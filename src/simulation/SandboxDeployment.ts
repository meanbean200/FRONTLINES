import {distance,type BattlefieldState,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {insideWorld} from '../terrain/WorldLayout';
import {addSquad} from './createBattlefield';
import {freshNeeds} from '../garrison/NeedsSystem';
import {inventory,RESOURCES} from '../garrison/types';

export type DeploymentKind='rifle'|'engineer';
export const SANDBOX_PERSONNEL_LIMIT=300;
export function deploymentPreview(state:BattlefieldState,terrain:TerrainSystem,kind:DeploymentKind,count:number,point:Vec2){
  const positions:Vec2[]=[];
  let reason='';
  if(state.operation)reason='This operation uses finite forces, not sandbox spawning.';
  else if(!state.living)reason='Supply accounting is not ready.';
  else if(!['rifle','engineer'].includes(kind)||![1,3,5].includes(count))reason='Choose 1, 3 or 5 rifle or engineer squads.';
  else if(state.soldiers.length+count*8>SANDBOX_PERSONNEL_LIMIT)reason=`Sandbox limit: ${SANDBOX_PERSONNEL_LIMIT} personnel. Choose a smaller group.`;
  else if(![point.x,point.z].every(Number.isFinite))reason='Choose a point on the battlefield.';
  if(!reason)for(let team=0;team<count;team++)for(let i=0;i<8;i++)positions.push({x:point.x+(team-(count-1)/2)*17+(i%4-1.5)*2,z:point.z+(Math.floor(i/4)-.5)*2});
  if(!reason&&positions.some(p=>!insideWorld(p,4)))reason='Leave space inside the battlefield edge.';
  if(!reason&&positions.some(p=>terrain.groundTypeAt(p.x,p.z)==='river'||terrain.obstacleAt(p.x,p.z,.8)||terrain.deformationAt(p.x,p.z)<-.35))reason='Choose clear, dry ground outside trenches and buildings.';
  if(!reason&&positions.some(p=>state.soldiers.some(s=>s.needs?.life!=='dead'&&distance(s,p)<1.2)))reason='Too close to existing troops · move the formation outline.';
  return {valid:!reason,reason:reason||`${count} ${kind==='rifle'?'rifle squad':'engineer team'}${count>1?'s':''} · ${count*8} personnel · click to place`,positions};
}
/** Explicit sandbox editing only. Does not alter operation rosters or replacement pools. */
export function deploySandbox(state:BattlefieldState,terrain:TerrainSystem,kind:DeploymentKind,count:number,point:Vec2){
  const preview=deploymentPreview(state,terrain,kind,count,point);if(!preview.valid)return {ids:[],reason:preview.reason};
  const ids:number[]=[];
  for(let team=0;team<count;team++){
    const points=preview.positions.slice(team*8,team*8+8),center={x:points.reduce((n,p)=>n+p.x,0)/8,z:points.reduce((n,p)=>n+p.z,0)/8};
    const number=state.squads.filter(q=>q.kind===kind).length+1,q=addSquad(state,kind,8,center.x,center.z,`${kind==='rifle'?'Rifle squad':'Engineer team'} ${number}`);q.faction='player';q.order.issuedAt=state.elapsed;ids.push(q.id);
    for(const [i,s] of state.soldiers.filter(s=>s.squadId===q.id).entries()){
      Object.assign(s,points[i]);s.cover=terrain.coverAt(s.x,s.z);s.needs=freshNeeds();s.needs.day=Math.floor(state.living!.campaignHours/24);
      s.carried=inventory({food:2,water:3,ammo:60});s.ammunition=60;
      // Explicitly added people bring starting kit: a recorded import, never a refill.
      for(const resource of RESOURCES)state.living!.ledger.imported[resource]+=s.carried[resource];
    }
  }
  return {ids,reason:`Placed ${count*8} personnel · click elsewhere to add another group · Esc finishes`};
}

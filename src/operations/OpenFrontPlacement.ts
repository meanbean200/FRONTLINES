import {hash2D} from '../core/random';
import type {Vec2} from '../core/types';
import {SETTLEMENTS} from '../terrain/WorldFeatures';
import {insideWorld,pointOnRoad,ROADS,roadRoute} from '../terrain/WorldLayout';
import {atDepth,frontDepth} from './OperationGeometry';
import {configuredDefinition,isNewOpenFront,type ResolvedBattleSetup} from './BattleSetup';
import type {DeploymentZone,OperationRuntime,OperationalObjective,StrategicLocation} from './OperationalTypes';

export const OPEN_FRONT_WORLD_SIZE=2400;
/** Initial conditions only. Legacy placement remains byte-for-byte reconstructible.
 * Rear objectives cover actual depots, never an arbitrary strip across the map. */
export function placeOpenFront(seed:number,setup:ResolvedBattleSetup):OperationRuntime {
  if(!isNewOpenFront(setup))throw new Error('Open Front rules v1 require an explicit new-battle setup.');
  const d=configuredDefinition('open-front',setup),direction=setup.advanced.direction;
  const angle=(direction==='auto'?Math.floor(hash2D(seed,29,177)*4):['east','south','west','north'].indexOf(direction))*Math.PI/2;
  const forward={x:Math.round(Math.cos(angle))||0,z:Math.round(Math.sin(angle))||0};
  const front={origin:{x:0,z:0},forward,right:{x:-forward.z||0,z:forward.x},beltDepth:300};
  const zones:DeploymentZone[]=[];
  const zone=(id:string,name:string,center:Vec2,halfWidth:number,halfDepth:number)=>{zones.push({id,name,center,halfWidth,halfDepth,forward:{...forward}});return id;};
  const road=ROADS.find(r=>r.id===(forward.x?'central-lateral':'central-crossing'))!;
  const reinforcements=(['player','enemy'] as const).map(side=>{
    const sign=(side==='player'?-1:1)*(forward.x||forward.z);
    return {side,rear:pointOnRoad(road,sign*1000),entry:pointOnRoad(road,sign*1180),reserve:setup.advanced.reserves,intervalHours:24,releaseLimit:8};
  });
  const locations:StrategicLocation[]=SETTLEMENTS.filter(p=>insideWorld(p,p.r+40,OPEN_FRONT_WORLD_SIZE)&&Math.abs(frontDepth(front,p))<760)
    .map(p=>({id:`town-${p.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,name:p.name,kind:'village' as const,position:{x:p.x,z:p.z},zoneId:zone(`town-${p.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,p.name,p,p.r+25,p.r+25)}));
  for(const source of reinforcements){
    const label=source.side==='player'?'FRIENDLY REAR DEPOT':'OPPOSING REAR DEPOT';
    locations.push({id:`${source.side}-rear`,name:label,kind:'rear',position:source.rear,zoneId:zone(`${source.side}-rear`,label,source.rear,110,100)});
    zone(`${source.side}-deployment`,`${source.side==='player'?'Friendly':'Opposing'} staging`,atDepth(front,d.deployment[source.side]),220,100);
  }
  zone('contested','Unsettled approaches',atDepth(front,0),550,250);
  const routes=reinforcements.map(source=>{
    const target=reinforcements.find(s=>s.side!==source.side)!.rear;
    return {id:`${source.side}-access`,name:'CENTRAL SUPPLY ROAD',side:source.side,points:[source.rear,...roadRoute(source.rear,target,undefined,OPEN_FRONT_WORLD_SIZE)],width:55,destination:{...target}};
  });
  const objectives:OperationalObjective[]=reinforcements.map(source=>({id:`${source.side}-intent`,side:source.side,priority:'primary',title:source.side==='player'?'BREAK THEIR SUPPLY ACCESS':'PROTECT YOUR REAR DEPOT',effect:'A sustained, connected force disables the opposing physical rear, not an empty map boundary.',spec:{type:'rear-collapse',zone:`${source.side==='player'?'enemy':'player'}-rear`,routes:[`${source.side}-access`],minimum:12,squads:2,holdSeconds:180}}));
  for(const p of locations.filter(l=>l.kind==='village'))objectives.push({id:`optional-${p.id}`,side:'player',priority:'optional',title:`Secure ${p.name}`,effect:'Finite local stock and a possible supply hub',spec:{type:'area-control',zones:[p.zoneId],required:1,minimum:5,holdSeconds:45}});
  return {version:2,definitionId:'open-front',seed,front,zones,locations,routes,reinforcements,objectives,
    victory:objectives.filter(o=>o.priority==='primary').map(o=>({side:o.side,objectives:[o.id]})),
    progress:objectives.map(o=>({id:o.id,heldFor:0,pressureFor:0,satisfied:false,complete:false,failed:false,reason:'Rear access intact'})),
    phase:'preparation',phaseSince:0,history:[{phase:'preparation',at:0,reason:'Both forces deployed on unprepared ground'}],routeAccess:{},nextEvaluation:0,lastEvaluation:0,
    openFront:{version:1,nextWorks:1,works:[]}};
}

import {clamp,distance,type BattlefieldState,type SoldierState,type Vec2} from '../core/types';
import type {Objective,Faction} from './types';
import {inZone,zoneCorners} from './OperationGeometry';
import {SETTLEMENTS} from '../terrain/WorldFeatures';

export function controlZone(state:BattlefieldState,o:Objective){
  const r=state.operation?.runtime,location=r?.locations.find(l=>l.id===o.id);
  // Legacy flag/cache placement was outside the labelled Saint-Martin centre.
  // Leave physical stock and saved coordinates intact; control covers the town.
  const town=!r&&!state.operation?.authored&&SETTLEMENTS.find(t=>t.name===o.name);
  if(town)return {id:o.id,name:o.name,center:{x:town.x,z:town.z},halfWidth:town.r,halfDepth:town.r,forward:{x:1,z:0}};
  return location&&r?.zones.find(z=>z.id===location.zoneId);
}
export function insideObjective(state:BattlefieldState,o:Objective,p:Vec2):boolean {
  const zone=controlZone(state,o);return zone?inZone(p,zone):distance(p,o)<=o.radius;
}
export function controlBoundary(state:BattlefieldState,o:Objective):Vec2[]{
  const zone=controlZone(state,o);
  if(!zone)return Array.from({length:80},(_,i)=>({x:o.x+Math.cos(i/80*Math.PI*2)*o.radius,z:o.z+Math.sin(i/80*Math.PI*2)*o.radius}));
  const corners=zoneCorners(zone);
  return corners.flatMap((p,i)=>{const next=corners[(i+1)%4],n=Math.ceil(distance(p,next)/10);return Array.from({length:n},(_,j)=>({x:p.x+(next.x-p.x)*j/n,z:p.z+(next.z-p.z)*j/n}));});
}
export function controlPeople(state:BattlefieldState,o:Objective,people:SoldierState[]=state.soldiers){
  const present=people.filter(s=>s.health>0&&s.needs?.life==='active'&&insideObjective(state,o,s));
  const counts={player:0,enemy:0},eligible={player:0,enemy:0};
  for(const s of present){const side=state.squads.find(q=>q.id===s.squadId)?.faction??'player';counts[side]++;if(s.suppression<75)eligible[side]++;}
  return {present,counts,eligible,minimum:state.operation?.runtime?5:3,seconds:state.operation?.runtime?45:35};
}
/** One owner/control value also gates access to the physical town stock. */
export function advanceControl(state:BattlefieldState,o:Objective,dt:number,people?:SoldierState[]):void {
  const {counts,eligible,minimum,seconds}=controlPeople(state,o,people);
  o.contested=counts.player>0&&counts.enemy>0||o.owner==='player'&&counts.enemy>0||o.owner==='enemy'&&counts.player>0;
  if(counts.player&&counts.enemy||Math.max(eligible.player,eligible.enemy)<minimum)return;
  o.control=clamp(o.control+(eligible.player?1:-1)*dt/seconds,-1,1);
  if(Math.abs(o.control)>=1)o.owner=o.control>0?'player':'enemy';
  else if(o.owner==='player'&&o.control<=0||o.owner==='enemy'&&o.control>=0)o.owner='neutral';
  if(o.owner==='player'&&!counts.enemy||o.owner==='enemy'&&!counts.player)o.contested=false;
}
export function controlReadout(state:BattlefieldState,o:Objective,side:Faction='player'){
  const {eligible,counts,minimum,seconds}=controlPeople(state,o),other=side==='player'?'enemy':'player';
  // A contest can be reported, but never disclose hidden hostile strength.
  const mixed=counts[side]>0&&counts[other]>0;
  const securing=!mixed&&eligible[side]>=minimum&&o.owner!==side;
  const hostileContest=o.owner===side&&counts[other]>0;
  const progress=Math.round((side==='player'?o.control+1:1-o.control)*50);
  const status=mixed||hostileContest?'CONTESTED':securing?`SECURING · ${progress}%`:o.owner===side?'FRIENDLY CONTROL':o.owner===other?'ENEMY CONTROL':'NEUTRAL';
  const reason=mixed||hostileContest?'Control area contested · clear the area':eligible[side]<minimum?`${eligible[side]} / ${minimum} able, unpinned personnel in control area`:securing?`${Math.ceil((side==='player'?1-o.control:1+o.control)*seconds)} simulation seconds remaining`:'Secured · physical supplies available';
  return {status,reason,progress};
}

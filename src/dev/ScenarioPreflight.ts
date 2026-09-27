import {validateScenario,type ScenarioPreset} from '../scenarios/ScenarioPreset';
import {AuthoringWorld} from './AuthoringWorld';
import {emptyScenarioWorld} from '../scenarios/instantiateScenario';
import {addSquad} from '../simulation/createBattlefield';
import {polylineLength,distance} from '../core/types';
import {trenchAnchorAt} from '../construction/PositionDefinitions';

export interface AuthoringIssue {entityId?:string;severity:'error'|'warning';message:string}
export const preflightDiagnostics={runs:0,lastMs:0,totalMs:0};
/** Explicit, aggregated preflight. Never constructs a production simulation or mutates a draft. */
export function preflight(p:ScenarioPreset):AuthoringIssue[]{
 preflightDiagnostics.runs++;const started=performance.now();
 try{return inspectGeometry(p);}finally{preflightDiagnostics.lastMs=performance.now()-started;preflightDiagnostics.totalMs+=preflightDiagnostics.lastMs;}
}
function inspectGeometry(p:ScenarioPreset):AuthoringIssue[]{
 const issues:AuthoringIssue[]=[];
 try{validateScenario(p);}catch(e){return [{severity:'error',message:String(e)}];}
 const world=new AuthoringWorld();world.sync(p);
 const add=(entityId:string,message:string,severity:'error'|'warning'='error')=>issues.push({entityId,message:`${p.entities.find(e=>e.id===entityId)?.name??entityId}: ${message}`,severity});
 const blocked=(v:{x:number;z:number})=>world.terrain.groundTypeAt(v.x,v.z)==='river'||Boolean(world.terrain.obstacleAt(v.x,v.z,.3));
 const componentSide=new Map<number,string>(),assigned=new Map<number,Set<string>>();
 const fronts=new Map<number,number>(),readiness=new Map<number,string>();
 for(const e of p.entities){
  if(e.type==='trench'){
   const t=world.state.trenches.find(t=>t.id===world.ids.get(e.id))!;
   if(polylineLength(t.points)<6)add(e.id,'Trench is shorter than 6 m. Extend it.');
   if(t.points.slice(1).some((b,i)=>{const a=t.points[i],n=Math.max(1,Math.ceil(distance(a,b)/2));return Array.from({length:n+1},(_,j)=>({x:a.x+(b.x-a.x)*j/n,z:a.z+(b.z-a.z)*j/n})).some(blocked);}))add(e.id,'Trench crosses water or a solid obstacle. Reshape the marked line.');
   const component=world.network.component(t.id);
   if(e.completed&&component===undefined)add(e.id,'No usable completed floor. Extend the trench.');
   if(component!==undefined){if(componentSide.has(component)&&componentSide.get(component)!==e.side)add(e.id,'Connected trenches have opposing owners. Separate them or change faction.');componentSide.set(component,e.side);}
   if(component!==undefined&&e.front!==undefined){const front=((e.front%360)+360)%360;if(fronts.has(component)&&Math.abs(fronts.get(component)!-front)>.0001)add(e.id,'Connected trenches need the same front direction.');fronts.set(component,front);}
   if(component!==undefined&&e.readiness!==undefined){if(readiness.has(component)&&readiness.get(component)!==e.readiness)add(e.id,'Connected trenches need the same readiness.');readiness.set(component,e.readiness);}
  }else if(e.type==='formation'){
   const state=emptyScenarioWorld(p.seed);addSquad(state,e.kind,e.count,e.x,e.z,e.name);
   if(state.soldiers.some(blocked))add(e.id,'Formation footprint overlaps water or a solid obstacle. Move the formation onto clear ground.');
   if((e.intent==='defend'||e.intent==='support')&&!e.targetId)add(e.id,'Guard has no target; the commander will choose an objective. Pick a target for a specific guard assignment.','warning');
   if(e.trenchId){const component=world.network.component(world.ids.get(e.trenchId)!);if(component===undefined)add(e.id,'Assigned trench has no usable completed floor. Complete it or clear the assignment.');else{const set=assigned.get(component)??new Set<string>();set.add(e.id);assigned.set(component,set);}}
   if(e.ammo===0)add(e.id,'No personal rifle ammunition. Finite local stock is required to resupply.','warning');
  }else if(e.type==='facility'){
   const t=world.state.trenches.find(t=>t.id===world.ids.get(e.trenchId))!,anchor=trenchAnchorAt(t,e),component=world.network.component(t.id);
   if(component===undefined)add(e.id,'Parent trench is unfinished. Complete it before installing the facility.');
   if(!anchor||anchor.distance>t.width/2)add(e.id,'Off the parent trench floor. Use Snap to trench or move it explicitly.');
   if(e.weapon&&!e.crewId)add(e.id,'Weapon has no assigned crew; it will not be ready to fire.','warning');
   if(e.weapon&&!(e.weapon==='crew-mg'?e.stock.ammo:e.stock.mortarHE||e.stock.mortarSmoke))add(e.id,'No local weapon ammunition. Add finite stock or arrange a reachable source.','warning');
   if(e.crewId&&component!==undefined){const set=assigned.get(component)??new Set<string>();set.add(e.crewId);assigned.set(component,set);}
  }else if(e.type==='stock'&&blocked(e))add(e.id,'Stock intersects water or a solid obstacle. Move it to clear terrain.');
 }
 for(const [component,ids] of assigned){const people=p.entities.reduce((n,e)=>n+(e.type==='formation'&&ids.has(e.id)?e.count:0),0),capacity=world.network.capacity(component);if(people>capacity)for(const id of ids)add(id,`Connected trench capacity ${capacity} is below ${people} assigned people. Extend the network or reduce assignments.`);}
 if(!p.entities.some(e=>e.type==='objective'))issues.push({severity:'warning',message:'No objective: commanders have no authored place to contest.'});
 return issues;
}

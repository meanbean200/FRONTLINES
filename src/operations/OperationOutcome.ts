import type {BattlefieldState,Vec2} from '../core/types';
import type {Faction,OperationState} from './types';

export interface DecisiveObjective {
  id:string;
  name:string;
  condition:string;
  locations:{id:string;name:string;center:Vec2;halfWidth?:number;halfDepth?:number;forward?:Vec2}[];
  heldFor?:number;
  requiredSeconds?:number;
  progress?:number;
  required?:number;
}
/** Captured by the evaluator, not reconstructed from a later battlefield. Locations
 * are public objective areas, never the hidden people who completed them. */
export interface OperationOutcome {
  version:1;
  status:'victory'|'defeat';
  side:Faction;
  at:number;
  simulationTime:number;
  event:'objectives-secured'|'rear-breached'|'force-exhausted'|'time-expired';
  objectives:DecisiveObjective[];
  explanation:string;
}
export function finishOperation(state:BattlefieldState,outcome:Omit<OperationOutcome,'version'|'at'|'simulationTime'>):void {
  const op=state.operation!;
  if(op.status!=='active')return;
  op.outcome=structuredClone({...outcome,version:1,at:op.elapsed,simulationTime:state.elapsed});
  op.status=outcome.status;op.reason=outcome.explanation;state.simSpeed=0;
}
export function operationTimestamp(seconds:number):string {
  const n=Math.floor(seconds);return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
}
export function validOperationOutcome(op:OperationState,elapsed:number):boolean {
  const r=op.outcome;if(r===undefined)return true; // Old results keep their original evidence.
  const number=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  const point=(p:Vec2|undefined)=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
  return !!r&&r.version===1&&r.status===op.status&&['victory','defeat'].includes(r.status)&&['player','enemy'].includes(r.side)&&
    number(r.at)&&r.at<=op.elapsed+.001&&number(r.simulationTime)&&r.simulationTime<=elapsed+.001&&
    ['objectives-secured','rear-breached','force-exhausted','time-expired'].includes(r.event)&&typeof r.explanation==='string'&&
    Array.isArray(r.objectives)&&r.objectives.length>0&&r.objectives.length<=32&&r.objectives.every(o=>o&&typeof o.id==='string'&&typeof o.name==='string'&&typeof o.condition==='string'&&
      [o.heldFor,o.requiredSeconds,o.progress,o.required].every(n=>n===undefined||number(n))&&Array.isArray(o.locations)&&o.locations.length<=32&&
      o.locations.every(l=>l&&typeof l.id==='string'&&typeof l.name==='string'&&point(l.center)&&(l.forward===undefined||point(l.forward))&&[l.halfWidth,l.halfDepth].every(n=>n===undefined||number(n))));
}

/** Current people and arrival manifests have different denominators. Never call
 * initial strength the capacity of the current formation. */
export function personnelReadout(state:BattlefieldState,side:Faction='player') {
  const ids=new Set(state.squads.filter(q=>(q.faction??'player')===side).map(q=>q.id));
  const people=state.soldiers.filter(s=>ids.has(s.squadId)&&s.needs?.life!=='dead'&&s.combat?.wound?.care!=='evacuated');
  const able=people.filter(s=>s.needs?.life==='active'&&s.health>=25&&!['disabling','critical','fatal'].includes(s.combat?.wound?.severity??'')).length;
  const arrivals=state.operation?.campaign?.replacements?.manifests.filter(m=>m.side===side&&m.stage==='arrived')??[];
  return {able,present:people.length,initial:side==='player'?state.operation!.initialPlayer:state.operation!.initialEnemy,
    replacements:new Set(arrivals.filter(m=>!m.returning).map(m=>m.personId)).size,returns:arrivals.filter(m=>m.returning).length};
}

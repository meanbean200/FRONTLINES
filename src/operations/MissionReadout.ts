import type {BattlefieldState} from '../core/types';
import type {OperationRuntime,OperationalObjective} from './OperationalTypes';
import type {DecisiveObjective} from './OperationOutcome';
import type {Faction} from './types';
import {operationTimestamp} from './OperationOutcome';

export interface MissionRule {id:string;side:Faction;title:string;condition:string;location:string;progress:string;warning:boolean}
const names=(r:OperationRuntime,ids:string[])=>ids.map(id=>r.zones.find(z=>z.id===id)?.name??id).join(' / ');
export function objectiveCondition(r:OperationRuntime,o:OperationalObjective):string {
  const s=o.spec;
  const effectiveness=r.victory.find(v=>v.side===o.side&&v.objectives.includes(o.id))?.opponentEffectivenessBelow;
  const enemy=o.side==='enemy';
  const extra=effectiveness===undefined?'':` ${enemy?'Your':'Opposing'} combat effectiveness must also fall to ${Math.round(effectiveness*100)}% of initial strength or less.`;
  switch(s.type){
    case 'rear-collapse':return `${enemy?'Opposing forces must keep':'Keep'} ${s.minimum} fit, armed personnel from ${s.squads} formations at the actual ${enemy?'friendly':'opposing'} rear depot, deny dispatch, and maintain an open road back to their own rear for ${s.holdSeconds} continuous seconds. Clearing the depot or cutting the attackers off stops the pressure. Empty edge territory does not count.`;
    case 'breakthrough':return `${enemy?'Opposing forces must keep':'Keep'} at least ${s.minimum} fit, armed personnel from ${s.squads} formations beyond ${enemy?'your rear':'the'} boundary, outnumbering ${enemy?'your defenders':'opposition'}, with an open road connection for ${s.holdSeconds} continuous seconds.`+extra;
    case 'area-control':return `${enemy?'Opposing forces must hold':'Hold'} ${s.required} of ${s.zones.length} areas with at least ${s.minimum} fit, armed personnel in each and no effective opposition for ${s.holdSeconds} continuous seconds.`+extra;
    case 'route-control':return `${enemy?'Opposing forces must keep':'Keep'} at least one named road corridor open for ${s.holdSeconds} continuous seconds.`+extra;
    case 'hold-line':return `Deny a connected enemy penetration of ${s.minimum} personnel from ${s.squads} formations for ${s.breachSeconds} seconds. Hold until ${operationTimestamp(s.duration)}, or keep the opposing effective force below four for 30 seconds.`;
    case 'physical-mission':return o.effect;
  }
}
export function decisiveObjective(r:OperationRuntime,o:OperationalObjective,pressure=false):DecisiveObjective {
  const s=o.spec,p=r.progress.find(p=>p.id===o.id)!,ids='zone' in s?[s.zone]:'zones' in s?s.zones:[];
  return {id:o.id,name:o.title,condition:objectiveCondition(r,o),locations:ids.map(id=>{
    const z=r.zones.find(z=>z.id===id)!;return {id:z.id,name:z.name,center:{...z.center},halfWidth:z.halfWidth,halfDepth:z.halfDepth,forward:{...z.forward}};
  }),heldFor:pressure?p.pressureFor:p.heldFor,requiredSeconds:s.type==='hold-line'?(pressure?s.breachSeconds:undefined):'holdSeconds' in s?s.holdSeconds:undefined};
}
/** Public mission conditions and progress only. No enemy coordinates or hidden
 * contact identities enter either the briefing or the live HUD. */
export function missionRules(r:OperationRuntime,elapsed=0):MissionRule[] {
  const plan=r.missionPlan,m=r.mission;
  if(plan){
    const modern=plan.version===3,seconds=modern?30:12;
    const condition=modern?(plan.kind==='meeting'?'Two fit occupants in each road house, no opposing occupants, and an open road.':plan.kind==='line-defense'?'Three fit defenders within 100 m of the road house, no enemy occupation, an open road and the actual assault repelled.':'Three fit occupants in the cleared enemy trench, two in the farmhouse and an open road.'):
      `Two fit occupants in the road house${plan.kind==='line-defense'?', repel the actual assault':', three in a completed nearby trench'}, an open road and an arrived truck delivery containing ammunition, food and water.`;
    const minimum=plan.kind==='line-defense'?(modern?3:2):plan.kind==='meeting'&&modern?4:5;
    return [{id:'player-mission',side:'player',title:'SECURE '+plan.place.toUpperCase(),condition:`${condition} Maintain all conditions for ${seconds} continuous seconds.`,location:plan.place,progress:`Consolidation ${Math.floor(m?.securedFor??0)} / ${seconds} s`,warning:false},
      {id:'enemy-mission',side:'enemy',title:'DENY YOUR FOOTHOLD',condition:`Two fit opposing occupants must hold ${modern&&plan.kind==='meeting'?'both road houses':'the road house'} without your occupants for 30 seconds.${plan.kind==='breakthrough'?' Only applies after you have first occupied the farm.':''}`,location:plan.place,progress:`Enemy occupation ${Math.floor(m?.breachedFor??0)} / 30 s`,warning:(m?.breachedFor??0)>0},
      {id:'force-minimum',side:'enemy',title:'LOSS OF FIELD STRENGTH',condition:`Defeat if fewer than ${minimum} people remain able to return to field duty. Serious wounds count; temporary exhaustion does not.`,location:'Your force',progress:'',warning:false}];
  }
  const rows:MissionRule[]=r.objectives.filter(o=>o.priority==='primary').map(o=>{
    const s=o.spec,p=r.progress.find(p=>p.id===o.id)!,location=names(r,'zone' in s?[s.zone]:'zones' in s?s.zones:[]);
    return {id:o.id,side:o.side,title:o.title,condition:objectiveCondition(r,o),location,progress:s.type==='hold-line'?`Relief ${operationTimestamp(Math.max(0,s.duration-elapsed))} · enemy penetration ${Math.floor(p.pressureFor)} / ${s.breachSeconds} s`:`${p.complete?'Hold met':'Continuous hold'} ${Math.floor(p.heldFor)} / ${'holdSeconds' in s?s.holdSeconds:0} s · ${p.reason}`,warning:o.side==='enemy'?p.satisfied:s.type==='hold-line'&&p.pressureFor>0};
  });
  const primary=r.objectives.find(o=>o.side==='player'&&o.priority==='primary');
  if(primary){const s=primary.spec,required=s.type==='breakthrough'||s.type==='rear-collapse'?s.minimum:s.type==='area-control'?s.minimum*s.required:3,squads=s.type==='breakthrough'||s.type==='rear-collapse'?s.squads:1;
    rows.push({id:'force-minimum',side:'enemy',title:'LOSS OF FIELD STRENGTH',condition:`Defeat if fewer than ${required} survivors or ${squads} formations remain and no replacement reserve or pending arrivals can restore them. Temporary suppression or rest does not count.`,location:'Your force',progress:'',warning:false});}
  return rows;
}
export function outcomeText(state:BattlefieldState):{title:string;detail:string;time:string} {
  const op=state.operation!,r=op.outcome;
  if(!r)return {title:op.status==='victory'?'Sector secured':'Operation ended',detail:op.reason,time:'Earlier result · no decisive-event record was saved.'};
  return {title:`${r.status==='victory'?'VICTORY':'DEFEAT'} — ${r.objectives[0].name}`,detail:r.explanation,time:`Decisive event at ${operationTimestamp(r.at)}`};
}

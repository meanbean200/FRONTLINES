import {distance,type BattlefieldState,type Vec2} from '../core/types';
import {commandEnemy,observeEnemy} from './EnemyCommander';
import {requestSupport} from '../combat/SupportWeapons';
import type {TerrainSystem} from '../terrain/TerrainSystem';

export interface CampaignPlan {
  phase:'scout'|'prepare'|'commit'|'reassess'|'consolidate'|'withdraw'|'recover';
  objectiveId:string;since:number;reviewAt:number;scoutId:number;forceIds:number[];
  startingAble:number;attempts:number;reason:string;nextSupport:number;
}
/** Own force state, delivered reports, known terrain and public objectives only. */
export function commandCampaign(state:BattlefieldState,terrain:TerrainSystem,move:(ids:number[],p:Vec2)=>void,hold:(ids:number[])=>void,occupy:(ids:number[],trench:number)=>boolean):void {
  const op=state.operation!,c=op.campaign!,now=state.elapsed;
  const home=state.living!.garrisons.find(g=>g.trenchId===c.enemyTrench&&g.faction==='enemy');if(!home)return;
  const observation=observeEnemy(state),own=observation.squads,byId=new Map(own.map(q=>[q.id,q]));
  const ready=own.filter(q=>q.kind==='rifle'&&q.able>=5&&q.energy>45&&q.ammo>=20&&q.morale>45&&q.suppression<25).sort((a,b)=>a.id-b.id);
  let plan=c.plan;
  const issue=(ids:number[],goal:Vec2)=>{for(const id of ids){const q=state.squads.find(q=>q.id===id);if(q&&(!q.order.target||distance(q.order.target,goal)>8||q.order.type!=='move')&&distance(q,goal)>8)move([id],goal);}};
  if(!plan){
    if(op.elapsed<c.nextRaid||ready.length<3)return;
    const objective=op.objectives.find(o=>o.id==='village'&&o.owner!=='enemy')??op.objectives.find(o=>o.id==='west-hq')!;
    const selected=ready.slice(-2),gun=own.find(q=>q.kind==='machinegun'&&q.able>=2&&q.ammo>15);
    plan=c.plan={phase:'scout',objectiveId:objective.id,since:now,reviewAt:now+120,scoutId:selected[0].id,forceIds:[...selected.map(q=>q.id),...(gun?[gun.id]:[])],startingAble:selected.reduce((n,q)=>n+q.able,0)+(gun?.able??0),attempts:1,reason:'Scout the objective; keep two rifle squads protecting the line',nextSupport:now};
    c.raidSquads=[...plan.forceIds];c.phase='raiding';op.enemyAI=undefined;
  }
  const objective=op.objectives.find(o=>o.id===plan!.objectiveId)!;
  const force=own.filter(q=>plan!.forceIds.includes(q.id)),able=force.reduce((n,q)=>n+q.able,0);
  const reports=observation.contacts.filter(r=>now-r.lastSeen<12&&r.active);
  const threatHome=reports.filter(r=>distance(r,home.entrance)<180).length>=3;
  const exhausted=able<plan.startingAble*.6||force.some(q=>q.energy<25||q.ammo<6||q.morale<24);
  const change=(phase:CampaignPlan['phase'],reason:string,after:number)=>{plan!.phase=phase;plan!.since=now;plan!.reviewAt=now+after;plan!.reason=reason;};
  if(!['withdraw','recover'].includes(plan.phase)&&(exhausted||threatHome))change('withdraw',threatHome?'Reinforce threatened supply access and command post':'Abort: casualties, cohesion or ammunition no longer support the attack',180);
  if(plan.phase==='scout'){
    const scout=byId.get(plan.scoutId),d=Math.max(1,distance(home.entrance,objective));
    const vantage={x:objective.x+(home.entrance.x-objective.x)/d*110,z:objective.z+(home.entrance.z-objective.z)/d*110};
    issue([plan.scoutId],vantage);
    if(scout&&(distance(scout,vantage)<20||reports.some(r=>distance(r,objective)<180))||now>=plan.reviewAt)change('prepare','Bring up support while the scout observes',90);
  }
  if(plan.phase==='prepare'){
    const d=Math.max(1,distance(home.entrance,objective)),stage={x:objective.x+(home.entrance.x-objective.x)/d*140,z:objective.z+(home.entrance.z-objective.z)/d*140};
    issue(plan.forceIds.filter(id=>id!==plan!.scoutId),stage);
    const nearby=force.filter(q=>distance(q,stage)<60);
    if(nearby.length>=2)change('commit','Advance with support; reassess losses and progress',150);
    else if(now>=plan.reviewAt)change('withdraw','Support failed to assemble; do not feed squads in separately',180);
  }
  if(plan.phase==='commit'){
    observation.squads=force;observation.objectives=observation.objectives.filter(o=>o.id===objective.id);
    const result=commandEnemy(observation,terrain,op.enemyAI);op.enemyAI=result.memory;
    for(const cmd of result.commands)if(cmd.type==='move')move([cmd.squadId],cmd.goal);else hold([cmd.squadId]);
    if(objective.owner==='enemy'&&!objective.contested)change('consolidate','Secure the village and its physical supply cache',120);
    else if(now>=plan.reviewAt)change('reassess','Review progress before committing more people',12);
  }
  if(plan.phase==='reassess'&&now>=plan.reviewAt){
    const supported=force.some(q=>(q.effectiveUntil??0)>now),close=force.some(q=>distance(q,objective)<80);
    if(plan.attempts<2&&(close||supported)&&!exhausted){plan.attempts++;change('commit','Limited renewed effort with actual support or a foothold',90);}
    else change('withdraw','No sustainable progress; withdraw and recover before another plan',180);
  }
  if(plan.phase==='consolidate'){
    const guard=force.find(q=>q.kind==='rifle'),building=terrain.buildings.filter(b=>distance(b,objective)<40).sort((a,b)=>distance(a,objective)-distance(b,objective))[0];
    if(guard){const q=state.squads.find(q=>q.id===guard.id)!;if(!q.order.building)issue([guard.id],building??objective);}
    const returning=plan.forceIds.filter(id=>id!==guard?.id);issue(returning,home.entrance);
    for(const id of returning)if(byId.get(id)&&distance(byId.get(id)!,home.entrance)<80&&!home.squadIds.includes(id))occupy([id],c.enemyTrench);
    if(objective.owner!=='enemy')change('withdraw','Lost foothold; recover a coherent force',180);
    else if(now>=plan.reviewAt){c.nextRaid=op.elapsed+300;delete c.plan;c.phase='preparing';c.raidSquads=[];return;}
  }
  if(plan.phase==='withdraw'){
    c.phase='returning';issue(plan.forceIds,home.entrance);
    for(const id of plan.forceIds)if(byId.get(id)&&distance(byId.get(id)!,home.entrance)<80&&!home.squadIds.includes(id))occupy([id],c.enemyTrench);
    if(plan.forceIds.every(id=>!byId.has(id)||home.squadIds.includes(id)))change('recover','Recover the force after an unsuccessful attack',300);
  }
  if(plan.phase==='recover'&&now>=plan.reviewAt){c.lastPlan={objectiveId:plan.objectiveId,reason:plan.reason,at:now};delete c.plan;c.phase='preparing';c.raidSquads=[];c.nextRaid=op.elapsed+180;}
  // No hidden target coordinates or bypass of the player-equivalent friendly-fire check.
  if(['prepare','commit'].includes(plan.phase)&&now>=plan.nextSupport){
    plan.nextSupport=now+30;const target=reports.find(r=>distance(r,objective)<100);
    const mortar=own.find(q=>q.kind==='mortar'&&q.able>=2);
    if(target&&mortar)requestSupport(state,'mortarHE',mortar.id,{x:target.x,z:target.z});
  }
}

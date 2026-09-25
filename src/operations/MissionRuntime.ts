import {distance,polylineLength,type BattlefieldState} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import type {Faction} from './types';
import {type MissionState} from './MissionContent';
import {operationalForces,updateRouteAccess} from './OperationalRuntime';

/** One-second fixed-clock mission checks, separate from soldier AI and weapon rules.
 * Object possession requires physically present people. No score circles or hidden
 * enemy coordinates are passed to the commander or normal objective readout. */
export function stepPhysicalMission(state:BattlefieldState,terrain:TerrainSystem):void {
  const op=state.operation!,r=op.runtime!,plan=r.missionPlan!,m=r.mission!;
  if(op.elapsed+1e-8<r.nextEvaluation)return;
  const dt=Math.max(0,op.elapsed-r.lastEvaluation);r.lastEvaluation=op.elapsed;r.nextEvaluation=op.elapsed+1;
  const sideBySquad=new Map(state.squads.map(q=>[q.id,q.faction??'player']));
  const people=(side:Faction)=>state.soldiers.filter(s=>sideBySquad.get(s.squadId)===side&&s.needs?.life==='active'&&s.health>=25);
  const friendly=people('player'),enemy=people('enemy'),forces=operationalForces(state);
  updateRouteAccess(r,terrain,forces);
  const contacts=op.intelligence?.command.player??op.contacts?.player??[];
  const incoming=friendly.some(s=>(s.combat?.lastIncoming??-Infinity)>state.elapsed-10);
  if(m.contactAt===undefined&&(incoming||contacts.some(c=>c.active&&c.visible)))m.contactAt=op.elapsed;
  const housePeople=(side:Faction)=>people(side).filter(s=>s.building?.id===plan.houseId&&s.building.stage==='station'&&!s.building.exitRequested);
  const holdsHouse=housePeople('player').length>=2&&housePeople('enemy').length===0;
  const enemyHouse=housePeople('enemy').length>=2&&housePeople('player').length===0;
  if(holdsHouse)m.houseTaken=true;
  const ownAreas=state.living!.garrisons.filter(g=>g.faction!=='enemy'&&distance(g.entrance,plan.house)<220);
  const realLine=state.trenches.filter(t=>t.status==='complete'&&polylineLength(t.points)>=25&&t.points.some(p=>distance(p,plan.house)<240));
  // Creation smooths survey vertices but preserves the line's two endpoints.
  const objectiveLines=plan.kind==='breakthrough'?realLine.filter(t=>plan.prepared.some(p=>p.side==='enemy'&&distance(p.points[0],t.points[0])<.001&&distance(p.points.at(-1)!,t.points.at(-1)!)<.001)):realLine;
  const line=objectiveLines.some(t=>friendly.filter(s=>terrain.isPointInConstructedTrench(s,t,t.width/2)).length>=3&&!enemy.some(s=>terrain.isPointInConstructedTrench(s,t,t.width/2)));
  // A delivery timestamp is written only by actual truck unloading, never the mission.
  const supplied=ownAreas.some(g=>(g.lastDeliveryAt??0)>0&&(g.cache.ammo+g.forwardStock.ammo)>=24&&(g.cache.food+g.forwardStock.food)>0&&(g.cache.water+g.forwardStock.water)>0);
  const route=r.routes.some(route=>route.side==='player'&&r.routeAccess[route.id]);
  m.checks={house:holdsHouse,line,supply:supplied,road:route};
  if(line)m.lineTaken=true;
  const attackRepelled=m.contactAt!==undefined&&op.elapsed-m.contactAt>30&&
    (enemy.length===0||r.commander?.phase==='withdrawing'&&op.elapsed-r.commander.since>25)&&!enemy.some(s=>distance(s,plan.house)<100);
  const secondHeld=plan.secondHouseId!==undefined&&friendly.filter(s=>s.building?.id===plan.secondHouseId&&s.building?.stage==='station').length>=2&&!enemy.some(s=>s.building?.id===plan.secondHouseId&&s.building?.stage==='station');
  const defenseHeld=friendly.filter(s=>distance(s,plan.house)<100).length>=3&&!enemyHouse;
  if(plan.version===3){m.checks.secondary=secondHeld;m.checks.defense=defenseHeld;}
  const satisfied=plan.version===3?(plan.kind==='line-defense'?defenseHeld&&route&&attackRepelled:plan.kind==='meeting'?holdsHouse&&secondHeld&&route:holdsHouse&&line&&route):plan.kind==='line-defense'?holdsHouse&&supplied&&route&&attackRepelled:holdsHouse&&line&&supplied&&route;
  m.securedFor=satisfied?m.securedFor+dt:0;
  // Losing the billet must be an actual hostile occupation, not a remote ownership flag.
  // A defended farm starts in hostile hands. That is the attack's problem to
  // solve, not an automatic defeat while the attacker is still approaching.
  const enemySecond=plan.secondHouseId!==undefined&&enemy.filter(s=>s.building?.id===plan.secondHouseId&&s.building?.stage==='station').length>=2&&!friendly.some(s=>s.building?.id===plan.secondHouseId&&s.building?.stage==='station');
  m.breachedFor=enemyHouse&&(plan.kind!=='breakthrough'||m.houseTaken)&&(plan.version!==3||plan.kind!=='meeting'||enemySecond)?m.breachedFor+dt:0;
  let phase:MissionState['phase'],reason:string;
  if(plan.kind==='line-defense'&&op.elapsed<plan.preparationSeconds){phase='preparation';reason=`${Math.ceil(plan.preparationSeconds-op.elapsed)} s before enemy scouts advance. Choose your line, occupy the billet, build and crew support.`;}
  else if(plan.kind==='breakthrough'&&!m.lineTaken){phase=m.contactAt===undefined?'contact':'line';reason='Scout the farm approach. Put at least three fit soldiers inside the defended trench after clearing it.';}
  else if(!holdsHouse){phase='building';reason=`Occupy the road house at ${plan.place}: click the building, choose a formation and Occupy. Two fit people must reach firing positions.`;}
  else if(!line&&plan.kind!=='line-defense'){phase='line';reason='Establish a completed trench near the hamlet with at least three fit occupants. Choose the ground and facing.';}
  else if(!supplied||!route){phase='sustain';reason=!route?'The billet supply approach is interrupted. Inspect the road and restore access.':'Bring a truck shipment to a nearby defended trench. Ammunition, food and water must actually arrive.';}
  else {phase='contact';reason=plan.kind==='line-defense'?'Billet supplied. Repel the finite assault; protect the approaches and recover your people.':'Building and field position established. Keep both secure while the road is checked.';}
  if(plan.version===3){
    if(plan.kind==='line-defense'){
      phase=op.elapsed<plan.preparationSeconds?'preparation':'contact';reason=phase==='preparation'?`${Math.ceil(plan.preparationSeconds-op.elapsed)} s to enemy advance · choose the line, support weapons and reserve.`:!defenseHeld?'Keep three fit defenders near the road house. Use buildings, trenches or cover; deny enemy occupation.':!route?'The road approach is cut. Restore access while holding the position.':attackRepelled?'Assault repelled · securing the road.':'Defend the road approaches. The enemy must actually attack and be repelled.';
    }else if(plan.kind==='meeting'){
      phase=!holdsHouse||!secondHeld?'building':'sustain';reason=!holdsHouse?'Secure Road House A with two fit occupants. Scout before crossing exposed ground.':!secondHeld?'Road House A occupied. Secure Junction House B with another formation.':!route?'Both houses held; clear the road approach.':`Both houses held · consolidate ${Math.floor(m.securedFor)} / 30 s.`;
    }else{phase=!line?'line':!holdsHouse?'building':'sustain';reason=!line?'Scout the earthworks; stage support and assault groups. WAIT preserves orders until your GO signal. Clear and hold the trench with three fit soldiers.':!holdsHouse?'Line occupied. Secure the overlooking farmhouse with two fit soldiers.':!route?'Position occupied; clear the road approach.':`Trench and farmhouse held · consolidate ${Math.floor(m.securedFor)} / 30 s.`;}
  }
  // These are finite-force operations: serious casualties require evacuation
  // and cannot return during this battle. Count temporary exhaustion as
  // recoverable, not as defeat. House and line need distinct physical people.
  const minimum=plan.kind==='line-defense'?(plan.version===3?3:2):plan.kind==='meeting'&&plan.version===3?4:5;
  const viable=state.soldiers.filter(s=>sideBySquad.get(s.squadId)==='player'&&s.needs?.life!=='dead'&&!['disabling','critical','fatal'].includes(s.combat?.wound?.severity??'')).length;
  const finish=(status:'victory'|'defeat',message:string)=>{op.status=status;op.reason=message;state.simSpeed=0;phase=status==='victory'?'secured':'lost';reason=message;};
  if(viable<minimum)finish('defeat',`Fewer than ${minimum} field-capable people remain. Serious casualties cannot return during this operation; the remaining force cannot secure its objectives.`);
  else if(m.breachedFor>=30)finish('defeat','The opposing force occupied the road house. The supply foothold has been lost.');
  else if(m.securedFor>=(plan.version===3?30:12))finish('victory',plan.version===3?(plan.kind==='line-defense'?'The assault broke. Your defenders hold the supply road.':plan.kind==='meeting'?'Both road houses and the junction approach are secured.':'The defended trench and overlooking farmhouse are secured.'):plan.kind==='line-defense'?'The attack withdrew. Your billet remains occupied and physically supplied.':'The house, field position and supply road form a sustained foothold.');
  if(m.phase!==phase){m.phase=phase;m.history.push({phase,at:op.elapsed,reason});if(m.history.length>32)m.history.shift();}
  m.reason=reason;
  r.phase=op.status==='victory'?'consolidation':op.status==='defeat'?'withdrawal':phase==='preparation'?'preparation':phase==='sustain'?'consolidation':phase==='contact'?'contact':'engagement';
  const progress=r.progress[0];progress.satisfied=satisfied;progress.heldFor=m.securedFor;progress.pressureFor=m.breachedFor;progress.reason=reason;progress.complete=op.status==='victory';progress.failed=op.status==='defeat';
}

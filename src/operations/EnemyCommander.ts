import {distance,type BattlefieldState,type CoverType,type Vec2} from '../core/types';
import {hash2D} from '../core/random';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {lineOfFire} from './Visibility';
import {factionOf,type Contact,type OperationMode} from './types';
import {configuredDefinition} from './BattleSetup';
import type {OperationalKnowledge} from './OperationalCommander';
import {squadHasEquipment} from '../combat/Equipment';
import {weaponPositionReadiness,crewAt,assignedWeaponPosition,currentWeapon} from '../combat/WeaponPositions';

export const ENEMY_AI_VERSION=1;
export const ENEMY_ROLES=['defend','advance','support','flank','withdraw','resupply','search','pinned'] as const;
export type EnemyRole=typeof ENEMY_ROLES[number];
export interface EnemyPlan {
  squadId:number;role:EnemyRole;objectiveId:string;goal:Vec2;home:Vec2;
  since:number;commitUntil:number;lastIssued:number;lastPosition:Vec2;stalledFor:number;
  reason:string;orders:number;
}
export interface EnemyMemory {version:1;decisions:number;plans:EnemyPlan[]}
export interface OwnSquad extends Vec2 {
  buildingOrder?:number;
  id:number;able:number;initial:number;health:number;morale:number;energy:number;suppression:number;ammo:number;
  moving:boolean;planning:boolean;orderTarget?:Vec2;
  kind?:import('../core/types').SquadKind;effectiveUntil?:number;
  mortar?:boolean;mortarAmmo?:number;automatic?:boolean;
  working?:boolean;supportBusy?:boolean;
  emplaced?:boolean;mortarReady?:boolean;
}
export interface KnownObjective extends Vec2 {id:string;radius:number;owner:'player'|'enemy'|'neutral';contested:boolean;ammo:number}
export interface EnemyObservation {
  at:number;seed:number;mode:OperationMode;squads:OwnSquad[];contacts:Contact[];objectives:KnownObjective[];
  operational?:OperationalKnowledge;
  assignments?:{squadId:number;objectiveId:string;goal:Vec2;defend:boolean}[];
}
export interface EnemyCommand {squadId:number;type:'move'|'hold';goal:Vec2;role:EnemyRole;reason:string}

/** Information firewall: no opposing live soldier, health, route or order enters the planner. */
export function observeEnemy(state:BattlefieldState):EnemyObservation {
  const op=state.operation!;
  const observation:EnemyObservation={at:state.elapsed,seed:state.seed,mode:op.mode,
    squads:state.squads.filter(q=>factionOf(q)==='enemy').map(q=>{
      const people=state.soldiers.filter(s=>s.squadId===q.id&&s.health>0&&s.needs?.life==='active');
      const mean=(f:(s:typeof people[number])=>number)=>people.reduce((n,s)=>n+f(s),0)/Math.max(1,people.length);
      // Keep the prepared area's support detail in place while its engineers build;
      // the ordinary maneuver groups still receive tactical movement orders.
      const supportDetail=q.order.type==='occupy-trench'&&people.some(s=>s.equipment?.mortar||s.equipment?.weapon==='crew-mg')&&state.living!.garrisons.some(g=>g.squadIds.includes(q.id));
      const mortar=assignedWeaponPosition(state,q.id,'mortar');
      return {id:q.id,x:q.x,z:q.z,kind:q.kind,emplaced:supportDetail||state.living!.facilities.some(f=>crewAt(state,f).some(s=>s.squadId===q.id)),mortarReady:!weaponPositionReadiness(state,q.id,'mortar'),working:q.order.type==='construct-trench'||q.order.type==='occupy-trench'&&squadHasEquipment(state,q,'tools')&&state.living!.facilities.some(f=>f.progress<1&&state.living!.garrisons.some(g=>g.id===f.garrisonId&&g.squadIds.includes(q.id))),supportBusy:op.supportMissions?.some(m=>m.squadId===q.id&&m.stage==='preparing')??false,mortar:Boolean(mortar?.installation)||squadHasEquipment(state,q,'mortar'),mortarAmmo:mortar?.stock.mortarHE??people.reduce((n,s)=>n+(s.carried?.mortarHE??0),0),automatic:Boolean(assignedWeaponPosition(state,q.id,'emplacement')?.installation)||squadHasEquipment(state,q,'automatic'),effectiveUntil:Math.max(0,...people.map(s=>currentWeapon(state,s)?.effectiveUntil??0)),able:people.length,initial:q.soldierIds.length,health:mean(s=>s.health),morale:mean(s=>s.morale),energy:mean(s=>s.needs!.energy),suppression:mean(s=>s.suppression),ammo:mean(s=>s.carried?.ammo??0),moving:q.order.type==='move',planning:q.movementState==='planning',orderTarget:q.order.target?{...q.order.target}:undefined};
    }).filter(q=>q.able>0),
    contacts:(op.intelligence?.command.enemy??op.contacts?.enemy??[]).filter(c=>c.active&&state.elapsed-c.lastSeen<=12).map(c=>({...c})),
    // Flag ownership is public to both players. Enemy-owned caches are finite friendly stock.
    objectives:op.runtime?[]:op.objectives.map(o=>({id:o.id,x:o.x,z:o.z,radius:o.radius,owner:o.owner,contested:o.contested,ammo:o.owner==='enemy'?(state.living!.crates.find(c=>c.id===o.cacheId)?.stock.ammo??0):0}))};
  for(const own of observation.squads){const building=state.squads.find(q=>q.id===own.id)?.order.building;if(building)own.buildingOrder=building.id;}
  if(op.runtime){
    const r=op.runtime,d=configuredDefinition(r.definitionId,op.setup);
    observation.objectives=op.objectives.map(site=>{
      const present=observation.squads.some(q=>distance(q,site)<160),reported=observation.contacts.some(c=>distance(c,site)<180);
      return {id:site.id,x:site.x,z:site.z,radius:180,owner:present&&!reported?'enemy':reported?'player':'neutral',contested:present&&reported,
        ammo:present&&!reported?(state.living!.crates.find(c=>c.id===site.cacheId)?.stock.ammo??0):0};
    });
    observation.operational={intent:d.enemyIntent,front:structuredClone(r.front),rear:{...r.reinforcements.find(s=>s.side==='enemy')!.rear},deploymentDepth:d.deployment.enemy,
      targets:d.enemyIntent==='contest'?r.locations.filter(l=>l.kind==='village').map(l=>({id:l.id,point:{...l.position}})):
        r.routes.filter(route=>route.side==='enemy').map(route=>({id:'player-rear',point:{...route.destination}}))};
    if(r.missionPlan){const m=r.missionPlan;
      observation.operational.deploymentDepth=m.deployment.enemy;
      observation.operational.mission={kind:m.kind,houseId:m.houseId,house:{...m.house},...(m.secondHouse?{secondHouseId:m.secondHouseId,secondHouse:{...m.secondHouse}}:{}),preparationSeconds:m.preparationSeconds,frontage:m.frontage};
      observation.operational.targets=[{id:'mission-house',point:{...m.house}}];
    }
  }
  return observation;
}

type Ground=Pick<TerrainSystem,'coverAt'|'groundTypeAt'|'obstacleAt'|'baseHeightAt'|'clampToWorld'|'heightAt'|'objects'>;
const shelter=(c:CoverType)=>c==='trench'?1:c==='forest'?.65:c==='low-ground'?.4:0;
const point=(p:Vec2):Vec2=>({x:p.x,z:p.z});

/** Bounded local placement. Navigation still validates the complete route before anybody moves. */
function position(terrain:Ground,anchor:Vec2,from:Vec2,others:Vec2[],threat?:Vec2,radius=24,retreat=false,variant=0):Vec2 {
  const candidates=[point(anchor),point(from)];
  for(const r of [radius*.5,radius])for(let i=0;i<12;i++){
    const angle=(i+variant*.37)*Math.PI/6;
    candidates.push(terrain.clampToWorld({x:anchor.x+Math.sin(angle)*r,z:anchor.z+Math.cos(angle)*r}));
  }
  let best=point(from),score=-Infinity;
  for(const p of candidates){
    if(distance(p,anchor)>radius*1.5+1)continue;
    if(terrain.obstacleAt(p.x,p.z,3)||terrain.groundTypeAt(p.x,p.z)==='river')continue;
    // Reward cover broad enough for people, not only a single protected centre pixel.
    const cover=[p,{x:p.x+4,z:p.z},{x:p.x-4,z:p.z},{x:p.x,z:p.z+3},{x:p.x,z:p.z-3}].reduce((n,v)=>n+shelter(terrain.coverAt(v.x,v.z)),0)/5;
    let value=cover*24-distance(p,anchor)*.48-distance(p,from)*.06;
    for(const other of others)value-=Math.max(0,17-distance(p,other))*2;
    if(threat){
      const d=distance(p,threat),clear=lineOfFire(terrain as TerrainSystem,p,threat);
      value+=retreat?Math.min(180,d)*.12+(clear?-15:12):(clear?10:-8)-Math.abs(d-95)*.07;
      if(!retreat&&d<25)value-=35;
    }
    if(value>score){score=value;best=p;}
  }
  return best;
}

/** Deterministic tactical AI, not a trained policy. Mutable memory contains only its own plans. */
export function commandEnemy(o:EnemyObservation,terrain:Ground,previous?:EnemyMemory):{memory:EnemyMemory;commands:EnemyCommand[]} {
  const memory:EnemyMemory=previous?structuredClone(previous):{version:ENEMY_AI_VERSION,decisions:0,plans:[]};
  memory.decisions++;
  memory.plans=memory.plans.filter(p=>o.squads.some(q=>q.id===p.squadId));
  const commands:EnemyCommand[]=[],assigned=new Map<string,number>(),claimed:Vec2[]=[];
  const visible=o.contacts.filter(c=>c.visible),elapsedSince=(plan:EnemyPlan)=>Math.max(0,o.at-plan.lastIssued);
  for(const [index,q] of o.squads.entries()){
    if(q.working||q.supportBusy)continue;
    let old=memory.plans.find(p=>p.squadId===q.id);
    const contact=visible.filter(c=>distance(q,c)<360).sort((a,b)=>distance(q,a)-distance(q,b)||a.soldierId-b.soldierId)[0];
    const remembered=o.contacts.filter(c=>!c.visible&&distance(q,c)<300).sort((a,b)=>b.lastSeen-a.lastSeen)[0];
    const nearest=contact?distance(q,contact):Infinity;
    const weak=q.able<3||q.morale<25||q.energy<18||q.health<32;
    const shock=q.able<=q.initial*.45&&nearest<145;
    const emergency=(weak||shock)&&nearest<180||q.ammo<4&&nearest<145||q.suppression>72;
    if(q.buildingOrder!==undefined&&!emergency)continue;
    if(q.emplaced&&!emergency)continue;
    if(old){
      old.stalledFor=!q.planning&&distance(q,old.goal)>6&&distance(q,old.lastPosition)<.6?old.stalledFor+3:0;
      old.lastPosition=point(q);
      // Travelling, purposeful commitments survive brief observation changes and saves.
      const validSupply=old.role!=='resupply'||o.objectives.some(p=>p.id===old.objectiveId&&p.owner==='enemy'&&!p.contested&&p.ammo>0);
      if(o.at<old.commitUntil&&!emergency&&!(o.operational&&contact&&old.role==='advance')&&old.stalledFor<15&&validSupply){
        if(old.role==='resupply'&&!q.moving&&q.ammo>=32)old.commitUntil=o.at;
        else {assigned.set(old.objectiveId,(assigned.get(old.objectiveId)??0)+1);claimed.push(old.goal);continue;}
      }
    }
    const assignment=o.assignments?.find(a=>a.squadId===q.id);
    const objective=assignment?{...o.objectives.find(p=>p.id===assignment.objectiveId)!,...assignment.goal}:[...o.objectives].sort((a,b)=>{
      const score=(p:KnownObjective)=>{
        const pressure=visible.filter(c=>distance(c,p)<p.radius+60).length;
        return (p.id==='village'?o.mode==='defense'?150:60:30)+(p.contested?20:0)+(o.mode==='advance'&&p.owner==='enemy'?25:0)+Math.min(24,pressure*3)-distance(q,p)*.13-(assigned.get(p.id)??0)*38;
      };
      return score(b)-score(a)||a.id.localeCompare(b.id);
    })[0];
    if(!objective)continue;
    const home=old?.home??point(q),variant=old?.stalledFor&&old.stalledFor>=15?(old.orders+1)%12:0;
    let role:EnemyRole='advance',reason='Advance on assigned objective',goal:Vec2=point(objective),commit=14;
    const cache=[...o.objectives].filter(p=>p.owner==='enemy'&&!p.contested&&p.ammo>0).sort((a,b)=>distance(q,a)-distance(q,b))[0];
    if((weak||shock||q.ammo<4)&&contact){
      role='withdraw';reason=q.ammo<4?'Disengage: ammunition exhausted':shock?'Disengage after heavy squad losses':'Disengage: people unfit for an assault';commit=22;
      const d=Math.max(1,nearest),away={x:q.x+(q.x-contact.x)/d*65,z:q.z+(q.z-contact.z)/d*65};
      goal=position(terrain,away,q,claimed,contact,22,true,variant);
    }else if(q.suppression>72){
      role='pinned';reason='Pinned: return fire or reach immediately nearby cover';commit=8;
      goal=position(terrain,q,q,claimed,contact,9,true,variant);
    }else if((q.ammo<12||old?.role==='resupply'&&q.ammo<32)&&cache){
      role='resupply';reason='Return to a finite captured ammunition cache';goal=point(cache);commit=24;
      // Stay at the loading point until enough real rounds have transferred.
      if(old?.role==='resupply'&&old.objectiveId===cache.id&&distance(q,old.goal)<12)goal=old.goal;
    }else if((weak||q.ammo<4)&&!contact){
      role='withdraw';reason=q.ammo<4?'No reachable friendly ammunition cache; hold back':'Rally under cover; avoid committing an unfit squad';commit=24;
      goal=old?.role==='withdraw'?old.goal:position(terrain,home,q,claimed,undefined,20,true,variant);
    }else if(contact){
      const support=o.squads.some(other=>other.id!==q.id&&(other.effectiveUntil??0)>o.at&&other.able>=3&&other.ammo>=4&&other.health>=32&&other.morale>=25&&other.energy>=18&&!other.moving&&other.suppression<65&&distance(other,q)<145&&distance(other,contact)<360&&lineOfFire(terrain as TerrainSystem,other,contact)&&!commands.some(c=>c.squadId===other.id&&c.type==='move'));
      const canFlank=index%2===1&&support&&nearest>45&&q.suppression<45&&q.able>=Math.max(3,q.initial*.5)&&old?.role!=='flank';
      if(canFlank){
        role='flank';reason='Move around observed contact while another squad covers';commit=20;
        const dx=(q.x-contact.x)/Math.max(1,nearest),dz=(q.z-contact.z)/Math.max(1,nearest),side=hash2D(q.id,0,o.seed)>.5?1:-1;
        const anchor={x:contact.x+dx*75+dz*42*side,z:contact.z+dz*75-dx*42*side};
        goal=position(terrain,anchor,q,claimed,contact,14,false,variant);
      }else{
        role='support';reason=support?'Hold a firing position; cover the maneuvering squad':'Establish a firing position on an observed contact';commit=12;
        const d=Math.max(1,nearest),anchor=nearest>260?{x:contact.x+(q.x-contact.x)/d*220,z:contact.z+(q.z-contact.z)/d*220}:q;
        goal=position(terrain,anchor,q,claimed,contact,nearest<260?14:22,false,variant);
        // Do not abandon a usable firing line just for a marginal cover improvement.
        if(nearest<300&&lineOfFire(terrain as TerrainSystem,q,contact)&&shelter(terrain.coverAt(goal.x,goal.z))-shelter(terrain.coverAt(q.x,q.z))<.25)goal=point(q);
      }
    }else if(remembered){
      role='search';reason='Cover the last observed position; no live tracking through concealment';commit=4;
      goal=position(terrain,q,q,claimed,remembered,10,false,variant);
    }else if(assignment?.defend||o.mode==='advance'&&objective.owner==='enemy'){
      role='defend';reason='Guard an objective from nearby usable cover';commit=24;
      const angle=index*Math.PI*2/Math.max(1,o.squads.length),anchor={x:objective.x+Math.sin(angle)*15,z:objective.z+Math.cos(angle)*15};
      goal=distance(q,objective)<objective.radius*.65&&shelter(terrain.coverAt(q.x,q.z))>=.4?point(q):position(terrain,anchor,q,claimed,undefined,18,false,variant);
    }else{
      const d=distance(q,objective),anchor=d>75?{x:q.x+(objective.x-q.x)/d*55,z:q.z+(objective.z-q.z)/d*55}:point(objective);
      goal=position(terrain,anchor,q,claimed,undefined,d>75?18:10,false,variant);
      if(d<20)goal=point(q); // Capture is physical; don't orbit the flag once inside.
      reason=o.operational?'Advance in bounds toward the operational objective':o.mode==='advance'?'Reinforce or retake an objective':'Advance in bounds toward the village';
    }
    const move=distance(q,goal)>5;
    const sameMove=move&&q.moving&&q.orderTarget&&distance(q.orderTarget,goal)<8;
    const needsOrder=move?!sameMove:q.moving;
    const issue=needsOrder&&(!old||elapsedSince(old)>=5||emergency&&old.role!==role);
    if(issue)commands.push({squadId:q.id,type:move?'move':'hold',goal:point(goal),role,reason});
    const changed=!old||old.role!==role||distance(old.goal,goal)>8;
    // A rate-limited order is not yet a commitment: retry it at the next decision.
    const commitUntil=needsOrder&&!issue?o.at:o.at+commit+hash2D(q.id,1,o.seed)*2;
    const plan:EnemyPlan={squadId:q.id,role,objectiveId:role==='resupply'&&cache?cache.id:objective.id,goal:point(goal),home,since:changed?o.at:old.since,commitUntil,lastIssued:issue?o.at:old?.lastIssued??o.at,lastPosition:point(q),stalledFor:old?.stalledFor??0,reason,orders:(old?.orders??0)+(issue?1:0)};
    if(old)memory.plans[memory.plans.indexOf(old)]=plan;else memory.plans.push(plan);
    assigned.set(plan.objectiveId,(assigned.get(plan.objectiveId)??0)+1);claimed.push(plan.goal);
  }
  return {memory,commands};
}

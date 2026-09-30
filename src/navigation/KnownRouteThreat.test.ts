import {describe,it,expect} from 'vitest';
import {knownRouteThreat} from './KnownRouteThreat';
import {SquadNavigation} from './SquadNavigation';
import {TrenchNetwork} from '../garrison/TrenchNetwork';
import {createOperation} from '../operations/createOperation';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {SaveSystem} from '../persistence/SaveSystem';
import {inventory} from '../garrison/types';
import {reconcileSupplyDemands} from '../garrison/SupplyDemand';

function fixture(){
  const state=createOperation('open-front'),person=state.soldiers[0],enemy=state.soldiers.find(p=>state.squads.find(q=>q.id===p.squadId)?.faction==='enemy')!;
  person.x=-200;person.z=0;state.elapsed=10;
  state.operation!.intelligence={squads:[{squadId:person.squadId,contacts:[],exposure:[],link:'connected',nextReport:20}],reports:[],command:{player:[],enemy:[]},sounds:[]};
  const contacts=state.operation!.intelligence.squads[0].contacts;
  const contact={soldierId:enemy.id,squadId:enemy.squadId,x:0,z:0,visible:true,active:true,lastSeen:10};
  const terrain={clampToWorld:(p:unknown)=>p,obstacleAt:()=>false,buildingAt:()=>undefined,coverAt:()=> 'open',navigationCostAt:()=>1} as unknown as TerrainSystem;
  return {state,person,enemy,contacts,contact,terrain};
}
describe('known-threat carrier routes',()=>{
  it('uses a moderately longer clear approach, then the short route after the report expires',()=>{
    const {state,person,contacts,contact,terrain}=fixture(),nav=new SquadNavigation(terrain),goal={x:200,z:0};contacts.push(contact);
    let risk=knownRouteThreat(state,person,terrain),path=nav.plan(person,goal,risk.unsafe,true);
    expect(path.length).toBeGreaterThan(1);expect(risk.route(person,path)).toBe(false);expect(path.some(p=>Math.abs(p.z)>=100)).toBe(true);
    state.elapsed=31;risk=knownRouteThreat(state,person,terrain);path=nav.plan(person,goal,risk.unsafe,true);expect(path).toEqual([goal]);
  });
  it('chooses the rear branch in a real connected loop instead of the known hostile face',()=>{
    const {state,person,contacts,contact,terrain}=fixture(),network=new TrenchNetwork();contacts.push(contact);
    network.sync([{id:1,points:[{x:-200,z:0},{x:200,z:0}],width:4.2,depth:1.75,progress:1,status:'complete'},
      {id:2,points:[{x:-200,z:0},{x:-200,z:120},{x:200,z:120},{x:200,z:0}],width:4.2,depth:1.75,progress:1,status:'complete'}]);
    const risk=knownRouteThreat(state,person,terrain),path=network.route(person,{x:200,z:0},network.component(1),risk.unsafe);
    expect(path.some(p=>p.z===120)).toBe(true);expect(risk.route(person,path)).toBe(false);
  });
  it('hidden enemy motion and another isolated squad knowledge cannot influence the route',()=>{
    const {state,person,enemy,terrain,contact}=fixture();const before=knownRouteThreat(state,person,terrain);
    enemy.x=person.x+10;enemy.z=person.z;state.operation!.intelligence!.squads.push({squadId:state.squads[1].id,contacts:[contact],exposure:[],link:'isolated',nextReport:20});
    expect(before.active).toBe(false);expect(knownRouteThreat(state,person,terrain).active).toBe(false);
  });
  it('keeps cargo and the exact job when new knowledge makes a trip unsafe, including save/load',()=>{
    const {state,person,contacts,contact}=fixture(),sim=new BattlefieldSimulation(state),g=state.living!.garrisons.find(g=>g.id===person.garrisonId)!;
    Object.assign(person,{x:g.entrance.x,z:g.entrance.z,action:'walking · haul'});person.combat={shotSequence:0,owner:'duty'};
    const goal=state.trenches.find(t=>t.id===g.trenchId)!.points.slice().sort((a,b)=>Math.hypot(b.x-person.x,b.z-person.z)-Math.hypot(a.x-person.x,a.z-person.z))[0];person.carried!.materials=4;
    Object.assign(contact,{x:goal.x,z:goal.z});contacts.push(contact);
    person.duty={kind:'haul',stage:'deliver',destination:goal,route:[goal],routeIndex:0,since:10,until:190,blockedFor:0,reason:'Return shipment'};
    const stock={...person.carried};
    (sim.garrisons as unknown as {execute:Function}).execute(person,g,.05);
    expect(person.duty.unsafeRoute).toBe(true);expect(person.action).toContain('unsafe');expect(person.carried).toEqual(stock);
    const copy=new SaveSystem().parse(JSON.stringify(state));expect(copy.soldiers.find(p=>p.id===person.id)!.duty).toEqual(person.duty);
    const restored=new BattlefieldSimulation(copy);
    for(const world of [sim,restored]){
      world.state.operation!.intelligence!.squads.find(q=>q.squadId===person.squadId)!.contacts=[];world.state.elapsed=14;
      const p=world.state.soldiers.find(p=>p.id===person.id)!,area=world.state.living!.garrisons.find(area=>area.id===g.id)!;
      (world.garrisons as unknown as {execute:Function}).execute(p,area,.05);
      expect(p.duty!.unsafeRoute).toBeUndefined();expect(p.duty!.stage).toBe('deliver');expect(p.duty!.destination).toEqual(goal);expect(p.carried).toEqual(stock);
      // Consuming an already-reached route node can take one fixed tick.
      for(let i=0;i<4;i++){world.state.elapsed+=.05;(world.garrisons as unknown as {execute:Function}).execute(p,area,.05);}
      expect(p.action).toContain('walking');
    }
    expect(copy.soldiers.find(p=>p.id===person.id)!.duty).toEqual(person.duty);
  });
  it('tolerates more risk for urgent ammunition and recognizes local incoming fire without revealing its shooter',()=>{
    const {state,person,contacts,contact,terrain}=fixture();contacts.push(contact);
    expect(knownRouteThreat(state,person,terrain).unsafe({x:0,z:80})).toBe(true);
    expect(knownRouteThreat(state,person,terrain,true).unsafe({x:0,z:80})).toBe(false);
    contacts.length=0;const neighbour=state.soldiers.find(s=>s.squadId===person.squadId&&s.id!==person.id)!;
    Object.assign(neighbour,{x:0,z:0,suppression:40,combat:{lastIncoming:10,shotSequence:0}});
    expect(knownRouteThreat(state,person,terrain).unsafe({x:0,z:0})).toBe(true);
    state.elapsed=17;expect(knownRouteThreat(state,person,terrain).active).toBe(false);
  });
  it('explains a failed initial safe approach without replacing a current duty or blaming solid geometry on enemies',()=>{
    const {state,person,contacts,contact}=fixture(),sim=new BattlefieldSimulation(state),g=state.living!.garrisons.find(g=>g.id===person.garrisonId)!;
    Object.assign(person,{x:g.entrance.x,z:g.entrance.z});
    const goal=state.trenches.find(t=>t.id===g.trenchId)!.points.slice().sort((a,b)=>Math.hypot(b.x-person.x,b.z-person.z)-Math.hypot(a.x-person.x,a.z-person.z))[0];
    Object.assign(contact,{x:goal.x,z:goal.z});contacts.push(contact);
    const before=JSON.stringify(person),assign=sim.garrisons as unknown as {assignDuty:Function};
    expect(assign.assignDuty(person,g,'haul',goal,'Collect supplies',180)).toBe(false);
    expect(g.haulIssue).toMatchObject({personId:person.id,reason:'NO SAFE APPROACH',at:10,destination:goal});expect(JSON.stringify(person)).toBe(before);
    expect(new SaveSystem().parse(JSON.stringify(state)).living!.garrisons.find(p=>p.id===g.id)!.haulIssue).toEqual(g.haulIssue);
    delete g.haulIssue;
    expect(assign.assignDuty(person,g,'haul',{x:goal.x,z:goal.z+20},'Invalid off-trench destination',180)).toBe(false);expect(g.haulIssue).toBeUndefined();
    contacts.length=0;
    expect(assign.assignDuty(person,g,'haul',goal,'Collect supplies',180)).toBe(true);expect(g.haulIssue).toBeUndefined();
  });
  it('keeps an empty-cargo critical-ammunition job across save/load and loads only real ammunition',()=>{
    const {state,person}=fixture(),sim=new BattlefieldSimulation(state),g=state.living!.garrisons.find(g=>g.id===person.garrisonId)!;
    Object.assign(person,{x:g.entrance.x,z:g.entrance.z,carried:inventory({ammo:60}),combat:{shotSequence:0,owner:'duty'}});
    Object.assign(person.needs!,{energy:100,hunger:0,thirst:0});g.underFireUntil=100;
    g.cache.ammo=0;g.forwardStock=inventory({ammo:40,food:20,water:20});reconcileSupplyDemands(state);
    const assign=sim.garrisons as unknown as {assignDuty:Function;execute:Function};
    expect(assign.assignDuty(person,g,'haul',g.entrance,'Collect critical ammunition',180,false,true)).toBe(true);
    Object.assign(person.duty!,{stage:'pickup',arrivedAt:6,route:[],routeIndex:0});
    const saved=new SaveSystem().parse(JSON.stringify(state));expect(saved.soldiers.find(p=>p.id===person.id)!.duty!.urgentAmmo).toBe(true);
    const originalFood=g.forwardStock.food,originalWater=g.forwardStock.water,ammo=g.forwardStock.ammo+person.carried!.ammo;
    assign.execute(person,g,.05);
    expect(person.carried!.ammo).toBeGreaterThan(60);expect(g.forwardStock.ammo+person.carried!.ammo).toBe(ammo);
    expect(g.forwardStock.food).toBe(originalFood);expect(g.forwardStock.water).toBe(originalWater);
    expect(person.carried!.food).toBe(0);expect(person.carried!.water).toBe(0);expect(person.duty).toMatchObject({stage:'deliver',urgentAmmo:true});
    const resumed=new BattlefieldSimulation(saved),p=saved.soldiers.find(p=>p.id===person.id)!,area=saved.living!.garrisons.find(a=>a.id===g.id)!;
    (resumed.garrisons as unknown as {execute:Function}).execute(p,area,.05);
    expect(p.duty).toEqual(person.duty);expect(p.carried).toEqual(person.carried);expect(area.forwardStock).toEqual(g.forwardStock);
  });
});

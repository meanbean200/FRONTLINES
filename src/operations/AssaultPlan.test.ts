import {describe,it,expect} from 'vitest';
import {createOperationalBattle} from './createOperationalBattle';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {previewAssault,committedToAssault,effectiveSquad} from './AssaultPlan';
import {preparedPosition} from '../combat/testing/PositionFixture';
import {SaveSystem} from '../persistence/SaveSystem';
import {manpowerPools} from '../garrison/Manpower';
import {positionReadiness} from '../combat/WeaponPositions';
import {inventory} from '../garrison/types';
import {balance} from '../garrison/Inventory';
import {createStudyScenario} from '../garrison/StudyScenario';
import {coordinateMovement} from '../combat/Cooperation';

function fixture(){
  const state=createOperationalBattle('meeting'),sim=new BattlefieldSimulation(state),q=state.squads.find(q=>q.faction==='player')!;
  const people=state.soldiers.filter(s=>s.squadId===q.id);people[0].equipment!.mortar=true;
  const f=preparedPosition(state,q.id,'mortar'),g=state.living!.garrisons.find(g=>g.id===f.garrisonId)!;
  // Finite recorded initial fixture manifest; never a runtime refill.
  f.stock.mortarHE=2;state.living!.ledger.initial.mortarHE+=2;
  q.order={type:'occupy-trench',trenchId:f.connectorId,issuedAt:0};
  for(const s of people){s.needs!.energy=90;s.needs!.hunger=s.needs!.thirst=10;s.suppression=0;s.combat={shotSequence:0};}
  // Keep actual garrison duties for the crew, not a fake squad-wide crew reservation.
  for(const s of people)if(!f.weaponCrewIds!.includes(s.id))delete s.duty;
  return {state,sim,q,people,f,g,target:{x:q.x+45,z:q.z+20}};
}
describe('individual assault authority',()=>{
  it('releases several squads from one position against the same confirmed snapshot',()=>{
    const sim=createStudyScenario(1944,1,24),state=sim.state,g=state.living!.garrisons[0],ids=state.squads.slice(0,2).map(q=>q.id);
    sim.prepareOrder(ids,'assault',{x:g.entrance.x+20,z:g.entrance.z},undefined,true,[g.id]);expect(sim.signalPrepared()).toBe(2);sim.step(.05);
    expect(state.preparedOrders!.every(o=>o.releasedAt===state.elapsed&&!o.assault!.reviewRequired)).toBe(true);
    expect(state.soldiers.filter(s=>committedToAssault(state,s))).toHaveLength(16);
  });
  it('withholds the entire signal when one squad changes before the release tick',()=>{
    const sim=createStudyScenario(1944,1,24),state=sim.state,g=state.living!.garrisons[0],ids=state.squads.slice(0,2).map(q=>q.id);
    sim.prepareOrder(ids,'assault',{x:g.entrance.x+20,z:g.entrance.z},undefined,true,[g.id]);sim.signalPrepared();state.soldiers[10].needs!.energy=10;sim.step(.05);
    expect(state.preparedOrders!.every(o=>o.releasedAt===undefined&&o.assault!.reviewRequired)).toBe(true);expect(state.soldiers.some(s=>committedToAssault(state,s))).toBe(false);
  });
  it('clears detached covering-group state after local contact disappears',()=>{
    const {state,sim,q,target}=fixture();sim.prepareOrder([q.id],'assault',target,undefined,true);sim.signalPrepared();sim.step(.05);
    const a=state.preparedOrders![0].assault!;a.march!.tactics={group:1,switchAt:100};coordinateMovement(state);expect(a.march!.tactics).toBeUndefined();
  });
  it('retains an empty NORMAL review so protected workers can explicitly choose ALL IN',()=>{
    const {state,sim,q,target}=fixture();q.order={type:'construct-trench',issuedAt:0};
    expect(sim.prepareOrder([q.id],'assault',target)).toBe(1);
    expect(state.preparedOrders![0].assault!.participantIds).toEqual([]);expect(sim.signalPrepared()).toBe(0);
    expect(new SaveSystem().parse(JSON.stringify(state)).preparedOrders).toEqual(state.preparedOrders);
    expect(sim.prepareOrder([q.id],'assault',target,undefined,true)).toBe(1);
    expect(state.preparedOrders![0].assault!.participantIds).toHaveLength(8);
  });
  it('leaves ongoing simulated duties identical while a read-only review remains open',()=>{
    const {state,sim,q,target}=fixture(),other=new BattlefieldSimulation(structuredClone(state));
    sim.prepareOrder([q.id],'assault',target,undefined,true);
    for(let i=0;i<120;i++){sim.step(.05);other.step(.05);}
    expect({...state,preparedOrders:undefined}).toEqual({...other.state,preparedOrders:undefined});
  });
  it('queries and cancels without touching duties, queues, stock, weapons or movement',()=>{
    const {state,sim,q,target}=fixture(),before=structuredClone(state);
    const p=previewAssault(state,[q.id],'all-in');expect(p.participantIds).toHaveLength(8);expect(state).toEqual(before);
    sim.prepareOrder([q.id],'assault',target,undefined,true);expect({...state,preparedOrders:undefined}).toEqual({...before,preparedOrders:undefined});
    sim.cancelPrepared();expect({...state,preparedOrders:undefined}).toEqual({...before,preparedOrders:undefined});
  });
  it('moves only normal participants and retains the two mounted operators and their squad identity',()=>{
    const {state,sim,q,people,f,target}=fixture(),crew=f.weaponCrewIds!.slice(),identity=people.map(s=>s.squadId),order=structuredClone(q.order);
    sim.prepareOrder([q.id],'assault',target);expect(state.preparedOrders![0].assault!.participantIds).toHaveLength(6);
    sim.signalPrepared();sim.step(.05);
    expect(q.order).toEqual(order);expect(f.weaponCrewIds).toEqual(crew);expect(people.map(s=>s.squadId)).toEqual(identity);
    for(const s of people)expect(committedToAssault(state,s)).toBe(!crew.includes(s.id));
    expect(new SaveSystem().parse(JSON.stringify(state))).toEqual(state);
  });
  it('requires a fresh confirmation when the preview or next-tick eligibility changes',()=>{
    const {state,sim,q,people,target}=fixture();sim.prepareOrder([q.id],'assault',target,undefined,true);
    people[2].combat!.reaction='pinned';expect(sim.signalPrepared()).toBe(0);expect(state.preparedOrders![0].assault!.reviewRequired).toBe(true);
    expect(state.preparedOrders![0].assault!.participantIds).not.toContain(people[2].id);expect(sim.signalPrepared()).toBe(1);
    people[3].needs!.energy=10;sim.step(.05);
    expect(state.preparedOrders![0].releasedAt).toBeUndefined();expect(state.preparedOrders![0].assault!.reviewRequired).toBe(true);
    expect(people.some(s=>committedToAssault(state,s))).toBe(false);
  });
  it('ALL IN leaves installed guns, cargo, materials and shells physical; excludes medical and critical recovery',()=>{
    const {state,sim,q,people,f,g,target}=fixture();
    people[2].needs!.energy=10;
    people[3].combat!.careTask={patientId:people[2].id,stage:'treat',route:[],index:0,progress:0,destination:{x:people[2].x,z:people[2].z},blockedFor:0};
    people[4].action='sleeping';people[4].duty={kind:'sleep',destination:{x:people[4].x,z:people[4].z},route:[],routeIndex:0,arrivedAt:0,since:0,until:100,blockedFor:0,reason:'Rest'};
    const work={...structuredClone(f),id:state.nextEntityId++,kind:'store' as const,installation:undefined,weaponCrewIds:[],progress:.3,stock:inventory(),workOrder:{explicit:true,workerIds:[people[5].id],createdAt:0,autoWorkers:true}};state.living!.facilities.push(work);
    people[5].carried!.materials=3;state.living!.ledger.initial.materials+=3;
    people[5].duty={kind:'haul',stage:'deliver',destination:target,route:[target],routeIndex:0,since:0,until:100,blockedFor:0,reason:'Physical delivery',facilityId:work.id};
    state.operation!.supportMissions=[0,1].map((n)=>({id:state.nextEntityId++,squadId:q.id,positionId:f.id,kind:'mortarHE' as const,target,impact:target,requestedAt:0,launchAt:20,impactAt:30,stage:n?'flight' as const:'preparing' as const,reason:'Fixture',dangerRadius:20,confirmedRisk:true,crewIds:f.weaponCrewIds!.slice()}));
    const installed=structuredClone(f.installation),stock=structuredClone(f.stock),beforeBalance=balance(state),cache=structuredClone(g.cache),members=q.soldierIds.slice();
    sim.prepareOrder([q.id],'assault',target,undefined,true);
    const plan=state.preparedOrders![0].assault!;expect(plan.preview.excluded.map(e=>e.id)).toEqual([people[2].id,people[3].id]);expect(plan.preview.awakenedIds).toContain(people[4].id);
    sim.signalPrepared();sim.step(.05);
    expect(f.weaponCrewIds).toEqual([]);expect(f.autoReplaceCrew).toBe(false);expect(f.installation).toEqual(installed);expect(f.stock).toEqual(stock);
    expect(people[5].carried!.materials).toBe(3);expect(work.progress).toBe(.3);expect(work.workOrder).toMatchObject({workerIds:[],autoWorkers:false,pausedByAssault:true});
    expect(state.operation!.supportMissions!.map(m=>m.stage)).toEqual(['cancelled','flight']);expect(q.soldierIds).toEqual(members);
    for(const key of Object.keys(beforeBalance) as (keyof typeof beforeBalance)[])expect(balance(state)[key]).toBeCloseTo(beforeBalance[key],7);
    expect(g.cache).toEqual(cache);expect(positionReadiness(state,f)).not.toBe('');
    sim.garrisons.autoCrew(f.id);expect(f.weaponCrewIds!.some(id=>plan.participantIds.includes(id))).toBe(false);
    const pools=manpowerPools(state,people);expect(new Set(Object.values(pools).flat()).size).toBe(8);expect(pools.assault).toHaveLength(6);
  });
  it('limits position selection to its actual people, not their remote squad mates',()=>{
    const {state,sim,q,people,g,target}=fixture();delete people[7].garrisonId;
    sim.prepareOrder([q.id],'assault',target,undefined,true,[g.id]);expect(state.preparedOrders![0].assault!.participantIds).not.toContain(people[7].id);
  });
  it('retains detached orders and paused work on load; cancellation holds locally without re-crewing',()=>{
    const {state,sim,q,people,f,target}=fixture();sim.prepareOrder([q.id],'assault',target,undefined,true);sim.signalPrepared();sim.step(.05);
    const copy=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));expect(copy.state).toEqual(state);
    sim.step(.05);copy.step(.05);expect(copy.state).toEqual(state);
    sim.cancelPrepared();expect(f.weaponCrewIds).toEqual([]);expect(people.every(s=>s.assaultHold!==undefined)).toBe(true);
    const cancelled=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));expect(cancelled.state).toEqual(state);
    const position=people.map(s=>({x:s.x,z:s.z}));sim.step(.05);expect(people.map(s=>({x:s.x,z:s.z}))).toEqual(position);
    expect(effectiveSquad(state,people[0],q).order.type).toBe('hold');
  });
  it('re-crews an abandoned installation only after an explicit assignment and physical return',()=>{
    const {state,sim,q,people,f,target}=fixture();expect(positionReadiness(state,f)).toBe('');sim.prepareOrder([q.id],'assault',target,undefined,true);sim.signalPrepared();
    for(let i=0;i<200;i++)sim.step(.05);sim.cancelPrepared();
    const returning=people.slice(0,2);expect(returning.every(s=>Math.hypot(s.x-f.x,s.z-f.z)>4)).toBe(true);
    for(const s of returning)expect(sim.garrisons.assignCrew(s.id,f.id).accepted).toBe(true);
    expect(positionReadiness(state,f)).toMatch(/MOVING/);
    for(let i=0;i<2400&&positionReadiness(state,f);i++)sim.step(.05);
    expect(positionReadiness(state,f)).toBe('');expect(f.weaponCrewIds).toEqual(returning.map(s=>s.id));
    expect(people.slice(2).every(s=>s.assaultHold!==undefined)).toBe(true);
  });
  it('rejects cross-squad membership, forged duplicate people and malformed saved continuations',()=>{
    const {state,sim,q,target}=fixture();sim.prepareOrder([q.id],'assault',target,undefined,true);
    for(const corrupt of [(a:any)=>a.participantIds.push(a.participantIds[0]),(a:any)=>a.participantIds[0]=state.soldiers.find(s=>s.squadId!==q.id)!.id,(a:any)=>a.preview.excluded=null,(a:any)=>a.march={x:0,z:0}]){
      const copy=structuredClone(state);corrupt(copy.preparedOrders![0].assault);expect(()=>new SaveSystem().parse(JSON.stringify(copy))).toThrow();
    }
  });
});

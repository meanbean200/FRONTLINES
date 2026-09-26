import {describe,it,expect,vi} from 'vitest';
import {createStudyScenario} from './StudyScenario';
import {balance,transfer} from './Inventory';
import {reconcileSupplyDemands,constructionDemand,claimed,unfulfilled,validSupplyDemands,availableForPerson} from './SupplyDemand';
import {SaveSystem} from '../persistence/SaveSystem';
import {workReadout,shipmentReadout,trenchWorkReadout} from '../ui/PositionReadout';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {preparedPosition} from '../combat/testing/PositionFixture';
import {requestPositionSupport,requestSupport,stepSupport} from '../combat/SupportWeapons';
import {positionReadiness} from '../combat/WeaponPositions';

function jobs(){
  const sim=createStudyScenario(),state=sim.state,w=state.living!,g=w.garrisons[0],t=state.trenches[0];
  transfer(g.cache,w.rearStock,'materials',20);
  const origin={x:t.points[0].x+45,z:t.points[0].z};
  const a=sim.requestConstruction({kind:'facility',garrisonId:g.id,facilityKind:'emplacement',origin,position:origin,facing:0})!;
  const from={x:origin.x+25,z:origin.z};
  const b=sim.requestConstruction({kind:'facility',garrisonId:g.id,facilityKind:'mortar',origin:from,position:{x:from.x,z:from.z+8}})!;
  expect(a).toBeDefined();expect(b).toBeDefined();return {sim,state,w,g,a:w.facilities.find(f=>f.id===a)!,b:w.facilities.find(f=>f.id===b)!};
}
describe('explicit supply demand and reservation accounting',()=>{
  it('gives an empty crewed gun shells before a supplied gun reserves deeper stock',()=>{
    const {state,w,g,a,b}=jobs();
    for(const f of [a,b]){f.kind='mortar';f.progress=1;f.paid=true;f.weaponCrewIds=state.soldiers.filter(s=>s.garrisonId===g.id).slice(f===a?0:2,f===a?2:4).map(s=>s.id);}
    a.stock.mortarHE=4;g.cache.mortarHE=4;for(const s of state.soldiers)s.carried!.mortarHE=0;
    reconcileSupplyDemands(state);
    const first=w.supplyDemands!.find(d=>d.consumerId===a.id&&d.resource==='mortarHE')!,empty=w.supplyDemands!.find(d=>d.consumerId===b.id&&d.resource==='mortarHE')!;
    expect(empty.priority).toBeLessThan(first.priority);
    expect(empty.claims.find(c=>c.source==='local')?.amount).toBeGreaterThanOrEqual(2);
  });
  it('reports the actual route length and stops promising an ETA for blocked traffic',()=>{
    const {state,w,g}=jobs(),truck=w.trucks.find(t=>t.role==='shuttle')!;
    Object.assign(truck,{x:0,z:0,state:'outbound',garrisonId:g.id,route:[{x:120,z:0},{x:120,z:120}],routeIndex:0,reason:'En route'});
    expect(shipmentReadout(state,truck)).toMatchObject({source:'Rear depot',remaining:240,eta:'~0:20 at 1× · unobstructed travel'});
    truck.state='blocked';truck.reason='Road severed';expect(shipmentReadout(state,truck).eta).toBe('Not predictable while stopped');
    truck.state='returning';truck.resume=undefined;truck.reason='Returning to depot';expect(shipmentReadout(state,truck).destination).toBe('Rear depot');
  });
  it('commits 16 plus 4 of the same 20 real materials, and demands the field gun remainder',()=>{
    const {state,g,a,b}=jobs(),before=balance(state);reconcileSupplyDemands(state);
    expect(g.cache.materials).toBe(20);expect(claimed(constructionDemand(state,a.id)!)).toBe(16);expect(claimed(constructionDemand(state,b.id)!)).toBe(4);expect(unfulfilled(constructionDemand(state,b.id)!)).toBe(b.materialCost-4);
    expect(workReadout(state,b)).toMatchObject({delivered:0,reserved:4,inbound:0,remaining:b.materialCost-4});expect(balance(state)).toEqual(before);expect(validSupplyDemands(state)).toBe(true);
    const saved=new SaveSystem().parse(JSON.stringify(state));expect(saved.living!.supplyDemands).toEqual(state.living!.supplyDemands);expect(balance(saved)).toEqual(before);
  });
  it('allocates assigned truck cargo once, names its jobs, and never guesses from proximity',()=>{
    const {state,w,g,a,b}=jobs(),truck=w.trucks.find(t=>t.role==='shuttle')!;
    transfer(g.cache,w.rearStock,'materials',12);transfer(w.rearStock,truck.cargo,'materials',8);truck.state='outbound';truck.garrisonId=g.id;reconcileSupplyDemands(state);
    expect(workReadout(state,a)).toMatchObject({reserved:8,inbound:8,remaining:0});expect(workReadout(state,b).remaining).toBe(b.materialCost);
    const r=shipmentReadout(state,truck);expect(r.destination).toBe(`Network ${String(g.trenchId).padStart(3,'0')}`);expect(r.cargo).toEqual(['Materials 8']);expect(r.jobs).toEqual([{name:'MG position 01',amount:8}]);
    truck.x+=1000;expect(shipmentReadout(state,truck).destination).toBe(r.destination);
    truck.state='blocked';truck.resume='outbound';reconcileSupplyDemands(state);expect(workReadout(state,a).inbound).toBe(8);
    truck.resume='returning';reconcileSupplyDemands(state);expect(workReadout(state,a).inbound).toBe(0);
    const convoy=w.trucks.find(t=>t.role==='convoy')!;convoy.state='outbound';expect(shipmentReadout(state,convoy).destination).toBe('Rear depot');convoy.state='returning';convoy.reason='Returning to depot';expect(shipmentReadout(state,convoy)).toMatchObject({destination:'Map-edge supply point',note:''});convoy.state='idle';expect(shipmentReadout(state,convoy).status).toBe('At map edge');
  });
  it('tracks claims through truck, forward store, carrier and local delivery without double promises',()=>{
    const {state,w,g,a}=jobs(),truck=w.trucks.find(t=>t.role==='shuttle')!,person=state.soldiers[0];
    transfer(g.cache,w.rearStock,'materials',20);transfer(w.rearStock,truck.cargo,'materials',16);truck.state='outbound';truck.garrisonId=g.id;
    const before=balance(state);reconcileSupplyDemands(state);expect(workReadout(state,a).inbound).toBe(16);
    transfer(truck.cargo,g.forwardStock,'materials',16);truck.state='returning';reconcileSupplyDemands(state);expect(workReadout(state,a).inbound).toBe(16);
    transfer(g.forwardStock,person.carried!,'materials',8);person.duty={kind:'haul',stage:'deliver',destination:g.entrance,route:[],routeIndex:0,since:0,until:100,reason:'Fixture delivery',blockedFor:0};reconcileSupplyDemands(state);expect(workReadout(state,a).inbound).toBe(16);
    transfer(person.carried!,g.cache,'materials',8);delete person.duty;reconcileSupplyDemands(state);expect(workReadout(state,a)).toMatchObject({reserved:8,inbound:8,remaining:0});expect(balance(state)).toEqual(before);
    expect(new SaveSystem().parse(JSON.stringify(state)).living!.supplyDemands).toEqual(w.supplyDemands);
  });
  it('cancellation releases future promises but leaves delivered stock exactly at the cancelled site',()=>{
    const {sim,state,g,a,b}=jobs();transfer(g.cache,a.stock,'materials',6);reconcileSupplyDemands(state);const before=balance(state);
    expect(sim.garrisons.cancelWork(a.id).accepted).toBe(true);expect(a.stock.materials).toBe(6);expect(g.cache.materials).toBe(14);expect(constructionDemand(state,a.id)).toBeUndefined();expect(claimed(constructionDemand(state,b.id)!)).toBe(14);expect(workReadout(state,a).status).toBe('CANCELLED');
    const saved=new SaveSystem().parse(JSON.stringify(state));expect(balance(saved)).toEqual(before);expect(saved.living!.facilities.find(f=>f.id===a.id)?.stock.materials).toBe(6);
  });
  it('dedicated cargo cannot be stolen by an earlier unfulfilled job',()=>{
    const {state,w,g,a,b}=jobs(),person=state.soldiers[0];transfer(g.cache,w.rearStock,'materials',20);transfer(w.rearStock,person.carried!,'materials',8);person.duty={kind:'haul',stage:'deliver',facilityId:b.id,destination:b,route:[],routeIndex:0,since:0,until:100,reason:'Second job delivery',blockedFor:0};
    reconcileSupplyDemands(state);expect(claimed(constructionDemand(state,a.id)!)).toBe(0);expect(claimed(constructionDemand(state,b.id)!)).toBe(8);
  });
  it('finishes the last material handoff when the first worker occupies the shared construction entrance',()=>{
    const {sim,state,g,b}=jobs(),mouth=state.trenches.find(t=>t.id===b.connectorId)!.points[0],first=state.soldiers.find(s=>s.id===b.workOrder!.workerIds[0])!,carrier=state.soldiers.find(s=>s.id===b.workOrder!.workerIds[1])!;
    transfer(g.cache,b.stock,'materials',8);transfer(g.cache,carrier.carried!,'materials',4);state.elapsed=4;g.nextDecision=1e9;
    Object.assign(first,mouth);first.duty={kind:'rest',destination:{...mouth},route:[],routeIndex:0,arrivedAt:0,since:0,until:1000,reason:'First load delivered',blockedFor:0};
    carrier.x=mouth.x+.6;carrier.z=mouth.z;carrier.duty={kind:'haul',stage:'deliver',facilityId:b.id,destination:{...mouth},route:[{...mouth}],routeIndex:0,since:0,until:1000,reason:'Second load',blockedFor:150,networkBound:true};
    const before=balance(state);for(let i=0;i<5*20;i++)sim.step(.05);
    expect(b.stock.materials+(b.paid?b.materialCost:0)).toBe(12);expect(carrier.carried!.materials).toBe(0);expect(Math.max(...Object.values(balance(state)).map((v,i)=>Math.abs(v-Object.values(before)[i])))).toBeLessThan(1e-6);
  });
  it('loads explicit job shortages before routine reserves using finite truck capacity',()=>{
    const {sim,state,w,g,a,b}=jobs();transfer(g.cache,w.rearStock,'materials',20);const truck=w.trucks.find(t=>t.role==='shuttle')!;w.trucks=[truck];w.logistics!.shuttleCapacity=20;const before=balance(state);
    sim.garrisons.logistics.step(.05);expect(truck.cargo.materials).toBe(20);expect(workReadout(state,a).inbound).toBe(16);expect(workReadout(state,b)).toMatchObject({inbound:4,remaining:b.materialCost-4});expect(balance(state)).toEqual(before);
  });
  it('weapon demands subtract crew stock and assigned inbound, and protect other crews promises',()=>{
    const {state,w,g,a}=jobs();a.progress=1;a.paid=true;a.workOrder!.workerIds=[];const gun=state.soldiers[0];gun.carried!.ammo=30;a.weaponCrewIds=[gun.id];const truck=w.trucks.find(t=>t.role==='shuttle')!;truck.cargo.ammo=60;truck.garrisonId=g.id;truck.state='outbound';reconcileSupplyDemands(state);
    const d=w.supplyDemands!.find(d=>d.consumerId===a.id&&d.resource==='ammo')!;expect(d.usable).toBe(30);expect(claimed(d)).toBe(60);expect(unfulfilled(d)).toBe(30);
    g.cache.ammo=20;reconcileSupplyDemands(state);expect(availableForPerson(state,gun.id,'local',g.id,'ammo',20)).toBe(20);expect(availableForPerson(state,state.soldiers[1].id,'local',g.id,'ammo',20)).toBe(0);
  });
  it('rejects inflated or duplicate claims on load instead of creating free supply',()=>{
    const {state}=jobs();const corrupt=structuredClone(state);corrupt.living!.supplyDemands![0].claims[0].amount=999;expect(()=>new SaveSystem().parse(JSON.stringify(corrupt))).toThrow();
    const duplicate=structuredClone(state);duplicate.living!.supplyDemands!.push(duplicate.living!.supplyDemands![0]);expect(()=>new SaveSystem().parse(JSON.stringify(duplicate))).toThrow();
    const holder=structuredClone(state),d=holder.living!.supplyDemands!.find(d=>d.consumer==='construction')!;d.claims[0].amount/=2;d.claims.push({...d.claims[0]});expect(validSupplyDemands(holder)).toBe(false);
  });
  it('gives a real active-combat ammunition shortage priority over construction and ordinary reserves',()=>{
    const {sim,state,w,g,a,b}=jobs();a.progress=1;a.paid=true;a.workOrder!.workerIds=[];a.weaponCrewIds=state.soldiers.slice(0,2).map(s=>s.id);g.underFireUntil=60;
    for(const s of state.soldiers.slice(0,2))s.carried!.ammo=0;
    transfer(g.cache,w.rearStock,'materials',20);const truck=w.trucks.find(t=>t.role==='shuttle')!;w.trucks=[truck];w.logistics!.shuttleCapacity=20;
    sim.garrisons.logistics.step(.05);expect(truck.cargo.ammo).toBe(20);expect(truck.cargo.materials).toBe(0);expect(unfulfilled(constructionDemand(state,b.id)!)).toBe(b.materialCost);
  });
  it('initializes an older save ledger without adding stock or preserving promises to a lost carrier',()=>{
    const {state,w,g,a}=jobs(),person=state.soldiers[0];transfer(g.cache,person.carried!,'materials',8);person.duty={kind:'haul',stage:'deliver',facilityId:a.id,destination:a,route:[],routeIndex:0,since:0,until:100,reason:'Delivery',blockedFor:0};reconcileSupplyDemands(state);
    expect(constructionDemand(state,a.id)!.claims.some(c=>c.source==='carrier')).toBe(true);person.needs!.life='incapacitated';reconcileSupplyDemands(state);expect(constructionDemand(state,a.id)!.claims.some(c=>c.source==='carrier')).toBe(false);expect(person.carried!.materials).toBe(8);
    const before=balance(state);delete w.supplyDemands;const loaded=new SaveSystem().parse(JSON.stringify(state));expect(loaded.living!.supplyDemands!.length).toBeGreaterThan(0);expect(balance(loaded)).toEqual(before);
  });
  it('saves immediately after a paused command releases a laden carrier, without stale claims or lost cargo',()=>{
    const {sim,state,g,a}=jobs(),s=state.soldiers[0];transfer(g.cache,s.carried!,'materials',8);s.duty={kind:'haul',stage:'deliver',facilityId:a.id,destination:a,route:[],routeIndex:0,since:0,until:100,reason:'Delivery',blockedFor:0};reconcileSupplyDemands(state);sim.garrisons.release(s.squadId);const before=balance(state);
    vi.stubGlobal('localStorage',{setItem:vi.fn()});try{const saves=new SaveSystem(),copy=saves.parse(saves.save(state));expect(validSupplyDemands(copy)).toBe(true);expect(balance(copy)).toEqual(before);expect(copy.soldiers.find(p=>p.id===s.id)!.carried!.materials).toBe(8);expect(copy.living!.supplyDemands!.every(d=>d.claims.every(c=>c.source!=='carrier'||c.id!==s.id))).toBe(true);}finally{vi.unstubAllGlobals();}
  });
  it('reports trench excavation through the same work-order concepts without invented material cost',()=>{
    const {sim,state}=jobs(),q=state.squads.find(q=>q.kind==='engineer')!,t=sim.trenches.create([{x:0,z:0},{x:20,z:0}],q.id);sim.trenches.assignEngineer(t.id,q.id);
    expect(trenchWorkReadout(state,t)).toMatchObject({status:'CREW APPROACHING',workers:8,materials:'No material required',progress:0});
  });
  it('never automatically plans player structures over twelve campaign hours with stocked materials',()=>{
    const sim=createStudyScenario(),state=sim.state,w=state.living!,g=w.garrisons[0];w.lethalNeeds=false;transfer(w.rearStock,g.cache,'materials',180);const initial=w.facilities.length;
    for(let i=0;i<900*20;i++)sim.step(.05);
    expect(w.campaignHours).toBeCloseTo(20,5);expect(w.facilities).toHaveLength(initial);expect(sim.garrisons.requestFacility(g.id,'rest')).toBeUndefined();expect(Math.max(...Object.values(balance(state)).map(Math.abs))).toBeLessThan(1e-6);
  },30000);
});

describe('physical position command authority',()=>{
  it('same-formation mortar operators do not redirect one pit to the other; mixed crews save during preparation',()=>{
    const state=createOperation('advance'),sim=new BattlefieldSimulation(state),q=state.squads.find(q=>q.faction==='player')!,crew=state.soldiers.filter(s=>s.squadId===q.id),helper=state.soldiers.find(s=>s.squadId===state.squads[1].id)!;
    crew[0].equipment!.mortar=true;crew[0].carried!.mortarHE=4;crew[0].x=-1000;crew[0].z=-1000;
    const a=preparedPosition(state,q.id,'mortar');crew[0].equipment!.mortar=false;crew[2].equipment!.mortar=true;crew[2].x=-970;crew[2].z=-1000;crew[2].carried!.mortarHE=4;
    const b=preparedPosition(state,q.id,'mortar');crew[0].equipment!.mortar=true;a.weaponCrewIds=[crew[0].id,helper.id];b.weaponCrewIds=[crew[2].id,crew[3].id];
    for(const f of [a,b])for(const [i,id] of f.weaponCrewIds!.entries()){const s=state.soldiers.find(s=>s.id===id)!;s.x=f.x+i;s.z=f.z;s.garrisonId=f.garrisonId;s.personalArea=true;s.suppression=0;s.action='watching';s.duty={kind:'watch',facilityId:f.id,destination:{x:s.x,z:s.z},route:[],routeIndex:0,since:0,arrivedAt:0,until:150,blockedFor:0,reason:'Fixture crew'};}
    expect(positionReadiness(state,a)).toBe('');expect(positionReadiness(state,b)).toBe('');const target={x:a.x+150,z:a.z+150};
    expect(requestSupport(state,'mortarHE',q.id,target).reason).toContain('actual gun position');
    const orders=structuredClone(state.squads.map(q=>q.order));expect(requestPositionSupport(state,'mortarHE',b.id,target,true,sim.terrain).accepted).toBe(true);expect(requestPositionSupport(state,'mortarHE',a.id,target,true,sim.terrain).accepted).toBe(true);
    reconcileSupplyDemands(state);const saved=new SaveSystem().parse(JSON.stringify(state));expect(saved.operation!.supportMissions!.map(m=>m.positionId)).toEqual([b.id,a.id]);expect(saved.operation!.supportMissions![1].crewIds).toEqual([crew[0].id,helper.id]);
    state.elapsed=16;stepSupport(state,sim.terrain);expect(state.operation!.supportMissions!.every(m=>m.stage==='flight')).toBe(true);expect(a.stock.mortarHE).toBe(3);expect(b.stock.mortarHE).toBe(3);expect(state.squads.map(q=>q.order)).toEqual(orders);
  });
});

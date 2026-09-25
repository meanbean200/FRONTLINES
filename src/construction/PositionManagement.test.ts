import {describe,it,expect} from 'vitest';
import {createStudyScenario} from '../garrison/StudyScenario';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {SaveSystem} from '../persistence/SaveSystem';
import {balance,consume,transfer} from '../garrison/Inventory';
import {inlineGeometry,weaponCrewPoint} from './PositionDefinitions';
import {positionReadiness,migrateWeaponCrews} from '../combat/WeaponPositions';
import {facilitySiteReason} from './ConstructionReadout';
import {workReadout,networkSupply} from '../ui/PositionReadout';
import {requestSupport,stepSupport} from '../combat/SupportWeapons';
import {createOperation} from '../operations/createOperation';
import {preparedPosition} from '../combat/testing/PositionFixture';
import {distance} from '../core/types';

function fixture(){const sim=createStudyScenario(),state=sim.state,g=state.living!.garrisons[0],t=state.trenches[0];g.nextSupport=1e9;state.living!.lethalNeeds=false;const origin={x:t.points[0].x+45,z:t.points[0].z};return {sim,state,g,t,origin};}
const run=(sim:BattlefieldSimulation,seconds:number)=>{for(let i=0;i<seconds*20;i++)sim.step(.05);};
function post(){const f=fixture(),id=f.sim.requestConstruction({kind:'facility',garrisonId:f.g.id,facilityKind:'emplacement',origin:f.origin,position:f.origin,facing:0})!;return {...f,p:f.state.living!.facilities.find(p=>p.id===id)!};}
function fund(f:ReturnType<typeof post>){const n=f.p.materialCost;transfer(f.g.cache,f.p.stock,'materials',n);consume(f.state,f.p.stock,'materials',n);f.p.paid=true;}

describe('V1 position management command boundary',()=>{
  it.each([4.2,7.2,8])('snaps to the actual %.1f m trench width rather than a fixed lateral range',width=>{
    const {sim,state,g,t,origin}=fixture();t.width=width;sim.garrisons.network.sync(state.trenches);
    const position=inlineGeometry(t,45,0).position;
    expect(facilitySiteReason(state,g,origin,position,sim.terrain,sim.navigation,sim.garrisons.network,'emplacement')).toBeUndefined();
    const id=sim.requestConstruction({kind:'facility',garrisonId:g.id,facilityKind:'emplacement',origin,position,facing:0});
    expect(id).toBeDefined();expect(state.living!.facilities.find(f=>f.id===id)!.z-origin.z).toBeCloseTo(width*.43);
  });
  it('snaps an MG directly to excavated trench without creating a connector; preserves facing and anchor',()=>{
    const {sim,state,g,t,origin}=fixture(),count=state.trenches.length,facing=Math.PI;
    const id=sim.requestConstruction({kind:'facility',garrisonId:g.id,facilityKind:'emplacement',origin,position:origin,facing})!,f=state.living!.facilities.find(f=>f.id===id)!;
    expect(f.trenchAnchor).toEqual({trenchId:t.id,along:45});expect(state.trenches).toHaveLength(count);expect(f.facing).toBe(facing);expect(f.z).toBeLessThan(origin.z);
    expect(distance(f,inlineGeometry(t,45,facing).position)).toBeLessThan(.001);expect(new SaveSystem().parse(JSON.stringify(state))).toEqual(state);
  });
  it('rejects detached MGs, unfinished floor, overlap and corrupt anchors without spending stock',()=>{
    const {sim,state,g,t,origin}=fixture(),before=JSON.stringify(balance(state));
    expect(sim.requestConstruction({kind:'facility',garrisonId:g.id,facilityKind:'emplacement',origin,position:{x:origin.x,z:origin.z-12}})).toBeUndefined();
    t.progress=.1;sim.garrisons.network.sync(state.trenches);expect(sim.requestConstruction({kind:'facility',garrisonId:g.id,facilityKind:'emplacement',origin,position:origin})).toBeUndefined();
    t.progress=1;const id=sim.requestConstruction({kind:'facility',garrisonId:g.id,facilityKind:'emplacement',origin,position:origin})!;
    expect(sim.requestConstruction({kind:'facility',garrisonId:g.id,facilityKind:'emplacement',origin,position:origin})).toBeUndefined();expect(JSON.stringify(balance(state))).toBe(before);
    const corrupt=structuredClone(state);corrupt.living!.facilities.find(f=>f.id===id)!.trenchAnchor!.along+=20;expect(()=>new SaveSystem().parse(JSON.stringify(corrupt))).toThrow();
  });
  it('uses distinct adjacent mortar and rear-support validators',()=>{
    const {sim,state,g,origin}=fixture(),ahead={x:origin.x,z:origin.z+7};
    expect(facilitySiteReason(state,g,origin,ahead,sim.terrain,sim.navigation,sim.garrisons.network,'mortar')).toBeUndefined();
    expect(facilitySiteReason(state,g,origin,ahead,sim.terrain,sim.navigation,sim.garrisons.network,'aid')).toContain('rear');
    const id=sim.requestConstruction({kind:'facility',garrisonId:g.id,facilityKind:'mortar',origin,position:ahead})!,f=state.living!.facilities.find(f=>f.id===id)!;
    expect(f.trenchAnchor).toBeUndefined();expect(state.trenches.find(t=>t.id===f.connectorId)?.points.at(-1)).toEqual(ahead);
  });
  it('allows independent movement without assigning the formation; moves physically and saves exactly',()=>{
    const {sim,state,t,origin}=fixture(),q=state.squads[0],s=state.soldiers.find(s=>s.squadId===q.id)!;sim.issueHold([q.id]);sim.garrisons.release(q.id);
    const order=structuredClone(q.order),others=structuredClone(state.soldiers.filter(p=>p!==s)),before={x:s.x,z:s.z};
    expect(sim.garrisons.orderPerson(s.id,'move',origin).accepted).toBe(true);expect(q.order).toEqual(order);expect(state.soldiers.filter(p=>p!==s)).toEqual(others);expect(s.personalArea).toBe(true);expect(distance(s,before)).toBe(0);
    run(sim,2);const loaded=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));run(sim,50);run(loaded,50);expect(loaded.state).toEqual(state);expect(sim.garrisons.network.corridorContains(s)).toBe(true);expect(s.trenchId).toBe(t.id);
  });
  it('rejects enemy, incapacitated and unreachable person orders with reasons',()=>{
    const {sim,state,origin}=fixture(),s=state.soldiers[0];s.needs!.life='incapacitated';expect(sim.garrisons.orderPerson(s.id,'move',origin).reason).toContain('INCAPACITATED');s.needs!.life='active';
    expect(sim.garrisons.orderPerson(s.id,'move',{x:origin.x,z:origin.z+50}).accepted).toBe(false);state.squads[0].faction='enemy';expect(sim.garrisons.orderPerson(s.id,'rest').reason).toContain('friendly');
  });
  it('makes a funded explicit job outrank routine patrol/rest with individually assigned tool carriers',()=>{
    const f=post();fund(f);const ids=f.p.workOrder!.workerIds;expect(ids).toHaveLength(2);const orders=structuredClone(f.state.squads.map(q=>q.order));run(f.sim,1);
    expect(ids.every(id=>f.state.soldiers.find(s=>s.id===id)?.duty?.kind==='construct')).toBe(true);expect(f.state.squads.map(q=>q.order)).toEqual(orders);
    run(f.sim,160);expect(f.p.progress).toBe(1);expect(f.p.workOrder!.workerIds).toHaveLength(0);expect(workReadout(f.state,f.p).status).toBe('COMPLETE');
  });
  it('unfunded jobs wait truthfully and deliver materials before work',()=>{
    const f=post();transfer(f.g.cache,f.state.living!.rearStock,'materials',f.g.cache.materials);run(f.sim,.1);expect(workReadout(f.state,f.p).status).toBe('MATERIALS IN TRANSIT');expect(f.p.progress).toBe(0);
    transfer(f.state.living!.rearStock,f.g.cache,'materials',16);f.g.nextDecision=0;run(f.sim,8);expect(f.p.paid).toBe(false);run(f.sim,250);expect(f.p.paid).toBe(true);expect(f.p.progress).toBe(1);expect(Math.max(...Object.values(balance(f.state)).map(Math.abs))).toBeLessThan(1e-6);
  });
  it('two physically present workers build faster than one; untooled labor cannot build alone',()=>{
    const a=post(),b=post();fund(a);fund(b);const ids=b.p.workOrder!.workerIds;b.p.workOrder!.workerIds=ids.slice(0,1);for(const sim of [a,b])for(const [i,id] of sim.p.workOrder!.workerIds.entries()){const s=sim.state.soldiers.find(s=>s.id===id)!;Object.assign(s,weaponCrewPoint(sim.state,sim.p,i));delete s.duty;}
    run(a.sim,20);run(b.sim,20);expect(a.p.progress).toBeGreaterThan(b.p.progress*1.5);
    const c=post();fund(c);for(const id of c.p.workOrder!.workerIds)c.state.soldiers.find(s=>s.id===id)!.equipment!.tools=false;run(c.sim,80);expect(c.p.progress).toBe(0);expect(workReadout(c.state,c.p).reason).toContain('tool carrier');
  });
  it('reserves limited truck space for an explicit material shortage before routine top-ups',()=>{
    const f=post(),w=f.state.living!,truck=w.trucks.find(t=>t.role==='shuttle')!;
    transfer(f.g.cache,w.rearStock,'materials',f.g.cache.materials);w.trucks=w.trucks.filter(t=>t===truck);w.logistics!.shuttleCapacity=8;
    const before=balance(f.state);f.sim.garrisons.logistics.step(.05);
    expect(truck.state).toBe('loading');expect(truck.cargo.materials).toBe(8);expect(balance(f.state)).toEqual(before);expect(f.p.paid).toBe(false);
  });
  it.each(['pickup','deliver'] as const)('does not pay twice when a late material carrier is at %s',stage=>{
    const f=post();fund(f);const s=f.state.soldiers.find(s=>s.id===f.p.workOrder!.workerIds[0])!;
    f.g.nextDecision=1e9;f.p.workOrder!.workerIds=[];f.state.elapsed=4;
    const at=stage==='pickup'?f.g.entrance:weaponCrewPoint(f.state,f.p,0);Object.assign(s,at);
    if(stage==='deliver')transfer(f.g.cache,s.carried!,'materials',8);
    const before=f.g.cache.materials;
    s.duty={kind:'haul',stage,facilityId:f.p.id,destination:{...at},route:[{...at}],routeIndex:1,since:0,until:100,arrivedAt:0,reason:'Late material trip',blockedFor:0};
    run(f.sim,.1);expect(f.p.stock.materials).toBe(0);expect(f.g.cache.materials).toBe(before);
    if(stage==='deliver'){
      expect(s.carried!.materials).toBe(8);expect(s.duty?.facilityId).toBeUndefined();expect(s.duty?.stage).toBe('deliver');
      run(f.sim,80);expect(s.carried!.materials).toBe(0);expect(f.g.cache.materials).toBe(before+8);
    }else expect(s.carried!.materials).toBe(0);
    expect(Math.max(...Object.values(balance(f.state)).map(Math.abs))).toBeLessThan(1e-6);
  });
  it('does not send empty material carriers to occupy a waiting worksite',()=>{
    const f=post(),s=f.state.soldiers.find(s=>s.id===f.p.workOrder!.workerIds[0])!;transfer(f.g.cache,f.state.living!.rearStock,'materials',f.g.cache.materials);f.p.workOrder!.workerIds=[];f.g.nextDecision=1e9;f.state.elapsed=4;
    Object.assign(s,f.g.entrance);s.duty={kind:'haul',stage:'pickup',facilityId:f.p.id,destination:{...f.g.entrance},route:[{...f.g.entrance}],routeIndex:1,since:0,until:100,arrivedAt:0,reason:'Empty pickup',blockedFor:0};
    run(f.sim,.1);expect(s.duty?.facilityId).not.toBe(f.p.id);expect(s.carried!.materials).toBe(0);expect(f.p.progress).toBe(0);
  });
  it('combat interrupts work without losing the work order, then resumes',()=>{
    const f=post();fund(f);for(const id of f.p.workOrder!.workerIds){const s=f.state.soldiers.find(s=>s.id===id)!;s.suppression=100;s.combat={shotSequence:0,owner:'reaction',reaction:'pinned'};}run(f.sim,2);expect(f.p.progress).toBe(0);expect(workReadout(f.state,f.p).status).toBe('INTERRUPTED BY COMBAT');
    for(const id of f.p.workOrder!.workerIds){const s=f.state.soldiers.find(s=>s.id===id)!;s.suppression=0;s.combat={shotSequence:0,owner:'duty',reaction:'steady'};}run(f.sim,160);expect(f.p.progress).toBe(1);
  });
  it('does not cancel a casualty rescue or a carried delivery to assign a worker',()=>{
    const f=post(),s=f.state.soldiers[0];s.combat={shotSequence:0,owner:'casualty'};expect(f.sim.garrisons.assignWorker(f.p.id,s.id).accepted).toBe(false);delete s.combat;s.duty={kind:'haul',stage:'deliver',destination:f.origin,route:[f.origin],routeIndex:0,since:0,until:100,reason:'Test loaded delivery',blockedFor:0};expect(f.sim.garrisons.assignWorker(f.p.id,s.id).reason).toContain('delivery');
  });
  it('explicit gunner and cross-formation assistant do not relocate their squads, and removal affects only that person',()=>{
    const f=post();fund(f);f.p.progress=1;f.p.workOrder!.workerIds=[];const gun=f.state.soldiers[0],helper=f.state.soldiers.find(s=>s.squadId===f.state.squads[1].id)!;gun.equipment!.weapon='crew-mg';gun.carried!.ammo=60;f.state.living!.ledger.initial.ammo+=60;
    for(const q of f.state.squads.slice(0,2)){f.sim.garrisons.release(q.id);q.order={type:'hold',issuedAt:0};}
    const others=structuredClone(f.state.soldiers.filter(s=>s!==gun&&s!==helper)),orders=structuredClone(f.state.squads.map(q=>q.order));
    expect(f.sim.garrisons.assignCrew(helper.id,f.p.id).reason).toContain('MG REQUIRED');expect(f.sim.garrisons.assignCrew(gun.id,f.p.id).accepted).toBe(true);expect(f.sim.garrisons.assignCrew(helper.id,f.p.id).accepted).toBe(true);expect(f.p.weaponCrewIds).toEqual([gun.id,helper.id]);expect(f.state.soldiers.filter(s=>s!==gun&&s!==helper)).toEqual(others);expect(f.state.squads.map(q=>q.order)).toEqual(orders);
    expect(f.sim.garrisons.assignCrew(f.state.soldiers[3].id,f.p.id).reason).toContain('CREW FULL');run(f.sim,100);expect(positionReadiness(f.state,f.p)).toBe('');
    const saved=new SaveSystem().parse(JSON.stringify(f.state));expect(saved.living!.facilities.find(p=>p.id===f.p.id)!.weaponCrewIds).toEqual([gun.id,helper.id]);expect(positionReadiness(saved,saved.living!.facilities.find(p=>p.id===f.p.id)!)).toBe('');expect(saved.squads.map(q=>q.order)).toEqual(orders);
    const gunBefore=structuredClone(gun);f.sim.garrisons.removeCrew(f.p.id,helper.id);expect(gun).toEqual(gunBefore);expect(positionReadiness(f.state,f.p)).toBe('NO ASSISTANT');expect(new SaveSystem().parse(JSON.stringify(f.state))).toEqual(f.state);
  });
  it('automatic crew selection prefers a local cross-formation helper and never recruits across the map',()=>{
    const f=post();fund(f);f.p.progress=1;f.p.workOrder!.workerIds=[];
    const gun=f.state.soldiers[0],helper=f.state.soldiers.find(s=>s.squadId===f.state.squads[1].id)!,nearby=f.state.soldiers[1];
    for(const s of f.state.soldiers){s.x=f.origin.x+700;s.z=f.origin.z+700;delete s.duty;}
    for(const q of f.state.squads)q.order={type:'hold',issuedAt:0};
    gun.equipment!.weapon='crew-mg';gun.carried!.ammo=60;f.state.living!.ledger.initial.ammo+=60;
    Object.assign(gun,weaponCrewPoint(f.state,f.p,0));Object.assign(helper,weaponCrewPoint(f.state,f.p,1));Object.assign(nearby,{x:f.p.x,z:f.p.z+6});
    const orders=structuredClone(f.state.squads.map(q=>q.order));expect(f.sim.garrisons.autoCrew(f.p.id,gun.squadId).accepted).toBe(true);expect(f.p.weaponCrewIds).toEqual([gun.id,helper.id]);expect(f.state.squads.map(q=>q.order)).toEqual(orders);
    f.sim.garrisons.removeCrew(f.p.id);for(const s of [gun,helper,nearby]){s.x+=700;s.z+=700;}
    expect(f.sim.garrisons.autoCrew(f.p.id).accepted).toBe(false);expect(f.p.weaponCrewIds).toEqual([]);
  });
  it('retains distinct crew in saved travel, rejects double assignment, and migrates legacy crews without inventing stock',()=>{
    const state=createOperation('campaign'),q=state.squads.find(q=>q.kind==='mortar'&&q.faction==='player')!,f=preparedPosition(state,q.id,'mortar');delete f.weaponCrewIds;f.weaponSquadId=q.id;const before=structuredClone(state.soldiers),stock=balance(state);migrateWeaponCrews(state);
    expect(f.weaponCrewIds).toHaveLength(2);expect(f.weaponSquadId).toBeUndefined();expect(state.soldiers).toEqual(before);expect(balance(state)).toEqual(stock);expect(state.living!.migrationNote).toContain('migrated');
    const bad=structuredClone(state);bad.living!.facilities.push({...structuredClone(f),id:bad.nextEntityId++});expect(()=>new SaveSystem().parse(JSON.stringify(bad))).toThrow();
  });
  it('leaves an impossible legacy crew uncrewed with a migration notice',()=>{
    const state=createOperation('campaign'),q=state.squads.find(q=>q.kind==='mortar'&&q.faction==='player')!,f=preparedPosition(state,q.id,'mortar');delete f.weaponCrewIds;f.weaponSquadId=q.id;for(const s of state.soldiers.filter(s=>s.squadId===q.id))s.equipment!.mortar=false;
    migrateWeaponCrews(state);expect(f.weaponCrewIds).toEqual([]);expect(state.living!.migrationNote).toContain('1 left uncrewed');
  });
  it('fires mortar with an individually selected assistant from another formation and consumes real ammunition',()=>{
    const state=createOperation('campaign'),sim=new BattlefieldSimulation(state),q=state.squads.find(q=>q.kind==='mortar'&&q.faction==='player')!,f=preparedPosition(state,q.id,'mortar'),gun=state.soldiers.find(s=>s.id===f.weaponCrewIds![0])!,old=state.soldiers.find(s=>s.id===f.weaponCrewIds![1])!,helper=state.soldiers.find(s=>s.squadId===state.squads[0].id)!;
    Object.assign(helper,{x:old.x,z:old.z,garrisonId:f.garrisonId,personalArea:true,duty:structuredClone(old.duty)});f.weaponCrewIds=[gun.id,helper.id];const ammo=gun.carried!.mortarHE,target={x:gun.x+160,z:gun.z};
    expect(requestSupport(state,'mortarHE',q.id,target,false,sim.terrain).accepted).toBe(true);state.elapsed=16;stepSupport(state,sim.terrain);expect(state.operation!.supportMissions![0].stage).toBe('flight');expect(gun.carried!.mortarHE).toBe(ammo-1);
  });
  it('separates store stock, inbound cargo, construction allocations and personal ammunition without inventing GOOD',()=>{
    const f=post(),truck=f.state.living!.trucks.find(t=>t.role==='shuttle')!;truck.garrisonId=f.g.id;truck.state='blocked';transfer(f.state.living!.rearStock,truck.cargo,'materials',12);f.g.cache.ammo=0;
    const before=JSON.stringify(f.state),readout=networkSupply(f.state,[f.g]);expect(readout.rows.find(r=>r.key==='ammo')!.status).toBe('EMPTY');expect(readout.inbound.materials).toBe(12+f.g.forwardStock.materials);expect(readout.required).toBe(16);expect(JSON.stringify(f.state)).toBe(before);expect(readout.trucks).toContain(truck);
  });
});

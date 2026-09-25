import { describe, it, expect } from 'vitest';
import { createStudyScenario } from './StudyScenario';
import { BattlefieldSimulation } from '../simulation/BattlefieldSimulation';
import { SaveSystem } from '../persistence/SaveSystem';
import { balance, transfer } from './Inventory';
import { dropCargo, updateNeeds } from './NeedsSystem';
import { applyPolicy, observation, RulePolicy } from './GarrisonPolicy';

const advance=(sim:BattlefieldSimulation,seconds:number)=>{for(let i=0;i<seconds/.05;i++)sim.step(.05);};
describe('living-trench transition contracts',()=>{
  it('uses separate temporary loading positions and clears a multi-carrier pickup',()=>{
    const sim=createStudyScenario(),w=sim.state.living!,g=w.garrisons[0];
    for(const key of ['food','water','materials'] as const)transfer(g.cache,w.rearStock,key,g.cache[key]);
    transfer(w.rearStock,g.forwardStock,'food',60);transfer(w.rearStock,g.forwardStock,'water',60);
    sim.step(.05);
    const carriers=sim.state.soldiers.filter(s=>s.duty?.kind==='haul'&&s.duty.stage==='pickup');
    expect(carriers.length).toBeGreaterThan(1);
    expect(new Set(carriers.map(s=>JSON.stringify(s.duty!.destination))).size).toBe(carriers.length);
    advance(sim,250);expect(g.cache.food).toBeGreaterThan(0);expect(g.cache.water).toBeGreaterThan(0);
    expect(carriers.every(s=>!(s.duty?.kind==='haul'&&s.duty.stage==='pickup'&&s.duty.blockedFor>60))).toBe(true);
  });
  it('takes a timed carried-ration break without losing the shipment or save continuity',()=>{
    const sim=createStudyScenario(),s=sim.state.soldiers[0],g=sim.state.living!.garrisons[0];g.nextDecision=1000;
    s.needs!.hunger=80;s.needs!.thirst=80;
    s.duty={kind:'haul',stage:'deliver',destination:{x:s.x+20,z:s.z},route:[{x:s.x+20,z:s.z}],routeIndex:0,since:0,until:300,reason:'Test shipment',blockedFor:0};
    const initial={x:s.x,z:s.z,food:s.carried!.food,water:s.carried!.water};advance(sim,3);
    expect(s.x).toBe(initial.x);expect(s.z).toBe(initial.z);expect(s.carried!.food).toBe(initial.food);expect(s.duty!.rationUntil).toBeDefined();
    const other=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(sim.state)));
    advance(sim,3.2);advance(other,3.2);
    expect(s.carried!.food).toBe(initial.food-1);expect(s.carried!.water).toBe(initial.water-1);expect(s.duty?.kind).toBe('haul');expect(s.duty?.stage).toBe('deliver');
    expect(other.state.soldiers).toEqual(sim.state.soldiers);expect(other.state.living).toEqual(sim.state.living);
    for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
  it('eats near a pickup instead of sending a ration across the full trench',()=>{
    const sim=createStudyScenario(),s=sim.state.soldiers.at(-1)!,g=sim.state.living!.garrisons[0];g.nextDecision=1000;
    s.x=g.entrance.x+4;s.z=g.entrance.z-1.134;s.needs!.hunger=70;s.needs!.thirst=70;
    s.duty={kind:'meal',stage:'pickup',destination:{x:s.x,z:s.z},route:[],routeIndex:0,since:0,arrivedAt:0,until:30,reason:'Collect meal',blockedFor:0};
    advance(sim,6.1);expect(s.duty?.stage).toBe('deliver');expect(Math.hypot(s.x-s.duty!.destination.x,s.z-s.duty!.destination.z)).toBeLessThan(10);
  });
  it('does not let accumulated materials or ammunition suppress food dispatch',()=>{
    const sim=createStudyScenario(),w=sim.state.living!,g=w.garrisons[0];
    transfer(w.rearStock,g.forwardStock,'materials',180);transfer(w.rearStock,g.forwardStock,'ammo',100);
    sim.step(.05);expect(w.trucks.some(t=>t.role==='shuttle'&&t.state==='loading'&&t.cargo.food>0&&t.cargo.water>0)).toBe(true);
    for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
  it('recovers an exhausted carrier where it stopped instead of marching it back to the trench',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0],s=sim.state.soldiers[0];
    s.x=g.forward.x+8;s.z=g.forward.z+8;s.needs!.energy=7;
    s.duty={kind:'haul',stage:'pickup',destination:{...g.forward},route:[{...g.forward}],routeIndex:0,since:0,until:300,reason:'Exhausted carrier',blockedFor:0};
    sim.step(.05);expect(s.duty?.kind).toBe('sleep');expect(Math.hypot(s.x-s.duty!.destination.x,s.z-s.duty!.destination.z)).toBeLessThan(1);
  });
  it('keeps temporary watch posts anchored across repeated physical reliefs',()=>{
    const sim=createStudyScenario(9919,1),g=sim.state.living!.garrisons[0];advance(sim,90);
    const anchors=new Set(sim.state.soldiers.filter(s=>s.duty?.kind==='watch').map(s=>JSON.stringify(s.duty!.watchPost)));
    expect(anchors.size).toBe(g.watchRequired);advance(sim,600);
    for(const soldier of sim.state.soldiers.filter(s=>s.duty?.kind==='watch')){
      expect(anchors.has(JSON.stringify(soldier.duty!.watchPost))).toBe(true);
      if(soldier.duty!.arrivedAt!==undefined)expect(Math.hypot(soldier.x-soldier.duty!.watchPost!.x,soldier.z-soldier.duty!.watchPost!.z)).toBeLessThan(3);
    }
  });
  it('can relieve overdue guards from rested sleepers without waking a fresh sleep shift',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0];advance(sim,100);
    const guard=sim.state.soldiers.find(s=>s.duty?.kind==='watch'&&s.duty.arrivedAt!==undefined)!;
    expect(guard).toBeDefined();guard.duty!.until=sim.state.elapsed+30;
    const reserves=sim.state.soldiers.filter(s=>s.duty?.kind!=='watch');
    for(const [i,s] of reserves.entries()){
      s.needs!.energy=100;s.needs!.hunger=10;s.needs!.thirst=10;
      s.duty={kind:'sleep',destination:{x:s.x,z:s.z},route:[],routeIndex:0,since:0,arrivedAt:i===0?sim.state.elapsed:0,until:600,reason:'Night shift rest',blockedFor:0};
    }
    g.nextDecision=0;sim.step(.05);
    expect(reserves[0].duty?.kind).toBe('sleep');
    expect(reserves.some(s=>s.duty?.kind==='watch'&&s.duty.relieving===guard.id)).toBe(true);
  });
  it('retires surplus alert posts when the player stands the garrison down',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0];
    sim.garrisons.setReadiness(g.id,'alert');advance(sim,90);
    expect(sim.state.soldiers.filter(s=>s.duty?.kind==='watch'&&s.duty.relieving===undefined)).toHaveLength(12);
    sim.garrisons.setReadiness(g.id,'routine');advance(sim,.1);
    expect(g.watchRequired).toBe(6);
    expect(sim.state.soldiers.filter(s=>s.duty?.kind==='watch'&&s.duty.relieving===undefined)).toHaveLength(6);
    expect(g.watchPresent).toBeLessThanOrEqual(6);
  });
  it('does not dispatch an exhausted, thirsty recovering soldier on an aid trip',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0],helper=sim.state.soldiers[0],patient=sim.state.soldiers[1];
    helper.x=g.entrance.x+15;helper.z=g.entrance.z+1;helper.needs!.energy=7;helper.needs!.thirst=90;
    helper.duty={kind:'sleep',destination:{x:helper.x,z:helper.z},route:[],routeIndex:0,since:0,arrivedAt:0,until:150,reason:'Recovery',blockedFor:0};
    patient.needs!.life='incapacitated';patient.health=14;patient.needs!.hunger=80;patient.needs!.thirst=80;
    sim.step(.05);expect(helper.duty?.patientId).toBeUndefined();expect(helper.duty?.kind).toBe('meal');
  });
  it('keeps readiness targets explicit even when too few soldiers are fit',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0];
    for(const [readiness,required] of [['routine',6],['alert',12],['stand-to',22]] as const){
      sim.garrisons.setReadiness(g.id,readiness);sim.step(.05);expect(g.watchRequired).toBe(required);
    }
    for(const soldier of sim.state.soldiers.slice(2)){soldier.needs!.life='incapacitated';soldier.health=10;}
    sim.step(.05);expect(g.watchRequired).toBe(22);expect(g.watchPresent).toBeLessThanOrEqual(2);
  });
  it('keeps a guard until its relief arrives and then releases it',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0];advance(sim,120);
    for(const soldier of sim.state.soldiers)if(soldier.duty?.relieving!==undefined)delete soldier.duty;
    const old=sim.state.soldiers.find(s=>s.duty?.kind==='watch'&&s.duty.arrivedAt!==undefined&&!sim.state.soldiers.some(p=>p.duty?.relieving===s.id))!;
    expect(old).toBeDefined();old.duty!.until=sim.state.elapsed+40;old.needs!.watchHours=8;
    const reserve=sim.state.soldiers.find(s=>s!==old&&s.duty?.kind!=='watch')!;delete reserve.duty;reserve.needs!.energy=100;reserve.needs!.hunger=10;reserve.needs!.thirst=10;
    g.nextDecision=0;sim.step(.05);
    const relief=sim.state.soldiers.find(s=>s.duty?.relieving===old.id)!;
    expect(relief).toBeDefined();expect(old.duty?.kind).toBe('watch');
    relief.duty!.arrivedAt=sim.state.elapsed;relief.x=old.x;relief.z=old.z+1;
    g.nextDecision=0;sim.step(.05);
    expect(old.duty?.kind).toBe('watch');advance(sim,45);
    expect(old.duty?.kind).not.toBe('watch');expect(relief.duty?.relieving).toBeUndefined();
  });

  it('leaving defense interrupts sleep once and retains carried inventory; Hold does neither',()=>{
    const sim=createStudyScenario(),s=sim.state.soldiers[0],g=sim.state.living!.garrisons[0];
    s.duty={kind:'sleep',destination:{x:s.x,z:s.z},route:[],routeIndex:0,since:0,arrivedAt:0,until:600,reason:'test rest',blockedFor:0};
    const stock={...s.carried!};sim.issueHold([s.squadId]);
    expect(s.needs!.interruptedSleep).toBe(0);expect(s.duty?.kind).toBe('sleep');expect(s.garrisonId).toBe(g.id);
    sim.issueMove([s.squadId],{x:s.x,z:s.z-20});
    expect(s.needs!.interruptedSleep).toBe(1);expect(s.duty).toBeUndefined();expect(s.garrisonId).toBeUndefined();
    expect(g.squadIds).not.toContain(s.squadId);expect(s.carried).toEqual(stock);
    for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-8);
  });

  it('only consumes carried meal stock after travel and eating time',()=>{
    const sim=createStudyScenario(),s=sim.state.soldiers[0],g=sim.state.living!.garrisons[0];
    g.nextDecision=1000;s.needs!.hunger=60;s.needs!.thirst=60;
    s.duty={kind:'meal',stage:'deliver',destination:{x:s.x,z:s.z},route:[],routeIndex:0,since:0,arrivedAt:0,until:30,reason:'test carried meal',blockedFor:0};
    const before={...s.carried!},cache={...g.cache};advance(sim,5);
    expect(s.carried).toEqual(before);advance(sim,2);
    expect(s.carried!.food).toBe(before.food-1);expect(s.carried!.water).toBe(before.water-1);expect(g.cache).toEqual(cache);
  });

  it('uses gradual deprivation, recoverable cargo and non-instant recovery',()=>{
    const sim=createStudyScenario(),w=sim.state.living!,s=sim.state.soldiers[0];
    w.lethalNeeds=true;s.needs!.energy=50;s.needs!.hunger=100;s.needs!.thirst=100;s.needs!.thirstyHours=6.1;
    updateNeeds(sim.state,s,75);expect(s.health).toBeCloseTo(88);expect(s.needs!.life).toBe('active');
    s.health=14;updateNeeds(sim.state,s,.05);expect(s.needs!.life).toBe('incapacitated');
    const before=balance(sim.state);dropCargo(sim.state,s);expect(w.crates.length).toBe(1);expect(balance(sim.state)).toEqual(before);
    s.needs!.hunger=10;s.needs!.thirst=10;s.needs!.thirstyHours=0;s.needs!.energy=10;
    for(let i=0;i<4;i++)updateNeeds(sim.state,s,75);
    expect(s.needs!.life).toBe('active');expect(s.health).toBeGreaterThanOrEqual(25);
    s.needs!.thirst=100;s.needs!.thirstyHours=7;s.health=5;updateNeeds(sim.state,s,75);
    expect(s.needs!.life).toBe('dead');expect(w.metrics.deaths).toBe(1);
  });

  it('retains cargo in a blocked truck without transferring it remotely',()=>{
    const sim=createStudyScenario(),w=sim.state.living!,truck=w.trucks.find(t=>t.role==='shuttle')!;
    // Intercept the departure itself: the smaller world's rear may be close.
    for(let i=0;i<200&&truck.state!=='outbound';i++)sim.step(.05);expect(truck.state).toBe('outbound');
    const stock={...truck.cargo},target=truck.route[truck.routeIndex];
    sim.createCrater(target,10,3);advance(sim,1);
    expect(truck.state).toBe('blocked');expect(truck.cargo).toEqual(stock);
    for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });

  it('pauses for player authority before an emergency recovery or withdrawal',()=>{
    const sim=createStudyScenario(),w=sim.state.living!,g=w.garrisons[0];
    transfer(g.cache,w.rearStock,'food',g.cache.food);transfer(g.cache,w.rearStock,'water',g.cache.water);
    const s=sim.state.soldiers[0];s.needs!.hunger=100;s.needs!.thirst=100;s.needs!.thirstyHours=4;
    sim.step(.05);expect(g.cutoff).toBe('decision');expect(sim.state.simSpeed).toBe(0);
    const time=sim.state.elapsed;sim.step(.05);expect(sim.state.elapsed).toBe(time);
    sim.garrisons.resolveEmergency(g.id,'hold');expect(sim.state.simSpeed).toBe(1);
  });

  it('continues travel, work, sleep and shipments identically after a v2 save',()=>{
    const sim=createStudyScenario(1944,2);
    for(const seconds of [30,300,650]){
      advance(sim,seconds);const saved=new SaveSystem().parse(JSON.stringify(sim.state)),other=new BattlefieldSimulation(saved);
      advance(sim,12);advance(other,12);
      expect(other.state.soldiers).toEqual(sim.state.soldiers);expect(other.state.living).toEqual(sim.state.living);
    }
  },20000);

  it('conserves stock and completes a supplied 72-hour loop-network soak',()=>{
    const sim=createStudyScenario(1944,2);advance(sim,72*75);
    expect(sim.state.living!.campaignHours).toBeCloseTo(80,5);
    expect(sim.state.living!.metrics.deaths).toBe(0);
    expect(sim.state.living!.facilities.filter(f=>f.progress===1)).toHaveLength(3);
    expect(sim.state.soldiers.some(s=>s.action==='sleeping')).toBe(true);
    expect(sim.state.soldiers.every(s=>(s.duty?.blockedFor??0)<120)).toBe(true);
    for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  },40000);

  it('bounds hybrid adjustments and rejects malformed neural output',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0],o=observation(sim.state,g,sim.state.soldiers);
    expect(o).toHaveLength(32);expect(o.every(Number.isFinite)).toBe(true);
    const base=new RulePolicy().decide(o);g.policy='hybrid';
    const result=applyPolicy(g,base,[100,-100,1,-1,1,-1]);
    expect(result.every((v,i)=>Math.abs(v-base[i])<=.250000001)).toBe(true);
    expect(()=>applyPolicy(g,base,[NaN,0,0,0,0,0])).toThrow();
  });
  it('consumes half-rations during a cutoff without inventing inventory',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0],s=sim.state.soldiers[0],w=sim.state.living!;
    transfer(g.cache,w.rearStock,'food',g.cache.food);g.cutoff='hold';g.nextDecision=1000;
    s.needs!.hunger=70;s.needs!.thirst=70;
    s.duty={kind:'meal',stage:'deliver',destination:{x:s.x,z:s.z},route:[],routeIndex:0,since:0,arrivedAt:0,until:30,reason:'reduced ration',blockedFor:0};
    const before=s.carried!.food;advance(sim,6.1);expect(s.carried!.food).toBe(before-.5);expect(s.needs!.hunger).toBeGreaterThan(49);
    for(const value of Object.values(balance(sim.state)))expect(Math.abs(value)).toBeLessThan(1e-6);
  });
  it('withdraws to distinct destinations and consumes real forward stocks on arrival',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0],s=sim.state.soldiers[0];
    transfer(sim.state.living!.rearStock,g.forwardStock,'food',20);transfer(sim.state.living!.rearStock,g.forwardStock,'water',20);
    sim.garrisons.resolveEmergency(g.id,'withdraw');
    const destinations=sim.state.soldiers.map(s=>JSON.stringify(s.duty!.destination));expect(new Set(destinations).size).toBe(24);
    s.x=s.duty!.destination.x;s.z=s.duty!.destination.z;s.duty!.arrivedAt=0;s.duty!.route=[];s.duty!.routeIndex=0;s.needs!.hunger=70;s.needs!.thirst=70;
    transfer(s.carried!,g.forwardStock,'food',s.carried!.food);transfer(s.carried!,g.forwardStock,'water',s.carried!.water);
    const food=g.forwardStock.food;advance(sim,6.1);
    expect(g.forwardStock.food).toBeLessThan(food);expect(s.carried!.food).toBe(.5);
    expect(s.needs!.hunger).toBeGreaterThanOrEqual(70);expect(s.duty!.rationUntil).toBeDefined();
    advance(sim,6.1);expect(s.carried!.food).toBe(0);expect(s.needs!.hunger).toBeGreaterThan(50);expect(s.needs!.hunger).toBeLessThan(51);expect(g.watchRequired).toBe(0);
  });
  it('physically delivers aid before an incapacitated soldier recovers',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0];advance(sim,100);
    const patient=sim.state.soldiers.find(s=>s.duty?.kind==='rest'&&s.duty.arrivedAt!==undefined)!;
    expect(patient).toBeDefined();patient.health=14;patient.needs!.energy=30;patient.needs!.hunger=80;patient.needs!.thirst=80;
    sim.step(.05);expect(patient.needs!.life).toBe('incapacitated');
    let aidArrived=false,previous=patient.needs!.thirst;
    for(let i=0;i<5000;i++){
      const helpers=sim.state.soldiers.filter(s=>s.duty?.patientId===patient.id&&s.duty.stage==='deliver');
      sim.step(.05);
      if(patient.needs!.thirst<previous-1){aidArrived=true;expect(helpers.some(s=>Math.hypot(s.x-patient.x,s.z-patient.z)<1.5)).toBe(true);}
      previous=patient.needs!.thirst;
    }
    expect(aidArrived).toBe(true);expect(patient.needs!.life).toBe('active');expect(g.squadIds).toContain(patient.squadId);
    for(const value of Object.values(balance(sim.state)))expect(Math.abs(value)).toBeLessThan(1e-6);
  });
  it('hands over aid at arms reach without touching an occupied intermediate waypoint',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0],[patient,helper]=sim.state.soldiers;
    g.nextDecision=10000;g.nextSupport=10000;
    patient.x=g.entrance.x+40;patient.z=g.entrance.z+.9;patient.health=14;
    patient.needs!.life='incapacitated';patient.needs!.thirst=80;patient.needs!.hunger=80;
    helper.x=patient.x;helper.z=patient.z-.8;
    helper.duty={kind:'haul',stage:'deliver',patientId:patient.id,destination:{x:patient.x,z:patient.z},route:[{x:patient.x-20,z:g.entrance.z},{x:patient.x,z:patient.z}],routeIndex:0,since:0,until:120,reason:'Aid beside occupied waypoint',blockedFor:0,networkBound:true};
    const position={x:helper.x,z:helper.z};
    for(let i=0;i<70&&patient.needs!.thirst>40;i++)sim.step(.05);
    expect(patient.needs!.thirst).toBeLessThan(40);expect({x:helper.x,z:helper.z}).toEqual(position);
    for(const value of Object.values(balance(sim.state)))expect(Math.abs(value)).toBeLessThan(1e-6);
  });
  it('does not hand over supplies remotely after a patient moves away',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0],[patient,helper]=sim.state.soldiers;
    g.nextDecision=10000;g.nextSupport=10000;
    helper.x=g.entrance.x+20;helper.z=g.entrance.z;patient.x=helper.x+30;patient.z=helper.z;
    patient.health=14;patient.needs!.life='incapacitated';patient.needs!.thirst=80;
    helper.duty={kind:'haul',stage:'deliver',patientId:patient.id,destination:{x:helper.x,z:helper.z},route:[],routeIndex:0,since:0,arrivedAt:0,until:120,reason:'Patient moved during handover',blockedFor:0,networkBound:true};
    advance(sim,3.2);
    expect(patient.needs!.thirst).toBeGreaterThan(79);expect(helper.duty?.arrivedAt).toBeUndefined();
    expect(helper.duty?.destination).toEqual({x:patient.x,z:patient.z});
  });
  it('saves an aid trip as coordinates and continues it without duplicate soldier references',()=>{
    const sim=createStudyScenario();advance(sim,100);
    const patient=sim.state.soldiers.find(s=>s.duty?.kind==='rest'&&s.duty.arrivedAt!==undefined)!;
    patient.health=14;patient.needs!.energy=30;patient.needs!.hunger=80;patient.needs!.thirst=80;
    let helper=sim.state.soldiers.find(s=>s.duty?.patientId===patient.id);
    for(let i=0;i<300&&!helper;i++){sim.step(.05);helper=sim.state.soldiers.find(s=>s.duty?.patientId===patient.id);}
    expect(helper).toBeDefined();
    expect(Object.keys(helper!.duty!.destination).sort()).toEqual(['x','z']);
    for(const point of helper!.duty!.route)expect(Object.keys(point).sort()).toEqual(['x','z']);
    const restored=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(sim.state)));
    advance(sim,90);advance(restored,90);
    expect(restored.state.soldiers).toEqual(sim.state.soldiers);expect(restored.state.living).toEqual(sim.state.living);
  });
  it('updates an excavated junction without teleporting its occupants',()=>{
    const sim=createStudyScenario();advance(sim,100);const main=sim.state.trenches[0];
    const branch={id:sim.state.nextEntityId++,points:[{x:main.points[0].x+70,z:main.points[0].z-30},{x:main.points[0].x+70,z:main.points[0].z+30}],width:4.2,depth:1.75,progress:.2,status:'building' as const};
    sim.state.trenches.push(branch);sim.step(.05);
    expect(sim.garrisons.network.component(branch.id)).not.toBe(sim.garrisons.network.component(main.id));
    const before=sim.state.soldiers.map(s=>({x:s.x,z:s.z}));branch.progress=1;sim.step(.05);
    expect(sim.garrisons.network.component(branch.id)).toBe(sim.garrisons.network.component(main.id));
    sim.state.soldiers.forEach((s,i)=>expect(Math.hypot(s.x-before[i].x,s.z-before[i].z)).toBeLessThan(.2));
  });
});

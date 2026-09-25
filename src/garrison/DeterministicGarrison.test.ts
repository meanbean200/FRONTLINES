import {describe,it,expect} from 'vitest';
import {createStudyScenario} from './StudyScenario';
import {createBattlefield} from '../simulation/createBattlefield';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {SaveSystem} from '../persistence/SaveSystem';
import {balance,total,transfer} from './Inventory';
import {updateNeeds} from './NeedsSystem';

describe('deterministic garrison acceptance contracts',()=>{
  it('never enables normal-scenario mortality merely because a shipment arrives',()=>{
    const sim=new BattlefieldSimulation(createBattlefield());
    sim.assignGarrison([sim.state.squads[0].id,sim.state.squads.find(q=>q.kind==='engineer')!.id],sim.state.trenches[0].id);
    for(let i=0;i<12000;i++)sim.step(.05);
    expect(sim.state.living!.lethalNeeds).toBe(false);
    expect(sim.state.living!.ledger.imported.food).toBeGreaterThan(0);
  },15000);
  it('uses deterministic priorities even when an old neural result is injected',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0];let requests=0;
    g.policy='learned';sim.garrisons.requestPolicy=()=>requests++;
    sim.garrisons.policyActions.set(g.id,{at:0,action:[-1,-1,-1,-1,-1,-1],modelId:'retired'});
    sim.step(.05);expect(g.policy).toBe('rules');expect(requests).toBe(0);expect(g.scores[0]).toBeGreaterThan(.5);
    expect(g.jobs?.find(j=>j.kind==='watch')?.required).toBe(g.watchRequired);
  });
  it('queues supplied facility jobs without stealing a player-ordered engineer',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0],engineer=sim.state.squads.find(q=>q.kind==='engineer')!;
    const id=sim.garrisons.requestFacility(g.id,'rest');expect(id).toBeDefined();
    expect(engineer.constructionQueue).toContainEqual({kind:'facility',id});
    expect(sim.state.living!.facilities.find(f=>f.id===id)?.progress).toBe(0);
    expect(new SaveSystem().parse(JSON.stringify(sim.state)).squads).toEqual(sim.state.squads);
    sim.issueHold([engineer.id]);expect(engineer.constructionQueue).toContainEqual({kind:'facility',id});
    sim.issueMove([engineer.id],{x:engineer.x,z:engineer.z-20});expect(engineer.constructionQueue).toEqual([]);
    expect(sim.garrisons.requestFacility(g.id,'meal')).toBeUndefined();
  });
  it('rejects support connectors beyond forty metres or facing forward',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0],origin={x:g.entrance.x+20,z:g.entrance.z};
    expect(sim.requestConstruction({kind:'facility',garrisonId:g.id,facilityKind:'rest',origin,position:{x:origin.x,z:origin.z-41}})).toBeUndefined();
    expect(sim.requestConstruction({kind:'facility',garrisonId:g.id,facilityKind:'rest',origin,position:{x:origin.x,z:origin.z+12}})).toBeUndefined();
  });
  it('retains excess truck cargo at a full destination with a balanced ledger',()=>{
    const sim=createStudyScenario(),w=sim.state.living!,g=w.garrisons[0],truck=w.trucks.find(t=>t.role==='shuttle')!;
    w.logistics!.forwardCapacity=5;truck.garrisonId=g.id;truck.state='unloading';truck.timer=0;truck.x=g.forward.x;truck.z=g.forward.z;
    transfer(w.rearStock,truck.cargo,'water',10);sim.garrisons.logistics.step(.05);
    expect(total(g.forwardStock)).toBe(5);expect(truck.cargo.water).toBe(5);expect(truck.state).toBe('unloading');expect(truck.reason).toContain('full');
    for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
  it('uses a scenario manifest only at scheduled map-edge loading',()=>{
    const sim=createStudyScenario(),w=sim.state.living!;w.logistics!.manifest.food=7;w.logistics!.deliveryInterval=900;
    sim.garrisons.logistics.step(.05);expect(w.ledger.imported.food).toBe(7);expect(w.nextDelivery).toBe(900);
    expect(w.trucks.find(t=>t.role==='convoy')!.cargo.food).toBe(7);
  });
  it('returns undelivered convoy stock from a full rear depot without destroying cargo or importing it twice',()=>{
    const sim=createStudyScenario(),w=sim.state.living!,t=w.trucks.find(t=>t.role==='convoy')!;
    sim.garrisons.logistics.step(.05);const cargo={...t.cargo},imports={...w.ledger.imported};
    w.logistics!.rearCapacity=total(w.rearStock);Object.assign(t,w.rear,{state:'unloading',timer:0});
    sim.garrisons.logistics.step(.05);expect(t.state).toBe('returning');expect(t.cargo).toEqual(cargo);
    for(let i=0;i<1800&&t.state!=='idle';i++)sim.garrisons.logistics.step(.05);
    expect(t.state).toBe('idle');expect(t.x).toBe(-1980);expect(t.cargo).toEqual(cargo);
    sim.state.elapsed=w.nextDelivery;sim.garrisons.logistics.step(.05);
    expect(t.state).toBe('loading');expect(t.cargo).toEqual(cargo);
    for(const key of Object.keys(cargo) as (keyof typeof cargo)[])if(key!=='fuel')expect(w.ledger.imported[key]).toBe(imports[key]);
    for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
  it('grants sheltered sleep benefits only in a completed nearby dugout',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0],s=sim.state.soldiers[0],id=sim.garrisons.requestFacility(g.id,'rest')!;
    const f=sim.state.living!.facilities.find(f=>f.id===id)!;s.x=f.x;s.z=f.z;
    s.duty={kind:'sleep',destination:{x:s.x,z:s.z},route:[],routeIndex:0,since:0,arrivedAt:0,until:300,facilityId:id,reason:'Rest test',blockedFor:0};
    s.needs!.energy=30;updateNeeds(sim.state,s,75);const floor=s.needs!.energy;
    s.needs!.energy=30;f.progress=1;updateNeeds(sim.state,s,75);expect(s.needs!.energy).toBeGreaterThan(floor);expect(s.needs!.energy).toBe(42);
  });
  it('does not reserve an entrance loading berth during a distant meal approach',()=>{
    const sim=createStudyScenario(1944,2),g=sim.state.living!.garrisons[0],s=sim.state.soldiers.at(-1)!;
    s.x=g.entrance.x+125;s.z=g.entrance.z;s.needs!.thirst=90;transfer(s.carried!,g.cache,'food',s.carried!.food);transfer(s.carried!,g.cache,'water',s.carried!.water);
    sim.step(.05);expect(s.duty?.kind).toBe('meal');expect(s.duty?.pickupQueued).toBe(true);
    expect(Math.hypot(s.duty!.destination.x-g.entrance.x,s.duty!.destination.z-g.entrance.z)).toBeGreaterThan(12);
  });
  it('rejoins the centreline before leaving a wide support bay',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0],id=sim.garrisons.requestFacility(g.id,'rest')!;
    const f=sim.state.living!.facilities.find(f=>f.id===id)!,t=sim.state.trenches.find(t=>t.id===f.connectorId)!;t.progress=1;t.status='complete';f.progress=1;
    const s=sim.state.soldiers[0];for(const other of sim.state.soldiers)other.needs!.energy=40;
    s.x=f.x+1.8;s.z=f.z+1.8;s.needs!.energy=100;sim.step(.05);
    expect(s.duty?.kind).toBe('watch');expect(s.duty?.networkBound).toBe(true);
    const route=[s,...s.duty!.route];expect(route.every((p,i)=>i===0||sim.garrisons.network.segmentInside(route[i-1],p))).toBe(true);
  });
  it('moves full-store haulers aside so consumers can free storage space',()=>{
    const sim=createStudyScenario(),w=sim.state.living!,g=w.garrisons[0],s=sim.state.soldiers[0];g.nextDecision=1000;
    w.logistics!.cacheCapacity=total(g.cache);s.x=g.entrance.x+4;s.z=g.entrance.z-1.13;
    s.duty={kind:'haul',stage:'deliver',destination:{x:s.x,z:s.z},route:[],routeIndex:0,since:0,arrivedAt:0,until:300,reason:'Full cache delivery',blockedFor:0};
    const stock={...g.cache},cargo={...s.carried};for(let i=0;i<62;i++)sim.step(.05);
    expect(g.cache).toEqual(stock);expect(s.carried).toEqual(cargo);expect(s.duty?.pickupQueued).toBe(true);
    expect(Math.hypot(s.duty!.destination.x-g.entrance.x,s.duty!.destination.z-g.entrance.z)).toBeGreaterThan(10);
    for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
  it('collects construction shortages without filling a supplied camp with extra food',()=>{
    const sim=createStudyScenario(),w=sim.state.living!,g=w.garrisons[0],s=sim.state.soldiers[0];g.nextDecision=1000;
    transfer(g.cache,w.rearStock,'materials',g.cache.materials);
    transfer(w.rearStock,g.forwardStock,'materials',20);transfer(w.rearStock,g.forwardStock,'food',20);transfer(w.rearStock,g.forwardStock,'water',20);
    s.x=g.forward.x;s.z=g.forward.z;s.duty={kind:'haul',stage:'pickup',destination:{x:s.x,z:s.z},route:[],routeIndex:0,since:0,arrivedAt:0,until:300,reason:'Demand dispatch',blockedFor:0};
    const food=s.carried!.food,water=s.carried!.water;for(let i=0;i<62;i++)sim.step(.05);
    expect(s.carried!.materials).toBe(8);expect(s.carried!.food).toBe(food);expect(s.carried!.water).toBe(water);
  });
  it('gives exhausted floor sleepers distinct temporary destinations',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0],people=sim.state.soldiers.slice(0,2);
    for(const [i,s] of people.entries()){s.x=g.entrance.x+35;s.z=g.entrance.z+(i?-.6:.6);s.needs!.energy=10;}
    sim.step(.05);expect(people.every(s=>s.duty?.kind==='sleep')).toBe(true);
    const [a,b]=people.map(s=>s.duty!.destination);expect(Math.hypot(a.x-b.x,a.z-b.z)).toBeGreaterThan(.9);
  });
  it('an explicit stand-to interrupts fit sleepers while retaining real cargo',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0];
    for(const s of sim.state.soldiers){s.needs!.energy=60;s.duty={kind:'sleep',destination:{x:s.x,z:s.z},route:[],routeIndex:0,since:0,arrivedAt:0,until:600,reason:'Night rest',blockedFor:0};}
    const packs=sim.state.soldiers.map(s=>({...s.carried}));sim.garrisons.setReadiness(g.id,'stand-to');sim.step(.05);
    expect(sim.state.soldiers.filter(s=>s.duty?.kind==='watch')).toHaveLength(22);
    expect(sim.state.soldiers.map(s=>s.carried)).toEqual(packs);
  });
  it('lets an exhausted soldier finish eating instead of restarting the six-second meal every decision',()=>{
    const sim=createStudyScenario(),s=sim.state.soldiers[0];s.needs!.energy=5;s.needs!.hunger=80;s.needs!.thirst=80;
    s.duty={kind:'meal',stage:'deliver',destination:{x:s.x,z:s.z},route:[],routeIndex:0,since:0,arrivedAt:0,until:15,reason:'Urgent meal before rest',blockedFor:0};
    const food=s.carried!.food;for(let i=0;i<125;i++)sim.step(.05);
    expect(s.carried!.food).toBe(food-1);expect(s.needs!.thirst).toBeLessThan(40);expect(s.needs!.life).toBe('active');
  });
  it('does not reset an acknowledged supply incident after a token delivery',()=>{
    const sim=createStudyScenario(),w=sim.state.living!,g=w.garrisons[0];
    transfer(g.cache,w.rearStock,'food',g.cache.food);transfer(g.cache,w.rearStock,'water',g.cache.water);
    sim.garrisons.resolveEmergency(g.id,'hold');transfer(w.rearStock,g.cache,'food',1);transfer(w.rearStock,g.cache,'water',1);
    sim.step(.05);expect(g.cutoff).toBe('hold');expect(sim.state.simSpeed).toBe(1);
  });
  it('clears a crowded entrance without trapping exterior walkers on obsolete detour points',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0];g.nextDecision=10000;
    const offsets=[[-1.46,-1.31],[-.55,-1.92],[-1.04,-1.67],[-.05,-1.74],[-1.77,-.84]];
    for(const [i,s] of sim.state.soldiers.entries()){
      s.x=g.entrance.x+(offsets[i]?.[0]??50+i*2);s.z=g.entrance.z+(offsets[i]?.[1]??1.1);
      s.needs!.energy=90;s.needs!.hunger=0;s.needs!.thirst=0;
      const destination=i<3?{x:g.entrance.x+20+i*3,z:g.entrance.z+1.1}:{x:s.x,z:s.z};
      s.duty={kind:i<3?'rest':'sleep',destination,route:i<3?[{x:g.entrance.x-.91,z:g.entrance.z-.76},{...g.entrance},destination]:[],routeIndex:0,since:0,arrivedAt:i<3?undefined:0,until:10000,reason:'Entrance queue regression',blockedFor:0};
    }
    for(let i=0;i<100;i++)sim.step(.05);
    const restored=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(sim.state)));
    for(let i=0;i<1500;i++){sim.step(.05);restored.step(.05);}
    expect(restored.state).toEqual(sim.state);
    for(const s of sim.state.soldiers.slice(0,3)){
      expect(s.duty?.arrivedAt).toBeDefined();expect(s.x).toBeGreaterThan(g.entrance.x+19);
      expect(s.duty?.blockedFor).toBe(0);
    }
  });
  it('routes an external approach around a branch rather than through its wall',()=>{
    const sim=createStudyScenario(1944,1),entrance=sim.state.living!.garrisons[0].entrance;
    const from={x:entrance.x+95,z:entrance.z+20};
    const avoid=(p:{x:number;z:number})=>sim.garrisons.network.corridorContains(p)&&Math.hypot(p.x-entrance.x,p.z-entrance.z)>3;
    const route=sim.navigation.plan(from,entrance,avoid);expect(route.length).toBeGreaterThan(1);
    const points=[from,...route];
    expect(points.every((p,i)=>i===0||sim.navigation.segmentClear(points[i-1],p,.4,avoid))).toBe(true);
  });
  it('allows nearby entry from inside a completed trench loop without teleporting',()=>{
    const sim=createStudyScenario(1944,2),g=sim.state.living!.garrisons[0],q=sim.state.squads[0];
    sim.issueHold([q.id]);
    for(const s of sim.state.soldiers.filter(s=>s.squadId===q.id)){s.x=g.entrance.x+100;s.z=g.entrance.z+30;}
    const before=sim.state.soldiers.filter(s=>s.squadId===q.id).map(s=>({x:s.x,z:s.z}));
    expect(sim.assignGarrison([q.id],g.trenchId)).toBe(true);
    expect(sim.state.soldiers.filter(s=>s.squadId===q.id).map(s=>({x:s.x,z:s.z}))).toEqual(before);
    sim.step(.05);
    for(const s of sim.state.soldiers.filter(s=>s.squadId===q.id)){
      expect(s.duty?.entryPoint).toBeDefined();
      expect(Math.hypot(s.duty!.entryPoint!.x-s.x,s.duty!.entryPoint!.z-s.z)).toBeLessThan(35);
      expect(sim.garrisons.network.corridorContains(s.duty!.entryPoint!)).toBe(true);
    }
  });
  it('uses timed carried rations at a post without counting simultaneous watch duty',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0],s=sim.state.soldiers[0];g.nextDecision=10000;
    s.x=g.entrance.x+25;s.z=g.entrance.z;s.needs!.hunger=80;s.needs!.thirst=80;
    s.duty={kind:'watch',destination:{x:s.x,z:s.z},route:[],routeIndex:0,since:0,arrivedAt:0,until:10000,reason:'Post ration break',blockedFor:0};
    const pack={...s.carried!};for(let i=0;i<100;i++)sim.step(.05);
    expect(s.action).toBe('eating');expect(g.watchPresent).toBe(0);expect(s.needs!.watchHours).toBe(0);expect(s.carried).toEqual(pack);
    for(let i=0;i<24;i++)sim.step(.05);
    expect(s.duty?.kind).toBe('watch');expect(s.needs!.thirst).toBeLessThan(40);expect(s.carried!.water).toBe(pack.water-1);
  });
  it('physically replenishes a thirsty occupied post before incapacitation',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0],guard=sim.state.soldiers[0],runner=sim.state.soldiers[6];
    for(const [i,s] of sim.state.soldiers.entries()){
      s.x=g.entrance.x+25+i*2;s.z=g.entrance.z;s.needs!.energy=i<7?90:35;
      s.duty={kind:i<6?'watch':'rest',destination:{x:s.x,z:s.z},route:[],routeIndex:0,since:0,arrivedAt:0,until:10000,reason:'Supply-to-post test',blockedFor:0};
    }
    runner.duty!.kind='meal';runner.duty!.until=0;runner.duty!.stage='deliver';guard.needs!.thirst=90;transfer(guard.carried!,g.cache,'water',guard.carried!.water);
    sim.step(.05);expect(runner.duty?.patientId).toBe(guard.id);g.nextDecision=10000;
    expect(guard.carried!.water).toBe(0);
    for(let i=0;i<1000;i++)sim.step(.05);
    expect(guard.needs!.life).toBe('active');expect(guard.needs!.thirst).toBeLessThan(45);expect(guard.carried!.water).toBeGreaterThan(0);
    for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
  it('safely retires an old saved chain of already-arrived relief guards',()=>{
    const sim=createStudyScenario(),people=sim.state.soldiers.slice(0,3);
    people.forEach((s,i)=>{s.duty={kind:'watch',destination:{x:s.x,z:s.z},route:[],routeIndex:0,since:0,arrivedAt:0,until:0,reason:'Old relief chain',blockedFor:0,relieving:i<2?people[i+1].id:undefined};});
    expect(()=>sim.step(.05)).not.toThrow();
    expect(people[0].duty?.relieving).toBeUndefined();
  });
  it('rests on nearby free berm floor instead of demanding an exact blocked parking point',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0],s=sim.state.soldiers[0];g.nextDecision=10000;
    s.x=g.entrance.x+30;s.z=g.entrance.z-1.13;const position={x:s.x,z:s.z},destination={x:s.x+.4,z:s.z};
    s.duty={kind:'rest',destination,route:[destination],routeIndex:0,since:0,until:100,reason:'Flexible floor rest',blockedFor:4,networkBound:true};
    sim.step(.05);sim.step(.05);
    expect(s.duty.arrivedAt).toBeDefined();expect({x:s.x,z:s.z}).toEqual(position);
  });
});

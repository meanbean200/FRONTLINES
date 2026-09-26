import {describe,it,expect,vi} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {updateCasualtyCare} from './Casualties';
import {careRouteLength,nearbyAidPost,rescueExposed,RESCUE_LIMITS} from './CasualtyTriage';
import {inventory} from '../garrison/types';
import {balance} from '../garrison/Inventory';
import {SaveSystem} from '../persistence/SaveSystem';

function setup(){
  const state=createOperation('campaign'),sim=new BattlefieldSimulation(state),patient=state.soldiers[0],helper=state.soldiers[1],g=state.living!.garrisons[0];
  for(const s of state.soldiers){s.x=1800;s.z=1800;s.nextShotAt=1e9;delete s.duty;}
  Object.assign(patient,{x:0,z:0,health:20});Object.assign(helper,{x:1,z:0});
  patient.needs!.life='incapacitated';patient.combat={shotSequence:0,wound:{severity:'critical',at:0,bleedUntil:240,stabilized:false,care:'untreated'}};
  vi.spyOn(sim.terrain,'obstacleAt').mockReturnValue(false);vi.spyOn(sim.navigation,'plan').mockImplementation((_a,b)=>[{x:b.x,z:b.z}]);
  const post=(x=8,z=0)=>{const f={id:state.nextEntityId++,garrisonId:g.id,kind:'aid' as const,x,z,connectorId:g.trenchId,progress:1,capacity:4,paid:true,stock:inventory(),materialCost:18};state.living!.facilities.push(f);return f;};
  const tick=(seconds:number)=>{for(let n=0;n<Math.round(seconds/.05);n++){state.elapsed+=.05;updateCasualtyCare(state,sim.terrain,sim.navigation,.05);}};
  return{state,sim,patient,helper,g,post,tick};
}

describe('bounded casualty triage',()=>{
  it('reassesses a blocked rescue automatically when a nearby aid post becomes available',()=>{
    const {state,patient,helper,post,tick}=setup();tick(25);
    expect(patient.combat!.wound!.stabilized).toBe(true);expect(helper.combat!.careTask).toBeUndefined();
    expect(state.operation!.rescueDecisions![0].choice).toBe('pending');
    const saved=new SaveSystem().parse(JSON.stringify(state));expect(saved.operation!.rescueDecisions![0].reviewAt).toBeGreaterThan(state.elapsed);
    post(60);tick(32);
    expect(helper.combat!.careTask?.stage).toBe('carry');expect(state.operation!.rescueDecisions).toEqual([]);
  });
  it('automatic retry keeps checking exposure rather than granting a risk override',()=>{
    const {state,sim,patient,helper,post,tick}=setup();post();
    vi.spyOn(sim.terrain.objects,'trace').mockReturnValue({clear:true,transmission:1});
    for(let i=0;i<3;i++){
      state.operation!.contacts={player:[{soldierId:999,squadId:998,x:10,z:0,lastSeen:state.elapsed,visible:false,active:true}],enemy:[]};
      tick(2);expect(helper.combat!.careTask).toBeUndefined();expect(patient.combat!.wound!.stabilized).toBe(false);
      state.elapsed+=30;
    }
    state.operation!.contacts={player:[],enemy:[]};tick(5);expect(helper.combat!.careTask?.patientId).toBe(patient.id);
  });
  it('stabilizes locally instead of assigning a kilometre-long carry',()=>{
    const {state,patient,helper,post,tick}=setup();post(1000);const initial=helper.carried!.medical;
    tick(60);expect(patient.combat!.wound!.stabilized).toBe(true);expect(helper.combat!.careTask).toBeUndefined();expect(helper.x).toBeLessThan(2);expect(patient.x).toBe(0);
    expect(helper.carried!.medical).toBe(initial-1);expect(state.operation!.rescueDecisions![0].reason).toContain('120 m');
    for(const n of Object.values(balance(state)))expect(Math.abs(n)).toBeLessThan(1e-8);
  });
  it('chooses actual walking distance, not just straight-line proximity',()=>{
    const {state,sim,patient,helper,post}=setup(),near=post(10),reachable=post(30);
    vi.mocked(sim.navigation.plan).mockImplementation((_a,b)=>b.x===10?[{x:0,z:200},{x:b.x,z:b.z}]:[{x:b.x,z:b.z}]);
    expect(nearbyAidPost(state,sim.navigation,patient,helper,'player')!.post.id).toBe(reachable.id);
    state.living!.facilities=state.living!.facilities.filter(f=>f.id!==reachable.id);expect(nearbyAidPost(state,sim.navigation,patient,helper,'player')).toBeUndefined();expect(near.id).not.toBe(reachable.id);
  });
  it('reports an unsuccessful explicit retry instead of hiding the unresolved rescue',()=>{
    const {state,sim,helper,post,tick}=setup();post(1000);tick(20);
    state.operation!.rescueDecisions![0].choice='approved';state.elapsed+=4;
    updateCasualtyCare(state,sim.terrain,sim.navigation,.05);
    expect(helper.combat!.careTask).toBeUndefined();expect(state.operation!.rescueDecisions![0].choice).toBe('pending');
  });
  it('counts patients already at an aid post as occupied capacity',()=>{
    const {state,sim,patient,helper,post}=setup(),f=post();f.capacity=1;
    const other=state.soldiers[2];Object.assign(other,{x:f.x,z:f.z});other.needs!.life='incapacitated';other.combat={shotSequence:0,wound:{severity:'disabling',at:0,stabilized:true,care:'aid-post'}};
    expect(nearbyAidPost(state,sim.navigation,patient,helper,'player')).toBeUndefined();
    expect(nearbyAidPost(state,sim.navigation,other,other,'player')!.post.id).toBe(f.id);
  });
  it('does not start an impossible bleeding-deadline rescue and helps a reachable casualty instead',()=>{
    const {state,sim,patient,helper}=setup();patient.combat!.wound!.bleedUntil=5;
    const other=state.soldiers[2];Object.assign(other,{x:3,z:0,health:20});other.needs!.life='incapacitated';other.combat={shotSequence:0,wound:{severity:'critical',at:0,bleedUntil:240,stabilized:false,care:'untreated'}};
    updateCasualtyCare(state,sim.terrain,sim.navigation,.05);expect(helper.combat!.careTask!.patientId).toBe(other.id);expect(patient.combat!.pauseReason).toContain('arrive in time');
    state.elapsed=6;updateCasualtyCare(state,sim.terrain,sim.navigation,.05);expect(patient.needs!.life).toBe('dead');
  });
  it('prioritizes timely critical aid over a closer minor wound',()=>{
    const {state,sim,patient,helper}=setup();patient.x=10;const other=state.soldiers[2];Object.assign(other,{x:helper.x,z:.5});other.combat={shotSequence:0,wound:{severity:'minor',at:0,stabilized:false,care:'untreated'}};
    updateCasualtyCare(state,sim.terrain,sim.navigation,.05);expect(helper.combat!.careTask!.patientId).toBe(patient.id);
  });
  it('does not take an entire rifle squad off duty to carry casualties',()=>{
    const {state,sim,helper}=setup(),squad=state.squads[0];
    const team=state.soldiers.filter(s=>s.squadId===squad.id);team.forEach((s,i)=>{s.x=i;s.z=0;});
    for(const p of state.soldiers.filter(s=>s.squadId===state.squads[1].id).slice(0,4)){p.x=5;p.z=2;p.health=40;p.needs!.life='incapacitated';p.combat={shotSequence:0,wound:{severity:'disabling',at:0,stabilized:false,care:'untreated'}};}
    updateCasualtyCare(state,sim.terrain,sim.navigation,.05);
    const assigned=team.filter(s=>s.combat?.careTask);expect(assigned).toHaveLength(1);expect(helper.combat!.careTask).toBeDefined();
  });
  it('rechecks old in-progress carries and leaves the patient at the actual position',()=>{
    const {state,sim,patient,helper,post}=setup(),f=post(1000);patient.combat!.wound={severity:'disabling',at:0,stabilized:true,care:'stabilized'};patient.x=helper.x=20;
    helper.combat={shotSequence:0,owner:'casualty',careTask:{patientId:patient.id,stage:'carry',route:[{x:1000,z:0}],index:0,progress:0,destination:{x:1000,z:0},facilityId:f.id,blockedFor:0}};
    updateCasualtyCare(state,sim.terrain,sim.navigation,.05);expect(helper.combat.careTask).toBeUndefined();expect(patient.x).toBe(20);expect(helper.x).toBe(20);expect(state.operation!.rescueDecisions![0].reason).toContain('980 m');
  });
  it('does not automatically detach the last able rifleman',()=>{
    const {state,sim,patient,helper}=setup();
    for(const s of state.soldiers.filter(s=>s.squadId===helper.squadId&&s!==helper&&s!==patient)){s.needs!.life='dead';s.health=0;}
    updateCasualtyCare(state,sim.terrain,sim.navigation,.05);expect(helper.combat!.careTask).toBeUndefined();
  });
  it('leaves the patient at the aid post and releases the helper when road pickup is too far',()=>{
    const {state,patient,helper,g,post,tick}=setup();post();g.forward={x:900,z:0};tick(65);
    expect(patient.combat!.wound!.care).toBe('aid-post');expect(helper.combat!.careTask).toBeUndefined();expect(patient.x).toBeCloseTo(8,0);expect(helper.x).toBeLessThan(9);expect(state.operation!.rescueDecisions![0].reason).toContain('60 m');
  });
  it('releases the carrier at a nearby pickup and boards only an actual arriving truck',()=>{
    const {state,sim,patient,helper,g,post,tick}=setup();post();g.forward={x:30,z:0};tick(100);
    expect(patient.combat!.wound!.care).toBe('awaiting-transport');expect(helper.combat!.careTask).toBeUndefined();expect(patient.x).toBeCloseTo(30,0);
    const saved=new SaveSystem().parse(JSON.stringify(state));expect(saved.soldiers[0].combat!.wound!.care).toBe('awaiting-transport');
    const truck=state.living!.trucks.find(t=>t.role==='shuttle'&&t.faction!=='enemy')!;Object.assign(truck,{x:30,z:0,state:'unloading'});
    updateCasualtyCare(state,sim.terrain,sim.navigation,.05);expect(truck.passengers).toEqual([patient.id]);expect(patient.combat!.wound!.care).toBe('transport');
    for(const n of Object.values(balance(state)))expect(Math.abs(n)).toBeLessThan(1e-8);
  });
  it('keeps Leave for now across save/load and more than the old 30-second cooldown',()=>{
    const {state,sim,patient,helper,tick}=setup();state.operation!.rescueDecisions=[{patientId:patient.id,side:'player',reason:'Rescue exposed to reported enemy fire',choice:'hold',reviewAt:1}];
    tick(40);expect(helper.combat?.careTask).toBeUndefined();expect(patient.combat!.wound!.stabilized).toBe(false);
    expect(new SaveSystem().parse(JSON.stringify(state)).operation!.rescueDecisions![0].choice).toBe('hold');
    state.operation!.rescueDecisions![0].choice='approved';state.elapsed+=4;updateCasualtyCare(state,sim.terrain,sim.navigation,.05);expect(helper.combat!.careTask!.patientId).toBe(patient.id);
  });
  it('checks reported threats along a carry route without reading hidden enemies',()=>{
    const {state,sim,helper}=setup();vi.spyOn(sim.terrain.objects,'trace').mockReturnValue({clear:true,transmission:1});
    const enemy=state.soldiers.find(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')!;Object.assign(enemy,{x:50,z:0});
    expect(rescueExposed(state,sim.terrain,helper,[{x:110,z:0}])).toBe(false);
    state.operation!.contacts={player:[{soldierId:enemy.id,squadId:enemy.squadId,x:50,z:0,lastSeen:0,visible:false,active:true}],enemy:[]};
    expect(rescueExposed(state,sim.terrain,helper,[{x:110,z:0}])).toBe(true);enemy.x=1800;
    expect(rescueExposed(state,sim.terrain,helper,[{x:110,z:0}])).toBe(true);state.elapsed=13;expect(rescueExposed(state,sim.terrain,helper,[{x:110,z:0}])).toBe(false);
  });
  it('stops an ongoing carry when a new reported threat exposes its route',()=>{
    const {state,sim,patient,helper,post,tick}=setup();post(60);tick(20);expect(helper.combat!.careTask!.stage).toBe('carry');
    vi.spyOn(sim.terrain.objects,'trace').mockReturnValue({clear:true,transmission:1});
    state.operation!.contacts={player:[{soldierId:999,squadId:998,x:55,z:0,lastSeen:state.elapsed,visible:false,active:true}],enemy:[]};
    helper.combat!.careTask!.reviewAt=0;const where={x:patient.x,z:patient.z};updateCasualtyCare(state,sim.terrain,sim.navigation,.05);
    expect(helper.combat!.careTask).toBeUndefined();expect({x:patient.x,z:patient.z}).toEqual(where);expect(state.operation!.rescueDecisions![0].reason).toContain('reported enemy fire');
  });
  it('applies the same distance limit to enemy care without using a friendly aid post',()=>{
    const {state,sim,patient,helper,post,tick}=setup(),enemySquad=state.squads.find(q=>q.faction==='enemy')!;
    // Keep a valid roster while putting this fixture's pair on the other side.
    for(const s of [patient,helper]){state.squads.find(q=>q.id===s.squadId)!.soldierIds=state.squads.find(q=>q.id===s.squadId)!.soldierIds.filter(id=>id!==s.id);s.squadId=enemySquad.id;enemySquad.soldierIds.push(s.id);}
    post(8);tick(30);expect(patient.combat!.wound!.stabilized).toBe(true);expect(helper.combat!.careTask).toBeUndefined();expect(patient.x).toBe(0);expect(state.operation!.rescueDecisions![0].side).toBe('enemy');
    expect(nearbyAidPost(state,sim.navigation,patient,helper,'enemy')).toBeUndefined();
  });
  it('clears an orphaned carrying pose after an explicit order cancels the helper task',()=>{
    const {state,sim,patient,helper,post,tick}=setup();post(60);tick(20);expect(patient.action).toBe('being carried');
    delete helper.combat!.careTask;helper.combat!.nextCareReview=100;const x=patient.x;
    updateCasualtyCare(state,sim.terrain,sim.navigation,.05);expect(patient.action).toBe('incapacitated');expect(patient.x).toBe(x);
  });
  it('does not teleport an uncollected patient to a dead helper or keep transporting the dead',()=>{
    const {state,sim,patient,helper}=setup();helper.x=25;helper.needs!.life='dead';helper.health=0;helper.combat={shotSequence:0,careTask:{patientId:patient.id,stage:'approach',route:[{x:0,z:0}],index:0,progress:0,destination:{x:0,z:0},blockedFor:0}};
    updateCasualtyCare(state,sim.terrain,sim.navigation,.05);expect(patient.x).toBe(0);expect(helper.combat.careTask).toBeUndefined();
    const truck=state.living!.trucks[0];truck.passengers=[patient.id];patient.needs!.life='dead';patient.health=0;patient.combat!.wound!.severity='fatal';delete patient.combat!.wound!.bleedUntil;
    updateCasualtyCare(state,sim.terrain,sim.navigation,.05);expect(truck.passengers).toEqual([]);expect(patient.x).toBe(0);expect(patient.combat!.wound!.returnAt).toBeUndefined();
  });
  it('drops a rescue assignment when pinned, preserving the casualty and the squad order',()=>{
    const {state,sim,patient,helper,post}=setup(),f=post();patient.combat!.wound!.stabilized=true;delete patient.combat!.wound!.bleedUntil;patient.x=helper.x=4;
    helper.combat={shotSequence:0,reaction:'pinned',owner:'reaction',careTask:{patientId:patient.id,stage:'carry',route:[{x:8,z:0}],index:0,progress:0,destination:{x:8,z:0},facilityId:f.id,blockedFor:0}};
    const order=structuredClone(state.squads[0].order);updateCasualtyCare(state,sim.terrain,sim.navigation,.05);
    expect(helper.combat.careTask).toBeUndefined();expect(patient.x).toBe(4);expect(state.squads[0].order).toEqual(order);expect(state.operation!.rescueDecisions![0].reason).toContain('pinned');
  });
  it('validates serialized care timers and preserves in-progress care exactly',()=>{
    const {state,sim,patient,helper,post,tick}=setup();post();tick(20);expect(helper.combat!.careTask?.stage).toBe('carry');
    const copy=new SaveSystem().parse(JSON.stringify(state)),other=new BattlefieldSimulation(copy);vi.spyOn(other.terrain,'obstacleAt').mockReturnValue(false);vi.spyOn(other.navigation,'plan').mockImplementation((_a,b)=>[{x:b.x,z:b.z}]);
    for(let n=0;n<100;n++){state.elapsed+=.05;copy.elapsed+=.05;updateCasualtyCare(state,sim.terrain,sim.navigation,.05);updateCasualtyCare(copy,other.terrain,other.navigation,.05);}
    expect(copy).toEqual(state);helper.combat!.careTask!.reviewAt=NaN;expect(()=>new SaveSystem().parse(JSON.stringify(state))).toThrow();
    expect(patient.needs!.life).toBe('incapacitated');expect(careRouteLength({x:0,z:0},[{x:2001,z:0}])).toBe(Infinity);expect(RESCUE_LIMITS.carry).toBe(120);
  });
});

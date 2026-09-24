import {describe,it,expect,vi} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {combatWound,updateCasualtyCare} from './Casualties';
import {updateNeeds} from '../garrison/NeedsSystem';
import {balance} from '../garrison/Inventory';
import {SaveSystem} from '../persistence/SaveSystem';
import {stepBuildings} from '../simulation/BuildingSystem';
import {doorPoint,floorHeight} from '../terrain/BuildingGeometry';
import {inventory} from '../garrison/types';
function setup(){const state=createOperation('advance'),sim=new BattlefieldSimulation(state),patient=state.soldiers[0],helper=state.soldiers[1];state.operation!.casualtyRules=true;for(const s of state.soldiers){s.x=1800;s.z=1800;s.nextShotAt=1e9;}Object.assign(patient,{x:0,z:0});Object.assign(helper,{x:1,z:0});helper.carried!.medical+=2;state.living!.ledger.initial.medical+=2;vi.spyOn(sim.terrain,'obstacleAt').mockReturnValue(false);vi.spyOn(sim.navigation,'plan').mockImplementation((_a,b)=>[{x:b.x,z:b.z}]);patient.combat={shotSequence:0,wound:{severity:'critical',at:0,bleedUntil:60,stabilized:false,care:'untreated'}};patient.health=20;patient.needs!.life='incapacitated';return{state,sim,patient,helper};}
describe('physical casualty care',()=>{
  it('waits for an explicit retry after a blocked rescue instead of recycling helpers',()=>{
    const {state,sim,patient,helper}=setup();vi.mocked(sim.navigation.plan).mockReturnValue([]);updateCasualtyCare(state,sim.terrain,sim.navigation,.05);expect(state.operation!.rescueDecisions![0].choice).toBe('pending');
    vi.mocked(sim.navigation.plan).mockImplementation((_a,b)=>[{x:b.x,z:b.z}]);for(let i=0;i<400;i++){state.elapsed+=.05;updateCasualtyCare(state,sim.terrain,sim.navigation,.05);}expect(helper.combat?.careTask).toBeUndefined();expect(patient.combat!.wound!.stabilized).toBe(false);
    state.operation!.rescueDecisions![0].choice='approved';for(let i=0;i<450;i++){state.elapsed+=.05;updateCasualtyCare(state,sim.terrain,sim.navigation,.05);}expect(patient.combat!.wound!.stabilized).toBe(true);
  });
  it('does not let a stabilized patient awaiting a post block aid to another bleeding patient',()=>{
    const {state,sim,patient,helper}=setup(),waiting=state.soldiers[2];Object.assign(waiting,{x:helper.x,z:helper.z+.2,health:40});waiting.needs!.life='incapacitated';waiting.combat={shotSequence:0,wound:{severity:'disabling',at:0,stabilized:true,care:'stabilized'}};
    for(let i=0;i<500;i++){state.elapsed+=.05;updateCasualtyCare(state,sim.terrain,sim.navigation,.05);}
    expect(patient.combat!.wound!.stabilized).toBe(true);expect(helper.combat?.careTask).toBeUndefined();expect(waiting.combat.wound!.care).toBe('stabilized');
  });
  it('reaches an upstairs casualty through the doorway and stairs, then carries them down before evacuation',()=>{
    const state=createOperation('campaign'),sim=new BattlefieldSimulation(state),patient=state.soldiers[0],helper=state.soldiers[1],id=sim.terrain.buildings.findIndex(b=>b.height>6),b=sim.terrain.buildings[id],g=state.living!.garrisons[0];
    for(const s of state.soldiers){s.x=1800;s.z=1800;delete s.duty;}for(const q of state.squads)q.order={type:'hold',issuedAt:0};
    Object.assign(patient,{x:b.x-2,z:b.z,health:20});patient.needs!.life='incapacitated';patient.combat={shotSequence:0,wound:{severity:'critical',at:0,bleedUntil:240,stabilized:false,care:'untreated'}};
    patient.building={id,floor:1,vertical:floorHeight(b),route:[],index:0,stage:'station',target:{x:patient.x,z:patient.z},targetFloor:1,stairTime:0};Object.assign(helper,doorPoint(b,12));
    const post=doorPoint(b,25);state.living!.facilities.push({id:state.nextEntityId++,garrisonId:g.id,kind:'aid',...post,connectorId:g.trenchId,progress:1,capacity:4,paid:true,stock:inventory(),materialCost:18});g.forward=doorPoint(b,40);
    const truck=state.living!.trucks.find(t=>t.role==='shuttle'&&t.faction!=='enemy')!;Object.assign(truck,g.forward,{state:'unloading'});
    let upstairs=false,carriedDown=false;
    for(let i=0;i<7000&&patient.combat.wound!.care!=='transport';i++){state.elapsed+=.05;updateCasualtyCare(state,sim.terrain,sim.navigation,.05);stepBuildings(state,sim.terrain,sim.navigation,.05);if(helper.building?.floor===1)upstairs=true;if(upstairs&&patient.building?.stage==='stairs'&&patient.building.targetFloor===0)carriedDown=true;}
    expect(upstairs).toBe(true);expect(carriedDown).toBe(true);expect(patient.combat.wound!.care,JSON.stringify({h:helper.combat,b:helper.building,p:patient})).toBe('transport');expect(patient.building).toBeUndefined();
    for(const n of Object.values(balance(state)))expect(Math.abs(n)).toBeLessThan(1e-7);
  },20000);
  it('does not erase wounds with rest; critical deterioration is explicit',()=>{
    const {state,patient}=setup();patient.needs!.hunger=10;patient.needs!.thirst=10;
    updateNeeds(state,patient,10);expect(patient.health).toBe(20);expect(patient.needs!.life).toBe('incapacitated');
    const copy=new SaveSystem().parse(JSON.stringify(state));expect(copy.soldiers[0].combat!.wound!.bleedUntil).toBe(60);
  });
  it('requires arrival, treatment time and a real kit to stop bleeding',()=>{
    const {state,sim,patient,helper}=setup();const before=helper.carried!.medical;
    for(let i=0;i<500;i++){state.elapsed+=.05;updateCasualtyCare(state,sim.terrain,sim.navigation,.05);}
    expect(patient.combat!.wound!.stabilized).toBe(true);expect(patient.combat!.wound!.bleedUntil).toBeUndefined();expect(helper.carried!.medical).toBe(before-1);expect(patient.needs!.life).toBe('incapacitated');
    for(const value of Object.values(balance(state)))expect(Math.abs(value)).toBeLessThan(1e-8);
  });
  it('does not repeatedly send a helper into a known exposed rescue',()=>{
    const {state,sim,patient,helper}=setup();helper.suppression=40;
    for(let i=0;i<80;i++){state.elapsed+=.1;updateCasualtyCare(state,sim.terrain,sim.navigation,.1);}
    expect(helper.combat!.careTask).toBeUndefined();expect(state.operation!.rescueDecisions).toHaveLength(1);expect(patient.combat!.wound!.stabilized).toBe(false);
  });
  it('full-energy hits can remove someone immediately without requiring two hits',()=>{
    const {state,patient}=setup();let removed=0,fatal=0;
    for(let i=0;i<100;i++){patient.health=100;patient.needs!.life='active';delete patient.combat!.wound;combatWound(state,patient,{id:i,at:0,shooterId:99,squadId:99,from:{x:10,y:1,z:0},to:{x:0,y:1,z:0},hitId:patient.id,energy:1});if(patient.needs!.life!=='active')removed++;if(patient.health===0)fatal++;}
    expect(removed).toBeGreaterThan(75);expect(fatal).toBeGreaterThan(5);expect(fatal).toBeLessThan(60);
  });
  it('untreated critical wounds die, but legacy wounds never acquire a bleeding timer',()=>{
    const {state,sim,patient,helper}=setup();helper.carried!.medical=0;state.elapsed=61;updateCasualtyCare(state,sim.terrain,sim.navigation,.05);expect(patient.needs!.life).toBe('dead');
    expect(patient.combat!.wound!.bleedUntil).toBeUndefined();
    const restored=new SaveSystem().parse(JSON.stringify(state));expect(restored.soldiers.find(p=>p.id===patient.id)!.combat!.wound!.severity).toBe('fatal');
    const deaths=state.living!.metrics.deaths;updateCasualtyCare(state,sim.terrain,sim.navigation,.05);expect(state.living!.metrics.deaths).toBe(deaths);
    const old=createOperation('advance');old.schemaVersion=2;old.soldiers[0].health=40;const migrated=new SaveSystem().parse(JSON.stringify(old));expect(migrated.soldiers[0].combat!.wound!.severity).toBe('legacy');expect(migrated.soldiers[0].combat!.wound!.bleedUntil).toBeUndefined();
  });
  it('carries through an aid post, waits for a real truck, then evacuates at the rear',()=>{
    const {state,sim,patient,helper}=setup(),q=state.squads[0];
    state.soldiers.filter(s=>s.squadId===q.id).forEach((s,i)=>{s.x=i;s.z=0;});
    const trenchId=sim.createTrench([{x:0,z:0},{x:60,z:0}])!,trench=state.trenches.find(t=>t.id===trenchId)!;trench.progress=1;trench.status='complete';delete trench.excavation;sim.terrain.syncModifications();
    const assigned=sim.assignGarrison([q.id],trenchId);
    expect(assigned,JSON.stringify({trench,component:sim.garrisons.network.component(trenchId),capacity:sim.garrisons.network.capacity(sim.garrisons.network.component(trenchId)??-1),at:state.soldiers.filter(s=>s.squadId===q.id).map(s=>[s.x,s.z,sim.garrisons.network.route(s,{x:0,z:0}).length])})).toBe(true);const g=state.living!.garrisons[0];g.forward={x:30,z:0};
    state.living!.facilities.push({id:state.nextEntityId++,garrisonId:g.id,kind:'aid',x:8,z:0,connectorId:trenchId,progress:1,capacity:2,paid:true,stock:{...state.living!.ledger.lost},materialCost:12});
    const truck=state.living!.trucks.find(t=>t.role==='shuttle')!;truck.x=30;truck.z=0;truck.state='unloading';state.living!.rear={x:80,z:0};
    for(let i=0;i<2200&&patient.combat!.wound!.care!=='transport';i++){state.elapsed+=.05;updateCasualtyCare(state,sim.terrain,sim.navigation,.05);}
    expect(patient.combat!.wound!.care).toBe('transport');expect(truck.passengers).toEqual([patient.id]);expect(helper.combat!.careTask).toBeUndefined();expect(patient.x).toBe(30);
    expect(new SaveSystem().parse(JSON.stringify(state)).living!.trucks.find(t=>t.id===truck.id)!.passengers).toEqual([patient.id]);
    truck.x=80;state.elapsed+=.05;updateCasualtyCare(state,sim.terrain,sim.navigation,.05);expect(patient.combat!.wound!.care).toBe('evacuated');expect(patient.x).toBe(80);expect(patient.garrisonId).toBeUndefined();
  });
});

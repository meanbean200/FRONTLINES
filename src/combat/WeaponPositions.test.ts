import {describe,it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {preparedPosition} from './testing/PositionFixture';
import {isMountedGun,positionOperator,weaponPositionReadiness} from './WeaponPositions';
import {equipWeapon,weaponReady} from './Weapons';
import {requestSupport,stepSupport} from './SupportWeapons';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {SaveSystem} from '../persistence/SaveSystem';
import {createStudyScenario} from '../garrison/StudyScenario';
import {balance} from '../garrison/Inventory';

describe('physical crewed weapon positions',()=>{
  it('does not divert a fit tool carrier from funded works to routine forward hauling',()=>{
    const sim=createStudyScenario(),s=sim.state,g=s.living!.garrisons[0];g.nextSupport=1e9;
    const id=sim.garrisons.requestFacility(g.id,'mortar')!,f=s.living!.facilities.find(f=>f.id===id)!;
    // Isolate allocation after a real material delivery; stock accounting is checked in the full build test.
    f.paid=true;g.forwardStock.water=100;g.forwardStock.food=100;
    sim.step(.05);
    const builders=s.soldiers.filter(p=>p.equipment?.tools&&p.duty?.kind==='construct');expect(builders.length).toBeGreaterThan(0);
    expect(s.soldiers.filter(p=>p.equipment?.tools&&p.duty?.reason==='Collect physical forward shipment')).toHaveLength(0);
  });
  it.each(['player','enemy'] as const)('%s cannot fire an unmounted heavy MG, while BARs stay portable',side=>{
    const state=createOperation('campaign'),q=state.squads.find(q=>q.faction===side&&state.soldiers.some(s=>s.squadId===q.id&&isMountedGun(state,s)))!,gun=positionOperator(state,q.id,'emplacement')!;
    equipWeapon(state,gun);state.elapsed=10;
    expect(weaponReady(state,gun,state.soldiers)).toBe(false);expect(gun.combat!.pauseReason).toContain('MG position');
    const f=preparedPosition(state,q.id,'emplacement');state.elapsed=20;
    expect(weaponReady(state,gun,state.soldiers)).toBe(true);
    f.progress=.99;expect(weaponReady(state,gun,state.soldiers)).toBe(false);f.progress=1;
    gun.x+=20;expect(weaponReady(state,gun,state.soldiers)).toBe(false);
    equipWeapon(state,gun,'bar');state.elapsed=30;expect(weaponReady(state,gun,state.soldiers)).toBe(true);
  });
  it.each(['player','enemy'] as const)('%s mortar needs a built, assigned pit and cancels when its crew leaves',side=>{
    const state=createOperation('campaign'),sim=new BattlefieldSimulation(state),q=state.squads.find(q=>q.faction===side&&q.kind==='mortar')!,operator=positionOperator(state,q.id,'mortar')!,target={x:operator.x+150,z:operator.z};
    if(side==='enemy')state.operation!.contacts={player:[],enemy:[{...target,soldierId:state.soldiers[0].id,squadId:state.squads[0].id,lastSeen:0,visible:false,active:true}]};
    const source=side==='player'?'PLAYER':'ENEMY_AI';
    expect(requestSupport(state,'mortarHE',q.id,target,false,sim.terrain,source).reason).toContain('mortar pit');
    const f=preparedPosition(state,q.id,'mortar');expect(requestSupport(state,'mortarHE',q.id,target,false,sim.terrain,source).accepted).toBe(true);
    sim.issueHold([q.id],side==='enemy');state.elapsed=1;stepSupport(state,sim.terrain);
    expect(f.weaponCrewIds).toContain(operator.id);expect(state.operation!.supportMissions![0].stage).toBe('preparing');
    const ammo=operator.carried!.mortarHE;f.weaponCrewIds=[];state.elapsed=16;stepSupport(state,sim.terrain);
    expect(state.operation!.supportMissions![0].stage).toBe('cancelled');expect(operator.carried!.mortarHE).toBe(ammo);
  });
  it('engineers deliver and build; selected crews walk in, hold their post, save and unmount on a new order',()=>{
    const sim=createStudyScenario(),state=sim.state,g=state.living!.garrisons[0],q=state.squads[0];g.nextSupport=1e9;
    const people=state.soldiers.filter(s=>s.squadId===q.id);people[0].equipment!.weapon='crew-mg';
    for(const s of state.soldiers){s.carried!.ammo=60;state.living!.ledger.initial.ammo+=60;}
    const id=sim.garrisons.requestFacility(g.id,'emplacement')!,f=state.living!.facilities.find(f=>f.id===id)!;
    expect(id).toBeDefined();expect(sim.garrisons.assignWeapon(q.id,id).accepted).toBe(false);
    for(let i=0;i<12000&&f.progress<1;i++)sim.step(.05);
    expect(f.paid).toBe(true);expect(f.progress).toBe(1);expect(state.living!.ledger.consumed.materials).toBe(16);
    expect(weaponPositionReadiness(state,q.id,'emplacement')).toContain('Assign');
    const before=people.map(s=>({x:s.x,z:s.z}));expect(sim.garrisons.assignWeapon(q.id,id).accepted).toBe(true);expect(people.map(s=>({x:s.x,z:s.z}))).toEqual(before);
    for(let i=0;i<6000&&weaponPositionReadiness(state,q.id,'emplacement');i++)sim.step(.05);
    expect(weaponPositionReadiness(state,q.id,'emplacement')).toBe('');
    for(let i=0;i<400;i++)sim.step(.05);
    expect(weaponPositionReadiness(state,q.id,'emplacement')).toBe('');
    expect(new SaveSystem().parse(JSON.stringify(state))).toEqual(state);
    for(const n of Object.values(balance(state)))expect(Math.abs(n)).toBeLessThan(1e-6);
    sim.issueTactical([q.id],'suppress',{x:f.x,z:f.z+100});expect(f.weaponCrewIds).toHaveLength(2);
    sim.issueHold([q.id]);expect(f.weaponCrewIds).toHaveLength(2);expect(weaponPositionReadiness(state,q.id,'emplacement')).toBe('');
    expect(q.order.intent).toBeUndefined();
    sim.issueMove([q.id],{x:q.x,z:q.z-20});expect(f.weaponCrewIds).toHaveLength(0);expect(weaponPositionReadiness(state,q.id,'emplacement')).toContain('Assign');
  },20000);
  it('refuses cross-faction, wrong equipment, double crew and corrupt save assignments',()=>{
    const state=createOperation('campaign'),sim=new BattlefieldSimulation(state),q=state.squads.find(q=>q.kind==='machinegun'&&q.faction==='player')!,f=preparedPosition(state,q.id,'emplacement');
    const enemy=state.squads.find(q=>q.faction==='enemy')!;expect(sim.garrisons.assignWeapon(enemy.id,f.id).accepted).toBe(false);
    f.weaponSquadId=enemy.id;expect(()=>new SaveSystem().parse(JSON.stringify(state))).toThrow();
  });
  it('a direct crew order releases the operator from routine digging without deleting the work queue',()=>{
    const sim=createStudyScenario(),state=sim.state,q=state.squads[0];state.soldiers.find(s=>s.squadId===q.id)!.equipment!.mortar=true;
    const f=preparedPosition(state,q.id,'mortar'),s=positionOperator(state,q.id,'mortar')!;sim.garrisons.network.sync(state.trenches);
    s.duty!.kind='construct';q.constructionQueue=[{kind:'facility',id:f.id}];f.weaponCrewIds=[];
    expect(sim.garrisons.assignWeapon(q.id,f.id).accepted).toBe(true);expect(s.duty?.kind).toBe('watch');expect(q.constructionQueue).toEqual([{kind:'facility',id:f.id}]);
  });
});

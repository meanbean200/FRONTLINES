import {describe,it,expect,vi} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {createOperationalBattle} from '../operations/createOperationalBattle';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {equipmentOf,squadHasEquipment} from './Equipment';
import {equipWeapon,weaponReady} from './Weapons';
import {requestSupport,stepSupport,supportReadiness} from './SupportWeapons';
import {SaveSystem} from '../persistence/SaveSystem';
import {observeEnemy} from '../operations/EnemyCommander';
import {balance} from '../garrison/Inventory';
describe('equipment, not classes',()=>{
  it('does not gain kit by changing a class, and ordinary infantry operates an explicitly carried automatic weapon',()=>{
    const state=createOperation('advance'),sim=new BattlefieldSimulation(state),q=state.squads[0],s=state.soldiers[0];
    expect(squadHasEquipment(state,q,'tools')).toBe(false);q.kind='engineer';expect(squadHasEquipment(state,q,'tools')).toBe(false);
    q.kind='rifle';s.equipment!.weapon='crew-mg';s.equipment!.tools=true;
    expect(squadHasEquipment(state,q,'automatic')).toBe(true);expect(squadHasEquipment(state,q,'tools')).toBe(true);
    expect(equipWeapon(state,s).id).toBe('crew-mg');state.elapsed=10;expect(weaponReady(state,s,state.soldiers)).toBe(true);
    const id=sim.createTrench([{x:-1400,z:-1400},{x:-1370,z:-1400}],q.id);expect(id).toBeDefined();expect(q.order.type).toBe('construct-trench');
    s.equipment!.tools=false;expect(squadHasEquipment(state,q,'tools')).toBe(false);
  });
  it('generates ordinary formations with conserved finite kit/resources and deterministic allocation',()=>{
    const state=createOperationalBattle('meeting'),same=createOperationalBattle('meeting');expect(state).toEqual(same);
    expect(state.squads.every(q=>q.kind==='rifle')).toBe(true);
    const people=state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='player');
    expect(people).toHaveLength(48);expect(people.filter(s=>s.equipment?.tools)).toHaveLength(8);expect(people.filter(s=>s.equipment?.mortar)).toHaveLength(1);
    expect(people.filter(s=>s.equipment?.weapon==='crew-mg')).toHaveLength(1);expect(people.filter(s=>s.equipment?.medicalKit)).toHaveLength(2);
    expect(Object.values(balance(state)).every(n=>Math.abs(n)<1e-8)).toBe(true);expect(new SaveSystem().parse(JSON.stringify(state))).toEqual(state);
  });
  it('migrates old implicit kits once, preserves injuries and inventory, and rejects corrupt gear',()=>{
    const state=createOperation('campaign');for(const s of state.soldiers)delete s.equipment;
    state.combatRules='combat-25-world2';state.soldiers[0].health=40;
    const ledger=structuredClone(state.living!.ledger),loaded=new SaveSystem().parse(JSON.stringify(state));
    expect(loaded.living!.ledger).toEqual(ledger);expect(loaded.soldiers[0].health).toBe(40);
    expect(loaded.soldiers.some(s=>equipmentOf(loaded,s).mortar)).toBe(true);
    loaded.soldiers[0].equipment!.tools='yes' as unknown as boolean;expect(()=>new SaveSystem().parse(JSON.stringify(loaded))).toThrow();
  });
  it('manual friendly support and reported enemy support are identifiable, finite and physically crewed',()=>{
    const state=createOperationalBattle('meeting'),sim=new BattlefieldSimulation(state),q=state.squads.find(q=>q.faction==='player'&&squadHasEquipment(state,q,'mortar'))!;
    const people=state.soldiers.filter(s=>s.squadId===q.id),carrier=people.find(s=>s.equipment!.mortar)!;
    vi.spyOn(sim.terrain,'buildingAt').mockReturnValue(undefined);vi.spyOn(sim.terrain.objects,'trace').mockReturnValue({clear:true,transmission:1});
    people.forEach((s,i)=>{s.x=q.x+i;s.z=q.z;});const target={x:q.x+150,z:q.z};
    expect(requestSupport(state,'mortarHE',q.id,target,false,sim.terrain,'ENEMY_AI').accepted).toBe(false);
    expect(requestSupport(state,'mortarHE',q.id,target,false,sim.terrain,'CAMPAIGN_AI').accepted).toBe(false);
    const before=carrier.carried!.mortarHE;expect(requestSupport(state,'mortarHE',q.id,target,false,sim.terrain,'PLAYER').accepted).toBe(true);
    state.elapsed=16;stepSupport(state,sim.terrain);expect(carrier.carried!.mortarHE).toBe(before-1);
    expect(state.operation!.supportMissions![0]).toMatchObject({source:'PLAYER',side:'player',ammoConsumed:1});
    expect(new SaveSystem().parse(JSON.stringify(state)).operation!.supportMissions).toEqual(state.operation!.supportMissions);
    const enemy=state.squads.find(q=>q.faction==='enemy'&&squadHasEquipment(state,q,'mortar'))!,ep=state.soldiers.filter(s=>s.squadId===enemy.id);ep.forEach((s,i)=>{s.x=enemy.x+i;s.z=enemy.z;});
    const report={soldierId:state.soldiers[0].id,squadId:q.id,x:enemy.x+150,z:enemy.z,lastSeen:state.elapsed,visible:false,active:true};
    expect(requestSupport(state,'mortarHE',enemy.id,report,false,sim.terrain,'ENEMY_AI').reason).toContain('report');
    state.operation!.contacts={player:[],enemy:[report]};
    expect(observeEnemy(state).squads.find(q=>q.id===enemy.id)?.mortar).toBe(true);
    expect(requestSupport(state,'mortarHE',enemy.id,report,false,sim.terrain,'ENEMY_AI').accepted).toBe(true);
    state.elapsed=32;stepSupport(state,sim.terrain);expect(state.operation!.supportMissions!.at(-1)).toMatchObject({source:'ENEMY_AI',side:'enemy',ammoConsumed:1});
    carrier.equipment!.mortar=false;expect(supportReadiness(state,'mortarHE',q.id).reason).toContain('equipment');
    expect(Object.values(balance(state)).every(n=>Math.abs(n)<1e-8)).toBe(true);
  });
});

import {describe,it,expect,vi} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {prepareActions} from './Reactions';
import {equipWeapon,weaponReady,WEAPONS} from './Weapons';
import {SaveSystem} from '../persistence/SaveSystem';
import {preparedPosition} from './testing/PositionFixture';
import {weaponCrewPoint} from '../construction/PositionDefinitions';
function setup(){const state=createOperation('advance'),sim=new BattlefieldSimulation(state),s=state.soldiers[0],q=state.squads[0];state.operation!.nextOrders=1e9;for(const p of state.soldiers)p.nextShotAt=1e9;return{state,sim,s,q};}
describe('human reactions and action authority',()=>{
  it('pinning pauses a persistent drawn order, defeats push-through, then resumes',()=>{
    const {state,sim,s,q}=setup();q.order={type:'move',drawnPath:[{x:s.x,z:s.z},{x:s.x+30,z:s.z}],target:{x:s.x+30,z:s.z},issuedAt:0,pushThrough:true};q.route=q.order.drawnPath!;
    s.suppression=85;const start={x:s.x,z:s.z};sim.step(.05);expect(s.action).toBe('pinned');expect(s.x).toBe(start.x);expect(s.z).toBe(start.z);expect(q.order.drawnPath).toHaveLength(2);
    s.suppression=0;state.elapsed=2;sim.step(.05);expect(s.action).toBe('pinned');
    state.elapsed=10;sim.step(.05);expect(s.combat!.reaction).toBe('steady');expect(q.order.type).toBe('move');expect(s.action).not.toBe('pinned');
  });
  it('broken troops retain their order and a reachable retreat survives a save',()=>{
    const {state,sim,s,q}=setup();s.morale=5;vi.spyOn(sim.navigation,'plan').mockImplementation((a)=>[{x:a.x-5,z:a.z}]);
    prepareActions(state,sim.terrain,sim.navigation,.05);expect(s.combat!.owner).toBe('reaction');expect(s.action).toBe('falling back');expect(q.order.type).toBe('hold');
    expect(new SaveSystem().parse(JSON.stringify(state)).soldiers[0].combat).toEqual(s.combat);
  });
  it('a paused builder cannot contribute excavation work',()=>{
    const {state,sim}=setup(),q=state.squads.find(q=>q.kind==='engineer')!;
    const id=sim.createTrench([{x:-1350,z:-1200},{x:-1310,z:-1200}],q.id)!;
    for(const s of state.soldiers.filter(s=>s.squadId===q.id)){s.suppression=100;}
    for(let n=0;n<20;n++)sim.step(.05);
    expect(state.trenches.find(t=>t.id===id)!.progress).toBe(0);expect(q.order.type).toBe('construct-trench');
  });
  it('a healthy mounted gunner holds the protected post under ordinary incoming fire, but pinning still wins',()=>{
    const {state,sim}=setup(),q=state.squads.find(q=>q.faction==='enemy')!,f=preparedPosition(state,q.id,'emplacement');
    const g=state.living!.garrisons.find(g=>g.id===f.garrisonId)!,s=state.soldiers.find(s=>s.id===f.weaponCrewIds![0])!,t=state.trenches.find(t=>t.id===f.connectorId)!;
    g.readiness='stand-to';f.facing=0;f.z=t.points[0].z+t.width*.43;f.trenchAnchor={trenchId:t.id,along:12};
    Object.assign(s,weaponCrewPoint(state,f,0));s.duty!.destination={x:s.x,z:s.z};s.duty!.arrivedAt=0;
    vi.spyOn(sim.terrain,'baseHeightAt').mockReturnValue(0);vi.spyOn(sim.terrain,'groundTypeAt').mockReturnValue('field');vi.spyOn(sim.terrain.objects,'trees').mockReturnValue([]);sim.terrain.buildings=[];sim.terrain.syncModifications();
    s.combat={shotSequence:0,coverReview:0,lastIncoming:0,threatDirection:0};s.suppression=25;s.needs!.energy=90;
    const origin={x:s.x,z:s.z};
    for(let i=0;i<80;i++){state.elapsed+=.05;s.combat.lastIncoming=state.elapsed;prepareActions(state,sim.terrain,sim.navigation,.05);}
    expect({x:s.x,z:s.z}).toEqual(origin);expect(s.combat.owner).toBe('duty');
    s.suppression=95;prepareActions(state,sim.terrain,sim.navigation,.05);expect(s.combat.reaction).toBe('pinned');expect(s.combat.owner).toBe('reaction');
  });
});
describe('finite weapons',()=>{
  it('reloads take real time and never grant inventory',()=>{
    const {state,s}=setup(),w=equipWeapon(state,s);expect(w.id).toBe('m1');w.loaded=0;const before=s.carried!.ammo;
    expect(weaponReady(state,s,[s])).toBe(false);expect(w.reloadUntil).toBe(WEAPONS.m1.reload);
    state.elapsed=2;expect(weaponReady(state,s,[s])).toBe(false);state.elapsed=4;expect(weaponReady(state,s,[s])).toBe(true);expect(s.carried!.ammo).toBe(before);
    s.carried!.ammo=0;w.loaded=0;expect(weaponReady(state,s,[s])).toBe(false);
  });
  it('machine guns need a present crew and setup, not nationality bonuses',()=>{
    const {state}=setup(),q=state.squads.find(q=>q.faction==='enemy')!,team=state.soldiers.filter(s=>s.squadId===q.id),gunner=team[1],w=equipWeapon(state,gunner);
    expect(w.id).toBe('mg42');preparedPosition(state,q.id,'emplacement');state.elapsed=10;expect(weaponReady(state,gunner,[gunner])).toBe(false);expect(weaponReady(state,gunner,team)).toBe(true);
    gunner.x+=1;expect(weaponReady(state,gunner,team)).toBe(false);expect(w.setupUntil).toBe(13);
  });
});

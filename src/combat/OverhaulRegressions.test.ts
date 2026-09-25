import {describe,it,expect,vi} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {createPlayableSandbox} from '../simulation/createBattlefield';
import {inventory} from '../garrison/types';
import {emplacementBoxes} from '../terrain/SupportGeometry';
import {SaveSystem} from '../persistence/SaveSystem';
import {coordinateMovement} from './Cooperation';
import {equipWeapon} from './Weapons';
import {prepareActions} from './Reactions';
import {requestSupport} from './SupportWeapons';
import {preparedPosition} from './testing/PositionFixture';
describe('combat overhaul release regressions',()=>{
  it('spreading fast-forward across browser frames preserves every fixed tick',()=>{
    const initial=createPlayableSandbox(),a=new BattlefieldSimulation(structuredClone(initial)),b=new BattlefieldSimulation(structuredClone(initial));a.setSpeed(5);b.setSpeed(5);
    for(let i=0;i<100;i++){a.step(.05);for(let j=0;j<5;j++)b.stepFixed();}expect(b.state).toEqual(a.state);
    b.setSpeed(0);const saved=structuredClone(b.state);b.stepFixed();expect(b.state).toEqual(saved);
  });
  it('emplacement sandbags use the same finite visible and ballistic volumes, with an open rear',()=>{
    const s=createOperation('campaign'),sim=new BattlefieldSimulation(s),g=s.living!.garrisons[0],f={id:s.nextEntityId++,garrisonId:g.id,kind:'emplacement' as const,connectorId:g.trenchId,x:0,z:0,facing:0,progress:1,capacity:3,paid:true,stock:inventory(),materialCost:16};s.living!.facilities.push(f);sim.terrain.buildings=[];vi.spyOn(sim.terrain,'heightAt').mockReturnValue(0);vi.spyOn(sim.terrain,'baseHeightAt').mockReturnValue(0);vi.spyOn(sim.terrain.objects,'trees').mockReturnValue([]);sim.terrain.syncModifications();
    expect(emplacementBoxes(f)).toHaveLength(3);expect(sim.terrain.objects.trace({x:0,z:8},{x:0,z:0},.5,.5,false,true).blockedBy).toBe('terrain');expect(sim.terrain.objects.trace({x:0,z:-8},{x:0,z:0},.5,.5,false,true).clear).toBe(true);expect(sim.terrain.objects.trace({x:0,z:8},{x:0,z:0},1.5,1.5,false,true).clear).toBe(true);
  });
  it('support owns crew actions while preparing, but cannot override physical pinning',()=>{
    const s=createOperation('campaign'),sim=new BattlefieldSimulation(s),q=s.squads.find(q=>q.kind==='mortar'&&q.faction==='player')!,crew=s.soldiers.filter(p=>p.squadId===q.id);q.x=crew[0].x;q.z=crew[0].z;
    preparedPosition(s,q.id,'mortar');
    expect(requestSupport(s,'mortarSmoke',q.id,{x:q.x+100,z:q.z}).accepted).toBe(true);prepareActions(s,sim.terrain,sim.navigation,.05);expect(crew.filter(p=>p.combat?.owner==='support')).toHaveLength(2);expect(new SaveSystem().parse(JSON.stringify(s)).operation!.supportMissions).toEqual(s.operation!.supportMissions);crew[0].suppression=90;prepareActions(s,sim.terrain,sim.navigation,.05);expect(crew[0].combat?.reaction).toBe('pinned');
  });
  it('unrelated supporting fire cannot authorize an advance',()=>{
    const s=createOperation('advance'),q=s.squads[0],people=s.soldiers.filter(p=>p.squadId===q.id),target=s.soldiers.find(p=>s.squads.find(q=>q.id===p.squadId)?.faction==='enemy')!;q.order={type:'move',issuedAt:0,target:{x:q.x+100,z:q.z}};Object.assign(target,{x:q.x+100,z:q.z});s.operation!.contacts={player:[{soldierId:target.id,squadId:target.squadId,x:target.x,z:target.z,lastSeen:0,visible:true,active:true}],enemy:[]};for(const p of people)p.combat={shotSequence:0,owner:'order'};
    const gun=people[1],w=equipWeapon(s,gun);w.effectiveUntil=3;w.effectivePoint={x:q.x,z:q.z+500};coordinateMovement(s);expect(people[0].combat!.pauseReason).toBe('Waiting briefly for covering fire');for(const p of people)p.combat!.owner='order';w.effectivePoint={x:target.x,z:target.z};coordinateMovement(s);expect(people[0].combat!.owner).toBe('order');
  });
});

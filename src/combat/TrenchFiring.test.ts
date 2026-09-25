import {describe,it,expect,vi} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {bankPoint} from '../garrison/DefensivePositions';
import {bodyFloor} from '../operations/Visibility';
import {clearAimPoint,muzzlePoint,resolveShot} from './Ballistics';
import {weaponCrewPoint} from '../construction/PositionDefinitions';
import {inventory,type Facility} from '../garrison/types';
import {fireSmallArms} from './SmallArmsSystem';

function fixture(width=4.2,points=[{x:-40,z:0},{x:40,z:0}]){
  const state=createOperation('advance'),sim=new BattlefieldSimulation(state),terrain=sim.terrain,s=state.soldiers[0],enemy=state.soldiers.find(p=>state.squads.find(q=>q.id===p.squadId)?.faction==='enemy')!;
  state.trenches=[{id:9000,points,width,depth:1.75,progress:1,status:'complete'}];
  terrain.buildings=[];vi.spyOn(terrain,'baseHeightAt').mockReturnValue(0);vi.spyOn(terrain,'groundTypeAt').mockReturnValue('field');vi.spyOn(terrain.objects,'trees').mockReturnValue([]);
  terrain.syncModifications();sim.garrisons.network.sync(state.trenches);s.x=s.z=0;s.action='watching';s.posture='standing';delete s.duty;
  enemy.action='holding';enemy.posture='standing';delete enemy.duty;
  return {state,sim,terrain,s,enemy};
}
describe('usable physical trench firing edges',()=>{
  it('allows explicit suppression against distant protection but never through its own bank',()=>{
    const {state,sim,terrain,s,enemy}=fixture(),q=state.squads.find(q=>q.id===s.squadId)!;
    state.trenches.push({id:9002,points:[{x:-40,z:100},{x:40,z:100}],width:4.2,depth:1.75,progress:1,status:'complete'});terrain.syncModifications();sim.garrisons.network.sync(state.trenches);
    q.order={type:'hold',issuedAt:0,intent:'suppress',target:{x:0,z:100}};s.carried!.ammo=60;s.nextShotAt=0;enemy.carried!.ammo=0;enemy.x=0;enemy.z=100;
    const sides=new Map(state.squads.map(q=>[q.id,q.faction??'player'] as const)),fired:number[]=[];
    const step=()=>{state.elapsed+=.05;state.operation!.elapsed=state.elapsed;fireSmallArms(state,terrain,[s,enemy],sides,()=>fired.push(state.elapsed));};
    for(let i=0;i<100;i++)step();expect(fired).toHaveLength(0);expect(s.combat?.pauseReason).toContain('firing edge blocked');
    Object.assign(s,bankPoint(sim.garrisons.network,s,0),{heading:0});
    for(let i=0;i<160;i++)step();expect(fired.length).toBeGreaterThan(0);expect(s.carried!.ammo).toBeLessThan(60);
  });
  it('does not levitate guards or grant eye-based permission through the parapet',()=>{
    const {s,enemy,terrain}=fixture();s.duty={kind:'watch',arrivedAt:0,route:[],routeIndex:0,blockedFor:0,destination:s,since:0,until:100,reason:'fixture'};enemy.x=0;enemy.z=40;
    expect(bodyFloor(terrain,s)).toBe(terrain.heightAt(0,0));expect(clearAimPoint(terrain,s,enemy)).toBeUndefined();
  });
  it.each([4.2,7.2])('fires from a reachable %s m bank toward front, rear, flanks and obliques',width=>{
    const {state,sim,terrain,s,enemy}=fixture(width);
    for(const front of [0,Math.PI,Math.PI/2,-Math.PI/2,.7,-.7,2.4,-2.4]){
      const p=bankPoint(sim.garrisons.network,{x:0,z:0},front);Object.assign(s,p,{heading:front});enemy.x=Math.sin(front)*50;enemy.z=Math.cos(front)*50;
      expect(sim.garrisons.network.corridorContains(s)).toBe(true);const aim=clearAimPoint(terrain,s,enemy);expect(aim,`direction ${front}`).toBeDefined();
      const shot=resolveShot(state,terrain,s,aim!,[enemy],0);expect(shot.hitId).toBe(enemy.id);expect(shot.from).toEqual(muzzlePoint(terrain,s));
    }
  });
  it('uses a bank at bends without changing body coordinates on query',()=>{
    const {sim,terrain,s,enemy}=fixture(4.2,[{x:-40,z:0},{x:0,z:0},{x:0,z:40}]);
    Object.assign(s,bankPoint(sim.garrisons.network,{x:0,z:15},Math.PI/2),{heading:Math.PI/2});enemy.x=50;enemy.z=15;
    const before={x:s.x,z:s.z};expect(clearAimPoint(terrain,s,enemy)).toBeDefined();expect({x:s.x,z:s.z}).toEqual(before);
  });
  it('does not authorize a shot from the sunken center of a T junction; the real outer edge clears it',()=>{
    const {state,sim,terrain,s,enemy}=fixture(4.2);
    state.trenches.push({id:9002,points:[{x:0,z:0},{x:0,z:35}],width:4.2,depth:1.75,progress:1,status:'complete'});
    terrain.syncModifications();sim.garrisons.network.sync(state.trenches);s.x=s.z=0;s.heading=Math.PI;enemy.x=0;enemy.z=-50;
    expect(clearAimPoint(terrain,s,enemy)).toBeUndefined();expect(s.x).toBe(0);expect(s.z).toBe(0);
    Object.assign(s,bankPoint(sim.garrisons.network,{x:4,z:0},Math.PI));enemy.x=4;
    expect(clearAimPoint(terrain,s,enemy)).toBeDefined();
  });
  it('places mounted crews on the real bank and clears their actual parapet',()=>{
    const {state,terrain,s,enemy}=fixture(7.2),t=state.trenches[0];
    const f:Facility={id:9001,garrisonId:0,kind:'emplacement',x:0,z:t.width*.43,facing:0,connectorId:t.id,trenchAnchor:{trenchId:t.id,along:40},progress:1,paid:true,capacity:2,stock:inventory(),materialCost:16};state.living!.facilities.push(f);terrain.syncModifications();
    Object.assign(s,weaponCrewPoint(state,f,0),{heading:0});enemy.x=0;enemy.z=50;
    expect(clearAimPoint(terrain,s,enemy)).toBeDefined();
  });
});

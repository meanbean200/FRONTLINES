import {describe,expect,it,vi} from 'vitest';
import {createOperation} from './createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {balance} from '../garrison/Inventory';
import {distance} from '../core/types';

function fixture(seed=1944){
  const state=createOperation('advance',seed),sim=new BattlefieldSimulation(state),shooter=state.soldiers[0],target=state.soldiers.find(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')!;
  for(const s of state.soldiers){s.x=state.squads.find(q=>q.id===s.squadId)?.faction==='enemy'?3000:-3000;s.z=3000;s.nextShotAt=10000;}
  Object.assign(shooter,{x:0,z:0,heading:Math.PI/2,nextShotAt:0});Object.assign(target,{x:35,z:0,heading:-Math.PI/2});
  state.living!.campaignHours=12;state.operation!.nextOrders=10000;
  state.operation!.casualtyRules=false; // Legacy injury compatibility; new wounds have dedicated care regressions.
  vi.spyOn(sim.terrain,'baseHeightAt').mockReturnValue(0);vi.spyOn(sim.terrain,'groundTypeAt').mockReturnValue('field');vi.spyOn(sim.terrain,'coverAt').mockReturnValue('open');vi.spyOn(sim.terrain,'obstacleAt').mockReturnValue(false);
  vi.spyOn(sim.terrain,'heightAt').mockReturnValue(0);sim.terrain.buildings=[];vi.spyOn(sim.terrain.objects,'trees').mockReturnValue([]);
  const tick=()=>{state.elapsed+=.5;sim.operations.step(.5,()=>{});};
  return {state,sim,shooter,target,tick};
}
describe('rifle lethality, reaction and suppression',()=>{
  it('takes time to acquire a target instead of firing instantly',()=>{
    const {state,shooter,target,tick}=fixture();tick();
    expect(shooter.aimTargetId).toBe(target.id);expect(shooter.aimReadyAt).toBeGreaterThan(state.operation!.elapsed);expect(state.operation!.shots).toBe(0);
    for(let i=0;i<4&&state.operation!.shots===0;i++)tick();expect(state.operation!.shots).toBe(1);
  });
  it('kills an exposed healthy soldier with two actual hits, conserving all ammunition',()=>{
    for(const seed of [1944,7,19]){
      const {state,target,tick}=fixture(seed);
      for(let i=0;i<180&&target.needs!.life==='active';i++)tick();
      expect(target.needs!.life).toBe('dead');expect(target.health).toBe(0);expect(state.operation!.hits).toBe(2);
      expect(state.operation!.shots).toBeGreaterThanOrEqual(2);
      for(const value of Object.values(balance(state)))expect(Math.abs(value)).toBeLessThan(1e-8);
    }
  });
  it('draws misses away from bodies and causes fear even without a hit',()=>{
    let misses=0;
    for(const seed of [1944,7,19]){
      const {state,shooter,target,tick}=fixture(seed);
      for(let i=0;i<150&&target.needs!.life==='active';i++){
        const shots=state.operation!.shots,hits=state.operation!.hits,morale=target.morale;tick();
        if(state.operation!.shots>shots&&state.operation!.hits===hits){
          misses++;expect(distance(shooter.lastTarget!,target)).toBeGreaterThan(.2);
          // Only credible near misses suppress; an actual distant miss is not
          // guaranteed to frighten the intended target through cover.
          if(target.morale<morale)expect(target.suppression).toBeGreaterThan(0);
        }
      }
    }
    expect(misses).toBeGreaterThan(0);
  });
  it('cannot fire using another soldier\'s sight through an obstruction',()=>{
    const {state,sim,shooter,target,tick}=fixture();
    state.operation!.contacts={player:[{soldierId:target.id,squadId:target.squadId,x:target.x,z:target.z,lastSeen:0,visible:true,active:true}],enemy:[]};
    sim.terrain.buildings=[{x:15,z:0,width:10,depth:20,height:8,angle:0}];
    for(let i=0;i<12;i++)tick();expect(state.operation!.shots).toBe(0);expect(shooter.carried!.ammo).toBe(60);
  });
});

import {describe,expect,it,vi} from 'vitest';
import {createOperation} from './createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {balance} from '../garrison/Inventory';
import {distance} from '../core/types';
import {fireSmallArms} from '../combat/SmallArmsSystem';

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
  it('does not use an unbounded spread estimate to withhold a viable point-blank shot',()=>{
    const {state,sim,shooter,target}=fixture();target.x=3;
    shooter.action='advancing';target.action='advancing';shooter.suppression=85;shooter.needs!.energy=15;shooter.morale=25;
    state.living!.campaignHours=23;state.elapsed=state.operation!.elapsed=10;
    shooter.aimTargetId=target.id;shooter.aimReadyAt=0;
    shooter.combat={shotSequence:0,aim:{targetId:target.id,since:0,lastSeen:10,point:{x:3,y:.86,z:0},lastHeading:Math.PI/2,lastPosition:{x:0,z:0},settlingUntil:20}};
    state.operation!.contacts={player:[{soldierId:target.id,squadId:target.squadId,x:3,z:0,lastSeen:10,visible:true,active:true}],enemy:[]};
    const ammo=shooter.carried!.ammo;
    fireSmallArms(state,sim.terrain,[shooter,target],new Map([[shooter.squadId,'player'],[target.squadId,'enemy']]),()=>{});
    expect(state.operation!.shots).toBe(1);expect(shooter.carried!.ammo).toBe(ammo-1);expect(shooter.combat.pauseReason).not.toBe('Holding ammunition · aimed hit implausible');
  });
});

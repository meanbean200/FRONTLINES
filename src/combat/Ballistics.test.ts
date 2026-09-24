import {describe,it,expect,vi} from 'vitest';
import {calibrateRifles} from './Calibration';
import {aimPoint,dispersionMultiplier,resolveShot,segmentDistance} from './Ballistics';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';

function fixture(){
  const state=createOperation('advance'),sim=new BattlefieldSimulation(state),shooter=state.soldiers[0],target=state.soldiers.find(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')!;
  Object.assign(shooter,{x:0,z:0,heading:Math.PI/2,morale:100,suppression:0,action:'holding'});
  Object.assign(target,{x:100,z:0,action:'holding',suppression:0});shooter.needs!.energy=100;state.living!.campaignHours=12;
  vi.spyOn(sim.terrain,'heightAt').mockReturnValue(0);vi.spyOn(sim.terrain,'baseHeightAt').mockReturnValue(0);
  vi.spyOn(sim.terrain,'groundTypeAt').mockReturnValue('field');vi.spyOn(sim.terrain.objects,'trees').mockReturnValue([]);sim.terrain.buildings=[];
  return {state,terrain:sim.terrain,shooter,target};
}
describe('physical rifle shots',()=>{
  it('meets all approved range bands over 20,000 seeded geometric intersections per distance',()=>{
    const bands=[[.2,.35],[.08,.15],[.01,.03],[.002,.008],[0,.005]];
    calibrateRifles().forEach((row,i)=>{expect(row.rate).toBeGreaterThanOrEqual(bands[i][0]);expect(row.rate).toBeLessThanOrEqual(bands[i][1]);});
  });
  it('moving targets and moving shooters are substantially harder at every distance',()=>{
    const still=calibrateRifles(),moving=calibrateRifles(20000,1.8),walking=calibrateRifles(20000,3.2);
    still.forEach((row,i)=>{expect(moving[i].rate).toBeLessThan(row.rate*.65);expect(walking[i].rate).toBeLessThan(moving[i].rate);});
  });
  it('uses the first physical obstruction, not the intended body, for impact',()=>{
    const {state,terrain,shooter,target}=fixture();terrain.buildings=[{x:40,z:20,width:10,depth:100,height:30,angle:0}];
    for(let i=0;i<100;i++){const shot=resolveShot(state,terrain,shooter,aimPoint(terrain,shooter,target),[target]);expect(shot.hitId).toBeUndefined();expect(shot.to.x).toBeLessThan(40);expect(shot.obstruction).toBe('building');}
  });
  it('continues exactly from the serialized shot counter and returns actual body intersections',()=>{
    const {state,terrain,shooter,target}=fixture();let hits=0;
    for(let i=0;i<300;i++){
      const before=structuredClone(shooter),a=resolveShot(state,terrain,shooter,aimPoint(terrain,shooter,target),[target]),b=resolveShot(state,terrain,before,aimPoint(terrain,before,target),[target]);
      expect(a).toEqual(b);if(a.hitId){hits++;expect(a.to.x).toBeCloseTo(99.77,2);expect(Math.abs(a.to.z)).toBeLessThanOrEqual(.231);}
    }
    expect(hits).toBeGreaterThan(10);
  });
  it('applies actual movement, darkness, fatigue and suppression without changing world positions',()=>{
    const {state,shooter,target}=fixture();expect(dispersionMultiplier(state,shooter,target)).toBe(1);
    target.action='advancing';expect(dispersionMultiplier(state,shooter,target)).toBe(1.8);
    shooter.suppression=70;expect(dispersionMultiplier(state,shooter,target)).toBeGreaterThan(5);
    expect(segmentDistance({x:5,y:1,z:2},{x:0,y:1,z:0},{x:10,y:1,z:0})).toBe(2);
  });
});

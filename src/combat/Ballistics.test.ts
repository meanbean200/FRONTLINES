import {describe,it,expect,vi} from 'vitest';
import {calibrateRifles} from './Calibration';
import {aimPoint,bodyVolume,dispersionMultiplier,dispersedEndpoint,muzzlePoint,resolveShot,rifleSpread,segmentDistance,shotError,MAX_SHOT_DEVIATION} from './Ballistics';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {boxIntersection} from '../terrain/WorldOcclusion';
import {SaveSystem} from '../persistence/SaveSystem';
import {OperationRenderer} from '../render/OperationRenderer';
import * as THREE from 'three';

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
  it('makes five-foot shots dangerous without making moving or stressed shooters perfect',()=>{
    const {state,terrain,shooter,target}=fixture();target.x=1.524;
    const rates=[];
    for(const multiplier of [1,5.76,8.130857142857144,80.37668571428573]){
      shooter.combat={shotSequence:0};let hits=0;
      for(let i=0;i<10000;i++){state.seed=1944+i%7;if(resolveShot(state,terrain,shooter,aimPoint(terrain,shooter,target),[target],multiplier).hitId!==undefined)hits++;}
      rates.push(hits/10000);
    }
    expect(rates[0]).toBeGreaterThan(.98);expect(rates[1]).toBeGreaterThan(.8);expect(rates[1]).toBeLessThan(.95);
    expect(rates[2]).toBeGreaterThan(.65);expect(rates[2]).toBeLessThan(rates[1]);expect(rates[3]).toBeGreaterThan(.4);expect(rates[3]).toBeLessThan(rates[2]);
  });
  it('bounds sampled error around the aim ray, not the horizon, including steep and degenerate directions',()=>{
    const from={x:0,y:1.48,z:0};
    for(const aim of [{x:1.524,y:.86,z:0},{x:0,y:8,z:0},{x:0,y:-8,z:0},{x:2,y:5,z:-1},{...from}]){
      for(const error of [[0,0],[100,-100],[-100,100],[.7,2.4]] as [number,number][]){
        const end=dispersedEndpoint(from,aim,100,error,20);
        expect(Object.values(end).every(Number.isFinite)).toBe(true);
        const a=new THREE.Vector3(aim.x-from.x,aim.y-from.y,aim.z-from.z),b=new THREE.Vector3(end.x-from.x,end.y-from.y,end.z-from.z);
        if(a.length()===0){expect(end).toEqual(from);continue;}
        expect(a.angleTo(b)).toBeLessThanOrEqual(MAX_SHOT_DEVIATION+1e-9);expect(b.length()).toBeCloseTo(20,8);
        if(aim.y===8)expect(end.y).toBeGreaterThan(20); // Can still engage an elevated target.
      }
    }
  });
  it('keeps the approved long-range spread values and repeatable sampled hit counts',()=>{
    const {terrain,shooter,target}=fixture();
    for(const [range,spread,hits] of [[50,.57,2792],[100,.95,1249],[200,2.2,268],[300,4.8,49],[350,6.4,32]]){
      expect(rifleSpread(range)).toBeCloseTo(spread,12);shooter.combat={shotSequence:0};target.x=range;let actual=0;
      const from=muzzlePoint(terrain,shooter),aim=aimPoint(terrain,shooter,target),body=bodyVolume(terrain,target);
      for(let i=0;i<10000;i++)if(boxIntersection(from,dispersedEndpoint(from,aim,spread,shotError(1944+i%7,shooter.id,i),range+15),body))actual++;
      expect(actual).toBe(hits);
    }
  });
  it('keeps close misses on the same physical ray used by impacts, damage and the rendered tracer',()=>{
    const {state,terrain,shooter,target}=fixture();target.x=1.524;
    const aim=aimPoint(terrain,shooter,target),from=muzzlePoint(terrain,shooter),render=new OperationRenderer(()=>state,terrain);
    for(let i=0;i<50;i++){
      const expected=dispersedEndpoint(from,aim,rifleSpread(target.x)*20,shotError(state.seed,shooter.id,i),target.x+15);
      const intersection=boxIntersection(from,expected,bodyVolume(terrain,target));
      const event=resolveShot(state,terrain,shooter,aim,[target],20);
      expect(event.hitId!==undefined).toBe(Boolean(intersection));
      expect(segmentDistance(event.to,from,expected)).toBeLessThan(1e-8);
      expect(event.to.y).toBeLessThan(1.5);
      state.operation!.shotEvents=[event];render.update();
      const trace=render.group.children.find(o=>o instanceof THREE.LineSegments) as THREE.LineSegments;
      const p=trace.geometry.attributes.position;
      for(const n of [0,1])expect(segmentDistance({x:p.getX(n),y:p.getY(n),z:p.getZ(n)},event.from,event.to)).toBeLessThan(1e-5);
      expect(p.getX(1)).toBeCloseTo(event.to.x,5);expect(p.getY(1)).toBeCloseTo(event.to.y,5);expect(p.getZ(1)).toBeCloseTo(event.to.z,5);
    }
  });
  it('still stops point-blank shots at real protection and cannot injure allies',()=>{
    const {state,terrain,shooter,target}=fixture();target.x=3;
    vi.mocked(terrain.heightAt).mockImplementation(x=>x>.8&&x<1.8?3:0);terrain.revision++;
    for(let i=0;i<30;i++){const event=resolveShot(state,terrain,shooter,{x:3,y:.86,z:0},[target]);expect(event.hitId).toBeUndefined();expect(event.obstruction).toBe('terrain');}
    vi.mocked(terrain.heightAt).mockReturnValue(0);terrain.revision++;const friendly={...target,id:9999,squadId:shooter.squadId};
    for(let i=0;i<30;i++)expect(resolveShot(state,terrain,shooter,aimPoint(terrain,shooter,friendly),[friendly]).hitId).toBeUndefined();
  });
  it('preserves exact near-range shot continuation after a real save parse',()=>{
    const {state,terrain,shooter,target}=fixture();target.x=1.524;
    for(let i=0;i<12;i++)resolveShot(state,terrain,shooter,aimPoint(terrain,shooter,target),[target],12);
    const copy=new SaveSystem().parse(JSON.stringify(state)),other=copy.soldiers.find(s=>s.id===shooter.id)!;
    for(let i=0;i<30;i++)expect(resolveShot(copy,terrain,other,aimPoint(terrain,other,target),[target],12)).toEqual(resolveShot(state,terrain,shooter,aimPoint(terrain,shooter,target),[target],12));
  });
});

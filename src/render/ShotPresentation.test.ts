import {it,expect} from 'vitest';
import * as THREE from 'three';
import {UnitRenderer} from './UnitRenderer';
import {createStudyScenario} from '../garrison/StudyScenario';
import {muzzlePoint} from '../combat/Ballistics';
import {createOperation} from '../operations/createOperation';
import {mortarGeometry} from './WeaponPositionVisual';
import {ShotTravel,shotTravelSegment,travelDuration} from './ShotTravel';

it('renders the rifle barrel and flash on the authoritative shot, including elevated and prone fire',()=>{
  for(const prone of [false,true]){
    const sim=createStudyScenario(),state=sim.state,s=state.soldiers[0];state.soldiers=[s];state.operation=createOperation('advance').operation;
    state.elapsed=1;s.posture=prone?'prone':'standing';s.heading=.75;s.action='watching';const from=muzzlePoint(sim.terrain,s),to={x:from.x+10,y:from.y+8,z:from.z+40};
    state.operation!.shotEvents=[{id:1,at:1,shooterId:s.id,squadId:s.squadId,from,to,energy:1}];
    const renderer=new UnitRenderer(state,sim.terrain);renderer.update(new Set(),1/60,30);
    const rifle=renderer.group.children[5] as THREE.InstancedMesh,flash=renderer.group.children[6] as THREE.InstancedMesh,matrix=new THREE.Matrix4();rifle.getMatrixAt(0,matrix);
    const barrel=new THREE.Vector3(0,0,.6).applyMatrix4(matrix),expected=new THREE.Vector3(from.x,from.y,from.z);expect(barrel.distanceTo(expected)).toBeLessThan(.0001);
    const direction=new THREE.Vector3(0,0,1).transformDirection(matrix),actual=new THREE.Vector3(to.x-from.x,to.y-from.y,to.z-from.z).normalize();expect(direction.distanceTo(actual)).toBeLessThan(.00001);
    flash.getMatrixAt(0,matrix);expect(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(expected)).toBeLessThan(.0001);
  }
});
it('uses a metre-scale crew mortar with baseplate, tube and bipod, not an oversized icon',()=>{
  const g=mortarGeometry();g.computeBoundingBox();const size=g.boundingBox!.getSize(new THREE.Vector3());expect(size.y).toBeGreaterThan(1.3);expect(size.y).toBeLessThan(1.5);expect(size.x).toBeGreaterThan(.9);expect(size.x).toBeLessThan(1.2);expect(Array.from(g.attributes.position.array).every(Number.isFinite)).toBe(true);g.dispose();
});
it('moves one short visual segment from the actual muzzle to the authoritative impact, never beyond it',()=>{
  const shot={id:1,at:0,shooterId:1,squadId:1,from:{x:2,y:1.5,z:3},to:{x:302,y:5,z:203},energy:1},before=JSON.stringify(shot),duration=travelDuration(shot,'full');
  expect(shotTravelSegment(shot,0,'full')![0]).toEqual(shot.from);
  const middle=shotTravelSegment(shot,duration/2,'full')!,end=shotTravelSegment(shot,duration,'full')!;
  expect(middle[1].x).toBeGreaterThan(shot.from.x);expect(middle[1].x).toBeLessThan(shot.to.x);expect(end[1]).toEqual(shot.to);
  for(const segment of [middle,end]){expect(Math.hypot(segment[1].x-segment[0].x,segment[1].z-segment[0].z)).toBeLessThanOrEqual(14);for(const p of segment)expect((p.z-shot.from.z)/(shot.to.z-shot.from.z)).toBeCloseTo((p.x-shot.from.x)/(shot.to.x-shot.from.x));}
  expect(shotTravelSegment(shot,duration+.03,'full')).toBeUndefined();expect(JSON.stringify(shot)).toBe(before);
});
it('clips unseen incoming fire to the impact area and never recovers an unknown origin from stored cues',()=>{
  const shot={id:1,at:0,shooterId:1,squadId:1,from:{x:0,y:2,z:0},to:{x:300,y:1,z:0},energy:1};
  for(const age of [0,.03,.065])for(const p of shotTravelSegment(shot,age,'incoming')!)expect(p.x).toBeGreaterThanOrEqual(292);
  expect(shotTravelSegment(shot,.03,'hidden')).toBeUndefined();
  const host={},travel=new ShotTravel();travel.update(host,[shot],0,0,true,()=> 'full');
  expect(travel.update(host,[shot],.05,.02,true,()=> 'incoming').segments.every(v=>v.every(p=>p.x>=292))).toBe(true);
  expect(travel.update(host,[shot],.1,.04,true,()=> 'hidden').segments).toEqual([]);
});
it('preserves real burst events at fast-forward, pauses calmly, and resets on a new world',()=>{
  const host={},travel=new ShotTravel(),shots=Array.from({length:5},(_,id)=>({id,at:id*.1,shooterId:1,squadId:1,from:{x:0,y:2,z:0},to:{x:250,y:1,z:id},energy:1}));
  const a=travel.update(host,shots,.4,0,true,()=> 'full');expect(a.segments).toHaveLength(5);
  const paused=travel.update(host,shots,.4,1,false,()=> 'full');expect(paused.segments).toEqual(a.segments);
  expect(travel.update(host,shots,1,1.06,true,()=> 'full').arrivals).toEqual([]);
  const end=travel.update(host,shots,1.5,1.16,true,()=> 'full');
  const next=travel.update(host,shots,2,1.26,true,()=> 'full');expect(end.arrivals.length+next.arrivals.length).toBe(5);
  expect(travel.update({},[],0,1.36,true,()=> 'full').segments).toEqual([]);
});

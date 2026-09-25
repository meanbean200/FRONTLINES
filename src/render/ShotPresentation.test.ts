import {it,expect} from 'vitest';
import * as THREE from 'three';
import {UnitRenderer} from './UnitRenderer';
import {createStudyScenario} from '../garrison/StudyScenario';
import {muzzlePoint} from '../combat/Ballistics';
import {createOperation} from '../operations/createOperation';
import {mortarGeometry} from './WeaponPositionVisual';

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

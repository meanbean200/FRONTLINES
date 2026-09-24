import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {createBattlefield} from '../simulation/createBattlefield';
import {createGroundGeometry} from './GroundGeometry';
import {createInfrastructure,refreshRoadCuts} from './Scenery';
import {RIVER_CROSSINGS} from '../terrain/WorldLayout';

describe('rendered excavation',()=>{
  it('renders physical causeway heights at both terrain LODs, including seam-adjacent crossings',()=>{
    const state=createBattlefield();state.trenches=[];state.craters=[];const sim=new BattlefieldSimulation(state),material=new THREE.MeshBasicMaterial();
    for(const p of RIVER_CROSSINGS)for(const divisions of [8,32]){
      const geometry=createGroundGeometry(sim.terrain,Math.floor(p.x/500)*500,Math.floor(p.z/500)*500,divisions),mesh=new THREE.Mesh(geometry,material);mesh.updateMatrixWorld(true);
      for(const dz of [-8,0,8]){const ray=new THREE.Raycaster(new THREE.Vector3(p.x,1000,p.z+dz),new THREE.Vector3(0,-1,0)),hit=ray.intersectObject(mesh,false)[0];expect(hit).toBeDefined();expect(Math.abs(hit.point.y-sim.terrain.heightAt(p.x,p.z+dz))).toBeLessThan(.1);}
      geometry.dispose();
    }material.dispose();
  });
  it('removes road surfacing across a cut and restores it on load without that cut',()=>{
    const state=createBattlefield();state.trenches=[];state.craters=[];
    const sim=new BattlefieldSimulation(state),infra=createInfrastructure(sim.terrain);
    const roads=infra.children.filter(o=>o instanceof THREE.Mesh&&o.userData.road) as THREE.Mesh[];
    const original=roads.map(r=>r.geometry.index!.count);
    const x=-1600,z=-1330+Math.sin(x/530)*30;
    sim.createCrater({x,z},10,3);refreshRoadCuts(infra,sim.terrain,-2000,-1500);
    expect(roads.some((r,i)=>r.geometry.index!.count<original[i])).toBe(true);
    state.craters=[];sim.terrain.syncModifications();refreshRoadCuts(infra,sim.terrain,-2000,-1500);
    expect(roads.map(r=>r.geometry.index!.count)).toEqual(original);
  });
  it('exposes the cut floor to a downward ray and restores the surface after modifiers are removed',()=>{
    const state=createBattlefield();state.trenches=[];state.craters=[];
    const simulation=new BattlefieldSimulation(state);
    const id=simulation.createTrench([{x:25,z:40},{x:95,z:40}])!;
    state.trenches.find(t=>t.id===id)!.progress=1;state.trenches[0].status='complete';simulation.terrain.syncModifications();
    const geometry=createGroundGeometry(simulation.terrain,0,0,32);
    const material=new THREE.MeshBasicMaterial();
    const mesh=new THREE.Mesh(geometry,material);mesh.updateMatrixWorld(true);
    const ray=new THREE.Raycaster(new THREE.Vector3(55,1000,40),new THREE.Vector3(0,-1,0));
    const hit=ray.intersectObject(mesh,false)[0];
    expect(hit).toBeDefined();
    const base=simulation.terrain.baseHeightAt(55,40);
    expect(base-hit.point.y).toBeGreaterThan(1.5);
    expect(hit.point.y).toBeCloseTo(simulation.terrain.heightAt(55,40),1);
    state.trenches=[];simulation.terrain.syncModifications();
    expect(simulation.terrain.heightAt(55,40)).toBe(base);
    geometry.dispose();material.dispose();
  });
});

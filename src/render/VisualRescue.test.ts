import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {soldierGeometry,weaponGeometry} from './SoldierVisual';
import {truckGeometry,truckWheelGeometry} from './VehicleVisual';
import {createVegetation,refreshVegetationClearance,setVegetationDetail} from './Vegetation';
import {ParticlePool} from './ParticlePool';
import {EnvironmentLighting,environmentDaylight} from './EnvironmentLighting';
import {ImpactEffects} from './ImpactEffects';
import {UnitRenderer} from './UnitRenderer';
import {releaseLostContextResources} from './ContextRecovery';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import type {TerrainSystem} from '../terrain/TerrainSystem';

describe('visual rescue contracts',()=>{
  it('keeps human and lorry geometry finite and metre-scaled, with cheaper distant bodies',()=>{
    const close=soldierGeometry(false),far=soldierGeometry(false,false,false),truck=truckGeometry(),wheel=truckWheelGeometry();
    for(const g of [close,far,truck,wheel,...(['rifle','smg','automatic','machinegun'] as const).map(weaponGeometry)]){
      for(const name of ['position','normal','color'])expect(Array.from(g.attributes[name].array).every(Number.isFinite)).toBe(true);g.computeBoundingBox();
    }
    expect(close.boundingBox!.max.y).toBeGreaterThan(1.7);expect(close.boundingBox!.max.y).toBeLessThan(1.9);
    expect(close.attributes.position.count).toBeGreaterThan(far.attributes.position.count*2);
    expect(truck.boundingBox!.max.y).toBeLessThan(3);expect(truck.boundingBox!.getSize(new THREE.Vector3()).z).toBeGreaterThan(5.5);
    expect(wheel.boundingBox!.getSize(new THREE.Vector3()).y).toBeCloseTo(1,1);
  });
  it('clears and restores trunks and both canopy LODs together without changing tree sites',()=>{
    const trees=[{x:0,z:0,size:4,index:0},{x:20,z:0,size:5,index:1}],serialized=JSON.stringify(trees);let cut=false;
    const terrain={objects:{trees:()=>trees},heightAt:()=>0,deformationAt:(x:number)=>cut&&Math.abs(x)<4?-.5:0} as unknown as TerrainSystem;
    const group=createVegetation(terrain,0,0),pair=group.userData.pairs[0],m=new THREE.Matrix4(),original=new THREE.Matrix4();pair.near.getMatrixAt(0,original);
    for(const row of group.userData.pairs)for(const mesh of [row.near,row.far]){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)expect(Math.hypot(p.getX(i),p.getY(i),p.getZ(i))).toBeLessThanOrEqual(1.000001);}
    setVegetationDetail(group,100,600);expect(pair.near.visible).toBe(true);expect(pair.far.visible).toBe(false);
    setVegetationDetail(group,1000,600);expect(pair.near.visible).toBe(false);expect(pair.far.visible).toBe(true);
    cut=true;refreshVegetationClearance(group,terrain);
    for(const mesh of [group.userData.trunks,pair.near,pair.far]){mesh.getMatrixAt(0,m);expect(m.elements[0]).toBe(0);}
    cut=false;refreshVegetationClearance(group,terrain);pair.near.getMatrixAt(0,m);expect(m.elements).toEqual(original.elements);pair.far.getMatrixAt(0,m);expect(m.elements).toEqual(original.elements);
    expect(JSON.stringify(trees)).toBe(serialized);
  });
  it('bounds particle capacity and reuses the same GPU attributes across frames',()=>{
    const p=new ParticlePool(8),matrices=p.mesh.instanceMatrix,alpha=p.mesh.geometry.attributes.particleAlpha;p.limit=4;
    p.begin();for(let i=0;i<40;i++)p.add(i,0,0,1,1,0xffffff,.5);p.end();expect(p.count).toBe(4);
    p.begin();p.add(0,0,0,1,1,0xffffff,0);p.end();expect(p.count).toBe(0);expect(p.mesh.instanceMatrix).toBe(matrices);expect(p.mesh.geometry.attributes.particleAlpha).toBe(alpha);
  });
  it('dims dust and smoke at night while brief luminous flashes retain their color',()=>{
    const p=new ParticlePool(4),day=new THREE.Color(),night=new THREE.Color(),flash=new THREE.Color();
    p.begin();p.add(0,0,0,1,1,0xb7b7a9,.5);p.end();p.mesh.getColorAt(0,day);
    p.setAmbientLight(.22);p.begin();p.add(0,0,0,1,1,0xb7b7a9,.5);p.add(0,0,0,1,1,0xb7b7a9,.5,true);p.end();
    p.mesh.getColorAt(0,night);p.mesh.getColorAt(1,flash);
    expect(night.r/day.r).toBeCloseTo(.22);expect(flash.r).toBeCloseTo(day.r);expect(environmentDaylight(22)).toBe(0);expect(environmentDaylight(12)).toBe(1);
  });
  it('invalidates cached shadow receivers on preset changes and retains readable night fill',()=>{
    const scene=new THREE.Scene(),material=new THREE.MeshStandardMaterial(),mesh=new THREE.Mesh(new THREE.PlaneGeometry(),material);scene.add(mesh);
    const renderer={shadowMap:{enabled:true}} as THREE.WebGLRenderer,lighting=new EnvironmentLighting(scene,renderer),version=material.version;
    lighting.setQuality('low');expect(renderer.shadowMap.enabled).toBe(false);expect(lighting.sun.castShadow).toBe(false);expect(material.version).toBeGreaterThan(version);
    lighting.setQuality('balanced');expect(renderer.shadowMap.enabled).toBe(true);expect(lighting.sun.castShadow).toBe(true);
    lighting.update(22,new THREE.Vector3(),60,0);const sky=scene.children.find(o=>o instanceof THREE.HemisphereLight) as THREE.HemisphereLight;
    expect(sky.intensity).toBeCloseTo(1.5);expect(lighting.sun.intensity).toBeLessThan(.5);expect(renderer.toneMappingExposure).toBeCloseTo(1.28);
    lighting.update(12,new THREE.Vector3(),60,100);expect(sky.intensity).toBeCloseTo(1.25);expect(lighting.sun.intensity).toBeCloseTo(2.7);expect(renderer.toneMappingExposure).toBeCloseTo(1.05);
  });
  it('keeps effect aging paused, bounded, state-free and cleared by restoration',()=>{
    const state=createOperation('campaign'),sim=new BattlefieldSimulation(state),p=state.soldiers[0],effects=new ImpactEffects();
    state.operation!.blastEvents=[{id:1,at:state.elapsed,x:p.x,z:p.z,radius:12}];const before=JSON.stringify(state);
    effects.update(state,sim.terrain);const count=effects.particles.count,matrices=Array.from(effects.particles.mesh.instanceMatrix.array);
    for(let i=0;i<10;i++)effects.update(state,sim.terrain);
    expect(count).toBeGreaterThan(0);expect(effects.particles.count).toBe(count);expect(Array.from(effects.particles.mesh.instanceMatrix.array)).toEqual(matrices);expect(JSON.stringify(state)).toBe(before);
    state.elapsed+=8;state.operation!.blastEvents=[];effects.update(state,sim.terrain);expect(effects.particles.count).toBe(0);
    state.elapsed=0;state.operation!.blastEvents=[{id:1,at:0,x:p.x,z:p.z,radius:12}];effects.update(state,sim.terrain);expect(effects.particles.count).toBeGreaterThan(0);
    const loaded=structuredClone(state);loaded.operation!.blastEvents=[];effects.update(loaded,sim.terrain);expect(effects.particles.count).toBe(0);
  });
  it('does not display a remote unobserved blast or unreported enemy bodies',()=>{
    const state=createOperation('campaign'),sim=new BattlefieldSimulation(state),effects=new ImpactEffects();
    state.operation!.blastEvents=[{id:1,at:0,x:3500,z:3500,radius:12}];effects.update(state,sim.terrain);expect(effects.particles.count).toBe(0);
    const unit=new UnitRenderer(state,sim.terrain),before=JSON.stringify(state);unit.update(new Set(),1/60,25);
    expect((unit.group.children[2] as THREE.InstancedMesh).count).toBe(0);expect(unit.visibleCount).toBe(48);
    unit.update(new Set(),1/60,1600);expect(unit.visibleCount).toBe(0);expect(JSON.stringify(state)).toBe(before);
  });
  it('places visible muzzle flashes at the resolved shot origin',()=>{
    const state=createOperation('campaign'),sim=new BattlefieldSimulation(state),s=state.soldiers[0],unit=new UnitRenderer(state,sim.terrain);
    const from={x:s.x+.3,y:sim.terrain.heightAt(s.x,s.z)+1.4,z:s.z+.7};
    state.operation!.shotEvents=[{id:1,at:state.elapsed,shooterId:s.id,squadId:s.squadId,from,to:{...from,x:from.x+50},energy:1}];
    unit.update(new Set(),1/60,25);const mesh=unit.group.children[6] as THREE.InstancedMesh,m=new THREE.Matrix4();expect(mesh.count).toBe(1);mesh.getMatrixAt(0,m);
    expect(m.elements[12]).toBeCloseTo(from.x,3);expect(m.elements[13]).toBeCloseTo(from.y,3);expect(m.elements[14]).toBeCloseTo(from.z,3);
  });
  it('releases alpha-tested shadow materials and textures during context recovery',()=>{
    const scene=new THREE.Scene(),map=new THREE.DataTexture(),depth=new THREE.MeshDepthMaterial({map}),g=new THREE.PlaneGeometry(),m=new THREE.MeshBasicMaterial({map});
    const mesh=new THREE.InstancedMesh(g,m,2);mesh.customDepthMaterial=depth;scene.add(mesh);
    const d=vi.spyOn(depth,'dispose'),t=vi.spyOn(map,'dispose');releaseLostContextResources(scene);expect(d).toHaveBeenCalledTimes(1);expect(t).toHaveBeenCalledTimes(1);
  });
});

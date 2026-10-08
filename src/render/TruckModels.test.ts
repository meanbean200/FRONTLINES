import {beforeAll,describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {parseTruckAssets,type TruckAssets} from './TruckAssets';
import {LivingRenderer} from './LivingRenderer';
import {releaseLostContextResources} from './ContextRecovery';
import {createOperation} from '../operations/createOperation';
import {inventory,type Truck} from '../garrison/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';

let asset:TruckAssets;
beforeAll(async()=>{const b=readFileSync('src/assets/truck.glb');asset=await parseTruckAssets(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));});
const terrain={heightAt:()=>4,baseHeightAt:()=>4} as unknown as TerrainSystem;
const mesh=(r:LivingRenderer,name:string)=>r.group.getObjectByName(name) as THREE.InstancedMesh;
const matrix=(m:THREE.InstancedMesh,i=0)=>{const a=new THREE.Matrix4();m.getMatrixAt(i,a);return a;};
function fixture(){
  const state=createOperation('campaign'),truck:Truck={id:99901,x:0,z:0,role:'shuttle',state:'outbound',route:[{x:0,z:200}],routeIndex:0,cargo:inventory({food:12,water:30}),fuel:90,timer:0,reason:'Delivery',faction:'player'};
  state.soldiers=[];state.trenches=[];state.living!.facilities=[];state.living!.garrisons=[];state.living!.crates=[];state.living!.trucks=[truck];
  const renderer=new LivingRenderer(()=>state,terrain,null,asset);return {state,truck,renderer};
}
describe('supplied transport presentation',()=>{
  it('retains source identity and all 15100 triangles with bounded finite metre-scale geometry',()=>{
    const manifest=JSON.parse(readFileSync('assets/truck-manifest.json','utf8'));
    expect(createHash('sha256').update(readFileSync(`assets/${manifest.source}`)).digest('hex')).toBe(manifest.sourceSha256);
    expect(manifest.bytes).toBeLessThan(850_000);expect(manifest.materials).toBe(1);expect(manifest.textures).toBe(0);
    const geometries=[asset.body,...asset.wheels.map(w=>w.geometry)];expect(geometries.reduce((n,g)=>n+(g.index?.count??g.getAttribute('position').count)/3,0)).toBe(15100);
    for(const g of geometries)for(const name of ['position','normal','color'])expect(Array.from(g.getAttribute(name).array).every(Number.isFinite)).toBe(true);
    const bounds=asset.body.boundingBox!.clone();for(const w of asset.wheels)bounds.union(w.geometry.boundingBox!.clone().translate(w.pivot));
    expect(bounds.getSize(new THREE.Vector3()).z).toBeCloseTo(6.5,4);expect(bounds.min.y).toBeCloseTo(0,4);expect(bounds.max.y).toBeLessThan(2.7);
    expect(asset.wheels.length).toBe(6);expect(asset.wheelRadius).toBeGreaterThan(.45);expect(asset.wheelRadius).toBeLessThan(.52);
    for(const w of asset.wheels){expect(Math.abs(w.pivot.x)).toBeCloseTo(.8285,3);expect(w.geometry.boundingBox!.getSize(new THREE.Vector3()).y).toBeLessThan(1.12);}
  });
  it('renders six source wheels, turns from displacement even on throttled frames, and freezes when parked',()=>{
    const {state,truck,renderer}=fixture(),body=mesh(renderer,'Logistics truck bodies'),wheel=mesh(renderer,'Logistics truck wheel 0');renderer.update(100,false);
    expect(body.geometry).toBe(asset.body);expect(body.count).toBe(1);expect(wheel.count).toBe(1);expect(mesh(renderer,'Distant truck wheels').count).toBe(0);
    const initial=matrix(wheel);truck.z=1;state.elapsed=.1;const before=JSON.stringify(state);renderer.update(116,false);
    expect(matrix(body).elements[14]).toBe(1);expect(matrix(wheel).elements).not.toEqual(initial.elements);
    const rotation=new THREE.Quaternion().setFromRotationMatrix(matrix(wheel));expect(rotation.angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),1/asset.wheelRadius))).toBeLessThan(.001);
    const frozen=matrix(wheel).elements;renderer.update(132,false);renderer.update(148,false);expect(matrix(wheel).elements).toEqual(frozen);expect(JSON.stringify(state)).toBe(before);
  });
  it('keeps axles attached while facing the route and uses a cheaper distant fallback without duplicate wheels',()=>{
    const {truck,renderer}=fixture();truck.x=20;truck.z=10;truck.route=[{x:120,z:10}];renderer.update(100,false,{x:20,z:10,zoom:20});
    const body=mesh(renderer,'Logistics truck bodies'),bodyMatrix=matrix(body);
    for(let i=0;i<6;i++){
      const w=mesh(renderer,`Logistics truck wheel ${i}`),origin=new THREE.Vector3().setFromMatrixPosition(matrix(w)),expected=asset.wheels[i].pivot.clone().applyMatrix4(bodyMatrix);
      expect(origin.distanceTo(expected)).toBeLessThan(.0001);
    }
    renderer.update(116,false,{x:20,z:10,zoom:700});expect(body.geometry).not.toBe(asset.body);expect(mesh(renderer,'Distant truck wheels').count).toBe(6);
    for(let i=0;i<6;i++)expect(mesh(renderer,`Logistics truck wheel ${i}`).count).toBe(0);
    renderer.update(132,false,{x:20,z:10,zoom:20});expect(body.geometry).toBe(asset.body);expect(mesh(renderer,'Distant truck wheels').count).toBe(0);
  });
  it('retains enemy visibility gates, bounded instance counts, and clears all vehicles on removal',()=>{
    const {state,truck,renderer}=fixture();truck.faction='enemy';renderer.update(100,false);expect(mesh(renderer,'Logistics truck bodies').count).toBe(0);
    renderer.spectator=true;renderer.update(200,false);expect(mesh(renderer,'Logistics truck bodies').count).toBe(1);
    state.living!.trucks=Array.from({length:80},(_,i)=>({...truck,id:i,x:i*10}));renderer.update(300,false);expect(mesh(renderer,'Logistics truck bodies').count).toBe(64);
    for(let i=0;i<6;i++)expect(mesh(renderer,`Logistics truck wheel ${i}`).count).toBe(64);
    state.living!.trucks=[];renderer.update(400,false);expect(mesh(renderer,'Logistics truck bodies').count).toBe(0);for(let i=0;i<6;i++)expect(mesh(renderer,`Logistics truck wheel ${i}`).count).toBe(0);
  });
  it('survives context-resource release and save-derived replacement without writing cargo, fuel, or saves',()=>{
    const {state,truck,renderer}=fixture();renderer.update(100,false);truck.z=2;renderer.update(200,false);const before=JSON.stringify(state);
    releaseLostContextResources(renderer.group);renderer.update(300,false);expect(mesh(renderer,'Logistics truck bodies').geometry).toBe(asset.body);expect(JSON.stringify(state)).toBe(before);
    state.living=JSON.parse(JSON.stringify(state.living));renderer.update(316,false);expect(matrix(mesh(renderer,'Logistics truck bodies')).elements[14]).toBe(2);expect(JSON.stringify(state)).toBe(before);
    const loaded=new LivingRenderer(()=>state,terrain,null,null);loaded.update(100,false);expect(mesh(loaded,'Distant truck wheels').count).toBe(6);expect(mesh(loaded,'Logistics truck bodies').geometry).not.toBe(asset.body);
  });
});

import {beforeAll,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {parseHouseAssets,houseRoofGeometry,type HouseAssets} from './HouseAssets';
import {createBuildingMeshes,refreshBuildingMeshes} from './Scenery';
import {createStudyScenario} from '../garrison/StudyScenario';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {buildingStyle,doorPoint,firingPoints,structureBoxes} from '../terrain/BuildingGeometry';
import {boxIntersection} from '../terrain/WorldOcclusion';
import {releaseLostContextResources} from './ContextRecovery';

let assets:HouseAssets;
const bytes=readFileSync(new URL('../assets/house.glb',import.meta.url));
const site={x:0,z:0,width:11,depth:9,height:5,angle:0};
const triangles=(g:THREE.BufferGeometry)=>(g.index?.count??g.getAttribute('position').count)/3;
beforeAll(async()=>{assets=await parseHouseAssets(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));});
function fixture(){const sim=createStudyScenario();sim.terrain.buildings=[{...site},{...site,x:30,height:7}];vi.spyOn(sim.terrain,'baseHeightAt').mockReturnValue(0);vi.spyOn(sim.terrain,'heightAt').mockReturnValue(0);const root=new THREE.Group();root.add(createBuildingMeshes(sim.terrain,assets));root.updateMatrixWorld(true);return {sim,root};}

describe('supplied single-floor cottage adaptation',()=>{
  it('preserves the full source and ships a bounded named surface kit',()=>{
    const manifest=JSON.parse(readFileSync(new URL('../../assets/house-manifest.json',import.meta.url),'utf8'));
    const source=readFileSync(new URL('../../assets/source/small-one-floor-house.obj',import.meta.url));
    expect(createHash('sha256').update(source).digest('hex')).toBe(manifest.sourceSha256);
    expect(source.length).toBe(526557);expect(manifest.sourceTriangles).toBe(15100);expect(manifest.bytes).toBe(bytes.length);
    expect(triangles(assets.roof)).toBe(3267);expect(triangles(assets.stone)).toBe(79);
    for(const g of [assets.roof,assets.stone])for(const key of ['position','normal'])expect(Array.from(g.getAttribute(key).array).every(Number.isFinite)).toBe(true);
    expect(assets.stone.boundingBox!.min.toArray()).toEqual([-.5,-.5,-.5]);expect(assets.stone.boundingBox!.max.toArray()).toEqual([.5,.5,.5]);
    expect(bytes.length).toBeLessThan(150000);
  });
  it('fits relief to each authoritative eave and roof pitch, without moving the floor or openings',()=>{
    const original=Array.from(assets.roof.getAttribute('position').array);
    for(const b of [site,{...site,x:45,z:28,width:13,depth:12,height:5.8},{...site,x:3,width:9,depth:8}]){
      const before=JSON.stringify(b),g=houseRoofGeometry(assets,b,21),p=g.getAttribute('position'),half=(b.depth+.8)/2,pitch=buildingStyle(b).pitch;
      for(let i=0;i<p.count;i++){
        const z=p.getZ(i)-b.z,x=p.getX(i)-b.x,skin=21+b.height+.14+(half-Math.abs(z))*Math.tan(pitch)+.11/Math.cos(pitch);
        expect(Math.abs(x)).toBeLessThanOrEqual((b.width+.8)/2+1e-5);expect(Math.abs(z)).toBeLessThanOrEqual(half+1e-5);
        expect(p.getY(i)-skin).toBeGreaterThan(.0119);expect(p.getY(i)-skin).toBeLessThan(.1401);
      }
      expect(JSON.stringify(b)).toBe(before);g.dispose();
    }
    expect(Array.from(assets.roof.getAttribute('position').array)).toEqual(original);
  });
  it('never paints closed source doors or glass across real entrances and firing apertures',()=>{
    const {sim,root}=fixture(),before=JSON.stringify(sim.state),boxes=JSON.stringify(sim.terrain.structure(0)),entry=doorPoint(site,2),posts=firingPoints(site);
    const details=root.children[0].children[0].children.filter(m=>m.userData.houseDetail);
    for(const side of [-1,1])for(const x of [-site.width*.28,0,site.width*.28]){
      const a=new THREE.Vector3(x,1.6,side*(site.depth/2+2)),to=new THREE.Vector3(x,1.6,0),ray=new THREE.Raycaster(a,to.clone().sub(a).normalize(),0,2.4);
      expect(ray.intersectObjects(details,true)).toHaveLength(0);
      expect(structureBoxes(site).some(b=>boxIntersection(a,to,b))).toBe(false);
    }
    for(const side of [-1,1]){const ray=new THREE.Raycaster(new THREE.Vector3(side*(site.width/2+2),1.6,0),new THREE.Vector3(-side,0,0),0,2.4);expect(ray.intersectObjects(details,true)).toHaveLength(0);}
    expect(doorPoint(site,2)).toEqual(entry);expect(firingPoints(site)).toEqual(posts);expect(JSON.stringify(sim.terrain.structure(0))).toBe(boxes);expect(JSON.stringify(sim.state)).toBe(before);
  });
  it('respects one-floor applicability, roof cutaways and bounded distance detail',()=>{
    const {sim,root}=fixture(),house=root.children[0].children[0],twoFloor=root.children[0].children[1];
    expect(house.children.length).toBeLessThanOrEqual(10);expect(twoFloor.children.some(m=>m.userData.houseDetail)).toBe(false);
    const roof=house.getObjectByName('Supplied cottage roof') as THREE.Mesh,geometry=roof.geometry;
    refreshBuildingMeshes(root,sim.terrain,new Map([[0,0]]),assets);expect(roof.visible).toBe(false);expect(house.getObjectByName('Supplied cottage stone')!.visible).toBe(true);
    refreshBuildingMeshes(root,sim.terrain,new Map(),assets,{x:0,z:0,zoom:40,detail:180});expect(roof.visible).toBe(true);
    refreshBuildingMeshes(root,sim.terrain,new Map(),assets,{x:2000,z:0,zoom:40,detail:180});expect(roof.visible).toBe(false);expect(house.children.filter(m=>!m.userData.houseDetail).every(m=>m.visible)).toBe(true);
    refreshBuildingMeshes(root,sim.terrain,new Map(),assets);expect(roof.visible).toBe(true);expect(roof.geometry).toBe(geometry);
  });
  it('does not overlay intact art on damage or ruins, and survives restoration/context reupload',()=>{
    const {sim,root}=fixture(),source=Array.from(assets.roof.getAttribute('position').array);
    const first=root.children[0].children[0].getObjectByName('Supplied cottage roof') as THREE.Mesh,disposed=vi.spyOn(first.geometry,'dispose');
    for(const condition of ['damaged','ruined'] as const){sim.state.buildingChanges=[{id:0,condition,damage:80}];sim.terrain.syncModifications();refreshBuildingMeshes(root,sim.terrain,new Map(),assets);expect(root.getObjectByName('Supplied cottage roof')).toBeUndefined();}
    expect(disposed).toHaveBeenCalledTimes(1);
    sim.state.buildingChanges=[];sim.terrain.syncModifications();refreshBuildingMeshes(root,sim.terrain,new Map(),assets);expect(root.getObjectByName('Supplied cottage roof')).toBeDefined();
    const before=JSON.stringify(sim.state);releaseLostContextResources(root);refreshBuildingMeshes(root,sim.terrain,new Map(),assets);expect(root.getObjectByName('Supplied cottage roof')!.visible).toBe(true);expect(JSON.stringify(sim.state)).toBe(before);
    expect(Array.from(assets.roof.getAttribute('position').array)).toEqual(source);
    const restored=new BattlefieldSimulation(JSON.parse(before));restored.terrain.buildings=[{...site},{...site,x:30,height:7}];vi.spyOn(restored.terrain,'baseHeightAt').mockReturnValue(0);
    const next=createBuildingMeshes(restored.terrain,assets).getObjectByName('Supplied cottage roof') as THREE.Mesh;
    expect(Array.from(next.geometry.getAttribute('position').array)).toEqual(Array.from((root.getObjectByName('Supplied cottage roof') as THREE.Mesh).geometry.getAttribute('position').array));
    refreshBuildingMeshes(root,sim.terrain,new Map());expect(root.getObjectByName('Supplied cottage roof')).toBeUndefined();
  });
});

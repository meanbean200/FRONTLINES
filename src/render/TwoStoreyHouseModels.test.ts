import {beforeAll,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {parseHouseAssets,parseTwoStoreyHouseAssets,houseRoofGeometry,type HouseAssets} from './HouseAssets';
import {createBuildingMeshes,refreshBuildingMeshes} from './Scenery';
import {createStudyScenario} from '../garrison/StudyScenario';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {buildingStyle,floorHeight,structureBoxes,doorPoint,stairPoint,firingPoints} from '../terrain/BuildingGeometry';
import {boxIntersection} from '../terrain/WorldOcclusion';
import {releaseLostContextResources} from './ContextRecovery';

let assets:HouseAssets,cottage:HouseAssets;
const bytes=readFileSync(new URL('../assets/two-story-house.glb',import.meta.url));
const buffer=(b:Buffer)=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;
const site={x:0,z:0,width:11,depth:9,height:7.5,angle:0};
const triangles=(g:THREE.BufferGeometry)=>(g.index?.count??g.getAttribute('position').count)/3;
beforeAll(async()=>{assets=await parseTwoStoreyHouseAssets(buffer(bytes));cottage=await parseHouseAssets(buffer(readFileSync(new URL('../assets/house.glb',import.meta.url))));});
function fixture(){
  const sim=createStudyScenario();sim.terrain.buildings=[{...site},{...site,x:30,height:5}];
  vi.spyOn(sim.terrain,'baseHeightAt').mockReturnValue(0);vi.spyOn(sim.terrain,'heightAt').mockReturnValue(0);
  const root=new THREE.Group();root.add(createBuildingMeshes(sim.terrain,cottage,assets));root.updateMatrixWorld(true);
  const refresh=(cutaways=new Map<number,number>(),detail=assets)=>refreshBuildingMeshes(root,sim.terrain,cutaways,cottage,undefined,detail);
  return {sim,root,refresh,house:root.children[0].children[0]};
}

describe('supplied two-story house presentation',()=>{
  it('preserves the full source and bounded named surfaces, with no texture dependency',()=>{
    const m=JSON.parse(readFileSync(new URL('../../assets/two-story-house-manifest.json',import.meta.url),'utf8'));
    const source=readFileSync(new URL('../../assets/source/2-story-house.obj',import.meta.url));
    expect(createHash('sha256').update(source).digest('hex')).toBe(m.sourceSha256);expect(source.length).toBe(450233);
    expect(m.sourceTriangles).toBe(13100);expect(m.bytes).toBe(bytes.length);expect(bytes.length).toBeLessThan(100000);expect(m.textures).toBe(0);
    expect([triangles(assets.roof),triangles(assets.stone),triangles(assets.shutter!)]).toEqual([2516,39,16]);
    for(const g of [assets.roof,assets.stone,assets.shutter!])for(const k of ['position','normal'])expect(Array.from(g.getAttribute(k).array).every(Number.isFinite)).toBe(true);
    for(const g of [assets.stone,assets.shutter!]){expect(g.boundingBox!.min.toArray()).toEqual([-.5,-.5,-.5]);expect(g.boundingBox!.max.toArray()).toEqual([.5,.5,.5]);}
  });
  it('rejects a mismatched asset instead of silently applying the wrong building kit',async()=>{
    await expect(parseHouseAssets(buffer(bytes))).rejects.toThrow('Incompatible house asset');
    await expect(parseTwoStoreyHouseAssets(buffer(readFileSync(new URL('../assets/house.glb',import.meta.url))))).rejects.toThrow('Incompatible house asset');
  });
  it('fits varied building sizes and pitches while retaining metre-scale roof relief',()=>{
    const source=Array.from(assets.roof.getAttribute('position').array);
    for(const b of [site,{...site,x:29,z:-13,width:13,depth:12,height:6.1},{...site,x:-3,width:9,depth:8,height:8}]){
      const g=houseRoofGeometry(assets,b,19),p=g.getAttribute('position'),half=(b.depth+.8)/2,pitch=buildingStyle(b).pitch;
      for(let i=0;i<p.count;i++){
        const x=p.getX(i)-b.x,z=p.getZ(i)-b.z,skin=19+b.height+.14+(half-Math.abs(z))*Math.tan(pitch)+.11/Math.cos(pitch);
        expect(Math.abs(x)).toBeLessThanOrEqual((b.width+.8)/2+1e-5);expect(Math.abs(z)).toBeLessThanOrEqual(half+1e-5);
        expect(p.getY(i)-skin).toBeGreaterThan(.0119);expect(p.getY(i)-skin).toBeLessThan(.1401);
      }g.dispose();
    }
    expect(Array.from(assets.roof.getAttribute('position').array)).toEqual(source);
  });
  it('keeps both floors, stairs, doors, windows, cover geometry and saved state authoritative',()=>{
    const {sim,root,house}=fixture(),before=JSON.stringify(sim.state),boxes=JSON.stringify(sim.terrain.structure(0));
    const layout=[doorPoint(site),stairPoint(site),...firingPoints(site)],details=house.children.filter(m=>m.userData.houseDetail);
    expect(structureBoxes(site).filter(b=>b.role==='stair')).toHaveLength(12);
    for(const floor of [0,1]){
      const y=floor*floorHeight(site)+1.6;
      for(const side of [-1,1])for(const x of [-site.width*.28,0,site.width*.28]){
        // Stop just inside the aperture: the real staircase deeper in the room
        // is solid and must not be mistaken for a blocked front window.
        const a=new THREE.Vector3(x,y,side*(site.depth/2+2)),b=new THREE.Vector3(x,y,side*(site.depth/2-.5));
        expect(new THREE.Raycaster(a,b.clone().sub(a).normalize(),0,2.4).intersectObjects(details,true)).toHaveLength(0);
        expect(structureBoxes(site).some(box=>boxIntersection(a,b,box))).toBe(false);
      }
      for(const side of [-1,1])expect(new THREE.Raycaster(new THREE.Vector3(side*(site.width/2+2),y,0),new THREE.Vector3(-side,0,0),0,2.4).intersectObjects(details,true)).toHaveLength(0);
      const trims=structureBoxes(site).filter(b=>b.role==='trim'&&b.layer===floor);
      for(const mesh of details.filter(m=>m.userData.layer===floor) as THREE.Mesh[]){
        const p=mesh.geometry.getAttribute('position');
        for(let i=0;i<p.count;i++)expect(trims.some(b=>Math.abs(p.getX(i)-b.x)<=b.rx+1e-5&&Math.abs(p.getY(i)-b.y)<=b.ry+1e-5&&Math.abs(p.getZ(i)-b.z)<=b.rz+1e-5)).toBe(true);
      }
    }
    expect(JSON.stringify(sim.state)).toBe(before);expect(JSON.stringify(sim.terrain.structure(0))).toBe(boxes);
    expect([doorPoint(site),stairPoint(site),...firingPoints(site)]).toEqual(layout);expect(root.children[0].children[1].getObjectByName('Supplied cottage roof')).toBeDefined();
  });
  it('separates floor cutaways and distance detail without per-frame allocations',()=>{
    const {sim,root,house,refresh}=fixture(),roof=house.getObjectByName('Supplied two-story roof') as THREE.Mesh,geometry=roof.geometry;
    expect(house.children.length).toBeLessThanOrEqual(14);expect(house.children.filter(m=>m.userData.houseDetail)).toHaveLength(5);
    refresh(new Map([[0,1]]));expect(roof.visible).toBe(false);expect(house.children.filter(m=>m.userData.houseDetail&&m.userData.layer===1).every(m=>m.visible)).toBe(true);
    refresh(new Map([[0,0]]));expect(house.children.filter(m=>m.userData.layer>0).every(m=>!m.visible)).toBe(true);expect(house.children.filter(m=>m.userData.layer===0).every(m=>m.visible)).toBe(true);
    refreshBuildingMeshes(root,sim.terrain,new Map(),cottage,{x:2000,z:0,zoom:40,detail:180},assets);
    expect(roof.visible).toBe(false);expect(house.children.filter(m=>!m.userData.houseDetail).every(m=>m.visible)).toBe(true);
    refresh();expect(roof.visible).toBe(true);expect(roof.geometry).toBe(geometry);
  });
  it('falls back independently and disposes owned details when damaged or unloaded',()=>{
    const {sim,root,house,refresh}=fixture();const details=house.children.filter(m=>m.userData.houseDetail) as THREE.Mesh[];
    const disposals=details.map(m=>vi.spyOn(m.geometry,'dispose'));
    for(const condition of ['damaged','ruined'] as const){sim.state.buildingChanges=[{id:0,condition,damage:90}];sim.terrain.syncModifications();refresh();expect(root.getObjectByName('Supplied two-story roof')).toBeUndefined();}
    disposals.forEach(spy=>expect(spy).toHaveBeenCalledTimes(1));
    sim.state.buildingChanges=[];sim.terrain.syncModifications();refresh();expect(root.getObjectByName('Supplied two-story roof')).toBeDefined();
    refreshBuildingMeshes(root,sim.terrain,new Map(),cottage);expect(root.getObjectByName('Supplied two-story roof')).toBeUndefined();expect(root.getObjectByName('Supplied cottage roof')).toBeDefined();
    refreshBuildingMeshes(root,sim.terrain,new Map(),undefined,undefined,assets);expect(root.getObjectByName('Supplied cottage roof')).toBeUndefined();expect(root.getObjectByName('Supplied two-story roof')).toBeDefined();
  });
  it('retains deterministic presentation across save restoration and graphics-context reupload',()=>{
    const {sim,root,refresh}=fixture(),before=JSON.stringify(sim.state),source=Array.from(assets.roof.getAttribute('position').array);
    releaseLostContextResources(root);refresh();expect(root.getObjectByName('Supplied two-story roof')!.visible).toBe(true);
    const restored=new BattlefieldSimulation(JSON.parse(before));restored.terrain.buildings=sim.terrain.buildings.map(b=>({...b}));vi.spyOn(restored.terrain,'baseHeightAt').mockReturnValue(0);
    const next=createBuildingMeshes(restored.terrain,cottage,assets).getObjectByName('Supplied two-story roof') as THREE.Mesh;
    expect(Array.from(next.geometry.getAttribute('position').array)).toEqual(Array.from((root.getObjectByName('Supplied two-story roof') as THREE.Mesh).geometry.getAttribute('position').array));
    expect(Array.from(assets.roof.getAttribute('position').array)).toEqual(source);expect(JSON.stringify(sim.state)).toBe(before);
  });
});

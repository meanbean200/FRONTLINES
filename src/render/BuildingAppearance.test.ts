import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {buildingStyle,structureBoxes} from '../terrain/BuildingGeometry';
import {boxIntersection} from '../terrain/WorldOcclusion';
import {emplacementBoxes,facilityFrame,facilityPoint} from '../terrain/SupportGeometry';
import {supportAppearance} from './SupportAppearance';
import {inventory,type Facility} from '../garrison/types';
import {createStudyScenario} from '../garrison/StudyScenario';
import {createInfrastructure,refreshBuildingMeshes} from './Scenery';

const site={x:0,z:0,width:12,depth:10,height:7,angle:0};
const facility=(kind:Facility['kind']):Facility=>({id:1,garrisonId:2,connectorId:3,x:0,z:0,kind,progress:1,paid:true,capacity:8,stock:inventory(),materialCost:12,facing:.63});
describe('adaptive structure presentation',()=>{
  it('keeps pitched roofs physical, finite and identical to rendered ray intersections',()=>{
    for(const condition of ['intact','damaged'] as const){
      const roofs=structureBoxes(site,condition).filter(b=>b.role==='roof');expect(roofs).toHaveLength(2);
      for(const b of roofs){
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(b.rx*2,b.ry*2,b.rz*2),new THREE.MeshBasicMaterial());mesh.rotation.x=b.pitch!;mesh.position.set(b.x,b.y,b.z);mesh.updateMatrixWorld();
        const from={x:b.x,y:20,z:b.z},to={x:b.x,y:0,z:b.z},hit=boxIntersection(from,to,b)!;
        const ray=new THREE.Raycaster(new THREE.Vector3(from.x,from.y,from.z),new THREE.Vector3(0,-1,0));
        expect(hit).toBeDefined();expect(ray.intersectObject(mesh)[0].point.y).toBeCloseTo(20-20*hit[0],5);
        mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();
      }
    }
    expect(structureBoxes(site,'ruined').some(b=>b.role==='roof')).toBe(false);
    expect(new Set(Array.from({length:10},(_,i)=>buildingStyle({...site,x:i}).pitch)).size).toBe(4);
  });
  it('retains open doors and firing windows after facade detail is added',()=>{
    const boxes=structureBoxes(site);
    for(const x of [0,-site.width*.28,site.width*.28])expect(boxes.some(b=>boxIntersection({x,y:1.6,z:-8},{x,y:1.6,z:0},b))).toBe(false);
    expect(boxes.some(b=>boxIntersection({x:1.7,y:1.6,z:-8},{x:1.7,y:1.6,z:0},b))).toBe(true);
  });
  it('roof and facade broad-phase culling preserves exact visibility intersections',()=>{
    const sim=createStudyScenario(),t=sim.terrain;t.buildings=[site];
    vi.spyOn(t,'baseHeightAt').mockReturnValue(0);vi.spyOn(t,'heightAt').mockReturnValue(0);vi.spyOn(t.objects,'trees').mockReturnValue([]);
    vi.spyOn(t,'groundTypeAt').mockReturnValue('field');const boxes=t.structure(0);
    for(const y of [1.6,4.8,7.4,8.5,9.4,13])for(const z of [-5.3,-4,-2,0,2,4,5.3]){
      const a={x:-20,y,z},b={x:20,y:y+.2,z};
      expect(t.objects.trace(a,b,a.y,b.y).clear).toBe(!boxes.some(box=>boxIntersection(a,b,box)));
    }
  });
  it('matches continuously rotated weapon parapets to render volumes',()=>{
    const boxes=emplacementBoxes(facility('emplacement'));expect(boxes.every(b=>b.angle===.63)).toBe(true);
    const b=boxes[0],s=Math.sin(b.angle),c=Math.cos(b.angle);
    expect(boxIntersection({x:b.x-s*2,y:.5,z:b.z-c*2},{x:b.x+s*2,y:.5,z:b.z+c*2},b)).toBeDefined();
    const parts=supportAppearance(facility('emplacement'),undefined,()=>0,false);
    expect(parts[0]).toMatchObject({x:b.x,z:b.z,sx:b.rx*2,sz:b.rz*2,angle:b.angle});
  });
  it('adapts bays and pegs to the actual connector and ground, without fake supplies',()=>{
    const sim=createStudyScenario(),connector=sim.state.trenches[0];connector.points=[{x:-20,z:-20},{x:0,z:0}];
    const f=facility('store'),frame=facilityFrame(f,connector);expect(frame.angle).toBeCloseTo(Math.PI/4);
    expect(facilityPoint(frame,0,-2).x).toBeCloseTo(-Math.SQRT2);
    f.progress=0;const pegs=supportAppearance(f,connector,(x,z)=>x*.1+z*.2);
    expect(pegs).toHaveLength(4);for(const p of pegs)expect(p.y-p.sy/2).toBeCloseTo(p.x*.1+p.z*.2);
    f.progress=1;const empty=supportAppearance(f,connector,()=>0);f.stock.ammo=200;const loaded=supportAppearance(f,connector,()=>0);
    expect(loaded.length).toBeGreaterThan(empty.length);
    expect(supportAppearance(f,connector,()=>0,false).length).toBeLessThan(loaded.length);
    expect(new Set((['rest','meal','aid','store','mortar'] as const).map(kind=>JSON.stringify(supportAppearance(facility(kind),connector,()=>0)))).size).toBe(5);
  });
  it('preserves roof cutaways and bounds detail batching per building',()=>{
    const sim=createStudyScenario(),infra=createInfrastructure(sim.terrain),building=infra.getObjectByName('buildings')!.children[0];
    expect(building.children.length).toBeLessThanOrEqual(10);
    refreshBuildingMeshes(infra,sim.terrain,new Map([[0,0]]));
    expect(building.children.filter(m=>m.userData.layer>0).every(m=>!m.visible)).toBe(true);
    refreshBuildingMeshes(infra,sim.terrain,new Map());expect(building.children.every(m=>m.visible)).toBe(true);
    const boxes=sim.terrain.structure(0).filter(b=>b.role==='foundation');expect(boxes.length).toBe(32);expect(boxes.every(b=>b.y+b.ry===0&&b.ry>0)).toBe(true);
  });
});

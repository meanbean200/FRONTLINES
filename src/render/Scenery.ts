import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TerrainSystem } from '../terrain/TerrainSystem';
import {buildingMaterial} from './BuildingMaterials';
import {buildingStyle} from '../terrain/BuildingGeometry';
import {WORLD_SIZE,WORLD_HALF,CHUNK_SIZE,clamp} from '../core/types';
import {ROADS,pointOnRoad} from '../terrain/WorldLayout';

export {createVegetation,refreshVegetationClearance} from './Vegetation';

export function createInfrastructure(terrain: TerrainSystem): THREE.Group {
  const group = new THREE.Group();
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x8c826d, roughness: 1, side: THREE.DoubleSide });
  roadMaterial.onBeforeCompile=shader=>{
    shader.vertexShader='attribute vec2 roadCoords; varying vec2 roadSurface;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nroadSurface=roadCoords;');
    shader.fragmentShader='varying vec2 roadSurface;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float verge=smoothstep(.36,.5,abs(roadSurface.x-.5));
      float rut=1.-smoothstep(.018,.085,abs(abs(roadSurface.x-.5)-.23));
      float grain=fract(sin(dot(floor(roadSurface*vec2(48.,8.)),vec2(12.9,78.2)))*43758.5);
      float detail=1.-smoothstep(90.,550.,length(vViewPosition));
      diffuseColor.rgb*=.95-verge*.26-rut*.12+(grain-.5)*.14*detail;
      // Dither the shoulder into the ground, without a transparent sorting seam.
      float edgeCoverage=1.-smoothstep(.39,.5,abs(roadSurface.x-.5));
      if(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)>edgeCoverage)discard;
    `);
  };
  const waterMaterial = new THREE.MeshStandardMaterial({ color: 0x547772, roughness: .32, metalness: .18, side: THREE.DoubleSide });
  const paths = ROADS.map(road=>({path:(t:number)=>pointOnRoad(road,t),width:road.width}));
  for (const { path, width } of paths) group.add(ribbon(terrain, path, width, roadMaterial, false));
  group.add(ribbon(terrain, t => ({ x: t, z: terrain.riverCenter(t) }), 27, waterMaterial, true));
  group.add(createBuildingMeshes(terrain));
  return group;
}

function ribbon(terrain: TerrainSystem, path: (t: number) => {x:number;z:number}, width: number, material: THREE.Material, water: boolean): THREE.Mesh {
  const vertices: number[] = [], indices: number[] = [],uvs:number[]=[];
  const steps = Math.ceil(WORLD_SIZE/4);
  for (let i=0; i<=steps; i++) {
    const t = -WORLD_HALF + i / steps * WORLD_SIZE, p = path(t), q = path(t + 1);
    const length = Math.hypot(q.x-p.x,q.z-p.z), nx = -(q.z-p.z)/length, nz = (q.x-p.x)/length;
    for (const side of [-1,1]) {
      const halfWidth=water?terrain.riverWidth(p.x):width/2;
      const x = clamp(p.x + nx * halfWidth * side,-WORLD_HALF,WORLD_HALF), z = clamp(p.z + nz * halfWidth * side,-WORLD_HALF,WORLD_HALF);
      vertices.push(x, water ? terrain.baseHeightAt(p.x,p.z)+2.4 : terrain.baseHeightAt(x,z)+.18, z);
      uvs.push(side*.5+.5,t);
    }
    if (i<steps&&(!water||terrain.distanceToRoad(p.x,p.z)>13)) {const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const geometry = new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('roadCoords',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;
  if(!water){mesh.userData.road=true;mesh.userData.hiddenRoadQuads=new Set<number>();}
  return mesh;
}

/** Cut road surfacing where excavation intersects it; do not leave a floating lid over a trench. */
export function refreshRoadCuts(group:THREE.Group,terrain:TerrainSystem,x:number,z:number):void {
  for(const mesh of group.children){
    if(!(mesh instanceof THREE.Mesh)||!mesh.userData.road)continue;
    const positions=mesh.geometry.attributes.position,hidden=mesh.userData.hiddenRoadQuads as Set<number>;let changed=false;
    for(let i=0;i<positions.count/2-1;i++){
      const a=i*2,b=a+2;
      if(Math.max(positions.getX(a),positions.getX(b))+8<x||Math.min(positions.getX(a),positions.getX(b))-8>x+CHUNK_SIZE||Math.max(positions.getZ(a),positions.getZ(b))+8<z||Math.min(positions.getZ(a),positions.getZ(b))-8>z+CHUNK_SIZE)continue;
      let cut=false;
      for(let along=0;along<=4&&!cut;along++)for(let across=0;across<=4&&!cut;across++){
        const t=along/4,u=across/4;
        const ax=positions.getX(a)*(1-u)+positions.getX(a+1)*u,az=positions.getZ(a)*(1-u)+positions.getZ(a+1)*u;
        const bx=positions.getX(b)*(1-u)+positions.getX(b+1)*u,bz=positions.getZ(b)*(1-u)+positions.getZ(b+1)*u;
        cut=terrain.deformationAt(ax*(1-t)+bx*t,az*(1-t)+bz*t)<-.1;
      }
      if(cut!==hidden.has(i)){changed=true;if(cut)hidden.add(i);else hidden.delete(i);}
    }
    if(changed){const indices:number[]=[];for(let i=0;i<positions.count/2-1;i++)if(!hidden.has(i)){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}mesh.geometry.setIndex(indices);}
  }
}

function createBuildingMeshes(terrain:TerrainSystem):THREE.Group {
  const group=new THREE.Group();group.name='buildings';group.userData.key=JSON.stringify(terrain.snapshot.buildingChanges);
  const plaster=[buildingMaterial(0xbab4a0,'plaster'),buildingMaterial(0xc6bd9f,'plaster'),buildingMaterial(0x90725d,'brick'),buildingMaterial(0xa7a393,'stone')];
  const wood=buildingMaterial(0x7b674e,'wood'),roofs=[0x535d61,0x856851,0x72685b,0x59615c].map(color=>buildingMaterial(color,'roof'));
  const shutters=[0x5a6357,0x536265,0x685b47,0x635f4d].map(color=>buildingMaterial(color,'wood'));
  terrain.buildings.forEach((b,id)=>{
    const root=new THREE.Group();root.userData.buildingId=id;const floor=terrain.baseHeightAt(b.x,b.z),style=buildingStyle(b);
    const parts=new Map<string,{material:THREE.Material;layer:number;geometries:THREE.BufferGeometry[]}>();
    for(const box of terrain.structure(id)){
      const material=box.role==='roof'?roofs[style.variant]:box.material==='timber'?(box.role==='trim'?shutters[style.variant]:wood):plaster[style.variant];
      const key=box.layer+':'+material.uuid;
      const row=parts.get(key)??{material,layer:box.layer,geometries:[]};
      const geometry=new THREE.BoxGeometry(box.rx*2,box.ry*2,box.rz*2);if(box.pitch)geometry.rotateX(box.pitch);geometry.translate(box.x,floor+box.y,box.z);row.geometries.push(geometry);parts.set(key,row);
    }
    for(const row of parts.values()){const geometry=mergeGeometries(row.geometries);row.geometries.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geometry,row.material);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.layer=row.layer;root.add(mesh);}
    group.add(root);
  });
  return group;
}
export function refreshBuildingMeshes(infrastructure:THREE.Group,terrain:TerrainSystem,cutaways:Map<number,number>):void {
  let group=infrastructure.getObjectByName('buildings') as THREE.Group|undefined;
  if(group?.userData.key!==JSON.stringify(terrain.snapshot.buildingChanges)){
    if(group){const materials=new Set<THREE.Material>();group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});materials.forEach(m=>m.dispose());infrastructure.remove(group);}
    group=createBuildingMeshes(terrain);infrastructure.add(group);
  }
  for(const building of group!.children){const level=cutaways.get(building.userData.buildingId);for(const mesh of building.children)mesh.visible=level===undefined||mesh.userData.layer<=level;}
}

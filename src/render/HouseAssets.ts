import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import houseUrl from '../assets/house.glb?url&inline';
import {buildingStyle} from '../terrain/BuildingGeometry';
import type {BuildingSite} from '../terrain/WorldFeatures';

export interface HouseAssets {roof:THREE.BufferGeometry;stone:THREE.BufferGeometry}
export async function parseHouseAssets(buffer:ArrayBuffer):Promise<HouseAssets>{
  const gltf=await new GLTFLoader().parseAsync(buffer,''),parts=new Map<string,THREE.BufferGeometry>();
  if(gltf.userData.version!==1||gltf.userData.source!=='source/small-one-floor-house.obj')throw Error('Incompatible house asset.');
  gltf.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const g=o.geometry.clone();g.computeBoundingBox();g.computeBoundingSphere();parts.set(o.name,g);o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});
  const take=(name:string)=>{const g=parts.get(name);if(!g)throw Error(`House asset missing ${name}`);return g;};
  return {roof:take('houseRoof'),stone:take('houseStone')};
}
let pending:Promise<HouseAssets>|undefined;
export function loadHouseAssets():Promise<HouseAssets>{return pending??=fetch(houseUrl).then(r=>{if(!r.ok)throw Error(`House asset: ${r.status}`);return r.arrayBuffer();}).then(parseHouseAssets);}

/** Per-building owned clone. Tile relief sits just outside the shared roof box;
 * the box still supplies the complete roof, shadow interior and protection. */
export function houseRoofGeometry(asset:HouseAssets,b:BuildingSite,floor:number):THREE.BufferGeometry{
  const g=asset.roof.clone(),p=g.getAttribute('position'),half=(b.depth+.8)/2,pitch=buildingStyle(b).pitch;
  for(let i=0;i<p.count;i++){
    const z=p.getZ(i)*half;
    p.setXYZ(i,b.x+p.getX(i)*(b.width+.8)/2,floor+b.height+.14+(half-Math.abs(z))*Math.tan(pitch)+.11/Math.cos(pitch)+p.getY(i),b.z+z);
  }
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}

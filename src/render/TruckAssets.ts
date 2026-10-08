import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import truckUrl from '../assets/truck.glb?url&inline';

export interface TruckAssets {
  body:THREE.BufferGeometry;
  wheels:{geometry:THREE.BufferGeometry;pivot:THREE.Vector3}[];
  wheelRadius:number;
}
/** Cached immutable prepared geometry. No simulation or inventory ownership. */
export async function parseTruckAssets(buffer:ArrayBuffer):Promise<TruckAssets>{
  const gltf=await new GLTFLoader().parseAsync(buffer,''),data=gltf.userData;
  if(data.version!==1||data.forward!=='+Z'||!Number.isFinite(data.wheelRadius)||data.wheelRadius<=0)throw Error('Incompatible truck asset.');
  const parts=new Map<string,{geometry:THREE.BufferGeometry;pivot:THREE.Vector3}>();
  gltf.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const geometry=o.geometry.clone();geometry.computeBoundingBox();geometry.computeBoundingSphere();parts.set(o.name,{geometry,pivot:o.position.clone()});o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});
  const take=(name:string)=>{const p=parts.get(name);if(!p)throw Error(`Truck asset missing ${name}.`);return p;};
  return {body:take('truckBody').geometry,wheels:Array.from({length:6},(_,i)=>take(`truckWheel${i}`)),wheelRadius:data.wheelRadius};
}
let pending:Promise<TruckAssets>|undefined;
export function loadTruckAssets():Promise<TruckAssets>{return pending??=fetch(truckUrl).then(r=>{if(!r.ok)throw Error(`Truck asset: ${r.status}`);return r.arrayBuffer();}).then(parseTruckAssets);}

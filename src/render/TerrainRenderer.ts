import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HALF } from '../core/types';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import { createGroundGeometry, groundMaterial } from './GroundGeometry';
import { createInfrastructure, createVegetation,refreshRoadCuts,refreshVegetationClearance,refreshBuildingMeshes } from './Scenery';
import type {GroundRequest,GroundResponse} from './GroundWorker';
import {excavationBoundsKey} from '../core/TrenchGeometry';

interface Chunk { cx:number; cz:number; mesh:THREE.Mesh; detail:boolean; revision:number; modified:boolean; vegetation?:THREE.Group; key?:string;candidateKey?:string;candidateRevision?:number;candidateDetail?:boolean }

export class TerrainRenderer {
  readonly group = new THREE.Group();
  private chunks: Chunk[] = [];
  private material = groundMaterial();
  private infrastructure?: THREE.Group;
  private seed = -1;
  private readonly worker=new Worker(new URL('./GroundWorker.ts',import.meta.url),{type:'module'});
  private job?:{id:number;chunk:Chunk;detail:boolean;key:string};
  private nextId=1;
  private lastRequest=0;
  private lastVegetation=0;
  private generation=0;
  private failed=false;
  chunkDebugVisible = false;
  constructor(private readonly terrain: TerrainSystem) {
    this.worker.onmessage=({data:r}:MessageEvent<GroundResponse>)=>{
      const job=this.job;if(!job||job.id!==r.id)return;this.job=undefined;
      if(!this.chunks.includes(job.chunk))return;
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(r.position,3));geometry.setAttribute('normal',new THREE.BufferAttribute(r.normal,3));geometry.setAttribute('color',new THREE.BufferAttribute(r.color,3));geometry.setIndex(new THREE.BufferAttribute(r.index,1));geometry.computeBoundingSphere();
      job.chunk.mesh.geometry.dispose();job.chunk.mesh.geometry=geometry;job.chunk.detail=job.detail;job.chunk.key=job.key;
      if(this.infrastructure)refreshRoadCuts(this.infrastructure,this.terrain,job.chunk.cx*500-4000,job.chunk.cz*500-4000);
      if(job.chunk.vegetation)refreshVegetationClearance(job.chunk.vegetation,this.terrain);
    };
    this.worker.onerror=()=>{this.job=undefined;this.failed=true;console.error('Terrain worker unavailable; retaining the last rendered terrain. Reload to retry.');};
    this.reset();
  }
  reset(): void {
    for (const chunk of this.chunks) {chunk.mesh.geometry.dispose(); if (chunk.vegetation) this.disposeInstances(chunk.vegetation);}
    if (this.infrastructure) {const materials=new Set<THREE.Material>();this.infrastructure.traverse(o => {if (o instanceof THREE.Mesh) {o.geometry.dispose();for(const material of Array.isArray(o.material)?o.material:[o.material])materials.add(material);}});materials.forEach(m=>m.dispose());}
    this.group.clear(); this.chunks=[];this.seed=this.terrain.seed;this.generation++;
    for (let cz=0;cz<16;cz++) for (let cx=0;cx<16;cx++) {
      const mesh=new THREE.Mesh(createGroundGeometry(this.terrain,cx*CHUNK_SIZE-WORLD_HALF,cz*CHUNK_SIZE-WORLD_HALF,8,false),this.material);
      mesh.receiveShadow=true;
      const chunk:Chunk={cx,cz,mesh,detail:false,revision:this.terrain.revision,modified:this.terrain.intersectsModification(cx*500-4000,cx*500-3500,cz*500-4000,cz*500-3500)};
      if(!chunk.modified)chunk.key=this.chunkKey(chunk,false);
      this.group.add(mesh);this.chunks.push(chunk);
    }
    this.infrastructure=createInfrastructure(this.terrain);this.group.add(this.infrastructure);
  }
  update(cameraX:number,cameraZ:number):void {
    if(this.seed!==this.terrain.seed) this.reset();
    this.terrain.syncModifications();
    const sorted=this.chunks.map(chunk=>({chunk,d:Math.hypot(chunk.cx*500-3750-cameraX,chunk.cz*500-3750-cameraZ)})).sort((a,b)=>a.d-b.d);
    const now=performance.now();let budget=now-this.lastVegetation>80?1:0;
    for(const {chunk,d} of sorted) {
      const detail=d<1100;
      const modified=this.terrain.intersectsModification(chunk.cx*500-4000,chunk.cx*500-3500,chunk.cz*500-4000,chunk.cz*500-3500);
      if(!modified&&!chunk.modified)chunk.revision=this.terrain.revision;
      if(chunk.candidateRevision!==this.terrain.revision||chunk.candidateDetail!==detail){chunk.candidateKey=this.chunkKey(chunk,detail);chunk.candidateRevision=this.terrain.revision;chunk.candidateDetail=detail;}
      const key=chunk.candidateKey!;
      if(key!==chunk.key&&!this.job&&!this.failed&&now-this.lastRequest>80) {
        const id=this.nextId++;this.job={id,chunk,detail,key};this.lastRequest=now;
        const request:GroundRequest={id,x:chunk.cx*500-4000,z:chunk.cz*500-4000,divisions:detail?32:8,world:this.terrain.snapshot};
        this.worker.postMessage(request);
      }
      if(d<1600 && !chunk.vegetation && budget>0) {
        chunk.vegetation=createVegetation(this.terrain,chunk.cx*500-4000,chunk.cz*500-4000);
        this.group.add(chunk.vegetation);budget--;this.lastVegetation=now;
      } else if(d>2100 && chunk.vegetation) {
        this.group.remove(chunk.vegetation);this.disposeInstances(chunk.vegetation);chunk.vegetation=undefined;
      }
    }
  }
  /** Only nearby construction invalidates a mesh, at the same .5 m steps as its physical floor. */
  private chunkKey(chunk:Chunk,detail:boolean):string {
    const x=chunk.cx*500-4000,z=chunk.cz*500-4000;
    const world=this.terrain.snapshot;
    const parts=[`${world.seed}:${this.terrain.epoch}:${this.generation}:${detail}`];
    for(const t of world.trenches){const key=excavationBoundsKey(t,x,z);if(key)parts.push(key);}
    for(const c of world.craters)if(c.x+c.radius*1.3>=x&&c.x-c.radius*1.3<=x+500&&c.z+c.radius*1.3>=z&&c.z-c.radius*1.3<=z+500)parts.push(`${c.id}:${c.x}:${c.z}:${c.radius}:${c.depth}`);
    return parts.join('|');
  }
  setChunkDebug(visible:boolean):void {this.chunkDebugVisible=visible;this.material.wireframe=visible;}
  showInteriors(cutaways:Map<number,number>):void{if(this.infrastructure)refreshBuildingMeshes(this.infrastructure,this.terrain,cutaways);}
  get visibleChunkCount():number {return this.chunks.filter(c=>c.detail).length;}
  private disposeInstances(group:THREE.Group):void {group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});}
}

import * as THREE from 'three';
import { CHUNK_SIZE } from '../core/types';
import {WORLD_CHUNKS,chunkOrigin,intersectsCrossing} from '../terrain/WorldLayout';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import { createGroundGeometry, groundMaterial } from './GroundGeometry';
import { createInfrastructure, createVegetation,refreshRoadCuts,refreshVegetationClearance,refreshBuildingMeshes } from './Scenery';
import type {GroundRequest,GroundResponse} from './GroundWorker';
import {excavationBoundsKey} from '../core/TrenchGeometry';
import {VISUAL_QUALITY,type VisualQuality} from './VisualQuality';
import {setVegetationDetail} from './Vegetation';
import {GroundDressing} from './GroundDressing';

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
  private quality:VisualQuality='balanced';
  private coarseGenerationMs=0;
  private workerGenerationMs=0;
  private workerJobs=0;
  private dressing:GroundDressing;
  chunkDebugVisible = false;
  constructor(private readonly terrain: TerrainSystem) {
    this.dressing=new GroundDressing(terrain);
    this.worker.onmessage=({data:r}:MessageEvent<GroundResponse>)=>{
      const job=this.job;if(!job||job.id!==r.id)return;this.job=undefined;
      if(!this.chunks.includes(job.chunk))return;
      this.workerGenerationMs+=r.generationMs;this.workerJobs++;
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(r.position,3));geometry.setAttribute('normal',new THREE.BufferAttribute(r.normal,3));geometry.setAttribute('color',new THREE.BufferAttribute(r.color,3));geometry.setAttribute('groundCover',new THREE.BufferAttribute(r.groundCover,3));geometry.setIndex(new THREE.BufferAttribute(r.index,1));geometry.computeBoundingSphere();
      job.chunk.mesh.geometry.dispose();job.chunk.mesh.geometry=geometry;job.chunk.detail=job.detail;job.chunk.key=job.key;
      if(this.infrastructure)refreshRoadCuts(this.infrastructure,this.terrain,chunkOrigin(job.chunk.cx),chunkOrigin(job.chunk.cz));
      if(job.chunk.vegetation)refreshVegetationClearance(job.chunk.vegetation,this.terrain);
    };
    this.worker.onerror=()=>{this.job=undefined;this.failed=true;console.error('Terrain worker unavailable; retaining the last rendered terrain. Reload to retry.');};
    this.reset();
  }
  reset(): void {
    // Detach the previous generation before new work is queued. Late responses cannot claim a new chunk.
    this.job=undefined;
    for (const chunk of this.chunks) {chunk.mesh.geometry.dispose(); if (chunk.vegetation) this.disposeInstances(chunk.vegetation);}
    if (this.infrastructure) {const materials=new Set<THREE.Material>();this.infrastructure.traverse(o => {if (o instanceof THREE.Mesh) {o.geometry.dispose();for(const material of Array.isArray(o.material)?o.material:[o.material])materials.add(material);}});materials.forEach(m=>m.dispose());}
    this.dressing.reset();this.group.clear();this.group.add(this.dressing.group); this.chunks=[];this.seed=this.terrain.seed;this.generation++;
    const begin=performance.now();this.workerGenerationMs=0;this.workerJobs=0;
    for (const {cx,cz,x,z} of WORLD_CHUNKS) {
      const mesh=new THREE.Mesh(createGroundGeometry(this.terrain,x,z,8,false),this.material);
      mesh.receiveShadow=true;
      const chunk:Chunk={cx,cz,mesh,detail:false,revision:this.terrain.revision,modified:this.terrain.intersectsModification(x,x+CHUNK_SIZE,z,z+CHUNK_SIZE)};
      if(!chunk.modified&&!intersectsCrossing(x,x+CHUNK_SIZE,z,z+CHUNK_SIZE))chunk.key=this.chunkKey(chunk,false);
      this.group.add(mesh);this.chunks.push(chunk);
    }
    this.coarseGenerationMs=performance.now()-begin;
    this.infrastructure=createInfrastructure(this.terrain);this.group.add(this.infrastructure);
  }
  update(cameraX:number,cameraZ:number,zoom=0):void {
    if(this.seed!==this.terrain.seed) this.reset();
    this.terrain.syncModifications();
    const sorted=this.chunks.map(chunk=>({chunk,d:Math.hypot(chunkOrigin(chunk.cx)+CHUNK_SIZE/2-cameraX,chunkOrigin(chunk.cz)+CHUNK_SIZE/2-cameraZ)})).sort((a,b)=>a.d-b.d);
    const now=performance.now();let budget=now-this.lastVegetation>80?1:0;
    this.dressing.update(cameraX,cameraZ,zoom,now);
    for(const {chunk,d} of sorted) {
      const detail=d<1100;
      const x=chunkOrigin(chunk.cx),z=chunkOrigin(chunk.cz);
      const modified=this.terrain.intersectsModification(x,x+CHUNK_SIZE,z,z+CHUNK_SIZE);
      if(!modified&&!chunk.modified)chunk.revision=this.terrain.revision;
      if(chunk.candidateRevision!==this.terrain.revision||chunk.candidateDetail!==detail){chunk.candidateKey=this.chunkKey(chunk,detail);chunk.candidateRevision=this.terrain.revision;chunk.candidateDetail=detail;}
      const key=chunk.candidateKey!;
      if(key!==chunk.key&&!this.job&&!this.failed&&now-this.lastRequest>80) {
        const id=this.nextId++;this.job={id,chunk,detail,key};this.lastRequest=now;
        const request:GroundRequest={id,x,z,divisions:detail?32:8,world:this.terrain.snapshot};
        this.worker.postMessage(request);
      }
      if(d<1600 && !chunk.vegetation && budget>0) {
        chunk.vegetation=createVegetation(this.terrain,x,z);
        this.group.add(chunk.vegetation);budget--;this.lastVegetation=now;
      } else if(d>2100 && chunk.vegetation) {
        this.group.remove(chunk.vegetation);this.disposeInstances(chunk.vegetation);chunk.vegetation=undefined;
      }
      if(chunk.vegetation)setVegetationDetail(chunk.vegetation,Math.hypot(d,zoom*.75),VISUAL_QUALITY[this.quality].foliageDetail);
    }
  }
  /** Only nearby construction invalidates a mesh, at the same .5 m steps as its physical floor. */
  private chunkKey(chunk:Chunk,detail:boolean):string {
    const x=chunkOrigin(chunk.cx),z=chunkOrigin(chunk.cz);
    const world=this.terrain.snapshot;
    const parts=[`${world.seed}:${this.terrain.epoch}:${this.generation}:${detail}`];
    for(const t of world.trenches){const key=excavationBoundsKey(t,x,z);if(key)parts.push(key);}
    for(const c of world.craters)if(c.x+c.radius*1.3>=x&&c.x-c.radius*1.3<=x+CHUNK_SIZE&&c.z+c.radius*1.3>=z&&c.z-c.radius*1.3<=z+CHUNK_SIZE)parts.push(`${c.id}:${c.x}:${c.z}:${c.radius}:${c.depth}`);
    return parts.join('|');
  }
  setChunkDebug(visible:boolean):void {this.chunkDebugVisible=visible;this.material.wireframe=visible;}
  setQuality(quality:VisualQuality):void{this.quality=quality;this.material.userData.detail.value=VISUAL_QUALITY[quality].groundDetail;this.dressing.setQuality(quality);}
  showInteriors(cutaways:Map<number,number>):void{if(this.infrastructure)refreshBuildingMeshes(this.infrastructure,this.terrain,cutaways);}
  get visibleChunkCount():number {return this.chunks.filter(c=>c.detail).length;}
  stats(camera:THREE.Camera){
    const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    return {generatedChunks:this.chunks.length,detailedChunks:this.visibleChunkCount,visibleChunks:this.chunks.filter(c=>frustum.intersectsObject(c.mesh)).length,coarseGenerationMs:this.coarseGenerationMs,workerGenerationMs:this.workerGenerationMs,workerJobs:this.workerJobs};
  }
  /** Resident uncleared trees; separate from actual camera-frustum count. */
  get residentTreeCount():number {return this.chunks.reduce((n,c)=>n+(c.vegetation?c.vegetation.userData.trees.length-c.vegetation.userData.cleared.size:0),0);}
  visibleTrees(camera:THREE.Camera):number{
    const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)),sphere=new THREE.Sphere();let count=0;
    for(const c of this.chunks)if(c.vegetation)for(const [i,t] of (c.vegetation.userData.trees as {x:number;z:number;size:number}[]).entries()){
      if(c.vegetation.userData.cleared.has(i))continue;sphere.center.set(t.x,this.terrain.heightAt(t.x,t.z)+t.size*1.9,t.z);sphere.radius=t.size*1.3;if(frustum.intersectsSphere(sphere))count++;
    }return count;
  }
  private disposeInstances(group:THREE.Group):void {group.traverse(o=>{if(o instanceof THREE.InstancedMesh){o.dispose();if(o.userData.disposableMaterial)(o.material as THREE.Material).dispose();}});}
}

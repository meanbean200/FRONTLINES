import { type BattlefieldState, type CoverType, type TrenchState, type Vec2, WORLD_HALF, clamp, distance, distanceToSegment } from '../core/types';
import { smoothNoise } from '../core/random';
import { buildingsForSeed, SETTLEMENTS, type BuildingSite } from './WorldFeatures';
import {excavatedPoints,excavatedSpan,excavationKey} from '../core/TrenchGeometry';
import {routeMetrics} from '../core/Polyline';
import {WorldOcclusion} from './WorldOcclusion';
import {structureBoxes,buildingContains,type BuildingCondition,type StructureBox} from './BuildingGeometry';
import {emplacementBoxes} from './SupportGeometry';
import {roadDistance,riverCenter,riverWidth,ROADS} from './WorldLayout';

export type GroundType = 'field' | 'forest' | 'road' | 'river' | 'settlement';
export interface ModificationBounds { minX: number; maxX: number; minZ: number; maxZ: number }
interface ExcavationSegment { a: Vec2; b: Vec2; width: number; depth: number; trenchId: number; length: number; along: number; rampOrigin?: number }

function cutDepth(segment:ExcavationSegment,hit:ReturnType<typeof distanceToSegment>):number {
  const half=segment.width/2;
  const ramp=segment.rampOrigin===undefined?1:clamp(Math.abs(segment.along+hit.t*segment.length-segment.rampOrigin)/4,0,1);
  return segment.depth*(1-smoothStep(half*.52,half,hit.distance))*ramp;
}

/** This sampled surface is shared by picking, rendering, cover and movement. */
export class TerrainSystem {
  readonly objects=new WorldOcclusion(this);
  private segments: ExcavationSegment[] = [];
  private buckets = new Map<string, ExcavationSegment[]>();
  private bounds: ModificationBounds[] = [];
  private signature = '';
  private readonly routeIds=new WeakMap<Vec2[],number>();
  private nextRouteId=1;
  revision = 0;
  epoch=0;
  buildings: BuildingSite[];
  private structureCache=new Map<number,{condition:BuildingCondition;site:BuildingSite;boxes:StructureBox[]}>();
  private buildingIndex?:BuildingSite[];
  private buildingBuckets=new Map<string,number[]>();
  private baseTiles=new Map<string,Float64Array>();
  private baseTileKeys:string[]=[];
  private baseTileCursor=0;
  private protectionRevision=-1;
  private protection:ReturnType<typeof emplacementBoxes>=[];
  supportProtection(){if(this.protectionRevision!==this.revision){this.protectionRevision=this.revision;this.protection=this.state.living?.facilities.flatMap(f=>emplacementBoxes(f).map(b=>({...b,y:b.y+this.heightAt(f.x,f.z)})))??[];}return this.protection;}
  buildingCondition(id:number):BuildingCondition{return this.state.buildingChanges?.find(b=>b.id===id)?.condition??'intact';}
  structure(id:number):StructureBox[]{const condition=this.buildingCondition(id),site=this.buildings[id],old=this.structureCache.get(id);if(old?.condition===condition&&old.site===site)return old.boxes;const boxes=structureBoxes(site,condition);this.structureCache.set(id,{condition,site,boxes});return boxes;}
  buildingAt(p:Vec2):number|undefined{
    if(this.buildingIndex!==this.buildings){this.buildingIndex=this.buildings;this.buildingBuckets.clear();this.buildings.forEach((b,id)=>{for(let x=Math.floor((b.x-b.width/2)/32);x<=Math.floor((b.x+b.width/2)/32);x++)for(let z=Math.floor((b.z-b.depth/2)/32);z<=Math.floor((b.z+b.depth/2)/32);z++){const key=x+','+z,row=this.buildingBuckets.get(key)??[];row.push(id);this.buildingBuckets.set(key,row);}});}
    return this.buildingBuckets.get(Math.floor(p.x/32)+','+Math.floor(p.z/32))?.find(i=>buildingContains(this.buildings[i],p));
  }
  constructor(private state: BattlefieldState) {
    this.buildings = buildingsForSeed(state.seed);
    this.syncModifications();
  }
  get seed(): number { return this.state.seed; }
  get snapshot():Pick<BattlefieldState,'seed'|'trenches'|'craters'|'buildingChanges'> {return {seed:this.seed,trenches:this.state.trenches,craters:this.state.craters,buildingChanges:this.state.buildingChanges};}
  setState(state: BattlefieldState): void {
    this.epoch++;
    this.state = state;
    this.objects.reset();
    this.baseTiles.clear();this.baseTileKeys=[];this.baseTileCursor=0;
    this.structureCache.clear();
    this.buildings = buildingsForSeed(state.seed);
    this.signature = '';
    this.syncModifications();
  }
  syncModifications(): void {
    const signature = `${this.state.seed}|${this.state.trenches.map(t => {let routeId=this.routeIds.get(t.points);if(!routeId){routeId=this.nextRouteId++;this.routeIds.set(t.points,routeId);}return `${t.id}:${excavationKey(t,.5)}:${t.width}:${t.depth}:${routeId}`;}).join('|')}|${JSON.stringify(this.state.craters)}|${JSON.stringify(this.state.buildingChanges)}`;
    const withSupport=signature+'|'+this.state.living?.facilities.filter(f=>f.kind==='emplacement'&&f.progress===1).map(f=>`${f.id}:${f.facing}`).join(',');
    if (withSupport === this.signature) return;
    this.signature = withSupport;
    this.revision++;
    this.segments = [];
    this.buckets.clear();
    this.bounds = this.state.craters.map(c => ({ minX: c.x - c.radius * 1.3, maxX: c.x + c.radius * 1.3, minZ: c.z - c.radius * 1.3, maxZ: c.z + c.radius * 1.3 }));
    for (const trench of this.state.trenches) {
      const built=excavatedPoints(trench,.5),fullLength=routeMetrics(trench.points).length,origin=trench.excavation?.origin??0;
      // Only a fixed end entrance slopes into the floor. A middle-out job opens
      // a pit; its growing work faces are never entrances or migrating ramps.
      const rampOrigin=origin<.001||fullLength-origin<.001?origin:undefined;
      let along=excavatedSpan(trench,.5).start;
      for (let i = 1; i < built.length; i++) {
        const a = built[i - 1];
        const length = distance(a, built[i]);
        if (length < 0.001) continue;
        const b = built[i];
        const segment = { a, b, width: trench.width, depth: trench.depth, trenchId: trench.id, length, along, rampOrigin };
        along+=length;
        this.segments.push(segment);
        const padding = trench.width * 1.6 + 3;
        const bounds = { minX: Math.min(a.x, b.x) - padding, maxX: Math.max(a.x, b.x) + padding, minZ: Math.min(a.z, b.z) - padding, maxZ: Math.max(a.z, b.z) + padding };
        this.bounds.push(bounds);
        for (let bx = Math.floor(bounds.minX / 32); bx <= Math.floor(bounds.maxX / 32); bx++) {
          for (let bz = Math.floor(bounds.minZ / 32); bz <= Math.floor(bounds.maxZ / 32); bz++) {
            const key = `${bx},${bz}`;
            const list = this.buckets.get(key) ?? [];
            list.push(segment);
            this.buckets.set(key, list);
          }
        }
      }
    }
  }
  modificationSignature(): string { return String(this.revision); }
  intersectsModification(minX: number, maxX: number, minZ: number, maxZ: number): boolean {
    return this.bounds.some(b => b.maxX >= minX && b.minX <= maxX && b.maxZ >= minZ && b.minZ <= maxZ);
  }
  baseHeightAt(x: number, z: number): number {
    // One shared metre-resolution base surface for rendering, navigation and
    // ballistic queries. Earthwork deformation remains continuous and exact.
    // Cache tiles, not individual rays through the same static hillside.
    const bx=Math.floor(x/32),bz=Math.floor(z/32),key=bx+','+bz;
    let tile=this.baseTiles.get(key);
    if(!tile){tile=new Float64Array(33*33);for(let iz=0;iz<=32;iz++)for(let ix=0;ix<=32;ix++)tile[iz*33+ix]=this.rawBaseHeightAt(bx*32+ix,bz*32+iz);if(this.baseTileKeys.length<4096)this.baseTileKeys.push(key);else{this.baseTiles.delete(this.baseTileKeys[this.baseTileCursor]);this.baseTileKeys[this.baseTileCursor]=key;this.baseTileCursor=(this.baseTileCursor+1)%4096;}this.baseTiles.set(key,tile);}
    const px=x-bx*32,pz=z-bz*32,ix=Math.floor(px),iz=Math.floor(pz),fx=px-ix,fz=pz-iz,i=iz*33+ix;
    const a=tile[i]+(tile[i+1]-tile[i])*fx,b=tile[i+33]+(tile[i+34]-tile[i+33])*fx;return a+(b-a)*fz;
  }
  private rawBaseHeightAt(x:number,z:number):number {
    const seed = this.state.seed;
    const broad = (smoothNoise((x + 12000) / 1600, (z - 4000) / 1600, seed) - 0.5) * 100; // Noise phase, not world bounds.
    const rolling = (smoothNoise(x / 420, z / 420, seed + 31) - 0.5) * 48;
    const detail = (smoothNoise(x / 110, z / 110, seed + 83) - 0.5) * 3;
    const ridgeAxis = z - (Math.sin(x / 920) * 430 + 520);
    const ridge = Math.exp(-ridgeAxis * ridgeAxis / 260000) * 85;
    const riverDistance = Math.abs(z - this.riverCenter(x));
    const valley = -Math.exp(-riverDistance * riverDistance / 80000) * 28;
    // Shared earth causeways: the road raises the channel, with sloped verges.
    // This is physical terrain used by bullets, feet and vehicles, not a fake bridge.
    const crossing=riverDistance<this.riverWidth(x)*1.25?smoothStep(4,12,roadDistance(x,z)):1;
    const channel = -5.5 * (1 - smoothStep(this.riverWidth(x) * 0.7, this.riverWidth(x) * 1.25, riverDistance))*crossing;
    return broad + rolling + detail + ridge + valley + channel;
  }
  deformationAt(x: number, z: number): number {
    let excavation = 0;
    let spoil = 0;
    for (const segment of this.buckets.get(`${Math.floor(x / 32)},${Math.floor(z / 32)}`) ?? []) {
      const hit = distanceToSegment({ x, z }, segment.a, segment.b);
      const half = segment.width / 2;
      if (hit.distance < half) {
        excavation = Math.min(excavation, -cutDepth(segment,hit));
      } else if (hit.distance < half + 3) {
        spoil = Math.max(spoil, 0.5 * Math.sin((hit.distance - half) / 3 * Math.PI));
      }
    }
    for (const crater of this.state.craters) {
      const t = Math.hypot(x - crater.x, z - crater.z) / crater.radius;
      if (t < 1) excavation = Math.min(excavation, -crater.depth * Math.pow(1 - t * t, 1.6));
      if (t > 0.82 && t < 1.3) spoil = Math.max(spoil, crater.depth * 0.18 * Math.sin((t - 0.82) / 0.48 * Math.PI));
    }
    return excavation < -0.05 ? excavation : spoil;
  }
  heightAt(x: number, z: number): number {const id=this.buildingAt({x,z}),b=id===undefined?undefined:this.buildings[id];return b?this.baseHeightAt(b.x,b.z):this.baseHeightAt(x,z)+this.deformationAt(x,z);}
  groundTypeAt(x: number, z: number): GroundType {
    if (this.distanceToRoad(x, z) < 4) return 'road';
    if (Math.abs(z - this.riverCenter(x)) < this.riverWidth(x)) return 'river';
    if (this.isSettlement(x, z)) return 'settlement';
    return this.forestValueAt(x, z) > 0.57 ? 'forest' : 'field';
  }
  forestValueAt(x: number, z: number): number {
    return smoothNoise((x + 2300) / 230, (z - 1200) / 230, this.state.seed + 411) * 0.72 + smoothNoise((x - 900) / 1100, (z + 400) / 1100, this.state.seed + 99) * 0.28;
  }
  coverAt(x: number, z: number): CoverType {
    const nearby=this.buckets.get(`${Math.floor(x / 32)},${Math.floor(z / 32)}`)??[];
    if(nearby.some(s=>cutDepth(s,distanceToSegment({x,z},s.a,s.b))>.7))return 'trench';
    if (this.deformationAt(x, z) < -0.7) {
      return 'low-ground';
    }
    return this.groundTypeAt(x, z) === 'forest' ? 'forest' : 'open';
  }
  slopeAt(x: number, z: number): number {
    return Math.hypot(this.baseHeightAt(x + 4, z) - this.baseHeightAt(x - 4, z), this.baseHeightAt(x, z + 4) - this.baseHeightAt(x, z - 4)) / 8;
  }
  obstacleAt(x: number, z: number, clearance = 1): boolean {
    return this.buildings.some(b => Math.abs(x - b.x) < b.width / 2 + clearance && Math.abs(z - b.z) < b.depth / 2 + clearance);
  }
  navigationCostAt(x: number, z: number): number {
    if (this.obstacleAt(x, z, 3)) return 1000;
    const ground = this.groundTypeAt(x, z);
    return (ground === 'river' ? 20 : ground === 'forest' ? 1.6 : ground === 'road' ? 0.8 : 1) + this.slopeAt(x, z) * 5 + Math.abs(this.deformationAt(x, z)) * 0.3;
  }
  riverCenter(x: number): number { return riverCenter(x); }
  riverWidth(x: number): number { return riverWidth(x); }
  roadCenterZ(x: number): number { return ROADS[1].center(x); }
  distanceToRoad(x: number, z: number): number {
    return roadDistance(x,z);
  }
  isSettlement(x: number, z: number): boolean { return SETTLEMENTS.some(s => Math.hypot(x - s.x, z - s.z) < s.r); }
  isPointInConstructedTrench(point: Vec2, trench: TrenchState, maxDistance: number): boolean {
    return this.segments.some(s => s.trenchId === trench.id && distanceToSegment(point, s.a, s.b).distance <= maxDistance);
  }
  clampToWorld(point: Vec2): Vec2 { return { x: clamp(point.x, -WORLD_HALF + 10, WORLD_HALF - 10), z: clamp(point.z, -WORLD_HALF + 10, WORLD_HALF - 10) }; }
}
export function smoothStep(min: number, max: number, value: number): number {
  const t = clamp((value - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

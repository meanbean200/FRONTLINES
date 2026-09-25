import {describe,it,expect,vi,afterEach} from 'vitest';
import * as THREE from 'three';
import {WORLD_SIZE,WORLD_HALF,WORLD_VERSION,CHUNK_SIZE,CHUNKS_PER_AXIS,distance} from '../core/types';
import {WORLD_CHUNKS,ROADS,pointOnRoad,roadRoute,nearestRoad,convoyEntry,rearDepot,mapProject,mapUnproject,mapCenter,insideWorld} from './WorldLayout';
import {SETTLEMENTS} from './WorldFeatures';
import {TerrainSystem} from './TerrainSystem';
import {TerrainRenderer} from '../render/TerrainRenderer';
import {createBattlefield,createPlayableSandbox,addSquad} from '../simulation/createBattlefield';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {SquadNavigation} from '../navigation/SquadNavigation';
import {SaveSystem,SAVE_KEY} from '../persistence/SaveSystem';
import {balance} from '../garrison/Inventory';
afterEach(()=>vi.unstubAllGlobals());
describe('canonical 4 km world',()=>{
 it('generates exactly 8×8 real 500m meshes and requests only bounded worker chunks',()=>{
  expect([WORLD_SIZE,WORLD_HALF,CHUNK_SIZE,CHUNKS_PER_AXIS]).toEqual([4000,2000,500,8]);expect(WORLD_CHUNKS).toHaveLength(64);
  const requests:unknown[]=[];vi.stubGlobal('Worker',class{postMessage(r:unknown){requests.push(r);}});
  const t=new TerrainSystem(createBattlefield()),renderer=new TerrainRenderer(t);
  const meshes=renderer.group.children.filter(o=>o instanceof THREE.Mesh) as THREE.Mesh[];expect(meshes).toHaveLength(64);
  for(const mesh of meshes){mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox!;expect(b.max.x-b.min.x).toBe(500);expect(b.max.z-b.min.z).toBe(500);expect(insideWorld({x:b.min.x,z:b.min.z})).toBe(true);expect(insideWorld({x:b.max.x,z:b.max.z})).toBe(true);}
  renderer.update(1900,1900);expect(requests.length).toBeGreaterThan(0);for(const r of requests as {x:number;z:number}[])expect(insideWorld(r)).toBe(true);
  expect(t.objects.trees(-2500,0)).toEqual([]);expect(t.objects.trees(2000,0)).toEqual([]);
 },10000);
 it('distributes settlements, usable open/wooded land and roads across all quadrants',()=>{
  const t=new TerrainSystem(createBattlefield());expect(SETTLEMENTS.length).toBeGreaterThanOrEqual(8);expect(t.buildings.length).toBeGreaterThan(65);
  for(const x of [-1,1])for(const z of [-1,1])expect(SETTLEMENTS.some(p=>Math.sign(p.x)===x&&Math.sign(p.z)===z)).toBe(true);
  for(const b of t.buildings){expect(insideWorld(b,Math.max(b.width,b.depth))).toBe(true);expect(t.distanceToRoad(b.x,b.z)).toBeGreaterThan(Math.max(b.width,b.depth)/2+5);expect(t.groundTypeAt(b.x,b.z)).not.toBe('river');}
  const kinds=new Set<string>();for(let z=-1900;z<=1900;z+=100)for(let x=-1900;x<=1900;x+=100)kinds.add(t.groundTypeAt(x,z));expect(kinds).toEqual(new Set(['field','forest','road','river','settlement']));
 });
 it('routes physical vehicles between every road, including passable earth crossings',()=>{
  const t=new TerrainSystem(createBattlefield());
  for(const road of ROADS)for(const end of [-1800,1800]){
   const target=pointOnRoad(road,end),route=roadRoute(rearDepot(),target);expect(route.length).toBeGreaterThan(0);expect(distance(route.at(-1)!,target)).toBeLessThan(.001);
   for(const p of route){expect(insideWorld(p)).toBe(true);expect(t.groundTypeAt(p.x,p.z)).toBe('road');expect(t.obstacleAt(p.x,p.z,1.6)).toBe(false);}
   for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i];expect(distance(a,b)).toBeLessThan(21);for(let n=0;n<=10;n++){const p={x:a.x+(b.x-a.x)*n/10,z:a.z+(b.z-a.z)*n/10};expect(t.groundTypeAt(p.x,p.z)).not.toBe('river');}}
  }
  for(const road of ROADS.filter(r=>r.axis==='z')){let z=-720;for(let i=0;i<20;i++)z=t.riverCenter(road.center(z));const p=pointOnRoad(road,z);expect(t.groundTypeAt(p.x,p.z)).toBe('road');expect(t.heightAt(p.x,p.z)-t.heightAt(p.x+25,t.riverCenter(p.x+25))).toBeGreaterThan(3);}
 });
 it('retains rear depth, mode variety, valid actors and genuine edge arrivals',()=>{
  for(const mode of ['campaign','advance','defense','sandbox'] as const){const s=mode==='sandbox'?createPlayableSandbox():createOperation(mode),sim=new BattlefieldSimulation(s);expect(s.worldVersion).toBe(WORLD_VERSION);expect(s.worldSize).toBe(WORLD_SIZE);expect(()=>new SaveSystem().parse(JSON.stringify(s))).not.toThrow();expect(s.soldiers.every(p=>insideWorld(p)&&!sim.terrain.obstacleAt(p.x,p.z,.1))).toBe(true);}
  const c=createOperation('campaign'),w=c.living!;expect(w.rear).toEqual(rearDepot(false,ROADS[2]));expect(w.enemySupply!.rear).toEqual(rearDepot(true,ROADS[2]));
  for(const t of w.trucks.filter(t=>t.role==='convoy'))expect(t).toMatchObject(convoyEntry(t.faction==='enemy',t.faction==='enemy'?w.enemySupply!.rear:w.rear));
  for(const g of w.garrisons){const rear=g.faction==='enemy'?w.enemySupply!.rear:w.rear;expect(distance(rear,g.forward)).toBeGreaterThan(1000);expect(distance(g.entrance,g.forward)).toBeLessThan(300);}
  const a=createOperation('advance').operation!.objectives[1],d=createOperation('defense').operation!.objectives[1];expect(distance(a,d)).toBeGreaterThan(2000);
 });
 it('conserves cargo and continues cross-map road shipments after save/load',()=>{
  const s=createOperation('campaign'),a=new BattlefieldSimulation(s);s.operation!.nextOrders=s.operation!.nextCombat=1e9;
  const g=s.living!.garrisons[0];g.forward=nearestRoad({x:1080,z:1000}).point;
  // A stocked network no longer requests arbitrary extra water. Create an
  // accounted real shortage for this cross-map delivery fixture.
  g.cache.water-=50;s.living!.rearStock.water+=50;
  for(let i=0;i<700;i++){s.elapsed+=.05;a.garrisons.logistics.step(.05);}
  expect(s.living!.trucks.some(t=>t.state==='outbound')).toBe(true);
  const b=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(s)));
  for(let i=0;i<10000;i++){s.elapsed+=.05;b.state.elapsed+=.05;a.garrisons.logistics.step(.05);b.garrisons.logistics.step(.05);}
  expect(b.state.living).toEqual(s.living);expect(g.forwardStock.water).toBeGreaterThan(0);for(const n of Object.values(balance(s)))expect(Math.abs(n)).toBeLessThan(1e-7);
 },20000);
 it('finds whole-map routes in both axes and obeys edge clearance',()=>{
  const nav=new SquadNavigation(new TerrainSystem(createBattlefield()));
  for(const [a,b] of [[{x:-1850,z:-1750},{x:1850,z:-1750}],[{x:1700,z:-1800},{x:1700,z:1800}],[{x:-1750,z:-1600},{x:1750,z:1600}]]){const route=nav.plan(a,b);expect(route.length).toBeGreaterThan(0);expect(route.every(p=>insideWorld(p,5))).toBe(true);expect(distance(route.at(-1)!,b)).toBeLessThan(70);expect(route.every((p,i)=>nav.segmentClear(i?route[i-1]:a,p,1))).toBe(true);}
  expect(insideWorld(nav.freeDestination({x:5000,z:-5000}),10)).toBe(true);
 },10000);
 it('physically walks an ordered soldier across both full-map axes without teleporting',()=>{
  // A navigation fixture, not a supply/needs soak: keep this walker rested and fed.
  for(const [from,to] of [[{x:-1850,z:-1750},{x:1850,z:-1750}],[{x:1700,z:-1800},{x:1700,z:1800}]]){
   const s=createBattlefield();s.soldiers=[];s.squads=[];s.trenches=[];s.craters=[];
   const q=addSquad(s,'rifle',1,from.x,from.z,'Route test'),sim=new BattlefieldSimulation(s),p=s.soldiers[0];sim.issueMove([q.id],to);
   let largestStep=0;for(let i=0;i<48000&&q.order.type==='move';i++){const prior={x:p.x,z:p.z};p.needs!.energy=100;p.needs!.hunger=p.needs!.thirst=10;sim.stepFixed();largestStep=Math.max(largestStep,distance(prior,p));}
   expect(distance(p,to)).toBeLessThan(12);expect(largestStep).toBeLessThan(.2);expect(insideWorld(p,5)).toBe(true);
  }
 },20000);
 it('maps both corners and interiors exactly, with clamped local sheets',()=>{
  const center={x:0,z:0};expect(mapProject({x:-2000,z:-2000},center)).toEqual({x:0,y:0});expect(mapProject({x:2000,z:2000},center)).toEqual({x:1,y:1});
  for(const span of [1800,2400,WORLD_SIZE])for(const vertical of [1,.625]){const c=mapCenter({x:1980,z:-1980},span,vertical);for(const point of [{x:0,z:0},{x:1200,z:-1550}]){const q=mapProject(point,c,span,vertical),p=mapUnproject(q.x,q.y,c,span,vertical);expect(p.x).toBeCloseTo(point.x);expect(p.z).toBeCloseTo(point.z);}expect(insideWorld(mapUnproject(0,0,c,span,vertical))).toBe(true);expect(insideWorld(mapUnproject(1,1,c,span,vertical))).toBe(true);}
 });
 it('rejects legacy worlds without modifying their storage or clamping a single coordinate',()=>{
  const original=createOperation('campaign');delete original.worldSize;delete original.worldVersion;original.soldiers[0].x=-3500;
  for(const version of [1,2,3]){const raw=JSON.stringify({...original,schemaVersion:version}),key=`frontlines-battlefield-v${version}`,storage=new Map([[key,raw]]);vi.stubGlobal('localStorage',{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)});const save=new SaveSystem();expect(save.legacyNotice()).toContain('8 km');expect(()=>save.load()).toThrow('original save is preserved');expect(storage.get(key)).toBe(raw);expect(storage.has(SAVE_KEY)).toBe(false);save.save(createOperation('campaign'));expect(storage.get(key)).toBe(raw);expect(save.load()!.worldSize).toBe(4000);}
  const bad=createOperation('campaign');bad.soldiers[0].x=2001;expect(()=>new SaveSystem().parse(JSON.stringify(bad))).toThrow();
 });
 it('retains trench/crater deformation on a 500m boundary through saving',()=>{
  const s=createPlayableSandbox(),a=new BattlefieldSimulation(s);const id=a.createTrench([{x:480,z:-1800},{x:540,z:-1800}])!,t=s.trenches.find(t=>t.id===id)!;t.progress=1;t.status='complete';a.createCrater({x:500,z:1750},12,3);a.terrain.syncModifications();
  const b=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(s)));for(const p of [{x:500,z:-1800},{x:500,z:1750}]){expect(a.terrain.deformationAt(p.x,p.z)).toBeLessThan(-1);expect(b.terrain.heightAt(p.x,p.z)).toBe(a.terrain.heightAt(p.x,p.z));}expect(b.state.trenches).toEqual(a.state.trenches);expect(b.state.craters).toEqual(a.state.craters);
 });
});

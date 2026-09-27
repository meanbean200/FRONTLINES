import {describe,it,expect,vi} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {LogisticsSystem} from './LogisticsSystem';
import {transfer,balance,total} from './Inventory';
import {roadRoute,ROADS,pointOnRoad} from '../terrain/WorldLayout';
import {SaveSystem} from '../persistence/SaveSystem';
import {crateAccess,crateVisible} from './SupplyAccess';
describe('bounded truck recovery and physical interception',()=>{
 it('breaks the reproduced mutual queue at a converging waypoint without teleporting cargo',()=>{
  const s=createOperation('campaign'),w=s.living!,terrain=new TerrainSystem(s),logistics=new LogisticsSystem(s,terrain),pair=w.trucks.filter(t=>t.faction!=='enemy'&&t.role==='shuttle').slice(0,2);
  vi.spyOn(terrain,'obstacleAt').mockReturnValue(false);vi.spyOn(terrain,'deformationAt').mockReturnValue(0);vi.spyOn(terrain,'groundTypeAt').mockReturnValue('road');
  for(const p of s.soldiers){p.x=-1800;p.z=1800;}for(const t of w.trucks){t.state='loading';t.timer=1e6;}
  for(const [i,t] of pair.entries()){Object.assign(t,{x:i?2:-2,z:0,state:'outbound',route:[{x:0,z:100}],routeIndex:0,destination:{x:0,z:100}});transfer(w.rearStock,t.cargo,'ammo',10);}
  // Both old ahead-of-me dot products are positive: neither used to move.
  expect((pair[1].x-pair[0].x)*(0-pair[0].x)).toBeGreaterThan(0);expect((pair[0].x-pair[1].x)*(0-pair[1].x)).toBeGreaterThan(0);
  for(let i=0;i<40;i++){s.elapsed+=.05;logistics.step(.05);}
  for(const t of pair){expect(t.z).toBeGreaterThan(12);expect(t.z).toBeLessThanOrEqual(24);expect(t.cargo.ammo).toBe(10);}
  expect(new SaveSystem().parse(JSON.stringify(s)).living!.trucks.filter(t=>pair.some(p=>p.id===t.id))).toEqual(pair);
  expect(Object.values(balance(s)).every(n=>Math.abs(n)<1e-6)).toBe(true);
 });
 it('finds a road alternative without crossing a closed section',()=>{
  const a=pointOnRoad(ROADS[2],-1700),b=pointOnRoad(ROADS[2],1700),clear=(p:{x:number;z:number},q:{x:number;z:number})=>!(Math.min(p.x,q.x)<0&&Math.max(p.x,q.x)>=0&&Math.abs(p.z)<100&&Math.abs(q.z)<100);
  const old=roadRoute(a,b),next=roadRoute(a,b,clear);expect(old.some((p,i)=>!clear(i?old[i-1]:a,p))).toBe(true);expect(next.length).toBeGreaterThan(old.length);expect(next.every((p,i)=>clear(i?next[i-1]:a,p))).toBe(true);
 });
 it.each(['player','enemy'] as const)('%s loses only the intercepted physical shipment; cannot remotely deliver or refill it',side=>{
  const s=createOperation('campaign'),w=s.living!,terrain=new TerrainSystem(s),logistics=new LogisticsSystem(s,terrain),t=w.trucks.find(t=>(t.faction??'player')===side&&t.role==='shuttle')!;
  vi.spyOn(terrain,'heightAt').mockReturnValue(0);vi.spyOn(terrain,'obstacleAt').mockReturnValue(false);vi.spyOn(terrain,'deformationAt').mockReturnValue(0);vi.spyOn(terrain,'groundTypeAt').mockReturnValue('road');vi.spyOn(terrain.objects,'trace').mockReturnValue({clear:true,transmission:1});
  for(const truck of w.trucks){truck.state='loading';truck.timer=1e6;}w.nextDelivery=1e6;w.enemySupply!.nextDelivery=1e6;
  const rear=side==='enemy'?w.enemySupply!.stock:w.rearStock;transfer(rear,t.cargo,'ammo',30);
  Object.assign(t,{...pointOnRoad(ROADS[2],0),state:'outbound',route:[pointOnRoad(ROADS[2],300)],routeIndex:0,destination:pointOnRoad(ROADS[2],300)});
  for(const p of s.soldiers){p.x=-1800;p.z=1800;}
  const enemies=s.soldiers.filter(p=>(s.squads.find(q=>q.id===p.squadId)?.faction??'player')!==side).slice(0,3);for(const p of enemies){p.x=t.x+8;p.z=t.z;p.suppression=0;}
  const weapons=enemies.map(p=>p.equipment!.weapon);for(const p of enemies)p.equipment!.weapon='unarmed';
  for(let i=0;i<20;i++){s.elapsed+=.05;logistics.step(.05);}expect(t.state).toBe('outbound');expect(t.interdictedSince).toBeUndefined();
  enemies.forEach((p,i)=>{p.equipment!.weapon=weapons[i];p.x=t.x+8;p.z=t.z;});
  const cargo={...t.cargo},rearBefore={...rear};
  for(let i=0;i<170;i++){s.elapsed+=.05;logistics.step(.05);}
  expect(t.abandoned).toBe(true);expect(t.state).toBe('blocked');expect(total(t.cargo)).toBe(0);expect(rear).toEqual(rearBefore);
  const c=w.crates.find(c=>c.id===t.salvageId)!;expect(c.stock).toEqual(cargo);expect(crateAccess(s,terrain,c,side==='player'?'enemy':'player')).toBe('');
  expect(new SaveSystem().parse(JSON.stringify(s)).living!.trucks.find(v=>v.id===t.id)).toEqual(t);
  const count=w.crates.length;for(let i=0;i<50;i++){s.elapsed+=.05;logistics.step(.05);}expect(w.crates.length).toBe(count);expect(c.stock).toEqual(cargo);expect(Object.values(balance(s)).every(n=>Math.abs(n)<1e-6)).toBe(true);
  for(const p of enemies){p.x=-1800;p.z=1800;}expect(crateVisible(s,terrain,c,side==='player'?'enemy':'player')).toBe(false);
 });
 it('empty failed routes never unload remotely and return trips preserve their identity',()=>{
  const s=createOperation('campaign'),w=s.living!,terrain=new TerrainSystem(s),logistics=new LogisticsSystem(s,terrain),t=w.trucks[0];
  for(const p of s.soldiers){p.x=0;p.z=1700;}for(const truck of w.trucks){truck.state='loading';truck.timer=1e6;}
  transfer(w.rearStock,t.cargo,'ammo',20);const before={...t.cargo};t.state='blocked';t.resume='returning';t.route=[];t.routeIndex=0;t.destination={x:1700,z:1700};
  vi.spyOn(terrain,'obstacleAt').mockReturnValue(true);
  for(let i=0;i<90;i++){s.elapsed+=.05;logistics.step(.05);}
  expect(t.state).toBe('blocked');expect(t.resume).toBe('returning');expect(t.cargo).toEqual(before);expect(t.reason).toContain('ROUTE BLOCKED');expect(t.nextRepath).toBeGreaterThan(s.elapsed);
 });
});

import {distance,type BattlefieldState,type SoldierState,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {eyeHeight} from './Visibility';
import {smokeTransmission} from '../combat/SupportWeapons';
import type {SightRay} from '../terrain/WorldOcclusion';

interface BankSample extends Vec2 {y:number}
interface ObserverGeometry {revision:number;x:number;y:number;z:number;rays:Map<string,(SightRay|undefined)[]>}
const geometry=new WeakMap<TerrainSystem,WeakMap<SoldierState,ObserverGeometry>>();
const banks=new WeakMap<TerrainSystem,{revision:number;rows:Map<string,BankSample[]>}>();

/** Observe the exposed earth bank, not an imaginary crouched person on its floor.
 * Only this short observed section becomes memory; no occupant or inventory is read. */
export function seesTrenchSection(state:BattlefieldState,terrain:TerrainSystem,observer:SoldierState,a:Vec2,b:Vec2,width:number):boolean {
  if(observer.health<=0||observer.needs?.life!=='active'||observer.action==='sleeping')return false;
  const mid={x:(a.x+b.x)/2,z:(a.z+b.z)/2},length=distance(a,b)||1,d=distance(observer,mid);
  const hour=(state.living?.campaignHours??12)%24,night=hour<6||hour>=20;
  if(d>(night?120:500))return false;
  const facing=((mid.x-observer.x)*Math.sin(observer.heading)+(mid.z-observer.z)*Math.cos(observer.heading))/Math.max(1,d);
  const attention=d<30?1:facing<-.25?.35:facing<.25?.7:1;
  const light=night?.12:hour<7||hour>=19?.55:1;
  const potential=(light/(1+(d/330)**2)+(d<30?.35:0))*attention*(.55+observer.needs.energy*.0045)*(1-observer.suppression*.006);
  if(potential<.24)return false;
  const normal={x:(b.z-a.z)/length,z:-(b.x-a.x)/length};
  const side=(observer.x-mid.x)*normal.x+(observer.z-mid.z)*normal.z>=0?1:-1;
  const key=`${a.x},${a.z}:${b.x},${b.z}:${width}:${side}`,y=eyeHeight(terrain,observer);
  let bankCache=banks.get(terrain);if(bankCache?.revision!==terrain.revision){bankCache={revision:terrain.revision,rows:new Map()};banks.set(terrain,bankCache);}
  let samples=bankCache.rows.get(key);
  if(!samples){samples=[a,mid,b].map(center=>{const x=center.x+normal.x*side*(width/2+1.5),z=center.z+normal.z*side*(width/2+1.5);return {x,z,y:terrain.heightAt(x,z)+.12};});if(bankCache.rows.size>=2048)bankCache.rows.delete(bankCache.rows.keys().next().value!);bankCache.rows.set(key,samples);}
  let people=geometry.get(terrain);if(!people){people=new WeakMap();geometry.set(terrain,people);}
  let saved=people.get(observer);
  if(!saved||saved.revision!==terrain.revision||saved.x!==observer.x||saved.y!==y||saved.z!==observer.z){saved={revision:terrain.revision,x:observer.x,y,z:observer.z,rays:new Map()};people.set(observer,saved);}
  let rays=saved.rays.get(key);
  if(!rays){rays=[];if(saved.rays.size>=256)saved.rays.delete(saved.rays.keys().next().value!);saved.rays.set(key,rays);}
  // Cache exact static geometry only. Heading, energy, suppression, day/night
  // and smoke are evaluated live; a cache can never extend observation memory.
  let visible=0,tested=0;
  for(const [i,bank] of samples.entries()){
    const ray=rays[i]??(rays[i]=terrain.objects.trace(observer,bank,y,bank.y));
    if(ray.clear&&potential*ray.transmission*smokeTransmission(state,observer,bank)>=.24)visible++;
    tested++;if(visible===2)return true;if(visible+3-tested<2)return false;
  }
  return visible>=2;
}

import {distance,type BattlefieldState,type SoldierState,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {eyeHeight} from './Visibility';
import {smokeTransmission} from '../combat/SupportWeapons';

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
  let visible=0,tested=0;
  for(const center of [a,mid,b]){
    const bank={x:center.x+normal.x*side*(width/2+1.5),z:center.z+normal.z*side*(width/2+1.5)};
    const ray=terrain.objects.trace(observer,bank,eyeHeight(terrain,observer),terrain.heightAt(bank.x,bank.z)+.12);
    if(ray.clear&&potential*ray.transmission*smokeTransmission(state,observer,bank)>=.24)visible++;
    tested++;if(visible===2)return true;if(visible+3-tested<2)return false;
  }
  return visible>=2;
}

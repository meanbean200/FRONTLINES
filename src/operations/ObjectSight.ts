import {distance,type BattlefieldState,type SoldierState,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {eyeHeight} from './Visibility';
import {smokeTransmission} from '../combat/SupportWeapons';

export type ObjectSignature='field-gun'|'truck'|'position';
const profiles={
  'field-gun':{radius:1.4,height:1.75,scale:340,night:180},
  truck:{radius:1.2,height:2.6,scale:420,night:220},
  position:{radius:2,height:.7,scale:300,night:140},
};
/** Recognition of exposed physical surfaces, never an occupant/stock query.
 * Large objects get their own apparent size and bounded silhouette samples;
 * a concealed soldier beside a visible truck does not become a contact. */
export function seesObject(state:BattlefieldState,terrain:TerrainSystem,observer:SoldierState,target:Vec2,kind:ObjectSignature):boolean {
  if(observer.health<=0||observer.needs?.life!=='active'||observer.action==='sleeping')return false;
  const profile=profiles[kind],d=distance(observer,target),hour=(state.living?.campaignHours??12)%24,night=hour<6||hour>=20;
  if(d>(night?profile.night:800))return false;
  const toward={x:(observer.x-target.x)/Math.max(.1,d),z:(observer.z-target.z)/Math.max(.1,d)};
  const facing=-toward.x*Math.sin(observer.heading)-toward.z*Math.cos(observer.heading);
  const attention=d<30?1:facing<-.25?.3:facing<.25?.7:1;
  const condition=(.6+observer.needs.energy*.004)*(1-observer.suppression*.004);
  const potential=d<25?.9:(night?.2:hour<7||hour>=19?.6:1)*attention*condition/(1+(d/profile.scale)**2);
  if(potential<.24)return false;
  // Near face, upper silhouette, and two shoulders. Every sample still traces
  // real terrain, masonry, trunks, foliage and smoke; no through-wall shortcut.
  const near={x:target.x+toward.x*profile.radius,z:target.z+toward.z*profile.radius};
  const samples=[{...near,h:profile.height*.75},{...target,h:profile.height},...[-1,1].map(side=>({x:near.x-toward.z*profile.radius*side,z:near.z+toward.x*profile.radius*side,h:profile.height*.7}))];
  const floor=terrain.heightAt(target.x,target.z);
  return samples.some(p=>{const ray=terrain.objects.trace(observer,p,eyeHeight(terrain,observer),floor+p.h);return ray.clear&&potential*ray.transmission*smokeTransmission(state,observer,p)>=.24;});
}
export function playerCanSeeObject(state:BattlefieldState,terrain:TerrainSystem,p:Vec2,kind:ObjectSignature):boolean {
  if(!state.operation)return true;
  const friendly=new Set(state.squads.filter(q=>q.faction!=='enemy').map(q=>q.id));
  return state.soldiers.some(s=>friendly.has(s.squadId)&&seesObject(state,terrain,s,p,kind));
}

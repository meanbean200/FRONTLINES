import type {BattlefieldState,SoldierState,Vec2} from '../core/types';
import {equipmentOf} from './Equipment';
import {isMountedGun,weaponPositionReadiness} from './WeaponPositions';
export type WeaponId='m1'|'bar'|'kar98k'|'mg42'|'smg'|'crew-mg';
export interface WeaponDefinition {id:WeaponId;name:string;range:number;magazine:number;reload:number;interval:number;burst:number;burstGap:number;spread:number;setup:number;crew:number}
export interface WeaponState {id:WeaponId;loaded:number;reloadUntil:number;setupUntil:number;burstLeft:number;position:Vec2;effectiveUntil?:number;effectivePoint?:Vec2}
export const WEAPONS:Record<WeaponId,WeaponDefinition>={
  m1:{id:'m1',name:'M1 rifle',range:360,magazine:8,reload:3,interval:3.8,burst:1,burstGap:3.8,spread:1,setup:0,crew:1},
  kar98k:{id:'kar98k',name:'Kar98k',range:360,magazine:5,reload:4,interval:4.5,burst:1,burstGap:4.5,spread:1,setup:0,crew:1},
  bar:{id:'bar',name:'BAR',range:320,magazine:20,reload:4,interval:.15,burst:3,burstGap:3.5,spread:1.35,setup:1,crew:1},
  mg42:{id:'mg42',name:'MG42',range:500,magazine:50,reload:6,interval:.1,burst:5,burstGap:3,spread:1.6,setup:3,crew:2},
  smg:{id:'smg',name:'Leader SMG',range:90,magazine:30,reload:3,interval:.12,burst:3,burstGap:2.8,spread:1.9,setup:0,crew:1},
  'crew-mg':{id:'crew-mg',name:'Crew machine gun',range:500,magazine:100,reload:7,interval:.15,burst:5,burstGap:3.5,spread:1.45,setup:5,crew:2},
};
/** Loaded rounds are a subset of carried ammo, never a second inventory. */
export function equipWeapon(state:BattlefieldState,s:SoldierState,role?:WeaponId):WeaponState {
  const combat=s.combat??={shotSequence:0};s.equipment??=equipmentOf(state,s);
  if(role)s.equipment.weapon=role; // Explicit scenario/test equipment assignment, never a class gate.
  const id=s.equipment.weapon;if(combat.weapon?.id===id)return combat.weapon;
  return combat.weapon={id,loaded:Math.min(WEAPONS[id].magazine,Math.floor(s.carried?.ammo??0)),reloadUntil:0,setupUntil:state.elapsed+WEAPONS[id].setup,burstLeft:0,position:{x:s.x,z:s.z}};
}
export function weaponReady(state:BattlefieldState,s:SoldierState,active:SoldierState[]):boolean {
  const w=equipWeapon(state,s),def=WEAPONS[w.id],now=state.elapsed;
  if(Math.hypot(s.x-w.position.x,s.z-w.position.z)>.15){w.position={x:s.x,z:s.z};w.setupUntil=now+def.setup;w.burstLeft=0;}
  if(isMountedGun(state,s)){
    const reason=weaponPositionReadiness(state,s.squadId,'emplacement');
    if(reason){s.combat!.pauseReason=reason;w.setupUntil=now+def.setup;w.burstLeft=0;return false;}
  }
  if(now<w.setupUntil){s.combat!.pauseReason=`Setting up ${def.name}`;return false;}
  if(def.crew>1&&active.filter(other=>other.squadId===s.squadId&&other.needs?.life==='active'&&other.action!=='sleeping'&&!other.combat?.careTask&&Math.hypot(other.x-s.x,other.z-s.z)<10&&other.suppression<70).length<def.crew){s.combat!.pauseReason='Weapon crew unavailable';return false;}
  if(w.reloadUntil){
    if(now<w.reloadUntil){s.combat!.pauseReason=`Reloading ${def.name}`;return false;}
    w.loaded=Math.min(def.magazine,Math.floor(s.carried?.ammo??0));w.reloadUntil=0;
  }
  w.loaded=Math.min(w.loaded,Math.floor(s.carried?.ammo??0));
  if(w.loaded<1){if((s.carried?.ammo??0)>=1)w.reloadUntil=now+def.reload;return false;}
  return true;
}

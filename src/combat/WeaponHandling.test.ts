import {describe,it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {fireSmallArms} from './SmallArmsSystem';
import {equipWeapon} from './Weapons';

function fixture(){
  const state=createOperation('meeting'),terrain=new TerrainSystem(state),q=state.squads.find(q=>q.kind==='machinegun'&&q.faction!=='enemy')!;
  const crew=state.soldiers.filter(s=>s.squadId===q.id);crew.forEach((s,i)=>{s.x=i;s.z=0;s.nextShotAt=100;});
  const tick=(at:number)=>{state.elapsed=state.operation!.elapsed=at;fireSmallArms(state,terrain,crew,new Map([[q.id,'player']]),()=>{});};
  return {state,crew,tick};
}
describe('weapon handling is independent of firing cooldown',()=>{
  it('starts setup immediately, tracks travel and settles during the firing cooldown',()=>{
    const {state,crew,tick}=fixture(),gunner=crew[0];tick(1);expect(gunner.combat!.weapon!.setupUntil).toBe(6);
    gunner.x=2;tick(2);expect(gunner.combat!.weapon!.setupUntil).toBe(7);
    tick(7);expect(gunner.combat!.weapon!.setupUntil).toBe(7);expect(state.operation!.shots).toBe(0);expect(gunner.nextShotAt).toBe(100);
  });
  it('starts a physical reload before the next burst window without consuming or firing rounds',()=>{
    const {state,crew,tick}=fixture(),gunner=crew[0],weapon=equipWeapon(state,gunner);weapon.loaded=0;weapon.setupUntil=0;
    const ammo=gunner.carried!.ammo;tick(10);expect(weapon.reloadUntil).toBe(17);tick(17);
    expect(weapon.loaded).toBe(Math.min(100,ammo));expect(gunner.carried!.ammo).toBe(ammo);expect(state.operation!.shots).toBe(0);expect(gunner.nextShotAt).toBe(100);
  });
});

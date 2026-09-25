import {describe,it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {fireSmallArms} from './SmallArmsSystem';
import {equipWeapon} from './Weapons';
import {preparedPosition} from './testing/PositionFixture';

function fixture(){
  const state=createOperation('meeting'),terrain=new TerrainSystem(state),q=state.squads.find(q=>q.faction!=='enemy'&&state.soldiers.some(s=>s.squadId===q.id&&s.equipment?.weapon==='crew-mg'))!;
  const crew=state.soldiers.filter(s=>s.squadId===q.id).sort((a,b)=>Number(b.equipment?.weapon==='crew-mg')-Number(a.equipment?.weapon==='crew-mg'));crew.forEach((s,i)=>{s.x=i;s.z=0;s.nextShotAt=100;});
  const tick=(at:number)=>{state.elapsed=state.operation!.elapsed=at;fireSmallArms(state,terrain,crew,new Map([[q.id,'player']]),()=>{});};
  preparedPosition(state,q.id,'emplacement');
  return {state,crew,tick};
}
describe('weapon handling is independent of firing cooldown',()=>{
  it('starts setup immediately, tracks travel and settles during the firing cooldown',()=>{
    const {state,crew,tick}=fixture(),gunner=crew[0];tick(1);expect(equipWeapon(state,gunner).setupUntil).toBe(6);
    gunner.x=2;tick(2);expect(equipWeapon(state,gunner).setupUntil).toBe(7);
    tick(7);expect(equipWeapon(state,gunner).setupUntil).toBe(7);expect(state.operation!.shots).toBe(0);expect(gunner.nextShotAt).toBe(100);
  });
  it('starts a physical reload before the next burst window without consuming or firing rounds',()=>{
    const {state,crew,tick}=fixture(),gunner=crew[0],weapon=equipWeapon(state,gunner);weapon.loaded=0;weapon.setupUntil=0;
    const ammo=state.living!.facilities.at(-1)!.stock.ammo;tick(10);expect(weapon.reloadUntil).toBe(17);tick(17);
    expect(weapon.loaded).toBe(Math.min(100,ammo));expect(state.living!.facilities.at(-1)!.stock.ammo).toBe(ammo);expect(state.operation!.shots).toBe(0);expect(gunner.nextShotAt).toBe(100);
  });
});

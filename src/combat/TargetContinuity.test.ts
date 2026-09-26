import {describe,it,expect,vi} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {updateContacts} from '../operations/Visibility';
import {fireSmallArms} from './SmallArmsSystem';
import {equipWeapon,type WeaponId} from './Weapons';
import {recordDeath} from '../simulation/DeathRecord';
import {SaveSystem} from '../persistence/SaveSystem';
import type {ShotEvent} from './types';

function fixture(weapon:WeaponId='bar'){
  const state=createOperation('advance'),terrain=new TerrainSystem(state);
  state.trenches=[];state.living!.facilities=[];state.living!.garrisons=[];
  terrain.buildings=[];vi.spyOn(terrain,'baseHeightAt').mockReturnValue(0);vi.spyOn(terrain,'heightAt').mockReturnValue(0);vi.spyOn(terrain.objects,'trees').mockReturnValue([]);
  const shooter=state.soldiers[0],targets=state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy').slice(0,2);
  for(const s of state.soldiers){s.x=-1800;s.z=-1800;s.nextShotAt=1e6;delete s.duty;delete s.garrisonId;}
  Object.assign(shooter,{x:0,z:0,heading:0,nextShotAt:0,action:'holding'});equipWeapon(state,shooter,weapon);
  targets.forEach((s,i)=>Object.assign(s,{x:i?2:-2,z:65,heading:Math.PI,action:'holding'}));
  state.living!.campaignHours=12;state.operation!.nextOrders=1e6;
  const factions=new Map(state.squads.map(q=>[q.id,q.faction??'player'] as const)),events:ShotEvent[]=[];
  const tick=()=>{state.elapsed+=.05;state.operation!.elapsed+=.05;updateContacts(state,terrain);fireSmallArms(state,terrain,[shooter,...targets],factions,(_s,e)=>events.push(e));};
  return {state,terrain,shooter,targets,factions,events,tick};
}
describe('live target continuity and automatic fire',()=>{
  it.each(['m1','bar','smg'] as const)('%s finishes acquisition when nearby enemies exchange distance priority',weapon=>{
    const f=fixture(weapon);
    for(let i=0;i<120&&!f.events.length;i++){
      f.targets[0].z=i%2?65:64;f.targets[1].z=i%2?64:65;f.tick();
    }
    expect(f.events.length,'Crossing targets must not restart acquisition forever').toBeGreaterThan(0);
    expect(f.state.living!.ledger.consumed.ammo).toBe(f.events.length);
  });
  it.each([1,5])('clears a dead target during cooldown and reacquires a living threat at %s×',speed=>{
    const f=fixture('bar');for(let i=0;i<100&&!f.events.length;i++)f.tick();expect(f.events.length).toBe(1);
    const dead=f.targets.find(s=>s.id===f.shooter.aimTargetId)!;
    recordDeath(f.state,dead,{cause:'combat-fire',at:f.state.elapsed});
    // Restore at the boundary most likely to retain a stale aiming cache.
    const saved=new SaveSystem().parse(JSON.stringify(f.state));Object.assign(f.state,saved);
    const shooter=f.state.soldiers.find(s=>s.id===f.shooter.id)!,others=f.targets.map(t=>f.state.soldiers.find(s=>s.id===t.id)!);
    f.state.elapsed+=.05;f.state.operation!.elapsed+=.05;
    fireSmallArms(f.state,f.terrain,[shooter,...others],f.factions,()=>{});
    expect(shooter.aimTargetId).not.toBe(dead.id);expect(shooter.combat?.aim?.targetId).not.toBe(dead.id);
    let shots=0;
    for(let frame=0;frame<140/speed;frame++)for(let tick=0;tick<speed;tick++){
      f.state.elapsed+=.05;f.state.operation!.elapsed+=.05;updateContacts(f.state,f.terrain);
      fireSmallArms(f.state,f.terrain,[shooter,...others],f.factions,()=>{shots++;expect(shooter.aimTargetId).not.toBe(dead.id);});
    }
    expect(shots).toBeGreaterThan(0);
  });
  it('does not start another shot against a casualty already removed in this firing pass',()=>{
    const f=fixture('m1'),other=f.state.soldiers[1];Object.assign(other,{x:1,z:0,heading:0,nextShotAt:0,action:'holding'});equipWeapon(f.state,other,'m1');
    recordDeath(f.state,f.targets[1],{cause:'other',at:0});
    for(const s of [f.shooter,other]){s.aimTargetId=f.targets[0].id;s.aimReadyAt=0;s.combat!.aim={targetId:f.targets[0].id,since:0,lastSeen:0,point:{...f.targets[0],y:.8},lastHeading:0,lastPosition:{x:s.x,z:s.z},settlingUntil:0};}
    updateContacts(f.state,f.terrain);let fired=0;
    fireSmallArms(f.state,f.terrain,[f.shooter,other,...f.targets],f.factions,()=>{fired++;recordDeath(f.state,f.targets[0],{cause:'combat-fire',at:0});});
    expect(fired).toBe(1);expect(other.carried!.ammo).toBe(60);
  });
});

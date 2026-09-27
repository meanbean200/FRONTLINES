import {describe,it,expect,vi} from 'vitest';
import {traverseMount,angleDelta,MOUNT_TURN_RATE} from './MountTraverse';
import {createOperation} from '../operations/createOperation';
import {preparedPosition} from './testing/PositionFixture';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {fireSmallArms} from './SmallArmsSystem';
import {crewOperator} from './WeaponPositions';
import {equipWeapon} from './Weapons';
import {updateContacts} from '../operations/Visibility';
import {SaveSystem} from '../persistence/SaveSystem';
describe('mounted MG response and shared traverse',()=>{
 it.each([1,5])('turns before firing, reacquires during cooldown and refuses targets outside the sector at %sx',speed=>{
  const s=createOperation('campaign'),terrain=new TerrainSystem(s),q=s.squads.find(q=>q.faction==='player'&&q.kind==='machinegun')??s.squads.find(q=>q.faction==='player'&&s.soldiers.some(p=>p.squadId===q.id&&p.equipment?.weapon==='crew-mg'))!;
  const gun=s.soldiers.find(p=>p.squadId===q.id&&p.equipment?.weapon==='crew-mg')!;gun.x=0;gun.z=0;
  const f=preparedPosition(s,q.id,'emplacement'),operator=crewOperator(s,f)!;f.facing=0;
  terrain.buildings=[];vi.spyOn(terrain,'baseHeightAt').mockReturnValue(0);vi.spyOn(terrain,'heightAt').mockReturnValue(0);vi.spyOn(terrain.objects,'trees').mockReturnValue([]);vi.spyOn(terrain.objects,'trace').mockReturnValue({clear:true,transmission:1});
  const target=s.soldiers.find(p=>s.squads.find(q=>q.id===p.squadId)?.faction==='enemy')!;
  for(const p of s.soldiers)if(!f.weaponCrewIds!.includes(p.id)){p.x=-1800;p.z=-1800;p.nextShotAt=1e9;}
  target.x=-40;target.z=80;operator.nextShotAt=0;equipWeapon(s,operator).setupUntil=0;s.living!.campaignHours=12;
  const factions=new Map(s.squads.map(q=>[q.id,q.faction??'player'] as const)),shots:number[]=[];
  const tick=()=>{s.elapsed+=.05;s.operation!.elapsed=s.elapsed;updateContacts(s,terrain);fireSmallArms(s,terrain,s.soldiers,factions,(shooter)=>{if(shooter.id===operator.id){shots.push(s.elapsed);expect(Math.abs(angleDelta(Math.atan2(target.x-operator.x,target.z-operator.z),f.traverse!.yaw))).toBeLessThan(.016);}});};
  for(let i=0;i<60/speed&&!shots.length;i++)for(let j=0;j<speed;j++)tick();
  expect(shots.length).toBeGreaterThan(0);expect(shots[0]).toBeLessThan(2);
  const oldYaw=f.traverse!.yaw;target.x=40;operator.nextShotAt=s.elapsed+3;
  for(let i=0;i<15;i++)tick();expect(f.traverse!.yaw).toBeGreaterThan(oldYaw);expect(f.traverse!.yaw).toBeLessThanOrEqual(Math.atan2(40,80));
  const restored=new SaveSystem().parse(JSON.stringify(s));expect(restored.living!.facilities.find(p=>p.id===f.id)!.traverse).toEqual(f.traverse);
  target.z=-80;const before=shots.length;for(let i=0;i<100;i++)tick();expect(shots).toHaveLength(before);
 });
 it('does not bank rotation across a pause or absent crew',()=>{const s=createOperation('campaign'),q=s.squads.find(q=>q.faction==='player'&&s.soldiers.some(p=>p.squadId===q.id&&p.equipment?.weapon==='crew-mg'))!,f=preparedPosition(s,q.id,'emplacement');f.facing=0;traverseMount(f,1,0);traverseMount(f,1,200);expect(f.traverse!.yaw).toBeCloseTo(MOUNT_TURN_RATE*.1);});
});

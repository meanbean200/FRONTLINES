import {it,expect,vi} from 'vitest';
import {createStudyScenario} from '../garrison/StudyScenario';
import {createOperation} from '../operations/createOperation';
import {addSquad} from '../simulation/createBattlefield';
import {freshNeeds} from '../garrison/NeedsSystem';
import {inventory} from '../garrison/types';
import {crewOperator,positionReadiness} from './WeaponPositions';
import {updateContacts} from '../operations/Visibility';
import {fireSmallArms} from './SmallArmsSystem';
import {SaveSystem} from '../persistence/SaveSystem';
import type {Faction} from '../operations/types';

it('builds, walks a mixed crew, observes and fires the mounted gun; wrong facing and empty ammunition explain inactivity',()=>{
  const sim=createStudyScenario(),s=sim.state,t=sim.terrain,g=s.living!.garrisons[0],gun=s.soldiers[0],helper=s.soldiers[8];
  g.nextSupport=1e9;s.living!.lethalNeeds=false;gun.equipment!.weapon='crew-mg';
  for(const p of [gun,helper]){p.carried!.ammo=60;s.living!.ledger.initial.ammo+=60;}
  const id=sim.garrisons.requestFacility(g.id,'emplacement',undefined,undefined,undefined,true)!,f=s.living!.facilities.find(p=>p.id===id)!;
  for(let i=0;i<12000&&f.progress<1;i++)sim.step(.05);expect(f.progress).toBe(1);
  expect(sim.garrisons.assignCrew(gun.id,id)).toMatchObject({accepted:true});
  let assigned=sim.garrisons.assignCrew(helper.id,id);for(let i=0;i<12000&&!assigned.accepted;i++){sim.step(.05);assigned=sim.garrisons.assignCrew(helper.id,id);}expect(assigned).toMatchObject({accepted:true});
  for(let i=0;i<6000&&positionReadiness(s,f);i++)sim.step(.05);expect(positionReadiness(s,f)).toBe('');expect(crewOperator(s,f)?.id).toBe(gun.id);
  expect(new SaveSystem().parse(JSON.stringify(s)).living!.facilities.find(p=>p.id===id)!.weaponCrewIds).toEqual([gun.id,helper.id]);
  // Isolate the engagement on flat clear ground after physical construction and arrival.
  vi.spyOn(t,'baseHeightAt').mockReturnValue(0);vi.spyOn(t.objects,'trees').mockReturnValue([]);t.buildings=[];t.syncModifications();
  const enemy=addSquad(s,'rifle',1,gun.x,gun.z+65,'Target');enemy.faction='enemy';const target=s.soldiers.at(-1)!;target.needs=freshNeeds();target.carried=inventory({ammo:60});s.living!.ledger.initial.ammo+=60;
  s.operation=createOperation('advance').operation;s.operation!.elapsed=s.elapsed;s.operation!.objectives=[];s.living!.campaignHours=12;gun.heading=f.facing=0;gun.needs!.energy=100;
  const sides=new Map(s.squads.map(q=>[q.id,q.faction??'player'] as [number,Faction]));let fired=0;
  const shoot=(seconds:number)=>{for(let i=0;i<seconds*20;i++){s.elapsed+=.05;s.operation!.elapsed+=.05;updateContacts(s,t);fireSmallArms(s,t,[gun,helper,target],sides,(p)=>{if(p.id===gun.id)fired++;});}};
  shoot(12);expect(fired).toBeGreaterThan(1);expect(gun.carried!.ammo).toBeLessThan(60);
  f.facing=Math.PI;const count=fired;shoot(6);expect(fired).toBe(count);expect(gun.combat?.pauseReason).toContain('firing sector');
  f.stock.ammo=gun.carried!.ammo=helper.carried!.ammo=0;expect(positionReadiness(s,f)).toContain('AMMO');
},20000);

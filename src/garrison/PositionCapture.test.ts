import {describe,it,expect} from 'vitest';
import {createStudyScenario} from './StudyScenario';
import {inventory} from './types';
import {balance} from './Inventory';
import {SaveSystem} from '../persistence/SaveSystem';
import {connectedName,friendlyTrenches,networkRepresentatives} from '../ui/TrenchReadout';
import {SUPPORT_WORKS} from '../construction/ConstructionReadout';

function fixture(){
  const sim=createStudyScenario(),s=sim.state,g=s.living!.garrisons[0],t=s.trenches[0],[enemy,q]=s.squads;
  for(const other of s.squads.slice(1))sim.garrisons.release(other.id);
  enemy.faction='enemy';g.faction='enemy';t.engineerSquadId=enemy.id;
  const old=s.soldiers.filter(p=>p.squadId===enemy.id),chosen=s.soldiers.filter(p=>p.squadId===q.id);
  for(const p of old){p.x=t.points[0].x+500;p.z=t.points[0].z+500;p.garrisonId=g.id;}
  for(const [i,p] of chosen.entries()){p.x=t.points[0].x+10+i;p.z=t.points[0].z;}
  // A detached gunner is absent from the formation roster but still owns a duty.
  g.squadIds=[];old[0].personalArea=true;
  const cost=SUPPORT_WORKS.emplacement.cost,f={id:s.nextEntityId++,kind:'emplacement' as const,garrisonId:g.id,x:t.points[0].x+12,z:t.points[0].z,connectorId:t.id,progress:1,capacity:2,paid:true,materialCost:cost,includesWeapon:true,installation:{kind:'crew-mg' as const,source:'construction' as const},stock:inventory({ammo:60}),weaponCrewIds:[old[0].id,old[1].id]};
  s.living!.facilities.push(f);s.living!.ledger.initial.materials+=cost;s.living!.ledger.consumed.materials+=cost;s.living!.ledger.initial.ammo+=60;
  return {sim,s,g,t,q,old,chosen,f};
}
describe('physical position capture',()=>{
  it('cannot remotely claim an enemy trench or claim one with a nearby defender',()=>{
    const {sim,t,q,chosen,old}=fixture();
    chosen.forEach(p=>p.z+=200);expect(sim.garrisons.assign([q.id],t.id)).toBe(false);
    chosen.forEach(p=>p.z-=200);old[0].x=t.points[0].x+40;old[0].z=t.points[0].z+12;
    expect(sim.garrisons.assign([q.id],t.id)).toBe(false);
  });
  it('retains installed equipment, stock and network identity while releasing former personal crews',()=>{
    const {sim,s,g,t,q,old,f}=fixture(),before=balance(s),locations=old.map(p=>({x:p.x,z:p.z})),weapon=structuredClone(f.installation);
    expect(sim.garrisons.assign([q.id],t.id)).toBe(true);expect(g.faction).toBe('player');expect(f.weaponCrewIds).toEqual([]);
    expect(f.installation).toEqual(weapon);expect(f.stock.ammo).toBe(60);expect(balance(s)).toEqual(before);
    expect(old.every(p=>p.garrisonId===undefined&&p.duty===undefined&&p.personalArea===undefined)).toBe(true);expect(old.map(p=>({x:p.x,z:p.z}))).toEqual(locations);
    const n=sim.garrisons.network;expect(networkRepresentatives(friendlyTrenches(s,n),n).map(t=>t.id)).toEqual([t.id]);expect(connectedName(s,n,t.id)).toContain('Captured network');
    expect(new SaveSystem().parse(JSON.stringify(s))).toEqual(s);
  });
});

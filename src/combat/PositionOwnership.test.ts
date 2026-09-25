import {describe,it,expect} from 'vitest';
import {createStudyScenario} from '../garrison/StudyScenario';
import {preparedPosition} from './testing/PositionFixture';
import {crewOperator,installPositionWeapons,positionReadiness} from './WeaponPositions';
import {SaveSystem} from '../persistence/SaveSystem';
import {balance} from '../garrison/Inventory';
import {equipWeapon} from './Weapons';

describe('position-owned installed weapons',()=>{
  it.each(['emplacement','mortar'] as const)('%s survives an empty post, replacement gunner, rest and save',kind=>{
    const sim=createStudyScenario(),state=sim.state,q=state.squads[0],first=state.soldiers.find(s=>s.squadId===q.id)!;
    if(kind==='mortar')first.equipment!.mortar=true;else first.equipment!.weapon='crew-mg';
    const f=preparedPosition(state,q.id,kind),installed=structuredClone(f.installation),stock=structuredClone(f.stock),ids=[...f.weaponCrewIds!];
    sim.garrisons.network.sync(state.trenches);
    const before=balance(state);installPositionWeapons(state);installPositionWeapons(state);
    expect(f.installation).toEqual(installed);expect(balance(state)).toEqual(before);
    expect(kind==='mortar'?first.equipment!.mortar:first.equipment!.weapon).toBe(kind==='mortar'?false:'unarmed');
    sim.garrisons.removeCrew(f.id,ids[0]);expect(f.weaponCrewIds).toEqual([ids[1]]);expect(f.installation).toEqual(installed);expect(f.stock).toEqual(stock);
    const replacement=state.soldiers.find(s=>s.squadId===q.id&&!ids.includes(s.id))!;
    expect(replacement.equipment?.weapon).not.toBe('crew-mg');expect(replacement.equipment?.mortar).toBe(false);
    expect(sim.garrisons.assignCrew(replacement.id,f.id).accepted).toBe(true);expect(f.weaponCrewIds).toEqual([ids[1],replacement.id]);
    const operator=crewOperator(state,f)!;if(kind==='emplacement')expect(equipWeapon(state,operator)).toBe(f.installation!.weapon);
    expect(sim.garrisons.orderPerson(operator.id,'rest').accepted).toBe(true);expect(f.weaponCrewIds).toContain(operator.id);
    sim.step(.05);expect(operator.duty?.kind).toBe('sleep');expect(f.weaponCrewIds).toContain(operator.id);
    const trench=state.trenches.find(t=>t.id===f.connectorId)!;trench.points[0].x-=30;trench.points[1].x+=30; // enough usable area for a full formation, not just a two-person fixture
    expect(sim.garrisons.assign([q.id],f.connectorId)).toBe(true);expect(f.weaponCrewIds).toContain(operator.id);expect(operator.duty?.kind).toBe('sleep');
    expect(new SaveSystem().parse(JSON.stringify(state))).toEqual(state);
    sim.garrisons.removeCrew(f.id);expect(positionReadiness(state,f)).toContain('NO GUNNER');expect(f.installation).toBeDefined();expect(f.stock).toEqual(stock);
    expect(balance(state)).toEqual(before);
  });
  it('completion installs paid equipment exactly once, but never refills ready ammunition',()=>{
    const sim=createStudyScenario(),s=sim.state,g=s.living!.garrisons[0];g.nextSupport=1e9;
    const id=sim.garrisons.requestFacility(g.id,'emplacement',undefined,undefined,undefined,true)!,f=s.living!.facilities.find(f=>f.id===id)!;
    for(let i=0;i<12000&&f.progress<1;i++)sim.step(.05);
    expect(f.installation).toMatchObject({kind:'crew-mg',source:'construction'});expect(f.stock.ammo).toBe(0);
    const loaded=new SaveSystem().parse(JSON.stringify(s));expect(loaded).toEqual(s);installPositionWeapons(s,true);expect(f.stock.ammo).toBe(0);
    for(const n of Object.values(balance(s)))expect(Math.abs(n)).toBeLessThan(1e-6);
  },15000);
  it.each(['emplacement','mortar'] as const)('keeps %s crew when two supply areas merge into one network',kind=>{
    const sim=createStudyScenario(),state=sim.state,q=state.squads[0],first=state.soldiers.find(s=>s.squadId===q.id)!;
    if(kind==='mortar')first.equipment!.mortar=true;else first.equipment!.weapon='crew-mg';
    const f=preparedPosition(state,q.id,kind),ids=[...f.weaponCrewIds!],area=f.garrisonId,duty=structuredClone(first.duty),root=state.trenches[0];
    state.trenches.push({id:state.nextEntityId++,points:[{x:f.x,z:f.z},{...root.points[0]}],width:4.2,depth:1.75,progress:1,status:'complete'});
    sim.garrisons.network.sync(state.trenches);expect(sim.garrisons.network.anchor(f.connectorId)).toBe(root.id);
    expect(sim.garrisons.assign([q.id],root.id)).toBe(true);
    expect(f.weaponCrewIds).toEqual(ids);expect(first.garrisonId).toBe(area);expect(first.duty).toEqual(duty);
    expect(new SaveSystem().parse(JSON.stringify(state))).toEqual(state);
  });
});

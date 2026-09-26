import {it,expect} from 'vitest';
import {createOperationalBattle} from '../operations/createOperationalBattle';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {preparedPosition} from '../combat/testing/PositionFixture';
import {SaveSystem} from '../persistence/SaveSystem';
import {positionReadiness} from '../combat/WeaponPositions';

function fixture(){
  const state=createOperationalBattle('meeting'),sim=new BattlefieldSimulation(state),q=state.squads.find(q=>q.faction==='player')!,people=state.soldiers.filter(s=>s.squadId===q.id);
  people[0].equipment!.mortar=true;const f=preparedPosition(state,q.id,'mortar'),g=state.living!.garrisons.find(g=>g.id===f.garrisonId)!;
  q.order={type:'occupy-trench',trenchId:f.connectorId,issuedAt:0};g.readiness='stand-to';
  for(const s of people){s.needs!.energy=90;s.needs!.hunger=s.needs!.thirst=10;s.suppression=0;s.combat={shotSequence:0};if(!f.weaponCrewIds!.includes(s.id)){delete s.duty;s.x+=8;}}
  const outgoing=people.find(s=>s.id===f.weaponCrewIds![0])!,old=f.weaponCrewIds!.slice();outgoing.needs!.energy=40;
  return {state,sim,q,people,f,g,outgoing,old};
}

it('reserves a relief separately and exchanges the actual post only after arrival',()=>{
  const {state,sim,f,outgoing,old}=fixture();
  sim.step(.05);expect(f.crewRelief).toBeDefined();expect(f.weaponCrewIds).toEqual(old);expect(outgoing.duty?.kind).toBe('watch');
  const incoming=state.soldiers.find(s=>s.id===f.crewRelief!.incomingId)!;expect(f.weaponCrewIds).not.toContain(incoming.id);expect(incoming.duty?.arrivedAt).toBeUndefined();
  const copy=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));expect(copy.state).toEqual(state);
  let handover=false;
  for(let i=0;i<1200&&f.crewRelief;i++){sim.step(.05);copy.step(.05);if(f.crewRelief?.phase==='handover'){handover=true;expect(f.weaponCrewIds).toEqual(old);expect(new SaveSystem().parse(JSON.stringify(state))).toEqual(state);}}
  expect(handover).toBe(true);
  expect(copy.state).toEqual(state);expect(f.crewRelief).toBeUndefined();expect(f.weaponCrewIds).toContain(incoming.id);expect(f.weaponCrewIds).not.toContain(outgoing.id);expect(outgoing.duty?.kind).toBe('sleep');
},20000);

it('cancels the incoming reservation when the outgoing post is explicitly vacated',()=>{
  const {state,sim,f,outgoing}=fixture();sim.step(.05);
  const incoming=state.soldiers.find(s=>s.id===f.crewRelief!.incomingId)!;
  sim.garrisons.removeCrew(f.id,outgoing.id);
  expect(f.crewRelief).toBeUndefined();expect(incoming.duty).toBeUndefined();expect(f.weaponCrewIds).not.toContain(incoming.id);
  expect(new SaveSystem().parse(JSON.stringify(state))).toEqual(state);
});

it('does not suppress critical rest to satisfy 90% readiness when no relief is fit',()=>{
  const {state,sim,f,people,g,outgoing}=fixture();
  for(const s of people)if(!f.weaponCrewIds!.includes(s.id))s.needs!.energy=20;
  outgoing.needs!.energy=20;
  for(let i=0;i<200;i++)sim.step(.05);
  expect(g.readiness).toBe('stand-to');expect(f.crewRelief).toBeUndefined();
  expect(outgoing.selfCare?.kind==='sleep'||outgoing.duty?.kind==='sleep').toBe(true);
  expect(positionReadiness(state,f)).toMatch(/RESTING/);expect(g.watchPresent).toBeLessThan(g.watchRequired);
});

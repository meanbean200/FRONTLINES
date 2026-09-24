import { expect, it } from 'vitest';
import { createStudyScenario } from './StudyScenario';
import { addSquad } from '../simulation/createBattlefield';
import { dropCargo } from './NeedsSystem';
import { balance } from './Inventory';

it('accepts reinforcements after losses without retaining permanent casualty reservations',()=>{
  const sim=createStudyScenario(1944,0,48),state=sim.state,g=state.living!.garrisons[0];
  const fallen=state.soldiers.slice(0,24);
  const reserve=addSquad(state,'rifle',24,g.entrance.x-12,g.entrance.z-12,'Reinforcements');
  expect(sim.assignGarrison([reserve.id],g.trenchId)).toBe(false);
  for(const s of fallen){s.needs!.life='incapacitated';s.health=10;}
  expect(sim.assignGarrison([reserve.id],g.trenchId)).toBe(false);
  for(const s of fallen){s.needs!.life='dead';s.health=0;s.action='dead';dropCargo(state,s);}
  const bodies=fallen.map(s=>({id:s.id,x:s.x,z:s.z}));
  expect(sim.assignGarrison([reserve.id],g.trenchId)).toBe(true);
  expect(state.soldiers.filter(s=>s.garrisonId===g.id&&s.needs?.life!=='dead')).toHaveLength(48);
  expect(g.capacity).toBeGreaterThanOrEqual(48);
  expect(fallen.map(s=>({id:s.id,x:s.x,z:s.z}))).toEqual(bodies);
  expect(state.soldiers.filter(s=>s.needs?.life==='dead')).toHaveLength(24);
  for(const value of Object.values(balance(state)))expect(Math.abs(value)).toBeLessThan(1e-6);
});

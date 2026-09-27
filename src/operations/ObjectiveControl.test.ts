import {describe,it,expect} from 'vitest';
import {createOperation} from './createOperation';
import {advanceControl,insideObjective,controlReadout,controlBoundary} from './ObjectiveControl';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {crateAccess} from '../garrison/SupplyAccess';
import {SaveSystem} from '../persistence/SaveSystem';
import {balance} from '../garrison/Inventory';
describe('town control and physical stock authority',()=>{
 it('reproduces the legacy Saint-Martin flag offset and secures the actual town, then recaptures without refilling',()=>{
  const s=createOperation('campaign'),o=s.operation!.objectives.find(o=>o.id==='village')!,terrain=new TerrainSystem(s),crate=s.living!.crates.find(c=>c.id===o.cacheId)!,initial={...crate.stock};
  const friends=s.soldiers.filter(p=>s.squads.find(q=>q.id===p.squadId)?.faction==='player').slice(0,5),enemies=s.soldiers.filter(p=>s.squads.find(q=>q.id===p.squadId)?.faction==='enemy').slice(0,5);
  for(const p of s.soldiers){p.x=-1700;p.z=1700;}
  for(const p of friends){p.x=0;p.z=-80;}
  expect(Math.hypot(o.x,o.z+80)).toBeGreaterThan(o.radius); // failed old circle
  expect(insideObjective(s,o,friends[0])).toBe(true);expect(controlBoundary(s,o).length).toBeGreaterThan(4);
  expect(crateAccess(s,terrain,crate,'player')).toContain('AREA NOT SECURED');
  for(let i=0;i<701;i++)advanceControl(s,o,.05);
  expect(o.owner).toBe('player');expect(controlReadout(s,o).status).toBe('FRIENDLY CONTROL');expect(crateAccess(s,terrain,crate,'player')).toBe('');
  const loaded=new SaveSystem().parse(JSON.stringify(s));expect(loaded.operation!.objectives.find(v=>v.id==='village')).toEqual(o);
  for(const p of friends){p.x=-1700;p.z=1700;}for(const p of enemies){p.x=0;p.z=-80;}
  advanceControl(s,o,.05);expect(controlReadout(s,o).status).toBe('CONTESTED');expect(crateAccess(s,terrain,crate,'player')).toBe('NO CURRENT OBSERVATION');
  for(let i=0;i<1401;i++)advanceControl(s,o,.05);
  expect(o.owner).toBe('enemy');expect(crate.stock).toEqual(initial);expect(Object.values(balance(s)).every(n=>Math.abs(n)<1e-6)).toBe(true);
 });
 it('pinned enemies still contest; suppressed allies do not inflate capture strength',()=>{
  const s=createOperation('campaign'),o=s.operation!.objectives.find(o=>o.id==='village')!;
  const friends=s.soldiers.filter(p=>s.squads.find(q=>q.id===p.squadId)?.faction==='player').slice(0,3),enemy=s.soldiers.find(p=>s.squads.find(q=>q.id===p.squadId)?.faction==='enemy')!;
  for(const p of s.soldiers){p.x=-1700;p.z=1700;}for(const p of [...friends,enemy]){p.x=0;p.z=-80;}enemy.suppression=99;
  advanceControl(s,o,100);expect(o.control).toBe(0);expect(controlReadout(s,o).status).toBe('CONTESTED');
  enemy.x=1700;friends[0].suppression=99;advanceControl(s,o,100);expect(o.control).toBe(0);expect(controlReadout(s,o).reason).toContain('2 / 3');
 });
});

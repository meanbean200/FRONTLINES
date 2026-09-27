import {describe,it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {stockPiles,stockPileAnchors,crateAnchors,crateAccess,crateVisible} from './SupplyAccess';
import {inventory} from './types';
import {SaveSystem} from '../persistence/SaveSystem';
describe('shared physical stock presentation',()=>{
 it('maps every friendly depot/roadhead box to its actual inventory and hides unseen enemy stores',()=>{
  const s=createOperation('campaign'),t=new TerrainSystem(s),w=s.living!;
  for(const p of s.soldiers.filter(p=>s.squads.find(q=>q.id===p.squadId)?.faction==='player')){p.x=-1800;p.z=-1800;}
  const piles=stockPiles(s,t);expect(piles.filter(p=>p.side==='enemy')).toHaveLength(0);
  expect(piles.find(p=>p.kind==='rear')!.stock).toBe(w.rearStock);
  for(const g of w.garrisons.filter(g=>g.faction!=='enemy')){
   expect(piles.find(p=>p.kind==='cache'&&p.id===g.id)!.stock).toBe(g.cache);
   expect(piles.find(p=>p.kind==='forward'&&p.id===g.id)!.stock).toBe(g.forwardStock);
  }
  const p=piles[0];expect(stockPileAnchors(p)[0]).toEqual({x:p.point.x+2,z:p.point.z});
  expect(stockPileAnchors({...p,stock:inventory()})).toEqual([]);
 });
 it('keeps captured stock blocked by hostile control and keeps pack click anchors attached to the actual drop',()=>{
  const s=createOperation('campaign'),t=new TerrainSystem(s),p=s.soldiers[0],c={id:s.nextEntityId++,x:p.x,z:p.z,droppedBy:p.id,stock:inventory({food:2})};
  s.living!.crates.push(c);expect(crateVisible(s,t,c)).toBe(true);
  expect(crateAnchors(s,c)).toEqual([{x:c.x+Math.cos(p.heading)*.65,z:c.z-Math.sin(p.heading)*.65}]);
  const town=s.operation!.objectives[0],cache=s.living!.crates.find(c=>c.id===town.cacheId)!;town.owner='enemy';town.contested=true;
  expect(crateAccess(s,t,cache,'player')).not.toBe('');
 });
 it('migrates the previous rules without replaying old needs conversions or refilling stock',()=>{
  const s=createOperation('campaign'),g=s.living!.garrisons[0],before=JSON.stringify(s.living!.rearStock);s.combatRules='combat-44-endless-controller-world2';g.cutoff='decision';
  const copy=new SaveSystem().parse(JSON.stringify(s));expect(copy.living!.garrisons[0].cutoff).toBe('decision');expect(JSON.stringify(copy.living!.rearStock)).toBe(before);expect(copy.living!.migrationNote).toContain('revised combat');
 });
});

import {describe,it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {planningAssets} from './PlanningReadout';
import {reinforcementReadout} from './ReinforcementReadout';
import {inventory} from '../garrison/types';
import {buildingReadout} from './BuildingReadout';
describe('command map and passenger readouts',()=>{
  it('does not disclose hidden live enemy trenches, facilities or truck movement',()=>{
    const sim=new BattlefieldSimulation(createOperation('open-front')),s=sim.state,a=planningAssets(s,sim.garrisons.network);
    for(const t of s.living!.trucks.filter(t=>t.faction==='enemy'))t.x+=100;
    for(const g of s.living!.garrisons.filter(g=>g.faction==='enemy'))g.forwardStock.ammo+=100;
    expect(planningAssets(s,sim.garrisons.network)).toEqual(a);expect(a.some(v=>v.kind==='network')).toBe(true);expect(a.some(v=>v.kind==='memory')).toBe(false);
  });
  it('reports only the current physical transport leg and preserves a blocked passenger',()=>{
    const s=createOperation('open-front'),t=s.living!.trucks[0],q=s.squads[0],m={id:1234,personId:1235,squadId:q.id,side:'player' as const,returning:false,stage:'convoy' as const,truckId:t.id,stock:inventory(),releasedAt:0};
    Object.assign(t,{x:0,z:0,route:[{x:120,z:0}],routeIndex:0,state:'outbound'});
    expect(reinforcementReadout(s,m).eta).toContain('~16 s');t.state='blocked';t.reason='Road blocked';
    const before=structuredClone(m),read=reinforcementReadout(s,m);expect(read.blocked).toBe(true);expect(read.eta).toBeUndefined();expect(read.reason).toBe('Road blocked');expect(m).toEqual(before);
  });
  it('keeps a building window reserved while its owner is physically away on a supply errand',()=>{
    const sim=new BattlefieldSimulation(createOperation('advance')),s=sim.state,p=s.soldiers[0];
    p.selfCare={kind:'resupply',stage:'outbound',orderAt:0,since:0,until:6,blockedFor:0,home:{x:0,z:0,building:{id:0,floor:1,target:{x:1,z:1}}},route:[],index:0};
    const read=buildingReadout(s,sim.terrain,0)!;expect(read.people).toContain(p);expect(read.floors[1].reserved).toBe(1);expect(read.floors[1].inside).toBe(0);
  });
});

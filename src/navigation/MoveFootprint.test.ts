import {describe,it,expect,vi} from 'vitest';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {createBattlefield,addSquad} from '../simulation/createBattlefield';
import {distance} from '../core/types';

describe('clicked formation footprint',()=>{
  it.each([3,8,16])('centres %s squads locally at the click, independent of travel distance',count=>{
    const state=createBattlefield();state.soldiers=[];state.squads=[];state.trenches=[];
    for(let i=0;i<count;i++)addSquad(state,'rifle',8,-1800,-1700-i,`Group ${i}`);
    const sim=new BattlefieldSimulation(state);
    vi.spyOn(sim.terrain,'buildingAt').mockReturnValue(undefined);vi.spyOn(sim.terrain,'obstacleAt').mockReturnValue(false);
    vi.spyOn(sim.navigation,'planFormation').mockImplementation((_from,to)=>[to]);
    for(const x of [-1775,-1000,1000]){
      const click={x,z:-1700};sim.issueMove(state.squads.map(q=>q.id),click);
      const goals=state.squads.map(q=>q.order.target!);
      expect(goals.reduce((sum,p)=>sum+p.x,0)/count).toBeCloseTo(click.x,8);
      expect(goals.reduce((sum,p)=>sum+p.z,0)/count).toBeCloseTo(click.z,8);
      expect(Math.max(...goals.map(p=>distance(p,click)))).toBeLessThanOrEqual(18.001);
    }
  });
  it('reports insufficient local space instead of silently moving the footprint far away',()=>{
    const state=createBattlefield();state.soldiers=[];state.squads=[];state.trenches=[];
    const q=addSquad(state,'rifle',8,-1800,-1700,'Group'),sim=new BattlefieldSimulation(state),click={x:-1600,z:-1700};
    vi.spyOn(sim.terrain,'buildingAt').mockReturnValue(undefined);
    vi.spyOn(sim.terrain,'obstacleAt').mockImplementation((x,z)=>distance({x,z},click)<30);
    sim.issueMove([q.id],click);
    expect(distance(q.order.target!,click)).toBeLessThan(1);
    expect(q.orderNote).toContain('Route blocked');expect(q.route).toEqual([]);
  });
});

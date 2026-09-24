import { describe, expect, it, vi } from 'vitest';
import { SquadNavigation } from './SquadNavigation';
import { TerrainSystem } from '../terrain/TerrainSystem';
import { createBattlefield } from '../simulation/createBattlefield';
import { TrenchNetwork } from '../garrison/TrenchNetwork';
import { distance, type TrenchState } from '../core/types';
import {createOperationalBattle} from '../operations/createOperationalBattle';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';

describe('external garrison approach planning',()=>{
  it('keeps both formations moving to the village when a coarse final grid cell is inside buildings',()=>{
    const sim=new BattlefieldSimulation(createOperationalBattle('meeting',1944));
    const squads=sim.state.squads.slice(0,2);
    sim.issueMove(squads.map(q=>q.id),{x:-7.391036260090295,z:-76.90571195162948});
    for(const q of squads){expect(q.order.type).toBe('move');expect(q.route.length).toBeGreaterThan(0);expect(q.route.every((p,i)=>sim.navigation.segmentClear(i?q.route[i-1]:q,p,2))).toBe(true);}
  });
  it('reports a failed route without silently cancelling the destination or walking through the obstacle',()=>{
    const sim=new BattlefieldSimulation(createOperationalBattle('meeting',1944)),q=sim.state.squads[0];
    vi.spyOn(sim.navigation,'plan').mockReturnValue([]);sim.issueMove([q.id],{x:-1850,z:-1850});
    const order=structuredClone(q.order),before={x:q.x,z:q.z};sim.step(.05);
    expect(q.order).toEqual(order);expect(q.orderNote).toContain('Route blocked');expect(distance(q,before)).toBeLessThan(2);
  });
  it('does not run a grid search for a long, fully checked open approach',()=>{
    const terrain=new TerrainSystem(createBattlefield()),nav=new SquadNavigation(terrain);
    const cost=vi.spyOn(terrain,'navigationCostAt');
    const start={x:-1900,z:-1850},goal={x:-1650,z:-1850};
    expect(nav.plan(start,goal,()=>false)).toEqual([goal]);
    expect(cost).not.toHaveBeenCalled();
  });
  it('still routes around an intervening trench wall and validates every segment',()=>{
    const nav=new SquadNavigation(new TerrainSystem(createBattlefield()));
    const start={x:-1900,z:-1850},goal={x:-1650,z:-1850};
    const wall=(p:{x:number;z:number})=>p.x>-1850&&p.x<-1830&&Math.abs(p.z+1850)<30;
    expect(nav.segmentClear(start,goal,4,wall)).toBe(false);
    const route=nav.plan(start,goal,wall);
    expect(route.length).toBeGreaterThan(1);
    expect(route.every((p,i)=>nav.segmentClear(i?route[i-1]:start,p,2,wall))).toBe(true);
  });
  it('finds a bounded return around another camp on costly sloping terrain',()=>{
    // Reduced geometry from the saved 1,000-person carrier-947 failure. The
    // river/slope cost used to exhaust 8,000 iterations 119 m short of entry.
    const state=createBattlefield(),goal={x:-1390,z:-820},start={x:-1390,z:-1340.079089424514};
    state.seed=1944;state.craters=[];
    state.trenches=[-1150,-820].map((z,i):TrenchState=>({id:i+1,width:4.2,depth:1.75,progress:1,status:'complete',points:[{x:-1390,z},{x:-1060,z},{x:-1060,z:z+80},{x:-1225,z:z+80},{x:-1225,z}]}));
    const network=new TrenchNetwork();network.sync(state.trenches);
    const nav=new SquadNavigation(new TerrainSystem(state)),avoid=(p:{x:number;z:number})=>network.corridorContains(p)&&distance(p,goal)>3;
    const route=nav.plan(start,goal,avoid);
    expect(route.length).toBeGreaterThan(0);expect(route.at(-1)).toEqual(goal);
    expect(route.every((p,i)=>nav.segmentClear(i?route[i-1]:start,p,2,avoid))).toBe(true);
  });
  it('does not connect the last leg through a sealed wall',()=>{
    const nav=new SquadNavigation(new TerrainSystem(createBattlefield())),start={x:-1900,z:-1850},goal={x:-1650,z:-1850};
    const enclosure=(p:{x:number;z:number})=>{const d=Math.hypot(p.x-goal.x,p.z-goal.z);return d>18&&d<30;};
    expect(nav.plan(start,goal,enclosure)).toEqual([]);
  });
  it('caches terrain costs only within a search and observes changes next time',()=>{
    const terrain=new TerrainSystem(createBattlefield()),nav=new SquadNavigation(terrain);
    const start={x:-1900,z:-1850},goal={x:-1650,z:-1850},wall=(p:{x:number;z:number})=>p.x>-1850&&p.x<-1830&&Math.abs(p.z+1850)<30;
    const cost=vi.spyOn(terrain,'navigationCostAt');
    expect(nav.plan(start,goal,wall).length).toBeGreaterThan(0);
    const keys=cost.mock.calls.map(([x,z])=>`${x},${z}`);expect(new Set(keys).size).toBe(keys.length);expect(keys.length).toBeGreaterThan(0);
    cost.mockClear();expect(nav.plan(start,goal,wall).length).toBeGreaterThan(0);expect(cost).toHaveBeenCalled();
    const sealed=(p:{x:number;z:number})=>wall(p)||Math.hypot(p.x-goal.x,p.z-goal.z)>18&&Math.hypot(p.x-goal.x,p.z-goal.z)<30;
    expect(nav.plan(start,goal,sealed)).toEqual([]);
  });
});

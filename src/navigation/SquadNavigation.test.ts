import { describe, expect, it, vi } from 'vitest';
import { SquadNavigation } from './SquadNavigation';
import { TerrainSystem } from '../terrain/TerrainSystem';
import { createBattlefield } from '../simulation/createBattlefield';
import { TrenchNetwork } from '../garrison/TrenchNetwork';
import { distance, type TrenchState } from '../core/types';

describe('external garrison approach planning',()=>{
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

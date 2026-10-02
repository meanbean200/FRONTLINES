import {describe,it,expect,vi} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {FormationWalker} from './FormationWalker';
import {TrenchNetwork} from '../garrison/TrenchNetwork';
import {distance,type Vec2} from '../core/types';
import {SaveSystem} from '../persistence/SaveSystem';
import {smokeMovement} from './SmokeMovement';

describe('shared smoke-aware movement, not changed path knowledge',()=>{
  it.each(['player','enemy'] as const)('%s crosses real multi-junction floor more cautiously but retains its order and arrives',side=>{
    const run=(smoked:boolean)=>{
      const state=createOperation('advance'),sim=new BattlefieldSimulation(state),q=state.squads.find(q=>q.faction===side)!,people=state.soldiers.filter(s=>s.squadId===q.id);
      const route:Vec2[]=[{x:-1830,z:-1760},{x:-1790,z:-1760},{x:-1790,z:-1720},{x:-1750,z:-1720},{x:-1750,z:-1680}];
      state.trenches=[{id:state.nextEntityId++,points:[{x:-1860,z:-1760},...route.slice(1)],width:4.2,depth:1.75,progress:1,status:'complete'},
        {id:state.nextEntityId++,points:[{x:-1820,z:-1720},route[2],{x:-1760,z:-1720}],width:4.2,depth:1.75,progress:1,status:'complete'},
        {id:state.nextEntityId++,points:[{x:-1750,z:-1760},route[3]],width:4.2,depth:1.75,progress:1,status:'complete'}];
      sim.terrain.syncModifications();const network=new TrenchNetwork();network.sync(state.trenches);vi.spyOn(sim.terrain.objects,'trunkAt').mockReturnValue(undefined);
      q.order={type:'move',issuedAt:0,drawnPath:route};q.route=route;const standing=structuredClone(q.order);
      people.forEach((p,i)=>{Object.assign(p,{x:route[0].x-i*1.15,z:route[0].z,heading:Math.PI/2});delete p.duty;});
      state.elapsed=10;state.operation!.smokeFields=smoked?[{id:state.nextEntityId++,x:-1775,z:-1730,radius:49,born:0,until:180}]:[];
      const walker=new FormationWalker(sim.terrain,sim.navigation),indices=new Map(people.map(p=>[p.id,1])),stalls=new Map<number,number>(),closest=new Map<number,{leg:number;distance:number}>();let maxStall=0,pauses=0,spread=0,wrongTurns=0;
      for(let tick=0;tick<3200&&indices.size;tick++){
        state.elapsed+=.05;walker.begin(state);
        for(const p of people){const index=indices.get(p.id);if(index===undefined)continue;const target=route[index];
          if(distance(p,target)<.4){if(index===route.length-1)indices.delete(p.id);else indices.set(p.id,index+1);continue;}
          const old={x:p.x,z:p.z};walker.walk(p,target,.05,network);const stopped=distance(old,p)<.0001;
          if(stopped&&p.action==='reorienting in smoke')pauses++;
          const stall=stopped?(stalls.get(p.id)??0)+.05:0;stalls.set(p.id,stall);maxStall=Math.max(maxStall,stall);
          const remaining=distance(p,target),best=closest.get(p.id);
          // A wrong branch/backtrack must take the person away from their
          // current waypoint, beyond ordinary local spacing adjustments.
          if(best?.leg===index&&remaining>best.distance+2)wrongTurns++;
          closest.set(p.id,{leg:index,distance:best?.leg===index?Math.min(best.distance,remaining):remaining});
          expect(network.corridorContains(p)).toBe(true);
        }
        spread=Math.max(spread,Math.max(...people.map(p=>distance(p,people[0]))));
      }
      expect(indices.size).toBe(0);expect(q.order).toEqual(standing);expect(q.route).toEqual(route);
      expect(wrongTurns).toBe(0);
      return {seconds:state.elapsed-10,maxStall,pauses,spread,arrived:people.length,wrongTurns};
    };
    const clear=run(false),smoked=run(true);expect(smoked.seconds).toBeGreaterThan(clear.seconds*1.1);expect(smoked.seconds).toBeLessThan(clear.seconds*1.8);expect(smoked.pauses).toBeGreaterThan(0);expect(smoked.maxStall).toBeLessThan(2);
    console.info('SMOKE_JUNCTION',JSON.stringify({side,clear,smoked}));
  },15000);
  it('saves a bounded reorientation and restores normal speed immediately when smoke clears',()=>{
    const state=createOperation('advance'),sim=new BattlefieldSimulation(state),p=state.soldiers[0];state.elapsed=10;p.heading=0;
    state.operation!.smokeFields=[{id:state.nextEntityId++,x:p.x,z:p.z,radius:18,born:0,until:100}];const target={x:p.x+8,z:p.z};
    expect(smokeMovement(state,p,target)).toBe(0);const restored=new SaveSystem().parse(JSON.stringify(state)),copy=restored.soldiers.find(s=>s.id===p.id)!;
    expect(copy.smokeAwareness).toEqual(p.smokeAwareness);
    state.elapsed=restored.elapsed=10.95;expect(smokeMovement(restored,copy,target)).toBe(smokeMovement(state,p,target));expect(smokeMovement(state,p,target)).toBeGreaterThan(0);
    state.operation!.smokeFields=[];expect(smokeMovement(state,p,target)).toBe(1);expect(p.smokeAwareness).toBeUndefined();expect(sim.state.squads[0].order.type).toBe('hold');
  });
});

import {describe,it,expect,vi} from 'vitest';
import {createBattlefield,addSquad} from '../simulation/createBattlefield';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {FormationWalker} from './FormationWalker';
import {TrenchNetwork} from '../garrison/TrenchNetwork';
import {distance,type Vec2} from '../core/types';
import {bodyBlocks} from './FriendlyTraffic';

describe('P0 friendly traffic and local route joining',()=>{
  it('does not send a near-destination member back to the formation anchor',()=>{
    const state=createBattlefield();state.soldiers=[];state.squads=[];state.trenches=[];
    const q=addSquad(state,'rifle',8,-1840,-1700,'Split route'),sim=new BattlefieldSimulation(state),p=state.soldiers[0];
    p.x=-1512;p.z=-1700;sim.issueMove([q.id],{x:-1510,z:-1700});
    let lowestX=p.x;
    for(let i=0;i<300;i++){sim.step(.05);lowestX=Math.min(lowestX,p.x);}
    expect(lowestX).toBeGreaterThan(-1520);expect(distance(p,{x:-1510,z:-1700})).toBeLessThan(10);
  });
  it('friendly overlap does not remove enemy or wall constraints',()=>{
    const state=createBattlefield(),sim=new BattlefieldSimulation(state),p=state.soldiers[0],other=state.soldiers[1],next={x:p.x+.1,z:p.z};
    other.x=p.x+.5;other.z=p.z;expect(bodyBlocks(state,p,other,next,1)).toBe(false);
    const q=addSquad(state,'rifle',1,0,0,'Opponent');q.faction='enemy';other.squadId=q.id;
    expect(bodyBlocks(state,p,other,next,1)).toBe(true);
    const b=sim.terrain.buildings[0];expect(sim.terrain.obstacleAt(b.x,b.z,.5)).toBe(true);
  });
  it('96 walkers pass a narrow T with counterflow without two-second body jams',()=>{
    const state=createBattlefield();state.soldiers=[];state.squads=[];state.trenches=[];state.craters=[];
    for(let i=0;i<12;i++)addSquad(state,'rifle',8,0,0,`Traffic ${i}`);
    const junction={x:-1720,z:-1740},ends=[{x:-1820,z:-1740},{x:-1620,z:-1740},{x:-1720,z:-1640}];
    state.trenches=[{id:state.nextEntityId++,points:[ends[0],ends[1]],width:2.2,depth:1.75,progress:1,status:'complete'},
      {id:state.nextEntityId++,points:[junction,ends[2]],width:2.2,depth:1.75,progress:1,status:'complete'}];
    const sim=new BattlefieldSimulation(state),walker=new FormationWalker(sim.terrain,sim.navigation),graph=new TrenchNetwork();graph.sync(state.trenches);
    // Treeless supplied/unopposed walking fixture; real corridor boundaries are
    // enforced on every step. This isolates body traffic, not terrain routing.
    vi.spyOn(sim.terrain.objects,'trunkAt').mockReturnValue(undefined);
    const routes=new Map<number,Vec2[]>(),starts=new Map<number,Vec2>();
    state.soldiers.forEach((p,i)=>{
      const arm=Math.floor(i/32),offset=i%32,start=ends[arm],dest=ends[(arm+1)%3];
      const fraction=.38+offset*.016;p.x=junction.x+(start.x-junction.x)*fraction;p.z=junction.z+(start.z-junction.z)*fraction;
      const end={x:junction.x+(dest.x-junction.x)*fraction,z:junction.z+(dest.z-junction.z)*fraction};
      routes.set(p.id,[junction,end]);starts.set(p.id,{x:p.x,z:p.z});
    });
    const run=(isolated:boolean)=>{
      state.elapsed=0;const indices=new Map(state.soldiers.map(p=>[p.id,0])),stalls=new Map<number,number>();let maxStall=0;
      for(const p of state.soldiers)Object.assign(p,starts.get(p.id));
      for(let tick=0;tick<7000&&indices.size;tick++){
        state.elapsed+=.05;walker.begin(state);
        for(const p of state.soldiers){const index=indices.get(p.id);if(index===undefined)continue;
          if(isolated)walker.begin({...state,soldiers:[p]});
          const route=routes.get(p.id)!,target=route[index],before={x:p.x,z:p.z};
          if(distance(p,target)<.25){if(index===1)indices.delete(p.id);else indices.set(p.id,index+1);stalls.set(p.id,0);continue;}
          walker.walk(p,target,.05,graph);expect(graph.corridorContains(p)).toBe(true);
          const stalled=distance(before,p)<.001?(stalls.get(p.id)??0)+.05:0;stalls.set(p.id,stalled);maxStall=Math.max(maxStall,stalled);
        }
      }
      expect(indices.size).toBe(0);return {seconds:state.elapsed,maxStall};
    };
    const isolated=run(true),crowded=run(false);
    expect(crowded.maxStall).toBeLessThanOrEqual(2);expect(crowded.seconds).toBeLessThan(2*isolated.seconds);
    console.info('T-junction walking fixture',JSON.stringify({isolated,crowded}));
  },20000);
});

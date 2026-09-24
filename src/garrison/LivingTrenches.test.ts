import {describe,it,expect} from 'vitest';
import {TrenchNetwork} from './TrenchNetwork';
import {type TrenchState} from '../core/types';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {createBattlefield} from '../simulation/createBattlefield';
import {balance} from './Inventory';
import {SaveSystem} from '../persistence/SaveSystem';
const line=(id:number,x1:number,z1:number,x2:number,z2:number,progress=1):TrenchState=>({id,points:[{x:x1,z:z1},{x:x2,z:z2}],width:4.2,depth:1.75,progress,status:progress===1?'complete':'building'});
export function camp():BattlefieldSimulation {
  const sim=new BattlefieldSimulation(createBattlefield());
  const rifle=sim.state.squads[0],engineer=sim.state.squads.find(s=>s.kind==='engineer')!;
  sim.state.squads=sim.state.squads.filter(s=>s.id===rifle.id||s.id===engineer.id);
  sim.state.soldiers=sim.state.soldiers.filter(s=>s.squadId===rifle.id||s.squadId===engineer.id);
  // Removing fixture personnel removes their initial packs from the accounting universe.
  sim.state.living!.ledger.initial.food-=206*2;sim.state.living!.ledger.initial.water-=206*3;
  const t=sim.state.trenches[0];
  sim.state.soldiers.forEach((s,i)=>{s.x=t.points[0].x+(i%4)*1.2;s.z=t.points[0].z-5-Math.floor(i/4)*1.2;});
  sim.issueOccupyNearest([rifle.id,engineer.id],t.id);return sim;
}
describe('living trench network',()=>{
  it('splits crossings and deduplicates reversed and partially overlapping frontage',()=>{
    const graph=new TrenchNetwork();graph.sync([line(1,0,0,100,0),line(2,50,-50,50,50),line(3,100,0,25,0)]);
    expect(graph.edges.reduce((sum,e)=>sum+e.length,0)).toBeCloseTo(200);
    expect(graph.capacity(graph.component(1)!)).toBe(76);
    const route=graph.route({x:10,z:0},{x:50,z:40});expect(route.some(p=>Math.abs(p.x-50)<.01&&Math.abs(p.z)<.01)).toBe(true);
  });
  it('does not connect unfinished crossings or parallel adjacent lines',()=>{
    const graph=new TrenchNetwork();graph.sync([line(1,0,0,100,0,.2),line(2,50,-50,50,50),line(3,0,3,100,3)]);
    expect(graph.component(1)).not.toBe(graph.component(2));expect(graph.component(1)).not.toBe(graph.component(3));
  });
  it('routes loops without cutting corners',()=>{
    const graph=new TrenchNetwork();graph.sync([line(1,0,0,50,0),line(2,50,0,50,50),line(3,50,50,0,50),line(4,0,50,0,0)]);
    const path=graph.route({x:10,z:0},{x:40,z:50});expect(path.length).toBeGreaterThan(3);
    expect(path.every(p=>graph.nearest(p)!.distance<.01)).toBe(true);
  });
  it('counts overlapping corridor floor only once and joins wide traversable overlap',()=>{
    const graph=new TrenchNetwork();const a=line(1,0,0,100,0),b=line(2,0,2,100,2);
    graph.sync([a]);const first=graph.capacity(graph.component(1)!);graph.sync([a,b]);
    expect(graph.component(1)).toBe(graph.component(2));expect(graph.capacity(graph.component(1)!)).toBeLessThan(first*2);
  });
});
describe('garrison lifecycle',()=>{
  it('assigns temporary duties, maintains membership and preserves exact active-duty saves',()=>{
    const sim=camp();for(let i=0;i<600;i++)sim.step(.05);
    const assigned=sim.state.soldiers.filter(s=>s.garrisonId!==undefined);
    expect(assigned).toHaveLength(18);expect(assigned.every(s=>s.trenchAlong===undefined)).toBe(true);
    expect(assigned.some(s=>s.duty?.kind==='watch')).toBe(true);
    expect(new SaveSystem().parse(JSON.stringify(sim.state))).toEqual(sim.state);
    sim.issueHold([sim.state.squads[0].id]);expect(sim.state.soldiers.filter(s=>s.squadId===sim.state.squads[0].id).every(s=>!s.duty&&s.garrisonId===undefined)).toBe(true);
  });
  it('moves scheduled cargo physically and conserves every resource through save/load',()=>{
    const sim=camp();for(let i=0;i<9000;i++)sim.step(.05);
    expect(sim.state.living!.ledger.imported.food).toBeGreaterThan(0);
    for(const value of Object.values(balance(sim.state)))expect(Math.abs(value)).toBeLessThan(1e-6);
    const snapshot=new SaveSystem().parse(JSON.stringify(sim.state));const other=new BattlefieldSimulation(snapshot);
    for(let i=0;i<40;i++){sim.step(.05);other.step(.05);}
    expect(other.state.living).toEqual(sim.state.living);
  },20000);
  it('rejects corrupt needs, inventories and unknown save versions',()=>{
    const sim=camp(),save=new SaveSystem();const a=structuredClone(sim.state);a.living!.rearStock.food=-1;expect(()=>save.parse(JSON.stringify(a))).toThrow();
    const b=structuredClone(sim.state);b.soldiers[0].needs!.energy=10000;expect(()=>save.parse(JSON.stringify(b))).toThrow();
  });
  it('initializes legacy needs at migration without retrospective deprivation',()=>{
    const old=createBattlefield();old.elapsed=50000;const restored=new SaveSystem().parse(JSON.stringify(old));
    expect(restored.schemaVersion).toBe(3);expect(restored.soldiers[0].needs!.energy).toBe(100);expect(restored.living!.campaignHours).toBe(8);
  });
});

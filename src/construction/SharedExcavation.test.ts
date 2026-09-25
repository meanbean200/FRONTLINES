import {describe,it,expect} from 'vitest';
import {addSquad,createBattlefield} from '../simulation/createBattlefield';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {SaveSystem} from '../persistence/SaveSystem';
import {trenchWorkforce} from '../ui/TrenchReadout';
function fixture(join=false){
  const s=createBattlefield(),q=s.squads.find(q=>q.kind==='engineer')!;s.squads=[q];s.soldiers=s.soldiers.filter(p=>p.squadId===q.id);s.trenches=[];s.craters=[];
  q.x=-1800;q.z=-1710;s.soldiers.forEach((p,i)=>{p.x=q.x+(i%4)*1.5;p.z=q.z-Math.floor(i/4)*1.5;});
  addSquad(s,'rifle',8,-1810,-1710,'Helpers');const helper=s.squads.at(-1)!;
  const sim=new BattlefieldSimulation(s),id=sim.createTrench([{x:-1940,z:-1700},{x:-1640,z:-1700}],q.id)!,t=s.trenches.find(t=>t.id===id)!;
  if(join)expect(sim.resumeConstruction([helper.id],id)).toBe(1);
  return {sim,s,q,helper,t};
}
const run=(sim:BattlefieldSimulation,seconds:number)=>{for(let i=0;i<seconds*20;i++)sim.step(.05);};
describe('shared physical excavation',()=>{
  it('additional ordinary hands join a tool-equipped project and increase real work after arriving',()=>{
    const one=fixture(),two=fixture(true);run(one.sim,55);run(two.sim,55);
    expect(two.t.progress).toBeGreaterThan(one.t.progress);const crew=trenchWorkforce(two.s,two.t);
    expect(crew.assigned).toBe(16);expect(crew.helpers).toBeGreaterThan(0);expect(crew.digging).toBeGreaterThan(0);
    expect(two.s.soldiers.filter(p=>p.equipment?.tools).length).toBe(8);
    const loaded=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(two.s)));run(two.sim,4);run(loaded,4);expect(loaded.state).toEqual(two.s);
    two.sim.issueHold([two.helper.id]);run(two.sim,3);expect(two.helper.order.type).toBe('hold');expect(two.q.order.type).toBe('construct-trench');
  });
  it('one, four and eight workers produce increasing excavation with physical workface limits',()=>{
    const progress:number[]=[];
    for(const count of [1,4,8]){const {sim,s,q,t}=fixture();const ids=q.soldierIds.slice(count);s.soldiers=s.soldiers.filter(p=>!ids.includes(p.id));q.soldierIds=q.soldierIds.slice(0,count);run(sim,45);progress.push(t.progress);}
    expect(progress[1]).toBeGreaterThan(progress[0]);expect(progress[2]).toBeGreaterThan(progress[1]);
  });
  it('an explicit helper join does not change implicit local R or steal a weapon crew',()=>{
    const {sim,helper,t}=fixture();expect(sim.resumeConstruction([helper.id])).toBe(0);expect(sim.resumeConstruction([helper.id],t.id)).toBe(1);
    sim.issueHold([helper.id]);expect(sim.resumeConstruction([helper.id])).toBe(0);
  });
  it('keeps helpers on queued branches when the first trench completes, and resumes after tools return',()=>{
    const {sim,s,q,helper,t}=fixture(true),branch=sim.createTrench([{x:-1800,z:-1700},{x:-1800,z:-1880}],q.id)!;
    run(sim,140);expect(helper.engineerWork?.projectTrenches).toContain(branch);
    expect(helper.order.type).toBe('construct-trench');expect(helper.engineerWork?.projectId).toBe(q.engineerWork?.projectId);
    const work=s.trenches.find(p=>p.id===branch)!;sim.issueHold([q.id]);const held=work.progress;run(sim,3);expect(work.progress).toBe(held);expect(helper.order.type).toBe('construct-trench');
    expect(sim.resumeConstruction([q.id],branch)).toBe(1);run(sim,6);expect(helper.engineerWork?.projectId).toBe(q.engineerWork?.projectId);
    const loaded=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(s)));run(sim,3);run(loaded,3);expect(loaded.state).toEqual(s);expect(t.progress).toBeGreaterThan(.5);
  });
});

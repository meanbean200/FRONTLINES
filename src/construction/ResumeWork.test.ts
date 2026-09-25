import {describe,it,expect} from 'vitest';
import {createStudyScenario} from '../garrison/StudyScenario';
import {resumeWorkChoices} from './ResumeWork';
import {SaveSystem} from '../persistence/SaveSystem';
import {inventory} from '../garrison/types';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
function fixture(){
  const sim=createStudyScenario(),s=sim.state,q=s.squads[0],g=s.living!.garrisons[0],main=s.trenches[0];
  const people=s.soldiers.filter(p=>p.squadId===q.id);people.forEach((p,i)=>p.equipment!.tools=i===0);
  const job=(x:number,z:number,owner?:number)=>{const t={id:s.nextEntityId++,points:[{x,z},{x,z:z+30}],width:4.2,depth:1.75,progress:.1,status:'planned' as const,engineerSquadId:owner};s.trenches.push(t);return t;};
  const choices=()=>{sim.garrisons.network.sync(s.trenches);return resumeWorkChoices(s,sim.garrisons.network,q,t=>[t.points[0]]);};
  const local=()=>job(main.points[0].x,main.points[0].z,q.id);
  return {sim,s,q,g,main,people,job,choices,local};
}
describe('R local continuation contexts',()=>{
  it('defending plus a distant job does not release the defense assignment',()=>{const f=fixture();f.job(f.q.x+250,f.q.z);const before=JSON.stringify(f.q);expect(f.sim.resumeConstruction([f.q.id])).toBe(0);expect(JSON.stringify(f.q)).toBe(before);});
  it('resumes a previous local branch ahead of an unrelated job',()=>{const f=fixture(),t=f.local();f.job(f.q.x+100,f.q.z);expect(f.choices().candidates[0].trench.id).toBe(t.id);});
  it('does not steal a weapon crew',()=>{const f=fixture();f.local();f.s.living!.facilities.push({id:f.s.nextEntityId++,garrisonId:f.g.id,kind:'emplacement',x:f.q.x,z:f.q.z,connectorId:f.main.id,progress:1,capacity:2,paid:true,stock:inventory(),materialCost:16,weaponCrewIds:[f.people[0].id]});expect(f.choices().reason).toContain('Crew');});
  it('uses actual tools in a mixed formation, not its class',()=>{const f=fixture(),t=f.local();expect(f.q.kind).toBe('rifle');expect(f.choices().candidates[0].trench).toBe(t);f.people[0].equipment!.tools=false;expect(f.choices().reason).toContain('tool');});
  it('does not override building occupation',()=>{const f=fixture();f.local();f.q.order.building={id:0,floor:0};expect(f.choices().reason).toContain('Building');});
  it('does not override explicitly ordered rest',()=>{const f=fixture();f.local();f.people[0].duty={kind:'sleep',destination:f.people[0],route:[],routeIndex:0,since:0,until:100,blockedFor:0,reason:'Player rest',playerOrdered:true};expect(f.choices().reason).toContain('rest');});
  it('rejects a nearby but disconnected other network',()=>{const f=fixture();f.job(f.main.points[0].x,f.main.points[0].z+35);expect(f.choices().candidates).toHaveLength(0);});
  it('does not prefer a distant earlier owner over a valid near branch',()=>{const f=fixture();f.job(f.q.x+300,f.q.z,f.q.id);const near=f.local();expect(f.choices().candidates.map(c=>c.trench.id)).toEqual([near.id]);});
  it('makes the same choice after save/load',()=>{const f=fixture(),t=f.local(),loaded=new SaveSystem().parse(JSON.stringify(f.s)),next=new BattlefieldSimulation(loaded);expect(next.previewResume(f.q.id).candidates[0].trench.id).toBe(t.id);});
  it('does not resume enemy excavation, even nearby',()=>{const f=fixture(),t=f.local();f.s.squads[1].faction='enemy';t.engineerSquadId=f.s.squads[1].id;expect(f.choices().candidates).toHaveLength(0);});
});

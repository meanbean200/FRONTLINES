import {describe,it,expect} from 'vitest';
import {createStudyScenario} from '../garrison/StudyScenario';
import {balance,transfer} from '../garrison/Inventory';
import {SaveSystem} from '../persistence/SaveSystem';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {migrateExplicitWorkQueues} from './WorkAssignments';
import {chooseEngineer} from './ConstructionReadout';

const run=(s:BattlefieldSimulation,n:number)=>{for(let i=0;i<n*20;i++)s.step(.05);};
function fixture(){
  const sim=createStudyScenario(),s=sim.state,g=s.living!.garrisons[0],t=s.trenches[0];s.living!.lethalNeeds=false;
  // Three real tool sets are deliberately scarce. All resources remain in the ledger.
  s.soldiers.forEach((p,i)=>p.equipment!.tools=i<3);
  transfer(s.living!.rearStock,g.cache,'materials',30);
  const ids=[30,65,100].map(offset=>{const origin={x:t.points[0].x+offset,z:t.points[0].z};return sim.requestConstruction({kind:'facility',garrisonId:g.id,facilityKind:'emplacement',origin,position:origin,facing:0})!;});
  return {sim,s,g,ids,jobs:ids.map(id=>s.living!.facilities.find(f=>f.id===id)!)};
}
describe('multi-build skill and ownership reliability',()=>{
  it('distributes scarce tools across three simultaneous jobs and never duplicates a worker',()=>{
    const {s,jobs}=fixture();expect(jobs).toHaveLength(3);
    for(const f of jobs)expect(f.workOrder!.workerIds.filter(id=>s.soldiers.find(p=>p.id===id)!.equipment!.tools)).toHaveLength(1);
    const ids=jobs.flatMap(f=>f.workOrder!.workerIds);expect(new Set(ids).size).toBe(ids.length);
    expect(s.squads.flatMap(q=>q.constructionQueue??[])).toEqual([]);
  });
  it('completes all three through real carrier/work movement with inventory conserved',()=>{
    const {sim,s,jobs}=fixture(),before=balance(s);run(sim,450);
    expect(jobs.map(f=>f.progress)).toEqual([1,1,1]);for(const key of Object.keys(before) as (keyof typeof before)[])expect(balance(s)[key]).toBeCloseTo(before[key],6);
  },15000);
  it('Auto workers repairs a full labor-only crew without evicting carriers',()=>{
    const {sim,s,jobs}=fixture(),f=jobs[2],tool=f.workOrder!.workerIds.find(id=>s.soldiers.find(p=>p.id===id)!.equipment!.tools)!;
    s.soldiers.find(p=>p.id===tool)!.equipment!.tools=false;
    const spare=s.soldiers.find(p=>!jobs.some(f=>f.workOrder!.workerIds.includes(p.id)))!;spare.equipment!.tools=true;
    const old=[...f.workOrder!.workerIds];expect(sim.garrisons.autoWorkers(f.id).accepted).toBe(true);
    expect(f.workOrder!.workerIds).toEqual([...old,spare.id]);
  });
  it('new trench placement cannot silently release assigned structure workers',()=>{
    const {sim,s,jobs}=fixture(),person=s.soldiers.find(p=>p.id===jobs[0].workOrder!.workerIds[0])!,q=s.squads.find(q=>q.id===person.squadId)!,before=structuredClone(jobs[0].workOrder);
    expect(chooseEngineer(s,new Set([q.id]))?.id).not.toBe(q.id);
    expect(sim.createTrench([{x:q.x,z:q.z-30},{x:q.x+30,z:q.z-30}],q.id)).toBeUndefined();expect(jobs[0].workOrder).toEqual(before);
  });
  it('does not borrow a soldier ordered into a house before entry starts, and repairs the old conflicting reservation',()=>{
    const {sim,s,jobs}=fixture(),f=jobs[0],id=f.workOrder!.workerIds[0],person=s.soldiers.find(p=>p.id===id)!,q=s.squads.find(q=>q.id===person.squadId)!;
    sim.issueBuilding([q.id],0,0);expect(f.workOrder!.workerIds).not.toContain(id);
    expect(sim.garrisons.assignWorker(f.id,id).reason).toContain('building order');
    sim.garrisons.autoWorkers(f.id);expect(jobs.flatMap(j=>j.workOrder!.workerIds).some(id=>q.soldierIds.includes(id))).toBe(false);
    // A saved old assignment must not strand its helpers indefinitely.
    f.workOrder!.workerIds.push(id);person.personalArea=true;person.garrisonId=f.garrisonId;
    const cargo=structuredClone(person.carried),point={x:person.x,z:person.z};sim.garrisons.autoWorkers(f.id);
    expect(f.workOrder!.workerIds).not.toContain(id);expect(person.garrisonId).toBeUndefined();expect(person.carried).toEqual(cargo);expect({x:person.x,z:person.z}).toEqual(point);
    // Recreate the legacy conflict and let the entire coordinator repair it:
    // its stale pre-repair people snapshot must not reattach a ghost duty.
    f.workOrder!.workerIds.push(id);person.personalArea=true;person.garrisonId=f.garrisonId;
    s.living!.garrisons.find(g=>g.id===f.garrisonId)!.nextDecision=0;run(sim,1);
    expect(person.duty).toBeUndefined();expect(()=>new SaveSystem().parse(JSON.stringify(s))).not.toThrow();
  });
  it('cancelling one job leaves other workers, materials and sites intact',()=>{
    const {sim,s,jobs}=fixture();run(sim,10);const others=structuredClone(jobs.slice(1));const before=balance(s);
    expect(sim.garrisons.cancelWork(jobs[0].id).accepted).toBe(true);expect(jobs.slice(1)).toEqual(others);expect(balance(s)).toEqual(before);
  });
  it('continues exact multi-build progress after a mid-delivery save',()=>{
    const {sim,s}=fixture();run(sim,12);const copy=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(s)));run(sim,150);run(copy,150);expect(copy.state).toEqual(s);
  },15000);
  it('migration removes only duplicate explicit queue references',()=>{
    const {s,jobs}=fixture(),q=s.squads[0];q.constructionQueue=[17,{kind:'facility',id:jobs[0].id},{kind:'facility',id:999}];
    const sites=structuredClone(s.living!.facilities),people=structuredClone(s.soldiers);migrateExplicitWorkQueues(s);
    expect(q.constructionQueue).toEqual([17,{kind:'facility',id:999}]);expect(s.living!.facilities).toEqual(sites);expect(s.soldiers).toEqual(people);
  });
});

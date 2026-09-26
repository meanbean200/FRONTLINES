import {it,expect} from 'vitest';
import {createStudyScenario} from './StudyScenario';
import {SaveSystem} from '../persistence/SaveSystem';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
const step=(sim:BattlefieldSimulation,seconds:number)=>{for(let i=0;i<seconds*20;i++)sim.step(.05);};
it('prefers a reachable built dugout, falls back when full, and resumes identically after saving the approach',()=>{
  const sim=createStudyScenario(),s=sim.state,g=s.living!.garrisons[0];g.nextSupport=1e9;
  const restId=sim.garrisons.requestFacility(g.id,'rest',undefined,undefined,undefined,true)!,rest=s.living!.facilities.find(f=>f.id===restId)!;
  for(let n=0;n<20000&&rest.progress<1;n++)sim.step(.05);expect(rest.progress).toBe(1);
  const p=s.soldiers.find(p=>p.garrisonId===g.id&&p.duty?.kind!=='watch')!;
  const duty=()=>s.soldiers.find(other=>other.id===p.id)!.duty;
  delete p.duty;p.needs!.energy=20;p.needs!.hunger=p.needs!.thirst=10;g.nextDecision=0;sim.step(.05);
  expect(duty()?.kind).toBe('sleep');expect(duty()?.facilityId).toBe(rest.id);
  const copy=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(s)));step(sim,4);step(copy,4);expect(copy.state).toEqual(s);
  const sleepers=s.soldiers.filter(other=>other!==p).slice(0,rest.capacity);
  for(const other of sleepers)other.duty={kind:'sleep',destination:rest,route:[],routeIndex:0,since:s.elapsed,until:s.elapsed+600,arrivedAt:s.elapsed,facilityId:rest.id,reason:'Reserved bed fixture',blockedFor:0};
  delete p.duty;p.needs!.energy=20;g.nextDecision=0;sim.step(.05);expect(duty()?.kind).toBe('sleep');expect(duty()?.facilityId).toBeUndefined();
},20000);

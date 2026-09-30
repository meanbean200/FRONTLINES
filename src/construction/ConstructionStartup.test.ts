import {it,expect} from 'vitest';
import {createStudyScenario} from '../garrison/StudyScenario';
import {distance} from '../core/types';
import {balance,transfer} from '../garrison/Inventory';
import {inventory} from '../garrison/types';
import {workReadout} from '../ui/PositionReadout';
import {SaveSystem} from '../persistence/SaveSystem';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';

it('assigns a supplied nearby work party immediately, then waits for actual material arrival before work',()=>{
  const sim=createStudyScenario(),s=sim.state,g=s.living!.garrisons[0],t=s.trenches[0];g.nextSupport=1e9;
  const at={x:g.entrance.x+8,z:g.entrance.z};
  for(const [i,p] of s.soldiers.entries()){p.x=g.entrance.x+(i%8-3)*2;p.z=g.entrance.z+(Math.floor(i/8)-1)*.8;delete p.duty;}
  const id=sim.requestConstruction({kind:'facility',garrisonId:g.id,facilityKind:'emplacement',origin:at,position:at,facing:0})!,f=s.living!.facilities.find(f=>f.id===id)!;
  expect(f.workOrder!.workerIds).toHaveLength(2);expect(workReadout(s,f).status).toBe('COLLECTING MATERIALS');expect(f.progress).toBe(0);
  let assigned=0,arrived=0,firstWork=0;
  for(let i=0;i<1600&&!firstWork;i++){
    sim.stepFixed();if(!assigned&&s.soldiers.some(p=>p.duty?.facilityId===id))assigned=s.elapsed;
    if(!arrived&&f.paid)arrived=s.elapsed;
    if(f.progress>0)firstWork=s.elapsed;
  }
  console.info('SUPPLIED_CONSTRUCTION_STARTUP',JSON.stringify({assigned,materialsArrived:arrived,firstWork}));
  expect(assigned).toBeLessThanOrEqual(.1);expect(arrived).toBeGreaterThan(3);expect(firstWork).toBeGreaterThanOrEqual(arrived);expect(firstWork).toBeLessThan(45);
  expect(s.trenches.find(p=>p.id===t.id)!.progress).toBe(1);expect(Object.values(balance(s)).every(n=>Math.abs(n)<1e-6)).toBe(true);
});

it('uses a nearby finite crate and local legal entry for work, without a compulsory walk to the central entrance',()=>{
  const sim=createStudyScenario(),s=sim.state,g=s.living!.garrisons[0],t=s.trenches[0];g.nextSupport=1e9;
  const at={x:t.points[0].x+12,z:t.points[0].z};
  transfer(g.cache,s.living!.rearStock,'materials',g.cache.materials);
  const crate={id:s.nextEntityId++,x:at.x,z:at.z-10,faction:'player' as const,stock:inventory()};transfer(s.living!.rearStock,crate.stock,'materials',16);s.living!.crates.push(crate);
  for(const [i,p] of s.soldiers.entries()){p.x=at.x+Math.floor(i/2)*2;p.z=at.z+(i%2?-.8:.8);delete p.duty;}
  const id=sim.requestConstruction({kind:'facility',garrisonId:g.id,facilityKind:'emplacement',origin:at,position:at,facing:0})!,f=s.living!.facilities.find(f=>f.id===id)!;
  let sawCargo=false,copy:BattlefieldSimulation|undefined;
  for(let i=0;i<2400&&f.progress===0;i++){
    sim.stepFixed();copy?.stepFixed();
    const p=s.soldiers.find(p=>p.duty?.facilityId===id&&p.duty?.crateId===crate.id&&p.duty.stage==='deliver'&&(p.carried?.materials??0)>0);
    if(p&&!sawCargo){sawCargo=true;expect(distance(p.duty!.entryPoint!,crate)).toBeLessThan(15);copy=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(s)));}
  }
  expect(sawCargo).toBe(true);expect(f.progress).toBeGreaterThan(0);expect(copy?.state).toEqual(s);expect(crate.stock.materials).toBe(0);expect(Object.values(balance(s)).every(n=>Math.abs(n)<1e-6)).toBe(true);
});

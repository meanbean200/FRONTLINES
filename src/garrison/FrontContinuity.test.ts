import {describe,it,expect} from 'vitest';
import {createStudyScenario} from './StudyScenario';
import {SaveSystem} from '../persistence/SaveSystem';
describe('world-facing watch after real movement and relief',()=>{
  it.each([0,Math.PI/2,Math.PI,-Math.PI/2])('retains front %s through patrol/rest and save',front=>{
    const sim=createStudyScenario(1944,1),s=sim.state,g=s.living!.garrisons[0];g.nextSupport=1e9;
    sim.garrisons.setFront(g.id,front);
    for(let i=0;i<2400;i++)sim.step(.05);
    const watch=s.soldiers.filter(p=>p.garrisonId===g.id&&p.duty?.kind==='watch'&&p.duty.arrivedAt!==undefined);
    expect(watch.length).toBeGreaterThan(0);for(const p of watch)expect(Math.cos(p.heading-front)).toBeCloseTo(1,4);
    const loaded=new SaveSystem().parse(JSON.stringify(s));expect(loaded.living!.garrisons[0].front).toBe(front);
  });
});

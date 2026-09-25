import {describe,it,expect} from 'vitest';
import {createStudyScenario} from '../garrison/StudyScenario';
import {TrenchRenderer} from './TrenchRenderer';
import {TrenchSystem} from '../construction/TrenchSystem';
import {trenchTimbers} from './TrenchDressing';

describe('trench dressing follows current earthwork',()=>{
  it('rebuilds existing revetment when adjoining excavation opens a junction',()=>{
    const sim=createStudyScenario(),t=sim.state.trenches[0];
    t.points=[{x:-100,z:-700},{x:100,z:-700}];t.progress=1;t.status='complete';
    sim.terrain.syncModifications();const renderer=new TrenchRenderer(sim.state,sim.terrain);
    renderer.update(80);const old=renderer.group.children[0];
    const branch=new TrenchSystem(sim.state).create([{x:0,z:-700},{x:0,z:-650}]);branch.progress=1;branch.status='complete';
    sim.terrain.syncModifications();renderer.update(80);
    expect(renderer.group.children.includes(old)).toBe(false);
  });
  it('does not rebuild a finished line for remote work, and seats dressing on the real bank',()=>{
    const sim=createStudyScenario(),t=sim.state.trenches[0],renderer=new TrenchRenderer(sim.state,sim.terrain);
    renderer.update(80);const old=renderer.group.children[0];
    const branch=sim.trenches.create([{x:1000,z:1000},{x:1060,z:1000}]);branch.progress=1;branch.status='complete';sim.terrain.syncModifications();renderer.update(80);
    expect(renderer.group.children.includes(old)).toBe(true);
    for(const width of [4.2,7.2]){t.width=width;sim.terrain.syncModifications();const parts=trenchTimbers(t,sim.terrain);
      expect(parts.some(p=>p.role==='bank')).toBe(true);
      for(const p of parts){expect(p.y-sim.terrain.heightAt(p.x,p.z)).toBeCloseTo(.026);expect([p.pitch,p.roll,p.y].every(Number.isFinite)).toBe(true);}
    }
  });
});

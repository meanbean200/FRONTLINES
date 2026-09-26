import {describe,it,expect,vi,afterEach} from 'vitest';
import {AttractCycle} from './AttractCycle';
import {AsyncSquadPlanner} from '../navigation/AsyncSquadPlanner';
import {emptyScenarioWorld} from '../scenarios/instantiateScenario';
describe('attract lifecycle',()=>{
 it('resets on resolution, four minutes, or sixty seconds after contact without fire',()=>{const c=new AttractCycle();expect(c.update(70,'active',false,0)).toBeUndefined();expect(c.update(80,'active',true,0)).toBeUndefined();expect(c.update(139.95,'active',false,0)).toBeUndefined();expect(c.update(140,'active',false,0)).toBe('quiet');c.reset();expect(c.update(239.95,'active',false,0)).toBeUndefined();expect(c.update(240,'active',false,0)).toBe('duration');c.reset();expect(c.update(10,'victory',false,0)).toBe('resolved');});
 it('fresh cycles do not inherit contact or activity across ten resets',()=>{const c=new AttractCycle();for(let n=0;n<10;n++){c.reset();expect(c.update(60,'active',false,0)).toBeUndefined();expect(c.update(70,'active',true,0)).toBeUndefined();expect(c.update(120,'active',false,1)).toBeUndefined();expect(c.update(179.95,'active',false,1)).toBeUndefined();expect(c.update(180,'active',false,1)).toBe('quiet');}});
});
describe('retired navigation owner',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 it('drops even an already captured old worker callback without invoking cancelled requests',()=>{
  let worker:any;class FakeWorker {onmessage:any;onerror:any;terminate=vi.fn();postMessage=vi.fn();constructor(){worker=this;}}
  vi.stubGlobal('Worker',FakeWorker);const planner=new AsyncSquadPlanner(),done=vi.fn();planner.plan({x:0,z:0},{x:1,z:1},emptyScenarioWorld(),done);const late=worker.onmessage;planner.dispose();late({data:{id:1,route:[{x:1,z:1}]}});expect(done).not.toHaveBeenCalled();expect(worker.terminate).toHaveBeenCalledOnce();expect(worker.onmessage).toBeNull();planner.dispose();expect(worker.terminate).toHaveBeenCalledOnce();
 });
});

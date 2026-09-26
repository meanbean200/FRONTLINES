import {afterEach,expect,it,vi} from 'vitest';
import {AsyncSquadPlanner} from './AsyncSquadPlanner';
import {emptyScenarioWorld} from '../scenarios/instantiateScenario';

afterEach(()=>vi.unstubAllGlobals());
it('terminates the old worker and ignores late results after a session switch',()=>{
 const workers:FakeWorker[]=[];
 class FakeWorker {
  onmessage:((event:{data:{id:number;route:{x:number;z:number}[]}})=>void)|null=null;
  onerror:(()=>void)|null=null;
  postMessage=vi.fn();terminate=vi.fn();
  constructor(){workers.push(this);}
 }
 vi.stubGlobal('Worker',FakeWorker);
 const state=emptyScenarioWorld(),oldDone=vi.fn(),newDone=vi.fn(),old=new AsyncSquadPlanner();
 old.plan({x:0,z:0},{x:10,z:10},state,oldDone);
 const lateResult=workers[0].onmessage!;
 old.dispose();old.dispose();
 const current=new AsyncSquadPlanner();current.plan({x:0,z:0},{x:20,z:20},state,newDone);
 lateResult({data:{id:1,route:[{x:10,z:10}]}});
 expect(oldDone).not.toHaveBeenCalled();expect(newDone).not.toHaveBeenCalled();
 expect(workers[0].terminate).toHaveBeenCalledOnce();expect(workers[0].onmessage).toBeNull();
 old.plan({x:0,z:0},{x:30,z:30},state,oldDone);expect(workers[0].postMessage).toHaveBeenCalledOnce();
 workers[1].onmessage!({data:{id:1,route:[{x:20,z:20}]}});
 expect(newDone).toHaveBeenCalledExactlyOnceWith([{x:20,z:20}]);current.dispose();
});

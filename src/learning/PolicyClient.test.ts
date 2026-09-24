import {afterEach,describe,it,expect,vi} from 'vitest';
import {PolicyClient} from './PolicyClient';
import {createStudyScenario} from '../garrison/StudyScenario';
class FakeWorker {
  static instance:FakeWorker;
  sent:{id:number}[]=[];
  onmessage?: (e:MessageEvent)=>void;
  onerror?:()=>void;
  constructor(){FakeWorker.instance=this;}
  postMessage(value:{id:number}){this.sent.push(value);}
  terminate(){}
  reply(value:Record<string,unknown>){this.onmessage?.({data:value} as MessageEvent);}
}
const setup=()=>{
  vi.stubGlobal('Worker',FakeWorker);vi.stubGlobal('window',{addEventListener:vi.fn()});
  const sim=createStudyScenario(),client=new PolicyClient(sim),g=sim.state.living!.garrisons[0];g.policy='learned';
  const request=()=>sim.garrisons.requestPolicy!(g,new Array(32).fill(0));
  return {sim,client,g,request,worker:FakeWorker.instance};
};
afterEach(()=>vi.unstubAllGlobals());
describe('browser neural transport boundary',()=>{
  it('rejects stale replies and replies belonging to an earlier loaded campaign',()=>{
    const {sim,g,request,worker}=setup();request();sim.state.elapsed=11;
    worker.reply({id:1,action:new Array(6).fill(0),modelId:'candidate',inferenceMs:.1});expect(sim.garrisons.policyActions.size).toBe(0);
    request();sim.replaceState(structuredClone(sim.state));
    worker.reply({id:2,action:new Array(6).fill(0),modelId:'candidate',inferenceMs:.1});expect(sim.garrisons.policyActions.has(g.id)).toBe(false);
  });
  it('pins model identity and immediately discards cached actions on failure',()=>{
    const {sim,g,client,request,worker}=setup();request();
    worker.reply({id:1,action:new Array(6).fill(.2),modelId:'candidate:hash',inferenceMs:.15});
    expect(g.modelId).toBe('candidate:hash');expect(client.inferenceMs).toBe(.15);expect(sim.garrisons.policyActions.size).toBe(1);
    request();worker.reply({id:2,error:'checksum mismatch'});
    expect(sim.garrisons.policyActions.size).toBe(0);expect(g.policyStatus).toContain('Fallback');
    request();worker.reply({id:3,action:new Array(6).fill(.2),modelId:'different:hash',inferenceMs:.1});
    expect(sim.garrisons.policyActions.size).toBe(0);expect(g.policyStatus).toContain('identity unavailable');
  });
  it('clears pending/cached actions if the policy worker itself fails',()=>{
    const {sim,g,request,worker}=setup();request();worker.reply({id:1,action:new Array(6).fill(0),modelId:'candidate',inferenceMs:.1});
    worker.onerror!();expect(sim.garrisons.policyActions.size).toBe(0);expect(g.policyStatus).toContain('worker failed');
  });
});

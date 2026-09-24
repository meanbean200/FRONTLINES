import type {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
export class PolicyClient {
  private worker=new Worker(new URL('./PolicyWorker.ts',import.meta.url),{type:'module'});
  private nextId=1;
  private pending=new Map<number,{garrisonId:number;state:BattlefieldSimulation['state'];at:number;mode:string}>();
  inferenceMs=0;
  constructor(simulation:BattlefieldSimulation){
    simulation.garrisons.requestPolicy=(g,observation)=>{
      for(const [id,p] of this.pending)if(p.state!==simulation.state||simulation.state.elapsed-p.at>10)this.pending.delete(id);
      if([...this.pending.values()].some(p=>p.garrisonId===g.id))return;
      const id=this.nextId++;this.pending.set(id,{garrisonId:g.id,state:simulation.state,at:simulation.state.elapsed,mode:g.policy});
      this.worker.postMessage({id,mode:g.policy,observation});
    };
    this.worker.onmessage=({data:r})=>{
      const p=this.pending.get(r.id);this.pending.delete(r.id);if(!p||p.state!==simulation.state)return;
      const g=simulation.state.living!.garrisons.find(g=>g.id===p.garrisonId);if(!g||g.policy!==p.mode||simulation.state.elapsed-p.at>10)return;
      if(r.error){simulation.garrisons.policyActions.delete(g.id);g.policyStatus=`Fallback: ${r.error}`;return;}
      if(g.modelId&&g.modelId!==r.modelId){simulation.garrisons.policyActions.delete(g.id);g.policyStatus='Fallback: saved model identity unavailable';return;}
      g.modelId=r.modelId;this.inferenceMs=r.inferenceMs;
      simulation.garrisons.policyActions.set(g.id,{at:p.at,action:r.action,modelId:r.modelId});
    };
    this.worker.onerror=()=>{for(const g of simulation.state.living!.garrisons)if(g.policy!=='rules')g.policyStatus='Fallback: policy worker failed';simulation.garrisons.policyActions.clear();this.pending.clear();};
    window.addEventListener('beforeunload',()=>this.worker.terminate(),{once:true});
  }
}

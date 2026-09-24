import type {BattlefieldState} from '../core/types';
export function signalEngagement(state:BattlefieldState):void {
  const op=state.operation;if(!op)return;
  const old=op.engagement;
  if(!old||state.elapsed-old.lastContact>30){
    op.engagement={lastContact:state.elapsed,number:(old?.number??0)+1};
    if(state.simSpeed>1)state.simSpeed=1;
  }else old.lastContact=state.elapsed;
}

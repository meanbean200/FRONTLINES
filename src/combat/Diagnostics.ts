import type {BattlefieldState} from '../core/types';

/** Explicit developer readout. Never supplies new information to a commander. */
export function combatDiagnostics(state:BattlefieldState){
  return {
    at:state.elapsed,
    soldiers:state.soldiers.map(s=>({id:s.id,squadId:s.squadId,position:{x:s.x,z:s.z},
      posture:s.posture??'standing',reaction:s.combat?.reaction??'steady',owner:s.combat?.owner??'order',
      suppression:s.suppression,morale:s.morale,threatDirection:s.combat?.threatDirection,
      desiredCover:s.combat?.reactionRoute?.[s.combat.reactionIndex??0],
      stoppedReason:s.combat?.pauseReason??squadReason(state,s.squadId),action:s.action,equipment:s.combat?.weapon?.id??'not equipped'})),
    support:(state.operation?.supportMissions??[]).map(m=>({...m,source:m.source??'LEGACY_UNKNOWN',ammoConsumed:m.ammoConsumed??null})),
    requests:structuredClone(state.operation?.supportRequests??[]),
  };
}
function squadReason(state:BattlefieldState,id:number){return state.squads.find(q=>q.id===id)?.orderNote??'';}

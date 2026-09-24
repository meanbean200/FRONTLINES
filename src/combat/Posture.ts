import type {SoldierState} from '../core/types';
export function postureOf(s:Partial<SoldierState>):NonNullable<SoldierState['posture']>{
  if(s.action==='sleeping'||s.needs?.life==='incapacitated'||s.needs?.life==='dead')return 'prone';
  return s.posture??((s.suppression??0)>65?'crouched':'standing');
}
export function postureSpeed(s:SoldierState):number{return postureOf(s)==='prone'?.2:postureOf(s)==='crouched'?.65:1;}

import {distance,type BattlefieldState,type Vec2} from '../core/types';
import {controlZone} from '../operations/ObjectiveControl';
import {total} from './Inventory';
import {inventory,type Garrison} from './types';

export function supplyPointAccess(state:BattlefieldState,townId:string,side:'player'|'enemy'='player'):string{
  const o=state.operation?.objectives.find(o=>o.id===townId);
  if(!o||o.owner!==side||o.contested)return 'AREA NOT SECURED';
  return '';
}
export function forwardAccess(state:BattlefieldState,g:Garrison):string{
  return g.supplyTownId?supplyPointAccess(state,g.supplyTownId,g.faction??'player'):'';
}
export function supplyPointTown(state:BattlefieldState,townId:string){
  const town=state.operation?.objectives.find(o=>o.id===townId);
  return town&&{town,point:controlZone(state,town)?.center??town};
}
export function pendingSupplyHandoff(state:BattlefieldState,g:Garrison):boolean{
  return state.living!.trucks.some(t=>!t.abandoned&&t.garrisonId===g.id&&['loading','outbound','unloading','blocked'].includes(t.state)&&t.resume!=='returning')||
    state.soldiers.some(s=>s.garrisonId===g.id&&s.duty?.kind==='haul'&&s.duty.stage==='pickup'&&!s.duty.crateId&&!s.duty.patientId&&!s.duty.facilityId||s.combat?.careTask&&distance(s.combat.careTask.destination,g.forward)<10);
}
/** Tick-owned changeover. Old stock becomes a physical recovery pile; neither
 * active haulers nor loaded trucks have their destination moved underneath them. */
export function changeSupplyPoint(state:BattlefieldState,g:Garrison,clear:(p:Vec2)=>boolean):void{
  const currentIssue=forwardAccess(state,g);
  if(currentIssue)g.supplyPointIssue=currentIssue;
  else if(g.supplyPointIssue==='AREA NOT SECURED')delete g.supplyPointIssue;
  const change=g.pendingSupplyPoint;if(!change)return;
  const blocked=supplyPointAccess(state,change.townId,g.faction??'player');
  if(blocked){g.supplyPointIssue=blocked;return;}
  if(pendingSupplyHandoff(state,g)){g.supplyPointIssue='CHANGE QUEUED · current handoff finishing';return;}
  if(!clear(change.point)){g.supplyPointIssue='NO ROAD ACCESS · change queued';return;}
  if(distance(g.forward,change.point)>.5&&total(g.forwardStock)>0){
    state.living!.crates.push({id:state.nextEntityId++,...g.forward,stock:g.forwardStock,faction:g.faction??'player'});
    g.forwardStock=inventory();
  }
  g.forward={...change.point};g.supplyTownId=change.townId;delete g.pendingSupplyPoint;delete g.supplyPointIssue;
}

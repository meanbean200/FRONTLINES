import {distance,type BattlefieldState} from '../core/types';
import {inlineGeometry,WEAPON_POSITIONS} from './PositionDefinitions';
import {excavatedSpan} from '../core/TrenchGeometry';
import {WEAPONS} from '../combat/Weapons';
export function validPositionState(state:BattlefieldState):boolean {
  const crew=new Set<number>(),workers=new Set<number>();
  for(const f of state.living?.facilities??[]){
    const g=state.living!.garrisons.find(g=>g.id===f.garrisonId)!;
    if(f.facing!==undefined&&!Number.isFinite(f.facing))return false;
    if(f.includesWeapon!==undefined&&(typeof f.includesWeapon!=='boolean'||!['emplacement','mortar'].includes(f.kind)))return false;
    if(f.autoReplaceCrew!==undefined&&typeof f.autoReplaceCrew!=='boolean')return false;
    const installed=f.installation;
    if(installed){
      if(!f.paid||f.progress!==1||!['construction','legacy-kit'].includes(installed.source)||!['emplacement','mortar'].includes(f.kind)||!(f.kind==='mortar'?installed.kind==='mortar':['crew-mg','mg42'].includes(installed.kind)))return false;
      if(installed.source==='construction'&&!f.includesWeapon||installed.source==='legacy-kit'&&!state.soldiers.some(s=>s.id===installed.personId))return false;
      if(installed.personId!==undefined&&state.living!.facilities.some(other=>other!==f&&other.installation?.personId===installed.personId&&other.kind===f.kind))return false;
      const w=installed.weapon;
      if(w&&(installed.kind==='mortar'||w.id!==installed.kind||![w.loaded,w.reloadUntil,w.setupUntil,w.burstLeft,w.position?.x,w.position?.z].every(Number.isFinite)||w.loaded<0||w.loaded>WEAPONS[w.id].magazine||w.reloadUntil<0||w.setupUntil<0||w.burstLeft<0))return false;
      if(w&&(w.effectiveUntil!==undefined&&(!Number.isFinite(w.effectiveUntil)||w.effectiveUntil<0)||w.effectivePoint!==undefined&&![w.effectivePoint.x,w.effectivePoint.z].every(Number.isFinite)))return false;
    }
    if(f.trenchAnchor){
      const a=f.trenchAnchor,t=state.trenches.find(t=>t.id===a.trenchId);if(f.kind!=='emplacement'||!t||f.connectorId!==t.id||!Number.isFinite(a.along)||f.facing===undefined)return false;
      const span=excavatedSpan(t);if(a.along<span.start||a.along>span.end||distance(inlineGeometry(t,a.along,f.facing).position,f)>.01)return false;
    }
    if(f.weaponCrewIds!==undefined){
      if(!['emplacement','mortar'].includes(f.kind)||!Array.isArray(f.weaponCrewIds)||f.weaponCrewIds.length>WEAPON_POSITIONS[f.kind as keyof typeof WEAPON_POSITIONS].crew)return false;
      for(const id of f.weaponCrewIds){const s=state.soldiers.find(s=>s.id===id),q=state.squads.find(q=>q.id===s?.squadId);if(!s||!q||crew.has(id)||(q.faction??'player')!==(g.faction??'player'))return false;crew.add(id);}
    }
    if(f.workOrder){
      const o=f.workOrder;if(typeof o.explicit!=='boolean'||!Number.isFinite(o.createdAt)||o.createdAt<0||!Array.isArray(o.workerIds)||o.workerIds.length>16)return false;
      if(o.autoWorkers!==undefined&&typeof o.autoWorkers!=='boolean')return false;
      if(o.cancelledAt!==undefined&&(!Number.isFinite(o.cancelledAt)||o.cancelledAt<o.createdAt||o.cancelledAt>state.elapsed||o.workerIds.length>0))return false;
      for(const id of o.workerIds){const s=state.soldiers.find(s=>s.id===id),q=state.squads.find(q=>q.id===s?.squadId);if(!s||!q||workers.has(id)||(q.faction??'player')!==(g.faction??'player'))return false;workers.add(id);}
    }
  }
  if([...crew].some(id=>workers.has(id)))return false;
  return (state.living?.garrisons??[]).every(g=>g.lastDeliveryAt===undefined||Number.isFinite(g.lastDeliveryAt)&&g.lastDeliveryAt>=0&&g.lastDeliveryAt<=state.elapsed);
}

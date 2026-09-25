import {distance,type BattlefieldState} from '../core/types';
import {inlineGeometry,WEAPON_POSITIONS} from './PositionDefinitions';
import {excavatedSpan} from '../core/TrenchGeometry';
export function validPositionState(state:BattlefieldState):boolean {
  const crew=new Set<number>(),workers=new Set<number>();
  for(const f of state.living?.facilities??[]){
    const g=state.living!.garrisons.find(g=>g.id===f.garrisonId)!;
    if(f.facing!==undefined&&!Number.isFinite(f.facing))return false;
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
      for(const id of o.workerIds){const s=state.soldiers.find(s=>s.id===id),q=state.squads.find(q=>q.id===s?.squadId);if(!s||!q||workers.has(id)||(q.faction??'player')!==(g.faction??'player'))return false;workers.add(id);}
    }
  }
  if([...crew].some(id=>workers.has(id)))return false;
  return (state.living?.garrisons??[]).every(g=>g.lastDeliveryAt===undefined||Number.isFinite(g.lastDeliveryAt)&&g.lastDeliveryAt>=0&&g.lastDeliveryAt<=state.elapsed);
}

import {distance,type BattlefieldState} from '../core/types';
import {hasEquipment} from '../combat/Equipment';
import {constructionDemand} from '../garrison/SupplyDemand';
import {effectiveReadiness} from '../garrison/types';
import {workReadout} from '../ui/PositionReadout';

/** On-demand, read-only stall evidence. Never called by scheduling or rendering. */
export function constructionDiagnostics(state:BattlefieldState){
  const world=state.living;if(!world)return [];
  return world.facilities.filter(f=>f.workOrder).map(f=>{
    const g=world.garrisons.find(g=>g.id===f.garrisonId),demand=constructionDemand(state,f.id);
    const workers=(f.workOrder!.workerIds??[]).map(id=>{
      const p=state.soldiers.find(p=>p.id===id);
      return p?{id,life:p.needs?.life,energy:p.needs?.energy,tools:hasEquipment(state,p,'tools'),
        action:p.action,owner:p.combat?.owner,distance:distance(p,f),duty:p.duty,
        selfCare:p.selfCare,carried:p.carried,playerOrdered:p.duty?.playerOrdered}: {id,missing:true};
    });
    return {at:state.elapsed,id:f.id,kind:f.kind,garrisonId:f.garrisonId,progress:f.progress,paid:f.paid,
      connectorProgress:state.trenches.find(t=>t.id===f.connectorId)?.progress,
      siteMaterials:f.stock.materials,remainingMaterials:f.paid?0:Math.max(0,f.materialCost-f.stock.materials),
      priority:f.workOrder!.priority??'normal',autoWorkers:f.workOrder!.autoWorkers===true,
      workerIds:f.workOrder!.workerIds,workers,claims:demand?.claims??[],
      carriers:state.soldiers.filter(p=>p.duty?.kind==='haul'&&p.duty.facilityId===f.id).map(p=>({id:p.id,
        life:p.needs?.life,stage:p.duty!.stage,materials:p.carried?.materials,distance:distance(p,f),
        blocked:p.duty!.routeBlocked,reason:p.duty!.reason})),
      garrison:g?{readiness:g.readiness,effectiveReadiness:effectiveReadiness(g,state.elapsed),
        underFireUntil:g.underFireUntil,nextDecision:g.nextDecision,cacheMaterials:g.cache.materials,
        forwardMaterials:g.forwardStock.materials,supplyIssue:g.supplyIssue,haulIssue:g.haulIssue}:undefined,
      readout:g?workReadout(state,f):{status:'POSITION UNAVAILABLE',reason:'Worksite has no garrison.'}};
  });
}

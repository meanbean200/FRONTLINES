import type {BattlefieldState} from '../../core/types';
import {inventory,type Facility} from '../../garrison/types';
import {positionOperator,type WeaponPositionKind} from '../WeaponPositions';
import {SUPPORT_WORKS} from '../../construction/ConstructionReadout';

/** Prepared scenario fixture for isolated combat tests. Production must build and walk here. */
export function preparedPosition(state:BattlefieldState,squadId:number,kind:WeaponPositionKind){
  const w=state.living!,q=state.squads.find(q=>q.id===squadId)!,operator=positionOperator(state,squadId,kind)!;
  const x=operator.x,z=operator.z,t={id:state.nextEntityId++,points:[{x:x-12,z},{x:x+12,z}],width:8,depth:1.75,progress:1,status:'complete' as const};state.trenches.push(t);
  for(const g of w.garrisons)g.squadIds=g.squadIds.filter(id=>id!==q.id);
  for(const f of w.facilities)if(f.weaponSquadId===q.id)delete f.weaponSquadId;
  const g={id:state.nextEntityId++,name:'Prepared test position',faction:q.faction??'player' as const,trenchId:t.id,squadIds:[q.id],entrance:{x:x-12,z},forward:{x:x-12,z},front:0,readiness:'routine' as const,cache:inventory(),forwardStock:inventory(),nextDecision:0,nextSupport:1e9,policy:'rules' as const,policyStatus:'Fixture',scores:[],cutoff:'clear' as const,watchRequired:2,watchPresent:2,capacity:20};w.garrisons.push(g);
  const cost=SUPPORT_WORKS[kind].cost,f:Facility={id:state.nextEntityId++,garrisonId:g.id,kind,x,z,connectorId:t.id,progress:1,capacity:2,paid:true,stock:inventory(),materialCost:cost,weaponSquadId:q.id};w.facilities.push(f);
  w.ledger.initial.materials+=cost;w.ledger.consumed.materials+=cost;
  const people=state.soldiers.filter(s=>s.squadId===q.id).sort((a,b)=>Number(b===operator)-Number(a===operator));
  people.forEach((s,i)=>{s.x=x+(i%2)*1.2;s.z=z-Math.floor(i/2)*1.1;s.garrisonId=g.id;s.action='watching';s.duty={kind:'watch',destination:{x:s.x,z:s.z},route:[],routeIndex:0,since:state.elapsed,arrivedAt:state.elapsed,until:state.elapsed+150,blockedFor:0,reason:'Prepared test crew',facilityId:f.id};});
  return f;
}

import {pointAlongPolyline,type BattlefieldState,type Vec2} from '../core/types';
import {TrenchNetwork} from '../garrison/TrenchNetwork';
import {networkCapacity} from '../garrison/NetworkCapacity';
import {knownTrenchNetworks,ownedTrenchIds} from '../operations/TrenchIntelligence';
import {connectedName} from './TrenchReadout';
import {facilityName} from '../construction/PositionDefinitions';
import {positionReadiness} from '../combat/WeaponPositions';
import {controlReadout,controlZone} from '../operations/ObjectiveControl';
import {forwardAccess} from '../garrison/SupplyPoints';

export interface PlanningAsset {key:string;id:number;kind:'network'|'memory'|'weapon'|'work'|'supply'|'truck'|'town';name:string;detail:string;point:Vec2;networkId?:number;front?:number;objectiveId?:string}
/** Player-owned assets and recorded terrain ONLY. No live enemy facility lookup. */
export function planningAssets(state:BattlefieldState,network:TrenchNetwork):PlanningAsset[]{
  network.sync(state.trenches);const rows:PlanningAsset[]=[],own=ownedTrenchIds(state,'player',network),seen=new Set<number>(),w=state.living;
  for(const t of state.trenches.filter(t=>own.has(t.id))){
    const id=network.anchor(t.id);if(seen.has(id))continue;seen.add(id);
    const cap=networkCapacity(state,network,t.id),g=w?.garrisons.find(g=>g.faction!=='enemy'&&network.anchor(g.trenchId)===id);
    rows.push({key:`network:${id}`,id,kind:'network',networkId:id,name:connectedName(state,network,id),point:pointAlongPolyline(t.points,.5),front:g?.front,
      detail:`${cap.present} here · ${cap.inbound} inbound · ${cap.free}/${cap.capacity} free${t.status==='complete'?'':' · excavation'}`});
  }
  for(const n of knownTrenchNetworks(state))rows.push({key:`memory:${n.id}`,id:n.id,kind:'memory',networkId:n.id,name:n.name,point:n.point,detail:`Recorded earthworks · ${Math.round(n.length)} m seen · ${Math.max(0,Math.floor(state.elapsed-Math.max(...n.sections.map(s=>s.at))))} s since observation. Occupants and stocks unknown.`});
  for(const [index,o] of (state.operation?.objectives??[]).entries()){
    const readout=controlReadout(state,o);
    rows.push({key:`town:${o.id}`,id:o.cacheId??index,kind:'town',objectiveId:o.id,name:o.name,point:controlZone(state,o)?.center??o,detail:`${readout.status} · ${readout.reason}`});
  }
  if(!w)return rows;
  for(const f of w.facilities){
    const g=w.garrisons.find(g=>g.id===f.garrisonId);if(!g||g.faction==='enemy')continue;
    const weapon=['mortar','emplacement'].includes(f.kind);
    rows.push({key:`facility:${f.id}`,id:f.id,kind:f.progress<1?'work':weapon?'weapon':'supply',name:facilityName(state,f),point:f,networkId:network.anchor(g.trenchId),front:f.facing,
      detail:f.progress<1?`${Math.floor(f.progress*100)}% built · ${f.workOrder?.workerIds.length??0} workers`:weapon?positionReadiness(state,f)||'Ready · installed weapon':`${Math.floor(f.stock.food)} food · ${Math.floor(f.stock.water)} water · ${Math.floor(f.stock.ammo)} rounds`});
  }
  rows.push({key:'rear:0',id:0,kind:'supply',name:'Rear depot',point:w.rear,detail:`${Math.floor(w.rearStock.food)} food · ${Math.floor(w.rearStock.water)} water · ${Math.floor(w.rearStock.materials)} materials`});
  for(const g of w.garrisons.filter(g=>g.faction!=='enemy'))rows.push({key:`forward:${g.id}`,id:g.id,kind:'supply',name:`${connectedName(state,network,g.trenchId)} roadhead`,point:g.forward,networkId:network.anchor(g.trenchId),detail:`${Math.floor(g.forwardStock.food)} food · ${Math.floor(g.forwardStock.water)} water · ${forwardAccess(state,g)||'Physical delivery point'}`});
  for(const t of w.trucks.filter(t=>t.faction!=='enemy')){
    const passengers=state.operation?.campaign?.replacements?.manifests.filter(m=>m.truckId===t.id&&m.stage!=='arrived').length??0;
    const ordinal=w.trucks.filter(v=>v.faction!=='enemy'&&v.role===t.role).findIndex(v=>v.id===t.id)+1;
    rows.push({key:`truck:${t.id}`,id:t.id,kind:'truck',name:t.role==='convoy'?'Supply convoy':`Delivery truck ${ordinal}`,point:t,detail:`${passengers?passengers+' passengers · ':''}${t.reason||'Awaiting assignment'}`});
  }
  return rows;
}

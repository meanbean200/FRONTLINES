import type {BattlefieldState} from '../core/types';
import {inventory,RESOURCES,type Inventory,type Truck} from '../garrison/types';
import {total} from '../garrison/Inventory';
import type {Faction} from './types';

export const endlessReleaseInterval=(state:BattlefieldState):number=>state.operation?.endless?.options.reinforcements==='continuous'?90:180;
export function endlessDeficit(state:BattlefieldState,side:Faction):number {
  const e=state.operation!.endless!,r=state.operation!.campaign!.replacements!;
  const squads=new Set(state.squads.filter(q=>(q.faction??'player')===side).map(q=>q.id));
  // Evacuated people and returning passengers already belong to the army.
  const living=state.soldiers.filter(s=>squads.has(s.squadId)&&s.needs?.life!=='dead').length;
  const pending=r.manifests.filter(m=>m.side===side&&!m.returning&&m.stage!=='arrived').length;
  return Math.max(0,e.targetStrength[side]-living-pending);
}
/** Availability is a bounded authorization at the rear edge, never a forward refill. */
export function stepEndlessAvailability(state:BattlefieldState):void {
  const e=state.operation?.endless,r=state.operation?.campaign?.replacements;
  if(!e||!r||state.operation?.status!=='active'||e.options.reinforcements==='finite')return;
  const config=state.living!.logistics!;
  for(const side of ['player','enemy'] as const){
    if(state.elapsed>=e.nextAvailability[side]){
      e.nextAvailability[side]=state.elapsed+(e.options.reinforcements==='continuous'?90:600);
      const added=Math.min(8,48-r.reserve[side],Math.max(0,endlessDeficit(state,side)-r.reserve[side]));
      r.reserve[side]+=added;e.generatedReserve[side]+=added;
    }
    if(state.elapsed>=e.nextSupplyAvailability[side]){
      e.nextSupplyAvailability[side]=state.elapsed+config.deliveryInterval*(e.options.reinforcements==='replenishing'?2:1);
      for(const key of RESOURCES){
        const batch=config.manifest[key]+(key==='fuel'?30:0);
        const added=Math.max(0,Math.min(batch,e.sourceInitial[key]-e.sourceStock[side][key]));
        e.sourceStock[side][key]+=added;e.sourceGenerated[side][key]+=added;
      }
    }
  }
}
/** Called only at scheduled map-edge loading. Account for rear AND inbound stock.
 * Reused trucks bound physical entities; returned cargo is never overwritten. */
export function loadEndlessManifest(state:BattlefieldState,t:Truck,rearStock:Inventory):number {
  const w=state.living!,e=state.operation!.endless!,side=t.faction??'player',config=w.logistics!;
  const source=e.sourceStock[side];let room=Math.max(0,config.convoyCapacity-total(t.cargo)),loaded=0;
  for(const key of RESOURCES){
    const inbound=w.trucks.filter(other=>(other.faction??'player')===side&&other.role==='convoy').reduce((n,other)=>n+other.cargo[key],0);
    const need=Math.max(0,e.rearTarget[side][key]-rearStock[key]-inbound);
    const n=Math.max(0,Math.min(room,source[key],need,config.manifest[key]-t.cargo[key]));
    t.cargo[key]+=n;source[key]-=n;room-=n;loaded+=n;e.sourceUsed[side][key]+=n;w.ledger.imported[key]+=n;
  }
  const fuel=Math.max(0,Math.min(30-t.fuel,source.fuel));
  t.fuel+=fuel;source.fuel-=fuel;e.sourceUsed[side].fuel+=fuel;w.ledger.imported.fuel+=fuel;
  return loaded;
}
export function initialEndlessSource(manifest:Inventory):Inventory {
  const stock=inventory();for(const key of RESOURCES)stock[key]=(manifest[key]+(key==='fuel'?30:0))*4;return stock;
}

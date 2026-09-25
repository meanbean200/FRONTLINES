import {distance,type BattlefieldState} from '../core/types';
import type {ReplacementManifest} from '../operations/Replacements';
export const TRANSPORT_STAGES=['Map edge','Convoy','Rear depot','Shuttle','Arrived'] as const;
const stages=['edge','convoy','rear','shuttle','arrived'];
/** ETA describes ONLY the current known truck leg, not promised end-to-end arrival. */
export function reinforcementReadout(state:BattlefieldState,m:ReplacementManifest){
  const w=state.living!,truck=w.trucks.find(t=>t.id===m.truckId),q=state.squads.find(q=>q.id===m.squadId),g=w.garrisons.find(g=>g.id===m.garrisonId)??w.garrisons.find(g=>g.squadIds.includes(m.squadId));
  let eta:string|undefined;
  if(truck&&['outbound','returning'].includes(truck.state)){
    const path=[truck,...truck.route.slice(truck.routeIndex)],metres=path.slice(1).reduce((n,p,i)=>n+distance(path[i],p),0);
    eta=`Current road leg ~${Math.ceil(metres/12+6)} s at 1× if clear`;
  }else if(truck&&['loading','unloading'].includes(truck.state))eta=`${truck.state==='loading'?'Boarding':'Unloading'} ~${Math.ceil(truck.timer)} s`;
  const blocked=truck?.state==='blocked';
  const reason=blocked?truck!.reason:m.stage==='edge'?'Waiting at the map edge for the next available returning convoy':m.stage==='rear'?g?'At rear depot · awaiting shuttle space':'At rear depot · assign the formation to an arrival network':m.stage==='arrived'?'Unloaded at roadhead · walking into formation':truck?.reason??'Assigned transport unavailable';
  return {formation:q?.name??'Formation',stage:stages.indexOf(m.stage),destination:g?.name??'No arrival network',source:m.stage==='edge'?'Map edge':m.stage==='rear'?'Rear depot':truck?`Truck ${truck.id}`:'Roadhead',reason,eta,blocked};
}

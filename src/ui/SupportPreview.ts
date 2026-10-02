import {distance,type BattlefieldState,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {crewOperator} from '../combat/WeaponPositions';
import {supportReadiness,type SupportKind} from '../combat/SupportWeapons';

/** Public preflight; no secret impact, random counter, mission or ammo mutation. */
export function supportPreview(state:BattlefieldState,terrain:TerrainSystem,kind:SupportKind,ids:readonly number[],target:Vec2,squadId?:number){
  if(kind==='smokeGrenades'){
    const status=squadId===undefined?undefined:supportReadiness(state,kind,squadId,terrain),operator=state.soldiers.find(p=>p.id===status?.operatorId),range=operator?distance(operator,target):Infinity;
    return {danger:0,dispersion:2,ready:status&&!status.reason&&range<=30?1:0,total:status?1:0,risk:0,range:operator?`${Math.round(range)} m`:'Choose a squad',reason:status?.reason||(range>30?'OUT OF THROW RANGE · 30 m maximum':''),origin:operator&&{x:operator.x,z:operator.z},unit:'throwers'};
  }
  const guns=state.living?.facilities.filter(f=>ids.includes(f.id)&&f.kind==='mortar')??[];
  const ranges:number[]=[],blocked:string[]=[];let ready=0;
  for(const f of guns){
    const operator=crewOperator(state,f),range=distance(operator??f,target);ranges.push(range);
    const status=operator?supportReadiness(state,kind,operator.squadId,terrain,true,f.id).reason:'NO CREW';
    const inRange=range>=(f.artillery?100:50)&&range<=(f.artillery?1600:900),angle=Math.atan2(target.x-f.x,target.z-f.z)-(f.facing??0),inSector=!f.artillery||Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)))<=Math.PI/3;
    if(status)blocked.push(status);else if(!inRange)blocked.push('OUT OF RANGE');else if(!inSector)blocked.push('OUTSIDE TRAVERSE');else ready++;
  }
  const heavy=guns.some(f=>f.artillery),danger=kind==='mortarHE'?(heavy?65:40):0,dispersion=heavy?26:18;
  const friendly=new Set(state.squads.filter(q=>q.faction!=='enemy').map(q=>q.id));
  const risk=danger?state.soldiers.filter(s=>friendly.has(s.squadId)&&s.needs?.life!=='dead'&&distance(s,target)<danger).length:0;
  const min=Math.round(Math.min(...ranges)),max=Math.round(Math.max(...ranges)),range=ranges.length?(min===max?String(min):`${min}–${max}`)+' m':'Choose a gun';
  return {danger,dispersion,ready,total:guns.length,risk,range,reason:[...new Set(blocked)].join(' · '),origin:guns[0]&&{x:guns[0].x,z:guns[0].z},unit:'guns'};
}

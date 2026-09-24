import type {Vec2} from '../core/types';
import {hash2D} from '../core/random';
import {SETTLEMENTS} from '../terrain/WorldFeatures';
import {ROADS,pointOnRoad,roadRoute} from '../terrain/WorldLayout';
import {OPERATION_DEFINITIONS} from './OperationDefinitions';
import {configuredDefinition,type ResolvedBattleSetup} from './BattleSetup';
import {atDepth,frontDepth} from './OperationGeometry';
import type {DeploymentZone,OperationId,OperationRuntime,OperationalObjective,StrategicLocation} from './OperationalTypes';

/** Terrain-feature placement. Orientation and lateral lanes vary with the sector seed.
 * Zones express intent, never movement barriers or compulsory squad waypoints. */
export function placeOperation(id:OperationId,seed:number,setup?:ResolvedBattleSetup):OperationRuntime {
  const d=setup?configuredDefinition(id,setup):OPERATION_DEFINITIONS[id],direction=setup?.advanced.direction??'auto';
  const angle=(direction==='auto'?Math.floor(hash2D(seed,29,177)*4):['east','south','west','north'].indexOf(direction))*Math.PI/2;
  const forward={x:Math.round(Math.cos(angle))||0,z:Math.round(Math.sin(angle))||0};
  const front={origin:{x:0,z:0},forward,right:{x:-forward.z||0,z:forward.x},beltDepth:d.deployment.enemy};
  const zones:DeploymentZone[]=[];
  const zone=(id:string,name:string,center:Vec2,halfWidth:number,halfDepth:number)=>{zones.push({id,name,center,halfWidth,halfDepth,forward:{...forward}});return id;};
  for(const side of ['player','enemy'] as const){const sign=side==='player'?-1:1;
    zone(`${side}-rear`,`${side==='player'?'Friendly':'Opposing'} rear`,atDepth(front,sign*1500),1720,400);
    zone(`${side}-deployment`,`${side==='player'?'Friendly':'Opposing'} deployment`,atDepth(front,d.deployment[side]),1000,180);
  }
  zone('contested','Contested ground',atDepth(front,0),1700,450);
  zone('enemy-belt','Estimated defensive belt',atDepth(front,d.deployment.enemy),1650,180);
  // Use the full depth and width: no single deep flag is mandatory.
  zone('deep','Ground beyond the belt',atDepth(front,1450),1800,400);
  zone('fallback','Rear access boundary',atDepth(front,-1450),1800,400);
  const middle=SETTLEMENTS.filter(p=>Math.abs(frontDepth(front,p))<1080)
    .sort((a,b)=>hash2D(a.x,a.z,seed)-hash2D(b.x,b.z,seed)).slice(0,3);
  const locations:StrategicLocation[]=middle.map((p,i)=>({id:`site-${i}`,name:p.name,kind:'village',position:{x:p.x,z:p.z},zoneId:zone(`site-${i}`,p.name,p,p.r+55,p.r+55)}));
  const roads=ROADS.filter(r=>r.axis===(forward.x?'x':'z'));
  const main=roads[Math.floor(hash2D(seed,91,43)*roads.length)];
  const reinforcements=(['player','enemy'] as const).map(side=>{const sign=(side==='player'?-1:1)*(forward.x||forward.z);return {side,rear:pointOnRoad(main,sign*1680),entry:pointOnRoad(main,sign*1980),reserve:d.persistent?(setup?.advanced.reserves??48):0,intervalHours:24,releaseLimit:d.persistent?8:0};});
  const routes=reinforcements.flatMap(source=>roads.map((road,i)=>{
    const sign=(source.side==='player'?1:-1)*(forward.x||forward.z),destination=pointOnRoad(road,sign*1400);
    // Each road is an alternative, not another mandatory checkpoint.
    return {id:`${source.side}-route-${i}`,name:road.id.replaceAll('-',' ').toUpperCase(),side:source.side,points:[source.rear,...roadRoute(source.rear,destination)],width:90,destination};
  }));
  for(const source of reinforcements)locations.push({id:`${source.side}-rear`,name:source.side==='player'?'FRIENDLY REAR':'OPPOSING REAR',kind:'rear',position:source.rear,zoneId:`${source.side}-rear`});
  const routeIds=(side:'player'|'enemy')=>routes.filter(r=>r.side===side).map(r=>r.id);
  const objectives:OperationalObjective[]=[];
  const breakthrough=(side:'player'|'enemy',zoneId:string,title:string)=>objectives.push({id:`${side}-intent`,side,priority:'primary',title,effect:'Sustained operational penetration',spec:{type:'breakthrough',zone:zoneId,routes:routeIds(side),minimum:8,squads:2,holdSeconds:d.persistent?120:90}});
  // A content builder per definition; runtime evaluation below is shared by objective type.
  const content:Record<OperationId,()=>void>={
    breakthrough:()=>breakthrough('player','deep','BREAK THE LINE · SECURE A DEEP ROUTE'),
    'line-defense':()=>objectives.push({id:'player-intent',side:'player',priority:'primary',title:'DENY THE ENEMY ACCESS TO YOUR REAR',effect:'Hold the sector until relief',spec:{type:'hold-line',zone:'fallback',routes:routeIds('enemy'),minimum:8,squads:2,breachSeconds:90,duration:d.defenseSeconds}}),
    meeting:()=>{for(const side of ['player','enemy'] as const)objectives.push({id:`${side}-intent`,side,priority:'primary',title:'SECURE KEY TERRAIN · BREAK THEIR RESISTANCE',effect:'Control two areas while reducing opposing combat effectiveness below half strength',spec:{type:'area-control',zones:middle.map((_,i)=>`site-${i}`),required:2,minimum:5,holdSeconds:90}});},
    'open-front':()=>{breakthrough('player','deep','SECURE THE OPPOSING REAR · MAINTAIN ACCESS');breakthrough('enemy','fallback','SECURE FRIENDLY REAR');},
  };content[id]();
  for(const p of locations.filter(l=>l.kind==='village'))objectives.push({id:`optional-${p.id}`,side:'player',priority:'optional',title:`Secure ${p.name}`,effect:'A finite ammunition, ration and water cache; recorded in the after-action report',spec:{type:'area-control',zones:[p.zoneId],required:1,minimum:5,holdSeconds:45}});
  return {version:2,definitionId:id,seed,front,zones,locations,routes,reinforcements,objectives,
    victory:objectives.filter(o=>o.priority==='primary').map(o=>({side:o.side,objectives:[o.id],...(id==='meeting'?{opponentEffectivenessBelow:.45}:{})})),
    progress:objectives.map(o=>({id:o.id,heldFor:0,pressureFor:0,satisfied:false,complete:false,failed:false,reason:'Not yet established'})),
    phase:'preparation',phaseSince:0,history:[{phase:'preparation',at:0,reason:'Forces deployed; no confirmed contact'}],routeAccess:{},nextEvaluation:0,lastEvaluation:0};
}

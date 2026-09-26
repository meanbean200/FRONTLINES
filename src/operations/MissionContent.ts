import {distance,type Vec2,type BattlefieldState} from '../core/types';
import {hash2D} from '../core/random';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {SETTLEMENTS} from '../terrain/WorldFeatures';
import {ROADS,pointOnRoad,nearestRoad,roadRoute,convoyEntry,insideWorld} from '../terrain/WorldLayout';
import {configuredDefinition,type ResolvedBattleSetup} from './BattleSetup';
import {placeOperation} from './OperationPlacement';
import {atDepth,frontDepth} from './OperationGeometry';
import type {OperationId,OperationRuntime} from './OperationalTypes';
import {forceSize} from './OperationDefinitions';

export const MISSION_COPY={
  breakthrough:{title:'Signal at the Orchard',situation:'A trench and its overlooking farmhouse block the supply road. Reconnoitre the earthworks, stage a supporting group and several assault formations, then release a coordinated WAIT / GO attack. Secure the trench and farmhouse together.',intent:'Reconnoitre · coordinate the assault · secure the position'},
  'line-defense':{title:'Hold the Supply Road',situation:'The enemy is assembling beyond the road house. You have three minutes to prepare before its scouts advance. Choose your fighting line, build support weapons, keep a reserve and repel the finite assault while denying the road approach.',intent:'Prepare your line · protect the road · break the assault'},
  meeting:{title:'Race for the Hamlet',situation:'Both forces are closing on two buildings controlling the road junction. Neither side has prepared trenches. Decide whether to rush a foothold or cover the approach; hold both buildings and keep the road open. Building a trench is a tactical choice, not a victory checkbox.',intent:'Seize the two road houses · deny the junction'},
} as const;
export const MISSION_SUCCESS={
  breakthrough:'Clear and hold the enemy trench with three fit soldiers; occupy the farmhouse with two. Keep the road approach open for a 30-second consolidation. WAIT and GO are command tools, not mandatory hidden counters.',
  'line-defense':'Keep at least three fit defenders within 100 m of the road house, deny enemy occupation and keep the road open. Win after the actual attacking force is repelled. Trench, building and support placement are yours.',
  meeting:'Put two fit soldiers in each marked road house and clear opposing occupants. Keep the junction approach open for 30 seconds. No compulsory construction or delivery checklist.',
} as const;
const LEGACY_INTENT={breakthrough:'Take the trench · occupy the farm · bring supplies forward','line-defense':'Prepare the approaches · repel the attack · keep the billet supplied',meeting:'Occupy the hamlet · establish a line · receive supplies'} as const;
export const missionFailure=(kind:MissionKind)=>kind==='breakthrough'?'Defeat: fewer than five people able to return to field duty, or the enemy retakes your occupied farm for 30 seconds. Enemy occupation before you first take the farm is expected.':`Defeat: fewer than ${kind==='line-defense'?'three':'four'} people able to return to field duty, or the enemy holds ${kind==='meeting'?'both road houses':'the road house'} unopposed for 30 seconds. Temporary exhaustion does not count as a loss.`;
export type MissionKind=keyof typeof MISSION_COPY;
export interface MissionPlan {
  version:1|2|3;kind:MissionKind;place:string;houseId:number;house:Vec2;secondHouseId?:number;secondHouse?:Vec2;
  deployment:Record<'player'|'enemy',number>;frontage:number;
  prepared:{side:'player'|'enemy';points:Vec2[]}[];
  approach:Vec2;preparationSeconds:number;
}
export interface MissionState {
  version:1;phase:'preparation'|'contact'|'line'|'building'|'sustain'|'secured'|'lost';
  lineTaken:boolean;houseTaken?:boolean;contactAt?:number;securedFor:number;breachedFor:number;
  reason:string;history:{phase:string;at:number;reason:string}[];
  checks?:{house:boolean;line:boolean;supply:boolean;road:boolean;secondary?:boolean;defense?:boolean};
}
export const blankMission=():MissionState=>({version:1,phase:'preparation',lineTaken:false,securedFor:0,breachedFor:0,reason:'Read the situation and inspect the marked building.',history:[{phase:'preparation',at:0,reason:'Forces staged; orders remain yours.'}]});

/** A new-content constructor only. Frozen Operations V2 placements stay loadable.
 * All landmarks come from the real generated world, not renderer-only props. */
export function placeMissionOperation(id:OperationId,seed:number,setup?:ResolvedBattleSetup,version:1|2|3=3):OperationRuntime {
  if(id==='open-front')return placeOperation(id,seed,setup);
  const r=placeOperation(id,seed,setup),d=configuredDefinition(id,setup);
  const bare:BattlefieldState={schemaVersion:3,seed,elapsed:0,simSpeed:0,nextEntityId:1,squads:[],soldiers:[],trenches:[],craters:[]};
  const terrain=new TerrainSystem(bare);let forward=r.front.forward;
  // Central/southern hamlets avoid making a river crossing the mandatory solution.
  const choices=SETTLEMENTS.filter(s=>s.z>-300&&Math.abs(s.x)<1400&&s.z<1200)
    .sort((a,b)=>hash2D(a.x,a.z,seed+17)-hash2D(b.x,b.z,seed+17));
  let selected:{site:typeof SETTLEMENTS[number];houseId:number}|undefined;
  for(const site of choices){
    const houseId=terrain.buildings.map((b,i)=>({b,i})).filter(v=>distance(v.b,site)<100)
      .sort((a,b)=>distance(a.b,nearestRoad(a.b).point)-distance(b.b,nearestRoad(b.b).point)||a.i-b.i)[0]?.i;
    if(houseId===undefined)continue;
    const house=terrain.buildings[houseId];
    // Follow a real road for the default approach. A perpendicular nearest-road
    // projection put the player's depot beyond the enemy line in live testing.
    if(version>=2&&(setup?.advanced.direction??'auto')==='auto'){
      const axis=ROADS[nearestRoad(house).road].axis,sign=hash2D(seed,29,177)<.5?1:-1;
      forward=axis==='x'?{x:sign,z:0}:{x:0,z:sign};
    }
    const points=(version===1?[-480,560]:[-600,600]).map(n=>({x:house.x+forward.x*n,z:house.z+forward.z*n}));
    if(points.every(p=>insideWorld(p,160)&&p.z>terrain.riverCenter(p.x)+terrain.riverWidth(p.x)+80)){selected={site,houseId};break;}
  }
  if(!selected)throw new Error('No usable mission hamlet for this approach. Choose another seed or direction.');
  const house={x:terrain.buildings[selected.houseId].x,z:terrain.buildings[selected.houseId].z};
  r.front.origin={...house};
  if(version>=2){r.front.forward={...forward};r.front.right={x:-forward.z||0,z:forward.x};}
  const close=setup?.advanced.approach==='close',deployment=id==='breakthrough'?{player:close?-430:-520,enemy:-90}:id==='line-defense'?{player:-100,enemy:close?440:550}:{player:close?-360:-440,enemy:close?360:440};
  if(version===3&&id==='meeting'){deployment.player=-320;deployment.enemy=320;}
  if(version===3&&id==='breakthrough')deployment.player=close?-400:-450;
  const frontage=setup?.size==='large'?280:140,prepared:MissionPlan['prepared']=[];
  // Attack provides one real enemy line. Defense starts with a short communications
  // trench, leaving the chosen fighting line and support works to the player.
  const side=id==='breakthrough'?'enemy':id==='line-defense'?'player':undefined;
  if(side){
    const count=setup?.size==='large'?2:1;
    // Whole formations alternate sectors. Extra equipment personnel still need
    // physical capacity; keep the historical default footprint when it fits.
    const perSector=Math.ceil(Math.ceil(forceSize(configuredDefinition(id,setup).forces[side])/8)/count)*8;
    const wanted=side==='enemy'?-140:-115,length=side==='enemy'?Math.max(140,perSector*2.5+20):90;
    for(let sector=0;sector<count;sector++){
    let path:Vec2[]|undefined;
    for(let i=0;i<320&&!path;i++){
      const depth=wanted+(Math.floor(i/16)-4)*9,lateral=(i%16-8)*9+(sector-(count-1)/2)*190;
      const candidate=[-.5,-.25,0,.25,.5].map((f,j)=>atDepth(r.front,depth+(j%2?4:0),lateral+f*length));
      const samples=Array.from({length:Math.ceil(length)+1},(_,n)=>atDepth(r.front,depth,lateral-length/2+n));
      if(samples.every(p=>insideWorld(p,30)&&!terrain.obstacleAt(p.x,p.z,5)&&terrain.groundTypeAt(p.x,p.z)!=='river'&&terrain.distanceToRoad(p.x,p.z)>12))path=candidate;
    }
    if(!path)throw new Error('No safe prepared trench near the mission building. Choose another seed.');
    prepared.push({side,points:path});deployment[side]=(path[2].x-house.x)*forward.x+(path[2].z-house.z)*forward.z;
    }
  }
  r.front.beltDepth=deployment.enemy;
  const approach=nearestRoad(atDepth(r.front,-130)).point;
  r.missionPlan={version,kind:id,place:selected.site.name,houseId:selected.houseId,house,deployment,frontage,prepared,approach,preparationSeconds:id==='line-defense'?(version===3?180:90):0};
  if(version===3&&id==='meeting'){
    const second=terrain.buildings.map((b,id)=>({b,id})).filter(v=>v.id!==selected.houseId&&distance(v.b,house)>30&&distance(v.b,house)<150).sort((a,b)=>distance(a.b,house)-distance(b.b,house)||a.id-b.id)[0];
    if(!second)throw new Error('No second road house near this junction. Choose another seed.');
    r.missionPlan.secondHouseId=second.id;r.missionPlan.secondHouse={x:second.b.x,z:second.b.z};
  }
  r.mission=blankMission();
  r.zones=r.zones.map(z=>({...z,center:atDepth(r.front,z.id==='player-deployment'?deployment.player:z.id==='enemy-deployment'||z.id==='enemy-belt'?deployment.enemy:0),halfWidth:frontage,halfDepth:90}));
  if(version>=2)r.zones=r.zones.filter(z=>['player-deployment','enemy-deployment','enemy-belt','contested','player-rear','enemy-rear'].includes(z.id)).map(z=>({...z,forward:{...forward}}));
  r.locations=[{id:'mission-house',name:selected.site.name+' / ROAD HOUSE',kind:'village',position:house,zoneId:'contested'}];
  if(r.missionPlan.secondHouse)r.locations.push({id:'second-house',name:selected.site.name+' / JUNCTION HOUSE',kind:'village',position:r.missionPlan.secondHouse,zoneId:'contested'});
  r.reinforcements=r.reinforcements.map(source=>{
    let rear=nearestRoad(atDepth(r.front,source.side==='player'?-320:440)).point;
    if(version>=2){
      const sign=source.side==='player'?-1:1,wanted=atDepth(r.front,sign*Math.max(320,Math.abs(deployment[source.side])+80));
      const choices=ROADS.flatMap(road=>Array.from({length:99},(_,i)=>pointOnRoad(road,-1960+i*40)))
        .filter(p=>frontDepth(r.front,p)*sign>=Math.max(250,Math.abs(deployment[source.side])+40)&&!terrain.obstacleAt(p.x,p.z,2)&&terrain.groundTypeAt(p.x,p.z)!=='river')
        .sort((a,b)=>distance(a,wanted)-distance(b,wanted));
      if(!choices.length)throw new Error('No usable rear road for this mission. Choose another approach.');
      rear=choices[0];
    }
    const positiveEdge=version===1?source.side==='enemy':(source.side==='player'?-1:1)*(forward.x||forward.z)>0;
    return {...source,rear,entry:convoyEntry(positiveEdge,rear)};
  });
  r.routes=r.reinforcements.map(source=>({id:source.side+'-route',name:source.side==='player'?'BILLET SUPPLY ROAD':'OPPOSING APPROACH',side:source.side,points:[source.rear,...roadRoute(source.rear,approach)],width:28,destination:approach}));
  for(const source of r.reinforcements){
    r.locations.push({id:source.side+'-rear',name:source.side==='player'?'FRIENDLY REAR':'OPPOSING REAR',kind:'rear',position:source.rear,zoneId:source.side+'-rear'});
    const zone=r.zones.find(z=>z.id===source.side+'-rear')!;zone.center={...source.rear};zone.halfWidth=70;zone.halfDepth=70;
  }
  r.objectives=[{id:'player-mission',side:'player',priority:'primary',title:(version===3?MISSION_COPY[id].intent:LEGACY_INTENT[id]).toUpperCase(),effect:'Physical battlefield objectives',spec:{type:'physical-mission'}}];
  r.progress=[{id:'player-mission',heldFor:0,pressureFor:0,satisfied:false,complete:false,failed:false,reason:MISSION_COPY[id].situation}];
  r.victory=[];
  // d is deliberately only read for force configuration; no content mutates old definitions.
  if(d.persistent)throw new Error('Persistent operations retain their original content');
  return r;
}

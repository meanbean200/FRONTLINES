import {describe,it,expect} from 'vitest';
import {createOperation} from './createOperation';
import {OPERATION_IDS,OPERATION_DEFINITIONS,forceSize} from './OperationDefinitions';
import {placeOperation} from './OperationPlacement';
import {atDepth,frontDepth,inZone,zoneCorners} from './OperationGeometry';
import {operationalForces,stepOperationalRuntime,updateRouteAccess,updateOperationalCaches} from './OperationalRuntime';
import {commandOperationalEnemy} from './OperationalCommander';
import {observeEnemy} from './EnemyCommander';
import {SaveSystem} from '../persistence/SaveSystem';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {balance} from '../garrison/Inventory';
import {insideWorld} from '../terrain/WorldLayout';
import {distance,type BattlefieldState,type Vec2} from '../core/types';
import type {Faction} from './types';
import {stepReplacements} from './Replacements';

function move(state:BattlefieldState,side:Faction,p:Vec2,limit=1000){
  const squads=state.squads.filter(q=>q.faction===side&&q.kind==='rifle').slice(0,limit);
  for(const q of squads){Object.assign(q,p);state.soldiers.filter(s=>s.squadId===q.id).forEach((s,i)=>Object.assign(s,{x:p.x+(i%4)*2,z:p.z+Math.floor(i/4)*2}));}
}
function fixture(id='breakthrough' as typeof OPERATION_IDS[number]){
  const state=createOperation(id),r=state.operation!.runtime!,terrain=new TerrainSystem(state);
  for(const side of ['player','enemy'] as const){const p=atDepth(r.front,side==='player'?-1920:1920);for(const q of state.squads.filter(q=>q.faction===side)){Object.assign(q,p);for(const s of state.soldiers.filter(s=>s.squadId===q.id))Object.assign(s,p);}}
  return {state,r,terrain};
}
function tick(state:BattlefieldState,terrain:TerrainSystem,seconds=1){for(let i=0;i<seconds;i++){state.elapsed++;state.operation!.elapsed++;stepOperationalRuntime(state,terrain);}}

describe('Operations V2 definitions and terrain placement',()=>{
  it('loads four independent definitions and separates placement from intent',()=>{
    expect(OPERATION_IDS).toEqual(['breakthrough','line-defense','meeting','open-front']);
    expect(OPERATION_DEFINITIONS.breakthrough.forces.player.rifles).toBeGreaterThan(OPERATION_DEFINITIONS.breakthrough.forces.enemy.rifles);
    expect(OPERATION_DEFINITIONS['open-front'].persistent).toBe(true);
  });
  it('generates deterministic, bounded, oriented geography across seeds',()=>{
    const headings=new Set<string>(),sites=new Set<string>();
    for(let seed=1944;seed<1964;seed++)for(const id of OPERATION_IDS){const r=placeOperation(id,seed);
      expect(r).toEqual(placeOperation(id,seed));headings.add(JSON.stringify(r.front.forward));sites.add(r.locations[0].name);
      expect(r.routes).toHaveLength(6);expect(r.routes.every(route=>route.points.length>2&&route.points.every(p=>insideWorld(p)))).toBe(true);
      expect(r.zones.flatMap(zoneCorners).every(p=>insideWorld(p))).toBe(true);
      expect(r.zones.every(z=>inZone(z.center,z))).toBe(true);
      expect(frontDepth(r.front,r.reinforcements[0].rear)).toBeLessThan(-1500);
      expect(frontDepth(r.front,r.reinforcements[1].rear)).toBeGreaterThan(1500);
      expect(r.reinforcements.every(s=>Math.abs(frontDepth(r.front,s.entry))>1900)).toBe(true);
    }
    expect(headings.size).toBe(4);expect(sites.size).toBeGreaterThan(3);
  });
  it('supports diagonal geometry without axis-specific membership tests',()=>{
    const f={origin:{x:0,z:0},forward:{x:Math.SQRT1_2,z:Math.SQRT1_2},right:{x:-Math.SQRT1_2,z:Math.SQRT1_2},beltDepth:0};
    const z={id:'test',name:'Diagonal',center:atDepth(f,300),forward:f.forward,halfWidth:50,halfDepth:120};
    expect(inZone(atDepth(f,400,40),z)).toBe(true);expect(inZone(atDepth(f,400,60),z)).toBe(false);
  });
  it.each(OPERATION_IDS)('builds %s with conserved stock, clear deployment, usable alternatives and saveable state',id=>{
    for(const seed of [1944,1945,1946]){const state=createOperation(id,seed),r=state.operation!.runtime!,terrain=new TerrainSystem(state);
      expect(state.soldiers.length).toBe(forceSize(OPERATION_DEFINITIONS[id].forces.player)+forceSize(OPERATION_DEFINITIONS[id].forces.enemy));
      expect(state.soldiers.every(s=>insideWorld(s)&&!terrain.obstacleAt(s.x,s.z,.1)&&terrain.groundTypeAt(s.x,s.z)!=='river')).toBe(true);
      expect(Object.values(balance(state)).every(n=>Math.abs(n)<1e-7)).toBe(true);
      expect(state.operation!.contacts).toBeUndefined();
      expect(()=>new SaveSystem().parse(JSON.stringify(state))).not.toThrow();
      const friendly=state.squads.filter(q=>q.faction==='player'),enemies=state.squads.filter(q=>q.faction==='enemy');
      expect(Math.min(...friendly.flatMap(a=>enemies.map(b=>distance(a,b))))).toBeGreaterThan(600);
      updateRouteAccess(r,terrain,{player:[],enemy:[]});
      expect(r.routes.filter(route=>route.side==='player'&&r.routeAccess[route.id]).length).toBeGreaterThanOrEqual(2);
    }
  },30000);
});

describe('reusable operational objectives and terminal conditions',()=>{
  it('requires viable multi-squad penetration, access and continuous consolidation; touching is not winning',()=>{
    const {state,r,terrain}=fixture(),point=r.routes.find(r=>r.side==='player')!.destination;
    move(state,'player',point,1);tick(state,terrain,95);expect(state.operation!.status).toBe('active');expect(r.progress[0].heldFor).toBe(0);
    move(state,'player',point,2);tick(state,terrain,35);expect(r.phase).toBe('consolidation');expect(state.operation!.status).toBe('active');
    move(state,'player',atDepth(r.front,-1200));tick(state,terrain);expect(r.progress[0].heldFor).toBe(0);
    move(state,'player',point,2);tick(state,terrain,90);expect(state.operation!.status).toBe('victory');expect(state.simSpeed).toBe(0);
  });
  it('permits a different deep road approach to satisfy the same intent',()=>{
    const {state,r,terrain}=fixture();move(state,'player',r.routes.filter(r=>r.side==='player')[2].destination,2);tick(state,terrain,90);expect(state.operation!.status).toBe('victory');
  });
  it('resets consolidation when all usable routes are physically cut',()=>{
    const {state,r,terrain}=fixture();move(state,'player',r.routes[0].destination,2);tick(state,terrain,30);
    const blocked=Object.create(terrain) as TerrainSystem;blocked.obstacleAt=()=>true;
    tick(state,blocked);expect(r.progress[0].heldFor).toBe(0);expect(r.progress[0].reason).toContain('connection');
  });
  it('routes are interdicted by a viable hostile group, not one distant invisible man',()=>{
    const {state,r,terrain}=fixture(),route=r.routes[0],p=route.points[Math.floor(route.points.length/2)];
    move(state,'enemy',p,1);updateRouteAccess(r,terrain,operationalForces(state));expect(r.routeAccess[route.id]).toBe(false);
    const hostile=operationalForces(state).enemy;updateRouteAccess(r,terrain,{player:[],enemy:hostile.slice(0,1)});expect(r.routeAccess[route.id]).toBe(true);
  });
  it('uses contact and physical breach for phases rather than a script clock',()=>{
    const {state,r,terrain}=fixture();tick(state,terrain,400);expect(r.phase).toBe('preparation');
    const enemy=state.soldiers.find(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')!;
    state.operation!.contacts={player:[{soldierId:enemy.id,squadId:enemy.squadId,x:0,z:0,lastSeen:state.elapsed,active:true,visible:true}],enemy:[]};tick(state,terrain);expect(r.phase).toBe('contact');
    state.operation!.shots=1;tick(state,terrain);expect(r.phase).toBe('engagement');
    move(state,'player',atDepth(r.front,800),2);tick(state,terrain);expect(r.phase).toBe('exploitation');
  });
  it('defense tolerates losing all forward settlements but not sustained rear penetration',()=>{
    const {state,r,terrain}=fixture('line-defense');for(const o of state.operation!.objectives.filter(o=>o.id.startsWith('site'))){o.owner='enemy';o.control=-1;}
    tick(state,terrain,120);expect(state.operation!.status).toBe('active');
    move(state,'enemy',r.routes.find(r=>r.side==='enemy')!.destination,2);tick(state,terrain,89);expect(state.operation!.status).toBe('active');tick(state,terrain,1);expect(state.operation!.status).toBe('defeat');
  });
  it('defense wins when a finite assault becomes incapable; critical losses can end an offensive',()=>{
    const {state,terrain}=fixture('line-defense');for(const s of state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')){s.health=0;s.needs!.life='dead';}tick(state,terrain,30);expect(state.operation!.status).toBe('victory');
    const b=fixture();for(const s of b.state.soldiers.filter(s=>b.state.squads.find(q=>q.id===s.squadId)?.faction==='player')){s.health=0;s.needs!.life='dead';}tick(b.state,b.terrain);expect(b.state.operation!.status).toBe('defeat');
  });
  it('ends defense at relief, without requiring a village or another arbitrary holding period',()=>{
    const {state,r,terrain}=fixture('line-defense');state.elapsed=state.operation!.elapsed=1199;r.nextEvaluation=r.lastEvaluation=1199;tick(state,terrain);expect(state.operation!.status).toBe('victory');
  });
  it('does not count unarmed men as a viable breakthrough, and cannot soft-lock with seven survivors',()=>{
    const {state,r,terrain}=fixture();move(state,'player',r.routes[0].destination,2);
    for(const s of state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='player'))s.carried!.ammo=0;
    tick(state,terrain,90);expect(state.operation!.status).toBe('active');expect(r.progress[0].heldFor).toBe(0);
    const combat=state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='player'&&state.squads.find(q=>q.id===s.squadId)?.kind==='rifle');
    for(const s of state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='player'&&!combat.slice(0,7).includes(s))){s.health=0;s.needs!.life='dead';}
    tick(state,terrain);expect(state.operation!.status).toBe('defeat');
  });
  it('optional terrain unlocks a finite physical cache without creating inventory',()=>{
    const {state,r}=fixture(),cache=state.operation!.objectives[0],q=state.squads[0],p=state.soldiers.find(s=>s.squadId===q.id)!;
    move(state,'player',r.locations[0].position,1);cache.owner='player';cache.control=1;p.x=cache.x+20;p.z=cache.z;
    p.carried!.ammo-=20;state.living!.ledger.consumed.ammo+=20;
    const factions=new Map(state.squads.map(q=>[q.id,q.faction!]));updateOperationalCaches(state,state.soldiers,factions,1);expect(p.carried!.ammo).toBe(40);
    p.x=cache.x;updateOperationalCaches(state,state.soldiers,factions,1);expect(p.carried!.ammo).toBe(44);
    expect(Math.max(...Object.values(balance(state)).map(Math.abs))).toBeLessThan(1e-7);
  });
  it('meeting engagement needs terrain AND reduced opposing effectiveness',()=>{
    const {state,r,terrain}=fixture('meeting'),rifles=state.squads.filter(q=>q.faction==='player'&&q.kind==='rifle');
    for(const [i,q] of rifles.slice(0,2).entries()){const p=r.locations[i].position;Object.assign(q,p);for(const s of state.soldiers.filter(s=>s.squadId===q.id))Object.assign(s,p);}
    tick(state,terrain,90);expect(r.progress[0].complete).toBe(true);expect(state.operation!.status).toBe('active');
    for(const s of state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy'))s.carried!.ammo=0;
    tick(state,terrain);expect(state.operation!.status).toBe('victory');
  });
  it('open front retains finite physical replacements and no arbitrary timeout',()=>{
    const s=createOperation('open-front');expect(s.operation!.duration).toBe(0);expect(s.operation!.campaign!.replacements!.reserve).toEqual({player:48,enemy:48});expect(s.living!.trucks).toHaveLength(8);
    const {state,r,terrain}=fixture('open-front');state.elapsed=state.operation!.elapsed=10000;r.lastEvaluation=10000;r.nextEvaluation=10000;tick(state,terrain);expect(state.operation!.status).toBe('active');
  });
  it('Open Front uses the existing physical replacement chain without a reserve refill on load',()=>{
    const state=createOperation('open-front'),sim=new BattlefieldSimulation(state),w=state.living!,q=state.squads[0],patient=state.soldiers.find(p=>p.squadId===q.id)!,g=w.garrisons.find(g=>g.squadIds.includes(q.id))!;
    patient.health=0;patient.needs!.life='dead';w.campaignHours=32;stepReplacements(state,.05);
    const r=state.operation!.campaign!.replacements!,m=r.manifests[0];expect(r.reserve.player).toBe(47);m.stage='rear';sim.garrisons.logistics.step(.05);
    const truck=w.trucks.find(t=>t.garrisonId===g.id)!;expect(truck).toBeDefined();stepReplacements(state,.05);expect(m.stage).toBe('shuttle');
    expect(new SaveSystem().parse(JSON.stringify(state)).operation!.campaign!.replacements).toEqual(r);
    Object.assign(truck,g.forward,{state:'unloading',timer:0});stepReplacements(state,.05);expect(m.stage).toBe('arrived');expect(state.soldiers.some(p=>p.id===m.personId)).toBe(true);
    expect(Math.max(...Object.values(balance(state)).map(Math.abs))).toBeLessThan(1e-7);
  });
});

describe('information firewall and persistence',()=>{
  it('enemy regrouping never steals an engineer construction order',()=>{
    const state=createOperation('open-front'),sim=new BattlefieldSimulation(state),engineer=state.squads.find(q=>q.faction==='enemy'&&state.soldiers.some(s=>s.squadId===q.id&&s.equipment?.tools))!;
    sim.garrisons.release(engineer.id);engineer.order={type:'construct-trench',trenchId:state.operation!.campaign!.enemyTrench,issuedAt:0};
    for(const p of state.soldiers.filter(p=>state.squads.find(q=>q.id===p.squadId)?.faction==='enemy'))p.morale=0;
    state.operation!.nextOrders=0;const assigned:number[]=[];
    sim.operations.step(.05,()=>{},()=>{},ids=>{assigned.push(...ids);return true;});
    expect(state.operation!.runtime!.commander!.phase).toBe('withdrawing');expect(assigned).not.toContain(engineer.id);expect(engineer.order.type).toBe('construct-trench');
  });
  it('preserves mortar support through reported areas, without inventing a hidden target',()=>{
    const state=createOperation('open-front'),terrain=new TerrainSystem(state),before=commandOperationalEnemy(observeEnemy(state),terrain);
    expect(before.support).toBeUndefined();
    const q=state.squads[0],mortar=state.soldiers.find(s=>s.equipment?.mortar&&state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')!,target={x:mortar.x+200,z:mortar.z};state.operation!.contacts={player:[],enemy:[{soldierId:q.soldierIds[0],squadId:q.id,...target,lastSeen:0,visible:false,active:true,status:'last-reported'}]};
    const after=commandOperationalEnemy(observeEnemy(state),terrain);expect(after.support?.target).toEqual(target);
    expect(commandOperationalEnemy(observeEnemy(state),terrain,after.memory,after.commander).support).toBeUndefined();
  });
  it('brings reserve-carried mortar equipment into range of delivered reports, not hidden positions',()=>{
    const {state,terrain}=fixture('meeting'),o=observeEnemy(state),mortar=o.squads.find(q=>q.mortar)!;
    const report={soldierId:state.soldiers[0].id,squadId:state.squads[0].id,x:0,z:-80,lastSeen:0,visible:false,active:true,status:'last-reported' as const};
    const quiet=commandOperationalEnemy(o,terrain);o.contacts=[report];const aware=commandOperationalEnemy(o,terrain);
    expect(aware.support).toBeUndefined();const goal=aware.commands.find(c=>c.squadId===mortar.id)!.goal;
    expect(distance(goal,report)).toBeLessThan(distance(mortar,report)-100);
    expect(goal).not.toEqual(quiet.commands.find(c=>c.squadId===mortar.id)?.goal);
    o.contacts=[];expect(commandOperationalEnemy(o,terrain)).toEqual(quiet);
  });
  it.each(OPERATION_IDS)('%s plans cannot read hidden positions, losses, orders or objective oracle state',id=>{
    const state=createOperation(id),copy=structuredClone(state);
    for(const q of copy.squads.filter(q=>q.faction==='player')){q.x=800;q.z=900;q.order.target={x:0,z:0};}
    for(const s of copy.soldiers.filter(s=>copy.squads.find(q=>q.id===s.squadId)?.faction==='player')){s.x=800;s.z=900;s.health=0;s.needs!.life='dead';}
    for(const o of copy.operation!.objectives){o.owner='player';o.contested=true;}
    copy.operation!.runtime!.phase='consolidation';copy.operation!.runtime!.progress[0].complete=true;copy.operation!.runtime!.routeAccess={'player-route-0':false};
    expect(observeEnemy(copy)).toEqual(observeEnemy(state));
    expect(commandOperationalEnemy(observeEnemy(copy),new TerrainSystem(copy))).toEqual(commandOperationalEnemy(observeEnemy(state),new TerrainSystem(state)));
  });
  it('matches exact continuation mid-consolidation and rejects malformed/incompatible runtime',()=>{
    const {state,r,terrain}=fixture();move(state,'player',r.routes[0].destination,2);tick(state,terrain,37);
    const restored=new SaveSystem().parse(JSON.stringify(state));expect(restored.operation!.runtime).toEqual(r);
    tick(state,terrain,53);tick(restored,new TerrainSystem(restored),53);expect(restored.operation).toEqual(state.operation);
    for(const damage of [(s:BattlefieldState)=>{s.operation!.runtime!.version=99 as 2;},(s:BattlefieldState)=>{s.operation!.runtime!.routes[0].points[0].x=99999;},(s:BattlefieldState)=>{s.operation!.runtime!.progress.pop();},(s:BattlefieldState)=>{delete s.operation!.runtime;}]){const bad=structuredClone(state);damage(bad);expect(()=>new SaveSystem().parse(JSON.stringify(bad))).toThrow();}
  });
  it('continues the actual fixed-step simulation and commander identically after a save',()=>{
    const a=new BattlefieldSimulation(createOperation('meeting'));for(let i=0;i<100;i++)a.step(.05);
    const b=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(a.state)));
    for(let i=0;i<40;i++){a.step(.05);b.step(.05);}
    expect(b.state.operation).toEqual(a.state.operation);expect(b.state.soldiers).toEqual(a.state.soldiers);expect(b.state.squads).toEqual(a.state.squads);
  },30000);
  it('old mission saves retain their original mission logic and data',()=>{
    const old=createOperation('campaign'),restored=new SaveSystem().parse(JSON.stringify(old));expect(restored.operation!.mode).toBe('campaign');expect(restored.operation!.runtime).toBeUndefined();expect(restored.operation).toEqual(old.operation);
  });
});

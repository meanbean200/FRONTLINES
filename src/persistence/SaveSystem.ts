import type { BattlefieldState } from '../core/types';
import {polylineLength,WORLD_VERSION,WORLD_SIZE} from '../core/types';
import {insideWorld} from '../terrain/WorldLayout';
import {trenchCapacity} from '../construction/TrenchSystem';
import {migrateExplicitWorkQueues} from '../construction/WorkAssignments';
import { initializeLiving } from '../garrison/LogisticsSystem';
import { RESOURCES } from '../garrison/types';
import { OBSERVATION_VERSION, RULES_VERSION } from '../garrison/GarrisonPolicy';
import {ENEMY_AI_VERSION,ENEMY_ROLES} from '../operations/EnemyCommander';
import {excavatedSpan} from '../core/TrenchGeometry';
import {WEAPONS,type WeaponId} from '../combat/Weapons';
import {validIntelligence,validContactTracking} from '../operations/IntelligenceValidation';
import {validCombatSystems} from '../combat/CombatValidation';
import {validCampaignSystems} from '../operations/CampaignValidation';
import {initializeReplacements} from '../operations/Replacements';
import {validBuildings} from '../terrain/BuildingValidation';
import {validOperationalRuntime} from '../operations/OperationalValidation';
import {isOperationId} from '../operations/OperationDefinitions';
import {initializeEquipment} from '../combat/Equipment';
import {migrateWeaponCrews,installPositionWeapons} from '../combat/WeaponPositions';
import {validPositionState} from '../construction/PositionValidation';
import {reconcileSupplyDemands,validSupplyDemands} from '../garrison/SupplyDemand';
import {migrateSupportPositions} from '../combat/SupportWeapons';
import {validTerrainKnowledge} from '../operations/TrenchIntelligence';
import {validPreparedOrders} from '../operations/PreparedOrders';

export const SAVE_KEY = 'frontlines-battlefield-v4';
const WORLD2_V3_KEY = 'frontlines-battlefield-v3-world2-4km';
const V3_KEY = 'frontlines-battlefield-v3';
const V2_KEY = 'frontlines-battlefield-v2';
const LEGACY_KEY = 'frontlines-battlefield-v1';

export class SaveSystem {
  lastError='';
  save(state: BattlefieldState): string {
    // Claims are derived accounting. A paused command can release a carrier
    // between fixed ticks; validate physical authority, then refresh this copy.
    // Loading still rejects malformed or oversubscribed serialized claims.
    const physical={...state,living:state.living?{...state.living,supplyDemands:undefined}:undefined};
    if(!isBattlefieldState(physical))throw new Error('Battlefield contains invalid state; existing save preserved.');
    const snapshot=structuredClone(state);initializeEquipment(snapshot);reconcileSupplyDemands(snapshot);for(const s of snapshot.soldiers)s.posture??='standing';
    const json = JSON.stringify({...snapshot,schemaVersion:4,combatRules:RULES_VERSION,policySchema:{observationVersion:OBSERVATION_VERSION,rulesVersion:RULES_VERSION}});
    localStorage.setItem(SAVE_KEY, json);
    return json;
  }

  load(): BattlefieldState | undefined {
    this.lastError='';
    const raw = localStorage.getItem(SAVE_KEY)??localStorage.getItem(WORLD2_V3_KEY)??localStorage.getItem(V3_KEY)??localStorage.getItem(V2_KEY)??localStorage.getItem(LEGACY_KEY);
    if (!raw) return undefined;
    try{return this.parse(raw);}catch(error){this.lastError=error instanceof Error?error.message:'Save could not be loaded.';throw error;}
  }

  parse(raw: string): BattlefieldState {
    const value: unknown = JSON.parse(raw);
    const world=value as Partial<BattlefieldState>|null;
    if(world&&typeof world==='object'&&(world.worldVersion!==WORLD_VERSION||world.worldSize!==WORLD_SIZE))throw new Error('Legacy or incompatible battlefield: this save uses the old 8 km or another world layout. New battles use 4 × 4 km. The original save is preserved; start a new battle, or open it in its matching older build. No coordinates were migrated.');
    // Only known legacy inventory locations gain explicit zero-valued new fields.
    // Current v3 payloads must validate as written rather than repairing corruption.
    const legacy=value as Partial<BattlefieldState>|null;
    if(legacy&&legacy.schemaVersion===2&&legacy.living){
      const w=legacy.living,stocks=[w.rearStock,w.enemySupply?.stock,w.ledger?.initial,w.ledger?.imported,w.ledger?.consumed,w.ledger?.lost,w.logistics?.manifest,...(w.garrisons??[]).flatMap(g=>[g.cache,g.forwardStock]),...(w.facilities??[]).map(f=>f.stock),...(w.trucks??[]).map(t=>t.cargo),...(w.crates??[]).map(c=>c.stock),...(legacy.soldiers??[]).map(s=>s.carried)];
      for(const stock of stocks)if(stock)for(const key of ['medical','mortarHE','mortarSmoke','smokeGrenades'] as const)stock[key]??=0;
    }
    if (!isBattlefieldState(value)||!validTerrainKnowledge(value)||!validPreparedOrders(value)) throw new Error('Save data is not a supported FRONTLINES battlefield.');
    const state=structuredClone(value);
    const policySchema=(value as BattlefieldState&{policySchema?:{observationVersion?:unknown;rulesVersion?:unknown}}).policySchema;
    if(policySchema&&(policySchema.observationVersion!==OBSERVATION_VERSION||policySchema.rulesVersion!==RULES_VERSION)){
      for(const g of state.living?.garrisons??[])if(g.policy!=='rules'){
        g.modelId=`unavailable-schema:${g.modelId??'unspecified'}`;g.policyStatus='Fallback: saved policy observation/rules version is unavailable';
      }
    }
    const wasLegacy=state.schemaVersion<3;
    const migratedV4=state.schemaVersion<4;
    if(state.schemaVersion===1){
      // No retrospective deprivation, free rations, or depot refill on migration.
      initializeLiving(state);
      const w=state.living!;
      for(const stock of [w.rearStock,w.ledger.initial,w.ledger.imported,w.ledger.consumed,w.ledger.lost])for(const key of RESOURCES)stock[key]=0;
      for(const truck of w.trucks)truck.fuel=0;
      for(const s of state.soldiers){for(const key of RESOURCES)s.carried![key]=0;s.carried!.ammo=s.ammunition;w.ledger.initial.ammo+=s.ammunition;}
    }
    initializeLiving(state);
    if(!wasLegacy&&state.combatRules!==RULES_VERSION)state.living!.migrationNote='This copy now uses revised combat and terrain rules. Exact continuation is guaranteed only within the same rules version; existing people and stock are unchanged.';
    for(const s of state.soldiers)s.posture??='standing';
    initializeEquipment(state);
    for(const m of state.operation?.supportMissions??[]){m.source??='LEGACY_UNKNOWN';m.side??=state.squads.find(q=>q.id===m.squadId)?.faction??'player';}
    if(wasLegacy){
      state.living!.migrationNote='Copy migrated to v3: revised combat rules; people, health, orders and existing stock preserved. Legacy injuries do not bleed. Original v1/v2 storage is untouched.';
      for(const s of state.soldiers){s.combat??={shotSequence:0};if(s.health>0&&s.health<100)s.combat.wound={severity:'legacy',at:state.elapsed,stabilized:true,care:'stabilized'};}
      for(const g of state.living!.garrisons)if(g.policy!=='rules'){g.modelId=`unavailable-rules:${g.modelId??'unspecified'}`;g.policyStatus='Fallback: neural model predates revised combat rules';}
      if(state.operation){
        state.operation.casualtyRules=true;state.operation.supportRules=true;
        const manifest=state.living!.logistics!.manifest;
        // Change only future scheduled cargo: trade 40 food units for the new
        // support supplies within the existing finite convoy capacity.
        if(manifest.food>=40&&manifest.medical+manifest.mortarHE+manifest.mortarSmoke+manifest.smokeGrenades===0){manifest.food-=40;manifest.medical=12;manifest.mortarHE=12;manifest.mortarSmoke=6;manifest.smokeGrenades=10;}
        initializeReplacements(state);
      }
    }
    migrateWeaponCrews(state);
    installPositionWeapons(state);
    migrateExplicitWorkQueues(state);
    migrateSupportPositions(state);
    if(!state.living!.supplyDemands)reconcileSupplyDemands(state);
    if(migratedV4){
      for(const s of state.soldiers)if(s.needs?.life==='dead'&&!s.death)s.death={cause:'legacy-unknown',at:state.elapsed,occurredAt:state.elapsed,condition:{healthBefore:s.health,energy:s.needs.energy,hunger:s.needs.hunger,thirst:s.needs.thirst}};
      state.living!.migrationNote='Copy migrated to v4. People, coordinates, stock and existing timing preserved. Historical death causes are unknown; no retrospective deprivation. Original saves remain untouched.';
    }
    if(state.combatRules!==RULES_VERSION){
      for(const g of state.living!.garrisons)if(g.cutoff==='decision')g.cutoff='warning';
      for(const s of state.soldiers){
        if(s.selfCare?.kind==='supply-wait'){delete s.selfCare;delete s.survivalReason;}
        // Preserve route, cargo and elapsed recovery work. Legacy mobile naps
        // now finish as field rest; proper stationary sleep remains sleep.
        if(s.selfCare?.kind==='sleep'&&s.selfCare.mobile){s.selfCare.kind='field-rest';s.selfCare.until=Math.min(s.selfCare.until,state.elapsed+45);if(s.action==='sleeping')s.action='resting';}
      }
      state.living!.migrationNote=(state.living!.migrationNote??'')+' Food and water no longer cause injury or death. Historical injuries and cause records are preserved; no supplies were added.';
    }
    state.schemaVersion=4;state.combatRules=RULES_VERSION;
    return state;
  }

  hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null||localStorage.getItem(WORLD2_V3_KEY)!==null||localStorage.getItem(V3_KEY)!==null||localStorage.getItem(V2_KEY)!==null||localStorage.getItem(LEGACY_KEY)!==null;
  }
  legacyNotice():string{return localStorage.getItem(SAVE_KEY)!==null?'':localStorage.getItem(WORLD2_V3_KEY)!==null?'Existing campaign will be migrated as a copy; the original save is preserved.':this.hasSave()?'Legacy 8 km save found · preserved separately. It needs the matching older build; start a new 4 km battle to play here.':'';}
}

function isBattlefieldState(value: unknown): value is BattlefieldState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BattlefieldState>;
  if(candidate.worldVersion!==WORLD_VERSION||candidate.worldSize!==WORLD_SIZE)return false;
  const shape = (
    ([1,2,3,4].includes(candidate.schemaVersion!)) &&
    typeof candidate.seed === 'number' &&
    typeof candidate.elapsed === 'number' &&
    typeof candidate.nextEntityId === 'number' &&
    Array.isArray(candidate.soldiers) &&
    Array.isArray(candidate.squads) &&
    Array.isArray(candidate.trenches) &&
    Array.isArray(candidate.craters)
  );
  if(!shape)return false;
  const state=candidate as BattlefieldState;
  if(!validTerrainKnowledge(state)||!validPreparedOrders(state))return false;
  if(!validBuildings(state))return false;
  if(!validCombatSystems(state))return false;
  if(!validWorldPositions(state))return false;
  if(state.squads.some(s=>!s||s.faction!==undefined&&!['player','enemy'].includes(s.faction)))return false;
  const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
  const point=(p:unknown):boolean=>Boolean(p&&typeof p==='object'&&finite((p as {x:unknown}).x)&&finite((p as {z:unknown}).z));
  if(!finite(state.seed)||!finite(state.elapsed)||state.elapsed<0||![0,1,2,5].includes(state.simSpeed)||!Number.isInteger(state.nextEntityId))return false;
  if(state.schemaVersion===1&&state.living!==undefined)return false;
  const ids=new Set<number>();
  if(state.schemaVersion!==1&&!validLiving(state))return false;
  if(state.operation!==undefined&&!validOperation(state))return false;
  for(const entity of [...state.soldiers,...state.squads,...state.trenches,...state.craters,...(state.living?[...state.living.garrisons,...state.living.facilities,...state.living.trucks,...state.living.crates]:[])]){
    if(!entity||!Number.isInteger(entity.id)||entity.id<1||ids.has(entity.id)||entity.id>=state.nextEntityId)return false;
    ids.add(entity.id);
  }
  if(!state.soldiers.every(s=>point(s)&&finite(s.heading)&&finite(s.health)&&s.health>=0&&s.health<=100&&finite(s.fatigue)&&finite(s.morale)&&finite(s.ammunition)&&finite(s.suppression)&&Number.isInteger(s.squadId)&&typeof s.action==='string'))return false;
  if(!state.squads.every(s=>point(s)&&typeof s.name==='string'&&['rifle','engineer','machinegun','mortar','medical'].includes(s.kind)&&Array.isArray(s.soldierIds)&&Array.isArray(s.route)&&s.route.every(point)&&Number.isInteger(s.routeIndex)&&s.routeIndex>=0&&s.order&&['hold','move','occupy-trench','construct-trench'].includes(s.order.type)&&(!s.order.target||point(s.order.target))))return false;
  const soldierMap=new Map(state.soldiers.map(s=>[s.id,s])),claimed=new Set<number>();
  for(const squad of state.squads)for(const id of squad.soldierIds){if(claimed.has(id)||soldierMap.get(id)?.squadId!==squad.id)return false;claimed.add(id);}
  if(claimed.size!==state.soldiers.length)return false;
  if(!state.trenches.every(t=>Array.isArray(t.points)&&t.points.length>=2&&t.points.every(point)&&finite(t.progress)&&t.progress>=0&&t.progress<=1&&finite(t.width)&&t.width>0&&finite(t.depth)&&t.depth>0&&['planned','building','complete'].includes(t.status)))return false;
  for(const t of state.trenches)if(t.excavation!==undefined){
    const e=t.excavation,length=polylineLength(t.points);
    if(!e||![e.start,e.end,e.origin].every(finite)||e.start<0||e.end<e.start||e.end>length+.000001||e.origin<e.start-.000001||e.origin>e.end+.000001||length<=0||Math.abs(t.progress-(e.end-e.start)/length)>1e-7)return false;
  }
  const trenchIds=new Set(state.trenches.map(t=>t.id));
  for(const squad of state.squads){
    const order=squad.order;
    if(squad.tactics&&(![0,1].includes(squad.tactics.group)||!finite(squad.tactics.switchAt)||squad.tactics.switchAt<0))return false;
    if(order.intent!==undefined&&!['move','observe','suppress','assault','fall-back'].includes(order.intent)||order.pushThrough!==undefined&&typeof order.pushThrough!=='boolean')return false;
    if(order.drawnPath!==undefined&&(!Array.isArray(order.drawnPath)||order.drawnPath.length<2||order.drawnPath.length>8192||!order.drawnPath.every(point)||order.type!=='move'))return false;
    if(order.pathEndOffset!==undefined&&(!finite(order.pathEndOffset)||order.pathEndOffset<0))return false;
    if(squad.constructionQueue!==undefined&&(!Array.isArray(squad.constructionQueue)||!squad.constructionQueue.every(j=>typeof j==='number'?trenchIds.has(j):j&&((j.kind==='trench'&&trenchIds.has(j.id))||(j.kind==='facility'&&state.living?.facilities.some(f=>f.id===j.id))))||new Set(squad.constructionQueue.map(j=>typeof j==='number'?`trench:${j}`:`${j.kind}:${j.id}`)).size!==squad.constructionQueue.length))return false;
    if(squad.workStarted!==undefined&&typeof squad.workStarted!=='boolean')return false;
    if(squad.engineerWork!==undefined){
      const work=squad.engineerWork,members=new Set<number>();
      if(!work||order.type!=='construct-trench'||work.version!==1||!finite(work.nextReview)||work.nextReview<0||!Array.isArray(work.crews)||work.crews.length>squad.soldierIds.length)return false;
      if(work.projectId!==undefined&&!trenchIds.has(work.projectId)||work.projectTrenches!==undefined&&(!Array.isArray(work.projectTrenches)||work.projectTrenches.some(id=>!trenchIds.has(id))||new Set(work.projectTrenches).size!==work.projectTrenches.length))return false;
      const jobs=new Set([order.trenchId,...(work.projectTrenches??[]),...(squad.constructionQueue??[]).map(j=>typeof j==='number'?j:j.kind==='trench'?j.id:undefined)]);
      for(const crew of work.crews){
        if(!crew||!Array.isArray(crew.soldierIds)||crew.soldierIds.length<1||crew.soldierIds.length>2||![-1,1].includes(crew.direction)||!Array.isArray(crew.route)||!crew.route.every(point)||!Number.isInteger(crew.routeIndex)||crew.routeIndex<0||crew.routeIndex>crew.route.length||typeof crew.approached!=='boolean')return false;
        if(crew.trenchId!==0&&(!trenchIds.has(crew.trenchId)||!jobs.has(crew.trenchId)&&state.trenches.find(t=>t.id===crew.trenchId)?.status!=='complete'))return false;
        if(crew.trenchId===0&&(crew.route.length||crew.approached))return false;
        for(const id of crew.soldierIds){if(!squad.soldierIds.includes(id)||members.has(id))return false;members.add(id);}
      }
    }
    if(order.trenchId!==undefined&&!trenchIds.has(order.trenchId))return false;
  }
  for(const soldier of state.soldiers){
    const travel=soldier.formationTravel;
    if(travel&&(!finite(travel.orderAt)||travel.orderAt<0||travel.orderAt>state.elapsed||!Number.isInteger(travel.index)||travel.index<0||!point(travel.goal)||!insideWorld(travel.goal)||!Array.isArray(travel.local)||travel.local.length>8192||!travel.local.every(p=>point(p)&&insideWorld(p))||!Number.isInteger(travel.localIndex)||travel.localIndex<0||travel.localIndex>travel.local.length||!finite(travel.retryAt)||travel.retryAt<0||!point(travel.checkpoint)||!finite(travel.progressAt)||travel.progressAt<0||travel.progressAt>state.elapsed||typeof travel.arrived!=='boolean'))return false;
    if(soldier.posture!==undefined&&!['standing','crouched','prone'].includes(soldier.posture))return false;
    const combat=soldier.combat;
    if(combat){
      if(!Number.isSafeInteger(combat.shotSequence)||combat.shotSequence<0)return false;
      const aim=combat.aim;
      if(aim&&(![aim.since,aim.lastSeen,aim.lastHeading,aim.settlingUntil].every(finite)||!point(aim.point)||!finite(aim.point.y)||!point(aim.lastPosition)||aim.targetId!==undefined&&!soldierMap.has(aim.targetId)))return false;
      if(combat.reaction!==undefined&&!['steady','under-fire','pinned','shaken','broken'].includes(combat.reaction)||combat.owner!==undefined&&!['order','duty','reaction','casualty','building','support','self-care'].includes(combat.owner))return false;
      if(combat.weapon?.effectivePoint&&!point(combat.weapon.effectivePoint))return false;
      for(const v of [combat.reactionUntil,combat.reactionSince,combat.lastIncoming,combat.threatDirection,combat.coverReview,combat.coverTests])if(v!==undefined&&!finite(v))return false;
      if(combat.coverAnchor!==undefined&&!point(combat.coverAnchor))return false;
      if(combat.reactionRoute!==undefined&&(!Array.isArray(combat.reactionRoute)||!combat.reactionRoute.every(point)||!Number.isInteger(combat.reactionIndex)||combat.reactionIndex!<0||combat.reactionIndex!>combat.reactionRoute.length))return false;
      const w=combat.weapon;
      if(w&&(!WEAPONS[w.id as WeaponId]||!Number.isInteger(w.loaded)||w.loaded<0||w.loaded>WEAPONS[w.id].magazine||![w.reloadUntil,w.setupUntil,w.burstLeft].every(v=>finite(v)&&v>=0)||!point(w.position)||w.effectiveUntil!==undefined&&!finite(w.effectiveUntil)))return false;
    }
    if(soldier.nextShotAt!==undefined&&(!finite(soldier.nextShotAt)||soldier.nextShotAt<0))return false;
    if(soldier.lastShotAt!==undefined&&(!finite(soldier.lastShotAt)||soldier.lastShotAt<0))return false;
    if(soldier.lastTarget!==undefined&&!point(soldier.lastTarget))return false;
    if(soldier.aimTargetId!==undefined&&!soldierMap.has(soldier.aimTargetId))return false;
    for(const timer of [soldier.aimReadyAt,soldier.lastHitAt])if(timer!==undefined&&(!finite(timer)||timer<0))return false;
    if(soldier.pathTravel!==undefined&&(!finite(soldier.pathTravel)||soldier.pathTravel<0))return false;
    if(soldier.trenchTravel!==undefined&&(!finite(soldier.trenchTravel)||soldier.trenchTravel< -1))return false;
    if(soldier.trenchId!==undefined&&!trenchIds.has(soldier.trenchId))return false;
    if(soldier.trenchAlong!==undefined){const trench=state.trenches.find(t=>t.id===soldier.trenchId);if(!trench||!finite(soldier.trenchAlong)||soldier.trenchAlong<excavatedSpan(trench).start||soldier.trenchAlong>excavatedSpan(trench).end)return false;}
  }
  if(state.schemaVersion===1)for(const trench of state.trenches)if(state.soldiers.filter(s=>s.trenchId===trench.id).length>trenchCapacity(trench))return false;
  return state.craters.every(c=>point(c)&&finite(c.radius)&&c.radius>0&&finite(c.depth)&&c.depth>0);
}

/** Physical actors, destinations and works must stay in this generated world.
 * Shot rays and uncertainty areas may extend beyond its edge; they are not actors.
 */
function validWorldPositions(s:BattlefieldState):boolean {
  const w=s.living;
  const points=[...s.soldiers,...s.squads,...s.craters,...s.trenches.flatMap(t=>t.points??[]),
    ...s.squads.flatMap(q=>[...(q.route??[]),...(q.order?.drawnPath??[]),...(q.order?.target?[q.order.target]:[]),...(q.engineerWork?.crews.flatMap(c=>c.route)??[])]),
    ...s.soldiers.flatMap(p=>p.duty?[p.duty.destination,...p.duty.route]:[]),
    ...(s.operation?.objectives??[]),
    ...(w?[w.rear,...(w.enemySupply?[w.enemySupply.rear]:[]),...w.facilities,...w.crates,...w.trucks,...w.trucks.flatMap(t=>t.route),...w.garrisons.flatMap(g=>[g.entrance,g.forward,...(g.frontage??[])])]:[])];
  return points.every(p=>p&&insideWorld(p));
}

function validOperation(state:BattlefieldState):boolean {
  if(!validCampaignSystems(state))return false;
  const op=state.operation!;
  if(!validIntelligence(state))return false;
  const nonnegative=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
  if(!op||op.version!==1||state.schemaVersion===1||!(['advance','defense','campaign'].includes(op.mode)||isOperationId(op.mode))||!['active','victory','defeat'].includes(op.status)||typeof op.reason!=='string'||!validOperationalRuntime(state))return false;
  if(op.shotEvents!==undefined&&(!Array.isArray(op.shotEvents)||op.shotEvents.length>256||!op.shotEvents.every(e=>e&&Number.isSafeInteger(e.id)&&nonnegative(e.at)&&nonnegative(e.energy)&&state.soldiers.some(s=>s.id===e.shooterId&&s.squadId===e.squadId)&&[e.from,e.to].every(p=>p&&[p.x,p.y,p.z].every(Number.isFinite))&&(e.hitId===undefined||state.soldiers.some(s=>s.id===e.hitId))&&(e.obstruction===undefined||['terrain','building','trunk'].includes(e.obstruction)))))return false;
  if(![op.elapsed,op.duration,op.score,op.targetScore,op.nextCombat,op.nextOrders,op.initialPlayer,op.initialEnemy,op.shots,op.hits].every(nonnegative)||(!op.runtime&&op.mode!=='campaign'&&op.duration<=0)||op.targetScore<=0)return false;
  if(!Array.isArray(op.objectives)||new Set(op.objectives.map(o=>o?.id)).size!==op.objectives.length||(!op.runtime&&(op.objectives.length!==3||!op.objectives.some(o=>o?.id==='village'))))return false;
  if(!op.objectives.every(o=>o&&typeof o.id==='string'&&typeof o.name==='string'&&Number.isFinite(o.x)&&Number.isFinite(o.z)&&nonnegative(o.radius)&&o.radius>0&&Number.isFinite(o.control)&&Math.abs(o.control)<=1&&['player','enemy','neutral'].includes(o.owner)&&typeof o.contested==='boolean'&&Number.isInteger(o.cacheId)&&o.cacheId>0))return false;
  if(op.mode==='campaign'||op.mode==='open-front'){
    const c=op.campaign;
    if(!c||op.duration!==0||!state.living?.enemySupply||!(op.runtime?['player-rear','enemy-rear']:['west-hq','east-hq']).every(id=>op.objectives.some(o=>o.id===id))||![c.playerTrench,c.enemyTrench].every(id=>state.trenches.some(t=>t.id===id))||c.playerTrench===c.enemyTrench)return false;
    if(![c.nextRaid,c.returnAt,c.playerHold,c.enemyHold].every(nonnegative)||!['preparing','raiding','returning'].includes(c.phase)||!Array.isArray(c.raidSquads)||new Set(c.raidSquads).size!==c.raidSquads.length||!c.raidSquads.every(id=>state.squads.some(q=>q.id===id&&q.faction==='enemy')))return false;
  }else if(op.campaign!==undefined)return false;
  if(op.lastObservationAt!==undefined&&(!nonnegative(op.lastObservationAt)||op.lastObservationAt>state.elapsed+.001))return false;
  if(op.engagement&&(!nonnegative(op.engagement.lastContact)||op.engagement.lastContact>state.elapsed+.001||!Number.isInteger(op.engagement.number)||op.engagement.number<1))return false;
  if(op.sightProgress!==undefined){
    if(!op.sightProgress||typeof op.sightProgress!=='object')return false;
    for(const side of ['player','enemy'] as const){const rows=op.sightProgress[side];if(!Array.isArray(rows)||new Set(rows.map(r=>r?.soldierId)).size!==rows.length||!rows.every(r=>r&&nonnegative(r.exposure)&&r.exposure<=1&&state.soldiers.some(s=>s.id===r.soldierId&&state.squads.some(q=>q.id===s.squadId&&(q.faction??'player')!==side))))return false;}
  }
  if(op.contacts!==undefined){
    if(!op.contacts||typeof op.contacts!=='object')return false;
    for(const side of ['player','enemy'] as const){
      const contacts=op.contacts[side];if(!Array.isArray(contacts)||new Set(contacts.map(c=>c?.soldierId)).size!==contacts.length)return false;
      for(const c of contacts){
        const soldier=state.soldiers.find(s=>s.id===c?.soldierId),squad=state.squads.find(s=>s.id===soldier?.squadId);
        if(!c||!soldier||!squad||c.squadId!==squad.id||(squad.faction??'player')===side||!Number.isFinite(c.x)||!Number.isFinite(c.z)||!nonnegative(c.lastSeen)||c.lastSeen>state.elapsed+.001||typeof c.visible!=='boolean'||typeof c.active!=='boolean'||!validContactTracking(state,c,side))return false;
      }
    }
  }
  if(op.enemyAI!==undefined){
    const ai=op.enemyAI,enemyIds=new Set(state.squads.filter(q=>q.faction==='enemy').map(q=>q.id));
    const point=(p:unknown):boolean=>!!p&&typeof p==='object'&&Number.isFinite((p as {x:number}).x)&&Number.isFinite((p as {z:number}).z);
    if(!ai||ai.version!==ENEMY_AI_VERSION||!Number.isInteger(ai.decisions)||ai.decisions<0||!Array.isArray(ai.plans)||new Set(ai.plans.map(p=>p?.squadId)).size!==ai.plans.length)return false;
    for(const plan of ai.plans){
      if(!plan||!enemyIds.has(plan.squadId)||!ENEMY_ROLES.includes(plan.role)||!op.objectives.some(o=>o.id===plan.objectiveId)||![plan.goal,plan.home,plan.lastPosition].every(point)||typeof plan.reason!=='string')return false;
      if(![plan.since,plan.commitUntil,plan.lastIssued,plan.stalledFor,plan.orders].every(nonnegative)||plan.since>state.elapsed+.001||plan.lastIssued>state.elapsed+.001||!Number.isInteger(plan.orders))return false;
    }
  }
  return state.squads.every(s=>s.faction===undefined||['player','enemy'].includes(s.faction));
}

function validLiving(state:BattlefieldState):boolean {
  const w=state.living;if(!w||w.version!==1)return false;
  const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
  const nonnegative=(v:unknown)=>finite(v)&&v>=0;
  const point=(v:unknown):boolean=>!!v&&typeof v==='object'&&finite((v as {x:number}).x)&&finite((v as {z:number}).z);
  const stock=(v:unknown):boolean=>!!v&&typeof v==='object'&&RESOURCES.every(k=>nonnegative((v as Record<string,unknown>)[k]));
  if(!nonnegative(w.campaignHours)||typeof w.lethalNeeds!=='boolean'||!nonnegative(w.nextDelivery)||![0,1,2,5].includes(w.emergencyResumeSpeed)||!point(w.rear)||!stock(w.rearStock)||!w.ledger||!w.metrics)return false;
  if(w.entry!==undefined&&(!point(w.entry)||!insideWorld(w.entry))||w.enemySupply?.entry!==undefined&&(!point(w.enemySupply.entry)||!insideWorld(w.enemySupply.entry)))return false;
  if(w.enemySupply!==undefined&&(!w.enemySupply||!point(w.enemySupply.rear)||!stock(w.enemySupply.stock)||!nonnegative(w.enemySupply.nextDelivery)))return false;
  if(w.logistics&&(!stock(w.logistics.manifest)||!['deliveryInterval','rearCapacity','forwardCapacity','cacheCapacity','storeCapacity','convoyCapacity','shuttleCapacity','carrierCapacity'].every(k=>finite(w.logistics![k as keyof typeof w.logistics])&&Number(w.logistics![k as keyof typeof w.logistics])>0)))return false;
  if(!['initial','imported','consumed','lost'].every(k=>stock(w.ledger[k as keyof typeof w.ledger]))||!['watchGapHours','criticalNeedHours','distance','blockedHours','deaths'].every(k=>nonnegative(w.metrics[k as keyof typeof w.metrics])))return false;
  if(![w.garrisons,w.facilities,w.trucks,w.crates].every(Array.isArray))return false;
  const gIds=new Set(w.garrisons.map(g=>g.id)),tIds=new Set(state.trenches.map(t=>t.id)),sIds=new Set(state.soldiers.map(s=>s.id)),qIds=new Set(state.squads.map(s=>s.id));
  const facilities=new Map(w.facilities.map(f=>[f.id,f])),crateIds=new Set(w.crates.map(c=>c.id)),claimedSquads=new Set<number>();
  for(const g of w.garrisons){
    if(g.faction!==undefined&&!['player','enemy'].includes(g.faction)||g.squadIds.some(id=>state.squads.some(q=>q.id===id&&(q.faction??'player')!==(g.faction??'player'))))return false;
    if(!tIds.has(g.trenchId)||typeof g.name!=='string'||!Array.isArray(g.squadIds)||!g.squadIds.every(id=>qIds.has(id))||!point(g.entrance)||!point(g.forward)||!stock(g.cache)||!stock(g.forwardStock)||!finite(g.front)||!nonnegative(g.nextDecision)||!nonnegative(g.nextSupport))return false;
    if(!['routine','alert','stand-to'].includes(g.readiness)||!['rules','learned','hybrid'].includes(g.policy)||!['clear','warning','decision','hold','recover','withdraw'].includes(g.cutoff)||typeof g.policyStatus!=='string'||!Array.isArray(g.scores)||!g.scores.every(finite))return false;
    if(![g.watchRequired,g.watchPresent,g.capacity].every(nonnegative)||![0,6].includes(g.scores.length)||(g.modelId!==undefined&&typeof g.modelId!=='string'))return false;
    if(g.underFireUntil!==undefined&&!nonnegative(g.underFireUntil))return false;
    if(g.breachUntil!==undefined&&!nonnegative(g.breachUntil))return false;
    if(g.nextRoadheadReview!==undefined&&!nonnegative(g.nextRoadheadReview))return false;
    if(g.threatSector&&(!point(g.threatSector)||!finite(g.threatSector.front))||g.reserveRequired!==undefined&&!nonnegative(g.reserveRequired))return false;
    if(g.frontage!==undefined&&(!Array.isArray(g.frontage)||g.frontage.length<2||g.frontage.length>4096||!g.frontage.every(point)))return false;
    if(g.recoveredSince!==undefined&&!nonnegative(g.recoveredSince)||g.supplyIssue!==undefined&&typeof g.supplyIssue!=='string')return false;
    for(const id of g.squadIds){if(claimedSquads.has(id))return false;claimedSquads.add(id);}
  }
  for(const f of w.facilities){
    if(!gIds.has(f.garrisonId)||!tIds.has(f.connectorId)||!point(f)||!['rest','meal','store','ammo','aid','emplacement','mortar'].includes(f.kind)||!nonnegative(f.progress)||f.progress>1||!nonnegative(f.capacity)||typeof f.paid!=='boolean'||!stock(f.stock)||!nonnegative(f.materialCost))return false;
    if(f.weaponSquadId!==undefined&&(!['emplacement','mortar'].includes(f.kind)||!w.garrisons.find(g=>g.id===f.garrisonId)?.squadIds.includes(f.weaponSquadId)||w.facilities.some(other=>other!==f&&other.kind===f.kind&&other.weaponSquadId===f.weaponSquadId)))return false;
  }
  if(w.trucks.some(t=>t.faction!==undefined&&!['player','enemy'].includes(t.faction)||t.faction==='enemy'&&!w.enemySupply))return false;
  for(const t of w.trucks)if(!point(t)||!stock(t.cargo)||!nonnegative(t.fuel)||!finite(t.timer)||!['convoy','shuttle'].includes(t.role)||!['idle','loading','outbound','unloading','returning','blocked'].includes(t.state)||!Array.isArray(t.route)||!t.route.every(point)||!Number.isInteger(t.routeIndex)||t.routeIndex<0||t.routeIndex>t.route.length||(t.garrisonId!==undefined&&!gIds.has(t.garrisonId)))return false;
  for(const c of w.crates)if(!point(c)||!stock(c.stock)||c.droppedBy!==undefined&&!sIds.has(c.droppedBy))return false;
  for(const s of state.soldiers){
    const n=s.needs;if(!n||!['active','incapacitated','dead'].includes(n.life)||!['energy','hunger','thirst','hungryHours','thirstyHours','sleepHours','day','watchHours','interruptedSleep','taskChanges'].every(k=>nonnegative(n[k as keyof typeof n]))||n.energy>100||n.hunger>100||n.thirst>100||!stock(s.carried))return false;
    if([n.hungrySeconds,n.thirstySeconds].some(v=>v!==undefined&&!nonnegative(v)))return false;
    const care=s.selfCare;
    if(s.nextSelfCareReview!==undefined&&!nonnegative(s.nextSelfCareReview)||s.survivalReason!==undefined&&(typeof s.survivalReason!=='string'||s.survivalReason.length>500))return false;
    if(care){
      if(care.mobile!==undefined&&typeof care.mobile!=='boolean')return false;
      if(care.networkBound!==undefined&&typeof care.networkBound!=='boolean')return false;
      if(care.rationUntil!==undefined&&!nonnegative(care.rationUntil))return false;
      if(care.retryAt!==undefined&&!nonnegative(care.retryAt))return false;
      if(care.recovering!==undefined&&typeof care.recovering!=='boolean')return false;
      if(!['sleep','field-rest','meal','resupply','supply-wait'].includes(care.kind)||!['exit','outbound','use','return'].includes(care.stage)||![care.orderAt,care.since,care.until,care.blockedFor].every(nonnegative)||!point(care.home)||!Array.isArray(care.route)||care.route.length>4096||!care.route.every(point)||!Number.isInteger(care.index)||care.index<0||care.index>care.route.length)return false;
      if(care.home.building&&(!Number.isSafeInteger(care.home.building.id)||care.home.building.id<0||![0,1].includes(care.home.building.floor)||!point(care.home.building.target)))return false;
      if(care.source&&(!['cache','forward','facility','rear','crate'].includes(care.source.kind)||!Number.isSafeInteger(care.source.id)||care.source.id<0))return false;
    }
    if(s.personalArea!==undefined&&typeof s.personalArea!=='boolean')return false;
    if(s.assaultHold!==undefined&&(!nonnegative(s.assaultHold)||s.assaultHold>state.elapsed))return false;
    if(s.garrisonId!==undefined){const g=w.garrisons.find(g=>g.id===s.garrisonId),q=state.squads.find(q=>q.id===s.squadId);if(!g||!q||(g.faction??'player')!==(q.faction??'player')||!s.personalArea&&!g.squadIds.includes(s.squadId))return false;}
    const d=s.duty;if(d&&(!['watch','patrol','sleep','rest','meal','haul','construct'].includes(d.kind)||!point(d.destination)||!Array.isArray(d.route)||!d.route.every(point)||!Number.isInteger(d.routeIndex)||d.routeIndex<0||d.routeIndex>d.route.length||!nonnegative(d.since)||!nonnegative(d.until)||!nonnegative(d.blockedFor)||(d.arrivedAt!==undefined&&!nonnegative(d.arrivedAt))||(d.patientId!==undefined&&!sIds.has(d.patientId))))return false;
    if(d){
      if(d.playerOrdered!==undefined&&(typeof d.playerOrdered!=='boolean'||d.playerOrdered&&(!['watch','sleep','rest','meal'].includes(d.kind)||state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')))return false;
      if(d.watchPost!==undefined&&!point(d.watchPost))return false;
      if(d.entryPoint!==undefined&&!point(d.entryPoint))return false;
      if(d.relocationExit!==undefined&&!point(d.relocationExit))return false;
      if(d.exitPoint!==undefined&&!point(d.exitPoint))return false;
      if(d.rationUntil!==undefined&&!nonnegative(d.rationUntil))return false;
      if(d.pickupQueued!==undefined&&typeof d.pickupQueued!=='boolean')return false;
      if(d.detourWaypoints!==undefined&&(!Number.isInteger(d.detourWaypoints)||d.detourWaypoints<0||d.detourWaypoints>d.route.length))return false;
      for(const flag of [d.networkBound,d.routeBlocked,d.entryPending,d.exitPending])if(flag!==undefined&&typeof flag!=='boolean')return false;
      if(s.garrisonId===undefined||typeof d.reason!=='string'||(d.stage!==undefined&&!['pickup','deliver'].includes(d.stage))||(d.relieving!==undefined&&!sIds.has(d.relieving))||(d.crateId!==undefined&&!crateIds.has(d.crateId)))return false;
      for(const id of [d.facilityId,d.pickupStoreId,d.dropStoreId])if(id!==undefined&&facilities.get(id)?.garrisonId!==s.garrisonId)return false;
    }
  }
  return validPositionState(state)&&validSupplyDemands(state);
}

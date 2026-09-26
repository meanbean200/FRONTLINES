import type { Vec2 } from '../core/types';

export const RESOURCES = ['food', 'water', 'materials', 'fuel', 'ammo','medical','mortarHE','mortarSmoke','smokeGrenades'] as const;
export type Resource = typeof RESOURCES[number];
export type Inventory = Record<Resource, number>;
export const inventory = (values: Partial<Inventory> = {}): Inventory => ({ food: 0, water: 0, materials: 0, fuel: 0, ammo: 0,medical:0,mortarHE:0,mortarSmoke:0,smokeGrenades:0, ...values });
export type DutyKind = 'watch' | 'patrol' | 'sleep' | 'rest' | 'meal' | 'haul' | 'construct';
export type PersonalOrder = 'watch' | 'rest' | 'meal' | 'move' | 'auto';
export type Readiness = 'routine' | 'alert' | 'stand-to';
export type PolicyKind = 'rules' | 'learned' | 'hybrid';
export interface Needs {
  energy: number; hunger: number; thirst: number; life: 'active' | 'incapacitated' | 'dead';
  hungryHours: number; thirstyHours: number; sleepHours: number; day: number;
  /** Simulation seconds, independent of the calendar/daylight clock. */
  hungrySeconds?:number;thirstySeconds?:number;
  watchHours: number; interruptedSleep: number; taskChanges: number;
}
export interface Duty {
  /** Bounded individual order; safety and later squad orders still win. */
  playerOrdered?:boolean;
  kind: DutyKind; destination: Vec2; route: Vec2[]; routeIndex: number; since: number;
  arrivedAt?: number; until: number; reason: string; facilityId?: number; relieving?: number;
  stage?: 'pickup' | 'deliver'; blockedFor: number;
  patientId?: number; crateId?: number;
  pickupStoreId?: number; dropStoreId?: number;
  watchPost?: Vec2;
  rationUntil?: number;
  pickupQueued?: boolean;
  networkBound?:boolean; routeBlocked?:boolean; routeTrenches?:number[];
  /** Initial local avoidance waypoints need precise following, not marching-lane offsets. */
  detourWaypoints?:number;
  entryPending?:boolean; exitPending?:boolean;
  /** Personal entry into completed trench space; logistics still use the supply entrance. */
  entryPoint?:Vec2;
  /** Explicit player reassignment may cross open ground between separate networks. */
  relocationExit?:Vec2;
  /** A withdrawal can supersede a transfer before the old network is exited. */
  exitPoint?:Vec2;
}
export interface Facility extends Vec2 {
  id: number; garrisonId: number; kind: 'rest' | 'meal' | 'store' | 'ammo'|'aid'|'emplacement'|'mortar';
  /** Installed equipment and ready stock belong to the position, not its crew. */
  installation?: {kind:'crew-mg'|'mg42'|'mortar'|'field-gun'; source:'construction'|'legacy-kit'; personId?:number; weapon?:import('../combat/Weapons').WeaponState};
  /** Explicit new field-gun identity. Older indirect posts remain legacy mortars.
   * The internal mortar category/resource keys are retained for save compatibility. */
  artillery?:{batteryId:number;index:number;size:1|2|3|4};
  /** New work orders include the installation in their delivered material budget. */
  includesWeapon?:boolean;
  autoReplaceCrew?:boolean;
  /** Migration-only squad reservation. */
  weaponSquadId?:number;
  /** Authoritative personnel reservations. The legacy squad field is migration-only. */
  weaponCrewIds?:number[];
  /** Metres along the parent centreline; no detached connector for inline posts. */
  trenchAnchor?:{trenchId:number;along:number};
  workOrder?:{explicit:boolean;workerIds:number[];createdAt:number;cancelledAt?:number;autoWorkers?:boolean};
  connectorId: number; progress: number; capacity: number; paid: boolean;
  stock: Inventory; materialCost: number;
  facing?:number;
}
export interface Garrison {
  faction?:'player'|'enemy';
  id: number; name: string; trenchId: number; squadIds: number[]; entrance: Vec2; forward: Vec2;
  front: number; readiness: Readiness; cache: Inventory; forwardStock: Inventory;
  nextDecision: number; nextSupport: number; policy: PolicyKind; policyStatus: string; modelId?: string;
  scores: number[]; cutoff: 'clear' | 'warning' | 'decision' | 'hold' | 'recover' | 'withdraw';
  watchRequired: number; watchPresent: number; capacity: number;
  jobs?: {kind:DutyKind;priority:number;assigned:number;required:number;reason:string}[];
  lossRate?:number; watchEffectiveness?:number;
  recoveredSince?:number; supplyIssue?:string;
  /** Temporary safety response; never replaces the player's selected readiness. */
  underFireUntil?:number;
  breachUntil?:number;
  nextRoadheadReview?:number;
  threatSector?:Vec2&{front:number};
  reserveRequired?:number;
  frontage?:Vec2[];
  lastDeliveryAt?:number;
}
export function effectiveReadiness(garrison:Garrison,elapsed:number):Readiness {
  return (garrison.underFireUntil??0)>elapsed&&garrison.cutoff!=='withdraw'&&garrison.readiness==='routine'?'alert':garrison.readiness;
}
export interface Truck extends Vec2 {
  passengers?:number[];
  faction?:'player'|'enemy';
  id: number; role: 'convoy' | 'shuttle'; state: 'idle' | 'loading' | 'outbound' | 'unloading' | 'returning' | 'blocked';
  route: Vec2[]; routeIndex: number; cargo: Inventory; fuel: number; timer: number;
  garrisonId?: number; reason: string; resume?: 'outbound' | 'returning';
}
export interface Crate extends Vec2 { id: number; stock: Inventory; droppedBy?:number }
/** Accounting claims, never another inventory. Sources refer to physical holders. */
export interface SupplyClaim { source:'local'|'store'|'forward'|'truck'|'carrier'; id:number; amount:number }
export interface SupplyDemand {
  key:string; garrisonId:number; consumer:'construction'|'weapon'|'personnel'|'reserve'; consumerId:number;
  resource:Resource; target:number; usable:number; priority:number; createdAt:number; claims:SupplyClaim[];
}
export interface LogisticsConfig {
  deliveryInterval: number; manifest: Inventory;
  rearCapacity: number; forwardCapacity: number; cacheCapacity: number; storeCapacity: number;
  convoyCapacity: number; shuttleCapacity: number; carrierCapacity: number;
}
export interface LivingWorld {
  entry?:Vec2;
  enemySupply?:{rear:Vec2;entry?:Vec2;stock:Inventory;nextDelivery:number};
  version: 1; campaignHours: number; lethalNeeds: boolean; garrisons: Garrison[]; facilities: Facility[];
  trucks: Truck[]; crates: Crate[]; rear: Vec2; rearStock: Inventory; nextDelivery: number;
  ledger: { initial: Inventory; imported: Inventory; consumed: Inventory; lost: Inventory };
  metrics: { watchGapHours: number; criticalNeedHours: number; distance: number; blockedHours: number; deaths: number };
  emergencyResumeSpeed: number; migrationNote?: string;
  logistics?: LogisticsConfig;
  supplyDemands?:SupplyDemand[];
}

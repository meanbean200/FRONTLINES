import {atDistance,routeMetrics} from './Polyline';
import type { Needs, Duty, Inventory, LivingWorld } from '../garrison/types';
import type { OperationState } from '../operations/types';
import type { SoldierCombat, TacticalIntent } from '../combat/types';

export interface Vec2 {
  x: number;
  z: number;
}

export type CoverType = 'open' | 'low-ground' | 'forest' | 'trench';
export type SquadKind = 'rifle' | 'engineer'|'machinegun'|'mortar'|'medical';
export type OrderType = 'hold' | 'move' | 'occupy-trench' | 'construct-trench';
export type TrenchStatus = 'planned' | 'building' | 'complete';
export type ConstructionJob = {kind:'trench'|'facility';id:number};
export type ConstructionRequest = {kind:'trench';points:Vec2[];engineerSquadId?:number}|{kind:'facility';garrisonId:number;facilityKind:import('../garrison/types').Facility['kind'];origin:Vec2;position:Vec2;facing?:number;explicit?:boolean;guns?:1|4};

export interface SoldierState extends Vec2 {
  death?:import('../simulation/DeathRecord').DeathRecord;
  formationTravel?:import('../navigation/FormationWalker').FormationTravel;
  /** Temporary survival task. Standing formation/building orders remain authoritative. */
  selfCare?:import('../simulation/SelfPreservation').SelfCare;
  nextSelfCareReview?:number;
  survivalReason?:string;
  posture?:'standing'|'crouched'|'prone';
  equipment?:import('../combat/Equipment').InfantryEquipment;
  building?:{id:number;floor:0|1;vertical:number;route:Vec2[];index:number;stage:'approach'|'inside'|'stairs'|'station'|'exit';target:Vec2;targetFloor:0|1;stairTime:number;stairFrom?:Vec2;exitRequested?:boolean;recovering?:boolean;routeReviewAt?:number};
  id: number;
  squadId: number;
  heading: number;
  health: number;
  suppression: number;
  morale: number;
  ammunition: number;
  fatigue: number;
  action: string;
  cover: CoverType;
  trenchId?: number;
  trenchSlot?: number;
  trenchTravel?: number;
  trenchAlong?: number;
  pathTravel?: number;
  needs?: Needs;
  duty?: Duty;
  carried?: Inventory;
  garrisonId?: number;
  /** Individually attached to an area, without rewriting their formation order. */
  personalArea?:boolean;
  nextShotAt?: number;
  lastShotAt?: number;
  lastTarget?: Vec2;
  aimTargetId?:number;
  aimReadyAt?:number;
  lastHitAt?:number;
  combat?:SoldierCombat;
}

export interface SquadOrder {
  building?:{id:number;floor:0|1};
  type: OrderType;
  target?: Vec2;
  trenchId?: number;
  issuedAt: number;
  drawnPath?: Vec2[];
  pathEndOffset?: number;
  intent?:TacticalIntent;
  pushThrough?:boolean;
}

export interface SquadState extends Vec2 {
  id: number;
  faction?: 'player' | 'enemy';
  name: string;
  kind: SquadKind;
  soldierIds: number[];
  order: SquadOrder;
  route: Vec2[];
  routeIndex: number;
  formationHeading?: number;
  constructionQueue?: (number|ConstructionJob)[];
  workStarted?: boolean;
  engineerWork?: {version:1;nextReview:number;crews:EngineerCrew[];projectId?:number;projectTrenches?:number[]};
  tactics?:{group:0|1;switchAt:number};
  orderNote?: string;
  movementState: 'idle' | 'planning' | 'moving' | 'forming' | 'digging' | 'entrenching';
}

export interface EngineerCrew {
  soldierIds:number[];trenchId:number;direction:-1|1;
  route:Vec2[];routeIndex:number;approached:boolean;
}

export interface TrenchState {
  id: number;
  points: Vec2[];
  progress: number;
  status: TrenchStatus;
  width: number;
  depth: number;
  engineerSquadId?: number;
  /** Completed interval in metres along points. Absent in legacy prefix-built trenches. */
  excavation?: {start:number;end:number;origin:number};
}

export interface CraterState extends Vec2 {
  id: number;
  radius: number;
  depth: number;
}

export interface BattlefieldState {
  terrainKnowledge?:import('../operations/TrenchIntelligence').TerrainKnowledge;
  preparedOrders?:import('../operations/PreparedOrders').PreparedOrder[];
  /** Generated terrain identity, separate from serialized simulation schema. */
  worldVersion?: number;
  worldSize?: number;
  buildingChanges?:import('../terrain/BuildingGeometry').BuildingChange[];
  schemaVersion: 1 | 2 | 3 | 4;
  combatRules?: string;
  living?: LivingWorld;
  operation?: OperationState;
  seed: number;
  elapsed: number;
  simSpeed: number;
  nextEntityId: number;
  soldiers: SoldierState[];
  squads: SquadState[];
  trenches: TrenchState[];
  craters: CraterState[];
}

export interface DebugFlags {
  paths: boolean;
  destinations: boolean;
  chunks: boolean;
  trenchGraph: boolean;
  trenchSlots: boolean;
}

export const WORLD_VERSION = 2;
export const WORLD_SIZE = 4_000;
export const WORLD_HALF = WORLD_SIZE / 2;
export const CHUNK_SIZE = 500;
export const CHUNKS_PER_AXIS = WORLD_SIZE / CHUNK_SIZE;
export const FIXED_STEP = 1 / 20;

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const lerpVec = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: lerp(a.x, b.x, t),
  z: lerp(a.z, b.z, t),
});

export function polylineLength(points: Vec2[]): number {
  return routeMetrics(points).length;
}

export function pointAlongPolyline(points: Vec2[], normalized: number): Vec2 {
  return atDistance(points,clamp(normalized,0,1)*polylineLength(points));
}

export function distanceToSegment(point: Vec2, a: Vec2, b: Vec2): { distance: number; t: number } {
  const vx = b.x - a.x;
  const vz = b.z - a.z;
  const lengthSquared = vx * vx + vz * vz;
  if (lengthSquared === 0) return { distance: distance(point, a), t: 0 };
  const t = clamp(((point.x - a.x) * vx + (point.z - a.z) * vz) / lengthSquared, 0, 1);
  return { distance: Math.hypot(point.x - (a.x + vx * t), point.z - (a.z + vz * t)), t };
}

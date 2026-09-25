import type {SquadKind, Vec2} from '../core/types';
import type {Faction} from './types';

export const OPERATIONS_VERSION = 2;
export type OperationId = 'breakthrough' | 'line-defense' | 'meeting' | 'open-front';
export type OperationalPhase = 'preparation' | 'contact' | 'engagement' | 'exploitation' | 'consolidation' | 'withdrawal';
export interface FrontGeometry {origin:Vec2; forward:Vec2; right:Vec2; beltDepth:number}
export interface DeploymentZone {id:string; name:string; center:Vec2; forward:Vec2; halfWidth:number; halfDepth:number}
export interface StrategicLocation {id:string; name:string; kind:'village'|'rear'|'road'; position:Vec2; zoneId:string}
export interface OperationalRoute {id:string; name:string; side:Faction; points:Vec2[]; width:number; destination:Vec2}
export interface StartingForce {rifles:number; engineers:number; machineguns:number; mortars:number; medics:number}
export interface ReinforcementSource {side:Faction; rear:Vec2; entry:Vec2; reserve:number; intervalHours:number; releaseLimit:number}
export type ObjectiveSpec =
  | {type:'physical-mission'}
  | {type:'area-control'; zones:string[]; required:number; minimum:number; holdSeconds:number}
  | {type:'route-control'; routes:string[]; holdSeconds:number}
  | {type:'breakthrough'; zone:string; routes:string[]; minimum:number; squads:number; holdSeconds:number}
  | {type:'hold-line'; zone:string; routes:string[]; minimum:number; squads:number; breachSeconds:number; duration:number};
export interface OperationalObjective {id:string; title:string; side:Faction; priority:'primary'|'optional'; spec:ObjectiveSpec; effect:string}
export interface ObjectiveProgress {id:string; heldFor:number; pressureFor:number; satisfied:boolean; complete:boolean; failed:boolean; reason:string}
export interface VictoryCondition {side:Faction; objectives:string[]; opponentEffectivenessBelow?:number}
export interface OperationDefinition {
  id:OperationId; title:string; tag:string; duration:string; situation:string; intent:string;
  enemyIntent:'defend'|'penetrate'|'contest'; prepared:readonly Faction[]; deployment:Record<Faction,number>;
  forces:Record<Faction,StartingForce>; persistent:boolean; defenseSeconds:number;
}
export interface OperationalCommandMemory {phase:'scouting'|'committing'|'holding'|'withdrawing'; since:number; startingAble:number; reason:string; nextSupport?:number}
/** Plain serialized state only. Rules are versioned independently of unchanged combat rules. */
export interface OperationRuntime {
  missionPlan?:import('./MissionContent').MissionPlan;
  mission?:import('./MissionContent').MissionState;
  version:2; definitionId:OperationId; seed:number; front:FrontGeometry;
  zones:DeploymentZone[]; locations:StrategicLocation[]; routes:OperationalRoute[];
  reinforcements:ReinforcementSource[]; objectives:OperationalObjective[]; victory:VictoryCondition[];
  progress:ObjectiveProgress[]; phase:OperationalPhase; phaseSince:number;
  history:{phase:OperationalPhase;at:number;reason:string}[]; commander?:OperationalCommandMemory;
  routeAccess:Record<string,boolean>; nextEvaluation:number; lastEvaluation:number;
}
export const COMBAT_KINDS:readonly SquadKind[] = ['rifle','machinegun'];

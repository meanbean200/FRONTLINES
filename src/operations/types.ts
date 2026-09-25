import type { Vec2 } from '../core/types';
import type {EnemyMemory} from './EnemyCommander';
import type {ShotEvent} from '../combat/types';
import type {RescueDecision} from '../combat/Casualties';
import type {SupportMission,SmokeField,BlastEvent} from '../combat/SupportWeapons';
import {operationInfo} from './OperationDefinitions';

export type OperationMode = 'advance' | 'defense' | 'campaign' | import('./OperationalTypes').OperationId;
export type GameMode = OperationMode | 'sandbox';
export type Faction = 'player' | 'enemy';
export interface Contact extends Vec2 {
  soldierId:number; squadId:number; lastSeen:number; visible:boolean; active:boolean;
  status?:'confirmed'|'last-reported';uncertainty?:number;
  /** Last real observer; tracking never grants sight through occlusion. */
  observerId?:number; trackedUntil?:number;
}
export interface LocalIntelligence {
  squads:{squadId:number;contacts:Contact[];exposure:{soldierId:number;exposure:number}[];link:'connected'|'isolated';nextReport:number}[];
  reports:{squadId:number;side:Faction;deliverAt:number;contacts:Contact[]}[];
  command:Record<Faction,Contact[]>;
  sounds:{side:Faction;x:number;z:number;radius:number;at:number;status:'suspected'}[];
}
export interface Objective extends Vec2 {
  id: string;
  name: string;
  radius: number;
  owner: Faction | 'neutral';
  /** Signed capture progress: -1 enemy, +1 player. */
  control: number;
  contested: boolean;
  cacheId: number;
}
export interface OperationState {
  forceModel?:'infantry-equipment-v1';
  setup?:import('./BattleSetup').ResolvedBattleSetup;
  runtime?:import('./OperationalTypes').OperationRuntime;
  version: 1;
  mode: OperationMode;
  status: 'active' | 'victory' | 'defeat';
  elapsed: number;
  duration: number;
  score: number;
  targetScore: number;
  nextCombat: number;
  nextOrders: number;
  objectives: Objective[];
  initialPlayer: number;
  initialEnemy: number;
  shots: number;
  hits: number;
  reason: string;
  /** Observed positions only. Lost contacts never track unseen movement. */
  contacts?:Record<Faction,Contact[]>;
  enemyAI?:EnemyMemory;
  /** Unconfirmed exposure has no position, so it cannot leak an unseen target. */
  sightProgress?:Record<Faction,{soldierId:number;exposure:number}[]>;
  lastObservationAt?:number;
  shotEvents?:ShotEvent[];
  intelligence?:LocalIntelligence;
  engagement?:{lastContact:number;number:number};
  casualtyRules?:boolean;
  rescueDecisions?:RescueDecision[];
  supportRules?:boolean;supportMissions?:SupportMission[];smokeFields?:SmokeField[];blastEvents?:BlastEvent[];
  supportRequests?:import('../combat/SupportWeapons').SupportRequest[];
  campaign?: {playerTrench:number;enemyTrench:number;nextRaid:number;raidSquads:number[];returnAt:number;phase:'preparing'|'raiding'|'returning';playerHold:number;enemyHold:number;plan?:import('./CampaignCommander').CampaignPlan;lastPlan?:{objectiveId:string;reason:string;at:number};replacements?:import('./Replacements').ReplacementSystem};
}

export const MODE_INFO = {
  breakthrough:operationInfo('breakthrough'),
  'line-defense':operationInfo('line-defense'),
  meeting:operationInfo('meeting'),
  'open-front':operationInfo('open-front'),
  campaign: {
    title: 'Trench war', duration: 'SAVE & RESUME', tag: 'OPEN-ENDED CAMPAIGN',
    description: 'Two prepared trench networks, physical supply convoys, and a contested village. Build rear supply stores and ammunition dugouts, rotate the watch, and push the opposing line back. No time limit.',
    hint: 'Hold the opposing command post for 120 seconds while protecting your own. Each side has 48 reserves: at most eight replacements per campaign day, delivered physically. Pause, save and resume at any time.',
  },
  advance: {
    title: 'Village offensive', duration: '10 MIN', tag: 'QUICK OPERATION',
    description: 'Take Le Verger and a second strongpoint on the western approach. Hold both to earn 180 control points. Enemy squads seek cover and counterattack using what they can spot.',
    hint: 'Capture with 3 able soldiers. Two objectives earn 1 point/sec. Enemies contest the circle. Pause freely.',
  },
  defense: {
    title: 'Hold the crossroads', duration: '15 MIN', tag: 'DEFENSIVE OPERATION',
    description: 'Defend the village against a finite enemy force that combines covering fire and flanking. Build cover, manage ammunition, and deny their foothold.',
    hint: 'You have 90 seconds to prepare. Keep the Beaumont crossroads until the timer ends, or defeat the assault. Losing the village ends the operation.',
  },
  sandbox: {
    title: 'Living battlefield', duration: 'OPEN ENDED', tag: 'PEACEFUL SANDBOX',
    description: 'Start with a manageable 28-person garrison. Build connected trenches and watch soldiers eat, sleep, work, and receive physical supplies. No enemy or timer.',
    hint: 'Assign squads to trenches with T. Reserves carry finite rations; assign them before leaving a long campaign running.',
  },
} as const;

export const factionOf = (squad: { faction?: Faction }): Faction => squad.faction ?? 'player';

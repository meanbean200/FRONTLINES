import type {Faction} from './types';
import type {Inventory} from '../garrison/types';

export const REINFORCEMENT_POLICIES=['finite','replenishing','continuous'] as const;
export const ENEMY_PRESSURES=['low','standard','high'] as const;
export type ReinforcementPolicy=typeof REINFORCEMENT_POLICIES[number];
export type EnemyPressure=typeof ENEMY_PRESSURES[number];
export interface EndlessOptions {reinforcements:ReinforcementPolicy;pressure:EnemyPressure}
export const defaultEndlessOptions=():EndlessOptions=>({reinforcements:'replenishing',pressure:'standard'});
export function validEndlessOptions(v:unknown):v is EndlessOptions {
  const o=v as EndlessOptions|undefined;
  return !!o&&REINFORCEMENT_POLICIES.includes(o.reinforcements)&&ENEMY_PRESSURES.includes(o.pressure);
}
export interface EndlessDirector {
  phase:'probe'|'commit'|'hold'|'regroup';targetId:string;since:number;reviewAt:number;
  startingAble:number;attempts:number;nextSupport:number;reason:string;
  /** Own presence and delivered reports, not a live enemy oracle. */
  knownSites:{id:string;owner:Faction|'neutral';at:number}[];
  failedTargets:{id:string;until:number}[];
}
export interface EndlessState {
  version:1;options:EndlessOptions;startedAt:number;startedHour:number;
  targetStrength:Record<Faction,number>;initialReserve:number;
  generatedReserve:Record<Faction,number>;nextAvailability:Record<Faction,number>;
  nextSupplyAvailability:Record<Faction,number>;nextAccounting:number;
  /** Authorized off-map stock, not world inventory until a map-edge truck loads it. */
  sourceStock:Record<Faction,Inventory>;sourceInitial:Inventory;sourceGenerated:Record<Faction,Inventory>;
  sourceUsed:Record<Faction,Inventory>;rearTarget:Record<Faction,Inventory>;
  owners:Record<string,Faction|'neutral'>;director:EndlessDirector;
  history:{at:number;kind:'control'|'reserve'|'ended';text:string}[];
  statistics:{captured:Record<Faction,number>;lost:Record<Faction,number>;reinforcements:Record<Faction,number>};
  ended?:{at:number;cause:'player-ended'|'force-exhausted';side?:Faction};
}

import {hash2D} from '../core/random';
import {OPERATION_DEFINITIONS,isOperationId,forceSize} from './OperationDefinitions';
import type {OperationDefinition,OperationId} from './OperationalTypes';
import type {BattlefieldState} from '../core/types';
import type {Faction} from './types';

export type BattleSize='small'|'medium'|'large';
export type Army='us'|'german';
export interface AdvancedBattleOptions {
  time:'dawn'|'day'|'dusk'|'night'; direction:'auto'|'east'|'south'|'west'|'north';
  composition:'standard'|'balanced'; engineers:1|2; mortars:boolean; smoke:boolean;
  supply:'standard'|'low'; reserves:0|24|48; approach:'standard'|'close';
}
/** Configuration only; never includes units, inventory, DOM or mutable mission progress. */
export interface BattleSetup {
  version:1; operation:OperationId; size:BattleSize; side:Army|'random';
  map:'random'|'seed'; seed:number; advanced:AdvancedBattleOptions;
}
export interface ResolvedBattleSetup extends BattleSetup {side:Army;map:'seed'}
export interface OperationPreset {id:string;name:string;options:Partial<AdvancedBattleOptions>}
export const SETUP_PRESETS:readonly OperationPreset[]=[
  {id:'standard',name:'Standard',options:{}},
  {id:'balanced',name:'Balanced forces',options:{composition:'balanced'}},
  {id:'low-supply',name:'Low supply',options:{supply:'low'}},
  {id:'engineers',name:'Engineer support',options:{engineers:2}},
  {id:'fast-contact',name:'Closer approach',options:{approach:'close'}},
];
export const SIZE_LABELS:Record<BattleSize,string>={small:'Small · fewer formations',medium:'Medium · standard force',large:'Large · wider frontage'};
export const ARMY_LABELS:Record<Army,string>={us:'U.S. forces',german:'German forces'};
export const defaultAdvanced=():AdvancedBattleOptions=>({time:'day',direction:'auto',composition:'standard',engineers:1,mortars:true,smoke:true,supply:'standard',reserves:48,approach:'standard'});
export const defaultBattleSetup=():BattleSetup=>({version:1,operation:'breakthrough',size:'medium',side:'us',map:'random',seed:1944,advanced:defaultAdvanced()});
export function applyPreset(setup:BattleSetup,id:string):BattleSetup {
  const preset=SETUP_PRESETS.find(p=>p.id===id);if(!preset)throw new Error('Unknown setup preset');
  return {...setup,advanced:{...defaultAdvanced(),...preset.options}};
}
export function validBattleSetup(value:unknown,resolved=false):value is BattleSetup {
  if(!value||typeof value!=='object')return false;
  const s=value as BattleSetup,a=s.advanced;
  return s.version===1&&isOperationId(s.operation)&&['small','medium','large'].includes(s.size)&&
    (resolved?['us','german']:['us','german','random']).includes(s.side)&&
    (resolved?s.map==='seed':['random','seed'].includes(s.map))&&Number.isSafeInteger(s.seed)&&s.seed>=1&&s.seed<=2147483647&&!!a&&
    ['dawn','day','dusk','night'].includes(a.time)&&['auto','east','south','west','north'].includes(a.direction)&&
    ['standard','balanced'].includes(a.composition)&&[1,2].includes(a.engineers)&&typeof a.mortars==='boolean'&&typeof a.smoke==='boolean'&&
    ['standard','low'].includes(a.supply)&&[0,24,48].includes(a.reserves)&&['standard','close'].includes(a.approach);
}
/** Randomness is supplied at the UI boundary. A resolved setup always recreates exactly. */
export function resolveBattleSetup(setup:BattleSetup,randomSeed:number):ResolvedBattleSetup {
  if(!validBattleSetup(setup))throw new Error('Check the battle settings and seed (1–2147483647).');
  const seed=setup.map==='seed'?setup.seed:randomSeed;
  if(!Number.isSafeInteger(seed)||seed<1||seed>2147483647)throw new Error('Invalid random seed');
  return {...structuredClone(setup),map:'seed',seed,side:setup.side==='random'?(hash2D(seed,731,91)<.5?'us':'german'):setup.side};
}
export function configuredDefinition(id:OperationId,setup?:ResolvedBattleSetup):OperationDefinition {
  const d=structuredClone(OPERATION_DEFINITIONS[id]);if(!setup)return d;
  if(!validBattleSetup(setup,true)||setup.operation!==id)throw new Error('Incompatible battle setup');
  const base={small:2,medium:4,large:8}[setup.size],a=setup.advanced;
  for(const side of ['player','enemy'] as const){
    const f=d.forces[side],advantage=a.composition==='standard'&&f.rifles>4?2:0;
    f.rifles=base+advantage;f.engineers=a.engineers;f.mortars=a.mortars?1:0;
  }
  if(a.approach==='close')for(const side of ['player','enemy'] as const){const depth=d.deployment[side];d.deployment[side]=Math.sign(depth)*(Math.abs(depth)===550?450:Math.min(Math.abs(depth),650));}
  return d;
}
export function armyFor(state:BattlefieldState,side:Faction):Army {
  const player=state.operation?.setup?.side??'us';return side==='player'?player:player==='us'?'german':'us';
}
export function forceSummary(setup:ResolvedBattleSetup):string {
  const f=configuredDefinition(setup.operation,setup).forces.player;
  return `${f.rifles} rifle squads · ${f.engineers} engineer ${f.engineers===1?'section':'sections'} · machine-gun team${f.mortars?' · mortar team':''} · medics`;
}
export function battlePopulation(setup:BattleSetup):string {
  const resolved=resolveBattleSetup({...setup,map:'seed'},setup.seed),d=configuredDefinition(setup.operation,resolved);
  return `${forceSize(d.forces.player)} friendly / ${forceSize(d.forces.enemy)} opposing personnel`;
}

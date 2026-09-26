import type {ScenarioIntent} from './ScenarioPreset';
export const AUTHOR_INTENTS=['attack','defend','hold'] as const;
export const intentKind=(intent:ScenarioIntent)=>intent==='probe'?'attack':intent==='support'?'defend':intent==='reserve'?'hold':intent;
export const INTENT_LABELS={attack:'Advance / contest',defend:'Guard target',hold:'Remain here'};
export const INTENT_HELP={
 attack:'AI chooses routes toward the target (or an objective). Contacts, supply and self-preservation can interrupt it.',
 defend:'AI seeks nearby cover around the chosen target. It can react to threats and needs; this is not an immovable post.',
 hold:'Excluded from commander movement orders. Still observes, fights and manages needs. Trench duties remain active; not a special reserve AI.'
};

import {validateScenario,type ScenarioPreset} from './ScenarioPreset';
import published from 'virtual:frontlines-title-preset';
// Build-time validated snapshot. No draft files, filesystem writers or editor controls.
export function menuPreset():ScenarioPreset{
 if(!published)throw new Error('No title battle published. Open FRONTLINES DEV and choose Use for title screen.');
 if(typeof published==='object'&&'unavailable'in published)throw new Error(String(published.unavailable));
 validateScenario(published);return structuredClone(published);
}

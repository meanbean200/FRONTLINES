import {validBattleSetup,type BattleSetup} from '../operations/BattleSetup';

export const SETUP_STORAGE_KEY='frontlines-battle-setups-v1';
export interface SavedSetup {name:string;setup:BattleSetup}
type StoragePort=Pick<Storage,'getItem'|'setItem'>;
export function readSetupPresets(storage:StoragePort):SavedSetup[] {
  try {const data:unknown=JSON.parse(storage.getItem(SETUP_STORAGE_KEY)??'[]');
    return Array.isArray(data)?data.filter((p):p is SavedSetup=>!!p&&typeof p.name==='string'&&p.name.trim().length>0&&p.name.length<=48&&validBattleSetup(p.setup)).slice(0,12):[];
  }catch{return [];}
}
export function saveSetupPreset(storage:StoragePort,name:string,setup:BattleSetup):void {
  name=name.trim();if(!name||name.length>48)throw new Error('Use a preset name of 1–48 characters.');
  if(!validBattleSetup(setup))throw new Error('Check settings before saving.');
  const rows=readSetupPresets(storage);if(rows.some(p=>p.name.toLowerCase()===name.toLowerCase()))throw new Error('That name already exists. Use a new name.');
  if(rows.length>=12)throw new Error('Twelve local presets are already saved.');
  // A failed write never modifies the separate battlefield save key.
  storage.setItem(SETUP_STORAGE_KEY,JSON.stringify([...rows,{name,setup:structuredClone(setup)}]));
}

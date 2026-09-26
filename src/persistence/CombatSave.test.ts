import {describe,it,expect,vi} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {SaveSystem,SAVE_KEY} from './SaveSystem';
import {balance} from '../garrison/Inventory';
describe('combat v3 saves',()=>{
  it('migrates a copy without replacing legacy storage, health, roster or stock',()=>{
    const old=createOperation('advance');old.schemaVersion=2;delete old.combatRules;old.soldiers[0].health=40;
    const raw=JSON.stringify(old),store=new Map([['frontlines-battlefield-v2',raw]]);
    vi.stubGlobal('localStorage',{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)});
    try{const save=new SaveSystem(),restored=save.load()!;expect(restored.schemaVersion).toBe(4);expect(restored.soldiers[0].health).toBe(40);expect(restored.soldiers.length).toBe(old.soldiers.length);expect(restored.living!.ledger).toEqual(old.living!.ledger);save.save(restored);expect(store.get('frontlines-battlefield-v2')).toBe(raw);expect(store.has(SAVE_KEY)).toBe(true);expect(balance(restored)).toEqual(balance(old));}finally{vi.unstubAllGlobals();}
  });
  it('preserves aiming and the deterministic counter; rejects corrupt combat state',()=>{
    const state=createOperation('advance'),s=state.soldiers[0];s.combat={shotSequence:123,aim:{since:0,lastSeen:0,point:{x:1,y:2,z:3},lastHeading:1,lastPosition:{x:0,z:0},settlingUntil:5}};
    const save=new SaveSystem();expect(save.parse(JSON.stringify(state))).toEqual(state);
    s.combat.shotSequence=-1;expect(()=>save.parse(JSON.stringify(state))).toThrow();
  });
});

import {describe,it,expect,vi} from 'vitest';
import {defaultBattleSetup,resolveBattleSetup} from './BattleSetup';
import {createOperationalBattle} from './createOperationalBattle';
import {createOperation} from './createOperation';
import {initialReserveCapacity,stepReplacements} from './Replacements';
import {SaveSystem} from '../persistence/SaveSystem';

describe('configured replacement capacity',()=>{
  for(const capacity of [0,24,48] as const)it(`preserves ${capacity} capacity through release and saved continuation`,()=>{
    const setup=defaultBattleSetup();setup.operation='open-front';setup.advanced.reserves=capacity;
    const resolved=resolveBattleSetup(setup,1944),state=createOperationalBattle('open-front',1944,resolved);
    const r=state.operation!.campaign!.replacements!;
    expect(initialReserveCapacity(state)).toBe(capacity);expect(r.reserve).toEqual({player:capacity,enemy:capacity});
    for(const s of state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='player').slice(-8)){
      s.health=0;s.needs!.life='dead';
    }
    state.living!.campaignHours=r.nextAt.player;stepReplacements(state,.05);
    expect(r.reserve.player).toBe(Math.max(0,capacity-8));expect(initialReserveCapacity(state)).toBe(capacity);
    const store=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>store.get(key)??null,setItem:(key:string,value:string)=>store.set(key,value)});
    try {
      const saves=new SaveSystem();saves.save(state);const loaded=saves.load()!;
      expect(loaded.operation!.campaign!.replacements).toEqual(r);
      expect(initialReserveCapacity(loaded)).toBe(capacity);
      expect(loaded.operation!.setup).toEqual(resolved);
    } finally {vi.unstubAllGlobals();}
  });
  it('uses the historical 48 for a legacy campaign without setup, not its remaining pool',()=>{
    const state=createOperation('campaign');expect(state.operation!.setup).toBeUndefined();
    for(const s of state.soldiers.slice(0,8)){s.health=0;s.needs!.life='dead';}
    state.living!.campaignHours=state.operation!.campaign!.replacements!.nextAt.player;stepReplacements(state,.05);
    const copy=new SaveSystem().parse(JSON.stringify(state));
    expect(copy.operation!.campaign!.replacements!.reserve.player).toBe(40);
    expect(initialReserveCapacity(copy)).toBe(48);
  });
  it('retains 48 for persistent factory scenarios that predate explicit setup',()=>{
    const state=createOperationalBattle('open-front');expect(state.operation!.setup).toBeUndefined();
    expect(initialReserveCapacity(new SaveSystem().parse(JSON.stringify(state)))).toBe(48);
  });
});

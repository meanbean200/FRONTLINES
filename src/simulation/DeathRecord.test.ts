import {describe,it,expect,vi} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {recordDeath,deathDescription} from './DeathRecord';
import {updateNeeds} from '../garrison/NeedsSystem';
import {updateCasualtyCare} from '../combat/Casualties';
import {BattlefieldSimulation} from './BattlefieldSimulation';
import {SaveSystem,SAVE_KEY} from '../persistence/SaveSystem';
import {balance} from '../garrison/Inventory';

describe('persistent, abstract death provenance',()=>{
  it('records a transition and drops cargo only once',()=>{
    const state=createOperation('campaign'),p=state.soldiers[0],before=balance(state),deaths=state.living!.metrics.deaths;
    state.elapsed=10;recordDeath(state,p,{cause:'artillery',at:10,eventId:42,squadId:state.squads[1].id});
    const saved=structuredClone(state);recordDeath(state,p,{cause:'deprivation',at:10,deprivation:'thirst'});
    expect(state).toEqual(saved);expect(state.living!.metrics.deaths).toBe(deaths+1);expect(balance(state)).toEqual(before);
    expect(deathDescription(p)).toBe('Died from artillery wounds');expect(new SaveSystem().parse(JSON.stringify(state))).toEqual(state);
  });
  it('distinguishes fatigue collapse from combat death; obsolete lethal thirst cannot kill',()=>{
    const state=createOperation('campaign'),sim=new BattlefieldSimulation(state),p=state.soldiers[0];
    p.needs!.energy=0;p.needs!.hunger=p.needs!.thirst=10;delete p.duty;p.action='walking';updateNeeds(state,p,.05);
    expect(p.needs!.life).toBe('incapacitated');expect(p.death).toBeUndefined();
    state.living!.lethalNeeds=true;p.needs!.thirst=100;p.needs!.thirstyHours=7;p.needs!.thirstySeconds=7/(24/1800);p.health=.001;state.elapsed=100;
    updateNeeds(state,p,.05);expect(p.death).toBeUndefined();expect(p.needs!.life).toBe('incapacitated');expect(p.health).toBeGreaterThanOrEqual(.001);
    const patient=state.soldiers[1];patient.needs!.life='incapacitated';patient.combat={shotSequence:0,wound:{severity:'critical',at:0,bleedUntil:100,stabilized:false,care:'untreated',origin:{cause:'artillery',at:0,eventId:123}}};
    updateCasualtyCare(state,sim.terrain,sim.navigation,.05);expect(patient.death).toMatchObject({cause:'artillery',eventId:123,at:0,occurredAt:100});
  });
  it('migrates a v3 copy without overwriting storage or inventing old death causes',()=>{
    const state=createOperation('campaign');state.schemaVersion=3;state.soldiers[0].health=0;state.soldiers[0].needs!.life='dead';
    const raw=JSON.stringify(state),key='frontlines-battlefield-v3-world2-4km',store=new Map([[key,raw]]);
    vi.stubGlobal('localStorage',{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)});
    try {const save=new SaveSystem(),loaded=save.load()!;expect(loaded.soldiers[0].death?.cause).toBe('legacy-unknown');expect(loaded.living!.ledger).toEqual(state.living!.ledger);save.save(loaded);expect(store.get(key)).toBe(raw);expect(store.has(SAVE_KEY)).toBe(true);}finally{vi.unstubAllGlobals();}
  });
  it('rejects fabricated/future cause records rather than silently repairing them',()=>{
    const s=createOperation('campaign'),p=s.soldiers[0];recordDeath(s,p,{cause:'combat-fire',at:0});p.death!.occurredAt=100;
    expect(()=>new SaveSystem().parse(JSON.stringify(s))).toThrow();
  });
});

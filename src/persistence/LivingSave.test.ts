import {describe,it,expect,vi} from 'vitest';
import {SaveSystem} from './SaveSystem';
import {createStudyScenario} from '../garrison/StudyScenario';
import {RULES_VERSION} from '../garrison/GarrisonPolicy';

describe('living save boundaries',()=>{
  it('stores policy schema and preserves the legacy storage key',()=>{
    const storage=new Map([['frontlines-battlefield-v1','legacy-do-not-overwrite']]);
    vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)});
    expect(new SaveSystem().legacyNotice()).toContain('new Open Front battle');
    const saved=JSON.parse(new SaveSystem().save(createStudyScenario().state));
    expect(saved.policySchema).toEqual({observationVersion:2,rulesVersion:RULES_VERSION});
    expect(storage.get('frontlines-battlefield-v1')).toBe('legacy-do-not-overwrite');vi.unstubAllGlobals();
  });
  it('keeps unavailable saved model identity visibly distinct from a current model',()=>{
    const state=createStudyScenario().state,g=state.living!.garrisons[0];g.policy='learned';g.modelId='old-model';
    const saved={...state,policySchema:{observationVersion:999,rulesVersion:'unknown'}};
    const restored=new SaveSystem().parse(JSON.stringify(saved));
    expect(restored.living!.garrisons[0].policyStatus).toContain('Fallback');
    expect(restored.living!.garrisons[0].modelId).toContain('unavailable-schema:');
  });
  it.each(['combat-44-supply-interception-world2','combat-45-command-logistics-world2','combat-46-open-front-reset-world2'])('migrates %s without replaying survival migrations or adding stock',(rules)=>{
    const state=createStudyScenario().state,g=state.living!.garrisons[0];
    state.combatRules=rules;g.cutoff='decision';g.policy='learned';g.modelId='old-model';
    const original=JSON.stringify(state),saved={...state,policySchema:{observationVersion:2,rulesVersion:state.combatRules}};
    const restored=new SaveSystem().parse(JSON.stringify(saved));
    expect(restored.soldiers).toEqual(state.soldiers);expect(restored.squads).toEqual(state.squads);expect(restored.trenches).toEqual(state.trenches);
    expect(restored.living!.ledger).toEqual(state.living!.ledger);expect(restored.living!.rearStock).toEqual(state.living!.rearStock);
    expect(restored.living!.garrisons[0].cache).toEqual(g.cache);expect(restored.living!.garrisons[0].cutoff).toBe('decision');
    expect(restored.living!.garrisons[0].policyStatus).toContain('Fallback');expect(restored.combatRules).toBe(RULES_VERSION);
    expect(restored.living!.migrationNote).not.toContain('Food and water');expect(JSON.stringify(state)).toBe(original);
  });
  it('rejects dangling stores, duplicate memberships and missing metrics',()=>{
    const state=createStudyScenario().state,save=new SaveSystem();
    const duplicate=structuredClone(state);duplicate.living!.garrisons[0].squadIds.push(duplicate.squads[0].id);expect(()=>save.parse(JSON.stringify(duplicate))).toThrow();
    const missing=structuredClone(state),metrics=missing.living!.metrics;delete (metrics as Partial<typeof metrics>).distance;expect(()=>save.parse(JSON.stringify(missing))).toThrow();
    const sim=createStudyScenario();sim.step(.05);const soldier=sim.state.soldiers.find(s=>s.duty)!;soldier.duty!.pickupStoreId=999999;expect(()=>save.parse(JSON.stringify(sim.state))).toThrow();
  });
  it('rejects unsupported emergency resume speeds without changing an existing save',()=>{
    const state=createStudyScenario().state,save=new SaveSystem(),storage=new Map([['frontlines-battlefield-v2','existing-save']]);
    vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)});
    try{
      for(const speed of [-1,.5,100,NaN]){
        state.living!.emergencyResumeSpeed=speed;
        expect(()=>save.parse(JSON.stringify(state))).toThrow();expect(()=>save.save(state)).toThrow();
        expect(storage.get('frontlines-battlefield-v2')).toBe('existing-save');
      }
    }finally{vi.unstubAllGlobals();}
  });
  it('preserves optional safe-haul feedback and urgency but rejects malformed copies',()=>{
    const sim=createStudyScenario();sim.step(.05);
    const state=sim.state,g=state.living!.garrisons[0],person=state.soldiers.find(p=>p.duty)!,save=new SaveSystem();
    g.haulIssue={personId:person.id,destination:{...g.forward},at:state.elapsed,reason:'NO SAFE APPROACH'};person.duty!.urgentAmmo=true;
    const saved=save.parse(JSON.stringify(state));expect(saved.living!.garrisons[0].haulIssue).toEqual(g.haulIssue);expect(saved.soldiers.find(p=>p.id===person.id)!.duty!.urgentAmmo).toBe(true);
    for(const value of [null,{...g.haulIssue,at:-1},{...g.haulIssue,destination:{x:'bad',z:0}},{...g.haulIssue,reason:'invented'}]){
      const copy=structuredClone(state);Object.assign(copy.living!.garrisons[0],{haulIssue:value});expect(()=>save.parse(JSON.stringify(copy))).toThrow();
    }
    const copy=structuredClone(state);Object.assign(copy.soldiers.find(p=>p.id===person.id)!.duty!,{urgentAmmo:'true'});expect(()=>save.parse(JSON.stringify(copy))).toThrow();
  });
});

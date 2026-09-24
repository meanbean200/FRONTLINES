import {describe,it,expect,vi} from 'vitest';
import {SaveSystem} from './SaveSystem';
import {createStudyScenario} from '../garrison/StudyScenario';
import {RULES_VERSION} from '../garrison/GarrisonPolicy';

describe('living save boundaries',()=>{
  it('stores policy schema and preserves the legacy storage key',()=>{
    const storage=new Map([['frontlines-battlefield-v1','legacy-do-not-overwrite']]);
    vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)});
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
});

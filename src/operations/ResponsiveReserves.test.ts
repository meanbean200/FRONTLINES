import {describe,it,expect} from 'vitest';
import {defaultOpenFrontSetup,resolveBattleSetup} from './BattleSetup';
import {createOperationalBattle} from './createOperationalBattle';
import {stepReplacements,reserveDispatchAt,replacementInterval} from './Replacements';
import {SaveSystem} from '../persistence/SaveSystem';

describe('finite responsive releases in new Open Front only',()=>{
  it('releases recorded losses every four simulation minutes, without adding people before transport arrives',()=>{
    const s=createOperationalBattle('open-front',1944,resolveBattleSetup({...defaultOpenFrontSetup(),map:'seed',seed:1944},1944),true),r=s.operation!.campaign!.replacements!;
    expect(r.clock).toBe('simulation');expect(replacementInterval(s)).toBe(240);
    const soldier=s.soldiers[0],people=s.soldiers.length,initial=r.reserve.player;soldier.needs!.life='dead';soldier.health=0;
    s.elapsed=239;stepReplacements(s,.05);expect(r.manifests).toHaveLength(0);
    s.elapsed=240;stepReplacements(s,.05);expect(r.manifests).toHaveLength(1);expect(r.manifests[0].stage).toBe('edge');expect(r.reserve.player).toBe(initial-1);expect(s.soldiers).toHaveLength(people);
    expect(reserveDispatchAt(r,'player')).toBe(480);expect(new SaveSystem().parse(JSON.stringify(s)).operation!.campaign!.replacements).toEqual(r);
  });
  it('preserves an existing Open Front save with the old calendar cadence, finite stock and roster',()=>{
    const s=createOperationalBattle('open-front',1944,resolveBattleSetup({...defaultOpenFrontSetup(),map:'seed',seed:1944},1944),true),r=s.operation!.campaign!.replacements!;
    delete r.releaseIntervalSeconds;delete r.clock;r.nextAt={player:32,enemy:32};const before=JSON.stringify({people:s.soldiers,stocks:s.living!.rearStock,r});
    const copy=new SaveSystem().parse(JSON.stringify(s));expect(replacementInterval(copy)).toBe(24);expect(JSON.stringify({people:copy.soldiers,stocks:copy.living!.rearStock,r:copy.operation!.campaign!.replacements})).toBe(before);
  });
  it('does not accept a forged fast cadence on a legacy operation',()=>{
    const s=createOperationalBattle('open-front'),r=s.operation!.campaign!.replacements!;r.clock='simulation';r.releaseIntervalSeconds=240;
    expect(()=>new SaveSystem().parse(JSON.stringify(s))).toThrow();
  });
});

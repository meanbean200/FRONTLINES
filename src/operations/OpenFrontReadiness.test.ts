import {describe,it,expect} from 'vitest';
import {createOperationalBattle} from './createOperationalBattle';
import {defaultBattleSetup,resolveBattleSetup,type BattleSize} from './BattleSetup';
import {commandOperationalEnemy} from './OperationalCommander';
import {observeEnemy} from './EnemyCommander';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {balance} from '../garrison/Inventory';
import {SaveSystem} from '../persistence/SaveSystem';
import {atDepth,frontDepth} from './OperationGeometry';
import {defaultEndlessOptions} from './EndlessTypes';

describe('Open Front start and opening intentions',()=>{
  it('compares 64/72/80 with finite kit and stock; 72 is the smallest full role budget',()=>{
    // A simultaneous staffing budget, not a claim of subjective battle quality.
    const budget={trench:16,building:8,mobile:16,reserve:8,workers:8,fieldGuns:8,mg:2,haulers:4,medical:2};
    const needed=Object.values(budget).reduce((a,b)=>a+b,0);expect(needed).toBe(72);
    for(const [i,size]of (['small','medium','large'] as BattleSize[]).entries()){
      const setup=resolveBattleSetup({...defaultBattleSetup(),operation:'open-front',size,map:'seed',seed:1944},1944),s=createOperationalBattle('open-front',1944,setup);
      const people=s.soldiers.filter(p=>s.squads.find(q=>q.id===p.squadId)?.faction==='player');
      expect(people).toHaveLength([64,72,80][i]);expect(people.every(p=>p.equipment&&p.carried!.food>0&&p.carried!.water>0)).toBe(true);
      expect(people.length>=needed).toBe(size!=='small');expect(s.living!.trucks.length).toBe(8);
      expect(Object.values(balance(s)).every(n=>Math.abs(n)<1e-6)).toBe(true);
      expect(new SaveSystem().parse(JSON.stringify(s)).soldiers).toHaveLength(s.soldiers.length);
    }
  });
  it('a first report does not dispatch the main force straight to the rear; assembly must physically arrive',()=>{
    const s=createOperationalBattle('open-front'),terrain=new TerrainSystem(s),o=observeEnemy(s),town=o.operational!.staging![0];
    o.contacts=[{soldierId:1,squadId:1,x:o.operational!.targets[0].point.x,z:o.operational!.targets[0].point.z,lastSeen:o.at,visible:false,active:true,status:'last-reported'}];
    const initial=commandOperationalEnemy(o,terrain);expect(initial.commander.phase).toBe('scouting');expect(initial.commands.some(c=>c.type==='move'),JSON.stringify({squads:o.squads,commands:initial.commands})).toBe(true);
    const k=o.operational!,approach=atDepth(k.front,k.deploymentDepth,0),selected=k.staging!.filter(site=>frontDepth(k.front,site.point)<k.deploymentDepth-100).sort((a,b)=>Math.hypot(a.point.x-approach.x,a.point.z-approach.z)-Math.hypot(b.point.x-approach.x,b.point.z-approach.z))[0]??town;
    expect(frontDepth(k.front,selected.point)).toBeLessThan(k.deploymentDepth-100);
    expect(initial.commands.some(c=>c.type==='move'&&frontDepth(k.front,c.goal)<frontDepth(k.front,o.squads.find(q=>q.id===c.squadId)!)-20)).toBe(true);
    o.squads.filter(q=>!q.emplaced&&!q.working).slice(0,3).forEach(q=>{q.x=selected.point.x;q.z=selected.point.z;});o.at+=20;
    const arrived=commandOperationalEnemy(o,terrain,undefined,initial.commander);expect(arrived.commander.phase).toBe('consolidating');
    o.at+=19;const committed=commandOperationalEnemy(o,terrain,undefined,arrived.commander);expect(committed.commander.phase).toBe('committing');
  });
  it('keeps the distinct Endless director outside the Open Front staging rule',()=>{
    const setup=resolveBattleSetup({...defaultBattleSetup(),operation:'open-front',battleMode:'endless',endless:defaultEndlessOptions(),map:'seed',seed:1944},1944);
    const state=createOperationalBattle('open-front',1944,setup);
    expect(state.operation!.endless).toBeDefined();expect(observeEnemy(state).operational!.staging).toBeUndefined();
  });
});

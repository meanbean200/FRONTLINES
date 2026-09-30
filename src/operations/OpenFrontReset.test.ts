import {describe,it,expect} from 'vitest';
import {defaultOpenFrontSetup,defaultBattleSetup,resolveBattleSetup,validBattleSetup} from './BattleSetup';
import {createOperationalBattle} from './createOperationalBattle';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {insideWorld,roadRoute,mapCenter,mapProject,mapUnproject} from '../terrain/WorldLayout';
import {SaveSystem} from '../persistence/SaveSystem';
import {balance} from '../garrison/Inventory';
import {atDepth} from './OperationGeometry';
import {stepOperationalRuntime} from './OperationalRuntime';
import {rearAccess} from './RearAccess';
import {createGroundGeometry} from '../render/GroundGeometry';
import {defaultEndlessOptions} from './EndlessTypes';
import {renderBattleSetup,renderBattleBriefing} from '../ui/BattleSetupView';

const fresh=(seed=1944,direction:'east'|'south'|'west'|'north'='east')=>{
  const setup=resolveBattleSetup({...defaultOpenFrontSetup(),map:'seed',seed,advanced:{...defaultOpenFrontSetup().advanced,direction}},seed);
  return createOperationalBattle('open-front',seed,setup,true);
};
describe('Open Front v1 reset; legacy rules preserved',()=>{
  it('starts a real 2.4 km sector, 72/64 people and no finished works in every direction',()=>{
    for(const direction of ['east','south','west','north'] as const)for(const seed of [1944,81,117]){
      const s=fresh(seed,direction),terrain=new TerrainSystem(s);
      expect(s.worldSize).toBe(2400);expect(s.trenches).toEqual([]);expect(s.living!.facilities).toEqual([]);
      expect([s.operation!.initialPlayer,s.operation!.initialEnemy]).toEqual([72,64]);
      expect([...s.soldiers,...s.squads,...s.living!.trucks,...s.living!.crates].every(p=>insideWorld(p,0,2400))).toBe(true);
      expect(s.soldiers.every(p=>!terrain.obstacleAt(p.x,p.z,.1))).toBe(true);
      expect(new SaveSystem().parse(JSON.stringify(s)).worldSize).toBe(2400);
      expect(Object.values(balance(s)).every(n=>Math.abs(n)<1e-6)).toBe(true);
    }
  });
  it('keeps legacy Open Front and Endless dimensions, trenches, identities and rules',()=>{
    for(const endless of [false,true]){
      const setup=resolveBattleSetup({...defaultBattleSetup(),operation:'open-front',map:'seed',...(endless?{battleMode:'endless' as const,endless:defaultEndlessOptions()}:{})},1944);
      const s=createOperationalBattle('open-front',1944,setup,true),restored=new SaveSystem().parse(JSON.stringify(s));
      expect(s.worldSize).toBe(4000);expect(s.trenches.some(t=>t.progress===1)).toBe(true);expect(s.operation!.runtime!.openFront).toBeUndefined();
      expect(restored.operation!.runtime).toEqual(s.operation!.runtime);expect(restored.soldiers.map(p=>[p.id,p.x,p.z])).toEqual(s.soldiers.map(p=>[p.id,p.x,p.z]));
    }
    expect(validBattleSetup({...defaultOpenFrontSetup(),battleMode:'endless',endless:defaultEndlessOptions()})).toBe(false);
  });
  it('bounds navigation, worker terrain, road graph and map projection to the actual world',()=>{
    const s=fresh(),sim=new BattlefieldSimulation(s),terrain=sim.terrain;
    expect(terrain.obstacleAt(1250,0)).toBe(true);expect(terrain.clampToWorld({x:1800,z:-1700})).toEqual({x:1190,z:-1190});
    const route=sim.navigation.plan(s.squads[0],{x:1800,z:300});expect(route.length).toBeGreaterThan(0);expect(route.every(p=>insideWorld(p,0,2400))).toBe(true);
    const road=roadRoute(s.living!.rear,s.living!.enemySupply!.rear,undefined,2400);expect(road.length).toBeGreaterThan(0);expect(road.every(p=>insideWorld(p,0,2400))).toBe(true);
    const mesh=createGroundGeometry(terrain,1000,-500,8,false);mesh.computeBoundingBox();expect(mesh.boundingBox!.max.x).toBe(1200);mesh.dispose();
    expect(terrain.snapshot.worldSize).toBe(2400);expect(mapCenter({x:1100,z:1100},2400,1,2400)).toEqual({x:0,z:0});
    const p={x:1190,z:-1190},q=mapProject(p,{x:0,z:0},2400);expect(mapUnproject(q.x,q.y,{x:0,z:0},2400)).toEqual(p);
    s.soldiers[0].x=1300;expect(()=>new SaveSystem().parse(JSON.stringify(s))).toThrow();
  });
  it('rejects unsupported rules/dimensions instead of shrinking or reinterpreting a save',()=>{
    const s=fresh();s.worldSize=4000;expect(()=>new SaveSystem().parse(JSON.stringify(s))).toThrow();
    s.worldSize=2400;delete s.operation!.setup!.openFrontRules;expect(()=>new SaveSystem().parse(JSON.stringify(s))).toThrow();
  });
  it('offers one normal battle setup, not a mission picker, with honest briefing',()=>{
    const s=fresh().operation!.setup!,html=renderBattleSetup(s,false,[]),brief=renderBattleBriefing(s);
    expect(html).toContain('2.4 × 2.4 km');expect(html).not.toContain('data-mode-choice');expect(html).not.toContain('data-battle-mode');expect(brief).toContain('Neither army has dug in');expect(brief).toContain('actual opposing rear depot');
  });
  it('does not win or suspend dispatch by camping empty far-edge ground',()=>{
    const s=fresh(),r=s.operation!.runtime!,terrain=new TerrainSystem(s);
    const ids=s.squads.filter(q=>q.faction==='player').slice(0,2).map(q=>q.id);
    s.soldiers.filter(p=>ids.includes(p.squadId)).forEach((p,i)=>Object.assign(p,atDepth(r.front,1090,900+i)));
    for(let i=0;i<250;i++){s.elapsed++;s.operation!.elapsed++;stepOperationalRuntime(s,terrain);}
    expect(s.operation!.status).toBe('active');expect(r.progress.find(p=>p.id==='player-intent')!.heldFor).toBe(0);expect(rearAccess(s,terrain,'enemy').blocked).toBe(false);
  });
  it('requires a connected viable force at the physical depot and resets pressure on recovery',()=>{
    const s=fresh(),terrain=new TerrainSystem(s),r=s.operation!.runtime!,rear=s.living!.enemySupply!.rear;
    // Synthetic evaluator fixture. Move formations off the access road, then
    // place an actual assault at the depot; no rendering/AI acceptance claimed.
    for(const p of s.soldiers)Object.assign(p,{x:p.x,z:p.z+500});
    const ids=s.squads.filter(q=>q.faction==='player').slice(0,2).map(q=>q.id),attack=s.soldiers.filter(p=>ids.includes(p.squadId));
    attack.forEach((p,i)=>Object.assign(p,{x:rear.x+(i%4)*2,z:rear.z+Math.floor(i/4)*2}));
    const tick=()=>{s.elapsed++;s.operation!.elapsed++;stepOperationalRuntime(s,terrain);};
    for(let i=0;i<25;i++)tick();expect(rearAccess(s,terrain,'enemy').blocked).toBe(true);expect(r.progress.find(p=>p.id==='player-intent')!.heldFor).toBe(25);expect(s.operation!.status).toBe('active');
    attack.forEach(p=>p.z+=300);tick();expect(r.progress.find(p=>p.id==='player-intent')!.heldFor).toBe(0);
    attack.forEach(p=>p.z-=300);for(let i=0;i<181;i++)tick();expect(s.operation!.status).toBe('victory');expect(s.operation!.outcome!.objectives[0].locations[0].halfWidth).toBe(110);
  });
  it('enemy begins real excavation, keeps a maneuver force and restores unfinished work exactly',()=>{
    const s=fresh(),a=new BattlefieldSimulation(s);for(let i=0;i<100;i++)a.stepFixed();
    const work=s.operation!.runtime!.openFront!.works[0];expect(work).toBeDefined();expect(work.squadIds).toHaveLength(2);
    expect(s.squads.filter(q=>q.faction==='enemy'&&q.order.type==='construct-trench')).toHaveLength(2);
    expect(s.trenches[0].progress).toBeLessThan(1);
    for(let i=0;i<1200;i++)a.stepFixed();expect(s.trenches[0].progress).toBeGreaterThan(0);
    const b=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(s)));for(let i=0;i<20;i++){a.stepFixed();b.stepFixed();}
    expect(b.state.trenches).toEqual(s.trenches);expect(b.state.operation!.runtime!.openFront).toEqual(s.operation!.runtime!.openFront);expect(b.state.soldiers).toEqual(s.soldiers);
    expect(Object.values(balance(s)).every(n=>Math.abs(n)<1e-6)).toBe(true);
  },30000);
  it('retains both construction teams and physically supplies/builds an initial enemy MG',()=>{
    const s=fresh(),sim=new BattlefieldSimulation(s);let firstRequest=0,firstWork=0,complete=0;
    for(let i=0;i<6000;i++){
      sim.stepFixed();const mg=s.living!.facilities.find(f=>f.kind==='emplacement'&&s.living!.garrisons.some(g=>g.id===f.garrisonId&&g.faction==='enemy'));
      if(mg&&!firstRequest)firstRequest=s.elapsed;if(mg?.progress&&!firstWork)firstWork=s.elapsed;
      if(mg?.progress===1){complete=s.elapsed;break;}
    }
    const work=s.operation!.runtime!.openFront!.works[0],g=s.living!.garrisons.find(g=>g.trenchId===work.trenchId)!;
    console.info('OPEN_FRONT_AI_STARTUP',JSON.stringify({firstRequest,firstWork,complete}));
    expect(g.squadIds).toEqual(expect.arrayContaining(work.squadIds));
    const evidence=JSON.stringify({firstRequest,firstWork,complete,g,facilities:s.living!.facilities,people:s.soldiers.filter(p=>g.squadIds.includes(p.squadId)).map(p=>({id:p.id,x:p.x,z:p.z,duty:p.duty,needs:p.needs,carried:p.carried,care:p.selfCare,owner:p.combat?.owner})),crates:s.living!.crates,trucks:s.living!.trucks});
    expect(firstRequest).toBeGreaterThan(0);expect(firstWork,evidence).toBeGreaterThan(firstRequest);expect(complete,evidence).toBeGreaterThan(firstWork);
    expect(s.living!.ledger.consumed.materials).toBeGreaterThanOrEqual(16);
    expect(Object.values(balance(s)).every(n=>Math.abs(n)<1e-5)).toBe(true);
  },60000);
});

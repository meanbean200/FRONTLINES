import { describe, expect, it } from 'vitest';
import { createOperation } from './createOperation';
import { COMBAT_RULES, combatCover, lineOfFire } from './OperationSystem';
import { BattlefieldSimulation } from '../simulation/BattlefieldSimulation';
import { SaveSystem } from '../persistence/SaveSystem';
import { balance } from '../garrison/Inventory';
import { factionOf } from './types';
import { createBattlefield, createPlayableSandbox } from '../simulation/createBattlefield';
import { distance } from '../core/types';

describe('bounded tactical operations', () => {
  it('creates distinct finite modes with balanced starting manifests and passable spawns', () => {
    for (const mode of ['advance','defense'] as const) {
      const state=createOperation(mode), sim=new BattlefieldSimulation(state);
      expect(state.operation!.duration).toBe(mode==='advance'?600:900);
      expect(state.squads.filter(s=>s.faction==='player')).toHaveLength(6);
      expect(state.soldiers.every(s=>!sim.terrain.obstacleAt(s.x,s.z,.1))).toBe(true);
      expect(Object.values(balance(state)).every(n=>Math.abs(n)<1e-8)).toBe(true);
      expect(()=>new SaveSystem().parse(JSON.stringify(state))).not.toThrow();
    }
  });
  it('keeps peaceful legacy sandboxes free of combat', () => {
    const state=createBattlefield(), sim=new BattlefieldSimulation(state);
    for(let i=0;i<100;i++)sim.step(.05);
    expect(state.operation).toBeUndefined(); expect(state.soldiers.every(s=>s.health===100)).toBe(true);
  });
  it('starts the playable sandbox with a manageable fully assignable garrison', () => {
    const state=createPlayableSandbox(),sim=new BattlefieldSimulation(state);
    expect(state.soldiers).toHaveLength(28);expect(state.squads).toHaveLength(3);
    expect(sim.assignGarrison(state.squads.map(s=>s.id),state.trenches[0].id)).toBe(true);
    expect(state.soldiers.every(s=>s.garrisonId!==undefined)).toBe(true);
    expect(Object.values(balance(state)).every(n=>Math.abs(n)<1e-8)).toBe(true);
  });
  it('gives a defensive operation ninety seconds of preparation before enemy movement', () => {
    const sim=new BattlefieldSimulation(createOperation('defense'));
    for(let i=0;i<1200;i++)sim.step(.05);
    expect(sim.state.squads.filter(s=>s.faction==='enemy').every(s=>s.order.type==='hold')).toBe(true);
    for(let i=0;i<700;i++)sim.step(.05);
    expect(sim.state.squads.some(s=>s.faction==='enemy'&&s.order.type==='move')).toBe(true);
  });
  it('rejects enemy player commands, including drawn paths and garrison assignment', () => {
    const state=createOperation('advance'), sim=new BattlefieldSimulation(state), enemy=state.squads.find(s=>s.faction==='enemy')!, original=structuredClone(enemy.order);
    sim.issueMove([enemy.id],{x:-1300,z:-1400}); sim.issueHold([enemy.id]);
    expect(sim.issueDrawnPath([enemy.id],[{x:-1300,z:-1400},{x:-1250,z:-1400}])).toBe(false);
    expect(sim.issueOccupyNearest([enemy.id])).toBeUndefined();expect(enemy.order).toEqual(original);
  });
  it('requires three physical able troops and freezes capture while contested', () => {
    const state=createOperation('advance'),sim=new BattlefieldSimulation(state),op=state.operation!,o=op.objectives[0];
    const player=state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='player'),enemy=state.soldiers.find(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')!;
    for(const s of state.soldiers){s.x=-3000;s.z=-3000;s.nextShotAt=10000;}
    op.nextOrders=10000;
    player.slice(0,2).forEach(s=>{s.x=o.x;s.z=o.z;});
    sim.operations.step(10,()=>{});expect(o.control).toBe(0);
    player[2].x=o.x;player[2].z=o.z;
    sim.operations.step(10,()=>{});expect(o.control).toBeCloseTo(10/COMBAT_RULES.captureSeconds);
    enemy.x=o.x;enemy.z=o.z;const prior=o.control;
    sim.operations.step(10,()=>{});expect(o.control).toBe(prior);expect(o.contested).toBe(true);
    enemy.x=-3000;sim.operations.step(35,()=>{});expect(o.owner).toBe('player');
  });
  it('does not capture with incapacitated or heavily suppressed troops', () => {
    const state=createOperation('advance'),sim=new BattlefieldSimulation(state),o=state.operation!.objectives[0];state.operation!.nextOrders=10000;
    for(const s of state.soldiers){s.x=-3000;s.z=-3000;s.nextShotAt=10000;}
    for(const s of state.soldiers.slice(0,8)){s.x=o.x;s.z=o.z;s.suppression=100;}
    sim.operations.step(.05,()=>{});expect(o.control).toBe(0);
    for(const s of state.soldiers.slice(0,8))s.needs!.life='incapacitated';
    sim.operations.step(10,()=>{});expect(o.control).toBe(0);
  });
  it('denies scoring while a lone hostile contests an owned circle without enough troops to capture', () => {
    const state=createOperation('advance'),sim=new BattlefieldSimulation(state),op=state.operation!;
    for(const s of state.soldiers){s.x=-3000;s.z=-3000;s.nextShotAt=10000;}
    for(const o of op.objectives){o.owner='player';o.control=1;}
    const enemy=state.soldiers.find(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')!,o=op.objectives[1];
    enemy.x=o.x;enemy.z=o.z;op.nextOrders=10000;sim.operations.step(1,()=>{});
    expect(o.contested).toBe(true);expect(o.owner).toBe('player');expect(op.score).toBe(0);
  });
  it('a captured cache transfers supplies only after stopping physically nearby and conserves inventory', () => {
    const state=createOperation('advance'),sim=new BattlefieldSimulation(state),o=state.operation!.objectives[0],s=state.soldiers[0];
    state.operation!.nextCombat=state.operation!.nextOrders=10000;
    for(const enemy of state.soldiers.filter(p=>state.squads.find(q=>q.id===p.squadId)?.faction==='enemy')){enemy.x=-3000;enemy.z=-3000;}
    o.owner='player';o.control=1;s.action='holding';
    s.carried!.ammo-=20;state.living!.ledger.consumed.ammo+=20;
    s.x=o.x+20;s.z=o.z;sim.operations.step(1,()=>{});expect(s.carried!.ammo).toBe(40);
    s.x=o.x;sim.operations.step(1,()=>{});expect(s.carried!.ammo).toBe(44);
    expect(Object.values(balance(state)).every(n=>Math.abs(n)<1e-8)).toBe(true);
  });
  it('blocks rifle fire through building footprints and preserves cover advantage', () => {
    const sim=new BattlefieldSimulation(createOperation('advance')),b=sim.terrain.buildings[0];
    expect(lineOfFire(sim.terrain,{x:b.x-b.width,z:b.z+2},{x:b.x+b.width,z:b.z+2})).toBe(false);
    expect(combatCover('trench')).toBeLessThan(combatCover('forest'));expect(combatCover('forest')).toBe(combatCover('open')); // Leaves conceal; only physical trunks stop bullets.
  });
  it('fires only with ammunition and resolves shots without breaking the inventory ledger', () => {
    const state=createOperation('advance'),sim=new BattlefieldSimulation(state),enemy=state.soldiers.find(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')!,player=state.soldiers[0];
    state.operation!.nextOrders=10000;
    for(const s of state.soldiers){s.x=-3000;s.z=-3000;s.nextShotAt=10000;}
    player.x=-2000;player.z=-1500;enemy.x=-1990;enemy.z=-1500;player.nextShotAt=0;
    const before=player.carried!.ammo;sim.operations.step(.5,()=>{});
    expect(state.operation!.shots).toBe(0); // First acquire and aim; no instant-perfect reaction.
    for(let i=0;i<4&&state.operation!.shots===0;i++)sim.operations.step(.5,()=>{});
    expect(state.operation!.shots).toBe(1);expect(player.carried!.ammo).toBe(before-1);
    state.living!.ledger.consumed.ammo+=player.carried!.ammo;player.carried!.ammo=0;
    sim.operations.step(20,()=>{});expect(state.operation!.shots).toBe(1);
    expect(Object.values(balance(state)).every(n=>Math.abs(n)<1e-8)).toBe(true);
  });
  it('reaches victory on sustained objective control and cannot resume after completion', () => {
    const state=createOperation('advance'),sim=new BattlefieldSimulation(state),op=state.operation!;
    for(const o of op.objectives){o.owner='player';o.control=1;}
    for(const s of state.soldiers){s.x=-3000;s.z=-3000;s.nextShotAt=10000;}
    op.nextOrders=10000;op.score=op.targetScore-1;
    sim.operations.step(1,()=>{});expect(op.status).toBe('victory');expect(state.simSpeed).toBe(0);
    const elapsed=state.elapsed;state.simSpeed=5;sim.step(.05);expect(state.elapsed).toBe(elapsed);
  });
  it('times out an uncompleted offensive and loses a defense after village capture', () => {
    for(const mode of ['advance','defense'] as const){
      const state=createOperation(mode),sim=new BattlefieldSimulation(state),op=state.operation!;
      if(mode==='advance')op.elapsed=op.duration;
      else {const o=op.objectives.find(o=>o.id==='village')!;o.owner='enemy';o.control=-1;}
      sim.operations.step(.05,()=>{});expect(op.status).toBe('defeat');
    }
  });
  it('continues combat, objectives, and enemy decisions identically after save/load', () => {
    const a=new BattlefieldSimulation(createOperation('advance'));const ids=a.state.squads.filter(s=>factionOf(s)==='player').slice(0,3).map(s=>s.id);
    a.issueMove(ids,{x:-1180,z:-1400});for(let i=0;i<800;i++)a.step(.05);
    const b=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(a.state)));
    for(let i=0;i<800;i++){a.step(.05);b.step(.05);}
    expect(b.state).toEqual(a.state);expect(Object.values(balance(a.state)).every(n=>Math.abs(n)<1e-7)).toBe(true);
  },20000);
  it('rejects corrupt operation payloads without applying migrations', () => {
    const state=createOperation('advance');state.operation!.objectives[0].control=Infinity;
    expect(()=>new SaveSystem().parse(JSON.stringify(state))).toThrow();
    const second=createOperation('advance');second.operation!.objectives.pop();expect(()=>new SaveSystem().parse(JSON.stringify(second))).toThrow();
  });
  it('surviving troops finish a multi-waypoint move without being anchored to casualties', () => {
    const state=createPlayableSandbox(),squad=state.squads[0];
    state.squads=[squad];state.soldiers=state.soldiers.filter(s=>s.squadId===squad.id);
    const sim=new BattlefieldSimulation(state);
    for(const [i,s] of state.soldiers.entries()){
      s.x=-2000+i*.5;s.z=-2000;
      if(i>=4){s.health=0;s.needs!.life='dead';}
    }
    sim.step(.05);
    const dead=state.soldiers.filter(s=>s.needs!.life==='dead').map(s=>({x:s.x,z:s.z}));
    const destination={x:-1880,z:-1940};
    sim.scheduleNavigation=(_start,_goal,done)=>done([{x:-1940,z:-2000},destination]);
    sim.issueMove([squad.id],destination);
    for(let i=0;i<2200&&squad.order.type==='move';i++)sim.step(.05);
    expect(squad.order.type).toBe('hold');
    expect(distance(squad,destination)).toBeLessThan(3);
    expect(state.soldiers.filter(s=>s.needs!.life==='dead').map(s=>({x:s.x,z:s.z}))).toEqual(dead);
  });
  it('keeps finished operations immutable when issuing orders from battlefield markers', () => {
    const state=createOperation('advance'),sim=new BattlefieldSimulation(state);
    state.operation!.status='victory';state.simSpeed=0;
    const before=structuredClone(state),ids=state.squads.filter(s=>s.faction==='player').map(s=>s.id);
    sim.issueMove(ids,{x:-1500,z:-1500});sim.issueHold(ids);
    expect(sim.issueOccupyNearest([ids[0]],state.trenches[0].id)).toBeUndefined();
    expect(sim.issueDrawnPath(ids,[{x:-1500,z:-1500},{x:-1600,z:-1500}])).toBe(false);
    expect(sim.createTrench([{x:-1500,z:-1500},{x:-1600,z:-1500}],ids.at(-1))).toBeUndefined();
    expect(sim.resumeConstruction(ids)).toBe(0);
    expect(state).toEqual(before);
  });
});

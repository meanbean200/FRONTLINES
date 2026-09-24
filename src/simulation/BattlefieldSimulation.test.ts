import { describe, expect, it } from 'vitest';
import { createBattlefield } from './createBattlefield';
import { BattlefieldSimulation } from './BattlefieldSimulation';
import { TerrainSystem } from '../terrain/TerrainSystem';
import { SaveSystem } from '../persistence/SaveSystem';

describe('battlefield foundation', () => {
  it('ignores stale worker routes after a newer command or hold',()=>{
    const simulation=new BattlefieldSimulation(createBattlefield());
    const callbacks:((route:{x:number;z:number}[])=>void)[]=[];
    simulation.scheduleNavigation=(_start,_goal,done)=>callbacks.push(done);
    const squad=simulation.state.squads[0];
    simulation.issueMove([squad.id],{x:-1250,z:-1250});
    simulation.issueMove([squad.id],{x:-1200,z:-1250});
    callbacks[0]([{x:-1250,z:-1250}]);
    expect(squad.movementState).toBe('planning');expect(squad.route).toHaveLength(0);
    simulation.issueHold([squad.id]);callbacks[1]([{x:-1200,z:-1250}]);
    expect(squad.order.type).toBe('hold');expect(squad.route).toHaveLength(0);
  });
  it('reserves linear capacity across separate commands and refuses an over-capacity order',()=>{
    const simulation=new BattlefieldSimulation(createBattlefield());
    simulation.issueOccupyNearest([simulation.state.squads[0].id]);
    simulation.issueOccupyNearest([simulation.state.squads[1].id]);
    const assigned=simulation.state.soldiers.filter(s=>s.trenchId!==undefined);
    expect(assigned.every(s=>s.trenchAlong===undefined&&s.garrisonId!==undefined)).toBe(true);
    expect(assigned.every(s=>s.trenchSlot===undefined)).toBe(true);
    expect(simulation.trenches.used(simulation.state.trenches[0])).toBe(20);
    const all=simulation.state.squads.filter(s=>s.kind==='rifle').map(s=>s.id);
    expect(simulation.issueOccupyNearest(all)).toBeUndefined();
  });

  it('stops excavation when engineers are ordered away',()=>{
    const simulation=new BattlefieldSimulation(createBattlefield());
    const engineer=simulation.state.squads.find(s=>s.kind==='engineer')!;
    const id=simulation.createTrench([{x:engineer.x,z:engineer.z},{x:engineer.x-30,z:engineer.z-30}],engineer.id);
    const trench=simulation.state.trenches.find(t=>t.id===id)!;
    for(let i=0;i<20;i++)simulation.step(.05);
    // The new working point is midway along this line, not at the team's feet.
    expect(trench.progress).toBe(0);
    for(let i=0;i<400&&trench.progress<=.001;i++)simulation.step(.05);
    expect(trench.progress).toBeGreaterThan(.001);
    simulation.issueMove([engineer.id],{x:engineer.x-100,z:engineer.z});
    const before=trench.progress;
    for(let i=0;i<20;i++)simulation.step(.05);
    expect(trench.progress).toBe(before);
  });

  it('places separate squad objectives and avoids settlement footprints along navigation segments',()=>{
    const simulation=new BattlefieldSimulation(createBattlefield());
    simulation.issueMove(simulation.state.squads.slice(0,4).map(s=>s.id),{x:-1200,z:-1350});
    const goals=simulation.state.squads.slice(0,4).map(s=>s.order.target!);
    expect(new Set(goals.map(p=>`${p.x}:${p.z}`)).size).toBe(4);
    const building=simulation.terrain.buildings[5];
    const start={x:building.x-45,z:building.z};
    const route=simulation.navigation.plan(start,{x:building.x+45,z:building.z});
    expect(route.length).toBeGreaterThan(1);
    let previous=start;
    for(const p of route){
      const n=Math.ceil(Math.hypot(p.x-previous.x,p.z-previous.z));
      for(let i=0;i<=n;i++)expect(simulation.terrain.obstacleAt(previous.x+(p.x-previous.x)*i/n,previous.z+(p.z-previous.z)*i/n,.5)).toBe(false);
      previous=p;
    }
  });
  it('reproduces terrain from the same seed', () => {
    const a = new TerrainSystem(createBattlefield(1944));
    const b = new TerrainSystem(createBattlefield(1944));
    const c = new TerrainSystem(createBattlefield(1945));
    expect(a.baseHeightAt(742, -1_119)).toBe(b.baseHeightAt(742, -1_119));
    expect(a.baseHeightAt(742, -1_119)).not.toBe(c.baseHeightAt(742, -1_119));
  });

  it('moves one commanded squad without moving held squads', () => {
    const simulation = new BattlefieldSimulation(createBattlefield());
    const commanded = simulation.state.squads[0];
    const held = simulation.state.squads[1];
    const commandedStart = { x: commanded.x, z: commanded.z };
    const heldStart = { x: held.x, z: held.z };
    simulation.issueMove([commanded.id], { x: commanded.x + 120, z: commanded.z + 30 });
    for (let i = 0; i < 80; i += 1) simulation.step(0.05);
    expect(Math.hypot(commanded.x - commandedStart.x, commanded.z - commandedStart.z)).toBeGreaterThan(10);
    expect(held.x).toBeCloseTo(heldStart.x, 5);
    expect(held.z).toBeCloseTo(heldStart.z, 5);
  });

  it('constructs a trench and assigns a living garrison without permanent positions', () => {
    const simulation = new BattlefieldSimulation(createBattlefield());
    const engineer = simulation.state.squads.find((squad) => squad.kind === 'engineer')!;
    const trenchId = simulation.createTrench(
      [
        { x: engineer.x, z: engineer.z },
        { x: engineer.x + 45, z: engineer.z + 12 },
        { x: engineer.x + 90, z: engineer.z - 8 },
      ],
      engineer.id,
    )!;
    simulation.state.simSpeed = 5;
    for (let i = 0; i < 400; i += 1) simulation.step(0.05);
    const trench = simulation.state.trenches.find((item) => item.id === trenchId)!;
    expect(trench.status).toBe('complete');
    const rifle = simulation.state.squads[0];
    for (const soldier of simulation.state.soldiers.filter((item) => item.squadId === rifle.id)) {
      soldier.x = engineer.x + 12;
      soldier.z = engineer.z + 15;
    }
    simulation.step(0.05);
    expect(simulation.issueOccupyNearest([rifle.id],trenchId)).toBe(trenchId);
    for (let i = 0; i < 300; i += 1) simulation.step(0.05);
    const occupants = simulation.state.soldiers.filter((item) => item.squadId === rifle.id);
    expect(occupants.every(s=>s.trenchAlong===undefined&&s.duty!==undefined)).toBe(true);
    expect(occupants.some((soldier) => soldier.cover === 'trench')).toBe(true);
  });

  it('round-trips versioned terrain modifications and unit state', () => {
    const simulation = new BattlefieldSimulation(createBattlefield());
    simulation.createCrater({ x: 45, z: -90 }, 30, 6);
    const trenchId = simulation.createTrench([{ x: -20, z: 0 }, { x: 80, z: 30 }])!;
    const trench = simulation.state.trenches.find((item) => item.id === trenchId)!;
    trench.progress = 0.42;
    trench.status = 'building';
    const save = new SaveSystem();
    const restored = save.parse(JSON.stringify(simulation.state));
    expect(restored.craters).toEqual(simulation.state.craters);
    expect(restored.trenches).toEqual(simulation.state.trenches);
    expect(restored.soldiers).toEqual(simulation.state.soldiers);
    const corrupt=structuredClone(simulation.state);corrupt.squads[0].soldierIds.push(corrupt.squads[1].soldierIds[0]);
    expect(()=>save.parse(JSON.stringify(corrupt))).toThrow();
  });

  it('maintains finite simulation state with 300 active soldiers', () => {
    const simulation = new BattlefieldSimulation(createBattlefield());
    expect(simulation.spawnStressSoldiers(300)).toBe(300);
    const squadIds = simulation.state.squads.slice(0, 24).map((squad) => squad.id);
    simulation.issueMove(squadIds, { x: 300, z: -300 });
    for (let i = 0; i < 100; i += 1) simulation.step(0.05);
    expect(simulation.state.soldiers).toHaveLength(300);
    expect(simulation.state.soldiers.every((soldier) => Number.isFinite(soldier.x) && Number.isFinite(soldier.z))).toBe(true);
  });
});

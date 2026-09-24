import type { BattlefieldState, SoldierState, SquadKind, SquadState } from '../core/types';
import {WORLD_VERSION,WORLD_SIZE} from '../core/types';
import { TrenchSystem } from '../construction/TrenchSystem';

export function createBattlefield(seed = 1944): BattlefieldState {
  const state: BattlefieldState = {
    worldVersion: WORLD_VERSION, worldSize: WORLD_SIZE,
    schemaVersion: 1,
    seed,
    elapsed: 0,
    simSpeed: 1,
    nextEntityId: 1,
    soldiers: [],
    squads: [],
    trenches: [],
    craters: [],
  };

  for (let i = 0; i < 20; i += 1) {
    const column = i % 4;
    const row = Math.floor(i / 4);
    addSquad(state, 'rifle', 10, -1390 + column * 37, -1500 + row * 35, `Rifle ${String(i + 1).padStart(2, '0')}`);
  }
  for (let i = 0; i < 3; i += 1) {
    addSquad(state, 'engineer', 8, -1435 + i * 48, -1280, `Engineer ${i + 1}`);
  }
  const trenches = new TrenchSystem(state);
  const prepared = trenches.create([{x:-1390,z:-1270},{x:-1365,z:-1236},{x:-1328,z:-1247},{x:-1295,z:-1218},{x:-1260,z:-1232}]);
  prepared.progress = 1;
  prepared.status = 'complete';
  state.craters.push({id:state.nextEntityId++,x:-1305,z:-1180,radius:9,depth:2.7},{id:state.nextEntityId++,x:-1245,z:-1188,radius:6,depth:2});
  return state;
}

export function addSquad(
  state: BattlefieldState,
  kind: SquadKind,
  size: number,
  x: number,
  z: number,
  name: string,
): SquadState {
  const squadId = state.nextEntityId++;
  const squad: SquadState = {
    id: squadId,
    name,
    kind,
    x,
    z,
    soldierIds: [],
    order: { type: 'hold', issuedAt: state.elapsed },
    route: [],
    routeIndex: 0,
    movementState: 'idle',
  };
  for (let i = 0; i < size; i += 1) {
    const soldier: SoldierState = {
      id: state.nextEntityId++,
      squadId,
      x: x + (i % 5) * 3.2 - 6.4,
      z: z + Math.floor(i / 5) * 4.2 - 2.1,
      heading: 0,
      health: 100,
      suppression: 0,
      morale: 100,
      ammunition: kind === 'engineer' ? 60 : 120,
      fatigue: 0,
      action: 'holding',
      cover: 'open',
    };
    state.soldiers.push(soldier);
    squad.soldierIds.push(soldier.id);
  }
  state.squads.push(squad);
  return squad;
}

/** Manageable first sandbox: everyone can join the starting garrison. Large forces remain a stress option. */
export function createPlayableSandbox(seed=1944):BattlefieldState {
  const state=createBattlefield(seed);
  const retained=new Set([state.squads[0].id,state.squads[1].id,state.squads.find(s=>s.kind==='engineer')!.id]);
  state.squads=state.squads.filter(s=>retained.has(s.id));
  state.soldiers=state.soldiers.filter(s=>retained.has(s.squadId));
  return state;
}

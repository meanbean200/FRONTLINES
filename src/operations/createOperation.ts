import { addSquad, createBattlefield } from '../simulation/createBattlefield';
import { initializeLiving } from '../garrison/LogisticsSystem';
import { inventory, RESOURCES } from '../garrison/types';
import { TerrainSystem } from '../terrain/TerrainSystem';
import { SquadNavigation } from '../navigation/SquadNavigation';
import type { BattlefieldState, Vec2 } from '../core/types';
import type { Faction, OperationMode } from './types';
import {createCampaign} from './createCampaign';
import {isOperationId} from './OperationDefinitions';
import {createOperationalBattle} from './createOperationalBattle';

/** Fresh matches are separate from saved campaigns. No localStorage writes here. */
export function createOperation(mode: OperationMode, seed = 1944): BattlefieldState {
  if(isOperationId(mode))return createOperationalBattle(mode,seed);
  if(mode==='campaign')return createCampaign(seed);
  const state = createBattlefield(seed);
  state.soldiers = []; state.squads = [];
  const terrain = new TerrainSystem(state), navigation = new SquadNavigation(terrain);
  // Preserve short-operation distances, but put defense on a northern approach
  // to Beaumont. This is a scenario placement, not a mission-rule redesign.
  const place=(p:Vec2):Vec2=>mode==='defense'?{x:1080+(p.z+1332),z:1000-(p.x+1070)}:p;
  const add = (faction: Faction, at: Vec2, index: number, engineer = false) => {
    const p = navigation.freeDestination(place(at));
    const squad = addSquad(state, engineer ? 'engineer' : 'rifle', 8, p.x, p.z,
      faction === 'enemy' ? `Opposing ${index + 1}` : engineer ? 'Pioneer team' : ['Able', 'Baker', 'Charlie', 'Dog', 'Easy'][index]);
    squad.faction = faction;
    for (const soldier of state.soldiers.filter(s => s.squadId === squad.id)) {
      const clear = navigation.freeDestination(soldier); soldier.x = clear.x; soldier.z = clear.z;
    }
  };
  for (let i = 0; i < 6; i++) add('player', mode === 'advance'
    ? { x: -1375 + i % 3 * 30, z: -1450 + Math.floor(i / 3) * 32 }
    : { x: -1120 + i % 3 * 42, z: -1330 + Math.floor(i / 3) * 36 }, i, i === 5);
  const enemies = mode === 'advance' ? 3 : 6;
  for (let i = 0; i < enemies; i++) add('enemy', mode === 'advance'
    ? [{ x: -1170, z: -1385 }, { x: -1060, z: -1295 }, { x: -970, z: -1280 }][i]
    : { x: -820 + i % 3 * 30, z: -1470 + Math.floor(i / 3) * 270 }, i);
  initializeLiving(state);
  const world = state.living!;
  // Account for the entire starting ammunition manifest in the same ledger as supplies.
  for (const soldier of state.soldiers) {
    soldier.carried!.ammo = 60; soldier.ammunition = 60; world.ledger.initial.ammo += 60;
    soldier.carried!.medical=1;soldier.carried!.smokeGrenades=1;world.ledger.initial.medical++;world.ledger.initial.smokeGrenades++;
    soldier.nextShotAt = 4 + soldier.id % 9 * .35;
  }
  const sites = [
    { id: 'farm', name: 'WEST FARM', x: -1210, z: -1400 },
    { id: 'village', name: mode==='defense'?'BEAUMONT':'LE VERGER', x: -1070, z: -1332 },
    { id: 'orchard', name: 'EAST ORCHARD', x: -970, z: -1240 },
  ];
  const objectives = sites.map(site => {
    const p = navigation.freeDestination(place(site)), cacheId = state.nextEntityId++;
    const stock = inventory({ food: 32, water: 48, ammo: 240 });
    world.crates.push({ id: cacheId, ...p, stock });
    for (const key of RESOURCES) world.ledger.initial[key] += stock[key];
    return { ...site, ...p, radius: 43, cacheId, owner: mode === 'advance' ? 'neutral' as const : 'player' as const,
      control: mode === 'advance' ? 0 : 1, contested: false };
  });
  state.operation = { version: 1, mode, status: 'active', elapsed: 0, duration: mode === 'advance' ? 600 : 900,
    casualtyRules:true,supportRules:true,
    score: 0, targetScore: 180, nextCombat: 0, nextOrders: mode === 'advance' ? 3 : 90,
    objectives, initialPlayer: 48, initialEnemy: enemies * 8, shots: 0, hits: 0, reason: '' };
  return state;
}

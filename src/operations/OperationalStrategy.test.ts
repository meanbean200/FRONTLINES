import {describe,it,expect} from 'vitest';
import {createOperationalBattle} from './createOperationalBattle';
import {observeEnemy} from './EnemyCommander';
import {commandOperationalEnemy} from './OperationalCommander';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {SaveSystem} from '../persistence/SaveSystem';

describe('army-level observed planning',()=>{
  it('probes, assesses, prepares, assaults, remembers failure and retains a movable reserve',()=>{
    const state=createOperationalBattle('open-front'),terrain=new TerrainSystem(state),o=observeEnemy(state);let r=commandOperationalEnemy(o,terrain);
    expect(r.commander.planPhase).toBe('establishing-front');o.at=31;r=commandOperationalEnemy(o,terrain,r.memory,r.commander);expect(r.commander.planPhase).toBe('probing');
    const target=o.operational!.staging![0].point;o.contacts=[{soldierId:state.soldiers[0].id,squadId:state.squads[0].id,...target,lastSeen:o.at,visible:false,active:true,status:'last-reported'}];
    o.at+=3;r=commandOperationalEnemy(o,terrain,r.memory,r.commander);expect(r.commander.planPhase).toBe('assessing');o.at+=13;r=commandOperationalEnemy(o,terrain,r.memory,r.commander);expect(r.commander.planPhase).toBe('preparing-attack');
    o.at+=31;r=commandOperationalEnemy(o,terrain,r.memory,r.commander);expect(r.commander.planPhase).toBe('assaulting');expect(r.commander.reserveIds!.length).toBeGreaterThan(0);expect(r.commander.attack).toBeDefined();
    o.at+=46;o.contacts[0].lastSeen=o.at;for(const q of o.squads)q.able=Math.max(0,Math.floor(q.able*.6));
    r=commandOperationalEnemy(o,terrain,r.memory,r.commander);expect(r.commander.planPhase).toBe('assessing');expect(r.commander.failedApproaches).toHaveLength(1);expect(r.commander.failedApproaches![0].cooldownUntil).toBeGreaterThan(o.at);
    state.elapsed=state.operation!.elapsed=o.at;state.operation!.runtime!.commander=r.commander;expect(new SaveSystem().parse(JSON.stringify(state)).operation!.runtime!.commander).toEqual(r.commander);
  });
  it('reduces ambition when its own physical ammunition or route state is poor',()=>{
    const state=createOperationalBattle('open-front'),terrain=new TerrainSystem(state),o=observeEnemy(state);o.at=90;o.operational!.logistics={blocked:1,loads:1,ammo:0,materials:20};for(const q of o.squads)q.ammo=4;
    const r=commandOperationalEnemy(o,terrain);expect(r.commander.planPhase).toBe('resupplying');expect(r.commander.reason).toContain('ammunition');
  });
});

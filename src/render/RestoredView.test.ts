import {describe,expect,it} from 'vitest';
import {restoredViewTarget} from './RestoredView';
import {createBattlefield} from '../simulation/createBattlefield';
import {createOperation} from '../operations/createOperation';
import {factionOf} from '../operations/types';

describe('restored campaign camera target',()=>{
  it('focuses an able friendly rather than enemies, fallen troops or a stale squad centre',()=>{
    const state=createOperation('defense'),enemy=state.squads.find(q=>factionOf(q)==='enemy')!;
    const friendly=state.soldiers.filter(s=>s.squadId===state.squads[0].id);friendly[0].health=0;friendly[1].needs!.life='incapacitated';
    const target=friendly[2];target.x=2500;target.z=-2700;
    state.soldiers.sort((a,b)=>Number(b.squadId===enemy.id)-Number(a.squadId===enemy.id));
    const before=structuredClone(state);expect(restoredViewTarget(state)).toEqual({x:2500,z:-2700});expect(state).toEqual(before);
  });
  it('supports old saves without individual needs or faction fields',()=>{
    const state=createBattlefield(),s=state.soldiers[0];expect(s.needs).toBeUndefined();
    expect(restoredViewTarget(state)).toEqual({x:s.x,z:s.z});
  });
  it('keeps incapacitated survivors inspectable, then uses a friendly last-known position',()=>{
    const state=createOperation('defense'),player=state.squads.filter(q=>factionOf(q)==='player').map(q=>q.id);
    const survivors=state.soldiers.filter(s=>player.includes(s.squadId));for(const s of survivors)s.needs!.life='incapacitated';
    expect(restoredViewTarget(state)).toEqual({x:survivors[0].x,z:survivors[0].z});
    for(const s of survivors){s.health=0;s.needs!.life='dead';}
    expect(restoredViewTarget(state)).toEqual({x:state.squads[0].x,z:state.squads[0].z});
  });
  it('handles an empty world without inventing a unit or changing state',()=>{
    const state=createBattlefield();state.soldiers=[];state.squads=[];state.trenches=[];
    expect(restoredViewTarget(state)).toBeUndefined();
  });
});

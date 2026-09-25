import {describe,it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {contactGroups,contactDescription} from './ContactReadout';

function fixture(){
  const state=createOperation('advance');state.elapsed=10;
  state.operation!.contacts={enemy:[],player:[
    {soldierId:1,squadId:100,x:0,z:0,lastSeen:10,visible:true,active:true},
    {soldierId:2,squadId:200,x:20,z:10,lastSeen:10,visible:true,active:true},
    {soldierId:3,squadId:100,x:100,z:0,lastSeen:10,visible:true,active:true},
  ]};
  return state;
}
describe('quiet grouped enemy contacts',()=>{
  it('groups nearby known sightings, not hidden squad identities',()=>{
    const state=fixture(),before=JSON.stringify(state),groups=contactGroups(state);
    expect(groups).toHaveLength(2);expect(groups[0]).toMatchObject({id:1,x:0,z:0,members:[1,2]});
    expect(JSON.stringify(state)).toBe(before);
    state.soldiers.forEach(s=>{s.x=1700;s.z=-1800;s.health=0;});state.squads=[];
    expect(contactGroups(state)).toEqual(groups);
  });
  it('keeps the same anchor when some members drop out of live sight',()=>{
    const state=fixture();state.operation!.contacts!.player[0].visible=false;
    expect(contactGroups(state)[0]).toMatchObject({id:1,x:0,z:0,visible:true,members:[1,2]});
    state.operation!.contacts!.player[1].visible=false;
    expect(contactGroups(state)[0]).toMatchObject({id:1,x:0,z:0,visible:false});
  });
  it('is deterministic regardless of report ordering and expires old contacts',()=>{
    const state=fixture(),first=contactGroups(state);state.operation!.contacts!.player.reverse();
    expect(contactGroups(state)).toEqual(first);state.elapsed=28.01;
    expect(contactGroups(state)).toEqual([]);
  });
  it('removes confirmed casualties, but does not consult unobserved health changes',()=>{
    const state=fixture();state.operation!.contacts!.player[0].active=false;
    expect(contactGroups(state).flatMap(g=>g.members)).toEqual([2,3]);
  });
  it('keeps counts, squad identities, and ticking ages out of persistent labels',()=>{
    expect(contactDescription(true)).toBe('Enemy contact area\nTroops observed here · nearby sightings grouped');
    expect(contactDescription(false)).toContain('not live tracking');
    expect(contactDescription(true)+contactDescription(false)).not.toMatch(/SPOTTED|\d/);
  });
});

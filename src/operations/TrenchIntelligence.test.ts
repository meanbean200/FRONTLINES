import {describe,it,expect,vi} from 'vitest';
import {createOperationalBattle} from './createOperationalBattle';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {knownTrenchNetworks,observeTrenches,validTerrainKnowledge} from './TrenchIntelligence';
import {SaveSystem} from '../persistence/SaveSystem';
vi.mock('./TerrainSight',()=>({seesTrenchSection:(_s:unknown,_t:unknown,_o:unknown,_a:unknown,b:{x:number;z:number})=>b.x<30}));
describe('observed terrain memory, not enemy state',()=>{
  it('retains only seen geometry through hidden expansion, movement, and save',()=>{
    const state=createOperationalBattle('meeting'),terrain=new TerrainSystem(state),enemy=state.squads.find(q=>q.faction==='enemy')!,friendly=state.squads.find(q=>q.faction==='player')!;
    state.trenches=[{id:state.nextEntityId++,points:[{x:0,z:0},{x:80,z:0}],width:4.2,depth:1.75,progress:1,status:'complete',engineerSquadId:enemy.id}];
    const soldier=state.soldiers.find(s=>s.squadId===friendly.id)!;soldier.x=0;soldier.z=-10;for(let i=0;i<5;i++){state.elapsed=i*.2;observeTrenches(state,terrain);}
    const memory=structuredClone(knownTrenchNetworks(state));expect(memory).toHaveLength(1);expect(memory[0].length).toBe(28);expect(memory[0].sections.every(s=>s.points.every(p=>p.x<=28))).toBe(true);
    soldier.x=-1800;state.trenches[0].points.push({x:80,z:80});state.elapsed=2;observeTrenches(state,terrain);expect(knownTrenchNetworks(state)).toEqual(memory);
    expect(knownTrenchNetworks(new SaveSystem().parse(JSON.stringify(state)))).toEqual(memory);
    expect(JSON.stringify(memory)).not.toMatch(/soldierIds|weaponCrewIds|stock|carried/);expect(validTerrainKnowledge(state)).toBe(true);
  });
  it('disjoint glimpses of one segment do not create duplicate target identities or invented connecting geometry',()=>{
    const state=createOperationalBattle('meeting');state.terrainKnowledge={nextReview:1,sections:[{id:state.nextEntityId++,sourceId:9999,cell:0,points:[{x:0,z:0},{x:4,z:0}],width:4,at:0,side:'player'},{id:state.nextEntityId++,sourceId:9999,cell:10,points:[{x:40,z:0},{x:44,z:0}],width:4,at:0,side:'player'}]};
    const rows=knownTrenchNetworks(state);expect(rows).toHaveLength(1);expect(rows[0].length).toBe(8);expect(rows[0].sections).toHaveLength(2);
  });
});

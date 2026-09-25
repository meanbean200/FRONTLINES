import {describe,it,expect} from 'vitest';
import {createOperationalBattle} from './createOperationalBattle';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {seesTrenchSection} from './TerrainSight';
import {observeTrenches,knownTrenchNetworks} from './TrenchIntelligence';

describe('physical earthwork discovery',()=>{
  it('discovers real exposed banks from a nearby scout without requiring visible occupants',()=>{
    const state=createOperationalBattle('meeting'),terrain=new TerrainSystem(state),p=state.soldiers[0];
    state.living!.campaignHours=12;state.trenches=[{id:state.nextEntityId++,points:[{x:-1850,z:-1700},{x:-1810,z:-1700}],width:4.2,depth:1.75,progress:1,status:'complete',engineerSquadId:state.squads.find(q=>q.faction==='enemy')!.id}];terrain.syncModifications();
    Object.assign(p,{x:-1830,z:-1725,heading:0,action:'watching',suppression:0});p.needs!.energy=100;
    expect(seesTrenchSection(state,terrain,p,{x:-1832,z:-1700},{x:-1828,z:-1700},4.2)).toBe(true);
    observeTrenches(state,terrain);expect(knownTrenchNetworks(state).length).toBeGreaterThan(0);
    p.action='sleeping';expect(seesTrenchSection(state,terrain,p,{x:-1832,z:-1700},{x:-1828,z:-1700},4.2)).toBe(false);
  });
  it('does not reveal a bank through masonry, smoke or distant darkness',()=>{
    const state=createOperationalBattle('meeting'),terrain=new TerrainSystem(state),p=state.soldiers[0],b=terrain.buildings[20];
    state.living!.campaignHours=12;Object.assign(p,{x:b.x,z:b.z-30,heading:0,action:'watching',suppression:0});p.needs!.energy=100;
    expect(seesTrenchSection(state,terrain,p,{x:b.x-2,z:b.z+30},{x:b.x+2,z:b.z+30},4.2)).toBe(false);
    Object.assign(p,{x:-1830,z:-1725});state.operation!.smokeFields=[{id:999,x:-1830,z:-1714,radius:14,born:0,until:100}];state.elapsed=5;
    expect(seesTrenchSection(state,terrain,p,{x:-1832,z:-1700},{x:-1828,z:-1700},4.2)).toBe(false);
    state.operation!.smokeFields=[];state.living!.campaignHours=0;p.z=-1850;
    expect(seesTrenchSection(state,terrain,p,{x:-1832,z:-1700},{x:-1828,z:-1700},4.2)).toBe(false);
  });
});

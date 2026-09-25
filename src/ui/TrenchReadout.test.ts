import {describe,it,expect} from 'vitest';
import {createBattlefield} from '../simulation/createBattlefield';
import {TrenchNetwork} from '../garrison/TrenchNetwork';
import {friendlyTrenches,trenchName,trenchPeople,trenchWorkforce} from './TrenchReadout';
import {createOperation} from '../operations/createOperation';

describe('trench inspection identity',()=>{
  it('hides unexcavated enemy support connectors even before they form a network',()=>{
    const state=createOperation('campaign'),g=state.living!.garrisons.find(g=>g.faction==='enemy')!,t={id:state.nextEntityId++,points:[{x:g.entrance.x,z:g.entrance.z},{x:g.entrance.x,z:g.entrance.z+12}],width:4.2,depth:1.75,progress:0,status:'planned' as const};
    state.trenches.push(t);state.living!.facilities.push({id:state.nextEntityId++,garrisonId:g.id,connectorId:t.id,kind:'mortar',x:t.points[1].x,z:t.points[1].z,capacity:2,materialCost:12,progress:0,paid:false,stock:{...state.living!.ledger.lost}});
    const network=new TrenchNetwork();network.sync(state.trenches);expect(network.component(t.id)).toBeUndefined();expect(friendlyTrenches(state,network)).not.toContain(t);
  });
  it('keeps distinct names across saved copies, hides enemy works, and never counts undug floor',()=>{
    const state=createBattlefield(),q=state.squads[0];q.faction='player';const enemy=state.squads[1];enemy.faction='enemy';
    const a={id:state.nextEntityId++,points:[{x:-1800,z:-1700},{x:-1700,z:-1700}],width:4.2,depth:1.75,progress:.5,status:'building' as const};
    state.trenches=[a,{...a,id:state.nextEntityId++,engineerSquadId:enemy.id}];const network=new TrenchNetwork();network.sync(state.trenches);
    expect(trenchName(state,a.id)).toBe('Trench 01');expect(trenchName(structuredClone(state),state.trenches[1].id)).toBe('Trench 02');expect(friendlyTrenches(state,network)).toEqual([a]);
    const s=state.soldiers.find(s=>s.squadId===q.id)!;s.x=-1710;s.z=-1700;expect(trenchPeople(state,network,a)).not.toContain(s);
    s.x=-1780;expect(trenchPeople(state,network,a)).toContain(s);
    const [digger,helper,otherFront]=state.soldiers.filter(s=>s.squadId===q.id);digger.action='digging';helper.action='clearing spoil';otherFront.action='digging';
    q.order={type:'construct-trench',trenchId:a.id,issuedAt:0};
    q.engineerWork={version:1,nextReview:0,crews:[{soldierIds:[digger.id,helper.id],trenchId:a.id,direction:1,route:[],routeIndex:0,approached:true},{soldierIds:[otherFront.id],trenchId:999,direction:1,route:[],routeIndex:0,approached:true}]};
    expect(trenchWorkforce(state,a)).toEqual({digging:1,helpers:1});expect(trenchWorkforce(state,{...a,status:'complete',progress:1})).toEqual({digging:0,helpers:0});
  });
});

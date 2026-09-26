import {describe,it,expect} from 'vitest';
import {createOperationalBattle} from './createOperationalBattle';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {SaveSystem} from '../persistence/SaveSystem';
import {preparedStatus,validPreparedOrders} from './PreparedOrders';
import {raidEligibility} from './RaidEligibility';
import {preparedPosition} from '../combat/testing/PositionFixture';
describe('persistent signal orders',()=>{
  it('keeps mixed formations with assigned gun crews home unless explicitly released',()=>{
    const state=createOperationalBattle('meeting'),sim=new BattlefieldSimulation(state),[gunSquad,rifles]=state.squads.filter(q=>q.faction==='player');
    state.soldiers.find(s=>s.squadId===gunSquad.id)!.equipment!.mortar=true;
    const f=preparedPosition(state,gunSquad.id,'mortar'),crew=f.weaponCrewIds!.slice(),ids=[gunSquad.id,rifles.id];
    expect(raidEligibility(state,ids)).toMatchObject({eligible:[rifles.id],protectedIds:[gunSquad.id]});
    expect(sim.prepareOrder(ids,'assault',{x:rifles.x+20,z:rifles.z})).toBe(1);expect(f.weaponCrewIds).toEqual(crew);
    expect(new SaveSystem().parse(JSON.stringify(state)).living!.facilities.find(p=>p.id===f.id)!.weaponCrewIds).toEqual(crew);
    expect(sim.prepareOrder([gunSquad.id],'assault',{x:rifles.x+20,z:rifles.z},undefined,true)).toBe(1);
    sim.signalPrepared();sim.step(.05);expect(f.weaponCrewIds).toEqual([]);
  });
  it('cancels the actual released movement as well as its saved planning marker',()=>{
    const state=createOperationalBattle('meeting'),sim=new BattlefieldSimulation(state),q=state.squads[0];
    sim.prepareOrder([q.id],'assault',{x:q.x+45,z:q.z+20});sim.signalPrepared();sim.step(.05);
    expect(q.order.intent).toBe('assault');sim.cancelPrepared();
    expect(state.preparedOrders).toEqual([]);expect(q.order.type).toBe('hold');expect(q.route).toEqual([]);
    const loaded=new SaveSystem().parse(JSON.stringify(state));expect(loaded.preparedOrders).toEqual([]);expect(loaded.squads[0].order.type).toBe('hold');
  });
  it('waits, saves, and releases assault and support on the same fixed tick',()=>{
    const state=createOperationalBattle('meeting'),sim=new BattlefieldSimulation(state),squads=state.squads.filter(q=>q.faction==='player').slice(0,3),ids=squads.map(q=>q.id),target={x:squads[0].x+35,z:squads[0].z+10};
    expect(sim.prepareOrder(ids.slice(0,2),'assault',target,251)).toBe(2);expect(sim.prepareOrder(ids.slice(2),'suppress',target,251)).toBe(1);
    const orders=squads.map(q=>structuredClone(q.order));sim.step(.05);expect(squads.map(q=>q.order)).toEqual(orders);expect(state.preparedOrders!.every(o=>preparedStatus(state,o)==='WAIT FOR SIGNAL')).toBe(true);
    const loaded=new SaveSystem().parse(JSON.stringify(state)),copy=new BattlefieldSimulation(loaded);expect(loaded).toEqual(state);
    expect(sim.signalPrepared()).toBe(3);expect(copy.signalPrepared()).toBe(3);
    expect(state.preparedOrders!.every(o=>o.releasedAt===undefined)).toBe(true); // signaling while paused does not execute a tick
    sim.step(.05);copy.step(.05);expect(loaded).toEqual(state);
    expect(new Set(state.preparedOrders!.map(o=>o.releasedAt)).size).toBe(1);expect(state.preparedOrders![0].releasedAt).toBeCloseTo(.1);
    expect(squads.map(q=>q.order.intent)).toEqual(['assault','assault','suppress']);expect(new SaveSystem().parse(JSON.stringify(state))).toEqual(state);
  });
  it('cancels a prepared intention on an explicit order, and reports pinned formations truthfully',()=>{
    const state=createOperationalBattle('meeting'),sim=new BattlefieldSimulation(state),q=state.squads[0];
    sim.prepareOrder([q.id],'assault',q);for(const s of state.soldiers.filter(s=>s.squadId===q.id)){s.combat??={shotSequence:0};s.combat.reaction='pinned';}
    expect(preparedStatus(state,state.preparedOrders![0])).toContain('PINNED');sim.issueHold([q.id]);expect(state.preparedOrders).toEqual([]);expect(q.orderNote).toBeUndefined();
    sim.prepareOrder([q.id],'assault',q);sim.cancelPrepared();expect(state.preparedOrders).toEqual([]);expect(q.order.type).toBe('hold');
  });
  it('rejects malformed or temporally impossible saved signals',()=>{
    const state=createOperationalBattle('meeting'),sim=new BattlefieldSimulation(state),q=state.squads[0];sim.prepareOrder([q.id],'observe',q);expect(validPreparedOrders(state)).toBe(true);
    state.preparedOrders![0].releasedAt=0;expect(validPreparedOrders(state)).toBe(false);delete state.preparedOrders![0].releasedAt;state.preparedOrders![0].target.x=Infinity;expect(validPreparedOrders(state)).toBe(false);
  });
  it('does not restart queued excavation while a tool formation waits for its signal',()=>{
    const state=createOperationalBattle('meeting'),sim=new BattlefieldSimulation(state),q=state.squads.find(q=>q.faction==='player'&&state.soldiers.some(s=>s.squadId===q.id&&s.equipment?.tools))!;
    const id=state.nextEntityId++;state.trenches.push({id,points:[{x:q.x,z:q.z+20},{x:q.x+25,z:q.z+20}],width:4.2,depth:1.75,progress:0,status:'planned',engineerSquadId:q.id});q.constructionQueue=[id];
    sim.prepareOrder([q.id],'assault',{x:q.x+40,z:q.z});sim.step(.05);
    expect(q.order.type).toBe('hold');expect(q.constructionQueue).toEqual([]);expect(state.trenches.find(t=>t.id===id)!.progress).toBe(0);expect(state.preparedOrders![0].releasedAt).toBeUndefined();
  });
});

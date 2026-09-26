import {describe,it,expect} from 'vitest';
import {createOperationalBattle} from './createOperationalBattle';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {previewAssault} from './AssaultPlan';
import {preparedPosition} from '../combat/testing/PositionFixture';
import {manpowerPools} from '../garrison/Manpower';
import {SaveSystem} from '../persistence/SaveSystem';
import {inventory} from '../garrison/types';
import {readyDefender} from '../garrison/PersonnelRoles';

function fixture(){
  const state=createOperationalBattle('meeting'),sim=new BattlefieldSimulation(state),q=state.squads.find(q=>q.faction==='player')!;
  const people=state.soldiers.filter(s=>s.squadId===q.id);people[0].equipment!.mortar=true;
  const gun=preparedPosition(state,q.id,'mortar');
  q.order={type:'occupy-trench',trenchId:gun.connectorId,issuedAt:0};
  for(const s of people){s.needs!.energy=90;s.needs!.hunger=s.needs!.thirst=10;s.suppression=0;s.combat={shotSequence:0};s.action='idle';if(!gun.weaponCrewIds!.includes(s.id))delete s.duty;}
  const work={...structuredClone(gun),id:state.nextEntityId++,kind:'store' as const,installation:undefined,weaponCrewIds:undefined,progress:.3,stock:inventory(),workOrder:{explicit:true,workerIds:[people[2].id,people[3].id],createdAt:0,autoWorkers:true}};
  state.living!.facilities.push(work);
  people[4].duty={kind:'rest',destination:{x:people[4].x,z:people[4].z},route:[],routeIndex:0,arrivedAt:0,since:0,until:100,blockedFor:0,reason:'Ready reserve'};
  people[5].duty={...structuredClone(people[4].duty),kind:'sleep',reason:'Scheduled sleep'};people[5].action='sleeping';
  return {state,sim,q,people,gun,work,target:{x:q.x+45,z:q.z+20}};
}

describe('worker assault eligibility',()=>{
  it('counts a fit waiting reserve as AVAILABLE and permits NORMAL participation',()=>{
    const {state,q,people}=fixture(),before=JSON.stringify(state);
    expect(manpowerPools(state,people).available).toContain(people[4].id);
    expect(previewAssault(state,[q.id],'normal').participantIds).toEqual([people[4].id,people[6].id,people[7].id]);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('opts workers in individually without releasing crew or waking actual sleepers',()=>{
    const {state,q,people,work}=fixture(),before=JSON.stringify(state);
    const p=previewAssault(state,[q.id],'normal',undefined,{includeWorkers:true});
    expect(p.participantIds).toEqual([people[4].id,people[6].id,people[7].id,people[2].id,people[3].id]);
    expect(p.excluded.map(e=>e.id)).toEqual([people[0].id,people[1].id,people[5].id]);
    expect(p.workIds).toEqual([work.id]);expect(p.weaponIds).toEqual([]);expect(p.awakenedIds).toEqual([]);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('limits a work-party preview to its selected person IDs across save and GO',()=>{
    const {state,sim,q,people,work,gun,target}=fixture(),before=JSON.stringify(state),ids=[people[2].id];
    expect(sim.prepareOrder([q.id],'assault',target,undefined,false,undefined,{includeWorkers:true,personIds:ids})).toBe(1);
    const a=state.preparedOrders![0].assault!;expect(a.participantIds).toEqual(ids);
    expect(JSON.stringify({...state,preparedOrders:undefined})).toBe(JSON.stringify({...JSON.parse(before),preparedOrders:undefined}));
    const copy=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));
    expect(copy.state.preparedOrders).toEqual(state.preparedOrders);
    sim.signalPrepared();copy.signalPrepared();sim.step(.05);copy.step(.05);
    expect(JSON.stringify(copy.state)).toBe(JSON.stringify(state));
    expect(work.workOrder.workerIds).toEqual([people[3].id]);expect(gun.weaponCrewIds).toEqual(people.slice(0,2).map(s=>s.id));
    expect(people.map(s=>s.squadId)).toEqual(people.map(()=>q.id));expect(a.participantIds).toEqual(ids);
  });
  it('keeps the selected work party fixed when roles change and requires reconfirmation',()=>{
    const {state,sim,q,people,work,target}=fixture(),ids=[people[2].id,people[3].id];
    sim.prepareOrder([q.id],'assault',target,undefined,false,undefined,{includeWorkers:true,personIds:ids});
    people[2].combat!.reaction='pinned';work.workOrder.workerIds.push(people[6].id);
    expect(sim.signalPrepared()).toBe(0);
    const a=state.preparedOrders![0].assault!;expect(a.reviewRequired).toBe(true);expect(a.participantIds).toEqual([people[3].id]);
    expect(a.preview.excluded).toContainEqual({id:people[2].id,reason:'Physically pinned or broken'});
    expect(sim.signalPrepared()).toBe(1);sim.step(.05);
    expect(a.phase).toBe('committed');expect(work.workOrder.workerIds).toEqual([people[2].id,people[6].id]);
    expect(a.participantIds).not.toContain(people[6].id);
  });
  it('preserves the fixed scope through ALL IN, without collecting the rest of either squad',()=>{
    const {state,sim,q,people,target}=fixture(),options={includeWorkers:true,personIds:[people[2].id]};
    sim.prepareOrder([q.id],'assault',target,undefined,false,undefined,options);
    sim.prepareOrder([q.id],'assault',target,undefined,true,undefined,options);
    expect(state.preparedOrders![0].assault!.participantIds).toEqual(options.personIds);
    options.personIds.push(people[0].id); // UI-owned arrays cannot mutate saved preparation.
    expect(state.preparedOrders![0].assault!.options!.personIds).toEqual([people[2].id]);
  });
  it('does not confuse assigned people or unarmed reserve with actual defensive readiness',()=>{
    const {state,q,people}=fixture(),p=people[4];
    p.equipment!.weapon='m1';p.carried!.ammo=60;expect(readyDefender(state,p)).toBe(true);
    const before=previewAssault(state,[q.id],'normal',undefined,{personIds:[people[2].id],includeWorkers:true});
    p.equipment!.weapon='unarmed';expect(readyDefender(state,p)).toBe(false);
    const after=previewAssault(state,[q.id],'normal',undefined,{personIds:[people[2].id],includeWorkers:true});
    expect(after.remainingAssigned).toBe(before.remainingAssigned);expect(after.remainingReadyPersonnel).toBe(before.remainingReadyPersonnel!-1);
    p.equipment!.weapon='m1';delete p.duty!.arrivedAt;expect(readyDefender(state,p)).toBe(false);
  });
  it('rejects malformed scope/options and preserves older unscoped v4 preparations',()=>{
    const {state,sim,q,people,target}=fixture();sim.prepareOrder([q.id],'assault',target,undefined,false,undefined,{includeWorkers:true,personIds:[people[2].id]});
    for(const corrupt of [(a:any)=>a.options.includeWorkers='yes',(a:any)=>a.options.personIds.push(a.options.personIds[0]),(a:any)=>a.options.personIds=[people[3].id],(a:any)=>a.options.personIds=[state.soldiers.find(s=>s.squadId!==q.id)!.id]]){
      const bad=structuredClone(state);corrupt(bad.preparedOrders![0].assault);expect(()=>new SaveSystem().parse(JSON.stringify(bad))).toThrow();
    }
    const legacy=structuredClone(state),a=legacy.preparedOrders![0].assault!;delete a.options;delete a.preview.trenchWorkIds;delete a.preview.remainingAssigned;delete a.preview.remainingReadyPersonnel;
    expect(()=>new SaveSystem().parse(JSON.stringify(legacy))).not.toThrow();
  });
  it('keeps every real worker safety exclusion when Include workers is enabled',()=>{
    const {state,q,people}=fixture();people[2].needs!.energy=15;people[3].action='eating';
    const p=previewAssault(state,[q.id],'normal',undefined,{includeWorkers:true});
    expect(p.excluded).toContainEqual({id:people[2].id,reason:'Critical self-care'});
    expect(p.excluded).toContainEqual({id:people[3].id,reason:'Protected recovery'});
    expect(p.participantIds).toEqual([people[4].id,people[6].id,people[7].id]);
  });
  it('does not present cancelled work as an assault interruption',()=>{
    const {state,q,people,work}=fixture();Object.assign(work.workOrder,{cancelledAt:0});
    const p=previewAssault(state,[q.id],'normal',undefined,{personIds:[people[2].id]});
    expect(p.participantIds).toEqual([people[2].id]);expect(p.workIds).toEqual([]);
    expect(manpowerPools(state,people).available).toContain(people[2].id);
  });
  it('distinguishes excavation workers from personally assigned members of that squad',()=>{
    const {state,q,people,gun}=fixture(),trench=state.trenches.find(t=>t.id===gun.connectorId)!;
    trench.status='building';trench.progress=.5;q.order={type:'construct-trench',trenchId:trench.id,issuedAt:0};
    const s=people[4];s.personalArea=true;
    const options={personIds:[s.id],includeWorkers:true};
    expect(manpowerPools(state,people).available).toContain(s.id);
    expect(previewAssault(state,[q.id],'normal',undefined,options).trenchWorkIds).toEqual([]);
    delete s.personalArea;
    expect(manpowerPools(state,people).workers).toContain(s.id);
    expect(previewAssault(state,[q.id],'normal',undefined,options).trenchWorkIds).toEqual([trench.id]);
  });
});

import {describe,it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {updateNeeds} from './NeedsSystem';
import {stepSelfPreservation} from '../simulation/SelfPreservation';
import {prepareActions} from '../combat/Reactions';
import {needsRecovery} from './PersonnelRoles';
import {SaveSystem} from '../persistence/SaveSystem';
import {inventory} from './types';
import {balance} from './Inventory';
import {createStudyScenario} from './StudyScenario';

describe('nonlethal sustenance and bounded field recovery',()=>{
  it.each([false,true])('never damages health from hunger/thirst with legacy lethal flag %s',lethal=>{
    const state=createOperation('campaign'),p=state.soldiers[0];state.living!.lethalNeeds=lethal;
    p.needs!.hunger=p.needs!.thirst=100;p.needs!.hungryHours=p.needs!.thirstyHours=100;
    p.combat={shotSequence:0,wound:{severity:'legacy',at:0,stabilized:true,care:'stabilized'}};p.health=60;
    const before=balance(state);for(let i=0;i<100;i++){p.needs!.energy=90;updateNeeds(state,p,75);}
    expect(p.health).toBe(60);expect(p.needs!.life).toBe('active');expect(p.death).toBeUndefined();expect(balance(state)).toEqual(before);
    const copy=new SaveSystem().parse(JSON.stringify(state));expect(copy.soldiers[0].health).toBe(60);expect(copy.living!.lethalNeeds).toBe(lethal);
  });
  it('does not block a fit, hungry or thirsty person from their assignment',()=>{
    const state=createOperation('advance'),p=state.soldiers[0];p.needs!.hunger=p.needs!.thirst=100;
    expect(needsRecovery(p)).toBe(false);
  });
  it('does not churn watch relief solely because water is inaccessible',()=>{
    const sim=createStudyScenario();for(let i=0;i<1200;i++)sim.step(.05);
    const state=sim.state,g=state.living!.garrisons[0],guard=state.soldiers.find(s=>s.duty?.kind==='watch'&&s.duty.arrivedAt!==undefined&&s.duty.relieving===undefined)!;
    expect(guard).toBeDefined();guard.duty!.until=state.elapsed+150;guard.needs!.energy=90;guard.needs!.hunger=10;guard.needs!.thirst=100;
    state.living!.rearStock.water+=guard.carried!.water;guard.carried!.water=0;g.nextDecision=0;sim.step(.05);
    expect(guard.duty?.kind).toBe('watch');expect(guard.duty?.relieving).toBeUndefined();expect(guard.selfCare).toBeUndefined();
  });
  it('does not halt a march indefinitely because inaccessible water is empty',()=>{
    const state=createOperation('advance'),sim=new BattlefieldSimulation(state),p=state.soldiers[0],q=state.squads[0];
    q.order={type:'move',issuedAt:0,target:{x:p.x+100,z:p.z}};p.needs!.thirst=100;p.carried!.water=0;
    state.living!.rear={x:1900,z:1900};
    stepSelfPreservation(state,sim.terrain,sim.navigation,.05);
    expect(p.selfCare).toBeUndefined();expect(p.survivalReason??'').not.toContain('WATER');
  });
  it('finishes critical in-place recovery under sustained threat without standing or moving',()=>{
    const state=createOperation('advance'),sim=new BattlefieldSimulation(state),p=state.soldiers[0],q=state.squads[0];
    p.x=-1850;p.z=-1850;p.combat={shotSequence:0};
    q.order={type:'move',issuedAt:0,target:{x:p.x+100,z:p.z}};
    p.needs!.energy=9;p.needs!.hunger=p.needs!.thirst=10;const start={x:p.x,z:p.z};
    for(let i=0;i<2000;i++){
      state.elapsed+=.05;p.suppression=95;p.combat!.lastIncoming=state.elapsed;
      if(i===400){p.combat!.reactionRoute=[{x:p.x+3,z:p.z}];p.combat!.reactionIndex=0;}
      prepareActions(state,sim.terrain,sim.navigation,.05);stepSelfPreservation(state,sim.terrain,sim.navigation,.05);updateNeeds(state,p,.05);
      if(!p.selfCare&&p.needs!.energy>=44.99)break;
      expect(p.action).toBe('resting');expect(p.posture).toBe('prone');expect({x:p.x,z:p.z}).toEqual(start);
    }
    expect(p.selfCare).toBeUndefined();expect(p.needs!.energy).toBeGreaterThanOrEqual(44.99);
    expect(q.order.type).toBe('move');expect(p.combat!.reaction).toBe('pinned');
  });
  it('recovers a travelling worker from 25 to 45 in 30–60 seconds without crediting sleep',()=>{
    const state=createOperation('campaign'),sim=new BattlefieldSimulation(state),p=state.soldiers[0];
    p.x=-1850;p.z=-1850;p.action='walking · haul';p.needs!.energy=25;p.needs!.hunger=p.needs!.thirst=10;
    p.duty={kind:'haul',destination:{x:-1700,z:-1850},route:[{x:-1700,z:-1850}],routeIndex:0,since:0,until:100,reason:'Delivery',blockedFor:0,stage:'deliver'};
    const duty=structuredClone(p.duty),pack=inventory({...p.carried}),initialSleep=p.needs!.sleepHours;
    let copy:BattlefieldSimulation|undefined;
    for(let i=0;i<1200;i++){
      state.elapsed+=.05;prepareActions(state,sim.terrain,sim.navigation,.05);stepSelfPreservation(state,sim.terrain,sim.navigation,.05);updateNeeds(state,p,.05);
      if(i===400)copy=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));
      if(i>400&&copy){copy.state.elapsed+=.05;prepareActions(copy.state,copy.terrain,copy.navigation,.05);stepSelfPreservation(copy.state,copy.terrain,copy.navigation,.05);updateNeeds(copy.state,copy.state.soldiers[0],.05);}
      if(!p.selfCare){expect(state.elapsed).toBeGreaterThanOrEqual(30);expect(state.elapsed).toBeLessThanOrEqual(60);break;}
      expect(p.action).not.toBe('sleeping');
    }
    expect(p.selfCare).toBeUndefined();expect(p.needs!.energy).toBeGreaterThanOrEqual(44.99);expect(p.needs!.sleepHours).toBeLessThanOrEqual(initialSleep);
    expect(p.duty).toEqual(duty);expect(p.carried).toEqual(pack);expect(copy!.state.soldiers[0]).toEqual(p);
  });
});

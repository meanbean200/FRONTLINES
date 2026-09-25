import {describe,it,expect} from 'vitest';
import {createOperation} from './createOperation';
import {stepReplacements,requestReserveSquad,reserveDispatchAt} from './Replacements';
import {SaveSystem} from '../persistence/SaveSystem';
import {balance} from '../garrison/Inventory';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {inventory} from '../garrison/types';
const check=(s:ReturnType<typeof createOperation>)=>{for(const v of Object.values(balance(s)))expect(Math.abs(v)).toBeLessThan(1e-7);expect(()=>new SaveSystem().parse(JSON.stringify(s))).not.toThrow();};
describe('finite physical replacements',()=>{
  it('honors the daily release already recorded in an older save without an explicit dispatch field',()=>{
    const s=createOperation('campaign'),w=s.living!,r=s.operation!.campaign!.replacements!,p=s.soldiers[0];p.health=0;p.needs!.life='dead';w.campaignHours=32;
    stepReplacements(s,.05);delete r.dispatchAt;
    expect(reserveDispatchAt(r,'player')).toBe(56);expect(requestReserveSquad(s,w.garrisons[0].id).accepted).toBe(false);check(s);
  });
  it('collects reserves between supply schedules without importing extra stock or fuel',()=>{
    const s=createOperation('campaign'),sim=new BattlefieldSimulation(s),w=s.living!,g=w.garrisons[0];
    w.nextDelivery=1000;expect(requestReserveSquad(s,g.id).accepted).toBe(true);
    const imports=structuredClone(w.ledger.imported),truck=w.trucks.find(t=>t.role==='convoy'&&t.faction!=='enemy')!,fuel=truck.fuel;
    sim.garrisons.logistics.step(.05);stepReplacements(s,.05);
    expect(truck.state).toBe('loading');expect(s.operation!.campaign!.replacements!.manifests.every(m=>m.stage==='convoy')).toBe(true);
    // The opposing scheduled supply convoy is independent; only its import is permitted.
    expect(w.nextDelivery).toBe(1000);expect(truck.fuel).toBe(fuel);expect(Object.values(truck.cargo).every(n=>n===0)).toBe(true);
    expect(w.ledger.imported.food-imports.food).toBe(w.logistics!.manifest.food);check(s);
  });
  it('requested squads spend finite reserves, ride real routes and survive a mid-convoy save',()=>{
    let s=createOperation('campaign'),sim=new BattlefieldSimulation(s),w=s.living!,g=w.garrisons[0],r=s.operation!.campaign!.replacements!;
    expect(requestReserveSquad(s,g.id).accepted).toBe(true);expect(s.soldiers).toHaveLength(96);expect(r.reserve.player).toBe(40);
    const squadId=r.manifests[0].squadId;expect(requestReserveSquad(s,g.id).accepted).toBe(false);check(s);
    sim.issueHold([squadId]);expect(g.squadIds).toContain(squadId);
    let saved=false,travelled=false;const stages=new Set<string>();
    for(let i=0;i<16000&&r.manifests.some(m=>m.stage!=='arrived');i++){
      s.elapsed+=.05;w.campaignHours+=.05/75;stepReplacements(s,.05);sim.garrisons.logistics.step(.05);
      for(const m of r.manifests)stages.add(m.stage);
      const m=r.manifests.find(m=>m.stage==='convoy'),truck=w.trucks.find(t=>t.id===m?.truckId);
      if(truck?.state==='outbound'&&truck.routeIndex>0&&!saved){
        travelled=true;s=new SaveSystem().parse(JSON.stringify(s));sim=new BattlefieldSimulation(s);w=s.living!;g=w.garrisons[0];r=s.operation!.campaign!.replacements!;saved=true;
      }
    }
    expect(saved&&travelled).toBe(true);expect([...stages]).toEqual(expect.arrayContaining(['convoy','rear','shuttle','arrived']));
    expect(r.manifests.every(m=>m.stage==='arrived')).toBe(true);expect(s.soldiers.filter(p=>p.squadId===squadId)).toHaveLength(8);
    expect(s.soldiers.filter(p=>p.squadId===squadId).every(p=>Math.hypot(p.x-g.forward.x,p.z-g.forward.z)<5)).toBe(true);check(s);
  },15000);
  it('dispatches a passenger shuttle without cloning the lost heavy weapon',()=>{
    const s=createOperation('campaign'),sim=new BattlefieldSimulation(s),w=s.living!,q=s.squads.find(q=>q.kind==='machinegun'&&q.faction==='player')!,p=s.soldiers.find(p=>p.id===q.soldierIds[0])!,g=w.garrisons[0];p.needs!.life='dead';p.health=0;w.campaignHours=32;stepReplacements(s,.05);const m=s.operation!.campaign!.replacements!.manifests[0];expect(m.replacesId).toBe(p.id);m.stage='rear';g.forwardStock=inventory({water:400});w.ledger.initial.water+=400;sim.garrisons.logistics.step(.05);const t=w.trucks.find(t=>t.garrisonId===g.id)!;expect(t).toBeDefined();stepReplacements(s,.05);expect(m.stage).toBe('shuttle');Object.assign(t,g.forward,{state:'unloading',timer:0});stepReplacements(s,.05);expect(s.soldiers.find(p=>p.id===m.personId)!.combat!.weapon!.id).toBe('m1');expect(p.equipment!.weapon).toBe('crew-mg');check(s);
  });
  it('releases no more than eight daily, never grows a healthy army, and preserves losses while arrivals are blocked',()=>{
    const s=createOperation('campaign'),r=s.operation!.campaign!.replacements!;s.living!.campaignHours=32;stepReplacements(s,.05);expect(r.reserve.player).toBe(48);
    for(const p of s.soldiers.filter(p=>s.squads.find(q=>q.id===p.squadId)?.faction==='player').slice(0,12)){p.health=0;p.needs!.life='dead';}
    s.living!.campaignHours=56;stepReplacements(s,.05);expect(r.reserve.player).toBe(40);expect(r.manifests).toHaveLength(8);expect(s.soldiers).toHaveLength(96);
    stepReplacements(s,.05);expect(r.manifests).toHaveLength(8);check(s);
    s.living!.campaignHours=80;stepReplacements(s,.05);expect(r.manifests).toHaveLength(12);expect(r.reserve.player).toBe(36);check(s);
  });
  it('hands each person through convoy, depot and shuttle; only then adds the replacement with real depot supplies',()=>{
    const s=createOperation('campaign'),w=s.living!,r=s.operation!.campaign!.replacements!,p=s.soldiers[0],q=s.squads[0],g=w.garrisons[0];p.health=0;p.needs!.life='dead';w.campaignHours=32;
    stepReplacements(s,.05);const m=r.manifests[0],convoy=w.trucks.find(t=>t.role==='convoy'&&t.faction!=='enemy')!,shuttle=w.trucks.find(t=>t.role==='shuttle'&&t.faction!=='enemy')!;
    convoy.state='loading';stepReplacements(s,.05);expect(m.stage).toBe('convoy');check(s);
    convoy.state='blocked';stepReplacements(s,.05);expect(s.soldiers.some(p=>p.id===m.personId)).toBe(false);
    Object.assign(convoy,w.rear,{state:'unloading',timer:.01});stepReplacements(s,.05);expect(m.stage).toBe('rear');
    Object.assign(shuttle,w.rear,{state:'loading',garrisonId:g.id});stepReplacements(s,.05);expect(m.stage).toBe('shuttle');check(s);
    const copy=new SaveSystem().parse(JSON.stringify(s));expect(copy.operation!.campaign!.replacements).toEqual(r);
    Object.assign(shuttle,g.forward,{state:'unloading',timer:.01});stepReplacements(s,.05);expect(m.stage).toBe('arrived');expect(s.soldiers).toHaveLength(97);expect(s.soldiers.filter(p=>p.squadId===q.id&&p.needs!.life==='active')).toHaveLength(8);expect(s.soldiers.find(p=>p.id===m.personId)!.carried!.ammo).toBe(60);check(s);
  });
  it('returns an evacuated person under their original identity without charging the reserve',()=>{
    const s=createOperation('campaign'),p=s.soldiers[0],r=s.operation!.campaign!.replacements!;p.combat={shotSequence:4,wound:{severity:'disabling',at:0,stabilized:true,care:'evacuated',returnAt:32}};p.needs!.life='incapacitated';s.living!.campaignHours=32;
    stepReplacements(s,.05);expect(r.manifests).toHaveLength(1);expect(r.manifests[0].returning).toBe(true);expect(r.manifests[0].personId).toBe(p.id);expect(r.reserve.player).toBe(48);check(s);
    const w=s.living!,g=w.garrisons.find(g=>g.squadIds.includes(p.squadId))!,truck=w.trucks.find(t=>t.role==='shuttle'&&t.faction!=='enemy')!;
    Object.assign(truck,w.rear,{state:'loading',garrisonId:g.id});stepReplacements(s,.05);expect(r.manifests[0].stage).toBe('shuttle');
    Object.assign(truck,g.forward,{state:'unloading',timer:0});stepReplacements(s,.05);expect(r.manifests[0].stage).toBe('arrived');expect(s.soldiers).toHaveLength(96);expect(s.soldiers.filter(person=>person.id===p.id)).toHaveLength(1);expect(p.needs!.life).toBe('active');expect(p.combat!.wound).toBeUndefined();expect(r.reserve.player).toBe(48);check(s);
  });
});

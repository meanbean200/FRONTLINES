import {it,expect} from 'vitest';
import {createStudyScenario} from './StudyScenario';
import {distance} from '../core/types';
import {consume,transfer,balance} from './Inventory';
import {weaponCrewPoint,weaponServicePoint} from '../construction/PositionDefinitions';
import {SaveSystem} from '../persistence/SaveSystem';

it('passes both ways through an operating inline MG while ammo uses a separate bay and reserves wait away from it',()=>{
  const sim=createStudyScenario(1944,0,40),s=sim.state,w=s.living!,g=w.garrisons[0],t=s.trenches[0],center={x:t.points[0].x+70,z:t.points[0].z};g.nextSupport=1e9;
  const id=sim.garrisons.requestFacility(g.id,'emplacement',center,center,0,true)!,f=w.facilities.find(f=>f.id===id)!;expect(f).toBeDefined();
  transfer(g.cache,f.stock,'materials',f.materialCost);consume(s,f.stock,'materials',f.materialCost);f.paid=true;f.progress=1;
  f.installation={kind:'crew-mg',source:'construction'};f.weaponCrewIds=s.soldiers.slice(0,2).map(p=>p.id);
  transfer(w.rearStock,g.cache,'ammo',200);
  const crew=s.soldiers.slice(0,2);
  for(const [i,p]of crew.entries()){
    Object.assign(p,weaponCrewPoint(s,f,i));transfer(p.carried!,g.cache,'ammo',p.carried!.ammo);p.ammunition=0;
    p.duty={kind:'watch',destination:weaponCrewPoint(s,f,i),route:[],routeIndex:0,since:0,arrivedAt:0,until:180,reason:'Assigned weapon crew',facilityId:f.id,blockedFor:0};
  }
  const service=weaponServicePoint(s,f),relief=weaponServicePoint(s,f,true);
  expect(sim.garrisons.network.corridorContains(service)).toBe(true);
  expect(crew.every(p=>distance(p,service)>2&&distance(p,relief)>3)).toBe(true);
  const targets=new Map<number,{x:number;z:number}>();
  for(const [i,p]of s.soldiers.slice(2,18).entries()){
    const side=i%2?1:-1;Object.assign(p,{x:center.x+side*(18+Math.floor(i/2)*2.2),z:center.z});delete p.duty;
    const to={x:center.x-side*(18.95+Math.floor(i/2)*2.2),z:center.z};targets.set(p.id,to);const result=sim.garrisons.orderPerson(p.id,'move',to);expect(result.accepted,result.reason).toBe(true);
  }
  for(const [i,p]of s.soldiers.slice(18).entries()){p.x=t.points[0].x+15+i*2;p.z=center.z-.9;delete p.duty;}
  let bayObserved=false,delivered=false,copy:typeof sim|undefined;const stalls=new Map<number,number>();let maxStall=0;
  for(let tick=0;tick<1900;tick++){
    const before=new Map(s.soldiers.filter(p=>targets.has(p.id)).map(p=>[p.id,{x:p.x,z:p.z,index:p.duty?.routeIndex}]));sim.step(.05);copy?.step(.05);
    const carrier=crew.find(p=>p.duty?.weaponDeliveryId===f.id&&p.duty.kind==='haul');
    if(carrier){bayObserved=true;expect(carrier.duty!.destination).toEqual(service);if(!copy)copy=new (sim.constructor as typeof import('../simulation/BattlefieldSimulation').BattlefieldSimulation)(new SaveSystem().parse(JSON.stringify(s)));}
    delivered||=f.stock.ammo>0;
    for(const p of s.soldiers.filter(p=>targets.has(p.id)&&distance(p,targets.get(p.id)!)>.5)){
      const old=before.get(p.id)!,stall=distance(p,old)<.001&&old.index===p.duty?.routeIndex?(stalls.get(p.id)??0)+.05:0;
      stalls.set(p.id,stall);maxStall=Math.max(maxStall,stall);expect(sim.garrisons.network.corridorContains(p)).toBe(true);
    }
    if(delivered&&[...targets].every(([id,to])=>distance(s.soldiers.find(p=>p.id===id)!,to)<.5))break;
  }
  expect(bayObserved).toBe(true);expect(delivered).toBe(true);expect(maxStall).toBeLessThanOrEqual(2);
  for(const [id,to]of targets)expect(distance(s.soldiers.find(p=>p.id===id)!,to)).toBeLessThan(.5);
  const idle=s.soldiers.filter(p=>!targets.has(p.id)&&!f.weaponCrewIds!.includes(p.id)&&p.duty?.arrivedAt!==undefined&&['rest','sleep','watch'].includes(p.duty.kind));
  expect(idle.every(p=>distance(p,f)>=3)).toBe(true);
  expect(copy).toBeDefined();expect(JSON.stringify(copy!.state)).toBe(JSON.stringify(s));
  for(const n of Object.values(balance(s)))expect(Math.abs(n)).toBeLessThan(1e-6);
},20000);

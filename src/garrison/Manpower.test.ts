import {it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {manpowerPools,readyWatch} from './Manpower';

it('never counts travelling, unarmed, empty, sleeping, pinned or hungry guards as ready',()=>{
  const state=createOperation('campaign'),p=state.soldiers[0];
  p.duty={kind:'watch',destination:{x:p.x,z:p.z},route:[],routeIndex:0,since:0,until:150,arrivedAt:0,blockedFor:0,reason:'Readiness fixture'};
  p.needs!.energy=90;p.needs!.hunger=p.needs!.thirst=10;p.carried!.ammo=60;p.action='watching';p.combat={shotSequence:0};
  expect(readyWatch(state,p)).toBe(true);
  const snapshot=structuredClone(p);
  for(const change of [()=>{delete p.duty!.arrivedAt;},()=>{p.duty!.entryPending=true;},()=>{p.duty!.exitPending=true;},()=>{p.x+=10;},()=>{p.equipment!.weapon='unarmed';},()=>{p.carried!.ammo=0;},()=>{p.action='sleeping';},()=>{p.combat!.reaction='pinned';},()=>{p.needs!.thirst=90;}]){
    Object.assign(p,structuredClone(snapshot));change();expect(readyWatch(state,p)).toBe(false);
  }
});

it('keeps every living person in one manpower pool while retaining station badges',()=>{
  const state=createOperation('campaign'),people=state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction!=='enemy');
  const q=state.squads.find(q=>q.id===people[0].squadId)!;q.order={type:'move',intent:'assault',issuedAt:0};delete people[0].duty;
  people[1].needs!.life='incapacitated';people[2].needs!.life='dead';
  people[4].combat={shotSequence:0,reaction:'pinned'};
  const f=state.living!.facilities[0];if(f){f.weaponCrewIds=[people[1].id,people[3].id];}
  const before=JSON.stringify(state),pools=manpowerPools(state,people),all=Object.values(pools).flat();
  expect(new Set(all).size).toBe(all.length);expect(all.length).toBe(people.filter(p=>p.needs!.life!=='dead').length);
  expect(pools.recovering).toContain(people[1].id);expect(pools.recovering).toContain(people[4].id);expect(pools.assault).toContain(people[0].id);expect(JSON.stringify(state)).toBe(before);
});

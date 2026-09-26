import {it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {marchPreview} from './MarchPreview';

it('estimates remaining travel, recovery and only actual carried endurance without mutation',()=>{
  const s=createOperation('campaign'),p=s.soldiers[0],q=s.squads.find(q=>q.id===p.squadId)!,ids=new Set([q.id]);
  const route=[{x:p.x,z:p.z},{x:p.x+3000,z:p.z}];
  for(const person of s.soldiers.filter(person=>person.squadId===q.id)){person.needs!.energy=24;person.needs!.thirst=60;person.carried!.water=0;}
  const before=JSON.stringify(s),r=marchPreview(s,ids,route);
  expect(r.restSeconds).toBeGreaterThan(0);expect(r.atRisk).toBe(q.soldierIds.length);expect(JSON.stringify(s)).toBe(before);
  s.living!.rearStock.water+=9999;expect(marchPreview(s,ids,route)).toEqual(r);
  for(const person of s.soldiers.filter(person=>person.squadId===q.id)){person.x=route[1].x;person.z=route[1].z;person.needs!.energy=80;}
  expect(marchPreview(s,ids,route).travelSeconds).toBe(0);expect(marchPreview(s,ids,route).atRisk).toBe(0);
});

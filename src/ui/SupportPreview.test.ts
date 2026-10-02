import {describe,it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {supportPreview} from './SupportPreview';
import {preparedPosition} from '../combat/testing/PositionFixture';
import {transfer} from '../garrison/Inventory';

describe('read-only understated fire control',()=>{
  it('uses actual guns, range, traverse and friendly risk without resolving a secret impact',()=>{
    const s=createOperation('campaign'),sim=new BattlefieldSimulation(s),q=s.squads.find(q=>q.kind==='mortar'&&q.faction==='player')!,f=preparedPosition(s,q.id,'mortar');
    f.facing=0;f.artillery={batteryId:f.id,size:1,index:0};transfer(s.living!.rearStock,f.stock,'mortarHE',4);
    const near={x:f.x,z:f.z+10},front={x:f.x,z:f.z+200},back={x:f.x,z:f.z-200};
    const before=JSON.stringify(s),a=supportPreview(s,sim.terrain,'mortarHE',[f.id],near),b=supportPreview(s,sim.terrain,'mortarHE',[f.id],back),c=supportPreview(s,sim.terrain,'mortarSmoke',[f.id],front);
    expect(a.risk).toBeGreaterThan(0);expect(a.danger).toBe(65);expect(a.ready).toBe(0);expect(b.ready).toBe(0);expect(c.danger).toBe(0);expect(c.dispersion).toBe(26);expect(c.total).toBe(1);expect(JSON.stringify(s)).toBe(before);
  });
  it('reports throwers and a 30 m limit for hand smoke rather than pretending it is artillery',()=>{
    const s=createOperation('advance'),sim=new BattlefieldSimulation(s),q=s.squads[0],p=s.soldiers.find(p=>p.squadId===q.id)!;
    const before=JSON.stringify(s),close=supportPreview(s,sim.terrain,'smokeGrenades',[],{x:p.x+12,z:p.z},q.id),far=supportPreview(s,sim.terrain,'smokeGrenades',[],{x:p.x+70,z:p.z},q.id);
    expect(close.unit).toBe('throwers');expect(close.ready).toBe(1);expect(far.ready).toBe(0);expect(far.reason).toContain('30 m');expect(close.danger).toBe(0);expect(JSON.stringify(s)).toBe(before);
  });
});

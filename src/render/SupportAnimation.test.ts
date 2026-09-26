import {it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {latestGunDischarge,gunRecoil} from './SupportAnimation';
it('recoils only from a real ammunition-consuming discharge, then settles',()=>{
  const s=createOperation('campaign');s.elapsed=20.1;
  s.operation!.supportMissions=[{id:900,squadId:s.squads[0].id,positionId:901,weapon:'field-gun',kind:'mortarHE',target:{x:0,z:0},impact:{x:0,z:0},requestedAt:0,launchAt:20,impactAt:24,stage:'preparing',reason:'',dangerRadius:65,confirmedRisk:false,ammoConsumed:0}];
  expect(latestGunDischarge(s,901)).toBeUndefined();const m=s.operation!.supportMissions[0];m.stage='cancelled';expect(latestGunDischarge(s,901)).toBeUndefined();
  m.stage='flight';m.ammoConsumed=1;expect(latestGunDischarge(s,901)).toBe(m);expect(latestGunDischarge(s,902)).toBeUndefined();
  expect(gunRecoil(.1)).toBeGreaterThan(.15);expect(gunRecoil(.8)).toBeLessThan(.02);expect(gunRecoil(-1)).toBe(0);expect(gunRecoil(2)).toBe(0);
});

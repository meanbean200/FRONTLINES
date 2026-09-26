import type {BattlefieldState} from '../core/types';
/** Presentation only: a cancelled or merely queued order never recoils. */
export function latestGunDischarge(state:BattlefieldState,id:number){
  let latest:NonNullable<NonNullable<BattlefieldState['operation']>['supportMissions']>[number]|undefined;
  for(const m of state.operation?.supportMissions??[])if(m.positionId===id&&m.weapon==='field-gun'&&m.ammoConsumed===1&&(m.stage==='flight'||m.stage==='complete')&&state.elapsed>=m.launchAt&&(!latest||m.launchAt>latest.launchAt))latest=m;
  return latest;
}
export function gunRecoil(age:number):number {
  return age>=0&&age<1.2?.30*(1-Math.exp(-age*65))*Math.exp(-age*4):0;
}

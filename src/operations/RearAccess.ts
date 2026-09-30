import {distance,type BattlefieldState,type SoldierState} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {equipmentOf} from '../combat/Equipment';
import type {Faction} from './types';

/** Physical authority, not commander intelligence. A dispatch stoppage discloses
 * its own depot's problem, never an unseen attacker's identity or coordinates. */
export function rearAccess(state:BattlefieldState,terrain:TerrainSystem,side:Faction){
  const w=state.living!,rear=side==='enemy'?w.enemySupply!.rear:w.rear;
  const sides=new Map(state.squads.map(q=>[q.id,q.faction??'player']));
  const fit=(s:SoldierState)=>s.health>=25&&s.needs?.life==='active'&&s.needs.energy>=15&&s.suppression<75&&(s.carried?.ammo??s.ammunition)>0&&equipmentOf(state,s).weapon!=='unarmed';
  const nearby=state.soldiers.filter(s=>distance(s,rear)<=110&&fit(s)&&terrain.objects.trace(s,rear,terrain.heightAt(s.x,s.z)+1.5,terrain.heightAt(rear.x,rear.z)+1.5,false).clear);
  const attackers=nearby.filter(s=>sides.get(s.squadId)!==side),defenders=nearby.length-attackers.length;
  const blocked=attackers.length>=3&&attackers.length>defenders;
  return {blocked,attackers,defenders,reason:blocked?'REAR DEPOT CONTESTED · DISPATCH SUSPENDED':'Rear depot operating'};
}

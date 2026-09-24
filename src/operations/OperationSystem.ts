import { clamp, distance, type BattlefieldState, type SoldierState, type Vec2 } from '../core/types';
import { transfer } from '../garrison/Inventory';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import { factionOf, type Faction } from './types';
import {updateContacts} from './Visibility';
import {fireSmallArms} from '../combat/SmallArmsSystem';
import {commandEnemy,observeEnemy} from './EnemyCommander';
import {commandCampaign} from './CampaignCommander';
import type {ShotEvent} from '../combat/types';
import {segmentDistance,bodyVolume} from '../combat/Ballistics';
import {signalEngagement} from '../combat/Engagement';
import {stepOperationalRuntime,updateOperationalCaches} from './OperationalRuntime';
import {commandOperationalEnemy} from './OperationalCommander';
import {requestSupport} from '../combat/SupportWeapons';
export {lineOfFire} from './Visibility';

export const COMBAT_RULES = Object.freeze({ range: 360, interval: .5, shotInterval: 3.8, damage: 60, captureSeconds: 35, captureTroops: 3 });
export function combatCover(cover: SoldierState['cover']): number {
  return cover === 'trench' ? .22 : cover === 'low-ground' ? .6 : 1;
}

export class OperationSystem {
  constructor(private state: BattlefieldState, private readonly terrain: TerrainSystem) {}
  replaceState(state: BattlefieldState): void { this.state = state; }
  step(dt: number, moveEnemy: (ids: number[], destination: Vec2) => void, holdEnemy: (ids:number[])=>void = ()=>{},occupyEnemy:(ids:number[],trench:number)=>boolean=()=>false): void {
    const op = this.state.operation; if (!op || op.status !== 'active') return;
    op.elapsed += dt;
    const factions = new Map(this.state.squads.map(s => [s.id, factionOf(s)]));
    const active = this.state.soldiers.filter(s => s.health > 0 && s.needs?.life === 'active');
    for (const soldier of active) soldier.suppression = Math.max(0, soldier.suppression - dt * 2.5);
    if(op.runtime)updateOperationalCaches(this.state,active,factions,dt);else this.updateObjectives(active, factions, dt);
    // Every target is revisited each half-second, spread over the fixed ticks
    // instead of creating one all-observers visibility spike every ten frames.
    if(dt<=.050001)updateContacts(this.state,this.terrain,Math.floor((op.elapsed+.000001)/.05)%10);
    if (op.elapsed >= op.nextCombat) { op.nextCombat = op.elapsed + .1;if(dt>.050001)updateContacts(this.state,this.terrain);fireSmallArms(this.state,this.terrain,active,factions,(a,b)=>this.alertNearbyGarrisons(a,b)); }
    if(op.contacts?.player.some(c=>c.visible&&c.active))signalEngagement(this.state);
    if (op.elapsed >= op.nextOrders) {
      op.nextOrders = op.elapsed + 3;
      if(op.runtime){
        const observation=observeEnemy(this.state),result=commandOperationalEnemy(observation,this.terrain,op.enemyAI,op.runtime.commander);op.enemyAI=result.memory;op.runtime.commander=result.commander;
        for(const c of result.commands){if(c.type==='move')moveEnemy([c.squadId],c.goal);else holdEnemy([c.squadId]);}
        if(result.support)requestSupport(this.state,'mortarHE',result.support.squadId,result.support.target,false,this.terrain,'ENEMY_AI');
        if(result.commander.phase==='withdrawing')for(const q of this.state.squads.filter(q=>q.faction==='enemy'&&(q.kind==='rifle'||q.kind==='machinegun')&&q.order.type!=='occupy-trench')){
          const rally=this.state.living!.garrisons.filter(g=>g.faction==='enemy'&&distance(q,g.entrance)<120).sort((a,b)=>distance(q,a.entrance)-distance(q,b.entrance))[0];
          if(rally&&!observation.contacts.some(c=>distance(c,rally.entrance)<180))occupyEnemy([q.id],rally.trenchId);
        }
      }
      else if(op.mode==='campaign')commandCampaign(this.state,this.terrain,moveEnemy,holdEnemy,occupyEnemy);
      else {
      const result=commandEnemy(observeEnemy(this.state),this.terrain,op.enemyAI);op.enemyAI=result.memory;
      for(const command of result.commands){
        if(command.type==='move')moveEnemy([command.squadId],command.goal);else holdEnemy([command.squadId]);
      }
      }
    }
    if(op.runtime){stepOperationalRuntime(this.state,this.terrain);return;}
    const able = this.state.soldiers.filter(s => s.health > 0 && s.needs?.life === 'active');
    const player = able.filter(s => factions.get(s.squadId) === 'player').length;
    const enemy = able.length - player;
    const village = op.objectives.find(o => o.id === 'village')!;
    if (op.mode!=='campaign'&&player < COMBAT_RULES.captureTroops) this.finish('defeat', 'Too few able troops remain to hold the sector.');
    else if (op.mode === 'defense' && village.owner === 'enemy') this.finish('defeat', 'The enemy secured Saint-Martin.');
    else if (op.mode === 'advance' && op.score >= op.targetScore && village.owner === 'player') this.finish('victory', 'Saint-Martin and its approaches are secured.');
    else if (op.mode === 'defense' && (enemy === 0 || op.elapsed >= op.duration) && village.owner === 'player' && !village.contested) this.finish('victory', enemy === 0 ? 'The assault has been stopped.' : 'The crossroads held until relief arrived.');
    else if(op.mode==='campaign'){
      const c=op.campaign!,west=op.objectives.find(o=>o.id==='west-hq')!,east=op.objectives.find(o=>o.id==='east-hq')!;
      c.playerHold=west.owner==='player'&&!west.contested&&east.owner==='player'&&!east.contested?c.playerHold+dt:0;
      c.enemyHold=east.owner==='enemy'&&!east.contested&&west.owner==='enemy'&&!west.contested?c.enemyHold+dt:0;
      if(c.playerHold>=120)this.finish('victory','The opposing command post is secured and your line is intact.');
      else if(c.enemyHold>=120)this.finish('defeat','The enemy secured your command post and held their own line.');
    }
    else if (op.elapsed >= op.duration) this.finish('defeat', 'Time expired before the objective was secured.');
  }
  private finish(status: 'victory' | 'defeat', reason: string): void {
    this.state.operation!.status = status; this.state.operation!.reason = reason; this.state.simSpeed = 0;
  }
  private updateObjectives(active: SoldierState[], factions: Map<number, Faction>, dt: number): void {
    const op = this.state.operation!;
    for (const objective of op.objectives) {
      const nearby = active.filter(s => distance(s, objective) <= objective.radius && s.suppression < 75);
      const player = nearby.filter(s => factions.get(s.squadId) === 'player').length, enemy = nearby.length - player;
      const mixed = player > 0 && enemy > 0;
      objective.contested = mixed || objective.owner === 'player' && enemy > 0 || objective.owner === 'enemy' && player > 0;
      if (!mixed && Math.max(player, enemy) >= COMBAT_RULES.captureTroops) {
        objective.control = clamp(objective.control + (player ? 1 : -1) * dt / COMBAT_RULES.captureSeconds, -1, 1);
        if (objective.control >= 1) objective.owner = 'player';
        else if (objective.control <= -1) objective.owner = 'enemy';
        else if (objective.owner === 'player' && objective.control <= 0 || objective.owner === 'enemy' && objective.control >= 0) objective.owner = 'neutral';
      }
      // Physical arrival at a finite cache, never a capture-triggered or proximity-wide refill.
      const crate = this.state.living!.crates.find(c => c.id === objective.cacheId);
      if (crate && !objective.contested) for (const soldier of nearby) {
        if (factions.get(soldier.squadId) !== objective.owner || distance(soldier, crate) > 12 || soldier.duty || soldier.action !== 'holding') continue;
        transfer(crate.stock, soldier.carried!, 'ammo', Math.min(dt * 4, 60 - soldier.carried!.ammo));
        transfer(crate.stock, soldier.carried!, 'food', Math.min(dt * .25, 2 - soldier.carried!.food));
        transfer(crate.stock, soldier.carried!, 'water', Math.min(dt * .25, 3 - soldier.carried!.water));
        soldier.ammunition = soldier.carried!.ammo;
      }
    }
    const owned = op.objectives.filter(o => o.owner === 'player' && !o.contested).length;
    if (owned >= 2 && op.objectives.some(o => o.id === 'village' && o.owner === 'player' && !o.contested)) op.score += dt * (owned - 1);
  }
  private alertNearbyGarrisons(shooter:SoldierState,event:ShotEvent):void {
    const side=this.state.squads.find(q=>q.id===shooter.squadId)?.faction??'player';
    if(side==='enemy'&&this.state.soldiers.some(s=>this.state.squads.some(q=>q.id===s.squadId&&factionOf(q)==='player')&&segmentDistance(bodyVolume(this.terrain,s),event.from,event.to)<8))signalEngagement(this.state);
    const intel=this.state.operation!.intelligence;
    if(intel)for(const listener of ['player','enemy'] as const){
      if(listener===side||!this.state.soldiers.some(s=>this.state.squads.some(q=>q.id===s.squadId&&factionOf(q)===listener)&&s.needs?.life==='active'&&distance(s,shooter)<250))continue;
      const x=Math.round(shooter.x/50)*50,z=Math.round(shooter.z/50)*50;
      if(!intel.sounds.some(s=>s.side===listener&&s.x===x&&s.z===z&&this.state.elapsed-s.at<3))intel.sounds.push({side:listener,x,z,radius:60,at:this.state.elapsed,status:'suspected'});
    }
    for(const g of this.state.living!.garrisons){
    if(g.cutoff==='withdraw'||!this.state.soldiers.some(s=>s.garrisonId===g.id&&s.needs?.life==='active'&&(distance(s,shooter)<100||segmentDistance(bodyVolume(this.terrain,s),event.from,event.to)<30)))continue;
    // An actual fired round raises the alarm, without 20 Hz assignment churn.
    if((g.underFireUntil??0)<=this.state.elapsed)g.nextDecision=0;
    g.underFireUntil=this.state.elapsed+30;
    const point=distance(g.entrance,event.to)<distance(g.entrance,event.from)?event.to:event.from;
    const friendly=(g.faction??'player')===side,sign=friendly?-1:1;
    g.threatSector={x:Math.round(point.x/20)*20,z:Math.round(point.z/20)*20,front:Math.atan2(sign*(event.from.x-event.to.x),sign*(event.from.z-event.to.z))};
    }
  }
}

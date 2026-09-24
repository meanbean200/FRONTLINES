import {distance,type BattlefieldState,type SoldierState} from '../core/types';
import {inventory,RESOURCES,type Inventory} from '../garrison/types';
import {transfer} from '../garrison/Inventory';
import {freshNeeds} from '../garrison/NeedsSystem';
import type {Faction} from './types';
import {equipWeapon} from '../combat/Weapons';
import {armyFor} from './BattleSetup';

export interface ReplacementManifest {
  id:number;side:Faction;squadId:number;personId:number;returning:boolean;
  stage:'edge'|'convoy'|'rear'|'shuttle'|'arrived';truckId?:number;garrisonId?:number;
  stock:Inventory;releasedAt:number;arrivedAt?:number;
  replacesId?:number;
}
export interface ReplacementSystem {
  reserve:Record<Faction,number>;nextAt:Record<Faction,number>;
  establishment:{squadId:number;strength:number}[];manifests:ReplacementManifest[];
}
/** Configured capacity is immutable as reserves are spent. Pre-setup campaigns
 * and V2 factory scenarios without setup used the original 48-person pool. */
export function initialReserveCapacity(state:BattlefieldState):number {
  return state.operation?.setup?.advanced?.reserves??48;
}
export function initializeReplacements(state:BattlefieldState):void {
  const c=state.operation?.campaign;if(!c||c.replacements)return;
  const next=state.living!.campaignHours+24;
  const reserve=initialReserveCapacity(state);
  c.replacements={reserve:{player:reserve,enemy:reserve},nextAt:{player:next,enemy:next},establishment:state.squads.map(q=>({squadId:q.id,strength:q.soldierIds.length})),manifests:[]};
}
/** Called immediately before truck motion, so loading and unloading are real timed handoffs. */
export function stepReplacements(state:BattlefieldState,dt:number):void {
  const r=state.operation?.campaign?.replacements,w=state.living;if(!r||!w)return;
  for(const side of ['player','enemy'] as const){
    if(w.campaignHours>=r.nextAt[side]){
      // No accumulated wave after a loaded clock jump, and no army growth.
      r.nextAt[side]=w.campaignHours+24;let allowance=Math.min(8,r.reserve[side]);
      for(const row of r.establishment){
        const q=state.squads.find(q=>q.id===row.squadId&&(q.faction??'player')===side);if(!q)continue;
        const alive=state.soldiers.filter(s=>s.squadId===q.id&&s.needs?.life!=='dead').length;
        const pending=r.manifests.filter(m=>m.squadId===q.id&&!m.returning&&m.stage!=='arrived').length;
        const count=Math.min(allowance,Math.max(0,row.strength-alive-pending));
        const losses=state.soldiers.filter(s=>s.squadId===q.id&&s.needs?.life==='dead'&&!r.manifests.some(m=>m.replacesId===s.id));
        for(let i=0;i<count;i++)r.manifests.push({id:state.nextEntityId++,side,squadId:q.id,personId:state.nextEntityId++,returning:false,stage:'edge',stock:inventory(),releasedAt:w.campaignHours,replacesId:losses[i]?.id});
        allowance-=count;r.reserve[side]-=count;
      }
    }
  }
  for(const s of state.soldiers){
    const wound=s.combat?.wound;
    if(wound?.care!=='evacuated'||wound.returnAt===undefined||w.campaignHours<wound.returnAt||s.needs?.life==='dead'||r.manifests.some(m=>m.returning&&m.personId===s.id&&m.stage!=='arrived'))continue;
    const side=state.squads.find(q=>q.id===s.squadId)?.faction??'player';
    r.manifests.push({id:state.nextEntityId++,side,squadId:s.squadId,personId:s.id,returning:true,stage:'rear',stock:inventory(),releasedAt:w.campaignHours});
    delete wound.returnAt;
  }
  for(const m of r.manifests){
    if(m.stage==='arrived')continue;
    const rear=m.side==='enemy'?w.enemySupply!.rear:w.rear,stock=m.side==='enemy'?w.enemySupply!.stock:w.rearStock;
    let truck=w.trucks.find(t=>t.id===m.truckId);
    if(m.stage==='shuttle'&&truck?.state==='idle'&&distance(truck,rear)<5){m.stage='rear';delete m.truckId;delete m.garrisonId;truck=undefined;}
    if(m.stage==='edge'){
      truck=w.trucks.find(t=>(t.faction??'player')===m.side&&t.role==='convoy'&&t.state==='loading'&&r.manifests.filter(p=>p.truckId===t.id&&p.stage!=='arrived').length<8);
      if(truck){m.stage='convoy';m.truckId=truck.id;}
    }else if(m.stage==='convoy'&&truck?.state==='unloading'&&truck.timer<=dt+.00001&&distance(truck,rear)<5){m.stage='rear';delete m.truckId;}
    else if(m.stage==='rear'){
      const g=w.garrisons.find(g=>(g.faction??'player')===m.side&&g.squadIds.includes(m.squadId));
      // A replacement waits for its squad's defended rally point, never teleports to a moving squad.
      truck=g?w.trucks.find(t=>(t.faction??'player')===m.side&&t.role==='shuttle'&&t.garrisonId===g.id&&t.state==='loading'&&distance(t,rear)<5&&r.manifests.filter(p=>p.truckId===t.id&&p.stage!=='arrived').length<8):undefined;
      if(truck&&g){
        for(const key of RESOURCES){const target=key==='ammo'?60:key==='food'?2:key==='water'?3:key==='medical'?1:0;transfer(stock,m.stock,key,Math.max(0,target-m.stock[key]));}
        m.stage='shuttle';m.truckId=truck.id;m.garrisonId=g.id;
      }
    }else if(m.stage==='shuttle'&&truck?.state==='unloading'&&truck.timer<=dt+.00001){
      const g=w.garrisons.find(g=>g.id===m.garrisonId&&(g.faction??'player')===m.side&&g.squadIds.includes(m.squadId));
      if(!g||distance(truck,g.forward)>5){if(distance(truck,rear)<5){m.stage='rear';delete m.truckId;delete m.garrisonId;}continue;}
      let person=state.soldiers.find(s=>s.id===m.personId);
      if(!person){person={id:m.personId,squadId:m.squadId,x:truck.x,z:truck.z,heading:0,health:100,suppression:0,morale:70,ammunition:0,fatigue:0,action:'arriving replacement',cover:'open',needs:freshNeeds(),carried:inventory(),combat:{shotSequence:0}} satisfies SoldierState;state.soldiers.push(person);state.squads.find(q=>q.id===m.squadId)!.soldierIds.push(person.id);}
      else {delete person.combat!.wound;delete person.combat!.careTask;person.health=100;person.needs=freshNeeds();person.suppression=0;person.morale=Math.max(60,person.morale);}
      for(const key of RESOURCES)transfer(m.stock,person.carried!,key,m.stock[key]);
      person.ammunition=person.carried!.ammo;person.x=truck.x;person.z=truck.z;person.garrisonId=g.id;person.action='arriving replacement';delete person.duty;
      // New arrivals bring one ordinary rifle, not cloned heavy equipment from
      // a casualty elsewhere. Returning people retain their original kit.
      person.posture='standing';
      if(!m.returning)person.equipment={version:1,weapon:armyFor(state,m.side)==='german'?'kar98k':'m1',tools:false,mortar:false,medicalKit:false};
      equipWeapon(state,person);
      m.stage='arrived';m.arrivedAt=w.campaignHours;delete m.truckId;g.nextDecision=0;
    }
    if(m.returning&&truck){const s=state.soldiers.find(s=>s.id===m.personId)!;s.x=truck.x;s.z=truck.z;}
  }
}

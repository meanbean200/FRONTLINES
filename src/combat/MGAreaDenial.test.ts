import {describe,it,expect,vi} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {preparedPosition} from './testing/PositionFixture';
import {weaponCrewPoint} from '../construction/PositionDefinitions';
import {positionReadiness} from './WeaponPositions';

/** Matched exposed advance, not a historical hit-rate claim. No return fire:
 * isolate the difference between two riflemen and a two-person mounted crew.
 * Actual observation, shots, wounds, suppression, reactions and movement run. */
function advance(seed:number,mg:boolean){
  const state=createOperation('advance');state.seed=seed;
  const attackers=state.squads.filter(q=>q.faction==='player').slice(0,2),defender=state.squads.find(q=>q.faction==='enemy')!;
  state.squads=[...attackers,defender];defender.soldierIds=defender.soldierIds.slice(0,2);
  state.soldiers=state.soldiers.filter(s=>state.squads.some(q=>q.soldierIds.includes(s.id)));
  state.trenches=[];state.living!.garrisons=[];state.living!.facilities=[];state.living!.trucks=[];state.living!.crates=[];
  state.operation!.nextOrders=1e9;state.operation!.initialEnemy=2;state.operation!.initialPlayer=16;state.operation!.supportRules=false;
  const crew=state.soldiers.filter(s=>s.squadId===defender.id);
  crew.forEach((s,i)=>{s.x=i*1.2;s.z=0;s.heading=0;s.nextShotAt=0;s.equipment!.weapon=i?'mg42':'kar98k';s.equipment!.medicalKit=false;});
  const f=preparedPosition(state,defender.id,'emplacement'),g=state.living!.garrisons[0];
  f.facing=0;f.z=8*.43;f.trenchAnchor={trenchId:f.connectorId,along:12};g.front=0;g.readiness='stand-to';g.nextDecision=1e9;g.nextSupport=1e9;
  f.stock.ammo=600;
  for(const [i,id] of f.weaponCrewIds!.entries()){
    const s=crew.find(s=>s.id===id)!;Object.assign(s,weaponCrewPoint(state,f,i));s.carried!.ammo=mg?0:300;s.ammunition=s.carried!.ammo;
    s.equipment!.weapon=mg?'unarmed':'kar98k';delete s.combat;s.duty!.destination={x:s.x,z:s.z};s.duty!.until=1e9;
  }
  if(!mg){state.living!.facilities=[];for(const s of crew)delete s.duty!.facilityId;}
  for(const [i,q] of attackers.entries()){
    q.x=i*8-4;q.z=220;q.order={type:'hold',issuedAt:0};q.route=[];
    state.soldiers.filter(s=>s.squadId===q.id).forEach((s,j)=>{s.x=q.x+(j%4-1.5)*1.4;s.z=q.z+Math.floor(j/4)*2;s.heading=Math.PI;s.nextShotAt=1e9;s.equipment!.medicalKit=false;s.equipment!.mortar=false;delete s.garrisonId;delete s.duty;});
  }
  const sim=new BattlefieldSimulation(state);sim.terrain.buildings=[];
  vi.spyOn(sim.terrain,'baseHeightAt').mockReturnValue(0);vi.spyOn(sim.terrain,'groundTypeAt').mockReturnValue('field');vi.spyOn(sim.terrain.objects,'trees').mockReturnValue([]);sim.terrain.syncModifications();
  if(mg)expect(positionReadiness(state,f)).toBe('');
  for(const q of attackers)sim.issueMove([q.id],{x:q.x,z:30});
  const people=state.soldiers.filter(s=>attackers.some(q=>q.id===s.squadId)),reached=new Set<number>(),crossed=new Set<number>();
  let pinned=0,suppression=0,exposed=0,earlyAdvance=0;
  for(let i=0;i<4800;i++){
    sim.stepFixed();for(const s of people){if(s.needs!.life!=='active')continue;suppression+=s.suppression*.05;if(s.combat?.reaction==='pinned')pinned+=.05;if(s.z<=120)crossed.add(s.id);if(s.z>40)exposed+=.05;else reached.add(s.id);}
    if(i===2399)earlyAdvance=people.reduce((n,s)=>n+220-s.z,0)/16;
  }
  return {seed,mg,shots:state.operation!.shots,hits:state.operation!.hits,pinned:Math.round(pinned),meanSuppression:Math.round(suppression/(240*16)*10)/10,reached:reached.size,crossed100m:crossed.size,casualties:people.filter(s=>s.needs!.life!=='active'||s.combat?.wound&&s.combat.wound.severity!=='minor').length,advance:Math.round(people.reduce((n,s)=>n+220-s.z,0)/16),earlyAdvance:Math.round(earlyAdvance),exposed:Math.round(exposed)};
}
describe('mounted MG area denial against the same exposed advance',()=>{
  it('disrupts movement through credible near shots, not a damage multiplier',()=>{
    const rows=[1944,81,117].flatMap(seed=>[advance(seed,false),advance(seed,true)]);
    console.info('MATCHED_MG_ADVANCE',JSON.stringify(rows));
    const total=(mg:boolean,key:'pinned'|'meanSuppression'|'reached'|'advance'|'crossed100m')=>rows.filter(r=>r.mg===mg).reduce((n,r)=>n+r[key],0);
    expect(total(true,'pinned'),JSON.stringify(rows)).toBeGreaterThan(total(false,'pinned')*2+20);
    expect(total(true,'meanSuppression'),JSON.stringify(rows)).toBeGreaterThan(total(false,'meanSuppression')*1.5);
    expect(total(true,'reached')).toBeLessThanOrEqual(total(false,'reached'));
    expect(total(true,'crossed100m')).toBeLessThan(total(false,'crossed100m'));
    expect(total(true,'advance')).toBeLessThan(total(false,'advance')*.8);
  },60000);
});

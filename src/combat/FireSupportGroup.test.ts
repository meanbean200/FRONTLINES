import {describe,it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {preparedPosition} from './testing/PositionFixture';
import {requestSupportGroup,cancelSupportMission,stepSupport} from './SupportWeapons';
import {transfer,balance} from '../garrison/Inventory';
import {SaveSystem} from '../persistence/SaveSystem';
import {TerrainSystem} from '../terrain/TerrainSystem';

function fixture(){
  const state=createOperation('campaign');
  const guns=state.squads.filter(q=>q.faction==='player'&&q.kind==='rifle').slice(0,4).map(q=>{
    state.soldiers.find(s=>s.squadId===q.id)!.equipment!.mortar=true;
    const f=preparedPosition(state,q.id,'mortar');f.includesWeapon=true;f.installation={kind:'field-gun',source:'construction'};f.artillery={batteryId:f.id,index:0,size:1};f.facing=0;
    f.stock.mortarHE+=4;state.living!.ledger.initial.mortarHE+=4;return f;
  });
  for(const s of state.soldiers)if(!guns.some(f=>f.weaponCrewIds?.includes(s.id))){s.x=1500;s.z=1500;}
  return {state,guns,target:{x:guns[0].x,z:guns[0].z+230}};
}
describe('one intent across separately owned support weapons',()=>{
  it('dispatches every selected ready gun once and reports unavailable members',()=>{
    const {state,guns,target}=fixture();transfer(guns[2].stock,state.living!.rearStock,'mortarHE',guns[2].stock.mortarHE);
    state.soldiers.find(s=>s.id===guns[3].weaponCrewIds![0])!.suppression=90;
    const before=balance(state),result=requestSupportGroup(state,'mortarHE',[...guns.map(g=>g.id),guns[0].id],target);
    expect(result.accepted,result.reason).toBe(true);expect(result.reason).toContain('2/4');expect(state.operation!.supportMissions).toHaveLength(2);expect(balance(state)).toEqual(before);
    const [cancelled,firing]=state.operation!.supportMissions!;
    expect(cancelSupportMission(state,cancelled.id)).toBe(true);const rounds=guns[0].stock.mortarHE;
    state.elapsed=20.05;stepSupport(state,new TerrainSystem(state));
    expect(cancelled.stage).toBe('cancelled');expect(guns[0].stock.mortarHE).toBe(rounds);expect(firing.stage).toBe('flight');expect(guns[1].stock.mortarHE).toBe(3);
    expect(cancelSupportMission(state,firing.id)).toBe(false);expect(balance(state)).toEqual(before);
    expect(new SaveSystem().parse(JSON.stringify(state))).toEqual(state);
  });
  it('a danger confirmation cannot partially commit a group',()=>{
    const {state,guns,target}=fixture(),friend=state.soldiers.find(s=>!guns.some(f=>f.weaponCrewIds?.includes(s.id))&&state.squads.find(q=>q.id===s.squadId)?.faction==='player')!;
    friend.x=target.x;friend.z=target.z;const result=requestSupportGroup(state,'mortarHE',guns.map(g=>g.id),target);
    expect(result.warning).toBe(true);expect(state.operation!.supportMissions??[]).toEqual([]);
    expect(requestSupportGroup(state,'mortarHE',guns.map(g=>g.id),target,true).accepted).toBe(true);expect(state.operation!.supportMissions).toHaveLength(4);
  });
});

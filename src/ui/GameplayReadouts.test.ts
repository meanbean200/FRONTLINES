import {describe,it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {buildingReadout} from './BuildingReadout';
import {reportAnnotations} from './ContactReadout';
import {networkSupply} from './PositionReadout';
import {createStudyScenario} from '../garrison/StudyScenario';
import {reconcileSupplyDemands} from '../garrison/SupplyDemand';

describe('click-object player readouts',()=>{
  it('reports geometry capacity and friendly building occupants without hidden enemies',()=>{
    const state=createOperation('advance'),sim=new BattlefieldSimulation(state),s=state.soldiers[0],enemy=state.soldiers.find(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')!;
    sim.terrain.buildings=[{x:0,z:0,width:12,depth:12,height:8,angle:0}];
    s.building={id:0,floor:1,vertical:4,stage:'station',route:[],index:0,target:{x:4,z:0},targetFloor:1,stairTime:0};enemy.building=structuredClone(s.building);
    const before=JSON.stringify(state),r=buildingReadout(state,sim.terrain,0)!;
    expect(r.floors.map(f=>f.capacity)).toEqual([8,8]);expect(r.floors[1].inside).toBe(1);expect(r.people.map(p=>p.id)).toEqual([s.id]);expect(JSON.stringify(state)).toBe(before);
    s.needs!.life='incapacitated';const casualty=buildingReadout(state,sim.terrain,0)!;
    expect(casualty.floors[1]).toMatchObject({inside:1,ready:0,reserved:0,casualties:1});
  });
  it('retains approximate sound reports as annotations, not identity/position tracking',()=>{
    const state=createOperation('advance');state.elapsed=10;state.operation!.intelligence={squads:[],reports:[],command:{player:[],enemy:[]},sounds:[{side:'player',x:104,z:87,radius:40,at:9,status:'suspected'},{side:'enemy',x:300,z:200,radius:50,at:9,status:'suspected'}]};
    const a=reportAnnotations(state);expect(a).toHaveLength(1);expect(a[0]).toMatchObject({x:120,z:60,visible:false,heard:true,members:[]});state.soldiers[0].x=1000;expect(reportAnnotations(state)).toEqual(a);state.elapsed=25;expect(reportAnnotations(state)).toEqual([]);
  });
  it('shows real requested supply, pending truck cargo and specific shortages without mutation',()=>{
    const sim=createStudyScenario(),s=sim.state,g=s.living!.garrisons[0];s.living!.rearStock.materials=0;g.cache.materials=0;reconcileSupplyDemands(s);
    const before=JSON.stringify(s),row=networkSupply(s,[g]).rows.find(r=>r.key==='materials')!;
    expect(row.local).toBe(0);expect(row.requested).toBeGreaterThan(0);expect(row.reason).toContain('rear depot');expect(JSON.stringify(s)).toBe(before);
    const truck=s.living!.trucks.find(t=>t.role==='shuttle')!;truck.garrisonId=g.id;truck.cargo.materials=9;truck.state='blocked';
    const blocked=networkSupply(s,[g]).rows.find(r=>r.key==='materials')!;expect(blocked.inbound).toBe(9);expect(blocked.reason).toBe('Supply truck route blocked');
  });
});

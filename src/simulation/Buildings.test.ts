import {describe,it,expect,vi} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from './BattlefieldSimulation';
import {stepBuildings} from './BuildingSystem';
import {doorPoint,floorHeight,stairPoint} from '../terrain/BuildingGeometry';
import {SaveSystem} from '../persistence/SaveSystem';
import {bodyFloor} from '../operations/Visibility';
import {distance} from '../core/types';
describe('shared usable building geometry',()=>{
  it('finishes an interrupted stair traversal and separates overlapping helpers continuously',()=>{
    const sim=new BattlefieldSimulation(createOperation('advance')),s=sim.state,q=s.squads[0],id=sim.terrain.buildings.findIndex(b=>b.height>6),b=sim.terrain.buildings[id],helpers=s.soldiers.slice(0,2),landing={...stairPoint(b),z:b.z-2};
    for(const p of s.soldiers){p.x=1800;p.z=1800;}q.order={type:'hold',issuedAt:0};
    helpers.forEach((p,i)=>{p.x=landing.x+i*.2;p.z=landing.z+(i?0:.2);p.building={id,floor:0,vertical:i?0:floorHeight(b)*.05,route:[],index:0,stage:i?'station':'stairs',target:{x:b.x,z:b.z},targetFloor:i?0:1,stairTime:i?0:.4,stairFrom:landing};});
    let reachedUpper=false;for(let i=0;i<1500;i++){s.elapsed+=.05;const old=helpers.map(p=>({x:p.x,z:p.z}));stepBuildings(s,sim.terrain,sim.navigation,.05);helpers.forEach((p,n)=>expect(distance(p,old[n])).toBeLessThan(.12));if(helpers[0].building?.floor===1)reachedUpper=true;}
    expect(reachedUpper).toBe(true);expect(helpers.every(p=>!p.building)).toBe(true);
  });
  it('exits through the door to treat a casualty on the approach, then stops reassigning without an aid post',()=>{
    const sim=new BattlefieldSimulation(createOperation('advance')),s=sim.state,q=s.squads[0],id=sim.terrain.buildings.findIndex(b=>b.height>6),b=sim.terrain.buildings[id],helper=s.soldiers[0],patient=s.soldiers[1],outside=doorPoint(b,10);
    s.operation!.nextOrders=1e9;for(const p of s.soldiers){p.x=1800;p.z=1800;p.nextShotAt=1e9;}
    q.order={type:'hold',issuedAt:0,building:{id,floor:1}};
    Object.assign(helper,{x:b.x,z:b.z});helper.building={id,floor:1,vertical:floorHeight(b),route:[],index:0,stage:'station',target:{x:b.x,z:b.z},targetFloor:1,stairTime:0};
    Object.assign(patient,outside);patient.needs!.life='incapacitated';patient.health=40;patient.combat={shotSequence:0,wound:{severity:'disabling',at:0,stabilized:false,care:'untreated'}};patient.building={id,floor:0,vertical:0,route:[outside],index:0,stage:'approach',target:{x:b.x,z:b.z},targetFloor:0,stairTime:0};
    for(let i=0;i<2400;i++)sim.step(.05);
    expect(patient.combat.wound!.stabilized).toBe(true);expect(helper.combat?.careTask).toBeUndefined();expect(patient.combat.pauseReason).toContain('aid post');expect(helper.building?.floor).toBe(1);expect(helper.building?.stage).toBe('station');
    const medical=s.living!.ledger.consumed.medical;for(let i=0;i<200;i++)sim.step(.05);expect(s.living!.ledger.consumed.medical).toBe(medical);expect(helper.combat?.careTask).toBeUndefined();
  },20000);
  it('fills ground-floor observation positions without blocking the entrance',()=>{
    const sim=new BattlefieldSimulation(createOperation('advance')),s=sim.state,q=s.squads[0],id=0,b=sim.terrain.buildings[id],door=doorPoint(b,16),people=s.soldiers.filter(p=>p.squadId===q.id);for(const p of s.soldiers){p.x=1800;p.z=1800;}people.forEach((p,i)=>{p.x=door.x+(i%4-1.5)*1.5;p.z=door.z-Math.floor(i/4)*2;});Object.assign(q,door);sim.issueBuilding([q.id],id,0);for(let i=0;i<3500;i++){s.elapsed+=.05;stepBuildings(s,sim.terrain,sim.navigation,.05);}expect(people.map(p=>p.building?.stage),JSON.stringify(people.map(p=>({x:p.x,z:p.z,b:p.building,reason:p.combat?.pauseReason})))).toEqual(Array(8).fill('station'));
  });
  it('doors and windows are openings, masonry is actual protection, and upper floors share height',()=>{
    const sim=new BattlefieldSimulation(createOperation('advance')),t=sim.terrain,id=t.buildings.findIndex(b=>b.height>6),b=t.buildings[id];
    vi.spyOn(t,'baseHeightAt').mockReturnValue(0);vi.spyOn(t,'heightAt').mockReturnValue(0);vi.spyOn(t.objects,'trees').mockReturnValue([]);
    const ray=(x:number,y:number)=>t.objects.trace({x,z:b.z-b.depth/2-3},{x,z:b.z},y,y,false,true);
    expect(ray(b.x,1.5).clear).toBe(true);expect(ray(b.x-b.width*.28,1.6).clear).toBe(true);expect(ray(b.x+b.width*.15,1.6).blockedBy).toBe('building');
    const s=sim.state.soldiers[0];s.x=b.x;s.z=b.z;s.building={id,floor:1,vertical:floorHeight(b),route:[],index:0,stage:'station',target:{x:b.x,z:b.z},targetFloor:1,stairTime:0};expect(bodyFloor(t,s)).toBeCloseTo(floorHeight(b)+.14);
  });
  it('walks eight people through a door, saves on stairs, and exits without jumping through a wall',()=>{
    const sim=new BattlefieldSimulation(createOperation('advance')),s=sim.state,q=s.squads[0],t=sim.terrain,id=t.buildings.findIndex(b=>b.height>6),b=t.buildings[id],people=s.soldiers.filter(p=>p.squadId===q.id),door=doorPoint(b,16);
    for(const p of s.soldiers){p.x=1800;p.z=1800;}
    people.forEach((p,i)=>{p.x=door.x+(i%4-1.5)*1.5;p.z=door.z-Math.floor(i/4)*2;});q.x=door.x;q.z=door.z;
    sim.issueBuilding([q.id],id,1);let stairsSaved=false;
    for(let tick=0;tick<3500;tick++){s.elapsed+=.05;const old=people.map(p=>({x:p.x,z:p.z}));stepBuildings(s,t,sim.navigation,.05);people.forEach((p,i)=>expect(Math.hypot(p.x-old[i].x,p.z-old[i].z)).toBeLessThan(.12));if(!stairsSaved&&people.some(p=>p.building?.stage==='stairs')){expect(new SaveSystem().parse(JSON.stringify(s))).toEqual(s);stairsSaved=true;}}
    expect(stairsSaved,JSON.stringify(people.map(p=>({x:p.x,z:p.z,action:p.action,building:p.building,pause:p.combat?.pauseReason})))).toBe(true);expect(people.map(p=>p.building?.stage),JSON.stringify(people.map(p=>({x:p.x,z:p.z,b:p.building,reason:p.combat?.pauseReason})))).toEqual(Array(8).fill('station'));expect(people.every(p=>p.building?.floor===1)).toBe(true);
    sim.issueHold([q.id]);for(let tick=0;tick<3000;tick++){s.elapsed+=.05;stepBuildings(s,t,sim.navigation,.05);}
    expect(people.every(p=>!p.building),JSON.stringify(people.map(p=>({x:p.x,z:p.z,b:p.building,reason:p.combat?.pauseReason})))).toBe(true);
  },20000);
  it('persists only bounded preset damage and rejects malformed occupancy',()=>{
    const s=createOperation('advance'),save=new SaveSystem();s.buildingChanges=[{id:0,condition:'damaged',damage:65}];expect(save.parse(JSON.stringify(s)).buildingChanges).toEqual(s.buildingChanges);
    s.buildingChanges[0].id=99999;expect(()=>save.parse(JSON.stringify(s))).toThrow();
  });
});

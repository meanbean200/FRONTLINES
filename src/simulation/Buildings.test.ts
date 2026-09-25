import {describe,it,expect,vi} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from './BattlefieldSimulation';
import {stepBuildings} from './BuildingSystem';
import {doorPoint,firingPoints,floorHeight,stairPoint} from '../terrain/BuildingGeometry';
import {SaveSystem} from '../persistence/SaveSystem';
import {bodyFloor} from '../operations/Visibility';
import {distance} from '../core/types';
import {updateNeeds} from '../garrison/NeedsSystem';
import {clearAimPoint,resolveShot} from '../combat/Ballistics';
describe('shared usable building geometry',()=>{
  it.each([false,true])('cancels an exterior approach without routing through the house, including saved bad exits (%s)',savedExit=>{
    const sim=new BattlefieldSimulation(createOperation('advance',1944)),s=sim.state,q=s.squads[0],p=s.soldiers[0],id=48,b=sim.terrain.buildings[id];
    for(const other of s.soldiers){other.x=1800;other.z=1800;if(other!==p&&other.squadId===q.id)other.needs!.life='incapacitated';}
    p.x=b.x-b.width/2-.48;p.z=b.z-1.42;
    q.order=savedExit?{type:'hold',issuedAt:0,building:{id,floor:1}}:{type:'hold',issuedAt:0};
    p.building={id,floor:0,vertical:0,route:savedExit?[{x:b.x,z:b.z-2},doorPoint(b,-1),doorPoint(b,4)]:[doorPoint(b,8)],index:0,stage:savedExit?'exit':'approach',target:firingPoints(b)[0],targetFloor:1,stairTime:0,exitRequested:savedExit||undefined};
    const before={x:p.x,z:p.z};stepBuildings(s,sim.terrain,sim.navigation,.05);
    expect(p.building).toBeUndefined();expect({x:p.x,z:p.z}).toEqual(before);
    q.order={type:'hold',issuedAt:0,building:{id,floor:1}};
    for(let i=0;i<2400;i++){s.elapsed+=.05;const last={x:p.x,z:p.z};stepBuildings(s,sim.terrain,sim.navigation,.05);expect(distance(p,last)).toBeLessThan(.12);}
    expect(p.building?.stage).toBe('station');expect(p.building?.floor).toBe(1);
  });
  it('keeps doorway priority stable when a flank arrival must walk away from the door to finish its approach',()=>{
    // Reduced from the normal-control meeting-battle failure: nearest-person
    // priority swapped every few steps between two different approach routes.
    const sim=new BattlefieldSimulation(createOperation('advance',1944)),s=sim.state,q=s.squads[0],id=48,b=sim.terrain.buildings[id],people=s.soldiers.filter(p=>p.squadId===q.id);
    for(const p of s.soldiers){p.x=1800;p.z=1800;}
    q.order={type:'hold',issuedAt:0,building:{id,floor:0}};
    const starts=[[1044.50,1038.22],[1038.51,1032.08],[1031.69,1030.31],[1038.06,1030.18],[1031.68,1028.75],[1031.67,1028.76],[1038.06,1028.79],[1031.73,1027.41]];
    people.forEach((p,i)=>{p.x=starts[i][0];p.z=starts[i][1];const target={x:b.x+(i%3-1)*b.width*.28,z:b.z+(i<3?-1:1)*(b.depth/2-.8)};
      p.building={id,floor:0,vertical:0,route:[{x:1048,z:1040},doorPoint(b,8),doorPoint(b,-1),{x:b.x,z:b.z},target],index:0,stage:'approach',target,targetFloor:0,stairTime:0};});
    people[4].needs!.life='incapacitated';delete people[4].building;
    // Give the seven survivors distinct actual firing destinations.
    people.filter(p=>p.needs!.life==='active').forEach((p,i)=>p.building!.target=firingPoints(b)[i]);
    for(const p of people.filter(p=>p.building))p.building!.route[p.building!.route.length-1]=p.building!.target;
    for(let i=0;i<4400;i++){s.elapsed+=.05;stepBuildings(s,sim.terrain,sim.navigation,.05);}
    expect(people.filter(p=>p.needs!.life==='active').map(p=>p.building?.stage)).toEqual(Array(7).fill('station'));
  });
  it.each([false,true])('does not cut through the house corner when a helper approaches from its flank (old route: %s)',oldRoute=>{
    const sim=new BattlefieldSimulation(createOperation('advance',1944)),state=sim.state,q=state.squads[0],p=state.soldiers[0],id=48,b=sim.terrain.buildings[id];
    for(const s of state.soldiers){s.x=1800;s.z=1800;if(s!==p&&s.squadId===q.id)s.needs!.life='incapacitated';}
    Object.assign(p,{x:b.x-b.width/2-.45,z:b.z-b.depth/2+.4});q.x=p.x;q.z=p.z;
    q.order={type:'hold',issuedAt:0,building:{id,floor:0}};
    if(oldRoute)p.building={id,floor:0,vertical:0,route:[doorPoint(b,8),doorPoint(b,-1),{x:b.x,z:b.z},{x:b.x-b.width*.28,z:b.z-b.depth/2+.8}],index:0,stage:'approach',target:{x:b.x-b.width*.28,z:b.z-b.depth/2+.8},targetFloor:0,stairTime:0};
    for(let i=0;i<1600;i++){state.elapsed+=.05;const old={x:p.x,z:p.z};stepBuildings(state,sim.terrain,sim.navigation,.05);expect(distance(p,old)).toBeLessThan(.12);}
    expect(p.building?.stage,JSON.stringify({x:p.x,z:p.z,route:p.building,reason:p.combat?.pauseReason})).toBe('station');
  });
  it('rests on a long building approach, consumes only personal food, saves and resumes the same order',()=>{
    const sim=new BattlefieldSimulation(createOperation('advance')),state=sim.state,q=state.squads[0],p=state.soldiers[0],b=sim.terrain.buildings[0];
    for(const s of state.soldiers){s.x=1800;s.z=1800;}Object.assign(p,doorPoint(b,24));q.x=p.x;q.z=p.z;p.needs!.energy=11;p.needs!.hunger=65;p.needs!.thirst=65;p.carried!.food=1;p.carried!.water=1;
    sim.issueBuilding([q.id],0,0);const advance=()=>{state.elapsed+=.05;stepBuildings(state,sim.terrain,sim.navigation,.05);updateNeeds(state,p,.05);};advance();
    expect(p.action).toBe('sleeping');const at={x:p.x,z:p.z},route=JSON.stringify(p.building!.route);
    for(let i=0;i<100;i++)advance();expect({x:p.x,z:p.z}).toEqual(at);expect(p.carried!.food).toBe(0);expect(p.carried!.water).toBe(0);expect(p.needs!.life).toBe('active');
    expect(new SaveSystem().parse(JSON.stringify(state)).soldiers[0].building?.recovering).toBe(true);
    for(let i=0;i<2600;i++)advance();expect(p.building!.recovering).toBeUndefined();expect(JSON.stringify(p.building!.route)).toBe(route);expect(distance(p,at)).toBeGreaterThan(1);expect(q.order.building).toEqual({id:0,floor:0});
  });
  it('fires through a real window on both floors, never an adjacent masonry panel',()=>{
    const sim=new BattlefieldSimulation(createOperation('advance')),state=sim.state,t=sim.terrain,id=t.buildings.findIndex(b=>b.height>6),b=t.buildings[id],p=state.soldiers[0],enemy=state.soldiers.find(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')!;
    vi.spyOn(t,'baseHeightAt').mockReturnValue(0);vi.spyOn(t,'heightAt').mockReturnValue(0);vi.spyOn(t.objects,'trees').mockReturnValue([]);
    for(const floor of [0,1] as const){
      Object.assign(p,{x:b.x-b.width*.28,z:b.z-b.depth/2+.8,heading:Math.PI,action:'watching',posture:'standing'});delete p.duty;
      p.building={id,floor,vertical:floorHeight(b)*floor,route:[],index:0,stage:'station',target:{x:p.x,z:p.z},targetFloor:floor,stairTime:0};enemy.x=p.x;enemy.z=p.z-50;delete enemy.duty;enemy.posture='standing';
      const aim=clearAimPoint(t,p,enemy);expect(aim).toBeDefined();expect(resolveShot(state,t,p,aim!,[enemy],0).hitId).toBe(enemy.id);
      p.x=b.x+b.width*.15;enemy.x=p.x;expect(clearAimPoint(t,p,enemy)).toBeUndefined();
    }
  });
  it('queues a second formation outside a full floor, then admits it after a physical exit',()=>{
    const sim=new BattlefieldSimulation(createOperation('advance')),state=sim.state,groups=state.squads.slice(0,2),id=0,site=sim.terrain.buildings[id],door=doorPoint(site,16);
    for(const p of state.soldiers){p.x=1800;p.z=1800;}
    const people=groups.map((q,n)=>state.soldiers.filter(p=>p.squadId===q.id).map((p,i)=>{Object.assign(p,{x:door.x+(i%4-1.5)*1.5,z:door.z-Math.floor(i/4)*2-n*8});return p;}));
    groups.forEach(q=>Object.assign(q,door));sim.issueBuilding(groups.map(q=>q.id),id,0);
    const advance=(ticks:number)=>{for(let i=0;i<ticks;i++){state.elapsed+=.05;const before=people.flat().map(p=>({x:p.x,z:p.z}));stepBuildings(state,sim.terrain,sim.navigation,.05);people.flat().forEach((p,n)=>expect(distance(p,before[n])).toBeLessThan(.12));}};
    advance(3500);expect(people[0].every(p=>p.building?.stage==='station')).toBe(true);expect(people[1].every(p=>!p.building&&p.combat?.owner==='building')).toBe(true);
    expect(people[1][0].combat?.pauseReason).toContain('floor full');sim.issueHold([groups[0].id]);advance(5500);
    expect(people[0].every(p=>!p.building)).toBe(true);expect(people[1].map(p=>p.building?.stage)).toEqual(Array(8).fill('station'));
    expect(new Set(people[1].map(p=>JSON.stringify(p.building!.target))).size).toBe(8);
  },20000);
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

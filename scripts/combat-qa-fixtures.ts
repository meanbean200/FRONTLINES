import {existsSync,writeFileSync} from 'node:fs';
import {createOperation} from '../src/operations/createOperation';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {doorPoint} from '../src/terrain/BuildingGeometry';
import {roadPoint} from '../src/garrison/LogisticsSystem';
import {inventory} from '../src/garrison/types';
import {consume} from '../src/garrison/Inventory';
import {SaveSystem} from '../src/persistence/SaveSystem';
const base=process.argv[2];if(!base)throw Error('Output prefix required');
for(const kind of ['village','defense','night','supply','rescue'] as const){
  const sim=new BattlefieldSimulation(createOperation('campaign')),s=sim.state,w=s.living!,q=s.squads[0],enemy=s.squads.find(q=>q.faction==='enemy')!,g=w.garrisons[0];s.operation!.nextOrders=1e9;
  let focus={x:g.entrance.x,z:g.entrance.z},target={...focus},buildingId:number|undefined,patientId:number|undefined;
  const place=(id:number,x:number,z:number,heading:number)=>{const squad=s.squads.find(q=>q.id===id)!;sim.garrisons.release(id);squad.order={type:'hold',issuedAt:s.elapsed};squad.x=x;squad.z=z;squad.route=[];squad.routeIndex=0;s.soldiers.filter(p=>p.squadId===id).forEach((p,i)=>{p.x=x+(i%4-1.5)*1.3;p.z=z+Math.floor(i/4)*1.5;p.heading=heading;delete p.duty;delete p.trenchId;p.cover=sim.terrain.coverAt(p.x,p.z);});};
  if(kind==='village'){
    buildingId=sim.terrain.buildings.findIndex(b=>b.height>6&&Math.hypot(b.x+1070,b.z+1370)<100);const b=sim.terrain.buildings[buildingId],door=doorPoint(b,20);place(q.id,door.x,door.z,0);const hostile=sim.navigation.freeDestination({x:b.x+85,z:b.z-20});place(enemy.id,hostile.x,hostile.z,-Math.PI/2);focus={x:b.x,z:b.z};target={...focus};
  }else if(kind==='night'){
    const p=roadPoint(-1900);place(q.id,p.x,p.z,Math.PI/2);place(enemy.id,p.x+21,p.z,-Math.PI/2);w.campaignHours=23;focus={x:p.x+10,z:p.z};target={x:p.x+21,z:p.z};
  }else if(kind==='defense'){
    const p=sim.navigation.freeDestination({x:g.entrance.x+85,z:g.entrance.z+60});place(enemy.id,p.x,p.z,-Math.PI/2);enemy.order.intent='suppress';target={x:g.entrance.x,z:g.entrance.z+50};enemy.order.target={...target};focus={...target};
  }else if(kind==='supply'){
    for(let i=0;i<1400;i++)sim.step(.05);const t=w.trucks.find(t=>t.role==='convoy'&&t.faction!=='enemy')!,p=roadPoint(t.x+30);s.trenches.push({id:s.nextEntityId++,points:[{x:p.x,z:p.z-10},{x:p.x,z:p.z+10}],width:5,depth:2,status:'complete',progress:1});for(let i=0;i<100;i++)sim.step(.05);focus={x:t.x,z:t.z};target=p;
  }else if(kind==='rescue'){
    for(const p of s.soldiers)p.nextShotAt=1e9;const patient=s.soldiers[0],med=s.squads.find(q=>q.kind==='medical'&&q.faction==='player')!;patientId=patient.id;sim.garrisons.release(q.id);q.order={type:'hold',issuedAt:0};delete patient.duty;patient.combat={shotSequence:0,wound:{severity:'critical',at:0,bleedUntil:240,stabilized:false,care:'untreated'}};patient.health=20;patient.needs!.life='incapacitated';place(med.id,patient.x+3,patient.z,Math.PI);const post={x:patient.x-8,z:patient.z};consume(s,g.cache,'materials',18);w.facilities.push({id:s.nextEntityId++,garrisonId:g.id,kind:'aid',connectorId:g.trenchId,...post,progress:1,capacity:4,paid:true,stock:inventory(),materialCost:18});focus={x:patient.x,z:patient.z};target=post;
  }
  s.simSpeed=0;const file=`${base}-${kind}.json`;if(existsSync(file))throw Error('Preserve '+file);new SaveSystem().parse(JSON.stringify(s));writeFileSync(file,JSON.stringify({scope:`Controlled ${kind} browser fixture; existing simulation rules, explicit setup only`,state:s,focus,target,buildingId,patientId,squadId:q.id,enemyId:enemy.id}),{flag:'wx'});console.log(file);
}

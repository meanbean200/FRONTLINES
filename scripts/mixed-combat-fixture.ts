import {writeFileSync,existsSync} from 'node:fs';
import type {BattlefieldState} from '../src/core/types';
import {addSquad} from '../src/simulation/createBattlefield';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {inventory,RESOURCES} from '../src/garrison/types';
import {roadPoint} from '../src/garrison/LogisticsSystem';
import {SaveSystem} from '../src/persistence/SaveSystem';
const count=Number(process.argv[2]),target=process.argv[3];if(![300,1000].includes(count)||!target||existsSync(target))throw Error('300/1000 and unused output path required');
const s:BattlefieldState={schemaVersion:3,seed:1944,elapsed:0,simSpeed:0,nextEntityId:1,soldiers:[],squads:[],trenches:[],craters:[]};
const assignments:{ids:number[];trench:number;side:'player'|'enemy';x:number;z:number}[]=[];
for(let g=0;g<count/50;g++){
  const pair=Math.floor(g/2),x=-2200+(pair%3)*900+(g%2)*220,z=-1700+Math.floor(pair/3)*550,side=g%2?'enemy':'player',ids:number[]=[];
  for(const [i,kind] of (['rifle','rifle','rifle','rifle','engineer','machinegun','mortar','medical'] as const).entries()){const n=i<5?8:i===7?4:3;const q=addSquad(s,kind,n,x,z+i*25,`${side} ${pair+1}.${i+1}`);q.faction=side;ids.push(q.id);}
  const trench=s.nextEntityId++;s.trenches.push({id:trench,points:[{x,z:z-12},{x,z:z+225}],width:7.2,depth:1.75,status:'complete',progress:1});s.soldiers.filter(p=>ids.includes(p.squadId)).forEach((p,i)=>{p.x=x;p.z=z+i*4;p.heading=side==='player'?Math.PI/2:-Math.PI/2;});assignments.push({ids,trench,side,x,z});
}
const sim=new BattlefieldSimulation(s),w=s.living!;w.campaignHours=12;w.enemySupply={rear:roadPoint(1800),stock:{...w.rearStock},nextDelivery:0};for(const key of RESOURCES)w.ledger.initial[key]+=w.enemySupply.stock[key];
w.trucks[2].faction='enemy';w.trucks[2].role='convoy';Object.assign(w.trucks[2],roadPoint(3980));w.trucks[3].faction='enemy';Object.assign(w.trucks[3],w.enemySupply.rear);
for(const a of assignments){if(!sim.garrisons.assign(a.ids,a.trench))throw Error('Fixture assignment failed');const g=w.garrisons.find(g=>g.trenchId===a.trench)!;g.front=a.side==='player'?Math.PI/2:-Math.PI/2;g.readiness='alert';g.nextSupport=1e9;g.cache=inventory({food:120,water:160,ammo:500,medical:20,mortarHE:20,mortarSmoke:10,smokeGrenades:10});for(const key of RESOURCES)w.ledger.initial[key]+=g.cache[key];for(const q of s.squads.filter(q=>a.ids.includes(q.id))){q.order.intent='suppress';q.order.target={x:a.x+(a.side==='player'?220:-220),z:q.z};}}
for(const p of s.soldiers){p.carried!.ammo=120;p.ammunition=120;w.ledger.initial.ammo+=120;p.carried!.medical=1;w.ledger.initial.medical++;}
s.operation={version:1,mode:'advance',status:'active',elapsed:0,duration:1e9,score:0,targetScore:180,nextCombat:0,nextOrders:1e9,objectives:['west-hq','village','east-hq'].map((id,i)=>({id,name:id,x:3500+i*70,z:-3000,radius:30,owner:'neutral',control:0,contested:false,cacheId:(()=>{const id=s.nextEntityId++;w.crates.push({id,x:3500+i*70,z:-3000,stock:inventory()});return id;})()})),initialPlayer:count/2,initialEnemy:count/2,shots:0,hits:0,reason:'',casualtyRules:true,supportRules:true};
new SaveSystem().parse(JSON.stringify(s));writeFileSync(target,JSON.stringify(s),{flag:'wx'});console.log({count:s.soldiers.length,garrisons:w.garrisons.length,trucks:w.trucks.length,target});

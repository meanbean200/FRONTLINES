import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {dirname} from 'node:path';
import {WORLD_SIZE,WORLD_HALF,CHUNK_SIZE,type BattlefieldState} from '../src/core/types';
import {createBattlefield,addSquad} from '../src/simulation/createBattlefield';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {TerrainSystem} from '../src/terrain/TerrainSystem';
import {SquadNavigation} from '../src/navigation/SquadNavigation';
import {createGroundGeometry} from '../src/render/GroundGeometry';
import {roadPoint} from '../src/garrison/LogisticsSystem';
import {inventory,RESOURCES} from '../src/garrison/types';

const target=process.argv[2];if(!target||existsSync(target))throw Error('Pass unused evidence path');
const empty=createBattlefield();empty.soldiers=[];empty.squads=[];empty.trenches=[];empty.craters=[];
const terrain=new TerrainSystem(empty),start=performance.now();let chunks=0,vertices=0;
for(let z=-WORLD_HALF;z<WORLD_HALF;z+=CHUNK_SIZE)for(let x=-WORLD_HALF;x<WORLD_HALF;x+=CHUNK_SIZE){const g=createGroundGeometry(terrain,x,z,8,false);vertices+=g.attributes.position.count;g.dispose();chunks++;}
const generationMs=performance.now()-start,nav=new SquadNavigation(terrain);
const routes=[[-1850,-1750,1850,-1750],[-1700,-1800,-1700,1800],[-1850,1600,1850,1600],[-1750,-1600,1750,1600]].map(([x,z,gx,gz])=>{const a={x,z},b={x:gx,z:gz},begin=performance.now(),route=nav.plan(a,b);return {from:a,to:b,ms:performance.now()-begin,waypoints:route.length,arrived:route.length>0&&Math.hypot(route.at(-1)!.x-gx,route.at(-1)!.z-gz)<70};});
const s:BattlefieldState={...empty,soldiers:[],squads:[],trenches:[],craters:[],simSpeed:0};
for(let g=0;g<6;g++){
 const x=-1400+Math.floor(g/2)*700+(g%2)*220,z=-1550,side=g%2?'enemy':'player';
 for(let i=0;i<5;i++){const q=addSquad(s,i===4?'engineer':'rifle',10,x,z+i*30,`${side} ${g}.${i}`);q.faction=side;}
}
const sim=new BattlefieldSimulation(s),w=s.living!;w.campaignHours=12;
for(const p of s.soldiers){p.carried!.ammo=120;p.ammunition=120;w.ledger.initial.ammo+=120;}
w.enemySupply={rear:roadPoint(WORLD_HALF-320),stock:{...w.rearStock},nextDelivery:0};for(const k of RESOURCES)w.ledger.initial[k]+=w.enemySupply.stock[k];
w.trucks[2].faction='enemy';w.trucks[2].role='convoy';Object.assign(w.trucks[2],roadPoint(WORLD_HALF-20));w.trucks[3].faction='enemy';Object.assign(w.trucks[3],w.enemySupply.rear);
s.operation={version:1,mode:'advance',status:'active',elapsed:0,duration:1e9,score:0,targetScore:180,nextCombat:0,nextOrders:1e9,objectives:['farm','village','orchard'].map((id,i)=>{const p={x:1500+i*70,z:1700},cacheId=s.nextEntityId++;w.crates.push({id:cacheId,...p,stock:inventory()});return {id,name:id,...p,radius:30,owner:'neutral' as const,control:0,contested:false,cacheId};}),initialPlayer:150,initialEnemy:150,shots:0,hits:0,reason:'',casualtyRules:true,supportRules:true};
// Give both sides an established contact so requested 5× is not a first-contact test.
s.operation.engagement={number:1,lastContact:0};
const result={worldSize:WORLD_SIZE,chunks,vertices,generationMs,buildings:terrain.buildings.length,routes,fixture:{state:s,focus:{x:-650,z:-1400},zoom:740}};
mkdirSync(dirname(target),{recursive:true});writeFileSync(target,JSON.stringify(result),{flag:'wx'});console.log({target,worldSize:WORLD_SIZE,chunks,generationMs,routes});

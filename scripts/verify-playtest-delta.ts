import {existsSync,writeFileSync} from 'node:fs';
import {createOperation} from '../src/operations/createOperation';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {aimPoint,resolveShot} from '../src/combat/Ballistics';
const output=process.argv[2];if(!output||existsSync(output))throw Error('Choose an unused evidence path');
function flat(sim:BattlefieldSimulation){const t=sim.terrain;t.buildings=[];t.heightAt=()=>0;t.baseHeightAt=()=>0;t.coverAt=()=> 'open';t.groundTypeAt=()=> 'field';t.objects.trees=()=>[];t.obstacleAt=()=>false;}
const calibration=[];
for(const range of [50,100,200,300,350])for(const multiplier of [1,.94]){
 const sim=new BattlefieldSimulation(createOperation('advance',1944));flat(sim);const s=sim.state,a=s.soldiers[0],b=s.soldiers.find(p=>s.squads.find(q=>q.id===p.squadId)?.faction==='enemy')!;
 Object.assign(a,{x:0,z:0,heading:Math.PI/2,action:'holding',suppression:0,morale:100});Object.assign(b,{x:range,z:0,action:'holding',suppression:0});let hits=0;
 for(let i=0;i<20000;i++)if(resolveShot(s,sim.terrain,a,aimPoint(sim.terrain,a,b),[b],multiplier).hitId)hits++;
 const p=hits/20000,z=1.96,d=1+z*z/20000,c=(p+z*z/40000)/d,m=z*Math.sqrt(p*(1-p)/20000+z*z/16e8)/d;
 calibration.push({range,multiplier,shots:20000,hits,rate:p,confidence95:[c-m,c+m]});
}
const encounters=[];
for(const condition of ['rested','tired','suppressed','moving'] as const)for(const range of [50,200,300])for(let seed=1944;seed<1948;seed++){
 const sim=new BattlefieldSimulation(createOperation('advance',seed)),s=sim.state,op=s.operation!;flat(sim);op.nextOrders=1e9;op.duration=1e9;op.casualtyRules=true;s.living!.campaignHours=12;
 const a=s.squads.find(q=>q.faction==='player')!,b=s.squads.find(q=>q.faction==='enemy')!,team=s.soldiers.filter(p=>p.squadId===a.id||p.squadId===b.id);
 for(const p of s.soldiers){p.nextShotAt=1e9;p.x=1800;p.z=1800;}
 for(const [i,p] of team.entries()){
  Object.assign(p,{x:p.squadId===a.id?0:range,z:(i%8)*4,nextShotAt:0,heading:p.squadId===a.id?Math.PI/2:-Math.PI/2});
  if(p.squadId===a.id){p.needs!.energy=condition==='tired'?30:100;p.suppression=condition==='suppressed'?60:0;}
 }
 a.x=0;a.z=14;b.x=range;b.z=14;for(const o of op.objectives){o.x=-1800;o.z=1800;}
 if(condition==='moving')sim.issueMove([a.id],{x:range-10,z:14});
 let firstHit:number|null=null,firstDisabled:number|null=null;
 for(let i=0;i<2400;i++){sim.step(.05);if(firstHit===null&&op.hits)firstHit=s.elapsed;if(firstDisabled===null&&team.some(p=>p.needs!.life!=='active'))firstDisabled=s.elapsed;}
 encounters.push({condition,range,seed,seconds:s.elapsed,shots:op.shots,hits:op.hits,firstHit,firstDisabled,dead:team.filter(p=>p.needs!.life==='dead').length,disabled:team.filter(p=>p.needs!.life==='incapacitated').length,ammoConsumed:s.living!.ledger.consumed.ammo});
}
writeFileSync(output,JSON.stringify({scope:'Paired identical 20,000 seeded shot paths comparing only old/new calm spread multiplier. Actual 8v8 production simulation on controlled flat terrain, 120 seconds, four seeds, scenario weapons; conditions are initial states and normal recovery/suppression/movement remain active. Not a historical claim, before/after whole-encounter comparison, or browser acceptance.',calibration,encounters},null,2),{flag:'wx'});
console.log(JSON.stringify({output,calibration,encounters}));

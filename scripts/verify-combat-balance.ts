import {existsSync,writeFileSync} from 'node:fs';
import {createOperation} from '../src/operations/createOperation';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {aimPoint,resolveShot,dispersionMultiplier} from '../src/combat/Ballistics';
import {RULES_VERSION} from '../src/garrison/GarrisonPolicy';
const output=process.argv[2];if(!output||existsSync(output))throw Error('Choose unused evidence');
function flat(sim:BattlefieldSimulation){const t=sim.terrain;t.buildings=[];t.heightAt=()=>0;t.baseHeightAt=()=>0;t.coverAt=()=> 'open';t.groundTypeAt=()=> 'field';t.objects.trees=()=>[];t.obstacleAt=()=>false;}
const sim=new BattlefieldSimulation(createOperation('advance')),s=sim.state,shooter=s.soldiers[0],target=s.soldiers.find(p=>s.squads.find(q=>q.id===p.squadId)!.faction==='enemy')!;flat(sim);Object.assign(shooter,{x:0,z:0,action:'holding',morale:100,suppression:0});shooter.needs!.energy=100;s.living!.campaignHours=12;Object.assign(target,{action:'holding',suppression:0,z:0});
const rows=[];
for(const condition of ['ideal','moving-target','moving-shooter','dark','fatigue','suppressed'] as const)for(const range of [50,100,200,300,350]){
  shooter.action=condition==='moving-shooter'?'advancing':'holding';target.action=condition==='moving-target'?'advancing':'holding';s.living!.campaignHours=condition==='dark'?23:12;shooter.needs!.energy=condition==='fatigue'?30:100;shooter.suppression=condition==='suppressed'?60:0;target.x=range;shooter.combat={shotSequence:0};let hits=0;
  for(let n=0;n<10000;n++){s.seed=1944+n%7;if(resolveShot(s,sim.terrain,shooter,aimPoint(sim.terrain,shooter,target),[target],dispersionMultiplier(s,shooter,target)).hitId)hits++;}
  const p=hits/10000,z=1.96,d=1+z*z/10000,c=(p+z*z/20000)/d,m=z*Math.sqrt(p*(1-p)/10000+z*z/4e8)/d;rows.push({condition,range,shots:10000,hits,rate:p,confidence95:[c-m,c+m]});
}
const encounters=[];
for(const range of [50,200,300])for(let seed=1944;seed<1952;seed++){
  const sim=new BattlefieldSimulation(createOperation('advance',seed)),s=sim.state,op=s.operation!;flat(sim);op.nextOrders=1e9;op.duration=1e9;op.casualtyRules=true;s.living!.campaignHours=12;
  const a=s.squads.find(q=>q.faction==='player')!,b=s.squads.find(q=>q.faction==='enemy')!,team=s.soldiers.filter(p=>p.squadId===a.id||p.squadId===b.id);
  for(const p of s.soldiers){p.nextShotAt=1e9;p.x=1800;p.z=1800;}
  for(const [i,p] of team.entries()){Object.assign(p,{x:p.squadId===a.id?0:range,z:(i%8)*4,nextShotAt:0,heading:p.squadId===a.id?Math.PI/2:-Math.PI/2});}
  a.x=0;a.z=14;b.x=range;b.z=14;for(const o of op.objectives){o.x=-1800;o.z=1800;}
  const initial=team.reduce((n,p)=>n+p.carried!.ammo,0);
  for(let i=0;i<2400;i++)sim.step(.05);
  encounters.push({seed,range,seconds:s.elapsed,shots:op.shots,hits:op.hits,dead:team.filter(p=>p.needs!.life==='dead').length,disabled:team.filter(p=>p.needs!.life==='incapacitated').length,ammoConsumed:s.living!.ledger.consumed.ammo,ammoRemovedFromPacksIncludingDrops:initial-team.reduce((n,p)=>n+p.carried!.ammo,0),finalMaxSuppression:Math.max(...team.map(p=>p.suppression))});
}
writeFileSync(output,JSON.stringify({rules:RULES_VERSION,scope:'Actual resolveShot pipeline on controlled flat unobstructed geometry; 8v8 stationary encounters with scenario weapon roles, 120 seconds, eight seeds; not historical hit claims or a supported-advance acceptance test',rows,encounters},null,2),{flag:'wx'});console.log(JSON.stringify({output,ideal:rows.filter(r=>r.condition==='ideal'),encounters}));

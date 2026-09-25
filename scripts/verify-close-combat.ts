import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {createOperation} from '../src/operations/createOperation';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {aimPoint,resolveShot,dispersionMultiplier} from '../src/combat/Ballistics';
import {RULES_VERSION} from '../src/garrison/GarrisonPolicy';

const output=process.argv[2];if(!output||existsSync(output))throw new Error('Choose an unused evidence filename');
const state=createOperation('advance'),sim=new BattlefieldSimulation(state),terrain=sim.terrain;
terrain.buildings=[];terrain.heightAt=()=>0;terrain.baseHeightAt=()=>0;terrain.coverAt=()=> 'open';terrain.groundTypeAt=()=> 'field';terrain.objects.trees=()=>[];
const shooter=state.soldiers[0],target=state.soldiers.find(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')!;
Object.assign(shooter,{x:0,z:0,posture:'standing'});Object.assign(target,{z:0,posture:'standing'});
const samples=10000,rows=[];
for(const condition of ['rested','moving','pressured','severe'] as const)for(const range of [1.524,3,5,10,25,50,100,200,300,350]){
  shooter.action=condition==='moving'||condition==='severe'?'advancing':'holding';
  target.action=condition==='rested'?'holding':'advancing';
  shooter.suppression=condition==='pressured'?50:condition==='severe'?85:0;
  shooter.morale=condition==='severe'?25:condition==='pressured'?60:100;
  shooter.needs!.energy=condition==='severe'?15:condition==='pressured'?45:100;
  state.living!.campaignHours=condition==='severe'?23:12;
  shooter.combat={shotSequence:0};target.x=range;target.suppression=0;
  const aim=aimPoint(terrain,shooter,target),multiplier=dispersionMultiplier(state,shooter,target);
  let hits=0,maxDeviation=0,maxElevation=-90,maxEndHeight=-Infinity;
  const angles=[];
  for(let i=0;i<samples;i++){
    state.seed=1944+i%7;
    const event=resolveShot(state,terrain,shooter,aim,[target],multiplier);
    if(event.hitId!==undefined)hits++;
    const a={x:aim.x-event.from.x,y:aim.y-event.from.y,z:aim.z-event.from.z},b={x:event.to.x-event.from.x,y:event.to.y-event.from.y,z:event.to.z-event.from.z};
    const length=Math.hypot(a.x,a.y,a.z)*Math.hypot(b.x,b.y,b.z);
    const deviation=Math.acos(Math.max(-1,Math.min(1,(a.x*b.x+a.y*b.y+a.z*b.z)/length)))*180/Math.PI;
    angles.push(deviation);maxDeviation=Math.max(maxDeviation,deviation);maxElevation=Math.max(maxElevation,Math.atan2(b.y,Math.hypot(b.x,b.z))*180/Math.PI);maxEndHeight=Math.max(maxEndHeight,event.to.y);
  }
  angles.sort((a,b)=>a-b);const p=hits/samples,z=1.96,denom=1+z*z/samples,center=(p+z*z/(2*samples))/denom,margin=z*Math.sqrt(p*(1-p)/samples+z*z/(4*samples*samples))/denom;
  rows.push({condition,range,samples,multiplier,hits,rate:p,confidence95:[center-margin,center+margin],p95Deviation:angles[Math.floor(samples*.95)],maxDeviation,maxElevation,maxEndHeight});
}
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify({rules:RULES_VERSION,scope:'Controlled flat unobstructed geometric shots, seven repeated seeds, live resolveShot. Gameplay calibration, not historical accuracy or a natural firefight.',rows},null,2),{flag:'wx'});
console.log(JSON.stringify({output,close:rows.filter(r=>r.range===1.524),long:rows.filter(r=>r.condition==='rested'&&r.range>=50)},null,2));

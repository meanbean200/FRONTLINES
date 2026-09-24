import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createStudyScenario } from '../src/garrison/StudyScenario';
import { SaveSystem } from '../src/persistence/SaveSystem';
import { BattlefieldSimulation } from '../src/simulation/BattlefieldSimulation';
import { balance } from '../src/garrison/Inventory';
import { RULES_VERSION } from '../src/garrison/GarrisonPolicy';

// Deliberately induced shortage fixture for browser controls, not a natural playthrough.
const sim=createStudyScenario(),state=sim.state,w=state.living!,first=w.garrisons[0];
const squad=state.squads.at(-1)!,id=state.nextEntityId++,entrance={x:first.entrance.x,z:first.entrance.z-100};
state.trenches.push({id,points:[entrance,{x:entrance.x+140,z:entrance.z}],width:4.2,depth:1.75,progress:1,status:'complete'});
state.soldiers.filter(s=>s.squadId===squad.id).forEach((s,i)=>{s.x=entrance.x+5+i*2;s.z=entrance.z;});
assert(sim.assignGarrison([squad.id],id));
for(const g of w.garrisons){
  g.nextDecision=1000;g.nextSupport=1000;
  const person=state.soldiers.find(s=>s.garrisonId===g.id)!;
  person.needs!.thirst=100;person.needs!.thirstyHours=4;
}
state.simSpeed=5;sim.step(.05);
assert(w.garrisons.every(g=>g.cutoff==='decision'));
assert.equal(w.emergencyResumeSpeed,5);
const paused=new SaveSystem().parse(JSON.stringify(state));
sim.garrisons.resolveEmergency(first.id,'hold');assert.equal(state.simSpeed,0);
const restored=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));
restored.garrisons.resolveEmergency(w.garrisons[1].id,'hold');assert.equal(restored.state.simSpeed,5);
restored.step(.05);
const ledger=balance(restored.state);assert(Object.values(ledger).every(n=>Math.abs(n)<1e-6));
const target=process.argv[2]??'output/emergency-pause-followup-r1.json';
writeFileSync(target,JSON.stringify({rules:RULES_VERSION,kind:'synthetic diagnostic fixture',paused,resumeSpeed:restored.state.simSpeed,ledger},null,2),{flag:'wx'});
console.log(JSON.stringify({target,rules:RULES_VERSION,pausedAt:paused.elapsed,resumeSpeed:restored.state.simSpeed,ledger}));

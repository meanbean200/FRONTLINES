import type {BattlefieldState,SquadState} from '../core/types';
import type {StartingForce} from './OperationalTypes';
import type {Army} from './BattleSetup';

/** Fresh scenarios only. Preserve the scenario's headcount and finite kit
 * allocation, distributed among ordinary formations instead of tiny classes. */
export function equipInfantryForce(state:BattlefieldState,formations:SquadState[],force:StartingForce,army:Army):void{
  const groups=formations.map(q=>state.soldiers.filter(s=>s.squadId===q.id));
  for(const people of groups)for(const s of people)s.equipment={version:1,weapon:army==='german'?'kar98k':'m1',tools:false,mortar:false,medicalKit:false};
  for(let i=0;i<force.rifles;i++){const people=groups[i%groups.length];if(people[1])people[1].equipment!.weapon=army==='german'?'mg42':'bar';if(people[7])people[7].equipment!.weapon='smg';}
  for(let i=0;i<force.engineers*8;i++){const people=groups[i%groups.length],s=people[Math.floor(i/groups.length)%people.length];s.equipment!.tools=true;}
  for(let i=0;i<force.machineguns;i++){const people=groups[(force.rifles+i)%groups.length];people[Math.min(2,people.length-1)].equipment!.weapon='crew-mg';}
  for(let i=0;i<force.mortars;i++){const people=groups[(groups.length-1-i+groups.length)%groups.length];people[0].equipment!.mortar=true;}
  for(let i=0;i<force.medics*2;i++){const people=groups[(groups.length-1-i+groups.length)%groups.length];people[people.length-1].equipment!.medicalKit=true;}
}

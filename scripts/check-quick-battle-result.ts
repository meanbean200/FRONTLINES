import {writeFileSync} from 'node:fs';
import {defaultBattleSetup,resolveBattleSetup} from '../src/operations/BattleSetup';
import {createOperationalBattle} from '../src/operations/createOperationalBattle';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {SaveSystem} from '../src/persistence/SaveSystem';
import {balance} from '../src/garrison/Inventory';

const target=process.argv[2];if(!target)throw Error('Pass an unused JSON evidence path.');
const setup=resolveBattleSetup({...defaultBattleSetup(),operation:'line-defense',size:'small',map:'seed',seed:1944},1);
const state=createOperationalBattle(setup.operation,setup.seed,setup),sim=new BattlefieldSimulation(state);
for(let i=0;i<24020&&state.operation!.status==='active';i++)sim.step(.05);
new SaveSystem().parse(JSON.stringify(state));
const summary={scope:'Actual small Defend the Line simulation; fixed ticks, no combat overrides or state injections',setup,elapsed:state.elapsed,status:state.operation!.status,reason:state.operation!.reason,shots:state.operation!.shots,hits:state.operation!.hits,ledgerError:Math.max(...Object.values(balance(state)).map(Math.abs))};
writeFileSync(target,JSON.stringify({summary,state}),{flag:'wx'});console.log(JSON.stringify(summary));

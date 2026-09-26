import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {instantiateScenario} from './instantiateScenario';
import {parseTitleCatalogue} from './TitleCatalogue';
import {WorldSession} from '../sessions/WorldSession';
import {AttractCycle} from '../sessions/AttractCycle';
import {balance} from '../garrison/Inventory';
import {RESOURCES} from '../garrison/types';

describe('published, visually authored menu battle',()=>{
 it.each(Array.from({length:10},(_,i)=>i+1))('real fixed-step attract cycle %i has finite supply and clean initial conditions',async()=>{
  const catalogue=parseTitleCatalogue(readFileSync('content/scenarios/catalogue.json','utf8'));
  expect(catalogue.active).toBeTruthy();const text=readFileSync(`content/scenarios/published/${catalogue.active}.json`,'utf8'),preset=JSON.parse(text),baseline=JSON.stringify(instantiateScenario(preset)),owners=WorldSession.ownership.active;
   const session=new WorldSession('attract',instantiateScenario(preset),false),cycle=new AttractCycle();expect(JSON.stringify(session.state)).toBe(baseline);
   try{
   let reason:string|undefined;
   for(let tick=0;tick<=4801;tick++){
    session.step();const {elapsed,operation:op}=session.state;
    if(tick%100===0)await new Promise<void>(resolve=>setTimeout(resolve,0));
    reason=cycle.update(elapsed,op!.status,Boolean(op!.contacts?.player.some(c=>c.visible)||op!.contacts?.enemy.some(c=>c.visible)),op!.shots);
    if(reason)break;
   }
   expect(reason).toBeTruthy();expect(session.state.operation!.shots).toBeGreaterThan(10);
   const missions=session.state.operation!.supportMissions??[];
   for(const side of ['player','enemy'])expect(missions.some(m=>m.side===side&&m.ammoConsumed===1)).toBe(true);
   for(const resource of RESOURCES)expect(Math.abs(balance(session.state)[resource])).toBeLessThan(.00001);
   expect(session.state.living!.ledger.imported).toEqual(expect.objectContaining({ammo:0,mortarHE:0,food:0,water:0}));
   expect(JSON.stringify(preset)).toBe(JSON.stringify(JSON.parse(text)));
   }finally{session.dispose();}expect(WorldSession.ownership.active).toBe(owners);
 },60000);
});

import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {instantiateScenario} from './instantiateScenario';
import {parseTitleCatalogue} from './TitleCatalogue';
import {WorldSession} from '../sessions/WorldSession';
import {AttractCycle} from '../sessions/AttractCycle';
import {balance} from '../garrison/Inventory';
import {RESOURCES} from '../garrison/types';
import {operatedPosition} from '../combat/WeaponPositions';

describe('published menu battle',()=>{
 it.each(Array.from({length:10},(_,i)=>i+1))('real fixed-step attract cycle %i has finite supply and clean initial conditions',async()=>{
  const catalogue=parseTitleCatalogue(readFileSync('content/scenarios/catalogue.json','utf8'));
  expect(catalogue.active).toBeTruthy();const text=readFileSync(`content/scenarios/published/${catalogue.active}.json`,'utf8'),preset=JSON.parse(text),baseline=JSON.stringify(instantiateScenario(preset)),owners=WorldSession.ownership.active;
   const session=new WorldSession('attract',instantiateScenario(preset),false),cycle=new AttractCycle();expect(JSON.stringify(session.state)).toBe(baseline);
   try{
   let reason:string|undefined;const firedSides=new Set<string>(),mountedSides=new Set<string>(),firstShots=new Map<string,number>();
   for(let tick=0;tick<=4801;tick++){
    session.step();const {elapsed,operation:op}=session.state;
    for(const m of op!.supportMissions??[])if(m.ammoConsumed===1)firedSides.add(m.side??'player');
    for(const event of op!.shotEvents??[]){const shooter=session.state.soldiers.find(s=>s.id===event.shooterId),side=session.state.squads.find(q=>q.id===event.squadId)?.faction??'player';if(!firstShots.has(side))firstShots.set(side,event.at);if(shooter&&operatedPosition(session.state,shooter,'emplacement')&&elapsed<=30)mountedSides.add(side);}
    if(tick%100===0)await new Promise<void>(resolve=>setTimeout(resolve,0));
    reason=cycle.update(elapsed,op!.status,Boolean(op!.contacts?.player.some(c=>c.visible)||op!.contacts?.enemy.some(c=>c.visible)),op!.shots);
    if(reason)break;
   }
   expect(reason).toBeTruthy();expect(session.state.operation!.shots).toBeGreaterThan(10);
   // Completed missions are pruned from the bounded live queue. Check the whole
   // observed cycle, not just its final 120-second window.
   expect(firedSides).toEqual(new Set(['player','enemy']));
   if(preset.id==='road-cut-redoubts'){
    expect(session.state.soldiers).toHaveLength(64);
    expect([...firstShots.keys()].sort()).toEqual(['enemy','player']);
    for(const at of firstShots.values())expect(at).toBeLessThan(5);
    expect(mountedSides).toEqual(new Set(['player','enemy']));
    expect(preset).toEqual(JSON.parse(readFileSync('content/scenarios/road-cut-redoubts.json','utf8')));
   }
   for(const resource of RESOURCES)expect(Math.abs(balance(session.state)[resource])).toBeLessThan(.00001);
   expect(session.state.living!.ledger.imported).toEqual(expect.objectContaining({ammo:0,mortarHE:0,food:0,water:0}));
   expect(JSON.stringify(preset)).toBe(JSON.stringify(JSON.parse(text)));
   }finally{session.dispose();}expect(WorldSession.ownership.active).toBe(owners);
 },60000);
});

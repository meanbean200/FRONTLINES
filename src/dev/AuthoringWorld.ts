import {emptyScenarioWorld} from '../scenarios/instantiateScenario';
import type {ScenarioPreset} from '../scenarios/ScenarioPreset';
import {TrenchSystem} from '../construction/TrenchSystem';
import {TrenchNetwork} from '../garrison/TrenchNetwork';
import {TerrainSystem} from '../terrain/TerrainSystem';

/** Geometry preview only: no people, AI, inventory, simulation, sessions or workers. */
export class AuthoringWorld {
 readonly state=emptyScenarioWorld();
 readonly terrain=new TerrainSystem(this.state);
 readonly network=new TrenchNetwork();
 readonly ids=new Map<string,number>();
 private signatures=new Map<string,string>();
 sync(p:ScenarioPreset):boolean {
  const seedChanged=this.state.seed!==p.seed;
  this.state.seed=p.seed;
  const system=new TrenchSystem(this.state),retained=new Set<number>();
  for(const e of p.entities)if(e.type==='trench'){
   const signature=JSON.stringify([e.points,e.width,e.depth,e.completed]);
   let id=this.ids.get(e.id),trench=this.state.trenches.find(t=>t.id===id);
   if(this.signatures.get(e.id)!==signature||!trench){
    if(trench)this.state.trenches=this.state.trenches.filter(t=>t.id!==id);
    trench=system.create(e.points);if(id!==undefined)trench.id=id;else{ id=trench.id;this.ids.set(e.id,id); }
    trench.width=e.width;trench.depth=e.depth;trench.progress=e.completed?1:0;trench.status=e.completed?'complete':'planned';
    this.signatures.set(e.id,signature);
   }
   retained.add(trench.id);
  }
  this.state.trenches=this.state.trenches.filter(t=>retained.has(t.id));
  for(const [id,n] of this.ids)if(!retained.has(n)){this.ids.delete(id);this.signatures.delete(id);}
  if(seedChanged)this.terrain.setState(this.state);else this.terrain.syncModifications();
  this.network.sync(this.state.trenches);
  return seedChanged;
 }
}

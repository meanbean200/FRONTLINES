import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {tsImport} from 'tsx/esm/api';

/** Build-time only: embed the published snapshot, never all draft JSON files. */
export function presetContentPlugin(){
 let root,serve=false;
 const virtual='virtual:frontlines-title-preset',resolved='\0'+virtual;
 return {name:'frontlines-published-title',configResolved(config){root=config.root;serve=config.command==='serve';},resolveId(id){if(id===virtual)return resolved;},
  async load(id){if(id!==resolved)return;try{const folder=resolve(root,'content/scenarios');this.addWatchFile(resolve(folder,'catalogue.json'));
   const catalogue=JSON.parse(await readFile(resolve(folder,'catalogue.json'),'utf8'));
   if(catalogue.version!==1)throw new Error('Unsupported title catalogue');if(!catalogue.active)return 'export default null';
   if(!/^[a-z0-9][a-z0-9_-]{0,100}$/.test(catalogue.active)||!catalogue.presets?.includes(catalogue.active))throw new Error('Invalid title catalogue reference');
   const file=resolve(folder,'published',catalogue.active+'.json');this.addWatchFile(file);const preset=JSON.parse(await readFile(file,'utf8'));
   const {instantiateScenario}=await tsImport(pathToFileURL(resolve(root,'src/scenarios/instantiateScenario.ts')).href,import.meta.url);const world=instantiateScenario(preset);
   if(world.soldiers.length<50||world.soldiers.length>100||!preset.entities.some(e=>e.type==='objective')||preset.controllers.player!=='ai'||preset.controllers.enemy!=='ai'||world.operation.initialPlayer<1||world.operation.initialEnemy<1)throw new Error('Published title battle requires 50–100 people, both AI factions and an objective');
   return 'export default '+JSON.stringify(preset);
   }catch(error){if(!serve)throw error;return 'export default '+JSON.stringify({unavailable:error instanceof Error?error.message:String(error)});}
  },
  // Publication must not reload an editor with a dirty document. The player reloads explicitly.
  handleHotUpdate(ctx){if(ctx.file.replaceAll('\\','/').includes('/content/scenarios/')&&(ctx.file.endsWith('catalogue.json')||ctx.file.replaceAll('\\','/').includes('/published/'))){const mod=ctx.server.moduleGraph.getModuleById(resolved);if(mod)ctx.server.moduleGraph.invalidateModule(mod);return [];}}
 };
}

import type {Plugin} from 'vite';
import {readFile,writeFile,mkdir,rename,realpath,lstat} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {validateScenario} from '../src/scenarios/ScenarioPreset';
import {instantiateScenario} from '../src/scenarios/instantiateScenario';
import {parseTitleCatalogue} from '../src/scenarios/TitleCatalogue';
/** DEV server only. Explicit project-folder selection; fixed destination, no arbitrary filesystem API. */
export function devContentPlugin():Plugin{return {name:'frontlines-dev-content',apply:'serve',configureServer(server){
 const folder=resolve(server.config.root,'content/scenarios'),token=randomBytes(24).toString('hex');
 server.middlewares.use('/__frontlines_dev/folder',async(req,res)=>{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  const reply=(code:number,body:unknown)=>{res.statusCode=code;res.end(JSON.stringify(body));};
  try{
   if(req.method==='GET'){reply(200,{path:folder,token});return;}
   if(req.method!=='POST'||req.headers['x-frontlines-author']!==token||req.headers.origin!==`http://${req.headers.host}`){reply(403,{error:'Use the local FRONTLINES DEV controls to select this content folder.'});return;}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>2000000)throw new Error('Preset exceeds 2 MB');}const data=JSON.parse(body);
   await mkdir(folder,{recursive:true});const actual=await realpath(folder);if(actual!==folder)throw new Error('Content folder must not be a redirected link');
   const safe=(name:string)=>{if(!/^[a-z0-9][a-z0-9_-]{0,79}\.json$/.test(name))throw new Error('Invalid preset filename');const path=resolve(folder,name);if(!path.startsWith(folder+sep)||dirname(path)!==folder)throw new Error('Invalid content path');return path;};
   if(data.action==='load'){const path=safe(data.id+'.json');if((await lstat(path)).isSymbolicLink())throw new Error('Linked files are not supported');reply(200,JSON.parse(await readFile(path,'utf8')));return;}
   if(!['save','publish'].includes(data.action))throw new Error('Unsupported author action');validateScenario(data.preset);
   if(data.action==='publish'){const world=instantiateScenario(data.preset);if(world.soldiers.length<50||world.soldiers.length>100||!data.preset.entities.some((e:{type:string})=>e.type==='objective')||data.preset.controllers.player!=='ai'||data.preset.controllers.enemy!=='ai'||!world.operation!.initialPlayer||!world.operation!.initialEnemy)throw new Error('Title battle requires 50–100 people, both AI factions and an objective');}
   const atomic=async(path:string,text:string)=>{try{if((await lstat(path)).isSymbolicLink())throw new Error('Linked files are not supported');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}const temp=path+'.'+randomBytes(4).toString('hex')+'.tmp';await writeFile(temp,text,{flag:'wx'});await rename(temp,path);};
   const presetPath=safe(data.preset.id+'.json');
   if(data.exclusive){try{await lstat(presetPath);throw new Error('That identity already exists; choose another duplicate name');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
   await atomic(presetPath,JSON.stringify(data.preset,null,2));
   if(data.action==='publish'){const text=JSON.stringify(data.preset,null,2),key=data.preset.id+'-'+createHash('sha256').update(text).digest('hex').slice(0,12),published=resolve(folder,'published');await mkdir(published,{recursive:true});if(await realpath(published)!==published)throw new Error('Published folder must not be a redirected link');await atomic(resolve(published,key+'.json'),text);
    const path=safe('catalogue.json');let presets:string[]=[];try{presets=parseTitleCatalogue(await readFile(path,'utf8')).presets;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}await atomic(path,JSON.stringify({version:1,active:key,presets:[...new Set([...presets,key])]},null,2));}
   reply(200,{saved:true});
  }catch(e){reply(400,{error:e instanceof Error?e.message:String(e)});}
 });
 }};}

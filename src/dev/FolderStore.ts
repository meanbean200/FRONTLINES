import {validateScenario,type ScenarioPreset} from '../scenarios/ScenarioPreset';
import {parseTitleCatalogue} from '../scenarios/TitleCatalogue';
type Writer={write:(text:string)=>Promise<void>;close:()=>Promise<void>;abort:()=>Promise<void>};
type Directory={name:string;getDirectoryHandle:(name:string,options:{create:boolean})=>Promise<Directory>;getFileHandle:(name:string,options?:{create:boolean})=>Promise<{getFile:()=>Promise<File>;createWritable:()=>Promise<Writer>}>};
async function write(writer:Writer,text:string):Promise<void>{try{await writer.write(text);await writer.close();}catch(error){try{await writer.abort();}catch{/* Preserve the original write failure. */}throw error;}}
export class FolderStore {
 private folder?:Directory;
 private project?:{path:string;token:string};
 private useProject=false;
 get label():string{return this.useProject?this.project!.path:this.folder?.name??'No folder selected';}
 get selected():boolean{return this.useProject||Boolean(this.folder);}
 async discover():Promise<string|undefined>{try{const r=await fetch('/__frontlines_dev/folder');if(!r.ok)return;const p=await r.json();if(typeof p.path==='string'&&typeof p.token==='string')this.project=p;return this.project?.path;}catch{return;}}
 chooseProject():void{if(!this.project)throw new Error('Local project publishing is unavailable in this build');this.useProject=true;this.folder=undefined;}
 async choose():Promise<void>{const pick=(window as unknown as {showDirectoryPicker?:(o:unknown)=>Promise<Directory>}).showDirectoryPicker;if(!pick)throw new Error('Folder access is unavailable here. Choose the local project folder or use Import / Download.');const folder=await pick.call(window,{mode:'readwrite',id:'frontlines-presets'});this.folder=folder;this.useProject=false;}
 private async request(body:unknown):Promise<any>{const r=await fetch('/__frontlines_dev/folder',{method:'POST',headers:{'Content-Type':'application/json','X-Frontlines-Author':this.project!.token},body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw new Error(result.error??'Project write failed');return result;}
 async save(p:ScenarioPreset,exclusive=false):Promise<void>{validateScenario(p);if(this.useProject){await this.request({action:'save',preset:p,exclusive});return;}if(!this.folder)throw new Error('Choose a folder first, or use Download');if(exclusive){try{await this.folder.getFileHandle(p.id+'.json');throw new Error('That identity already exists; choose another duplicate name');}catch(error){if((error as DOMException).name!=='NotFoundError')throw error;}}const file=await this.folder.getFileHandle(p.id+'.json',{create:true});await write(await file.createWritable(),JSON.stringify(p,null,2));}
 async load(id:string):Promise<ScenarioPreset>{let value:unknown;if(this.useProject)value=await this.request({action:'load',id});else{if(!this.folder)throw new Error('Choose a folder or Import a preset');const file=await this.folder.getFileHandle(id+'.json');value=JSON.parse(await (await file.getFile()).text());}validateScenario(value);return value;}
 async publish(p:ScenarioPreset):Promise<void>{validateScenario(p);if(this.useProject){await this.request({action:'publish',preset:p});return;}if(!this.folder)throw new Error('Choose the project content/scenarios folder before publishing');await this.save(p);const text=JSON.stringify(p,null,2),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(v=>v.toString(16).padStart(2,'0')).join('').slice(0,12),key=p.id+'-'+hash;
  let previous:string[]=[];try{const file=await this.folder.getFileHandle('catalogue.json');previous=parseTitleCatalogue(await(await file.getFile()).text()).presets;}catch(error){if((error as DOMException).name!=='NotFoundError')throw error;}
  const published=await this.folder.getDirectoryHandle('published',{create:true}),snapshot=await published.getFileHandle(key+'.json',{create:true});await write(await snapshot.createWritable(),text);
  const file=await this.folder.getFileHandle('catalogue.json',{create:true});await write(await file.createWritable(),JSON.stringify({version:1,active:key,presets:[...new Set([...previous,key])]},null,2));}
 download(p:ScenarioPreset):void{validateScenario(p);const url=URL.createObjectURL(new Blob([JSON.stringify(p,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=p.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}

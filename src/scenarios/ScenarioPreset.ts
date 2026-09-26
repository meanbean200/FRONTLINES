import {WORLD_SIZE,WORLD_VERSION,type Vec2,type SquadKind} from '../core/types';
import {RESOURCES,type Inventory,type Facility} from '../garrison/types';
import type {Faction} from '../operations/types';

export const SCENARIO_VERSION=1;
export const INTENTIONS=['attack','defend','hold','reserve','probe','support'] as const;
export type ScenarioIntent=typeof INTENTIONS[number];
type Base={id:string;name:string};
export type ScenarioEntity=
 | Base&{type:'trench';side:Faction;points:Vec2[];completed:boolean;width:number;depth:number}
 | Base&Vec2&{type:'formation';side:Faction;kind:SquadKind;count:number;intent:ScenarioIntent;targetId?:string;trenchId?:string;ammo:number;food:number;water:number}
 | Base&Vec2&{type:'facility';kind:Facility['kind'];trenchId:string;crewId?:string;weapon?:'crew-mg'|'mortar'|'field-gun';facing:number;stock:Inventory}
 | Base&Vec2&{type:'stock';stock:Inventory}
 | Base&Vec2&{type:'objective';owner:Faction|'neutral';radius:number}
 | Base&Vec2&{type:'staging';side:Faction;radius:number};
export interface ScenarioCamera extends Vec2 {zoom:number;azimuth:number;polar:number}
/** Initial conditions only. Editor history, simulation snapshots and reports do not belong here. */
export interface ScenarioPreset {
 version:1;id:string;name:string;seed:number;generatorVersion:number;worldSize:number;
 hour:number;controllers:Record<Faction,'human'|'ai'>;camera:ScenarioCamera;entities:ScenarioEntity[];
}
export const blankScenario=():ScenarioPreset=>({version:1,id:'untitled-sector',name:'Untitled sector',seed:1944,generatorVersion:WORLD_VERSION,worldSize:WORLD_SIZE,hour:10,controllers:{player:'ai',enemy:'ai'},camera:{x:-1250,z:-1350,zoom:450,azimuth:0,polar:.65},entities:[]});

/** Reject unknown fields, rather than accepting playtest state as authoring data. */
export function validateScenario(value:unknown):asserts value is ScenarioPreset {
 const fail=(message:string):never=>{throw new Error('Scenario: '+message);};
 const object=(v:unknown,label:string):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))fail(label+' must be an object');return v as Record<string,unknown>;};
 const keys=(v:Record<string,unknown>,allowed:string[],label:string)=>{for(const k of Object.keys(v))if(!allowed.includes(k))fail(`${label}: unsupported field "${k}" (runtime state is not a preset)`);};
 const number=(v:unknown,min:number,max:number,label:string)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(`${label} must be between ${min} and ${max}`);};
 const text=(v:unknown,label:string)=>{if(typeof v!=='string'||!v.trim()||v.length>100)fail(label+' needs 1–100 characters');};
 const choice=(v:unknown,choices:readonly string[],label:string)=>{if(typeof v!=='string'||!choices.includes(v))fail(`${label}: choose ${choices.join(', ')}`);};
 const p=object(value,'preset');keys(p,['version','id','name','seed','generatorVersion','worldSize','hour','controllers','camera','entities'],'preset');
 if(p.version!==1)fail('unsupported version; open with a compatible FRONTLINES DEV build');
 if(p.generatorVersion!==WORLD_VERSION||p.worldSize!==WORLD_SIZE)fail(`this generator supports version ${WORLD_VERSION}, ${WORLD_SIZE} m worlds; existing layouts are never silently rescaled`);
 text(p.id,'identity');if(!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(p.id as string))fail('identity must be a safe lowercase filename');if(/^(catalogue|con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(p.id as string))fail('identity is reserved; choose another preset filename');text(p.name,'name');number(p.seed,1,2147483647,'seed');if(!Number.isInteger(p.seed))fail('seed must be an integer');number(p.hour,0,23.99,'time of day');
 const controllers=object(p.controllers,'controllers');keys(controllers,['player','enemy'],'controllers');for(const side of ['player','enemy'])choice(controllers[side],['human','ai'],side+' controller');
 const point=(v:Record<string,unknown>,label:string)=>{number(v.x,-WORLD_SIZE/2+12,WORLD_SIZE/2-12,label+' x');number(v.z,-WORLD_SIZE/2+12,WORLD_SIZE/2-12,label+' z');};
 const camera=object(p.camera,'camera');keys(camera,['x','z','zoom','azimuth','polar'],'camera');point(camera,'camera');number(camera.zoom,40,4000,'camera zoom');number(camera.azimuth,-100,100,'camera rotation');number(camera.polar,.1,1.5,'camera tilt');
 if(!Array.isArray(p.entities)||p.entities.length>500)fail('entities must be a list of at most 500 items');
 const ids=new Map<string,Record<string,unknown>>();let population=0;
 const stock=(s:unknown,label:string)=>{const o=object(s,label);keys(o,[...RESOURCES],label);for(const r of RESOURCES)number(o[r],0,100000,label+' '+r);};
 for(const raw of p.entities as unknown[]){const e=object(raw,'entity');text(e.id,'entity identity');if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(e.id as string))fail('entity identity must contain only letters, numbers, hyphens and underscores');text(e.name,'entity name');if(ids.has(e.id as string))fail('duplicate identity '+e.id);ids.set(e.id as string,e);
  const type=e.type;choice(type,['trench','formation','facility','stock','objective','staging'],'entity type');
  const fields=type==='trench'?['side','points','completed','width','depth']:type==='formation'?['x','z','side','kind','count','intent','targetId','trenchId','ammo','food','water']:type==='facility'?['x','z','kind','trenchId','crewId','weapon','facing','stock']:type==='stock'?['x','z','stock']:type==='objective'?['x','z','owner','radius']:['x','z','side','radius'];
  keys(e,['id','name','type',...fields],String(e.name));if(type!=='trench')point(e,String(e.name));
  if(['trench','formation','staging'].includes(type as string))choice(e.side,['player','enemy'],'faction');
  if(type==='trench'){number(e.width,3,8,'trench width');number(e.depth,.4,2.5,'trench depth');if(typeof e.completed!=='boolean')fail('trench completion is required');if(!Array.isArray(e.points)||e.points.length<2||e.points.length>128)fail('trench needs 2–128 control points');for(const v of e.points as unknown[]){const pt=object(v,'control point');keys(pt,['x','z'],'control point');point(pt,'control point');}}
  if(type==='formation'){choice(e.kind,['rifle','engineer','machinegun','mortar','medical'],'formation equipment');choice(e.intent,INTENTIONS,'intention');number(e.count,1,32,'personnel');if(!Number.isInteger(e.count))fail('personnel must be whole people');population+=e.count as number;number(e.ammo,0,600,'rounds per person');number(e.food,0,10,'food per person');number(e.water,0,10,'water per person');}
  if(type==='facility'){choice(e.kind,['rest','meal','store','ammo','aid','emplacement','mortar'],'facility kind');number(e.facing,-360,360,'facing');if(e.weapon!==undefined)choice(e.weapon,['crew-mg','mortar','field-gun'],'installed weapon');stock(e.stock,'facility stock');if((e.kind==='emplacement')!==(e.weapon==='crew-mg')||(e.kind==='mortar')!==(['mortar','field-gun'].includes(e.weapon as string)))fail('installed weapon must match the position type');}
  if(type==='stock')stock(e.stock,'loose stock');if(type==='objective'){choice(e.owner,['player','enemy','neutral'],'objective control');number(e.radius,10,200,'control radius');}if(type==='staging')number(e.radius,10,200,'staging radius');
 }
 if(population>1024)fail('more than 1024 people; reduce the authored force');
 for(const e of ids.values()){
  const ref=(key:string,type?:string)=>{if(e[key]===undefined)return;const other=ids.get(e[key] as string);if(!other||type&&other.type!==type)fail(`${e.name}: ${key} references a missing ${type??'entity'}`);return other!;};
  if(e.type==='facility'&&!e.trenchId)fail(e.name+': choose a parent trench');
  const trench=ref('trenchId','trench'),crew=ref('crewId','formation'),target=ref('targetId');
  if(target&&!['objective','staging'].includes(String(target.type)))fail(e.name+': choose an objective or staging area as the intention target');
  if(trench&&e.side&&trench.side!==e.side)fail(e.name+': cannot start assigned to the opposing trench');
  if(crew&&trench&&crew.side!==trench.side)fail(e.name+': crew and position must have the same faction');
  if(crew&&(!(e.weapon)||Number(crew.count)<2))fail(e.name+': a weapon crew needs at least two people');
 }
 const crews=new Set<string>();for(const e of ids.values())if(e.crewId){if(crews.has(e.crewId as string))fail('one formation cannot initially crew two posts');crews.add(e.crewId as string);}
}

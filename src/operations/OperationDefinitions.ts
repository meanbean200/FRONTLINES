import type {OperationDefinition,OperationId,StartingForce} from './OperationalTypes';

const force=(rifles=4):StartingForce=>({rifles,engineers:1,machineguns:1,mortars:1,medics:1});
/** Content, not runtime branches. Additional operations reuse the same objective evaluators. */
export const OPERATION_DEFINITIONS:Readonly<Record<OperationId,OperationDefinition>> = {
  breakthrough:{id:'breakthrough',title:'Breakthrough',tag:'OFFENSIVE OPERATION',duration:'NO TIME LIMIT',
    situation:'A prepared enemy belt bars the roads beyond; break through in strength and keep a route back to your rear.',
    intent:'Break the line · secure a deep route',enemyIntent:'defend',prepared:['enemy'],deployment:{player:-1200,enemy:250},
    forces:{player:force(6),enemy:force()},persistent:false,defenseSeconds:0},
  'line-defense':{id:'line-defense',title:'Defend the Line',tag:'DEFENSIVE OPERATION',duration:'20 MIN TO RELIEF',
    situation:'An enemy column is approaching a broad sector; trade ground if needed, but deny a sustained penetration into your rear.',
    intent:'Deny the enemy access to your rear',enemyIntent:'penetrate',prepared:['player'],deployment:{player:-250,enemy:1250},
    forces:{player:force(),enemy:force(6)},persistent:false,defenseSeconds:1200},
  meeting:{id:'meeting',title:'Meeting Engagement',tag:'MANEUVER OPERATION',duration:'NO TIME LIMIT',
    situation:'Both forces approach unsettled ground; reconnoitre the central terrain and break the opposing force’s ability to contest it.',
    intent:'Secure key terrain · defeat the opposing force',enemyIntent:'contest',prepared:[],deployment:{player:-1150,enemy:1150},
    forces:{player:force(),enemy:force()},persistent:false,defenseSeconds:0},
  'open-front':{id:'open-front',title:'Open Front',tag:'PERSISTENT CAMPAIGN',duration:'SAVE & RESUME',
    situation:'Opposing trench lines protect finite supply networks; develop your positions and sustain a decisive advance into the enemy rear.',
    intent:'Secure the opposing rear · maintain access',enemyIntent:'penetrate',prepared:['player','enemy'],deployment:{player:-550,enemy:550},
    forces:{player:force(),enemy:force()},persistent:true,defenseSeconds:0},
};
export const OPERATION_IDS=Object.keys(OPERATION_DEFINITIONS) as OperationId[];
export function isOperationId(id:string):id is OperationId{return Object.hasOwn(OPERATION_DEFINITIONS,id);}
export const forceSize=(f:StartingForce)=>f.rifles*8+f.engineers*8+f.machineguns*3+f.mortars*3+f.medics*2;
export function operationInfo(id:OperationId){const d=OPERATION_DEFINITIONS[id];return {title:d.title,tag:d.tag,duration:d.duration,description:d.situation,hint:d.intent};}

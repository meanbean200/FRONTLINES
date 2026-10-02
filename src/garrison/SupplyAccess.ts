import {distance,type BattlefieldState,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import type {Faction} from '../operations/types';
import {seesObject} from '../operations/ObjectSight';
import type {Crate} from './types';
import {total} from './Inventory';
import {playerCanSeePoint} from '../operations/Visibility';
import type {Inventory} from './types';
import {positionName} from './PositionNames';

export interface StockPile {kind:'rear'|'cache'|'forward';id:number;point:Vec2;stock:Inventory;side:Faction;name:string}
export function stockPiles(state:BattlefieldState,terrain:TerrainSystem,spectator=false,inView?:(point:Vec2)=>boolean):StockPile[]{
 const w=state.living!;const piles:StockPile[]=[{kind:'rear',id:0,point:w.rear,stock:w.rearStock,side:'player',name:'Rear depot'}];
 for(const g of w.garrisons)for(const kind of ['cache','forward'] as const)piles.push({kind,id:g.id,point:kind==='cache'?g.entrance:g.forward,stock:kind==='cache'?g.cache:g.forwardStock,side:g.faction??'player',name:`${positionName(state,g)} · ${kind==='cache'?'position store':'roadhead'}`});
 if(w.enemySupply)piles.push({kind:'rear',id:1,point:w.enemySupply.rear,stock:w.enemySupply.stock,side:'enemy',name:'Opposing rear depot'});
 return piles.filter(p=>(!inView||inView(p.point))&&(spectator||p.side==='player'||playerCanSeePoint(state,terrain,p.point)));
}
export function stockPileAnchors(p:StockPile):Vec2[]{return Array.from({length:Math.min(12,Math.ceil((p.stock.food+p.stock.water+p.stock.materials)/20))},(_,i)=>({x:p.point.x+2+(i%4)*1.15,z:p.point.z+Math.floor(i/4)*1.1}));}

export function factionSeesStock(state:BattlefieldState,terrain:TerrainSystem,p:Vec2,side:Faction,truck=false):boolean {
  if(!state.operation)return true;
  const squads=new Set(state.squads.filter(q=>(q.faction??'player')===side).map(q=>q.id));
  return state.soldiers.some(s=>squads.has(s.squadId)&&seesObject(state,terrain,s,p,truck?'truck':'position'));
}
export function ownsCrate(state:BattlefieldState,c:Crate,side:Faction):boolean {
  const objective=state.operation?.objectives.find(o=>o.cacheId===c.id);
  if(objective)return objective.owner===side&&!objective.contested;
  if(c.faction)return c.faction===side;
  const owner=state.soldiers.find(s=>s.id===c.droppedBy);
  return Boolean(owner&&(state.squads.find(q=>q.id===owner.squadId)?.faction??'player')===side);
}
export function crateVisible(state:BattlefieldState,terrain:TerrainSystem,c:Crate,side:Faction='player'):boolean {
  return ownsCrate(state,c,side)||factionSeesStock(state,terrain,c,side);
}
/** Authority checks presence; feedback never identifies or locates hidden defenders. */
export function crateAccess(state:BattlefieldState,terrain:TerrainSystem,c:Crate,side:Faction):string {
  if(total(c.stock)<.001)return 'EMPTY';
  if(!crateVisible(state,terrain,c,side))return 'NO CURRENT OBSERVATION';
  const site=state.operation?.objectives.find(o=>o.cacheId===c.id);
  if(site&&(site.owner!==side||site.contested))return 'AREA NOT SECURED';
  if(state.soldiers.some(s=>s.health>0&&s.needs?.life==='active'&&(state.squads.find(q=>q.id===s.squadId)?.faction??'player')!==side&&distance(s,c)<25))return 'AREA NOT SECURED';
  if(!ownsCrate(state,c,side)&&state.operation&&!state.soldiers.some(s=>s.needs?.life==='active'&&(state.squads.find(q=>q.id===s.squadId)?.faction??'player')===side&&distance(s,c)<30))return 'AREA NOT SECURED · bring personnel to the stock';
  return '';
}
/** Click anchors are the same physical boxes used by LivingRenderer. */
export function crateAnchors(state:BattlefieldState,c:Crate):Vec2[] {
  const site=state.operation?.objectives.some(o=>o.cacheId===c.id);
  const owner=state.soldiers.find(s=>c.droppedBy!==undefined?s.id===c.droppedBy:!site&&s.needs?.life!=='active'&&distance(s,c)<.05);
  if(owner)return [{x:c.x+Math.cos(owner.heading)*.65,z:c.z-Math.sin(owner.heading)*.65}];
  return Array.from({length:site?Math.min(10,Math.ceil(total(c.stock)/32)):1},(_,i)=>({x:c.x+(site?2+i%3*1.05:0),z:c.z+Math.floor(i/3)*.95}));
}

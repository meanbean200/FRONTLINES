import type { Vec2 } from '../core/types';
import type {WeaponState} from './Weapons';
import type {Wound,CareTask} from './Casualties';

export interface Point3 extends Vec2 { y:number }
export interface ShotEvent {
  id:number; at:number; shooterId:number; squadId:number;
  from:Point3; to:Point3; hitId?:number;
  obstruction?:'terrain'|'building'|'trunk'; energy:number;
}
export interface AimState {
  targetId?:number; since:number; lastSeen:number; point:Point3;
  lastHeading:number; lastPosition:Vec2; settlingUntil:number;
}
export interface SoldierCombat {
  shotSequence:number; aim?:AimState;
  reaction?:Reaction;reactionUntil?:number;owner?:ActionOwner;
  lastIncoming?:number;threatDirection?:number;coverReview?:number;
  reactionRoute?:Vec2[];reactionIndex?:number;pauseReason?:string;
  weapon?:WeaponState;
  wound?:Wound;careTask?:CareTask;nextCareReview?:number;
}
export type Reaction = 'steady'|'under-fire'|'pinned'|'shaken'|'broken';
export type ActionOwner = 'order'|'duty'|'reaction'|'casualty'|'building'|'support';
export type TacticalIntent = 'move'|'observe'|'suppress'|'assault'|'fall-back';

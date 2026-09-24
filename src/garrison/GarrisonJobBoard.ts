import type {SoldierState} from '../core/types';
import type {Garrison} from './types';

/** Deterministic shared allocation. Duties own reservations; nobody owns a berth. */
export class GarrisonJobBoard {
  rankPeople(people:SoldierState[]):SoldierState[] {
    const urgency=(s:SoldierState)=>{
      const n=s.needs!;
      return Math.max(n.thirst,n.hunger)+n.thirstyHours*4+n.hungryHours*2+(s.health<40?40:0)+(n.energy<10?20:0);
    };
    return [...people].sort((a,b)=>urgency(b)-urgency(a)||a.id-b.id);
  }

  publish(g:Garrison,people:SoldierState[]):void {
    g.jobs=(['watch','patrol','sleep','meal','haul','construct'] as const).map((kind,i)=>({
      kind,priority:g.scores[i],assigned:people.filter(s=>s.duty?.kind===kind).length,
      required:kind==='watch'?g.watchRequired:kind==='meal'?people.filter(s=>s.needs!.hunger>35||s.needs!.thirst>35).length:kind==='sleep'?people.filter(s=>s.needs!.sleepHours<8).length:0,
      reason:kind==='watch'?'Readiness target; physical relief required':kind==='meal'?'Needs-ranked service queue':kind==='sleep'?'Night preference and recovery deficit':'Reachable work with inventory and personnel constraints',
    }));
  }
}

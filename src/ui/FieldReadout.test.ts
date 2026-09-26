import {it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {selectionReadout} from './FieldReadout';

it('reports fit strength separately from physically ready personnel without mutating orders',()=>{
 const state=createOperation('advance'),q=state.squads[0],ids=new Set([q.id]),people=state.soldiers.filter(s=>s.squadId===q.id);
 for(const p of people){delete p.garrisonId;delete p.duty;p.action='holding';p.carried!.ammo=60;p.needs!.energy=90;p.combat={shotSequence:0};p.equipment!.weapon='m1';}
 expect(selectionReadout(state,ids)!.ready).toBe(people.length);
 people[0].action='following drawn path';people[1].combat!.reaction='pinned';people[2].carried!.ammo=0;people[3].action='sleeping';
 const before=JSON.stringify(state),read=selectionReadout(state,ids)!;
 expect(read.able).toBe(people.length);expect(read.ready).toBe(people.length-4);expect(JSON.stringify(state)).toBe(before);
});

it('keeps routine field rest local and never invents hunger or water emergencies',()=>{
 const state=createOperation('advance'),q=state.squads[0],ids=new Set([q.id]);
 for(const p of state.soldiers.filter(s=>s.squadId===q.id)){p.needs!.hunger=p.needs!.thirst=100;p.carried!.food=p.carried!.water=0;}
 expect(selectionReadout(state,ids)!.warning).toBe('');
 state.soldiers[0].selfCare={kind:'field-rest',stage:'use',since:0,until:45,orderAt:0,home:{x:0,z:0},route:[],index:0,blockedFor:0};
 expect(selectionReadout(state,ids)!.warning).toBe('RESTING');
});

import {describe,it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {selectionReadout} from './FieldReadout';
import {mapUnits,mapClusters} from './FieldMap';
import {trenchDraft} from './TrenchDraft';
import {fieldIcon} from './FieldSymbols';

describe('field command presentation is truthful and read only',()=>{
  it('discloses one meaningful formation warning instead of permanent stat meters',()=>{
    const state=createOperation('advance'),q=state.squads[0],ids=new Set([q.id]);
    expect(selectionReadout(state,ids)!.warning).toBe('');
    const people=state.soldiers.filter(s=>s.squadId===q.id);for(const s of people)s.carried!.ammo=5;
    expect(selectionReadout(state,ids)!.warning).toBe('LOW AMMO');people[0].needs!.life='incapacitated';
    expect(selectionReadout(state,ids)!.warning).toBe('CASUALTIES');
    for(const s of people)s.combat={shotSequence:0,reaction:'pinned'};
    expect(selectionReadout(state,ids)!.warning).toBe('PINNED');
  });
  it('reports actual strength, rounds and state, without exposing an enemy selection',()=>{
    const state=createOperation('advance'),q=state.squads[0],s=state.soldiers.find(s=>s.squadId===q.id)!;
    s.needs!.life='incapacitated';s.carried!.ammo=99;
    const before=JSON.stringify(state),r=selectionReadout(state,new Set([q.id]))!;
    expect(r.able).toBe(7);expect(r.down).toBe(1);expect(r.total).toBe(8);
    expect(r.ammo).toBe(state.soldiers.filter(s=>s.squadId===q.id&&s.needs!.life==='active').reduce((sum,s)=>sum+s.carried!.ammo,0));
    expect(selectionReadout(state,new Set([state.squads.find(q=>q.faction==='enemy')!.id]))).toBeUndefined();
    expect(JSON.stringify(state)).toBe(before);
  });
  it('never maps hidden live coordinates or force identities',()=>{
    const state=createOperation('advance'),enemy=state.squads.find(q=>q.faction==='enemy')!;
    state.operation!.contacts={player:[],enemy:[]};
    expect(mapUnits(state).some(u=>u.enemy)).toBe(false);
    state.operation!.contacts.player=[{soldierId:enemy.soldierIds[0],squadId:enemy.id,x:12,z:13,lastSeen:state.elapsed,visible:false,active:true}];
    enemy.x=999;enemy.z=888;
    expect(mapUnits(state).find(u=>u.enemy)).toMatchObject({x:12,z:13,reported:true,name:'Last report'});
    state.elapsed+=60;expect(mapUnits(state).some(u=>u.enemy)).toBe(false);
  });
  it('clusters nearby map symbols without combining factions or report quality',()=>{
    const sample={id:1,x:0,z:0,enemy:false,reported:false,name:'Able'};
    const clusters=mapClusters([sample,{...sample,id:2,x:3},{...sample,id:3,enemy:true},{...sample,id:4,enemy:true,reported:true}],p=>({x:p.x,y:p.z}));
    expect(clusters.map(c=>c.units.length)).toEqual([2,1,1]);
  });
  it('marks only blocked drawn segments and does not promise a smoothing result',()=>{
    const ground={clampToWorld:(p:{x:number;z:number})=>({...p}),obstacleAt:(x:number)=>x>=24&&x<=26,groundTypeAt:(x:number)=>x>=40?'river' as const:'field' as const};
    const a=trenchDraft([{x:0,z:0},{x:8,z:0}],ground);expect(a.tooShort).toBe(true);expect(a.blocked).toHaveLength(0);
    expect(trenchDraft([{x:0,z:0},{x:10,z:0}],ground).tooShort).toBe(false);
    const b=trenchDraft([{x:0,z:0},{x:22,z:0},{x:30,z:0},{x:45,z:0}],ground);expect(b.length).toBe(45);expect(b.blocked).toHaveLength(2);expect(b.tooShort).toBe(false);
  });
  it('icons are labelled by their control, not duplicate screen reader text',()=>{
    expect(fieldIcon('move')).toContain('aria-hidden="true"');expect(fieldIcon('rifle')).toContain('viewBox="0 0 24 24"');
  });
});

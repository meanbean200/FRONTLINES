import {describe,it,expect} from 'vitest';
import {defaultOpenFrontSetup,resolveBattleSetup} from './BattleSetup';
import {createOperationalBattle} from './createOperationalBattle';
import {forwardWorkIntent} from './OpenFrontWorks';
import {atDepth,frontDepth} from './OperationGeometry';

// Synthetic commander-input checks, not a claim of an integrated player battle.
function fixture(){
  const setup=defaultOpenFrontSetup();setup.advanced.direction='east';
  const state=createOperationalBattle('open-front',1944,resolveBattleSetup({...setup,map:'seed'},1944),true),r=state.operation!.runtime!;
  state.elapsed=state.operation!.elapsed=300;
  const id=state.nextEntityId++;state.trenches.push({id,points:[atDepth(r.front,315,-40),atDepth(r.front,315,0),atDepth(r.front,315,40)],width:4.2,depth:1.75,progress:1,status:'complete'});
  const teams=state.squads.filter(q=>q.faction==='enemy').slice(0,2);
  state.operation!.intelligence={squads:[],reports:[],sounds:[],command:{player:[],enemy:[{soldierId:state.soldiers[0].id,squadId:state.squads[0].id,x:-150,z:0,lastSeen:300,visible:false,active:true,status:'last-reported',uncertainty:20}]}};
  return {state,r,id,teams};
}
describe('adaptive Open Front earthwork intentions',()=>{
  it('requires actual own forward deployment by two formations and a recent delivered report',()=>{
    const {state,r,id,teams}=fixture();expect(forwardWorkIntent(state,id)).toBeUndefined();
    Object.assign(teams[0],atDepth(r.front,0,-20));expect(forwardWorkIntent(state,id)).toBeUndefined();
    Object.assign(teams[1],atDepth(r.front,20,20));
    expect(frontDepth(r.front,forwardWorkIntent(state,id)!)).toBe(75);
    state.operation!.intelligence!.command.enemy[0].lastSeen=250;expect(forwardWorkIntent(state,id)).toBeUndefined();
  });
  it('cannot follow hidden opponents or recruit depleted forward formations',()=>{
    const {state,r,id,teams}=fixture();teams.forEach((q,i)=>Object.assign(q,atDepth(r.front,i*20,i*20)));
    const before=forwardWorkIntent(state,id);
    for(const p of state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='player')){p.x=999;p.z=-999;}
    expect(forwardWorkIntent(state,id)).toEqual(before);
    state.soldiers.filter(p=>p.squadId===teams[1].id).forEach(p=>p.needs!.energy=20);
    expect(forwardWorkIntent(state,id)).toBeUndefined();
  });
  it('places a fallback line behind the threatened line only on a reported withdrawal',()=>{
    const {state,r,id}=fixture();r.commander={phase:'withdrawing',since:300,startingAble:64,reason:'Regroup'};
    expect(forwardWorkIntent(state,id)).toBeUndefined();
    Object.assign(state.operation!.intelligence!.command.enemy[0],atDepth(r.front,250));
    expect(frontDepth(r.front,forwardWorkIntent(state,id)!)).toBe(485);
  });
});

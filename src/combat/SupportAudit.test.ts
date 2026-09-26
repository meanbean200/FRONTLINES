import {describe,it,expect} from 'vitest';
import {createOperationalBattle} from '../operations/createOperationalBattle';
import {requestSupport,type SupportRequest,type SupportSource} from './SupportWeapons';
import {SaveSystem} from '../persistence/SaveSystem';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {RULES_VERSION} from '../garrison/GarrisonPolicy';
import {preparedPosition} from './testing/PositionFixture';

function fixture(){
  const state=createOperationalBattle('meeting'),terrain=new TerrainSystem(state);
  const q=state.squads.find(q=>q.faction==='player'&&state.soldiers.some(s=>s.squadId===q.id&&s.equipment?.mortar))!;
  const enemy=state.squads.find(q=>q.faction==='enemy')!;
  preparedPosition(state,q.id,'mortar');
  return {state,terrain,q,enemy,target:{x:q.x,z:q.z+200}};
}
const row=(squadId:number,side:'player'|'enemy',source:SupportSource):SupportRequest=>({at:0,squadId,side,source,kind:'mortarHE',target:{x:100,z:100},accepted:false,reason:'No ammunition'});

describe('truthful support audit ownership',()=>{
  it('authorizes authored friendly AI only with its actual controller and delivered faction report',()=>{
    const {state,terrain,q,target,enemy}=fixture(),op=state.operation!;
    expect(requestSupport(state,'mortarHE',q.id,target,false,terrain,'AUTHORED_AI').reason).toContain('authority');
    op.authored={presetId:'test',controllers:{player:'ai',enemy:'ai'},intentions:[],targets:[],memories:{},hold:{player:0,enemy:0}};
    if(op.intelligence)op.intelligence.command.player=[];if(op.contacts)op.contacts.player=[];
    expect(requestSupport(state,'mortarHE',q.id,target,false,terrain,'AUTHORED_AI').reason).toContain('report');
    const report={soldierId:enemy.soldierIds[0],squadId:enemy.id,...target,lastSeen:state.elapsed,active:true,visible:true};
    if(op.intelligence)op.intelligence.command.player=[report];else op.contacts={player:[report],enemy:[]};
    expect(requestSupport(state,'mortarHE',q.id,target,false,terrain,'AUTHORED_AI').accepted).toBe(true);
    expect(op.supportMissions!.at(-1)).toMatchObject({side:'player',source:'AUTHORED_AI'});
    expect(()=>new SaveSystem().parse(JSON.stringify(state))).not.toThrow();
    op.authored.controllers.player='human';const before=JSON.stringify(state);
    expect(requestSupport(state,'mortarHE',q.id,target,false,terrain,'AUTHORED_AI').reason).toContain('authority');expect(JSON.stringify(state)).toBe(before);
  });
  it('rejects an unknown requester without inventing player history or changing state',()=>{
    const {state,terrain,target}=fixture(),before=JSON.stringify(state);
    expect(requestSupport(state,'mortarHE',state.nextEntityId+900,target,false,terrain).accepted).toBe(false);
    expect(JSON.stringify(state)===before).toBe(true);
  });
  it('keeps a real no-ammunition rejection, with its identity, faction and reason',()=>{
    const {state,terrain,q,target}=fixture();
    for(const s of state.soldiers.filter(s=>s.squadId===q.id)){state.living!.ledger.initial.mortarHE-=s.carried!.mortarHE;s.carried!.mortarHE=0;}
    for(const f of state.living!.facilities){state.living!.ledger.initial.mortarHE-=f.stock.mortarHE;f.stock.mortarHE=0;}
    const result=requestSupport(state,'mortarHE',q.id,target,false,terrain);
    expect(result.accepted).toBe(false);expect(result.reason).toContain('ammunition');
    expect(state.operation!.supportRequests!.at(-1)).toMatchObject({squadId:q.id,side:'player',source:'PLAYER',accepted:false,reason:result.reason});
    expect(()=>new SaveSystem().parse(JSON.stringify(state))).not.toThrow();
  });
  it.each(['ENEMY_AI','CAMPAIGN_AI'] as const)('rejects %s commanding a player without poisoning later saves',source=>{
    const {state,terrain,q,target}=fixture(),before=JSON.stringify(state);
    expect(requestSupport(state,'mortarHE',q.id,target,false,terrain,source).reason).toContain('authority');
    expect(JSON.stringify(state)===before).toBe(true);expect(()=>new SaveSystem().parse(JSON.stringify(state))).not.toThrow();
  });
  it('rejects PLAYER commanding an enemy without writing an invalid audit row',()=>{
    const {state,terrain,enemy,target}=fixture(),before=JSON.stringify(state);
    expect(requestSupport(state,'mortarHE',enemy.id,target,false,terrain,'PLAYER').reason).toContain('authority');
    expect(JSON.stringify(state)===before).toBe(true);
  });
  for(const corruption of ['missing-squad','wrong-side','player-as-enemy-ai','enemy-as-player'] as const)
    it(`rejects current-rules saved request history: ${corruption}`,()=>{
      const {state,q,enemy}=fixture();expect(state.combatRules).toBe(RULES_VERSION);
      const bad=corruption==='missing-squad'?row(state.nextEntityId+1,'player','PLAYER'):
        corruption==='wrong-side'?row(enemy.id,'player','PLAYER'):
        corruption==='player-as-enemy-ai'?row(q.id,'player','ENEMY_AI'):row(enemy.id,'enemy','PLAYER');
      state.operation!.supportRequests=[bad];
      expect(()=>new SaveSystem().parse(JSON.stringify(state))).toThrow('not a supported');
    });
  it.each(['ENEMY_AI','CAMPAIGN_AI'] as const)('preserves a real %s rejection without a delivered report',source=>{
    const {state,terrain,enemy,target}=fixture();
    expect(requestSupport(state,'mortarHE',enemy.id,target,false,terrain,source).reason).toContain('report');
    expect(state.operation!.supportRequests!.at(-1)).toMatchObject({squadId:enemy.id,side:'enemy',source,accepted:false});
    expect(()=>new SaveSystem().parse(JSON.stringify(state))).not.toThrow();
  });
  it('keeps bounded history and the legacy default player faction for an existing squad',()=>{
    const {state,terrain,q,target}=fixture();delete q.faction;
    for(let n=0;n<70;n++)requestSupport(state,'mortarHE',q.id,{...target,x:q.x+10},false,terrain);
    expect(state.operation!.supportRequests).toHaveLength(64);
    expect(state.operation!.supportRequests!.every(r=>r.squadId===q.id&&r.side==='player')).toBe(true);
    expect(()=>new SaveSystem().parse(JSON.stringify(state))).not.toThrow();
  });
  it.each(['SCRIPTED_SCENARIO','LEGACY_UNKNOWN'] as const)('preserves explicit historical %s records without authorizing new fire',source=>{
    const {state,terrain,q,target}=fixture();state.operation!.supportRequests=[row(q.id,'player',source)];
    const saved=new SaveSystem().parse(JSON.stringify(state));
    expect(saved.operation!.supportRequests).toEqual(state.operation!.supportRequests);
    const before=JSON.stringify(saved);
    expect(requestSupport(saved,'mortarHE',q.id,target,false,terrain,source).reason).toContain('authority');
    expect(JSON.stringify(saved)===before).toBe(true);
  });
  it.each(['SCRIPTED_SCENARIO','LEGACY_UNKNOWN'] as const)('historical %s never excuses a mismatched owner',source=>{
    const {state,enemy}=fixture();state.operation!.supportRequests=[row(enemy.id,'player',source)];
    expect(()=>new SaveSystem().parse(JSON.stringify(state))).toThrow('not a supported');
  });
  it.each(['side','source'] as const)('also rejects the adjacent mission-history %s mismatch',field=>{
    const {state,terrain,q,target}=fixture();expect(requestSupport(state,'mortarHE',q.id,target,false,terrain).accepted).toBe(true);
    const mission=state.operation!.supportMissions![0];
    if(field==='side')mission.side='enemy';else mission.source='ENEMY_AI';
    expect(()=>new SaveSystem().parse(JSON.stringify(state))).toThrow('not a supported');
  });
  it('loads old missions without provenance as explicit unknowns and can save them again',()=>{
    const {state,terrain,q,target}=fixture();expect(requestSupport(state,'mortarHE',q.id,target,false,terrain).accepted).toBe(true);
    delete state.operation!.supportRequests;delete state.operation!.supportMissions![0].side;delete state.operation!.supportMissions![0].source;
    state.combatRules='combat-23-world2';
    const old=JSON.stringify(state),loaded=new SaveSystem().parse(old);
    expect(JSON.stringify(state)).toBe(old);
    expect(loaded.operation!.supportMissions![0]).toMatchObject({side:'player',source:'LEGACY_UNKNOWN'});
    expect(new SaveSystem().parse(JSON.stringify(loaded)).operation!.supportMissions).toEqual(loaded.operation!.supportMissions);
  });
});

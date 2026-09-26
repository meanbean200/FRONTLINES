import * as THREE from 'three';
import { FIXED_STEP, type BattlefieldState, type DebugFlags, type Vec2 } from '../core/types';
import { createPlayableSandbox } from '../simulation/createBattlefield';
import { BattlefieldSimulation } from '../simulation/BattlefieldSimulation';
import { StrategyCamera } from '../render/StrategyCamera';
import { TerrainRenderer } from '../render/TerrainRenderer';
import { UnitRenderer } from '../render/UnitRenderer';
import { TrenchRenderer } from '../render/TrenchRenderer';
import { DebugRenderer } from '../render/DebugRenderer';
import { SaveSystem } from '../persistence/SaveSystem';
import { BattlefieldUI, type PerfSnapshot } from '../ui/BattlefieldUI';
import { CommandInput, type InteractionMode } from '../input/CommandInput';
import { TacticalOverlay } from '../ui/TacticalOverlay';
import {WorldSession,simulationPort,type SessionKind} from '../sessions/WorldSession';
import {AttractCycle} from '../sessions/AttractCycle';
import {menuPreset} from '../scenarios/MenuCatalogue';
import {instantiateScenario} from '../scenarios/instantiateScenario';
import {blankScenario,type ScenarioPreset} from '../scenarios/ScenarioPreset';
import { GarrisonPanel } from '../ui/GarrisonPanel';
import {TrenchPanel} from '../ui/TrenchPanel';
import {trenchName} from '../ui/TrenchReadout';
import { LivingRenderer } from '../render/LivingRenderer';
import { ReplayPanel } from '../ui/ReplayPanel';
import { OperationUI } from '../ui/OperationUI';
import type {ResolvedBattleSetup} from '../operations/BattleSetup';
import {createOperationalBattle} from '../operations/createOperationalBattle';
import { OperationRenderer } from '../render/OperationRenderer';
import { createOperation } from '../operations/createOperation';
import { factionOf, type GameMode } from '../operations/types';
import { releaseLostContextResources } from '../render/ContextRecovery';
import { restoredViewTarget } from '../render/RestoredView';
import { HudLayout } from '../ui/HudLayout';
import {requestSupport,requestPositionSupport,requestBatterySupport,requestSupportGroup,selectedSupportTeam} from '../combat/SupportWeapons';
import {combatDiagnostics} from '../combat/Diagnostics';
import {CombatAudio} from '../render/CombatAudio';
import {trenchDraft} from '../ui/TrenchDraft';
import {BuildPanel} from '../ui/BuildPanel';
import {chooseEngineer,facilitySiteReason,MIN_TRENCH_LENGTH,SUPPORT_WORKS,type FacilityPreview} from '../construction/ConstructionReadout';
import {artilleryLayout} from '../construction/ArtilleryLayout';
import {trenchAnchorAt,inlineGeometry} from '../construction/PositionDefinitions';
import {localInventory} from '../garrison/Inventory';
import {EnvironmentLighting} from '../render/EnvironmentLighting';
import {VISUAL_QUALITY,type VisualQuality} from '../render/VisualQuality';
import {DeploymentPanel} from '../ui/DeploymentPanel';
import {deploySandbox,deploymentPreview,type DeploymentKind} from '../simulation/SandboxDeployment';
import {HostViewport} from '../render/HostViewport';
import {installViewportDiagnostic} from '../diagnostics/ViewportDiagnostic';
import {AssaultOrders} from '../ui/AssaultOrders';

export class FrontlinesApp {
  readonly selectedSquads = new Set<number>();
  readonly flags: DebugFlags = {
    paths: false,
    destinations: true,
    chunks: false,
    trenchGraph: false,
    trenchSlots: false,
  };
  private state: BattlefieldState;
  private readonly simulation: BattlefieldSimulation;
  private session:WorldSession;
  private attractPreset?:ScenarioPreset;
  private readonly attractCycle=new AttractCycle();
  private attractResets=0;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: StrategyCamera;
  private readonly terrainRenderer: TerrainRenderer;
  private readonly unitRenderer: UnitRenderer;
  private readonly trenchRenderer: TrenchRenderer;
  private readonly debugRenderer: DebugRenderer;
  private readonly saveSystem = new SaveSystem();
  private readonly audio=new CombatAudio(()=>this.state);
  private readonly ui: BattlefieldUI;
  private readonly tactical: TacticalOverlay;
  private readonly lighting:EnvironmentLighting;
  private mode: InteractionMode = 'select';
  private pendingFacility?:{id:number;kind:import('../garrison/types').Facility['kind'];anchor?:Vec2;center?:Vec2;guns:1|4};
  private supportPosition?:number;
  private supportBattery=false;
  private supportPositions:number[]=[];
  private lastTime = performance.now();
  private accumulator = 0;
  private graphicsLost = false;
  private readonly frameSamples: number[] = [];
  private readonly intervalSamples: number[] = [];
  private readonly simSamples: number[] = [];
  private perf: PerfSnapshot = { fps: 0, frameMs: 0, simulationMs: 0, drawCalls: 0, chunks: 0 };
  private frameCosts={simulation:0,terrain:0,units:0,tactical:0,positions:0,webgl:0,hud:0,total:0};
  private pixelRatioLimit=1.25;
  private readonly viewport:HostViewport;
  private readonly garrisonPanel:GarrisonPanel;
  private readonly trenchPanel:TrenchPanel;
  private readonly assaultOrders:AssaultOrders;
  private readonly buildPanel:BuildPanel;
  private readonly deploymentPanel:DeploymentPanel;
  private pendingDeployment:{kind:DeploymentKind;count:number}={kind:'rifle',count:1};
  private readonly input:CommandInput;
  private readonly livingRenderer:LivingRenderer;
  private readonly operationUI:OperationUI;
  private readonly operationRenderer:OperationRenderer;
  private battlePreview?:{state:BattlefieldState;point:Vec2;zoom:number;selected:number[]};

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.state = instantiateScenario(blankScenario());
    this.session=new WorldSession('attract',this.state);
    this.simulation = simulationPort(()=>this.session.simulation);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate=false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.07;
    this.scene.background = new THREE.Color(0xa1b1ad);
    this.scene.fog = new THREE.FogExp2(0xa1b1ad, 0.00021);
    this.camera = new StrategyCamera(canvas, this.simulation.terrain);
    // Frame the interior of the real sector for the opening menu, not its edge.
    // Beginning or loading a battle still focuses that force's actual position.
    this.camera.focus({x:-160,z:100},430);
    this.lighting=new EnvironmentLighting(this.scene,this.renderer);
    this.terrainRenderer = new TerrainRenderer(this.simulation.terrain);
    this.unitRenderer = new UnitRenderer(this.state, this.simulation.terrain);
    this.trenchRenderer = new TrenchRenderer(this.state, this.simulation.terrain);
    this.debugRenderer = new DebugRenderer(this.state, this.simulation.terrain, this.simulation.trenches);
    this.scene.add(this.terrainRenderer.group, this.unitRenderer.group, this.trenchRenderer.group, this.debugRenderer.group);
    this.livingRenderer=new LivingRenderer(()=>this.state,this.simulation.terrain);this.scene.add(this.livingRenderer.group);
    this.operationRenderer=new OperationRenderer(()=>this.state,this.simulation.terrain);this.scene.add(this.operationRenderer.group);
    this.ui = new BattlefieldUI(this.state, this.selectedSquads, this.flags, {
      setSpeed: (speed) => this.simulation.setSpeed(speed),
      hold: () => this.simulation.issueHold([...this.selectedSquads]),
      cancelAssault:()=>{if(this.simulation.commandsLocked)return;this.simulation.cancelPrepared([...this.selectedSquads]);this.ui.notify('Assault cancelled · detachment holds here; return and re-crewing need new orders');},
      occupy: () => this.setMode('defend'),
      trenchMode: () => this.enterTrenchMode(),
      moveMode: () => this.setMode('move'),
      tactical:mode=>this.setMode(mode),pushThrough:()=>this.simulation.setPushThrough([...this.selectedSquads]),
      support:kind=>this.setMode(kind),
      fireGroup:(ids,kind)=>{this.supportPosition=undefined;this.supportBattery=false;this.supportPositions=ids.slice();this.setMode(kind);this.ui.notify(`${ids.length} weapons selected · click one target area · Esc cancels`);},
      buildWeapons:()=>this.buildPanel.open(undefined,true,true),
      staffWeapons:ids=>{if(this.simulation.commandsLocked)return;const results=ids.map(id=>this.simulation.garrisons.autoCrew(id));this.ui.notify(`Crew assignments · ${results.filter(r=>r.accepted).length}/${results.length} accepted${results.some(r=>!r.accepted)?' · '+results.find(r=>!r.accepted)!.reason:''}`);},
      crewWeapon:(squadId,facilityId)=>{if(this.simulation.commandsLocked)return;const result=this.simulation.garrisons.assignWeapon(squadId,facilityId);this.ui.notify(result.reason,result.accepted?'normal':'warn');},
      focusPosition:id=>{const f=this.state.living!.facilities.find(f=>f.id===id);if(f){this.camera.focus(f,70);this.trenchPanel.inspectFacility(id);}},
      manageNetwork:id=>this.trenchPanel.open(id),
      buildingFloor:floor=>{if(document.documentElement.dataset.replay||document.documentElement.dataset.help||this.simulation.commandsLocked)return;for(const q of this.state.squads.filter(q=>this.selectedSquads.has(q.id)&&q.order.building)){const b=this.simulation.terrain.buildings[q.order.building!.id];if(floor&&b.height<=6){this.ui.notify('This building has one usable floor','warn');continue;}q.order.building!.floor=floor;}},
      mute:muted=>{this.audio.muted=muted;},
      resume:()=>{const count=this.simulation.resumeConstruction([...this.selectedSquads]);this.ui.notify(this.simulation.lastResumeReason,count?'normal':'warn');},
      resumePreview:()=>{const rows=[...this.selectedSquads].map(id=>this.simulation.previewResume(id)),job=rows.flatMap(r=>r.candidates)[0];return job?`Resume local trench ${job.trench.id} [R] · ${Math.round(job.point.x)}, ${Math.round(job.point.z)}`:rows[0]?.reason??'Select a formation with tools';},
      quality:level=>this.setQuality(level),
      craterMode: () => this.setMode('crater'),
      save: () => this.save(),
      load: () => this.load(),
      stress: () => this.stress(300),
      select:(ids,add)=>this.selectSquads(ids,add),
      focus:(id)=>this.focusSquad(id),
      setDebug: (key, value) => {
        this.flags[key] = value;
        if (key === 'chunks') this.terrainRenderer.setChunkDebug(value);
      },
    },this.simulation.terrain);
    this.garrisonPanel=new GarrisonPanel(this.simulation,id=>this.trenchPanel.open(id));
    this.assaultOrders=new AssaultOrders(this.simulation,text=>this.ui.notify(text));
    this.buildPanel=new BuildPanel(()=>this.state,{manage:id=>this.trenchPanel.openConstruction(id),place:(id,kind,guns)=>this.beginFacility(id,kind,guns),focus:point=>this.camera.focus(point,100),assign:id=>{
      if(this.simulation.commandsLocked)return;
      const engineer=chooseEngineer(this.state,this.selectedSquads),g=this.state.living!.garrisons.find(g=>g.id===id&&g.faction!=='enemy');
      if(!engineer){this.ui.notify('No fit formation with tools available.','warn');return;}
      const assigned=this.simulation.issueOccupyNearest([engineer.id],g?.trenchId);
      this.ui.notify(assigned?`${engineer.name} assigned · unfinished earthworks are preserved`:'No reachable completed trench with room for the engineers. Finish excavation first.',assigned?'normal':'warn');
      if(assigned)this.selectSquads([engineer.id]);
    }},()=>this.selectedSquads,this.simulation.garrisons.network);
    this.trenchPanel=new TrenchPanel(this.simulation,this.camera,this.selectedSquads,{
      defend:id=>this.occupyTrench(id,false),
      resume:id=>{const ids=[...this.selectedSquads];if(!ids.length){this.ui.notify('Select the formation to add to this worksite.','warn');return;}const ok=this.simulation.resumeConstruction(ids,id);this.ui.notify(ok?`${ok} detail(s) joining · physically arriving helpers increase excavation. Tools are still required at each face.`:this.simulation.lastResumeReason,ok?'normal':'warn');},
      area:id=>{const component=this.simulation.garrisons.network.component(id),g=this.state.living!.garrisons.find(g=>g.faction!=='enemy'&&component!==undefined&&this.simulation.garrisons.network.component(g.trenchId)===component);if(g?.squadIds[0])this.garrisonPanel.showForSquad(g.squadIds[0]);},
      move:()=>this.setMode('person-move'),cancel:()=>{if(this.mode==='person-move')this.setMode('select');},notify:text=>this.ui.notify(text),
      place:(id,kind)=>this.beginFacility(id,kind),person:()=>{this.selectedSquads.clear();},fire:(id,kind,battery)=>{this.supportPositions=[];this.supportPosition=id;this.supportBattery=Boolean(battery);this.setMode(kind);this.ui.notify(battery?'Choose target area · each ready battery gun will fire one round':'Choose target area · this position’s assigned crew will fire.');},
    });
    this.tactical=new TacticalOverlay(()=>this.state,this.selectedSquads,this.camera,this.simulation.terrain,(ids,add)=>this.selectSquads(ids,add),id=>this.trenchPanel.open(id),point=>{this.simulation.issueMove([...this.selectedSquads],point);this.ui.notify('Map move order issued');},{
      inspect:a=>{if(a.key.startsWith('facility:'))this.trenchPanel.inspectFacility(a.id);else if(a.networkId!==undefined)this.trenchPanel.open(a.networkId);else{this.camera.focus(a.point,100);this.trenchPanel.inspectAt(a.point);}},
      prepare:a=>{this.simulation.prepareOrder([...this.selectedSquads],'assault',a.point,a.networkId);this.ui.notify('Review assault · current duties continue until GO');},
      signal:()=>{this.simulation.signalPrepared();this.ui.notify(this.simulation.lastSignalReason);},
    });
    this.deploymentPanel=new DeploymentPanel(()=>this.state,(kind,count)=>{this.pendingDeployment={kind,count};this.setMode('deploy');this.ui.notify(`Place ${count} ${kind==='rifle'?'rifle squad':'engineer team'}${count>1?'s':''} · click clear ground · Esc finishes`);},point=>this.camera.focus(point,90),text=>this.ui.notify(text));
    this.input=new CommandInput({
      supportDangerRadius:()=>this.state.living?.facilities.some(f=>(f.id===this.supportPosition||this.supportPositions.includes(f.id))&&f.artillery)?65:40,
      canvas,
      camera: this.camera,
      getState: () => this.state,
      getMode: () => this.mode,
      setMode: (mode) => this.setMode(mode),
      selectedSquads: this.selectedSquads,
      onSelectionChanged: () => this.trenchPanel.clearPerson(),
      onInspectPerson:id=>this.trenchPanel.inspectPerson(id),
      onInspectTrench:point=>this.trenchPanel.inspectAt(point),
      onPersonMove:point=>this.trenchPanel.movePerson(point),
      previewDeployment:point=>deploymentPreview(this.state,this.simulation.terrain,this.pendingDeployment.kind,this.pendingDeployment.count,point),
      onDeploy:point=>{if(this.simulation.commandsLocked||document.documentElement.dataset.replay)return;const result=deploySandbox(this.state,this.simulation.terrain,this.pendingDeployment.kind,this.pendingDeployment.count,point);if(result.ids.length)this.selectSquads(result.ids);this.ui.notify(result.reason,result.ids.length?'normal':'warn');},
      onMove: (point) => {this.simulation.issueMove([...this.selectedSquads], point);if(this.selectedSquads.size)this.ui.notify(`Move order · ${this.selectedSquads.size} squad${this.selectedSquads.size===1?'':'s'}`);},
      onTactical:(mode,point)=>{this.simulation.issueTactical([...this.selectedSquads],mode,point);this.ui.notify(mode==='assault'?'Review assault personnel and consequences, then confirm GO':`${mode} order issued`);},
      onSupport:(kind,point)=>{const pit=this.supportPosition,squad=selectedSupportTeam(this.state,this.selectedSquads,kind,this.simulation.terrain);if(kind==='smokeGrenades'?squad===undefined:pit===undefined&&!this.supportPositions.length){this.ui.notify(kind==='smokeGrenades'?'Select a squad with smoke grenades':'Open Fire support and choose your weapons','warn');return false;}const request=(risk:boolean)=>kind==='smokeGrenades'?requestSupport(this.state,kind,squad!,point,risk,this.simulation.terrain,'PLAYER'):this.supportPositions.length?requestSupportGroup(this.state,kind,this.supportPositions,point,risk,this.simulation.terrain):this.supportBattery?requestBatterySupport(this.state,kind,pit!,point,risk,this.simulation.terrain):requestPositionSupport(this.state,kind,pit!,point,risk,this.simulation.terrain,'PLAYER');let result=request(false);if(result.warning&&window.confirm(result.reason))result=request(true);this.ui.notify(result.reason,result.accepted?'normal':'warn');return result.accepted;},
      onDrawPath:(points,append,intent)=>{const ok=this.simulation.issueDrawnPath([...this.selectedSquads],points,append);if(ok&&intent)for(const q of this.state.squads.filter(q=>this.selectedSquads.has(q.id)&&factionOf(q)==='player'))q.order.intent=intent;this.ui.notify(ok?`${append?'Extended':'Drawn'} ${intent??'move'} route · ${this.selectedSquads.size} squad(s)`:'Route crosses a building or cannot be reached · adjust the corridor',ok?'normal':'warn');},
      onTrench: (points) => this.buildTrench(points),
      previewTrench:points=>trenchDraft(points,this.simulation.terrain),
      previewFacility:position=>this.facilityPreview(position),
      notify:message=>this.ui.notify(message,'warn'),
      onDefend:points=>{const id=this.simulation.defendArea([...this.selectedSquads],points);this.ui.notify(id?'Area assigned. Choose facing in Position → Overview.':'Draw the frontage within 40m of reachable completed trenches; check capacity.',id?'normal':'warn');if(id)this.garrisonPanel.showForSquad([...this.selectedSquads][0]);},
      onFacility:position=>{
        const pending=this.pendingFacility,preview=this.facilityPreview(position);if(!pending||!preview)return false;
        // Pin the center before collision validation: rotating the layout may
        // clear an obstruction in the initial orientation. Confirm still validates every gun.
        if(pending.kind==='mortar'&&!pending.center&&preview.origin&&Math.hypot(preview.origin.x-preview.position.x,preview.origin.z-preview.position.z)<=40){pending.center={...preview.position};this.ui.notify('Point in the firing direction · the whole battery rotates · click to confirm.');return false;}
        if(!preview.valid||!preview.origin){this.ui.notify(preview.reason,'warn');return false;}
        if(pending.kind==='emplacement'&&!pending.anchor){pending.anchor={...preview.origin};this.ui.notify('Choose the gun facing with the pointer · click to confirm.');return false;}
        const id=this.simulation.requestConstruction({kind:'facility',garrisonId:pending.id,facilityKind:pending.kind,origin:preview.origin,position:preview.position,facing:preview.facing,guns:pending.guns});
        this.ui.notify(id?`${preview.name} queued · ${this.state.simSpeed===0?'paused: press Space to start crews':'carriers deliver materials, then engineers dig and build'}`:'Worksite changed · reopen Build and check the assigned engineers.',id?'normal':'warn');
        if(id){this.trenchPanel.inspectFacility(id);}return Boolean(id);
      },
      onCrater: (point) => {
        this.simulation.createCrater(point,9,2.7);
        this.ui.notify('Impact crater created');
      },
    });
    const host=canvas.closest<HTMLElement>('#app');if(!host)throw new Error('Game host is missing.');
    this.viewport=new HostViewport(host,()=>this.pixelRatioLimit,({width,height,ratio})=>{
      if(this.renderer.getPixelRatio()!==ratio)this.renderer.setPixelRatio(ratio);
      this.renderer.setSize(width,height,false);this.camera.resize(width,height);
    });
    installViewportDiagnostic(host,canvas,this.renderer,this.camera.camera);
    new ReplayPanel(()=>this.state,state=>window.__FRONTLINES__.restoreState(state),(x,z)=>this.camera.focus({x,z},180));
    this.operationUI=new OperationUI(()=>this.state,{home:()=>this.startHome(),leaveHome:()=>this.leaveHome(),start:setup=>this.beginPreview(setup),preview:setup=>this.previewBattle(setup),cancelPreview:()=>this.cancelBattlePreview(),legacyStart:(mode,seed)=>this.startGame(mode,seed),load:()=>this.load(),save:()=>Boolean(this.save()),hasSave:()=>this.saveSystem.hasSave(),loadError:()=>this.saveSystem.lastError,saveNotice:()=>this.saveSystem.legacyNotice(),focus:p=>this.camera.focus(p,520),quality:level=>this.setQuality(level),mute:muted=>{this.audio.muted=muted;}});
    this.startHome();
    new HudLayout(document.querySelector<HTMLElement>('#ui-root')!);
    canvas.addEventListener('webglcontextlost',event=>{
      event.preventDefault();this.graphicsLost=true;this.accumulator=0;this.operationUI.setGraphicsLost(true);
      releaseLostContextResources(this.scene);this.lighting.releaseShadows();
    });
    canvas.addEventListener('webglcontextrestored',()=>{
      this.graphicsLost=false;this.accumulator=0;this.lastTime=performance.now();this.renderer.shadowMap.needsUpdate=true;this.operationUI.setGraphicsLost(false);
    });
    this.installDeveloperAPI();
    this.lastTime=performance.now();
    window.addEventListener('visibilitychange',()=>{this.lastTime=performance.now();this.accumulator=0;});
    requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    this.viewport.checkPixelRatio();
    if(this.graphicsLost||document.hidden){
      // Never let an invisible battlefield advance during a driver/context interruption.
      this.lastTime=now;this.accumulator=0;requestAnimationFrame(this.frame);return;
    }
    const frameStart = performance.now();
    const interval=now-this.lastTime;
    // A load/visibility callback may reset lastTime after this RAF timestamp
    // was queued. Negative time reverses camera damping and clock accumulation.
    const realDt = Number.isFinite(interval)?Math.max(0,Math.min(0.1,interval/1000)):0;
    this.lastTime = now;
    const attract=this.session.kind==='attract',speed=attract?1:this.state.simSpeed,running=attract?Boolean(this.attractPreset):!document.documentElement.dataset.replay&&!document.documentElement.dataset.help&&!document.documentElement.dataset.fieldMap&&!this.operationUI.isOpen&&speed>0;
    this.accumulator=running?Math.min(.5,this.accumulator+realDt*speed):0;
    let simulationDuration = 0;
    try{while (this.accumulator >= FIXED_STEP) {
      const simStart = performance.now();
      this.session.step();
      simulationDuration += performance.now() - simStart;
      this.accumulator -= FIXED_STEP;
      if(this.state.simSpeed!==speed){this.accumulator=0;break;}
      // Never batch five expensive combat ticks into a single camera frame.
      // Every tick stays 50ms; measured advancement exposes hardware overload.
      if(simulationDuration+(performance.now()-simStart)>10)break;
    }}catch(error){if(!attract)throw error;this.failAttract(error);}
    if(attract&&this.attractPreset){
      const op=this.state.operation!,at=this.state.elapsed,contact=Boolean(op.contacts?.player.some(c=>c.visible)||op.contacts?.enemy.some(c=>c.visible));
      if(this.attractCycle.update(at,op.status,contact,op.shots)){this.attractResets++;this.startHome();}
    }
    this.camera.update(realDt);
    this.input.updatePreview();
    let phaseStart=performance.now();
    this.terrainRenderer.update(this.camera.target.x, this.camera.target.z,this.camera.zoomDistance);
    this.frameCosts.terrain=performance.now()-phaseStart;
    const interiors=new Map<number,number>();for(const s of this.state.soldiers)if(this.selectedSquads.has(s.squadId)&&s.building&&this.state.squads.find(q=>q.id===s.squadId)?.faction!=='enemy')interiors.set(s.building.id,Math.min(interiors.get(s.building.id)??1,s.building.floor));
    const inspected=this.trenchPanel.inspectedBuilding;if(inspected!==undefined&&this.state.soldiers.some(s=>s.building?.id===inspected&&this.state.squads.some(q=>q.id===s.squadId&&q.faction!=='enemy')))interiors.set(inspected,this.trenchPanel.inspectedFloor);
    this.terrainRenderer.showInteriors(interiors);
    phaseStart=performance.now();this.unitRenderer.update(this.selectedSquads,realDt,this.camera.zoomDistance);this.frameCosts.units=performance.now()-phaseStart;
    this.trenchRenderer.update(this.camera.zoomDistance);
    this.debugRenderer.update(realDt, this.flags, this.selectedSquads);
    phaseStart=performance.now();this.tactical.update(realDt);this.frameCosts.tactical=performance.now()-phaseStart;
    this.livingRenderer.update(now,this.garrisonPanel.showRoutes||this.deploymentPanel.showRoutes||this.trenchPanel.showRoutes,{...this.camera.target,zoom:this.camera.zoomDistance});this.garrisonPanel.update(now);
    phaseStart=performance.now();this.trenchPanel.update();this.assaultOrders.update();this.frameCosts.positions=performance.now()-phaseStart;
    this.buildPanel.update();this.deploymentPanel.update();
    this.operationRenderer.update();this.operationUI.update(now);
    if(!attract)this.audio.update();
    this.lighting.update(this.state.living?.campaignHours??12,this.camera.target,this.camera.zoomDistance,now);
    phaseStart=performance.now();this.renderer.render(this.scene, this.camera.camera);this.frameCosts.webgl=performance.now()-phaseStart;
    phaseStart=performance.now();this.ui.render(now, this.perf, this.mode);this.frameCosts.hud=performance.now()-phaseStart;
    const frameDuration = performance.now() - frameStart;
    this.frameCosts.total=frameDuration;this.frameCosts.simulation=simulationDuration;
    this.recordPerf(frameDuration, simulationDuration, interval);
    requestAnimationFrame(this.frame);
  };

  private enterTrenchMode(): void {
    if(this.simulation.commandsLocked)return;
    const engineer=chooseEngineer(this.state,this.selectedSquads);
    if(!engineer){this.ui.notify('No fit formation with tools available to dig.','warn');return;}
    this.selectSquads([engineer.id]);
    this.ui.notify(`${engineer.name} · left-drag at least ${MIN_TRENCH_LENGTH} m to dig`);
    this.setMode('trench');
  }

  private buildTrench(points: Vec2[]): number | undefined {
    const engineer=chooseEngineer(this.state,this.selectedSquads);
    if (!engineer) return undefined;
    const id = this.simulation.createTrench(points, engineer.id);
    if (id) this.ui.notify(`${trenchName(this.state,id)} · ${engineer.constructionQueue?.includes(id)?'queued':'planned'} · ${engineer.name}${this.state.simSpeed===0?' · paused: press Space for crews to work':''}`);
    else this.ui.notify('Route blocked by a building or water · draw on open ground','warn');
    return id;
  }

  private beginFacility(id:number,kind:import('../garrison/types').Facility['kind'],guns:1|4=1):void{
    if(this.simulation.commandsLocked)return;
    if(id<0){const g=this.simulation.garrisons.ensureArea(-id);if(!g){this.ui.notify('Choose an excavated friendly trench.','warn');return;}id=g.id;}
    this.setMode('facility');this.pendingFacility={id,kind,guns};
    this.ui.notify(`${SUPPORT_WORKS[kind].name} · move over ground to preview; click to place, Esc to cancel`);
  }
  private facilityPreview(position:Vec2):FacilityPreview|undefined{
    const pending=this.pendingFacility;if(!pending)return;
    const g=this.state.living!.garrisons.find(g=>g.id===pending.id&&g.faction!=='enemy'),work=SUPPORT_WORKS[pending.kind];
    this.simulation.garrisons.network.sync(this.state.trenches);
    const network=this.simulation.garrisons.network,component=g?network.component(g.trenchId):undefined;
    const hit=component===undefined?undefined:network.nearest(pending.anchor??pending.center??position,component),origin=pending.anchor??hit?.point;
    let facing=g?.front??0,site=pending.center??position,segment:Vec2[]|undefined;
    if(pending.kind==='mortar'&&pending.center&&Math.hypot(position.x-site.x,position.z-site.z)>1)facing=Math.atan2(position.x-site.x,position.z-site.z);
    if(pending.kind==='emplacement'&&hit&&origin){const t=this.state.trenches.find(t=>network.edges[hit.edge].trenches.includes(t.id)),anchor=t&&trenchAnchorAt(t,origin);if(t&&anchor){facing=pending.anchor?Math.atan2(position.x-origin.x,position.z-origin.z):g?.front??0;site=inlineGeometry(t,anchor.along,facing).position;segment=[network.nodes[network.edges[hit.edge].a],network.nodes[network.edges[hit.edge].b]];}}
    const materials=g?localInventory(this.state,g).materials:0;
    const sites=pending.guns===4?artilleryLayout(site,facing,network,component,4):undefined;
    const reason=!g||!origin?'Choose an excavated friendly trench.':g.cutoff==='withdraw'?'Network is withdrawing.':pending.kind==='emplacement'&&!pending.anchor&&(hit?.distance??Infinity)>6?'Hover the trench to attach an MG position.':sites?sites.map(s=>s.origin?facilitySiteReason(this.state,g,s.origin,s.position,this.simulation.terrain,this.simulation.navigation,network,'mortar'):'No completed connector').find(Boolean):facilitySiteReason(this.state,g,origin,site,this.simulation.terrain,this.simulation.navigation,network,pending.kind);
    return {name:pending.guns===4?'Four-gun battery':work.name,cost:work.cost*pending.guns,position:site,origin,sites:sites?.map(s=>s.position),materials,kind:pending.kind,facing,segment,valid:!reason,reason:reason??(pending.kind==='emplacement'?(pending.anchor?'Click to confirm facing.':'Click trench, then choose facing.'):pending.kind==='mortar'?(pending.center?'Point firing direction · click to confirm facing.':'Click center, then choose firing direction.'):'Click to place work order.')};
  }

  private occupyTrench(requestedId?:number,showArea=true): void {
    if(document.documentElement.dataset.replay||this.simulation.commandsLocked)return;
    const trenchId = this.simulation.issueOccupyNearest([...this.selectedSquads],requestedId);
    if(trenchId&&showArea)this.garrisonPanel.showForSquad([...this.selectedSquads][0]);
    this.ui.notify(trenchId ? this.simulation.garrisons.lastAssignment.reason+' Hold keeps this assignment; Move / Withdraw leaves it.' : this.simulation.garrisons.lastAssignment.reason, trenchId ? 'normal' : 'warn');
  }
  private setQuality(level:string):void {
    if(!['low','balanced','high'].includes(level))return;
    this.ui.setQuality(level);this.operationUI.setQuality(level);
    const quality=level as VisualQuality;this.pixelRatioLimit=VISUAL_QUALITY[quality].pixelRatio;
    this.lighting.setQuality(quality);this.terrainRenderer.setQuality(quality);this.unitRenderer.setQuality(quality);this.operationRenderer.setQuality(quality);this.renderer.shadowMap.needsUpdate=true;this.resize();
  }

  private setMode(mode: InteractionMode): void {
    if(mode==='crater'&&this.state.operation)return;
    this.mode = mode;
    if(mode!=='facility')this.pendingFacility=undefined;
    if(mode!=='mortarHE'&&mode!=='mortarSmoke'){this.supportPosition=undefined;this.supportPositions=[];}
    this.canvas.dataset.mode = mode;
    document.documentElement.dataset.commandMode=mode;
  }
  private selectSquads(ids:number[],add=false):void {
    if(!add)this.selectedSquads.clear();
    for(const id of ids)if(this.state.squads.some(s=>s.id===id&&factionOf(s)==='player')){if(add&&this.selectedSquads.has(id))this.selectedSquads.delete(id);else this.selectedSquads.add(id);}
  }
  private focusSquad(id?:number):void {
    const squad=this.state.squads.find(s=>id!==undefined?s.id===id:this.selectedSquads.has(s.id));
    if(squad){this.selectSquads([squad.id]);this.camera.focus(squad,120);}else this.camera.focus({x:-1270,z:-1300},490);
  }

  private save(): string {
    if(this.session.kind!=='player'){this.ui.notify('Only a player battle can save a campaign.','warn');return '';}
    if(document.documentElement.dataset.replay){this.ui.notify('Return to the campaign before saving. Replay snapshots do not replace campaign saves.','warn');return '';}
    try {
      const json = this.session.save(state=>this.saveSystem.save(state));
      this.ui.notify(`Battlefield saved · ${(json.length / 1024).toFixed(0)} KB`);return json;
    } catch(error) {this.ui.notify(`Save failed; previous save preserved. ${error instanceof Error?error.message:''}`,'warn');return '';}
  }

  private load(): boolean {
    if(document.documentElement.dataset.replay){this.ui.notify('Return to the campaign before loading.','warn');return false;}
    try {
      const loaded = this.saveSystem.load();
      if (!loaded) {
        this.ui.notify('No saved battlefield found.', 'warn');
        return false;
      }
      this.replaceWorld(loaded);
      const target=restoredViewTarget(loaded);if(target)this.camera.focus(target,300);
      this.operationUI.stateRestored();
      const retired=loaded.living?.garrisons.some(g=>g.policy!=='rules');
      this.ui.notify(loaded.living?.migrationNote??(retired?'Battlefield restored · saved neural coordinator retired; deterministic rules are active.':'Battlefield state restored.'));
      return true;
    } catch (error) {
      this.ui.notify(error instanceof Error ? error.message : 'Save could not be loaded.', 'warn');
      return false;
    }
  }

  private startGame(mode:GameMode,seed=1944,setup?:ResolvedBattleSetup):void {
    const fresh=setup?createOperationalBattle(setup.operation,setup.seed,setup,true):mode==='sandbox'?createPlayableSandbox(seed):createOperation(mode,seed);
    this.replaceWorld(fresh);
    if(mode==='sandbox')this.simulation.issueOccupyNearest([fresh.squads[0].id,fresh.squads[1].id,fresh.squads.find(s=>s.kind==='engineer')!.id],fresh.trenches[0].id);
    const start=mode==='campaign'?fresh.operation?.objectives[0]:restoredViewTarget(fresh);if(start)this.camera.focus(start,mode==='sandbox'||mode==='campaign'?360:520);
    this.selectSquads([]);this.setMode('select');
    this.ui.notify(mode==='sandbox'?'Living battlefield · no enemies or timer':'Select squads, right-drag a route. Rifles engage visible enemies automatically.');
  }
  private previewBattle(setup:ResolvedBattleSetup):void {
    this.cancelBattlePreview();
    // Construct first: a failed preparation must not discard the current world.
    const fresh=createOperationalBattle(setup.operation,setup.seed,setup,true);
    this.battlePreview={state:this.state,point:{x:this.camera.target.x,z:this.camera.target.z},zoom:this.camera.zoomDistance,selected:[...this.selectedSquads]};
    this.replaceWorld(fresh);
    const target=restoredViewTarget(fresh);if(target)this.camera.focus(target,820);
  }
  private cancelBattlePreview():void {
    const held=this.battlePreview;if(!held)return;this.battlePreview=undefined;
    this.replaceWorld(held.state);this.camera.focus(held.point,held.zoom);this.selectSquads(held.selected);
  }
  private beginPreview(setup:ResolvedBattleSetup):void {
    if(!this.battlePreview){this.startGame(setup.operation,setup.seed,setup);return;}
    this.battlePreview=undefined;this.selectSquads([]);this.setMode('select');
    const target=restoredViewTarget(this.state);if(target)this.camera.focus(target,520);
    this.ui.notify('Select a formation to issue orders. M opens the operational map.');
  }
  private startHome():void {
    this.battlePreview=undefined;this.attractCycle.reset();
    try{const preset=menuPreset(),fresh=instantiateScenario(preset);this.replaceWorld(fresh,'attract');this.attractPreset=preset;this.camera.restore(preset.camera);this.operationUI.setAttractStatus(`${preset.name} · ${fresh.soldiers.length} personnel · LIVE / SOUND MUTED`);}
    catch(error){this.failAttract(error);}
  }
  private failAttract(error:unknown):void{console.error('Title battle unavailable',error);this.attractPreset=undefined;this.replaceWorld(instantiateScenario(blankScenario()),'attract');this.camera.restore(blankScenario().camera);this.operationUI.setAttractStatus('Title battle unavailable · '+(error instanceof Error?error.message:String(error)));}
  private leaveHome():void{if(this.session.kind==='attract'){this.attractPreset=undefined;this.replaceWorld(instantiateScenario(blankScenario()),'player');}}
  private replaceWorld(loaded:BattlefieldState,kind:SessionKind='player'):void {
    // Loading/new worlds invalidate any unfinished pointer or keyboard gesture.
    window.dispatchEvent(new Event('frontlines-menu'));this.setMode('select');
    this.session.dispose();this.session=new WorldSession(kind,loaded);this.state=loaded;this.unitRenderer.spectator=this.livingRenderer.spectator=kind==='attract';this.unitRenderer.replaceState(loaded);this.trenchRenderer.replaceState(loaded);this.debugRenderer.replaceState(loaded);this.ui.replaceState(loaded);this.terrainRenderer.reset();this.renderer.shadowMap.needsUpdate=true;this.selectedSquads.clear();this.accumulator=0;this.lastTime=performance.now();
  }

  private stress(target: number): number {
    const total = this.simulation.spawnStressSoldiers(target);
    this.ui.notify(`Stress force ready: ${total} active soldiers`);
    return total;
  }

  private recordPerf(frameMs: number, simulationMs: number, intervalMs: number): void {
    this.frameSamples.push(frameMs);
    this.intervalSamples.push(intervalMs);
    this.simSamples.push(simulationMs);
    if (this.frameSamples.length > 120) this.frameSamples.shift();
    if (this.intervalSamples.length > 120) this.intervalSamples.shift();
    if (this.simSamples.length > 120) this.simSamples.shift();
    const averageFrame = average(this.frameSamples);
    this.perf = {
      fps: average(this.intervalSamples) > 0 ? 1000 / average(this.intervalSamples) : 0,
      frameMs: averageFrame,
      simulationMs: average(this.simSamples),
      drawCalls: this.renderer.info.render.calls,
      chunks: this.terrainRenderer.visibleChunkCount,
      p95Ms:[...this.intervalSamples].sort((a,b)=>a-b)[Math.floor(this.intervalSamples.length*.95)]??0,
    };
  }

  private readonly resize = (): void => {
    this.viewport.sync();
  };

  private installDeveloperAPI(): void {
    window.__FRONTLINES__ = {
      getSessionStats:()=>({kind:this.session.kind,generation:this.session.generation,resets:this.attractResets,...WorldSession.ownership,gpu:{...this.renderer.info.memory},entities:this.state.soldiers.length,renderHosts:1,terrainWorkers:1}),
      ready: true,
      getSummary: () => ({
        soldiers: this.state.soldiers.length,
        squads: this.state.squads.length,
        trenches: structuredClone(this.state.trenches),
        craters: structuredClone(this.state.craters),
        elapsed: this.state.elapsed,
        selected: [...this.selectedSquads],
        perf: { ...this.perf },
      }),
      selectSquads: (ids) => {
        this.selectSquads(ids);
      },
      issueMove: (x, z) => this.simulation.issueMove([...this.selectedSquads], { x, z }),
      issueDrawnPath:(points,append=false)=>this.simulation.issueDrawnPath([...this.selectedSquads],points,append),
      hold:()=>this.simulation.issueHold([...this.selectedSquads]),
      resumeConstruction:()=>this.simulation.resumeConstruction([...this.selectedSquads]),
      occupyTrench:id=>this.simulation.issueOccupyNearest([...this.selectedSquads],id),
      setQuality:level=>this.setQuality(level),
      createTrench: (points, engineerSquadId) => this.simulation.createTrench(points, engineerSquadId),
      occupyNearestTrench: () => this.simulation.issueOccupyNearest([...this.selectedSquads]),
      createCrater: (x, z, radius = 24, depth = 5) => this.simulation.createCrater({ x, z }, radius, depth),
      setSpeed: (speed) => this.simulation.setSpeed(speed),
      save: () => this.save(),
      load: () => this.load(),
      spawnStressTest: (count = 300) => this.stress(count),
      focus: (x, z, distance = 450) => this.camera.focus({ x, z }, distance),
      getPerf: () => ({ ...this.perf }),
      getFrameCosts:()=>({...this.frameCosts}),
      getSimulationCosts:()=>({...this.simulation.stepCosts}),
      getVisualStats:()=>({triangles:this.renderer.info.render.triangles,drawCalls:this.renderer.info.render.calls,particles:this.operationRenderer.particleCount,submittedSoldiers:this.unitRenderer.visibleCount,residentTrees:this.terrainRenderer.residentTreeCount,visibleTrees:this.terrainRenderer.visibleTrees(this.camera.camera),cameraTarget:{x:this.camera.target.x,z:this.camera.target.z},zoomDistance:this.camera.zoomDistance,...this.terrainRenderer.stats(this.camera.camera)}),
      getState: () => structuredClone(this.state),
      getCombatDiagnostics:()=>combatDiagnostics(this.state,this.simulation.terrain),
      getPolicyPerf:()=>({inferenceMs:0,coordinator:'deterministic'}),
      setReadiness:(id,value)=>this.simulation.garrisons.setReadiness(id,value),
      resolveEmergency:(id,choice)=>this.simulation.garrisons.resolveEmergency(id,choice),
      advance:seconds=>{for(let i=0;i<Math.min(7200,Math.max(0,seconds))/FIXED_STEP;i++)this.simulation.step(FIXED_STEP);},
      restoreState:value=>{const loaded=this.saveSystem.parse(JSON.stringify(value));this.replaceWorld(loaded);},
      projectWorld:(x,z,height=.2)=>this.camera.project({x,z},height),
      terrainProbe:(x,z)=>{
        const ray=new THREE.Raycaster(new THREE.Vector3(x,1000,z),new THREE.Vector3(0,-1,0));
        const ground=this.terrainRenderer.group.children.filter(o=>o instanceof THREE.Mesh);
        const hit=ray.intersectObjects(ground,false)[0];
        return {base:this.simulation.terrain.baseHeightAt(x,z),sampled:this.simulation.terrain.heightAt(x,z),rendered:hit?.point.y,cover:this.simulation.terrain.coverAt(x,z)};
      },
    };
  }
}

const average = (values: number[]): number => values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

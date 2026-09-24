export const COMPACT_HUD = '(max-width: 1150px), (max-height: 720px)';
export type HudPanel = 'force' | 'selection' | 'map';

export function hudInsets(sessionBottom:number,objectiveBottom:number,dockHeight:number,selectionHeight:number,hintHeight=0){
  return {railTop:Math.ceil(Math.max(sessionBottom,objectiveBottom)+8),dockHeight:Math.ceil(dockHeight),selectionHeight:Math.ceil(selectionHeight),hintHeight:Math.ceil(hintHeight)};
}

/** Screen-only state. Drawers and measured spacing never enter campaign saves. */
export class HudLayout {
  private readonly compact=window.matchMedia(COMPACT_HUD);
  private readonly garrison:HTMLDetailsElement;
  private scheduled=false;
  constructor(private readonly root:HTMLElement){
    this.garrison=root.querySelector<HTMLDetailsElement>('.garrison-panel')!;
    const support=root.querySelector<HTMLDetailsElement>('.support-controls');
    support?.addEventListener('toggle',()=>{if(support.open){this.garrison.open=false;if(this.compact.matches)this.setPanel(undefined);}});
    root.querySelectorAll<HTMLButtonElement>('[data-hud-panel]').forEach(button=>button.addEventListener('click',()=>{
      const panel=button.dataset.hudPanel as HudPanel;
      this.setPanel(root.dataset.hudPanel===panel?undefined:panel);
      this.garrison.open=false;
      if(support)support.open=false;
    }));
    this.garrison.addEventListener('toggle',()=>{if(this.garrison.open){if(support)support.open=false;if(this.compact.matches)this.setPanel(undefined);}});
    // Retire drawer state when entering the spacious layout; do not close a
    // player's open trench inspector merely because the window was resized.
    this.compact.addEventListener('change',()=>{this.setPanel(undefined);this.schedule();});
    window.addEventListener('frontlines-menu',()=>this.setPanel(undefined));
    const observer=new ResizeObserver(()=>this.schedule());
    for(const selector of ['.session-controls','.operation-hud','.command-dock','.selection-card','.mode-label']){
      const element=root.querySelector(selector);if(element)observer.observe(element);
    }
    observer.observe(root);this.schedule();
  }
  private setPanel(panel?:HudPanel):void {
    if(panel)this.root.dataset.hudPanel=panel;else delete this.root.dataset.hudPanel;
    for(const button of this.root.querySelectorAll<HTMLButtonElement>('[data-hud-panel]')){
      const open=button.dataset.hudPanel===panel;button.setAttribute('aria-expanded',String(open));button.classList.toggle('active',open);
    }
  }
  private schedule():void {
    if(this.scheduled)return;this.scheduled=true;
    requestAnimationFrame(()=>{this.scheduled=false;this.measure();});
  }
  private measure():void {
    const top=this.root.getBoundingClientRect().top;
    const session=this.root.querySelector('.session-controls')!.getBoundingClientRect();
    const objectives=this.root.querySelector<HTMLElement>('.operation-hud')!;
    const insets=hudInsets(session.bottom-top,objectives.hidden?0:objectives.getBoundingClientRect().bottom-top,
      this.root.querySelector('.command-dock')!.getBoundingClientRect().height,this.root.querySelector('.selection-card')!.getBoundingClientRect().height,this.root.querySelector('.mode-label')!.getBoundingClientRect().height);
    for(const [name,value] of Object.entries({'--hud-rail-top':insets.railTop,'--hud-dock-height':insets.dockHeight,'--hud-selection-height':insets.selectionHeight,'--hud-hint-height':insets.hintHeight})){
      const next=`${value}px`;if(this.root.style.getPropertyValue(name)!==next){this.root.style.setProperty(name,next);document.documentElement.style.setProperty(name,next);}
    }
  }
}

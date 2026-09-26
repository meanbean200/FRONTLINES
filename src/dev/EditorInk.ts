import type {ScenarioEntity,ScenarioPreset} from '../scenarios/ScenarioPreset';
import {productionTrenchPath} from '../construction/TrenchSystem';
import type {StrategyCamera} from '../render/StrategyCamera';
import type {Vec2} from '../core/types';
const ns='http://www.w3.org/2000/svg';
const esc=(s:string)=>s.replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]!));

/** Keyed marks. Idle frames write nothing; camera motion changes only projected marks. */
export class EditorInk {
 readonly element=document.createElementNS(ns,'svg');
 readonly stats={passes:0,entityBuilds:0,attributeWrites:0,removed:0,lastUpdateMs:0,totalUpdateMs:0,maxUpdateMs:0};
 private marks=new Map<string,SVGGElement>();
 private content=new WeakMap<SVGGElement,string>();
 private key='';
 private paths=new WeakMap<object,Vec2[]>();
 invalid=new Set<string>();
 constructor(){this.element.classList.add('editor-ink');}
 private attr(el:Element,key:string,value:string){if(el.getAttribute(key)!==value){el.setAttribute(key,value);this.stats.attributeWrites++;}}
 draw(p:ScenarioPreset|undefined,selected:string|undefined,preview:ScenarioEntity|undefined,draft:Vec2[],camera:StrategyCamera,rect:DOMRect):void{
  const key=[camera.camera.matrixWorld.elements.map(n=>n.toFixed(5)).join(','),rect.left,rect.top,rect.width,rect.height,selected,[...this.invalid].join(','),JSON.stringify(preview),JSON.stringify(draft)].join('|');
  if(this.preset===p&&this.key===key)return;const started=performance.now();this.preset=p;this.key=key;this.stats.passes++;
  this.attr(this.element,'viewBox',`0 0 ${rect.width} ${rect.height}`);
  const point=(v:Vec2)=>{const s=camera.project(v,.5);return `${(s.x-rect.left).toFixed(1)},${(s.y-rect.top).toFixed(1)}`;};
  const keep=new Set<string>();
  const put=(id:string,markup:string,transform='')=>{
   keep.add(id);let mark=this.marks.get(id);if(!mark){mark=document.createElementNS(ns,'g');mark.dataset.entity=id;this.marks.set(id,mark);this.element.append(mark);}
   if(this.content.get(mark)!==markup){mark.innerHTML=markup;this.content.set(mark,markup);this.stats.entityBuilds++;}
   this.attr(mark,'transform',transform);return mark;
  };
  const entities=p?.entities.map(e=>preview?.id===e.id?preview:e)??[];
  const current=entities.find(e=>e.id===selected);
  if(current&&current.type!=='trench'){
   const ids=['targetId','trenchId','crewId'].flatMap(k=>k in current?[String((current as unknown as Record<string,unknown>)[k])]:[]);
   put('$links',ids.flatMap(id=>{const e=entities.find(e=>e.id===id);if(!e)return[];const to=e.type==='trench'?e.points[Math.floor(e.points.length/2)]:e;return `<polyline points="${point(current)} ${point(to)}" fill="none" stroke="#dfcb8d" stroke-width="2" stroke-dasharray="5 5"/>`;}).join(''));
  }
  for(const e of entities){
   const active=e.id===selected,color=this.invalid.has(e.id)?'#e17c62':e.type==='facility'?'#c8b984':('side'in e?e.side:e.type==='objective'?e.owner:'neutral')==='enemy'?'#cb8c7c':'#a3c0c5';
   if(e.type==='trench'){
    let path=this.paths.get(e);if(!path){path=productionTrenchPath(e.points);this.paths.set(e,path);}
    put(e.id,`<polyline points="${path.map(point).join(' ')}" fill="none" stroke="${active?'#f1dfaa':color}" stroke-width="${active?3:1.5}" ${e.completed?'':'stroke-dasharray="5 5"'}/>${active?e.points.map((v,i)=>{const [x,y]=point(v).split(',');return `<circle cx="${x}" cy="${y}" r="6" fill="#16211c" stroke="#efdaa0"/><text x="${x}" y="${Number(y)-10}" fill="#efdaa0">${i+1}</text>`;}).join(''):''}`);
   }else{
    const s=camera.project(e,1);if(!s.visible)continue;
    const symbol=e.type==='formation'?({rifle:'×',engineer:'⚒',machinegun:'MG',mortar:'M',medical:'+'}[e.kind]):e.type==='objective'?'⚑':e.type==='stock'?'▣':e.type==='staging'?'R':e.weapon==='field-gun'?'FG':e.weapon==='crew-mg'?'MG':e.weapon==='mortar'?'M':'⌂';
    const label=active?esc(e.name)+(e.type==='formation'?` · ${e.count}`:''):e.type==='objective'||e.type==='staging'?esc(e.name):'';
    put(e.id,`<rect x="-16" y="-13" width="32" height="26" fill="#14201e" stroke="${active?'#f0dfa6':color}" stroke-width="${active?3:1}"/><text text-anchor="middle" y="5" fill="${color}">${symbol}</text>${label?`<text x="21" y="5" fill="#e9e7d8" paint-order="stroke" stroke="#17211c" stroke-width="3">${label}</text>`:''}`,`translate(${(s.x-rect.left).toFixed(1)},${(s.y-rect.top).toFixed(1)})`);
   }
  }
  if(draft.length)put('$draft',`<polyline points="${draft.map(point).join(' ')}" fill="none" stroke="#ead6a0" stroke-width="3" stroke-dasharray="7 4"/>`);
  for(const [id,mark] of this.marks)if(!keep.has(id)){mark.remove();this.marks.delete(id);this.stats.removed++;}
  const top=this.marks.get(selected??'');if(top&&this.element.lastElementChild!==top)this.element.append(top);
  this.stats.lastUpdateMs=performance.now()-started;this.stats.totalUpdateMs+=this.stats.lastUpdateMs;this.stats.maxUpdateMs=Math.max(this.stats.maxUpdateMs,this.stats.lastUpdateMs);
 }
 private preset?:ScenarioPreset;
}

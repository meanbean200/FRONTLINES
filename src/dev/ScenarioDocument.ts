import {blankScenario,validateScenario,type ScenarioPreset} from '../scenarios/ScenarioPreset';
export class ScenarioDocument {
 preset:ScenarioPreset=blankScenario();
 private past:ScenarioPreset[]=[];
 private future:ScenarioPreset[]=[];
 private saved=JSON.stringify(this.preset);
 get dirty():boolean{return JSON.stringify(this.preset)!==this.saved;}
 get canUndo():boolean{return this.past.length>0;}
 get canRedo():boolean{return this.future.length>0;}
 change(edit:(p:ScenarioPreset)=>void):void{const next=structuredClone(this.preset);edit(next);validateScenario(next);if(JSON.stringify(next)===JSON.stringify(this.preset))return;this.past.push(structuredClone(this.preset));if(this.past.length>80)this.past.shift();this.future=[];this.preset=next;}
 undo():void{const p=this.past.pop();if(p){this.future.push(this.preset);this.preset=p;}}
 redo():void{const p=this.future.pop();if(p){this.past.push(this.preset);this.preset=p;}}
 load(p:unknown):void{validateScenario(p);this.preset=structuredClone(p);this.past=[];this.future=[];this.saved=JSON.stringify(p);}
 markSaved(snapshot:string):void{this.saved=snapshot;}
 duplicate(id:string):void{this.change(p=>{p.id=id;p.name+=' copy';});}
}

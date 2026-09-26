/** Simulation-time reset policy. The caller replaces the entire world, never repairs it. */
export class AttractCycle {
 private contacted=false;
 private lastActivity=0;
 private shots=0;
 reset():void{this.contacted=false;this.lastActivity=0;this.shots=0;}
 update(elapsed:number,status:string,hasContact:boolean,shots:number):'resolved'|'duration'|'quiet'|undefined{
  if(hasContact&&!this.contacted){this.contacted=true;this.lastActivity=elapsed;}
  if(shots>this.shots){this.shots=shots;this.lastActivity=elapsed;}
  if(status!=='active')return 'resolved';
  if(elapsed>=240)return 'duration';
  if(this.contacted&&elapsed-this.lastActivity>=60)return 'quiet';
 }
}

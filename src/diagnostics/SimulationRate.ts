/** Honest wall-time throughput, separate from requested fixed-step speed. */
export class SimulationRate {
  private identity?:object;
  private requested=-1;
  private wall=0;
  private simulation=0;
  value?:number;
  sample(identity:object,wallMs:number,simulationSeconds:number,requested:number):number|undefined{
    if(identity!==this.identity||requested!==this.requested||simulationSeconds<this.simulation||requested<=0){
      this.identity=identity;this.requested=requested;this.wall=wallMs;this.simulation=simulationSeconds;this.value=undefined;return;
    }
    if(wallMs-this.wall>=2000){this.value=(simulationSeconds-this.simulation)/((wallMs-this.wall)/1000);this.wall=wallMs;this.simulation=simulationSeconds;}
    return this.value;
  }
}

/** Optional bounded diagnostics; never serialized or consulted by game rules. */
export class TickProfile {
  enabled=false;
  private rows:Record<string,number>[]=[];
  private cursor=0;
  private sequence=0;
  setEnabled(enabled:boolean):void{this.enabled=enabled;this.rows=[];this.cursor=0;this.sequence=0;}
  record(at:number,costs:Record<string,number>):void{
    if(!this.enabled)return;
    const row={sequence:++this.sequence,at,...costs};
    if(this.rows.length<4096)this.rows.push(row);else{this.rows[this.cursor]=row;this.cursor=(this.cursor+1)%4096;}
  }
  read(after=0){return this.rows.filter(row=>row.sequence>after).sort((a,b)=>a.sequence-b.sequence).map(row=>({...row}));}
}

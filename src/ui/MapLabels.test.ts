import {describe,it,expect} from 'vitest';
import {placeMapLabels,type MapLabel} from './MapLabels';
const label=(text:string,priority=1):MapLabel=>({text,priority,x:100,y:100,width:80,height:15,font:'14px sans-serif',color:'#fff'});
describe('map label disclosure',()=>{
  it('keeps important labels and moves competing labels near their anchors',()=>{
    const result=placeMapLabels([label('truck'),label('objective',3)],240,200);
    expect(result.map(r=>r.text)).toEqual(['objective','truck']);expect(result[0].top+result[0].height+4<=result[1].top||result[1].top+result[1].height+4<=result[0].top).toBe(true);
  });
  it('does not draw text beyond map bounds or hide it under other text',()=>{
    const result=placeMapLabels(Array.from({length:20},(_,i)=>label(String(i))),200,200);
    expect(result.length).toBeLessThan(20);for(const r of result){expect(r.left).toBeGreaterThanOrEqual(4);expect(r.top).toBeGreaterThanOrEqual(4);expect(r.top+r.height).toBeLessThanOrEqual(196);}
  });
  it('does not mutate observations and produces a stable arrangement',()=>{
    const input=[label('one'),label('two')],before=JSON.stringify(input);
    expect(placeMapLabels(input,300,200)).toEqual(placeMapLabels(input,300,200));expect(JSON.stringify(input)).toBe(before);
  });
});

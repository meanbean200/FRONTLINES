import {describe,it,expect} from 'vitest';
import {formationLabels} from './FormationLabels';

describe('selectable formation labels',()=>{
  it('separates the three overlapping Open Front formations without dropping labels',()=>{
    const anchors=[{id:1,x:451,y:408},{id:2,x:443,y:407},{id:3,x:422,y:406}],placed=formationLabels(anchors,1654,910);
    expect(placed).toHaveLength(3);expect(placed[0]).toEqual(anchors[0]);
    for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++)expect(Math.abs(placed[i].x-placed[j].x)>=64||Math.abs(placed[i].y-placed[j].y)>=56).toBe(true);
  });
  it('tracks camera motion immediately and packs crowded symbols inside a narrow viewport',()=>{
    const anchors=Array.from({length:12},(_,id)=>({id,x:190,y:290})),placed=formationLabels(anchors,390,844);
    expect(new Set(placed.map(p=>`${p.x},${p.y}`)).size).toBe(12);
    for(const p of placed){expect(p.x).toBeGreaterThanOrEqual(34);expect(p.x).toBeLessThanOrEqual(356);expect(p.y).toBeGreaterThanOrEqual(50);expect(p.y).toBeLessThanOrEqual(822);}
    const moved=formationLabels(anchors.map(p=>({...p,x:p.x+2,y:p.y+3})),390,844);
    expect(moved).toEqual(placed.map(p=>({...p,x:p.x+2,y:p.y+3})));
  });
  it('keeps formation clicks clear of the secured town control',()=>{
    const placed=formationLabels([{id:1,x:879,y:407},{id:2,x:882,y:418}],1654,910,[{x:880,y:425,width:300,height:48}]);
    for(const p of placed)expect(p.x+34<=730||p.x-34>=1030||p.y+18<=377||p.y-44>=425).toBe(true);
  });
});

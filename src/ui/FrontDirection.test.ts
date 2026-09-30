import {describe,it,expect} from 'vitest';
import {FRONT_DIRECTIONS,frontDirection,sameFacing} from './FrontDirection';

describe('world-facing trench controls',()=>{
  it.each(FRONT_DIRECTIONS)('recognizes $label across equivalent saved angles',({id,label,angle})=>{
    expect(frontDirection([angle,angle+Math.PI*2,angle-Math.PI*2])).toEqual({label,selected:id});
  });
  it('does not silently show South for a positive west or custom heading',()=>{
    expect(frontDirection([Math.PI*1.5])).toEqual({label:'West',selected:'west'});
    expect(frontDirection([Math.PI/4])).toEqual({label:'Custom · 135°'});
    expect(frontDirection([Math.PI*1.75])).toEqual({label:'Custom · 225°'});
  });
  it('shows mixed connected fronts without a falsely selected direction',()=>{
    expect(frontDirection([0,Math.PI/2])).toEqual({label:'Mixed'});
    expect(frontDirection([])).toEqual({label:'Unassigned'});
  });
  it('tolerates harmless angle rounding, not different or invalid headings',()=>{
    expect(sameFacing(0,Math.PI*2+.00001)).toBe(true);
    expect(sameFacing(0,.01)).toBe(false);
    expect(sameFacing(NaN,0)).toBe(false);
    expect(sameFacing(Infinity,0)).toBe(false);
  });
});

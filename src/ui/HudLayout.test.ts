import {describe,it,expect} from 'vitest';
import {hudInsets} from './HudLayout';

describe('content-sized HUD spacing',()=>{
  it('places the drawer rail below wrapped objective text, not a fixed desktop offset',()=>{
    expect(hudInsets(82,209.25,53,0)).toEqual({railTop:218,dockHeight:53,selectionHeight:0,hintHeight:0});
  });
  it('uses the session controls when sandbox has no objective HUD',()=>{
    expect(hudInsets(82.1,0,61.2,155)).toEqual({railTop:91,dockHeight:62,selectionHeight:155,hintHeight:0});
  });
  it('reserves actual taller command and selection content',()=>{
    const a=hudInsets(50,130,53,100),b=hudInsets(50,130,92,175);
    expect(b.railTop).toBe(a.railTop);expect(b.dockHeight).toBe(92);expect(b.selectionHeight).toBe(175);
  });
  it('reserves wrapped placement instructions before positioning a toast',()=>{
    expect(hudInsets(50,130,53,100,44.2).hintHeight).toBe(45);
  });
});

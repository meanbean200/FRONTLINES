async(page)=>({scope:'Read-only projection diagnostics',data:await page.evaluate(()=>{
  const state=window.__FRONTLINES__.getState(),q=state.squads.find(q=>q.kind==='engineer'&&q.faction!=='enemy'),m=document.querySelector('[aria-label="Select Pioneer team"]');
  return {squad:q,projection:window.__FRONTLINES__.projectWorld(q.x,q.z,3),offset:window.__FRONTLINES__.projectWorld(q.x-100,q.z+40,.3),marker:m?.style.transform,markerRect:m?.getBoundingClientRect().toJSON(),view:[innerWidth,innerHeight],canvas:document.querySelector('#battlefield').getBoundingClientRect().toJSON(),scale:document.querySelector('.tactical-overlay').dataset.scale,selected:window.__FRONTLINES__.getSummary().selected,mode:document.querySelector('#battlefield').dataset.mode};
})})

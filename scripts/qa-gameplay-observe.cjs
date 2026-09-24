async(page) => {
  await page.evaluate(() => {
    if (window.__FRONTLINES_AUDIT?.timer) clearInterval(window.__FRONTLINES_AUDIT.timer);
    const initial=window.__FRONTLINES__.getState();
    const audit=window.__FRONTLINES_AUDIT={started:Date.now(),setup:initial.operation?.setup,events:[],samples:[],first:{},lastOrders:{},timer:0};
    audit.timer=setInterval(() => {
      const s=window.__FRONTLINES__.getState(),op=s.operation;
      if(!op||document.documentElement.dataset.menu||document.documentElement.dataset.fieldMap)return;
      const friendly=new Set(s.squads.filter(q=>q.faction!=='enemy').map(q=>q.id));
      const people=s.soldiers.filter(p=>friendly.has(p.squadId));
      const row={wall:(Date.now()-audit.started)/1000,sim:s.elapsed,shots:op.shots,hits:op.hits,
        contacts:op.contacts?.player?.filter(c=>c.visible).length??0,
        casualties:people.filter(p=>p.needs?.life!=='active').length,
        suppression:people.filter(p=>p.suppression>10).length,
        moving:s.squads.filter(q=>friendly.has(q.id)&&q.order.type==='move').length,
        missions:op.supportMissions?.filter(m=>friendly.has(m.squadId)).map(m=>({id:m.id,kind:m.kind,stage:m.stage,reason:m.reason})),
        progress:op.runtime?.progress,phase:op.runtime?.phase};
      for(const [key,condition] of Object.entries({contact:row.contacts>0,shot:row.shots>0,combat:row.shots>=5&&(row.hits>0||row.suppression>0),casualty:row.casualties>0}))if(condition&&!audit.first[key])audit.first[key]={wall:row.wall,sim:row.sim};
      for(const q of s.squads.filter(q=>friendly.has(q.id))){
        const key=JSON.stringify([q.order,q.movementState,q.orderNote]);
        if(key!==audit.lastOrders[q.id]){audit.events.push({sim:s.elapsed,wall:row.wall,id:q.id,name:q.name,order:q.order,movement:q.movementState,note:q.orderNote});audit.lastOrders[q.id]=key;}
      }
      audit.samples.push(row);
    },500);
  });
  await page.locator('#begin-operation').click();
  await page.locator('[data-speed="0"]').click();
  const path='output/playwright/gameplay-rescue/baseline-begin-'+Date.now()+'.png';
  await page.screenshot({path,animations:'disabled'});
  return {path,setup:await page.evaluate(()=>window.__FRONTLINES__.getState().operation.setup)};
}

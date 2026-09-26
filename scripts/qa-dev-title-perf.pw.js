async page=>{
 const result={samples:[]},inspect=()=>page.evaluate(()=>window.__FRONTLINES_DEV__.inspect()),source=JSON.stringify((await inspect()).source);
 const start=()=>page.evaluate(()=>{const before=window.__FRONTLINES_DEV__.inspect().metrics;let mutations=0,frames=[],last=performance.now(),alive=true;const observer=new MutationObserver(v=>mutations+=v.length);observer.observe(document.querySelector('.editor-ink'),{childList:true,subtree:true,attributes:true});const tick=now=>{frames.push(now-last);last=now;if(alive)requestAnimationFrame(tick);};requestAnimationFrame(tick);window.__REAL_TITLE_SAMPLE__={end:()=>{alive=false;observer.disconnect();frames.sort((a,b)=>a-b);return {before,after:window.__FRONTLINES_DEV__.inspect().metrics,mutations,p95:frames[Math.floor(frames.length*.95)],max:Math.max(...frames)};}};});
 const end=()=>page.evaluate(()=>window.__REAL_TITLE_SAMPLE__.end());
 await page.locator('#opening-camera').click();await page.waitForTimeout(1000);
 await start();await page.waitForTimeout(5000);result.samples.push({kind:'idle',...await end()});
 await start();await page.keyboard.down('d');await page.waitForTimeout(750);await page.keyboard.up('d');await page.waitForTimeout(4250);result.samples.push({kind:'pan',...await end()});await page.locator('#opening-camera').click();
 for(const [kind,id,selector] of [['formation-drag','formation-10','rect'],['node-drag','trench-2','circle']]){
  if(await page.locator('#deselect').count())await page.locator('#deselect').click();await page.locator(`[data-select="${id}"]`).click();
  const b=await page.locator(`[data-entity="${id}"] ${selector}`).first().boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
  await start();await page.mouse.move(x,y);await page.mouse.down();for(let n=0;n<60;n++){await page.mouse.move(x+n*.35,y+Math.sin(n/10)*10);await page.waitForTimeout(83);}const during=await inspect();await page.mouse.up();
  result.samples.push({kind,...await end(),previewMoved:!!during.preview,sourceUnchangedDuring:JSON.stringify(during.source)===source});await page.locator('#undo').click();
 }
 result.sourceUnchanged=JSON.stringify((await inspect()).source)===source;result.entities=(await inspect()).source.entities.length;await page.evaluate(r=>window.__TITLE_PERF_QA__=r,result);
}

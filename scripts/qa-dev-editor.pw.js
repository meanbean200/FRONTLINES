// Run with playwright-cli run-code --filename=scripts/qa-dev-editor.pw.js on a fresh DEV document.
async page => {
 const result={samples:[],errors:[]};
 await page.setViewportSize({width:1600,height:900});
 const inspect=()=>page.evaluate(()=>window.__FRONTLINES_DEV__.inspect());
 const start=async()=>page.evaluate(()=>{
  const d=window.__FRONTLINES_DEV__.inspect();let mutations=0,frames=[],last=performance.now(),alive=true;
  const observer=new MutationObserver(v=>mutations+=v.length);observer.observe(document.querySelector('.editor-ink'),{childList:true,subtree:true,attributes:true});
  const tick=now=>{frames.push(now-last);last=now;if(alive)requestAnimationFrame(tick);};requestAnimationFrame(tick);
  window.__EDITOR_SAMPLE__={finish:()=>{alive=false;observer.disconnect();const sorted=frames.toSorted((a,b)=>a-b);return {before:d.metrics,after:window.__FRONTLINES_DEV__.inspect().metrics,mutations,frames:frames.length,p95:sorted[Math.floor(sorted.length*.95)],max:Math.max(...frames)};}};
 });
 const end=()=>page.evaluate(()=>window.__EDITOR_SAMPLE__.finish());
 await page.locator('[data-tool=trench]').click();await page.mouse.move(530,680);await page.mouse.down();await page.mouse.move(1020,680,{steps:24});await page.mouse.up();
 await page.locator('[data-tool=objective]').click();await page.mouse.click(1000,540);
 for(const count of [10,25,50,100]){
  await page.locator('[data-tool=formation]').click();
  let existing=(await inspect()).source.entities.length;
  while(existing<count){const index=existing-2;await page.mouse.click(180+(index%16)*64,200+Math.floor(index/16)*55);existing++;}
  await page.locator('[data-tool=select]').first().click();
  await page.waitForTimeout(1500);await start();await page.waitForTimeout(5000);result.samples.push({count,kind:'idle',...await end()});
  const formation=(await inspect()).source.entities.find(e=>e.type==='formation');
  const mark=page.locator(`[data-entity="${formation.id}"] rect`),box=await mark.boundingBox();
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  const before=await inspect();await start();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  for(let n=0;n<60;n++){await page.mouse.move(box.x+box.width/2+n*.6,box.y+box.height/2+Math.sin(n/10)*12);await page.waitForTimeout(83);}
  const during=await inspect();await page.screenshot({path:`output/playwright/dev-${count}-drag.png`});await page.mouse.up();const after=await inspect();
  result.samples.push({count,kind:'formation-drag',...await end(),sourceUnchangedDuring:JSON.stringify(before.source)===JSON.stringify(during.source),previewMoved:Boolean(during.preview),commits:after.metrics.document.commits-before.metrics.document.commits});
  await start();await page.keyboard.down('d');await page.waitForTimeout(1000);await page.keyboard.up('d');await page.waitForTimeout(4000);result.samples.push({count,kind:'pan',...await end()});
  await page.locator('#opening-camera').click();await page.waitForTimeout(500);
  const trench=(await inspect()).source.entities.find(e=>e.type==='trench');
  // List selection is UI, not an injected world state.
  await page.locator('#deselect').click();await page.locator(`[data-select="${trench.id}"]`).click();
  const node=await page.locator(`[data-entity="${trench.id}"] circle`).first().boundingBox();
  const beforeNode=await inspect();await start();await page.mouse.move(node.x+6,node.y+6);await page.mouse.down();
  for(let n=0;n<60;n++){await page.mouse.move(node.x+6+n*.5,node.y+6+Math.sin(n/12)*8);await page.waitForTimeout(83);}
  const duringNode=await inspect();await page.mouse.up();const afterNode=await inspect();
  result.samples.push({count,kind:'node-drag',...await end(),sourceUnchangedDuring:JSON.stringify(beforeNode.source)===JSON.stringify(duringNode.source),previewMoved:Boolean(duringNode.preview),commits:afterNode.metrics.document.commits-beforeNode.metrics.document.commits});
 }
 await page.screenshot({path:'output/playwright/dev-100-authoring.png'});
 await page.locator('#validate').click();await page.screenshot({path:'output/playwright/dev-preflight-problems.png'});
 result.preflight=await page.locator('.validation').innerText();result.final=(await inspect()).metrics;
 await page.evaluate(r=>{window.__DEV_QA_RESULT__=r;},result);
}

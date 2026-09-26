// Three honest behaviors authored through controls, no injected runtime/preset.
async page=>{
 const read=()=>page.evaluate(()=>window.__FRONTLINES_DEV__.inspect());
 if(await page.locator('#close-validation').count())await page.locator('#close-validation').click();
 await page.locator('.file-menu summary').click();page.once('dialog',d=>d.accept());await page.locator('#reset').click();
 await page.locator('[data-tool=objective]').click();await page.mouse.click(1000,660);const objective=(await read()).source.entities.find(e=>e.type==='objective').id;
 for(const [intent,x,y] of [['attack',700,580],['defend',800,720],['hold',380,580]]){
  await page.locator('[data-tool=formation]').click();await page.locator('#placement-count').fill('2');await page.locator('#placement-count').press('Tab');await page.locator('#placement-intent').selectOption(intent);await page.locator('#placement-target').selectOption(objective);await page.mouse.click(x,y);
 }
 await page.locator('[data-tool=select]').first().click();await page.locator('#validate').click();
 const result={preflight:await page.locator('.validation').innerText(),source:(await read()).source};
 if(result.preflight.includes('ERROR'))throw Error(result.preflight);
 await page.screenshot({path:'output/playwright/dev-three-intents-setup.png'});
 await page.locator('#play').click();await page.locator('#test-speed').click();
 await page.waitForFunction(()=>window.__FRONTLINES_DEV__.inspect().runtime.elapsed>=35);await page.locator('#test-pause').click();
 const d=await read();result.elapsed=d.runtime.elapsed;result.plans=d.runtime.operation.authored.memories;result.positions=d.runtime.squads.map(q=>({id:q.id,x:q.x,z:q.z,order:q.order}));result.sourceUnchanged=JSON.stringify(d.source)===JSON.stringify(result.source);
 await page.screenshot({path:'output/playwright/dev-three-intents-play.png'});await page.locator('#play').click();
 result.stopped=(await read()).ownership;await page.evaluate(r=>window.__DEV_INTENT_QA__=r,result);
 if(!result.sourceUnchanged)throw Error('Play changed the author source');
}

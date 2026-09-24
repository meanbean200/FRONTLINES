async (page) => {
  const base='output/playwright/cinematic-ui',stamp=Date.now(),shots=[],checks={};
  const shot=async name=>{const path=base+'/'+stamp+'-'+name+'.png';await page.mouse.move(1000,24);await page.screenshot({path,animations:'disabled'});shots.push(path);};
  const state=()=>page.evaluate(()=>window.__FRONTLINES__.getState());
  await page.goto('http://127.0.0.1:4175/');
  await page.setViewportSize({width:1920,height:1080});
  await page.locator('#choose-operation').waitFor();
  await page.waitForFunction(()=>window.__FRONTLINES__.getPerf().chunks>=8);
  await page.waitForTimeout(500);
  await shot('main');
  await page.locator('#operations-menu').click();await shot('operations');
  await page.locator('[data-operation="line-defense"]').click();await shot('quick');
  await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');
  const before=await state();
  await page.locator('#launch-operation').click();
  await page.locator('#begin-operation').waitFor();
  await page.waitForTimeout(900);await shot('briefing');
  const preview=await state();checks.realPreview=preview.operation?.mode==='line-defense'&&preview.seed===1944;
  await page.locator('#back-to-setup').click();
  const restored=await state();checks.previewBackPreservesWorld=JSON.stringify(before)===JSON.stringify(restored);
  await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();
  await page.locator('[data-speed="0"]').click();
  await page.waitForTimeout(3600);await shot('normal-hud');
  checks.emptyHud=await page.locator('#selection-docket').isHidden()&&await page.locator('.command-dock').isHidden()&&await page.locator('.force-roster').isHidden()&&await page.locator('.garrison-panel').isHidden();
  const marker=page.locator('.squad-marker:not(.enemy)').filter({visible:true}).first();
  await marker.click();await page.waitForTimeout(300);await shot('selected');
  await page.locator('#selection-docket [data-hud-panel]').click();await shot('unit-details');
  await page.locator('#selection-detail summary').filter({hasText:'Condition'}).click();
  await page.locator('[aria-label="Close unit details"]').click();
  await page.locator('#build-command').click();await shot('build');
  await page.locator('[data-build-category="support"]').click();await shot('build-support');
  await page.locator('[data-build-close]').click();
  await page.locator('.hud-tools>summary').click();await page.locator('#defense-toggle').click();await shot('defense');
  await page.locator('[data-defense-tab="supplies"]').click();await shot('supplies');
  await page.locator('.garrison-panel>summary').click();
  await page.locator('#map-expand').click();await shot('map');
  const tick=(await state()).elapsed;await page.waitForTimeout(150);checks.mapPauses=(await state()).elapsed===tick;
  await page.keyboard.press('m');checks.mapKeyCloses=await page.locator('.field-map').isHidden();
  await page.locator('.operation-menu-button').click();await shot('pause');
  await page.locator('[data-settings]').click();await shot('settings');
  await page.locator('#menu-back').click();await page.locator('#resume-session').click();
  const layouts=[];
  for(const [width,height] of [[2560,1440],[1654,910],[1366,768],[1280,720],[1024,768],[2560,1080],[1280,540]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(160);await shot('hud-'+width+'x'+height);
    layouts.push(await page.evaluate(()=>{
      const selectors=['.brand','.operation-hud','.session-controls','.operation-menu-button','#selection-docket','.command-dock','.battle-tools'];
      const boxes=selectors.map(selector=>{const el=document.querySelector(selector),r=el.getBoundingClientRect();return {selector,x:r.x,y:r.y,w:r.width,h:r.height};});
      const overlaps=[];for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++){const x=boxes[a],y=boxes[b];if(x.w&&x.h&&y.w&&y.h&&Math.min(x.x+x.w,y.x+y.w)>Math.max(x.x,y.x)+1&&Math.min(x.y+x.h,y.y+y.h)>Math.max(x.y,y.y)+1)overlaps.push([x.selector,y.selector]);}
      return {width:innerWidth,height:innerHeight,overlaps,offscreen:boxes.filter(r=>r.x<0||r.y<0||r.x+r.w>innerWidth+1||r.y+r.h>innerHeight+1),canvas:{w:document.querySelector('#battlefield').clientWidth,h:document.querySelector('#battlefield').clientHeight}};
    }));
  }
  checks.layouts=layouts;
  await page.setViewportSize({width:1920,height:1080});
  return {checks,shots};
}

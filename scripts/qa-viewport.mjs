// Production + file + genuine iframe QA, owned disposable Edge only.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';

const folder=resolve('output/playwright',`viewport-${Date.now()}`),production=process.argv[2]??'http://127.0.0.1:4175/';
await mkdir(folder,{recursive:true});
const evidence={folder,production,samples:[],errors:[],checks:[]};
const fixture=await readFile('tests/fixtures/viewport-host.html');
const server=createServer((_,res)=>{res.setHeader('Content-Type','text/html');res.end(fixture);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const fixtureURL=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({channel:'msedge',headless:true});
const sizes=[[907,510],[1216,684],[821,462],[1280,720],[1920,1080],[973,557],[1043,619],[821,462]];
const withDebug=url=>{const u=new URL(url);u.searchParams.set('viewportDebug','1');return u.href;};
const read=frame=>frame.evaluate(()=>window.__FRONTLINES_VIEWPORT__());
const closeEnough=(a,b,label)=>assert.ok(Math.abs(a-b)<1.1,`${label}: ${a} != ${b}`);
async function sample(frame,label,expected){
  await frame.waitForFunction(()=>{const d=window.__FRONTLINES_VIEWPORT__?.();return d&&Math.abs(d.cameraAspect-d.app.width/d.app.height)<1e-6&&Math.abs(d.backing.width-Math.floor(d.app.width*d.rendererPixelRatio))<2;});
  const d=await read(frame);
  for(const key of ['document','body','app','canvas','ui','overlay',...(d.menu?['menu']:[])]){
    closeEnough(d[key].width,d.inner.width,`${label}/${key}/width`);closeEnough(d[key].height,d.inner.height,`${label}/${key}/height`);
    closeEnough(d[key].x,0,`${label}/${key}/left`);closeEnough(d[key].y,0,`${label}/${key}/top`);
  }
  if(expected){closeEnough(d.inner.width,expected[0],label+'/available width');closeEnough(d.inner.height,expected[1],label+'/available height');}
  closeEnough(d.backing.width,Math.floor(d.app.width*d.rendererPixelRatio),label+'/backing width');closeEnough(d.backing.height,Math.floor(d.app.height*d.rendererPixelRatio),label+'/backing height');
  assert.equal(d.overflow,false);assert.ok(Math.abs(d.cameraAspect-d.app.width/d.app.height)<1e-6);
  if(d.menu)assert.ok(await frame.locator('.operation-menu').evaluate(e=>e.scrollWidth<=e.clientWidth+1),label+'/menu horizontal overflow');
  evidence.samples.push({label,...d});return d;
}
async function screenshot(page,name){await page.screenshot({path:join(folder,name+'.png'),animations:'disabled'});}
async function controls(page,frame){
  await frame.locator('#sandbox-session').click();await frame.locator('[data-speed="0"]').click();
  await frame.locator('.hud-tools summary').click();await frame.locator('#roster-toggle').click();
  await frame.locator('.roster-row').first().click();await frame.locator('[aria-label="Close forces"]').click();
  await page.keyboard.press('f');
  await frame.waitForFunction(()=>{const p=window.__FRONTLINES__.getVisualStats(),q=window.__FRONTLINES__.getState().squads[0];return p.zoomDistance<120.001&&Math.hypot(p.cameraTarget.x-q.x,p.cameraTarget.z-q.z)<.001;});
}
async function clickAlignment(page,frame,label){
  // Read-only projection; the order is issued with a real right mouse click.
  const point=await frame.evaluate(()=>{const q=window.__FRONTLINES__.getState().squads[0];return {x:q.x+18,z:q.z+8};});
  const screen=await frame.evaluate(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,0),point);
  const element=frame===page?null:await frame.frameElement(),offset=element?await element.boundingBox():{x:0,y:0};
  assert.ok(screen.visible);await page.mouse.click(screen.x+offset.x,screen.y+offset.y,{button:'right'});
  await frame.waitForFunction(()=>window.__FRONTLINES__.getState().squads[0].order.type==='move');
  const actual=await frame.evaluate(()=>window.__FRONTLINES__.getState().squads[0].order.target);
  evidence.checks.push({label,actual,point,screen});
  assert.ok(Math.hypot(actual.x-point.x,actual.z-point.z)<1,`${label}: offset picking`);
  // Labels are positioned from the same projection as the rendered scene.
  const alignment=await frame.evaluate(()=>{const q=window.__FRONTLINES__.getState().squads[0],p=window.__FRONTLINES__.projectWorld(q.x,q.z,3),r=document.querySelector('.squad-marker').getBoundingClientRect();return {p,r:{x:r.x,y:r.y,width:r.width,height:r.height}};});
  closeEnough(alignment.r.x+alignment.r.width/2,alignment.p.x,label+'/marker x');closeEnough(alignment.r.y+alignment.r.height,alignment.p.y-18,label+'/marker y');
  evidence.checks.push({label,picking:true,actual,point,labelProjection:alignment});
}
try{
  for(const [kind,url] of [['production',withDebug(production)],['standalone',withDebug(pathToFileURL(resolve('FRONTLINES.html')).href)]]){
    const context=await browser.newContext({viewport:{width:1280,height:720},offline:kind==='standalone'}),page=await context.newPage();
    page.on('pageerror',e=>evidence.errors.push(`${kind}: ${e.message}`));
    await page.goto(url);await page.locator('#choose-operation').waitFor();
    await page.waitForFunction(()=>window.__FRONTLINES__.getVisualStats().triangles>50000);
    for(const size of sizes){await page.setViewportSize({width:size[0],height:size[1]});await sample(page,`${kind}-menu-${size}`,size);}
    for(let n=0;n<3;n++){await page.reload();await page.locator('#choose-operation').waitFor();await sample(page,`${kind}-refresh-${n}`,sizes.at(-1));}
    await screenshot(page,kind+'-menu-821');
    await controls(page,page);
    for(const size of [sizes[0],sizes[1],sizes[2],sizes[4]]){await page.setViewportSize({width:size[0],height:size[1]});await sample(page,`${kind}-play-${size}`,size);await clickAlignment(page,page,`${kind}-${size}`);}
    await screenshot(page,kind+'-gameplay-1920');await context.close();
  }
  // Parent layout, not page.setViewportSize, is responsible for every iframe change.
  const context=await browser.newContext({viewport:{width:2048,height:1240}}),page=await context.newPage();
  page.on('pageerror',e=>evidence.errors.push(`iframe: ${e.message}`));
  await page.goto(fixtureURL+'?game='+encodeURIComponent(withDebug(production)));
  const frame=await page.locator('#game').elementHandle().then(e=>e.contentFrame());
  await frame.locator('#choose-operation').waitFor();
  for(const size of sizes){
    await page.locator('#host-width').fill(String(size[0]));await page.locator('#host-height').fill(String(size[1]));await page.locator('#apply-size').click();
    await frame.waitForFunction(([w,h])=>innerWidth===w&&innerHeight===h,size);await sample(frame,`iframe-menu-${size}`,size);
    if([821,1216,1920].includes(size[0]))await screenshot(page,`iframe-menu-${size[0]}`);
  }
  await page.locator('#toggle-host').click();await page.locator('#toggle-host').click();await sample(frame,'iframe-revealed',sizes.at(-1));
  await controls(page,frame);
  for(const size of sizes){
    await page.locator('#host-width').fill(String(size[0]));await page.locator('#host-height').fill(String(size[1]));await page.locator('#apply-size').click();
    await frame.waitForFunction(([w,h])=>innerWidth===w&&innerHeight===h,size);await sample(frame,`iframe-play-${size}`,size);await clickAlignment(page,frame,`iframe-${size}`);
  }
  await screenshot(page,'iframe-gameplay-821');
  await page.locator('#fullscreen').click();await page.waitForFunction(()=>!!document.fullscreenElement);await sample(frame,'iframe-fullscreen');await clickAlignment(page,frame,'iframe-fullscreen');
  await frame.locator('.operation-menu-button').click();await sample(frame,'iframe-fullscreen-menu');await frame.locator('#resume-session').click();
  await frame.locator('#map-expand').click();assert.ok(await frame.locator('.field-map').isVisible());await frame.locator('.field-map [data-close]').click();
  await page.evaluate(()=>document.exitFullscreen());await frame.waitForFunction(()=>innerWidth===821);await sample(frame,'iframe-fullscreen-exit',[821,462]);
  await context.close();
  for(const dpr of [1,1.25,1.5,2]){
    const context=await browser.newContext({viewport:{width:907,height:510},deviceScaleFactor:dpr}),page=await context.newPage();
    await page.goto(withDebug(production));await page.locator('#choose-operation').waitFor();
    const d=await sample(page,`dpr-${dpr}`,[907,510]);assert.equal(d.devicePixelRatio,dpr);assert.equal(d.rendererPixelRatio,Math.min(dpr,1.25));
    await screenshot(page,`dpr-${dpr}`);await context.close();
  }
  // DPR-only changes can occur when moving a window between displays: no
  // CSS resize is required. The renderer must still refresh, even if Chromium
  // omits both resize and media-query notifications for this transition.
  const dynamic=await browser.newContext({viewport:{width:907,height:510}}),dynamicPage=await dynamic.newPage(),cdp=await dynamic.newCDPSession(dynamicPage);
  try{
    await dynamicPage.goto(withDebug(production));await dynamicPage.locator('#choose-operation').waitFor();
    for(const dpr of [2,1.25,1.5,1]){
      await cdp.send('Emulation.setDeviceMetricsOverride',{width:907,height:510,deviceScaleFactor:dpr,mobile:false});
      await dynamicPage.waitForFunction(d=>window.__FRONTLINES_VIEWPORT__().rendererPixelRatio===Math.min(d,1.25),dpr);
      await sample(dynamicPage,`dynamic-dpr-${dpr}`,[907,510]);
    }
    await dynamicPage.goto(production);await dynamicPage.locator('#choose-operation').waitFor();assert.equal(await dynamicPage.evaluate(()=>typeof window.__FRONTLINES_VIEWPORT__),'undefined');
  }finally{await cdp.send('Emulation.clearDeviceMetricsOverride');await cdp.detach();await dynamic.close();}
  assert.deepEqual(evidence.errors,[]);evidence.passed=true;
}catch(error){evidence.failure=error.stack;process.exitCode=1;}
finally{await browser.close();await new Promise(r=>server.close(r));await writeFile(join(folder,'result.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({folder,passed:evidence.passed,samples:evidence.samples.length,checks:evidence.checks.length,errors:evidence.errors,failure:evidence.failure}));}

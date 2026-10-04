// Browser-render proof for owner-visible player smoke at every quality level.
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const fixturePath=path.resolve(process.argv[2]),url=process.argv[3]??'http://127.0.0.1:4182/',folder=path.resolve(process.argv[4]??`output/playwright/player-delta-5/visual-${Date.now()}`);
await mkdir(folder,{recursive:true});const fixture=JSON.parse(await readFile(fixturePath,'utf8'));
const smoke=fixture.operation.smokeFields.find(s=>s.until>fixture.elapsed&&s.side==='player'&&s.source==='PLAYER');
if(!smoke)throw new Error('Fixture has no active player-ordered smoke');
const report={scope:'Automated Edge render capture of a production-path player smoke order in a scaled Open Front fixture; visual judgment still requires screenshot inspection.',url,smoke,qualities:[],errors:[]};
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1654,height:910}});page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto(url);await page.locator('#sandbox-session').click();await page.locator('[data-speed="0"]').click();
  for(const quality of ['low','balanced','high']){
    await page.evaluate(({fixture,quality,smoke})=>{const api=window.__FRONTLINES__;api.restoreState(fixture);api.setQuality(quality);api.focus(smoke.x,smoke.z,145);api.setSpeed(0);},{fixture,quality,smoke});
    await page.waitForTimeout(2600);const visual=await page.evaluate(()=>window.__FRONTLINES__.getVisualStats());
    const state=await page.evaluate(()=>window.__FRONTLINES__.getState()),active=state.operation.smokeFields.filter(s=>s.until>state.elapsed&&s.side==='player'&&s.source==='PLAYER').length;
    const screenshot=path.join(folder,`player-smoke-${quality}.png`);await page.screenshot({path:screenshot});report.qualities.push({quality,active,visual,screenshot});
  }
}catch(e){report.failure=String(e);process.exitCode=1;}
finally{await browser.close();await writeFile(path.join(folder,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({folder,failure:report.failure,errors:report.errors,qualities:report.qualities.map(q=>({quality:q.quality,active:q.active,particles:q.visual.particles}))}));}

// Explicit synthetic stress diagnostic, NOT player-input acceptance.
// Replay the retained 300/1,000-person fixtures; never touch a player's profile.
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const source=path.resolve(process.argv[2]??'docs/evidence/v1-player-experience/fixtures');
const url=process.argv[3]??'http://127.0.0.1:4175/';
const folder=path.resolve('output/playwright',`player-experience-performance-${Date.now()}`);
await mkdir(folder,{recursive:true});
const report={scope:'Synthetic retained mixed-combat load fixtures; not normal-control gameplay acceptance.',source,url,folder,results:[],errors:[]};
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const context=await browser.newContext({viewport:{width:1600,height:900}}),page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(url);await page.locator('#sandbox-session').click();await page.locator('[data-speed="0"]').click();
  for(const count of [300,1000]){
    const bytes=await readFile(path.join(source,`performance-${count}.json`)),fixture=JSON.parse(bytes),sha256=createHash('sha256').update(bytes).digest('hex');
    for(const quality of count===300?['balanced','high']:['balanced'])for(const speed of [1,5]){
      await page.evaluate(({fixture,quality})=>{const api=window.__FRONTLINES__;api.restoreState(fixture);api.setQuality(quality);api.focus(-1000,-1500,720);},{fixture,quality});
      await page.waitForTimeout(3000);await page.locator('[data-speed="1"]').click();await page.waitForTimeout(12000);await page.locator(`[data-speed="${speed}"]`).click();await page.waitForTimeout(1500);
      const data=await page.evaluate(async()=>{
        const api=window.__FRONTLINES__,before=api.getState(),frames=[],costs=[],steps=[];let last,start;
        await new Promise(resolve=>{function sample(t){start??=t;if(last!==undefined)frames.push(t-last);last=t;costs.push(api.getFrameCosts());steps.push(api.getSimulationCosts());if(t-start<6000)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});
        const distribution=values=>{const row=values.slice().sort((a,b)=>a-b);return {mean:row.reduce((a,b)=>a+b,0)/row.length,p50:row[Math.floor(row.length*.5)],p95:row[Math.floor(row.length*.95)],p99:row[Math.floor(row.length*.99)],max:row.at(-1)};};
        const summarize=rows=>Object.fromEntries(Object.keys(rows[0]).map(key=>[key,distribution(rows.map(row=>row[key]))]));
        const after=api.getState();return {wallSeconds:(last-start)/1000,frames:frames.length,frameIntervals:distribution(frames),advanced:after.elapsed-before.elapsed,shots:after.operation.shots-before.operation.shots,personnel:after.soldiers.length,active:after.soldiers.filter(p=>p.needs.life==='active').length,speed:after.simSpeed,frameCosts:summarize(costs),lastTickCosts:summarize(steps),tickCostCaveat:'Latest completed fixed tick sampled per render frame, not an independent sample of every simulation tick.',visual:api.getVisualStats(),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}};
      });await page.locator('[data-speed="0"]').click();
      const row={count,quality,requestedSpeed:speed,fixtureSHA256:sha256,...data};report.results.push(row);console.log(JSON.stringify({count,quality,speed,p95:data.frameIntervals.p95,advanced:data.advanced,shots:data.shots}));
      await page.screenshot({path:path.join(folder,`${count}-${quality}-${speed}.png`),scale:'css'});
    }
  }
}catch(error){report.failure=String(error);process.exitCode=1;}
finally{await browser.close();await writeFile(path.join(folder,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({folder,rows:report.results.length,errors:report.errors,failure:report.failure}));}

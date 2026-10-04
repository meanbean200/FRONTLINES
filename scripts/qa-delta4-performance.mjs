// Synthetic busy-load measurement, never normal-control player acceptance.
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const source=path.resolve(process.argv[2]),url=process.argv[3]??'http://127.0.0.1:4182/',folder=path.resolve(process.argv[4]??`output/playwright/player-delta-4/performance-${Date.now()}`),counts=(process.argv[5]??'136,300,512,1000').split(',').map(Number);
await mkdir(folder,{recursive:true});
const report={scope:'Synthetic authored mixed-combat performance fixtures loaded through production save validation; fixture identity is recorded per result. Not ordinary-play acceptance or a normal population option.',url,results:[],errors:[]};
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const context=await browser.newContext({viewport:{width:1654,height:910}}),page=await context.newPage(),cdp=await context.newCDPSession(page);
  page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto(url);await page.locator('#sandbox-session').click();await page.locator('[data-speed="0"]').click();
  for(const count of counts){
    const bytes=await readFile(path.join(source,`battle-${count}.json`)),fixture=JSON.parse(bytes),sha256=createHash('sha256').update(bytes).digest('hex'),fixtureIdentity={worldSize:fixture.worldSize,mode:fixture.operation?.mode,runtime:fixture.operation?.runtime?.definitionId,operationalPlanner:Boolean(fixture.operation?.runtime?.commander),people:fixture.soldiers.length};
    for(const quality of count===512?['balanced','high']:['balanced'])for(const speed of [1,5]){
      await page.evaluate(({fixture,quality})=>{const api=window.__FRONTLINES__;api.restoreState(fixture);api.setQuality(quality);api.focus(-540,-825,460);api.setSpeed(0);},{fixture,quality});
      await page.waitForTimeout(2200);await page.locator(`[data-speed="${speed}"]`).click();await page.waitForTimeout(2000);
      // Keep every fixed-tick row, rather than repeatedly sampling the last tick.
      const trace=[];const onTrace=e=>trace.push(...e.value);cdp.on('Tracing.dataCollected',onTrace);
      await cdp.send('Tracing.start',{categories:'v8,devtools.timeline,disabled-by-default-v8.gc',options:'record-continuously'});
      const data=await page.evaluate(async()=>{
        const api=window.__FRONTLINES__,before=api.getState(),startAt=before.elapsed,startShots=before.operation.shots,frames=[],costs=[],ticks=[];let last,start,cursor=0;
        const startCounters=api.getRuntimeProfile();api.setProfiling(true);
        const heapStart=performance.memory?.usedJSHeapSize;
        await new Promise(resolve=>{function sample(t){start??=t;if(last!==undefined)frames.push(t-last);last=t;costs.push(api.getFrameCosts());const p=api.getRuntimeProfile(cursor);ticks.push(...p.ticks);cursor=p.ticks.at(-1)?.sequence??cursor;if(t-start<15000)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});
        const distribution=values=>{const a=values.slice().sort((a,b)=>a-b);return {mean:a.reduce((n,v)=>n+v,0)/Math.max(1,a.length),median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],worst:a.at(-1)};};
        const summarize=(rows,skip=[])=>Object.fromEntries(Object.keys(rows[0]??{}).filter(k=>!skip.includes(k)).map(k=>[k,distribution(rows.map(r=>r[k]))]));
        const after=api.getState(),p=api.getRuntimeProfile(),delta=(a,b)=>Object.fromEntries(Object.keys(a).map(k=>[k,a[k]-b[k]]));api.setProfiling(false);
        return {wallSeconds:(last-start)/1000,advanced:after.elapsed-startAt,achievedSpeed:(after.elapsed-startAt)/((last-start)/1000),frames:frames.length,frameIntervals:distribution(frames),frameCosts:summarize(costs),ticks:ticks.length,tickCosts:summarize(ticks,['at','sequence']),traces:delta(p.traces,startCounters.traces),paths:delta(p.paths,startCounters.paths),heapStart,heapEnd:performance.memory?.usedJSHeapSize,visual:api.getVisualStats(),shots:after.operation.shots-startShots,requestedSpeed:after.simSpeed,active:after.soldiers.filter(s=>s.needs?.life==='active').length,smoke:after.operation.smokeFields?.filter(s=>s.until>after.elapsed).length??0,missions:after.operation.supportMissions?.length??0,commander:after.operation.runtime?.commander?{phase:after.operation.runtime.commander.planPhase,activeSector:after.operation.runtime.commander.activeSector,reserve:after.operation.runtime.commander.reserveIds?.length,transitions:after.operation.runtime.commander.transitions?.length}:undefined,works:after.operation.runtime?.openFront?.works.map(w=>({side:w.side,stage:w.stage,trenchId:w.trenchId,progress:after.trenches.find(t=>t.id===w.trenchId)?.progress})),facilities:after.living.facilities.map(f=>({id:f.id,kind:f.kind,progress:f.progress,connector:after.trenches.find(t=>t.id===f.connectorId)?.progress,workers:after.soldiers.filter(s=>s.duty?.facilityId===f.id&&s.duty?.kind==='construct'&&s.duty.arrivedAt!==undefined).length})),trucks:after.living.trucks.map(t=>({side:t.faction??'player',state:t.state,roadhead:t.roadhead?.role,cargo:Object.values(t.cargo).reduce((n,v)=>n+v,0)}))};
      });
      const completed=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');await completed;cdp.off('Tracing.dataCollected',onTrace);
      const gc=trace.filter(e=>e.ph==='X'&&/^(MinorGC|MajorGC)$/.test(e.name)&&e.dur),row={count,quality,selectedSpeed:speed,fixtureSHA256:sha256,fixtureIdentity,...data,gc:{scope:'Top-level MinorGC/MajorGC events only, excluding nested V8 phases',events:gc.length,totalMs:gc.reduce((n,e)=>n+e.dur/1000,0),worstMs:Math.max(0,...gc.map(e=>e.dur/1000))}};
      report.results.push(row);await page.locator('[data-speed="0"]').click();await page.screenshot({path:path.join(folder,`${count}-${quality}-${speed}.png`)});
      await writeFile(path.join(folder,`${count}-${quality}-${speed}-gc.json`),JSON.stringify(gc));await writeFile(path.join(folder,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({count,quality,speed,p95:data.frameIntervals.p95,achieved:data.achievedSpeed,shots:data.shots}));
    }
  }
}catch(e){report.failure=String(e);process.exitCode=1;}
finally{await browser.close();await writeFile(path.join(folder,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({folder,failure:report.failure,errors:report.errors}));}

// Player-input acceptance helpers. All game diagnostics are read-only.
import {select,ground} from './qa-reset-controls.mjs';
export async function selectFormation(page,name){
  if(await page.locator('#trench-panel').isVisible())await page.locator('[aria-label="Close position management"]').click();
  await select(page,name);
}
export async function inspectNetwork(page){
  if(await page.locator('#trench-panel').isVisible())return;
  if(!await page.locator('.hud-tools').evaluate(e=>e.open))await page.locator('.hud-tools summary').click();
  await page.locator('#trenches-command').click();
}
export async function plot(page,points){
  await page.locator('#build-command').click();await page.locator('#trench-command').click();
  const screen=await Promise.all(points.map(p=>ground(page,p.x,p.z)));
  if(screen.some(p=>!p.visible))throw Error('Plot is outside the current camera; reframe first.');
  const count=await page.evaluate(()=>window.__FRONTLINES__.getState().trenches.length);
  await page.mouse.move(screen[0].x,screen[0].y);await page.mouse.down();
  for(const p of screen.slice(1))await page.mouse.move(p.x,p.y,{steps:10});await page.mouse.up();
  if(await page.evaluate(()=>window.__FRONTLINES__.getState().trenches.length)!==count+1)throw Error('Plot rejected: '+await page.locator('#toast').textContent());
}
export async function profile(page,seconds=8){
  return page.evaluate(seconds=>new Promise(resolve=>{
    const api=window.__FRONTLINES__,start=performance.now(),simStart=api.getState().elapsed,intervals=[],costs=[],steps=[],speed=api.getState().simSpeed;
    let last=start,mutations=0;const observer=new MutationObserver(rows=>mutations+=rows.length);observer.observe(document.querySelector('#trench-panel'),{subtree:true,childList:true});
    const sample=now=>{intervals.push(now-last);last=now;costs.push(api.getFrameCosts?.()??{});steps.push(api.getSimulationCosts?.()??{});
      if(now-start<seconds*1000){requestAnimationFrame(sample);return;}
      observer.disconnect();const sorted=intervals.slice(1).sort((a,b)=>a-b),summary={};
      for(const key of Object.keys(costs[0])){const row=costs.map(c=>c[key]).sort((a,b)=>a-b);summary[key]={mean:row.reduce((a,b)=>a+b,0)/row.length,p95:row[Math.floor(row.length*.95)],max:row.at(-1)};}
      resolve({wallSeconds:(now-start)/1000,simulationSeconds:api.getState().elapsed-simStart,speed,frames:sorted.length,mean:sorted.reduce((a,b)=>a+b,0)/sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1),hitches:intervals.flatMap((ms,i)=>ms>40?[{frame:i,ms,costs:costs[i],lastFixedTick:steps[i]}]:[]),costs:summary,inspectorMutations:mutations,perf:api.getPerf(),view:api.getVisualStats(),trenches:api.getState().trenches.length,complete:api.getState().trenches.filter(t=>t.status==='complete').length});
    };requestAnimationFrame(sample);
  }),seconds);
}

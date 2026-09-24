import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const [session,kind,fixturePath,output]=process.argv.slice(2);if(!output||existsSync(output)||existsSync(output+'.probe.cjs'))throw Error('Unused evidence path required');
const f=JSON.parse(readFileSync(fixturePath,'utf8'));
const body=`async(page)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1280,height:800});if(await page.locator('#launch-operation').isVisible())await page.locator('#launch-operation').click();await page.evaluate(f=>{window.__FRONTLINES__.restoreState(f.state);window.__FRONTLINES__.focus(f.focus.x,f.focus.z,${kind==='night'?90:kind==='supply'?160:kind==='rescue'?100:160});},${JSON.stringify(f)});await page.waitForTimeout(900);
 await page.locator('.roster-row[data-squad="${f.squadId}"]').click();
 ${kind==='village'?`await page.getByRole('button',{name:'Assault',exact:true}).click();const point=await page.evaluate(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,0),${JSON.stringify(f.target)});await page.mouse.click(point.x,point.y);`:''}
 ${kind==='defense'?`await page.locator('.garrison-panel>summary').click();await page.locator('#garrison-readiness').selectOption('alert');await page.locator('.garrison-panel>summary').click();`:''}
 await page.locator('[data-speed="${kind==='rescue'?1:5}"]').click();await page.waitForTimeout(${kind==='night'?3500:kind==='rescue'?12000:kind==='supply'?5000:9000});
 ${kind==='village'||kind==='defense'?`await page.locator('[data-speed="5"]').click();await page.waitForTimeout(18000);`:''}
 const contactSpeed=await page.evaluate(()=>window.__FRONTLINES__.getState().simSpeed);await page.locator('[data-speed="0"]').click();await page.waitForTimeout(250);
 ${kind==='supply'?`await page.locator('.garrison-panel>summary').click();await page.getByText('Facilities & shipments',{exact:true}).click();`:''}
 await page.screenshot({path:${JSON.stringify(output.replace(/\.json$/,'.png'))}});
 const state=await page.evaluate(()=>window.__FRONTLINES__.getState());return {scope:${JSON.stringify(f.scope)},actualControls:true,contactSpeed,errors,state,checks:{active:state.operation.status==='active',noPageErrors:errors.length===0,shots:state.operation.shots,building:state.squads.find(q=>q.id===${f.squadId}).order.building,occupants:state.soldiers.filter(p=>p.building).map(p=>({id:p.id,stage:p.building.stage,floor:p.building.floor})),alarm:state.living.garrisons.some(g=>g.underFireUntil>state.elapsed),blockedTrucks:state.living.trucks.filter(t=>t.state==='blocked').map(t=>({id:t.id,cargo:t.cargo,reason:t.reason})),patient:state.soldiers.find(p=>p.id===${f.patientId??0})?.combat?.wound},viewport:{width:1280,height:800}};
}`;
writeFileSync(output+'.probe.cjs',body,{flag:'wx'});execFileSync(process.execPath,['scripts/run-browser-probe.mjs',session,output+'.probe.cjs',output],{stdio:'inherit',timeout:55000});

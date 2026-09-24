import {writeFileSync,existsSync} from 'node:fs';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {createOperation} from '../src/operations/createOperation';
import {roadPoint} from '../src/garrison/LogisticsSystem';
const output=process.argv[2];if(!output||existsSync(output))throw Error('Choose an unused probe path');
const sim=new BattlefieldSimulation(createOperation('campaign')),s=sim.state,q=s.squads[0],m=s.squads.find(q=>q.kind==='mortar'&&q.faction==='player')!,p=roadPoint(-1900),friend={x:p.x+120,z:p.z},safe={x:p.x+140,z:p.z+55};
for(const unit of [q,m]){sim.garrisons.release(unit.id);const at=unit===q?friend:p;Object.assign(unit,at);unit.order={type:'hold',issuedAt:0};unit.route=[];unit.routeIndex=0;for(const [i,person] of s.soldiers.filter(p=>p.squadId===unit.id).entries()){person.x=at.x;person.z=at.z+i*1.5;delete person.duty;delete person.trenchId;person.cover=sim.terrain.coverAt(person.x,person.z);}}
for(const person of s.soldiers)person.nextShotAt=1e9;s.simSpeed=0;s.operation!.nextOrders=1e9;
writeFileSync(output,`async(page)=>{
 const errors=[],dialogs=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});await page.setViewportSize({width:1280,height:800});await page.evaluate(s=>window.__FRONTLINES__.restoreState(s),${JSON.stringify(s)});await page.evaluate(()=>window.__FRONTLINES__.focus(${p.x+70},${p.z+20},260));await page.waitForTimeout(2000);
 await page.locator('.roster-row[data-squad="${m.id}"]').click();await page.locator('.support-controls>summary').click();
 const point=async p=>page.evaluate(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,0),p);
 await page.getByRole('button',{name:'Mortar HE',exact:true}).click();let screen=await point(${JSON.stringify(friend)});await page.mouse.move(screen.x,screen.y);await page.screenshot({path:'output/playwright/combat-v3-support-danger.png'});await page.mouse.click(screen.x,screen.y);
 const cancelled=await page.evaluate(()=>window.__FRONTLINES__.getState().operation.supportMissions??[]);
 await page.getByRole('button',{name:'Mortar HE',exact:true}).click();screen=await point(${JSON.stringify(safe)});await page.mouse.click(screen.x,screen.y);await page.locator('[data-speed="5"]').click();await page.waitForTimeout(5500);await page.locator('[data-speed="0"]').click();
 await page.getByRole('button',{name:'Mortar smoke',exact:true}).click();screen=await point(${JSON.stringify(safe)});await page.mouse.click(screen.x,screen.y);await page.locator('[data-speed="5"]').click();await page.waitForTimeout(5500);await page.locator('[data-speed="0"]').click();
 await page.locator('.roster-row[data-squad="${q.id}"]').click();await page.getByRole('button',{name:'Throw smoke',exact:true}).click();screen=await point(${JSON.stringify({x:friend.x+18,z:friend.z+3})});await page.mouse.click(screen.x,screen.y);await page.locator('[data-speed="5"]').click();await page.waitForTimeout(1400);await page.locator('[data-speed="0"]').click();await page.waitForTimeout(300);
 await page.screenshot({path:'output/playwright/combat-v3-support-result.png'});const state=await page.evaluate(()=>window.__FRONTLINES__.getState());return {scope:'Actual Edge HE friendly-risk cancellation, HE launch, mortar smoke, hand smoke, inventory and rendered smoke',errors,dialogs,state,checks:{warned:dialogs.length===1,cancelledWithoutMission:cancelled.length===0,HE:state.living.ledger.consumed.mortarHE===1,mortarSmoke:state.living.ledger.consumed.mortarSmoke===1,grenade:state.living.ledger.consumed.smokeGrenades===1,clouds:state.operation.smokeFields.length===2,noPageErrors:!errors.length}};
}`,{flag:'wx'});

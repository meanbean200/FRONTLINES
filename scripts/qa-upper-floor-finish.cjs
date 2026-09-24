async(page)=>{
 for(let i=0;i<6;i++){await page.locator('[data-speed="5"]').click();await page.waitForTimeout(4000);}await page.locator('[data-speed="0"]').click();
 const state=await page.evaluate(()=>window.__FRONTLINES__.getState()),people=state.soldiers.filter(p=>p.squadId===253&&p.needs.life==='active');await page.screenshot({path:'output/playwright/combat-v3-upper-floor-final-r2.png'});
 return {scope:'Continue actual upstairs order while two squadmates finish automatic first aid, then return to their intended floor',state,checks:{upstairs:people.every(p=>p.building?.stage==='station'&&p.building.floor===1),casualtiesStabilized:state.soldiers.filter(p=>[259,260].includes(p.id)).every(p=>p.combat?.wound?.stabilized),noRepeatedRescueTasks:people.every(p=>!p.combat?.careTask)}};
}

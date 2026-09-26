import {test,expect} from '@playwright/test';
import {preparedPosition} from '../../src/combat/testing/PositionFixture';

test('NORMAL and ALL IN review actual individuals, release on GO and restore detached movement',async({page},info)=>{
  await page.goto('/');await page.locator('#choose-operation').click();await page.locator('[data-mode-choice="meeting"]').click();
  await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();await page.locator('[data-speed="0"]').click();
  // Synthetic occupied-post fixture; all input after the validated restore is
  // ordinary player UI. This does not claim a player constructed this position.
  const state=await page.evaluate(()=>window.__FRONTLINES__.getState()),q=state.squads.find(q=>q.name==='Able')!,people=state.soldiers.filter(s=>s.squadId===q.id);
  people[0].equipment!.mortar=true;const f=preparedPosition(state,q.id,'mortar'),crew=f.weaponCrewIds!.slice();
  q.order={type:'occupy-trench',trenchId:f.connectorId,issuedAt:state.elapsed};
  for(const s of people){s.needs!.energy=90;s.needs!.hunger=s.needs!.thirst=10;s.suppression=0;s.combat={shotSequence:0};if(!crew.includes(s.id))delete s.duty;}
  await page.evaluate(state=>window.__FRONTLINES__.restoreState(state),state);
  await page.getByRole('button',{name:'Select Able',exact:true}).click();await page.keyboard.press('f');
  await page.getByRole('button',{name:'Options',exact:true}).click();await page.getByRole('button',{name:'Assault',exact:true}).click();
  const target=await page.evaluate(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,.1),{x:q.x+35,z:q.z+15});await page.mouse.click(target.x,target.y);
  const panel=page.getByRole('region',{name:'Assault preparation'});
  await expect(panel).toBeVisible();await expect(page.getByRole('button',{name:'Close unit details',exact:true})).toBeHidden();await expect(page.locator('#signal-orders')).toBeHidden();
  const preview=await page.evaluate(()=>window.__FRONTLINES__.getState());
  expect(preview.preparedOrders![0].assault!.participantIds).toHaveLength(6);expect(preview.living!.facilities.find(p=>p.id===f.id)!.weaponCrewIds).toEqual(crew);
  expect(preview.squads.find(p=>p.id===q.id)!.order).toEqual(q.order);
  await panel.getByRole('button',{name:'ALL IN',exact:true}).click();
  expect(await page.evaluate(()=>window.__FRONTLINES__.getState().preparedOrders![0].assault!.participantIds.length)).toBe(8);
  await page.screenshot({path:info.outputPath('all-in-review.png')});
  await panel.getByRole('button',{name:'Cancel preview',exact:true}).click();await expect(panel).toBeHidden();
  expect(await page.evaluate(id=>window.__FRONTLINES__.getState().living!.facilities.find(p=>p.id===id)!.weaponCrewIds,f.id)).toEqual(crew);
  await page.getByRole('button',{name:'Options',exact:true}).click();await page.getByRole('button',{name:'Assault',exact:true}).click();await page.mouse.click(target.x,target.y);
  await panel.getByRole('button',{name:'ALL IN',exact:true}).click();await panel.getByRole('button',{name:'Confirm ALL IN · GO',exact:true}).click();
  expect(await page.evaluate(()=>window.__FRONTLINES__.getState().preparedOrders![0].releasedAt)).toBeUndefined();
  await page.locator('[data-speed="1"]').click();await expect(panel).toBeHidden();await page.locator('[data-speed="0"]').click();
  const committed=await page.evaluate(()=>window.__FRONTLINES__.getState());expect(committed.living!.facilities.find(p=>p.id===f.id)!.weaponCrewIds).toEqual([]);expect(committed.preparedOrders![0].assault!.phase).toBe('committed');
  expect(committed.soldiers.filter(s=>s.squadId===q.id).map(s=>s.id)).toEqual(people.map(s=>s.id));
  await page.locator('.operation-menu-button').click();await page.locator('#save-session').click();await expect(page.locator('.menu-status')).toContainText('Session saved.');
  await page.reload();await page.locator('#main-continue').click();
  const restored=await page.evaluate(()=>window.__FRONTLINES__.getState());expect(restored.preparedOrders).toEqual(committed.preparedOrders);expect(restored.living!.facilities.find(p=>p.id===f.id)!.weaponCrewIds).toEqual([]);
  await page.screenshot({path:info.outputPath('all-in-detached-reloaded.png')});
  await page.getByRole('button',{name:'Select Able',exact:true}).click();await page.getByRole('button',{name:'Cancel assault',exact:true}).click();
  const cancelled=await page.evaluate(()=>window.__FRONTLINES__.getState());expect(cancelled.preparedOrders).toEqual([]);expect(cancelled.soldiers.filter(s=>s.squadId===q.id).every(s=>s.assaultHold!==undefined)).toBe(true);expect(cancelled.living!.facilities.find(p=>p.id===f.id)!.weaponCrewIds).toEqual([]);
});

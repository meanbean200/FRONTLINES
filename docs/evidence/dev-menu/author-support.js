async page => {
 const field=async(key,value)=>{await page.locator('[data-field="'+key+'"]').fill(String(value));await page.locator('[data-field="'+key+'"]').press('Tab');};
 const post=async(x,y,name,installation,crew,ammo,he)=>{
  await page.locator('[data-tool="facility"]').click();await page.mouse.click(x,y);await field('name',name);
  await page.locator('[data-field="installation"]').selectOption(installation);
  if(crew)await page.locator('[data-field="crewId"]').selectOption({label:crew});
  if(ammo)await field('stock.ammo',ammo);if(he)await field('stock.mortarHE',he);
  await field('facing',name.startsWith('South')?180:0);
 };
 await post(930,725,'South MG post','crew-mg','Able MG crew',600,0);
 await post(1040,727,'South field gun','field-gun','Able Gun crew',0,12);
 await post(930,377,'North MG post','crew-mg','Grenadier MG crew',600,0);
 await post(1040,379,'North mortar','mortar','Grenadier Gun crew',0,12);
 await post(1110,722,'South supply dugout','store',null,400,0);await field('stock.food',48);await field('stock.water',72);await field('stock.materials',60);
 await post(1000,375,'North supply dugout','store',null,400,0);await field('stock.food',48);await field('stock.water',72);await field('stock.materials',60);
 await post(990,711,'South floor rest','rest',null,0,0);
 await post(1090,368,'North floor rest','rest',null,0,0);
 await page.locator('[data-tool="staging"]').click();await page.locator('#placement-side').selectOption('player');await page.mouse.click(1160,810);await field('name','South reserve assembly');
 await page.locator('[data-tool="staging"]').click();await page.locator('#placement-side').selectOption('enemy');await page.mouse.click(1170,280);await field('name','North reserve assembly');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.screenshot({path:'03-authored-support.png'});
}

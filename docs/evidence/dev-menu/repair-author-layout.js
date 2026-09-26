async page => {
 const select=async(name)=>{if(await page.locator('#deselect').count())await page.locator('#deselect').click();await page.locator('[data-select]').filter({hasText:name}).click();};
 await select('South orchard line');await page.locator('#control-point').selectOption('0');await page.locator('#remove-point').click();
 for(const name of ['South MG post','South field gun','North MG post','North mortar','South supply dugout','North supply dugout','South floor rest','North floor rest']){await select(name);await page.locator('#snap-post').click();}
 await page.locator('#save').click();await page.locator('#play').click();
 await page.screenshot({path:'04-first-valid-playtest.png'});
}

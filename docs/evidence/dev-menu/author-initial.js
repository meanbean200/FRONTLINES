async page => {
 await page.getByText('Document / folder',{exact:true}).click();
 await page.locator('#preset-name').fill('The Orchard Approach');await page.locator('#preset-name').press('Tab');
 await page.locator('#preset-id').fill('orchard-approach');await page.locator('#preset-id').press('Tab');
 await page.getByRole('button',{name:'Use project content folder',exact:true}).click();
 await page.getByText('Generated terrain',{exact:true}).click();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Regenerate terrain',exact:true}).click();
 await page.getByRole('button',{name:'⌁ Draw trench',exact:true}).click();
 await page.mouse.move(880,735);await page.mouse.down();await page.mouse.move(985,710,{steps:12});await page.mouse.move(1070,735,{steps:12});await page.mouse.move(1160,710,{steps:12});await page.mouse.up();
 console.log(await page.locator('#dev-status').innerText());
 await page.screenshot({path:'01-first-authored-trench.png'});
}

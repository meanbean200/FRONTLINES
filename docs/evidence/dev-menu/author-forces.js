async page => {
 const field=async(key,value)=>{await page.locator('[data-field="'+key+'"]').fill(String(value));await page.locator('[data-field="'+key+'"]').press('Tab');};
 await field('name','South orchard line');
 await page.locator('#placement-side').selectOption('enemy');
 await page.locator('[data-tool="trench"]').click();
 await page.mouse.move(900,385);await page.mouse.down();await page.mouse.move(970,365,{steps:8});await page.mouse.move(1040,385,{steps:8});await page.mouse.move(1110,365,{steps:8});await page.mouse.up();
 await field('name','North orchard line');
 await page.locator('[data-tool="objective"]').click();await page.mouse.click(1080,535);await field('name','Orchard crossing');
 const formation=async(side,x,y,name,kind,count,intent)=>{
  await page.locator('#placement-side').selectOption(side);await page.locator('[data-tool="formation"]').click();await page.mouse.click(x,y);
  await field('name',name);await page.locator('[data-field="kind"]').selectOption(kind);await field('count',count);await page.locator('[data-field="intent"]').selectOption(intent);
  await page.locator('[data-field="targetId"]').selectOption({label:'Orchard crossing'});
  if(kind!=='rifle')await page.locator('[data-field="trenchId"]').selectOption({label:side==='player'?'South orchard line':'North orchard line'});
  console.log(name+': '+await page.locator('#dev-status').innerText());
 };
 for(const [side,y,base] of [['player',780,'Able'],['enemy',325,'Grenadier']]){
  await formation(side,880,y,base+' One','rifle',8,'attack');
  await formation(side,985,y,base+' Two','rifle',8,'probe');
  await formation(side,1080,y,base+' Reserve','rifle',8,'reserve');
  await formation(side,1140,y,base+' Pioneers','engineer',4,'hold');
  await formation(side,930,side==='player'?727:378,base+' MG crew','machinegun',2,'support');
  await formation(side,1040,side==='player'?727:382,base+' Gun crew','mortar',2,'support');
 }
 await page.getByRole('button',{name:'Save',exact:true}).click();
 console.log(await page.locator('#dev-status').innerText());
 await page.screenshot({path:'02-forces-through-controls.png'});
}

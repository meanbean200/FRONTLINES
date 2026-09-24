async(page)=>{await page.getByRole('button',{name:'Begin operation'}).click();await page.locator('[data-speed="0"]').click();return {scope:'Production Edge session ready',url:page.url()};}

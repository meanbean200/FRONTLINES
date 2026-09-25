// Interactive QA only: owns a disposable Edge process. Never attaches to a
// player browser/profile. Commands are developer-authored Playwright actions.
import {chromium} from 'playwright';
import {createInterface} from 'node:readline';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve('output/playwright',`gameplay-reset-${Date.now()}`);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:false,args:['--window-size=1640,980']});
const context=await browser.newContext({viewport:null});
context.setDefaultTimeout(8000);
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push({at:new Date().toISOString(),url:page.url(),type:'pageerror',message:String(error),stack:error.stack}));
page.on('console',message=>{if(message.type()==='error')errors.push({at:new Date().toISOString(),url:page.url(),type:'console',message:message.text(),location:message.location()});});
const shot=async name=>{const file=path.join(out,`${name}.png`);await page.screenshot({path:file,scale:'css'});return file;};
const record=async(name,data)=>{await writeFile(path.join(out,`${name}.json`),JSON.stringify(data,null,2));return data;};
let closing=false;
const close=async()=>{if(closing)return;closing=true;await record('page-errors',errors);for(const p of context.pages())try{const s=await context.newCDPSession(p);await s.send('Emulation.clearDeviceMetricsOverride');await s.detach();}catch{}await browser.close();};
process.once('SIGINT',()=>void close().finally(()=>process.exit()));
const input=createInterface({input:process.stdin,crlfDelay:Infinity});
try{
  await page.goto(process.argv[2]??'http://127.0.0.1:4175/');
  console.log(JSON.stringify({ready:true,out}));
  for await(const line of input){if(line==='exit')break;try{
    const result=await new Function('page','context','browser','shot','record','out',`return (async()=>{${JSON.parse(line).code}\n})()`)(page,context,browser,shot,record,out);
    console.log(JSON.stringify({result:result??null}));
  }catch(error){console.log(JSON.stringify({error:String(error)}));}}
}finally{await close();}

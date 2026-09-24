import {readFileSync} from 'node:fs';
const x=JSON.parse(readFileSync(process.argv[2],'utf8'));let count=0;
function diff(a:any,b:any,path='state'):void{if(count>30)return;if(a===b)return;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const key of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[key],b[key],path+'.'+key);}else {console.log(path,JSON.stringify(a),JSON.stringify(b));count++;}}
diff(x.original,x.loaded);console.log({differences:count});

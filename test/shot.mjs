// 使い方: node test/shot.mjs <出力名> '<ページ内で実行する JS>' [待ち ms]
import puppeteer from 'puppeteer';
const [name,code,wait]=process.argv.slice(2);
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--window-size=1280,720','--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage();await p.setViewport({width:1280,height:720});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+' '+m.text());});
await p.goto('http://127.0.0.1:8795/index.html');
await p.waitForFunction('window.__SR',{timeout:30000}).catch(()=>errs.push('boot timeout'));
let out=null;
if(code)out=await p.evaluate(code).catch(e=>'EVALERR '+e.message);
await new Promise(r=>setTimeout(r,+wait||400));
await p.screenshot({path:new URL('./out/'+name+'.png',import.meta.url).pathname});
console.log(JSON.stringify(out));if(errs.length)console.log(errs.slice(0,12).join('\n'));
await b.close();

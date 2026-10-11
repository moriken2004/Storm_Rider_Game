// 機体の点検用：node test/insp.mjs <形 0-6> [塗装] [視点セット a|b]  → test/out/insp_<形>_<セット>.png（6 視点の一覧）
import puppeteer from 'puppeteer';
import fs from 'fs';
const [shape='0',color='0',set='a',strip='']=process.argv.slice(2);
const I=.55,VIEWS=[{az:0,el:.12,r:70,ty:6,tz:10,fov:60,indoor:I},{az:3.1416,el:.1,r:60,ty:8,tz:-10,fov:62,indoor:I},{az:1.2,el:.2,r:16,ty:2,tx:-40,tz:-24,fov:60,indoor:I},{az:-1.2,el:.2,r:16,ty:2,tx:40,tz:-22,fov:60,indoor:I},{az:-1.1,el:.18,r:18,ty:2.5,tx:40,tz:62,fov:60,indoor:I},{az:2.6,el:.08,r:26,ty:3,tx:-30,tz:-74,fov:60,indoor:I}];
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--window-size=960,560','--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage();await p.setViewport({width:960,height:540});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:30000});
await p.evaluate((s,c,strip)=>{document.getElementById('bOpts').click();document.getElementById('oShape').children[s].click();document.getElementById('oColor').children[c].click();document.getElementById('opts').style.display='none';if(strip){for(const q of __SR.P.armor){q.on=false;q.mesh.visible=false;q.scar.visible=true;}}__SR.view.scale=1;window.dispatchEvent(new Event('resize'));},+shape,+color,strip);
const dir=new URL('./out/',import.meta.url).pathname,files=[];
for(let i=0;i<VIEWS.length;i++){await p.evaluate(v=>{__SR.G.insp=v;__SR.tick(3);},VIEWS[i]);await new Promise(r=>setTimeout(r,500));const f=dir+`_i${i}.png`;await p.screenshot({path:f});files.push(f);}
const q=await b.newPage();await q.setViewport({width:1920,height:1080});
await q.setContent('<!doctype html><body style="margin:0;display:grid;grid-template-columns:repeat(3,640px);grid-auto-rows:360px;background:#000">'+files.map(f=>`<img style="display:block" width=640 height=360 src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}">`).join('')+'</body>');
await q.screenshot({path:dir+`hangar.png`,clip:{x:0,y:0,width:1920,height:720}});
if(errs.length)console.log(errs.join('\n'));console.log('done');await b.close();

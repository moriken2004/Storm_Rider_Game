// 機体の点検用：node test/insp.mjs <形 0-6> [塗装] [視点セット a|b]  → test/out/insp_<形>_<セット>.png（6 視点の一覧）
import puppeteer from 'puppeteer';
import fs from 'fs';
const [shape='0',color='0',set='a',strip0='']=process.argv.slice(2);const strip=set==='p'?'nogear':set==='k'?'nocanopy':strip0;
const VIEWS={a:[{az:-2.5,el:.32,r:60},{az:-1.571,el:.03,r:62},{az:-.7,el:.2,r:60},{az:-3.1,el:1.45,r:66},{az:-2.3,el:-.07,r:52,fov:34},{az:3.1416,el:.05,r:60}],
 // 近接：機首・エンジン・尾部・脚・翼端・腹下
 // 操縦席まわり（c：標準胴体、d：原型機）
 c:[{az:-2.5,el:.3,r:9,ty:1.6,tz:-6.3},{az:-1.571,el:.12,r:8,ty:1.6,tz:-6.3},{az:3.1416,el:.25,r:9,ty:1.6,tz:-6.3},{az:-.8,el:.45,r:8,ty:1.6,tz:-6.3},{az:-3.0,el:1.2,r:8,ty:1.6,tz:-6.3},{az:2.2,el:.2,r:6,ty:1.7,tz:-6.6}],
 d:[{az:-2.5,el:.2,r:13,ty:0,tz:-11.5},{az:-1.571,el:.05,r:12,ty:0,tz:-11.5},{az:3.1416,el:.1,r:12,ty:0,tz:-11.5},{az:-2.9,el:.9,r:11,ty:0,tz:-11.5},{az:2.4,el:.3,r:9,ty:0,tz:-11.5},{az:3.1416,el:-.25,r:10,ty:0,tz:-11.5}],
 // 装甲が剥がれた跡（第 4 引数に strip を付けて使う）
 s:[{az:-2.3,el:.5,r:16,ty:1.2,tz:2},{az:-1.571,el:.35,r:14,ty:1,tz:2.5},{az:-.9,el:.75,r:16,ty:1,tz:3},{az:-2.2,el:.6,r:14,tx:-6,tz:1.5,ty:.6},{az:-1.3,el:1.1,r:16,tx:-7,tz:2},{az:-2.6,el:.3,r:30,ty:1}],
 // 操縦士と操縦席の接写（風防を外す）。最後は操縦士の目の位置から計器盤
 k:[{az:-2.4,el:.35,r:3.2,ty:1.85,tz:-6.0},{az:-1.571,el:.15,r:2.8,ty:1.8,tz:-6.0},{az:-2.9,el:.25,r:2.4,ty:2.0,tz:-6.6},{az:-3.1,el:1.3,r:3.0,ty:1.6,tz:-6.2},{az:-.6,el:.35,r:2.6,ty:1.75,tz:-5.6},{az:0,el:-.12,r:.9,ty:2.2,tz:-6.1,fov:70}],
 // ディフューザー（腹下の吊り下げ）：脚を隠して近くから
 p:[{az:-2.3,el:-.12,r:9,ty:-2.32,tz:-.3},{az:-1.571,el:-.05,r:8.5,ty:-2.32,tz:-.3},{az:-.6,el:-.2,r:9,ty:-2.32,tz:-.3},{az:-2.9,el:-.08,r:3.6,ty:-2.32,tz:-3.6},{az:-.15,el:-.05,r:3.8,ty:-2.32,tz:2.9},{az:-1.9,el:-.95,r:8,ty:-2.32,tz:-.3}],
 b:[{az:-2.4,el:.2,r:26,tz:-8},{az:-1.9,el:.25,r:24,tz:5,tx:-2},{az:-.9,el:.3,r:26,tz:10},{az:-1.75,el:-.02,r:24,tz:-1,ty:-1.5},{az:-2.2,el:.3,r:26,tx:-11,tz:2},{az:-1.2,el:.5,r:26,tz:2}]}[set];
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--window-size=960,560','--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage();await p.setViewport({width:960,height:540});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:30000});
await p.evaluate((s,c,strip)=>{document.getElementById('bOpts').click();document.getElementById('oShape').children[s].click();document.getElementById('oColor').children[c].click();document.getElementById('opts').style.display='none';if(strip==='nogear'){__SR.P.mesh.userData.gear.visible=false;}else if(strip==='nocanopy'){const u=__SR.P.mesh.userData;u.canopy.visible=false;if(u.canopyG)u.canopyG.children.forEach(o=>o.visible=false);}else if(strip){for(const q of __SR.P.armor){q.on=false;q.mesh.visible=false;q.scar.visible=true;}}__SR.view.scale=1;const P=__SR.P;P.pos.x=30;P.pos.z-=955;P.mesh.position.copy(P.pos);window.dispatchEvent(new Event('resize'));},+shape,+color,strip);
const dir=new URL('./out/',import.meta.url).pathname,files=[];
for(let i=0;i<VIEWS.length;i++){await p.evaluate(v=>{__SR.G.insp=v;__SR.tick(3);},VIEWS[i]);await new Promise(r=>setTimeout(r,500));const f=dir+`_i${i}.png`;await p.screenshot({path:f});files.push(f);}
const q=await b.newPage();await q.setViewport({width:1920,height:1080});
await q.setContent('<!doctype html><body style="margin:0;display:grid;grid-template-columns:repeat(3,640px);grid-auto-rows:360px;background:#000">'+files.map(f=>`<img style="display:block" width=640 height=360 src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}">`).join('')+'</body>');
await q.screenshot({path:dir+`insp_${shape}_${set}.png`,clip:{x:0,y:0,width:1920,height:720}});
if(errs.length)console.log(errs.join('\n'));console.log('done');await b.close();

// カットシーンを 1 秒おきに撮って一覧にする：node trailer/probe.mjs <INTRO|FIRE1|FIRE2|LAND>
import puppeteer from 'puppeteer';
import fs from 'fs';
const which=process.argv[2]||'INTRO';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage();await p.setViewport({width:480,height:270});p.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:30000});
await p.evaluate(w=>{window.requestAnimationFrame=()=>0;const S=__SR;
  if(w==='FIRE1'){S.startRun('eye');S.tick(30);}if(w==='FIRE2'){S.startRun('spare');S.G.spareGiven=true;S.P.hasPod=true;S.tick(30);}
  if(w==='LAND'){S.startRun('ret');S.P.pos.set(30,300,21000-3600);S.P.yaw=Math.PI;S.tick(10);}
  S.startCut(S.CUTS['CUT_'+w]);},which);
const imgs=[];
for(let t=0;t<70;t++){const m=await p.evaluate(()=>{__SR.tick(30,1/30);return __SR.G.mode;});if(m!=='cut')break;imgs.push((await p.screenshot({type:'jpeg',quality:70})).toString('base64'));}
const q=await b.newPage();const cols=8,rows=Math.ceil(imgs.length/cols);await q.setViewport({width:cols*240,height:rows*150});
await q.setContent('<!doctype html><body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(8,240px);font:12px monospace;color:#fff">'+imgs.map((d,i)=>`<div style="position:relative;height:150px"><img width=240 height=135 src="data:image/jpeg;base64,${d}"><b style="position:absolute;left:2px;top:2px;background:#000">${i+1}s</b></div>`).join('')+'</body>');
await q.screenshot({path:new URL('./out/probe_'+which+'.png',import.meta.url).pathname});console.log(which,imgs.length,'s');await b.close();

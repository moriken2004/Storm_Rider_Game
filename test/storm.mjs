// 嵐の中（レインバンド・壁雲・目の縁）を追尾カメラで撮る。node test/storm.mjs <tag>
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;const tag=process.argv[2]||'a';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
p.on('console',m=>{const t=m.text();if(t.includes('ERROR')){const e=t.match(/ERROR: 0:(\d+)[^\n]*/);console.log(e?e[0]:t.slice(0,200));}});p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
for(const[n,ph,r,y,t]of[['band','bands',7600,420,2],['band2','bands',9800,380,6],['wall','wall',4150,400,2],['wall2','wall',3600,800,5],['eyeedge','eye',2200,1500,2]]){
  await p.evaluate((ph,r,y,t)=>{window.requestAnimationFrame=()=>0;const S=__SR,G=S.G,P=S.P;S.startRun(ph);if(G.mode==='cut')S.endCut();document.getElementById('hud').style.visibility='hidden';const rd=document.getElementById('radio');if(rd)rd.style.display='none';
    const a=.7;P.pos.set(Math.cos(a)*r,y,Math.sin(a)*r);P.yaw=Math.atan2(Math.cos(a),-Math.sin(a))+0.3;S.cloudCut();for(let i=0;i<30*t;i++){S.input.tx=0;S.input.ty=(y-P.pos.y)/200;P.inv=1;S.step(1/30);}},ph,r,y,t);
  await p.screenshot({path:out('storm_'+n+'_'+tag+'.png')});}
await b.close();

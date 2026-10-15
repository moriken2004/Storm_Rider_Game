// 台風を上空から撮る。node test/typhoon.mjs <tag>
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;const tag=process.argv[2]||'a';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:1280,height:720});p.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:60000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR;S.startRun('approach');if(S.G.mode==='cut')S.endCut();document.getElementById('hud').style.visibility='hidden';});
for(const[n,c,l,fov]of[['top',[1,52000,1],[0,0,0],50],['obl',[0,30000,30000],[0,0,-1500],48],['title',[9000,33000,17000],[0,0,-800],48],['low',[0,7000,16000],[0,2000,0],60]]){
  await p.evaluate((c,l,fov)=>{window.__PCAM=cam=>{cam.position.set(...c);cam.lookAt(...l);cam.fov=fov;cam.updateProjectionMatrix();};__SR.cloudCut();for(let i=0;i<20;i++)__SR.step(1/30);},c,l,fov);await p.screenshot({path:out('ty_'+n+'_'+tag+'.png')});}
await b.close();

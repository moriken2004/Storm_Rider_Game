// 港の海の色を撮る
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;const tag=process.argv[2]||'a';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR;S.startRun('approach');if(S.G.mode==='cut')S.endCut();document.getElementById('hud').style.visibility='hidden';const r=document.getElementById('radio');if(r)r.style.display='none';});
for(const[n,c,l]of[['top',[1450,900,21000+150.01],[1450,0,21000+150]],['obl',[1900,160,21000+650],[1400,0,21000+150]],['low',[1700,30,21000+380],[1350,0,21000+150]]]){
  await p.evaluate((c,l)=>{window.__PCAM=cam=>{cam.position.set(...c);cam.lookAt(...l);cam.up.set(0,c[1]>800?0:1,c[1]>800?-1:0);cam.fov=55;cam.updateProjectionMatrix();};__SR.cloudCut();for(let i=0;i<5;i++)__SR.step(1/30);},c,l);await p.screenshot({path:out('harbor_'+n+'_'+tag+'.png')});}
await b.close();

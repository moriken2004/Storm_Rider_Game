// 草地の繰り返しを、変更前（v72）と並べて撮る
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;
for(const[tag,u]of[['new','/index.html'],['old','/test/out/v72.html']]){const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
  await p.goto('http://127.0.0.1:8795'+u);await p.waitForFunction('window.__SR',{timeout:200000});
  await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR;S.startRun('approach');if(S.G.mode==='cut')S.endCut();document.getElementById('hud').style.visibility='hidden';const r=document.getElementById('radio');if(r)r.style.display='none';});
  for(const[n,c,l]of[['low',[-80,16.5,21000-600],[-60,15,21000-450]],['mid',[-300,90,21000-200],[-60,15,21000+200]],['high',[0,700,21000-600],[0,0,21000+200]]]){
    await p.evaluate((c,l)=>{const gy=(x,z)=>Math.max(islandH(x,z-21000),0);window.__PCAM=cam=>{cam.position.set(c[0],Math.max(c[1],gy(c[0],c[2])+2),c[2]);cam.lookAt(...l);cam.fov=60;cam.updateProjectionMatrix();};for(let i=0;i<3;i++)__SR.step(1/30);},c,l);
    await p.screenshot({path:out('grass_'+n+'_'+tag+'.png')});}
  await b.close();}

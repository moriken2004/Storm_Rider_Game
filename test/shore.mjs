// 浜辺を低い位置から撮る（草むら・流木の確認）
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;const tag=process.argv[2]||'a';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
p.on('console',m=>{const t=m.text();if(t.includes('ERROR'))console.log(t.slice(0,200));});p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR;S.startRun('approach');if(S.G.mode==='cut')S.endCut();document.getElementById('hud').style.visibility='hidden';const r=document.getElementById('radio');if(r)r.style.display='none';});
for(const[n,a]of[['s1',1.75],['s2',-1.1],['s3',.9]]){await p.evaluate((a)=>{let r=300;while(r<2600&&islandH(Math.cos(a)*r,Math.sin(a)*r)>0)r+=4;const cx=Math.cos(a),cz=Math.sin(a),tx=-cz,tz=cx,gy=(x,z)=>Math.max(islandH(x,z),0);
  const px=cx*(r-25)+tx*20,pz=cz*(r-25)+tz*20;window.__PCAM=cam=>{cam.position.set(px,gy(px,pz)+1.7,pz+21000);cam.lookAt(cx*(r-50)-tx*40,gy(cx*(r-50),cz*(r-50))+1.5,cz*(r-50)-tz*40+21000);cam.fov=60;cam.updateProjectionMatrix();};for(let i=0;i<3;i++)__SR.step(1/30);},a);await p.screenshot({path:out('shore_'+n+'_'+tag+'.png')});}
await b.close();

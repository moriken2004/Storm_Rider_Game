// 崖の海岸を沖から撮る
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;const tag=process.argv[2]||'a';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
p.on('console',m=>{if(m.text().includes('ERROR'))console.log(m.text().slice(0,300));});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR;S.startRun('approach');if(S.G.mode==='cut')S.endCut();document.getElementById('hud').style.visibility='hidden';const r=document.getElementById('radio');if(r)r.style.display='none';});
for(const[n,a]of[['w',Math.PI],['sw',2.35],['nw',-2.15],['ne',-.6]]){await p.evaluate((a)=>{let r=300;while(r<2600&&islandH(Math.cos(a)*r,Math.sin(a)*r)>0)r+=4;const cx=Math.cos(a),cz=Math.sin(a),tx=-cz,tz=cx;
  window.__PCAM=cam=>{cam.position.set(cx*(r+160)+tx*90,25,cz*(r+160)+tz*90+21000);cam.lookAt(cx*(r-30)-tx*30,12,cz*(r-30)-tz*30+21000);cam.fov=55;cam.updateProjectionMatrix();};for(let i=0;i<3;i++)__SR.step(1/30);},a);await p.screenshot({path:out('cliff_'+n+'_'+tag+'.png')});}
// 寄り
await p.evaluate(()=>{const a=Math.PI;let r=300;while(r<2600&&islandH(Math.cos(a)*r,Math.sin(a)*r)>0)r+=4;window.__PCAM=cam=>{cam.position.set(-(r+45),10,21000+20);cam.lookAt(-(r-5),14,21000-10);cam.fov=55;cam.updateProjectionMatrix();};for(let i=0;i<3;i++)__SR.step(1/30);});
await p.screenshot({path:out('cliff_close_'+tag+'.png')});
await b.close();

// 船の甲板を寄りで撮る。node test/deck.mjs <tag>
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;const tag=process.argv[2]||'a';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
p.on('console',m=>{if(m.text().includes('ERROR'))console.log(m.text().slice(0,300));});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR;S.startRun('approach');if(S.G.mode==='cut')S.endCut();for(let i=0;i<5;i++)S.step(1/30);document.getElementById('hud').style.visibility='hidden';const r=document.getElementById('radio');if(r)r.style.display='none';});
for(const[n,i,ox,oy,oz,lx,ly,lz]of[['cargo_fore',0,8,22,-110,0,12,-80],['cargo_aft',0,-10,26,105,0,11,86],['patrol',4,6,14,40,0,5,20],['fish',1,3,7,16,0,2,6]]){
  await p.evaluate((i,ox,oy,oz,lx,ly,lz)=>{const s=__SR.ships[i];window.__PCAM=c=>{const cc=Math.cos(s.h),sn=Math.sin(s.h),T=(a,b)=>[s.x+a*cc+b*sn,s.z-a*sn+b*cc];const[px,pz]=T(ox,oz),[qx,qz]=T(lx,lz);c.position.set(px,oy+s.m.position.y,pz);c.lookAt(qx,ly,qz);c.fov=55;c.updateProjectionMatrix();};for(let k=0;k<3;k++)__SR.step(1/30);},i,ox,oy,oz,lx,ly,lz);
  await p.screenshot({path:out('deck_'+n+'_'+tag+'.png')});}
await b.close();

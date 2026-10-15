// 島を真上から撮る（海岸線の形の確認）。node test/island.mjs <tag>
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;const tag=process.argv[2]||'a';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:960});
p.on('console',m=>{if(m.text().includes('ERROR'))console.log(m.text().slice(0,300));});p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR;S.startRun('ret');if(S.G.mode==='cut')S.endCut();document.getElementById('hud').style.visibility='hidden';const r=document.getElementById('radio');if(r)r.style.display='none';
  window.__PCAM=c=>{c.position.set(0,6500,21000.01);c.lookAt(0,0,21000);c.up.set(0,0,-1);c.fov=40;c.updateProjectionMatrix();};S.cloudCut();for(let i=0;i<10;i++)S.step(1/30);});
await p.screenshot({path:out('island_'+tag+'.png')});
await p.evaluate(()=>{window.__PCAM=c=>{c.position.set(-2600,500,21000+2600);c.lookAt(0,0,21000);c.up.set(0,1,0);c.fov=50;c.updateProjectionMatrix();};for(let i=0;i<3;i++)__SR.step(1/30);});await p.screenshot({path:out('island_obl_'+tag+'.png')});
await b.close();

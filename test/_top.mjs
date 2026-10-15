import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:1200,height:900});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:60000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR;S.startRun('approach');if(S.G.mode==='cut')S.endCut();document.getElementById('hud').style.visibility='hidden';document.getElementById('radio').style.display='none';
  window.__PCAM=c=>{c.position.set(300,900,21000+200.01);c.lookAt(300,0,21000+200);c.up.set(0,0,-1);c.fov=60;c.updateProjectionMatrix();};for(let i=0;i<3;i++)S.step(1/30);});
await p.screenshot({path:out('basetop.png')});await b.close();

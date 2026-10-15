// 帰投（夕方）の港と基地を撮る
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;const tag=process.argv[2]||'a';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
p.on('console',m=>{const t=m.text();if(t.includes('ERROR'))console.log(t.slice(0,200));});p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
console.log(await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR;S.startRun('ret');if(S.G.mode==='cut')S.endCut();document.getElementById('hud').style.visibility='hidden';const r=document.getElementById('radio');if(r)r.style.display='none';for(let i=0;i<30;i++)S.step(1/30);return 'gold='+(S.G.gold||0).toFixed(2)+' gloom='+(S.G.gloom||0).toFixed(2);}));
for(const[n,c,l]of[['port',[1700,60,21000+600],[1250,10,21000+150]],['portlow',[1550,20,21000+420],[1280,12,21000+150]],['base',[600,120,21000+700],[250,15,21000+300]]]){await p.evaluate((c,l)=>{window.__PCAM=cam=>{cam.position.set(...c);cam.lookAt(...l);cam.fov=55;cam.updateProjectionMatrix();};for(let i=0;i<3;i++)__SR.step(1/30);},c,l);await p.screenshot({path:out('dusk_'+n+'_'+tag+'.png')});}
await b.close();

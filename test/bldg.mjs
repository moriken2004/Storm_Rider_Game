// 建物を色々な角度から撮り、閉じていない面がないか確かめる。node test/bldg.mjs <tag>
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;const tag=process.argv[2]||'a';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:800,height:450});p.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:60000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR;S.startRun('approach');if(S.G.mode==='cut')S.endCut();for(let i=0;i<5;i++)S.step(1/30);document.getElementById('hud').style.visibility='hidden';document.getElementById('radio').style.display='none';});
const Z=21000,HZ=Z+1085,Y=15;
const V={hg_front_hi:[[0,70,HZ-200],[0,30,HZ-90]],hg_top:[[60,120,HZ-60],[0,30,HZ]],hg_back:[[40,40,HZ+200],[0,25,HZ+90]],hg_side:[[150,30,HZ],[50,20,HZ]],
  main_n:[[330,60,Z+260],[330,20,Z+400]],main_e:[[520,50,Z+400],[400,20,Z+400]],main_top:[[330,160,Z+330],[330,20,Z+400]],main_w:[[130,40,Z+430],[250,20,Z+400]],
  tower:[[230,90,Z+330],[200,70,Z+360]],port_shed:[[1060,40,Z+160],[1130,10,Z+160]],port_office:[[1100,30,Z-170],[1125,10,Z-130]],port_tank:[[1100,30,Z-20],[1128,8,Z-40]]};
for(const[n,[c,l]]of Object.entries(V)){await p.evaluate((c,l)=>{window.__PCAM=cam=>{cam.position.set(...c);cam.lookAt(...l);cam.fov=55;cam.updateProjectionMatrix();};for(let i=0;i<3;i++)__SR.step(1/30);},c,l);await p.screenshot({path:out('bd_'+n+'_'+tag+'.png')});}
await b.close();
// 灯台の土台
const b2=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const q=await b2.newPage();await q.setViewport({width:800,height:450});
await q.goto('http://127.0.0.1:8795/index.html');await q.waitForFunction('window.__SR',{timeout:60000});
await q.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR;S.startRun('approach');if(S.G.mode==='cut')S.endCut();document.getElementById('hud').style.visibility='hidden';});
for(const[n,c,l]of[['lh1',[290,25,21000-1290],[250,4,21000-1335]],['lh2',[200,12,21000-1380],[250,4,21000-1340]]]){await q.evaluate((c,l)=>{window.__PCAM=cam=>{cam.position.set(...c);cam.lookAt(...l);cam.fov=55;cam.updateProjectionMatrix();};for(let i=0;i<3;i++)__SR.step(1/30);},c,l);await q.screenshot({path:out('bd_'+n+'_'+tag+'.png')});}
await b2.close();

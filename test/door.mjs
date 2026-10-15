// 格納庫の扉を開けた状態で外から撮る（ちらつき＝面の重なりの確認）。node test/door.mjs <tag>
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;const tag=process.argv[2]||'a';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR;S.startRun('approach');if(S.G.mode==='cut')S.endCut();S.setDoors(1);document.getElementById('hud').style.visibility='hidden';const r=document.getElementById('radio');if(r)r.style.display='none';});
const HZ=21000+1085,Y=15;
for(const[n,c,l]of[['front',[40,20,HZ-260],[50,15,HZ-88]],['side',[120,12,HZ-120],[60,14,HZ-88]],['far',[150,60,HZ-500],[50,15,HZ-88]],['top',[95,45,HZ-110],[70,20,HZ-88]]]){
  await p.evaluate((c,l)=>{window.__PCAM=cam=>{cam.position.set(...c);cam.lookAt(...l);cam.fov=45;cam.updateProjectionMatrix();};for(let i=0;i<3;i++)__SR.step(1/30);},c,l);await p.screenshot({path:out('door_'+n+'_'+tag+'.png')});
  await p.evaluate(()=>{__SR.camera.position.x+=.37;__SR.step(1/30);});}
await b.close();

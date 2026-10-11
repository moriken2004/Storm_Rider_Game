// 雲の描画の比較：同じ場面を「歩数の配分なし／あり」で撮って上下に並べる。node test/cloudab.mjs → test/out/cloudab.png
import puppeteer from 'puppeteer';
import fs from 'fs';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage();await p.setViewport({width:640,height:360});p.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR');
// 視点：[x,y,z, 向き yaw, 俯仰 pitch]
const V=[[0,900,14500,0,.02],[600,1500,12500,.3,-.02],[0,2600,11000,0,-.05],[-800,1200,9500,-.2,.05],[0,700,13200,.5,.06],[1500,2000,13500,-.6,0]];
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR;S.startRun('approach');S.tick(5,1/30);document.getElementById('hud').style.display='none';document.getElementById('fhud').style.display='none';});
const shots=[];
for(const on of[0,+(process.argv[2]||18)])for(const v of V){await p.evaluate((v,on)=>{const S=__SR;S.cloudMat.uniforms.uBud.value=on;S.G.mode='title';S.G.optPrev=false;window.__PCAM=cam=>{cam.up.set(0,1,0);cam.position.set(v[0],v[1],v[2]);const cy=Math.cos(v[4]);cam.lookAt(v[0]-Math.sin(v[3])*cy*100,v[1]+Math.sin(v[4])*100,v[2]-Math.cos(v[3])*cy*100);cam.fov=62;cam.updateProjectionMatrix();};S.cloudCut();for(let i=0;i<14;i++)S.step(1/60);},v,on);
  await new Promise(r=>setTimeout(r,250));shots.push((await p.screenshot({type:'jpeg',quality:85})).toString('base64'));}
const q=await b.newPage();await q.setViewport({width:1920,height:720});
await q.setContent('<!doctype html><body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(6,320px);grid-auto-rows:180px">'+shots.map(d=>`<img style="display:block" width=320 height=180 src="data:image/jpeg;base64,${d}">`).join('')+'</body>');
await q.screenshot({path:new URL('./out/cloudab.png',import.meta.url).pathname,clip:{x:0,y:0,width:1920,height:360}});console.log('done');await b.close();

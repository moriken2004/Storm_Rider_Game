// 低空飛行のしぶき（後ろ・横から）と、どこまで低く飛べるか
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;const tag=process.argv[2]||'a';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
const r=await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR,G=S.G,P=S.P;S.startRun('approach');if(G.mode==='cut')S.endCut();document.getElementById('hud').style.visibility='hidden';const rd=document.getElementById('radio');if(rd)rd.style.display='none';
  P.pos.set(0,7,16000);P.yaw=0;P.inv=0;P.hull=100;let minY=99,hits=0,h0=P.hull;for(let i=0;i<30*6;i++){S.input.tx=0;S.input.ty=-.3;S.step(1/30);minY=Math.min(minY,P.pos.y);}return{minY:+minY.toFixed(1),hull:P.hull,mode:G.mode};});
console.log('海面へ押し付けたとき 最低高度',r.minY,'m 耐久',r.hull);
await p.screenshot({path:out('spray_chase_'+tag+'.png')});
for(const[n,ox,oy,oz]of[['side',40,6,-10],['rear',10,4,60]]){await p.evaluate((ox,oy,oz)=>{const S=__SR,P=S.P;window.__PCAM=c=>{const cy=Math.cos(P.yaw),sy=Math.sin(P.yaw);c.position.set(P.pos.x+ox*cy+oz*sy,oy,P.pos.z-ox*sy+oz*cy);c.lookAt(P.pos.x,P.pos.y,P.pos.z);c.fov=50;c.updateProjectionMatrix();};for(let i=0;i<20;i++){S.input.ty=-.15;S.step(1/30);}},ox,oy,oz);await p.screenshot({path:out('spray_'+n+'_'+tag+'.png')});}
console.log('描画',await p.evaluate(()=>{const g=document.getElementById('gl').getContext('webgl2');const t=performance.now();for(let i=0;i<30;i++){__SR.step(1/30);g.finish();}return((performance.now()-t)/30).toFixed(1)+'ms';}));
await b.close();

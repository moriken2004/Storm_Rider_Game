// 船と港の見た目を確認する：船 3 種の寄り・港の全景・港の低空
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:1280,height:720});p.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR');
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('hud').style.visibility='hidden';const S=__SR;S.startRun('approach');if(S.G.mode==='cut')S.endCut();for(let i=0;i<10;i++)S.step(1/30);document.getElementById('hud').style.visibility='hidden';});
const shot=async(n,f)=>{await p.evaluate(f);await p.evaluate(()=>{for(let i=0;i<3;i++)__SR.step(1/30);});await p.screenshot({path:out('port_'+n+'.png')});};
const SHIP=(i,dx,dy,dz,fov)=>`()=>{const s=__SR.ships[${i}],L=s.m.userData.len,c=Math.cos(s.h),n=Math.sin(s.h);window.__PCAM=cam=>{const ox=${dx}*L,oz=${dz}*L;cam.position.set(s.x+ox*c+oz*n,${dy}*L,s.z-ox*n+oz*c);cam.lookAt(s.x,L*.08,s.z);cam.fov=${fov};cam.updateProjectionMatrix();};}`;
await shot('cargo',eval(SHIP(0,.55,.16,.45,40)));
await shot('cargo2',eval(SHIP(0,-.5,.06,-.6,40)));
await shot('patrol',eval(SHIP(4,.8,.2,.6,40)));await shot('patrol2',eval(SHIP(4,-.7,.15,-.5,40)));
await shot('fish',eval(SHIP(1,1.0,.35,.9,40)));
await shot('portwide',()=>{window.__PCAM=c=>{c.position.set(850,230,21000+820);c.lookAt(1220,5,21130);c.fov=50;c.updateProjectionMatrix();};});
await shot('portlow',()=>{window.__PCAM=c=>{c.position.set(1380,28,21000+560);c.lookAt(1240,10,21150);c.fov=55;c.updateProjectionMatrix();};});
await b.close();
// 港の寄り：岸壁と係留中の貨物船・防波堤の消波ブロック・コンテナヤード
const b2=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const q=await b2.newPage();await q.setViewport({width:1280,height:720});q.on('pageerror',e=>console.log('PAGEERR '+e.message));
await q.goto('http://127.0.0.1:8795/index.html');await q.waitForFunction('window.__SR');
await q.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR;S.startRun('approach');if(S.G.mode==='cut')S.endCut();for(let i=0;i<10;i++)S.step(1/30);document.getElementById('hud').style.visibility='hidden';});
const V=[['quay',[1340,22,21000+40],[1300,8,21000+150]],['break',[1600,25,21000-110],[1650,2,21000-160]],['yard',[1230,30,21000-200],[1180,6,21000-100]],['jetty',[1420,18,21000+120],[1360,5,21000+30]]];
for(const[n,c,l]of V){await q.evaluate((c,l)=>{window.__PCAM=cam=>{cam.position.set(...c);cam.lookAt(...l);cam.fov=55;cam.updateProjectionMatrix();};for(let i=0;i<3;i++)__SR.step(1/30);},c,l);await q.screenshot({path:out('port_'+n+'.png')});}
await b2.close();

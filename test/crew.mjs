// 出撃カットの整備員：各場面で誘導員・歩く人・作業する人に寄って撮る
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:960,height:540});p.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR');
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('title').hidden=true;__SR.startCut(__SR.CUTS.CUT_INTRO);});
let T=0;const go=async t=>{await p.evaluate(n=>{for(let k=0;k<n;k++)__SR.step(1/30);},Math.round((t-T)*30));T=t;};
const Z=21000+1085,Y=15;
const cams={marshal:[[30,Y+3.5,Z-64],[37,Y+1.2,Z-76]],walk:[[-30,Y+3,Z-8],[-39,Y+1,Z-16]],work:[[33,Y+2.6,Z-42],[39.4,Y+.8,Z-49]]};
for(const[t,n]of[[13,'lights'],[20,'doors'],[23.5,'start'],[27.5,'engine'],[31.6,'move'],[33,'pass']]){await go(t);
  for(const[cn,[c,l]]of Object.entries(cams)){await p.evaluate((c,l)=>{window.__PCAM=cam=>{cam.position.set(...c);cam.lookAt(...l);cam.fov=40;cam.updateProjectionMatrix();};__SR.step(1/30);window.__PCAM=null;},c,l);T+=1/30;
    await p.screenshot({path:out('crew_'+n+'_'+cn+'.png')});}}
await b.close();

// 実際の AquaTopia 読み込み中に、ミニゲームが動けるか（画面を止める長い処理がないか）。node test/bnload.mjs
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();const MOB=process.env.MOBILE==='1',SLOW=+process.env.SLOW||1;await p.setViewport(MOB?{width:844,height:390,deviceScaleFactor:3,isMobile:true,hasTouch:true,isLandscape:true}:{width:960,height:640,deviceScaleFactor:2});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000,polling:100});
if(SLOW>1){const c=await p.target().createCDPSession();await c.send('Emulation.setCPUThrottlingRate',{rate:SLOW});}
await p.evaluate(()=>initAudio());await new Promise(r=>setTimeout(r,500));   // 実際のゲームでは AquaTopia のボタンを押した時点で音は用意済み
await p.evaluate(()=>{window.__lt=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push([Math.round(e.startTime),Math.round(e.duration)]);}).observe({type:'longtask'});
  window.__t0=performance.now();window.__done=false;exStartAsync().then(()=>{window.__done=performance.now()-window.__t0;});});
// 読み込み中にたたき続ける
let clicks=0;const t0=Date.now();
while(!(await p.evaluate(()=>window.__done))&&Date.now()-t0<120000){const cv=await p.$('canvas.bn');if(cv){const bb=await cv.boundingBox();const t=bb&&await p.evaluate(()=>{const b=BN.list&&BN.list.find(b=>!b.gone);return b?[b.x/BN.W,b.y/BN.H]:null;});if(bb&&t){await(MOB?p.touchscreen.tap(bb.x+bb.width*t[0],bb.y+bb.height*t[1]):p.mouse.click(bb.x+bb.width*t[0],bb.y+bb.height*t[1]));clicks++;}}await new Promise(r=>setTimeout(r,60));}
const r=await p.evaluate(()=>({done:Math.round(window.__done),lt:window.__lt.map(([s,d])=>[s-Math.round(window.__t0),d]),sc:BN.score?BN.score():null}));
const big=r.lt.filter(x=>x[1]>=100);const worst=Math.max(0,...r.lt.map(x=>x[1]));const blocked=r.lt.reduce((a,x)=>a+x[1],0);
console.log('読み込み',r.done,'ms  たたいた',clicks,'回  はがした',r.sc);console.log('100ms以上の停止',big.length,'回  最長',worst,'ms  止まっていた合計',blocked,'ms');console.log(JSON.stringify(big.slice(0,30)));
const lim=300*SLOW;   // 0.3 秒を超えて止まらないこと（0.1 秒前後の小さな引っかかりは、ほかのアプリの GPU 負荷で揺れるので数だけ記録）
console.log(errs[0]||(worst<=lim&&r.sc>=3?'読み込み中も遊べる':'読み込み中に止まる'));await b.close();

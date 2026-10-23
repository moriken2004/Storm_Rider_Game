// 巨大イカの現れ方：暗い海から少しずつ浮かび上がるか（明るさの推移と画像）。node test/krfade.mjs
import puppeteer from 'puppeteer';
const dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('bExplore').click();});await p.waitForFunction('EX.on&&!exLoading',{timeout:120000,polling:100});
await p.evaluate(()=>{const S=__SR,I=S.input;let q=null;for(let r=1200;r<3200&&!q;r+=40)for(let a=0;a<6.28;a+=.15){const x=BASE.x+Math.cos(a)*r,z=BASE.z+Math.sin(a)*r;if(exGround(x,z)<-80){q=[x,z];break;}}
  EX.pos.set(q[0],0,q[1]);EX.depth=0;for(let i=0;i<60*30;i++){I.tBoost=true;S.step(1/60);if(EX.depth>55)break;}I.tBoost=false;EX.krT=19.95;});
// 予兆（10 秒）の間は影がかすかに見えるだけ・目は出ない。襲いかかる瞬間（30 秒）に暗がりから浮かび上がる
const fades=[];let t=0;
for(const T of[1,4,8]){const n=Math.round((T-t)*60);t=T;const f=await p.evaluate(n=>{let mx=0;for(let i=0;i<n;i++){__SR.step(1/60);if(EX.kr&&EX.kr.phase===1)mx=Math.max(mx,KR.fade.value);}return{fade:+mx.toFixed(2),phase:EX.kr.phase,eyes:EX.kr.g.userData.eyes.filter(e=>e.visible).length,text:document.getElementById('exwarn').textContent};},n);fades.push(f);await p.screenshot({path:dir+'kr_omen_'+T+'.png'});}
await p.evaluate(()=>{EX.krT=29.99;});
for(const T of[.35,.8]){const f=await p.evaluate(n=>{for(let i=0;i<n;i++)__SR.step(1/60);return{fade:+KR.fade.value.toFixed(2),phase:EX.kr.phase,eyes:EX.kr.g.userData.eyes.filter(e=>e.visible).length,text:document.getElementById('exwarn').textContent};},Math.round((T-(fades.length>3?.35:0))*60));fades.push(f);await p.screenshot({path:dir+'kr_reveal_'+T+'.png'});}
console.log(JSON.stringify(fades));
const omen=fades.slice(0,3),rv=fades.slice(3);
const ok=omen.every(f=>f.phase===1&&f.fade<=.2&&f.eyes===0&&!/イカ/.test(f.text))&&rv[0].fade>.4&&rv[1].fade===1&&rv[1].eyes>0;
console.log(errs[0]||(ok?'イカは少しずつ現れる':'イカの現れ方に問題'));await b.close();

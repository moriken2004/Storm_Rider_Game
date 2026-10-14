// 武装モードの検査：隠しコマンド → 空域の外で迎撃機と交戦
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage();await p.setViewport({width:1280,height:720});p.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR');
for(const k of['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA']){await p.keyboard.down(k);await p.keyboard.up(k);}
await new Promise(r=>setTimeout(r,300));
console.log('隠しコマンド後',await p.evaluate(()=>JSON.stringify({armed:__SR.G.armed,badge:getComputedStyle(document.getElementById('armBadge')).display,toast:document.getElementById('toast').textContent})));
await p.screenshot({path:new URL('./out/armed_title.png',import.meta.url).pathname});
await p.reload();await p.waitForFunction('window.__SR');console.log('読み込み直し後',await p.evaluate(()=>__SR.G.armed));
for(const k of['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA']){await p.keyboard.down(k);await p.keyboard.up(k);}
const r=await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR,P=S.P,G=S.G,I=S.input,ICP=S.ICP,log=[];S.startRun('eye');P.pos.set(0,500,-16000);P.yaw=0;P.pitch=0;let last=-1,shotT=-1;
  for(let i=0;i<30*240&&G.mode!=='over';i++){const t=i/30;I.tx=0;I.ty=Math.max(-1,Math.min(1,(500-P.pos.y)/200));I.tGun=false;I.tMsl=false;
    if(G.mode==='cut'){S.endCut();continue;}
    // 交戦：生きている迎撃機へ機首を向け、ロックしたらミサイル、近ければ機銃
    const f=ICP.f.find(q=>q.mesh.visible&&!q.dead);if(f&&ICP.st>=4){const dx=f.pos.x-P.pos.x,dz=f.pos.z-P.pos.z;let e=Math.atan2(-dx,-dz)-P.yaw;while(e>3.1416)e-=6.2832;while(e<-3.1416)e+=6.2832;I.tx=Math.max(-1,Math.min(1,-e*2.5));I.ty=Math.max(-1,Math.min(1,(Math.max(f.pos.y,150)-P.pos.y)/150));
      if(G.lockT>=1.1&&i%20===0)I.tMsl=true;if(Math.abs(e)<.12&&Math.hypot(dx,dz)<900)I.tGun=true;}
    S.step(1/30);if(ICP.st!==last){log.push(t.toFixed(1)+'s st'+ICP.st+(ICP.cleared?'c':'')+' out'+Math.round(Math.hypot(P.pos.x,P.pos.z))+' '+G.mode+' '+G.phase);last=ICP.st;}
    if(ICP.cleared&&shotT<0){shotT=t;log.push(t.toFixed(0)+'s 2 機撃墜');}
    if(shotT>0&&t>shotT+12)break;}
  return{prompt:G.prompt&&G.prompt.t,st:ICP.st,log:log.join(' → '),mode:G.mode,hull:Math.round(P.hull),kills:G.stats.kills||0,msl:P.msl,wing:S.W.map(w=>w.state+(w.shot?'*':'')).join(','),out:Math.round(Math.min(Math.hypot(P.pos.x,P.pos.z)-16500,9e9))};});
console.log('交戦',JSON.stringify(r));
await b.close();

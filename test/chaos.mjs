// でたらめな操作を全局面で長く続け、例外・数値の異常・不正な状態を探す。node test/chaos.mjs
import puppeteer from 'puppeteer';
const issues=[];const note=m=>{if(issues.length<40)issues.push(m);};
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000});const p=await b.newPage();await p.setViewport({width:800,height:450});
p.on('pageerror',e=>note('PAGEERR '+e.message+' '+(e.stack||'').split('\n')[1]));p.on('console',m=>{const t=m.text();if(!/404/.test(t)&&(m.type()==='error'||/NaN|THREE\./.test(t)))note('CONSOLE '+t.slice(0,200));});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
await p.evaluate(()=>{window.__bad=()=>{const S=__SR,P=S.P,c=S.camera.position,f=v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);const r=[];if(!f(P.pos))r.push('P.pos');if(!f(P.vel))r.push('P.vel');if(!f(c))r.push('camera');if(!Number.isFinite(P.hull))r.push('hull');if(!Number.isFinite(P.speed))r.push('speed');S.W.forEach((w,i)=>{if(w.state!=='gone'&&!f(w.pos))r.push('W'+i);});S.ICP.f.forEach((q,i)=>{if(q.mesh.visible&&!f(q.pos))r.push('F'+i);});if(P.pos.y<-50)r.push('below sea');return r;};});
for(const armed of[false,true]){
  if(armed)for(const k of['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA']){await p.keyboard.down(k);await p.keyboard.up(k);}
  for(const ph of['approach','bands','wall','eye','spare','ret']){
    const r=await p.evaluate((ph,armed)=>{window.requestAnimationFrame=()=>0;const S=__SR,G=S.G,P=S.P,I=S.input;let seed=ph.length*977+(armed?5:0);const R=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
      G.ckpt=null;S.startRun(ph);if(G.mode==='cut')S.endCut();const bad=new Set(),modes={};let tx=0,ty=0,retries=0;
      for(let i=0;i<30*240;i++){
        if(G.mode==='cut'){if(R()<.02)S.endCut();S.step(1/30);modes.cut=(modes.cut||0)+1;continue;}
        if(G.mode==='over'){retries++;document.getElementById('bRetry').click();continue;}
        if(G.mode==='result'){modes.result=1;break;}
        if(G.mode==='dying'){S.step(1/30);modes.dying=(modes.dying||0)+1;continue;}
        if(i%20===0){tx=R()*2-1;ty=R()*2-1;}if(R()<.003)tx=tx>0?-1:1;
        I.tx=tx;I.ty=ty;I.tBoost=R()<.3;I.tAct=R()<.2;I.tGun=armed&&R()<.4;I.tMsl=armed&&R()<.05;if(R()<.004)I.rollQ=R()<.5?-1:1;
        if(R()<.0015){S.togglePause();for(let k=0;k<5;k++)S.step(1/30);S.togglePause();}
        S.step(1/30);modes[G.mode]=(modes[G.mode]||0)+1;
        if(i%15===0){const r=__bad?__bad():[];r.forEach(x=>bad.add(x));if(!Number.isFinite(P.boost)||P.boost<0||P.boost>100.01)bad.add('boost '+P.boost);if(P.hull>100.01)bad.add('hull>100');}
      }
      return{ph,armed,modes,retries,bad:[...bad].slice(0,6),final:G.mode};},ph,armed).catch(e=>({ph,err:e.message.slice(0,200)}));
    if(r.err)note(ph+' '+r.err);if(r.bad&&r.bad.length)note(ph+(armed?'(武装)':'')+' 異常 '+r.bad.join(','));
    console.log(JSON.stringify(r));}}
console.log('\n=== 問題 '+issues.length+' 件 ===');issues.forEach(s=>console.log(s));await b.close();

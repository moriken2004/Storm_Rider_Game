// 深海と巨大電気イカ：45m より深く潜れる、20 秒で予兆、30 秒で襲われて電撃 → ゲームオーバー、やり直しで元に戻る。浅く戻れば数え直し。node test/kraken.mjs
import puppeteer from 'puppeteer';
const dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{const t=m.text();if((m.type()==='error'||/shader error/.test(t))&&!/Failed to load resource/.test(t))errs.push(t.slice(0,200));});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('bExplore').click();});await p.waitForFunction('EX.on&&!exLoading',{timeout:120000,polling:100});
const o={};
o.dive=await p.evaluate(()=>{const S=__SR,I=S.input;let q=null;for(let r=1200;r<3200&&!q;r+=40)for(let a=0;a<6.28;a+=.15){const x=BASE.x+Math.cos(a)*r,z=BASE.z+Math.sin(a)*r;if(exGround(x,z)<-80){q=[x,z];break;}}
  if(!q)return 'なし';EX.pos.set(q[0],0,q[1]);EX.depth=0;window.__q=q;let mx=0;for(let i=0;i<60*30;i++){I.tBoost=true;S.step(1/60);mx=Math.max(mx,EX.depth);if(EX.depth>60)break;}I.tBoost=false;return{floor:+exGround(q[0],q[1]).toFixed(1),maxDepth:+mx.toFixed(1),krT:+(EX.krT||0).toFixed(1)};});
// 浅く戻すと数え直し
o.reset=await p.evaluate(()=>{const S=__SR;EX.krT=12;EX.depth=20;for(let i=0;i<120;i++)S.step(1/60);return +(EX.krT||0).toFixed(1);});
o.warn=await p.evaluate(()=>{const S=__SR,gl=S.renderer.getContext(),px=new Uint8Array(4);EX.depth=62;EX.krT=19.5;let mx=0;for(let i=0;i<90;i++){const t0=performance.now();S.step(1/60);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);mx=Math.max(mx,performance.now()-t0);}return{phase:EX.kr&&EX.kr.phase,warn:!document.getElementById('exwarn').hidden,text:document.getElementById('exwarn').textContent,maxFrameMs:Math.round(mx)};});
await p.screenshot({path:dir+'kr_warn.png'});
o.attack=await p.evaluate(()=>{const S=__SR,gl=S.renderer.getContext(),px=new Uint8Array(4);EX.krT=29.9;let mx=0;for(let i=0;i<60*4;i++){const t0=performance.now();S.step(1/60);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);mx=Math.max(mx,performance.now()-t0);}return{phase:EX.kr.phase,lock:EX.krLock,maxFrameMs:Math.round(mx)};});
await p.screenshot({path:dir+'kr_shock.png'});
o.over=await p.evaluate(()=>{const S=__SR;for(let i=0;i<60*3;i++)S.step(1/60);return{phase:EX.kr.phase,over:!document.getElementById('exover').hidden};});
await p.screenshot({path:dir+'kr_over.png'});
o.floor=await p.evaluate(()=>{const S=__SR;document.getElementById('bExRetry').click();const q=window.__q;const fl=exGround(q[0],q[1]);EX.pos.set(q[0],fl+2,q[1]);EX.depth=-fl-2;EX.krT=21;let worst=99;
  for(let i=0;i<120;i++){S.step(1/60);const k=EX.kr;worst=Math.min(worst,k.pos.y-(exGround(k.pos.x,k.pos.z)+11),...k.arms.map(a=>{const P=a.geo.attributes.position.array;let w=99;for(let j=0;j<P.length;j+=36)w=Math.min(w,P[j+1]-exGround(P[j],P[j+2])+.6);return w;}));}
  return{boatDepth:+EX.depth.toFixed(1),worstClear:+worst.toFixed(2)};});
o.retry=await p.evaluate(()=>{document.getElementById('bExRetry').click();for(let i=0;i<30;i++)__SR.step(1/60);return{over:!document.getElementById('exover').hidden,lock:EX.krLock,depth:EX.depth,krVis:EX.kr.g.visible,mode:__SR.G.mode};});
console.log(JSON.stringify(o));
const ok=o.warn.maxFrameMs<200&&o.attack.maxFrameMs<200&&o.floor.worstClear>-0.05&&o.dive.maxDepth>45&&o.reset<12&&o.warn.phase===1&&o.warn.warn&&o.attack.lock&&o.over.over&&!o.retry.over&&!o.retry.lock&&!o.retry.krVis;console.log(errs[0]||(ok?'深海の流れよし':'深海の流れに問題'));await b.close();

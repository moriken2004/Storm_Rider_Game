// 段ボール：ボートで突っ込むと箱が押されて崩れ、上の箱が落ちる。終了で元に戻る。node test/crates.mjs
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{const t=m.text();if((m.type()==='error'||/shader error/.test(t))&&!/Failed to load resource/.test(t))errs.push(t.slice(0,200));});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('bExplore').click();});await p.waitForFunction('EX.on&&!exLoading',{timeout:120000,polling:100});
const r=await p.evaluate(()=>{const S=__SR,I=S.input;const C=EX.crates;if(!C||!C.length)return{err:'箱がない'};
  // いちばん端の山の手前 9m から、山の中心へ向かって走る
  const c0=C[0].p0,cx=C.filter(c=>Math.abs(c.p0.x-c0.x)<3).reduce((a,c)=>a+c.p0.x,0)/C.filter(c=>Math.abs(c.p0.x-c0.x)<3).length;const cz=c0.z;
  const top0=Math.max(...C.map(c=>c.p.y));const sx=cx+(cx>0?-9:9);EX.pos.set(sx,exStandH(sx,cz,99),cz);EX.yaw=Math.atan2(sx-cx,0)||Math.PI/2*(sx>cx?1:-1);EX.depth=0;EX.spd=0;EX.camReset=true;
  for(let i=0;i<10;i++)S.step(1/30);EX.camFix=[cx+(cx>0?-6:6),EX.pos.y+3,cz+6,cx,EX.pos.y+.8,cz];
  for(let i=0;i<70;i++){I.ty=1;S.step(1/30);}I.ty=0;for(let i=0;i<90;i++)S.step(1/30);
  const moved=C.filter(c=>c.p.distanceTo(c.p0)>.3).length,fell=C.filter(c=>c.p0.y-c.p.y>.3).length,awake=C.filter(c=>c.awake).length,below=C.filter(c=>c.p.y-c.hy<exStandH(c.p.x,c.p.z,c.p.y)-.25).length;
  return{n:C.length,moved,fell,awake,below,boat:[+(EX.pos.x-cx).toFixed(1),+EX.pos.y.toFixed(2)]};});
console.log(JSON.stringify(r));await p.screenshot({path:'test/out/crates.png'});
const r2=await p.evaluate(()=>{EX.camFix=null;__SR.togglePause();document.getElementById('bPTitle').click();__SR.step(1/30);return EX.crates.filter(c=>c.moved).length;});
console.log('戻した後に動いたまま',r2);const ok=r.moved>=6&&r.fell>=3&&r.below===0&&r2===0;console.log(errs[0]||(ok?'崩れる':'崩れない'));await b.close();

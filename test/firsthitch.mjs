// 初めての場面で固まらないか：探検で初めて潜る・初めて浮上する・初めてブーストする・初めて陸に上がる瞬間の、1 コマの最長時間。node test/firsthitch.mjs
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('bExplore').click();});await p.waitForFunction('EX.on&&!exLoading',{timeout:120000,polling:100});
const r=await p.evaluate(()=>{const S=__SR,I=S.input,gl=S.renderer.getContext(),px=new Uint8Array(4);const run=(n,f)=>{let mx=0;for(let i=0;i<n;i++){if(f)f(i);const t0=performance.now();S.step(1/60);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);mx=Math.max(mx,performance.now()-t0);}return Math.round(mx);};
  const o={};run(30);o.base=run(30);
  o.dive=run(120,()=>{I.tBoost=true;});I.tBoost=false;
  o.surface=run(200,()=>{I.tAct=true;});I.tAct=false;
  o.boost=run(90,()=>{I.ty=1;I.tXb=true;});I.ty=0;I.tXb=false;
  EX.pos.set(BASE.x+735,0,BASE.z-1270);o.land=run(60,()=>{I.ty=1;});I.ty=0;return o;});
console.log(JSON.stringify(r));const worst=Math.max(r.dive,r.surface,r.boost,r.land);console.log(errs[0]||(worst<Math.max(150,r.base*4)?'初めての場面でも固まらない':'固まる場面あり'));await b.close();

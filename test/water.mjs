// 海面への接触：急降下・大きな傾き → 水没（墜落）、浅い角度 → 水を被って減速・小さな損傷、原型機の正しい姿勢 → 着水して浮き、加速して離水。node test/water.mjs
import puppeteer from 'puppeteer';
const dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:300000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:300000});
const run=(name,o)=>p.evaluate((name,o)=>{window.requestAnimationFrame=()=>0;document.getElementById('title').hidden=true;const S=__SR,G=S.G,P=S.P,I=S.input;
  S.opts.shape=o.shape;S.startRun('approach');if(G.mode==='cut')S.endCut();G.mode='play';P.inv=0;P.hull=100;
  P.pos.set(0,o.y,BASE.z-3200);P.yaw=0;P.pitch=o.pitch;P.roll=o.roll||0;P.speed=o.speed||150;const log=[];let on=false,lift=false,minSpd=999;
  for(let i=0;i<(o.n||150);i++){I.tx=0;I.ty=o.ty!==undefined?o.ty:o.pitch/.56;I.tBoost=false;if(o.roll){P.roll=o.roll;}
    if(o.after&&P.onWater&&i>o.after){I.tBoost=true;if(P.speed>110)I.ty=1;}
    S.step(1/30);if(P.onWater)on=true;if(on&&!P.onWater)lift=true;minSpd=Math.min(minSpd,P.speed);if(G.mode!=='play')break;}
  return{name,mode:G.mode,cause:G.cause||'',hull:Math.round(P.hull),y:+P.pos.y.toFixed(1),minSpd:Math.round(minSpd),onWater:on,lifted:lift,wash:+(G.wash||0).toFixed(2),wet:+(G.lensWet||0).toFixed(2)};},name,o);
const shape=await p.evaluate(()=>{for(let i=0;i<30;i++){__SR.opts.shape=i;if(typeof SHAPES!=='undefined'&&SHAPES[i]&&SHAPES[i].orig)return i;}return -1;});
const out=[];
out.push(await run('急降下',{shape:0,y:40,pitch:-.45,n:90}));
out.push(await run('大きな傾き',{shape:0,y:7,pitch:-.03,roll:1.0,n:60}));
out.push(await run('浅い角度でかすめる',{shape:0,y:7,pitch:-.04,ty:-.07,n:40}));
out.push(await run('通常機でそっと降りる',{shape:0,y:7,pitch:.03,ty:-.02,n:40}));
out.push(await run('原型機の着水と離水',{shape,y:7,pitch:.05,ty:-.02,n:600,after:120}));
for(const r of out)console.log(JSON.stringify(r));
const ok=out[0].mode!=='play'&&/水没/.test(out[0].cause)&&out[1].mode!=='play'&&out[2].mode==='play'&&out[2].hull<100&&out[2].hull>60&&out[2].wash>0&&out[4].onWater&&out[4].lifted&&!out[3].onWater;
console.log(ok?'問題なし':'問題あり');console.log(errs.slice(0,3).join('\n')||'エラーなし');await b.close();

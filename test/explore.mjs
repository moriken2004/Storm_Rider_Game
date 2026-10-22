// AquaTopia の確認：始める→水上を進む→浜へ上がる→沖で潜る→戻る。各場面を撮り、動きの状態とエラー・描画の重さを見る。node test/explore.mjs
import puppeteer from 'puppeteer';import {execFileSync} from 'child_process';
const dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{const t=m.text();if((m.type()==='error'||/shader error|ERROR:/.test(t))&&!/Failed to load resource/.test(t))errs.push('CONSOLE '+t.replace(/\n/g,' ').slice(0,300));});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('bExplore').click();});
const run=(n,inp,setup)=>p.evaluate((n,inp,setup)=>{const S=__SR,I=S.input;if(setup){(0,eval)(setup);EX.cam.set(EX.pos.x+9,EX.pos.y+5,EX.pos.z+9);}const gl=S.renderer.getContext(),px=new Uint8Array(4);let ms=0;
  for(let i=0;i<n;i++){I.tx=inp.x||0;I.ty=inp.y||0;I.tBoost=!!inp.dive;I.tAct=!!inp.up;const t0=performance.now();S.step(1/30);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);ms+=performance.now()-t0;}
  I.tx=I.ty=0;I.tBoost=I.tAct=false;return{mode:S.G.mode,ex:EX.mode,pos:[EX.pos.x-BASE.x,EX.pos.y,EX.pos.z-BASE.z].map(v=>+v.toFixed(1)),depth:+EX.depth.toFixed(1),spd:+EX.spd.toFixed(1),gnd:+exGround(EX.pos.x,EX.pos.z).toFixed(1),ms:+(ms/n).toFixed(1),grass:EX.grass.count,rocks:EX.rocks.count,weed:EX.weed.count,coral:EX.coral.count};},n,inp,setup);
const shots=[],out=[];const shot=async(name)=>{const f=dir+'ex_'+name+'.png';await p.screenshot({path:f});shots.push(f);};
out.push(['水上で前進',await run(150,{y:1})]);await shot('water');
out.push(['浜へ（陸へ上がる）',await run(240,{y:1},"EX.pos.set(BASE.x+420,0,BASE.z-1900);EX.yaw=Math.PI;EX.depth=0;")]);await shot('land');
out.push(['草地（陸の上）',await run(90,{y:.6,x:.3},"EX.pos.set(BASE.x-300,exGround(BASE.x-300,BASE.z-1000),BASE.z-1000);EX.yaw=0;EX.depth=0;")]);await shot('grass');
out.push(['沖で潜る',await run(300,{y:.5,dive:true},"EX.pos.set(BASE.x-200,0,BASE.z-2200);EX.yaw=Math.PI;EX.depth=0;")]);await shot('dive');
out.push(['海中を進む',await run(150,{y:1,dive:true})]);await shot('dive2');
out.push(['浮上',await run(200,{up:true})]);await shot('surface');
for(const[n,r]of out)console.log(n.padEnd(16),JSON.stringify(r));
execFileSync('/opt/homebrew/bin/ffmpeg',['-v','error','-y',...shots.flatMap(f=>['-i',f]),'-filter_complex',shots.map((_,i)=>'['+i+']scale=640:-1['+i+'s]').join(';')+';'+shots.map((_,i)=>'['+i+'s]').join('')+'xstack=inputs=6:layout=0_0|w0_0|w0+w1_0|0_h0|w0_h0|w0+w1_h0',dir+'ex_grid.jpg']);
// 一時停止→タイトルへ→出撃（探検の後始末が任務に残らないか）
{const r=await p.evaluate(()=>{const S=__SR,G=S.G;S.togglePause();const m1=G.mode,pv=!document.getElementById('pause').hidden;document.getElementById('bPTitle').click();for(let i=0;i<5;i++)S.step(1/30);
  const t={afterPause:m1,pauseShown:pv,title:G.mode,boat:EX.b.visible,patch:EX.patch.visible,det:DETU.uDet.value.x,under:finalMat.uniforms.uUnder.value,cls:document.body.className};
  document.getElementById('bStart').click();for(let i=0;i<30;i++)S.step(1/30);t.start=G.mode;t.boat2=EX.b.visible;return t;});
  console.log('一時停止→タイトル→出撃',JSON.stringify(r));if(!(r.afterPause==='pause'&&r.pauseShown&&r.title==='title'&&!r.boat&&!r.patch&&r.det>1e8&&r.under===0&&/cut|play/.test(r.start)))errs.push('後始末の問題');}
console.log(errs.slice(0,6).join('\n')||'エラーなし');await b.close();

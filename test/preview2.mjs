// 設定画面のプレビュー（格納庫と機体）が、新しい終わり方（水没・建物への激突・海面で失速・水上から）のあとでも出るか。格納庫が見えているかも確かめる
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:600000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
const over=`for(let i=0;i<600&&G.mode!=='over';i++)S.step(1/30);document.getElementById('bOTitle').click();`;
const cases={
  '水没→タイトル':`S.startRun('approach');if(G.mode==='cut')S.endCut();P.inv=0;P.pos.set(0,40,BASE.z-3200);P.pitch=-.5;S.input.ty=-1;`+over+`S.input.ty=0;`,
  '格納庫に激突→タイトル':`S.startRun('ret');if(G.mode==='cut')S.endCut();P.inv=0;P.pos.set(0,RWY_Y+20,BASE.z+HANGAR_Z-160);P.yaw=Math.PI;P.pitch=0;P.speed=150;`+over,
  '基地の建物に激突→タイトル':`S.startRun('ret');if(G.mode==='cut')S.endCut();P.inv=0;P.pos.set(330,40,BASE.z+330-80);P.yaw=Math.PI;P.pitch=-.3;`+over,
  '着水して浮く→一時停止→タイトル':`S.opts.shape=6;S.startRun('approach');if(G.mode==='cut')S.endCut();P.inv=0;P.pos.set(0,7,BASE.z-3200);P.pitch=.03;S.input.ty=-.02;for(let i=0;i<120;i++)S.step(1/30);S.input.ty=0;S.togglePause();document.getElementById('bPTitle').click();S.opts.shape=0;`,
  '再挑戦してから→タイトル':`S.startRun('bands');if(G.mode==='cut')S.endCut();P.inv=0;S.damage(999,'t');for(let i=0;i<400&&G.mode!=='over';i++)S.step(1/30);document.getElementById('bRetry').click();for(let i=0;i<60;i++)S.step(1/30);if(G.mode==='cut')S.endCut();S.damage(999,'t');`+over,
};
let bad=0;
for(const[n,c]of Object.entries(cases)){
  const r=await p.evaluate((c)=>{const S=__SR,G=S.G,P=S.P;eval(c);for(let i=0;i<10;i++)S.step(1/30);document.getElementById('bOpts').click();for(let i=0;i<40;i++)S.step(1/30);
    const v=P.pos.clone().project(S.camera);const HG=baseGroup.userData.hangar;let hv=true;for(let q=HG;q;q=q.parent)if(!q.visible)hv=false;
    let hvis=0;HG.traverse(o=>{if(o.isMesh&&o.visible)hvis++;});const cd=S.camera.position.distanceTo(new THREE.Vector3(BASE.x,RWY_Y,BASE.z+HANGAR_Z));
    return{mode:G.mode,optPrev:G.optPrev,meshVis:P.mesh.visible,hangarVis:hv,hangarMeshes:hvis,camToHangar:Math.round(cd),scr:[+v.x.toFixed(2),+v.y.toFixed(2)],pos:[P.pos.x,P.pos.y,P.pos.z].map(Math.round),banner:document.getElementById('banner').classList.contains('on')};},c);
  const ok=r.meshVis&&r.hangarVis&&r.camToHangar<200&&Math.abs(r.scr[0])<1&&!r.banner;if(!ok)bad++;console.log((ok?'✓ ':'✗ ')+n,JSON.stringify(r));
  await p.screenshot({path:out('prev2_'+Object.keys(cases).indexOf(n)+'.png')});
  await p.evaluate(()=>{document.querySelector('#opts .bBack').click();__SR.step(1/30);});}
{const r=await p.evaluate(()=>{const S=__SR,G=S.G,P=S.P;S.startRun('bands');if(G.mode==='cut')S.endCut();for(let i=0;i<30;i++)S.step(1/30);const c0=S.camera.position.clone();S.togglePause();document.getElementById('bPOpts').click();for(let i=0;i<20;i++)S.step(1/30);
    const v=P.pos.clone().project(S.camera),d=S.camera.position.distanceTo(P.pos);document.querySelector('#opts .bBack').click();S.step(1/30);const back=S.camera.position.distanceTo(c0);S.togglePause();for(let i=0;i<10;i++)S.step(1/30);
    return{prevOnScreen:Math.abs(v.x)<1&&Math.abs(v.y)<1&&v.z<1,dist:Math.round(d),restored:back<1,mode:G.mode,optPrev:G.optPrev};});
  const ok=r.prevOnScreen&&r.dist<60&&r.restored&&r.mode==='play'&&!r.optPrev;if(!ok)bad++;console.log((ok?'✓ ':'✗ ')+'一時停止中の設定で機体を見せる',JSON.stringify(r));}
console.log(bad?'問題 '+bad+' 件':'問題なし');await b.close();

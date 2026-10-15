// 設定画面の機体プレビューが、色々な終わり方のあとでも表示されるか（機体が画面中央に写るか）
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
const cases={
  '起動直後':`0`,
  '墜落（海）→タイトル':`S.startRun('bands');if(G.mode==='cut')S.endCut();P.inv=0;P.pos.y=12;P.pitch=-.6;for(let i=0;i<400&&G.mode!=='over';i++)S.step(1/30);document.getElementById('bOTitle').click();`,
  '撃墜（耐久0）→タイトル':`S.startRun('wall');if(G.mode==='cut')S.endCut();P.inv=0;S.damage(999,'t');for(let i=0;i<400&&G.mode!=='over';i++)S.step(1/30);document.getElementById('bOTitle').click();`,
  '主翼喪失→タイトル':`S.startRun('approach');if(G.mode==='cut')S.endCut();P.wingLost=1;P.wlT=0;for(let i=0;i<600&&G.mode!=='over';i++)S.step(1/30);document.getElementById('bOTitle').click();`,
  '任務完了→タイトル':`S.startRun('ret');if(G.mode==='cut')S.endCut();S.startCut(S.CUTS.CUT_LAND);for(let i=0;i<2000&&G.mode!=='result';i++)S.step(1/30);document.getElementById('bRTitle').click();`,
  '一時停止→タイトル':`S.startRun('eye');if(G.mode==='cut')S.endCut();S.togglePause();document.getElementById('bPTitle').click();`,
  '出撃カット途中→スキップ→一時停止→タイトル':`document.getElementById('title').hidden=true;S.startCut(S.CUTS.CUT_INTRO);for(let i=0;i<300;i++)S.step(1/30);S.endCut();S.togglePause();document.getElementById('bPTitle').click();`,
};
for(const[n,c]of Object.entries(cases)){
  const r=await p.evaluate((c)=>{const S=__SR,G=S.G,P=S.P;eval(c);for(let i=0;i<10;i++)S.step(1/30);document.getElementById('bOpts').click();for(let i=0;i<40;i++)S.step(1/30);
    // 機体が画面に写っているか：機体の中心を画面に投影し、見えている部品の数を数える
    const v=P.pos.clone().project(S.camera);let vis=0,tot=0;P.mesh.traverse(o=>{if(o.isMesh){tot++;let ok=true;for(let q=o;q;q=q.parent)if(!q.visible)ok=false;if(ok)vis++;}});
    let inScene=false;P.mesh.traverseAncestors(a=>{if(a.isScene)inScene=true;});
    return{mode:G.mode,optPrev:G.optPrev,meshVis:P.mesh.visible,parts:vis+'/'+tot,inScene,scr:[+v.x.toFixed(2),+v.y.toFixed(2),+v.z.toFixed(3)],pos:[P.pos.x,P.pos.y,P.pos.z].map(Math.round),opts:!document.getElementById('opts').hidden};},c);
  const ok=r.meshVis&&r.inScene&&Math.abs(r.scr[0])<1&&Math.abs(r.scr[1])<1&&r.scr[2]<1;console.log((ok?'✓ ':'✗ ')+n,JSON.stringify(r));
  await p.screenshot({path:out('prev_'+Object.keys(cases).indexOf(n)+'.png')});
  await p.evaluate(()=>{document.querySelector('#opts .bBack').click();__SR.step(1/30);});}
await b.close();

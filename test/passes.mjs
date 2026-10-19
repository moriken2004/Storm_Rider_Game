// 描画の段ごとの時間（GPU 完了まで）を場面別に測る。node test/passes.mjs
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--window-size=1600,900']});
const p=await b.newPage();await p.setViewport({width:1600,height:900,deviceScaleFactor:1.5});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:60000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('title').hidden=true;});
const run=async(label,setup)=>{await p.evaluate(setup);
  const r=await p.evaluate(()=>{const S=__SR;S.view.scale=1;S.view.upT=-9999;resize();const gl=renderer.getContext(),px=new Uint8Array(4),sync=()=>gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
    const orig=renderer.render.bind(renderer),acc={};let k=0;
    renderer.render=(sc,cam)=>{const m=sc.isScene&&sc.children.length===1&&sc.children[0].material?sc.children[0].material:null;const name=(m&&(m.name||m.userData.nm))||(sc===S.scene?'scene':m?'fs#'+(m.fragmentShader||'').length:'overlay');sync();const t=performance.now();orig(sc,cam);sync();acc[name]=(acc[name]||0)+performance.now()-t;};
    for(let i=0;i<6;i++)S.step(1/60);for(const k2 in acc)delete acc[k2];sync();const t0=performance.now(),N=30;for(let i=0;i<N;i++)S.step(1/60);sync();const tot=(performance.now()-t0)/N;renderer.render=orig;
    return{tot:+tot.toFixed(1),parts:Object.entries(acc).map(([k,v])=>[k,+(v/N).toFixed(2)]).sort((a,b)=>b[1]-a[1])};});
  console.log(label.padEnd(10),r.tot+'ms',JSON.stringify(r.parts));};
await run('approach','__SR.startRun("approach");if(__SR.G.mode==="cut")__SR.endCut();');
await run('bands','__SR.startRun("approach");__SR.G.flags.b3=1;__SR.P.pos.set(0,400,11000);__SR.tick(30)');
await run('wall','__SR.startRun("approach");__SR.G.flags.b3=__SR.G.flags.b4=1;__SR.P.pos.set(0,400,4300);__SR.tick(30)');
await run('wall低','__SR.startRun("approach");__SR.G.flags.b3=__SR.G.flags.b4=1;__SR.P.pos.set(0,140,4300);__SR.tick(30)');
await run('eye','__SR.startRun("eye")');
await b.close();

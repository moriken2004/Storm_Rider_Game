// 同じ場面で機能の入・切を交互に測る（PC の負荷のゆらぎを打ち消す）
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--window-size=1600,900']});
const p=await b.newPage();await p.setViewport({width:1600,height:900,deviceScaleFactor:1.5});
const errs=[];p.on('console',m=>{if(m.type()==='error'&&/ERROR/.test(m.text()))errs.push(m.text().split('\n').slice(0,3).join(' | '));});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:60000});
const ab=async(label,setup,offJs,onJs)=>{await p.evaluate(setup);
  const r=await p.evaluate((offJs,onJs)=>{__SR.view.scale=1;__SR.view.upT=-9999;resize();const gl=renderer.getContext(),px=new Uint8Array(4);const run=(js)=>{const f=new Function(js);let t=0;for(let i=0;i<10;i++){f();renderFrame();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);const t0=performance.now();f();renderFrame();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);t+=performance.now()-t0;}return t/10;};
    for(let i=0;i<8;i++)__SR.step(1/60);let a=0,c=0;for(let k=0;k<6;k++){a+=run(offJs);c+=run(onJs);}return[a/6,c/6];},offJs,onJs);
  console.log(label.padEnd(30),'切',r[0].toFixed(2),'ms  入',r[1].toFixed(2),'ms  差',(r[1]-r[0]).toFixed(2));};
const H='document.getElementById("title").hidden=true;';
await ab('雲の輪郭強調（接近）',H+'__SR.startRun("approach")','compMat.uniforms.uSharp.value=0','compMat.uniforms.uSharp.value=.8');
await ab('陽炎（接近）','1','finalMat.uniforms.uHeatAmt.value=0','finalMat.uniforms.uHeatAmt.value=.9');
await ab('すき間の陰影（格納庫）','__SR.startCut(__SR.CUTS.CUT_INTRO);__SR.tick(10*30)','compMat.uniforms.uAO.value=0','compMat.uniforms.uAO.value=1');
await ab('被写界深度（格納庫）','1','finalMat.uniforms.uDof.value=0','finalMat.uniforms.uDof.value=1');
await ab('光条（帰投・太陽正面）','__SR.endCut();__SR.startRun("ret");__SR.G.flags.e1=1','finalMat.uniforms.uRays.value=0','finalMat.uniforms.uRays.value=1');
console.log(errs.slice(0,2).join('\n')||'no errors');await b.close();

// 重さの段階ごとの描画時間（島の上空・壁雲の中）
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:1280,height:720,deviceScaleFactor:3});
p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
console.log(await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR,G=S.G;S.startRun('approach');if(G.mode==='cut')S.endCut();const gl=document.getElementById('gl').getContext('webgl2');const out=[];
  for(const[n,c,l]of[['島の上空',[-600,350,21000-900],[400,0,21300]],['壁雲の中',[2800,600,2800],[0,500,0]],['雨帯',[0,420,9800],[0,400,0]]]){window.__PCAM=cam=>{cam.position.set(...c);cam.lookAt(...l);cam.fov=62;cam.updateProjectionMatrix();};
    const acc=[0,0,0];for(let rep=0;rep<3;rep++)for(const t of(rep%2?[2,1,0]:[0,1,2])){S.setTier(t);S.cloudCut();for(let i=0;i<15;i++)S.step(1/30);gl.finish();const t0=performance.now();for(let i=0;i<30;i++){S.step(1/30);gl.finish();}acc[t]+=(performance.now()-t0)/90;}const row=[n,...acc.map((v,t)=>'段階'+t+' '+v.toFixed(1)+'ms')];out.push(row.join('  '));}
  S.setTier(0);return out.join('\n');}));
await b.close();

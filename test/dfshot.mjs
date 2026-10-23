// ディフューザーのマーキング（機番の刷り込み）を真横から撮る。node test/dfshot.mjs [名前]
import puppeteer from 'puppeteer';
const dir=new URL('./out/',import.meta.url).pathname,name=process.argv[2]||'df';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:1000,height:500,deviceScaleFactor:2});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000,polling:100});
const shot=await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const r=__SR.renderer,sc=new THREE.Scene();sc.background=new THREE.Color(0x8a96a0);sc.add(new THREE.HemisphereLight(0xffffff,0x445566,1.2));const dl=new THREE.DirectionalLight(0xffffff,2.2);dl.position.set(2,3,4);sc.add(dl);
  const d=buildDiffuser();sc.add(d);const out=[];for(const[side,cx]of[[1,1],[-1,-1]]){const cam=new THREE.PerspectiveCamera(22,2,.1,100);cam.position.set(side*4.2,0,1.06);cam.up.set(0,1,0);cam.lookAt(0,0,1.06);
    r.setRenderTarget(null);r.setSize(1000,500,false);r.render(sc,cam);out.push(r.domElement.toDataURL('image/png'));}return out;});
const fs=await import('fs');shot.forEach((u,i)=>fs.writeFileSync(dir+name+'_'+(i?'L':'R')+'.png',Buffer.from(u.split(',')[1],'base64')));console.log('撮影',dir+name+'_R.png');await b.close();

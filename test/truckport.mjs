// 港を走るコンテナトレーラーを、ゲームを進めた状態で撮る。node test/truckport.mjs [接頭辞]
import puppeteer from 'puppeteer';
const pre=process.argv[2]||'tp',dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:600000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:900,height:500});
await p.goto('http://127.0.0.1:8795/index.html',{timeout:120000});await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:300000,polling:300});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('bExplore').click();});await p.waitForFunction('EX.on&&!exLoading',{timeout:200000,polling:200});
const shots=await p.evaluate(()=>{const S=__SR;for(let i=0;i<120;i++)S.step(1/30);const trs=baseGroup.userData.trucks||baseGroup.userData.lodPort.userData.trucks;const out={};
  for(const k of[0,1]){const tr=trs[k];tr.updateMatrixWorld(true);const w=new V3();tr.getWorldPosition(w);const f=new V3(0,0,-1).applyQuaternion(tr.getWorldQuaternion(new THREE.Quaternion()));
    const cam=new THREE.PerspectiveCamera(45,900/500,.1,3000);cam.position.copy(w).addScaledVector(f,13).add(new V3(f.z*9,5,-f.x*9));cam.lookAt(w.x,w.y+2,w.z);
    S.renderer.setRenderTarget(null);S.renderer.setSize(900,500,false);S.renderer.render(scene,cam);out['t'+k]=S.renderer.domElement.toDataURL('image/jpeg',.88);}return out;});
const fs=await import('fs');for(const[k,u]of Object.entries(shots))fs.writeFileSync(dir+pre+'_'+k+'.jpg',Buffer.from(u.split(',')[1],'base64'));console.log('撮影');await b.close();

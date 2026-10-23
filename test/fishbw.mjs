// 漁船の舷側（ブルワーク）を近くから撮る。node test/fishbw.mjs [接頭辞]
import puppeteer from 'puppeteer';
const dir=new URL('./out/',import.meta.url).pathname,pre=process.argv[2]||'bw';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:900,height:500});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000,polling:100});
const shots=await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const r=__SR.renderer,out={};const sc=new THREE.Scene();sc.background=new THREE.Color(0x9fb3c2);sc.add(new THREE.HemisphereLight(0xffffff,0x556677,1.3));const dl=new THREE.DirectionalLight(0xffffff,2);dl.position.set(3,4,-2);sc.add(dl);
  const s=buildShip('fish');sc.add(s);const V={side:[[16,3.5,-2],[0,2.6,-2],40],bowq:[[9,5,-17],[0,2.8,-8],45],deck:[[0,6.5,-15],[0,2.6,-4],55],sternq:[[9,4.5,14],[0,2.6,4],45]};
  for(const[k,[c,t,f]]of Object.entries(V)){const cam=new THREE.PerspectiveCamera(f,900/500,.05,500);cam.position.set(...c);cam.lookAt(...t);r.setRenderTarget(null);r.setSize(900,500,false);r.render(sc,cam);out[k]=r.domElement.toDataURL('image/jpeg',.88);}return out;});
const fs=await import('fs');for(const[k,u]of Object.entries(shots))fs.writeFileSync(dir+pre+'_'+k+'.jpg',Buffer.from(u.split(',')[1],'base64'));
const {execSync}=await import('child_process');execSync(`python3 -c "
from PIL import Image
ims=[Image.open('${dir}${pre}_'+v+'.jpg').resize((450,250)) for v in ['side','bowq','deck','sternq']]
W=Image.new('RGB',(900,500));[W.paste(im,((i%2)*450,(i//2)*250)) for i,im in enumerate(ims)];W.save('${dir}${pre}_grid.jpg')"`);console.log('撮影');await b.close();

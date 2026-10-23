// 船を単体で近くから撮る（舷側・船首・甲板・船尾）。node test/shipclose.mjs <cargo|patrol|fish> [接頭辞]
import puppeteer from 'puppeteer';
const kind=process.argv[2]||'patrol',pre=process.argv[3]||'sc',dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:900,height:500});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000,polling:100});
const shots=await p.evaluate(kind=>{window.requestAnimationFrame=()=>0;const r=__SR.renderer,out={};const sc=new THREE.Scene();sc.background=new THREE.Color(0x9fb3c2);sc.add(new THREE.HemisphereLight(0xffffff,0x556677,1.3));const dl=new THREE.DirectionalLight(0xffffff,2);dl.position.set(3,4,-2);sc.add(dl);
  const s=buildShip(kind);sc.add(s);const bb=new THREE.Box3();bb.expandByObject(s.children[0]);bb.expandByObject(s.children[1]);const L=bb.max.z-bb.min.z,B=bb.max.x-bb.min.x,D=bb.max.y;
  const V={side:[[B*1.6,D*.9,-L*.1],[0,D*.8,-L*.1],50],bowq:[[B*1.1,D*1.5,-L*.62],[0,D*.9,-L*.3],50],deck:[[0,D*2.4,-L*.6],[0,D,-L*.15],55],sternq:[[B*1.1,D*1.4,L*.62],[0,D*.9,L*.3],50],deckmid:[[B*.8,D*2.2,0],[0,D,-L*.05],50],sternlow:[[B*.9,D*.4,L*.58],[0,D*.5,L*.38],50],bowdeck:[[0,D*1.9,-L*.22],[0,D*1.1,-L*.46],60],bowside:[[B*.9,D*1.3,-L*.44],[0,D*1.05,-L*.42],55],sterndeck:[[0,D*2.2,L*.3],[0,D*1.1,L*.48],60]};
  for(const[k,[c,t,f]]of Object.entries(V)){const cam=new THREE.PerspectiveCamera(f,900/500,.05,3000);cam.position.set(...c);cam.lookAt(...t);r.setRenderTarget(null);r.setSize(900,500,false);r.render(sc,cam);out[k]=r.domElement.toDataURL('image/jpeg',.88);}return out;},kind);
const fs=await import('fs');for(const[k,u]of Object.entries(shots))fs.writeFileSync(dir+pre+'_'+kind+'_'+k+'.jpg',Buffer.from(u.split(',')[1],'base64'));
const {execSync}=await import('child_process');execSync(`python3 -c "
from PIL import Image
ims=[Image.open('${dir}${pre}_${kind}_'+v+'.jpg').resize((450,250)) for v in ['side','bowq','deck','sternq','deckmid','sternlow','bowdeck','bowside','sterndeck','side']]
W=Image.new('RGB',(900,1250));[W.paste(im,((i%2)*450,(i//2)*250)) for i,im in enumerate(ims)];W.save('${dir}${pre}_${kind}_grid.jpg')"`);console.log('撮影');await b.close();

// コンテナトレーラーを単体で撮る。node test/truckshot.mjs [接頭辞]
import puppeteer from 'puppeteer';
const pre=process.argv[2]||'tk',dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:600000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:900,height:500});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8795/index.html',{timeout:120000});await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:300000,polling:300});
const shots=await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const r=__SR.renderer,out={};const sc=new THREE.Scene();sc.background=new THREE.Color(0x9fb3c2);sc.add(new THREE.HemisphereLight(0xffffff,0x556677,1.2));const dl=new THREE.DirectionalLight(0xffffff,2.2);dl.position.set(4,6,-3);sc.add(dl);
  const gnd=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:0x46484a,roughness:.9}));gnd.rotation.x=-Math.PI/2;sc.add(gnd);
  const a=buildTrailerTruck(0xb8382a,containerMat());sc.add(a);const e=buildTrailerTruck(0xe6e8e6,null);e.position.x=6;sc.add(e);
  const V={front:[[4.5,2.6,-13],[0,1.8,-6.5],45],side:[[-11,2.2,-1],[0,2,-1],50],cab:[[-3.6,2.4,-9.2],[0,2,-6.3],50],rear:[[-3,1.6,11.5],[0,1.2,6],45],empty:[[12,3.4,-2],[6,1,1.5],50],under:[[-5,.35,1],[0,.7,2],60]};
  for(const[k,[c,t,f]]of Object.entries(V)){const cam=new THREE.PerspectiveCamera(f,900/500,.05,500);cam.position.set(...c);cam.lookAt(...t);r.setRenderTarget(null);r.setSize(900,500,false);r.render(sc,cam);out[k]=r.domElement.toDataURL('image/jpeg',.88);}
  let n=0;a.traverse(o=>{if(o.isMesh)n++;});out.n=n;return out;});
console.log('部品の数（まとめた後）',shots.n,errs[0]||'');delete shots.n;
const fs=await import('fs');for(const[k,u]of Object.entries(shots))fs.writeFileSync(dir+pre+'_'+k+'.jpg',Buffer.from(u.split(',')[1],'base64'));
const {execSync}=await import('child_process');execSync(`python3 -c "
from PIL import Image
ims=[Image.open('${dir}${pre}_'+v+'.jpg').resize((450,250)) for v in ['front','side','cab','rear','empty','under']]
W=Image.new('RGB',(900,750));[W.paste(im,((i%2)*450,(i//2)*250)) for i,im in enumerate(ims)];W.save('${dir}${pre}_grid.jpg')"`);await b.close();

// 基地の作業車を単体で撮る（斜め前と斜め後ろ）。node test/vehshot.mjs [接頭辞]
import puppeteer from 'puppeteer';
const pre=process.argv[2]||'vh',dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:600000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:600,height:400});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8795/index.html',{timeout:120000});await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:300000,polling:300});
const shots=await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const r=__SR.renderer,out={};
  for(const[kind,hex]of[['tug',0xd9a21b],['gpu',0xd9a21b],['fuel',0xc9ced2],['fire',0xb3261c],['follow',0xd9a21b],['cart',0x2c4f7a]]){const sc=new THREE.Scene();sc.background=new THREE.Color(0x9fb3c2);sc.add(new THREE.HemisphereLight(0xffffff,0x556677,1.3));const dl=new THREE.DirectionalLight(0xffffff,2.2);dl.position.set(4,6,-3);sc.add(dl);
    const gnd=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshLambertMaterial({color:0x55585b}));gnd.rotation.x=-Math.PI/2;sc.add(gnd);
    const v=buildVehicle(kind,hex);sc.add(v);const bb=new THREE.Box3().setFromObject(v),sz=bb.getSize(new V3()),c=bb.getCenter(new V3()),R=Math.max(sz.x,sz.y,sz.z);
    for(const[k,dx,dz]of[['f',.8,-1],['r',-.8,1]]){const cam=new THREE.PerspectiveCamera(40,1.5,.05,500);cam.position.set(c.x+dx*R*.62,c.y+R*.3,c.z+dz*R*.72);cam.lookAt(c.x,c.y*.8,c.z);r.setRenderTarget(null);r.setSize(600,400,false);r.render(sc,cam);out[kind+'_'+k]=r.domElement.toDataURL('image/jpeg',.88);}
    let n=0;v.traverse(o=>{if(o.isMesh)n++;});out[kind+'_n']=n;}
  return out;});
const fs=await import('fs');const ns={};for(const[k,u]of Object.entries(shots)){if(k.endsWith('_n')){ns[k]=u;continue;}fs.writeFileSync(dir+pre+'_'+k+'.jpg',Buffer.from(u.split(',')[1],'base64'));}console.log(JSON.stringify(ns),errs[0]||'');
const {execSync}=await import('child_process');execSync(`python3 -c "
from PIL import Image
K=['tug','gpu','fuel','fire','follow','cart']
W=Image.new('RGB',(900,1200))
for i,k in enumerate(K):
  for j,s in enumerate(['f','r']):W.paste(Image.open('${dir}${pre}_'+k+'_'+s+'.jpg').resize((450,200)),(j*450,i*200))
W.save('${dir}${pre}_grid.jpg')"`);await b.close();

// アオリイカを単体で撮る（上・横・斜め前・下）。node test/squidshot.mjs [接頭辞]
import puppeteer from 'puppeteer';
const pre=process.argv[2]||'sq',dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:600000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:600,height:400});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200));});
await p.goto('http://127.0.0.1:8795/index.html',{timeout:120000});await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:300000,polling:300});
const shots=await p.evaluate(()=>{window.requestAnimationFrame=()=>0;seaInit();const r=__SR.renderer,out={};const sc=new THREE.Scene();sc.background=new THREE.Color(0x1d5a6e);sc.add(new THREE.HemisphereLight(0xcfeeff,0x203040,.55));const dl=new THREE.DirectionalLight(0xffffff,.7);dl.position.set(1,4,-1);sc.add(dl);
  const m=new THREE.InstancedMesh(SEA.squid.geometry,SEA.squid.material,1);m.setMatrixAt(0,new THREE.Matrix4().makeTranslation(0,-8,0));m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array([.95,.86,.78]),3);m.frustumCulled=false;sc.add(m);U.uTime.value=1.3;
  const V={top:[[0,-6.9,-.06],[0,-8,-.06]],side:[[1.0,-7.88,-.06],[0,-8,-.06]],front:[[.45,-7.65,.7],[0,-8,.05]],q:[[-.6,-7.55,-.75],[0,-8,-.1]]};
  for(const[k,[c,t]]of Object.entries(V)){const cam=new THREE.PerspectiveCamera(45,1.5,.01,50);cam.position.set(...c);cam.up.set(0,1,0);if(k==='top')cam.up.set(0,0,-1);cam.lookAt(...t);r.setRenderTarget(null);r.setSize(600,400,false);r.render(sc,cam);out[k]=r.domElement.toDataURL('image/jpeg',.88);}return out;});
const fs=await import('fs');for(const[k,u]of Object.entries(shots))fs.writeFileSync(dir+pre+'_'+k+'.jpg',Buffer.from(u.split(',')[1],'base64'));
const {execFileSync}=await import('child_process');execFileSync('python3',['-c',`from PIL import Image\nK=['top','side','front','q']\nW=Image.new('RGB',(1200,800))\nfor i,k in enumerate(K):W.paste(Image.open('${dir}${pre}_'+k+'.jpg'),((i%2)*600,(i//2)*400))\nW.save('${dir}${pre}_grid.jpg')`]);console.log(errs[0]||'撮影');await b.close();

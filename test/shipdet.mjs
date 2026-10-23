// 船を単体で組み立て、水を除いて撮る：スクリューと船体（めり込み）・船首と船尾の船名（歪み）。node test/shipdet.mjs [接頭辞]
import puppeteer from 'puppeteer';
const dir=new URL('./out/',import.meta.url).pathname,pre=process.argv[2]||'sd';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:900,height:500,deviceScaleFactor:1});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000,polling:100});
const shots=await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const r=__SR.renderer,out={};
  for(const kind of['cargo','patrol','fish']){const sc=new THREE.Scene();sc.background=new THREE.Color(0x8a96a0);sc.add(new THREE.HemisphereLight(0xffffff,0x556677,1.3));const dl=new THREE.DirectionalLight(0xffffff,2);dl.position.set(3,4,2);sc.add(dl);
    const s=buildShip(kind);sc.add(s);s.updateMatrixWorld(true);const bb=new THREE.Box3();bb.expandByObject(s.children[0]);bb.expandByObject(s.children[1]);const L=bb.max.z-bb.min.z,H=bb.max.y-bb.min.y,B=bb.max.x-bb.min.x;
    // 船尾の下：横から（x+）と斜め後ろ下から
    const yb=bb.min.y,ym=bb.min.y+H*.5,zt=bb.max.z;
    const views={stern_side:[[B*2.2,yb+H*.2,zt-L*.08],[0,yb+H*.2,zt-L*.08],34],stern_low:[[B*.9,yb-H*.25,zt+L*.12],[0,yb+H*.15,zt-L*.06],34],
      bow_name:[[B*2.6,ym,bb.min.z+L*.12],[0,ym,bb.min.z+L*.12],34],stern_name:[[B*2.6,ym,zt-L*.1],[0,ym,zt-L*.1],34],bow_name_p:[[-B*2.6,ym,bb.min.z+L*.12],[0,ym,bb.min.z+L*.12],34]};
    for(const[k,[c,t,f]]of Object.entries(views)){const cam=new THREE.PerspectiveCamera(f,900/500,.1,2000);cam.position.set(...c);cam.lookAt(...t);r.setRenderTarget(null);r.setSize(900,500,false);r.render(sc,cam);out[kind+'_'+k]=r.domElement.toDataURL('image/jpeg',.85);}}
  return out;});
const fs=await import('fs');for(const[k,u]of Object.entries(shots))fs.writeFileSync(dir+pre+'_'+k+'.jpg',Buffer.from(u.split(',')[1],'base64'));
console.log(Object.keys(shots).length,'枚',errs[0]||'');await b.close();

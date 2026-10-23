// 港の構造物を水を除いて撮る（防波堤の堤頭と標識灯・水中の斜面・突堤・護岸・沖の岩礁）。node test/harbshot.mjs [接頭辞]
import puppeteer from 'puppeteer';
const pre=process.argv[2]||'hb',dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:600000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:900,height:500});
await p.goto('http://127.0.0.1:8795/index.html',{timeout:120000});await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:300000,polling:300});
const shots=await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const r=__SR.renderer,out={};const sc=new THREE.Scene();sc.background=new THREE.Color(0x7d95a6);sc.add(new THREE.HemisphereLight(0xffffff,0x556677,1.2));const dl=new THREE.DirectionalLight(0xffffff,2);dl.position.set(3,5,2);sc.add(dl);
  // 基地の物を借りて描く（位置は基地の座標のまま）
  const keep=[],vis=[];baseGroup.traverse(o=>{if(!o.isMesh&&!o.visible){vis.push(o);o.visible=true;}});for(const c of baseGroup.children.slice()){keep.push([c,c.parent]);sc.add(c);}
  const hd=baseGroup.userData.bwHeads||[[1668,40],[1668,250]];const T=(x,y,z)=>[x,y,z];
  const V={head:[[hd[0][0]+40,26,hd[0][1]+35],[hd[0][0],4,hd[0][1]],45],head2:[[hd[1][0]+38,22,hd[1][1]-30],[hd[1][0],5,hd[1][1]],45],bw_under:[[1560,-9,-150],[1500,-6,-185],60],
    pier_under:[[1420,-8,-10],[1380,-8,20],60],rev_under:[[1400,-7,-230],[1360,-7,-270],60],reef:[[-1260,-6,1450],[-1330,-6,1400],60]};
  {const tr=(baseGroup.userData.trucks||[])[1]||(baseGroup.userData.lodPort&&baseGroup.userData.lodPort.userData.trucks||[])[1];if(tr){const q=tr.position;V.truck=[[q.x+14,q.y+6,q.z-12],[q.x,q.y+2,q.z],45];}}
  for(const[k,[c,t,f]]of Object.entries(V)){const cam=new THREE.PerspectiveCamera(f,900/500,.1,4000);cam.position.set(c[0],c[1],c[2]);cam.lookAt(t[0],t[1],t[2]);r.setRenderTarget(null);r.setSize(900,500,false);r.render(sc,cam);out[k]=r.domElement.toDataURL('image/jpeg',.85);}
  for(const[c,pa]of keep)pa.add(c);for(const o of vis)o.visible=false;return out;});
const fs=await import('fs');for(const[k,u]of Object.entries(shots))fs.writeFileSync(dir+pre+'_'+k+'.jpg',Buffer.from(u.split(',')[1],'base64'));
const {execSync}=await import('child_process');execSync(`python3 -c "
from PIL import Image
ims=[Image.open('${dir}${pre}_'+v+'.jpg').resize((450,250)) for v in ['head','head2','bw_under','pier_under','rev_under','reef','truck']]
W=Image.new('RGB',(900,1000));[W.paste(im,((i%2)*450,(i//2)*250)) for i,im in enumerate(ims)];W.save('${dir}${pre}_grid.jpg')"`);console.log('撮影');await b.close();

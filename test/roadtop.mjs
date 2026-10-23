// 道路のつなぎ目を真上から撮る。node test/roadtop.mjs [接頭辞]
import puppeteer from 'puppeteer';
const pre=process.argv[2]||'rt',dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:600000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:600,height:600});
await p.goto('http://127.0.0.1:8795/index.html',{timeout:120000});await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:300000,polling:300});
const V=process.env.ZOOM?{js:[214,302,16],js2:[222,304,30],pt:[1112,191,22],pt2:[1118,190,45]}:{corner1:[217,328,45],corner2:[217,392,45],t400:[225,400,50],j620:[210,625,60],jstart:[215,300,55],j40:[215,-40,45],port:[1100,195,70],mid:[640,320,90]};
const shots=await p.evaluate((V)=>{window.requestAnimationFrame=()=>0;const r=__SR.renderer,out={};const sc=new THREE.Scene();sc.background=new THREE.Color(0x335566);sc.add(new THREE.HemisphereLight(0xffffff,0x556677,1.3));const dl=new THREE.DirectionalLight(0xffffff,1.4);dl.position.set(2,6,1);sc.add(dl);
  const vis=[];baseGroup.traverse(o=>{if(!o.isMesh&&!o.visible){vis.push(o);o.visible=true;}});const keep=[];for(const c of baseGroup.children.slice()){keep.push(c);sc.add(c);}
  for(const[k,[x,z,s]]of Object.entries(V)){const cam=new THREE.OrthographicCamera(-s,s,s,-s,1,3000);cam.position.set(x,400,z);cam.up.set(0,0,-1);cam.lookAt(x,0,z);r.setRenderTarget(null);r.setSize(600,600,false);r.render(sc,cam);out[k]=r.domElement.toDataURL('image/jpeg',.85);}
  for(const c of keep)baseGroup.add(c);for(const o of vis)o.visible=false;return out;},V);
const fs=await import('fs');for(const[k,u]of Object.entries(shots))fs.writeFileSync(dir+pre+'_'+k+'.jpg',Buffer.from(u.split(',')[1],'base64'));
const {execFileSync}=await import('child_process');execFileSync('python3',['-c',`from PIL import Image
K=${JSON.stringify(Object.keys(V))}
W=Image.new('RGB',(1200,600))
for i,k in enumerate(K):W.paste(Image.open('${dir}${pre}_'+k+'.jpg').resize((300,300)),((i%4)*300,(i//4)*300))
W.save('${dir}${pre}_grid.jpg')`]);console.log('撮影');await b.close();

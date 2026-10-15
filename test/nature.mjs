// 島の岩・森・並木・クレーン・救命艇・格納庫の階段を寄りで撮る（見た目の確認用）
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;
const tag=process.argv[2]||'a';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:1280,height:720});p.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:60000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR;S.startRun('approach');if(S.G.mode==='cut')S.endCut();for(let i=0;i<5;i++)S.step(1/30);document.getElementById('hud').style.visibility='hidden';document.getElementById('radio')&&(document.getElementById('radio').style.visibility='hidden');});
const Z=21000,V={rock:[[-1330,30,Z-700],[-1430,20,Z-760]],avenue:[[-120,25,Z-300],[-170,12,Z-200]],
  crane:[[1330,40,Z+20],[1276,30,Z+60]],crane2:[[1200,25,Z+60],[1280,35,Z+60]],stairs:[[22,21,Z+1085-40],[10,16,Z+1085-60]]};
// 地形の上から撮る視点：[x,地面からの高さ,z] → 見る点 [x,地面からの高さ,z]
const G2={forestA:[[-1150,30,Z-250],[-700,25,Z-150]],forestB:[[650,35,Z-950],[350,20,Z-800]],forestC:[[-600,180,Z+1300],[-300,0,Z+700]]};
for(const[n,[c,l]]of Object.entries(G2)){await p.evaluate((c,l)=>{const gy=(x,z)=>Math.max(islandH(x,z-21000),0);window.__PCAM=cam=>{cam.position.set(c[0],gy(c[0],c[2])+c[1],c[2]);cam.lookAt(l[0],gy(l[0],l[2])+l[1],l[2]);cam.fov=55;cam.updateProjectionMatrix();};for(let i=0;i<3;i++)__SR.step(1/30);},c,l);await p.screenshot({path:out('nat_'+n+'_'+tag+'.png')});}
for(const[n,[c,l]]of Object.entries(V)){await p.evaluate((c,l)=>{window.__PCAM=cam=>{cam.position.set(...c);cam.lookAt(...l);cam.fov=55;cam.updateProjectionMatrix();};for(let i=0;i<3;i++)__SR.step(1/30);},c,l);await p.screenshot({path:out('nat_'+n+'_'+tag+'.png')});}
// 救命艇（貨物船の船尾）
await p.evaluate(()=>{const s=__SR.ships[0];window.__PCAM=c=>{const cc=Math.cos(s.h),sn=Math.sin(s.h),ox=-40,oz=120;c.position.set(s.x+ox*cc+oz*sn,28,s.z-ox*sn+oz*cc);c.lookAt(s.x+sn*84,16,s.z+cc*84);c.fov=40;c.updateProjectionMatrix();};for(let i=0;i<3;i++)__SR.step(1/30);});
await p.screenshot({path:out('nat_lifeboat_'+tag+'.png')});
await b.close();

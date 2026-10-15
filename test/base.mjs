// 道・基地・浜・貨物船の船尾を撮る（見た目の確認用）。node test/base.mjs <tag>
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;const tag=process.argv[2]||'a';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:1280,height:720});p.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:60000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR;S.startRun('approach');if(S.G.mode==='cut')S.endCut();for(let i=0;i<5;i++)S.step(1/30);document.getElementById('hud').style.visibility='hidden';});
// [x, 地面からの高さ, z] → [x, 地面からの高さ, z]（z は基地基準）
const V={road1:[[700,14,300],[900,4,250]],road2:[[960,30,180],[620,2,330]],road3:[[520,60,420],[900,0,250]],
  base1:[[-500,220,-600],[0,10,200]],base2:[[200,45,900],[0,15,1085]],base3:[[300,30,-300],[230,10,0]],base4:[[-120,40,500],[60,10,350]],
  };
// 浜：角度ごとに海岸線を探し、沖から浜を見る
for(const[n,a]of[['beach1',3.0],['beach2',1.75],['beach3',-1.1],['beach4',2.4]]){await p.evaluate((a)=>{let r=300;while(r<2600&&islandH(Math.cos(a)*r,Math.sin(a)*r)>0)r+=4;const cx=Math.cos(a),cz=Math.sin(a),tx=-cz,tz=cx;
  window.__PCAM=cam=>{cam.position.set(cx*(r+70)+tx*40,9,cz*(r+70)+tz*40+21000);cam.lookAt(cx*(r-25)-tx*20,1.5,cz*(r-25)-tz*20+21000);cam.fov=50;cam.updateProjectionMatrix();};for(let i=0;i<3;i++)__SR.step(1/30);},a);await p.screenshot({path:out('base_'+n+'_'+tag+'.png')});}
for(const[n,[c,l]]of Object.entries(V)){await p.evaluate((c,l)=>{const gy=(x,z)=>Math.max(islandH(x,z),0);window.__PCAM=cam=>{cam.position.set(c[0],gy(c[0],c[2])+c[1],c[2]+21000);cam.lookAt(l[0],gy(l[0],l[2])+l[1],l[2]+21000);cam.fov=55;cam.updateProjectionMatrix();};for(let i=0;i<3;i++)__SR.step(1/30);},c,l);await p.screenshot({path:out('base_'+n+'_'+tag+'.png')});}
for(const[n,ox,oy,oz,ly]of[['stern1',-30,6,130,4],['stern2',25,2,118,3],['stern3',0,12,140,8]]){await p.evaluate((ox,oy,oz,ly)=>{const s=__SR.ships[0];window.__PCAM=c=>{const cc=Math.cos(s.h),sn=Math.sin(s.h);c.position.set(s.x+ox*cc+oz*sn,oy,s.z-ox*sn+oz*cc);c.lookAt(s.x+sn*92,ly,s.z+cc*92);c.fov=45;c.updateProjectionMatrix();};for(let k=0;k<3;k++)__SR.step(1/30);},ox,oy,oz,ly);await p.screenshot({path:out('base_'+n+'_'+tag+'.png')});}
await b.close();

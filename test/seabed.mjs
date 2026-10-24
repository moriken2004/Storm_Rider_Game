// 海底（サンゴ礁・アマモ場・カジメの林）を探検で潜って撮る。node test/seabed.mjs [接頭辞]
import puppeteer from 'puppeteer';
const pre=process.argv[2]||'sb',dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:900,height:500});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8795/index.html',{timeout:120000});await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:300000,polling:300});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('bExplore').click();});await p.waitForFunction('EX.on&&!exLoading',{timeout:200000,polling:200});
// 種類ごとに探す：サンゴ礁・アマモ場・カジメ
const spots=await p.evaluate(()=>{const out={};for(let r=200;r<3000&&Object.keys(out).length<3;r+=37)for(let a=0;a<6.28;a+=.13){const x=BASE.x+Math.cos(a)*r,z=BASE.z+Math.sin(a)*r,h=exGround(x,z);
  if(!out.reef&&h<-6&&h>-12&&typeof hash2==='function'&&hash2(Math.floor(x/40),Math.floor(z/40),91)>.58)out.reef=[x,z,h];
  if(!out.kelp&&h<-5&&h>-12&&typeof hash2==='function'&&hash2(Math.floor(x/40),Math.floor(z/40),91)<=.58&&hash2(Math.floor(x/30),Math.floor(z/30),92)>=.5)out.kelp=[x,z,h];
  if(!out.eel&&h<-2.5&&h>-6&&typeof hash2==='function'&&hash2(Math.floor(x/30),Math.floor(z/30),92)<.5)out.eel=[x,z,h];}return out;});
console.log(JSON.stringify(spots));
for(const[k,[x,z,h]]of Object.entries(spots)){for(const[j,yaw]of[[0,0],[1,2.1]]){await p.evaluate(([x,z,h,yaw])=>{EX.pos.set(x,h+2.2,z);EX.depth=-(h+2.2);EX.mode='dive';EX.yaw=yaw;EX.vel.set(0,0,0);
    // ボートを隠し、カメラを海底すれすれ（1.2m）に置いて水平に見る
    window.__PCAM=(cam)=>{EX.b.visible=false;const gx=x+Math.sin(yaw)*6,gz=z+Math.cos(yaw)*6;cam.position.set(x-Math.sin(yaw)*2,exGround(x-Math.sin(yaw)*2,z-Math.cos(yaw)*2)+1.3,z-Math.cos(yaw)*2);cam.lookAt(gx,exGround(gx,gz)+.5,gz);};
    for(let i=0;i<50;i++){EX.pos.set(x,h+2.2,z);EX.vel.set(0,0,0);__SR.step(1/30);}},[x,z,h,yaw]);
  await p.screenshot({path:dir+pre+'_'+k+'_'+j+'.jpg',type:'jpeg',quality:85});}}
console.log(errs[0]||'撮影');await b.close();

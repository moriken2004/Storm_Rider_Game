// 海面を撮る：水深 4・12・40m の所を斜め上から見下ろす（底の透け方）と、水平線方向（波と泡）。node test/surface.mjs [接頭辞] [ポート]
import puppeteer from 'puppeteer';
const pre=process.argv[2]||'sf',port=process.argv[3]||'8795',dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:900,height:500});
await p.goto('http://127.0.0.1:'+port+'/index.html',{timeout:120000});await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:300000,polling:300});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('bExplore').click();});await p.waitForFunction('EX.on&&!exLoading',{timeout:200000,polling:200});
const spots=await p.evaluate(()=>{const out={};for(let r=300;r<2800&&Object.keys(out).length<3;r+=29)for(let a=0;a<6.28;a+=.09){const x=BASE.x+Math.cos(a)*r,z=BASE.z+Math.sin(a)*r;let ok=true;for(const[dx,dz]of[[15,0],[-15,0],[0,15],[0,-15],[25,25]]){const h=exGround(x+dx,z+dz);if(Math.abs(h-exGround(x,z))>2.5)ok=false;}if(!ok)continue;const h=exGround(x,z);
  if(!out.d4&&h<-3.5&&h>-5)out.d4=[x,z];if(!out.d12&&h<-11&&h>-13.5)out.d12=[x,z];if(!out.d40&&h<-37&&h>-43)out.d40=[x,z];}return out;});
const shot=async(name,x,z,cam)=>{await p.evaluate(([x,z,cam])=>{EX.pos.set(x,0,z);EX.depth=0;EX.mode='water';EX.vel.set(0,0,0);window.__PCAM=(c)=>{EX.b.visible=false;c.position.set(x+cam[0],cam[1],z+cam[2]);c.lookAt(x+cam[3],cam[4],z+cam[5]);};for(let i=0;i<45;i++){EX.pos.set(x,0,z);EX.vel.set(0,0,0);__SR.step(1/30);}},[x,z,cam]);await p.screenshot({path:dir+pre+'_'+name+'.jpg',type:'jpeg',quality:86});};
for(const k of['d4','d12','d40'])if(spots[k])await shot(k,spots[k][0],spots[k][1],[0,7,-6,0,0,6]);
if(spots.d12){await shot('hz',spots.d12[0],spots.d12[1],[0,2.2,0,0,0,60]);await shot('mid',spots.d12[0],spots.d12[1],[0,9,0,0,0,45]);}
console.log(JSON.stringify(Object.keys(spots)));await b.close();

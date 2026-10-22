import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
for(const btn of['bExplore','bStart']){const p=await b.newPage();await p.setViewport({width:960,height:540});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000});
const r=await p.evaluate(btn=>{window.requestAnimationFrame=()=>0;const S=__SR;S.step(1/30);const gl=S.renderer.getContext(),px=new Uint8Array(4);const t0=performance.now();document.getElementById(btn).click();const t1=performance.now();
 const f=[];for(let i=0;i<6;i++){const a=performance.now();S.step(1/30);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);f.push(Math.round(performance.now()-a));}return{click:Math.round(t1-t0),frames:f};},btn);
console.log(btn,JSON.stringify(r));await p.close();}
await b.close();

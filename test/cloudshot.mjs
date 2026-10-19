// 雲の見た目の比較用に、決まった場面を撮る。node test/cloudshot.mjs <接頭辞>
import puppeteer from 'puppeteer';
const pre=process.argv[2]||'a',dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:1280,height:720});
await p.evaluateOnNewDocument(()=>{let a=7;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:60000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('title').hidden=true;});
for(const[n,s]of[['approach','__SR.startRun("approach");if(__SR.G.mode==="cut")__SR.endCut();'],['wall','__SR.startRun("approach");__SR.G.flags.b3=__SR.G.flags.b4=1;__SR.P.pos.set(0,400,4300);'],['eye','__SR.startRun("eye")']]){
  await p.evaluate(s=>{(0,eval)(s);const S=__SR;S.view.scale=1;S.view.upT=-9999;resize();for(let i=0;i<40;i++)S.step(1/30);},s);
  await p.screenshot({path:dir+'cl_'+pre+'_'+n+'.png'});}
await b.close();

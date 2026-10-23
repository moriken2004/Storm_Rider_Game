import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--disable-gpu-program-cache','--disable-gpu-shader-disk-cache']});const p=await b.newPage();await p.setViewport({width:960,height:640,deviceScaleFactor:2});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000,polling:100});
const r=await p.evaluate(async()=>{initAudio();await new Promise(r=>setTimeout(r,300));const lt=[];const t0=performance.now();new PerformanceObserver(l=>{for(const e of l.getEntries())if(e.duration>=100)lt.push([Math.round(e.startTime-t0),Math.round(e.duration)]);}).observe({type:'longtask'});
  const orig=exPrecompile;let keys0=null;window.exPrecompile=async(p)=>{await orig(p);keys0=new Map(renderer.info.programs.map(q=>[q.id,q.cacheKey]));};
  await exStartAsync();const tl=Math.round(performance.now()-t0);
  const nw=renderer.info.programs.filter(q=>!keys0.has(q.id));
  // 似た既存のキーとの違い
  const old=[...keys0.values()];const diff=nw.slice(0,4).map(q=>{const a=q.cacheKey.split(',');let best=null,bd=1e9;for(const k of old){const b=k.split(',');if(b.length!==a.length)continue;let d=0;const di=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i]){d++;di.push(i+':'+b[i]+'→'+a[i]);}if(d<bd){bd=d;best=di;}}return q.name+' '+JSON.stringify(best);});
  // 出発後 3 秒のコマ
  const fr=[];let last=performance.now();const t1=performance.now();await new Promise(r=>{const f=()=>{const n=performance.now();fr.push(n-last);last=n;if(n-t1<3000)requestAnimationFrame(f);else r();};requestAnimationFrame(f);});
  return{load:tl,stalls:lt,nNew:nw.length,diff,maxFrame:Math.round(Math.max(...fr)),newAfter:renderer.info.programs.length-keys0.size-nw.length};});
console.log(JSON.stringify(r,null,1));await b.close();

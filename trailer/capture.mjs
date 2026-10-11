// 予告編の撮影：node trailer/capture.mjs preview|final
import puppeteer from 'puppeteer';
import fs from 'fs';
const mode=process.argv[2]||'preview',only=process.argv[3];
const W=mode==='final'?1920:640,H=mode==='final'?1080:360,FPS=mode==='final'?60:30,every=mode==='final'?1:6,DSF=mode==='final'?1.5:1;
const dir=new URL('./',import.meta.url).pathname,fdir=dir+'frames/';
if(mode==='final'&&!only){fs.rmSync(fdir,{recursive:true,force:true});fs.mkdirSync(fdir);}
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required',`--window-size=${W},${H}`]});
const p=await b.newPage();await p.setViewport({width:W,height:H,deviceScaleFactor:DSF});p.on('pageerror',e=>console.log('PAGEERR '+e.message));
// 乱数を固定（撮り直しても同じ画になるように）
await p.evaluateOnNewDocument(()=>{let s=20261010;Math.random=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:30000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR;S.opts.q=2;S.view.scale=1;S.resize();
  const st=document.createElement('style');st.textContent=`#radio,#skip,#hint,#banner,#card,#touch,#sleep,#prompt,#barT,#barB,#load{display:none!important}
   body.nohud #hud,body.nohud #fhud{display:none!important}
   body.notitle #title{display:none!important}
   #title button,#diff,#diffT,#title .menu{display:none!important}
   #plate{transform:scale(1.75);transform-origin:50% 50%}
   .trb{position:fixed;left:0;right:0;height:12.1vh;background:#000;z-index:9000}
   #trF{position:fixed;inset:0;background:#000;z-index:9100;opacity:0}
   #trC{position:fixed;left:0;right:0;bottom:17vh;text-align:center;z-index:9200;color:#f4efe2;font:600 3.9vh "Hiragino Mincho ProN","Yu Mincho",serif;letter-spacing:.34em;text-shadow:0 0 1.2vh rgba(0,0,0,.9),0 .2vh .4vh rgba(0,0,0,.8);opacity:0}
   #trB{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9200;color:#f4efe2;font:500 4.2vh "Hiragino Mincho ProN","Yu Mincho",serif;letter-spacing:.4em;opacity:0}
   #trL{position:fixed;left:6vw;top:17vh;z-index:9200;color:#e6bd74;font:400 2.3vh "Josefin Sans","Hiragino Sans",sans-serif;letter-spacing:.5em;opacity:0;border-left:.25vh solid #e6bd74;padding-left:1.2vw}
   #trL2{position:fixed;left:0;right:0;bottom:9vh;text-align:center;z-index:9200;color:#e6bd74;font:400 2.1vh "Josefin Sans","Hiragino Sans",sans-serif;letter-spacing:.5em;opacity:0}`;document.head.appendChild(st);
  for(const[id,cls,sty]of[['trT','trb','top:0'],['trBo','trb','bottom:0'],['trF'],['trC'],['trB'],['trL'],['trL2']]){const d=document.createElement('div');d.id=id;if(cls)d.className=cls;if(sty)d.style.cssText=sty;document.body.appendChild(d);}});
await p.addScriptTag({path:dir+'shots.js'});
const info=await p.evaluate(()=>TR.SH.map(s=>[s.name,s.dur,s.at]));
let fn=0,gt=0;const sheet=[];const t00=Date.now();
for(let si=0;si<info.length;si++){const[name,dur,at]=info[si],n=Math.round((at+dur)*FPS)-Math.round(at*FPS);
  if(only&&name!==only){ // 前のショットに依存する準備だけは通す
    await p.evaluate(si=>{const s=TR.SH[si];s.setup();},si).catch(e=>console.log('setup err',name,e.message));gt+=dur;fn+=n;continue;}
  await p.evaluate(si=>{const s=TR.SH[si],S=__SR,q=id=>document.getElementById(id);s.setup();S.cloudCut();
    document.body.classList.toggle('nohud',!s.hud);document.body.classList.toggle('notitle',!s.titleUI);
    q('trT').style.display=q('trBo').style.display=s.bars?'':'none';},si).catch(e=>console.log('setup err',name,e.message));
  for(let f=0;f<n;f++){const t=f/FPS;
    await p.evaluate((si,t,FPS)=>{const s=TR.SH[si],S=__SR,k=t/s.dur,q=id=>document.getElementById(id),sm=(a,b,x)=>{x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x);};
      TR.setT(k);s.frame(t,k);if(!s.black)S.step(1/FPS);
      let fo=s.black?1:0;if(s.fadeIn)fo=Math.max(fo,1-sm(0,s.fadeIn,t));if(s.fadeOut)fo=Math.max(fo,sm(s.dur-s.fadeOut,s.dur-.1,t));q('trF').style.opacity=fo;
      const c=q('trC');if(s.cap){c.textContent=s.cap[0];c.style.opacity=sm(s.cap[1],s.cap[1]+.5,t)*(1-sm(s.cap[2]-.5,s.cap[2],t));}else c.style.opacity=0;
      const B=q('trB');if(s.big){B.textContent=s.big;B.style.opacity=sm(.15,.6,t)*(1-sm(s.dur-.45,s.dur-.05,t));}else B.style.opacity=0;
      const L=q('trL');if(s.label){L.textContent=s.label;L.style.opacity=sm(.4,.9,t)*(1-sm(s.dur-.5,s.dur,t));}else L.style.opacity=0;
      const L2=q('trL2');if(s.label2){L2.textContent=s.label2;L2.style.opacity=sm(2,3,t)*(1-sm(s.dur-s.fadeOut-.3,s.dur-s.fadeOut,t));}else L2.style.opacity=0;},si,t,FPS).catch(e=>{if(f===0)console.log('frame err',name,e.message);});
    if(f%every===0){if(mode==='final')await p.screenshot({path:fdir+String(fn).padStart(5,'0')+'.jpg',type:'jpeg',quality:90});
      else if(f%30===12||f%30===27)sheet.push([name,(gt+t).toFixed(1),(await p.screenshot({type:'jpeg',quality:72})).toString('base64')]);}
    fn++;}
  gt+=dur;console.log(name,'done',gt+'s',((Date.now()-t00)/1000).toFixed(0)+'s elapsed');}
if(mode!=='final'){const q=await b.newPage(),cols=8,rows=Math.ceil(sheet.length/cols);await q.setViewport({width:cols*240,height:rows*152});
  await q.setContent('<!doctype html><body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(8,240px);font:11px monospace;color:#fff">'+sheet.map(([n,t,d])=>`<div style="position:relative;height:152px"><img width=240 height=135 src="data:image/jpeg;base64,${d}"><b style="position:absolute;left:2px;top:2px;background:#000">${t}s ${n}</b></div>`).join('')+'</body>');
  const parts=Math.ceil(rows/4);for(let i=0;i<parts;i++)await q.screenshot({path:dir+`out/preview_${i}.png`,clip:{x:0,y:i*4*152,width:1920,height:Math.min(4,rows-i*4)*152}});console.log('sheets',parts);}
console.log('frames',fn);await b.close();

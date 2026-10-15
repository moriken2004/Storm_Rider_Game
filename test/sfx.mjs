// 効果音が鳴るか（音の大きさを解析器で測る）。node test/sfx.mjs
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--autoplay-policy=no-user-gesture-required']});const p=await b.newPage();p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
await p.mouse.click(10,10);await new Promise(r=>setTimeout(r,800));
console.log(await p.evaluate(async()=>{const ctx=AU.ctx;if(!ctx)return 'no audio';await ctx.resume();const an=ctx.createAnalyser();an.fftSize=2048;AU.sfx.connect(an);const buf=new Float32Array(2048);
  const out=[];for(const k of['gun','ting','plip','whoosh','spark','hit']){SFX[k](k==='whoosh'?.5:undefined);let peak=0;const t0=performance.now();while(performance.now()-t0<600){await new Promise(r=>setTimeout(r,20));an.getFloatTimeDomainData(buf);for(const v of buf)peak=Math.max(peak,Math.abs(v));}out.push(k+' 最大振幅 '+peak.toFixed(3));await new Promise(r=>setTimeout(r,300));}
  return out.join('\n');}));
await b.close();

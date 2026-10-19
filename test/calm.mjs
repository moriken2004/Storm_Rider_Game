// 「光と揺れを抑える」「操縦の感度」の効き目を確かめる。node test/calm.mjs
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new'});const p=await b.newPage();
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
console.log(await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR,G=S.G,o=S.opts,out=[];S.startRun('approach');if(G.mode==='cut')S.endCut();
  for(const calm of[false,true]){o.calm=calm;let mx={w:0,f:0,cam:0},fl=[];G.white=0;S.step(1/30);const c0=S.camera.position.clone();
    G.white=.4;G.flash=1.6;G.shake=.9;let pc=S.camera.position.clone();
    for(let i=0;i<20;i++){S.step(1/30);const u=renderer?0:0;const fu=S.finalU||null;fl.push(+S.U.uFlashI.value.toFixed(2));}
    out.push((calm?'抑える':'通常')+' 雲の光 '+JSON.stringify(fl.slice(0,8)));}
  for(const sens of[60,100,140]){o.sens=sens;S.input.x=0;S.input.tx=.3;const r=[];for(let i=0;i<10;i++){S.step(1/30);r.push(+S.input.x.toFixed(2));}S.input.tx=0;out.push('感度'+sens+' 指0.3 → '+JSON.stringify(r));}
  o.calm=false;o.sens=100;return out.join('\n');}));
await b.close();

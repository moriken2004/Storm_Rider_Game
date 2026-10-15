// 自動の画質調整：フレームが遅いと解像度→段階が下がり、速くなると戻るか（時計をずらして遅さを模擬）
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new'});const p=await b.newPage();await p.setViewport({width:960,height:540});p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
await p.evaluate(()=>{const S=__SR;document.getElementById('title').hidden=true;document.getElementById('bStart').click();for(let i=0;i<10;i++)S.step(1/30);S.endCut();});
const sample=async(ms,label)=>{await p.evaluate((ms)=>{window.__slow=ms;},ms);await new Promise(r=>setTimeout(r,14000));console.log(label,await p.evaluate(()=>JSON.stringify({scale:+__SR.view.scale.toFixed(2),tier:__SR.view.tier||0,min:__SR.view.minScale,trees:(()=>{let sc=null;__SR.P.mesh.traverseAncestors(a=>{if(a.isScene)sc=a;});const B=sc.children.find(c=>c.userData&&c.userData.hangar);return B.userData.trees.count+'/'+(B.userData.shrubs.count);})(),mode:__SR.G.mode})));};
await p.evaluate(()=>{const rs=window.requestAnimationFrame;window.__slow=0;const po=performance.now.bind(performance);let skew=0;performance.now=()=>po()+skew;const orig=window.requestAnimationFrame;window.requestAnimationFrame=cb=>orig(t=>{skew+=window.__slow;cb(t+skew);});});
await p.evaluate(()=>{setInterval(()=>{const S=__SR;S.P.inv=2;S.P.hull=100;if(S.P.pos.y<300)S.P.pos.y=400;S.input.ty=0;},50);});await sample(0,'通常');await sample(30,'遅い（+30ms/コマ）');await sample(30,'遅いまま');await sample(0,'速く戻す');await sample(0,'速いまま');await sample(0,'さらに');await sample(0,'その後');await sample(0,'その後2');await sample(0,'その後3');
await b.close();

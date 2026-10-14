// プレイ中に迎撃機のカットが入っても、帰投ゲート・観測リング・残り時間・トラブルが消えないこと
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new'});const p=await b.newPage();p.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR');
for(const ph of['ret','eye','spare','approach']){
  const r=await p.evaluate((ph)=>{window.requestAnimationFrame=()=>0;const S=__SR,P=S.P,G=S.G,ICP=S.ICP;window.__gates=()=>S.gateRings.filter(r=>r.visible).length;window.__rings=()=>S.rings.filter(r=>r.visible).length;window.__core=()=>S.core().visible;S.startRun(ph);if(G.mode==='cut')S.endCut();S.step(1/30);
    const snap=()=>JSON.stringify({gate:window.__gates(),ring:window.__rings(),core:window.__core(),timer:document.getElementById('timer').hidden,ice:P.ice,eng:P.engineOut});
    if(ph==='approach'){P.ice=1;}
    const before=snap();ICP.seen=0;ICP.cleared=false;
    // 空域の外へ瞬間移動して迎撃を起こす
    const a=Math.atan2(P.pos.x,P.pos.z);P.pos.set(Math.sin(a)*30000,P.pos.y,Math.cos(a)*30000+(ph==='ret'?0:0));
    let sawCut=false;for(let i=0;i<30*3;i++){S.step(1/30);if(G.mode==='cut'){sawCut=true;S.endCut();break;}}
    S.step(1/30);return{ph,sawCut,mode:G.mode,before,after:snap()};},ph);
  console.log(JSON.stringify(r));}
await b.close();
// 帰投中に僚機撃墜のカットまで進めても、ゲートが残ること
const b2=await puppeteer.launch({headless:'new'});const p2=await b2.newPage();p2.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p2.goto('http://127.0.0.1:8795/index.html');await p2.waitForFunction('window.__SR');
console.log('僚機撃墜カット後',await p2.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR,P=S.P,G=S.G,ICP=S.ICP;S.startRun('ret');if(G.mode==='cut')S.endCut();P.pos.set(9000,400,29000);P.yaw=Math.PI/2;let cuts=0;
  for(let i=0;i<30*60&&cuts<2;i++){S.input.ty=Math.max(-1,Math.min(1,(400-P.pos.y)/200));S.step(1/30);if(G.mode==='cut'){cuts++;S.endCut();}}S.step(1/30);
  return JSON.stringify({cuts,st:ICP.st,gates:S.gateRings.filter(r=>r.visible).length,wing:S.W.map(w=>w.state).join()});}));
await b2.close();

// BGM の動作確認：読み込み → タイトル曲 → 出撃 → 一時停止 → タイトルへ戻る、の各時点の状態を出す
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage();const logs=[];p.on('pageerror',e=>logs.push('PAGEERR '+e.message));p.on('console',m=>{if(/BGM/.test(m.text()))logs.push(m.text());});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR');
const st=()=>p.evaluate(()=>({ctx:AU.ctx&&AU.ctx.state,ready:BGM.ready,mood:BGM.mood,cur:!!BGM.cur,synth:MUS.mood,mode:__SR.G.mode}));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await p.mouse.click(640,60);await wait(2500);console.log('after first click',JSON.stringify(await st()));
// 実際に音が出ているか：音楽の出力を解析器で測る
const level=()=>p.evaluate(async()=>{const an=AU.ctx.createAnalyser();AU.mus.connect(an);await new Promise(r=>setTimeout(r,600));const d=new Float32Array(an.fftSize);an.getFloatTimeDomainData(d);AU.mus.disconnect(an);let s=0;for(const v of d)s+=v*v;return +(Math.sqrt(s/d.length)).toFixed(4);});
console.log('title level',await level());
await p.evaluate(()=>document.getElementById('bStart').click());await wait(1500);await p.keyboard.press('Enter');await wait(1500);console.log('in flight',JSON.stringify(await st()),'level',await level());
await p.keyboard.press('Escape');await wait(500);console.log('paused',JSON.stringify(await st()));
await p.evaluate(()=>document.getElementById('bPTitle').click());await wait(1800);console.log('back to title',JSON.stringify(await st()),'level',await level());
await p.evaluate(()=>document.getElementById("oFix").click());await wait(2500);console.log("after restart",JSON.stringify(await st()),"level",await level(),"keep",await p.evaluate(()=>AU.keep&&!AU.keep.paused));
// 予約が失敗したとき、内蔵シンセへ戻るか
await p.evaluate(()=>{BGM.node=()=>{throw new Error('simulated');};BGM.mood=null;BGM.cur=null;BGM.play('storm');});await wait(1500);console.log('after simulated failure',JSON.stringify(await st()),'level',await level());
console.log(logs.join('\n'));await b.close();

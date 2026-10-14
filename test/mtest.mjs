// スマートフォン（エミュレーション）での個別確認：node test/mtest.mjs
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const W=+(process.argv[2]||844),H=+(process.argv[3]||390);
const p=await b.newPage();await p.setViewport({width:W,height:H,deviceScaleFactor:2,isMobile:true,hasTouch:true,isLandscape:true});p.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:60000});await p.evaluate(()=>{__SR.G.armed=true;document.body.classList.add('armed');});
const dir=new URL('./out/',import.meta.url).pathname;
// 1) 帰投中のエンジン停止：案内の文言と、発射ボタンの長押しで再始動できるか
let r=await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR,P=S.P,G=S.G;S.startRun('ret');for(let i=0;i<3000&&!P.engineOut;i++){P.inv=1;const T=G.target;if(T){const dx=T.x-P.pos.x,dz=T.z-P.pos.z;let e=Math.atan2(-dx,-dz)-P.yaw;while(e>3.1416)e-=6.2832;while(e<-3.1416)e+=6.2832;S.input.tx=Math.max(-1,Math.min(1,-e*2.5));}S.input.ty=Math.max(-1,Math.min(1,(600-P.pos.y)/200));S.input.tBoost=true;S.step(1/30);}
  S.input.tx=S.input.ty=0;S.input.tBoost=false;for(let i=0;i<5;i++)S.step(1/30);return{engineOut:P.engineOut,prompt:document.getElementById('promptT').innerText,radio:document.getElementById('rtext').innerText,warn:document.getElementById('warn').innerText};});
console.log('エンジン停止時',JSON.stringify(r));
await p.screenshot({path:dir+'m_engine.png'});
const box=async id=>p.evaluate(id=>{const r=document.getElementById(id).getBoundingClientRect();return[r.left,r.top,r.right,r.bottom].map(Math.round);},id);
const A=await box('tbA');await p.touchscreen.touchStart((A[0]+A[2])/2,(A[1]+A[3])/2);
r=await p.evaluate(()=>{const S=__SR;for(let i=0;i<90;i++)S.step(1/30);return{tAct:S.input.tAct,engineOut:S.P.engineOut};});await p.touchscreen.touchEnd();console.log('発射を 3 秒長押し',JSON.stringify(r));
// 2) 重なり：レーダー・発射・ブースト・一時停止・僚機表示・目標表示
const ids=['radar','tbA','tbB','tbP','tbG','tbM','wing','obj','tl','prompt','radio'],bx={};for(const i of ids)bx[i]=await box(i);
const hit=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];const ov=[];for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)if(hit(bx[ids[i]],bx[ids[j]]))ov.push(ids[i]+'×'+ids[j]);
console.log('画面',W+'×'+H,'重なり:',ov.join(' ')||'なし',JSON.stringify({radar:bx.radar,tbA:bx.tbA}));
// 3) 海へ墜落 → ゲームオーバーの画面が出るか
r=await p.evaluate(()=>{const S=__SR,P=S.P,G=S.G;S.startRun('approach');let n=0;for(;n<1500&&G.mode!=='over';n++){if(G.mode==='play')P.pitch=-.9;S.input.ty=-1;S.step(1/30);}return{mode:G.mode,sec:+(n/30).toFixed(1),fade:document.getElementById('fade').style.opacity,over:!document.getElementById('over').hidden,text:document.getElementById('overP').innerText.split('\n')[0],touchShown:getComputedStyle(document.getElementById('touch')).display};});
console.log('海へ墜落',JSON.stringify(r));await new Promise(r=>setTimeout(r,400));await p.screenshot({path:dir+'m_over.png'});
const R=await box('bRetry');await p.touchscreen.tap((R[0]+R[2])/2,(R[1]+R[3])/2);await new Promise(r=>setTimeout(r,300));console.log('再挑戦をタップ',await p.evaluate(()=>__SR.G.mode));
await b.close();

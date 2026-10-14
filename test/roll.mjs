// バレルロール：E で 1 回転し、元の進路へ戻る。ミサイルを振り切れることがある
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:1280,height:720});p.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR');
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR;S.startRun('approach');if(S.G.mode==='cut')S.endCut();S.P.pos.set(0,400,9000);S.P.yaw=0;for(let i=0;i<20;i++)S.step(1/30);});
await p.keyboard.down('KeyE');await p.keyboard.up('KeyE');
const r=await p.evaluate(()=>{const S=__SR,P=S.P,x0=P.pos.x,y0=P.pos.y,log=[];for(let i=0;i<36;i++){S.step(1/30);if(i%6===0)log.push([(P.brA||0).toFixed(2),(P.pos.x-x0).toFixed(1),(P.pos.y-y0).toFixed(1),P.mesh.rotation.z.toFixed(2)].join('/'));if(i===12)window.__shot=1;}
  return{log:log.join(' '),dx:(P.pos.x-x0).toFixed(1),dy:(P.pos.y-y0).toFixed(1),br:!!P.br};});
console.log('ロール (brA/横/上/機体z)',JSON.stringify(r));
// 途中の画
await p.evaluate(()=>{const S=__SR;S.P.brCD=0;S.input.rollQ=-1;for(let i=0;i<12;i++)S.step(1/30);});
await p.screenshot({path:out('roll.png')});
// ダブルタップ
await p.evaluate(()=>{for(let i=0;i<60;i++)__SR.step(1/30);});
await p.keyboard.down('KeyA');await p.keyboard.up('KeyA');await p.keyboard.down('KeyA');await p.keyboard.up('KeyA');
console.log('2度押し',await p.evaluate(()=>{__SR.step(1/30);return JSON.stringify(__SR.P.br);}));
// ミサイル回避：外へ出て攻撃させ、ミサイルが 500m に来たらロール
const m=await p.evaluate(()=>{const S=__SR,P=S.P,G=S.G,I=S.input,ICP=S.ICP;let tries=0,lost=0,hits=0;S.startRun('eye');P.pos.set(0,500,-16000);P.yaw=0;
  for(let i=0;i<30*200&&G.mode!=='over';i++){if(G.mode==='cut'){S.endCut();continue;}I.ty=Math.max(-1,Math.min(1,(500-P.pos.y)/200));I.tx=0;P.hull=100;
    for(const q of ICP.mis){if(q.life>0&&!q.tgt&&!q.lost&&!q.tried&&q.pos.distanceTo(P.pos)<500){q.tried=1;if(!P.br&&P.brCD<=0){I.rollQ=1;tries++;q.watch=1;}}}
    const before=ICP.mis.filter(q=>q.watch&&q.lost&&!q.counted);before.forEach(q=>{q.counted=1;lost++;});S.step(1/30);if(tries>=8)break;}
  return{tries,lost};});
console.log('ミサイル回避',JSON.stringify(m));
await b.close();

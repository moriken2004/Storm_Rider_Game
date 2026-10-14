// 武装モードの地上掃射：船を沈める・施設を壊す・引き波とレーダーの見た目
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:1280,height:720});p.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR');
for(const k of['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA']){await p.keyboard.down(k);await p.keyboard.up(k);}
// 引き波：上空から船を見下ろす
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR;S.startRun('approach');for(let i=0;i<30;i++)S.step(1/30);const s=S.ships[0];
  window.__PCAM=c=>{c.position.set(s.x+120,260,s.z+160);c.lookAt(s.x+Math.sin(s.h)*120,0,s.z+Math.cos(s.h)*120);};S.step(1/30);S.step(1/30);});
await p.screenshot({path:out('wake.png')});
// 船を撃つ：船の後ろ上空から機首を向けて機銃
const r=await p.evaluate(()=>{const S=__SR,P=S.P,G=S.G,I=S.input;window.__PCAM=null;S.startRun('approach');if(G.mode==='cut')S.endCut();const s=S.ships[1];const log=[];
  for(let i=0;i<30*40;i++){if(G.mode==='cut'){S.endCut();continue;}const dx=s.x-P.pos.x,dz=s.z-P.pos.z,d=Math.hypot(dx,dz);
    if(i===0||d>1400){P.pos.set(s.x+Math.sin(s.h)*900,160,s.z+Math.cos(s.h)*900);P.yaw=s.h;P.pitch=-.17;P.vel.set(-Math.sin(s.h),0,-Math.cos(s.h)).multiplyScalar(P.speed);}
    let e=Math.atan2(-dx,-dz)-P.yaw;while(e>3.14)e-=6.28;while(e<-3.14)e+=6.28;I.tx=Math.max(-1,Math.min(1,-e*8));const want=Math.atan2(-(P.pos.y-5),d);I.ty=Math.max(-1,Math.min(1,(want-P.pitch)*6));
    I.tGun=d<850&&d>120;S.step(1/30);if(s.dead){log.push('沈没 '+(i/30).toFixed(1)+'s');break;}}
  return{log,hp:s.hp,burn:S.STR.burn.length};});
console.log('船',JSON.stringify(r));
for(let i=0;i<4;i++)await p.evaluate(()=>{for(let k=0;k<30;k++)__SR.step(1/30);});
await p.evaluate(()=>{const s=__SR.ships[1],c0=[s.x+200,90,s.z+220];window.__PCAM=c=>{c.position.set(...c0);c.lookAt(s.x,10,s.z);};__SR.step(1/30);});
await p.screenshot({path:out('sink.png')});
// 施設：格納庫付近の建物へ低空から撃ち込む
const r2=await p.evaluate(()=>{const S=__SR,P=S.P,G=S.G,I=S.input;window.__PCAM=null;const cols=S.STR.cols;const o=cols[0];console.log("rocks",cols.filter(q=>q.c[7]).length);const c=o.c,tx=(c[0]+c[3])/2,tz=(c[2]+c[5])/2,ty=(c[1]+c[4])/2;
  let n=0;for(let pass=0;pass<12&&!o.dead;pass++){P.pos.set(tx+700,ty+120,tz);P.yaw=0;P.wingLost=false;P.hull=100;
    for(let i=0;i<30*2.5;i++){const dx=tx-P.pos.x,dz=tz-P.pos.z,d=Math.hypot(dx,dz);P.pitch=Math.atan2(ty-P.pos.y,d);P.yaw=Math.atan2(-dx,-dz);I.tx=0;I.ty=0;I.tGun=d>150;S.step(1/30);n++;if(o.dead)break;}}
  return{dead:o.dead,hp:o.hp,size:[c[3]-c[0],c[4]-c[1],c[5]-c[2]].map(Math.round),burn:S.STR.burn.length,mode:G.mode,t:(n/30).toFixed(1)};});
console.log('施設',JSON.stringify(r2));
await p.evaluate(()=>{const S=__SR,b=S.STR.burn[S.STR.burn.length-1];for(let k=0;k<90;k++)S.step(1/30);window.__PCAM=c=>{c.position.set(b.x+150,b.y+80,b.z+200);c.lookAt(b.x,b.y+20,b.z);};S.step(1/30);});
await p.screenshot({path:out('burn.png')});
// レーダー：任務エリア境界の近く
await p.evaluate(()=>{const S=__SR,P=S.P;window.__PCAM=null;S.ICP.cleared=true;P.pos.set(12500,400,9000);P.yaw=-1.2;P.pitch=0;S.step(1/30);});
await p.screenshot({path:out('radar_area.png'),clip:{x:0,y:0,width:1280,height:720}});
await b.close();

// 港の破壊：係留船は船として沈む・クレーンは 1 基まるごと倒れる・コンテナは区画ごとに吹き飛ぶ・やり直しで元に戻る。node test/portwreck.mjs
import puppeteer from 'puppeteer';
const dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:1280,height:720});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
const ev=(f,...a)=>p.evaluate(f,...a);
await ev(()=>{window.requestAnimationFrame=()=>0;document.getElementById('title').hidden=true;const S=__SR,G=S.G;S.startRun('approach');if(G.mode==='cut')S.endCut();S.G.mode='play';S.P.inv=999;});
const shoot=(x,y,z,n)=>ev((x,y,z,n)=>{const S=__SR,V=S.P.pos.constructor;let r=0;for(let i=0;i<n;i++){const q={pos:new V(x,y,z),dir:new V(0,-1,0)};if(S.strHit(q,new V(x,y+2,z),2,5))r++;}return r;},x,y,z,n);
const steps=(n)=>ev(n=>{for(let i=0;i<n;i++){__SR.P.pos.set(__SR.P.pos.x,900,__SR.P.pos.z);__SR.step(1/30);}},n);
const look=(px,py,pz,tx,ty,tz)=>ev((a)=>{const S=__SR,c=S.camera;S.step(1/30);for(let k=0;k<6;k++){c.position.set(a[0],a[1],a[2]);c.lookAt(a[3],a[4],a[5]);c.fov=50;c.updateProjectionMatrix();if(!k)S.cloudCut();renderFrame();}},[px,py,pz,tx,ty,tz]);
const out=[];const info=await ev(()=>{const S=__SR,B=S.ships.filter(s=>s.moored),cols=baseGroup.userData.colliders;return{moored:B.map(s=>s.m.userData.kind+'@'+Math.round(s.x)+','+Math.round(s.z-BASE.z)),port:cols.filter(c=>c[0]-BASE.x>1050).length,cranes:cols.filter(c=>c[10]).length,cont:cols.filter(c=>c[8]===5).length};});
out.push('係留船 '+JSON.stringify(info));
// 1 係留中の貨物船を撃つ
const cg=await ev(()=>{const s=__SR.ships.find(s=>s.moored&&s.m.userData.kind==='cargo');return[s.x,s.z];});
await look(cg[0]+260,90,cg[1]+160,cg[0],5,cg[1]);await p.screenshot({path:dir+'pw_0_cargo.png'});
const brk0=await ev(()=>__SR.BRK.list.length);
await shoot(cg[0],8,cg[1],40);await steps(150);
const r1=await ev(()=>{const s=__SR.ships.find(s=>s.moored&&s.m.userData.kind==='cargo');return{dead:s.dead,y:+s.m.position.y.toFixed(1),brk:__SR.BRK.list.length,rope:s.rope?s.rope.visible:'なし'};});
out.push('貨物船を撃つ → '+JSON.stringify(r1)+(r1.dead&&r1.brk===brk0?' ✓ 船として沈む':' ✗'));
await look(cg[0]+260,90,cg[1]+160,cg[0],5,cg[1]);await p.screenshot({path:dir+'pw_1_cargo_sink.png'});
// 2 クレーン
const cr=await ev(()=>{const c=baseGroup.userData.colliders.find(c=>c[10]);return[(c[9][0]+c[9][2])/2,c[1]+20,(c[9][1]+c[9][3])/2];});
await look(cr[0]-160,70,cr[2]+170,cr[0]+10,25,cr[2]);await p.screenshot({path:dir+'pw_2_crane0.png'});
await shoot(cr[0],cr[1],cr[2],40);await steps(25);await look(cr[0]-160,70,cr[2]+170,cr[0]+10,25,cr[2]);await p.screenshot({path:dir+'pw_3_crane_mid.png'});
await steps(120);await look(cr[0]-160,70,cr[2]+170,cr[0]+10,25,cr[2]);await p.screenshot({path:dir+'pw_4_crane_down.png'});
out.push('クレーン → '+JSON.stringify(await ev(()=>{const b=__SR.BRK.list.find(b=>b.c[10]);return b?{kind:b.kind,parts:b.parts.length,att:b.att.length,done:b.done,dead:b.c[10].userData.dead}:null;})));
// 3 コンテナ区画
const cb=await ev(()=>{const c=baseGroup.userData.colliders.filter(c=>c[8]===5)[6];return[(c[0]+c[3])/2,c[4]-1,(c[2]+c[5])/2];});
await look(cb[0]-120,60,cb[2]+120,cb[0],5,cb[2]);await p.screenshot({path:dir+'pw_5_cont0.png'});
await shoot(cb[0],cb[1],cb[2],40);await steps(20);await look(cb[0]-120,60,cb[2]+120,cb[0],5,cb[2]);await p.screenshot({path:dir+'pw_6_cont_fly.png'});
await steps(200);await look(cb[0]-120,60,cb[2]+120,cb[0],5,cb[2]);await p.screenshot({path:dir+'pw_7_cont_after.png'});
out.push('コンテナ → '+JSON.stringify(await ev(()=>{const d=window.__SR.CONTD?0:0;return{deb:CBRK.deb.filter(d=>d.on).length,rest:CBRK.deb.filter(d=>d.on&&d.rest).length,sunk:CBRK.deb.filter(d=>d.on&&d.sink>0).length,broken:CBRK.broken.length};})));
// 4 やり直しで元に戻る
await ev(()=>{strReset();});await steps(5);
out.push('やり直し後 '+JSON.stringify(await ev(()=>({brk:__SR.BRK.list.length,deb:CBRK.deb.filter(d=>d.on).length,broken:CBRK.broken.length,cargo:__SR.ships.find(s=>s.moored&&s.m.userData.kind==='cargo').dead,crane:baseGroup.userData.lodPort.userData.cranes.some(c=>c.userData.dead)}))));
await look(cb[0]-120,60,cb[2]+120,cb[0],5,cb[2]);await p.screenshot({path:dir+'pw_8_reset.png'});
console.log(out.join('\n'));console.log(errs.slice(0,5).join('\n')||'エラーなし');await b.close();

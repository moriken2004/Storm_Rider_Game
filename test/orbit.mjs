// 設定画面の機体プレビュー：背景をドラッグすると視点が回り、ホイールで寄り引きする
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:1280,height:720});p.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR');
await p.click('#bOpts');await new Promise(r=>setTimeout(r,800));
const cam=()=>p.evaluate(()=>{const c=__SR.camera.position,P=__SR.P.pos;return [Math.round(c.x-P.x),Math.round(c.y-P.y),Math.round(c.z-P.z)].join(',')+' orb='+JSON.stringify(__SR.G.orb&&{az:+__SR.G.orb.az.toFixed(2),el:+__SR.G.orb.el.toFixed(2),r:+__SR.G.orb.r.toFixed(1)});});
await p.screenshot({path:out('orbit_0.png')});console.log('前',await cam());
await p.mouse.move(300,360);await p.mouse.down();for(let i=1;i<=20;i++)await p.mouse.move(300+i*14,360-i*7);await p.mouse.up();await new Promise(r=>setTimeout(r,300));
console.log('ドラッグ後',await cam());await p.screenshot({path:out('orbit_1.png')});
await p.mouse.move(300,360);for(let i=0;i<6;i++)await p.mouse.wheel({deltaY:-100});await new Promise(r=>setTimeout(r,300));
console.log('寄り',await cam());await p.screenshot({path:out('orbit_2.png')});
await p.mouse.move(300,360);await p.mouse.down();for(let i=1;i<=30;i++)await p.mouse.move(300,360-i*20);await p.mouse.up();await new Promise(r=>setTimeout(r,300));
console.log('真上まで',await cam());
await p.click('#opts .bBack');await new Promise(r=>setTimeout(r,300));console.log('閉じた後 orb',await p.evaluate(()=>__SR.G.orb));
await b.close();

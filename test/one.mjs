// 1 場面を大きく撮る：node test/one.mjs <名前> '<準備の JS>'（survey.mjs と同じ fly/cam/free が使える）
import puppeteer from 'puppeteer';
const [name,code]=process.argv.slice(2);
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage();await p.setViewport({width:1280,height:720});p.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR');
const r=await p.evaluate(code=>{window.requestAnimationFrame=()=>0;const st=document.createElement('style');st.textContent='#radio,#hint,#banner,#hud,#fhud{display:none!important}';document.head.appendChild(st);
  const S=__SR,P=S.P,G=S.G,I=S.input;
  window.fly=(n,alt,steer)=>{for(let i=0;i<n;i++){P.inv=1;I.tx=0;const T=G.target;if(T&&steer!==false){const dx=T.x-P.pos.x,dz=T.z-P.pos.z;let e=Math.atan2(-dx,-dz)-P.yaw;while(e>3.1416)e-=6.2832;while(e<-3.1416)e+=6.2832;I.tx=Math.max(-1,Math.min(1,-e*2.5));}I.ty=alt===undefined?0:Math.max(-1,Math.min(1,(alt-P.pos.y)/200));S.step(1/30);}};
  window.cam=(x,y,z,yaw,pit,fov)=>{window.__PCAM=c=>{c.up.set(0,1,0);c.position.set(x,y,z);const cy=Math.cos(pit);c.lookAt(x-Math.sin(yaw)*cy*100,y+Math.sin(pit)*100,z-Math.cos(yaw)*cy*100);c.fov=fov||62;c.updateProjectionMatrix();};};
  const out=eval(code);S.cloudCut();if(window.__PCAM){G.mode='title';G.optPrev=false;}for(let i=0;i<12;i++)S.step(1/60);return out===undefined?null:String(out);},code);
await new Promise(r=>setTimeout(r,300));await p.screenshot({path:new URL(`./out/one_${name}.png`,import.meta.url).pathname});console.log(name,r);await b.close();

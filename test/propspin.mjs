// 船のスクリュー：航行中は回る・係留中は止まる・撃沈後も回り続ける。node test/propspin.mjs
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:800,height:450});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000,polling:100});
const r=await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR,sh=S.ships;const mv=sh.find(s=>!s.moored&&s.m.userData.props),mo=sh.find(s=>s.moored&&s.m.userData.props);
  const ang=s=>s.m.userData.props[0].rotation.z;const a0=[ang(mv),ang(mo)];for(let i=0;i<60;i++)S.step(1/60);const a1=[ang(mv),ang(mo)];
  strSink(mv);for(let i=0;i<60;i++)S.step(1/60);const a2=ang(mv);for(let i=0;i<120;i++)S.step(1/60);const a3=ang(mv);
  return{moving:+(a1[0]-a0[0]).toFixed(2),moored:+(a1[1]-a0[1]).toFixed(2),sunk1:+(a2-a1[0]).toFixed(2),sunk2:+((a3-a2)/2).toFixed(2),dead:mv.dead,n:sh.filter(s=>s.m.userData.props).length,all:sh.length};});
console.log(JSON.stringify(r));const ok=Math.abs(r.moving)>1&&r.moored===0&&Math.abs(r.sunk1)>1&&Math.abs(r.sunk2-r.sunk1)<.05&&r.dead&&r.n===r.all;
console.log(errs[0]||(ok?'スクリューは回る':'スクリューに問題'));await b.close();

// AquaTopia の当たり判定：岸壁は海から登れない、陸から乗ると舗装の高さ、流木・岩は乗り越える（減速して持ち上がる）、斜めの防波堤のそばの水面は通れる。node test/exphys.mjs
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:640,height:360});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('bExplore').click();});await p.waitForFunction('EX.on&&!exLoading',{timeout:120000,polling:100});
const r=await p.evaluate(()=>{const S=__SR,I=S.input,o={};const drive=(x,z,yaw,n,y)=>{EX.pos.set(x,y===undefined?0:y,z);EX.yaw=yaw;EX.depth=0;EX.spd=0;EX.camReset=true;let maxY=-1e9,minY=1e9;for(let i=0;i<n;i++){I.ty=1;S.step(1/30);maxY=Math.max(maxY,EX.pos.y);minY=Math.min(minY,EX.pos.y);}I.ty=0;return{x:+(EX.pos.x-BASE.x).toFixed(1),z:+(EX.pos.z-BASE.z).toFixed(1),y:+EX.pos.y.toFixed(2),maxY:+maxY.toFixed(2),mode:EX.mode};};
  // 1) 海から岸壁（x=1292）へ西向きに
  o.quayFromSea=drive(BASE.x+1330,BASE.z+20,Math.PI/2,240);
  // 2) 港の陸（x=1200）から岸壁の上を東へ（岸壁の上は 4.6m）
  o.onQuay=drive(BASE.x+1230,BASE.z-140,-Math.PI/2,90,4.2);
  // 3) 流木：一番近い流木の手前から向かって走る
  {const L=(baseGroup.userData.exBumps||[]).filter(q=>q[8]===1);const q=L[0];if(q){const yaw=Math.atan2(-(q[0]-(q[0]+6*q[7])),-(q[2]-(q[2]+6*q[6])));const sx=q[0]+6*q[7],sz=q[2]-6*q[6]*-1;
      EX.pos.set(q[0]+6*q[7],0,q[2]+6*q[6]);const yw=Math.atan2(-(q[0]-EX.pos.x),-(q[2]-EX.pos.z));const g0=exGround(EX.pos.x,EX.pos.z);o.log=Object.assign(drive(EX.pos.x,EX.pos.z,Math.atan2(EX.pos.x-q[0],EX.pos.z-q[2]),120,g0),{logTop:+(q[1]+q[4]).toFixed(2),ground:+g0.toFixed(2),n:L.length});}}
  // 4) 斜めの防波堤（1640,-150）→（1668,40）の内側 14m の水面を北へ
  o.besideBreakwater=drive(BASE.x+1640,BASE.z+20,0,150);
  return o;});
console.log(JSON.stringify(r,null,0));
const ok=r.quayFromSea.x>1293.5&&r.quayFromSea.maxY<1.5&&Math.abs(r.onQuay.y-4.62)<.25&&r.besideBreakwater.z<-10;console.log(errs[0]||(ok?'当たり判定よし':'当たり判定に問題'));await b.close();

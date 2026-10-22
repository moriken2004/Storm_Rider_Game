// 森の中のカメラの揺れ：木の多い所を蛇行して進み、カメラの位置と向きの「コマごとの急な変化」（二階差分）の最大を測る。node test/camjit.mjs [port]
import puppeteer from 'puppeteer';
const port=process.argv[2]||'8795';
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:640,height:360});
await p.goto('http://127.0.0.1:'+port+'/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('bExplore').click();});await p.waitForFunction('EX.on&&(typeof exLoading==="undefined"||!exLoading)',{timeout:120000,polling:100});
const r=await p.evaluate(()=>{const S=__SR,I=S.input;if(!VEG.ok)vegInit();const res=[];
  const cands=[];for(let k=0;k<600;k++){const x=BASE.x+(((k*7919)%600)/600-.5)*2400,z=BASE.z+(((k*104729)%599)/599-.5)*2800,h=exGround(x,z);if(h<8)continue;let n=0;vegNear(x,z,30,()=>n++);if(n>25&&n<70)cands.push([n,x,z]);}
  cands.sort((a,b)=>b[0]-a[0]);
  for(const[n,x0,z0]of cands.slice(0,3)){EX.pos.set(x0,exGround(x0,z0),z0);EX.yaw=0;EX.depth=0;EX.spd=0;EX.cam.set(EX.pos.x,EX.pos.y+5,EX.pos.z+12);EX.camReset=true;for(let i=0;i<30;i++)S.step(1/60);
    const P=[],A=[],d=new THREE.Vector3();for(let i=0;i<900;i++){I.ty=1;I.tx=Math.sin(i*.02)*.8;S.step(1/60);P.push(camera.position.clone());camera.getWorldDirection(d);A.push(d.clone());}
    let jp=0,ja=0;for(let i=2;i<P.length;i++){const a=P[i].clone().sub(P[i-1]),b2=P[i-1].clone().sub(P[i-2]);jp=Math.max(jp,a.sub(b2).length());const t1=A[i].angleTo(A[i-1]),t0=A[i-1].angleTo(A[i-2]);ja=Math.max(ja,Math.abs(t1-t0)*180/Math.PI);}
    res.push({trees:n,jerkPos:+jp.toFixed(3),jerkAngDeg:+ja.toFixed(3),moved:+Math.hypot(EX.pos.x-x0,EX.pos.z-z0).toFixed(1)});}
  I.tx=I.ty=0;return{runs:res,jerkPos:Math.max(...res.map(q=>q.jerkPos)),jerkAngDeg:Math.max(...res.map(q=>q.jerkAngDeg))};});
console.log(JSON.stringify(r));console.log(r.jerkPos<.06&&r.jerkAngDeg<.6?'揺れなし':'揺れあり');await b.close();

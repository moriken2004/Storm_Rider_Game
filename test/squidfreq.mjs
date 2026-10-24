// アオリイカの出現の頻度：潜って移動しながら 120 秒、見えている数を数える。node test/squidfreq.mjs
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:640,height:360});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8795/index.html',{timeout:120000});await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:300000,polling:300});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('bExplore').click();});await p.waitForFunction('EX.on&&!exLoading',{timeout:200000,polling:200});
const r=await p.evaluate(()=>{let q=null;for(let rr=600;rr<2600&&!q;rr+=40)for(let a=0;a<6.28;a+=.2){const x=BASE.x+Math.cos(a)*rr,z=BASE.z+Math.sin(a)*rr;if(exGround(x,z)<-25){q=[x,z,a];break;}}
  EX.pos.set(q[0],-12,q[1]);EX.depth=12;EX.mode='dive';const m4=new THREE.Matrix4(),pp=new V3(),qq=new THREE.Quaternion(),ss=new V3();let vis=0,frames=0,maxN=0,secWith=0;
  for(let sec=0;sec<120;sec++){let any=0;for(let i=0;i<30;i++){EX.pos.x+=Math.cos(q[2]+1.57)*.12;EX.pos.z+=Math.sin(q[2]+1.57)*.12;EX.pos.y=-12;EX.depth=12;__SR.step(1/30);
      let n=0;for(let k=0;k<SEA.squid.count;k++){SEA.squid.getMatrixAt(k,m4);m4.decompose(pp,qq,ss);if(ss.x>0&&pp.distanceTo(camera.position)<40)n++;}vis+=n;frames++;maxN=Math.max(maxN,n);if(n)any=1;}secWith+=any;}
  return{avg:+(vis/frames).toFixed(2),maxN,secWith,count:SEA.squid.count};});
console.log(JSON.stringify(r),errs[0]||'');await b.close();

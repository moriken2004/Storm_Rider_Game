// ボートと海の生き物：潜って群れの中を走らせ、ボートの船体（半径 2.6m）の中に入った生き物を数える。node test/boatsea.mjs
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:640,height:360});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:'+(process.argv[2]||8795)+'/index.html',{timeout:120000});await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:300000,polling:300});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('bExplore').click();});await p.waitForFunction('EX.on&&!exLoading',{timeout:200000,polling:200});
const r=await p.evaluate(()=>{let q=null;for(let rr=500;rr<2600&&!q;rr+=40)for(let a=0;a<6.28;a+=.2){const x=BASE.x+Math.cos(a)*rr,z=BASE.z+Math.sin(a)*rr;if(exGround(x,z)<-18){q=[x,z];break;}}
  EX.pos.set(q[0],-6,q[1]);EX.depth=6;EX.mode='dive';for(let i=0;i<60;i++){EX.pos.set(q[0],-6,q[1]);__SR.step(1/30);}
  const m4=new THREE.Matrix4(),pp=new V3(),qq=new THREE.Quaternion(),ss=new V3();let bad=0,tot=0,near=0;const kinds={};
  // 一番近い群れの真ん中へ向けて、ボートを何度も通す
  for(let pass=0;pass<6;pass++){const sc=SEA.schools.filter(s=>s.ok).sort((a,b)=>a.p.distanceTo(EX.pos)-b.p.distanceTo(EX.pos))[0];if(!sc)break;const tgt=sc.p.clone();
    for(let i=0;i<150;i++){const d=tgt.clone().sub(EX.pos);d.y=0;const L=d.length();if(L>.5)EX.pos.addScaledVector(d.normalize(),Math.min(L,.25));EX.pos.y=tgt.y;EX.depth=-tgt.y;__SR.step(1/30);
      for(const[k,m]of[['魚',SEA.fish],['礁の魚',SEA.reef],['イカ',SEA.squid],['エイ',SEA.ray],['サメ',SEA.shark],['クラゲ',SEA.jelly]]){for(let j=0;j<m.count;j++){m.getMatrixAt(j,m4);m4.decompose(pp,qq,ss);if(ss.x<=0||pp.y<-1e3)continue;tot++;const dy=pp.y-EX.pos.y,dh=Math.hypot(pp.x-EX.pos.x,pp.z-EX.pos.z);if(dh<6)near++;if(dy>-1.1&&dy<1.6&&dh<2.4){bad++;kinds[k]=(kinds[k]||0)+1;}}}}}
  return{bad,near,tot,kinds};});
console.log(JSON.stringify(r));console.log(errs[0]||(r.bad===0&&r.near>0?'ボートの中に生き物はいない':'ボートの中に生き物がいる'));await b.close();

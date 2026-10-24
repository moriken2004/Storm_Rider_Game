// 海の生き物が構造物（岸壁・防波堤・突堤・船など）の中に入っていないか。港の近くで潜って 10 秒、箱の中に入ったコマを数える。node test/seastruct.mjs
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:640,height:360});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8795/index.html',{timeout:120000});await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:300000,polling:300});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('bExplore').click();});await p.waitForFunction('EX.on&&!exLoading',{timeout:200000,polling:200});
const r=await p.evaluate(()=>{const inside=(q)=>{for(const c of exColsNear(q.x,q.z,1)){if(q.y<c[1]||q.y>c[4])continue;const dx=q.x-c[6],dz=q.z-c[7],u=dx*c[10]+dz*c[11],v=dx*c[12]+dz*c[13];if(Math.abs(u)<c[8]-.05&&Math.abs(v)<c[9]-.05)return true;}return false;};
  const m4=new THREE.Matrix4(),pp=new V3(),qq=new THREE.Quaternion(),ss=new V3();const out={};
  // 防波堤の外側・突堤の脇・岸壁の前（基地の座標）
  for(const[name,x,z]of[['防波堤',1560,-190],['突堤',1380,40],['岸壁',1300,150],['堤頭',1680,40]]){const X=BASE.x+x,Z=BASE.z+z;let bad=0,tot=0;const kinds={};
    for(let i=0;i<300;i++){EX.pos.set(X,-6,Z);EX.depth=6;EX.mode='dive';EX.vel.set(0,0,0);__SR.step(1/30);if(i<60)continue;
      for(const[k,m]of[['魚',SEA.fish],['サメ',SEA.shark],['エイ',SEA.ray],['イカ',SEA.squid],['礁の魚',SEA.reef],['クラゲ',SEA.jelly],['サンゴ',SEA.coralB],['カジメ',SEA.kelp],['アマモ',SEA.eel]]){for(let j=0;j<m.count;j++){m.getMatrixAt(j,m4);m4.decompose(pp,qq,ss);if(ss.x<=0||pp.y<-1e3)continue;tot++;if(inside(pp)){bad++;kinds[k]=(kinds[k]||0)+1;}}}}
    out[name]={bad,tot,kinds};}
  return out;});
console.log(JSON.stringify(r));const bad=Object.values(r).reduce((a,q)=>a+q.bad,0);console.log(errs[0]||(bad===0?'構造物の中に生き物はいない':'構造物の中に生き物がいる '+bad));await b.close();

// 左右対称の点検：全ての形で、着陸脚（buildGear）と機体（buildAircraft、部品をまとめる前）の部品を、左右の鏡の位置で 1 対 1 に突き合わせる。
// 相手のいない部品を出す（右の主脚が丸ごと消えていた不具合の再発防止）。node test/gearcheck.mjs
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8795/index.html?nomerge');await p.evaluate(()=>{window.__NOMERGE=1;});await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000});
const r=await p.evaluate(()=>{window.__NOMERGE=1;const res=[];
  const unmatched=(root)=>{root.updateMatrixWorld(true);const L=[],bx=new THREE.Box3(),c=new THREE.Vector3(),sz=new THREE.Vector3();
    root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh)return;for(let q=o;q;q=q.parent)if(q.userData&&q.userData.crew)return;let vis=true;for(let q=o;q;q=q.parent)if(!q.visible&&q!==root)vis=vis;bx.setFromObject(o);if(bx.isEmpty())return;bx.getCenter(c);bx.getSize(sz);L.push({x:c.x,y:c.y,z:c.z,s:sz.clone(),t:o.geometry.type,m:o,used:false});});
    const bad=[];for(const a of L){if(Math.abs(a.x)<.03||a.used)continue;let best=null,bd=1e9;for(const q of L){if(q===a||q.used||q.t!==a.t)continue;const d=Math.hypot(q.x+a.x,q.y-a.y,q.z-a.z)+Math.abs(q.s.x-a.s.x)+Math.abs(q.s.y-a.s.y)+Math.abs(q.s.z-a.s.z);if(d<bd){bd=d;best=q;}}
      if(best&&bd<.1){best.used=true;a.used=true;}else bad.push([a.t,+a.x.toFixed(2),+a.y.toFixed(2),+a.z.toFixed(2),[+a.s.x.toFixed(2),+a.s.y.toFixed(2),+a.s.z.toFixed(2)]]);}
    return bad;};
  for(let i=0;i<SHAPES.length;i++){const g=buildGear(SHAPES[i],0x2b6cc4);const gb=unmatched(g);let ab=[];try{const m=buildAircraft(0x2b6cc4,'SR-01',i,SCHEMES[0]);ab=unmatched(m);}catch(e){ab=['ERR '+e.message];}
    const ext=ab.filter(q=>Array.isArray(q)&&Math.max(...q[4])>.35&&!(q[0]==='BoxGeometry'&&q[4][0]===.05&&q[4][1]===.5)&&!(Math.abs(q[1])<.7&&q[2]>.6&&q[3]<-3&&q[3]>-9.5));res.push({i,name:SHAPES[i].name,gear:gb,aircraft:ext.slice(0,8),aircraftN:ext.length});}
  return res;});
/* 例外：機首の下のブレードアンテナ（前脚を避けて横に寄せてある） */
let bad=0;for(const x of r){console.log(x.i,x.name,'脚の片側だけの部品',x.gear.length,'機体の外側の片側だけの部品',x.aircraftN);if(x.gear.length||x.aircraftN){bad++;console.log('  脚:',JSON.stringify(x.gear.slice(0,6)));}if(x.aircraftN)console.log('  機体:',JSON.stringify(x.aircraft));}
console.log(errs[0]||(bad?'左右非対称あり':'脚と機体は左右対称'));await b.close();

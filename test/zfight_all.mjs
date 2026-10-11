// 同じ平面で重なっている面（ちらつきの原因）を探す：node test/zfight.mjs
// 部品の結合を止めた状態で、基地・港・格納庫の全 Mesh の平らな面を調べ、同じ向き・同じ高さ（2cm 以内）で 1 ㎡以上重なる組を報告する
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage();p.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p.evaluateOnNewDocument(()=>{window.__NOMERGE=1;});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR');
const r=await p.evaluate(()=>{const S=__SR,base=S.P.mesh.parent.children.find(c=>c.userData.lod),root=S.P.mesh.parent;root.updateMatrixWorld(true);base.visible=false;
  const V=THREE.Vector3,faces=[],a=new V,b2=new V,c=new V,n=new V,e1=new V,e2=new V;let meshes=0;
  root.traverse(m=>{if(!m.isMesh||m.isInstancedMesh)return;{let q=m,v=true;while(q){if(q===base)v=false;q=q.parent;}if(!v||!m.visible)return;}
    const mt=m.material;if(Array.isArray(mt))return;const g=m.geometry,pa=g.attributes.position,ix=g.index,nt=ix?ix.count/3:pa.count/3;if(nt>80)return;meshes++;
    const soft=!!(mt.polygonOffset||mt.depthWrite===false||mt.blending===THREE.AdditiveBlending);const local=new Map();
    for(let i=0;i<nt;i++){const i0=ix?ix.getX(i*3):i*3,i1=ix?ix.getX(i*3+1):i*3+1,i2=ix?ix.getX(i*3+2):i*3+2;a.fromBufferAttribute(pa,i0).applyMatrix4(m.matrixWorld);b2.fromBufferAttribute(pa,i1).applyMatrix4(m.matrixWorld);c.fromBufferAttribute(pa,i2).applyMatrix4(m.matrixWorld);
      e1.subVectors(b2,a);e2.subVectors(c,a);n.crossVectors(e1,e2);const ar=n.length()/2;if(ar<.05)continue;n.normalize();const d=n.dot(a),k=Math.round(n.x*50)+','+Math.round(n.y*50)+','+Math.round(n.z*50)+','+Math.round(d*20);
      let f=local.get(k);if(!f)local.set(k,f={n:n.clone(),d,min:new V(1e9,1e9,1e9),max:new V(-1e9,-1e9,-1e9),ar:0,m,soft,ds:mt.side===THREE.DoubleSide});for(const v of[a,b2,c]){f.min.min(v);f.max.max(v);}f.ar+=ar;}
    for(const f of local.values())if(f.ar>1)faces.push(f);});
  // 向きと距離でまとめて、重なる組を探す
  const bins=new Map();for(const f of faces){const k=Math.round(f.n.x*30)+','+Math.round(f.n.y*30)+','+Math.round(f.n.z*30);let L=bins.get(k);if(!L)bins.set(k,L=[]);L.push(f);}
  const out=[],nm=f=>{const g=f.m.geometry;return g.type.replace('Geometry','')+'('+['x','y','z'].map(k=>(f.max[k]-f.min[k]).toFixed(0)).join('×')+')';};
  for(const L of bins.values()){L.sort((p,q)=>p.d-q.d);for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length&&L[j].d-L[i].d<.02;j++){const A=L[i],B=L[j];if(A.m===B.m||A.n.dot(B.n)<.9995)continue;if(A.soft||B.soft)continue;
      const ov=['x','y','z'].map(k=>Math.min(A.max[k],B.max[k])-Math.max(A.min[k],B.min[k]));const big=ov.filter(v=>v>.25);if(ov.some(v=>v<-.01)||big.length<2)continue;const area=big.sort((x,y)=>y-x)[0]*big[1];if(area<1)continue;
      if(A.m.material===B.m.material&&A.m.material.map==null)continue; // 同じ無地の材質どうしは重なっても見分けがつかない
      const cx=(Math.max(A.min.x,B.min.x)+Math.min(A.max.x,B.max.x))/2,cy=(Math.max(A.min.y,B.min.y)+Math.min(A.max.y,B.max.y))/2,cz=(Math.max(A.min.z,B.min.z)+Math.min(A.max.z,B.max.z))/2;
      out.push({area:+area.toFixed(1),gap:+(L[j].d-L[i].d).toFixed(3),n:[A.n.x,A.n.y,A.n.z].map(v=>+v.toFixed(1)).join(','),at:[cx,cy,cz].map(v=>Math.round(v)).join(','),a:nm(A),b:nm(B)});}}
  out.sort((p,q)=>q.area-p.area);return{meshes,faces:faces.length,n:out.length,out:out.slice(0,60)};});
console.log(`部品 ${r.meshes}／面 ${r.faces}／重なり ${r.n} 組（面積の大きい順、位置は基地の座標で 高さは滑走路面からの差）`);
for(const o of r.out)console.log(`  ${String(o.area).padStart(8)}㎡  差${o.gap}m  向き(${o.n})  位置(${o.at})  ${o.a} × ${o.b}`);
await b.close();

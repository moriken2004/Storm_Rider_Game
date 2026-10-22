// 基地の部品のうち、真下に支え（ほかの部品か地面）がなく浮いているものを洗い出す（mergeStatic を止めて読み込む）
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new'});const p=await b.newPage();p.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p.evaluateOnNewDocument(()=>{window.__NOMERGE=1;});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:90000});
const r=await p.evaluate(()=>{const S=__SR,T=S.camera.constructor;let root=S.camera;const sc=window.__SR.scene||null;
  // シーンを探す
  let scene=null;S.P.mesh.traverseAncestors(a=>{if(a.isScene)scene=a;});const B=scene.children.find(c=>c.userData&&c.userData.hangar);
  const meshes=[];B.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&o.visible&&!(o.material&&o.material.transparent)){const bx=new THREE.Box3().setFromObject(o),sz=new THREE.Vector3();bx.getSize(sz);if(Math.max(sz.x,sz.y,sz.z)<700)meshes.push(o);   /* 岸壁（640m）も部品に入れる：防舷材は岸壁に付いている */}});
  B.updateMatrixWorld(true);const out=[],boxes=meshes.map(m=>new THREE.Box3().setFromObject(m));
  // 触れ合う部品をまとめ（外形の箱を 0.3m 広げて判定）、まとまりのどれも地面に届いていないものを浮いているとみなす
  const N=meshes.length,par=[...Array(N).keys()],fd=i=>{while(par[i]!==i)i=par[i]=par[par[i]];return i;},ex=boxes.map(bx=>bx.clone().expandByScalar(.3));
  for(let i=0;i<N;i++)for(let j=i+1;j<N;j++)if(ex[i].intersectsBox(ex[j])){const a=fd(i),b=fd(j);if(a!==b)par[a]=b;}
  const grounded=new Set();for(let i=0;i<N;i++){const bb=ex[i],c=new THREE.Vector3();bb.getCenter(c);let gy=-1e9;for(const[dx,dz]of[[0,0],[bb.min.x-c.x,0],[bb.max.x-c.x,0],[0,bb.min.z-c.z],[0,bb.max.z-c.z]])gy=Math.max(gy,Math.max(islandH(c.x+dx,c.z+dz-21000),0));if(bb.min.y<=gy+.2)grounded.add(fd(i));}
  const groups=new Map();for(let i=0;i<N;i++){const r=fd(i);if(grounded.has(r))continue;if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i);}
  for(const[r,list]of groups){const u=new THREE.Box3();list.forEach(i=>u.union(boxes[i]));const c=new THREE.Vector3(),sz=new THREE.Vector3();u.getCenter(c);u.getSize(sz);const gy=Math.max(islandH(c.x,c.z-21000),0);
    out.push({gap:+(u.min.y-gy).toFixed(1),n:list.length,y:+u.min.y.toFixed(1),x:+c.x.toFixed(0),z:+(c.z-21000).toFixed(0),sz:[sz.x,sz.y,sz.z].map(v=>+v.toFixed(1)),geo:meshes[list[0]].geometry.type,col:meshes[list[0]].material.color?meshes[list[0]].material.color.getHexString():''});}
  out.sort((a,b)=>b.gap-a.gap);return JSON.stringify({n:meshes.length,float:out.length,list:out.slice(0,80)});});
const o=JSON.parse(r);console.log('部品',o.n,'浮いている候補',o.float);for(const e of o.list)console.log(JSON.stringify(e));
await b.close();

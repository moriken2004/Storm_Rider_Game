// 当たり判定の点検：基地の地面近く（地面から 0.3〜3.5m に掛かる）の物で、当たり判定（exCols）・凸凹（exBumps）・木の幹のどれにも入っていない物を数え、種類と場所を出す。node test/colaudit.mjs
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000});
const r=await p.evaluate(()=>{window.__NOAUDIT=1;const B=baseGroup,C=B.userData.exCols||[],Bu=B.userData.exBumps||[];B.updateMatrixWorld(true);
  const covered=(x,y,z)=>{for(const c of C){if(y<c[1]-.3||y>c[4]+.3)continue;const dx=x-c[6],dz=z-c[7];if(Math.abs(dx*c[10]+dz*c[11])<=c[8]+.3&&Math.abs(dx*c[12]+dz*c[13])<=c[9]+.3)return true;}
    for(const q of Bu){if(Math.hypot(x-q[0],z-q[2])<Math.max(q[3],q[5])+.3)return true;}return false;};
  const veg=new Set();for(const k of['trees','avenue','palms','shrubs'])(Array.isArray(B.userData[k])?B.userData[k]:[B.userData[k]]).forEach(m=>m&&veg.add(m));
  const out=new Map();const bx=new THREE.Box3(),m4=new THREE.Matrix4(),c=new THREE.Vector3();
  const check=(o,box,label)=>{const gy=Math.max(islandH((box.min.x+box.max.x)/2-BASE.x,(box.min.z+box.max.z)/2-BASE.z),0),hy=box.max.y-box.min.y,sx=box.max.x-box.min.x,sz=box.max.z-box.min.z;
    if(box.max.y<gy+.3||box.min.y>gy+3.5||hy<.25||sx>300||sz>300)return;if(sx*sz>2500&&hy<.12*Math.max(sx,sz))return;box.getCenter(c);if(covered(c.x,Math.min(c.y,gy+1),c.z))return;
    const k=label;const e=out.get(k)||{n:0,ex:[]};e.n++;if(e.ex.length<3)e.ex.push([Math.round(c.x-BASE.x),Math.round(c.z-BASE.z),+sx.toFixed(1),+hy.toFixed(1),+sz.toFixed(1)]);out.set(k,e);};
  B.traverse(o=>{if(!o.isMesh||!o.visible)return;for(let q=o;q&&q!==B;q=q.parent)if(q.userData.dyn&&!q.userData.push)return;if(veg.has(o))return;const mat=Array.isArray(o.material)?o.material[0]:o.material;if(mat.transparent||mat.depthWrite===false)return;
    const label=(o.isInstancedMesh?'I:':'')+o.geometry.type+':'+(mat.color?mat.color.getHexString():'')+(o.userData.push?':push':'');
    if(o.isInstancedMesh){o.geometry.computeBoundingBox();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m4);m4.premultiply(o.matrixWorld);bx.copy(o.geometry.boundingBox).applyMatrix4(m4);check(o,bx,label);}}
    else{if(o.userData.push)return;bx.setFromObject(o);check(o,bx,label);}});
  return[...out].sort((a,b)=>b[1].n-a[1].n);});
let tot=0;for(const[k,e]of r){tot+=e.n;console.log(String(e.n).padStart(5),k,JSON.stringify(e.ex));}console.log('当たり判定のない物',tot);await b.close();

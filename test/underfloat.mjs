// 海中で浮いている構造物（水面より下まで届くのに、真下の海底まで届かない物）を探す。node test/underfloat.mjs
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();
await p.evaluateOnNewDocument(()=>{window.__NOMERGE=1;});   // 材質ごとにまとめると 1 つずつ調べられないので、まとめずに読み込む
await p.goto('http://127.0.0.1:8795/index.html',{timeout:120000});await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:600000,polling:500});
const r=await p.evaluate(()=>{baseGroup.updateMatrixWorld(true);const out=[],bb=new THREE.Box3(),m4=new THREE.Matrix4(),c=new V3(),sz=new V3();
  const gnd=(x,z)=>{const bx=x-BASE.x,bz=z-BASE.z;return islandH(bx,bz);};
  const test=(box,name,col,o)=>{if(box.min.y>-.5||box.max.y<-1)return;box.getCenter(c);box.getSize(sz);if(sz.x<1.5&&sz.z<1.5)return;
    // 足もとの海底（中心と四隅のいちばん高い所）。構造物の下端との差
    let g=-1e9;for(const[dx,dz]of[[0,0],[-.4,-.4],[.4,-.4],[-.4,.4],[.4,.4]])g=Math.max(g,gnd(c.x+dx*sz.x,c.z+dz*sz.z));const gap=box.min.y-g;if(gap>1)out.push({name,gap:+gap.toFixed(1),bot:+box.min.y.toFixed(1),floor:+g.toFixed(1),x:Math.round(c.x-BASE.x),z:Math.round(c.z-BASE.z),sz:[+sz.x.toFixed(1),+sz.y.toFixed(1),+sz.z.toFixed(1)],col,par:o&&o.parent?(o.parent.name||o.parent.type)+(o.parent.parent?'<'+(o.parent.parent.name||o.parent.parent.type):''):''});};
  baseGroup.traverse(o=>{if(!o.isMesh||!o.geometry)return;if(o.userData.supported||o.userData.onMound)return;   /* 根元・壁の続き・捨て石の土台に支えられている物 */if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
    const col=o.material&&o.material.color?o.material.color.getHexString():'';
    if(o.isInstancedMesh){for(let i=0;i<o.count;i++){o.getMatrixAt(i,m4);m4.premultiply(o.matrixWorld);bb.copy(o.geometry.boundingBox).applyMatrix4(m4);test(bb,'一括:'+o.geometry.type,col,o);}}
    else{bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);test(bb,o.geometry.type,col,o);}});
  return out;});
const groups={};for(const q of r){const k=q.name+'/'+q.col;(groups[k]=groups[k]||[]).push(q);}
for(const[k,v]of Object.entries(groups)){v.sort((a,b)=>b.gap-a.gap);console.log(k,'件数',v.length,'最大',JSON.stringify(v[0]),v.length>1?'最小 '+v[v.length-1].gap:'');}
console.log('浮いている候補',r.length);await b.close();

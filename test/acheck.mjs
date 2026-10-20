// 機体の作りの点検：浮いている部品（本体とつながっていない）と、同じ平面で重なる面（ちらつき）を、全部の機体の形・僚機・迎撃機について調べる。
// node test/acheck.mjs [形の番号...]   形を省くと全部。結果は部品の位置（機体の座標：x 右, y 上, z 前が負）・大きさ・色で出す
import puppeteer from 'puppeteer';
const only=process.argv.slice(2).map(Number);
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000});const p=await b.newPage();
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.evaluateOnNewDocument(()=>{window.__NOMERGE=1;});   // 部品をまとめる前の状態で調べる（まとめると部品どうしの重なりが見えない）
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
const src=await (await fetch('http://127.0.0.1:8795/index.html')).text();const LINES=src.split('\n');
const res=await p.evaluate(only=>{const out=[];const V=THREE.Vector3;
  // 部品を足した場所（index.html の行と列）を記録する
  const add0=THREE.Object3D.prototype.add;THREE.Object3D.prototype.add=function(...os){const st=(new Error().stack||'').split('\n');const fr=[];for(const l of st.slice(2,8)){const m=l.match(/index\.html:(\d+):(\d+)/);if(m)fr.push(m[1]+':'+m[2]);}const at=fr.slice(0,2).join(',');for(const o of os)if(o&&o.userData&&!o.userData._at)o.userData._at=at;return add0.apply(this,os);};
  const targets=[];for(let i=0;i<SHAPES.length;i++)if(!only.length||only.includes(i))targets.push(['形'+i+' '+SHAPES[i].name,()=>{const m=buildAircraft(0x2b6cc4,'SR-01',i,SCHEMES[0]);addArmor(m);const gr=buildGear(m.userData.shape,m.userData.bodyHex);m.add(gr);return m;}]);   // 装甲板と脚（降ろした状態）も含める
  if(!only.length)targets.push(['迎撃機',()=>buildFighter()]);
  for(const[name,mk]of targets){const g=mk();g.position.set(0,0,0);g.rotation.set(0,0,0);g.scale.set(1,1,1);g.updateMatrixWorld(true);
    const ms=[];g.traverse(o=>{if(!o.isMesh||!o.visible)return;let vis=true;for(let q=o;q;q=q.parent)if(!q.visible)vis=false;if(!vis)return;const m=Array.isArray(o.material)?o.material[0]:o.material;
      if(m.blending===THREE.AdditiveBlending||m.transparent&&m.opacity<.5)return;const geo=o.geometry;if(!geo.attributes.position)return;
      const pos=geo.attributes.position,idx=geo.index,n=idx?idx.count:pos.count;const T=new Float32Array(n*3);const v=new V();
      const inst=o.isInstancedMesh?o.count:1;
      for(let k=0;k<inst;k++){const M=new THREE.Matrix4();if(o.isInstancedMesh){o.getMatrixAt(k,M);M.premultiply(o.matrixWorld);}else M.copy(o.matrixWorld);
        const TT=k?new Float32Array(n*3):T;for(let i=0;i<n;i++){v.fromBufferAttribute(pos,idx?idx.getX(i):i).applyMatrix4(M);TT[i*3]=v.x;TT[i*3+1]=v.y;TT[i*3+2]=v.z;}
        const bb=new THREE.Box3();for(let i=0;i<n;i++)bb.expandByPoint(v.set(TT[i*3],TT[i*3+1],TT[i*3+2]));
        let at='';for(let q=o;q&&!at;q=q.parent)at=q.userData._at||'';const pr=geo.parameters?Object.values(geo.parameters).filter(v=>typeof v==='number').slice(0,3).map(v=>+v.toFixed(3)).join('x'):'';ms.push({o,T:TT,bb,col:m.color?'#'+m.color.getHexString():'-',geo:geo.type+'('+pr+')',inst:k,at});}});
    // つながり：2cm 以内、または辺が相手の三角形を貫く
    const TH=.02,tri=new THREE.Triangle(),cp=new V(),pa=new V(),pb=new V(),pc=new V(),q=new V(),ray=new THREE.Ray(),hit=new V();
    const par=ms.map((_,i)=>i),fd=i=>par[i]===i?i:(par[i]=fd(par[i])),un=(a,b2)=>{par[fd(a)]=fd(b2);};
    const near=(A,B)=>{const bbB=B.bb.clone().expandByScalar(TH),bbA=A.bb.clone().expandByScalar(TH);
      const tb=[];for(let i=0;i<B.T.length;i+=9){const x0=Math.min(B.T[i],B.T[i+3],B.T[i+6]),x1=Math.max(B.T[i],B.T[i+3],B.T[i+6]),y0=Math.min(B.T[i+1],B.T[i+4],B.T[i+7]),y1=Math.max(B.T[i+1],B.T[i+4],B.T[i+7]),z0=Math.min(B.T[i+2],B.T[i+5],B.T[i+8]),z1=Math.max(B.T[i+2],B.T[i+5],B.T[i+8]);
        if(x1<bbA.min.x||x0>bbA.max.x||y1<bbA.min.y||y0>bbA.max.y||z1<bbA.min.z||z0>bbA.max.z)continue;tb.push(i);}
      if(!tb.length)return false;
      for(let i=0;i<A.T.length;i+=3){q.set(A.T[i],A.T[i+1],A.T[i+2]);if(!bbB.containsPoint(q))continue;for(const j of tb){tri.set(pa.set(B.T[j],B.T[j+1],B.T[j+2]),pb.set(B.T[j+3],B.T[j+4],B.T[j+5]),pc.set(B.T[j+6],B.T[j+7],B.T[j+8]));tri.closestPointToPoint(q,cp);if(cp.distanceToSquared(q)<TH*TH)return true;}}
      // 辺の貫通（細い支柱が翼を突き抜けるなど）
      for(let i=0;i<A.T.length;i+=9)for(let e=0;e<3;e++){const s=i+e*3,t=i+((e+1)%3)*3;pa.set(A.T[s],A.T[s+1],A.T[s+2]);pb.set(A.T[t],A.T[t+1],A.T[t+2]);const L=pa.distanceTo(pb);if(L<1e-5)continue;ray.set(pa,pb.clone().sub(pa).multiplyScalar(1/L));
        for(const j of tb){if(ray.intersectTriangle(q.set(B.T[j],B.T[j+1],B.T[j+2]),pc.set(B.T[j+3],B.T[j+4],B.T[j+5]),cp.set(B.T[j+6],B.T[j+7],B.T[j+8]),false,hit)&&hit.distanceTo(pa)<=L)return true;}}
      return false;};
    for(let i=0;i<ms.length;i++)for(let j=i+1;j<ms.length;j++){if(fd(i)===fd(j))continue;const A=ms[i],B=ms[j];if(!A.bb.clone().expandByScalar(TH).intersectsBox(B.bb))continue;if(near(A,B)||near(B,A))un(i,j);}
    // 本体＝いちばん大きな部品の組
    const vol=b2=>{const s=b2.getSize(new V());return s.x*s.y*s.z+s.x*s.z;};const sz={};ms.forEach((m,i)=>{const r=fd(i);sz[r]=(sz[r]||0)+vol(m.bb);});const main=+Object.keys(sz).sort((a,b2)=>sz[b2]-sz[a])[0];
    const fl=[];ms.forEach((m,i)=>{if(fd(i)===main)return;const c=m.bb.getCenter(new V()),s=m.bb.getSize(new V());fl.push(`  浮き @${m.at} ${m.geo} ${m.col} 中心(${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)}) 大きさ(${s.x.toFixed(2)},${s.y.toFixed(2)},${s.z.toFixed(2)})`);});
    // 同じ平面で重なる面
    const buck=new Map(),nrm=new V(),e1=new V(),e2=new V();const tris=[];
    ms.forEach((m,mi)=>{for(let i=0;i<m.T.length;i+=9){pa.set(m.T[i],m.T[i+1],m.T[i+2]);e1.set(m.T[i+3]-pa.x,m.T[i+4]-pa.y,m.T[i+5]-pa.z);e2.set(m.T[i+6]-pa.x,m.T[i+7]-pa.y,m.T[i+8]-pa.z);nrm.crossVectors(e1,e2);const ar=nrm.length()/2;if(ar<4e-4)continue;nrm.normalize();const d=nrm.dot(pa);
      const key=[Math.round(nrm.x*60),Math.round(nrm.y*60),Math.round(nrm.z*60),Math.round(d/.004)].join(',');const t={mi,i,n:nrm.clone(),d,ar};tris.push(t);let a=buck.get(key);if(!a)buck.set(key,a=[]);a.push(t);}});
    const ov2=(P,Q)=>{// 2 つの三角形（同一平面）の重なり：分離軸で判定し、面積の目安を返す
      const ax=[];for(const S of[P,Q])for(let e=0;e<3;e++){const a=S[e],c=S[(e+1)%3];ax.push([-(c[1]-a[1]),c[0]-a[0]]);}
      let minPen=1e9;for(const[ux,uy]of ax){const l=Math.hypot(ux,uy);if(l<1e-9)continue;const pr=S=>S.map(v=>(v[0]*ux+v[1]*uy)/l);const a=pr(P),c=pr(Q);const pen=Math.min(Math.max(...a),Math.max(...c))-Math.max(Math.min(...a),Math.min(...c));if(pen<=.003)return 0;minPen=Math.min(minPen,pen);}return minPen;};
    const zf=new Map();const seen=new Set();
    for(const[key,a]of buck){const[k0,k1,k2,k3]=key.split(',').map(Number);const nb=[...a];for(const dd of[-1,1]){const o=buck.get([k0,k1,k2,k3+dd].join(','));if(o)nb.push(...o);}
      for(const t of a)for(const u of nb){if(u===t||(u.mi===t.mi&&u.i===t.i))continue;const pk=t.mi<u.mi||(t.mi===u.mi&&t.i<u.i)?t.mi+':'+t.i+'|'+u.mi+':'+u.i:u.mi+':'+u.i+'|'+t.mi+':'+t.i;if(seen.has(pk))continue;seen.add(pk);
        if(t.n.dot(u.n)<.9995||Math.abs(t.d-u.d)>.004)continue;
        // 平面に投影
        const n=t.n,up=Math.abs(n.y)<.9?new V(0,1,0):new V(1,0,0),bx=new V().crossVectors(up,n).normalize(),by=new V().crossVectors(n,bx);
        const P2=(m,i)=>[0,1,2].map(k=>{const x=ms[m].T[i+k*3],y=ms[m].T[i+k*3+1],z=ms[m].T[i+k*3+2];return[x*bx.x+y*bx.y+z*bx.z,x*by.x+y*by.y+z*by.z];});
        const pen=ov2(P2(t.mi,t.i),P2(u.mi,u.i));if(pen>.003){const mk=t.mi===u.mi?'同じ部品 '+t.mi:Math.min(t.mi,u.mi)+'&'+Math.max(t.mi,u.mi);const e=zf.get(mk)||{n:0,pen:0,c:new V()};e.n++;e.pen=Math.max(e.pen,pen);e.c.set(ms[t.mi].T[t.i],ms[t.mi].T[t.i+1],ms[t.mi].T[t.i+2]);zf.set(mk,e);}}}
    const zl=[...zf].map(([k,e])=>{const ids=k.replace('同じ部品 ','').split('&').map(Number);const d=ids.map(i=>ms[i].geo+' '+ms[i].col+' @'+ms[i].at).join(' / ');return `  重なり ${k} [${d}] 組${e.n} 位置(${e.c.x.toFixed(2)},${e.c.y.toFixed(2)},${e.c.z.toFixed(2)}) 重なり幅${e.pen.toFixed(3)}m`;});
    out.push(`== ${name}  部品 ${ms.length}  浮き ${fl.length}  重なり ${zl.length}\n`+fl.slice(0,30).join('\n')+(fl.length?'\n':'')+zl.slice(0,40).join('\n'));}
  return out.join('\n');},only);
console.log(res.replace(/,?(\d+):(\d+)(?=[,\s])/g,(m,l,c)=>{const t=LINES[l-1]||'';const k=Math.max(0,c-60);return ' L'+l+'«'+t.slice(Math.max(0,c-45),+c+15).replace(/\s+/g,' ')+'»';}));console.log(errs.slice(0,3).join('\n')||'エラーなし');await b.close();

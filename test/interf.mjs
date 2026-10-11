// 機体部品の干渉検査：node test/interf.mjs [形 ...]
// 排気・吸気の通り道、エンジン本体、車輪、ディフューザー、地面に他の部品が入っていないか、どこにも接していない部品がないかを調べる
import puppeteer from 'puppeteer';
const shapes=process.argv.slice(2).map(Number);
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage();p.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:30000});
await p.evaluate(()=>{document.getElementById('bOpts').click();});
const n=await p.evaluate(()=>document.getElementById('oShape').children.length);
for(const si of shapes.length?shapes:[...Array(n).keys()]){
  const r=await p.evaluate(si=>{
    const btn=document.getElementById('oShape').children[si];btn.click();
    const root=__SR.P.mesh,ud=root.userData;root.updateMatrixWorld(true);
    const inv=new THREE.Matrix4().copy(root.matrixWorld).invert(),M=new THREE.Matrix4(),V=THREE.Vector3;
    const parts=[];
    root.traverse(o=>{if(!o.isMesh)return;let vis=true,tag='',q=o;while(q&&q!==root){if(!q.visible)vis=false;if(q.userData.eng)tag='eng';if(q.userData.podm||q===ud.pod)tag='pod';if(q===ud.gear)tag='gear';q=q.parent;}
      if(!vis||(ud.plumes&&ud.plumes.includes(o)))return;
      M.multiplyMatrices(inv,o.matrixWorld);const g=o.geometry,pa=g.attributes.position,ix=g.index,pts=[];const a=new V,b2=new V,c=new V,t=new V;
      const nt=ix?ix.count/3:pa.count/3;
      for(let i=0;i<nt;i++){const i0=ix?ix.getX(i*3):i*3,i1=ix?ix.getX(i*3+1):i*3+1,i2=ix?ix.getX(i*3+2):i*3+2;
        a.fromBufferAttribute(pa,i0).applyMatrix4(M);b2.fromBufferAttribute(pa,i1).applyMatrix4(M);c.fromBufferAttribute(pa,i2).applyMatrix4(M);
        const L=Math.max(a.distanceTo(b2),b2.distanceTo(c),c.distanceTo(a)),k=Math.max(1,Math.ceil(L/.18));
        for(let u=0;u<=k;u++)for(let v=0;v<=k-u;v++){t.set(0,0,0).addScaledVector(a,u/k).addScaledVector(b2,v/k).addScaledVector(c,1-(u+v)/k);pts.push(t.x,t.y,t.z);}}
      let cx=0,cy=0,cz=0;for(let i=0;i<pts.length;i+=3){cx+=pts[i];cy+=pts[i+1];cz+=pts[i+2];}const np=pts.length/3;
      parts.push({o,tag,pts,name:g.type.replace('Geometry','').replace('Buffer','Loft')+'@'+[cx/np,cy/np,cz/np].map(x=>x.toFixed(1)).join(',')});});
    const E=ud.engPos,sc=ud.engSc,gp=ud.shape.gear||[2.5,.02],PY=ud.podY,out=[];
    // 立入禁止の体積：[名前, 許す部品の種類, 判定(x,y,z)→めり込み深さ(>0 で干渉)]
    const cyl=(cx,cy,z0,z1,r)=>(x,y,z)=>z>z0&&z<z1?r-Math.hypot(x-cx,y-cy):-1;
    const sph=(cx,cy,cz,r)=>(x,y,z)=>r-Math.hypot(x-cx,y-cy,z-cz);
    const vols=[];
    for(const s of[1,-1]){const sd=s>0?'右':'左';
      vols.push([sd+'排気の通り道','eng',cyl(s*E.x,E.y,E.z+4.2*sc,E.z+4.2*sc+10,.8*sc)]);
      vols.push([sd+'吸気の通り道','eng',cyl(s*E.x,E.y,E.z-3.7*sc-4,E.z-3.7*sc,.8*sc)]);
      vols.push([sd+'エンジン本体','eng',cyl(s*E.x,E.y,E.z-3.4*sc,E.z+4.1*sc,.82*sc)]);
      vols.push([sd+'主輪','gear',sph(s*gp[0],-3.1,2.3,.6)]);}
    vols.push(['前輪','gear',sph(0,-3.1,-7.6,.7)]);
    vols.push(['ディフューザー','pod',cyl(0,PY,-2.6,2.2,.5)]);
    vols.push(['地面（車輪の下端より下）','gear',(x,y,z)=>-3.6-y]);
    for(const pt of parts)for(const[vn,own,f]of vols){if(pt.tag===own)continue;let cnt=0,mx=0;const q=pt.pts;for(let i=0;i<q.length;i+=3){const d=f(q[i],q[i+1],q[i+2]);if(d>.03){cnt++;if(d>mx)mx=d;}}
      if(cnt)out.push(`干渉  ${vn} ← ${pt.name}${pt.tag?'['+pt.tag+']':''}  深さ ${mx.toFixed(2)}m`);}
    // 風防の外へ突き抜けていないか：操縦席の部品（頭と座席）を風防の楕円体と比べる
    if(ud.canopyG&&ud.heads){const cg=ud.canopyG,ci=new THREE.Matrix4().copy(cg.matrixWorld).invert(),sc=ud.canopy.scale,pv=new V;
      const chk=(o,nm)=>o.traverse(m=>{if(!m.isMesh)return;const pa=m.geometry.attributes.position;let mx=0;for(let i=0;i<pa.count;i++){pv.fromBufferAttribute(pa,i).applyMatrix4(m.matrixWorld).applyMatrix4(ci);
          const nx=pv.z<0?1-.5*(pv.z/(1.2*sc.z))**2:1,e=Math.hypot(pv.x/(1.2*sc.x*nx),pv.y/(1.2*sc.y),pv.z/(1.2*sc.z));if(pv.y>0&&e>mx)mx=e;}
        if(mx>1)out.push(`干渉  風防の外へ突き抜け ← ${nm} ${m.geometry.type}  ${((mx-1)*100).toFixed(0)}% 外`);});
      ud.heads.forEach(h=>chk(h.parent,'操縦席'));}
    // どこにも接していない部品：他の部品の表面まで 0.12m 以上離れている
    const cell=.3,H=new Map(),key=(x,y,z)=>Math.floor(x/cell)+','+Math.floor(y/cell)+','+Math.floor(z/cell);
    parts.forEach((pt,pi)=>{const q=pt.pts;for(let i=0;i<q.length;i+=3){const k=key(q[i],q[i+1],q[i+2]);let a=H.get(k);if(!a)H.set(k,a=[]);a.push(pi,q[i],q[i+1],q[i+2]);}});
    parts.forEach((pt,pi)=>{const q=pt.pts;let best=9;
      for(let i=0;i<q.length&&best>.12;i+=3){const x=q[i],y=q[i+1],z=q[i+2];for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){const a=H.get(key(x+dx*cell,y+dy*cell,z+dz*cell));if(!a)continue;
        for(let j=0;j<a.length;j+=4){if(a[j]===pi)continue;const d=Math.hypot(a[j+1]-x,a[j+2]-y,a[j+3]-z);if(d<best)best=d;}}}
      if(best>.12)out.push(`浮き  ${pt.name}${pt.tag?'['+pt.tag+']':''}  最寄りまで ${best>8?'0.3m 以上':best.toFixed(2)+'m'}`);});
    // 埋もれ：部品の表面の点から 6 方向に光線を飛ばし、どの方向も他の部品に遮られる点ばかりなら埋もれている（透明な風防は遮るものに数えない）
    const blockers=parts.filter(q=>!(q.o.material.transparent)&&q.o.material!==ud.canopy.material).map(q=>q.o),rc=new THREE.Raycaster(),W=root.matrixWorld,o3=new V,d3=new V;
    const dirs=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    for(const pt of parts){if(pt.tag==='gear')continue;const q=pt.pts,np=q.length/3,stp=Math.max(1,Math.floor(np/40));let seen=0,tot=0;const others=blockers.filter(m=>m!==pt.o);
      for(let i=0;i<np;i+=stp){tot++;let open=false;for(const d of dirs){o3.set(q[i*3]+d[0]*.04,q[i*3+1]+d[1]*.04,q[i*3+2]+d[2]*.04).applyMatrix4(W);d3.set(d[0],d[1],d[2]).transformDirection(W);rc.set(o3,d3);rc.far=40;if(!rc.intersectObjects(others,false).length){open=true;break;}}if(open)seen++;}
      const f=seen/tot;if(f<.34)out.push(`埋もれ  ${pt.name}${pt.tag?'['+pt.tag+']':''}  見えている点 ${Math.round(f*100)}%`);}
    return{name:btn.textContent,parts:parts.length,out};},si);
  console.log(`\n■ ${si} ${r.name}（部品 ${r.parts}）`+(r.out.length?'':'  問題なし'));r.out.forEach(l=>console.log('  '+l));
}
await b.close();

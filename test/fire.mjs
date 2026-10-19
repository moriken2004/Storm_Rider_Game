// 木の火災と爆風：ミサイルで木が燃え、燃え広がり、焦げる・爆風で隣の建物も壊れる・屋根と壁が一緒に崩れる・墜落で燃える・やり直しで元通り。node test/fire.mjs
import puppeteer from 'puppeteer';
const dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:600000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:1280,height:720});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
const ev=(f,...a)=>p.evaluate(f,...a);
await ev(()=>{window.requestAnimationFrame=()=>0;document.getElementById('title').hidden=true;const S=__SR,G=S.G;S.startRun('approach');if(G.mode==='cut')S.endCut();G.mode='play';S.P.inv=1e9;});
const steps=(n,dt)=>ev((n,dt)=>{const t0=performance.now();for(let i=0;i<n;i++){__SR.P.pos.y=1500;__SR.P.hull=100;__SR.step(dt);}return (performance.now()-t0)/n;},n,dt||1/30);
const look=(a)=>ev(a=>{const S=__SR,c=S.camera;S.step(1/30);for(let k=0;k<6;k++){c.position.set(a[0],a[1],a[2]);c.lookAt(a[3],a[4],a[5]);c.fov=50;c.updateProjectionMatrix();if(!k)S.cloudCut();vegUpdate(0);renderFrame();}},a);
const out=[];
// 森の濃い所を探す
const T=await ev(()=>{vegInit();let best=-1,bn=0;for(let id=0;id<VEG.X.length;id+=37){if(VEG.set[id]!==0)continue;let n=0;vegNear(VEG.X[id],VEG.Z[id],40,j=>{n++;});if(n>bn&&VEG.G[id]>20){bn=n;best=id;}}return[VEG.X[best],VEG.Y[best],VEG.Z[best],VEG.G[best],bn];});
out.push('森 '+JSON.stringify(T.map(v=>Math.round(v))));
const cam=[T[0]-150,T[3]+90,T[2]+150,T[0],T[3]+5,T[2]];
await look(cam);await p.screenshot({path:dir+'fire_0.png'});
// ミサイルが木に当たる
const hit=await ev(T=>{const S=__SR,V=S.P.pos.constructor;const q={pos:new V(T[0],T[1]-2,T[2]),dir:new V(0,-.3,-1).normalize()};return S.strHit(q,new V(T[0],T[1]-1,T[2]+4),5,45);},T);
out.push('木に命中 '+hit+' 燃えている '+await ev(()=>VEG.burn.length));
let ms=await steps(90);await look(cam);await p.screenshot({path:dir+'fire_1_3s.png'});
ms=await steps(300,1/15);out.push('20秒後 '+JSON.stringify(await ev(()=>({burn:VEG.burn.length,spread:VEG.spread,burnt:[...VEG.st].filter(v=>v===2).length}))));
await look(cam);await p.screenshot({path:dir+'fire_2_20s.png'});
const t3=await steps(30,1/30);out.push('燃えている間の 1 コマ '+t3.toFixed(1)+'ms');
await steps(600,1/15);out.push('60秒後 '+JSON.stringify(await ev(()=>({burn:VEG.burn.length,spread:VEG.spread,burnt:[...VEG.st].filter(v=>v===2).length}))));
await look(cam);await p.screenshot({path:dir+'fire_3_60s.png'});
// 爆風と同じ建物の部品
const bl=await ev(()=>{const S=__SR,cols=baseGroup.userData.colliders;strInit();const C=STR.cols;
  // 屋根と壁が別になっている倉庫（平面が重なる 2 つ）
  let pair=null;for(const a of C)for(const b of C){if(a===b||pair)continue;const e=a.c,s=b.c;if(e[8]===5||s[8]===5)continue;const ov=Math.max(0,Math.min(e[3],s[3])-Math.max(e[0],s[0]))*Math.max(0,Math.min(e[5],s[5])-Math.max(e[2],s[2]));if(ov>.6*Math.min((e[3]-e[0])*(e[5]-e[2]),(s[3]-s[0])*(s[5]-s[2]))&&(e[3]-e[0])*(e[5]-e[2])>400&&s[1]>e[1]+1)pair=[a,b];}
  const r={};if(pair){const[a,b2]=pair,c=b2.c;const V=S.P.pos.constructor;for(let i=0;i<6&&!b2.dead;i++)S.strHit({pos:new V((c[0]+c[3])/2,c[4]-.5,(c[2]+c[5])/2),dir:new V(0,-1,0)},new V((c[0]+c[3])/2,c[4]+1,(c[2]+c[5])/2),2,45);r.roofDead=b2.dead;r.wallDead=a.dead;}
  // 爆風：近くに別の施設がある小さな施設
  let near=null;for(const a of C){if(a.dead||a.c[8]===5)continue;const c=a.c;const nb=C.filter(q=>q!==a&&!q.dead&&q.c[8]!==5&&Math.max(q.c[0]-c[3],c[0]-q.c[3],q.c[2]-c[5],c[2]-q.c[5])<6&&Math.max(q.c[0]-c[3],c[0]-q.c[3],q.c[2]-c[5],c[2]-q.c[5])>0&&(q.c[3]-q.c[0])*(q.c[5]-q.c[2])<120);if(nb.length){near=[a,nb[0]];break;}}
  if(near){const[a,n]=near,c=a.c,V=S.P.pos.constructor;const hp0=n.hp;S.strHit({pos:new V((c[0]+c[3])/2,c[1]+1.5,(c[2]+c[5])/2),dir:new V(0,-1,0)},new V((c[0]+c[3])/2,c[1]+3,(c[2]+c[5])/2),2,45);r.blastNeighbor={hp0,hp:+n.hp.toFixed(1),dead:n.dead};}
  return r;});
out.push('建物 '+JSON.stringify(bl));
// 墜落で燃える
const cr=await ev(T=>{const S=__SR,P=S.P;let id=-1;for(let j=0;j<VEG.X.length;j+=53)if(VEG.set[j]===0&&!VEG.st[j]&&Math.hypot(VEG.X[j]-T[0],VEG.Z[j]-T[2])>400&&VEG.G[j]>20){id=j;break;}const b0=VEG.burn.length;P.pos.set(VEG.X[id],VEG.G[id]+3,VEG.Z[id]);P.inv=0;S.G.mode='play';crashExplode('test');return{mode:S.G.mode,lit:VEG.burn.length-b0};},T);
out.push('墜落 '+JSON.stringify(cr));
// やり直し
await ev(()=>{strReset();__SR.G.ckpt=null;__SR.startRun('approach');if(__SR.G.mode==='cut')__SR.endCut();});
out.push('やり直し後 '+JSON.stringify(await ev(()=>({burn:VEG.burn.length,burnt:[...VEG.st].filter(v=>v).length,brk:__SR.BRK.list.length,dead:STR.cols.filter(o=>o.dead).length}))));
await look(cam);await p.screenshot({path:dir+'fire_4_reset.png'});
console.log(out.join('\n'));console.log(errs.slice(0,5).join('\n')||'エラーなし');await b.close();

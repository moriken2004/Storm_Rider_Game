// 海底の安定性：潜って進む間に、近く（20m）の海底の物が置き直しで入れ替わらないか、動く生き物が瞬間移動しないか。node test/seastable.mjs
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('bExplore').click();});await p.waitForFunction('EX.on&&!exLoading',{timeout:120000,polling:100});
const r=await p.evaluate(()=>{const S=__SR,I=S.input,out=[];
  // 礁の上（4〜12m）を探す
  let st=null;for(let rr=200;rr<2600&&!st;rr+=37)for(let a=0;a<6.28;a+=.11){const x=BASE.x+Math.cos(a)*rr,z=BASE.z+Math.sin(a)*rr,h=exGround(x,z);if(h<-6&&h>-12&&hash2(Math.floor(x/40),Math.floor(z/40),91)>.58){st=[x,z,h];break;}}
  if(!st)return{err:'礁が見つからない'};
  const snapAll=()=>{const m=new THREE.Matrix4(),v=new THREE.Vector3(),L=[];for(const k of['coralB','coralM','coralT','fan','soft','eel','kelp','spT','spB','whip','pen','star','urch']){const im=SEA[k];for(let i=0;i<im.count;i++){im.getMatrixAt(i,m);v.setFromMatrixPosition(m);L.push([k,v.x,v.z]);}}return L;};
  const near=(L,cx,cz)=>{const s=new Set();for(const[k,x,z]of L)if((x-cx)**2+(z-cz)**2<400)s.add(k+':'+x.toFixed(2)+','+z.toFixed(2));return s;};
  const snap=(cx,cz)=>{const m=new THREE.Matrix4(),v=new THREE.Vector3(),set=new Set();for(const k of['coralB','coralM','coralT','fan','soft','eel','kelp','spT','spB','whip','pen','star','urch']){const im=SEA[k];for(let i=0;i<im.count;i++){im.getMatrixAt(i,m);v.setFromMatrixPosition(m);if((v.x-cx)**2+(v.z-cz)**2<400)set.add(k+':'+v.x.toFixed(2)+','+v.z.toFixed(2));}}return set;};
  EX.pos.set(st[0],-3,st[1]);EX.depth=-st[2]-2;EX.yaw=0;for(let i=0;i<20;i++)S.step(1/30);
  const psnap=()=>{const pa=EX.patch.geometry.attributes.position.array,m=new Map();for(let i=0;i<pa.length;i+=3){const x=pa[i],z=pa[i+2];if((x-EX.pos.x)**2+(z-EX.pos.z)**2<900)m.set(x.toFixed(2)+','+z.toFixed(2),pa[i+1]);}return m;};let pPrev=psnap(),pc=EX.pc.clone(),patchMoves=0,patchDiff=0,patchCommon=0,fishJ=0;const fPrev=[];
  let worstFlip=0,worstJump=0,tot=0,checks=0,rescat=0;const prevMov=new Map();let gc=EX.gc?SEA.gc.clone():null;
  for(let i=0;i<600;i++){I.ty=1;I.tBoost=true;S.step(1/30);EX.depth=Math.max(EX.depth,-exGround(EX.pos.x,EX.pos.z)-2.5);
    // 生き物の 1 コマの移動量
    for(const f of SEA.mov){if(!f.ok)continue;const pv=prevMov.get(f);if(f.reN!==f.tReN){f.tReN=f.reN;prevMov.set(f,f.p.clone());continue;}if(pv&&f.kind!=='squid'){const d=pv.distanceTo(f.p);if(d>worstJump){worstJump=d;window.__jk=f.kind+' ok='+f.ok;}}prevMov.set(f,f.p.clone());}
    if(!SEA.gc.equals(gc)){// 置き直しが起きた：前後で、今のボートのまわり 20m の物が同じか
      rescat++;const cx=EX.pos.x,cz=EX.pos.z;const after=near(snapAll(),cx,cz);const before=window.__before?near(window.__before,cx,cz):null;if(before){let diff=0;for(const k of after)if(!before.has(k)){diff++;(window.__dk=window.__dk||[]).push('+'+k);}for(const k of before)if(!after.has(k)){diff++;(window.__dk=window.__dk||[]).push('-'+k);}worstFlip=Math.max(worstFlip,diff);tot+=after.size;checks++;}gc=SEA.gc.clone();}
    if(!EX.pc.equals(pc)){patchMoves++;const cur=psnap();for(const[k,y]of cur){if(pPrev.has(k)){patchCommon++;patchDiff=Math.max(patchDiff,Math.abs(pPrev.get(k)-y));}}pc=EX.pc.clone();}pPrev=psnap();
    // 魚の上下の揺れ：1 匹ずつ y の二階差分
    {const m=new THREE.Matrix4(),v=new THREE.Vector3();for(let j=0;j<SEA.fish.count;j+=7){SEA.fish.getMatrixAt(j,m);v.setFromMatrixPosition(m);const jn=SEA.schools[Math.floor(j/28)].jn||0,q=fPrev[j];if(q&&q[2]===jn&&q[3]===jn){fishJ=Math.max(fishJ,Math.abs(v.y-2*q[1]+q[0]));}fPrev[j]=[q?q[1]:v.y,v.y,q?q[3]:jn,jn];}}
    window.__before=snapAll();}
  I.ty=0;I.tBoost=false;return{patchMoves,patchCommon,patchDiff:+patchDiff.toFixed(4),fishJerkY:+fishJ.toFixed(4),start:st.map(v=>+v.toFixed(1)),rescatters:rescat,checks,avgNear:checks?Math.round(tot/checks):0,worstChanged:worstFlip,worstJump:+worstJump.toFixed(2),dk:(window.__dk||[]).slice(0,12),jk:window.__jk};});
console.log(JSON.stringify(r));
const ok=r.rescatters>=3&&r.worstChanged===0&&r.worstJump<1.5&&r.avgNear>20&&r.patchMoves>=2&&r.patchCommon>100&&r.patchDiff<.001&&r.fishJerkY<.03;console.log(errs.slice(0,4).join('\n')||(ok?'安定':'不安定'));await b.close();

// 建物の崩壊の点検：全部壊して、上へ伸びた頂点・数値の異常・元に戻るかを調べる。node test/wreck.mjs
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new'});const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
const r=await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR,V=S.P.pos.constructor,bad=[];S.startRun('ret');for(let i=0;i<3;i++)S.step(1/30);S.strHit({pos:new V(0,-100,0),dir:new V(0,0,1)},new V(0,-100,0),1);
  const snap=()=>{const out=[];for(const m of S.BRK.meshes||[])out.push(m.a.array.slice());return out;};
  S.STR.cols.forEach(o=>{if(o.c[7])return;const c=o.c;o.hp=1;S.G.mode='play';S.strHit({pos:new V((c[0]+c[3])/2,c[1]+(c[4]-c[1])*.5,(c[2]+c[5])/2),dir:new V(0,0,1)},new V((c[0]+c[3])/2,c[1]+(c[4]-c[1])*.5,(c[2]+c[5])/2-1),1);});
  const orig=null;S.G.mode='title';for(let i=0;i<30*6;i++)S.step(1/30);
  let rise=0,nan=0,n=0;
  // 割れて落ちる建物（frac）：飛んだ塊は元の位置より高くなりうるが、建物の上端は超えない。残骸（role<0）は持ち上がらない
  for(const bk of S.BRK.list){if(bk.kind===1)continue;for(const P0 of bk.parts){const a=P0.m.a.array;for(let j=0;j<P0.I.length;j++){const i=P0.I[j],y=a[i*3+1],y0=P0.O[j*3+1];if(!Number.isFinite(y)||!Number.isFinite(a[i*3])||!Number.isFinite(a[i*3+2]))nan++;if(bk.frac&&P0.role&&P0.role[j]>=0){if(y+P0.m.oy>bk.y1+1)rise++;}else if(y-y0>1){rise++;}n++;}}}
  if(rise)bad.push('上へ伸びた頂点 '+rise);if(nan)bad.push('数値の異常 '+nan);
  const dead=S.STR.cols.filter(o=>o.dead).length;
  // タイトルで元に戻るか
  // 止めた部品・消した灯りの数（壊した直後）と、回る部品の位置の数値
  let sc=null;S.P.mesh.traverseAncestors(x=>{if(x.isScene)sc=x;});const B=sc.children.find(x=>x.userData&&x.userData.hangar);const hid=S.BRK.list.reduce((k,bk)=>k+bk.hide.length,0),att=S.BRK.list.reduce((k,bk)=>k+bk.att.length,0);
  for(const bk of S.BRK.list)for(const t of bk.att)if(![t.x.position.x,t.x.position.y,t.x.position.z].every(Number.isFinite))bad.push('回る部品の位置が異常');
  const pos0=(B.userData.spin||[]).map(o=>null);
  const saved=S.BRK.list.map(bk=>bk.parts.map(P0=>[P0.m.a.array,P0.I,P0.O]));S.showTitle();for(let i=0;i<5;i++)S.step(1/30);
  let diff=0;for(const bp of saved)for(const[a,I,O]of bp)for(let j=0;j<I.length;j++){const i=I[j];if(Math.abs(a[i*3]-O[j*3])+Math.abs(a[i*3+1]-O[j*3+1])+Math.abs(a[i*3+2]-O[j*3+2])>1e-4)diff++;}
  if(diff)bad.push('タイトルで戻らない頂点 '+diff);
  {let left=0;B.traverse(x=>{if(x.userData.brkDead)left++;});if(left)bad.push('止まったまま・消えたままの部品 '+left);}
  window.__extra='消した灯り '+hid+'・止めた部品 '+att;if(S.U.uScN.value)bad.push('焦げ跡が残る');if(S.STR.cols.some(o=>o.dead))bad.push('壊れた扱いが残る');if(S.G.hgDead)bad.push('格納庫の照明が消えたまま');
  return {bad,dead,n,extra:window.__extra};});
console.log('壊した '+r.dead+' 棟・動かした頂点 '+r.n+'・'+r.extra);
const all=r.bad.concat(errs);console.log(all.length?'問題 '+all.join(' / '):'問題なし');await b.close();

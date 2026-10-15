// 入念なバグ調査：難易度ごとの通しプレイ（2 周）・ゲームオーバーからの再挑戦・全カットシーン・一時停止と設定・数値の異常・
// シェーダーのエラー・メモリ（形と絵柄の数）の増え方を調べる。node test/soak.mjs
import puppeteer from 'puppeteer';
const issues=[];const note=(k,m)=>{issues.push(k+': '+m);console.log('  ⚠ '+k+': '+m);};
const b=await puppeteer.launch({headless:'new',protocolTimeout:600000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:960,height:540});
p.on('pageerror',e=>note('PAGEERR',e.message));
p.on('console',m=>{const t=m.text();if(/404/.test(t))return;if(m.type()==='error'||/THREE\.|WebGL|shader|NaN/i.test(t))note('CONSOLE('+m.type()+')',t.slice(0,240));});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;
  window.__mem=()=>{const i=__SR.renderer.info;let sc=null;__SR.P.mesh.traverseAncestors(a=>{if(a.isScene)sc=a;});let n=0;sc.traverse(()=>n++);return{geo:i.memory.geometries,tex:i.memory.textures,prog:i.programs?i.programs.length:0,obj:n};};
  window.__bad=()=>{const S=__SR,P=S.P,c=S.camera.position,f=v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);const r=[];if(!f(P.pos))r.push('P.pos');if(!f(P.vel))r.push('P.vel');if(!f(c))r.push('camera');if(!Number.isFinite(P.hull))r.push('hull');if(!Number.isFinite(P.speed))r.push('speed');
    S.W.forEach((w,i)=>{if(w.state!=='gone'&&!f(w.pos))r.push('W'+i);});S.ICP.f.forEach((q,i)=>{if(q.mesh.visible&&!f(q.pos))r.push('F'+i);});if(P.pos.y<-50)r.push('P below sea '+P.pos.y.toFixed(0));return r;};});
// 自動操縦（test/play.mjs と同じ）
const AUTOPILOT=`(maxChunks)=>{const S=__SR,G=S.G,P=S.P,I=S.input;let bad=[];
  for(let k=0;k<maxChunks;k++){
    if(G.mode==='cut'){S.tick(20);S.endCut();continue;}
    if(G.mode==='over'){window.__LOG.push('OVER '+G.cause+' @'+G.phase);document.getElementById('bRetry').click();continue;}
    if(G.mode==='result')return{done:true,bad};
    const T=G.target;if(T){const dx=T.x-P.pos.x,dz=T.z-P.pos.z,dy=T.y-P.pos.y,d=Math.hypot(dx,dz);let e=Math.atan2(-dx,-dz)-P.yaw;while(e>Math.PI)e-=6.2832;while(e<-Math.PI)e+=6.2832;
      I.tx=Math.max(-1,Math.min(1,-e*2.5));let dp=Math.atan2(dy,Math.max(d,150));if((G.phase==='bands'||G.phase==='wall'||G.phase==='approach')&&!G.flags.stall)dp=(420-P.pos.y)/400;I.ty=Math.max(-1,Math.min(1,dp/0.5));}
    for(const s of S.strikes){const px=P.pos.x+P.vel.x*s.t,pz=P.pos.z+P.vel.z*s.t;if(Math.hypot(px-s.x,pz-s.z)<135){const c=P.vel.z*(s.x-P.pos.x)-P.vel.x*(s.z-P.pos.z);I.tx=c>0?1:-1;break;}}
    I.tAct=G.prompt?(k%2===0||P.engineOut||P.fire):false;I.tBoost=G.phase==='ret'||!!P.ice;if(G.flags.hailT>0)I.ty=Math.max(-1,Math.min(1,(140-P.pos.y)/120));
    S.step(1/30);if(k%30===0){const r=__bad();if(r.length&&bad.length<5)bad.push(G.phase+':'+r.join(','));}
  }return{done:false,bad,ph:G.phase,mode:G.mode};}`;
const runMission=async(label)=>{await p.evaluate(()=>{window.__LOG=[];});for(let c=0;c<400;c++){const r=await p.evaluate(`(${AUTOPILOT})(150)`);if(r.bad.length)note(label+' 数値の異常',r.bad.join(' / '));if(r.done){const res=await p.evaluate(()=>({rank:document.getElementById('rank').textContent,log:__LOG}));console.log('  '+label+' 完了 ランク '+res.rank+(res.log.length?' '+res.log.join('; '):''));return true;}}
  note(label,'時間内に終わらない');return false;};
const SKIP1=process.argv.includes('quick'),ONLY5=process.argv.includes('armed');
// 1) 難易度ごとに通しプレイ → もう一度（2 周目）でメモリの増え方
for(const diff of(SKIP1?[]:[0,1,2])){console.log('難易度 '+diff);
  await p.evaluate((d)=>{__SR.opts.diff=d;document.getElementById('title').hidden=true;__SR.startCut(__SR.CUTS.CUT_INTRO);__SR.tick(30);__SR.endCut();},diff);
  const m0=await p.evaluate(()=>__mem());await runMission('難易度'+diff+' 1 周目');const m1=await p.evaluate(()=>__mem());
  await p.evaluate(()=>{document.getElementById('bAgain').click();__SR.tick(30);if(__SR.G.mode==='cut')__SR.endCut();});
  await runMission('難易度'+diff+' 2 周目');const m2=await p.evaluate(()=>__mem());
  console.log('  メモリ 開始',JSON.stringify(m0),'1周後',JSON.stringify(m1),'2周後',JSON.stringify(m2));
  if(m2.geo-m1.geo>20||m2.tex-m1.tex>5||m2.obj-m1.obj>50)note('難易度'+diff+' メモリ','2 周目で増加 geo+'+(m2.geo-m1.geo)+' tex+'+(m2.tex-m1.tex)+' obj+'+(m2.obj-m1.obj));
  await p.evaluate(()=>{document.getElementById('bRTitle').click();__SR.tick(10);});}
// 2) ゲームオーバー → 再挑戦で状態が戻るか（局面ごと）
for(const ph of['bands','eye','spare','ret']){
  const r=await p.evaluate((ph)=>{const S=__SR,G=S.G,P=S.P;document.getElementById('title').hidden=true;G.ckpt=null;S.startRun(ph);if(G.mode==='cut')S.endCut();S.tick(30);
    const before={ph:G.phase,hull:P.hull,gates:S.gateRings.filter(r=>r.visible).length,rings:S.rings.filter(r=>r.visible).length,hasPod:P.hasPod};
    P.inv=0;S.damage(999,'検査');for(let i=0;i<300&&G.mode!=='over';i++)S.step(1/30);const over=G.mode;document.getElementById('bRetry').click();for(let i=0;i<60;i++){if(G.mode==='cut'){S.endCut();}S.step(1/30);}
    const after={ph:G.phase,hull:Math.round(P.hull),gates:S.gateRings.filter(r=>r.visible).length,rings:S.rings.filter(r=>r.visible).length,hasPod:P.hasPod,mode:G.mode,inv:P.inv>0,bad:__bad(),strikes:S.strikes.length,burn:S.STR.burn.length,icp:S.ICP.st,wing:P.wingLost};
    return{over,before,after};},ph);
  console.log('再挑戦 '+ph,JSON.stringify(r));
  if(r.over!=='over')note('再挑戦 '+ph,'ゲームオーバー画面にならない ('+r.over+')');
  if(r.after.mode!=='play')note('再挑戦 '+ph,'再挑戦後に play に戻らない ('+r.after.mode+')');
  if(r.after.ph!==(ph==='bands'?'approach':r.before.ph))note('再挑戦 '+ph,'局面が変わる '+r.before.ph+'→'+r.after.ph);
  if(ph!=='bands'&&(r.after.gates!==r.before.gates||r.after.rings!==r.before.rings))note('再挑戦 '+ph,'輪の数が違う');
  if(r.after.bad.length)note('再挑戦 '+ph,'数値の異常 '+r.after.bad.join(','));
  if(r.after.wing)note('再挑戦 '+ph,'主翼喪失が残る');
  await p.evaluate(()=>{document.getElementById('title').hidden=true;});}
// 3) 全カットシーンを最後まで（飛ばさずに）
for(const c of['CUT_INTRO','CUT_FIRE1','CUT_FIRE2','CUT_LAND','CUT_ICP','CUT_KILL']){
  const r=await p.evaluate((c)=>{const S=__SR,G=S.G;const ph={CUT_FIRE1:'eye',CUT_FIRE2:'spare',CUT_LAND:'ret'}[c]||'approach';S.startRun(ph);if(G.mode==='cut')S.endCut();
    if(c==='CUT_ICP'||c==='CUT_KILL'){if(!S.ICP.f.length){}S.ICP.st=3;}
    try{S.startCut(S.CUTS[c]);}catch(e){return{err:e.message};}let n=0;while(G.mode==='cut'&&n<30*120){S.step(1/30);n++;}return{sec:(n/30).toFixed(1),mode:G.mode,bad:__bad(),ph:G.phase};},c);
  console.log('カット '+c,JSON.stringify(r));if(r.err)note('カット '+c,r.err);if(r.bad&&r.bad.length)note('カット '+c,'数値の異常 '+r.bad.join(','));if(r.mode==='cut')note('カット '+c,'終わらない');}
// 3b) 全カットシーンを始まった直後に飛ばす（状態が中途半端に残らないか）
for(const c of['CUT_INTRO','CUT_FIRE1','CUT_FIRE2','CUT_LAND','CUT_ICP','CUT_KILL']){
  const r=await p.evaluate((c)=>{const S=__SR,G=S.G,P=S.P;const ph={CUT_FIRE1:'eye',CUT_FIRE2:'spare',CUT_LAND:'ret'}[c]||'approach';S.startRun(ph);if(G.mode==='cut')S.endCut();S.ICP.st=(c==='CUT_ICP'||c==='CUT_KILL')?3:0;
    S.startCut(S.CUTS[c]);S.step(1/30);S.endCut();for(let i=0;i<60;i++)S.step(1/30);
    const far=S.ICP.st?S.ICP.f.filter(q=>q.mesh.visible&&!q.dead&&q.pos.distanceTo(P.pos)>3000).length:0;
    return{mode:G.mode,ph:G.phase,bad:__bad(),y:Math.round(P.pos.y),speed:Math.round(P.speed),far,hud:!document.getElementById('hud').hidden,cine:document.body.classList.contains('cine')};},c);
  console.log('即スキップ '+c,JSON.stringify(r));if(r.bad.length)note('即スキップ '+c,'数値の異常 '+r.bad.join(','));if(r.far)note('即スキップ '+c,'迎撃機が遠くに残る');if(r.mode==='play'&&(!r.hud||r.cine))note('即スキップ '+c,'HUD が戻らない');if(r.mode==='play'&&r.y<5)note('即スキップ '+c,'高度が低すぎる '+r.y);}
// 4) 一時停止・設定・操作説明をプレイ中に開閉
{const r=await p.evaluate(()=>{const S=__SR,G=S.G;S.startRun('bands');if(G.mode==='cut')S.endCut();S.tick(10);const pos0=S.P.pos.clone();S.togglePause();const m1=G.mode;for(let i=0;i<30;i++)S.step(1/30);const moved=S.P.pos.distanceTo(pos0);
  document.getElementById('bPOpts').click();const oo=!document.getElementById('opts').hidden;document.querySelector('#opts .bBack').click();document.getElementById('bResume').click();for(let i=0;i<10;i++)S.step(1/30);return{m1,moved:+moved.toFixed(2),optsOpen:oo,after:G.mode};});
 console.log('一時停止',JSON.stringify(r));if(r.moved>0.01)note('一時停止','停止中に機体が動く '+r.moved);if(r.after!=='play')note('一時停止','再開後 '+r.after);}
// 5) 武装モードで交戦→撃墜→空域へ戻る（隠しコマンドで有効にする）
await p.evaluate(()=>{__SR.showTitle();});for(const k of['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA']){await p.keyboard.down(k);await p.keyboard.up(k);}
{const r=await p.evaluate(()=>{const S=__SR,G=S.G,P=S.P,I=S.input,ICP=S.ICP;S.startRun('eye');if(G.mode==='cut')S.endCut();P.pos.set(0,500,-16600);P.yaw=0;let kills=0;
  for(let i=0;i<30*120;i++){if(G.mode==='cut'){S.endCut();continue;}const f=ICP.f.find(q=>q.mesh.visible&&!q.dead);I.tx=0;I.tGun=false;if(f&&ICP.st>=4){f.hp=Math.min(f.hp,1);const dx=f.pos.x-P.pos.x,dz=f.pos.z-P.pos.z;let e=Math.atan2(-dx,-dz)-P.yaw;while(e>3.14)e-=6.28;while(e<-3.14)e+=6.28;I.tx=Math.max(-1,Math.min(1,-e*8));I.ty=Math.max(-1,Math.min(1,(Math.max(f.pos.y,150)-P.pos.y)/150));I.tGun=Math.abs(e)<.15;}else I.ty=(500-P.pos.y)/200;P.hull=100;S.step(1/30);if(ICP.st!==window.__lst){window.__lst=ICP.st;(window.__tr=window.__tr||[]).push((i/30).toFixed(1)+'s st'+ICP.st+' mode='+G.mode+' out'+Math.round(Math.hypot(P.pos.x,P.pos.z))+' armed='+G.armed+' kills='+(G.stats.kills||0)+' d='+(f?Math.round(f.pos.distanceTo(P.pos)):'-')+' wl='+P.wingLost);}if(ICP.cleared)break;}
  return{cleared:ICP.cleared,st:ICP.st,prompt:G.prompt&&G.prompt.t,bad:__bad(),tr:window.__tr};});
 console.log('武装交戦',JSON.stringify(r));if(!r.cleared)note('武装交戦','撃墜しきれない');if(r.bad.length)note('武装交戦','数値の異常');}
console.log('\n=== 見つかった問題 '+issues.length+' 件 ===');issues.forEach(s=>console.log(s));
await b.close();

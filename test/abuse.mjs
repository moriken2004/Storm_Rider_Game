// 変なプレイで壊れないかを確かめる：場面ごとに意地の悪い操作をして、例外・数値の異常・抜け出せない状態・画面の食い違いを探す。node test/abuse.mjs
import puppeteer from 'puppeteer';
const issues=[];const note=m=>{issues.push(m);console.log('  ✗ '+m);};
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:960,height:540});
let errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').split('\n')[1]));p.on('console',m=>{const t=m.text();if(!/404|Failed to load resource/.test(t)&&(m.type()==='error'||/NaN/.test(t)))errs.push('CONSOLE '+t.slice(0,200));});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;
  // 状態の点検：数値・モードと画面の対応
  window.chk=()=>{const S=__SR,P=S.P,G=S.G,c=S.camera.position,f=v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z),$=id=>document.getElementById(id),vis=id=>{const e=$(id);return e&&!e.hidden&&getComputedStyle(e).display!=='none';};const r=[];
    if(!f(P.pos))r.push('P.pos');if(!f(P.vel))r.push('P.vel');if(!f(c))r.push('camera');if(!Number.isFinite(P.hull)||P.hull>100.01)r.push('hull '+P.hull);if(!Number.isFinite(P.speed))r.push('speed');if(!Number.isFinite(P.boost)||P.boost<-.01||P.boost>100.01)r.push('boost '+P.boost);
    if(![P.yaw,P.pitch,P.roll].every(Number.isFinite))r.push('angles');S.W.forEach((w,i)=>{if(w.state!=='gone'&&!f(w.pos))r.push('W'+i);});S.ICP.f.forEach((q,i)=>{if(q.mesh.visible&&!f(q.pos))r.push('F'+i);});
    if(P.pos.y<-30&&G.mode==='play')r.push('海中 y='+P.pos.y.toFixed(0));
    const m=G.mode;
    if(m==='play'&&(vis('title')||vis('over')||vis('res')||vis('pause')))r.push('play 中に画面が残る '+['title','over','res','pause'].filter(vis).join(','));
    if(m==='play'&&$('hud').hidden)r.push('play 中に HUD が隠れている');
    if(m!=='cut'&&vis('skip'))r.push(m+' でスキップ表示');
    if(m==='cut'&&!document.body.classList.contains('cine'))r.push('cut なのに cine でない');
    if(m!=='cut'&&document.body.classList.contains('cine'))r.push(m+' なのに cine のまま');
    if(m==='title'&&!vis('title')&&!vis('opts')&&!vis('help'))r.push('title なのに画面がない');
    if(m==='pause'&&!vis('pause'))r.push('pause なのに一時停止画面がない');
    if(m==='over'&&!vis('over'))r.push('over なのに失敗画面がない');
    if(m==='result'&&!vis('res'))r.push('result なのに結果画面がない');
    if(m!=='play'&&m!=='pause'&&m!=='dying'&&AU_alarm())r.push(m+' で警報が鳴り続ける');
    return r;};
  window.AU_alarm=()=>false;
  window.run=(n,fn)=>{const S=__SR;const bad=new Set();for(let i=0;i<n;i++){if(fn)fn(i);S.step(1/30);if(i%10===0)chk().forEach(x=>bad.add(x));}chk().forEach(x=>bad.add(x));return[...bad];};
  window.toTitle=()=>{const S=__SR;if(S.G.mode==='cut')S.endCut();if(S.G.mode==='pause')S.togglePause();S.showTitle();for(let i=0;i<5;i++)S.step(1/30);};
});
const T=async(name,fn,arg)=>{errs=[];let r;try{r=await p.evaluate(fn,arg);}catch(e){r=['評価エラー '+e.message.slice(0,200)];}
  r=(r||[]).concat(errs);const info=r.filter(x=>/^（参考）/.test(x));r=r.filter(x=>!/^（参考）/.test(x));if(info.length)console.log('    '+info.join(' / '));if(r.length)note(name+'：'+[...new Set(r)].slice(0,6).join(' / '));else console.log('  ✓ '+name);
  await p.evaluate(()=>{try{toTitle();}catch(e){}});};

console.log('■ 飛行の極端');
await T('嵐から逃げ続ける（4 分）',()=>{const S=__SR,P=S.P,I=S.input;S.startRun('approach');P.yaw+=Math.PI;const r=run(30*240,()=>{P.inv=1;I.tx=0;I.ty=0;I.tBoost=true;});return r.concat(Math.hypot(P.pos.x,P.pos.z)>200000?['はるか遠くへ '+Math.hypot(P.pos.x,P.pos.z).toFixed(0)]:[]);});
await T('真上へ上昇し続ける',()=>{const S=__SR,P=S.P,I=S.input;S.startRun('approach');return run(30*60,()=>{P.inv=1;I.ty=1;I.tBoost=true;}).concat(P.pos.y>20000?['高すぎる '+P.pos.y.toFixed(0)]:[]);});
await T('海へ全速で突っ込む',()=>{const S=__SR,P=S.P,I=S.input,G=S.G;S.startRun('approach');const r=run(30*40,()=>{I.ty=-1;I.tBoost=true;});return r.concat(G.mode==='play'&&P.pos.y<3?['海面の下を飛べる y='+P.pos.y.toFixed(1)]:[]);});
await T('海面すれすれで背面飛行',()=>{const S=__SR,P=S.P,I=S.input;S.startRun('approach');P.pos.y=12;return run(30*20,()=>{P.inv=1;P.roll=Math.PI;I.ty=0;});});
await T('失速するまで減速して急上昇',()=>{const S=__SR,P=S.P,I=S.input;S.startRun('bands');return run(30*40,()=>{P.inv=1;P.speed=Math.max(0,P.speed-20);I.ty=1;});});
await T('島の山へ突っ込む',()=>{const S=__SR,P=S.P,I=S.input,G=S.G;S.startRun('ret');P.pos.set(-1600,120,21000);P.yaw=-Math.PI/2;const r=run(30*20,()=>{I.ty=0;I.tx=0;});return r.concat(G.mode==='play'&&P.hull>=100?['山を通り抜けた']:[]);});
await T('ずっとロールし続ける',()=>{const S=__SR,P=S.P,I=S.input;S.startRun('bands');return run(30*30,(i)=>{P.inv=1;if(i%8===0)I.rollQ=i%16?1:-1;});});
await T('ブーストを押しっぱなし（3 分）',()=>{const S=__SR,P=S.P,I=S.input;S.startRun('approach');return run(30*180,()=>{P.inv=1;I.tBoost=true;I.ty=Math.sin(P.pos.y/300)*-.3;});});

console.log('■ 時間の乱れ');
await T('1 コマが 1 秒・5 秒かかる',()=>{const S=__SR,P=S.P;S.startRun('bands');const r=[];for(const d of[1,5,.5,2]){S.step(d);r.push(...chk());}return r.concat(run(60));});
await T('dt が 0 と負',()=>{const S=__SR;S.startRun('wall');const r=[];S.step(0);r.push(...chk());try{S.step(-0.1);}catch(e){r.push('負の dt で例外 '+e.message);}r.push(...chk());return r.concat(run(30));});
await T('カット中に長い停止',()=>{const S=__SR;S.startRun('approach');S.startCut(S.CUTS.CUT_ICP);S.step(3);S.step(8);return run(30*20);});

console.log('■ カットと画面遷移の割り込み');
await T('カット開始直後にスキップ連打',()=>{const S=__SR,G=S.G;S.startRun('approach');S.startCut(S.CUTS.CUT_ICP);const r=[];for(let i=0;i<10;i++){S.skipCut();S.step(1/60);}return r.concat(run(60));});
await T('カット中に一時停止キー',()=>{const S=__SR,G=S.G;S.startRun('approach');S.startCut(S.CUTS.CUT_ICP);for(let i=0;i<5;i++){S.togglePause();S.step(1/30);}return run(30*20).concat(G.mode==='pause'?['カットから一時停止に入った']:[]);});
await T('カット中にカットを重ねる',()=>{const S=__SR,G=S.G;S.startRun('approach');S.startCut(S.CUTS.CUT_ICP);run(30);S.startCut(S.CUTS.CUT_KILL);run(30);S.startCut(S.CUTS.CUT_ICP);return run(30*25).concat(G.mode==='cut'?['カットが終わらない']:[]);});
await T('カット中に被弾・失敗',()=>{const S=__SR,G=S.G;S.startRun('bands');S.startCut(S.CUTS.CUT_ICP);run(30);S.damage(60,'テスト');S.damage(60,'テスト');run(10);S.fail('テスト');return run(30*15);});
await T('死亡中に一時停止とスキップ',()=>{const S=__SR,G=S.G,P=S.P;S.startRun('bands');P.inv=0;P.hull=1;S.damage(50,'テスト');const r=[];for(let i=0;i<6;i++){S.togglePause();S.skipCut();S.step(1/30);}return r.concat(run(30*12)).concat(G.mode!=='over'?['死亡のあと失敗画面に行かない mode='+G.mode]:[]);});
await T('一時停止→タイトル→すぐ出撃',()=>{const S=__SR,G=S.G;S.startRun('eye');run(10);S.togglePause();document.getElementById('bPTitle').click();run(3);document.getElementById('bStart').click();return run(30*5).concat(G.mode!=='cut'?['出撃カットにならない '+G.mode]:[]);});
await T('失敗画面でリトライ連打',()=>{const S=__SR,G=S.G;S.startRun('wall');S.fail('テスト');run(10);for(let i=0;i<5;i++)document.getElementById('bRetry').click();return run(30*5).concat(G.mode!=='play'&&G.mode!=='cut'?['リトライ後 mode='+G.mode]:[]);});
await T('結果画面で再出撃を二度押し',()=>{const S=__SR,G=S.G,P=S.P;S.startRun('ret');P.pos.set(30,300,21000-3600);P.yaw=Math.PI;run(10);S.startCut(S.CUTS.CUT_LAND);run(20);S.skipCut();run(30*30,()=>{});if(G.mode!=='result')return['結果画面に行かない '+G.mode];document.getElementById('bAgain').click();document.getElementById('bAgain').click();const r=run(30*3);return r.concat(S.camera.view&&S.camera.view.enabled?['画面のずらしが残る']:[]);});
await T('タイトルで設定とヘルプを行き来',()=>{const S=__SR,G=S.G;const r=[];for(let i=0;i<4;i++){document.getElementById('bOpts').click();run(5);document.querySelector('#opts .bBack').click();run(3);document.getElementById('bHelp').click();run(3);document.querySelector('#help .bBack').click();run(3);}return r.concat(run(10)).concat(G.optPrev?['optPrev が残る']:[]);});

console.log('■ 飛行中の設定変更');
await T('一時停止中に機体の形と色を変えて再開',()=>{const S=__SR,G=S.G,P=S.P;S.startRun('wall');run(30);P.inv=0;S.damage(30,'テスト');run(30);const hull=P.hull,pod=P.mesh.userData.pod.visible;S.togglePause();document.getElementById('bPOpts').click();document.querySelectorAll('#oShape button')[1].click();document.querySelectorAll('#oColor button')[2].click();document.querySelector('#opts .bBack')&&0;S.togglePause();const r=run(30*10);
  if(P.hull!==hull&&Math.abs(P.hull-hull)>5)r.push('耐久が変わった '+hull+'→'+P.hull);if(P.mesh.userData.pod.visible!==pod)r.push('ポッドの表示が変わった');if(!P.mesh.parent)r.push('機体がシーンにない');
  const lost=P.armor.filter(a=>!a.on).length;if(hull<100&&lost===0)r.push('装甲が全部戻った');document.querySelectorAll('#oShape button')[0].click();document.querySelectorAll('#oColor button')[0].click();return r;});
await T('一時停止中に隠しコマンド',()=>{const S=__SR,G=S.G;S.startRun('bands');run(10);S.togglePause();const was=G.armed;for(const k of['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA']){dispatchEvent(new KeyboardEvent('keydown',{code:k}));dispatchEvent(new KeyboardEvent('keyup',{code:k}));}S.togglePause();const r=run(30*10,(i)=>{S.input.tGun=i%3==0;S.input.tMsl=i%40==0;});const now=G.armed;if(G.armed)for(const k of['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA']){dispatchEvent(new KeyboardEvent('keydown',{code:k}));dispatchEvent(new KeyboardEvent('keyup',{code:k}));}return r.concat(was!==now?['（参考）一時停止中に武装が切り替わる']:[]);});
await T('難易度をプレイ中に変える',()=>{const S=__SR,G=S.G;S.startRun('bands');run(10);S.togglePause();document.getElementById('bPOpts').click();const d=document.querySelectorAll('#diff button');d[2]&&d[2].click();S.togglePause();const r=run(30*20);d[0]&&d[0].click();return r;});

console.log('■ 武装モードの悪用');
await T('僚機を機銃で撃ち続ける',()=>{const S=__SR,G=S.G,P=S.P,W=S.W;if(!G.armed)for(const k of['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA']){dispatchEvent(new KeyboardEvent('keydown',{code:k}));dispatchEvent(new KeyboardEvent('keyup',{code:k}));}
  S.startRun('bands');run(5);const w=W[0];const r=run(30*15,()=>{P.inv=1;const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw);w.pos.set(P.pos.x+fx*80,P.pos.y,P.pos.z+fz*80);S.input.tGun=true;});S.input.tGun=false;return r.concat(['（参考）僚機 '+w.state+' hull='+(w.hull===undefined?'-':w.hull)]);});
await T('ミサイルを全弾すぐ撃つ（目標なし）',()=>{const S=__SR,G=S.G,P=S.P;S.startRun('approach');return run(30*20,(i)=>{P.inv=1;S.input.tMsl=i%2==0;});});

console.log('■ 破壊の悪用');
await T('建物を全部壊して、タイトルで元に戻るか',()=>{const S=__SR,G=S.G,V=S.P.pos.constructor;S.startRun('ret');run(3);S.strHit({pos:new V(0,-100,0),dir:new V(0,0,1)},new V(0,-100,0),1);
  const snap=()=>{let h=0;for(const m of (S.BRK.meshes||[]))for(let i=0;i<m.a.count;i+=97)h+=m.a.array[i*3+1];return h;};const t0=performance.now();let n=0;
  for(const o of S.STR.cols){if(o.c[7])continue;const c=o.c,cx=(c[0]+c[3])/2,cz=(c[2]+c[5])/2,h=c[4]-c[1];o.hp=1;G.mode='play';S.strHit({pos:new V(cx,c[1]+h*.5,cz),dir:new V(0,0,1)},new V(cx,c[1]+h*.5,cz-1),1);n++;if(n%20===0)run(2);}
  const tk=performance.now()-t0;const before=snap();const r=run(30*6);const after=snap();toTitle();const back=snap();S.startRun('ret');run(3);S.strHit({pos:new V(0,-100,0),dir:new V(0,0,1)},new V(0,-100,0),1);
  const r2=S.STR.cols.filter(o=>!o.c[7]&&o.dead).length;return r.concat(Math.abs(back-after)<1e-3?['崩れた形が戻らない']:[]).concat(S.U.uScN.value!==0?['焦げ跡が残る']:[]).concat(r2?['壊れた扱いが残る '+r2]:[]).concat(['（参考）'+n+' 棟 '+tk.toFixed(0)+'ms']);});
await T('ミサイルを基地へ撃ち続ける',()=>{const S=__SR,G=S.G,P=S.P,I=S.input;if(!G.armed)for(const k of['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA']){dispatchEvent(new KeyboardEvent('keydown',{code:k}));dispatchEvent(new KeyboardEvent('keyup',{code:k}));}
  S.startRun('ret');P.pos.set(0,180,21000-1500);P.yaw=Math.PI;P.pitch=-.12;const r=run(30*20,(i)=>{P.inv=1;P.msl=4;I.tMsl=i%6<3;I.tGun=true;I.ty=P.pos.y<80?.6:-.2;});I.tMsl=false;I.tGun=false;return r.concat(['（参考）壊れた '+S.STR.cols.filter(o=>o.dead).length+' 棟']);});
await T('船を全部沈める',()=>{const S=__SR,G=S.G,V=S.P.pos.constructor;S.startRun('approach');run(3);for(const s of S.ships){s.hp=1;G.mode='play';S.strHit({pos:new V(s.x,4,s.z),dir:new V(0,0,1)},new V(s.x,4,s.z-1),1);}const r=run(30*40);const left=S.ships.filter(s=>s.m.visible).length;toTitle();const back=S.ships.filter(s=>s.m.visible&&!s.dead).length;return r.concat(back!==S.ships.length?['船が戻らない '+back]:[]).concat(['（参考）40 秒後に見えている船 '+left]);});
await T('カット中に爆発を重ねる',()=>{const S=__SR,V=S.P.pos.constructor;S.startRun('approach');S.startCut(S.CUTS.CUT_ICP);for(let i=0;i<12;i++){S.explode(new V(S.P.pos.x+i*20,S.P.pos.y,S.P.pos.z-100),1,['air','tank','ship','bldg'][i%4]);S.step(1/30);}return run(30*10);});
await T('受け渡しカットをすぐスキップ',()=>{const S=__SR,G=S.G,P=S.P;S.startRun('spare');run(5);S.startCut(S.CUTS.CUT_HAND);S.step(1/30);S.skipCut();S.endCut();const r=run(30*3);return r.concat(!P.hasPod||!G.spareGiven?['予備弾が付いていない']:[]).concat(P.mesh.userData.pod.visible?[]:['ポッドが見えない']).concat(S.W[0].mesh.userData.pod.visible?['2番機に予備弾が残る']:[]).concat(G.targetLabel!=='コア'?['目標がコアでない '+G.targetLabel]:[]);});
await T('受け渡しカットの途中で終了して再開',()=>{const S=__SR,G=S.G,P=S.P;S.startRun('spare');run(5);S.startCut(S.CUTS.CUT_HAND);run(30*5);S.endCut();const r=run(30*3);return r.concat(!P.hasPod?['予備弾が付いていない']:[]);});
await T('1発目のカットをスキップ',()=>{const S=__SR,G=S.G,P=S.P;S.startRun('eye');run(5);S.startCut(S.CUTS.CUT_FIRE1);run(30*6);S.skipCut();S.endCut();const r=run(30*4);return r.concat(G.phase!=='spare'?['予備弾の局面にならない '+G.phase]:[]).concat(P.hasPod?['予備弾をまだ持っている']:[]);});
console.log('■ 着陸の悪用');
await T('脚を出さずに滑走路へ',()=>{const S=__SR,G=S.G,P=S.P,I=S.input;S.startRun('ret');P.pos.set(30,60,21000-1200);P.yaw=Math.PI;P.pitch=-.05;const r=run(30*30,()=>{I.ty=-.15;});return r.concat(['（参考）mode='+G.mode+' hull='+P.hull.toFixed(0)]);});
await T('滑走路の外（草地）へ降りる',()=>{const S=__SR,G=S.G,P=S.P,I=S.input;S.startRun('ret');P.pos.set(400,60,21000-1200);P.yaw=Math.PI;P.pitch=-.08;const r=run(30*30,()=>{I.ty=-.2;});return r.concat(['（参考）mode='+G.mode+' y='+P.pos.y.toFixed(1)]);});
await T('格納庫へ突っ込む',()=>{const S=__SR,G=S.G,P=S.P,I=S.input;S.startRun('ret');P.pos.set(0,28,21700);P.yaw=Math.PI;const r=run(30*10,()=>{I.ty=0;I.tx=0;P.pitch=0;});return r.concat(G.mode==='play'&&P.hull>=100?['格納庫を通り抜けた']:[]);});
await T('帰還中に嵐へ戻る',()=>{const S=__SR,G=S.G,P=S.P;S.startRun('ret');P.yaw=0;return run(30*90,()=>{P.inv=1;S.input.tBoost=true;}).concat(['（参考）phase='+G.phase+' mode='+G.mode]);});

console.log('■ 画面とキー');
await T('全キー同時押し',async()=>{const S=__SR;S.startRun('bands');const ks=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','Space','KeyF','KeyR','KeyE','KeyQ','Enter'];ks.forEach(k=>dispatchEvent(new KeyboardEvent('keydown',{code:k})));const r=run(30*10);ks.forEach(k=>dispatchEvent(new KeyboardEvent('keyup',{code:k})));return r;});
await T('タブを隠して戻す',()=>{const S=__SR,G=S.G;S.startRun('bands');run(5);Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));const m=G.mode;Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));const r=run(10);return r.concat(m!=='pause'?['隠しても一時停止しない '+m]:[]);});
await T('カット中にタブを隠す',()=>{const S=__SR,G=S.G;S.startRun('approach');S.startCut(S.CUTS.CUT_ICP);Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));return run(30*20);});
for(const [w,h] of [[320,568],[1920,400],[400,1200]]){await p.setViewport({width:w,height:h});await T(`画面サイズ ${w}×${h} でプレイとカット`,()=>{const S=__SR;S.resize();S.startRun('approach');run(30*3);S.startCut(S.CUTS.CUT_ICP);run(30*3);S.endCut();return run(30*3);});}
await p.setViewport({width:960,height:540});

console.log('■ 通しで何度も');
await T('出撃→失敗→リトライを 6 回',()=>{const S=__SR,G=S.G,P=S.P;const r=[];for(let k=0;k<6;k++){S.startRun(['approach','bands','wall','eye','spare','ret'][k]);run(30*4);P.inv=0;P.hull=1;S.damage(80,'テスト');run(30*8);if(G.mode==='over')document.getElementById('bRetry').click();run(30*2);r.push(...chk());}return r;});

console.log(issues.length?`\n問題 ${issues.length} 件`:'\n問題なし');
await b.close();

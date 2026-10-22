// 画面遷移とキー操作の総当たり：全ボタンの行き来・キー（Esc/P/Enter/隠しコマンド）・画面の回転と大きさの変更・タブを隠す・繰り返しの出撃でメモリ。
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;
const issues=[];const note=m=>{issues.push(m);console.log('  ⚠ '+m);};
const b=await puppeteer.launch({headless:'new',protocolTimeout:120000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();const MOB=process.argv.includes('mobile');if(MOB)await p.emulate({viewport:{width:844,height:390,deviceScaleFactor:2,isMobile:true,hasTouch:true,isLandscape:true},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});else await p.setViewport({width:1280,height:720});
p.on('pageerror',e=>note('PAGEERR '+e.message));p.on('console',m=>{const t=m.text();if(m.type()==='error'&&!/404/.test(t))note('CONSOLE '+t.slice(0,200));});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});await new Promise(r=>setTimeout(r,1000));
const W=ms=>new Promise(r=>setTimeout(r,ms));
const st=()=>p.evaluate(()=>{const v=id=>{const e=document.getElementById(id);return e&&!e.hidden&&getComputedStyle(e).display!=='none';};return{mode:__SR.G.mode,title:v('title'),opts:v('opts'),help:v('help'),pause:v('pause'),over:v('over'),res:v('res'),hud:v('hud'),cine:document.body.classList.contains('cine'),opt:__SR.G.optPrev,view:!!(__SR.camera.view&&__SR.camera.view.enabled)};});
const clk=async id=>{const ok=await p.evaluate(id=>{const e=document.getElementById(id)||document.querySelector(id);if(!e)return false;e.click();return true;},id);if(!ok)note('ボタンが無い '+id);await W(600);};
const expect=(label,s,want)=>{for(const[k,v]of Object.entries(want))if(s[k]!==v)note(label+': '+k+'='+s[k]+'（期待 '+v+'）');};
const visibleScreens=s=>['title','opts','help','pause','over','res'].filter(k=>s[k]);
// 1) タイトル → 操作説明 → 戻る → 設定 → 戻る
expect('起動',await st(),{mode:'title',title:true,opts:false,help:false});
await clk('bHelp');expect('操作説明',await st(),{help:true,title:false});await clk('#help .bBack');expect('操作説明→戻る',await st(),{help:false,title:true});
await clk('bOpts');expect('設定',await st(),{opts:true,title:false,opt:true,view:true});await clk('#opts .bBack');expect('設定→戻る',await st(),{opts:false,title:true,opt:false,view:false});
// 2) 出撃 → Enter でカットを飛ばす → Esc で一時停止 → 設定 → 戻る → 再開
await clk('bStart');await W(800);await p.keyboard.press('Enter');await W(1500);let s=await st();expect('出撃→スキップ',s,{mode:'play',hud:true,cine:false});
await p.keyboard.press('Escape');await W(500);expect('Esc',await st(),{mode:'pause',pause:true});
await clk('bPOpts');s=await st();expect('一時停止→設定',s,{opts:true,pause:false});await clk('#opts .bBack');expect('設定→戻る（一時停止）',await st(),{opts:false,pause:true,view:false});   // 一時停止中の設定は機体を見せるため一時停止の枠を隠し、画面をずらす。戻ったらずらしを解く
await p.keyboard.press('KeyP');await W(500);expect('P で再開',await st(),{mode:'play',pause:false});
// 3) 一時停止中に Enter（カットの飛ばし）を押しても壊れない／カット中に Esc
await p.keyboard.press('Escape');await W(300);await p.keyboard.press('Enter');await W(800);expect('一時停止中の Enter',await st(),{mode:'pause'});await clk('bResume');
// 4) タブを隠すと一時停止、戻しても勝手に再開しない
await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await W(300);
expect('タブを隠す',await st(),{mode:'pause'});
await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await W(300);
expect('タブを戻す',await st(),{mode:'pause'});await clk('bResume');
// 5) プレイ中に画面の大きさを変える（横→縦→横）
for(const[w,h]of[[844,390],[390,844],[1280,720],[667,375]]){await p.setViewport(MOB?{width:w,height:h,isMobile:true,hasTouch:true,deviceScaleFactor:2,isLandscape:w>h}:{width:w,height:h});await W(700);const r=await p.evaluate(()=>{const c=document.getElementById('gl');return{cw:c.clientWidth,ch:c.clientHeight,iw:innerWidth,ih:innerHeight,aspect:+__SR.camera.aspect.toFixed(3)};});
  if(Math.abs(r.aspect-r.iw/r.ih)>.02)note('画面 '+w+'×'+h+' でカメラの縦横比がずれる '+JSON.stringify(r));if(r.cw!==r.iw||r.ch!==r.ih)note('画面 '+w+'×'+h+' で描画面の大きさが合わない '+JSON.stringify(r));}
if(MOB){await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});await W(700);const rot=await p.evaluate(()=>{const e=document.getElementById('rot');return e&&getComputedStyle(e).display!=='none';});if(!rot)note('縦向きで回転の案内が出ない');await p.setViewport({width:844,height:390,isMobile:true,hasTouch:true,deviceScaleFactor:2,isLandscape:true});}else await p.setViewport({width:1280,height:720});await W(500);
// 6) ゲームオーバー → タイトル → 隠しコマンド → 出撃（武装） → 一時停止 → タイトル → 結果画面から
await p.evaluate(()=>{__SR.P.inv=0;__SR.damage(999,'検査');});for(let i=0;i<30;i++){await W(300);if((await st()).mode==='over')break;}
s=await st();expect('ゲームオーバー',s,{mode:'over',over:true});if(visibleScreens(s).length!==1)note('ゲームオーバーで画面が重なる '+visibleScreens(s));
await clk('bOTitle');expect('→タイトル',await st(),{mode:'title',title:true,over:false,hud:false});
for(const k of['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA']){await p.keyboard.down(k);await p.keyboard.up(k);}
if(!await p.evaluate(()=>__SR.G.armed))note('隠しコマンドが効かない');
await clk('bStart');await W(800);await p.keyboard.press('Enter');await W(1500);
// プレイ中の隠しコマンドは効かない（誤爆しない）
for(const k of['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA']){await p.keyboard.down(k);await p.keyboard.up(k);}
if(!await p.evaluate(()=>__SR.G.armed))note('プレイ中の入力で武装モードが解除された');
await p.keyboard.press('Escape');await W(300);await clk('bPTitle');expect('一時停止→タイトル',await st(),{mode:'title',pause:false,hud:false});
// 7) 結果画面 → もう一度 → 結果画面 → タイトル
for(const btn of['bAgain','bRTitle']){await p.evaluate(()=>{const S=__SR;document.getElementById('title').hidden=true;S.startRun('ret');if(S.G.mode==='cut')S.endCut();S.startCut(S.CUTS.CUT_LAND);});
  for(let i=0;i<60;i++){await W(500);if((await st()).mode==='result')break;}s=await st();expect('結果画面',s,{mode:'result',res:true});
  await clk(btn);await W(800);s=await st();if(btn==='bAgain')expect('もう一度',s,{mode:'cut',res:false});else expect('結果→タイトル',s,{mode:'title',res:false,title:true});
  if(btn==='bAgain'){await p.keyboard.press('Enter');await W(1500);}}
// 8) 出撃とタイトルの往復 8 回でメモリと描画の呼び出しが増えないか
const mem=()=>p.evaluate(()=>{const i=__SR.renderer.info;return{geo:i.memory.geometries,tex:i.memory.textures,prog:i.programs.length};});
const m0=await mem();
console.log('往復開始');for(let k=0;k<8;k++){console.log(' 往復',k);await clk('bStart');await W(500);await p.keyboard.press('Enter');await W(1200);await p.keyboard.press('Escape');await W(300);await clk('bPTitle');await W(300);}
const m1=await mem();console.log('往復 8 回 メモリ',JSON.stringify(m0),'→',JSON.stringify(m1));if(m1.geo-m0.geo>30||m1.tex-m0.tex>6||m1.prog-m0.prog>4)note('往復でメモリが増える');
await p.screenshot({path:out('ui_end.png')});
console.log('\n=== 問題 '+issues.length+' 件 ===');issues.forEach(x=>console.log(x));await b.close();

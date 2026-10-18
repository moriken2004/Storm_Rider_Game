// 人間と同じ情報だけで遊ぶボット。node test/bot.mjs [d0|d1|d2] [record]
// 見てよい情報：計器（高度・速度・方位）、目標の印（方向と距離）、レーダー（4.5km 以内の落雷予告・竜巻）、画面の文字（警告・指示）、
// 画面に見える僚機と迎撃機。見てはいけない情報：まだ予告されていない落雷の場所、内部のフラグや残り時間。
// 操作は画面のスティック（tx/ty）とボタン（ブースト・アクション・ロール）だけ。
// record を付けると 1/30 秒ずつ進めて全コマを撮り、bot/out/play_d?.mp4 に書き出す
import puppeteer from 'puppeteer';
import fs from 'fs';
import {execFileSync} from 'child_process';
const diff=+(process.argv.find(a=>/^d[0-2]$/.test(a))||'d2')[1],rec=process.argv.includes('record');
const OUT=new URL('../bot/out/',import.meta.url).pathname,FR=OUT+'frames/';
if(rec){fs.mkdirSync(FR,{recursive:true});for(const f of fs.readdirSync(FR))fs.unlinkSync(FR+f);}
const W=rec?1280:960,H=rec?720:540,FROM=(process.argv.find(a=>/^from=/.test(a))||'').slice(5);
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage();await p.setViewport({width:W,height:H});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
await p.evaluate(d=>{window.requestAnimationFrame=()=>0;try{localStorage.removeItem('stormrider_perf');}catch(e){}__SR.opts.diff=d;
  const S=__SR,G=S.G,P=S.P,I=S.input,$=id=>document.getElementById(id);
  const txt=id=>{const e=$(id);return e&&!e.hidden&&getComputedStyle(e).display!=='none'?e.textContent:'';};
  const wrap=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
  const M={hailUntil:-1,downUntil:-1,iceUntil:-1,log:[],t:0,last:''};
  // 画面に出ている情報を集める
  const see=()=>{const o={pos:P.pos.clone(),yaw:P.yaw,alt:P.pos.y,speed:P.speed,hull:P.hull,phase:G.phase,label:G.targetLabel||'',target:G.target?G.target.clone():null,
      warn:txt('warn'),prompt:txt('prompt'),strikes:[],spouts:[]};
    if(!(G.hudFail>0))for(const s of S.strikes){if(Math.hypot(s.x-P.pos.x,s.z-P.pos.z)<4500)o.strikes.push({x:s.x,z:s.z});}   // レーダーに映る予告だけ
    for(const s of S.spouts){if(!s.mesh.visible)continue;const q=s.mesh.position;if(Math.hypot(q.x-P.pos.x,q.z-P.pos.z)<4500)o.spouts.push({x:q.x,z:q.z});}
    return o;};
  window.BOT={M,step(){const o=see();M.t+=1/30;let tx=0,ty=0,boost=false,act=false;
    if(o.warn&&o.warn!==M.last){M.last=o.warn;if(/雹/.test(o.warn))M.hailUntil=M.t+11;if(/ダウンバースト/.test(o.warn))M.downUntil=M.t+7;if(/着氷/.test(o.warn))M.iceUntil=M.t+14;M.log.push(M.t.toFixed(0)+'s 警告:'+o.warn);}
    if(!o.warn)M.last='';
    // 目標へ向かう
    let wantAlt=null;
    if(o.target){const dx=o.target.x-o.pos.x,dz=o.target.z-o.pos.z,d=Math.hypot(dx,dz),e=wrap(Math.atan2(-dx,-dz)-o.yaw);tx=Math.max(-1,Math.min(1,-e*2.6));
      wantAlt=o.target.y;
      if(/台風中心|レインバンド|壁雲/.test(o.label)||o.phase==='approach'||o.phase==='bands'||o.phase==='wall')wantAlt=380;   // 雲の下を低めに
      if(o.label==='ハル機')wantAlt=o.target.y;
      if(o.phase==='ret'&&/進入開始点/.test(o.label))wantAlt=Math.max(320,o.target.y);
      if(o.phase==='ret'&&o.label==='滑走路'){wantAlt=Math.max(20,Math.min(o.pos.y,30+d*.12));}
      if(/2番機/.test(o.label)){wantAlt=o.target.y;if(d<300)boost=false;}
    }
    if(M.t<M.hailUntil)wantAlt=Math.min(wantAlt??150,140);
    // 竜巻は大きく避ける
    for(const s of o.spouts){const dx=s.x-o.pos.x,dz=s.z-o.pos.z,d=Math.hypot(dx,dz);if(d<700){const ang=wrap(Math.atan2(-dx,-dz)-o.yaw);if(Math.abs(ang)<1.2){tx=ang>0?1:-1;}}}
    // 落雷の予告（レーダーで見えた赤い円）からは、進む先に重なれば横へ逃げる
    {fwdOf(o.yaw,0,_bt);let worst=null,wd=1e9;for(const s of o.strikes){for(let k=0;k<=24;k++){const tt=k*.1,px=o.pos.x+_bt.x*o.speed*tt,pz=o.pos.z+_bt.z*o.speed*tt,d=Math.hypot(px-s.x,pz-s.z);if(d<150&&d<wd){wd=d;worst=s;}}}
      if(worst){const side=_bt.z*(worst.x-o.pos.x)-_bt.x*(worst.z-o.pos.z);tx=side>0?1:-1;boost=true;}}
    // 高度
    if(wantAlt!=null){const dy=wantAlt-o.pos.y;ty=Math.max(-1,Math.min(1,dy/180));}
    if(M.t<M.downUntil){ty=1;boost=true;}
    if(M.t<M.iceUntil)boost=true;
    if(o.phase==='ret'&&o.label!=='滑走路')boost=true;
    // 画面の指示に従う
    if(o.prompt){if(/押し続け/.test(o.prompt))act=true;else if(/連打/.test(o.prompt))act=(Math.floor(M.t*30)%2===0);else if(/消火|火災/.test(o.prompt))act=true;}
    if(/エンジン火災/.test(o.warn)||/消火/.test(o.prompt))act=true;
    I.tx=tx;I.ty=ty;I.tBoost=boost;I.tAct=act;
    if(o.phase!==M.ph){M.ph=o.phase;M.log.push(M.t.toFixed(0)+'s 局面:'+o.phase+' 耐久'+o.hull.toFixed(0));}
  }};
  window._bt=new P.pos.constructor();
},diff);
// 進め方：出撃ボタン→オープニング（記録しないときは飛ばす）→任務→結果
if(FROM)await p.evaluate(ph=>{__SR.G.ckpt=null;__SR.startRun(ph);},FROM);else await p.evaluate(()=>{document.getElementById('bStart').click();});
let frame=0,done=false,res=null;const shot=async()=>{await p.screenshot({path:FR+String(frame++).padStart(6,'0')+'.jpg',type:'jpeg',quality:82});};
for(let chunk=0;chunk<(rec?40000:260)&&!done;chunk++){
  const N=rec?1:120;
  const r=await p.evaluate((N,rec)=>{const S=__SR,G=S.G;for(let k=0;k<N;k++){
      if(G.mode==='cut'){if(!rec&&S.CUTS&&G.cutIntro!==false){}S.step(1/30);continue;}
      if(G.mode==='over'){BOT.M.log.push('失敗:'+G.cause+' @'+G.phase);document.getElementById('bRetry').click();continue;}
      if(G.mode==='result')return{done:true,rank:document.getElementById('rank').textContent,res:document.getElementById('resT').innerText,log:BOT.M.log};
      if(G.mode==='play'){BOT.step();S.step(1/30);}else S.step(1/30);}
    return{done:false,mode:G.mode,ph:G.phase,t:+(G.missionT||0).toFixed(0)};},N,rec);
  if(rec)await shot();
  if(r.done){done=true;res=r;break;}
  if(!rec&&chunk%3===0)console.log(JSON.stringify(r)+" "+await p.evaluate(()=>BOT.M.log.slice(-4).join(" | ")+" dmg="+JSON.stringify(__SR.G.dmgBy||{})+" hull="+__SR.P.hull.toFixed(0)+" y="+__SR.P.pos.y.toFixed(0)+" r="+Math.hypot(__SR.P.pos.x,__SR.P.pos.z).toFixed(0)));
  if(rec&&frame%900===0)console.log('frames',frame,JSON.stringify(r));
}
// 結果画面を少し映す
if(rec&&done){for(let i=0;i<120;i++){await p.evaluate(()=>__SR.step(1/30));await shot();}}
console.log(done?'RESULT '+res.rank+'\n'+res.res+'\n'+res.log.join('\n'):'NOT FINISHED');
if(errs.length)console.log(errs.slice(0,5).join('\n'));
await b.close();
if(rec&&done){const mp4=OUT+'play_d'+diff+'.mp4';execFileSync('/opt/homebrew/bin/ffmpeg',['-loglevel','error','-y','-framerate','30','-i',FR+'%06d.jpg','-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-preset','medium',mp4]);console.log('動画',mp4);}

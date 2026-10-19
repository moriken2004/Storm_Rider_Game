// 人間と同じ情報だけで遊ぶボット。node test/bot.mjs [d0|d1|d2] [record]
// 見てよい情報：計器（高度・速度・方位）、目標の印（方向と距離）、レーダー（4.5km 以内の落雷予告・竜巻）、画面の文字（警告・指示）、
// 画面に見える僚機と迎撃機。見てはいけない情報：まだ予告されていない落雷の場所、内部のフラグや残り時間。
// 操作は画面のスティック（tx/ty）とボタン（ブースト・アクション・ロール）だけ。
// record を付けると 1/30 秒ずつ進めて全コマを撮り、bot/out/play_d?.mp4 に書き出す
import puppeteer from 'puppeteer';
import fs from 'fs';
import {execFileSync} from 'child_process';
const diff=+(process.argv.find(a=>/^d[0-2]$/.test(a))||'d2')[1],rec=process.argv.includes('record');
const prof=process.argv.includes('prof');   // prof：1 コマごとの処理時間（GPU 完了まで）を測り、引っかかりを場面つきで一覧にする
const OUT=new URL('../bot/out/',import.meta.url).pathname,FR=OUT+'frames/';
if(rec){fs.mkdirSync(FR,{recursive:true});for(const f of fs.readdirSync(FR))fs.unlinkSync(FR+f);}
const W=rec?1280:960,H=rec?720:540,FROM=(process.argv.find(a=>/^from=/.test(a))||'').slice(5);
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage();await p.setViewport({width:W,height:H});
const SEED=+((process.argv.find(a=>/^seed=/.test(a))||'seed=1').slice(5));
// 乱数はシードで固定。ただし実時間で動くタイマー（音楽の刻みなど）には別系統の乱数を渡し、録画で遅くなっても本編の乱数列がずれないようにする
await p.evaluateOnNewDocument(sd=>{const mk=s=>{let a=s>>>0||1;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};};
  const game=mk(sd),side=mk(sd*7919+13);let cur=game;Math.random=()=>cur();
  const wrap=f=>typeof f!=='function'?f:function(...a){const prev=cur;cur=side;try{return f.apply(this,a);}finally{cur=prev;}};
  const si=window.setInterval,st=window.setTimeout;window.setInterval=(f,...r)=>si(wrap(f),...r);window.setTimeout=(f,...r)=>st(wrap(f),...r);
  // 音は実時間（currentTime）で鳴らし分けるので乱数の消費が実行速度に左右される。録画は無音なので音そのものを無効にする
  window.AudioContext=undefined;window.webkitAudioContext=undefined;},SEED);
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
await p.evaluate(d=>{window.requestAnimationFrame=()=>0;try{localStorage.removeItem('stormrider_perf');}catch(e){}__SR.opts.diff=d;
  const S=__SR,G=S.G,P=S.P,I=S.input,$=id=>document.getElementById(id);
  const txt=id=>{const e=$(id);return e&&!e.hidden&&getComputedStyle(e).display!=='none'?e.textContent:'';};
  const wrap=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
  const M={diff:d,hailUntil:-1,downUntil:-1,iceUntil:-1,log:[],t:0,last:''};
  // 画面に出ている情報を集める
  const see=()=>{const o={pos:P.pos.clone(),yaw:P.yaw,alt:P.pos.y,speed:P.speed,hull:P.hull,phase:G.phase,label:G.targetLabel||'',target:G.target?G.target.clone():null,
      warn:txt('warn'),prompt:txt('prompt'),strikes:[],spouts:[]};
    // レーダー（4.5km）に映る予告と、画面に見えている赤い柱（計器が落ちてレーダーが消えていても見える）
    for(const s of S.strikes){const d=Math.hypot(s.x-P.pos.x,s.z-P.pos.z);let ok=!(G.hudFail>0)&&d<4500;if(!ok&&d<3500){_bv.set(s.x,Math.max(30,P.pos.y),s.z).project(S.camera);ok=_bv.z<1&&Math.abs(_bv.x)<1.05&&Math.abs(_bv.y)<1.05;}if(ok)o.strikes.push({x:s.x,z:s.z,_dbgT:s.t});}   /* _dbgT はログ専用（判断には使わない） */
    for(const s of S.spouts){if(!s.mesh.visible)continue;const q=s.mesh.position;if(Math.hypot(q.x-P.pos.x,q.z-P.pos.z)<4500)o.spouts.push({x:q.x,z:q.z});}
    return o;};
  window.BOT={M,step(){const o=see();M.t+=1/30;let tx=0,ty=0,boost=false,act=false;
    if(o.warn&&o.warn!==M.last){M.last=o.warn;if(/雹/.test(o.warn))M.hailUntil=M.t+11;if(/ダウンバースト/.test(o.warn))M.downUntil=M.t+7;if(/着氷/.test(o.warn))M.iceUntil=M.t+14;M.log.push(M.t.toFixed(0)+'s 警告:'+o.warn);}
    if(!o.warn)M.last='';
    // 目標へ向かう
    let wantAlt=null;
    if(o.target){const dx=o.target.x-o.pos.x,dz=o.target.z-o.pos.z,d=Math.hypot(dx,dz),e=wrap(Math.atan2(-dx,-dz)-o.yaw);tx=Math.max(-1,Math.min(1,-e*2.6));
      wantAlt=o.target.y;
      if(/台風中心|レインバンド|壁雲/.test(o.label)||o.phase==='approach'||o.phase==='bands'||o.phase==='wall')wantAlt=M.diff>=2&&o.phase!=='approach'?135:380;   // 雲の下を低めに（極限は雹の帯を知っているので最初から低く）
      if(o.label==='ハル機'){wantAlt=o.target.y;if(d>260)boost=true;}
      if(o.phase==='ret'&&/進入開始点/.test(o.label))wantAlt=Math.max(320,o.target.y);
      if(o.phase==='ret'&&o.label==='滑走路'){wantAlt=Math.max(20,Math.min(o.pos.y,30+d*.12));}
      if(/2番機/.test(o.label)){wantAlt=o.target.y;boost=d>320;}
    }
    // コアのロックオン：近すぎたら一度離れ、向き直って機首（上下も）をコアに合わせ続ける
    let aimPitch=null;
    if(o.target&&/^コア/.test(o.label)){const dx=o.target.x-o.pos.x,dz=o.target.z-o.pos.z,dh=Math.hypot(dx,dz),d3=Math.hypot(dh,o.target.y-o.pos.y);
      if(d3<330)M.away=true;if(d3>1700)M.away=false;
      if(M.away){const e=wrap(Math.atan2(dx,dz)-o.yaw);tx=Math.max(-1,Math.min(1,-e*2.6));wantAlt=o.target.y;}
      else{aimPitch=Math.atan2(o.target.y-o.pos.y,dh);}
      {fwdOf(P.yaw,P.pitch,_bt);_bv.copy(o.target).sub(o.pos).normalize();M.cdbg='d='+d3.toFixed(0)+' dot='+_bt.dot(_bv).toFixed(3)+' away='+M.away+' lock='+G.lock.toFixed(2)+' pitch='+P.pitch.toFixed(2)+' aim='+(aimPitch??0).toFixed(2);}}
    if(M.t<M.hailUntil)wantAlt=Math.min(wantAlt??150,140);
    // 落雷は進路の先を狙って予告されるので、雷の多い所ではゆるく蛇行して読まれにくくする
    if((o.phase==='bands'||o.phase==='wall'||o.phase==='spare')&&!/ハル機|2番機/.test(o.label)&&!/^コア/.test(o.label)&&o.target){   // 落雷は「今の速度のまま進んだ先」を狙ってくるので、S 字に切り返し続けて先読みを外す（上手な人の飛び方）
      const dx=o.target.x-o.pos.x,dz=o.target.z-o.pos.z,sq=Math.floor(M.t/1.6)%2?1:-1,e=wrap(Math.atan2(-dx,-dz)+.55*sq-o.yaw);tx=Math.max(-1,Math.min(1,-e*3));}
    // 竜巻は大きく避ける
    for(const s of o.spouts){const dx=s.x-o.pos.x,dz=s.z-o.pos.z,d=Math.hypot(dx,dz);if(d<700){const ang=wrap(Math.atan2(-dx,-dz)-o.yaw);if(Math.abs(ang)<1.2){tx=ang>0?1:-1;}}}
    // 落雷の予告（レーダーで見えた赤い円）からは、進む先に重なれば横へ逃げる
    // 予告が出た時刻を覚え、経験から知っている予告時間（訓練2.1秒・実戦1.75秒・極限1.45秒）で落ちる時刻を見積もる。
    // 旋回と加速の組み合わせを頭の中で試し、落ちる瞬間に最も遠くにいられるものを選ぶ
    // ダウンバーストと着氷では加速を基本にする（落雷を避ける判断はこれより優先）
    if(M.t<M.downUntil||M.t<M.iceUntil)boost=true;
    // 方位計の動きから今の旋回の速さを読む
    M.w0=M.py==null?0:wrap(o.yaw-M.py)*30;M.py=o.yaw;
    {const WT=[2.1,1.75,1.45][M.diff],RAD=[62,72,72][M.diff]+22,seen=M.seen||(M.seen=new Map()),now=M.t;
      for(const s of o.strikes){const k=Math.round(s.x)+','+Math.round(s.z);if(!seen.has(k)){seen.set(k,now);M.fs=(M.fs||[]).concat([now.toFixed(1)+':rem'+s._dbgT.toFixed(2)+'/d'+Math.hypot(s.x-o.pos.x,s.z-o.pos.z).toFixed(0)+'/hf'+(G.hudFail>0?1:0)]).slice(-4);}s.hit=seen.get(k)+WT;}
      for(const[k,v]of seen)if(now-v>4)seen.delete(k);
      const live=o.strikes.filter(s=>s.hit>now-.05);
      if(live.length){const ice=M.t<M.iceUntil;const w0=M.w0||0,sim=(stx,sb)=>{let x=o.pos.x,z=o.pos.z,yaw=o.yaw,v=o.speed,t=now,score=1e9,w=w0;const vt=(sb?255:150)*(ice?.86:1),yr=-stx*(sb?.6:.82)*(ice?.8:1);
          for(let k=0;k<75;k++){const dt=1/30;w+=(yr-w)*(1-Math.exp(-dt/.25));yaw+=w*dt;   /* 旋回は 0.25 秒ほどの遅れで立ち上がる（実機で計測） */v+=(vt-v)*(1-Math.exp(-(sb?1.6:1)*dt));x+=-Math.sin(yaw)*v*dt;z+=-Math.cos(yaw)*v*dt;t+=dt;
            for(const s of live)if(Math.abs(t-s.hit)<dt*.6)score=Math.min(score,Math.hypot(x-s.x,z-s.z));}sim.yaw=yaw;sim.x=x;sim.z=z;return score;};
        const base=sim(tx,boost);M.dbg={n:live.length,base:Math.round(base),t:+now.toFixed(2),left:live.map(s=>+(s.hit-now).toFixed(2)),need:RAD+30};
        if(base<RAD+30){// 避けきれる手のうち、目標から外れない手（加速を使わない手）を優先する。避けきれないときは一番離れる手
          let best=null,bs=-1,bc=1e9;const T=o.target;for(const c of[[tx,boost],[tx,!boost],[-1,false],[1,false],[0,false],[-.5,false],[.5,false],[-1,true],[1,true],[0,true]]){const sc=sim(c[0],c[1]);
            let cost=0;if(T){const dx=T.x-sim.x,dz=T.z-sim.z;cost=Math.abs(wrap(Math.atan2(-dx,-dz)-sim.yaw))+Math.hypot(dx,dz)/2000;}cost+=c[1]?.3:0;
            if(sc>=RAD+30){if(bs<RAD+30||cost<bc){bc=cost;bs=sc;best=c;}}else if(bs<RAD+30&&sc>bs){bs=sc;best=c;}}
          tx=best[0];boost=best[1];M.dodge=(M.dodge||0)+1;M.dbg.best=Math.round(bs);M.dbg.c=best;if(!M.dbg.b0||M.dbg.t0!==M.seenKey){}}}}
    // 高度
    if(aimPitch!=null)ty=Math.max(-1,Math.min(1,(aimPitch-P.pitch)*4));
    else if(wantAlt!=null){const dy=wantAlt-o.pos.y;ty=Math.max(-1,Math.min(1,dy/180));}
    if(M.t<M.downUntil)ty=1;
    if(o.phase==='ret'&&o.label!=='滑走路')boost=true;
    // 画面の指示に従う
    if(o.prompt){if(/発射/.test(o.prompt))act=(Math.floor(M.t*30)%4<2);else if(/押し続け/.test(o.prompt))act=true;else if(/連打/.test(o.prompt))act=(Math.floor(M.t*30)%2===0);else if(/消火|火災/.test(o.prompt))act=true;}
    if(/エンジン火災/.test(o.warn)||/消火/.test(o.prompt))act=true;
    {const dl=(G.dmgBy&&G.dmgBy['落雷'])||0;if(dl>(M.dl||0)){const near=S.strikes.length;M.log.push(M.t.toFixed(1)+'s 被雷 dbg='+JSON.stringify(M.dbg||{})+' first='+JSON.stringify(M.fs)+' strikes='+near+' seenN='+(M.seen?M.seen.size:0)+' hudFail='+(G.hudFail||0).toFixed(2)+' ice='+(M.t<M.iceUntil));}M.dl=dl;}
    I.tx=tx;I.ty=ty;I.tBoost=boost;I.tAct=act;
    if(o.label!==M.lbl){M.log.push(M.t.toFixed(1)+'s 目標:'+o.label+(M.lbl==='ハル機'?' (救援 saved='+G.stats.saved+' W1='+S.W[1].state+')':''));M.lbl=o.label;}
    if(o.label==='ハル機'&&Math.floor(M.t*2)!==M.hl){M.hl=Math.floor(M.t*2);M.log.push(M.t.toFixed(1)+' ハル d='+S.W[1].pos.distanceTo(P.pos).toFixed(0)+' link='+(G.flags.link||0).toFixed(1)+' T='+(G.flags.stallT||0).toFixed(1)+' dodge='+(M.dodge||0));}
    if(o.phase!==M.ph){M.ph=o.phase;M.log.push(M.t.toFixed(0)+'s 局面:'+o.phase+' 耐久'+o.hull.toFixed(0));}
  }};
  window._bt=new P.pos.constructor();window._bv=new P.pos.constructor();
},diff);
// 進め方：出撃ボタン→オープニング（記録しないときは飛ばす）→任務→結果
if(FROM)await p.evaluate(ph=>{__SR.G.ckpt=null;__SR.startRun(ph);},FROM);else await p.evaluate(()=>{document.getElementById('bStart').click();});
let frame=0,done=false,res=null;const shot=async()=>{await p.screenshot({path:FR+String(frame++).padStart(6,'0')+'.jpg',type:'jpeg',quality:82});};
for(let chunk=0;chunk<(rec?40000:260)&&!done;chunk++){
  const N=rec?1:120;
  const r=await p.evaluate((N,rec,prof)=>{const S=__SR,G=S.G;const gl=prof&&S.renderer.getContext(),px=new Uint8Array(4);
    const ST=dt=>{if(!prof){S.step(dt);return;}const t0=performance.now();S.step(dt);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);const ms=performance.now()-t0;
      (window.PROF||(window.PROF=[])).push([+ms.toFixed(1),G.mode,G.phase,G.mode==='cut'&&S.curCut?S.curCut():'',+(G.missionT||0).toFixed(1),S.renderer.info.render.calls,Math.round(S.renderer.info.render.triangles/1000)+'k',(window.BOT&&BOT.M.log.slice(-1)[0]||'').slice(0,40),S.view.scale.toFixed(2)]);};
    for(let k=0;k<N;k++){
      if(G.mode==='cut'){ST(1/30);continue;}
      if(G.mode==='over'){BOT.M.log.push('失敗:'+G.cause+' @'+G.phase);document.getElementById('bRetry').click();continue;}
      if(G.mode==='result')return{done:true,rank:document.getElementById('rank').textContent,res:document.getElementById('resT').innerText,log:BOT.M.log};
      if(G.mode==='play'){BOT.step();ST(1/30);}else ST(1/30);}
    return{done:false,mode:G.mode,ph:G.phase,t:+(G.missionT||0).toFixed(0)};},N,rec,prof);
  if(rec)await shot();
  if(r.done){done=true;res=r;break;}
  if(!rec&&chunk%3===0)console.log(JSON.stringify(r)+" "+await p.evaluate(()=>BOT.M.log.slice(-4).join(" | ")+" "+(BOT.M.cdbg||'')+" dmg="+JSON.stringify(__SR.G.dmgBy||{})+" hull="+__SR.P.hull.toFixed(0)+" y="+__SR.P.pos.y.toFixed(0)+" r="+Math.hypot(__SR.P.pos.x,__SR.P.pos.z).toFixed(0)));
  if(rec&&frame%900===0)console.log('frames',frame,JSON.stringify(r));
}
// 結果画面を少し映す
if(rec&&done){for(let i=0;i<120;i++){await p.evaluate(()=>__SR.step(1/30));await shot();}}
console.log(done?'RESULT '+res.rank+'\n'+res.res+'\n'+res.log.join('\n'):'NOT FINISHED');
if(errs.length)console.log(errs.slice(0,5).join('\n'));
if(prof){const P=await p.evaluate(()=>window.PROF||[]);const by={};for(const[ms,m,ph,c]of P){const k=m==='cut'?'cut:'+(c||'?'):m+':'+ph;(by[k]||(by[k]=[])).push(ms);}
  const q=(a,f)=>{const b=[...a].sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(b.length*f))];};
  console.log('PROF 場面  コマ数  中央値  95%  最大  50ms超');for(const[k,a]of Object.entries(by))console.log('PROF',k,a.length,q(a,.5),q(a,.95),Math.max(...a),a.filter(x=>x>50).length);
  console.log('PROF 引っかかり上位');for(const r of [...P].map((r,i)=>[...r,i]).sort((x,y)=>y[0]-x[0]).slice(0,25))console.log('SPIKE',JSON.stringify(r));}
await b.close();
if(rec&&done){const mp4=OUT+'play_d'+diff+'.mp4';execFileSync('/opt/homebrew/bin/ffmpeg',['-loglevel','error','-y','-framerate','30','-i',FR+'%06d.jpg','-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-preset','medium',mp4]);console.log('動画',mp4);}

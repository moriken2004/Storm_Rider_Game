// ───────────────────────── 音（すべて WebAudio で合成） ─────────────────────────
const AU={ctx:null,mus:null,sfx:null,rev:null,noise:null,eng:null,wind:null,rain:null,alarm:null,musVol:.7,sfxVol:.8};
const mtof=m=>440*Math.pow(2,(m-69)/12);
function initAudio(){
  if(AU.ctx){if(AU.ctx.state!=='running'&&!AU.paused){const p=AU.ctx.resume();if(p&&p.catch)p.catch(()=>{});}return;}
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  const ctx=AU.ctx=new C();
  const comp=ctx.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=5;comp.attack.value=.004;comp.release.value=.22;comp.connect(ctx.destination);
  AU.mus=ctx.createGain();AU.sfx=ctx.createGain();AU.mus.connect(comp);AU.sfx.connect(comp);
  // 残響
  const len=ctx.sampleRate*3.2,ir=ctx.createBuffer(2,len,ctx.sampleRate);
  for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6);}
  AU.rev=ctx.createConvolver();AU.rev.buffer=ir;const rg=ctx.createGain();rg.gain.value=.55;AU.rev.connect(rg);rg.connect(comp);
  // ノイズ
  const nb=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;AU.noise=nb;
  // 低域の豊かな茶色ノイズ（雷鳴・地鳴り用）
  const bb=ctx.createBuffer(1,ctx.sampleRate*5,ctx.sampleRate),bd=bb.getChannelData(0);let lb=0;for(let i=0;i<bd.length;i++){lb=(lb+.02*(Math.random()*2-1))/1.02;bd[i]=lb*3.5;}AU.brown=bb;
  const loopNoise=()=>{const s=ctx.createBufferSource();s.buffer=nb;s.loop=true;s.start();return s;};
  // エンジン（出口でまとめて、距離と左右を付ける）：燃焼の轟音（事前合成のループ）・クラックル・タービンの唸り（ずれた 2 音と倍音、羽根の通過音）・腹に響く低音
  {const bus=AU.engBus=ctx.createGain();if(ctx.createStereoPanner){AU.engPan=ctx.createStereoPanner();bus.connect(AU.engPan);AU.engPan.connect(AU.sfx);}else bus.connect(AU.sfx);
    AU.jetBuf=makeJetBuffer(ctx);AU.crkBuf=makeCrackleBuffer(ctx);
    const src=ctx.createBufferSource();src.buffer=AU.jetBuf;src.loop=true;src.start();
    const pk=ctx.createBiquadFilter();pk.type='peaking';pk.frequency.value=380;pk.Q.value=.6;pk.gain.value=7;
    const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1500;lp.Q.value=.5;const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=38;
    const rg=ctx.createGain();rg.gain.value=0;src.connect(hp);hp.connect(pk);pk.connect(lp);lp.connect(rg);rg.connect(bus);
    const cs=ctx.createBufferSource();cs.buffer=AU.crkBuf;cs.loop=true;cs.start();const cf=ctx.createBiquadFilter();cf.type='bandpass';cf.frequency.value=900;cf.Q.value=.35;const cg=ctx.createGain();cg.gain.value=0;cs.connect(cf);cf.connect(cg);cg.connect(bus);
    const w=[0,1,2,3].map(i=>{const o=ctx.createOscillator();o.type=i===3?'triangle':'sine';o.frequency.value=1200;o.start();return o;});
    const wa=[.55,.5,.28,.12].map((v,i)=>{const g=ctx.createGain();g.gain.value=v;w[i].connect(g);return g;});const whg=ctx.createGain();whg.gain.value=0;wa.forEach(g=>g.connect(whg));
    const wbp=ctx.createBiquadFilter();wbp.type='bandpass';wbp.frequency.value=3000;wbp.Q.value=.9;whg.connect(wbp);wbp.connect(bus);
    // 唸りのゆらぎ（回転のむら）
    const vl=ctx.createOscillator();vl.frequency.value=5.3;const vg=ctx.createGain();vg.gain.value=4;vl.connect(vg);w.forEach(o=>vg.connect(o.frequency));vl.start();
    const bn=loopNoise(),bnf=ctx.createBiquadFilter();bnf.type='bandpass';bnf.Q.value=7;bnf.frequency.value=900;const bng=ctx.createGain();bng.gain.value=0;bn.connect(bnf);bnf.connect(bng);bng.connect(bus);
    const rn=ctx.createBufferSource();rn.buffer=AU.brown;rn.loop=true;rn.start();const rf=ctx.createBiquadFilter();rf.type='lowpass';rf.frequency.value=75;const rlg=ctx.createGain();rlg.gain.value=0;rn.connect(rf);rf.connect(rlg);rlg.connect(bus);
    AU.eng={src,pk,lp,rg,cs,cg,w,whg,wbp,bnf,bng,rlg};}
  // 僚機のエンジン（近くを通るときに聞こえる）
  {const bus=ctx.createGain();bus.gain.value=0;let pan=null;if(ctx.createStereoPanner){pan=ctx.createStereoPanner();bus.connect(pan);pan.connect(AU.sfx);}else bus.connect(AU.sfx);
    const o=ctx.createBufferSource();o.buffer=AU.jetBuf;o.loop=true;o.start(0,2.1);const nf=ctx.createBiquadFilter();nf.type='lowpass';nf.frequency.value=1400;const ng=ctx.createGain();ng.gain.value=.9;o.connect(nf);nf.connect(ng);ng.connect(bus);
    const w=ctx.createOscillator();w.type='sine';w.frequency.value=2300;const wg=ctx.createGain();wg.gain.value=.012;w.connect(wg);wg.connect(bus);w.start();
    const r=ctx.createBufferSource();r.buffer=AU.brown;r.loop=true;r.start();const rg=ctx.createGain();rg.gain.value=.9;r.connect(rg);rg.connect(bus);
    AU.wingV={bus,pan,nf,o,w};}
  // 風
  {const n=loopNoise(),f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=420;f.Q.value=.9;const g=ctx.createGain();g.gain.value=0;
    const l=ctx.createOscillator();l.frequency.value=.17;const lg=ctx.createGain();lg.gain.value=160;l.connect(lg);lg.connect(f.frequency);l.start();
    n.connect(f);f.connect(g);g.connect(AU.sfx);AU.wind={g,f};}
  // 雨
  {const n=loopNoise(),f=ctx.createBiquadFilter();f.type='highpass';f.frequency.value=3200;const g=ctx.createGain();g.gain.value=0;n.connect(f);f.connect(g);g.connect(AU.sfx);AU.rain={g};}
  // 風の笛鳴り・嵐の地鳴り・雨の本体・波しぶき
  {const n=loopNoise(),f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=760;f.Q.value=13;const g=ctx.createGain();g.gain.value=0;const l=ctx.createOscillator();l.frequency.value=.11;const lg=ctx.createGain();lg.gain.value=290;l.connect(lg);lg.connect(f.frequency);l.start();
    const l2=ctx.createOscillator();l2.frequency.value=.37;const lg2=ctx.createGain();lg2.gain.value=90;l2.connect(lg2);lg2.connect(f.frequency);l2.start();n.connect(f);f.connect(g);g.connect(AU.sfx);AU.wind2={g};}
  {const s=ctx.createBufferSource();s.buffer=AU.brown;s.loop=true;s.start();const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=150;const g=ctx.createGain();g.gain.value=0;s.connect(f);f.connect(g);g.connect(AU.sfx);AU.rumble={g};}
  {const n=loopNoise(),f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=1300;f.Q.value=.45;const g=ctx.createGain();g.gain.value=0;n.connect(f);f.connect(g);g.connect(AU.sfx);AU.rain2={g};}
  {const n=loopNoise(),f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=3000;f.Q.value=.5;const g=ctx.createGain();g.gain.value=0;n.connect(f);f.connect(g);g.connect(AU.sfx);AU.spray={g};}
  // 風切り音（右）・機内の空調・波の音
  {const mk=(pan,f0,lf)=>{const n=ctx.createBufferSource();n.buffer=nb;n.loop=true;n.start(0,Math.random()*1.5);const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=f0;f.Q.value=.8;const l=ctx.createOscillator();l.frequency.value=lf;const lg=ctx.createGain();lg.gain.value=f0*.4;l.connect(lg);lg.connect(f.frequency);l.start();const g=ctx.createGain();g.gain.value=0;n.connect(f);f.connect(g);
      if(ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=pan;g.connect(p);p.connect(AU.sfx);}else g.connect(AU.sfx);return g;};
    AU.windL=mk(-.8,520,.23);AU.windR=mk(.8,610,.31);}
  {const n=loopNoise(),f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=5200;f.Q.value=.7;const g=ctx.createGain();g.gain.value=0;n.connect(f);f.connect(g);g.connect(AU.sfx);AU.air={g};}
  {const s=ctx.createBufferSource();s.buffer=AU.brown;s.loop=true;s.start();const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=520;const l=ctx.createOscillator();l.frequency.value=.14;const lg=ctx.createGain();lg.gain.value=260;l.connect(lg);lg.connect(f.frequency);l.start();const g=ctx.createGain();g.gain.value=0;s.connect(f);f.connect(g);g.connect(AU.sfx);AU.wash={g};}
  // 警報
  {const o=ctx.createOscillator();o.type='square';o.frequency.value=880;const g=ctx.createGain();g.gain.value=0;const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=2400;
    o.connect(f);f.connect(g);g.connect(AU.sfx);o.start();AU.alarm={o,g,on:false,t:0};}
  setVolumes();setTimeout(buildThunderPool,300);setTimeout(buildBoomPool,1200);setTimeout(buildSfxPool,2200);
  MUS.tNext=ctx.currentTime+.1;
  if(!AU.timer)AU.timer=setInterval(()=>{musTick();BGM.tick();},40);
  if(BGM.buf){fixCues(BGM.buf.duration);BGM.ready=true;if(MUS.want){const w=MUS.want;MUS.pending='none';BGM.play(w);}}else BGM.load();
  keepAlive();
}
// Safari では、音声が「動作中」と表示されたまま無音になることがある。無音の audio 要素を鳴らし続けて、ページを再生中として扱わせる
function keepAlive(){if(AU.keep)return;try{const sr=8000,n=sr,b=new DataView(new ArrayBuffer(44+n*2)),w=(o,t)=>{for(let i=0;i<t.length;i++)b.setUint8(o+i,t.charCodeAt(i));};
  w(0,'RIFF');b.setUint32(4,36+n*2,true);w(8,'WAVEfmt ');b.setUint32(16,16,true);b.setUint16(20,1,true);b.setUint16(22,1,true);b.setUint32(24,sr,true);b.setUint32(28,sr*2,true);b.setUint16(32,2,true);b.setUint16(34,16,true);w(36,'data');b.setUint32(40,n*2,true);
  const a=AU.keep=new Audio(URL.createObjectURL(new Blob([b],{type:'audio/wav'})));a.loop=true;a.volume=.001;const p=a.play();if(p&&p.catch)p.catch(()=>{AU.keep=null;});}catch(e){}}
// 音声の作り直し（設定画面の「音が出ないとき」）。再生中の曲と環境音は作り直した側で鳴らし直す
function restartAudio(){const old=AU.ctx;if(old){try{old.close();}catch(e){}}
  for(const k of Object.keys(AU)){if(!['musVol','sfxVol','timer','keep'].includes(k))delete AU[k];}
  BGM.cur=null;BGM.mood=null;BGM.ready=false;const w=MUS.want;MUS.mood='none';MUS.pending=null;
  if(typeof THUNDER!=='undefined'&&THUNDER.length)THUNDER.length=0;
  initAudio();if(w)setMood(w);if(AU.keep){const p=AU.keep.play();if(p&&p.catch)p.catch(()=>{});}}
function setVolumes(){if(!AU.ctx)return;AU.mus.gain.value=AU.musVol*.85;AU.sfx.gain.value=AU.sfxVol*.9;}
function setWingVoice(power,sp){if(!AU.ctx||!AU.wingV)return;const t=AU.ctx.currentTime,v=AU.wingV;v.bus.gain.setTargetAtTime(power*.3*sp.prox,t,.06);if(v.pan)v.pan.pan.setTargetAtTime(sp.pan,t,.06);
  v.o.playbackRate.setTargetAtTime((.85+power*.2)*sp.dop,t,.06);v.w.frequency.setTargetAtTime((1500+power*1100)*sp.dop,t,.06);v.nf.frequency.setTargetAtTime((900+power*900)*sp.muf,t,.06);}
function setLoops(engine,boost,wind,rain,sp){
  if(!AU.ctx)return;const t=AU.ctx.currentTime,e=AU.eng;sp=sp||{prox:1,pan:0,dop:1,muf:1};
  AU.engBus.gain.setTargetAtTime(sp.prox,t,.06);if(AU.engPan)AU.engPan.pan.setTargetAtTime(sp.pan,t,.06);
  // 燃焼の轟音：強さで音量と明るさ、ブーストでさらに太く。ドップラーは再生速度で
  e.rg.gain.setTargetAtTime(engine*(.85+boost*.6),t,.12);e.src.playbackRate.setTargetAtTime((.82+engine*.22+boost*.14)*sp.dop,t,.15);
  e.lp.frequency.setTargetAtTime((1000+engine*2200+boost*3000)*sp.muf,t,.15);e.pk.frequency.setTargetAtTime(320+engine*260+boost*200,t,.2);
  e.cg.gain.setTargetAtTime((engine*.012+boost*.15)*sp.muf,t,.1);e.cs.playbackRate.setTargetAtTime(sp.dop,t,.1);   /* バリバリは控えめに（強いとパキパキと乾いて聞こえた） */
  // タービン：回転数に比例して高く大きく（地上・低出力では唸りが目立ち、全開では轟音に埋もれる）
  {const f0=(950+engine*1500+boost*350)*sp.dop;[1,1.0062,2.013,1.48].forEach((m,i)=>e.w[i].frequency.setTargetAtTime(f0*m,t,.25));e.wbp.frequency.setTargetAtTime(f0*1.4*sp.muf,t,.2);
    e.whg.gain.setTargetAtTime(engine*(.022-.008*boost)*Math.min(1,sp.muf*1.2),t,.2);e.bnf.frequency.setTargetAtTime(f0*.5,t,.2);e.bng.gain.setTargetAtTime(engine*.07*sp.muf,t,.2);}
  e.rlg.gain.setTargetAtTime(engine*.22+boost*.3,t,.2);
  AU.wind.g.gain.setTargetAtTime(.04*engine+wind*.85,t,.3);AU.wind.f.frequency.setTargetAtTime(340+wind*520,t,.4);
  AU.rain.g.gain.setTargetAtTime(rain*.2,t,.3);AU.rain2.g.gain.setTargetAtTime(rain*.24,t,.3);
  AU.wind2.g.gain.setTargetAtTime(wind*wind*.55,t,.5);AU.rumble.g.gain.setTargetAtTime(wind*1.5+rain*.7,t,.5);
}
function setAlarm(on){
  // 鳴らすのは約 14 秒の一続き。鳴り終わったあとの true は鳴らし直す（次の危険の警報が無視されないように）
  if(!AU.ctx)return;const t=AU.ctx.currentTime;if(on?AU.alarm.on&&t<(AU.alarm.until||0):!AU.alarm.on)return;AU.alarm.on=on;const g=AU.alarm.g.gain;g.cancelScheduledValues(t);
  if(on){AU.alarm.until=t+40*.36;for(let i=0;i<40;i++){g.setValueAtTime(.05,t+i*.36);g.setValueAtTime(0,t+i*.36+.16);AU.alarm.o.frequency.setValueAtTime(i%2?740:980,t+i*.36);}}
  else g.setValueAtTime(0,t);
}
// 汎用の単音
function tone(dest,type,f0,f1,t,dur,vol,a,opt){
  const ctx=AU.ctx,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);
  if(f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dur);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+(a||.005));g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  let n=o;if(opt&&opt.lp){const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(opt.lp,t);if(opt.lp2)f.frequency.exponentialRampToValueAtTime(opt.lp2,t+dur);o.connect(f);n=f;}
  n.connect(g);g.connect(dest);if(opt&&opt.rev){const r=ctx.createGain();r.gain.value=opt.rev;g.connect(r);r.connect(AU.rev);}
  o.start(t);o.stop(t+dur+.05);
}
function burst(dest,t,dur,vol,type,f0,f1,q,rev,a){
  const ctx=AU.ctx,s=ctx.createBufferSource();s.buffer=AU.noise;s.loop=true;const f=ctx.createBiquadFilter();f.type=type;f.frequency.setValueAtTime(f0,t);
  if(f1&&f1!==f0)f.frequency.exponentialRampToValueAtTime(f1,t+dur);f.Q.value=q||.7;
  const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+(a||.004));g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  s.connect(f);f.connect(g);g.connect(dest);if(rev){const r=ctx.createGain();r.gain.value=rev;g.connect(r);r.connect(AU.rev);}
  s.start(t,Math.random()*1.5);s.stop(t+dur+.05);
}
// ───────────────────────── 爆発音とジェット音の事前合成 ─────────────────────────
// 爆発：最初の衝撃波（Friedlander 波形：急に立ち上がって指数的に減り、負圧へ振れる）＋燃焼の轟き（時間とともに低域へ移るノイズ、乱流でうねる）
// ＋地鳴り（ごく低いノイズ）＋破片がはぜる音（まばらな短いクリック）。左右で別のノイズを使って広がりを出す
function renderBoom(sr,big,seed){
  const R=mulberry(seed),dur=big?5.6:3.0,n=Math.floor(sr*dur),out=[new Float32Array(n),new Float32Array(n)];
  const Ts=big?.034:.013,tb=big?1.05:.5,tr=big?2.4:1.0,crk=big?2.6:1.2;
  for(let ch=0;ch<2;ch++){const o=out[ch];let l1=0,l2=0,br=0,rl=0,mod=1,mt=0,ph=0,pa=0,pf=0,pd=0;
    for(let i=0;i<n;i++){const t=i/sr;
      // 衝撃波
      let p=0;if(t<Ts*7){const x=t/Ts,rise=Math.min(1,t/.0004);p=rise*(1-x)*Math.exp(-1.6*x)*(big?1.25:1.05);}
      // 燃焼の轟き：遮断周波数を時間で下げる 2 段の 1 次低域通過
      const fc=(big?3800:5200)*Math.exp(-t/(big?.35:.22))+(big?110:180),a=1-Math.exp(-2*Math.PI*fc/sr);
      const w=R()*2-1;l1+=a*(w-l1);l2+=a*(l1-l2);
      if(--mt<=0){mt=Math.floor(sr*(.03+R()*.08));mod=.55+R()*.9;}ph+=(mod-ph)*.0009;
      const env=Math.min(1,t/.006)*Math.exp(-t/tb)*(1-Math.exp(-t/.02));
      let s=p+l2*env*ph*(big?2.6:2.2);
      // 地鳴り
      br=(br+.02*(R()*2-1))/1.02;rl+=.004*(br*3.5-rl);s+=rl*Math.min(1,t/.05)*Math.exp(-t/tr)*(big?5:2.5);
      // 破片がはぜる音
      if(t>.25&&t<crk&&R()<(big?50:35)/sr*Math.exp(-t/(crk*.5))){pa=(R()*.5+.15)*Math.exp(-t/crk)*.45;pf=0;pd=0;}   // 落ちてくる破片：まばらに、低くこもった音で（高い乾いた音はキリキリ・パキパキと聞こえた）
      if(pa>1e-4){pf+=.12*((R()*2-1)-pf);s+=pa*3*pf*Math.exp(-pd/(sr*.004));pd++;if(pd>sr*.02)pa=0;}   /* 低域だけ残したノイズの粒（約 1kHz 以下） */
      o[i]=s;}}
  // 柔らかく飽和させて揃える
  let pk=0;for(const o of out)for(let i=0;i<n;i++){o[i]=Math.tanh(o[i]*1.5);pk=Math.max(pk,Math.abs(o[i]));}
  for(const o of out)for(let i=0;i<n;i++)o[i]*=.95/pk;
  // 終わりを静かに
  for(const o of out){const f=Math.floor(sr*.3);for(let i=0;i<f;i++)o[n-1-i]*=i/f;}
  return out;}
const BOOMS={big:[],small:[]};
function buildBoomPool(){if(!AU.ctx||BOOMS.big.length)return;const sr=AU.ctx.sampleRate,jobs=[[1,11],[0,23],[1,37],[0,41],[1,53],[0,67]];let i=0;
  const next=()=>{if(i>=jobs.length||!AU.ctx)return;const[bg,sd]=jobs[i++],d=renderBoom(sr,!!bg,sd),b=AU.ctx.createBuffer(2,d[0].length,sr);b.getChannelData(0).set(d[0]);b.getChannelData(1).set(d[1]);(bg?BOOMS.big:BOOMS.small).push(b);setTimeout(next,40);};next();}
// 距離のある爆発：音速ぶん遅れて届き、遠いほど高音が削られ（空気の吸収）、残響が増える
function boomAt(d,pan,k,type){if(!AU.ctx)return;const big=k>=.55||type==='tank'||type==='ship'||type==='bldg',pool=big?BOOMS.big:BOOMS.small;
  if(!pool.length){SFX.boom();return;}
  const ctx=AU.ctx,t=ctx.currentTime+Math.min(6,d/343),s=ctx.createBufferSource();s.buffer=pool[Math.floor(Math.random()*pool.length)];
  s.playbackRate.value=(big?.82+Math.random()*.2:.95+Math.random()*.3)*(type==='tank'?.85:1)*(k<.35?1.15:1);
  const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=16000*Math.exp(-d/850)+260;lp.Q.value=.4;
  const vol=Math.min(1.6,(.5+k*.9)*Math.pow(1/(1+d/170),1.05)*(type==='tank'?1.25:1)),g=ctx.createGain();g.gain.value=vol;
  s.connect(lp);lp.connect(g);let o=g;if(ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan))*(1-Math.min(.6,d/2500));g.connect(p);o=p;}o.connect(AU.sfx);
  const r=ctx.createGain();r.gain.value=vol*(.25+.7*Math.min(1,d/1400));g.connect(r);r.connect(AU.rev);
  s.start(t);s.stop(t+s.buffer.duration/s.playbackRate.value+.1);
  // 近いときは胸に響く低い一撃を足す
  if(d<260&&big)tone(AU.sfx,'sine',62,30,t,.7,.55*(1-d/260)*Math.min(1,k+.3),.004);}
// ジェットの燃焼音のループ：ピンク寄りのノイズに、ジェット騒音らしい山（低中域）と乱流のうねりを付け、継ぎ目を重ねてつなぐ
function makeJetBuffer(ctx){const sr=ctx.sampleRate,n=Math.floor(sr*6),X=Math.floor(sr*.4),b=ctx.createBuffer(2,n,sr),R=mulberry(777);
  for(let ch=0;ch<2;ch++){const o=new Float32Array(n+X);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,h=0,lo=0,m=1,mt=0,mm=1;
    for(let i=0;i<n+X;i++){const w=R()*2-1;b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;
      let p=(b0+b1+b2+b3+b4+b5+w*.5362)*.2;lo+=.18*(p-lo);h=lo;   // 高域を少し丸める
      if(--mt<=0){mt=Math.floor(sr*(.02+R()*.06));m=.75+R()*.5;}mm+=(m-mm)*.0015;o[i]=h*mm;}
    const d=b.getChannelData(ch);for(let i=0;i<n;i++)d[i]=o[i];for(let i=0;i<X;i++){const u=i/X;d[i]=o[i]*u+o[n+i]*(1-u);}
    let pk=0;for(let i=0;i<n;i++)pk=Math.max(pk,Math.abs(d[i]));for(let i=0;i<n;i++)d[i]*=.8/pk;}
  return b;}
// クラックル：本物のジェット排気に特有の「バリバリ」。正の側へ鋭く立つ、まばらで強さのばらつく圧力のとげ
function makeCrackleBuffer(ctx){const sr=ctx.sampleRate,n=Math.floor(sr*4),b=ctx.createBuffer(2,n,sr),R=mulberry(4242);
  for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);let a=0,k=0;
    for(let i=0;i<n;i++){if(R()<420/sr){a=Math.min(1,.15*Math.pow(R()+.02,-.7));k=0;}const e=a*Math.exp(-k/(sr*.00045));d[i]=e-(k>sr*.0006?e*.35:0)+(R()*2-1)*.03;k++;if(k>sr*.004)a=0;}
    const f=Math.floor(sr*.05);for(let i=0;i<f;i++){const u=i/f;d[i]=d[i]*u+d[n-f+i]*(1-u);}}
  return b;}
// ───────────────────────── ディフューザーの発射音・水への衝突音（事前合成） ─────────────────────────
// 発射：留め金が外れる金属音（減衰の速い不協和な固有振動）→ 0.22 秒後に点火の破裂音とはぜる音 → モーターの轟音（燃焼の不安定さでざらつき、遠ざかるにつれ高音が落ちて小さくなる）
function renderLaunch(sr,seed){const R=mulberry(seed),n=Math.floor(sr*3.8),out=[new Float32Array(n),new Float32Array(n)];
  for(let ch=0;ch<2;ch++){const o=out[ch];let l1=0,l2=0,am=1,amT=0,amV=1,pa=0,pd=0,pf=0,hp=0,lw=0;
    const modes=[[310,.07],[781,.05],[1427,.035],[2290,.022],[3410,.015]];
    for(let i=0;i<n;i++){const t=i/sr;let s=0;
      // 留め金
      for(const[f,tau]of modes)s+=Math.sin(2*Math.PI*f*(1+ch*.003)*t)*Math.exp(-t/tau)*.22;
      s+=Math.sin(2*Math.PI*68*t)*Math.exp(-t/.07)*.7;
      const tm=t-.22;
      if(tm>0){// 点火の圧力波
        const w=R()*2-1;hp=w-lw;lw=w;s+=hp*Math.exp(-tm/.012)*1.1+Math.sin(2*Math.PI*55*tm)*Math.exp(-tm/.09)*.9;
        // モーター：低域から高域まで広いノイズ。遮断周波数が上がってから、遠ざかって下がる
        const fc=Math.min(4200,600+tm*16000)*Math.exp(-Math.max(0,tm-.35)/1.5)+260,a=1-Math.exp(-2*Math.PI*fc/sr);
        l1+=a*(w-l1);l2+=a*(l1-l2);
        if(--amT<=0){amT=Math.floor(sr/(35+R()*45));amV=.55+R()*.9;}am+=(amV-am)*.02;
        const env=Math.min(1,tm/.06)/(1+Math.max(0,tm-.3)*1.25);s+=l2*env*am*2.6;
        // はぜる音（点火直後に密、だんだんまばらに）
        if(R()<(220*Math.exp(-tm/.3)+25)/sr){pa=(.15+R()*.35)*Math.min(1,1/(1+tm*1.5));pf=0;pd=0;}   // はぜる音はまばらに
        if(pa>1e-4){pf+=.2*((R()*2-1)-pf);s+=pa*2.2*pf*Math.exp(-pd/(sr*.0025));pd++;if(pd>sr*.012)pa=0;}}
      o[i]=s;}}
  return normOut(out,.3);}
// 水への衝突：叩く音（水面を打つ短い衝撃）＋水の塊が動く低いうねり＋落ちてくるしぶきの細かい音（ノイズの粒）。
// 泡の共鳴（上がっていく短い正弦波）は水中で聞こえる音で、空中では「キュルキュル」と鳴いて聞こえたので使わない
function renderSplash(sr,big,seed){const R=mulberry(seed),dur=big?4.2:1.6,n=Math.floor(sr*dur),out=[new Float32Array(n),new Float32Array(n)];
  const NR=big?700:120,rain=[];for(let k=0;k<NR;k++){const t0=(big?.5:.25)+R()*(big?2.6:1.0),k2=.25+R()*.6;rain.push([t0,k2,.003+R()*.008,(.05+R()*.18)*Math.exp(-(t0-.4)/(big?1.4:.6))]);}
  for(let ch=0;ch<2;ch++){const o=out[ch];let l1=0,l2=0,b1=0,hp=0,lw=0;
    for(let i=0;i<n;i++){const t=i/sr,w=R()*2-1;let s=0;
      // 叩く音：帯域を絞ったノイズの急な立ち上がり
      hp=w-lw;lw=w;b1+=.09*(hp-b1);s+=b1*Math.exp(-t/(big?.07:.025))*(big?5:3.4);
      if(big)s+=Math.sin(2*Math.PI*(48-12*t)*t)*Math.exp(-t/.35)*1.1;
      // 水の塊のうねり
      const fc=(big?1300:1900)*Math.exp(-t/(big?.9:.35))+120,a=1-Math.exp(-2*Math.PI*fc/sr);l1+=a*(w-l1);l2+=a*(l1-l2);
      s+=l2*Math.min(1,t/.015)*Math.exp(-t/(big?1.2:.4))*(big?2.2:1.3);
      // しぶきが降るさーっという音
      s+=hp*.05*Math.exp(-Math.pow((t-(big?1.2:.45))/(big?.9:.35),2))*(big?1:.6);
      o[i]=s;}
    // しぶきの粒：高域寄りのノイズを短く鳴らす（音程を持たせない）
    for(const[t0,k2,tau,a]of rain){const i0=Math.floor((t0+(ch?R()*.003:0))*sr),len=Math.min(n-i0,Math.floor(tau*5*sr));let lw2=0,lp2=0;for(let j=0;j<len;j++){const w=R()*2-1,h=w-lw2;lw2=w;lp2+=k2*(h-lp2);o[i0+j]+=a*1.4*lp2*Math.exp(-j/sr/tau)*Math.min(1,j/24);}}}
  return normOut(out,.25);}
function normOut(out,fade){let pk=0;for(const o of out)for(let i=0;i<o.length;i++){o[i]=Math.tanh(o[i]*1.2);pk=Math.max(pk,Math.abs(o[i]));}
  for(const o of out){for(let i=0;i<o.length;i++)o[i]*=.95/pk;const f=Math.floor(o.length*fade*.3);for(let i=0;i<f;i++)o[o.length-1-i]*=i/f;}return out;}
const SBUF={launch:[],splashBig:[],splashSmall:[]};
function buildSfxPool(){if(!AU.ctx||SBUF.launch.length)return;const sr=AU.ctx.sampleRate,jobs=[['launch',()=>renderLaunch(sr,5)],['launch',()=>renderLaunch(sr,9)],['splashBig',()=>renderSplash(sr,true,3)],['splashBig',()=>renderSplash(sr,true,8)],['splashSmall',()=>renderSplash(sr,false,4)],['splashSmall',()=>renderSplash(sr,false,6)]];let i=0;
  const next=()=>{if(i>=jobs.length||!AU.ctx)return;const[k,fn]=jobs[i++],d=fn(),b=AU.ctx.createBuffer(2,d[0].length,sr);b.getChannelData(0).set(d[0]);b.getChannelData(1).set(d[1]);SBUF[k].push(b);setTimeout(next,40);};next();}
// 事前合成の音を距離・左右付きで鳴らす
function playBuf(pool,o){if(!AU.ctx||!pool.length)return false;o=o||{};const ctx=AU.ctx,d=o.d||0,t=ctx.currentTime+Math.min(4,d/343)+(o.delay||0),s=ctx.createBufferSource();s.buffer=pool[Math.floor(Math.random()*pool.length)];s.playbackRate.value=(o.rate||1)*(.96+Math.random()*.08);
  const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=16000*Math.exp(-d/900)+300;const g=ctx.createGain();g.gain.value=(o.vol||1)/(1+d/160);
  s.connect(lp);lp.connect(g);let out=g;if(ctx.createStereoPanner&&o.pan){const p=ctx.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,o.pan));g.connect(p);out=p;}out.connect(AU.sfx);
  const r=ctx.createGain();r.gain.value=(o.vol||1)*(o.rev||.2)/(1+d/400);g.connect(r);r.connect(AU.rev);s.start(t);return true;}
// ───────────────────────── 雷鳴の合成 ─────────────────────────
// 放電路を数メートルずつの折れ線で作り、各区間が出す N 字形の圧力波を「聞き手までの距離÷音速」だけ遅らせて重ねる。
// 視線に直角な区間の束は鋭い「バリッ」、遠い区間は遅れて届く低い「ゴロゴロ」になる。
const THUNDER=[];
function renderThunder(sr,D,ic,seed){
  const R=mulberry(seed),rn=()=>R()*2-1,C=343,segs=[];
  const walk=(x,y,z,dx,dy,dz,n,step,amp,bias)=>{let tx=dx,ty=dy,tz=dz,k=0;
    for(let i=0;i<n;i++){
      if(k--<=0){k=30+Math.floor(R()*60);tx=dx+rn()*.9;ty=dy+rn()*.5;tz=dz+rn()*.9;}        // 大きな折れ曲がり
      dx+=(tx-dx)*.08+rn()*.34;dy+=(ty-dy)*.08+rn()*.22+bias;dz+=(tz-dz)*.08+rn()*.34;        // 細かなぎざぎざ
      const l=Math.hypot(dx,dy,dz)||1;dx/=l;dy/=l;dz/=l;
      const nx=x+dx*step,ny=Math.max(2,y+dy*step),nz=z+dx*0+dz*step;segs.push([(x+nx)/2,(y+ny)/2,(z+nz)/2,dx,dy,dz,amp*(.55+R()*R()*1.7),0]);x=nx;y=ny;z=nz;}
    return[x,y,z];};
  let trunk=0;
  if(!ic){const top=walk(D,0,0,0,1,0,300,7,1,.02);trunk=segs.length;
    for(let b=0;b<7;b++){const s=segs[30+Math.floor(R()*240)];walk(s[0],s[1],s[2],rn(),-.4,rn(),40+Math.floor(R()*110),7,.38,-.01);}   // 枝
    walk(top[0],top[1],top[2],rn(),.05,rn(),500+Math.floor(R()*500),9,.75,0);}                                                          // 雲の中を這う部分
  else walk(D,1800+R()*900,0,rn(),0,rn(),700+Math.floor(R()*600),9,.8,0);
  // 帰還雷撃（幹だけが数十ミリ秒おきに光り直す）
  const strokes=ic?0:1+Math.floor(R()*3);for(let k=0;k<strokes;k++){const off=(k+1)*(.045+R()*.07),a=.75-k*.17;for(let i=0;i<trunk;i++){const s=segs[i];segs.push([s[0],s[1],s[2],s[3],s[4],s[5],s[6]*a,off]);}}
  let rmin=1e9,rmax=0;for(const s of segs){const r=Math.hypot(s[0],s[1]-40,s[2]);s[8]=r;if(r<rmin)rmin=r;if(r>rmax)rmax=r;}
  const dur=Math.min(16,(rmax-rmin)/C+3.2),N=Math.floor(dur*sr),buf=new Float32Array(N);
  for(const s of segs){const r=s[8],lx=s[0]/r,ly=(s[1]-40)/r,lz=s[2]/r,cs=Math.abs(s[3]*lx+s[4]*ly+s[5]*lz),dir=1-cs;
    const amp=s[6]*(.22+.78*dir*dir)*120/r;
    const T=(.0034+.0000046*r)*(.7+R()*.6),n=Math.max(4,Math.floor(T*sr)),i0=Math.floor(((r-rmin)/C+s[7]+.01)*sr);if(i0+n>=N)continue;
    for(let k=0;k<n;k++)buf[i0+k]+=amp*(1-2*k/n);}
  // 地形や雲からのこだま（遅れて、こもって届く）と、うねる余韻
  const out=new Float32Array(N);let l1=0,l2=0,env=0,nz=0;const d1=Math.floor(.42*sr),d2=Math.floor(1.05*sr),d3=Math.floor(2.1*sr);
  for(let i=0;i<N;i++){const x=buf[i];l1+=(( i>=d1?buf[i-d1]:0)-l1)*.035;l2+=((i>=d2?buf[i-d2]:0)-l2)*.02;
    env+=(Math.abs(x)-env)*(Math.abs(x)>env?.02:.0006);nz+=((Math.random()*2-1)-nz)*.012;
    out[i]=x+l1*.55+l2*.42+(i>=d3?out[i-d3]*.16:0)+nz*env*2.2;}
  let pk=1e-9;for(let i=0;i<N;i++){const a=Math.abs(out[i]);if(a>pk)pk=a;}
  const f=Math.floor(.6*sr);for(let i=0;i<N;i++){out[i]=Math.tanh(out[i]/pk*1.6)*.85*(i>N-f?(N-i)/f:1);}
  return out;
}
function buildThunderPool(){
  const sr=22050,jobs=[[150,0,11],[150,0,12],[380,0,13],[800,0,14],[800,0,15],[1700,0,16],[3400,0,17],[6500,0,18],[1500,1,21],[3500,1,22],[7000,1,23],[7000,1,24]];let i=0;
  const next=()=>{if(i>=jobs.length||!AU.ctx)return;const[D,ic,seed]=jobs[i++];const d=renderThunder(sr,D,!!ic,seed),b=AU.ctx.createBuffer(1,d.length,sr);b.getChannelData(0).set(d);THUNDER.push({buf:b,D,ic:!!ic});setTimeout(next,60);};
  next();
}
// 雨粒・突風・機体のきしみ（環境音）
const AMB={pat:0,gust:1,creak:2};
function sfxAmbient(dt,rain,turb,g,low,spd){
  if(!AU.ctx)return;const t=AU.ctx.currentTime;
  const sp=sat((spd||0)/260);AU.windL.gain.setTargetAtTime(sp*sp*.16+turb*.12,t,.3);AU.windR.gain.setTargetAtTime(sp*sp*.16+turb*.12,t,.3);AU.air.g.gain.setTargetAtTime(sp>0?.018:0,t,.4);AU.wash.g.gain.setTargetAtTime((low||0)*1.3,t,.4);
  // 高 G 旋回のバフェット
  if(g>1.7){AMB.buf=(AMB.buf||0)-dt;if(AMB.buf<=0){AMB.buf=.09+Math.random()*.08;burst(AU.sfx,t,.12,.1*(g-1.4),'lowpass',160+Math.random()*120,70,1.2);}}
  // 壁雲の雹まじりの雨が機体を叩く
  if(rain>1.1){AMB.hail=(AMB.hail||0)-dt;if(AMB.hail<=0){AMB.hail=.03+Math.random()*.08;burst(AU.sfx,t,.025,.1+Math.random()*.12,'bandpass',700+Math.random()*900,500,5);}}
  if(rain>.15){AMB.pat-=dt;if(AMB.pat<=0){AMB.pat=.02+Math.random()*.09/rain;burst(AU.sfx,t,.03,.05+Math.random()*.1*rain,'bandpass',2600+Math.random()*3800,2000,3);}}
  if(turb>.3){AMB.gust-=dt;if(AMB.gust<=0){AMB.gust=.8+Math.random()*2.2;burst(AU.sfx,t,1.1+Math.random(),.35*turb,'bandpass',260+Math.random()*300,900+Math.random()*700,1.4,.3,.4);}
    AMB.creak-=dt;if(AMB.creak<=0){AMB.creak=1.2+Math.random()*3;const f=70+Math.random()*90;tone(AU.sfx,'sawtooth',f,f*(.7+Math.random()*.5),t,.3+Math.random()*.3,.07*turb,.05,{lp:500});burst(AU.sfx,t,.08,.12*turb,'bandpass',900,400,4);}}
}
const SFX={
  thunder(dist,kind){if(!AU.ctx)return;const ctx=AU.ctx,ic=kind==='ic';
    const pool=THUNDER.filter(b=>b.ic===ic||(!ic&&dist>5000));if(!pool.length){SFX.thunderOld(dist);return;}
    // 距離の近い版を選ぶ（同じ版が続かないよう少し散らす）
    pool.sort((a,b)=>Math.abs(Math.log(a.D/Math.max(dist,80)))-Math.abs(Math.log(b.D/Math.max(dist,80))));
    const pick=pool[Math.random()<.7||pool.length<2?0:1],t=ctx.currentTime+.03+Math.min(dist/1200,3.2);
    const s=ctx.createBufferSource();s.buffer=pick.buf;s.playbackRate.value=.9+Math.random()*.22;
    // 遠いほど高音が空気に吸われる
    const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=clamp(9000/(1+dist/450),160,9000);lp.Q.value=.3;
    const g=ctx.createGain();g.gain.value=clamp(2.6/(1+dist/900),.22,2.4)*(ic?.8:1);
    s.connect(lp);lp.connect(g);
    if(ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=(Math.random()*2-1)*.75;g.connect(p);p.connect(AU.sfx);}else g.connect(AU.sfx);
    const rv=ctx.createGain();rv.gain.value=.35;g.connect(rv);rv.connect(AU.rev);
    s.start(t);
    // 至近の落雷は、轟きの前に空気を裂く鋭い音が入る
    if(dist<500&&!ic){const v=1-dist/500;burst(AU.sfx,t,.035,1.2*v,'highpass',2600,1400,.5,.2);for(let i=0;i<4;i++)burst(AU.sfx,t+.02+Math.random()*.09,.03+Math.random()*.03,.9*v*Math.random(),'bandpass',1800+Math.random()*2600,900,1.2,.2);tone(AU.sfx,'sine',55,24,t,1.2,.9*v,.004);}},
  thunderOld(dist){if(!AU.ctx)return;const t=AU.ctx.currentTime+Math.min(dist/2600,2.2),v=.25+sat(1-dist/3500)*.75;burst(AU.sfx,t+.02,3.6,.95*v,'lowpass',1200,70,.6,.7,.02);tone(AU.sfx,'sine',62,30,t,1.6,.55*v,.01);},
  pull(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'square',880,880,t,.16,.1,.004,{lp:3200});tone(AU.sfx,'square',1320,1320,t+.2,.2,.1,.004,{lp:3600});},
  caution(){if(!AU.ctx)return;const t=AU.ctx.currentTime;for(let i=0;i<3;i++)tone(AU.sfx,'triangle',1480,1480,t+i*.11,.07,.08,.003);},
  gear(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'sawtooth',180,240,t,1.3,.07,.1,{lp:900});burst(AU.sfx,t,1.3,.12,'bandpass',900,1500,2,.2,.1);burst(AU.sfx,t+1.35,.18,.7,'lowpass',600,120,1,.3);tone(AU.sfx,'sine',90,50,t+1.35,.25,.6,.004);burst(AU.sfx,t+1.5,.06,.3,'bandpass',2200,1200,5);},
  horn(){if(!AU.ctx)return;const t=AU.ctx.currentTime+.4;for(const f of[98,147,99.5]){tone(AU.sfx,'sawtooth',f,f,t,2.6,.1,.25,{lp:520,rev:.8});}tone(AU.sfx,'sawtooth',98,98,t+3.1,1.1,.09,.2,{lp:520,rev:.8});},
  ignite(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'sine',70,34,t,.7,.9,.004);burst(AU.sfx,t,.5,.8,'lowpass',1400,160,.7,.4);burst(AU.sfx,t+.03,1.6,.4,'bandpass',500,1600,.8,.3,.1);for(let i=0;i<6;i++)burst(AU.sfx,t+.1+i*.09,.05,.18,'bandpass',900+Math.random()*1400,500,3);},
  // 主翼がちぎれる：金属が裂ける広い帯域の雑音と低い衝撃（音程の動く音は使わない）
  // 外板がはがれる：短い破断音と低い衝撃だけ。以前は細い帯域の音を 50ms おきに音程を動かして並べていたため「キュルキュル」と鳴き、こだまのように聞こえた
  rip(){if(!AU.ctx)return;const t=AU.ctx.currentTime;if(t-(AU.ripT||-9)<1.2)return;AU.ripT=t;burst(AU.sfx,t,.32,.7,'lowpass',2400,700,.5,.08);burst(AU.sfx,t,.12,.3,'highpass',2000,2000,.5,0);tone(AU.sfx,'sine',120,55,t,.3,.55,.003);},
  // 機銃：低い発射の衝撃＋乾いた破裂音（連射で重なる）
  gun(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'sine',140,48,t,.07,.32,.002);burst(AU.sfx,t,.05,.34,'bandpass',2600,1200,1.2,.08);burst(AU.sfx,t,.09,.22,'lowpass',900,200,.7);},
  // 弾が金属に当たる：短い打撃と高い響き
  // 着弾：建物や地面には鈍い衝撃（高く鳴る金属音はキリキリと耳についた）。船体に当たったときだけ低く短い金属の響き
  ting(metal){if(!AU.ctx)return;const t=AU.ctx.currentTime;burst(AU.sfx,t,.09,.32,'lowpass',900,220,.6);if(metal){const f=420+Math.random()*260;tone(AU.sfx,'triangle',f,f*.9,t,.09,.035,.002,{lp:1400});}},
  // 弾が海面に当たる
  plip(){if(!AU.ctx)return;const t=AU.ctx.currentTime;burst(AU.sfx,t,.12,.12,'bandpass',1400,500,2);},
  // ミサイルがかすめる：近づいて遠ざかる風切り（ドップラーで下がる）
  whoosh(pan){if(!AU.ctx)return;const ctx=AU.ctx,t=ctx.currentTime,s=ctx.createBufferSource();s.buffer=AU.noise;s.loop=true;const f=ctx.createBiquadFilter();f.type='bandpass';f.Q.value=1.4;
    f.frequency.setValueAtTime(2600,t);f.frequency.exponentialRampToValueAtTime(420,t+.9);const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.55,t+.18);g.gain.exponentialRampToValueAtTime(.0001,t+1.0);
    s.connect(f);f.connect(g);if(ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.setValueAtTime(pan||0,t);p.pan.linearRampToValueAtTime(-(pan||0),t+.9);g.connect(p);p.connect(AU.sfx);}else g.connect(AU.sfx);s.start(t,Math.random());s.stop(t+1.1);},
  spark(){if(!AU.ctx)return;const t=AU.ctx.currentTime;for(let i=0;i<3;i++)burst(AU.sfx,t+i*.04,.035,.18,'highpass',4200,6000,1);},
  radioEnd(){if(!AU.ctx)return;const t=AU.ctx.currentTime;burst(AU.sfx,t,.11,.1,'bandpass',1900,2700,4);},
  charge(d){if(!AU.ctx)return;const t=AU.ctx.currentTime,v=sat(1-d/900)*.5+.08;tone(AU.sfx,'sawtooth',180,1900,t,2.05,.045*v*2,1.6,{lp:5000,rev:.3});for(let i=0;i<9;i++)burst(AU.sfx,t+.4+i*.19-i*i*.004,.03,.12*v,'highpass',5000,7000,1);},
  gate(){if(!AU.ctx)return;const t=AU.ctx.currentTime;burst(AU.sfx,t,.55,.4,'bandpass',400,2600,1.6,.3,.08);},
  hum(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'sawtooth',50,50,t,7,.09,1,{lp:240});tone(AU.sfx,'sine',100,100,t,7,.06,1);for(const d of[.9,1.15,1.4])burst(AU.sfx,t+d,.06,.3,'bandpass',2400,1200,5,.5);tone(AU.sfx,'sine',38,38,t+1.5,.6,.5,.01);},
  klaxon(){if(!AU.ctx)return;const t=AU.ctx.currentTime;for(let i=0;i<4;i++){tone(AU.sfx,'sawtooth',370,470,t+i*.9,.6,.09,.03,{lp:1500,rev:.6});tone(AU.sfx,'square',185,235,t+i*.9,.6,.05,.03,{lp:900,rev:.6});}},
  door(){if(!AU.ctx)return;const t=AU.ctx.currentTime+.8;burst(AU.sfx,t,5.2,.55,'lowpass',170,120,1.2,.5,.5);tone(AU.sfx,'sawtooth',44,52,t,5.2,.14,.4,{lp:200});for(let i=0;i<10;i++)burst(AU.sfx,t+i*.5,.05,.12,'bandpass',1700,900,6,.4);burst(AU.sfx,t+5.1,.5,.9,'lowpass',900,120,.8,.7);tone(AU.sfx,'sine',70,34,t+5.1,.6,.8,.004);},
  spool(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'sawtooth',40,260,t,6,.16,2,{lp:1300,rev:.3});tone(AU.sfx,'sine',300,3400,t,6.5,.05,3,{rev:.3});burst(AU.sfx,t+1,6,.3,'bandpass',300,2400,1,.3,3);burst(AU.sfx,t+.1,.25,.5,'lowpass',700,150,1,.3);},
  // 被弾・衝突：機体を打つ低い衝撃と、外板がへこむ金属音（減衰の速い不協和な固有振動。音程は動かさない）、ばらばらの破片音
  // 激突：鈍い衝撃と砕ける音（音程のある響きや等間隔の粒は鳴きやこだまに聞こえるので入れない）
  hit(){if(!AU.ctx)return;const t=AU.ctx.currentTime;if(t-(AU.hitT||-9)<.35)return;AU.hitT=t;burst(AU.sfx,t,.35,1,'lowpass',2600,220,.5,.12);tone(AU.sfx,'sine',95,60,t,.4,.8,.003);burst(AU.sfx,t,.18,.35,'bandpass',1200,500,.4,0);},
  // 地面をこする：ざらついた摩擦音（低めの帯域、粒のある振幅）
  scrape(){if(!AU.ctx)return;const t=AU.ctx.currentTime;if(t-(AU.scrT||-9)<.8)return;AU.scrT=t;burst(AU.sfx,t,.7,.6,'bandpass',900,320,.6,.3,.01);burst(AU.sfx,t,.5,.35,'highpass',1800,1200,.5,.2);for(let i=0;i<9;i++)burst(AU.sfx,t+i*.06+Math.random()*.03,.05,.22,'lowpass',1400,600,.5,.1);tone(AU.sfx,'sine',70,45,t,.35,.6,.003);},
  zap(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'sine',60,28,t,1.1,.9,.003);burst(AU.sfx,t,.9,.7,'lowpass',2600,120,.6,.6);burst(AU.sfx,t,.3,.7,'bandpass',3200,600,2.5,.2);for(let i=0;i<5;i++)tone(AU.sfx,'sawtooth',900+Math.random()*1800,200,t+i*.035,.06,.1,.002,{lp:5000});},
  splash(){if(!AU.ctx)return;{const t=AU.ctx.currentTime;if(t-(AU.splT||-9)<.8)return;AU.splT=t;}   /* 跳ねるたびに重ねて鳴らさない */if(playBuf(SBUF.splashSmall,{vol:1.2}))return;const t=AU.ctx.currentTime;burst(AU.sfx,t,.25,.8,'lowpass',500,90,.8,.3);burst(AU.sfx,t+.1,1.4,.4,'highpass',2600,4800,.6,.4,.2);burst(AU.sfx,t,.9,.8,'bandpass',900,300,.6,.4,.02);},
  // 画面のボタン：決定（2 音の鐘）、出撃（低い打音＋上がる和音）、カーソルが乗ったとき（短い刻み）
  ui(){if(!AU.ctx)return;const t=AU.ctx.currentTime+.03;tone(AU.sfx,'triangle',2400,1200,t,.03,.16,.002);tone(AU.sfx,'sine',880,880,t,.16,.3,.004,{rev:.35});tone(AU.sfx,'sine',1318.5,1318.5,t+.07,.26,.26,.004,{rev:.45});},
  uiStart(){if(!AU.ctx)return;const t=AU.ctx.currentTime+.03;tone(AU.sfx,'sine',150,55,t,.3,.5,.004);[587.3,740,880,1174.7].forEach((f,i)=>tone(AU.sfx,'triangle',f,f,t+i*.07,.5,.2,.006,{rev:.5}));},
  uiHover(){if(!AU.ctx||AU.ctx.state!=='running')return;const t=AU.ctx.currentTime+.01;tone(AU.sfx,'sine',1760,1760,t,.04,.1,.002);},
  radio(){if(!AU.ctx)return;const t=AU.ctx.currentTime;burst(AU.sfx,t,.07,.12,'bandpass',2400,2400,3);tone(AU.sfx,'sine',1250,1250,t+.02,.05,.05,.003);},
  pickup(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'sine',mtof(64),mtof(64),t,.7,.1,.004,{rev:.6});[76,81,88].forEach((m,i)=>tone(AU.sfx,'sine',mtof(m),mtof(m),t+i*.07,.5,.16,.004,{rev:.5}));},
  lock(p){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'square',700+p*900,700+p*900,t,.05,.05,.003,{lp:3000});},
  lockOn(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'square',1760,1760,t,.5,.07,.003,{lp:4000});},
  warn(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'square',620,620,t,.12,.07,.003,{lp:2600});tone(AU.sfx,'square',620,620,t+.16,.12,.07,.003,{lp:2600});},
  boost(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'sine',85,42,t,.5,.8,.004);burst(AU.sfx,t,.3,.6,'lowpass',900,200,.8,.3);burst(AU.sfx,t,.9,.35,'bandpass',500,3200,1.2,.3,.05);tone(AU.sfx,'sawtooth',90,220,t,.6,.12,.03,{lp:900});},
  launch(){if(!AU.ctx)return;if(playBuf(SBUF.launch,{vol:1.1,rev:.35}))return;const t=AU.ctx.currentTime;burst(AU.sfx,t,.09,.9,'bandpass',900,300,5,.3);tone(AU.sfx,'square',95,60,t,.12,.3,.002,{lp:700});burst(AU.sfx,t+.08,2.6,.5,'lowpass',1400,160,.7,.6,.1);burst(AU.sfx,t,1.6,.8,'bandpass',300,4200,1,.5,.02);tone(AU.sfx,'sawtooth',110,880,t,1.2,.2,.02,{lp:2400,rev:.4});tone(AU.sfx,'sine',70,40,t,.5,.7,.004);},
  boom(){if(!AU.ctx)return;if(BOOMS.big.length){boomAt(40,0,.9,'air');return;}const t=AU.ctx.currentTime;burst(AU.sfx,t,3.2,1,'lowpass',2200,60,.6,.8);tone(AU.sfx,'sine',90,24,t,2.4,1,.005);burst(AU.sfx,t,.3,.8,'highpass',1800,600,.5,.5);},
  servo(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'sawtooth',180,260,t,1.4,.05,.15,{lp:900});tone(AU.sfx,'square',360,520,t,1.4,.015,.15,{lp:1400});burst(AU.sfx,t,1.4,.05,'bandpass',2400,2600,4,.1,.2);},
  latch(){if(!AU.ctx)return;const t=AU.ctx.currentTime;[[290,.09],[760,.06],[1390,.04],[2240,.025],[3300,.015]].forEach(([f,d])=>tone(AU.sfx,'sine',f,f*.995,t,d*5,.18,.001));tone(AU.sfx,'sine',70,50,t,.25,.6,.002);burst(AU.sfx,t,.03,.5,'highpass',3000,3000,.7,.2);
    [0,.11].forEach(dt=>tone(AU.sfx,'square',1760,1760,t+.35+dt,.06,.05,.002,{lp:4000}));},
  implode(){if(!AU.ctx)return;const t=AU.ctx.currentTime;
    burst(AU.sfx,t,2.25,.55,'bandpass',300,3800,1.2,.5,2.1);tone(AU.sfx,'sine',38,90,t,2.2,.45,2.0);for(let i=0;i<10;i++)burst(AU.sfx,t+Math.pow(i/10,.6)*2.1,.07,.1+i*.02,'bandpass',600+Math.random()*900,300,1.2);   /* 放電のはじける音：低めで帯域を広く（細く高いとキリキリ鳴いた） */
    if(BOOMS.big.length){const c=AU.ctx,s2=c.createBufferSource();s2.buffer=BOOMS.big[0];s2.playbackRate.value=.55;const g=c.createGain();g.gain.value=1.3;s2.connect(g);g.connect(AU.sfx);const r=c.createGain();r.gain.value=.9;g.connect(r);r.connect(AU.rev);s2.start(t+2.2);}
    else burst(AU.sfx,t+2.2,5,1,'lowpass',3000,50,.5,.9);tone(AU.sfx,'sine',62,20,t+2.2,5,1,.004);burst(AU.sfx,t+2.4,6,.35,'lowpass',260,60,.6,.8,.6);},
  stall(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'sawtooth',180,45,t,1.3,.25,.01,{lp:900});},
  restart(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'sawtooth',50,170,t,1.1,.25,.05,{lp:1200});burst(AU.sfx,t+.5,.8,.3,'bandpass',600,2600,1,.2,.2);},
  touch(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'sawtooth',1400,700,t,.22,.12,.004,{lp:3000});burst(AU.sfx,t+.1,5,.35,'lowpass',260,90,1,.3,.1);burst(AU.sfx,t,.5,.5,'bandpass',1800,700,3,.2);tone(AU.sfx,'sine',80,45,t,.3,.5,.004);},
};

// ───────────────────────── 音楽 ─────────────────────────
const MUS={mood:'none',pending:null,step:0,tNext:0,intensity:0};
function setMood(m){MUS.want=m;MUS.wantT=AU.ctx?AU.ctx.currentTime:0;if(!BGM.ready&&m==='return')m=MUS.mood==='victory'||MUS.pending==='victory'?'victory':'launch';if(m==='victory'&&!BGM.ready&&MUS.mood!==m){MUS.mood=m;MUS.step=0;MUS.pending=null;return;}if(BGM.ready){BGM.play(m);if(MUS.mood!=='none')MUS.pending='none';return;}if(MUS.mood!==m)MUS.pending=m;}
// ───────────────────────── 音源ファイルの BGM（ローカルに bgm/src/storm_rider.mp3 があるときだけ） ─────────────────────────
// start: 最初に鳴らし始める位置、loop:[a,b] を等パワーでつないで繰り返す。once は 1 回きりで next へ渡す
const CUES={
  title:{start:2.18,loop:[33.4135,61.3133]},
  // 出撃カット用：冒頭の盛り上がりを頭から流し、主題の入り（33.41 秒）が離陸（カット開始から 30 秒）に重なるようにする
  intro:{start:3.46,loop:[33.4135,61.3133]},
  storm:{start:131.2,loop:[148.2362,162.7533]},
  eye:{start:89.7,loop:[93.112,116.2891],vol:.9},
  climax:{start:168.1,loop:[179.3974,198.6695]},
  victory:{once:[198.6695,211.3],next:'theme'},
  theme:{start:33.4135,loop:[33.4135,61.3133]},
};
CUES.launch={start:33.4135,loop:[33.4135,61.3133]};
// 設定を読んだあとに決まる場面（帰投は主題の繰り返し）と、音源の長さに合わない設定の手当て
function fixCues(dur){
  let bad=false;for(const k in CUES){const c=CUES[k],hi=c.once?c.once[1]:c.loop[1],lo=c.once?c.once[0]:Math.min(c.start,c.loop[0]);if(!(lo>=0&&hi<=dur+.05&&hi>lo+.5))bad=true;}
  if(bad){const sc=dur/212.136;console.warn('BGM: 区間の設定が音源の長さ（'+dur.toFixed(1)+' 秒）に合いません。node bgm/setup.mjs <音楽ファイル> で作り直してください。内蔵の区間を曲の長さに合わせて伸縮して使います。');
    const D={title:{start:2.18,loop:[33.4135,61.3133]},intro:{start:3.46,loop:[33.4135,61.3133]},storm:{start:131.2,loop:[148.2362,162.7533]},eye:{start:89.7,loop:[93.112,116.2891],vol:.9},climax:{start:168.1,loop:[179.3974,198.6695]},victory:{once:[198.6695,211.3],next:'theme'},theme:{start:33.4135,loop:[33.4135,61.3133]},launch:{start:33.4135,loop:[33.4135,61.3133]}};
    for(const k in D){const c=D[k];CUES[k]=c.once?{once:c.once.map(v=>v*sc),next:c.next}:{start:c.start*sc,loop:c.loop.map(v=>v*sc),vol:c.vol};}}
  CUES.return={start:CUES.theme.loop[0],loop:CUES.theme.loop.slice()};
}
const BGM={ready:false,buf:null,cur:null,mood:null,
  load(){if(/[?&]synth/.test(location.search))return;fetch('bgm/cues.json').then(r=>r.ok?r.json():null).catch(()=>null).then(j=>{if(j)for(const k in j)if(k[0]!=='_'&&j[k]&&(j[k].loop||j[k].once))CUES[k]=j[k];return fetch('bgm/src/storm_rider.mp3');}).then(r=>r.ok?r.arrayBuffer():Promise.reject()).then(b=>new Promise((ok,ng)=>{const p=AU.ctx.decodeAudioData(b,ok,ng);if(p&&p.catch)p.catch(()=>{});})).then(buf=>{BGM.buf=buf;fixCues(buf.duration);BGM.ready=true;const el=document.getElementById('oSrc');if(el)el.textContent='手元の音源';if(MUS.want){const w=MUS.want;MUS.pending='none';BGM.play(w);}}).catch(e=>{if(e)console.warn('BGM load',e);});},
  curve(up,n){const c=new Float32Array(n);for(let i=0;i<n;i++){const u=i/(n-1);c[i]=up?Math.sin(u*Math.PI/2):Math.cos(u*Math.PI/2);}return c;},
  node(g,t,off,dur,fin,fout){const ctx=AU.ctx,s=ctx.createBufferSource();s.buffer=BGM.buf;const e=ctx.createGain();
    const N=8,G=e.gain;
    if(fin>0){G.setValueAtTime(0,t);for(let i=1;i<=N;i++)G.linearRampToValueAtTime(Math.sin(i/N*Math.PI/2),t+fin*i/N);}else G.setValueAtTime(1,t);
    if(fout>0){const t1=Math.max(t+dur-fout,t+fin+.001);G.setValueAtTime(1,t1);for(let i=1;i<=N;i++)G.linearRampToValueAtTime(Math.cos(i/N*Math.PI/2),t1+fout*i/N);}
    s.connect(e);e.connect(g);s.start(t,off,dur+.02);(g._src||(g._src=[])).push(s);if(g._src.length>8)g._src.shift();},
  fail(e){console.warn('BGM',e);BGM.ready=false;BGM.cur=null;BGM.mood=null;const el=document.getElementById('oSrc');if(el)el.textContent='内蔵シンセ';if(MUS.want){const w=MUS.want;MUS.mood='none';MUS.pending=w;}},
  play(m){try{BGM.play0(m);}catch(e){BGM.fail(e);}},
  play0(m){if(!BGM.ready||BGM.mood===m)return;BGM.mood=m;BGM.start(m,MUS.wantT);},
  // late：場面が求められた時刻。読み込み待ちで遅れて始まるときは、その分だけ先から鳴らす（出撃カットの離陸に主題を合わせるため）
  start(m,late){const ctx=AU.ctx,t=ctx.currentTime+.05;if(BGM.cur&&!BGM.cur.chain&&BGM.cur.c===CUES[m])return;
    {const k=BGM.cur,n=CUES[m];if(k&&n&&!k.chain&&k.c.loop&&n.loop&&k.c!==n&&k.c.loop[0]===n.loop[0]&&k.c.loop[1]===n.loop[1]&&k.t0!==undefined&&ctx.currentTime>=k.t0+(k.c.loop[0]-k.c.start)-1&&m!=='intro')return;}
    // 消滅の曲が鳴っている間に帰投へ移るときは、鳴り終わってから主題へつなぐ（途中で切らない）
    if(m==='return'&&BGM.cur&&BGM.cur.chain){BGM.cur.chain='return';return;}
    if(BGM.cur){const g=BGM.cur.g;g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(g.gain.value,t);const fd=m==='victory'?.22:1.1;g.gain.linearRampToValueAtTime(0,t+fd);for(const s of g._src||[]){try{s.stop(t+fd+.05);}catch(e){}}setTimeout(()=>{try{g.disconnect();}catch(e){}},(fd+.6)*1000);BGM.cur=null;}
    const c=CUES[m];if(!c)return;
    const g=ctx.createGain();g.gain.value=c.vol||1;g.connect(AU.mus);const xf=c.xf||.12;
    if(c.once){const d=c.once[1]-c.once[0];BGM.node(g,t,c.once[0],d,.25,.6);BGM.cur={g,c,next:t+d-1.2,chain:c.next};return;}
    let st=c.start;if(m==='intro'&&late!==undefined){const dl=ctx.currentTime-late;if(dl>.15&&dl<20)st=Math.min(c.start+dl,c.loop[1]-2);}
    const b=c.loop[1],d=b-st;
    if(d>xf+.5){BGM.node(g,t,st,d+xf,.4,xf);BGM.cur={g,c,next:t+d,xf,t0:t-(st-c.start)};}
    else BGM.cur={g,c,next:t,xf};
  },
  tick(){try{BGM.tick0();}catch(e){BGM.fail(e);}},
  tick0(){const k=BGM.cur;if(!k||!AU.ctx||AU.ctx.state!=='running')return;const now=AU.ctx.currentTime;
    if(k.chain){if(now>k.next){const n=k.chain;BGM.start(n);}return;}
    if(k.next<now-.3)k.next=now+.05;
    while(k.next<now+4){const[a,b]=k.c.loop;BGM.node(k.g,k.next,a,(b-a)+k.xf,k.xf,k.xf);k.next+=b-a;}
  }};
function pad(notes,t,dur,vol,bright){
  const ctx=AU.ctx,g=ctx.createGain(),f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(bright*.5,t);f.frequency.linearRampToValueAtTime(bright,t+dur*.5);f.frequency.linearRampToValueAtTime(bright*.6,t+dur);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+Math.min(.5,dur*.3));g.gain.setValueAtTime(vol,t+dur*.8);g.gain.linearRampToValueAtTime(0,t+dur+.7);
  notes.forEach(n=>{for(const d of[-7,7]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=mtof(n);o.detune.value=d;o.connect(f);o.start(t);o.stop(t+dur+.8);}});
  f.connect(g);g.connect(AU.mus);const r=ctx.createGain();r.gain.value=.5;g.connect(r);r.connect(AU.rev);
}
function brass(n,t,dur,vol){
  const ctx=AU.ctx,g=ctx.createGain(),f=ctx.createBiquadFilter();f.type='lowpass';f.Q.value=.7;
  const top=900+vol*9000+Math.min(900,n*9);f.frequency.setValueAtTime(300,t);f.frequency.linearRampToValueAtTime(top,t+.06);f.frequency.exponentialRampToValueAtTime(Math.max(500,top*.55),t+Math.max(.12,dur));
  const at=Math.min(.05,dur*.25);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+at);g.gain.linearRampToValueAtTime(vol*.82,t+at+.08);g.gain.setValueAtTime(vol*.78,t+Math.max(at+.09,dur*.8));g.gain.linearRampToValueAtTime(0,t+dur+.09);
  let vib=null;if(dur>.5){vib=ctx.createOscillator();vib.frequency.value=5.2;const vg=ctx.createGain();vg.gain.setValueAtTime(0,t);vg.gain.setValueAtTime(0,t+.28);vg.gain.linearRampToValueAtTime(9,t+.6);vib.connect(vg);vib._g=vg;vib.start(t);vib.stop(t+dur+.2);}
  for(const[d,ty,lv]of[[-5,'sawtooth',.5],[5,'sawtooth',.5],[0,'triangle',.35]]){const o=ctx.createOscillator();o.type=ty;o.frequency.value=mtof(n);o.detune.value=d;if(vib)vib._g.connect(o.detune);const og=ctx.createGain();og.gain.value=lv;o.connect(og);og.connect(f);o.start(t);o.stop(t+dur+.2);}
  f.connect(g);g.connect(AU.mus);const r=ctx.createGain();r.gain.value=.45;g.connect(r);r.connect(AU.rev);
}
// 和音を、響きの落ち着く中音域（E3〜E4）へ寄せて並べ直す。進行しても各声部が大きく跳ばない
const voice=c=>c.map(n=>{while(n<52)n+=12;while(n>=64)n-=12;return n;}).sort((x,y)=>x-y);
// ニ短調の音階（和音が A のときだけ導音 C# を使う）の上で、根音から k 段上の音
const SCALE=[2,4,5,7,9,10,0];
function deg(root,k,lead){const pc=((root%12)+12)%12;let i=SCALE.indexOf(pc);if(i<0)i=0;let n=root,j=i;for(let s=0;s<k;s++){const a0=SCALE[j%7],b0=SCALE[(j+1)%7];n+=((b0-a0)+12)%12||12;j++;}if(lead&&((n%12)+12)%12===0)n+=1;return n;}
const strg=(n,t,dur,vol)=>tone(AU.mus,'sawtooth',mtof(n),mtof(n),t,dur,vol,.014,{lp:1500+vol*9000,lp2:600,rev:.3});
const bassN=(n,t,dur,vol)=>{tone(AU.mus,'sawtooth',mtof(n),mtof(n),t,dur,vol,.008,{lp:420,lp2:160});tone(AU.mus,'sine',mtof(n-12),mtof(n-12),t,dur,vol*.9,.008);};
const bell=(n,t,vol)=>{tone(AU.mus,'sine',mtof(n),mtof(n),t,2.4,vol,.004,{rev:.9});tone(AU.mus,'sine',mtof(n)*2.76,mtof(n)*2.76,t,1.1,vol*.25,.004,{rev:.9});};
const kick=(t,v)=>{tone(AU.mus,'sine',150,42,t,.3,v,.003);burst(AU.mus,t,.03,v*.3,'lowpass',2000,2000,.5);};
const taiko=(t,v)=>{tone(AU.mus,'sine',110,48,t,.7,v,.003,{rev:.5});burst(AU.mus,t,.12,v*.5,'lowpass',700,200,.7,.4);};
const snare=(t,v)=>{burst(AU.mus,t,.17,v,'bandpass',1900,1500,.8,.25);tone(AU.mus,'triangle',210,150,t,.1,v*.5,.002);};
const hat=(t,v)=>burst(AU.mus,t,.045,v,'highpass',7500,7500,.5);
const cymbal=(t,v)=>burst(AU.mus,t,2.6,v,'highpass',5200,3800,.4,.6,.02);
const CH={Dm:[50,53,57],Bb:[46,50,53],C:[48,52,55],F:[53,57,60],Gm:[43,46,50],A:[45,49,52],D:[50,54,57],Am:[45,48,52],Bm:[47,50,54],G:[43,47,50],
  Dm9:[50,57,60,64,65],Bbmaj7:[46,53,57,62],Gm9:[43,50,53,57,58],A7s:[45,52,55,62],Ds2:[50,52,57,62],Fadd9:[53,55,60,65],C6:[48,52,55,57]};
const THEME=[[0,74,6],[6,76,2],[8,77,8],[16,81,10],[26,79,2],[28,77,4],[32,74,6],[38,77,2],[40,82,8],[48,79,8],[56,76,8],
  [64,74,6],[70,76,2],[72,77,8],[80,84,10],[90,81,2],[92,77,4],[96,82,8],[104,79,8],[112,81,12],[124,85,4]];
const VTHEME=[[0,74,4],[4,78,4],[8,81,8],[16,85,6],[22,83,2],[24,81,8],[32,86,8],[40,83,8],[48,83,6],[54,81,2],[56,79,8],
  [64,78,4],[68,81,4],[72,86,8],[80,88,8],[88,85,8],[96,86,6],[102,83,2],[104,79,8],[112,81,16]];
const MOODS={
  none:{bpm:60,bars:1,step(){}},
  // タイトル：ゆったりした和音の上に、8 小節で問いと答えになる旋律。鐘は決まった分散和音だけ
  title:{bpm:76,bars:8,ch:['Dm9','Bbmaj7','Gm9','A7s'],mel:[[0,74,12],[12,76,4],[16,77,16],[32,74,12],[44,77,4],[48,81,14],[64,77,12],[76,76,4],[80,74,14],[96,72,8],[104,70,8],[112,69,14]],
   step(s,t,sp){const bar=(s>>4)%8,st=s%16,c=CH[this.ch[bar%4]],v=voice(c);
    if(st===0){pad(v,t,sp*16,.05,1100);tone(AU.mus,'sine',mtof(c[0]-12),mtof(c[0]-12),t,sp*15,.15,.3);}
    if(st===6)bell(v[1]+12,t,.035);if(st===10)bell(v[2]+12,t,.03);if(st===14&&bar%2===1)bell(v[v.length-1]+12,t,.028);
    const gi=bar*16+st;for(const[a0,n,l]of this.mel)if(a0===gi)tone(AU.mus,'triangle',mtof(n),mtof(n),t,sp*l*1.05,.065,.06,{lp:1700,rev:.8});
  }},
  launch:{bpm:132,bars:8,ch:['Dm','Dm','Bb','C','Dm','F','Gm','A'],step(s,t,sp){const bar=(s>>4)%8,st=s%16,c=CH[this.ch[bar]],v=voice(c);
    if(st===0)pad(v.map(n=>n+12),t,sp*16,.032,1500);
    if(st%2===0)bassN(c[0]-12,t,sp*1.6,st%8===0?.2:.12);
    strg(v[[0,2,1,2][st%4]]+12,t,sp*.9,st%4===0?.048:.03);
    if(st===0||st===6||st===10)kick(t,.5);if(st===4||st===12)snare(t,.2);if(st%2===0)hat(t,st%4===0?.035:.022);
    if(bar===7&&st>=8)taiko(t,.12+(st-8)*.045);
    if(bar===0&&st===0)cymbal(t,.07);
    const gi=bar*16+st;for(const[a0,n,l]of THEME)if(a0===gi)brass(n-12,t,sp*l*.95,.085);
  }},
  // 嵐：音をぶつけて濁らせるのをやめ、ニ短調の音階の中で「低い呼びかけ → 半音上の隣の音で揺れる答え → 駆け上がり」を 4 小節ごとに繰り返す
  storm:{bpm:166,bars:8,ch:['Dm','Dm','Bb','Bb','Gm','Gm','A','A'],step(s,t,sp){const bar=(s>>4)%8,st=s%16,c=CH[this.ch[bar]],v=voice(c),I=MUS.intensity,ld=this.ch[bar]==='A',r0=c[0];
    if(st===0){pad([r0-12,r0-5,v[0],v[1]],t,sp*16,.05,800+I*450);tone(AU.mus,'sawtooth',mtof(r0-24),mtof(r0-24),t,sp*15,.15,.05,{lp:150});}
    bassN(r0-12,t,sp*.75,[.24,.09,.12,.19,.09,.12,.21,.09,.24,.09,.12,.19,.09,.19,.12,.15][st]);
    // 刻み続ける弦（和音の音だけ。強拍を少し強く）
    strg(v[[0,2,1,2][st%4]]+12,t,sp*.7,st%4===0?.062:.038);
    if(I>=1)strg(v[[2,0,1,0][st%4]]+24,t,sp*.5,st%4===0?.026:.018);
    // 太鼓
    if([1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0][st])taiko(t,st===0?.6:.4);
    if(st===4||st===12)snare(t,.28);
    hat(t,st%4===2?.045:st%2?.016:.03);
    if(bar%2===1&&st>=12)taiko(t,.3+(st-12)*.1);
    if(bar%4===0&&st===0)cymbal(t,.1);
    // 低い金管：呼びかけ（根音 → 3 度）と答え（5 度 → 6 度 → 5 度）
    const B=(k,len,vol,oct)=>{const n=deg(r0,k,ld)+(oct||0);brass(n-12,t,sp*len,vol);if(I>=2)brass(n,t,sp*len,vol*.5);};
    if(bar%4===0){if(st===0)B(0,7,.12);if(st===8)B(2,7,.11);}
    else if(bar%4===1){if(st===0)B(4,5.5,.12);if(st===6)B(5,1.8,.1);if(st===8)B(4,7,.11);}
    else if(bar%4===2){if(st===0)B(0,7,.12);if(st===8)B(4,7,.11);}
    else{if(st===0)B(2,7,.11);if(st>=8&&st%2===0)B([0,2,4,7][(st-8)>>1],1.8,.1+(st-8)*.004);}
    if(I>=2){
      if(st%4===2)kick(t,.45);
      if(bar%4===2&&st===0)tone(AU.mus,'sawtooth',260,980,t,sp*30,.045,sp*14,{lp:2600,rev:.6});
    }
  }},
  // 台風の目：低い持続音と開いた和音。タイトルの旋律の頭だけが、高い所で 2 回に 1 回こだまする
  eye:{bpm:66,bars:8,ch:['Ds2','Bbmaj7','Gm9','A7s'],step(s,t,sp){const bar=(s>>4)%8,st=s%16,c=CH[this.ch[bar%4]],v=voice(c);
    if(st===0)tone(AU.mus,'sawtooth',mtof(26),mtof(26),t,sp*16,.11,1.5,{lp:120});if(st===8&&bar%4===3)taiko(t,.22);
    if(st===0){pad(v.map(n=>n+12),t,sp*16,.042,1400);tone(AU.mus,'sine',mtof(c[0]-12),mtof(c[0]-12),t,sp*15,.12,.5);}
    if(st===4)bell(v[0]+24,t,.04);if(st===10)bell(v[2]+24,t,.034);if(st===14&&bar%2===0)bell(v[1]+24,t,.028);
    if(bar===0&&st===0)for(const[a0,n,l]of[[0,74,12],[12,76,4],[16,77,14]])tone(AU.mus,'sine',mtof(n+12),mtof(n+12),t+a0*sp,sp*l,.032,.2,{rev:.9});
    if(bar===4&&st===0)for(const[a0,n,l]of[[0,77,12],[12,76,4],[16,74,14]])tone(AU.mus,'sine',mtof(n+12),mtof(n+12),t+a0*sp,sp*l,.028,.2,{rev:.9});
  }},
  climax:{bpm:160,bars:8,ch:['Dm','Dm','Bb','C','Dm','F','Gm','A'],tr:2,step(s,t,sp){const bar=(s>>4)%8,st=s%16,c=CH[this.ch[bar]].map(n=>n+2),v=voice(c);
    if(st===0)pad(v.map(n=>n+12),t,sp*16,.033,1900);
    if(st%2===0)bassN(c[0]-12,t,sp*1.5,st%8===0?.21:.17);
    strg(v[[0,2,1,2][st%4]]+12,t,sp*.85,st%4===0?.05:.036);strg(v[[2,1,0,1][st%4]]+24,t,sp*.6,.017);
    if(st%4===0)kick(t,.55);if(st===4||st===12)snare(t,.26);hat(t,st%4===2?.04:st%2?.015:.028);
    if(st===3||st===11||st===14)taiko(t,.3);
    if(bar===0&&st===0)cymbal(t,.08);
    const gi=bar*16+st;for(const[a0,n,l]of THEME)if(a0===gi){brass(n-10,t,sp*l*.95,.085);brass(n-22,t,sp*l*.95,.04);}
  }},
  victory:{bpm:104,bars:8,ch:['D','A','Bm','G','D','A','G','A'],step(s,t,sp){const bar=(s>>4)%8,st=s%16,c=CH[this.ch[bar]],v=voice(c);
    if(st===0){pad(v.map(n=>n+12),t,sp*16,.048,2000);bassN(c[0]-12,t,sp*7,.2);taiko(t,.34);}
    if(st===8){bassN(c[0]-12,t,sp*7,.14);}
    if(st===14&&bar%2===1)taiko(t,.2);
    if(st%2===0)strg(v[[0,1,2,1,0,2,1,2][st>>1]]+24,t,sp*1.8,st%8===0?.028:.02);
    if(bar%4===0&&st===0)cymbal(t,.085);
    if(st===8&&bar%2===0)bell(v[2]+24,t,.026);
    const g=bar*16+st;for(const[a,n,l]of VTHEME)if(a===g){brass(n-12,t,sp*l*.96,.09);brass(n-24,t,sp*l*.96,.035);}
  }},
};
function musTick(){
  const ctx=AU.ctx;if(!ctx||ctx.state!=='running')return;
  if(MUS.tNext<ctx.currentTime-.5)MUS.tNext=ctx.currentTime+.05;
  let guard=0;const ahead=document.hidden?1.7:.3;
  while(MUS.tNext<ctx.currentTime+ahead&&guard++<48){
    if(MUS.pending&&(MUS.step%16===0||MUS.mood==='none'||MUS.pending==='none'||MOODS[MUS.mood].bpm<90)){MUS.mood=MUS.pending;MUS.pending=null;MUS.step=0;}
    const m=MOODS[MUS.mood],sp=60/m.bpm/4;
    try{m.step(MUS.step,MUS.tNext,sp);}catch(e){}
    MUS.tNext+=sp;MUS.step++;
  }
}
MOODS.intro=MOODS.title;MOODS.return=MOODS.victory; // 出撃カット（内蔵シンセではタイトルと同じ曲）

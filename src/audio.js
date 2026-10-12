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
  // エンジン（出口でまとめて、距離と左右を付ける）
  {const bus=AU.engBus=ctx.createGain();if(ctx.createStereoPanner){AU.engPan=ctx.createStereoPanner();bus.connect(AU.engPan);AU.engPan.connect(AU.sfx);}else bus.connect(AU.sfx);
    const g=ctx.createGain();g.gain.value=0;const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=600;
    const o1=ctx.createOscillator(),o2=ctx.createOscillator(),o3=ctx.createOscillator();o1.type='sawtooth';o2.type='sawtooth';o3.type='triangle';
    o1.frequency.value=70;o2.frequency.value=70.9;o3.frequency.value=141;
    const og=ctx.createGain();og.gain.value=.085;[o1,o2,o3].forEach(o=>{o.connect(og);o.start();});og.connect(f);
    const n=loopNoise(),nf=ctx.createBiquadFilter();nf.type='bandpass';nf.frequency.value=1400;nf.Q.value=.6;const ng=ctx.createGain();ng.gain.value=.5;n.connect(nf);nf.connect(ng);ng.connect(g);
    f.connect(g);g.connect(bus);
    // タービンの高い唸りと、腹に響く低音
    const wh=ctx.createOscillator();wh.type='sine';wh.frequency.value=1800;const wh2=ctx.createOscillator();wh2.type='triangle';wh2.frequency.value=2710;
    const whg=ctx.createGain();whg.gain.value=0;wh.connect(whg);wh2.connect(whg);whg.connect(bus);wh.start();wh2.start();
    const rn=loopNoise(),rf=ctx.createBiquadFilter();rf.type='lowpass';rf.frequency.value=85;const rg2=ctx.createGain();rg2.gain.value=0;rn.connect(rf);rf.connect(rg2);rg2.connect(bus);
    AU.eng={g,f,o:[o1,o2,o3],nf,wh,wh2,whg,rg2};}
  // アフターバーナーの轟音
  {const n=loopNoise(),f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=650;const ws=ctx.createWaveShaper();const cv=new Float32Array(256);for(let i=0;i<256;i++){const x=i/128-1;cv[i]=Math.tanh(x*5);}ws.curve=cv;
    const g=ctx.createGain();g.gain.value=0;n.connect(f);f.connect(ws);ws.connect(g);g.connect(AU.engBus);AU.roar={g,f};}
  // 僚機のエンジン（近くを通るときに聞こえる）
  {const bus=ctx.createGain();bus.gain.value=0;let pan=null;if(ctx.createStereoPanner){pan=ctx.createStereoPanner();bus.connect(pan);pan.connect(AU.sfx);}else bus.connect(AU.sfx);
    const n=loopNoise(),nf=ctx.createBiquadFilter();nf.type='bandpass';nf.frequency.value=900;nf.Q.value=.5;const ng=ctx.createGain();ng.gain.value=.5;n.connect(nf);nf.connect(ng);ng.connect(bus);
    const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=84;const of=ctx.createBiquadFilter();of.type='lowpass';of.frequency.value=520;const og=ctx.createGain();og.gain.value=.1;o.connect(of);of.connect(og);og.connect(bus);o.start();
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
  setVolumes();setTimeout(buildThunderPool,300);
  MUS.tNext=ctx.currentTime+.1;
  if(!AU.timer)AU.timer=setInterval(()=>{musTick();BGM.tick();},40);
  if(BGM.buf){BGM.ready=true;if(MUS.want){const w=MUS.want;MUS.pending='none';BGM.play(w);}}else BGM.load();
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
  v.o.frequency.setTargetAtTime((64+power*30)*sp.dop,t,.06);v.w.frequency.setTargetAtTime((1500+power*1100)*sp.dop,t,.06);v.nf.frequency.setTargetAtTime((700+power*500)*sp.dop*sp.muf,t,.06);}
function setLoops(engine,boost,wind,rain,sp){
  if(!AU.ctx)return;const t=AU.ctx.currentTime,e=AU.eng;sp=sp||{prox:1,pan:0,dop:1,muf:1};
  AU.engBus.gain.setTargetAtTime(sp.prox,t,.06);if(AU.engPan)AU.engPan.pan.setTargetAtTime(sp.pan,t,.06);
  e.g.gain.setTargetAtTime(engine*(.16+boost*.14),t,.12);
  const f=(62+engine*26+boost*34)*sp.dop;e.o[0].frequency.setTargetAtTime(f,t,.15);e.o[1].frequency.setTargetAtTime(f*1.013,t,.15);e.o[2].frequency.setTargetAtTime(f*2.01,t,.15);
  e.f.frequency.setTargetAtTime((420+engine*500+boost*900)*sp.muf,t,.15);e.nf.frequency.setTargetAtTime((1100+boost*1500)*sp.dop*sp.muf,t,.15);
  e.whg.gain.setTargetAtTime(engine*(.012+boost*.02),t,.2);e.wh.frequency.setTargetAtTime((1500+engine*900+boost*1300)*sp.dop,t,.1);e.wh2.frequency.setTargetAtTime((1500+engine*900+boost*1300)*1.506*sp.dop,t,.1);
  e.rg2.gain.setTargetAtTime(engine*.5+boost*.4,t,.2);AU.roar.g.gain.setTargetAtTime(boost*.2,t,.12);AU.roar.f.frequency.setTargetAtTime(500+boost*500,t,.2);
  AU.wind.g.gain.setTargetAtTime(.04*engine+wind*.85,t,.3);AU.wind.f.frequency.setTargetAtTime(340+wind*520,t,.4);
  AU.rain.g.gain.setTargetAtTime(rain*.2,t,.3);AU.rain2.g.gain.setTargetAtTime(rain*.24,t,.3);
  AU.wind2.g.gain.setTargetAtTime(wind*wind*.55,t,.5);AU.rumble.g.gain.setTargetAtTime(wind*1.5+rain*.7,t,.5);
}
function setAlarm(on){
  if(!AU.ctx||AU.alarm.on===on)return;AU.alarm.on=on;const t=AU.ctx.currentTime,g=AU.alarm.g.gain;g.cancelScheduledValues(t);
  if(on){for(let i=0;i<40;i++){g.setValueAtTime(.05,t+i*.36);g.setValueAtTime(0,t+i*.36+.16);AU.alarm.o.frequency.setValueAtTime(i%2?740:980,t+i*.36);}}
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
  rip(){if(!AU.ctx)return;const t=AU.ctx.currentTime;burst(AU.sfx,t,.35,.8,'bandpass',1400,3800,2.2,.3);burst(AU.sfx,t+.04,.5,.5,'highpass',3000,5200,.8,.3);tone(AU.sfx,'square',440,95,t,.28,.16,.003,{lp:2400});tone(AU.sfx,'sine',150,50,t,.3,.5,.003);for(let i=0;i<4;i++)tone(AU.sfx,'triangle',1800+Math.random()*2200,900,t+.1+i*.07,.12,.06,.002,{rev:.4});},
  spark(){if(!AU.ctx)return;const t=AU.ctx.currentTime;for(let i=0;i<3;i++)burst(AU.sfx,t+i*.04,.035,.18,'highpass',4200,6000,1);},
  radioEnd(){if(!AU.ctx)return;const t=AU.ctx.currentTime;burst(AU.sfx,t,.11,.1,'bandpass',1900,2700,4);},
  charge(d){if(!AU.ctx)return;const t=AU.ctx.currentTime,v=sat(1-d/900)*.5+.08;tone(AU.sfx,'sawtooth',180,1900,t,2.05,.045*v*2,1.6,{lp:5000,rev:.3});for(let i=0;i<9;i++)burst(AU.sfx,t+.4+i*.19-i*i*.004,.03,.12*v,'highpass',5000,7000,1);},
  gate(){if(!AU.ctx)return;const t=AU.ctx.currentTime;burst(AU.sfx,t,.55,.4,'bandpass',400,2600,1.6,.3,.08);},
  hum(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'sawtooth',50,50,t,7,.09,1,{lp:240});tone(AU.sfx,'sine',100,100,t,7,.06,1);for(const d of[.9,1.15,1.4])burst(AU.sfx,t+d,.06,.3,'bandpass',2400,1200,5,.5);tone(AU.sfx,'sine',38,38,t+1.5,.6,.5,.01);},
  klaxon(){if(!AU.ctx)return;const t=AU.ctx.currentTime;for(let i=0;i<4;i++){tone(AU.sfx,'sawtooth',370,470,t+i*.9,.6,.09,.03,{lp:1500,rev:.6});tone(AU.sfx,'square',185,235,t+i*.9,.6,.05,.03,{lp:900,rev:.6});}},
  door(){if(!AU.ctx)return;const t=AU.ctx.currentTime+.8;burst(AU.sfx,t,5.2,.55,'lowpass',170,120,1.2,.5,.5);tone(AU.sfx,'sawtooth',44,52,t,5.2,.14,.4,{lp:200});for(let i=0;i<10;i++)burst(AU.sfx,t+i*.5,.05,.12,'bandpass',1700,900,6,.4);burst(AU.sfx,t+5.1,.5,.9,'lowpass',900,120,.8,.7);tone(AU.sfx,'sine',70,34,t+5.1,.6,.8,.004);},
  spool(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'sawtooth',40,260,t,6,.16,2,{lp:1300,rev:.3});tone(AU.sfx,'sine',300,3400,t,6.5,.05,3,{rev:.3});burst(AU.sfx,t+1,6,.3,'bandpass',300,2400,1,.3,3);burst(AU.sfx,t+.1,.25,.5,'lowpass',700,150,1,.3);},
  hit(){if(!AU.ctx)return;const t=AU.ctx.currentTime;burst(AU.sfx,t,.12,.7,'highpass',2200,900,.7,.3);for(let i=0;i<5;i++)burst(AU.sfx,t+.08+i*.06,.05,.2,'bandpass',700+Math.random()*900,400,6);burst(AU.sfx,t,.45,.9,'lowpass',1800,160,.7,.3);tone(AU.sfx,'sine',120,38,t,.5,.8,.004);tone(AU.sfx,'square',310,90,t,.25,.12,.004,{lp:1400});},
  zap(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'sine',60,28,t,1.1,.9,.003);burst(AU.sfx,t,.9,.7,'lowpass',2600,120,.6,.6);burst(AU.sfx,t,.3,.7,'bandpass',3200,600,2.5,.2);for(let i=0;i<5;i++)tone(AU.sfx,'sawtooth',900+Math.random()*1800,200,t+i*.035,.06,.1,.002,{lp:5000});},
  splash(){if(!AU.ctx)return;const t=AU.ctx.currentTime;burst(AU.sfx,t,.25,.8,'lowpass',500,90,.8,.3);burst(AU.sfx,t+.1,1.4,.4,'highpass',2600,4800,.6,.4,.2);burst(AU.sfx,t,.9,.8,'bandpass',900,300,.6,.4,.02);},
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
  launch(){if(!AU.ctx)return;const t=AU.ctx.currentTime;burst(AU.sfx,t,.09,.9,'bandpass',900,300,5,.3);tone(AU.sfx,'square',95,60,t,.12,.3,.002,{lp:700});burst(AU.sfx,t+.08,2.6,.5,'lowpass',1400,160,.7,.6,.1);burst(AU.sfx,t,1.6,.8,'bandpass',300,4200,1,.5,.02);tone(AU.sfx,'sawtooth',110,880,t,1.2,.2,.02,{lp:2400,rev:.4});tone(AU.sfx,'sine',70,40,t,.5,.7,.004);},
  boom(){if(!AU.ctx)return;const t=AU.ctx.currentTime;burst(AU.sfx,t,3.2,1,'lowpass',2200,60,.6,.8);tone(AU.sfx,'sine',90,24,t,2.4,1,.005);burst(AU.sfx,t,.3,.8,'highpass',1800,600,.5,.5);},
  implode(){if(!AU.ctx)return;const t=AU.ctx.currentTime;
    burst(AU.sfx,t,2.2,.6,'bandpass',200,5200,1.5,.6,1.8);tone(AU.sfx,'sine',40,160,t,2.2,.5,1.8);
    burst(AU.sfx,t+2.2,5,1,'lowpass',3000,50,.5,.9);tone(AU.sfx,'sine',110,22,t+2.2,4,1,.005);
    [62,69,74,78,81,86].forEach((m,i)=>tone(AU.sfx,'sine',mtof(m+12),mtof(m+12),t+2.3+i*.09,5,.07,.02,{rev:.9}));},
  stall(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'sawtooth',180,45,t,1.3,.25,.01,{lp:900});},
  restart(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'sawtooth',50,170,t,1.1,.25,.05,{lp:1200});burst(AU.sfx,t+.5,.8,.3,'bandpass',600,2600,1,.2,.2);},
  touch(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(AU.sfx,'sawtooth',1400,700,t,.22,.12,.004,{lp:3000});burst(AU.sfx,t+.1,5,.35,'lowpass',260,90,1,.3,.1);burst(AU.sfx,t,.5,.5,'bandpass',1800,700,3,.2);tone(AU.sfx,'sine',80,45,t,.3,.5,.004);},
};

// ───────────────────────── 音楽 ─────────────────────────
const MUS={mood:'none',pending:null,step:0,tNext:0,intensity:0};
function setMood(m){MUS.want=m;if(m==='victory'&&!BGM.ready&&MUS.mood!==m){MUS.mood=m;MUS.step=0;MUS.pending=null;return;}if(BGM.ready){BGM.play(m);if(MUS.mood!=='none')MUS.pending='none';return;}if(MUS.mood!==m)MUS.pending=m;}
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
const BGM={ready:false,buf:null,cur:null,mood:null,
  load(){if(/[?&]synth/.test(location.search))return;fetch('bgm/cues.json').then(r=>r.ok?r.json():null).catch(()=>null).then(j=>{if(j)for(const k in j)if(k[0]!=='_'&&j[k]&&(j[k].loop||j[k].once))CUES[k]=j[k];return fetch('bgm/src/storm_rider.mp3');}).then(r=>r.ok?r.arrayBuffer():Promise.reject()).then(b=>new Promise((ok,ng)=>{const p=AU.ctx.decodeAudioData(b,ok,ng);if(p&&p.catch)p.catch(()=>{});})).then(buf=>{BGM.buf=buf;BGM.ready=true;const el=document.getElementById('oSrc');if(el)el.textContent='手元の音源';if(MUS.want){const w=MUS.want;MUS.pending='none';BGM.play(w);}}).catch(e=>{if(e)console.warn('BGM load',e);});},
  curve(up,n){const c=new Float32Array(n);for(let i=0;i<n;i++){const u=i/(n-1);c[i]=up?Math.sin(u*Math.PI/2):Math.cos(u*Math.PI/2);}return c;},
  node(g,t,off,dur,fin,fout){const ctx=AU.ctx,s=ctx.createBufferSource();s.buffer=BGM.buf;const e=ctx.createGain();
    const N=8,G=e.gain;
    if(fin>0){G.setValueAtTime(0,t);for(let i=1;i<=N;i++)G.linearRampToValueAtTime(Math.sin(i/N*Math.PI/2),t+fin*i/N);}else G.setValueAtTime(1,t);
    if(fout>0){const t1=Math.max(t+dur-fout,t+fin+.001);G.setValueAtTime(1,t1);for(let i=1;i<=N;i++)G.linearRampToValueAtTime(Math.cos(i/N*Math.PI/2),t1+fout*i/N);}
    s.connect(e);e.connect(g);s.start(t,off,dur+.02);},
  fail(e){console.warn('BGM',e);BGM.ready=false;BGM.cur=null;BGM.mood=null;const el=document.getElementById('oSrc');if(el)el.textContent='内蔵シンセ';if(MUS.want){const w=MUS.want;MUS.mood='none';MUS.pending=w;}},
  play(m){try{BGM.play0(m);}catch(e){BGM.fail(e);}},
  play0(m){if(!BGM.ready||BGM.mood===m)return;const ctx=AU.ctx,t=ctx.currentTime+.05;BGM.mood=m;if(BGM.cur&&!BGM.cur.chain&&BGM.cur.c===CUES[m])return;
    {const k=BGM.cur,n=CUES[m];if(k&&n&&!k.chain&&k.c.loop&&n.loop&&k.c!==n&&k.c.loop[0]===n.loop[0]&&k.c.loop[1]===n.loop[1]&&k.t0!==undefined&&ctx.currentTime>=k.t0+(k.c.loop[0]-k.c.start)-1&&m!=='intro')return;}
    if(BGM.cur){const g=BGM.cur.g;g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(g.gain.value,t);g.gain.linearRampToValueAtTime(0,t+(m==='victory'?.22:1.1));setTimeout(()=>g.disconnect(),1600);BGM.cur=null;}
    const c=CUES[m];if(!c)return;
    const g=ctx.createGain();g.gain.value=c.vol||1;g.connect(AU.mus);const xf=c.xf||.12;
    if(c.once){const d=c.once[1]-c.once[0];BGM.node(g,t,c.once[0],d,.25,.6);BGM.cur={g,c,next:t+d-1.2,chain:c.next};return;}
    const b=c.loop[1],d=b-c.start;
    if(d>xf+.5){BGM.node(g,t,c.start,d+xf,.4,xf);BGM.cur={g,c,next:t+d,xf,t0:t};}
    else BGM.cur={g,c,next:t,xf};
  },
  tick(){try{BGM.tick0();}catch(e){BGM.fail(e);}},
  tick0(){const k=BGM.cur;if(!k||!AU.ctx||AU.ctx.state!=='running')return;const now=AU.ctx.currentTime;
    if(k.chain){if(now>k.next){const n=k.chain;BGM.mood=null;BGM.play(n);}return;}
    if(k.next<now-.3)k.next=now+.05;
    while(k.next<now+.7){const[a,b]=k.c.loop;BGM.node(k.g,k.next,a,(b-a)+k.xf,k.xf,k.xf);k.next+=b-a;}
  }};
function pad(notes,t,dur,vol,bright){
  const ctx=AU.ctx,g=ctx.createGain(),f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(bright*.5,t);f.frequency.linearRampToValueAtTime(bright,t+dur*.5);f.frequency.linearRampToValueAtTime(bright*.6,t+dur);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+Math.min(.5,dur*.3));g.gain.setValueAtTime(vol,t+dur*.8);g.gain.linearRampToValueAtTime(0,t+dur+.7);
  notes.forEach(n=>{for(const d of[-7,7]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=mtof(n);o.detune.value=d;o.connect(f);o.start(t);o.stop(t+dur+.8);}});
  f.connect(g);g.connect(AU.mus);const r=ctx.createGain();r.gain.value=.5;g.connect(r);r.connect(AU.rev);
}
function brass(n,t,dur,vol){
  const ctx=AU.ctx,g=ctx.createGain(),f=ctx.createBiquadFilter();f.type='lowpass';f.Q.value=1.2;
  f.frequency.setValueAtTime(350,t);f.frequency.linearRampToValueAtTime(2300,t+.07);f.frequency.exponentialRampToValueAtTime(1100,t+dur);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.045);g.gain.setValueAtTime(vol*.8,t+dur*.75);g.gain.linearRampToValueAtTime(0,t+dur+.12);
  for(const[d,ty]of[[-6,'sawtooth'],[6,'sawtooth'],[0,'square']]){const o=ctx.createOscillator();o.type=ty;o.frequency.value=mtof(n);o.detune.value=d;const og=ctx.createGain();og.gain.value=ty==='square'?.25:.5;o.connect(og);og.connect(f);o.start(t);o.stop(t+dur+.2);}
  f.connect(g);g.connect(AU.mus);const r=ctx.createGain();r.gain.value=.4;g.connect(r);r.connect(AU.rev);
}
const strg=(n,t,dur,vol)=>tone(AU.mus,'sawtooth',mtof(n),mtof(n),t,dur,vol,.012,{lp:2200,lp2:700,rev:.25});
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
  title:{bpm:76,bars:8,ch:['Dm9','Bbmaj7','Gm9','A7s'],step(s,t,sp){const bar=(s>>4)%8,st=s%16,c=CH[this.ch[bar%4]];
    if(st===0){pad(c,t,sp*16,.05,1100);tone(AU.mus,'sine',mtof(c[0]-12),mtof(c[0]-12),t,sp*15,.16,.3);}
    if(st===4||st===10||st===14){if(Math.random()<.7)bell(c[1+Math.floor(Math.random()*(c.length-1))]+24,t,.05);}
    if(bar<4){const g=(bar*16+st);for(const[a,n,l]of[[0,74,12],[12,76,4],[16,77,16],[32,74,12],[44,77,4],[48,81,16]])if(a===g)tone(AU.mus,'triangle',mtof(n),mtof(n),t,sp*l*1.1,.07,.05,{lp:1800,rev:.8});}
  }},
  launch:{bpm:132,bars:8,ch:['Dm','Dm','Bb','C','Dm','F','Gm','A'],step(s,t,sp){const bar=(s>>4)%8,st=s%16,c=CH[this.ch[bar]];
    if(st===0)pad(c.map(n=>n+12),t,sp*16,.035,1500);
    if(st%2===0)bassN(c[0]-12,t,sp*1.6,st%8===0?.2:.13);
    strg(c[[0,2,1,2][st%4]]+12,t,sp*.9,st%4===0?.05:.032);
    if(st===0||st===6||st===10)kick(t,.5);if(st===4||st===12)snare(t,.2);if(st%2===0)hat(t,.035);
    if(bar===7&&st>=8)taiko(t,.12+(st-8)*.045);
    if(bar===0&&st===0)cymbal(t,.07);
    const g=bar*16+st;for(const[a,n,l]of THEME)if(a===g)brass(n-12,t,sp*l*.95,.085);
  }},
  storm:{bpm:166,bars:8,ch:['Dm','Dm','Bb','Bb','Gm','Gm','A','A'],step(s,t,sp){const bar=(s>>4)%8,st=s%16,c=CH[this.ch[bar]],I=MUS.intensity;
    // 低い不協和の持続音と、うなる低音
    if(st===0){pad([c[0]-12,c[0]-5,c[0],c[0]+1],t,sp*16,.055,800+I*500);tone(AU.mus,'sawtooth',mtof(c[0]-24),mtof(c[0]-24),t,sp*15,.16,.05,{lp:160});}
    bassN(c[0]-12,t,sp*.75,[.24,.1,.13,.2,.1,.13,.22,.1,.24,.1,.13,.2,.1,.2,.13,.16][st]);
    // 刻み続ける弦
    strg(c[[0,2,1,2][st%4]]+12,t,sp*.7,st%4===0?.07:.045);
    if(I>=1)strg(c[[2,0,1,0][st%4]]+24+(bar%2&&st>11?1:0),t,sp*.5,.028);
    // 太鼓
    if([1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0][st])taiko(t,st===0?.6:.42);
    if(st===4||st===12)snare(t,.3);
    hat(t,st%2?.025:.05);
    if(bar%2===1&&st>=12)taiko(t,.3+(st-12)*.1);
    if(bar%4===0&&st===0)cymbal(t,.11);
    // 低い金管の脅すような動機
    if(bar%2===0){if(st===0){brass(c[0]-12,t,sp*7,.12);brass(c[0]-5,t,sp*7,.07);}if(st===8){brass(c[0]-11,t,sp*6,.12);brass(c[0]-4,t,sp*6,.06);}}
    else if(bar%4===3&&st>=8&&st%2===0){const up=[0,3,7,10][(st-8)>>1];brass(c[0]+up,t,sp*1.9,.1);brass(c[0]+up-12,t,sp*1.9,.07);}
    else if(st===0){brass(c[0],t,sp*3,.1);brass(c[0]+7,t,sp*3,.07);}else if(st===6){brass(c[0]+1,t,sp*8,.1);}
    if(I>=2){
      if(st%4===2)kick(t,.5);
      if(bar%4===2&&st===0)tone(AU.mus,'sawtooth',260,980,t,sp*30,.05,sp*14,{lp:2600,rev:.6});
      if(st%8===7)brass(c[0]+13,t,sp*.9,.07);
    }
  }},
  eye:{bpm:66,bars:4,ch:['Ds2','Bbmaj7','Gm9','A7s'],step(s,t,sp){const bar=(s>>4)%4,st=s%16,c=CH[this.ch[bar]];
    if(st===0)tone(AU.mus,'sawtooth',mtof(26),mtof(26),t,sp*16,.12,1.5,{lp:120});if(st===8&&bar%2)taiko(t,.25);
    if(st===0){pad(c.map(n=>n+12),t,sp*16,.045,1400);tone(AU.mus,'sine',mtof(c[0]-12),mtof(c[0]-12),t,sp*15,.13,.5);}
    if(st%4===2&&Math.random()<.75)bell(c[Math.floor(Math.random()*c.length)]+24,t,.06);
    if(bar===0&&st===0&&Math.random()<.6)for(const[a,n,l]of[[0,74,12],[12,76,4],[16,77,14]])tone(AU.mus,'sine',mtof(n+12),mtof(n+12),t+a*sp,sp*l,.035,.2,{rev:.9});
  }},
  climax:{bpm:160,bars:8,ch:['Dm','Dm','Bb','C','Dm','F','Gm','A'],tr:2,step(s,t,sp){const bar=(s>>4)%8,st=s%16,c=CH[this.ch[bar]].map(n=>n+2);
    if(st===0)pad(c.map(n=>n+12),t,sp*16,.035,1900);
    if(st%2===0)bassN(c[0]-12,t,sp*1.5,.2);
    strg(c[[0,2,1,2][st%4]]+12,t,sp*.85,.05);strg(c[[2,1,0,1][st%4]]+24,t,sp*.6,.02);
    if(st%4===0)kick(t,.55);if(st===4||st===12)snare(t,.26);hat(t,st%2?.022:.04);
    if(st===3||st===11||st===14)taiko(t,.3);
    if(bar===0&&st===0)cymbal(t,.08);
    const g=bar*16+st;for(const[a,n,l]of THEME)if(a===g){brass(n-10,t,sp*l*.95,.085);brass(n-22,t,sp*l*.95,.04);}
  }},
  victory:{bpm:104,bars:8,ch:['D','A','Bm','G','D','A','G','A'],step(s,t,sp){const bar=(s>>4)%8,st=s%16,c=CH[this.ch[bar]];
    if(st===0){pad(c.map(n=>n+12),t,sp*16,.05,2000);bassN(c[0]-12,t,sp*7,.2);taiko(t,.36);}
    if(st===8){bassN(c[0]-12,t,sp*7,.15);}
    if(st===14&&bar%2===1)taiko(t,.22);
    if(st%2===0)strg(c[[0,1,2,1,0,2,1,2][st>>1]]+24,t,sp*1.8,.026);
    if(bar%4===0&&st===0)cymbal(t,.09);
    if(st%4===0&&Math.random()<.5)bell(c[Math.floor(Math.random()*3)]+36,t,.03);
    const g=bar*16+st;for(const[a,n,l]of VTHEME)if(a===g){brass(n-12,t,sp*l*.96,.09);brass(n-24,t,sp*l*.96,.035);}
  }},
};
function musTick(){
  const ctx=AU.ctx;if(!ctx||ctx.state!=='running')return;
  if(MUS.tNext<ctx.currentTime-.5)MUS.tNext=ctx.currentTime+.05;
  let guard=0;
  while(MUS.tNext<ctx.currentTime+.18&&guard++<16){
    if(MUS.pending&&(MUS.step%16===0||MUS.mood==='none'||MUS.pending==='none'||MOODS[MUS.mood].bpm<90)){MUS.mood=MUS.pending;MUS.pending=null;MUS.step=0;}
    const m=MOODS[MUS.mood],sp=60/m.bpm/4;
    try{m.step(MUS.step,MUS.tNext,sp);}catch(e){}
    MUS.tNext+=sp;MUS.step++;
  }
}
MOODS.intro=MOODS.title; // 出撃カット（内蔵シンセではタイトルと同じ曲）

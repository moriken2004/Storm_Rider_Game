// 予告編の音楽と効果音を合成して WAV に書き出す（既存の楽曲は使わない）：node trailer/audio.mjs
import fs from 'fs';
const SR=44100,DUR=60,N=SR*DUR,L=new Float32Array(N),R=new Float32Array(N),SL=new Float32Array(N),SR_=new Float32Array(N); // SL/SR_：残響へ送る分
let seed=7;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296*2-1;};
const put=(i,l,r,send=0)=>{if(i<0||i>=N)return;L[i]+=l;R[i]+=r;SL[i]+=l*send;SR_[i]+=r*send;};
const midi=n=>440*Math.pow(2,(n-69)/12);
const saw=p=>2*(p-Math.floor(p+.5));
// 音色
function tone(t0,dur,f,amp,{type='sine',a=.01,r=.2,pan=0,send=.2,lp=0,det=0,f1=0}={}){const i0=Math.round(t0*SR),n=Math.round((dur+r)*SR);let ph=0,ph2=0,y=0;
  for(let i=0;i<n;i++){const t=i/SR,ff=f1?f*Math.pow(f1/f,Math.min(1,t/dur)):f;ph+=ff/SR;ph2+=ff*(1+det)/SR;
    let v=type==='sine'?Math.sin(6.2832*ph):type==='saw'?(saw(ph)+saw(ph2))*.5:(saw(ph)>0?1:-1);
    if(lp){const c=1-Math.exp(-6.2832*(typeof lp==='function'?lp(t):lp)/SR);y+=c*(v-y);v=y;}
    const e=Math.min(1,t/a)*(t<dur?1:Math.max(0,1-(t-dur)/r));v*=amp*e;put(i0+i,v*(1-pan)*.7,v*(1+pan)*.7,send);}}
function noise(t0,dur,amp,{lp=8000,hp=0,a=.005,dec=0,pan=0,send=.2,lpf=null}={}){const i0=Math.round(t0*SR),n=Math.round(dur*SR);let y=0,h=0;
  for(let i=0;i<n;i++){const t=i/SR,cut=lpf?lpf(t):lp,c=1-Math.exp(-6.2832*cut/SR);y+=c*(rnd()-y);let v=y;if(hp){const ch=1-Math.exp(-6.2832*hp/SR);h+=ch*(v-h);v-=h;}
    const e=Math.min(1,t/a)*(dec?Math.exp(-t/dec):1)*Math.min(1,(dur-t)/.02);v*=amp*e;put(i0+i,v*(1-pan),v*(1+pan),send);}}
const kick=(t,amp=1)=>{const i0=Math.round(t*SR);let ph=0;for(let i=0;i<SR*.35;i++){const tt=i/SR,f=46+110*Math.exp(-tt*28);ph+=f/SR;const v=Math.sin(6.2832*ph)*Math.exp(-tt*9)*amp;put(i0+i,v,v,.05);}};
const snare=(t,amp=.5)=>{noise(t,.22,amp,{lp:9000,hp:900,dec:.07,send:.35});tone(t,.05,190,amp*.5,{r:.08,f1:140,send:.2});};
const hat=(t,amp=.12,pan=.2)=>noise(t,.05,amp,{lp:14000,hp:7000,dec:.018,pan,send:.1});
const tom=(t,f,amp=.6,pan=0)=>tone(t,.1,f,amp,{r:.35,f1:f*.6,pan,send:.3});
function thunder(t,amp=1,pan=0){noise(t,.25,amp*.9,{lp:5000,hp:300,dec:.06,pan,send:.5});noise(t+.02,4.5,amp*1.1,{lpf:x=>700*Math.exp(-x*.9)+90,dec:1.5,pan,send:.6});
  for(let k=0;k<5;k++)noise(t+.3+k*.37+rnd()*.1,.6,amp*.45*(1-k*.15),{lp:260,dec:.25,pan:pan+rnd()*.4,send:.6});}
function riser(t,dur,amp){noise(t,dur,amp,{lpf:x=>300*Math.pow(40,x/dur),hp:200,a:dur*.8,send:.3});tone(t,dur,110,amp*.35,{type:'saw',f1:880,a:dur*.9,r:.02,det:.01,lp:x=>500+4000*x/dur,send:.3});}
function impact(t,amp=1){tone(t,.2,60,amp,{r:2.4,f1:30,send:.3});noise(t,1.8,amp*.7,{lpf:x=>6000*Math.exp(-x*3)+120,dec:.6,send:.7});}
function pad(t,dur,notes,amp,o={}){for(const n of notes)for(const d of[-.006,.005])tone(t,dur,midi(n),amp/notes.length,{type:'saw',a:o.a||.8,r:o.r||1.2,det:d,lp:o.lp||1400,pan:d*60,send:.5});}
function stab(t,notes,amp,dur=.38){for(const n of notes)tone(t,dur,midi(n),amp/notes.length,{type:'saw',a:.012,r:.25,det:.007,lp:x=>900+5200*Math.exp(-x*7),pan:(n%5-2)*.15,send:.45});}
const bass=(t,n,dur=.2,amp=.42)=>tone(t,dur,midi(n),amp,{type:'saw',a:.006,r:.06,lp:x=>180+900*Math.exp(-x*14),send:.05});
const pluck=(t,n,amp=.11,pan=0)=>tone(t,.07,midi(n),amp,{type:'saw',a:.004,r:.12,lp:x=>1200+5000*Math.exp(-x*25),pan,send:.5});
const B=.5; // 1 拍（120BPM）
// ── 0–8 秒：低い持続音と遠雷
pad(0,8,[38,45,50],.20,{a:2.5,r:1.5,lp:500});tone(0,8,midi(26),.26,{a:2,r:1});
thunder(1.0,.35,-.4);thunder(4.2,.3,.5);for(const[t,n]of[[1.5,74],[3.5,77],[5.2,69]])tone(t,.05,midi(n),.09,{r:1.6,send:.9});
thunder(6.0,.95,0);impact(6.0,.7);
// ── 8–16 秒：高まり（脈打つ低音、弦、最後に上昇音）
pad(8,8,[50,53,57,62],.2,{a:3,r:.4,lp:1800});
for(let i=0;i<32;i++){const t=8+i*.25;bass(t,i%8<6?38:36,.14,.2+i*.008);if(i%2===0&&i>=8)hat(t,.05+i*.002);}
for(let i=0;i<8;i++)tom(8+i,i%2?70:55,.25+i*.04,i%2?.3:-.3);
noise(11,2.2,.22,{lpf:x=>400+2600*x,hp:150,a:.6,dec:1.4,send:.4}); // エンジン始動
riser(13.5,2.5,.42);for(let i=0;i<16;i++)snare(14+i*.125,.12+i*.022);
// ── 16–33 秒：本編（太鼓、低音の反復、金管の和音、弦の刻み）
const prog=[[38,[50,53,57,62]],[34,[46,50,53,58]],[41,[53,57,60,65]],[36,[48,52,55,60]]];
impact(16,.9);
for(let bar=0;bar<8.5;bar++){const t0=16+bar*2,[root,ch]=prog[Math.floor(bar)%4];
  for(let b=0;b<4;b++){const t=t0+b*B;if(t>=33)break;kick(t,.95);if(b%2)snare(t,.5);kick(t+.375,.5);
    for(let s=0;s<4;s++){hat(t+s*.125,s%2?.07:.11,s%2?.3:-.2);bass(t+s*.125,s===3?root+12:root,.1,.36);pluck(t+s*.125,ch[(s+b)%4]+12,.085,(s-1.5)*.3);}}
  stab(t0,ch.map(n=>n+12),.5);stab(t0+.75,ch.map(n=>n+12),.36,.2);stab(t0+1.5,ch.map(n=>n+12),.42,.3);
  pad(t0,2,ch,.13,{a:.2,r:.3,lp:2400});}
thunder(23.2,.7,.3);thunder(28.35,.9,-.2);thunder(29.1,.8,.3);
for(const t of[18,20,23,25,28,30])noise(t-.18,.2,.18,{lpf:x=>500+9000*x/.2,hp:400,a:.17,send:.3}); // カットの切り替わり
// ── 33–38 秒：発射（太鼓が抜け、持続和音と上昇音、白く飛ぶ瞬間に一撃）
pad(33,4.3,[50,57,62,65,69],.26,{a:.3,r:.3,lp:2600});tone(33,4.2,midi(26),.3,{a:.1,r:.2});
for(let i=0;i<17;i++)bass(33+i*.25,38,.12,.3);riser(34.7,2.5,.5);
impact(37.2,1.2);noise(37.2,2.6,.5,{lpf:x=>9000*Math.exp(-x*1.6)+200,dec:.9,send:.8});
// ── 38–40 秒：静寂（余韻だけ）
tone(38.3,.05,midi(74),.08,{r:1.5,send:.9});
// ── 40–47 秒：機体紹介（軽い刻み、1 秒ごとの合図）
for(let i=0;i<28;i++){const t=40+i*.25,[root,ch]=prog[Math.floor(i/8)%4];bass(t,i%4===3?root+12:root,.12,.3);hat(t,i%2?.06:.1,i%2?.3:-.2);pluck(t,ch[i%4]+12,.09,(i%4-1.5)*.3);if(i%4===0){kick(t,.8);stab(t,ch.map(n=>n+12),.3,.15);noise(t-.15,.17,.13,{lpf:x=>500+9000*x/.17,hp:400,a:.15,send:.3});}if(i%8===4)snare(t,.35);}
// ── 47–52 秒：帰還（長調へ）
pad(47,5.2,[46,53,58,62,65],.26,{a:1,r:.6,lp:2200});tone(47,2.5,midi(34),.3,{a:.3,r:.3});tone(49.5,2.5,midi(36),.3,{a:.3,r:.3});
pad(49.5,2.7,[48,55,60,64,67],.2,{a:.6,r:.4,lp:2600});for(const[t,n]of[[47.5,77],[48.5,82],[49.5,84],[50.5,79],[51.25,84]])tone(t,.06,midi(n),.1,{r:1.4,send:.9});
riser(50.5,1.5,.25);
// ── 52–60 秒：題名（ニ長調の和音を打って伸ばす）
impact(52,1.0);noise(52,3.2,.3,{lp:12000,hp:5000,dec:1.1,send:.6});
pad(52,6.2,[50,57,62,66,69,74],.34,{a:.05,r:1.6,lp:3000});tone(52,6.4,midi(26),.34,{a:.05,r:1.4});tone(52,6.4,midi(38),.2,{a:.05,r:1.4});
for(const[t,n]of[[52,86],[53,81],[54,78],[55,74]])tone(t,.06,midi(n),.11,{r:2,send:.9});
// ── 残響（櫛形フィルター 4 本を左右で少しずらす）と仕上げ
for(const[buf,out,offs]of[[SL,L,0],[SR_,R,23]]){for(const[d,g]of[[1557,.80],[1617,.79],[1491,.81],[1422,.78]]){const D=d+offs,c=new Float32Array(N);let lp=0;for(let i=0;i<N;i++){const fb=i>=D?c[i-D]:0;lp+=.35*(fb-lp);c[i]=buf[i]+lp*g;out[i]+=c[i]*.09;}}}
// 区間ごとの音量の起伏（序は静かに、本編で最大、黒地の文字では引く）
const env=[[0,.34],[5.9,.34],[6,.8],[8,.7],[14,.95],[16,1],[37.2,1],[37.9,.5],[38.4,.2],[39.9,.2],[40,1],[47,.9],[52,1],[60,1]];
const ev=t=>{for(let k=0;k<env.length-1;k++)if(t<env[k+1][0]){const[a0,g0]=env[k],[a1,g1]=env[k+1];return g0+(g1-g0)*(t-a0)/(a1-a0);}return 1;};
let pk=0;for(let i=0;i<N;i++){const fo=(i>59.3*SR?Math.max(0,1-(i-59.3*SR)/(.6*SR)):1)*ev(i/SR);L[i]=Math.tanh(L[i]*.8)*fo;R[i]=Math.tanh(R[i]*.8)*fo;pk=Math.max(pk,Math.abs(L[i]),Math.abs(R[i]));}
const g=.82/pk,buf=Buffer.alloc(44+N*4);buf.write('RIFF',0);buf.writeUInt32LE(36+N*4,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(2,22);buf.writeUInt32LE(SR,24);buf.writeUInt32LE(SR*4,28);buf.writeUInt16LE(4,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(N*4,40);
for(let i=0;i<N;i++){buf.writeInt16LE(Math.round(L[i]*g*32767),44+i*4);buf.writeInt16LE(Math.round(R[i]*g*32767),46+i*4);}
fs.writeFileSync(new URL('./out/mix.wav',import.meta.url).pathname,buf);
// 区間ごとの音量（耳で確かめられないので数値で見る）
const secs=[[0,8],[8,16],[16,33],[33,38],[38,40],[40,47],[47,52],[52,60]];console.log(secs.map(([a,b])=>{let s=0;for(let i=a*SR;i<b*SR;i++)s+=(L[i]*g)**2;return `${a}-${b}s ${(10*Math.log10(s/((b-a)*SR)+1e-12)).toFixed(1)}dB`;}).join(' | '));

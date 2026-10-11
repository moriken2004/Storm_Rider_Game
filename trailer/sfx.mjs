// 予告編の効果音だけを合成（雷・風・切り替えの風切り音・衝撃）：node trailer/sfx.mjs → out/sfx.wav
import fs from 'fs';
const SR=44100,DUR=95,N=SR*DUR,L=new Float32Array(N),R=new Float32Array(N);
let seed=11;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296*2-1;};
const put=(i,l,r)=>{if(i<0||i>=N)return;L[i]+=l;R[i]+=r;};
function tone(t0,dur,f,amp,{a=.01,r=.2,f1=0}={}){const i0=Math.round(t0*SR),n=Math.round((dur+r)*SR);let ph=0;for(let i=0;i<n;i++){const t=i/SR,ff=f1?f*Math.pow(f1/f,Math.min(1,t/dur)):f;ph+=ff/SR;const e=Math.min(1,t/a)*(t<dur?1:Math.max(0,1-(t-dur)/r)),v=Math.sin(6.2832*ph)*amp*e;put(i0+i,v,v);}}
function noise(t0,dur,amp,{lp=8000,hp=0,a=.005,dec=0,pan=0,lpf=null,env=null}={}){const i0=Math.round(t0*SR),n=Math.round(dur*SR);let y=0,h=0;
  for(let i=0;i<n;i++){const t=i/SR,cut=lpf?lpf(t):lp,c=1-Math.exp(-6.2832*cut/SR);y+=c*(rnd()-y);let v=y;if(hp){const ch=1-Math.exp(-6.2832*hp/SR);h+=ch*(v-h);v-=h;}
    const e=Math.min(1,t/a)*(dec?Math.exp(-t/dec):1)*Math.min(1,(dur-t)/.05)*(env?env(t):1);v*=amp*e;put(i0+i,v*(1-pan),v*(1+pan));}}
function thunder(t,amp=1,pan=0){noise(t,.25,amp*.9,{lp:5000,hp:300,dec:.06,pan});noise(t+.02,5,amp*1.1,{lpf:x=>700*Math.exp(-x*.9)+90,dec:1.6,pan});for(let k=0;k<5;k++)noise(t+.3+k*.37+rnd()*.1,.6,amp*.45*(1-k*.15),{lp:260,dec:.25,pan:pan+rnd()*.4});}
const whoosh=(t,amp=.3,d=.3)=>noise(t-d,d+.05,amp,{lpf:x=>400+7000*x/d,hp:300,a:d*.9});
const impact=(t,amp=1)=>{tone(t,.2,58,amp,{r:2.2,f1:30});noise(t,1.6,amp*.6,{lpf:x=>5000*Math.exp(-x*3)+120,dec:.6});};
const jet=(t,d,amp)=>noise(t,d,amp,{lpf:x=>500+2600*Math.sin(Math.PI*x/d),hp:180,a:d*.3,env:x=>Math.sin(Math.PI*x/d)});
// 序：風と遠雷
noise(0,10.2,.16,{lpf:x=>260+120*Math.sin(x*.9),a:2.5,env:x=>.7+.3*Math.sin(x*1.7)});thunder(2.2,.28,-.4);thunder(7.4,.25,.5);
// 10 秒：音楽のつなぎ目に雷を重ねる
thunder(9.98,1.0,0);impact(10.0,.6);
noise(13,1.9,.3,{lpf:x=>300+2400*x,hp:150,a:.5});          // エンジン始動
jet(15.4,2.8,.34);jet(18,2.2,.3);jet(20.3,2.1,.2);          // 離陸・海面すれすれ・編隊
noise(22.4,19.5,.13,{lp:5200,hp:1500,a:.4,env:x=>.8+.2*Math.sin(x*3)}); // 雨（嵐の区間）
thunder(23.6,.5,.4);thunder(25.9,.75,-.3);thunder(28.4,.45,.5);thunder(30.6,.5,-.5);thunder(32.9,1.0,.1);thunder(33.65,.9,-.2);thunder(35.9,.5,.4);thunder(39.6,.6,0);
for(const t of[13,14.76,18,20.2,22.4,25.3,27.5,29.7,32.6,34.8,37,39.2,41.9])whoosh(t,.22);
noise(41.9,11,.07,{lpf:x=>320,a:1.5,env:x=>.7+.3*Math.sin(x*.8)});   // 目の中の静かな風
noise(53.2,1.2,.3,{lpf:x=>600+5000*x,hp:300,a:.05,dec:.7});tone(53.2,.5,220,.12,{f1:900,r:.4}); // 発射
noise(54.4,2.8,.22,{lpf:x=>300*Math.pow(30,x/2.8),hp:200,a:2.4});    // 白く飛ぶ前の上昇音
impact(57.2,1.3);noise(57.25,5,.3,{lpf:x=>3000*Math.exp(-x*.7)+150,dec:2.2}); // 衝撃波
for(let i=0;i<7;i++)whoosh(65+i,.16,.2);
jet(72,4,.16);noise(78.7,.5,.3,{lp:900,dec:.15});tone(78.7,.1,70,.4,{r:.4,f1:45}); // 接地
whoosh(76,.2);whoosh(81.4,.2);whoosh(84.9,.2);impact(89.74,.9);
let pk=0;for(let i=0;i<N;i++){L[i]=Math.tanh(L[i]);R[i]=Math.tanh(R[i]);pk=Math.max(pk,Math.abs(L[i]),Math.abs(R[i]));}
const g=.8/pk,buf=Buffer.alloc(44+N*4);buf.write('RIFF',0);buf.writeUInt32LE(36+N*4,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(2,22);buf.writeUInt32LE(SR,24);buf.writeUInt32LE(SR*4,28);buf.writeUInt16LE(4,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(N*4,40);
for(let i=0;i<N;i++){buf.writeInt16LE(Math.round(L[i]*g*32767),44+i*4);buf.writeInt16LE(Math.round(R[i]*g*32767),46+i*4);}
fs.writeFileSync(new URL('./out/sfx.wav',import.meta.url).pathname,buf);console.log('sfx ok');

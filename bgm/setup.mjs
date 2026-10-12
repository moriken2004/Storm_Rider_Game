#!/usr/bin/env node
// 手元の音楽ファイルを、このゲームの BGM として使えるようにする。
//
//   node bgm/setup.mjs <音楽ファイル>          曲を解析して、場面ごとの区間を自動で決める
//   node bgm/setup.mjs <音楽ファイル> --preview 繰り返しのつなぎ目を聴いて確かめる WAV も書き出す
//   node bgm/setup.mjs --remove                 取り込んだ音源と設定を消して、内蔵シンセに戻す
//
// やること：
//   1. 音楽ファイルを bgm/src/storm_rider.mp3 に変換して置く（このファイルは .gitignore で除外済み）
//   2. 曲全体の音量と音色の移り変わりを調べ、静かな所・激しい所・締めくくりを見つける
//   3. それぞれの場面で「頭に戻っても不自然にならない」繰り返しの区間を探す
//   4. 結果を bgm/cues.json に書く（ゲームは起動時にこれを読む）
//
// 必要なもの：Node.js 18 以上と ffmpeg（https://ffmpeg.org/）。音楽ファイルはどこにも送信しません。
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url)),SRC=path.join(here,'src','storm_rider.mp3'),CUES=path.join(here,'cues.json'),WORK=path.join(here,'work');
const args=process.argv.slice(2),flags=new Set(args.filter(a=>a.startsWith('--'))),input=args.find(a=>!a.startsWith('--'));
const die=m=>{console.error('\n✗ '+m+'\n');process.exit(1);};

if(flags.has('--remove')){for(const f of[SRC,CUES])if(fs.existsSync(f)){fs.rmSync(f);console.log('削除: '+path.relative(process.cwd(),f));}console.log('内蔵シンセに戻しました。');process.exit(0);}
if(!input)die('使い方: node bgm/setup.mjs <音楽ファイル> [--preview]\n  例:    node bgm/setup.mjs ~/Music/my_song.mp3');
if(!fs.existsSync(input))die('ファイルが見つかりません: '+input);
if(spawnSync('ffmpeg',['-version']).status!==0)die('ffmpeg が見つかりません。https://ffmpeg.org/ から入れてください（macOS: brew install ffmpeg ／ Windows: winget install ffmpeg）。');

// ── 1. 取り込み
fs.mkdirSync(path.dirname(SRC),{recursive:true});
if(path.resolve(input)!==path.resolve(SRC)){
  const isMp3=/\.mp3$/i.test(input);
  const r=isMp3?(fs.copyFileSync(input,SRC),{status:0}):spawnSync('ffmpeg',['-loglevel','error','-y','-i',input,'-vn','-codec:a','libmp3lame','-q:a','3',SRC]);
  if(r.status!==0)die('音楽ファイルを変換できませんでした: '+(r.stderr||''));
}
console.log('① 取り込み: '+path.relative(process.cwd(),SRC));

// ── 2. 解析用にモノラル 22.05kHz で読む
const SR=22050,dec=spawnSync('ffmpeg',['-loglevel','error','-i',SRC,'-ac','1','-ar',String(SR),'-f','f32le','-'],{maxBuffer:1<<30});
if(dec.status!==0||!dec.stdout.length)die('音声を読み取れませんでした。');
const x=new Float32Array(dec.stdout.buffer,dec.stdout.byteOffset,dec.stdout.length>>2),DUR=x.length/SR;
if(DUR<60)die('曲が短すぎます（'+DUR.toFixed(0)+' 秒）。1 分以上の曲を使ってください。');
console.log('② 解析: '+fmt(DUR)+'（'+DUR.toFixed(1)+' 秒）');

// 短時間フーリエ変換 → 対数間隔 40 帯域の対数スペクトル
const N=2048,H=512,FPS=SR/H,NB=48,nf=Math.floor((x.length-N)/H);
const win=new Float32Array(N);for(let i=0;i<N;i++)win[i]=.5-.5*Math.cos(2*Math.PI*i/(N-1));
const rev=new Uint16Array(N);for(let i=0;i<N;i++){let r=0;for(let b=0;b<11;b++)r|=((i>>b)&1)<<(10-b);rev[i]=r;}
const cosT=new Float32Array(N/2),sinT=new Float32Array(N/2);for(let i=0;i<N/2;i++){cosT[i]=Math.cos(2*Math.PI*i/N);sinT[i]=Math.sin(2*Math.PI*i/N);}
const re=new Float32Array(N),im=new Float32Array(N);
// 帯域の境目（40Hz〜9kHz を対数間隔で 48 等分）。狭すぎて周波数の刻みが 1 つも入らない低い帯域は空のままにする
const edges=[];for(let b=0;b<=NB;b++)edges.push(Math.ceil(40*Math.pow(9000/40,b/NB)/(SR/N)-1e-9));
const band=new Float32Array(nf*NB),rms=new Float32Array(nf);
for(let f=0;f<nf;f++){
  let e=0;for(let i=0;i<N;i++){const v=x[f*H+i];e+=v*v;re[rev[i]]=v*win[i];im[rev[i]]=0;}rms[f]=Math.sqrt(e/N);
  for(let len=2;len<=N;len<<=1){const half=len>>1,step=N/len;for(let i=0;i<N;i+=len)for(let j=0;j<half;j++){const c=cosT[j*step],s=sinT[j*step],k=i+j+half,tr=re[k]*c+im[k]*s,ti=im[k]*c-re[k]*s;re[k]=re[i+j]-tr;im[k]=im[i+j]-ti;re[i+j]+=tr;im[i+j]+=ti;}}
  for(let b=0;b<NB;b++){let s=0;for(let k=edges[b];k<edges[b+1];k++)s+=Math.hypot(re[k],im[k]);band[f*NB+b]=Math.log1p(s*20);}
}
// 音量（dB）を 6 秒幅でならす
const dB=new Float32Array(nf);{const k=Math.round(3*FPS),cs=new Float64Array(nf+1);for(let i=0;i<nf;i++)cs[i+1]=cs[i]+rms[i]*rms[i];for(let i=0;i<nf;i++){const a=Math.max(0,i-k),b=Math.min(nf,i+k);dB[i]=10*Math.log10((cs[b]-cs[a])/(b-a)+1e-12);}}
const T=f=>f/FPS,F=t=>Math.max(0,Math.min(nf-1,Math.round(t*FPS)));
const meanDb=(a,b)=>{let s=0,n=0;for(let i=F(a);i<F(b);i++){s+=dB[i];n++;}return s/Math.max(1,n);};
const sorted=Array.from(dB).sort((a,b)=>a-b),med=sorted[nf>>1];
// 最初に音が出る所と、最後に音が消える所
let t0=0;{let f=0;while(f<nf-1&&20*Math.log10(rms[f]+1e-9)<-48)f++;t0=T(f);}let tEnd=DUR;while(tEnd>t0+30&&dB[F(tEnd-.2)]<med-22)tEnd-=.1;

// ── 3. 場面の割り当て：幅 win 秒の窓を動かし、音量がいちばん大きい／小さい所を選ぶ
const used=[];const free=(a,b)=>used.every(([u,v])=>b<=u||a>=v);
function pick(lo,hi,winLen,sign){let best=null;for(let a=lo;a+winLen<=hi;a+=1){if(!free(a,a+winLen))continue;const s=sign*meanDb(a,a+winLen);if(!best||s>best.s)best={a,b:a+winLen,s};}return best;}
const span=tEnd-t0,W=Math.min(34,span*.16);
const vicLen=Math.min(12.5,span*.07),vic=[tEnd-vicLen,tEnd];used.push(vic);
const climax=pick(t0+span*.55,vic[0],W,+1)||{a:vic[0]-W,b:vic[0]};used.push([climax.a,climax.b]);
const eye=pick(t0+span*.2,t0+span*.85,W,-1)||{a:t0+span*.4,b:t0+span*.4+W};used.push([eye.a,eye.b]);
const storm=pick(t0+span*.3,climax.a+1,W,+1)||pick(t0+span*.15,tEnd,W,+1)||{a:t0+span*.6,b:t0+span*.6+W};used.push([storm.a,storm.b]);
// 主題：曲の前半で、音量が中央値近くまで上がって落ち着いた最初の所
let th=t0+4;while(th<t0+span*.35&&meanDb(th,th+12)<med-1)th+=1;const theme={a:th,b:Math.min(th+58,t0+span*.5)};
// 繰り返し点を探す範囲は、選んだ窓の前後へ少し広げる（締めくくりには掛けない）
const widen=r=>({a:Math.max(t0,r.a-10),b:Math.min(vic[0]-.5,r.b+10)});

// ── 4. 繰り返しの区間を探す：2 秒ぶんの音色の並びが最もよく似た 2 点（開始と終了）
const PW=Math.round(2*FPS),PS=2;   // 2 秒ぶんを 1 コマおきに比べる
function patch(i){const n=Math.ceil(PW/PS),p=new Float32Array(n*NB);let m=0;for(let q=0;q<n;q++)for(let b=0;b<NB;b++){const v=band[(i+q*PS)*NB+b];p[q*NB+b]=v;m+=v;}m/=p.length;let nn=0;for(let k=0;k<p.length;k++){p[k]-=m;nn+=p[k]*p[k];}nn=Math.sqrt(nn)+1e-9;for(let k=0;k<p.length;k++)p[k]/=nn;return p;}
// 音の立ち上がりの強さ（帯域ごとの増分の和）
const flux=new Float32Array(nf);for(let f=1;f<nf;f++){let v=0;for(let b=0;b<NB;b++){const d=band[f*NB+b]-band[(f-1)*NB+b];if(d>0)v+=d;}flux[f]=v;}
// 範囲内の拍の周期（0.3〜1.0 秒）と確からしさ
function beatOf(a,b){const i0=F(a),i1=F(b),n=i1-i0;let m=0;for(let i=i0;i<i1;i++)m+=flux[i];m/=n;let z=0;for(let i=i0;i<i1;i++)z+=(flux[i]-m)**2;let best=[0,0];const ac=l=>{let v=0;for(let i=i0;i<i1-l;i++)v+=(flux[i]-m)*(flux[i+l]-m);return v/z;};
  for(let l=Math.round(.3*FPS);l<=Math.round(1.0*FPS);l++){const v=ac(l);if(v>best[1])best=[l,v];}const l=best[0],y0=ac(l-1),y1=best[1],y2=ac(l+1),fr=l+.5*(y0-y2)/(y0-2*y1+y2||1);return{period:fr/FPS,conf:best[1]};}
function findLoop(r,minLen){
  const bt=beatOf(r.a,r.b),useBeat=bt.conf>.25;
  // 範囲内のすべての組（開始 i・終了 j）を調べる。長さは minLen〜32 秒。音量の段差が大きい組は減点する
  const f0=F(r.a),f1=Math.min(F(r.b),nf-PW-2),st=2,P=[];for(let i=f0;i<f1;i+=st)P.push([i,patch(i),dB[Math.min(nf-1,i+Math.round(FPS/2))]]);
  let best={s:-2,i:f0,j:f1,raw:0};const lo=Math.round(minLen*FPS/st),hi=Math.round(32*FPS/st);
  for(let u=0;u<P.length;u++){const pa=P[u][1];for(let v=u+lo;v<P.length&&v<=u+hi;v++){const pb=P[v][1];let d=0;for(let k=0;k<pa.length;k++)d+=pa[k]*pb[k];let sc=d-.015*Math.abs(P[u][2]-P[v][2]);if(useBeat){const nb=(P[v][0]-P[u][0])/FPS/bt.period,off=Math.abs(nb-Math.round(nb));sc-=.12*off;if(Math.round(nb)%4===0)sc+=.01;}if(sc>best.s)best={s:sc,i:P[u][0],j:P[v][0],raw:d};}}
  best.s=best.raw;
  // 波形で ±25ms の微調整（低い音の位相を合わせる）
  const ia=best.i*H,L=4096;let bc=-2,bd=0;for(let d=-550;d<=550;d+=3){const ib=best.j*H+d;if(ib<0||ib+L>=x.length)continue;let s=0,na=0,nb=0;for(let k=0;k<L;k+=2){const p=x[ia+k],q=x[ib+k];s+=p*q;na+=p*p;nb+=q*q;}const c=s/(Math.sqrt(na*nb)+1e-9);if(c>bc){bc=c;bd=d;}}
  const a=ia/SR,b=(best.j*H+bd)/SR;return{a:+a.toFixed(4),b:+b.toFixed(4),score:+best.s.toFixed(3),step:+(meanDb(b-1,b)-meanDb(a,a+1)).toFixed(1),beats:useBeat?+((b-a)/bt.period).toFixed(2):null};
}
const roles={theme:[theme,12],eye:[widen(eye),10],storm:[widen(storm),10],climax:[widen(climax),10]},found={};
for(const[k,[r,ml]]of Object.entries(roles))found[k]=findLoop(r,Math.min(ml,(r.b-r.a)*.5));

// ── 5. ゲームが読む形で書き出す
const th0=found.theme.a,cues={
  _note:'bgm/setup.mjs が自動で作った設定。秒数は手で直してもよい（start＝頭出し、loop＝繰り返す区間、once＝1 回だけ鳴らす区間）。',
  _source:path.basename(input),_duration:+DUR.toFixed(2),
  title:{start:+t0.toFixed(2),loop:[found.theme.a,found.theme.b]},
  intro:{start:+Math.max(t0,th0-29.95).toFixed(2),loop:[found.theme.a,found.theme.b]},   // 主題の入りを、出撃カット 30 秒目の離陸に合わせる
  launch:{start:found.theme.a,loop:[found.theme.a,found.theme.b]},
  theme:{start:found.theme.a,loop:[found.theme.a,found.theme.b]},
  storm:{start:+Math.max(t0,storm.a).toFixed(2),loop:[found.storm.a,found.storm.b]},
  eye:{start:+Math.max(t0,eye.a).toFixed(2),loop:[found.eye.a,found.eye.b],vol:.9},
  climax:{start:+Math.max(t0,climax.a).toFixed(2),loop:[found.climax.a,found.climax.b]},
  victory:{once:[+vic[0].toFixed(2),+(vic[1]-.3).toFixed(2)],next:'theme'}};
fs.writeFileSync(CUES,JSON.stringify(cues,null,1)+'\n');
console.log('③ 場面の割り当て（bgm/cues.json に保存）\n');
const row=(n,use,a,b,sc,st,bt)=>console.log('  '+n.padEnd(10)+use.padEnd(26)+(fmt(a)+' – '+fmt(b)).padEnd(16)+(sc===undefined?'':('一致度 '+sc.toFixed(2)+(sc<.8?' △':'')+'　音量差 '+(st>0?'+':'')+st+'dB'+(Math.abs(st)>3?' △':'')+(bt==null?'　拍は不明瞭':'　'+bt+' 拍'))));
row('theme','タイトル・出撃・帰還',found.theme.a,found.theme.b,found.theme.score,found.theme.step,found.theme.beats);
row('storm','レインバンド・壁雲',found.storm.a,found.storm.b,found.storm.score,found.storm.step,found.storm.beats);
row('eye','台風の目',found.eye.a,found.eye.b,found.eye.score,found.eye.step,found.eye.beats);
row('climax','再攻撃',found.climax.a,found.climax.b,found.climax.score,found.climax.step,found.climax.beats);
row('victory','コア消滅（1 回だけ）',cues.victory.once[0],cues.victory.once[1]);
if(Object.values(found).some(f=>f.score<.8||Math.abs(f.step)>3))console.log('\n  △ の付いた区間は、つなぎ目が目立つかもしれません。--preview で聴いて、気になれば bgm/cues.json の秒数を直してください。');

// ── 6. つなぎ目の試聴用 WAV（繰り返しの終わり 4 秒 → 始まり 4 秒）
if(flags.has('--preview')){fs.mkdirSync(WORK,{recursive:true});
  for(const[k,f]of Object.entries(found)){const xf=Math.round(.12*SR),ia=Math.round(f.a*SR),ib=Math.round(f.b*SR),n1=4*SR,out=new Float32Array(n1*2);
    for(let i=0;i<n1;i++)out[i]=x[ib-n1+i]||0;for(let i=0;i<n1;i++)out[n1+i]=x[ia+i]||0;
    for(let i=0;i<xf;i++){const u=i/xf;out[n1-xf+i]=(x[ib-xf+i]||0)*Math.cos(u*Math.PI/2)+(x[ia-xf+i]||0)*Math.sin(u*Math.PI/2);}
    const buf=Buffer.alloc(44+out.length*2);buf.write('RIFF',0);buf.writeUInt32LE(36+out.length*2,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(SR,24);buf.writeUInt32LE(SR*2,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(out.length*2,40);
    for(let i=0;i<out.length;i++)buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,out[i]))*32767),44+i*2);fs.writeFileSync(path.join(WORK,'seam_'+k+'.wav'),buf);}
  console.log('\n④ 試聴用: bgm/work/seam_*.wav（4 秒目がつなぎ目です）');}
console.log('\n完了。ローカルサーバーを起動して遊んでください:\n\n  node serve.mjs   →   http://127.0.0.1:8795/\n\n設定画面の「音楽の音源」が「手元の音源」になっていれば成功です。\n内蔵シンセに戻すには  node bgm/setup.mjs --remove\n');
function fmt(t){const m=Math.floor(t/60),s=Math.floor(t%60);return m+':'+String(s).padStart(2,'0');}

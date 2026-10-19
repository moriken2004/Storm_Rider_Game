// 爆発・墜落まわりの音を 1 つずつ書き出す（耳で確かめる用）。node test/sndexport.mjs <ページ> <接頭辞>
// 1) 実際のゲーム中の墜落を実時間で録音（全部入り／ループ音だけ）  2) 効果音を 1 つずつオフラインで合成
import puppeteer from 'puppeteer';import fs from 'fs';import {execFileSync} from 'child_process';
const page=process.argv[2]||'/index.html',pre=process.argv[3]||'new',OUT=new URL('../sound_check/',import.meta.url).pathname;fs.mkdirSync(OUT,{recursive:true});
const b=await puppeteer.launch({headless:'new',args:['--autoplay-policy=no-user-gesture-required']});const p=await b.newPage();
await p.evaluateOnNewDocument(()=>{const f=AudioNode.prototype.connect;AudioNode.prototype.connect=function(d,...a){const r=f.call(this,d,...a);
  if(d===this.context.destination&&this.context instanceof AudioContext){const c=this.context;if(!c._rd)c._rd=c.createMediaStreamDestination();f.call(this,c._rd);}return r;};});
await p.goto('http://127.0.0.1:8795'+page);await p.waitForFunction('window.__SR',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});await p.keyboard.press('KeyX');await new Promise(r=>setTimeout(r,4000));
const save=(name,b64,ext)=>{const f=OUT+pre+'_'+name+'.'+ext;fs.writeFileSync(f,Buffer.from(b64,'base64'));if(ext==='webm'){execFileSync('/opt/homebrew/bin/ffmpeg',['-loglevel','error','-y','-i',f,'-ar','48000',f.replace('.webm','.wav')]);fs.unlinkSync(f);}console.log('書き出し',name);};
// 実時間の録音
const rec=async(name,setup,mute)=>{
  await p.evaluate((setup,mute)=>{(0,eval)('('+setup+')')();if(mute==='loops'){window._sv=window._sv||{...SFX};for(const k in SFX)SFX[k]=()=>{};window._ba=boomAt;boomAt=()=>{};window._pb=playBuf;playBuf=()=>true;}
    const c=AU.ctx;window._chunks=[];window._mr=new MediaRecorder(c._rd.stream,{mimeType:'audio/webm;codecs=opus'});_mr.ondataavailable=e=>_chunks.push(e.data);_mr.start();},setup.toString(),mute);
  for(let i=0;i<150;i++){await p.evaluate(()=>{const S=__SR;S.input.tx=0;S.input.ty=window._ty||0;S.step(1/30);});await new Promise(r=>setTimeout(r,30));}
  await new Promise(r=>setTimeout(r,1500));
  const b64=await p.evaluate(async()=>{await new Promise(r=>{_mr.onstop=r;_mr.stop();});const bl=new Blob(_chunks);const ab=new Uint8Array(await bl.arrayBuffer());let s='';for(let i=0;i<ab.length;i+=8192)s+=String.fromCharCode(...ab.subarray(i,i+8192));
    if(window._sv){Object.assign(SFX,_sv);boomAt=_ba;playBuf=_pb;window._sv=null;}return btoa(s);});
  save(name,b64,'webm');};
const ground=()=>{const S=__SR,G=S.G,P=S.P;S.startRun('approach');if(G.mode==='cut')S.endCut();P.inv=0;P.hull=100;P.pos.set(330,90,21000+330-60);P.yaw=Math.PI;P.pitch=-.6;window._ty=-1;};
const sea=()=>{const S=__SR,G=S.G,P=S.P;S.startRun('approach');if(G.mode==='cut')S.endCut();P.inv=0;P.hull=20;P.pos.set(0,60,24000);P.yaw=Math.PI;P.pitch=-.5;window._ty=-1;};
const skim=()=>{const S=__SR,G=S.G,P=S.P;S.startRun('approach');if(G.mode==='cut')S.endCut();P.inv=0;P.hull=100;P.pos.set(0,9,24000);P.yaw=Math.PI;P.pitch=-.12;window._ty=0;};
// 効果音を 1 つずつオフライン合成
const stems=[['B1_爆発_自機の墜落(近く・大)',"boomAt(40,0,1,'air')"],['B2_爆発_建物',"boomAt(150,.3,1,'bldg')"],['B3_爆発_小(遠く)',"boomAt(700,-.4,.3,'air')"],
  ['B4_激突(hit)','SFX.hit()'],['B5_外板がはがれる(rip)','SFX.rip()'],['B6_地面をこする(scrape)','SFX.scrape()'],['B7_着水_小(splash)','SFX.splash()'],['B8_着水_大',"playBuf(SBUF.splashBig,{vol:1.3})"],
  ['B9_建物に当たる金属音(ting)','SFX.ting&&SFX.ting()'],['B10_爆縮(implode)','SFX.implode&&SFX.implode()']];
for(const[name,call]of stems){const b64=await p.evaluate(async call=>{const real={ctx:AU.ctx,sfx:AU.sfx,rev:AU.rev};const sr=real.ctx.sampleRate,off=new OfflineAudioContext(2,sr*7,sr);
    AU.ctx=off;AU.sfx=off.createGain();AU.sfx.gain.value=.8;AU.sfx.connect(off.destination);const len=sr*3.2,ir=off.createBuffer(2,len,sr);for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6);}
    AU.rev=off.createConvolver();AU.rev.buffer=ir;const rg=off.createGain();rg.gain.value=.55;AU.rev.connect(rg);rg.connect(off.destination);for(const k of['hitT','ripT','scrT','splT'])AU[k]=undefined;
    let err='';try{(0,eval)(call);}catch(e){err=e.message;}const buf=await off.startRendering();Object.assign(AU,real);
    let pk=1e-9;for(let c=0;c<2;c++)for(const v of buf.getChannelData(c))pk=Math.max(pk,Math.abs(v));const g=Math.min(1,.95/pk),n=buf.length,dv=new DataView(new ArrayBuffer(44+n*4));
    const W=(o,s)=>{for(let i=0;i<s.length;i++)dv.setUint8(o+i,s.charCodeAt(i));};W(0,'RIFF');dv.setUint32(4,36+n*4,true);W(8,'WAVEfmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,2,true);dv.setUint32(24,sr,true);dv.setUint32(28,sr*4,true);dv.setUint16(32,4,true);dv.setUint16(34,16,true);W(36,'data');dv.setUint32(40,n*4,true);
    const L=buf.getChannelData(0),R=buf.getChannelData(1);for(let i=0;i<n;i++){dv.setInt16(44+i*4,Math.max(-1,Math.min(1,L[i]*g))*32767,true);dv.setInt16(46+i*4,Math.max(-1,Math.min(1,R[i]*g))*32767,true);}
    const ab=new Uint8Array(dv.buffer);let s='';for(let i=0;i<ab.length;i+=8192)s+=String.fromCharCode(...ab.subarray(i,i+8192));return [btoa(s),pk,err];},call);
  console.log('  peak',b64[1].toFixed(3),b64[2]);save(name,b64[0],'wav');}
if(!process.env.SKIPREC){await rec('A1_地面へ墜落_全部',ground);await rec('A2_海へ墜落_全部',sea);await rec('A3_海面に接触_全部',skim);await rec('A4_地面へ墜落_ループ音だけ(エンジン・風)',ground,'loops');}
await b.close();

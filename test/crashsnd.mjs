// 墜落・接触の瞬間にどの音がどう動くかを記録する（キュルキュル音の調査）。node test/crashsnd.mjs
// 音の部品を作った関数名で印を付け、周波数・再生速度の変化（往復の回数）と、鳴り始めた音の一覧を出す
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--autoplay-policy=no-user-gesture-required']});const p=await b.newPage();
await p.evaluateOnNewDocument(()=>{
  const who=()=>{const s=(new Error().stack||'').split('\n').slice(3,7).map(l=>(l.match(/at (\S+)/)||[])[1]).filter(Boolean);return s.join('<');};
  window.SND={on:false,ev:[],starts:[]};
  const tag=(node,lab)=>{for(const k of['frequency','playbackRate','detune','gain'])if(node[k])node[k]._lab=lab+'.'+k;node._lab=lab;return node;};
  for(const m of['createOscillator','createBufferSource','createBiquadFilter','createGain'])
    {const f=BaseAudioContext.prototype[m];BaseAudioContext.prototype[m]=function(...a){return tag(f.apply(this,a),m.slice(6)+'@'+who());};}
  for(const m of['setValueAtTime','setTargetAtTime','linearRampToValueAtTime','exponentialRampToValueAtTime'])
    {const f=AudioParam.prototype[m];AudioParam.prototype[m]=function(v,...a){if(SND.on&&this._lab&&!/gain$/.test(this._lab))SND.ev.push([this._lab,+v]);return f.call(this,v,...a);};}
  const d=Object.getOwnPropertyDescriptor(AudioParam.prototype,'value');Object.defineProperty(AudioParam.prototype,'value',{get(){return d.get.call(this);},set(v){if(SND.on&&this._lab&&!/gain$/.test(this._lab))SND.ev.push([this._lab,+v]);d.set.call(this,v);}});
  for(const C of[AudioBufferSourceNode,OscillatorNode]){const f=C.prototype.start;C.prototype.start=function(...a){if(SND.on)SND.starts.push(this._lab+(this.buffer?' len='+this.buffer.duration.toFixed(2):'')+(this.loop?' loop':''));return f.apply(this,a);};}
});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyX'}));});
await p.keyboard.press('KeyX');await new Promise(r=>setTimeout(r,3500));   // 音の初期化と事前合成を待つ
const run=async(name,setup)=>{
  await p.evaluate(setup);
  // 実時間に合わせて 1/30 秒ずつ進める（音は実時間で鳴るため）
  await p.evaluate(()=>{SND.ev=[];SND.starts=[];SND.on=true;});
  for(let i=0;i<120;i++){await p.evaluate(()=>{const S=__SR;S.input.tx=0;S.input.ty=window._ty||0;S.step(1/30);});await new Promise(r=>setTimeout(r,33));}
  const r=await p.evaluate(()=>{SND.on=false;const by={};for(const[l,v]of SND.ev){const o=by[l]||(by[l]={n:0,min:1e9,max:-1e9,rev:0,last:null,dir:0});o.n++;o.min=Math.min(o.min,v);o.max=Math.max(o.max,v);if(o.last!=null){const d=Math.sign(v-o.last);if(d&&o.dir&&d!==o.dir)o.rev++;if(d)o.dir=d;}o.last=v;}
    return{mode:__SR.G.mode,cause:__SR.G.cause,params:Object.entries(by).map(([l,o])=>l.slice(0,110)+'  n='+o.n+' '+o.min.toFixed(3)+'〜'+o.max.toFixed(3)+' 往復'+o.rev),starts:SND.starts.map(s=>s.slice(0,120))};});
  console.log('\n=== '+name+' → '+r.mode+' '+(r.cause||''));console.log('[変化する値]');r.params.forEach(x=>console.log('  '+x));
  const c={};r.starts.forEach(s=>c[s]=(c[s]||0)+1);console.log('[鳴り始めた音]');Object.entries(c).forEach(([s,n])=>console.log('  '+n+'× '+s));};
await run('海へ突っ込む',()=>{const S=__SR,G=S.G,P=S.P;S.startRun('approach');if(G.mode==='cut')S.endCut();P.inv=0;P.hull=100;P.pos.set(0,60,24000);P.yaw=Math.PI;P.pitch=-.5;window._ty=-1;});
await run('海面をかすめる',()=>{const S=__SR,G=S.G,P=S.P;S.startRun('approach');if(G.mode==='cut')S.endCut();P.inv=0;P.hull=100;P.pos.set(0,9,24000);P.yaw=Math.PI;P.pitch=-.12;window._ty=0;});
await run('島の地面へ突っ込む',()=>{const S=__SR,G=S.G,P=S.P;S.startRun('approach');if(G.mode==='cut')S.endCut();P.inv=0;P.hull=100;P.pos.set(330,90,21000+330-60);P.yaw=Math.PI;P.pitch=-.6;window._ty=-1;});
await b.close();

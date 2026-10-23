// ───────────────────────── 状態 ─────────────────────────
const DIFFS=[
  {name:'訓練',desc:'落雷の予告が長く、機体も頑丈です。起こるトラブルは基本的なものだけです。',dmg:1,strk:1,warnT:2.1,rad:62,turb:1,wind:1,eyeT:95,heal:30,floor:90,spouts:6,stallT:30},
  {name:'実戦',desc:'受けるダメージと風が強くなり、着氷・計器故障・風向の急変・脚の油圧故障が起こります。',dmg:1.35,strk:.78,warnT:1.75,rad:72,turb:1.3,wind:1.2,eyeT:78,heal:20,floor:85,spouts:9,stallT:25},
  {name:'極限',desc:'さらに雹とエンジン火災が起こります。着陸では進入ゲートをすべて通過しなければなりません。',dmg:1.8,strk:.6,warnT:1.45,rad:84,turb:1.6,wind:1.4,eyeT:64,heal:15,floor:80,spouts:12,stallT:21}];
const DF=()=>DIFFS[opts.diff||0];
// 保存した設定：壊れた値や古い版の範囲外の番号でも起動できるよう、型と範囲をそろえる（色と形の個数は読み込み後に fixOpts で確かめる）
const opts=(()=>{const d={mus:70,sfx:80,inv:false,q:1,diff:0,color:0,shape:0};let s={};try{s=JSON.parse(localStorage.getItem('stormrider_opts')||'{}');}catch(e){}if(!s||typeof s!=='object'||Array.isArray(s))s={};
  const num=(v,lo,hi,def,int)=>{v=Number(v);if(!Number.isFinite(v))return def;v=Math.min(hi,Math.max(lo,v));return int?Math.round(v):v;};
  return{mus:num(s.mus,0,100,d.mus),sfx:num(s.sfx,0,100,d.sfx),inv:!!s.inv,q:num(s.q,0,2,d.q,1),diff:num(s.diff,0,2,d.diff,1),color:num(s.color,0,99,0,1),shape:num(s.shape,0,99,0,1),sens:num(s.sens,60,140,100,1),calm:!!s.calm};})();
function fixOpts(){if(typeof SCHEMES!=='undefined'&&!(opts.color<SCHEMES.length))opts.color=0;if(typeof SHAPES!=='undefined'&&!(opts.shape<SHAPES.length))opts.shape=0;}fixOpts();
const saveOpts=()=>{try{localStorage.setItem('stormrider_opts',JSON.stringify(opts));}catch(e){}};
const G={mode:'boot',phase:'',t:0,pt:0,missionT:0,retries:0,flags:{},flash:0,scr:0,hurt:0,shake:0,gust:0,down:0,gloom:0,rain:0,gold:0,
  target:null,targetLabel:'',lock:0,ringIdx:0,eyeT:0,dock:0,strikeT:4,ambT:1,ckpt:null,stats:{dmg:0,saved:null},fade:0,white:0,prompt:null,warnT:0,hintT:0,gate:0};
const P={pos:new V3(0,400,14400),vel:new V3(),yaw:0,pitch:0,roll:0,speed:150,hull:100,boost:100,inv:0,engineOut:false,restart:0,hasPod:true,power:1,mesh:null,camYaw:0,camPitch:0,fling:new V3(),spin:0,wind:0};
const W=[{who:'G',pos:new V3(),yaw:0,pitch:0,roll:0,state:'form',mesh:null,ph:1.3,side:-50,fw:24,up:3,ang:0},
         {who:'H',pos:new V3(),yaw:0,pitch:0,roll:0,state:'form',mesh:null,ph:4.1,side:46,fw:12,up:1,ang:0}];
const WHO={C:['ミズハ管制','#8fd4ff'],G:['2番機 ゴウ','#ffc57a'],H:['3番機 ハル','#a6f0b4'],S:['機体システム','#ff8a7a'],F:['ノルド連邦 防空軍','#ff7466']};
const CORE=new V3(0,3400,0);
const input={x:0,y:0,boost:false,act:false,actHit:false,keys:{},tx:0,ty:0,tBoost:false,tAct:false,xb:false,tXb:false};
let sunL,hemiL,trails=[],bolts=[],columns=[],rings=[],gateRings=[],spouts=[],coreShell,coreGlow,shock,boomFx,proj,carrierRing;
const strikes=[];
const tA=new V3(),tB=new V3(),tC=new V3(),tD=new V3();

// ───────────────────────── 環境（太陽・空） ─────────────────────────
const ENV_A={dir:new V3(-0.45,0.42,0.78).normalize(),sun:new V3(5.2,4.5,3.6),zen:new V3(0.045,0.115,0.30),hor:new V3(0.30,0.38,0.48)};
const ENV_B={dir:new V3(-0.20,0.20,0.95).normalize(),sun:new V3(7.8,4.7,2.4),zen:new V3(0.075,0.185,0.46),hor:new V3(0.60,0.60,0.68)};
// 台風の目の中では太陽を高くして、壁雲に囲まれた海に日が差すようにする（壁雲の中を通る間に切り替わるので、外の景色の変化は見えない）
const SUN_BASE=ENV_A.dir.clone(),SUN_EYE=new V3(-0.45*.5,0.86,0.78*.5).normalize();
// 夕暮れの奥：日がさらに傾き、空は藍色、灯りが映える
const ENV_C={dir:new V3(-0.16,0.075,0.98).normalize(),sun:new V3(6.4,2.5,.9),zen:new V3(0.035,0.07,0.2),hor:new V3(0.5,0.38,0.36)};
function applyDusk(k){if(Math.abs(k-(G.duskK||0))<.002&&G.duskK!==undefined)return;G.duskK=k;if(k<=0){applyEnv(G.gold||0);G.duskK=0;duskLights(0);return;}
  const g0=G.gold;applyEnv(g0);G.duskK=k;U.uSunDir.value.lerp(ENV_C.dir,k).normalize();U.uSunCol.value.lerp(ENV_C.sun,k);U.uSkyZen.value.lerp(ENV_C.zen,k);U.uSkyHor.value.lerp(ENV_C.hor,k);duskLights(k);}
// 基地の灯り（滑走路灯・窓明かり・街灯・標識灯）を夕暮れの深さで明るくする
const DL={init:false,spr:[],win:[]};
function duskLights(k){if(!DL.init){DL.init=true;baseGroup.traverse(o=>{const m=o.material;if(!m||Array.isArray(m))return;if(o.isSprite&&m.blending===THREE.AdditiveBlending&&!DL.spr.some(q=>q[0]===m))DL.spr.push([m,m.color.clone(),o]);else if(m.isMeshStandardMaterial&&m.emissiveMap&&!DL.win.some(q=>q[0]===m))DL.win.push([m,m.emissiveIntensity]);});}
  for(const[m,c0]of DL.spr)m.color.copy(c0).multiplyScalar(1+1.6*k);for(const[m,e0]of DL.win)m.emissiveIntensity=e0*(1+2.6*k);
  if(runwayLights){runwayLights.material.size=2.6*(1+.9*k);}
  if(DL.lpts===undefined){DL.lpts=[];baseGroup.traverse(o=>{if(o.isPoints&&o!==runwayLights)DL.lpts.push([o.material,o.material.size]);});}for(const[m,s0]of DL.lpts)m.size=s0*(1+.9*k);}
function applyEnv(g){
  G.duskK=undefined;G.gold=g;SUN_BASE.copy(ENV_A.dir).lerp(ENV_B.dir,g).normalize();U.uSunDir.value.copy(SUN_BASE).lerp(SUN_EYE,G.eyeSun||0).normalize();U.uSunCol.value.copy(ENV_A.sun).lerp(ENV_B.sun,g);
  U.uSkyZen.value.copy(ENV_A.zen).lerp(ENV_B.zen,g);U.uSkyHor.value.copy(ENV_A.hor).lerp(ENV_B.hor,g);
}

// ───────────────────────── 無線 ─────────────────────────
const radioQ=[];let radioT=0,radioGap=0;
function say(who,text,dur){radioQ.push({who,text,dur:dur||1.7+text.length*.085});}
function clearRadio(){radioQ.length=0;radioT=0;$('radio').classList.remove('on');}
function updateRadio(dt){
  if(radioT>0){radioT-=dt;if(radioT<=0){$('radio').classList.remove('on');radioGap=.3;SFX.radioEnd();}return;}
  if(radioGap>0){radioGap-=dt;return;}
  const l=radioQ.shift();if(!l)return;
  const w=WHO[l.who];$('rwho').textContent=w[0];$('rwho').style.color=w[1];$('rtext').textContent=l.text;$('radio').classList.add('on');radioT=l.dur;SFX.radio();
}
let bannerT=0;
function banner(small,big){const b=$('banner');b.children[0].textContent=small;b.children[1].textContent=big;b.classList.add('on');bannerT=3.6;}
function hint(html,t){const h=$('hint');h.innerHTML=tk(html);h.hidden=false;G.hintT=t||7;}
function setObj(ph,text){$('objPhase').textContent=ph;$('objText').textContent=text;}
function warn(text,t){$('warn').textContent=text;$('warn').hidden=false;G.warnT=t||2.5;}

// ───────────────────────── 機体の配置 ─────────────────────────
function fwdOf(yaw,pitch,out){const c=Math.cos(pitch);return out.set(-Math.sin(yaw)*c,Math.sin(pitch),-Math.cos(yaw)*c);}
function syncAC(o){o.mesh.position.copy(o.pos);o.mesh.rotation.set(o.pitch,o.yaw,o.roll+(o.brA||0),'YXZ');}
function slotOf(w,out){
  const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw),rx=Math.cos(P.yaw),rz=-Math.sin(P.yaw);
  return out.set(P.pos.x+rx*w.side+fx*w.fw,P.pos.y+w.up,P.pos.z+rz*w.side+fz*w.fw);
}
function snapWing(){W.forEach(w=>{if(w.state==='gone')return;w.state='form';slotOf(w,w.pos);w.yaw=P.yaw;w.pitch=P.pitch;w.roll=0;w.mesh.visible=true;syncAC(w);});}
function gearOf(o,on){o.mesh.userData.gear.visible=on;}

// ───────────────────────── 雷 ─────────────────────────
function flashAt(x,y,z,I){U.uFlashPos.value.set(x,y,z);G.flash=Math.max(G.flash,I);const d=camera.position.distanceTo(U.uFlashPos.value);if(d<2200)G.scr=Math.max(G.scr,I*.35*(1-d/2200));}
function boltFromTo(a,b,w){let bo=bolts.find(q=>q.life<=0)||bolts[0];shapeBolt(bo,a,b,w||7);}
// 落雷が海面に当たったところ：白い蒸気としぶきが噴き上がる（近いときだけ）
function seaHit(x,z){if(Math.hypot(camera.position.x-x,camera.position.z-z)>3000)return;for(let k=0;k<14;k++){const a=Math.random()*6.283,v=6+Math.random()*16;puff(x+Math.cos(a)*3,3.6,z+Math.sin(a)*3,Math.cos(a)*v,14+Math.random()*26,Math.sin(a)*v,5+Math.random()*7,1.2+Math.random()*1.2,1,sprays);}}
function strikeAt(x,z,danger){
  const top=Math.max(rr(900,1700),danger?P.pos.y+rr(350,700):0);tA.set(x+rr(-260,260),top,z+rr(-260,260));tB.set(x,0,z);boltFromTo(tA,tB,danger?9:7);   /* 高い所を飛ぶときは自機より上から落ちる（見た目と当たり判定を合わせる） */
  flashAt(x,top*.6,z,danger?1.3:1);seaHit(x,z);
  if(strikeGlow){strikeGlow.visible=true;strikeGlow.position.set(x,14,z);strikeGlow.userData.t=0;}
  const d=Math.hypot(camera.position.x-x,camera.position.z-z);SFX.thunder(d);
  if(danger&&G.mode==='play'){const pd=Math.hypot(P.pos.x-x,P.pos.z-z);
    if(pd<DF().rad){SFX.zap();damage(17,'落雷の直撃を受けた');hudFail(.8);}
    else if(pd<260){G.shake=Math.max(G.shake,.55);glitch();hudFail(.45);}}
}
function warnStrike(x,z){const c=columns.find(q=>!q.visible);if(!c)return;c.visible=true;{const H=Math.max(3200,P.pos.y+1000);c.position.set(x,H/2,z);c.scale.set(DF().rad,H,DF().rad);}   /* 自機より上まで伸ばす（高い所で予告が見えなかった） */strikes.push({x,z,t:DF().warnT,t0:DF().warnT,col:c});SFX.warn();SFX.charge(Math.hypot(P.pos.x-x,P.pos.z-z));}
function updateStrikes(dt){
  for(let i=strikes.length-1;i>=0;i--){const s=strikes[i];s.t-=dt;
    s.col.material.uniforms.uAlpha.value=(.55+.45*Math.sin(G.t*26))*(1+sat((P.pos.y-600)/1500)*2.2);   /* 明るい雲を背にする高空では強く光らせる */
    const k=1-s.t/s.t0;s.col.scale.x=s.col.scale.z=lerp(DF().rad*1.55,DF().rad,k);{const H=Math.max(3200,P.pos.y+1000);if(H>s.col.scale.y){s.col.scale.y=H;s.col.position.y=H/2;}}
    if(s.t<=0){s.col.visible=false;strikeAt(s.x,s.z,true);strikes.splice(i,1);}}
  bolts.forEach(b=>{if(b.life>0){b.life-=dt;b.mesh.material.uniforms.uAlpha.value=b.life>0?(.35+.65*Math.abs(Math.sin(b.life*70)))*sat(b.life/.12):0;if(b.life<=0)b.mesh.visible=false;}});
}
function ambientLightning(dt){
  if(U.uStorm.value<.3)return;
  G.ambT-=dt;if(G.ambT>0)return;
  const cx=camera.position.x,cz=camera.position.z;
  for(let k=0;k<6;k++){const a=rnd()*6.283,d=rr(1500,7500),x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d,s=stormAt(x,900,z);
    if(s.c>.55){const y=rr(900,2600);
      const cg=rnd()<.45;if(cg){tA.set(x,rr(700,1500),z);tB.set(x+rr(-300,300),0,z+rr(-300,300));boltFromTo(tA,tB,10+d*.0012);seaHit(tB.x,tB.z);}
      flashAt(x,y,z,rr(.45,1));SFX.thunder(d*1.15,cg?'cg':'ic');break;}}
  G.ambT=rr(.4,2.0)/(0.35+G.gloom*1.4);
}
function glitch(){const h=$('hud');h.classList.remove('glitch');void h.offsetWidth;h.classList.add('glitch');}

// ───────────────────────── ダメージ ─────────────────────────
// 落雷で計器が落ちる（実戦以上）
function hudFail(p){if((opts.diff||0)<1||G.hudFail>0||Math.random()>p)return;G.hudFail=opts.diff>=2?10:6;if(!G.flags.hfSay){G.flags.hfSay=1;say('S','雷サージで計器が落ちた。復旧まで目視で飛べ');}}
// 損傷の出どころを数えておき、最後の文言に使う
function srcOf(c){return/ミサイル|機関砲/.test(c)?'迎撃機の攻撃':/落雷/.test(c)?'落雷':/竜巻/.test(c)?'海上竜巻':/雹/.test(c)?'雹':/火災/.test(c)?'エンジン火災':/海面/.test(c)?'海面との衝突':/建物|施設|灯台|格納庫/.test(c)?'建物との衝突':/滑走路|地面|山肌/.test(c)?'地面との衝突':'';}
function hurtBy(k,n){if(!k)return;const d=G.dmgBy||(G.dmgBy={});d[k]=(d[k]||0)+n;}
function causeText(){
  let s=(G.cause||'').replace(/。$/,'')+'。';
  if(P.hull<=0){const d=G.dmgBy||{},last=srcOf(G.cause||'');let top='',tv=0,sum=0;for(const k in d){sum+=d[k];if(d[k]>tv){tv=d[k];top=k;}}
    if(top&&top!==last&&tv>sum*.5)s+='\n損傷の多くは'+top+'によるものでした。';}
  const ph={approach:'嵐への接近中',bands:'レインバンドを通過中',wall:'壁雲を突破中',eye:'台風の目の中',spare:'予備ディフューザーの受け渡し中',ret:'基地への帰還中'}[G.phase];
  if(ph){const t=Math.floor(G.missionT);s+='\n'+ph+'（任務開始から '+Math.floor(t/60)+':'+String(t%60).padStart(2,'0')+'）';}
  return s;
}
function damage(n,cause){
  if(P.inv>0||G.mode!=='play')return;n*=DF().dmg;hurtBy(srcOf(cause),n);
  P.hull=Math.max(0,P.hull-n);P.inv=1.3;G.hurt=1;G.shake=1;if(IS_TOUCH&&navigator.vibrate)navigator.vibrate(n>15?[60,30,90]:[40]);G.stats.dmg+=n;if(!G.quietHit)SFX.hit();glitch();shedArmor(false);
  if(P.hull<=0){G.mode='dying';G.dieT=0;G.cause=cause;setAlarm(false);clearRadio();
    say(W[1].state!=='gone'?'H':'C','隊長！　応答してください、隊長！');}
  else if(P.hull<=30&&!G.flags.lowHull){G.flags.lowHull=1;say('S','機体損傷が限界に近い。これ以上の被弾は危険');}
}

// 装甲板：耐久が減るほど多く剥がれる
function shedArmor(silent){
  const need=Math.min(P.armor.length,Math.floor((100-P.hull)/6.2));let n=0,rip=false;
  for(const a of P.armor){if(n>=need)break;n++;if(!a.on)continue;a.on=false;a.scar.visible=true;
    if(silent){a.mesh.visible=false;continue;}
    rip=true;P.mesh.updateMatrixWorld();scene.attach(a.mesh);a.life=2.6;
    a.vel.copy(P.vel).multiplyScalar(.5).add(tA.set((Math.random()-.5)*26,10+Math.random()*16,(Math.random()-.5)*26));a.av.set((Math.random()-.5)*14,(Math.random()-.5)*14,(Math.random()-.5)*14);
    boomFx.visible=true;boomFx.position.copy(a.mesh.position);boomFx.userData.t=1.05;}
  if(rip){SFX.rip();G.scr=Math.max(G.scr,.12);}
}
function resetArmor(){for(let i=P.armor.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[P.armor[i],P.armor[j]]=[P.armor[j],P.armor[i]];}for(const a of P.armor){a.on=true;a.life=0;a.scar.visible=false;P.mesh.add(a.mesh);a.mesh.position.copy(a.home);a.mesh.quaternion.copy(a.homeQ);a.mesh.scale.setScalar(1);a.mesh.visible=true;}shedArmor(true);}
function updateArmor(dt){for(const a of P.armor){if(a.life<=0)continue;a.life-=dt;a.vel.y-=18*dt;a.vel.multiplyScalar(Math.exp(-dt*.9));a.mesh.position.addScaledVector(a.vel,dt);
    a.mesh.rotation.x+=a.av.x*dt;a.mesh.rotation.y+=a.av.y*dt;a.mesh.rotation.z+=a.av.z*dt;if(a.life<=0)a.mesh.visible=false;}
  // 傷口からの火花
  if(G.mode==='play'&&P.hull<45&&Math.random()<dt*(2.5-P.hull*.04)){const off=P.armor.filter(a=>!a.on);if(off.length&&!boomFx.visible){const a=off[Math.floor(Math.random()*off.length)];a.scar.getWorldPosition(boomFx.position);boomFx.visible=true;boomFx.userData.t=1.2;SFX.spark();}}
}

// ───────────────────────── プレイヤー ─────────────────────────
const CEIL={approach:1500,bands:1300,wall:1300,eye:4700,spare:4700,ret:3400};
// 地面の高さ（島の上は地形、それ以外は海面）
function groundAt(x,z){const lx=x-BASE.x,lz=z-BASE.z;return Math.abs(lx)<2700&&Math.abs(lz)<3100?Math.max(islandH(lx,lz),0):0;}
// 航行中の船：船体と上部構造の箱（船の向きに合わせた座標で判定）
function shipHit(){if(P.pos.y>60)return null;for(const s of ships){if(s.dead)continue;const L=s.m.userData.len,B=s.m.userData.beam,dx=P.pos.x-s.x,dz=P.pos.z-s.z;if(Math.abs(dx)>L||Math.abs(dz)>L)continue;
    const c=Math.cos(s.h),sn=Math.sin(s.h),lx=dx*c-dz*sn,lz=dx*sn+dz*c,k=s.m.userData.kind;
    const top=k==='cargo'?(lz>55&&lz<80?48:Math.abs(lz)<70?26:14):k==='patrol'?(Math.abs(lz+5)<10?16:8):(Math.abs(lz-1)<3?7:4.5);
    if(Math.abs(lx)<B/2+2&&Math.abs(lz)<L/2+2&&P.pos.y<top+2)return{why:{cargo:'貨物船',patrol:'巡視船',fish:'漁船'}[k]+'に激突した',ship:s};}return null;}
function hitTest(){
  {const sh=shipHit();if(sh)return sh;}
  const lx=P.pos.x-BASE.x,lz=P.pos.z-BASE.z,ly=P.pos.y-RWY_Y;if(!(Math.abs(lx)<2300&&Math.abs(lz)<2600&&P.pos.y<460))return null;
  const hz=lz-HANGAR_Z;if(Math.abs(lx)<53&&Math.abs(hz)<92&&ly<41&&!(Math.abs(lx)<42&&ly<25.5&&hz<85))return{why:'格納庫に激突した'};
  const x=P.pos.x,y=P.pos.y,z=P.pos.z,cy=Math.cos(P.yaw),sy=Math.sin(P.yaw),name=c=>lx>1050?(c&&c[6]?'港の照明塔':'港の施設'):(Math.hypot(lx-250,lz+1330)<40?'灯台':(c&&c[6]&&c[4]-c[1]>45&&lx<-200?'風車':(c&&c[6]?'基地の柱':'基地の建物')));
  for(const c of baseGroup.userData.colliders){
    if(c[6]){const px=(c[0]+c[3])/2-x,pz=(c[2]+c[5])/2-z,rp=Math.max(c[3]-c[0],c[5]-c[2])/2,lat=px*cy-pz*sy,along=-px*sy-pz*cy,dv=Math.abs(lat*Math.sin(P.roll))+3;
      if(y<c[1]-dv||y>c[4]+dv)continue;
      if(Math.abs(lat)<3+rp&&Math.abs(along)<12+rp)return{why:name(c)+'に激突した'};
      if(!P.wingLost&&Math.abs(lat)<13.5+rp&&Math.abs(along)<5+rp)return{wing:lat>0?1:-1,why:name(c)};
    }else{const R0=5;if(x>c[0]-R0&&x<c[3]+R0&&z>c[2]-R0&&z<c[5]+R0&&y>c[1]-2&&y<c[4]+2)return{why:name(c)+'に激突した'};}}
  return null;
}
// その場で爆発して機体を失う
// 機体が建物・船にぶつかったとき、その相手にもミサイル 1 発分の打撃を与える（壊れれば崩れる・沈む）
function ramHit(hit){if(!STR.init)strInit();if(hit&&hit.ship){strShipDmg(hit.ship,45);strBlast(P.pos.clone(),26,30,hit.ship);return;}fwdOf(P.yaw,P.pitch,tA);const q={pos:P.pos.clone().addScaledVector(tA,12),dir:tA.clone()};q.pos.y-=2.5;tB.copy(P.pos).addScaledVector(tA,-4);tB.y-=2.5;strHit(q,tB,16,45);   /* 当たり判定の上端の余白（2m）ぶん下げて、相手の箱に確実に入れる */}
function crashExplode(why){
  if(G.mode!=='play')return;P.inv=0;P.hull=Math.min(P.hull,1);damage(999,why);if(G.mode!=='dying')return;
  G.crash=1;G.dieT=0;P.speed=0;P.mesh.visible=false;explode(P.pos,1);vegIgnite(P.pos.x,P.pos.z,28);   // 陸に落ちたら周りの木が燃える
}
// 主翼を失う：その側の部品を消し、もげた翼を飛ばす。以後は操縦不能で、どこかに当たれば爆発
function loseWing(side,what){
  P.wingLost=side;P.wlT=0;P.wlWhat=what;P.hidden=[];P.mesh.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(P.mesh.matrixWorld).invert(),bx=new THREE.Box3(),c0=new V3();
  for(const c of P.mesh.children){if(c===P.mesh.userData.gear||!c.visible)continue;bx.setFromObject(c);if(bx.isEmpty())continue;bx.getCenter(c0).applyMatrix4(inv);if(c0.x*side>4.3){c.visible=false;P.hidden.push(c);}}
  fwdOf(P.yaw,0,tA);tB.set(tA.z*-1,0,tA.x).multiplyScalar(-side);  // 右向き×side
  const m=new THREE.Mesh(new THREE.BoxGeometry(10.5,.4,4.2),new THREE.MeshStandardMaterial({color:lin(P.mesh.userData.bodyHex||0x98a1a9),metalness:.6,roughness:.45}));m.position.copy(P.pos).addScaledVector(tB,7.5);m.rotation.set(P.pitch,P.yaw,P.roll,'YXZ');scene.add(m);
  DEBRIS.push({m,vel:P.vel.clone().multiplyScalar(.55).addScaledVector(tB,16).add(tC.set(0,9,0)),av:new V3(3+Math.random()*3,2*side,4+Math.random()*4),life:7,smoke:0});
  explode(m.position,.28);SFX.hit();SFX.rip&&SFX.rip();G.shake=1;G.hurt=1;P.hull=Math.min(P.hull,22);
  clearRadio();say('S',(side>0?'右':'左')+'主翼を喪失。操縦不能');setAlarm&&setAlarm(true);
}
const DEBRIS=[];
// 翼を失ったあとの落下
function fallNoWing(dt){
  const sd=P.wingLost;P.wlT+=dt;P.roll+=sd*(2.4+P.wlT*1.6)*dt;P.pitch=damp(P.pitch,-1.05,.7,dt);P.yaw-=sd*.45*dt;P.speed=damp(P.speed,120,.6,dt);P.power=.3;
  fwdOf(P.yaw,P.pitch,tA);P.vel.copy(tA).multiplyScalar(P.speed);P.vel.y-=9*P.wlT;P.pos.addScaledVector(P.vel,dt);G.shake=Math.max(G.shake,.45);
  if(Math.random()<dt*40){tB.set(tA.z*-1,0,tA.x).multiplyScalar(-sd);puff(P.pos.x+tB.x*4,P.pos.y+1,P.pos.z+tB.z*4,P.vel.x*.3,P.vel.y*.3+4,P.vel.z*.3,5+Math.random()*4,1.4,.8);}
  const lx=P.pos.x-BASE.x,lz=P.pos.z-BASE.z;let gy=5,land=false;if(Math.abs(lx)<2700&&Math.abs(lz)<3100){const h=islandH(lx,lz);if(h>2){gy=h+2.5;land=true;}}
  const hit=hitTest();syncAC(P);
  if(hit&&!hit.wing){ramHit(hit);crashExplode('主翼を失い、'+hit.why);return;}
  if(P.pos.y<gy){P.pos.y=gy;crashExplode(P.wlWhat+'に主翼をぶつけて失い、'+(land?'地面に激突した':'海面に突っ込んだ'));}
}
function brEvade(){let ok=false;for(const m of ICP.mis){if(m.life<=0||m.tgt||m.lost)continue;const d=m.pos.distanceTo(P.pos);if(d<750&&Math.random()<(d>150?.65:.3)){m.lost=true;ok=true;if(G.stats)G.stats.evade=(G.stats.evade||0)+1;}}
  if(ok)say(W[0].state!=='gone'?'G':'C',W[0].state!=='gone'?'振り切った！　いいロールだ':'ミサイル、外れました',1.6);}
// ── 海面への接触：地面のように弾まず、水を被る。角度が悪ければ水没（即墜落）。原型機はフロートがあり、正しい姿勢なら着水して浮かべる
const isFloatPlane=()=>{const sh=SHAPES[opts.shape];return !!(sh&&sh.orig);};
function wrapA(a){a%=6.2832;if(a>3.1416)a-=6.2832;if(a<-3.1416)a+=6.2832;return a;}
function seaPlunge(why){if(G.mode!=='play')return;P.inv=0;P.hull=Math.min(P.hull,1);damage(999,why);if(G.mode!=='dying')return;
  G.crash=1;G.dieT=0;P.speed=0;P.mesh.visible=false;explode(new V3(P.pos.x,4,P.pos.z),1.1,'splash');G.wash=1;G.lensWet=1;}
function seaContact(dt,W){
  const fl=isFloatPlane(),FW=W-.6;   // フロートで浮くときの胴体の高さ
  if(P.onWater){// 浮いている：波に揺られ、ブーストで加速、機首を上げれば離水
    const bob=Math.sin(G.t*1.3+P.pos.x*.01)*.25;P.pos.y=FW+bob;P.roll=damp(P.roll,Math.sin(G.t*1.1)*.03,3,dt);
    const iy=input.y*(opts.inv?-1:1);P.speed=damp(P.speed,P.boosting?175:14,P.boosting?.55:.8,dt);
    P.pitch=clamp(P.pitch,-.02,P.speed>105&&iy>.2?.3:.07);
    if(P.speed>105&&iy>.2&&P.pitch>.12){P.onWater=false;P.pos.y=FW+1.5;say('S','離水',1.2);}
    // 航跡としぶき（フロートの両脇）
    P.wkT=(P.wkT||0)-dt;if(P.speed>10&&P.wkT<=0){P.wkT=Math.max(.03,.25-P.speed/600);fwdOf(P.yaw,0,tA);const sx=Math.cos(P.yaw),sz=-Math.sin(P.yaw);
      for(const sd of[-1,1])bpart(BOOM.water,P.pos.x+sx*sd*2.8+tA.x*2,3.8,P.pos.z+sz*sd*2.8+tA.z*2,sx*sd*P.speed*.05,brn(1,3)+P.speed*.02,sz*sd*P.speed*.05,brn(.8,1.4),.8+P.speed*.01,3+P.speed*.03,{g:-14,dr:.8,a:.8,c:_bc.setRGB(.88,.92,.95)});}
    return;}
  if(P.pos.y>=W){P.wetC=0;return;}
  if(!BOOM.init)boomInit();
  const sink=-P.vel.y,nose=P.pitch,roll=Math.abs(wrapA(P.roll+(P.brA||0)));
  // 水没：急な降下・機首下げ・大きな傾き（主翼が水に刺さる）
  if(sink>9||nose<-.22||roll>.7){seaPlunge(roll>.7?'主翼が海面に刺さり、水没した':'海面に突っ込み、水没した');return;}
  // 着水：原型機だけ。機首わずかに上げ・翼ほぼ水平・ゆっくり降りる
  if(fl&&nose>-.06&&nose<.4&&roll<.3&&sink<5.5){P.onWater=true;P.pos.y=FW;P.pitch=.03;G.wash=Math.max(G.wash||0,.35);G.lensWet=Math.max(G.lensWet||0,.6);SFX.splash();
    for(let i=0;i<14;i++)bpart(BOOM.water,P.pos.x+brn(-6,6),4,P.pos.z+brn(-6,6),brn(-5,5),brn(4,12),brn(-5,5),brn(1,1.8),2,8,{g:-16,dr:.6,a:.85,c:_bc.setRGB(.88,.92,.95)});
    if(!G.flags.splashdown){G.flags.splashdown=1;say('C','着水を確認。フロートで浮いています。ブーストで加速し、機首を上げれば離水できます',4.5);}return;}
  // それ以外：海面をかすめて水を被る。強く減速し、少し損傷。押し上げは穏やか（弾まない）
  if(!P.wetC){P.wetC=1;P.speed*=.78;SFX.splash();}
  P.speed*=Math.exp(-dt*2.6);P.pos.y=W;P.pitch=damp(P.pitch,Math.max(P.pitch,.06),3,dt);
  G.wash=Math.max(G.wash||0,.75);G.lensWet=1;
  P.skT=(P.skT||0)-dt;if(P.skT<=0){P.skT=.35;G.quietHit=1;damage(Math.round(5+sink*1.8+P.speed*.02),'海面に接触した');G.quietHit=0;}
  fwdOf(P.yaw,0,tA);for(let i=0;i<3;i++)bpart(BOOM.water,P.pos.x+brn(-5,5)-tA.x*4,4,P.pos.z+brn(-5,5)-tA.z*4,brn(-6,6)-tA.x*P.speed*.15,brn(6,16),brn(-6,6)-tA.z*P.speed*.15,brn(1,2),3,brn(10,18),{g:-18,dr:.5,a:.9,c:_bc.setRGB(.88,.92,.95)});
  if(P.speed<60)seaPlunge('失速して海に沈んだ');}
function updatePlayer(dt){
  if(P.wingLost){fallNoWing(dt);return;}
  const ix=input.x,iy=input.y*(opts.inv?-1:1);
  const wantBoost=input.boost&&!P.engineOut;
  const boosting=wantBoost&&P.boost>(P.boosting?0.5:12);
  if(boosting&&!P.boosting)SFX.boost();
  P.boosting=boosting;
  P.boost=clamp(P.boost+(boosting?-20:(G.phase==='ret'?26:12))*dt,0,100);
  const ctl=P.ice?.5:1;
  const tgt=(boosting?255:150)*(P.engineOut?.62:1)*(P.ice?.86:1)*(P.fire?.8:1);
  P.speed=damp(P.speed,tgt,boosting?1.6:1.0,dt);
  P.power=damp(P.power,P.engineOut?.2:(boosting?1.5:.75),3,dt);
  // 乱気流
  const s=stormAt(P.pos.x,P.pos.y,P.pos.z);
  let tau=(P.pos.y<s.top?s.c*.3+s.wall*.7:0)+G.gust+(G.phase==='spare'?.35:0);tau=Math.min(tau*DF().turb,2.3)*U.uStorm.value;
  const t=G.t,n1=Math.sin(t*2.3)+Math.sin(t*3.7+1)+Math.sin(t*6.1+2),n2=Math.sin(t*1.9+4)+Math.sin(t*4.3)+Math.sin(t*7.7+1),n3=Math.sin(t*1.1)+Math.sin(t*2.9+3);
  P.turb=tau;P.g=1+(Math.hypot(1,P.speed*Math.abs(ix)*(boosting?.6:.82)/9.8)-1)*.36+iy*.6;
  P.yaw+=(-ix*(boosting?.6:.82)*ctl+(P.engineOut?-.11:0)+n3*tau*.02)*dt;
  P.roll=damp(P.roll,-ix*.95+n1*tau*.11+P.spin,4.5,dt);
  P.spin=damp(P.spin,0,1.2,dt);
  // バレルロール：機体を 1 回転させながら小さならせんを描く（近づいたミサイルを振り切れることがある）
  P.brCD=Math.max(0,(P.brCD||0)-dt);
  if(input.rollQ){if(!P.br&&P.brCD<=0&&!P.engineOut&&P.pos.y>40){P.br={t:0,d:input.rollQ};P.brCD=1.7;SFX.boost();brEvade();}input.rollQ=0;}
  if(P.br){const D=1.0;P.br.t+=dt;const u=Math.min(1,P.br.t/D),e=u*u*(3-2*u);P.brA=-P.br.d*6.2832*e;P.brPh=6.2832*e;P.brW=6.2832*6*u*(1-u)/D;if(u>=1){P.br=null;P.brA=0;}}
  let pT=iy*.56*(P.ice?.6:1)+n2*tau*.035;
  const ceil=CEIL[G.phase]||3000;
  if(P.pos.y>ceil-200){pT=Math.min(pT,-(P.pos.y-(ceil-200))/200*.4);if(!G.flags.ceilWarn&&P.pos.y>ceil-60){G.flags.ceilWarn=1;say('S',G.phase==='eye'||G.phase==='spare'?'これ以上は上昇できない':'雲中は着氷の危険。高度を下げろ');}}
  if(P.pos.y<6.5&&G.down<.1&&!(isFloatPlane()&&!P.boosting))pT=Math.max(pT,(6.5-P.pos.y)/6.5*.25);   // 海面すれすれで機首を上げる補助。原型機はブーストしていなければ外し、着水できるようにする
  P.pitch=damp(P.pitch,pT,2.6,dt);
  fwdOf(P.yaw,P.pitch,tA);
  P.wind=windAt(P.pos,tB);
  P.vel.copy(tA).multiplyScalar(P.speed).addScaledVector(tB,.8*DF().wind);
  P.vel.y+=n2*tau*9-G.down*62;P.vel.x+=n1*tau*7;P.vel.z+=n3*tau*7;
  P.vel.add(P.fling);P.fling.multiplyScalar(Math.exp(-dt*2.2));
  if(P.br){const R=15,c=Math.cos(P.brPh)*R*P.brW,s=Math.sin(P.brPh)*R*P.brW*P.br.d;P.vel.y+=c;P.vel.x+=Math.cos(P.yaw)*s;P.vel.z-=Math.sin(P.yaw)*s;}
  P.pos.addScaledVector(P.vel,dt);
  // 海面と島の地表への接触
  {const lx=P.pos.x-BASE.x,lz=P.pos.z-BASE.z;let gy=5.5,why='海面に突っ込んだ',land=false;
    if(Math.abs(lx)<2700&&Math.abs(lz)<3100){const h=islandH(lx,lz);if(h>4){land=true;gy=h+3.2;
      why=Math.abs(lx)<60&&Math.abs(lz-HANGAR_Z)<95?'格納庫に激突した':Math.abs(lx-30)<150&&Math.abs(lz-130)<1180?'滑走路に激突した':Math.abs(lx-250)<380&&Math.abs(lz-150)<480?'基地の地面に激突した':h>70?'島の山肌に激突した':'島の地面に激突した';}}
    if(land){if(P.pos.y<gy){P.pos.y=gy+2;P.pitch=.32;SFX.scrape();SFX.hit();G.quietHit=1;damage(18,why);G.quietHit=0;P.fling.y=30;}}
    else seaContact(dt,gy);}
  // 建物・港の施設・灯台・格納庫の外殻への衝突。細長い柱は、胴体に当たれば即爆発、主翼に当たればその翼がもげる
  {const hit=hitTest();if(hit&&G.mode==='play'){ramHit(hit);if(hit.wing)loseWing(hit.wing,hit.why);else crashExplode(hit.why);}}
  P.inv=Math.max(0,P.inv-dt);
  syncAC(P);P.mesh.userData.ctlR=ix;P.mesh.userData.ctlP=iy;
  // 翼端雲
  P.mesh.updateMatrixWorld();
  const hum=P.pos.y<s.top+400?1:.4,gl=sat((P.g-1.15)/1.2);
  const str=sat((s.c*.5+Math.abs(ix)*.5+(boosting?.35:0)+gl*.6)*hum)*.5;
  // 急な引き起こし・旋回では主翼の上に一瞬の水蒸気の幕（湿った空気ほど濃い）
  if(gl>.15&&Math.random()<dt*40*gl*hum*(.4+s.c)){fwdOf(P.yaw,P.pitch,tA);const tp=P.mesh.userData.tipPos,u=(Math.random()*2-1)*.8;tD.set(tp.x*u,tp.y+.6,tp.z-1.2+Math.random()*1.5);P.mesh.localToWorld(tD);
    puff(tD.x,tD.y,tD.z,P.vel.x*.85,P.vel.y*.85+1,P.vel.z*.85,1.2+Math.random()*1.4,.35+Math.random()*.25,.55*gl);}
  tC.set(1,0,0).applyQuaternion(P.mesh.quaternion);
  for(let i=0;i<2;i++){const tp=P.mesh.userData.tipPos;tD.set(i?tp.x:-tp.x,tp.y,tp.z);P.mesh.localToWorld(tD);pushTrail(trails[i],tD,tC,str*.3,dt,.3);}
}
// 僚機が撃たれた瞬間
function wingHit(w){
  if(w.state==='gone'||w.state==='down')return;explode(w.pos,.55);G.shake=Math.max(G.shake,.5);w.state='down';w.downT=0;w.shot=true;w.power=.05;G.stats.shot=true;G.stats.saved=false;
  if(w===W[1]&&G.flags.stall){G.flags.stall=0;G.prompt=null;carrierRing.visible=false;G.target=G.prevTarget;G.targetLabel=G.prevLabel;setObj('PHASE 1　レインバンド','落雷を避けて中心へ進め');}
  const i=W.indexOf(w);if(i===0){say('G','ぐあっ…！　やられた、操縦が利かん…隊長、逃げろ！',3.2);if(!G.spareGiven&&G.phase!=='ret')ICP.doomed=true;}else say('H','うわあっ！　た、隊長…っ！',2.6);
}
// 撃たれた僚機が煙を引いて落ちていく
function wingFall(w,i,dt){
  w.downT=(w.downT||0)+dt;w.roll+=dt*(2.2+w.downT)*(i?1:-1);w.pitch=damp(w.pitch,-1.0,.8,dt);fwdOf(w.yaw,w.pitch,tA);w.pos.addScaledVector(tA,130*dt);w.pos.y-=6*w.downT*dt;
  if(Math.random()<dt*45)puff(w.pos.x,w.pos.y+1,w.pos.z,0,4,0,5+Math.random()*4,1.6,.85);
  const lx=w.pos.x-BASE.x,lz=w.pos.z-BASE.z,gy=Math.abs(lx)<2700&&Math.abs(lz)<3100?Math.max(islandH(lx,lz),4):4;
  if(w.pos.y<gy+2||w.downT>9){explode(w.pos,.7);w.state='gone';w.mesh.visible=false;return;}
  syncAC(w);animAircraft(w.mesh,G.t,.05,w.ph);
}
function updateWing(dt){
  const tau=P.turb||0,t=G.t;
  W.forEach((w,i)=>{
    if(w.state==='down'){wingFall(w,i,dt);return;}
    if(w.state==='gone'){w.mesh.visible=false;return;}
    // 隊長機が墜落・操縦不能になったら、編隊を解いて自分の針路で水平飛行に戻り、安全な高度まで上がる（一緒に地面へ突っ込まない）
    const wgx=w.pos.x-BASE.x,wgz=w.pos.z-BASE.z,wg=Math.abs(wgx)<2700&&Math.abs(wgz)<3100?Math.max(islandH(wgx,wgz),0):0;
    if((w.state==='form'||w.state==='dockfly')&&(G.mode==='dying'||P.wingLost||G.crash)){
      if(!w.brk){w.brk=1;w.brkYaw=w.yaw+(i?-.5:.5);}
      const low=w.pos.y<wg+160;w.yaw=damp(w.yaw,w.brkYaw,.9,dt);w.pitch=damp(w.pitch,low?.24:.03,1.6,dt);w.roll=damp(w.roll,(w.brkYaw-w.yaw)*-1.2,2.5,dt);
      fwdOf(w.yaw,w.pitch,tB);w.pos.addScaledVector(tB,150*dt);if(w.pos.y<wg+18)w.pos.y=wg+18;
      syncAC(w);animAircraft(w.mesh,t,1.1,w.ph);return;
    }
    w.brk=0;
    if(w.state==='form'||w.state==='dockfly'){
      slotOf(w,tA);
      if(w.state==='dockfly'){const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw),rx=Math.cos(P.yaw),rz=-Math.sin(P.yaw);tA.set(P.pos.x-rx*40+fx*26,P.pos.y+4,P.pos.z-rz*40+fz*26);}
      const k=1+tau*1.6;
      tA.x+=Math.sin(t*.7+w.ph)*9*k;tA.y+=Math.sin(t*1.1+w.ph*2)*6*k;tA.z+=Math.cos(t*.5+w.ph)*9*k;
      const sp=w.state==='dockfly'?3.2:1.7;
      w.pos.x=damp(w.pos.x,tA.x,sp,dt);w.pos.y=damp(w.pos.y,tA.y,sp,dt);w.pos.z=damp(w.pos.z,tA.z,sp,dt);if(G.mode==='play'&&!w.mesh.userData.gear.visible){const fl=wg+Math.max(14,Math.min(90,-P.vel.y*1.5));if(w.pos.y<fl)w.pos.y=damp(w.pos.y,fl,6,dt);if(w.pos.y<wg+14)w.pos.y=wg+14;}
      w.yaw=damp(w.yaw,P.yaw,2.2,dt);w.pitch=damp(w.pitch,P.pitch+Math.sin(t*1.3+w.ph)*.03*k,2,dt);
      w.roll=damp(w.roll,P.roll*.85+Math.sin(t*1.7+w.ph)*.07*k,3,dt);
    }else if(w.state==='stall'){
      w.yaw-=.045*dt;w.pitch=damp(w.pitch,-.07,1,dt);w.roll=Math.sin(t*2.1)*.35;
      fwdOf(P.yaw,0,tB);const ahead=(w.pos.x-P.pos.x)*tB.x+(w.pos.z-P.pos.z)*tB.z;
      fwdOf(w.yaw,0,tA);const v=P.speed*(ahead<90?1.22:ahead>170?.9:1);w.pos.addScaledVector(tA,v*dt);
      w.pos.y=Math.max(170,w.pos.y-8*dt);
    }else if(w.state==='carrier'){
      const d=w.pos.distanceTo(P.pos);
      w.ang+=140/1100*dt;tA.set(Math.cos(w.ang)*1100,2850+Math.sin(t*.8)*30,Math.sin(w.ang)*1100);
      w.pos.lerp(tA,1-Math.exp(-dt*1.5));w.yaw=damp(w.yaw,-w.ang+Math.PI,3,dt);w.roll=.3+Math.sin(t*2)*.12;w.pitch=Math.sin(t*1.4)*.05;
      if(d<700&&G.mode==='play'){w.state='dockfly';w.yaw=nearAngle(w.yaw,P.yaw);say('G','見えた、隊長。横に付く。そのまま真っ直ぐ頼む');}
    }
    syncAC(w);animAircraft(w.mesh,t,w.state==='stall'?.05:.8,w.ph);
  });
}
function nearAngle(a,ref){while(a-ref>Math.PI)a-=Math.PI*2;while(a-ref<-Math.PI)a+=Math.PI*2;return a;}
function chaseCam(dt,snap){
  const k=snap?1:1-Math.exp(-dt*3.4);
  P.camYaw=lerp(P.camYaw,P.yaw,k);P.camPitch=lerp(P.camPitch,P.pitch*.62,snap?1:1-Math.exp(-dt*2.4));
  fwdOf(P.camYaw,P.camPitch,tA);
  const sh=(G.shake*2.6+(P.turb||0)*1.3)*(opts.calm?.3:1);
  const lowV=sat(1-(P.pos.y-12)/60);
  const tt=G.t,sx=Math.sin(tt*23.1)*.6+Math.sin(tt*37.7+1.3)*.4,sy=Math.sin(tt*19.3+.7)*.6+Math.sin(tt*41.9+2.1)*.4,sz=Math.sin(tt*29.3+2.9)*.5;
  camera.position.copy(P.pos).addScaledVector(tA,-47).add(tB.set(sx*sh*.5,11.5+lowV*8+sy*sh*.5,sz*sh*.5));
  tC.copy(P.pos).addScaledVector(tA,70);tC.y+=5-lowV*13;
  camera.up.set(Math.sin(P.roll*.22)*Math.cos(P.camYaw)*-1,1,Math.sin(P.roll*.22)*Math.sin(P.camYaw)).normalize();
  camera.lookAt(tC);if(sh>.02)camera.rotateZ((Math.sin(tt*17.9)*.6+Math.sin(tt*31.3+1.1)*.4)*sh*.006);
  const fov=62+(P.speed-150)*.11;if(Math.abs(camera.fov-fov)>.05){camera.fov=damp(camera.fov,fov,4,dt);camera.updateProjectionMatrix();}
}
function setCam(px,py,pz,lx,ly,lz,fov){camera.up.set(0,1,0);camera.position.set(px,py,pz);camera.lookAt(lx,ly,lz);if(fov&&camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}}

// ───────────────────────── フェーズ ─────────────────────────
// セーブポイント。mid=true のときは局面の途中から：位置・向きと「済み」の出来事を記録する（進行中の危険の残り時間は持ち越さない）
function saveCkpt(ph,mid){if(ICP.st||ICP.doomed)return;if(!mid&&G.ckpt&&G.ckpt.ph===ph&&G.ckpt.pos)return;   /* 途中から再開したときは、局面の始まりのセーブで上書きしない */const c={ph,hull:P.hull,w:W.map(w=>w.state==='gone'?'gone':'form'),saved:G.stats.saved};
  if(mid){c.pos=P.pos.clone();c.yaw=P.yaw;const f={};for(const k in G.flags){const v=G.flags[k];if(typeof v==='number'||typeof v==='boolean')f[k]=v;}for(const k of['downT','hailT','gustT','stallT','shearT','link'])delete f[k];f.stall=0;c.flags=f;}
  const isNew=!G.ckpt||G.ckpt.ph!==ph||!!G.ckpt.pos!==!!mid||(mid&&G.ckpt.pos&&G.ckpt.pos.distanceTo(P.pos)>500);G.ckpt=c;if(isNew&&G.mode==='play'&&mid)toast('チェックポイント',1.6);}
function resetHaz(){P.onWater=false;P.wetC=0;G.lensWet=0;G.wash=0;strikes.forEach(s=>s.col.visible=false);strikes.length=0;G.gust=0;G.down=0;G.prompt=null;G.hudFail=0;P.ice=0;P.iceT=0;P.fire=false;P.fireT=0;P.gearJam=false;P.gearN=0;G.gateHit=0;$('prompt').hidden=true;$('timer').hidden=true;$('warn').hidden=true;setAlarm(false);
  rings.forEach(r=>r.visible=false);gateRings.forEach(r=>r.visible=false);coreShell.visible=coreGlow.visible=false;carrierRing.visible=false;G.lock=0;P.fling.set(0,0,0);P.spin=0;P.engineOut=false;P.inv=1.5;if(tether)tether.visible=false;}
function enterPhase(ph,fresh){
  G.phase=ph;G.pt=0;G.flags.ceilWarn=0;
  if(ph==='approach'){
    setObj('PHASE 1　接近','台風の外縁へ向かえ');G.target=new V3(0,500,0);G.targetLabel='台風中心';
    setMood('launch');
    if(fresh){hint('<kbd>W</kbd><kbd>S</kbd> 機首の上げ下げ　<kbd>A</kbd><kbd>D</kbd> 旋回　<kbd>Shift</kbd> ブースト',9);
      say('C','ストームライダー隊、進路そのまま。台風13号〈オロチ〉の外縁まで2キロです');}
  }else if(ph==='bands'){
    setObj('PHASE 1　レインバンド','落雷を避けて中心へ進め');banner('PHASE 1','レインバンド突破');setMood('storm');MUS.intensity=1;G.strikeT=5;
  }else if(ph==='wall'){
    setObj('PHASE 2　壁雲','マーカーを頼りに壁雲を突き抜けろ');banner('PHASE 2','壁雲突入');setMood('storm');MUS.intensity=2;G.strikeT=2;
    say('C','壁雲に突入します。視界はほぼゼロ、風速は70メートルを超えます。マーカーだけを見てください');
    if(W[1].state!=='gone')say('H','な、何も見えません…！　隊長、どこですか！');
    say('G','喋るな、舌を噛むぞ！');
  }else if(ph==='eye'){
    U.uEye.value=1;G.ringIdx=0;G.lock=0;
    setMood('eye');banner('PHASE 3','台風の目');
    P.hull=Math.min(100,P.hull+DF().heal);saveCkpt('eye');
    if(fresh){if(W[1].state!=='gone')say('H','…晴れてる。ここが、台風の目…');
      say('C','台風の目に入りました。風が弱いうちに機体を立て直してください');
      say('C','観測リングを5つ通過すれば、コアの座標を確定できます');}
    nextRing();
  }else if(ph==='spare'){
    G.eyeT=G.eyeT0=DF().eyeT;U.uEye.value=1;G.dock=0;P.hasPod=false;G.spareGiven=false;G.lock=0;saveCkpt('spare');
    setMood('climax');banner('PHASE 4','予備弾の受け渡し');
    W[0].state='carrier';W[0].ang=Math.atan2(P.pos.z,P.pos.x)+2.2;W[0].pos.set(Math.cos(W[0].ang)*1100,2850,Math.sin(W[0].ang)*1100);
    setObj('PHASE 4　再攻撃','2番機と並走し、予備のディフューザーを受け取れ');G.target=W[0].pos;G.targetLabel='2番機（予備弾）';
    coreShell.visible=true;$('timer').hidden=false;G.strikeT=4;
    if(fresh){hint('2番機には発射装置が無い。並走して予備弾を受け取る',8);warn('ディフューザー喪失　予備弾を受け取れ',4);}
  }else if(ph==='ret'){
    U.uStorm.value=0;U.uEye.value=1;applyEnv(1);saveCkpt('ret');G.gate=0;
    setMood('return');banner('PHASE 5','帰投');
    setObj('PHASE 5　帰投','ミズハ基地へ帰投せよ');G.target=new V3(0,420,BASE.z-4300);G.targetLabel='進入開始点';
    gateRings.forEach(r=>r.visible=true);
    if(fresh)say('C','全機、帰投コースに乗ってください。追い風です、ブーストが早く回復します');
  }
  syncPods();
}
function syncPods(){W[0].mesh.userData.pod.visible=!G.spareGiven;W[1].mesh.userData.pod.visible=false;P.mesh.userData.pod.visible=P.hasPod;}
function nextRing(){
  rings.forEach((r,i)=>{r.visible=i>=G.ringIdx;r.material.uniforms.uAlpha.value=i===G.ringIdx?1:.25;});
  if(G.ringIdx<5){G.target=rings[G.ringIdx].position;G.targetLabel='観測リング '+(G.ringIdx+1)+'/5';setObj('PHASE 3　台風の目','観測リングを通過せよ（'+G.ringIdx+' / 5）');}
  else{coreShell.visible=coreGlow.visible=true;G.target=CORE;G.targetLabel='コア';setObj('PHASE 3　台風の目','コアに機首を向けてロックオンせよ');
    say(W[1].state!=='gone'?'H':'C','コアの座標、確定しました！');say('C','高度3400、目の中心です。機首を向け続ければロックオンします');}
}
function startRun0(){TM.forEach(m=>m.visible=false);icpReset();W.forEach(w=>{w.shot=false;w.downT=0;});if(G.stats)G.stats.shot=false;G.dieWall=0;G.dmgBy={};G.crash=0;G.boomBig=0;if(P.mesh)P.mesh.visible=true;if(P.hidden){for(const c of P.hidden)c.visible=true;P.hidden=null;}P.wingLost=0;for(const d of DEBRIS)scene.remove(d.m);DEBRIS.length=0;}
function startRun(ph){startRun0();
  resetHaz();clearRadio();
  U.uStorm.value=1;U.uEye.value=1;G.eyeSun=ph==='eye'||ph==='spare'?1:0;applyEnv(0);P.hasPod=true;P.speed=150;P.boost=100;P.pitch=0;P.roll=0;
  G.flags={};G.spareGiven=(ph==='ret');if(ph==='ret'||ph==='spare')P.hasPod=false;$('fade').style.opacity=0;finalMat.uniforms.uWhite.value=0;G.white=0;
  spouts.forEach((s,i)=>s.mesh.visible=i<DF().spouts);
  if(G.ckpt&&ph!=='approach'){W.forEach((w,i)=>{w.state=G.ckpt.w[i];});G.stats.saved=G.ckpt.saved;P.hull=Math.max(G.ckpt.hull,DF().floor);}
  else{W.forEach(w=>w.state='form');P.hull=100;G.stats.saved=null;}
  if(ph==='approach'){P.pos.set(0,420,BASE.z-2700);P.yaw=0;}
  else if(ph==='eye'){P.pos.set(0,480,2100);P.yaw=0;G.flags.b1=G.flags.b2=G.flags.b3=G.flags.b4=G.flags.b5=1;}
  else if(ph==='spare'){P.pos.set(500,3000,2000);P.yaw=.25;}
  else if(ph==='ret'){P.pos.set(0,2400,4200);P.yaw=Math.PI;spouts.forEach(s=>s.mesh.visible=false);}
  const mid=G.ckpt&&G.ckpt.ph===ph&&G.ckpt.pos;if(mid){P.pos.copy(G.ckpt.pos);P.yaw=G.ckpt.yaw;if(ph==='ret')spouts.forEach(s=>s.mesh.visible=false);}
  P.camYaw=P.yaw;P.camPitch=0;snapWing();trails.forEach(resetTrail);resetArmor();G.indoor=0;setDoors(1);hangarLight(1);
  gearOf(P,false);W.forEach(w=>gearOf(w,false));
  G.mode='play';document.body.classList.remove('cine');$('hud').hidden=false;$('skip').hidden=true;
  ['title','over','res','pause','help','opts'].forEach(i=>$(i).hidden=true);
  enterPhase(ph,!mid);if(mid)Object.assign(G.flags,G.ckpt.flags);syncAC(P);chaseCam(0,true);
}

function updatePhase(dt){
  const r=Math.hypot(P.pos.x,P.pos.z),f=G.flags,D=opts.diff||0;G.pt+=dt;
  if(G.phase==='approach'){if(r<15300){enterPhase('bands');saveCkpt('bands',true);}}
  else if(G.phase==='bands'){
    if(!f.b1&&r<14300){f.b1=1;say('C','レインバンドに入りました。落雷の予兆は赤い光の柱で表示します。柱から離れてください');hint('赤い柱＝落雷の予告。旋回して離れる',7);}
    if(D>=1&&!f.ice&&r<13500){f.ice=1;P.ice=1;P.iceT=0;warn('着氷',3);say('C','翼に氷が付き始めました。舵が重くなります。ブーストの排熱で落としてください');}
    if(D>=2&&!f.hail&&r<9700&&!f.stall){f.hail=1;f.hailT=10;warn('雹　高度180m以下へ',4);say('C','雹の帯に入ります！　高度を180メートル以下まで下げて、下をくぐってください');}
    if(!f.b2&&r<12600){f.b2=1;f.gustT=8;warn('乱気流',3);say('G','くっ、揺れる…！　この旧式じゃ翼がもげそうだ');MUS.intensity=1;}
    if(!f.b3&&r<10800){f.b3=1;startStall();}
    if(!f.b4&&r<8600&&!f.stall){f.b4=1;f.downT=6.5;warn('ダウンバースト　機首を上げろ',4);setAlarm(true);say('C','上空から強い下降気流！　機首を上げて、ブーストで抜けてください');}
    if(!f.b5&&r<7300){f.b5=1;say('C','前方に海上竜巻を複数確認しました。触れないよう迂回してください');say('G','おい、あれには近づくなよ…うおっ、引っ張られる！');}
    if((opts.diff||0)>=1&&!f.ck2&&r<7800&&f.b3&&!f.stall&&!(f.downT>0)&&!(f.hailT>0)){f.ck2=1;saveCkpt('bands',true);}   // レインバンド後半（実戦・極限）
    if(r<4750){enterPhase('wall');saveCkpt('wall',true);}
  }else if(G.phase==='wall'){
    if(r<EYE_R-60)enterPhase('eye',true);
    if(D>=1){f.shearT=(f.shearT===undefined?3:f.shearT)-dt;if(f.shearT<=0){f.shearT=D>=2?3.4:5;const s=Math.random()<.5?-1:1;fwdOf(P.yaw,0,tA);P.fling.set(tA.z*s*58,(Math.random()-.5)*30,-tA.x*s*58);P.spin=s*.8;G.shake=Math.max(G.shake,.8);warn('風向急変',1.2);SFX.boost();}
      if(D>=2&&!f.ice2&&r<3900){f.ice2=1;P.ice=1;P.iceT=0;warn('着氷',2.5);}}
    if(r>5900&&G.pt>3){G.phase='bands';setObj('PHASE 1　レインバンド','落雷を避けて中心へ進め');}
  }else if(G.phase==='eye'){
    if(G.ringIdx<5){
      if(P.pos.distanceTo(rings[G.ringIdx].position)<150){G.ringIdx++;SFX.pickup();SFX.gate();nextRing();
        if(G.ringIdx===2&&W[1].state!=='gone')say('H','観測データ、順調に集まっています');
        if(G.ringIdx===3)say('G','壁が動いてる…長居は無用だぞ');}
    }else updateLock(dt,2400,()=>startCut(CUT_FIRE1));
  }else if(G.phase==='spare'){
    if(D>=2&&!f.fire&&G.eyeT<G.eyeT0-14){f.fire=1;P.fire=true;P.fireT=0;warn('エンジン火災',3);setAlarm(true);SFX.stall();say('S','左エンジン火災。消火装置を作動させろ');}
    G.eyeT-=dt;U.uEye.value=lerp(.45,1,sat(G.eyeT/G.eyeT0));
    $('timer').textContent='目が閉じるまで '+Math.max(0,G.eyeT).toFixed(1);
    if(G.eyeT<=0){fail('目が閉じ、コアを見失った');return;}
    if(P.fire){}
    else if(!P.hasPod){
      const w=W[0],d=w.pos.distanceTo(P.pos);carrierRing.visible=true;carrierRing.position.copy(w.pos);carrierRing.quaternion.copy(camera.quaternion);
      if(d<135){G.dock+=dt;if(!f.dockSay){f.dockSay=1;say('G','受け渡しアームを伸ばす。そのまま…そのままだ');}
        tether.visible=true;tA.copy(w.pos);tA.y-=2;tB.copy(P.pos);tB.y-=2;tether.position.copy(tA).add(tB).multiplyScalar(.5);tether.lookAt(tB);tether.scale.set(1,1,tA.distanceTo(tB));tether.material.uniforms.uAlpha.value=.5+.5*Math.sin(G.t*20);}
      else{G.dock=Math.max(0,G.dock-dt*.4);tether.visible=false;}
      G.prompt=d<400?{t:'予備弾を受け渡し中　2番機の近くで並走を保て',p:G.dock/2.6}:null;
      if(G.dock>=2.6){tether.visible=false;G.prompt=null;carrierRing.visible=false;startCut(CUT_HAND);return;}
    }else updateLock(dt,1500,()=>startCut(CUT_FIRE2));
  }else if(G.phase==='ret'){
    const z=P.pos.z;
    if(!f.e1&&z>10000){f.e1=1;P.engineOut=true;P.restart=0;SFX.stall();warn('右エンジン停止',3);setAlarm(true);say('S','右エンジン停止。再始動シーケンスを実行せよ');
      if(W[1].state!=='gone')say('H','隊長の機体から煙が！');}
    if(D>=1&&!f.gear&&!P.engineOut&&f.e1&&z>BASE.z-7600){f.gear=1;P.gearJam=true;P.gearN=0;warn('油圧低下',3);SFX.caution();say('S','油圧低下。脚が下りない。手動で展開しろ');}
    if(P.gearJam&&!P.engineOut){if(input.actHit){P.gearN++;SFX.spark();}G.prompt={t:'<kbd>Space</kbd> を連打して脚を手動で下ろせ',p:P.gearN/9};
      if(P.gearN>=9){P.gearJam=false;G.prompt=null;SFX.gear();say('G','脚が出たぞ。ロックも掛かった、降りられる');}}
    if(P.engineOut){
      if(input.act)P.restart+=dt;else P.restart=Math.max(0,P.restart-dt*.6);
      G.prompt={t:'<kbd>Space</kbd> を押し続けてエンジンを再始動',p:P.restart/2.2};
      if(P.restart>=2.2){P.engineOut=false;G.prompt=null;alarmOff();SFX.restart();say('G','火が入ったな。まったく、最後まで世話の焼ける機体だ');}
    }
    if(D>=1&&!f.ck3&&z>BASE.z-6600&&f.e1&&!P.engineOut&&!P.gearJam&&(D<1||f.gear)&&G.gate===0){f.ck3=1;saveCkpt('ret',true);}   // 帰投の途中（実戦・極限）
    while(G.gate<3&&z>gateRings[G.gate].position.z-40){
      const g=gateRings[G.gate];if(Math.hypot(P.pos.x-g.position.x,P.pos.y-g.position.y)<170){SFX.pickup();SFX.gate();G.gateHit=(G.gateHit||0)+1;}g.visible=false;G.gate++;
    }
    if(G.gate<3){G.target=gateRings[G.gate].position;G.targetLabel='進入ゲート '+(G.gate+1)+'/3';if(z>BASE.z-6000&&!f.e2){f.e2=1;setObj('PHASE 5　帰投','進入ゲートを通って滑走路へ降下せよ');say('C','ミズハ管制です。滑走路が見えますか。ゲートに沿って降りてきてください');}}
    else{G.target=tA.set(0,RWY_Y+10,BASE.z-900).clone();G.targetLabel='滑走路';}
    const dx=Math.abs(P.pos.x),dz=BASE.z-950-z;
    if(!P.engineOut&&!P.gearJam&&(D<2||G.gateHit>=3)&&dx<260&&dz<1100&&dz>-200&&P.pos.y<420&&Math.cos(P.yaw)<-.6){startCut(CUT_LAND);return;}
    if(D>=2&&G.gate>=3&&G.gateHit<3&&!f.gateSay){f.gateSay=1;say('C','進入ゲートを通過できていません。着陸は許可できません、やり直してください');}
    if(!f.e3&&z>BASE.z-600&&G.gate>=3){f.e3=1;say('C','進入コースを外れています。北側から回り込んでやり直してください');G.gate=0;G.gateHit=0;f.gateSay=0;gateRings.forEach(g=>g.visible=true);f.e3=0;f.e4=1;}
  }
  // 持続イベント
  if(P.ice){if(P.boosting)P.iceT+=dt;G.prompt={t:'着氷：<kbd>Shift</kbd> ブーストの排熱で氷を落とせ',p:P.iceT/2.4};if(P.iceT>=2.4){P.ice=0;G.prompt=null;SFX.rip();say('G','氷が剥がれた。舵が戻ったな');}}
  if(f.hailT>0){f.hailT-=dt;if(P.pos.y>180){P.hull-=3.4*dt;G.hurt=Math.max(G.hurt,.4);G.shake=Math.max(G.shake,.3);G.stats.dmg+=3.4*dt;hurtBy('雹',3.4*dt);f.hailN=(f.hailN||0)+dt;if(f.hailN>1){f.hailN=0;SFX.hit();shedArmor(false);}if(P.hull<=0){P.hull=.5;P.inv=0;damage(5,'雹で機体が破損した');}}
    if(f.hailT<=0)say('C','雹の帯を抜けました');}
  if(P.fire){if(input.act)P.fireT+=dt;else P.fireT=Math.max(0,P.fireT-dt*.5);P.hull-=1.6*dt;G.stats.dmg+=1.6*dt;hurtBy('エンジン火災',1.6*dt);G.hurt=Math.max(G.hurt,.3);G.prompt={t:'<kbd>Space</kbd> を押し続けて消火',p:P.fireT/2};
    if(P.hull<=0){P.hull=.5;P.inv=0;damage(5,'エンジン火災で機体を失った');}
    else if(P.fireT>=2){P.fire=false;G.prompt=null;alarmOff();SFX.restart();say('S','消火を確認。推力は回復した');}}
  if(f.gustT>0){f.gustT-=dt;G.gust=damp(G.gust,f.gustT>0?.9:0,3,dt);}else G.gust=damp(G.gust,0,2,dt);
  if(f.downT>0){f.downT-=dt;G.down=damp(G.down,f.downT>1?1:0,2.5,dt);if(f.downT<=0)alarmOff();}else G.down=damp(G.down,0,2,dt);
  if(f.stall)updateStall(dt);
  // 落雷
  if(G.phase==='bands'||G.phase==='wall'||G.phase==='spare'||(G.phase==='eye'&&G.ringIdx>=2)){
    G.strikeT-=dt;
    if(G.strikeT<=0&&(G.phase!=='bands'||f.b1)){
      const lead=DF().warnT-.1,sp=G.phase==='wall'?170:80;warnStrike(P.pos.x+P.vel.x*lead+rr(-sp,sp),P.pos.z+P.vel.z*lead+rr(-sp,sp));
      if(rnd()<.5)warnStrike(P.pos.x+P.vel.x*lead*rr(.3,1.5)+rr(-420,420),P.pos.z+P.vel.z*lead*rr(.3,1.5)+rr(-420,420));
      G.strikeT=(G.phase==='bands'?lerp(4.2,7,sat((r-4700)/10000)):G.phase==='wall'?4.2:G.phase==='spare'?5:8)*DF().strk;
    }
  }
  // 竜巻
  if(U.uStorm.value>.5)for(const s of spouts){if(!s.mesh.visible)continue;
    // 根元で海水が渦を巻いて噴き上がる（近いときだけ）
    {const q=s.mesh.position;if(camera.position.distanceTo(q)<2500&&Math.random()<dt*22){const a2=Math.random()*6.283,r2=30+Math.random()*60;puff(q.x+Math.cos(a2)*r2,3.6,q.z+Math.sin(a2)*r2,-Math.sin(a2)*30,10+Math.random()*30,Math.cos(a2)*30,10+Math.random()*12,1.6+Math.random(),.7,sprays);}}
    const d=Math.hypot(P.pos.x-s.mesh.position.x,P.pos.z-s.mesh.position.z),rad=lerp(26,90,sat(P.pos.y/700));
    if(P.pos.y<800&&d<rad){damage(28,'海上竜巻に巻き込まれた');P.fling.set((P.pos.x-s.mesh.position.x)/d*70,45,(P.pos.z-s.mesh.position.z)/d*70);P.spin=2.2;}
    else if(d<450&&P.pos.y<800){tA.set(s.mesh.position.x-P.pos.x,0,s.mesh.position.z-P.pos.z).normalize();P.pos.addScaledVector(tA,(1-d/450)*26*dt);G.shake=Math.max(G.shake,(1-d/450)*.5);
      if(!f.spoutWarn){f.spoutWarn=1;warn('竜巻接近',2);}}
  }
}
function updateLock(dt,range,fire){
  const d=P.pos.distanceTo(CORE);fwdOf(P.yaw,P.pitch,tA);tB.copy(CORE).sub(P.pos).normalize();
  const ok=d<range&&tA.dot(tB)>.972&&d>260;
  const was=G.lock;
  G.lock=clamp(G.lock+(ok?dt/1.3:-dt*1.5),0,1);
  if(ok&&G.lock<1&&Math.floor(G.lock*8)!==Math.floor(was*8))SFX.lock(G.lock);
  if(G.lock>=1&&was<1)SFX.lockOn();
  if(G.lock>=1){G.prompt={t:'ロックオン完了　<kbd>Space</kbd> でディフューザー発射',p:1};if(input.actHit)fire();}
  else if(d>=range)G.prompt={t:'コアに接近せよ（射程 '+(range/1000).toFixed(1)+'km）',p:0};
  else G.prompt={t:'ロックオン中　機首をコアに向け続けろ',p:G.lock};
}
function startStall(){
  const w=W[1],f=G.flags;if(w.state==='gone')return;
  f.stall=1;f.stallT=DF().stallT;f.link=0;w.state='stall';w.yaw=P.yaw-.32;
  strikeAt(w.pos.x,w.pos.z,false);SFX.stall();
  say('H','うわあっ！　被雷しました、エンジンが止まります！');
  say('C','3番機が失速。近くを並走すれば再始動信号を中継できます');
  G.prevTarget=G.target;G.prevLabel=G.targetLabel;G.target=w.pos;G.targetLabel='ハル機';
  setObj('緊急　僚機救援','ハル機に接近し、並走してエンジンの再始動を支援せよ');
}
function updateStall(dt){
  const w=W[1],f=G.flags,d=w.pos.distanceTo(P.pos);f.stallT-=dt;
  const grace=f.stallT>DF().stallT-2.6;if(d<125&&!grace)f.link+=dt;
  G.prompt={t:grace?'ハル機が編隊から外れていく…':d<125?'再始動信号を中継中…':'ハル機に近づけ（残り '+Math.max(0,f.stallT).toFixed(0)+' 秒）',p:f.link/3.2};
  carrierRing.visible=true;carrierRing.position.copy(w.pos);carrierRing.quaternion.copy(camera.quaternion);
  const done=f.link>=3.2,lost=f.stallT<=0;
  if(done||lost){
    f.stall=0;G.prompt=null;carrierRing.visible=false;G.target=G.prevTarget;G.targetLabel=G.prevLabel;
    setObj('PHASE 1　レインバンド','落雷を避けて中心へ進め');
    if(done){w.state='form';w.yaw=nearAngle(w.yaw,P.yaw);G.stats.saved=true;SFX.restart();say('H','エンジン再始動…！　た、助かりました、隊長！');say('G','新入り、礼は帰ってから言え');}
    else{w.state='gone';G.stats.saved=false;say('H','だめです、高度が保てません…離脱して帰投します。すみません…！');say('C','3番機は離脱。救難艇を向かわせます。残る2機で続行してください');}
  }
}
// 警報が必要な危険がまだ続いているか（一つが収まっても、ほかが続いていれば警報を止めない）
function hazAlarm(){return !!(P.fire||P.engineOut||(G.flags&&G.flags.downT>0)||ICP.st===4);}
function alarmOff(){if(!hazAlarm())setAlarm(false);}
function fail(cause){if(G.mode==='dying'||G.mode==='over'||G.mode==='result'||G.mode==='title')return;if(CUT)endCut();G.cause=cause;G.mode='dying';G.dieT=1.2;setAlarm(false);}

// ───────────────────────── カットシーン ─────────────────────────
let CUT=null;
function startCut(def){P.br=null;P.brA=0;let save=null;
  if(def.mid){const vis=[...rings,...gateRings,coreShell,coreGlow];save={vis,v:vis.map(o=>o.visible),timer:$('timer').hidden};vis.forEach(o=>o.visible=false);
    G.prompt=null;$('prompt').hidden=true;$('warn').hidden=true;strikes.forEach(q=>q.col.visible=false);strikes.length=0;carrierRing.visible=false;if(tether)tether.visible=false;}
  else resetHaz();
  clearRadio();CUT={def,save,i:-1,t:0,tot:0,si:0,skip:false,fp:camera.position.clone(),fq:camera.quaternion.clone(),ff:camera.fov};G.mode='cut';
  document.body.classList.add('cine');$('hud').hidden=true;$('skip').hidden=false;$('banner').classList.remove('on');
  if(def.begin)def.begin();nextShot();
}
function nextShot(){const c=CUT;c.i++;c.t=0;const s=c.def.shots[c.i];if(s.setup)s.setup();}
function updateCut(dt){
  const c=CUT;c.t+=dt;c.tot+=dt;let s=c.def.shots[c.i];
  if(c.t>=s.dur){if(c.i+1<c.def.shots.length){nextShot();s=c.def.shots[c.i];}else{endCut();return;}}
  s.update(c.t,sat(c.t/s.dur),dt);
  const bi=c.def.blendIn||0,bo=c.def.blendOut||0;
  if(bi&&c.tot<bi){const k=ease(c.tot/bi);tD.copy(camera.position);qT.copy(camera.quaternion);camera.position.copy(c.fp).lerp(tD,k);camera.quaternion.copy(c.fq).slerp(qT,k);camera.fov=lerp(c.ff,camera.fov,k);camera.updateProjectionMatrix();}
  else if(bo&&c.i===c.def.shots.length-1&&s.dur-c.t<bo){const k=ease(1-(s.dur-c.t)/bo),f0=camera.fov;tD.copy(camera.position);qT.copy(camera.quaternion);const sh=G.shake;G.shake=0;P.camYaw=P.yaw;P.camPitch=P.pitch*.62;chaseCam(0,true);G.shake=sh;
    camera.position.lerpVectors(tD,camera.position,k);const qc=camera.quaternion.clone();camera.quaternion.copy(qT).slerp(qc,k);camera.fov=lerp(f0,62,k);camera.updateProjectionMatrix();}
  const subs=c.def.subs||[];while(c.si<subs.length&&c.tot>=subs[c.si][0]){const u=subs[c.si++];if(u[1]!=='H'||W[1].state!=='gone')say(u[1],typeof u[2]==='function'?u[2]():u[2],u[3]);}
  W.forEach(w=>{if(w.state!=='gone'){syncAC(w);animAircraft(w.mesh,G.t,w.power===undefined?.8:w.power,w.ph);}});syncAC(P);
}
function endCut(){
  const c=CUT;CUT=null;document.body.classList.remove('cine');$('skip').hidden=true;$('card').classList.remove('on');clearRadio();
  finalMat.uniforms.uWhite.value=0;G.white=0;shock.visible=false;boomFx.visible=false;proj.g.visible=false;proj.glow.visible=false;
  W.forEach(w=>{w.power=.8;});camera.fov=62;camera.updateProjectionMatrix();G.indoor=0;setDoors(1);hangarLight(1);
  c.def.end();
  if(c.save&&G.mode==='play'){c.save.vis.forEach((o,i)=>o.visible=c.save.v[i]);$('timer').hidden=c.save.timer;}
}
function skipCut(){if(!CUT||CUT.skip)return;CUT.skip=true;$('fade').style.opacity=1;const c=CUT;setTimeout(()=>{if(CUT===c)endCut();$('fade').style.opacity=0;},520);}   // 暗転の間に次のカットが始まっていたら、そちらは終わらせない
function cutFly(dt,spd){fwdOf(P.yaw,P.pitch,tA);P.pos.addScaledVector(tA,spd*dt);W.forEach(w=>{if(w.state==='gone')return;slotOf(w,tB);tB.y+=Math.sin(G.t*1.1+w.ph)*3;w.pos.lerp(tB,1-Math.exp(-dt*3));w.yaw=P.yaw;w.pitch=P.pitch;w.roll=Math.sin(G.t*1.6+w.ph)*.05;});}
function card(a,b){const c=$('card');c.children[0].style.fontSize=a.length>12?'min(6.4vw,66px)':'';c.children[0].textContent=a;c.children[1].textContent=b;c.classList.add('on');}
const RZ0=()=>BASE.z+1060;
// 機体原点から車輪の下端までは 3.6m（僚機は 0.92 倍）。機首上げでは主脚が沈むぶんを持ち上げる
const GH=o=>RWY_Y+3.6*o.mesh.scale.y,GP=(o,p)=>(2.3*Math.sin(Math.max(p,0))+3.6*(1-Math.cos(p)))*o.mesh.scale.y;
function setDoors(o){G.doorO=o;const d=baseGroup.userData.doors;d[0].position.x=-23.75-o*46.5;d[1].position.x=23.75+o*46.5;}
// ── 格納庫の整備員：灯り・扉・エンジン出力・機体の位置を見て動く
const _cl=new V3(),_cw=new V3();
// 重さの段階：0 通常、1 解像度の下限 50%・木 60%・低木 50%、2 下限 42%・木 40%・低木なし
// （雲の歩数を減らすと、残り歩数で届かないときの粗い歩みに早く切り替わってかえって重くなるので、雲は解像度で軽くする）
// 自動の画質調整で落ち着いた値を覚えておき（再読み込み後も）、次の出撃はそこから始める。出撃直後の数秒は速く調整する
function perfStart(){let L=null;try{L=JSON.parse(localStorage.getItem('stormrider_perf')||'null');}catch(e){}if(!L||L.q!==opts.q)L=null;
  view.scale=L?Math.min(1,Math.max(.42,+L.scale||1)):1;view.cs=L?Math.min(1,Math.max(.65,+L.cs||1)):1;view.upT=0;view.tierT=0;setTier(L?Math.min(2,Math.max(0,L.tier|0)):0);cloudSteps();G.fastAdapt=6;fpsAcc=0;fpsN=0;}
function perfSave(){const s=JSON.stringify({q:opts.q,scale:+view.scale.toFixed(3),cs:+(view.cs||1).toFixed(3),tier:view.tier||0});if(s===perfSave.last)return;perfSave.last=s;try{localStorage.setItem('stormrider_perf',s);}catch(e){}}
function cloudSteps(){cloudMat.uniforms.uSteps.value=Math.round((IS_TOUCH?[64,90,120]:[96,120,150])[opts.q]*(view.cs||1));}
// 初めての出撃の前に、任務で使う物をすべて一度描いて GPU に送っておく（初めて見えた瞬間のひっかかりを無くす）
// 段階に分けて読み込み画面のバーを進め、ブラウザが描画できるよう間を空ける
function warmUp(done){if(G.warmed){if(done!=='sync')done();return;}G.warmed=true;const L=$('load'),bar=$('loadBar');if(done!=='sync'){L.children[0].textContent='任務の準備中';L.hidden=false;bar.style.transform='scaleX(0)';}
  const cam0={p:camera.position.clone(),q:camera.quaternion.clone(),f:camera.fov},forced=[];
  const views=[[0,600,17400,0,400,9000],[0,1400,9000,0,900,0],[0,700,4300,0,1500,0],[0,1500,0,2400,1800,0],[0,3200,2200,0,3400,0],[0,9000,26000,0,0,0],[300,120,BASE.z-900,0,15,BASE.z+400],[1250,80,BASE.z-300,1250,15,BASE.z+200]];
  const steps=[()=>{try{if(!ICP.f.length)icpInit();pmInit();coreFxInit();if(!SAT.m)initSat();if(!SCUD.list.length)initScud();if(!GULLS.length)initGulls();if(!STR.init)strInit();vegInit();fireInit();tireMarks(0,BASE.z-700,Math.PI);monShow(true);monDraw(3);monShow(false);projChar(1);}catch(e){console.error(e);}},()=>{for(const root of[scene,overlay])root.traverse(o=>{if(!o.visible&&!o.isLight){forced.push(o);o.visible=true;}});renderer.compile(scene,camera);renderer.compile(overlay,camera);},
    ...views.map(v=>()=>{camera.position.set(v[0],v[1],v[2]);camera.lookAt(v[3],v[4],v[5]);camera.fov=70;camera.updateProjectionMatrix();renderFrame();}),
    ()=>{for(const o of forced)o.visible=false;TM.forEach(m=>m.visible=false);projChar(0);renderFrame();camera.position.copy(cam0.p);camera.quaternion.copy(cam0.q);camera.fov=cam0.f;camera.updateProjectionMatrix();cloudReset=true;}];
  if(done==='sync'){for(const s of steps){try{s();}catch(e){console.error(e);}}fpsAcc=0;fpsN=0;return;}
  let i=0;const BT=window.__bootT=[];const run=()=>{const _t=performance.now();try{steps[i]();}catch(e){console.error(e);}i++;bar.style.transform='scaleX('+(i/steps.length)+')';if(i<steps.length)setTimeout(run,16);else{L.hidden=true;fpsAcc=0;fpsN=0;done();}};setTimeout(run,30);}
function setTier(t){const up=t>(view.tier||0);view.tier=t;const B=baseGroup.userData;view.minScale=[.6,.5,.42][t];
  if(up&&view.scale>view.minScale+.001){view.scale=Math.max(view.minScale,view.scale*.85);resize();renderFrame();}   // 大きさを変えると画面が消えるので、同じコマのうちに描き直す
  for(const[im,k]of[[B.trees,[1,.6,.4][t]],[B.shrubs,[1,.5,0][t]]]){if(!im)continue;if(im.userData.n0===undefined)im.userData.n0=im.count;im.count=Math.floor(im.userData.n0*k);}}
// ── 夕方の灯り：港の灯りが水面に縦に伸びて揺らめく帯と、灯りの光の玉を夕方ほど明るく
const REFL={list:[],sprites:null};
function initRefl(){const P2=baseGroup.userData.lodPort;if(!P2||!P2.userData.refl)return;
  for(const[x,z,h,c]of P2.userData.refl){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({uniforms:{uC:{value:new V3(c[0],c[1],c[2])},uA:{value:0},uT:U.uTime,tN:U.tNoise2,tDepth:U.tDepth,uRes:U.uRes,uSeed:{value:x*.013+z*.007}},
      transparent:true,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'uniform vec3 uC;uniform float uA,uT,uSeed;uniform sampler2D tN,tDepth;uniform vec2 uRes;varying vec2 vUv;void main(){float d=texture2D(tDepth,gl_FragCoord.xy/uRes).x;if(gl_FragCoord.z>d)discard;float y=vUv.y;float w=1.0-abs(vUv.x-.5)*2.0;float n=texture2D(tN,vec2(vUv.x*.3+uSeed,y*1.8-uT*.12)).b;float br=.45+.55*smoothstep(.25,.8,n+.12*sin(y*70.0+uT*3.0));gl_FragColor=vec4(uC*uA*pow(w,2.2)*br*pow(1.0-y,1.6)*.16,1.0);}'}));
    m.frustumCulled=false;m.visible=false;m.userData={x:BASE.x+x,z:BASE.z+z,h};overlay.add(m);REFL.list.push(m);}
  // 灯りの光の玉（基地・港）の元の大きさ
  REFL.sprites=[];baseGroup.traverse(o=>{if(o.isSprite&&!o.userData.dyn)REFL.sprites.push({o,s:o.scale.x});});}
function updateRefl(){if(!REFL.list.length&&!REFL.tried){REFL.tried=1;initRefl();}const k=sat((G.gold||0)*1.1+(G.gloom||0)*.5);
  if(REFL.sprites&&Math.abs(k-(REFL.k||0))>.01){REFL.k=k;for(const q of REFL.sprites)q.o.scale.set(q.s*(1+k*.6),q.s*(1+k*.6),1);}
  for(const m of REFL.list){const u=m.userData,dx=camera.position.x-u.x,dz=camera.position.z-u.z,dist=Math.hypot(dx,dz);if(k<.02||dist>3500){m.visible=false;continue;}
    // 灯りの真下から手前（カメラ側）へ伸びる帯。長さは灯りの高さとカメラの高さで決まる
    const L=Math.min(110,u.h*(1.4+dist/Math.max(camera.position.y,8)*.1)),ang=Math.atan2(dx,dz);m.visible=true;
    m.position.set(u.x+Math.sin(ang)*L*.5,.9,u.z+Math.cos(ang)*L*.5);m.rotation.set(-Math.PI/2,ang,0,'YXZ');m.scale.set(2.5+dist*.0025,L,1);m.material.uniforms.uA.value=k;}}
// ── 雲の中のちぎれ雲：雲の中を飛んでいる間、機体の横を流れ去る切れ端（速さと奥行き）。稲光で照らされる
const SCUD={list:[],col:new V3(.1,.11,.12),on:false,_f:new V3(),_r:new V3(),_u:new V3()},_scS={},_scV=new V3();
function initScud(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),r=mulberry(4242);
  for(let i=0;i<60;i++){const a=r()*6.283,d=Math.pow(r(),.7)*38,px=64+Math.cos(a)*d,py=64+Math.sin(a)*d*.7,rr=14+r()*26,g=x.createRadialGradient(px,py,0,px,py,rr);g.addColorStop(0,'rgba(255,255,255,'+(.10+r()*.12)+')');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(px-rr,py-rr,rr*2,rr*2);}
  const map={value:new THREE.CanvasTexture(c)},col={value:SCUD.col};
  for(let i=0;i<46;i++){const mat=new THREE.ShaderMaterial({uniforms:{map,uCol:col,uOp:{value:0},tDepth:U.tDepth,uRes:U.uRes},transparent:true,depthTest:false,depthWrite:false,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'uniform sampler2D map,tDepth;uniform vec3 uCol;uniform vec2 uRes;uniform float uOp;varying vec2 vUv;void main(){float d=texture2D(tDepth,gl_FragCoord.xy/uRes).x;if(gl_FragCoord.z>d)discard;gl_FragColor=vec4(uCol,texture2D(map,vUv).a*uOp);}'});
    const m=new THREE.Mesh(quad1(),mat);m.frustumCulled=false;m.visible=false;m.renderOrder=-2;overlay.add(m);SCUD.list.push({m,s:1,rot:r()*6.283});}}
// ── 宇宙から見た台風（高度 14km 以上でだけ見せる）：渦に沿って流れる雲頂、外へ流れ出す巻雲、深い目。雲の厚みの勾配で太陽の陰影を付ける
const SAT={m:null};
function initSat(){const m=new THREE.Mesh(new THREE.PlaneGeometry(48000,48000),new THREE.ShaderMaterial({uniforms:{tN:U.tNoise2,uSpin:U.uSpin,uSunDir:U.uSunDir,uEye:U.uEye,uA:{value:0},tDepth:U.tDepth,uRes:U.uRes},
  vertexShader:'varying vec2 vXZ;void main(){vec4 w=modelMatrix*vec4(position,1.0);vXZ=w.xz;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader:`uniform sampler2D tN,tDepth;uniform float uSpin,uEye,uA;uniform vec3 uSunDir;uniform vec2 uRes;varying vec2 vXZ;
float n2(vec2 p){return texture2D(tN,p).b;}
float fbm(vec2 p){float s=0.0,a=0.5;for(int i=0;i<5;i++){s+=a*n2(p);p=p*2.03+vec2(0.13,0.37);a*=0.5;}return s;}
float dens(vec2 xz){float r=length(xz),th=atan(xz.y,xz.x)+uSpin,er=2400.0*uEye,lr=log(max(r,300.0)/er);
  float sw=th+lr*1.15;vec2 sp=vec2(cos(sw),sin(sw))*r;
  float nA=fbm(sp/9000.0+0.3),nB=fbm(sp/2600.0+1.7),nC=fbm(sp/650.0+3.1);
  float core=1.0-smoothstep(4500.0,10500.0+2600.0*nA,r);
  float band=pow(0.5+0.5*sin(th*2.0-lr*3.4+nA*3.2),3.0)*(1.0-smoothstep(9000.0,17500.0,r))*smoothstep(3500.0,6500.0,r);
  float outf=(1.0-smoothstep(12500.0,19500.0+2400.0*nA,r))*smoothstep(7500.0,11500.0,r)*smoothstep(0.42,0.72,fbm(vec2(lr*2.6,(th-lr*1.6)*1.1)+0.2))*0.6;
  float d=max(max(core,band*0.95),outf);d*=(0.72+0.5*nB)*(0.86+0.28*nC);
  d*=smoothstep(er*1.15,er*1.75,r+(nB-0.5)*700.0);
  return clamp(d,0.0,1.2);}
// 雲頂の高さ（陰影用）：厚い雲でも、突き出す積乱雲の頭や波打つ雲頂の凹凸を残す
float hgt(vec2 xz,float d){float r=length(xz),th=atan(xz.y,xz.x)+uSpin,sw=th+log(max(r,300.0)/2400.0)*1.15;vec2 sp=vec2(cos(sw),sin(sw))*r;
  float bump=pow(fbm(xz/26000.0+5.3),2.0)*1.1+fbm(sp/7000.0+7.7)*0.45;   /* 雲頂のこぶは数百 m 規模（宇宙からでも見える大きさ） */return min(d,1.0)*0.75+bump*smoothstep(0.2,0.9,d)*0.6;}
void main(){float zd=texture2D(tDepth,gl_FragCoord.xy/uRes).x;if(gl_FragCoord.z>zd)discard;
  float d=dens(vXZ);if(d<0.015)discard;
  float e=220.0,h0=hgt(vXZ,d),dx=hgt(vXZ+vec2(e,0.0),dens(vXZ+vec2(e,0.0)))-h0,dz=hgt(vXZ+vec2(0.0,e),dens(vXZ+vec2(0.0,e)))-h0;
  vec3 N=normalize(vec3(-dx*9.0,1.0,-dz*9.0)),L=normalize(uSunDir);
  float lam=clamp(dot(N,L),0.0,1.0),r=length(vXZ),er=2400.0*uEye;
  vec3 c=mix(vec3(0.42,0.5,0.64),vec3(0.97,0.99,1.03),0.15+0.85*lam)*(0.72+0.38*clamp(h0,0.0,1.0));   /* 低い雲頂の谷は陰る */
  // 目の壁：太陽に向いた側は明るく、反対側は陰に
  float wall=smoothstep(er*0.9,er*1.35,r)*(1.0-smoothstep(er*1.35,er*2.2,r));float sd=dot(normalize(vXZ),normalize(L.xz));
  c*=1.0-wall*0.45*smoothstep(-0.2,0.8,sd);
  // 外縁の薄い巻雲は青みがかる
  c=mix(c,vec3(0.78,0.84,0.93),(1.0-smoothstep(0.25,0.7,d))*0.5);
  gl_FragColor=vec4(c*vec3(1.2,1.25,1.36),clamp(d*1.9,0.0,1.0)*uA);}`,
  transparent:true,depthTest:false,depthWrite:false}));
  m.rotation.x=-Math.PI/2;m.position.y=4700;m.frustumCulled=false;m.visible=false;m.renderOrder=2;overlay.add(m);SAT.m=m;}   // 遠景用の嵐の円盤（world.js）より後に描く
function updateSat(){const k=sat((camera.position.y-14000)/8000);if(k<=0){if(SAT.m)SAT.m.visible=false;return;}if(!SAT.m)initSat();SAT.m.visible=U.uStorm.value>.5;SAT.m.material.uniforms.uA.value=k;}
function updateScud(){if(!SCUD.list.length)initScud();const cam=camera.position,sc=stormAt(cam.x,cam.y,cam.z,_scS);
  const inC=(G.mode==='title'||G.indoor>0)?0:sat(sc.c*1.5-.35)*(cam.y<sc.top*.95?1:0)*sat(cam.y/150);
  if(inC<=.01&&!SCUD.on)return;
  camera.getWorldDirection(SCUD._f);SCUD._r.crossVectors(SCUD._f,camera.up).normalize();SCUD._u.crossVectors(SCUD._r,SCUD._f);
  const fl=U.uFlashI.value||0,base=.11+.08*(1-(G.gloom||0));/* 雲の中を流れるちぎれ雲は背景より明るい灰色に（速度感）。稲光で白く */SCUD.col.set(base+fl*.9,base*1.06+fl*.9,base*1.15+fl);
  let any=false;
  for(const q of SCUD.list){const m=q.m,rel=_scV.subVectors(m.position,cam),dz=rel.dot(SCUD._f),d=rel.length();
    if(!m.visible||dz<-40||d>620){if(inC<.05){m.visible=false;continue;}
      m.position.copy(cam).addScaledVector(SCUD._f,180+Math.random()*420).addScaledVector(SCUD._r,(Math.random()-.5)*360).addScaledVector(SCUD._u,(Math.random()-.5)*170);
      q.s=50+Math.random()*90;q.rot=Math.random()*6.283;m.visible=true;m.material.uniforms.uOp.value=0;continue;}
    // 画面の中心から外へ流れて見える向きに、近くて速いほど長く引き伸ばす
    {const sx=rel.dot(SCUD._r),sy=rel.dot(SCUD._u),st=1+1.1*sat(P.speed/180)*sat(1-(dz-40)/260);m.quaternion.copy(camera.quaternion);m.rotateZ(Math.atan2(sy,sx));m.scale.set(q.s*st,q.s*.62,1);}
    m.material.uniforms.uOp.value=inC*.68*sat((d-20)/70)*(1-sat((d-430)/170));any=true;}
  SCUD.on=any;}
// 本棟の前の旗：根元から先へ行くほど大きく波打つ
function animFlags(){const D=baseGroup.userData.detail,fl=D&&D.userData.flags;if(!fl)return;if(camera.position.distanceTo(_cw.set(BASE.x+330,RWY_Y,BASE.z+335))>900)return;const t=G.t;
  for(const m of fl){if(m.userData.brkDead)continue;const pa=m.geometry.attributes.position;if(!m.userData.x0)m.userData.x0=Float32Array.from({length:pa.count},(_,i)=>pa.getX(i));const x0=m.userData.x0;
    for(let i=0;i<pa.count;i++){const u=(x0[i]+1.8)/3.6;pa.setZ(i,Math.sin(t*6.5-u*5.5)*.32*u+Math.sin(t*11-u*9)*.06*u);pa.setX(i,x0[i]-u*u*.15);}pa.needsUpdate=true;m.geometry.computeVertexNormals();}}
function animCrew(dt){
  const HG=baseGroup.userData.hangar,cr=HG&&HG.userData.crew;if(!cr)return;
  if(G.hgDead){if(animCrew.far!=='dead'){animCrew.far='dead';for(const c of cr)c.g.visible=false;}return;}   // 格納庫が壊れたら整備員は退避
  const far=G.indoor<=0&&camera.position.distanceTo(_cw.setFromMatrixPosition(HG.matrixWorld))>700;if(far!==animCrew.far){animCrew.far=far;for(const c of cr)c.g.visible=!far;}   // 遠いときは描かない
  if(far)return;
  const pl=HG.worldToLocal(_cl.copy(P.pos)),t=G.t,lit=baseGroup.userData.hlight.intensity>1.1,door=G.doorO||0,pw=P.power||0;
  const gone=pl.z<-160||pl.y>40||Math.abs(pl.x)>80,eng=pw>.2&&!gone,loud=pw>.62&&pl.z>-110,moving=pl.z<-31&&!gone&&pl.z>-400;
  const k=1-Math.exp(-dt*7),D=(o,ax,v)=>{o.rotation[ax]+=(v-o.rotation[ax])*k;};
  for(const c of cr){
    // 既定は直立。T に各関節の目標角を入れる（x：前後、z：横へ開く。腕・脚は sx で左右反転）
    const T={y:0,lean:0,hip:[0,0],kn:[0,0],sh:[[0,-.06],[0,.06]],el:[[0,0],[0,0]],look:null,walk:0};
    const toP=Math.atan2(pl.x-c.x,pl.z-c.z);let face=c.ry;
    const ears=()=>{for(let i=0;i<2;i++){const sx=i?1:-1;T.sh[i]=[-.35,sx*1.15];T.el[i]=[0,sx*2.35];}};
    const wave=()=>{T.sh[1]=[-.15,2.75];T.el[1]=[0,.35+.45*Math.sin(t*9+c.ph)];};
    if(c.role==='marshal'){
      if(!gone&&pl.z>c.z+8)face=toP;else face=Math.PI;   // 機体と向き合い、通り過ぎたら見送る
      if(!lit||door<.85){T.sh=[[-.25,.15],[-.25,-.15]];T.el=[[-.3,0],[-.3,0]];}
      else if(pw<.27){T.sh[1]=[0,2.95];T.el[1]=[Math.sin(t*7)*.4,Math.cos(t*7)*.4];T.sh[0]=[-.1,-.1];}      // エンジン始動の合図（頭上で輪を描く）
      else if(!moving){for(let i=0;i<2;i++){const sx=i?1:-1;T.sh[i]=[0,sx*1.5];T.el[i]=[0,sx*(.35+.95*(.5+.5*Math.sin(t*5)))];}}  // 前進せよ（手招き）
      else{T.sh[1]=[-.55,1.25];T.el[1]=[0,2.05];T.sh[0]=[0,-.08];}                                         // 敬礼で見送る
    }else{
      const busy=lit&&!eng&&!moving;
      if(c.role==='walk'&&busy){const zt=c.path[c.wp];let dz=zt-c.z;if(Math.abs(dz)<.3){c.wp^=1;dz=c.path[c.wp]-c.z;}const sp=1.25;c.z+=Math.sign(dz)*Math.min(Math.abs(dz),sp*dt);face=dz>0?0:Math.PI;
        c.ph+=dt*sp*3.1;T.walk=1;const sw=Math.sin(c.ph);T.hip=[sw*.42,-sw*.42];T.kn=[Math.max(0,-Math.sin(c.ph-.6))*.75,Math.max(0,Math.sin(c.ph-.6))*.75];T.sh=[[-sw*.38,-.06],[sw*.38,.06]];T.el=[[-.25,0],[-.25,0]];T.y=Math.abs(Math.cos(c.ph))*.03;}
      else if(c.role==='work'&&busy){T.y=-.38;T.lean=.35;T.hip=[-1.5,-.1];T.kn=[1.55,1.5];T.sh=[[-.8,-.05],[-1.0+Math.sin(t*8+c.ph)*.35,.05]];T.el=[[-.6,0],[-.9,0]];}
      else if(c.role==='clip'&&busy){T.sh=[[-.5,-.05],[-.35+Math.sin(t*3+c.ph)*.05,.12]];T.el=[[-1.3,0],[-1.2+Math.sin(t*11+c.ph)*.12,0]];T.look=-.45;}
      if(eng||moving){face=toP;if(moving)wave();else if(loud)ears();else if(c.role==='clip'){T.sh[0]=[-.5,-.05];T.el[0]=[-1.3,0];}}
      else if(c.role==='clip'&&lit&&!busy)face=c.ry;
    }
    // 向きはゆっくり変える（歩きは速め）
    let df=face-c.g.rotation.y;while(df>Math.PI)df-=6.2832;while(df<-Math.PI)df+=6.2832;c.g.rotation.y+=df*Math.min(1,dt*(T.walk?6:2.6));c.ry=c.g.rotation.y;
    c.g.position.set(c.x,0,c.z);c.body.position.y+=(.86+T.y-c.body.position.y)*k;D(c.torso,'x',T.lean);
    for(let i=0;i<2;i++){const sx=i?1:-1,L=c.legs[i],A=c.arms[i];D(L.hip,'x',T.hip[i]);D(L.kn,'x',T.kn[i]);D(A.sh,'x',T.sh[i][0]);D(A.sh,"z",T.sh[i][1]);D(A.el,'x',T.el[i][0]);D(A.el,'z',T.el[i][1]);}
    // 頭は機体（エンジンが回っていれば）か手元を見る
    let hy=0,hx=T.look||0;if(eng||moving){hy=toP-c.ry;while(hy>Math.PI)hy-=6.2832;while(hy<-Math.PI)hy+=6.2832;hy=clamp(hy,-1.1,1.1);hx=0;}D(c.head,'y',hy);D(c.head,'x',-hx);
  }
}
function hangarLight(k){if(G.hgDead)k=0;   // 壊れた格納庫の天井照明は点けない（落ちた屋根の上に浮いて見える）
baseGroup.userData.hlight.intensity=2.2*k;{const c=baseGroup.userData.cones;c.coneM.opacity=.55*k;c.poolM.opacity=.1*k;}baseGroup.userData.strip.color.setRGB(2.6*k+.02,2.7*k+.02,3*k+.03);}
const CUT_INTRO={
  subs:[[.8,'C','台風13号〈オロチ〉、中心気圧890ヘクトパスカル。18時間後に本土へ上陸する見込みです',6.2],
    [8.6,'C','ストームライダー隊に発進を許可します。目標は台風の中心、コア',4.2],[13.2,'C','ディフューザーは1番機に1発、2番機に予備が1発。コアへ撃ち込み、嵐を内側から消してください',5],
    [18.8,'C','格納庫ゲートを開放します。進路上、障害なし',3.2],
    [22.6,'G','2番機ゴウ。この旧式に発射装置は無い。予備の運び屋だ、撃つのは隊長の仕事だぞ',4.2],[27,'H','3番機ハル、初出撃です…！　よ、よろしくお願いします！',3.4],
    [30.8,'C','ストームライダー1、発進どうぞ。…必ず、帰ってきてください',5]],
  begin(){U.uStorm.value=1;U.uEye.value=1;G.eyeSun=0;applyEnv(0);setMood('intro');P.hasPod=true;G.spareGiven=false;syncPods();P.hull=100;resetArmor();
    W.forEach(w=>{w.state='form';w.mesh.visible=true;});trails.forEach(resetTrail);
    const y=GH(P);P.pos.set(0,y,RZ0());P.yaw=0;P.pitch=0;P.roll=0;P.power=.05;
    W[0].pos.set(-24,GH(W[0]),RZ0()+45);W[1].pos.set(24,GH(W[1]),RZ0()+80);W.forEach(w=>{w.yaw=0;w.pitch=0;w.roll=0;gearOf(w,true);});gearOf(P,true);
    setDoors(0);hangarLight(0);G.indoor=0;W.forEach(w=>{w.power=.05;});},
  shots:[
    {dur:8,update(t,u){const a=.55+u*.3;setCam(Math.sin(a)*17000,34000-u*3000,Math.cos(a)*17000+3500,0,0,-1000,48);}},
    // 暗い格納庫に灯りが入る
    {dur:7,setup(){G.indoor=1;SFX.hum();},update(t,u){const k=t<.9?0:t<1.5?(Math.sin(t*90)>0?.5:.05):smooth(1.5,3.2,t);hangarLight(k);P.power=.05;
      setCam(-17+u*7,RWY_Y+2.6+u*2.2,RZ0()-36+u*5,0,RWY_Y+5,RZ0()+4,34);}},
    // ゲートが開き、外の光と台風が見える
    {dur:7,setup(){SFX.klaxon();SFX.door();},update(t,u){setDoors(ease(sat((t-.8)/5)));G.indoor=1-.25*ease(sat((t-.8)/5));
      setCam(7-u*3,RWY_Y+12-u*2,RZ0()+34-u*6,0,RWY_Y+7,RZ0()-80,46);}},
    // エンジン始動
    {dur:8,setup(){SFX.spool();setDoors(1);},update(t,u){const pw=q=>q<0?.05:q<1.7?.05+.21*(q/1.7):.27+.78*smooth(1.7,5.6,q);P.power=pw(t);W[0].power=pw(t-1.5);W[1].power=pw(t-2.7);setCam(13-u*5,RWY_Y+3.2+u*1.5,RZ0()+25-u*4,-1,RWY_Y+4.4,RZ0()+2,38);}},
    // 格納庫から滑走路へ飛び出して離陸
    {dur:8.6,setup(){SFX.boost();setMood('launch');},update(t,u){const y=GH(P);
      const run=(tt)=>{const q=Math.max(0,tt);return{z:.5*19*q*q,y:Math.pow(Math.max(0,q-4.9),2)*7,p:sat((q-4.5)/1.2)*.2};};
      const a=run(t);P.pos.set(0,y+a.y+GP(P,a.p),RZ0()-a.z);P.pitch=a.p;P.power=1.5;W.forEach((w,i)=>{w.power=t>1.6+i*1.2?1.45:1.05;});gearOf(P,a.y<25);
      W.forEach((w,i)=>{const b=run(t-1.6-i*1.2);w.pos.set(i?24:-24,GH(w)+b.y+GP(w,b.p),RZ0()+45+i*35-b.z);w.pitch=b.p;gearOf(w,b.y<25);});
      G.indoor=.75*(1-smooth(40,110,a.z));
      setCam(31,RWY_Y+3.2,BASE.z+905,P.pos.x,P.pos.y+1.5,P.pos.z,30+u*16);if(t>3.9&&t<4.3)G.shake=.5;}},
    {dur:7,setup(){G.indoor=0;P.pos.set(0,300,BASE.z-1500);P.yaw=0;P.pitch=.1;gearOf(P,false);W.forEach(w=>{gearOf(w,false);w.power=.8;});snapWing();card('STORM RIDER','嵐を消す翼');SFX.gear();},
      update(t,u,dt){cutFly(dt,150);fwdOf(P.yaw,0,tA);setCam(P.pos.x-22+u*10,P.pos.y-7+u*5,P.pos.z+62-u*14,P.pos.x,P.pos.y+12,P.pos.z-200,58);
        if(u>.7)$('card').classList.remove('on');}}],
  blendOut:1.4,
  end(){const p=P.pos.clone(),ok=G.indoor===0&&p.y>200&&p.z<BASE.z-1600;G.missionT=0;G.retries=0;G.stats={dmg:0,saved:null};G.ckpt=null;startRun('approach');if(ok){P.pos.copy(p);P.pitch=.1;snapWing();syncAC(P);chaseCam(0,true);}}
};
function projSetup(){
  proj.from=P.mesh.userData.pod.getWorldPosition(new V3());proj.g.visible=true;proj.glow.visible=true;resetTrail(proj.trail);P.hasPod=false;P.mesh.userData.pod.visible=false;SFX.launch();G.shake=.6;proj.T=0;proj.d.userData.flame.visible=true;proj.v0=fwdOf(P.yaw,P.pitch,new V3()).multiplyScalar(130);
  coreShell.visible=false;
}
// 被雷して壊れたディフューザーの落下：回転しながら放物線で落ち、黒煙と火花を引く
function projFall(dt,hard){const p=proj.g.position;proj.fv.y-=(hard?34:14)*dt;proj.fv.multiplyScalar(Math.exp(-dt*.2));p.addScaledVector(proj.fv,dt);proj.g.rotation.x+=dt*(hard?4.2:3.1);proj.g.rotation.z+=dt*(hard?2.9:2.3);
  proj.st=(proj.st||0)-dt;if(proj.st<=0){proj.st=.03;const vl=Math.max(1,proj.fv.length()),bx=p.x-proj.fv.x/vl*3,by=p.y-proj.fv.y/vl*3+1.2,bz=p.z-proj.fv.z/vl*3;bpart(BOOM.dust,bx,by,bz,brn(-1,1),3,brn(-1,1),brn(2.6,3.8),.5,brn(4,7),{g:2,dr:1.2,a:.8,c:_bc.setRGB(.05,.045,.042)});   /* 煙は進む向きの後ろから（自分の煙に埋もれない） */if(Math.random()<.15)bpart(BOOM.fire,p.x,p.y,p.z,brn(-2,2),brn(-1,2),brn(-2,2),brn(.1,.22),.5,1.3,{dr:4});}}
function projMove(dt,T){
  proj.T+=dt;const u=sat(proj.T/T),e=u*u;proj.g.position.copy(proj.from).addScaledVector(proj.v0,proj.T);proj.g.position.y-=3.5*sat(proj.T/.5)*(1-e);proj.g.position.lerp(CORE,e);proj.g.lookAt(CORE);proj.d.userData.flame.visible=proj.T>.35;for(const q of proj.trail.pts)q.p.addScaledVector(proj.v0,dt);
  proj.glow.position.copy(proj.g.position);proj.glow.quaternion.copy(camera.quaternion);const s=5.5+Math.sin(G.t*40)*1.2;proj.glow.scale.set(s,s,1);
  tC.set(1,0,0).applyQuaternion(proj.g.quaternion);pushTrail(proj.trail,proj.g.position,tC,.55,dt,.5);
}
// 嵐のコア（カット用の姿）：青白く脈打つ電気の塊と、まわりを這う放電
const CFX={g:null,t:0,arcT:0};
function coreFxInit(){if(CFX.g)return;const g=new THREE.Group();g.position.copy(CORE);
  const shell=new THREE.Mesh(new THREE.SphereGeometry(1,40,24),glowMat(new V3(.9,1.6,3.2),2));shell.frustumCulled=false;g.add(shell);
  const inner=makeBillboard(new V3(1.6,2.4,4.2));overlay.remove(inner);g.add(inner);
  const halo=makeBillboard(new V3(.25,.45,.9));overlay.remove(halo);g.add(halo);
  g.visible=false;overlay.add(g);CFX.g=g;CFX.shell=shell;CFX.inner=inner;CFX.halo=halo;}
function coreFxUpdate(dt,on){coreFxInit();CFX.g.visible=on;if(!on)return;CFX.t+=dt;const t=CFX.t,pu=.8+.2*Math.sin(t*7)+.1*Math.sin(t*23);
  CFX.shell.scale.setScalar(120*pu);CFX.shell.material.uniforms.uAlpha.value=.3*pu;
  CFX.shell.visible=false;CFX.halo.visible=false;for(const[b,s,a]of[[CFX.inner,150,.55]]){b.scale.set(s*pu,s*pu,1);b.quaternion.copy(camera.quaternion);b.material.uniforms.uAlpha.value=a*pu;}
  CFX.arcT-=dt;if(CFX.arcT<=0){CFX.arcT=.07+Math.random()*.14;const a=Math.random()*6.283,e=(Math.random()-.5)*2.2,r=180+Math.random()*320;
    tB.set(CORE.x+Math.cos(a)*Math.cos(e)*40,CORE.y+Math.sin(e)*40,CORE.z+Math.sin(a)*Math.cos(e)*40);tC.set(CORE.x+Math.cos(a)*Math.cos(e)*r,CORE.y+Math.sin(e)*r,CORE.z+Math.sin(a)*Math.cos(e)*r);boltFromTo(tB,tC,4+Math.random()*3);if(Math.random()<.3)SFX.zap();}}
// ディフューザーの焼け焦げ（被雷）と、元の色への戻し
function projChar(k){proj.d.traverse(o=>{if(!o.isMesh||!o.material||!o.material.color)return;const m=o.material;
  if(m.isMeshBasicMaterial){/* 放射リングは消灯（毎コマ色を戻すカット用の減光表にも反映） */const ent=CUTDIM.find(q=>q[0]===m);if(ent){if(!m.userData.c0)m.userData.c0=ent[1].clone();ent[1].copy(m.userData.c0).multiplyScalar(1-.92*k);m.color.copy(ent[1]).multiplyScalar(G.mode==='cut'?.4:1);}return;}
  if(!m.userData.c0){m.userData.c0=m.color.clone();m.userData.mr=[m.metalness,m.roughness];m.userData.env=m.envMap;}m.color.copy(m.userData.c0).multiplyScalar(1-.93*k);m.metalness=lerp(m.userData.mr[0],0,k);m.roughness=lerp(m.userData.mr[1],.9,k);
  // 空の映り込みを外す（地色を黒くしても、明るい空の反射で白っぽく見えていた）
  const ne=k>0?null:m.userData.env;if(m.envMap!==ne){m.envMap=ne;m.needsUpdate=true;}});}
// ── 管制のコア解析モニター（1 発目の失敗カット）
function monShow(on){const m=$('mon');if(!m)return;m.hidden=!on;if(on){const c=$('monC'),r=devicePixelRatio||1;c.width=Math.round(innerWidth*r);c.height=Math.round(innerHeight*r);}}
function monDraw(t){const c=$('monC');if(!c||$('mon').hidden)return;const x=c.getContext('2d'),W=c.width,H=c.height,s=Math.min(W/1600,H/900);x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,W,H);
  const C1='#7fd8ff',C2='rgba(127,216,255,.35)',WARN='#ff6a55',F=(px,w)=>(w||400)+' '+Math.round(px*1.3)+'px "Hiragino Sans","Yu Gothic UI",sans-serif';
  const ox=(W-1600*s)/2,oy=(H-900*s)/2;x.translate(ox,oy);x.scale(s,s);
  // 枠と見出し
  x.strokeStyle=C2;x.lineWidth=1.5;x.strokeRect(40,40,1520,820);x.fillStyle=C1;x.font=F(26,500);x.fillText('ミズハ管制　コア解析',70,92);x.font=F(18);x.fillStyle=C2;x.fillText('台風13号〈オロチ〉 中心部　観測リンク：2番機ゴウ',70,124);
  x.textAlign='right';x.fillStyle=C1;x.font=F(20);x.fillText('T+'+(18+t).toFixed(1)+' s',1530,92);x.textAlign='left';
  // 左：目の平面図（コアと、ディフューザーの軌跡が途中で途切れる）
  const cx=420,cy=490,R=270;x.strokeStyle=C2;for(const k of[1,.66,.33]){x.beginPath();x.arc(cx,cy,R*k,0,6.283);x.stroke();}x.beginPath();x.moveTo(cx-R,cy);x.lineTo(cx+R,cy);x.moveTo(cx,cy-R);x.lineTo(cx,cy+R);x.stroke();
  x.save();x.translate(cx,cy);x.rotate(t*1.4);const gr=x.createLinearGradient(0,0,R,0);gr.addColorStop(0,'rgba(127,216,255,.28)');gr.addColorStop(1,'rgba(127,216,255,0)');x.fillStyle=gr;x.beginPath();x.moveTo(0,0);x.arc(0,0,R,-.35,0);x.fill();x.restore();
  const pu=.5+.5*Math.sin(t*6);x.fillStyle='rgba(255,106,85,'+(.55+.4*pu)+')';x.beginPath();x.arc(cx,cy,9+3*pu,0,6.283);x.fill();x.strokeStyle=WARN;x.beginPath();x.arc(cx,cy,22,0,6.283);x.stroke();
  x.fillStyle=WARN;x.font=F(17,500);x.fillText('コア',cx+28,cy-10);
  x.setLineDash([8,6]);x.strokeStyle=C1;x.beginPath();x.moveTo(cx-230,cy+190);x.lineTo(cx-95,cy+70);x.stroke();x.setLineDash([]);
  x.strokeStyle=WARN;x.lineWidth=3;x.beginPath();x.moveTo(cx-105,cy+60);x.lineTo(cx-85,cy+80);x.moveTo(cx-85,cy+60);x.lineTo(cx-105,cy+80);x.stroke();x.lineWidth=1.5;
  x.fillStyle=C1;x.font=F(16);x.fillText('ディフューザー軌跡',cx-250,cy+220);x.fillStyle=WARN;x.fillText('被雷・信号途絶',cx-80,cy+105);
  // 右上：観測値の表
  const rows=[['コア電位差','1.00','→ 0.99','健在',WARN],['中心気圧','890 hPa','→ 890 hPa','変化なし',WARN],['渦の回転','62 m/s','→ 62 m/s','変化なし',WARN],['ディフューザー','到達率 0 %','','信号途絶',WARN],['眼の半径','24 km','→ 23 km','縮小中',C1]];
  x.font=F(19);let y=200;for(const[a,b,c2,d,col]of rows){const show=t>.3+rows.indexOf(rows.find(r=>r[0]===a))*.35;if(!show)break;x.fillStyle=C2;x.fillText(a,860,y);x.fillStyle=C1;x.fillText(b,1080,y);x.fillText(c2,1230,y);x.fillStyle=col;x.textAlign='right';x.fillText(d,1530,y);x.textAlign='left';x.strokeStyle='rgba(127,216,255,.15)';x.beginPath();x.moveTo(860,y+14);x.lineTo(1530,y+14);x.stroke();y+=52;}
  // 右下：コアの強さの時間変化（着弾予定の線を越えても下がらない）
  const gx=860,gy=520,gw=670,gh=260;x.strokeStyle=C2;x.strokeRect(gx,gy,gw,gh);x.fillStyle=C2;x.font=F(15);x.fillText('コア強度',gx+8,gy+22);
  const hitX=gx+gw*.55;x.setLineDash([5,5]);x.beginPath();x.moveTo(hitX,gy);x.lineTo(hitX,gy+gh);x.stroke();x.setLineDash([]);x.fillText('着弾予定',hitX+6,gy+gh-10);
  const n=Math.min(1,t/2.6);x.strokeStyle=WARN;x.lineWidth=2.5;x.beginPath();for(let i=0;i<=200*n;i++){const q=i/200,X=gx+q*gw,v=.72+.025*Math.sin(q*31+1.3)+.018*Math.sin(q*77+t*2)+.012*Math.sin(q*173);const Y=gy+gh*(1-v);i?x.lineTo(X,Y):x.moveTo(X,Y);}x.stroke();x.lineWidth=1.5;
  // 結論（後半で点滅）
  if(t>2.4){x.fillStyle='rgba(255,106,85,'+(t%0.8<.55?1:.35)+')';x.font=F(30,600);x.textAlign='center';x.fillText('攻撃失敗　コアは健在',1195,470);x.textAlign='left';}
}
const CUT_FIRE1={
  blendIn:.9,blendOut:1.3,
  subs:[[.3,'C','ディフューザーの発射を確認'],[4.2,'H','か、雷が…！　コアから伸びてきた！',2.8],
    [7.9,'C','直撃です。ディフューザーの反応、消失……海へ落ちていきます',3.3],[11.5,'G','くそっ、コアは無傷だ……まだ生きてるぞ！',2.7],
    [14.4,'C','攻撃は失敗です。コアの電位差が雷を引き寄せました。衝撃で目が閉じ始めています',5.0],
    [19.6,'C','予備は2番機にあります。空中で1番機へ受け渡してください',3.6],
    [23.4,'G','発射装置さえあれば俺が撃つんだがな。横に付く、受け取れ隊長',2.7]],
  begin(){setMood('storm');MUS.intensity=2;projChar(0);coreFxInit();CFX.t=0;},
  shots:[
    // 1 機体の横、少し下から：腹の下でディフューザーが外れ、点火して飛び出す
    {dur:2.8,setup(){projSetup();coreShell.visible=false;},update(t,u,dt){cutFly(dt,130);projMove(dt,5);fwdOf(P.yaw,P.pitch,tA);const rx=Math.cos(P.yaw),rz=-Math.sin(P.yaw);
      const q=proj.g.position;tB.copy(q).sub(P.pos);const dq=tB.length();tB.normalize();const k=ease(sat(t/2.2));
      tC.copy(P.pos).addScaledVector(tB,Math.min(dq,90)*.24*k);tC.y-=1.5*(1-k);setCam(P.pos.x+rx*34-tA.x*30,P.pos.y-9,P.pos.z+rz*34-tA.z*30,tC.x,tC.y,tC.z,lerp(38,52,k));}},
    // 2 後ろから追う：前方に脈打つコア。コアから伸びた雷がディフューザーを撃ち抜く
    {dur:3.4,setup(){proj.hit=false;},update(t,u,dt){cutFly(dt,130);coreFxUpdate(dt,true);if(!proj.hit)projMove(dt,5);const p=proj.g.position;tA.copy(CORE).sub(p).normalize();
      if(!proj.hit){proj.fv=(proj.fv||new V3()).copy(tA).multiplyScalar(60);setCam(p.x-tA.x*30+tA.z*9,p.y-tA.y*30+7,p.z-tA.z*30-tA.x*9,lerp(p.x,CORE.x,.35),lerp(p.y,CORE.y,.35),lerp(p.z,CORE.z,.35),40);}
      else{projFall(dt,1);setCam(p.x-tA.x*16+tA.z*52,p.y+18,p.z-tA.z*16-tA.x*52,p.x,p.y-2,p.z,26);}
      // 雷の前ぶれ：コアの放電がディフューザーへ向かって伸びる
      if(!proj.hit&&t>.5&&t<1.3&&Math.random()<dt*14){tB.copy(CORE).addScaledVector(tA,-60);tC.copy(CORE).lerp(p,.3+Math.random()*.4);boltFromTo(tB,tC,5);}
      if(t>1.3&&!proj.hit){proj.hit=true;proj.glow.visible=false;proj.d.userData.flame.visible=false;proj.fv.y+=10;tB.copy(CORE).addScaledVector(tA,-55);boltFromTo(tB,p,5);
        flashAt(p.x,p.y,p.z,1.2);G.white=.22;SFX.zap();SFX.thunder(250);explode(p.clone(),.16,'air');G.shake=.35;projChar(1);}}},
    // 3 寄り：焼け焦げて火花を散らし、制御を失って回り始める
    {dur:1.6,setup(){G.shake=0;},update(t,u,dt){cutFly(dt,130);coreFxUpdate(dt,true);projFall(dt,1);G.shake=0;const p=proj.g.position;fwdOf(P.yaw,0,tA);
      if(Math.random()<dt*10)bpart(BOOM.fire,p.x+brn(-1,1),p.y,p.z+brn(-1,1),brn(-6,6),brn(-2,6),brn(-6,6),brn(.12,.25),.6,1.6,{dr:4});
      setCam(p.x+tA.z*12+tA.x*4,p.y+11,p.z-tA.x*12+tA.z*4,p.x,p.y,p.z,36);}},
    // 4 真上から：黒煙を引き、回りながら遥か下の海へ落ちていく
    {dur:3.5,setup(){proj.cam=proj.g.position.clone().add(tD.set(8,34,5));},update(t,u,dt){cutFly(dt,130);coreFxUpdate(dt,false);projFall(dt,1);G.shake=0;const p=proj.g.position;
      const d=proj.cam.distanceTo(p);setCam(proj.cam.x,proj.cam.y,proj.cam.z,p.x,p.y,p.z,clamp(2*Math.atan(9/d)*57.3,6,48));}},
    // 5 管制のモニター：コアの観測データ。着弾は無く、コアの値は下がっていない
    {dur:4.4,setup(){proj.g.visible=false;coreFxUpdate(0,false);monShow(true);},update(t,u,dt){cutFly(dt,130);monDraw(t);},end(){monShow(false);}},
    // 6 編隊：衝撃で揺れ、目が閉じ始める
    {dur:12,setup(){setMood('climax');setAlarm(true);coreFxUpdate(0,false);monShow(false);},update(t,u,dt){cutFly(dt,130);P.roll=Math.sin(t*3)*.12*(1-u);G.shake=Math.max(G.shake,.25*(1-u));
      U.uEye.value=1-.08*u;if(t>3)setAlarm(false);
      fwdOf(P.yaw,P.pitch,tA);const a=.5+u*2.4;setCam(P.pos.x+tA.x*46*Math.cos(a)+tA.z*46*Math.sin(a),P.pos.y+5+u*6,P.pos.z+tA.z*46*Math.cos(a)-tA.x*46*Math.sin(a),P.pos.x,P.pos.y+1,P.pos.z,46);}}],
  end(){coreFxUpdate(0,false);monShow(false);projChar(0);startRunKeep('spare');}
};
// 予備弾の受け渡し：2番機が横に並び、腹の下からアームを伸ばして、予備弾を 1番機の腹の下へ滑らせて装着する
const HAND={init:false,A:new V3(),B:new V3(),q:new THREE.Quaternion()};
function handInit(){if(HAND.init)return;HAND.init=true;
  const pd=buildDiffuser();if(pd.userData.flame)pd.userData.flame.visible=false;pd.visible=false;scene.add(pd);HAND.pod=pd;
  const arm=new THREE.Mesh(new THREE.CylinderGeometry(.07,.11,1,10).rotateX(Math.PI/2),std({color:lin(0x3b4148),metalness:.75,roughness:.35}));arm.visible=false;arm.frustumCulled=false;scene.add(arm);HAND.arm=arm;
  const gl=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,1,6).rotateX(Math.PI/2),glowMat(new V3(.12,.6,.85),0));gl.visible=false;gl.frustumCulled=false;overlay.add(gl);HAND.glow=gl;
  const lp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(.3,2.6,.8),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));lp.scale.set(.75,.75,1);lp.visible=false;scene.add(lp);HAND.lamp=lp;}
// 受け渡し中の 2 機の位置：2番機は右 20m、少し前、わずかに上
function handFly(dt,peel){fwdOf(P.yaw,0,tA);P.pitch=damp(P.pitch,0,2,dt);P.roll=damp(P.roll,0,2,dt);P.pos.addScaledVector(tA,130*dt);P.power=.8;const rx=Math.cos(P.yaw),rz=-Math.sin(P.yaw);
  W.forEach((w,i)=>{if(w.state==='gone')return;if(i===0){const k=peel||0;tB.set(P.pos.x+rx*(20+k*k*60)+tA.x*(2.5+k*20),P.pos.y+.6+Math.sin(G.t*1.3)*.25+k*k*35,P.pos.z+rz*(20+k*k*60)+tA.z*(2.5+k*20));w.pos.lerp(tB,1-Math.exp(-dt*(k>0?2.5:6)));w.yaw=P.yaw;w.pitch=k*.25;w.roll=k>0?Math.sin(k*14)*.45*(1-k)+k*.7:Math.sin(G.t*1.6)*.02;}
    else{slotOf(w,tB);w.pos.lerp(tB,1-Math.exp(-dt*3));w.yaw=P.yaw;w.pitch=P.pitch;w.roll=Math.sin(G.t*1.6+w.ph)*.05;}w.power=.8;});}
// アームを A（2番機の予備弾）から B（1番機の取り付け口）へ ext の割合だけ伸ばす
function handArm(ext){const w=W[0];syncAC(w);syncAC(P);w.mesh.updateMatrixWorld(true);P.mesh.updateMatrixWorld(true);w.mesh.userData.pod.getWorldPosition(HAND.A);P.mesh.userData.pod.getWorldPosition(HAND.B);
  const L=HAND.A.distanceTo(HAND.B)*ext;HAND.arm.visible=HAND.glow.visible=ext>.01;if(ext<=.01)return;tC.copy(HAND.B).sub(HAND.A).normalize();
  for(const m of[HAND.arm,HAND.glow]){m.position.copy(HAND.A).addScaledVector(tC,L/2);m.lookAt(tD.copy(HAND.A).addScaledVector(tC,L+1));m.scale.set(1,1,Math.max(.01,L));}
  HAND.glow.material.uniforms.uAlpha.value=.12+.08*Math.sin(G.t*18);}
const CUT_HAND={mid:true,blendIn:.6,blendOut:1.0,
  subs:[[.2,'G','受け渡しアームを伸ばす。速度を合わせろ…そのままだ',3.0],[3.4,'G','予備弾を送る。揺らすなよ',2.4],[6.3,'C','接続を確認。予備のディフューザー、1番機に装着しました',3.0],[9.5,'G','受け渡し完了だ。…外すなよ、隊長',2.6]],
  begin(){handInit();W[0].state='dockfly';W[0].mesh.visible=true;HAND.pod.visible=false;HAND.lamp.visible=false;HAND.locked=false;tether.visible=false;carrierRing.visible=false;
    // 2番機を受け渡しの位置へ（遠い場合）
    {const rx=Math.cos(P.yaw),rz=-Math.sin(P.yaw);fwdOf(P.yaw,0,tA);const w=W[0];if(w.pos.distanceTo(P.pos)>60)w.pos.set(P.pos.x+rx*20+tA.x*2.5,P.pos.y+.6,P.pos.z+rz*20+tA.z*2.5);}},
  shots:[
    // 並んで飛ぶ 2 機。2番機の腹の下からアームが伸びる
    {dur:3.2,update(t,u,dt){handFly(dt);handArm(ease(sat((t-.5)/2.2)));fwdOf(P.yaw,0,tA);const rx=Math.cos(P.yaw),rz=-Math.sin(P.yaw);
      const mx=(P.pos.x+W[0].pos.x)/2,mz=(P.pos.z+W[0].pos.z)/2;setCam(mx-tA.x*44-rx*6,P.pos.y-4.5,mz-tA.z*44-rz*6,mx,P.pos.y-1.2,mz,40);}},
    // 予備弾がアームを伝って 1番機へ滑っていく
    {dur:3.0,setup(){W[0].mesh.userData.pod.visible=false;HAND.pod.visible=true;SFX.servo();},update(t,u,dt){handFly(dt);handArm(1);const s=ease(sat((t-.2)/2.5));
      HAND.pod.position.lerpVectors(HAND.A,HAND.B,s);HAND.pod.position.y+=Math.sin(s*Math.PI)*.35+Math.sin(G.t*9)*.04*(1-s);P.mesh.userData.pod.getWorldQuaternion(HAND.pod.quaternion);
      fwdOf(P.yaw,0,tA);const p=HAND.pod.position;setCam(p.x+tA.x*13,p.y-3.2,p.z+tA.z*13,p.x,p.y,p.z,44);}},
    // 取り付け口：金具が噛み合い、ランプが緑に変わる
    {dur:3.0,update(t,u,dt){handFly(dt);handArm(t<1.4?1:1-ease(sat((t-1.4)/1.2)));
      if(!HAND.locked&&t>.35){HAND.locked=true;HAND.pod.visible=false;P.hasPod=true;G.spareGiven=true;syncPods();SFX.latch();G.shake=Math.max(G.shake,.25);}
      if(!HAND.locked){HAND.pod.position.copy(HAND.B);P.mesh.userData.pod.getWorldQuaternion(HAND.pod.quaternion);}
      fwdOf(P.yaw,0,tA);const rx=Math.cos(P.yaw),rz=-Math.sin(P.yaw),B=HAND.B;HAND.lamp.visible=HAND.locked&&(t*4%1<.6);HAND.lamp.position.set(B.x+rx*.7,B.y-.35,B.z+rz*.7);
      setCam(B.x+tA.x*7+rx*4.5,B.y-1.6,B.z+tA.z*7+rz*4.5,B.x,B.y,B.z,34);}},
    // アームを収めて、2番機が翼を振って離れていく
    {dur:3.2,update(t,u,dt){handFly(dt,ease(u));HAND.arm.visible=HAND.glow.visible=false;HAND.lamp.visible=false;fwdOf(P.yaw,0,tA);const rx=Math.cos(P.yaw),rz=-Math.sin(P.yaw);
      setCam(P.pos.x-tA.x*34-rx*10,P.pos.y+6,P.pos.z-tA.z*34-rz*10,P.pos.x+tA.x*30+rx*8,P.pos.y+2,P.pos.z+tA.z*30+rz*8,48);}}],
  end(){HAND.pod.visible=HAND.arm.visible=HAND.glow.visible=HAND.lamp.visible=false;P.hasPod=true;G.spareGiven=true;syncPods();W[0].state='form';tether.visible=false;carrierRing.visible=false;
    G.mode='play';$('hud').hidden=false;P.camYaw=P.yaw;P.camPitch=P.pitch*.62;P.inv=1.5;G.prompt=null;chaseCam(0,true);
    say('C','今度はコアのすぐ近くから撃ってください。遠くから撃てば、また雷に撃ち落とされます');
    setObj('PHASE 4　再攻撃','コアから1.5km以内でロックオンせよ');G.target=CORE;G.targetLabel='コア';}
};
const CUT_FIRE2={
  blendIn:.9,blendOut:1.4,
  subs:[[.3,'G','行け…！'],[9.5,'C','コアの消滅を確認。気圧上昇、風速低下…台風が、消えていきます！',5.6],[15.6,'H','やった…やりましたよ、隊長！',3.4],
    [19.4,'G','ふん。悪くない腕だ',2.8],[24.6,'C','全機、帰投してください。温かいお茶を用意して待っています',5]],
  begin(){$('timer').hidden=true;},
  shots:[
    {dur:2.6,setup(){projSetup();},update(t,u,dt){cutFly(dt,130);projMove(dt,5.2);fwdOf(P.yaw,P.pitch,tA);
      setCam(P.pos.x-tA.x*44+tA.z*10,P.pos.y+10,P.pos.z-tA.z*44-tA.x*10,proj.g.position.x,proj.g.position.y,proj.g.position.z,55);}},
    {dur:2.6,setup(){SFX.implode();},update(t,u,dt){cutFly(dt,130);projMove(dt,5.2);const p=proj.g.position;tA.copy(CORE).sub(proj.from).normalize();
      setCam(p.x-tA.x*34+tA.z*16,p.y+5,p.z-tA.z*34-tA.x*16,p.x+tA.x*40,p.y+tA.y*40,p.z+tA.z*40,46-u*8);
      G.white=Math.pow(u,5);}},
    {dur:17,setup(){setMood('victory');proj.g.visible=proj.glow.visible=false;coreShell.visible=false;G.white=1;shock.visible=true;flashAt(0,3400,0,2.5);SFX.thunder(900);
        P.pos.set(2000,2600,4500);P.yaw=Math.PI;P.pitch=0;P.roll=0;snapWing();spouts.forEach(s=>s.mesh.visible=false);},
      update(t,u,dt){G.white=Math.max(0,1-t/2.2);U.uEye.value=1;
        U.uStorm.value=1-ease(sat(t/14));applyEnv(ease(sat((t-3)/12)));
        const R=300+t*1900;shock.scale.set(R,R,R);shock.material.uniforms.uAlpha.value=sat(1.3-u*1.6)*.8;
        cutFly(dt,150);setCam(11000+u*3000,8000+u*5000,20000+u*5000,0,2400-u*900,0,50);}},
    {dur:9.5,setup(){U.uStorm.value=0;applyEnv(1);shock.visible=false;P.pos.set(0,2400,3600);snapWing();trails.forEach(resetTrail);},
      update(t,u,dt){cutFly(dt,150);const a=-2.3+u*2.3;setCam(P.pos.x+Math.sin(a)*70,P.pos.y+8+u*3,P.pos.z+Math.cos(a)*70,P.pos.x,P.pos.y+2,P.pos.z,42+u*14);}}],
  end(){startRunKeep('ret');}
};
const CUT_LAND={
  blendIn:1.2,
  subs:[[.5,'C','ストームライダー1、着陸を許可します。風は南西、3メートル。穏やかな夕方です',5.4],[8.6,'C','接地を確認。…全機帰還、任務完了です。おかえりなさい',5.4],
    [14.6,'H','隊長！　次の出撃も、ご一緒させてください！',3.6],[18.4,'G','その前に、俺の機体に発射装置を付けてくれ',3.2]],
  begin(){U.uStorm.value=0;applyEnv(1);gearOf(P,true);SFX.gear();gateRings.forEach(g=>g.visible=false);setMood('return');},
  shots:[
    // その時点の位置から、そのまま滑走路へ降りていく
    {dur:8,setup(){this.td=0;this.p0=P.pos.clone();this.y0=nearAngle(P.yaw,Math.PI);this.pt=P.pitch;},
      update(t,u){const gy=RWY_Y+3.6,e=1-Math.pow(1-u,2.2),p0=this.p0;P.pos.set(lerp(p0.x,0,ease(sat(u*1.5))),lerp(p0.y,gy,e),lerp(p0.z,BASE.z-760,u));
      P.yaw=lerp(this.y0,Math.PI,ease(sat(u*1.8)));P.pitch=lerp(this.pt,.03+.07*smooth(.6,1,u),sat(u*3));P.roll=Math.sin(t*1.3)*.03*(1-u);P.power=.35;P.pos.y=Math.max(P.pos.y,gy+GP(P,P.pitch));
      W.forEach((w,i)=>{slotOf(w,tA);tB.set(i?70:-70,260+i*30,P.pos.z-420-i*120);w.pos.lerp(tB,sat(u*1.2)*.08+ (u>.5?1:0)*0);if(u<.02)w.pos.copy(tA);w.yaw=P.yaw;w.pitch=0;w.roll=0;});
      // 望遠で機体を追う（遠いほど画角を絞り、機体が画面の一定の大きさに見える）
      {const dx=P.pos.x-42,dy=P.pos.y-(RWY_Y+4+u*2),dz=P.pos.z-(BASE.z-690),dd=Math.hypot(dx,dy,dz);setCam(42,RWY_Y+4+u*2,BASE.z-690,P.pos.x,P.pos.y+1,P.pos.z,clamp(2*Math.atan(30/dd)*57.3,3.5,34));}
      if(u>.985&&!this.td){this.td=1;SFX.touch();G.shake=.4;
        // 接地：主脚のタイヤから白い煙が後ろへ流れる
        fwdOf(P.yaw,0,tA);if(!BOOM.init)boomInit();for(const sd of[-1,1])for(let k=0;k<9;k++)bpart(BOOM.dust,P.pos.x+tA.z*sd*2.55-tA.x*(1+k*.9),RWY_Y+1,P.pos.z-tA.x*sd*2.55-tA.z*(1+k*.9),-tA.x*(10+k*2)+(Math.random()-.5)*3,1+Math.random()*2,-tA.z*(10+k*2)+(Math.random()-.5)*3,brn(1.6,2.6),1.6+k*.15,brn(6,10),{d:k*.012,g:.8,dr:1.6,a:.75,c:_bc.setRGB(.82,.82,.84)});   /* タイヤの白煙（地面に沈まない粒） */
        tireMarks(P.pos.x,P.pos.z,P.yaw);}}},
    {dur:8,update(t,u){const gy=RWY_Y+3.6,z=BASE.z-760+78*t-.5*9.2*t*t;P.pitch=.07*(1-sat(t/1.5))-.025*Math.sin(Math.PI*sat((t-1.2)/.7))*(t>1.2&&t<1.9?1:0);P.pos.set(0,gy+GP(P,P.pitch)-.32*Math.sin(Math.PI*sat(t/.45))*(t<.45?1:0)-.18*Math.sin(Math.PI*sat((t-1.2)/.7))*(t>1.2&&t<1.9?1:0),z);P.power=.2;   /* 主脚の沈み込みと、前脚が着くときの小さな揺れ */
      if(t>1.2&&!this.nw){this.nw=1;SFX.touch&&SFX.touch();}if(t<.1)this.nw=0;
      W.forEach((w,i)=>{w.pos.set(i?55:-55,RWY_Y+70+i*14,BASE.z-2600+175*t-i*150);w.yaw=Math.PI;w.roll=(i?-1:1)*sat(t/6)*.5;w.pitch=.05;});
      setCam(-48+u*14,RWY_Y+6,P.pos.z+70-u*20,P.pos.x,P.pos.y+2,P.pos.z+10,40);}},
    {dur:8,setup(){card('MISSION COMPLETE','任務完了');},update(t,u){W.forEach((w,i)=>{w.pos.set((i?-1:1)*(300+u*200),320+u*90,BASE.z+600+i*200+t*150);w.yaw=Math.PI+(i?-.3:.3);w.roll=0;});
      setCam(-190-u*60,RWY_Y+40+u*150,BASE.z-760-u*260,60,RWY_Y+10,BASE.z+500,46);}}],
  // 途中で飛ばしたときも、機体は滑走路の上で止まった状態にする（結果画面の背景で空に浮かない）
  end(){if(P.pos.y>RWY_Y+8||Math.abs(P.pos.x)>30||P.pos.z<BASE.z-900||P.pos.z>BASE.z+300){P.pos.set(0,RWY_Y+3.6,BASE.z-420);}P.yaw=Math.PI;P.pitch=0;P.roll=0;P.power=.2;gearOf(P,true);P.pos.y=RWY_Y+3.6+GP(P,0);syncAC(P);
    W.forEach((w,i)=>{if(w.state!=='gone'){w.pos.set(i?-300:300,420,BASE.z+800+i*200);w.yaw=Math.PI;syncAC(w);}});showResult();}
};
function startRunKeep(ph){ // カットシーン後、機体の状態を保って次のフェーズへ
  resetHaz();G.mode='play';$('hud').hidden=false;P.roll=0;
  if(ph==='ret'){if(Math.abs(P.yaw-Math.PI)>.01||P.pos.y<2000||P.pos.z<3500||Math.abs(P.pos.x)>300)P.pos.set(0,2400,4200);P.yaw=Math.PI;P.pitch=0;P.hull=Math.max(P.hull,40);W.forEach(w=>{if(w.state!=='gone')w.state='form';});snapWing();P.hasPod=false;G.spareGiven=true;}
  if(ph==='spare'){P.hasPod=false;}
  P.camYaw=P.yaw;P.camPitch=P.pitch*.62;
  trails.forEach(resetTrail);enterPhase(ph,true);chaseCam(0,true);
}

// ───────────────────────── 画面 ─────────────────────────
function showTitle(){
  view.scale=.72;cloudMat.uniforms.uSteps.value=84;resize();
  G.mode='title';ICP.seen=0;strReset();monShow(false);if(typeof CFX!=='undefined'&&CFX.g)CFX.g.visible=false;P.hull=100;startRun0();resetHaz();clearRadio();CUT=null;AU.paused=false;if(AU.ctx)initAudio();document.body.classList.remove('cine');
  endOptPrev();if(typeof stopExplore==='function')stopExplore();G.pauseFrom=null;['hud','over','res','pause','help','opts','skip'].forEach(i=>$(i).hidden=true);$('title').hidden=false;$('card').classList.remove('on');$('banner').classList.remove('on');bannerT=0;   // 任務の帯（PHASE ○）がタイトルに残っていた
  U.uStorm.value=1;U.uEye.value=1;G.eyeSun=0;applyEnv(0);setMood('title');$('fade').style.opacity=0;G.white=0;
  P.pos.set(0,RWY_Y+3.6,RZ0());P.yaw=0;P.pitch=0;P.roll=0;P.br=null;P.brA=0;P.brCD=0;syncAC(P);W.forEach((w,i)=>{w.state='form';w.pos.set(i?24:-24,GH(w),RZ0()+45+i*35);w.yaw=0;w.pitch=0;w.roll=0;syncAC(w);});resetArmor();
  spouts.forEach((s,i)=>s.mesh.visible=i<DF().spouts);gateRings.forEach(g=>g.visible=false);P.hasPod=true;G.spareGiven=false;syncPods();
}
function showResult(){
  G.mode='result';$('res').hidden=false;$('hud').hidden=true;
  const t=G.missionT,mm=Math.floor(t/60),ss=Math.floor(t%60);
  let sc=100-Math.max(0,t-330)*.08-G.stats.dmg*.25-G.retries*8+(G.stats.saved?8:G.stats.saved===false?-8:0)+(opts.diff||0)*7;
  const rank=sc>=92?'S':sc>=78?'A':sc>=60?'B':'C';
  $('rank').textContent=rank;$('rankT').textContent={S:'伝説の嵐乗り',A:'一流のストームライダー',B:'頼れる隊長',C:'満身創痍の帰還'}[rank];
  $('resT').innerHTML=`<tr><td>難易度</td><td>${DF().name}</td></tr><tr><td>任務時間</td><td class="mono">${mm}:${String(ss).padStart(2,'0')}</td></tr><tr><td>機体の耐久（残り）</td><td class="mono">${Math.round(P.hull)}%</td></tr>`+
    `<tr><td>受けたダメージの合計</td><td class="mono">${Math.round(G.stats.dmg)}</td></tr><tr><td>3番機ハル</td><td>${G.stats.shot?'撃墜された':G.stats.saved?'救援成功・全機帰還':G.stats.saved===false?'途中離脱（救助済み）':'無事帰還'}</td></tr>`+
    `<tr><td>再挑戦</td><td class="mono">${G.retries} 回</td></tr>`+(G.stats.kills?`<tr><td>撃墜した迎撃機</td><td class="mono">${G.stats.kills} 機</td></tr>`:'')+(G.stats.evade?`<tr><td>ロールで振り切ったミサイル</td><td class="mono">${G.stats.evade} 発</td></tr>`:'')+(G.stats.sunk?`<tr><td>沈めた船</td><td class="mono">${G.stats.sunk} 隻</td></tr>`:'')+(G.stats.wreck?`<tr><td>壊した施設</td><td class="mono">${G.stats.wreck} 棟</td></tr>`:'');
}
function updateDying(dt){
  G.dieWall=(G.dieWall||0)+dt;if(G.dieWall>9){gameOver();return;}
  G.dieT+=dt;if(G.crash){G.shake=Math.max(0,.8-G.dieT*.5);chaseCam(dt);if(G.dieT>2.6)$('fade').style.opacity=1;if(G.dieT>3.6){G.crash=2;P.mesh.visible=true;G.dieT=9;}else return;}
  if(G.crash===2){gameOver();return;}
  P.pitch=damp(P.pitch,-.7,1.2,dt);P.roll+=dt*2.4;P.speed=damp(P.speed,90,1,dt);fwdOf(P.yaw,P.pitch,tA);P.pos.addScaledVector(tA,P.speed*dt);if(P.pos.y<8&&!G.crash){P.pos.y=8;P.speed=0;G.crash=1;G.dieT=Math.min(G.dieT,.2);P.mesh.visible=false;if(groundAt(P.pos.x,P.pos.z)<3){explode(P.pos,.45);explode(new V3(P.pos.x,4,P.pos.z),1,'splash');G.wash=1;G.lensWet=1;}else{explode(P.pos,.8);vegIgnite(P.pos.x,P.pos.z,28);}return;}syncAC(P);
  P.power=.1;G.shake=.5;chaseCam(dt);
  if(G.dieT>1.0)$('fade').style.opacity=1;
  if(G.dieT>2.1)gameOver();
}
function gameOver(){G.mode='over';G.crash=0;$('fade').style.opacity=0;$('over').hidden=false;$('hud').hidden=true;$('overT').textContent=P.hull<=0?'機体喪失':'任務失敗';$('overP').textContent=causeText();clearRadio();setMood('title');}

// ───────────────────────── HUD ─────────────────────────
let rctx,hudN=0,hctx,pullT=0;
// ───────────────────────── 飛行 HUD（姿勢・速度・高度・方位） ─────────────────────────
function drawFlightHUD(dt){
  const cv=$('fhud'),dpr=Math.min(window.devicePixelRatio||1,1.25),w=view.cssW,h=view.cssH;
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
  const c=hctx;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
  const cx=w/2,cy=h*.5,S=Math.max(.62,Math.min(w/1280,h/720)),D=180/Math.PI;
  if(G.hudFail>0){if(Math.sin(G.t*23)>.2){c.fillStyle='rgba(255,90,74,.9)';c.font='600 '+Math.round(15*S)+'px ui-monospace,Menlo,monospace';c.textAlign='center';c.fillText('HUD FAIL  '+G.hudFail.toFixed(0),cx,cy-40*S);}
    if(Math.random()<.25){c.strokeStyle='rgba(150,255,196,.5)';c.beginPath();const y=cy+(Math.random()-.5)*240*S;c.moveTo(cx-300*S,y);c.lineTo(cx+300*S,y);c.stroke();}return;}
  if(P.ice){c.save();c.fillStyle='rgba(170,225,255,.95)';c.font='600 '+Math.round(13*S)+'px ui-monospace,Menlo,monospace';c.textAlign='center';if(Math.sin(G.t*8)>-.3)c.fillText('ICE',cx,cy-150*S);c.restore();}
  const col='rgba(150,255,196,.86)';c.strokeStyle=col;c.fillStyle=col;c.lineWidth=1.4*S;c.lineCap='butt';
  c.shadowBlur=0;
  const font=(px,b)=>{c.font=(b?'600 ':'')+Math.round(px*S)+'px "SF Mono",ui-monospace,Menlo,Consolas,monospace';};
  const pd=P.pitch*D,ppd=13*S;
  // ピッチラダー
  c.save();c.translate(cx,cy);c.rotate(P.roll);c.beginPath();c.rect(-230*S,-128*S,460*S,256*S);c.clip();font(11);c.textBaseline='middle';
  for(let a=-90;a<=90;a+=5){const y=(pd-a)*ppd;if(Math.abs(y)>140*S)continue;const major=a%10===0,half=(a===0?210:major?70:40)*S,gap=(a===0?46:26)*S;
    c.setLineDash(a<0?[7*S,5*S]:[]);c.beginPath();c.moveTo(-half,y);c.lineTo(-gap,y);c.moveTo(gap,y);c.lineTo(half,y);
    if(a!==0&&major){const k=(a>0?7:-7)*S;c.moveTo(-half,y);c.lineTo(-half,y+k);c.moveTo(half,y);c.lineTo(half,y+k);}
    c.stroke();if(a!==0&&major){c.textAlign='right';c.fillText(Math.abs(a),-half-6*S,y);c.textAlign='left';c.fillText(Math.abs(a),half+6*S,y);}}
  c.setLineDash([]);c.restore();
  // バンク目盛り
  c.save();c.translate(cx,cy);const R=172*S;
  for(const a of[-60,-45,-30,-20,-10,0,10,20,30,45,60]){const r=a/D,l=(a%30===0?12:7)*S;c.beginPath();c.moveTo(Math.sin(r)*R,-Math.cos(r)*R);c.lineTo(Math.sin(r)*(R+l),-Math.cos(r)*(R+l));c.stroke();}
  c.rotate(clamp(P.roll,-1.1,1.1));c.beginPath();c.moveTo(0,-R+2*S);c.lineTo(-6*S,-R+13*S);c.lineTo(6*S,-R+13*S);c.closePath();c.stroke();c.restore();
  // 機軸マークと速度ベクトル
  c.beginPath();c.moveTo(cx-34*S,cy);c.lineTo(cx-12*S,cy);c.lineTo(cx-6*S,cy+8*S);c.lineTo(cx,cy);c.lineTo(cx+6*S,cy+8*S);c.lineTo(cx+12*S,cy);c.lineTo(cx+34*S,cy);c.stroke();
  const hs=Math.hypot(P.vel.x,P.vel.z)||1,gam=Math.atan2(P.vel.y,hs)*D;let bet=(Math.atan2(-P.vel.x,-P.vel.z)-P.yaw)*D;bet=((bet+540)%360)-180;
  const fx=cx-clamp(bet,-14,14)*ppd*.9,fy=cy+(pd-gam)*ppd;
  c.beginPath();c.arc(fx,fy,7*S,0,6.283);c.moveTo(fx-7*S,fy);c.lineTo(fx-19*S,fy);c.moveTo(fx+7*S,fy);c.lineTo(fx+19*S,fy);c.moveTo(fx,fy-7*S);c.lineTo(fx,fy-14*S);c.stroke();
  // 方位テープ
  const hdg=((-P.yaw*D)%360+360)%360,ty=92*S,tw=170*S,pxd=4.6*S;
  c.save();c.beginPath();c.rect(cx-tw,ty-22*S,tw*2,40*S);c.clip();font(11);c.textAlign='center';c.textBaseline='alphabetic';
  for(let a=Math.floor((hdg-40)/5)*5;a<=hdg+40;a+=5){const x=cx+(a-hdg)*pxd,m=((a%360)+360)%360;c.beginPath();c.moveTo(x,ty);c.lineTo(x,ty-(m%10===0?9:5)*S);c.stroke();
    if(m%10===0)c.fillText(m%90===0?'NESW'[m/90]:String(m/10).padStart(2,'0'),x,ty-12*S);}
  c.restore();
  c.beginPath();c.moveTo(cx,ty+2*S);c.lineTo(cx-5*S,ty+10*S);c.lineTo(cx+5*S,ty+10*S);c.closePath();c.stroke();
  font(13,1);c.textAlign='center';c.fillText(String(Math.round(hdg)%360).padStart(3,'0'),cx,ty+26*S);
  if(G.target){let b=(Math.atan2(G.target.x-P.pos.x,-(G.target.z-P.pos.z))*D-hdg);b=((b+540)%360)-180;const x=cx+clamp(b,-36,36)*pxd;c.save();c.strokeStyle=c.fillStyle='rgba(255,212,138,.95)';c.beginPath();c.moveTo(x,ty-1*S);c.lineTo(x-5*S,ty-9*S);c.lineTo(x+5*S,ty-9*S);c.closePath();c.fill();c.restore();}
  // 速度・高度テープ
  const tape=(x,val,step,major,px,side,label)=>{const th=118*S;c.save();c.beginPath();c.rect(x-60*S,cy-th,120*S,th*2);c.clip();font(10.5);c.textBaseline='middle';c.textAlign=side>0?'left':'right';
    for(let v=Math.floor((val-th/px)/step)*step;v<=val+th/px;v+=step){if(v<0)continue;const y=cy+(val-v)*px,mj=v%major===0;c.beginPath();c.moveTo(x,y);c.lineTo(x+side*(mj?11:6)*S,y);c.stroke();if(mj&&Math.abs(y-cy)>15*S)c.fillText(v,x+side*15*S,y);}
    c.restore();c.beginPath();c.moveTo(x,cy-th);c.lineTo(x,cy+th);c.stroke();
    const bw=62*S,bh=24*S,bx=side>0?x+10*S:x-10*S-bw;c.save();c.fillStyle='rgba(2,14,10,.72)';c.fillRect(bx,cy-bh/2,bw,bh);c.restore();c.strokeRect(bx,cy-bh/2,bw,bh);
    c.beginPath();c.moveTo(x,cy);c.lineTo(x+side*10*S,cy-5*S);c.moveTo(x,cy);c.lineTo(x+side*10*S,cy+5*S);c.stroke();
    font(15,1);c.textAlign='center';c.textBaseline='middle';c.fillText(Math.round(val),bx+bw/2,cy+1*S);font(10);c.fillText(label,bx+bw/2,cy-th-10*S);};
  const kt=P.speed*1.944,alt=P.pos.y;
  tape(cx-292*S,kt,10,50,2.3*S,-1,'SPD kt');tape(cx+292*S,alt,20,100,1.15*S,1,'ALT m');
  // 補助表示
  font(11);c.textAlign='left';c.textBaseline='alphabetic';const lx=cx-352*S,by=cy+142*S;
  c.fillText('M  '+(P.speed/340).toFixed(2),lx,by);c.fillText('G  '+clamp(P.g||1,-1,9).toFixed(1),lx,by+16*S);c.fillText('AOA '+(clamp((pd-gam),-9,25)).toFixed(1),lx,by+32*S);
  c.textAlign='right';const rx=cx+352*S;c.fillText('VS '+(P.vel.y>=0?'+':'')+Math.round(P.vel.y)+' m/s',rx,by);if(alt<600)c.fillText('R '+Math.round(Math.max(0,alt-3)),rx,by+16*S);
  c.fillText(P.hasPod?'DFSR  ARM':'DFSR  ---',rx,by+32*S);
  c.textAlign='center';font(10);c.fillText('SR-01',cx,cy+150*S);
  if(P.boosting){font(11,1);c.fillText('A/B',cx-292*S,cy+142*S);}
  // 対地接近警報
  const danger=alt<70&&P.vel.y<-9||(G.down>.4&&alt<260);
  if(danger){pullT-=dt;if(pullT<=0){pullT=.55;SFX.pull();}
    if(Math.sin(G.t*14)>0){c.save();c.strokeStyle=c.fillStyle='rgba(255,90,74,.95)';font(26,1);c.fillText('PULL UP',cx,cy+78*S);c.lineWidth=2*S;c.beginPath();c.moveTo(cx-60*S,cy+40*S);c.lineTo(cx,cy+56*S);c.lineTo(cx+60*S,cy+40*S);c.stroke();c.restore();}}
  else pullT=0;
}
function updateHUD(dt){
  if(G.hudFail>0)G.hudFail-=dt;
  drawFlightHUD(dt);
  $('hullBar').firstElementChild.style.transform=`scaleX(${P.hull/100})`;$('hullBar').classList.toggle('low',P.hull<=30);$('hullN').textContent=Math.round(P.hull);
  $('boostBar').firstElementChild.style.transform=`scaleX(${P.boost/100})`;$('boostN').textContent=Math.round(P.boost);
  if((hudN++&3)===0){
    $('iAlt').textContent=Math.round(P.pos.y);$('iSpd').textContent=Math.round(P.speed*1.94);$('iWind').textContent=Math.round(P.wind*1.4);
    $('iDist').textContent=(Math.hypot(P.pos.x,P.pos.z)/1000).toFixed(1);
    W.forEach((w,i)=>{const el=$('w'+(i+1));const st=w.shot?['撃墜','st-bad']:w.state==='gone'?['離脱','st-out']:w.state==='stall'?['失速','st-bad']:w.state==='carrier'||w.state==='dockfly'?['予備搭載','st-mid']:(P.turb>.6?['苦戦中','st-mid']:['編隊','st-ok']);
      el.className=st[1];el.innerHTML=WHO[w.who][0]+'<b>'+st[0]+'</b>';});
    drawRadar();
    if(P.hull<=30&&G.mode==='play'){G.hullBeep=(G.hullBeep||0)+1;if(G.hullBeep%14===0)SFX.caution();}
  }
  // マーカー
  const el=$('mark');
  if(G.target&&!(G.hudFail>0)){
    el.hidden=false;tA.copy(G.target).applyMatrix4(camera.matrixWorldInverse);
    const hw=view.cssW/2,hh=view.cssH/2,f=hh/Math.tan(camera.fov*Math.PI/360);let x,y,off=false;
    if(tA.z<-1){x=tA.x/-tA.z*f;y=-tA.y/-tA.z*f;}else{x=tA.x*1e4;y=-tA.y*1e4;if(Math.abs(x)<1&&Math.abs(y)<1)y=1e4;off=true;}
    // 画面の端に寄せるときの余白は画面の大きさに比例させる（固定値だとスマートフォンの横向きで下の余白が中心近くまで来る）
    const mx=hw-(IS_TOUCH?Math.min(150,view.cssW*.17):Math.min(60,view.cssW*.07)),   // スマートフォンは左右の操作ボタンとスティックを避ける
    myT=hh-Math.min(120,view.cssH*.2),myB=hh-Math.min(190,view.cssH*.27),my=y>0?myB:myT;const onScreen=!off&&Math.abs(x)<hw-14&&Math.abs(y)<hh-14;   // 画面に見えている間はその場所に出す
    if(!onScreen&&(Math.abs(x)>mx||Math.abs(y)>my)){const k=Math.min(mx/Math.max(Math.abs(x),1e-6),my/Math.max(Math.abs(y),1e-6));x*=k;y*=k;off=true;}
    el.style.transform=`translate(${hw+x}px,${hh+y}px)`;el.classList.toggle('off',off);el.classList.toggle('lock',G.lock>=1);
    el.firstElementChild.style.transform=off?`rotate(${Math.atan2(y,x)*180/Math.PI-45}deg)`:'';
    const d=G.target.distanceTo(P.pos);el.lastElementChild.textContent=G.targetLabel+' '+(d>=1000?(d/1000).toFixed(1)+'km':Math.round(d)+'m');
    el.lastElementChild.style.left=x>mx-140?'-150px':'22px';
  }else el.hidden=true;
  if(IS_TOUCH&&!G.prompt&&G.wantOn){G.wantOn=0;$('tbA').classList.remove('want');$('tbB').classList.remove('want');$('prompt').dataset.t='';}if(G.prompt)G.wantOn=1;
  const pr=$('prompt');if(G.prompt){pr.hidden=false;if(pr.dataset.t!==G.prompt.t){pr.dataset.t=G.prompt.t;$('promptT').innerHTML=tk(G.prompt.t);if(IS_TOUCH){$('tbA').classList.toggle('want',/Space/.test(G.prompt.t));$('tbB').classList.toggle('want',/Shift/.test(G.prompt.t));}}pr.querySelector('i').style.transform=`scaleX(${sat(G.prompt.p)})`;}else pr.hidden=true;
  if(G.warnT>0){G.warnT-=dt;if(G.warnT<=0)$('warn').hidden=true;}
  if(G.hintT>0){G.hintT-=dt;if(G.hintT<=0)$('hint').hidden=true;}
}
function drawRadar(){
  if(G.hudFail>0){rctx.clearRect(0,0,340,340);return;}
  const c=rctx,S=340,cx=S/2,cy=S/2,sc=(S/2-14)/4500;c.clearRect(0,0,S,S);
  c.save();c.beginPath();c.arc(cx,cy,S/2-4,0,6.283);c.fillStyle='rgba(4,14,22,.55)';c.fill();c.clip();
  const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw),rx=Math.cos(P.yaw),rz=-Math.sin(P.yaw);
  const tr=(x,z)=>{const dx=x-P.pos.x,dz=z-P.pos.z;return[cx+(dx*rx+dz*rz)*sc,cy-(dx*fx+dz*fz)*sc];};
  {// 任務エリアの外側を赤く塗り、境界線を引く
    if(!drawRadar.off){drawRadar.off=document.createElement('canvas');drawRadar.off.width=drawRadar.off.height=S;}
    const o=drawRadar.off.getContext('2d'),[ox,oy]=tr(0,0),[bx,by]=tr(BASE.x,BASE.z),uni=e=>{o.beginPath();o.arc(ox,oy,AREA.storm*sc+e,0,6.283);o.fill();o.beginPath();o.arc(bx,by,AREA.base*sc+e,0,6.283);o.fill();
      o.lineCap='round';o.lineWidth=(AREA.corridor*sc+e)*2;o.beginPath();o.moveTo(ox,oy);const[zx,zy]=tr(0,BASE.z);o.lineTo(zx,zy);o.stroke();};
    o.globalCompositeOperation='source-over';o.clearRect(0,0,S,S);o.fillStyle='rgba(255,70,50,.16)';o.fillRect(0,0,S,S);
    o.fillStyle=o.strokeStyle='rgba(255,110,90,.85)';uni(2.5);o.globalCompositeOperation='destination-out';o.fillStyle=o.strokeStyle='#000';uni(0);o.globalCompositeOperation='source-over';c.drawImage(drawRadar.off,0,0);}
  c.strokeStyle='rgba(190,233,255,.22)';c.lineWidth=2;for(const r of[1500,3000,4500]){c.beginPath();c.arc(cx,cy,r*sc,0,6.283);c.stroke();}
  if(ICP.st){c.fillStyle='#ff5a4a';for(const f of ICP.f){if(!f.mesh.visible)continue;const[x,y]=tr(f.pos.x,f.pos.z);c.beginPath();c.moveTo(x,y-9);c.lineTo(x+7,y+7);c.lineTo(x-7,y+7);c.fill();}
    c.fillStyle='#fff';for(const m of ICP.mis){if(m.life<=0)continue;const[x,y]=tr(m.pos.x,m.pos.z);c.beginPath();c.arc(x,y,4.5,0,6.283);c.fill();}}
  if(U.uStorm.value>.3){const[ox,oy]=tr(0,0);c.strokeStyle='rgba(255,255,255,.5)';c.setLineDash([8,8]);c.beginPath();c.arc(ox,oy,EYE_R*U.uEye.value*sc,0,6.283);c.stroke();c.setLineDash([]);
    c.strokeStyle='rgba(160,180,200,.3)';c.lineWidth=(WALL_OUT-EYE_R)*sc*.5;c.beginPath();c.arc(ox,oy,(WALL_OUT+EYE_R)*.5*sc,0,6.283);c.stroke();c.lineWidth=2;
    for(const s of spouts){const[x,y]=tr(s.mesh.position.x,s.mesh.position.z);c.fillStyle='rgba(235,240,245,.9)';c.beginPath();c.arc(x,y,7,0,6.283);c.fill();c.strokeStyle='rgba(235,240,245,.5)';c.beginPath();c.arc(x,y,13,0,4);c.stroke();}}
  for(const s of strikes){const[x,y]=tr(s.x,s.z);c.strokeStyle='#ff5a4a';c.lineWidth=3;c.beginPath();c.arc(x,y,DF().rad*sc+5,0,6.283);c.stroke();c.fillStyle='rgba(255,90,74,.35)';c.fill();}
  W.forEach(w=>{if(w.state==='gone')return;const[x,y]=tr(w.pos.x,w.pos.z);c.fillStyle=w.state==='stall'?'#ff5a4a':'#8dffb0';c.beginPath();c.arc(x,y,6,0,6.283);c.fill();});
  if(G.target){let[x,y]=tr(G.target.x,G.target.z);const dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy),m=S/2-18;if(d>m){x=cx+dx/d*m;y=cy+dy/d*m;}
    c.save();c.translate(x,y);c.rotate(Math.PI/4);c.strokeStyle='#ffd48a';c.lineWidth=3;c.strokeRect(-7,-7,14,14);c.restore();}
  c.fillStyle='#fff';c.beginPath();c.moveTo(cx,cy-13);c.lineTo(cx+9,cy+10);c.lineTo(cx,cy+5);c.lineTo(cx-9,cy+10);c.closePath();c.fill();
  c.restore();c.strokeStyle='rgba(190,233,255,.6)';c.lineWidth=2;c.beginPath();c.arc(cx,cy,S/2-4,0,6.283);c.stroke();
}

// ───────────────────────── 入力 ─────────────────────────
function readInput(){
  const k=input.keys;let x=(k.KeyD||k.ArrowRight?1:0)-(k.KeyA||k.ArrowLeft?1:0),y=(k.KeyW||k.ArrowUp?1:0)-(k.KeyS||k.ArrowDown?1:0);
  let b=!!(k.ShiftLeft||k.ShiftRight),a=!!k.Space;input.xb=!!(k.KeyE||input.tXb);   /* 探検のボートのブースト（E／加速ボタン） */
  x+=input.tx;y+=input.ty;
  // 指やスティックを左右へ 2 度すばやく倒すとバレルロール（キーの 2 度押しと同じ）
  {const sx=input.tx+(navigator.getGamepads&&navigator.getGamepads()[0]?.axes[0]||0),d=sx>.75?1:sx<-.75?-1:0;
    if(d&&!input.flk&&G.mode==='play'){const now=G.t*1000;/* 実時間ではなくゲーム内時間（コマ落ちや録画でも同じ判定） */if(input.flD===d&&now-input.flT<380){input.rollQ=d;input.flT=0;}else{input.flD=d;input.flT=now;}}if(d)input.flk=1;else if(Math.abs(sx)<.35)input.flk=0;}b=b||input.tBoost;a=a||input.tAct;
  const gp=navigator.getGamepads?navigator.getGamepads()[0]:null;
  if(gp){if(Math.abs(gp.axes[0])>.15)x+=gp.axes[0];if(Math.abs(gp.axes[1])>.15)y-=gp.axes[1];b=b||gp.buttons[7]?.pressed||gp.buttons[1]?.pressed;a=a||gp.buttons[0]?.pressed;}
  {const gn=!!k.KeyF||!!input.tGun,ms=!!k.KeyR||!!input.tMsl;input.gun=G.armed&&gn;input.mslHit=G.armed&&ms&&!input.msl;input.msl=ms;}
  {const sk=opts.sens/100,cv=v=>Math.sign(v)*Math.pow(Math.abs(v),1/sk),r=9*sk;   /* 操縦の感度：低いほど中央付近がおだやかで、操作への反応もゆっくり（最大の効きは同じ） */
    input.x=damp(input.x,cv(clamp(x,-1,1)),r,.016);input.y=damp(input.y,cv(clamp(y,-1,1)),r,.016);}input.boost=b;input.actHit=a&&!input.act;input.act=a;
}
function bindInput(){
  for(const ev of['keydown','pointerdown','pointermove','touchstart','wheel'])addEventListener(ev,()=>{lastInput=performance.now();},{passive:true});
  addEventListener('keydown',e=>{
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
    input.keys[e.code]=true;initAudio();
    if(e.code==='Enter'&&G.mode==='cut')skipCut();
    if(G.mode!=='play'&&G.mode!=='cut'&&!e.repeat){const K=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'];CHEAT.push(e.code);if(CHEAT.length>K.length)CHEAT.shift();if(CHEAT.join()===K.join()){CHEAT.length=0;toggleArmed();}}
    if((e.code==='Escape'||e.code==='KeyP')&&!e.repeat)togglePause();
    // バレルロール：A・D（←・→）の 2 度押し
    if(!e.repeat&&G.mode==='play'){const d={KeyA:-1,ArrowLeft:-1,KeyD:1,ArrowRight:1}[e.code];
      if(d){const now=performance.now();if(input.tapD===d&&now-input.tapT<280){input.rollQ=d;input.tapT=0;}else{input.tapD=d;input.tapT=now;}}}
  });
  addEventListener('keyup',e=>{input.keys[e.code]=false;});
  addEventListener('blur',()=>{input.keys={};});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&G.mode==='play')togglePause();else if(!document.hidden&&AU.ctx)initAudio();});
  addEventListener('pointerdown',()=>initAudio(),true);addEventListener('focus',()=>{if(AU.ctx)initAudio();});
  addEventListener('resize',()=>resize());
  const click=(id,fn)=>$(id).addEventListener('click',()=>{initAudio();if(id==='bStart'||id==='bRetry'||id==='bAgain')SFX.uiStart();else SFX.ui();fn();});
  document.querySelectorAll('.screen button').forEach(b=>b.addEventListener('mouseenter',()=>SFX.uiHover()));
  const setDiff=d=>{opts.diff=d;saveOpts();document.querySelectorAll('#diff button').forEach(b=>b.classList.toggle('on',+b.dataset.d===d));$('diffT').textContent=DIFFS[d].desc;};
  document.querySelectorAll('#diff button').forEach(b=>b.addEventListener('click',()=>{initAudio();SFX.ui();setDiff(+b.dataset.d);}));setDiff(opts.diff||0);
  click('bStart',()=>{perfStart();resize();$('title').hidden=true;startCut(CUT_INTRO);});
  click('bExplore',()=>{SFX.ui();exStartAsync();});click('bHelp',()=>{$('help').hidden=false;if(G.mode==='title')$('title').hidden=true;});click('bOpts',()=>{$('opts').hidden=false;if(G.mode==='title'){G.optPrev=true;P.power=0;$('title').hidden=true;setDoors(1);hangarLight(1);gearOf(P,true);cloudReset=true;}});click('bPOpts',()=>{$('opts').hidden=false;if(G.mode==='pause'&&!G.optPrev){G.optPrev='air';$('pause').hidden=true;document.body.classList.add('optair');G.orb=null;G.pt=0;G.pcam={p:camera.position.clone(),q:camera.quaternion.clone(),f:camera.fov};cloudReset=true;}});   // 一時停止中の設定：飛んでいる機体のまわりを回って見せる（以前は景色だけで機体が見えなかった）
  {const o=$('opts'),pts=new Map();let pd=0;
    const lim=()=>{const q=G.orb;q.el=clamp(q.el,-.06,1.25);q.r=clamp(q.r,12,44);const top=RWY_Y+33-(P.pos.y+.6);if(Math.sin(q.el)*q.r>top)q.r=Math.max(12,top/Math.max(Math.sin(q.el),.01));};
    const start=()=>{if(!G.orb){const a=G.t*.2+.9;G.orb={az:a,el:.17,r:36};}};
    o.addEventListener('pointerdown',e=>{if(e.target!==o||!G.optPrev)return;start();pts.set(e.pointerId,{x:e.clientX,y:e.clientY});try{o.setPointerCapture(e.pointerId);}catch(_){}o.classList.add('grabbing');
      if(pts.size===2){const[a,b]=[...pts.values()];pd=Math.hypot(a.x-b.x,a.y-b.y);}});
    o.addEventListener('pointermove',e=>{const p=pts.get(e.pointerId);if(!p||!G.orb)return;
      if(pts.size===1){G.orb.az-=(e.clientX-p.x)*.009;G.orb.el+=(e.clientY-p.y)*.006;}
      p.x=e.clientX;p.y=e.clientY;if(pts.size===2){const[a,b]=[...pts.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pd>0)G.orb.r*=pd/d;pd=d;}lim();});
    const up=e=>{pts.delete(e.pointerId);if(!pts.size)o.classList.remove('grabbing');pd=0;};o.addEventListener('pointerup',up);o.addEventListener('pointercancel',up);
    o.addEventListener('wheel',e=>{if(!G.optPrev||e.target!==o)return;start();G.orb.r*=1+Math.sign(e.deltaY)*.08;lim();e.preventDefault();},{passive:false});}
  document.querySelectorAll('.bBack').forEach(b=>b.addEventListener('click',()=>{SFX.ui();$('help').hidden=true;$('opts').hidden=true;if(G.mode==='title')$('title').hidden=false;endOptPrev();}));
  // 機体の塗装と形
  const mkSel=(id,items,key,html)=>{const box=$(id);items.forEach((it,i)=>{const b=document.createElement('button');b.type='button';b.innerHTML=html(it);b.title=it.name;b.setAttribute('aria-label',it.name);b.addEventListener('click',()=>{initAudio();SFX.ui();opts[key]=i;saveOpts();upd();makePlayer();syncPods();});box.appendChild(b);});
    const upd=()=>{[...box.children].forEach((b,i)=>b.classList.toggle('on',i===(opts[key]||0)));const n=$(id+'N');if(n)n.textContent=items[opts[key]||0].name;};upd();};
  const hx=h=>'#'+h.toString(16).padStart(6,'0');
  mkSel('oColor',SCHEMES,'color',it=>`<i style="background:linear-gradient(135deg,${hx(it.body)} 0 58%,${hx(it.acc)} 58% 100%)"></i>`);
  mkSel('oShape',SHAPES,'shape',it=>it.name);
  click('bResume',togglePause);click('bPTitle',showTitle);click('bOTitle',showTitle);click('bRTitle',showTitle);
  click('bRetry',()=>{G.retries++;startRun(G.ckpt?G.ckpt.ph:'approach');});
  click('bAgain',()=>{if(camera.view&&camera.view.enabled)camera.clearViewOffset();strReset();/* 新しい任務：壊した施設・沈めた船・焦げ跡を元に戻す */perfStart();resize();$('res').hidden=true;startCut(CUT_INTRO);});
  $('skip').addEventListener('click',skipCut);
  $('oMus').value=opts.mus;$('oSfx').value=opts.sfx;$('oInv').checked=opts.inv;$('oQ').value=opts.q;$('oSens').value=opts.sens;$('oCalm').checked=opts.calm;
  $('oFix').addEventListener('click',()=>{restartAudio();setTimeout(()=>SFX.ui(),150);});
  const ap=()=>{opts.mus=+$('oMus').value;opts.sfx=+$('oSfx').value;opts.inv=$('oInv').checked;opts.q=+$('oQ').value;opts.sens=+$('oSens').value;opts.calm=$('oCalm').checked;AU.musVol=opts.mus/100;AU.sfxVol=opts.sfx/100;setVolumes();
    if(view.q!==opts.q){view.q=opts.q;view.cs=1;cloudSteps();resize(true);}saveOpts();};
  ['oMus','oSfx','oInv','oQ','oSens','oCalm'].forEach(i=>$(i).addEventListener('input',ap));ap();
  G.armed=false;try{localStorage.removeItem('stormrider_armed');}catch(e){}applyArmed();   // 武装モードは保存しない（読み込み直すと解除）
  {let n=0,t0=0;$('dial').addEventListener('pointerdown',e=>{const t=performance.now();if(t-t0>2500)n=0;t0=t;n++;if(n>=7){n=0;toggleArmed();}});$('dial').style.pointerEvents='auto';}
  fitUI();addEventListener('resize',fitUI);addEventListener('orientationchange',()=>setTimeout(fitUI,250));
  // タッチ
  IS_TOUCH=matchMedia('(pointer:coarse)').matches||('ontouchstart' in window&&navigator.maxTouchPoints>0&&innerWidth<1000);
  if(IS_TOUCH){
    document.body.classList.add('touch');view.touch=true;const st=$('stick'),nub=st.firstElementChild,zone=$('stickZone');let sid=null,ox=0,oy=0;const RAD=58;
    // 左側のどこに指を置いても、そこが操縦桿の中心になる
    const find=e=>{for(const t of e.changedTouches)if(t.identifier===sid)return t;return null;};
    zone.addEventListener('touchstart',e=>{initAudio();if(sid!==null)return;const t=e.changedTouches[0];sid=t.identifier;ox=t.clientX;oy=t.clientY;st.style.left=(ox-62)+'px';st.style.top=(oy-62)+'px';st.style.bottom='auto';st.classList.add('on');e.preventDefault();},{passive:false});
    zone.addEventListener('touchmove',e=>{const t=find(e);if(!t)return;let x=(t.clientX-ox)/RAD,y=(t.clientY-oy)/RAD;const d=Math.hypot(x,y);if(d>1){x/=d;y/=d;}
      // 中心付近は遊びを持たせ、端へ向かってなめらかに効かせる
      const cv=v=>{const a=Math.abs(v);return a<.08?0:Math.sign(v)*Math.pow((a-.08)/.92,1.25);};input.tx=cv(x);input.ty=-cv(y);nub.style.transform='translate('+x*38+'px,'+y*38+'px)';e.preventDefault();},{passive:false});
    const end=e=>{if(!find(e))return;sid=null;input.tx=input.ty=0;nub.style.transform='';st.classList.remove('on');st.style.left=st.style.top=st.style.bottom='';};
    zone.addEventListener('touchend',end);zone.addEventListener('touchcancel',end);
    const hold=(id,key)=>{const b=$(id),on=e=>{initAudio();input[key]=true;b.classList.add('on');if(navigator.vibrate)navigator.vibrate(8);e.preventDefault();},off=()=>{input[key]=false;b.classList.remove('on');};
      b.addEventListener('touchstart',on,{passive:false});b.addEventListener('touchend',off);b.addEventListener('touchcancel',off);};
    hold('tbA','tAct');hold('tbB','tBoost');hold('tbX','tXb');hold('tbG','tGun');hold('tbM','tMsl');
    $('tbP').addEventListener('touchstart',e=>{e.preventDefault();togglePause();},{passive:false});$('tbP').addEventListener('click',()=>togglePause());
    $('skip').textContent='スキップ ▸';
    // 画面を消灯させない（対応する端末だけ）
    const wl=()=>{if(navigator.wakeLock&&!document.hidden)navigator.wakeLock.request('screen').catch(()=>{});};addEventListener('pointerdown',wl,{once:true});document.addEventListener('visibilitychange',wl);
    // 初めて遊ぶ端末では、軽い画質から始める
    if(!localStorage.getItem('stormrider_opts')){opts.q=0;$('oQ').value=0;ap();}
  }
}
function togglePause(){
  document.body.classList.toggle('inplay',G.mode==='pause');G.inplayCls=G.mode==='pause';
  if(G.mode==='explore'){G.pauseFrom='explore';G.mode='pause';$('pause').hidden=false;$('bPOpts').hidden=true;}
  else if(G.mode==='play'){G.pauseFrom='play';G.mode='pause';$('pause').hidden=false;$('bPOpts').hidden=false;setAlarm(false);if(AU.ctx){AU.paused=true;AU.ctx.suspend();}}
  else if(G.mode==='pause'&&G.pauseFrom==='explore'){G.mode='explore';$('pause').hidden=true;}
  else if(G.mode==='pause'){G.mode='play';$('pause').hidden=true;$('opts').hidden=true;endOptPrev();if(AU.ctx){AU.paused=false;AU.ctx.resume();}if(hazAlarm())setAlarm(true);}
}

// ───────────────────────── メインループ ─────────────────────────
// ───────────────────────── 領空侵犯と迎撃機 ─────────────────────────
// 任務空域は「台風の中心〜基地」を結ぶ線から 18km 以内。外へ出ると、隣国（架空）の迎撃機が来る
// st：0 何もなし／1 接近中／2 警告（横に並ぶ）／3 最終警告（威嚇射撃）／4 攻撃／5 離脱していく
// 任務空域：台風（半径 16.5km）、基地までの回廊（幅 ±4km）、基地のまわり（半径 5km）
const AREA={storm:16500,corridor:4000,base:5000},ICP={st:0,t:0,n:0,pre:0,f:[],mis:[],trc:[],misT:0,gunT:0,atkT:0,beep:0};
// 任務空域の外側へどれだけ出ているか（m）。中にいるときは負
function areaOut(){const x=P.pos.x,z=P.pos.z,zc=clamp(z,0,BASE.z);return Math.min(Math.hypot(x,z)-AREA.storm,Math.hypot(x,z-zc)-AREA.corridor,Math.hypot(x-BASE.x,z-BASE.z)-AREA.base);}
function icpInit(){
  for(let i=0;i<2;i++){const mesh=buildFighter();mesh.visible=false;scene.add(mesh);ICP.f.push({mesh,pos:new V3(),yaw:0,pitch:0,roll:0,sd:i?-1:1,vel:new V3(),hp:8,dead:false});}
  for(let i=0;i<4;i++){const m=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,3.4,8).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({color:lin(0xdfe3e6),roughness:.5}));m.visible=false;m.frustumCulled=false;scene.add(m);
    const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(3,1.6,.5),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));gl.scale.set(9,9,1);gl.visible=false;scene.add(gl);ICP.mis.push({m,gl,pos:new V3(),dir:new V3(),life:0,smoke:0,lost:false});}
  const tm=new THREE.MeshBasicMaterial({color:new THREE.Color(4,2.8,.9)});for(let i=0;i<40;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.22,.22,16),tm);m.visible=false;m.frustumCulled=false;scene.add(m);ICP.trc.push({m,pos:new V3(),dir:new V3(),life:0,live:true});}
}
// 迎撃機の空戦：旋回率の上限つきで機首を回す。旋回半径は自機より大きいので、急旋回で振り切れ、内側に回り込める
const _da=new V3();
function dogfight(f,i,dt){
  const turn=[.6,.68,.76][opts.diff||0]*(f.evT>0?1.15:1);   // 回避中は限界まで引く
  if(f.spd===undefined||isNaN(f.spd))f.spd=f.vel.length()||200;
  fwdOf(f.yaw,f.pitch,tA);tB.copy(P.pos).sub(f.pos);const dist=tB.length(),toP=tB.clone().normalize(),off=Math.acos(clamp(toP.dot(tA),-1,1));
  fwdOf(P.yaw,P.pitch,_da);const pNose=Math.acos(clamp(-toP.dot(_da),-1,1));   // 自機の機首がこちらを向いている角度
  // 狙い：遠いときは自機の少し後ろ（追従位置）、近いときは自機の未来位置。2 機は左右にずらす
  // 回避：狙われたら 2〜3.5 秒だけ急旋回で逃げ、そのあと 3〜5 秒は回避せず向き直ってくる（その間が撃つ好機）
  if(f.evT>0){f.evT-=dt;if(f.evT<=0)f.evCD=2.5+Math.random()*1.5;}else if(f.evCD>0)f.evCD-=dt;
  if(G.armed&&pNose<.45&&dist<1600&&!(f.evT>0)&&!(f.evCD>0)){f.evT=2+Math.random()*1.5;f.evDir=Math.random()<.5?-1:1;}
  f.angT=(f.angT||0)+(off>.6&&!(f.extT>0)?dt:-dt*.5);if(f.angT<0)f.angT=0;
  if(f.extT>0){f.extT-=dt;if(f.extT<=0)f.angT=0;}else if(f.angT>7&&dist<1800&&!(f.evT>0)){f.extT=5+Math.random()*2;f.extYaw=Math.atan2(-(f.pos.x-P.pos.x),-(f.pos.z-P.pos.z));}
  if(f.extT>0&&!(f.evT>0)){fwdOf(f.extYaw,0,tC);tC.multiplyScalar(-1);tC.multiplyScalar(800).add(f.pos);tC.y=Math.max(P.pos.y+80,200);}
  else if(f.evT>0){fwdOf(f.yaw+f.evDir*1.2,f.pitch,tC);tC.multiplyScalar(500).add(f.pos);tC.y=f.pos.y+(Math.sin(G.t*.9+i)*60);}
  else if(dist>700){const mate=ICP.f[1-i],mateHunted=mate&&!mate.dead&&mate.mesh.visible&&mate.pNose<.5&&mate.dist<1500;tC.copy(P.pos).addScaledVector(_da,mateHunted?-120:-260).addScaledVector(P.vel,.4);if(mateHunted)f.spd=Math.max(f.spd,255);tC.x+=(i?-1:1)*90*Math.cos(P.yaw);tC.z+=(i?1:-1)*90*Math.sin(P.yaw);}
  else tC.copy(P.pos).addScaledVector(P.vel,dist/600);
  tC.y=Math.max(tC.y,60);tD.subVectors(tC,f.pos);const want=Math.atan2(-tD.x,-tD.z);let dy=want-f.yaw;while(dy>Math.PI)dy-=6.2832;while(dy<-Math.PI)dy+=6.2832;
  const step=clamp(dy,-turn*dt,turn*dt);f.yaw+=step;f.roll=damp(f.roll,clamp(-step/dt/turn,-1,1)*1.15,3,dt);
  const wp=clamp(Math.atan2(tD.y,Math.hypot(tD.x,tD.z)),-.5,.5);f.pitch=damp(f.pitch,wp,1.6,dt);
  // 速さ：追いつくまでは速く、すぐ後ろに来たら合わせる（近すぎると前へ飛び出す）
  const ts=off<.6&&dist<450?Math.max(150,P.speed+10):(f.extT>0?262:f.evT>0?238:245);f.spd=damp(f.spd,ts,.8,dt);
  fwdOf(f.yaw,f.pitch,tA);f.vel.copy(tA).multiplyScalar(f.spd);f.pos.addScaledVector(f.vel,dt);{const fl=groundAt(f.pos.x,f.pos.z)+40;if(f.pos.y<fl)f.pos.y=fl;}
  f.off=off;f.dist=dist;f.pNose=pNose;
  f.mesh.position.copy(f.pos);f.mesh.rotation.set(f.pitch,f.yaw,f.roll,'YXZ');f.mesh.userData.setPower(sat((f.spd-140)/180));f.mesh.userData.beacon.visible=(G.t*1.2+i*.4)%1<.12;
}
// 線分（始点 a、向き d、長さ len）と点 p の最短距離
const _sg=new V3();function segDist(a,d,len,p){_sg.copy(p).sub(a);const s=clamp(_sg.dot(d),0,len);return _sg.addScaledVector(d,-s).length();}
function icpReset(){ICP.cleared=false;ICP.doomT=0;ICP.f.forEach(f=>{f.dead=false;f.hp=8;});for(const m of PM){m.life=0;m.m.visible=m.gl.visible=false;}P.msl=4;G.lockF=null;armMeshes();ICP.doomed=false;ICP.kill=null;ICP.st=0;ICP.t=0;ICP.n=0;ICP.pre=0;ICP.atkT=0;for(const f of ICP.f)f.mesh.visible=false;for(const m of ICP.mis){m.life=0;m.m.visible=m.gl.visible=false;}for(const t of ICP.trc){t.life=0;t.m.visible=false;}}
function icpTracersOnly(dt,playing){for(const t of ICP.trc){if(t.life<=0)continue;t.life-=dt;const st=720*dt;t.pos.addScaledVector(t.dir,st);if(t.live==='P'&&t.life>0){tB.copy(t.pos).addScaledVector(t.dir,-st);if(strHit(t,tB,st))t.life=0;}t.m.position.copy(t.pos);tD.copy(t.pos).add(t.dir);t.m.lookAt(tD);if(t.life<=0)t.m.visible=false;}}
function icpTracer(from,to,spread,live){const t=ICP.trc.find(q=>q.life<=0);if(!t)return;t.pos.copy(from);t.dir.copy(to).sub(from).normalize();t.dir.x+=(Math.random()-.5)*spread;t.dir.y+=(Math.random()-.5)*spread;t.dir.z+=(Math.random()-.5)*spread;t.dir.normalize();t.life=1.3;t.live=live;t.m.visible=true;}

function icpMissile(f,tgt){const m=ICP.mis.find(q=>q.life<=0);if(!m)return false;m.wh=0;m.tgt=tgt||null;fwdOf(f.yaw,f.pitch,tA);m.pos.copy(f.pos).addScaledVector(tA,6);m.pos.y-=1.5;m.dir.copy(tA);m.life=9;m.lost=false;m.smoke=0;m.m.visible=m.gl.visible=true;SFX.launch();return true;}
function updateIntercept(dt){
  const playing=G.mode==='play'&&!P.wingLost,d=areaOut();
  if(!ICP.st){
    if(G.armed&&ICP.f.length)icpTracersOnly(dt,playing);
    if(!playing)return;
    if(d>-1000&&!ICP.pre&&!ICP.cleared){ICP.pre=1;say('C','この先は隣国ノルド連邦の領空です。任務空域へ引き返してください');warn('任務空域の外縁',3);}
    if(d<-1700){ICP.pre=0;ICP.cleared=false;}
    if(d<=0||ICP.cleared)return;
    if(!ICP.f.length)icpInit();
    ICP.st=1;ICP.t=0;ICP.atkT=0;SFX.caution();
    if(!ICP.seen){ICP.seen=1;ICP.f.forEach(f=>{f.mesh.visible=true;});startCut(CUT_ICP);return;}
    say('C','国籍不明機が 2 機、急速に接近！　ノルド連邦の迎撃機です');
    fwdOf(P.yaw,0,tA);ICP.f.forEach((f,i)=>{f.hp=8;f.dead=false;f.pos.copy(P.pos).addScaledVector(tA,-2600-i*300);f.pos.y=Math.max(260,P.pos.y+320);f.yaw=P.yaw;f.pitch=0;f.roll=0;f.mesh.visible=true;});
  }
  // 空域へ向かって戻っている間は、警告の時間を進めず、攻撃も控える
  const back=playing&&!(G.armed&&ICP.st===4)&&ICP.dPrev!==undefined&&(ICP.dPrev-d)/Math.max(dt,1e-3)>55;ICP.dPrev=d;
  if(ICP.doomT>0&&playing){ICP.doomT-=dt;if(ICP.doomT<=0){fail('領空侵犯で僚機を失い、予備のディフューザーもなくなった');return;}}
  ICP.t+=(back&&(ICP.st===2||ICP.st===3))?0:dt;const st=ICP.st;
  // 空域へ戻ったら離脱していく
  // 武装して交戦中は、空域へ少し戻ったくらいでは追ってくる
  if(playing&&st>=1&&st<=4&&d<(G.armed&&st===4?-4000:-500)){ICP.st=5;ICP.t=0;ICP.n++;alarmOff();G.prompt=null;if(st>=2)say('F','退去を確認した。二度と我が国の空に近づくな');if(ICP.doomed){ICP.doomT=5;say('C','予備のディフューザーは 2 番機とともに失われました…。任務は、続行できません');}for(const m of ICP.mis)if(m.life>0)m.life=Math.min(m.life,.4);}
  if(!playing&&st>=1&&st<=4){ICP.st=5;ICP.t=0;if(G.mode==='dying'&&st===4)say('F','目標の撃墜を確認。帰投する');}
  fwdOf(P.yaw,0,tA);tB.set(-tA.z,0,tA.x);  // tA=前、tB=右
  // ── 迎撃機の動き
  ICP.f.forEach((f,i)=>{if(!f.mesh.visible)return;
    if(f.dead){f.downT+=dt;f.vel.y-=14*dt;f.pos.addScaledVector(f.vel,dt);f.roll+=dt*(3+f.downT)*f.sd;f.pitch=damp(f.pitch,-1,.8,dt);f.mesh.position.copy(f.pos);f.mesh.rotation.set(f.pitch,f.yaw,f.roll,'YXZ');f.mesh.userData.setPower(0);
      if(Math.random()<dt*40)puff(f.pos.x,f.pos.y,f.pos.z,0,3,0,5+Math.random()*3,1.6,.85);if(f.pos.y<groundAt(f.pos.x,f.pos.z)+5||f.downT>9){explode(f.pos,.6);vegIgnite(f.pos.x,f.pos.z,24);f.mesh.visible=false;}return;}
    let vmax=560;
    if(ICP.st<=3){tC.copy(P.pos).addScaledVector(tB,f.sd*(34+i*4)).addScaledVector(tA,10-i*16);tC.y+=5+i*3+Math.sin(G.t*1.1+i*2)*1.5;}
    else if(ICP.st===4){const wv=Math.sin(G.t*.7+i*2.6);tC.copy(P.pos).addScaledVector(tA,-(430+i*190)).addScaledVector(tB,f.sd*(60+i*50)+wv*90);tC.y+=45+i*30+Math.cos(G.t*.9+i)*25;vmax=340;}
    else{fwdOf(f.yaw+f.sd*1.9,0,tC);tC.multiplyScalar(4000).add(f.pos);tC.y=f.pos.y+900;vmax=360;}
    if(ICP.st===4){dogfight(f,i,dt);return;}
    // 目標の位置との差に比例した速度を、隊長機の速度に上乗せする（離脱中は自分の針路だけ）
    tD.subVectors(tC,f.pos);const L=tD.length();tD.multiplyScalar(Math.min(1.3,vmax/Math.max(L,1)));if(ICP.st<=4)tD.add(P.vel);f.vel.lerp(tD,Math.min(1,dt*2.6));
    f.pos.addScaledVector(f.vel,dt);{const fl=groundAt(f.pos.x,f.pos.z)+30;if(f.pos.y<fl)f.pos.y=fl;}
    const v=f.vel,h=Math.hypot(v.x,v.z);let wy=h>20?Math.atan2(-v.x,-v.z):f.yaw;if(ICP.st<=3&&L<220)wy=P.yaw;let dy=wy-f.yaw;while(dy>Math.PI)dy-=6.2832;while(dy<-Math.PI)dy+=6.2832;
    f.yaw+=dy*Math.min(1,dt*2.4);f.roll=damp(f.roll,clamp(-dy*1.6,-1.1,1.1)+(ICP.st<=3&&L<220?P.roll*.8:0),3,dt);f.pitch=damp(f.pitch,clamp(Math.atan2(v.y,Math.max(h,60)),-.6,.6),2.5,dt);
    f.mesh.position.copy(f.pos);f.mesh.rotation.set(f.pitch,f.yaw,f.roll,'YXZ');f.mesh.userData.setPower(sat((f.vel.length()-140)/260));f.mesh.userData.beacon.visible=(G.t*1.2+i*.4)%1<.12;
    if(ICP.st===5&&f.pos.distanceTo(P.pos)>4200)f.mesh.visible=false;});
  if(ICP.st===5||ICP.cleared){if(ICP.f.every(f=>!f.mesh.visible||f.dead&&false)){if(ICP.st)ICP.pre=1;ICP.st=0;}}
  // ── 段階の進行
  const near=ICP.f.length&&ICP.f[0].pos.distanceTo(P.pos)<260;
  if(ICP.st===1&&(near||ICP.t>11)){ICP.st=2;ICP.t=0;SFX.warn&&SFX.warn();
    say('F',ICP.n?'再び領空に入ったな。次は警告しない。ただちに反転せよ':'警告する。貴機はノルド連邦の領空を侵犯している。ただちに反転し、領空から退去せよ');}
  const T2=ICP.n?5:13,T3=ICP.n?4:8;
  if(ICP.st===2){G.prompt={t:'領空侵犯　反転して任務空域へ戻れ',p:ICP.t/T2};if(ICP.t>T2){ICP.st=3;ICP.t=0;ICP.shot=0;say('F','最終警告だ。従わなければ撃墜する');}}
  if(ICP.st===3){G.prompt={t:G.armed?'最終警告　反転して戻るか、交戦に備えろ':'最終警告　反転して任務空域へ戻れ',p:ICP.t/T3};
    // 威嚇射撃：機首の前を横切る曳光弾
    if(ICP.t>1.2&&ICP.t<2.6){ICP.shot-=dt;if(ICP.shot<=0){ICP.shot=.07;const f=ICP.f[0];tC.copy(f.pos).addScaledVector(tA,400);tC.y+=8;icpTracer(f.pos,tC,.004,false);if(Math.random()<.4)SFX.spark();}}
    if(ICP.t>T3){ICP.st=4;ICP.t=0;ICP.misT=3.5;ICP.gunT=6;setAlarm(true);G.prompt=null;
      if(!G.armed&&W.some(q=>q.state!=='gone')){startCut(CUT_KILL);return;}
      if(G.armed&&W[0].state!=='gone')say('G','武装してるなら話は別だ。後ろは見ててやる、落とせ隊長！',3.4);say('F','警告は終わりだ。攻撃する');}}
  if(ICP.st===4){ICP.atkT+=dt;
    if(ICP.kill&&ICP.kill.length&&ICP.t>ICP.kill[0][0]){const wi=ICP.kill.shift()[1],wv=W[wi];if(wv.state!=='gone'&&wv.state!=='down')icpMissile(ICP.f[wi],wv);}
    // ミサイル：時間がたつほど間隔が詰まる
    if(!back)ICP.misT-=dt;if(ICP.misT<=0){const live=ICP.f.filter(q=>!q.dead&&q.mesh.visible&&q.off<.6&&q.dist<2800&&q.dist>300),f=live[Math.floor(Math.random()*live.length)];if(f&&icpMissile(f))ICP.misT=Math.max(1.8,5.2-ICP.atkT*.11)*(.8+Math.random()*.4);else ICP.misT=.4;}
    // 機関砲：未来位置を狙うので、まっすぐ飛んでいると当たる
    if(!back)ICP.gunT-=dt;if(ICP.gunT<=0){const live=ICP.f.filter(q=>!q.dead&&q.mesh.visible&&q.off<.14&&q.dist<800);if(live.length){ICP.gunT=Math.max(1.6,4.2-ICP.atkT*.06);ICP.burst=7;ICP.bf=live[Math.floor(Math.random()*live.length)];}else ICP.gunT=.3;}
    if(ICP.burst>0){ICP.bT=(ICP.bT||0)-dt;if(ICP.bT<=0){ICP.bT=.06;ICP.burst--;const f=ICP.bf,tt=f.pos.distanceTo(P.pos)/720;tC.copy(P.pos).addScaledVector(P.vel,tt);fwdOf(f.yaw,f.pitch,tA);tD.copy(tC).sub(f.pos).normalize();if(tD.dot(tA)>.97)icpTracer(f.pos,tC,.006,true);if(ICP.burst%2===0)SFX.spark();}}
  }
  // ── ミサイル
  let closest=1e9;const turn=[.72,.86,1.0][opts.diff||0];
  for(const m of ICP.mis){if(m.life<=0)continue;m.life-=dt;
    if(m.tgt){const wv=m.tgt;tC.copy(wv.pos).sub(m.pos);const dw=tC.length();tC.normalize();m.dir.lerp(tC,Math.min(1,dt*6)).normalize();
      if(dw<16&&wv.state!=='gone'&&wv.state!=='down'){m.life=0;m.m.visible=m.gl.visible=false;wingHit(wv);continue;}
      if(wv.state==='gone'||wv.state==='down')m.tgt=null;}
    tC.copy(P.pos).sub(m.pos);const dist=tC.length();if(!m.tgt)closest=Math.min(closest,dist);
    // かすめたとき：風切り音（左右に流れる）と小さな揺れ
    if(!m.tgt&&playing&&dist<95&&!m.wh){m.wh=1;fwdOf(P.yaw,0,tD);SFX.whoosh(clamp((m.pos.x-P.pos.x)*-tD.z+(m.pos.z-P.pos.z)*tD.x,-60,60)/60*-.8);G.shake=Math.max(G.shake,.35);}
    if(!m.tgt&&!m.lost&&playing){tC.addScaledVector(P.vel,Math.min(1.2,dist/300)).normalize();const ang=Math.acos(clamp(m.dir.dot(tC),-1,1));if(ang>1.35)m.lost=true;else if(ang>1e-4){m.dir.lerp(tC,Math.min(1,turn*dt/ang)).normalize();}}
    m.pos.addScaledVector(m.dir,300*dt);m.m.position.copy(m.pos);tD.copy(m.pos).add(m.dir);m.m.lookAt(tD);m.gl.position.copy(m.pos).addScaledVector(m.dir,-2.5);
    m.smoke-=dt;if(m.smoke<=0){m.smoke=.025;puff(m.pos.x-m.dir.x*3,m.pos.y-m.dir.y*3,m.pos.z-m.dir.z*3,0,1.5,0,2.2,1.6,.55);}
    let boom=false;if(playing&&!m.tgt&&dist<15){boom=true;P.fling.addScaledVector(m.dir,30);damage(24,'迎撃機のミサイルが命中した');}
    if(m.life<=0||m.pos.y<4)boom=true;
    if(boom){m.life=0;m.m.visible=m.gl.visible=false;explode(m.pos,.3);}}
  if(closest<1400&&playing&&ICP.st===4){G.prompt={t:'ミサイル接近　引きつけて急旋回か <kbd>A</kbd><kbd>D</kbd> 2 度押しロールでかわせ',p:sat(1-closest/1400)};ICP.beep-=dt;if(ICP.beep<=0){ICP.beep=Math.max(.09,closest/2600);SFX.warn();}}
  else if(ICP.st===4&&playing&&G.armed)G.prompt={t:'交戦中　<kbd>F</kbd> 機銃　<kbd>R</kbd> ミサイル　後ろを取って撃墜せよ',p:0};
  else if(ICP.st===4&&playing)G.prompt={t:back?'任務空域へ戻れ（あと '+Math.max(0,(d+500)/1000).toFixed(1)+' km）':'攻撃を受けている　反転して任務空域へ戻れ',p:back?sat(1-(d+500)/3000):0};
  // ── 曳光弾
  for(const t of ICP.trc){if(t.life<=0)continue;t.life-=dt;const st=720*dt;t.pos.addScaledVector(t.dir,st);tB.copy(t.pos).addScaledVector(t.dir,-st);t.m.position.copy(t.pos);tD.copy(t.pos).add(t.dir);t.m.lookAt(tD);
    if(t.live==='P'){for(const f of ICP.f)if(!f.dead&&f.mesh.visible&&segDist(tB,t.dir,st,f.pos)<9){t.life=0;fighterHit(f,1);break;}if(t.life>0&&strHit(t,tB,st))t.life=0;}
    else if(t.live&&playing&&segDist(tB,t.dir,st,P.pos)<(P.br?3.5:7)){t.life=0;damage(6,'迎撃機の機関砲に撃たれた');}
    if(t.life<=0)t.m.visible=false;}
}
// 迎撃機を隊長機からの相対位置に置く（カットシーン用）
function icpPose(i,f0,r0,u0,roll,pw){const f=ICP.f[i];fwdOf(P.yaw,0,tA);tB.set(-tA.z,0,tA.x);f.pos.copy(P.pos).addScaledVector(tA,f0).addScaledVector(tB,r0);f.pos.y+=u0;f.yaw=P.yaw;f.pitch=0;f.roll=roll||0;f.vel.copy(tA).multiplyScalar(150);
  f.mesh.visible=true;f.mesh.position.copy(f.pos);f.mesh.rotation.set(0,f.yaw,f.roll,'YXZ');f.mesh.userData.setPower(pw===undefined?.3:pw);f.mesh.userData.beacon.visible=(G.t*1.2+i*.4)%1<.12;}
const icpCam=(f0,r0,u0,lf,lr,lu,fov)=>{fwdOf(P.yaw,0,tA);tB.set(-tA.z,0,tA.x);setCam(P.pos.x+tA.x*f0+tB.x*r0,P.pos.y+u0,P.pos.z+tA.z*f0+tB.z*r0,P.pos.x+tA.x*lf+tB.x*lr,P.pos.y+lu,P.pos.z+tA.z*lf+tB.z*lr,fov);};
const icpLevel=dt=>{P.pitch=damp(P.pitch,0,2,dt);P.roll=damp(P.roll,0,2,dt);cutFly(dt,150);P.power=1;};
const CUT_ICP={mid:true,
  blendIn:.7,blendOut:1.1,
  subs:[[.2,'C','国籍不明機が 2 機、急速に接近！　ノルド連邦の迎撃機です',3.6],[5.2,'F','警告する。貴機はノルド連邦の領空を侵犯している。ただちに反転し、領空から退去せよ',5.6],[11.6,'G',()=>G.armed?'隊長、相手は本気だ。こっちも積んではいるが、撃ち合えば戦争だぞ。引き返せ！':'隊長、相手は本気だ。こっちは丸腰だぞ、引き返せ！',3.6]],
  begin(){if(!ICP.f.length)icpInit();SFX.caution();},
  shots:[
    // 後ろの空から 2 機が迫ってくる（隊長機の前から振り返る）
    {dur:4.2,setup(){SFX.boost();},update(t,u,dt){icpLevel(dt);const e=1-Math.pow(1-u,2.2);icpPose(0,lerp(-1500,-70,e),lerp(120,40,e),lerp(170,14,e),lerp(.5,0,e),1);icpPose(1,lerp(-1750,-150,e),lerp(-170,-46,e),lerp(230,22,e),lerp(-.5,0,e),1);
      icpCam(36,-10,7,-260,10,lerp(60,10,e),lerp(30,40,u));G.shake=Math.max(G.shake,u>.8?.25:0);}},
    // 右に並びかける 1 番機（低い位置から見上げる）
    {dur:3.8,setup(){SFX.boost();},update(t,u,dt){icpLevel(dt);const e=ease(u);icpPose(0,lerp(-70,12,e),lerp(40,32,e),lerp(14,5,e),Math.sin(u*3.1)*-.12,lerp(.9,.3,e));icpPose(1,lerp(-150,-4,e),lerp(-46,-38,e),lerp(22,7,e),0,lerp(.9,.3,e));
      const f=ICP.f[0];fwdOf(P.yaw,0,tA);tB.set(-tA.z,0,tA.x);setCam(f.pos.x+tA.x*26+tB.x*20,f.pos.y-5,f.pos.z+tA.z*26+tB.z*20,f.pos.x-tA.x*2,f.pos.y+.5,f.pos.z-tA.z*2,lerp(30,24,e));}},
    // 翼を振って合図する（隊長機の肩越しに、左の 2 番機）
    {dur:4.0,update(t,u,dt){icpLevel(dt);icpPose(0,12,32,5,0);icpPose(1,-4,-38,7,Math.sin(t*4.2)*.42*sat(1.4-Math.abs(u-.5)*2.6));
      const f=ICP.f[1];fwdOf(P.yaw,0,tA);tB.set(-tA.z,0,tA.x);setCam(f.pos.x-tA.x*30-tB.x*17,f.pos.y+7,f.pos.z-tA.z*30-tB.z*17,f.pos.x+tA.x*4+tB.x*10,f.pos.y-.5,f.pos.z+tA.z*4+tB.z*10,lerp(26,22,u));}},
    // 真上から：両側を挟まれた隊長機
    {dur:3.4,update(t,u,dt){icpLevel(dt);icpPose(0,10,34,5,0);icpPose(1,-6,-38,7,0);icpCam(-30,0,lerp(95,60,ease(u)),14,0,0,40);}}],
  end(){G.mode='play';$('hud').hidden=false;P.camYaw=P.yaw;P.camPitch=P.pitch*.62;P.inv=1;ICP.st=2;ICP.t=2;ICP.dPrev=undefined;
    // すぐ飛ばしたときは迎撃機がまだ遠くにいるので、警告の位置（左右に並ぶ）へ置く
    ICP.f.forEach((f,i)=>{if(f.pos.distanceTo(P.pos)>600)icpPose(i,10-i*16,f.sd*(34+i*4),5+i*3,0,.3);});chaseCam(0,true);}
};
// 僚機が撃墜されるカットシーン
const CK={};
function ckFly(dt){P.pitch=damp(P.pitch,0,2,dt);P.roll=damp(P.roll,0,2,dt);fwdOf(P.yaw,0,tA);P.pos.addScaledVector(tA,150*dt);P.power=1;
  W.forEach((w,i)=>{if(w.state==='gone')return;if(w.state==='down'){wingFall(w,i,dt);return;}slotOf(w,tB);tB.y+=Math.sin(G.t*1.1+w.ph)*3;w.pos.lerp(tB,1-Math.exp(-dt*3));w.yaw=P.yaw;w.pitch=0;w.roll=Math.sin(G.t*1.6+w.ph)*.05;});}
// 迎撃機 fi から僚機 wi へミサイルを飛ばす（u：0→1 で発射から命中まで）
function ckMissile(fi,wi,u,dt){const m=ICP.mis[fi],f=ICP.f[fi],wv=W[wi];if(u<=0||u>=1||wv.state!=='form'&&wv.state!=='dockfly'&&wv.state!=='stall'){if(u>=1&&m.m.visible){m.m.visible=m.gl.visible=false;wingHit(wv);}return;}
  if(!m.m.visible){m.m.visible=m.gl.visible=true;SFX.launch();}tC.copy(f.pos);tC.y-=1.5;const e=u*u*(3-2*u)*.4+u*.6;m.pos.lerpVectors(tC,wv.pos,e);m.dir.copy(wv.pos).sub(tC).normalize();m.m.position.copy(m.pos);tD.copy(m.pos).add(m.dir);m.m.lookAt(tD);m.gl.position.copy(m.pos).addScaledVector(m.dir,-2.5);
  CK.sm=(CK.sm||0)-dt;if(CK.sm<=0){CK.sm=.02;puff(m.pos.x-m.dir.x*3,m.pos.y-m.dir.y*3,m.pos.z-m.dir.z*3,0,1.5,0,2.4,1.8,.6);}}
const ckSkip=wi=>{if(W[wi].state==='gone'&&CUT)CUT.t=1e9;};
const CUT_KILL={mid:true,
  blendIn:.6,blendOut:1.0,
  subs:[[.2,'F','警告は終わりだ。攻撃する',2.6],[2.9,'H','ミ、ミサイルです！　2番機、後ろ！',2.4]],
  begin(){if(!ICP.f.length)icpInit();SFX.caution();setAlarm(true);for(const m of ICP.mis){m.life=0;m.m.visible=m.gl.visible=false;}},
  shots:[
    // 迎撃機が後ろへ下がり、編隊の真後ろに付く（迎撃機の背中越し）
    {dur:3.0,update(t,u,dt){ckFly(dt);const e=ease(u);icpPose(0,lerp(12,-300,e),lerp(32,26,e),lerp(5,26,e),lerp(0,-.25,Math.sin(u*3.14)),.2);icpPose(1,lerp(-4,-380,e),lerp(-38,-30,e),lerp(7,34,e),lerp(0,.25,Math.sin(u*3.14)),.2);
      const f=ICP.f[0];fwdOf(P.yaw,0,tA);tB.set(-tA.z,0,tA.x);setCam(f.pos.x-tA.x*26+tB.x*9,f.pos.y+6,f.pos.z-tA.z*26+tB.z*9,P.pos.x-tB.x*6,P.pos.y,P.pos.z-tB.z*6,lerp(34,26,e));}},
    // 2 番機：後ろから迫るミサイル、命中
    {dur:3.4,setup(){ckSkip(0);CK.sm=0;},update(t,u,dt){ckFly(dt);icpPose(0,-300,26,26,0,.3);icpPose(1,-380,-30,34,0,.3);ckMissile(0,0,u/.5,dt);
      const wv=W[0];fwdOf(P.yaw,0,tA);tB.set(-tA.z,0,tA.x);const k=sat((u-.5)/.5);setCam(lerp(wv.pos.x+tA.x*22-tB.x*15,P.pos.x+tA.x*30-tB.x*20,k*0),wv.pos.y+5+k*10,wv.pos.z+tA.z*22-tB.z*15,wv.pos.x-tA.x*8,wv.pos.y,wv.pos.z-tA.z*8,34);
      if(u>.5)G.shake=Math.max(G.shake,.5*(1-k));}},
    // 3 番機：横から。被弾して錐もみで落ちていく
    {dur:3.4,setup(){ckSkip(1);CK.sm=0;},update(t,u,dt){ckFly(dt);icpPose(0,-300,26,26,0,.3);icpPose(1,-380,-30,34,0,.3);ckMissile(1,1,u/.45,dt);
      const wv=W[1];fwdOf(P.yaw,0,tA);tB.set(-tA.z,0,tA.x);setCam(P.pos.x+tA.x*6+tB.x*70,P.pos.y+10,P.pos.z+tA.z*6+tB.z*70,wv.pos.x,wv.pos.y,wv.pos.z,30);
      if(u>.45)G.shake=Math.max(G.shake,.4*(1-u));}},
    // 隊長機の前から振り返る：煙を引いて落ちていく 2 機と、後ろに残る迎撃機
    {dur:4.0,setup(){say('C','2番機、3番機の反応が消えました…！　隊長、今すぐ空域へ戻ってください！',4);},update(t,u,dt){ckFly(dt);icpPose(0,lerp(-300,-430,u),lerp(26,60,u),lerp(26,45,u),0,.4);icpPose(1,lerp(-380,-620,u),lerp(-30,-110,u),lerp(34,75,u),0,.4);
      tC.set(0,0,0);let n=0;for(const wv of W)if(wv.state==='down'){tC.add(wv.pos);n++;}if(n)tC.multiplyScalar(1/n);else tC.copy(P.pos).addScaledVector(tA,-200);
      fwdOf(P.yaw,0,tA);tB.set(-tA.z,0,tA.x);tD.copy(P.pos).addScaledVector(tA,-60).lerp(tC,.55);setCam(P.pos.x+tA.x*34+tB.x*12,P.pos.y+9,P.pos.z+tA.z*34+tB.z*12,tD.x,tD.y,tD.z,lerp(40,34,u));}}],
  end(){for(const m of ICP.mis){m.life=0;m.m.visible=m.gl.visible=false;}
    // 途中で飛ばしたときも、僚機は撃たれた状態にする
    W.forEach(w=>{if(w.state!=='gone'&&w.state!=='down')wingHit(w);if(w.state==='down')w.power=.05;});icpPose(0,-430,60,45,0,.4);icpPose(1,-620,-110,75,0,.4);
    G.mode='play';$('hud').hidden=false;P.camYaw=P.yaw;P.camPitch=P.pitch*.62;P.inv=1.5;ICP.st=4;ICP.t=0;ICP.atkT=0;ICP.misT=2.5;ICP.gunT=5;ICP.kill=null;ICP.f.forEach(f=>{f.spd=200;});ICP.dPrev=undefined;setAlarm(true);chaseCam(0,true);}
};
// ── 爆発：閃光・火球・煙・粉塵・水柱・火花・破片をそれぞれの粒の池から出す（いくつ重なってもよい）
// type：air 機体／bldg コンクリートの建物／tower 塔の倒壊／shed 倉庫／tank 燃料タンク／ship 船／dust 倒れた塔が地面を打つ
const BOOM={init:false,fire:[],smoke:[],dust:[],water:[],flash:[],sparks:[],deb:[],ring:[],q:[],light:null,lt:9,lk:0,lc:new THREE.Color()};
function boomTex(kind){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),R=mulberry(kind*31+7);
  const n=kind===0?34:28;for(let i=0;i<n;i++){const a=R()*6.283,r=Math.pow(R(),.7)*(kind===0?26:34),px=64+Math.cos(a)*r,py=64+Math.sin(a)*r,s=(kind===0?12:14)+R()*22,g=x.createRadialGradient(px,py,0,px,py,s);
    const al=kind===0?.55+R()*.35:.35+R()*.3;g.addColorStop(0,'rgba(255,255,255,'+al+')');g.addColorStop(.6,'rgba(255,255,255,'+(al*.45)+')');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);}
  // 縁を不規則に削る（丸い板に見せない）
  x.globalCompositeOperation='destination-out';for(let i=0;i<14;i++){const a=R()*6.283,px=64+Math.cos(a)*(46+R()*14),py=64+Math.sin(a)*(46+R()*14),s=10+R()*16,g=x.createRadialGradient(px,py,0,px,py,s);g.addColorStop(0,'rgba(0,0,0,.8)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128);}
  const m=x.createRadialGradient(64,64,34,64,64,64);m.addColorStop(0,'rgba(0,0,0,0)');m.addColorStop(1,'rgba(0,0,0,1)');x.fillStyle=m;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
// 爆発の粒の材質：雲の合成のあとに描くので、手前の物体とは深度テクスチャで前後を判定する（Sprite だと空の部分で雲に塗りつぶされる）
// 粒の中は手続きノイズで作る：形のふちを時間とともに崩し（侵食）、火は温度で色を決め（黒体の色）、煙は擬似の法線で太陽と火に照らす。
// 地面や建物と交わる所は深度の差でなめらかに消す（ソフトパーティクル）
const FXU={uSunV:{value:new V3(0,1,0)}};
const FX_GLSL=`uniform sampler2D tDepth,tN;uniform vec2 uRes;uniform vec3 uSunV;
float lzf(float z){return 270000.0/(90000.0-z*89997.0);}
float softK(float range){float d=texture2D(tDepth,gl_FragCoord.xy/uRes).x;return clamp((lzf(d)-lzf(gl_FragCoord.z))/range,0.0,1.0);}
// 温度 0〜1.4 → 光の色（暗い赤→橙→黄→白）。HDR のまま返す
vec3 bbody(float t){t=max(t,0.0);return vec3(1.0,0.26,0.05)*smoothstep(0.04,0.4,t)*1.0+vec3(1.0,0.48,0.12)*smoothstep(0.3,0.75,t)*1.4+vec3(1.0,0.82,0.55)*smoothstep(0.75,1.2,t)*1.5;}`;
function boomMat(mu,add,kind){kind=kind===undefined?(add?0:1):kind;
  const m=new THREE.ShaderMaterial({uniforms:{map:mu,uColor:{value:new THREE.Color(1,1,1)},uAlpha:{value:1},uRot:{value:0},uSeed:{value:Math.random()*10},uAge:{value:0},uHeat:{value:1},tDepth:U.tDepth,uRes:U.uRes,tN:U.tNoise2,uSunV:FXU.uSunV,uSunCol:U.uSunCol,uSkyZen:U.uSkyZen},
    defines:{KIND:kind},
    vertexShader:'uniform float uRot;varying vec2 vUv,vP;void main(){vec2 c=uv-0.5;float s=sin(uRot),k=cos(uRot);vUv=vec2(k*c.x-s*c.y,s*c.x+k*c.y)+0.5;vP=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:FX_GLSL+`
uniform sampler2D map;uniform vec3 uColor,uSunCol,uSkyZen;uniform float uAlpha,uSeed,uAge,uHeat;varying vec2 vUv,vP;
void main(){
#if KIND==4
  float sk=softK(6.0);if(sk<=0.0)discard;float a=texture2D(map,vUv).a*uAlpha*sk;gl_FragColor=vec4(uColor*a,1.0);
#elif KIND==5
  // 大きな火の炎の塊：根元が太く、上へ細くちぎれる舌。ノイズは上へ流れ、年を取るほど上から欠けていく
  float sk=softK(4.0);if(sk<=0.0)discard;
  float y=vP.y*0.5+0.5;vec2 q=vec2(vP.x*0.32+uSeed*0.13,y*0.42-uAge*1.4+uSeed*0.29);
  float n=texture2D(tN,q).b*0.6+texture2D(tN,q*2.4+vec2(0.31,-uAge*0.9)).b*0.4;n=clamp((n-0.5)*2.4+0.5,0.0,1.0);
  float xs=vP.x+(n-0.5)*0.7*y;
  float shape=(1.0-abs(xs)*(0.95+y*1.5))*(1.0-y*0.75)*smoothstep(0.0,0.18,y);
  float f=shape*1.9-n*0.85*(0.3+y)-uAge*0.4;
  float a=smoothstep(0.0,0.25,f);
  float T=(f*1.3+(1.0-y)*0.3)*uHeat*1.1;
  gl_FragColor=vec4(bbody(T)*a*uAlpha*sk,1.0);
#else
  float sk=softK(KIND==0?5.0:9.0);if(sk<=0.0)discard;
  vec2 p=vUv*2.0-1.0;float r=length(p);
  vec2 q=vUv*0.42+vec2(uSeed*0.137,uSeed*0.291);
  vec4 n1=texture2D(tN,q+vec2(0.0,-uAge*0.22)),n2=texture2D(tN,q*2.6+vec2(uSeed*0.53,uAge*0.35)),n3=texture2D(tN,q*6.1+vec2(-uAge*0.5,uSeed*0.77));
  float n=clamp((n1.b*0.5+n2.b*0.32+n3.b*0.18-0.5)*2.5+0.5,0.0,1.0);   // 3 段の細かさを重ねて、もくもくした小さな塊まで出す
  // 形：ふちを大きく波打たせ、年を取るほど薄い所から崩れていく
  float body=1.0-smoothstep(0.3,1.0,r+(n-0.5)*0.85);
  float er=pow(uAge,1.4)*(KIND==3?0.5:0.85),den=body*(0.55+0.9*n);   // 水しぶきは崩れにくく、白く残る
  float a=smoothstep(er,er+0.22,den)*smoothstep(1.0,0.82,r)*(0.7+0.5*n);   // 中も一様にせず、濃淡をつける
#if KIND==0
  // 火：中心ほど・濃い所ほど熱い。冷えるにつれ暗い赤へ
  float T=den*(0.6+0.7*n)*uHeat*1.25;vec3 c=bbody(T)*uColor.r;
  gl_FragColor=vec4(c*a*uAlpha*sk,1.0);
#else
  // 煙・粉塵・水：擬似の法線（丸み＋ノイズの傾き）で太陽の側を明るく、陰を暗く
  vec3 N=normalize(vec3(p*0.85+(n1.rg-0.5)*1.4,0.55+0.45*sqrt(max(0.0,1.0-r*r))));
  float sd=max(dot(N,uSunV),0.0),lit=0.6+0.7*sd-0.2*(1.0-n);
  // 黒煙でも日の当たる側は灰色に光る（表面で散った日光）。上向きの面には空の光
  vec3 c=uColor*lit+uSunCol*(0.035*pow(sd,1.5)*(KIND==1?1.0:0.5))+uSkyZen*0.05*max(N.y,0.0);
  gl_FragColor=vec4(c,clamp(a*uAlpha*sk,0.0,1.0));
#endif
#endif
}`,
    transparent:true,depthTest:false,depthWrite:false,blending:add?THREE.CustomBlending:THREE.NormalBlending});
  if(add){m.blendEquation=THREE.AddEquation;m.blendSrc=THREE.OneFactor;m.blendDst=THREE.OneFactor;}
  m.color=m.uniforms.uColor.value;Object.defineProperty(m,'opacity',{get(){return this.uniforms.uAlpha.value;},set(v){if(this.uniforms)this.uniforms.uAlpha.value=v;}});Object.defineProperty(m,'rotation',{get(){return this.uniforms.uRot.value;},set(v){this.uniforms.uRot.value=v;}});return m;}
// 燃え続ける炎（建物・木・船）：縦長の板を水平方向だけカメラへ向け、上へ流れるノイズで炎の舌を作る
function flameMat(){const m=new THREE.ShaderMaterial({uniforms:{uAlpha:{value:1},uSeed:{value:Math.random()*10},uT:U.uTime,tDepth:U.tDepth,uRes:U.uRes,tN:U.tNoise2,uSunV:FXU.uSunV},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:FX_GLSL+`
uniform float uAlpha,uSeed,uT;varying vec2 vUv;
void main(){float sk=softK(4.0);if(sk<=0.0)discard;
  float x=(vUv.x-0.5)*2.0,y=vUv.y;
  vec2 q=vec2(vUv.x*0.55+uSeed*0.21,y*0.38-uT*0.55+uSeed);
  float n=texture2D(tN,q).b*0.6+texture2D(tN,q*2.3+vec2(0.31,-uT*0.4)).b*0.4;n=clamp((n-0.5)*2.4+0.5,0.0,1.0);
  // 根元は太く、上へ行くほど細くちぎれる。ノイズで横に揺らす
  float xs=x+(n-0.5)*0.55*y;
  float shape=(1.0-abs(xs)*(1.15+y*1.6))*(1.0-y*0.85);
  float f=shape*1.55-n*0.95*(0.35+y)-0.08;
  float a=smoothstep(0.0,0.28,f);
  float T=f*1.35+(1.0-y)*0.25;
  gl_FragColor=vec4(bbody(T)*a*uAlpha*sk*0.9,1.0);}`,
    transparent:true,depthTest:false,depthWrite:false,blending:THREE.CustomBlending});
  m.blendEquation=THREE.AddEquation;m.blendSrc=THREE.OneFactor;m.blendDst=THREE.OneFactor;return m;}
function makeFlame(){const m=new THREE.Mesh(quad1(),flameMat());m.frustumCulled=false;m.visible=false;m.renderOrder=3;overlay.add(m);return m;}
// 炎の板を、縦はそのままに水平方向だけカメラへ向ける
function faceYaw(m){m.rotation.set(0,Math.atan2(camera.position.x-m.position.x,camera.position.z-m.position.z),0);}
function boomInit(){BOOM.init=true;BOOM.quad=quad1();
  const ft=boomTex(0),st=boomTex(1),dt2=boomTex(2);
  const spr=(map,add,n,arr,ro,kind)=>{const mu={value:map};for(let i=0;i<n;i++){const sp=new THREE.Mesh(BOOM.quad,boomMat(mu,add,kind));sp.visible=false;sp.renderOrder=ro||0;sp.frustumCulled=false;overlay.add(sp);arr.push({sp,vel:new V3(),t:0,life:0,s0:1,s1:1,delay:0,g:0,dr:1,a:1,c:new THREE.Color(),rs:0});}};
  spr(ft,true,90,BOOM.fire,3,0);spr(st,false,240,BOOM.smoke,2,1);spr(dt2,false,70,BOOM.dust,2,2);spr(st,false,60,BOOM.water,2,3);spr(GLOWTEX,true,5,BOOM.flash,4,4);
  for(let i=0;i<5;i++){const N=70,g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(N*3),3));
    const pt=new THREE.Points(g,new THREE.PointsMaterial({map:GLOWTEX,color:new THREE.Color(3,1.5,.4),size:1.4,sizeAttenuation:true,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));pt.frustumCulled=false;pt.visible=false;scene.add(pt);
    const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(N*6),3));const ln=new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:new THREE.Color(4,2,.5),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));ln.frustumCulled=false;ln.visible=false;scene.add(ln);
    BOOM.sparks.push({pt,ln,v:Array.from({length:N},()=>new V3()),t:9,life:2});}
  // 破片：コンクリートの塊・金属の板・焦げた骨組み
  const conc=std({color:lin(0x77736b),roughness:.95,metalness:0}),met=std({color:lin(0x2a2c2f),roughness:.6,metalness:.6}),burnt=std({color:lin(0x18120e),roughness:.9,metalness:.1});
  const gs=[new THREE.BoxGeometry(1,1,1),new THREE.BoxGeometry(1.6,.18,1.1),new THREE.TetrahedronGeometry(.8),new THREE.BoxGeometry(2.4,.25,.25)];
  for(let i=0;i<56;i++){const m=new THREE.Mesh(gs[i%4],i%3===0?met:i%3===1?conc:burnt);m.visible=false;m.castShadow=true;scene.add(m);BOOM.deb.push({m,vel:new V3(),av:new V3(),life:0,trail:0,kind:0});}
  for(let i=0;i<3;i++){const r=new THREE.Mesh(new THREE.RingGeometry(.95,1,64),new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.3,1.0),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));r.rotation.x=-Math.PI/2;r.visible=false;scene.add(r);BOOM.ring.push({m:r,t:9,k:1});}
  BOOM.light=new THREE.PointLight(0xffa050,0,900,1.6);scene.add(BOOM.light);}
// 池から空いた粒を取る（なければ残りが一番短いもの）
function bget(pool){let best=null,bl=1e9;for(const p of pool){if(!p.sp.visible&&p.t>=p.life+p.delay)return p;const rem=p.life+p.delay-p.t;if(rem<bl){bl=rem;best=p;}}return best;}
function bpart(pool,x,y,z,vx,vy,vz,life,s0,s1,o){const p=bget(pool);if(!p)return null;p.sp.position.set(x,y,z);p.vel.set(vx,vy,vz);p.t=0;p.life=life;p.s0=s0;p.s1=s1;p.delay=o&&o.d||0;p.g=o&&o.g||0;p.dr=o&&o.dr!==undefined?o.dr:1.2;p.a=o&&o.a||1;p.rs=(Math.random()-.5)*(o&&o.rs||.4);p.sm=0;p.bk=o&&o.bk||1;{const gg=groundAt(x,z);p.fl=gg<=0&&islandH(x-BASE.x,z-BASE.z)<-1?3.5:gg;}p.sp.visible=false;p.sp.material.rotation=Math.random()*6.283;if(o&&o.c)p.c.copy(o.c);return p;}
const brn=(a,b)=>a+Math.random()*(b-a),_bc=new THREE.Color(),_bxv=new V3();
function explode(p,k,type){
  if(!BOOM.init)boomInit();type=type||'air';k=k||1;
  const gy=groundAt(p.x,p.z),sea=gy<=0&&islandH(p.x-BASE.x,p.z-BASE.z)<-1,floor=sea?3.5:gy,hgt=p.y-floor,low=hgt<30*Math.max(k,.4);
  const big=type==='tank',bld=type==='bldg'||type==='tower'||type==='shed'||type==='dust',hot=type!=='dust'&&type!=='splash';
  // 閃光
  if(hot){const f=bpart(BOOM.flash,p.x,p.y+1,p.z,0,0,0,big?.22:.12,14*k*(big?1.8:1),26*k*(big?2:1),{dr:0});if(f)f.c.setRGB(2.4,1.9,1.3);}
  // 火球：中心から膨らみ、白→橙→赤黒へ冷えて消える
  if(hot){const nF=Math.round((big?26:type==='air'?10+12*k:type==='ship'?10+10*k:6+8*k));
    for(let i=0;i<nF;i++){const a=Math.random()*6.283,e=brn(-.2,1.1),sp=brn(8,26)*k*(big?1.5:1);
      bpart(BOOM.fire,p.x+brn(-3,3)*k,p.y+brn(-1,3)*k,p.z+brn(-3,3)*k,Math.cos(a)*Math.cos(e)*sp,Math.sin(e)*sp+(big?brn(18,34):brn(4,14))*k,Math.sin(a)*Math.cos(e)*sp,brn(.6,1.3)*(big?1.9:1)*(.65+.35*k),brn(4,8)*k,brn(16,30)*k*(big?1.6:1),{d:Math.random()*(big?.35:.12),g:-4,dr:2.4,bk:(big?1.6:1)*(.6+.4*k)});}}
  // 煙：火球のあとに黒煙が立ち上る（タンクは太い黒煙の柱）
  {const nS=big?26:type==='dust'||type==='splash'?0:type==='air'?10+10*k:type==='ship'?14:8+6*k;
    for(let i=0;i<nS;i++){const a=Math.random()*6.283,r=brn(0,10)*k;
      bpart(BOOM.smoke,p.x+Math.cos(a)*r,p.y+brn(0,8)*k,p.z+Math.sin(a)*r,Math.cos(a)*brn(4,18)*k,brn(3,22)*(big?1.6:1),Math.sin(a)*brn(4,18)*k,brn(6,10)*(big?1.8:1)*(.6+.4*k),brn(9,15)*k,brn(48,84)*k*(big?1.5:1),{d:brn(.1,.8),g:big?7:3.5,dr:.7,a:big?1:.9,c:_bc.setRGB(.07,.065,.06)});}}
  // 粉塵：建物は地面を這う土ぼこりが広がる
  if(bld||(low&&!sea&&type==='air')){const nD=type==='dust'?16:bld?22:10,R0=type==='dust'?6:10*k;
    for(let i=0;i<nD;i++){const a=i/nD*6.283+brn(-.2,.2),sp=brn(8,22)*(type==='dust'?.8:k+.3);
      bpart(BOOM.dust,p.x+Math.cos(a)*R0*.4,floor+brn(1,5),p.z+Math.sin(a)*R0*.4,Math.cos(a)*sp,brn(1,4),Math.sin(a)*sp,brn(5,9),brn(6,10)*(k+.3),brn(28,44)*(k+.3),{d:brn(0,.25),g:.6,dr:1.1,a:.85,c:_bc.setRGB(.34,.31,.26)});}
    if(bld)for(let i=0;i<10;i++)bpart(BOOM.dust,p.x+brn(-6,6)*k,p.y+brn(-4,4),p.z+brn(-6,6)*k,brn(-4,4),brn(6,14),brn(-4,4),brn(5,8),brn(8,12)*k,brn(30,50)*k,{d:brn(.05,.4),g:1.5,dr:.8,a:.8,c:_bc.setRGB(.4,.37,.32)});}
  // 水柱：海面近くでは白い水が噴き上がって落ちる
  if(sea&&low){const nW=type==='ship'?26:type==='splash'?34:16;for(let i=0;i<nW;i++){const a=Math.random()*6.283,r=brn(0,5)*k,up=brn(30,70)*Math.sqrt(k)*(type==='ship'?1.2:1);
      bpart(BOOM.water,p.x+Math.cos(a)*r,4,p.z+Math.sin(a)*r,Math.cos(a)*brn(2,9)*k,up,Math.sin(a)*brn(2,9)*k,brn(2.8,4.2),brn(6,10)*k,brn(22,36)*k,{d:brn(0,.15),g:-26,dr:.2,a:.95,c:_bc.setRGB(.86,.9,.94)});}
    for(let i=0;i<10;i++){const a=i/10*6.283;bpart(BOOM.water,p.x,4,p.z,Math.cos(a)*brn(14,24)*k,brn(3,8),Math.sin(a)*brn(14,24)*k,brn(1.8,2.6),brn(5,8)*k,brn(18,28)*k,{g:-10,dr:1,a:.75,c:_bc.setRGB(.86,.9,.94)});}}
  // 火花
  if(hot){const s=BOOM.sparks.reduce((a,b)=>b.t-b.life>a.t-a.life?b:a);const pa=s.pt.geometry.attributes.position;s.t=0;s.life=big?2.6:1.8;
    for(let i=0;i<s.v.length;i++){pa.setXYZ(i,p.x,p.y,p.z);const a=Math.random()*6.283,e=brn(-.1,1.3),v=brn(18,70)*k*(big?1.3:1);s.v[i].set(Math.cos(a)*Math.cos(e)*v,Math.sin(e)*v+8,Math.sin(a)*Math.cos(e)*v);}
    pa.needsUpdate=true;s.pt.visible=s.ln.visible=true;s.pt.material.color.setRGB(3,type==='bldg'?1.8:1.5,.4);}
  // 破片
  {const nB=type==='splash'?0:type==='bldg'?14:type==='shed'?10:type==='tank'?10:type==='ship'?8:type==='air'?Math.round(4+6*k):type==='tower'?6:0;
    for(let i=0;i<nB;i++){let d=null,bl=1e9;for(const q of BOOM.deb){if(q.life<=0){d=q;break;}if(q.life<bl){bl=q.life;d=q;}}if(!d)break;
      const a=Math.random()*6.283,e=brn(.25,1.25),v=brn(14,40)*Math.sqrt(k)*(big?1.4:1);d.m.position.set(p.x+brn(-2,2)*k,p.y+brn(0,3),p.z+brn(-2,2)*k);d.vel.set(Math.cos(a)*Math.cos(e)*v,Math.sin(e)*v,Math.sin(a)*Math.cos(e)*v);
      d.av.set(brn(-8,8),brn(-8,8),brn(-8,8));const s=(type==='bldg'?brn(.8,2.6):brn(.4,1.4))*(k*.6+.5);d.m.scale.set(s*brn(.6,1.4),s*brn(.5,1.2),s*brn(.6,1.4));d.m.visible=true;d.life=brn(5,9);d.trail=type==='air'||type==='tank'||Math.random()<.3?1:0;d.kind=type;}}
  // 衝撃波の輪（地面・海面の近く）
  if(low&&k>.4&&hot){const r=BOOM.ring.reduce((a,b)=>b.t>a.t?b:a);r.t=0;r.k=k*(big?1.5:1);r.m.position.set(p.x,floor+.4,p.z);r.m.visible=true;}
  // 照り返しの光（いちばん新しい大きい爆発に付ける）
  if(hot&&(k>=BOOM.lk*.6||BOOM.lt>1.2)){BOOM.light.position.set(p.x,p.y+6,p.z);BOOM.lt=0;BOOM.lk=k*(big?1.8:1);}
  if(sea&&hgt<14&&(type==='air'||type==='ship'||type==='splash')){_bxv.setFromMatrixColumn(camera.matrixWorld,0);const dx=p.x-camera.position.x,dz=p.z-camera.position.z,dl=Math.hypot(dx,p.y-camera.position.y,dz)||1;playBuf(k>.45?SBUF.splashBig:SBUF.splashSmall,{d:dl,pan:(dx*_bxv.x+dz*_bxv.z)/dl,vol:1.3*Math.min(1.2,k+.3),delay:.05});}
  // 揺れと音は距離で弱める
  const dc=camera.position.distanceTo(p),near=sat(1-dc/1800);
  // 音：距離と左右を付けて鳴らす（遠いほど遅れて届き、こもる）
  if(type!=='splash'){_bxv.setFromMatrixColumn(camera.matrixWorld,0);const dx=p.x-camera.position.x,dy=p.y-camera.position.y,dz=p.z-camera.position.z,dl=Math.hypot(dx,dy,dz)||1;boomAt(dl,(dx*_bxv.x+dy*_bxv.y+dz*_bxv.z)/dl,k,type);}
  if(hot&&k>.5){G.white=Math.max(G.white||0,.38*near);G.shake=Math.max(G.shake,near*(big?1.2:1));if(near>.05&&flashAt)flashAt(p.x,p.y,p.z,1.2*near);}
  else if(hot&&k>.2&&near>.3){G.shake=Math.max(G.shake,.3*near);}
  // タンクは続けて小さな誘爆
  if(big){BOOM.q.push({t:.35,fn:()=>explode(_bxv.set(p.x+brn(-8,8),p.y+brn(2,8),p.z+brn(-8,8)).clone(),.45,'air')},{t:.9,fn:()=>explode(new V3(p.x+brn(-10,10),p.y+brn(4,12),p.z+brn(-10,10)),.35,'air')});}
}
function bfade(f,dt){f.t+=dt;const tt=f.t-f.delay;if(tt<0)return -1;const u=tt/f.life;if(u>=1){f.sp.visible=false;return -1;}f.sp.visible=true;f.sp.quaternion.copy(camera.quaternion);
  f.vel.multiplyScalar(Math.exp(-dt*f.dr));f.vel.y+=f.g*dt;f.sp.position.addScaledVector(f.vel,dt);f.sp.material.rotation+=f.rs*dt;return u;}
function updateExplosion(dt){
  for(let i=BOOM.q.length-1;i>=0;i--){const e=BOOM.q[i];e.t-=dt;if(e.t<=0){BOOM.q.splice(i,1);e.fn();}}
  updateDebris(dt);brkUpdate(dt);contUpdate(dt);vegUpdate(dt);fireUpdate(dt);
  FXU.uSunV.value.copy(U.uSunDir.value).transformDirection(camera.matrixWorldInverse);
  if(!BOOM.init)return;
  const amb=lerp(1,.45,G.gloom||0)*(1-.5*(G.indoor||0)),sun=U.uSunCol.value;
  for(const f of BOOM.flash){if(!f.sp.visible&&f.t>=f.life)continue;const u=bfade(f,dt);if(u<0)continue;const s=lerp(f.s0,f.s1,u);f.sp.scale.set(s,s,1);f.sp.material.color.copy(f.c).multiplyScalar(Math.pow(1-u,1.5));}
  for(const f of BOOM.fire){if(!f.sp.visible&&f.t>=f.life+f.delay)continue;const u=bfade(f,dt);if(u<0)continue;const s=lerp(f.s0,f.s1,1-Math.pow(1-u,2.4));f.sp.scale.set(s,s,1);
    // 冷えた火球は、その場所から黒煙になって立ち上る
    if(u>.5&&!f.sm){f.sm=1;const q=f.sp.position;bpart(BOOM.smoke,q.x,q.y,q.z,f.vel.x*.5,f.vel.y*.5+3,f.vel.z*.5,brn(5,9)*f.bk,s*.9,s*brn(2.6,3.6),{g:4,dr:.6,a:.9,rs:.25,c:_bc.setRGB(.06,.055,.05)});}
    const h=1-u,m=f.sp.material;m.uniforms.uAge.value=u;m.uniforms.uHeat.value=Math.pow(h,.9)*1.1;m.color.setRGB(1,1,1);m.opacity=Math.min(1,(f.t-f.delay)*16)*Math.pow(h,.45);}
  for(const f of BOOM.smoke){if(!f.sp.visible&&f.t>=f.life+f.delay)continue;const u=bfade(f,dt);if(u<0)continue;f.vel.x+=1.6*dt;const s=lerp(f.s0,f.s1,1-Math.pow(1-u,1.7));f.sp.scale.set(s,s,1);if(f.sp.position.y<f.fl+s*.42)f.sp.position.y=f.fl+s*.42;
    // 立ち上がりは火に照らされて赤茶、すぐに黒〜灰色。光の当たり具合で明るさを変える
    const gl=Math.max(0,1-(f.t-f.delay)*1.3),m=f.sp.material,lit=(.55+.1*u)*amb,gy=.16*u*u*amb;m.color.setRGB(f.c.r*lit+.7*gl+sun.x*.012*u+gy,f.c.g*lit+.28*gl+sun.y*.012*u+gy,f.c.b*lit+.08*gl+sun.z*.012*u+gy*1.05);
    m.uniforms.uAge.value=u;m.opacity=Math.min(1,(f.t-f.delay)*2.5)*Math.pow(1-u,.8)*f.a*(.85+.15*Math.sin(f.s1));}
  for(const f of BOOM.dust){if(!f.sp.visible&&f.t>=f.life+f.delay)continue;const u=bfade(f,dt);if(u<0)continue;const s=lerp(f.s0,f.s1,1-Math.pow(1-u,2));f.sp.scale.set(s,s,1);if(f.sp.position.y<f.fl+s*.38)f.sp.position.y=f.fl+s*.38;
    const m=f.sp.material,lit=(.75+.25*(1-u))*amb;m.uniforms.uAge.value=u;m.color.setRGB(f.c.r*lit+sun.x*.02,f.c.g*lit+sun.y*.02,f.c.b*lit+sun.z*.02);m.opacity=Math.min(1,(f.t-f.delay)*4)*Math.pow(1-u,1.2)*f.a;}
  for(const f of BOOM.water){if(!f.sp.visible&&f.t>=f.life+f.delay)continue;const u=bfade(f,dt);if(u<0)continue;const s=lerp(f.s0,f.s1,1-Math.pow(1-u,1.6));f.sp.scale.set(s,s,1);if(f.sp.position.y<3.5+s*.35){f.sp.position.y=3.5+s*.35;f.vel.y=Math.max(0,f.vel.y);}
    const m=f.sp.material,lit=(.7+.3*amb);m.uniforms.uAge.value=u;m.color.setRGB(f.c.r*lit+sun.x*.03,f.c.g*lit+sun.y*.03,f.c.b*lit+sun.z*.03);m.opacity=Math.min(1,(f.t-f.delay)*10)*Math.pow(1-u,.6)*f.a;}
  for(const s of BOOM.sparks){if(!s.pt.visible)continue;s.t+=dt;if(s.t>s.life){s.pt.visible=s.ln.visible=false;continue;}const pa=s.pt.geometry.attributes.position,la=s.ln.geometry.attributes.position;
    for(let i=0;i<s.v.length;i++){const v=s.v[i];v.y-=24*dt;v.multiplyScalar(Math.exp(-dt*.9));const x=pa.getX(i)+v.x*dt,z=pa.getZ(i)+v.z*dt,y=Math.max(pa.getY(i)+v.y*dt,groundAt(x,z)+.3);pa.setXYZ(i,x,y,z);
      la.setXYZ(i*2,x,y,z);la.setXYZ(i*2+1,x-v.x*.045,y-v.y*.045,z-v.z*.045);}   // 光の筋：動いた向きに 0.045 秒ぶん伸ばす（目の残像）
    pa.needsUpdate=la.needsUpdate=true;const fo=Math.pow(Math.max(0,1-s.t/s.life),1.5);s.pt.material.opacity=fo;s.ln.material.opacity=fo;}
  for(const r of BOOM.ring){if(!r.m.visible)continue;r.t+=dt;const u=r.t/.55,R=(6+u*110)*r.k;r.m.scale.set(R,R,1);r.m.material.opacity=Math.max(0,.22*Math.pow(1-u,2));if(u>=1)r.m.visible=false;}
  BOOM.lt+=dt;BOOM.light.intensity=Math.max(0,14*BOOM.lk*Math.exp(-BOOM.lt*4.5)+2.5*BOOM.lk*Math.max(0,1-BOOM.lt/1.4)+(BOOM.burnK||0));
}
// 破片：放物線で飛び、焦げ煙を引き、地面や海に落ちたら土ぼこりや水しぶき
function updateDebris(dt){
  for(const d of BOOM.deb){if(d.life<=0)continue;d.life-=dt;d.vel.y-=16*dt;d.vel.multiplyScalar(Math.exp(-dt*.3));d.m.position.addScaledVector(d.vel,dt);d.m.rotation.x+=d.av.x*dt;d.m.rotation.y+=d.av.y*dt;d.m.rotation.z+=d.av.z*dt;
    if(d.trail){d.tr=(d.tr||0)-dt;if(d.tr<=0){d.tr=.06;const q=d.m.position;bpart(BOOM.smoke,q.x,q.y,q.z,0,1.5,0,brn(1.4,2.2),1.2,5,{g:1.5,dr:1,a:.6,c:_bc.setRGB(.06,.055,.05)});}}
    const q=d.m.position,g=groundAt(q.x,q.z),sea=g<=0&&islandH(q.x-BASE.x,q.z-BASE.z)<-1,fl=sea?3.5:g;
    if(q.y<fl||d.life<=0){if(d.life>0){if(sea)bpart(BOOM.water,q.x,3.6,q.z,0,brn(8,14),0,1.2,1.5,5,{g:-20,dr:.5,a:.8,c:_bc.setRGB(.86,.9,.94)});else bpart(BOOM.dust,q.x,fl+.5,q.z,0,1.5,0,2.4,2,8,{g:.3,dr:1,a:.7,c:_bc.setRGB(.36,.33,.28)});}d.life=0;d.m.visible=false;}}
  // 機体から外れた主翼など（従来の大きな破片）
  for(let i=DEBRIS.length-1;i>=0;i--){const d=DEBRIS[i];d.life-=dt;d.vel.y-=14*dt;d.vel.multiplyScalar(Math.exp(-dt*.35));d.m.position.addScaledVector(d.vel,dt);d.m.rotation.x+=d.av.x*dt;d.m.rotation.y+=d.av.y*dt;d.m.rotation.z+=d.av.z*dt;
    d.smoke-=dt;if(d.smoke<=0){d.smoke=.05;puff(d.m.position.x,d.m.position.y,d.m.position.z,0,3,0,3,1.2,.6);}
    const gy=Math.max(groundAt(d.m.position.x,d.m.position.z),2);if(d.m.position.y<gy||d.life<=0){scene.remove(d.m);d.m.geometry.dispose();d.m.material.dispose();DEBRIS.splice(i,1);}}
}
// 読み込み中に、爆発の粒・破片・受け渡しの部品を一度だけ描いて GPU へ送っておく（初めての爆発でのひっかかりと、形状の数が後から増えるのを防ぐ）
function boomWarm(){boomInit();handInit();camera.updateMatrixWorld();fwdOf(0,0,tA);tB.copy(camera.position);camera.getWorldDirection(tC);tB.addScaledVector(tC,40);
  const objs=[...BOOM.fire,...BOOM.smoke,...BOOM.dust,...BOOM.water,...BOOM.flash].map(f=>f.sp).concat(BOOM.sparks.map(s=>s.pt),BOOM.deb.map(d=>d.m),BOOM.ring.map(r=>r.m),[HAND.pod,HAND.arm,HAND.glow,HAND.lamp]);
  const sv=objs.map(o=>[o.position.clone(),o.scale.clone()]);objs.forEach(o=>{o.position.copy(tB);o.scale.setScalar(.01);o.visible=true;});renderFrame();objs.forEach((o,i)=>{o.position.copy(sv[i][0]);o.scale.copy(sv[i][1]);o.visible=false;});}
function boomReset(){BOOM.q.length=0;if(!BOOM.init)return;for(const a of[BOOM.fire,BOOM.smoke,BOOM.dust,BOOM.water,BOOM.flash])for(const f of a){f.sp.visible=false;f.t=f.life=f.delay=0;}
  BOOM.sparks.forEach(s=>s.pt.visible=false);BOOM.deb.forEach(d=>{d.life=0;d.m.visible=false;});BOOM.ring.forEach(r=>r.m.visible=false);BOOM.lt=9;BOOM.lk=0;BOOM.light.intensity=0;}

// ── 建物の崩壊：まとめた形状の中から、壊れた建物の箱に入る頂点を集めて動かす（種類ごとに崩れ方が違う）
const BRK={meshes:null,list:[],sc:0,claim:new Map()};   // claim：頂点ごとの持ち主（先に崩れ始めた建物）。2 つの崩壊が同じ頂点を取り合って引き伸ばさない
function brkMeshes(){if(BRK.meshes)return BRK.meshes;const ref=new Map(),all=[];
  baseGroup.updateMatrixWorld(true);baseGroup.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||!o.geometry||!o.geometry.attributes.position)return;ref.set(o.geometry,(ref.get(o.geometry)||0)+1);all.push(o);});
  BRK.meshes=all.filter(o=>{const e=o.matrixWorld.elements;return ref.get(o.geometry)===1&&Math.abs(e[0]-1)<1e-4&&Math.abs(e[5]-1)<1e-4&&Math.abs(e[10]-1)<1e-4&&Math.abs(e[1])<1e-4&&Math.abs(e[2])<1e-4&&Math.abs(e[4])<1e-4;}).map(o=>({o,a:o.geometry.attributes.position,ox:o.matrixWorld.elements[12],oy:o.matrixWorld.elements[13],oz:o.matrixWorld.elements[14]}));
  return BRK.meshes;}
const bhash=(x,z)=>{const v=Math.sin(x*127.1+z*311.7)*43758.5453;return v-Math.floor(v);};
function brkStart(o){const c=o.c,kind=c[8]||0,M=.4;const parts=[];if(c[10])c[10].userData.dead=true;   /* クレーン：倒れたら荷役の動きを止める */if(o===STR.cols[0]){G.hgDead=true;hangarLight(0);}
  // 上に載っている部品（管制塔の上の管制室、柱の上の照明など）をたどって、ひとまとめに壊す
  const asm=[o],cu=c.slice(0,6);
  for(let k=0;k<asm.length&&asm.length<40;k++){const s=asm[k].c;
    for(const q of STR.cols){if(q.dead||q.c[7]||q.c[8]===5||q.c[10]||asm.includes(q))continue;const e=q.c,qx=(e[0]+e[3])/2,qz=(e[2]+e[5])/2;
      const ov=Math.max(0,Math.min(e[3],s[3])-Math.max(e[0],s[0]))*Math.max(0,Math.min(e[5],s[5])-Math.max(e[2],s[2])),same=ov>.6*Math.min((e[3]-e[0])*(e[5]-e[2]),(s[3]-s[0])*(s[5]-s[2]))&&e[1]<=s[4]+1&&e[4]>=s[1]-1;   // 平面がほぼ重なる＝同じ建物の屋根と壁
      if(same||(e[1]>=s[1]+.5&&e[1]<=s[4]+2&&qx>s[0]-2&&qx<s[3]+2&&qz>s[2]-2&&qz<s[5]+2)){asm.push(q);for(let i=0;i<3;i++){cu[i]=Math.min(cu[i],e[i]);cu[i+3]=Math.max(cu[i+3],e[i+3]);}}}}
  for(const q of asm){q.dead=true;q.hp=Math.min(q.hp,0);}
  const topM=kind===1?Math.max(3,(c[3]-c[0])*1.2):M;   // 倒れる塔は上に載った照明の頭なども一緒に倒す
  for(const m of brkMeshes()){const a=m.a,arr=a.array,x0=cu[0]-M-m.ox,x1=cu[3]+M-m.ox,y0=cu[1]-M-m.oy,y1=cu[4]+topM-m.oy,z0=cu[2]-M-m.oz,z1=cu[5]+M-m.oz,idx=[];
    const inb=i=>{const x=arr[i*3];if(x<x0||x>x1)return false;const z=arr[i*3+2];if(z<z0||z>z1)return false;const y=arr[i*3+1];return y>=y0&&y<=y1;};
    // 三角形の 3 頂点がすべて箱の中にあるときだけ動かす（道路・電線・クレーンのように箱をまたぐ三角形を引き伸ばさない）
    const ix=m.o.geometry.index;
    if(!ix){for(let t=0,n=a.count-2;t<n;t+=3){if(inb(t)&&inb(t+1)&&inb(t+2))idx.push(t,t+1,t+2);}}
    else{const ia=ix.array,ok=new Uint8Array(a.count),bad=new Uint8Array(a.count);for(let t=0;t<ia.length;t+=3){const p=ia[t],q=ia[t+1],r=ia[t+2],ip=inb(p),iq=inb(q),ir=inb(r);if(ip&&iq&&ir){ok[p]=ok[q]=ok[r]=1;}else{if(ip)bad[p]=1;if(iq)bad[q]=1;if(ir)bad[r]=1;}}for(let i=0;i<a.count;i++)if(ok[i]&&!bad[i])idx.push(i);}
    {let cl=BRK.claim.get(m.a);if(!cl){cl=new Uint8Array(a.count);BRK.claim.set(m.a,cl);}let w=0;for(const i of idx)if(!cl[i]){cl[i]=1;idx[w++]=i;}idx.length=w;}
    if(!idx.length)continue;const I=new Int32Array(idx),O=new Float32Array(idx.length*3);for(let j=0;j<idx.length;j++){O[j*3]=arr[idx[j]*3];O[j*3+1]=arr[idx[j]*3+1];O[j*3+2]=arr[idx[j]*3+2];}
    parts.push({m,I,O,lo:idx[0],hi:idx[idx.length-1]});}
  const a=c[10]?(Math.random()<.65?0:Math.PI)+(Math.random()-.5)*.7:Math.random()*6.283,gy=groundAt((c[0]+c[3])/2,(c[2]+c[5])/2),fl=Math.max(gy,3.5);   // クレーンは海側か陸側へ倒れる
  // 地面から浮いた部品（クレーンの梁など）はその場で崩さず、傾きながら地面へ落とす
  // ただし真下に別の建物があって支えられている部品（屋上のドームなど）は、その場で崩す
  const sup=c[1]-fl>6&&STR.cols.some(q=>!asm.includes(q)&&!q.c[7]&&q.c[0]<c[3]&&q.c[3]>c[0]&&q.c[2]<c[5]&&q.c[5]>c[2]&&q.c[1]<c[1]-.5&&q.c[4]>=c[1]-3);
  const kd=c[1]-fl>6?(sup?(kind===1?0:kind):4):kind;   // 高い位置の細長い部材は倒さない（空中で横へ突き出して旗のように見える）
  const b={o,c,cu,asm:asm.map(q=>({c:q.c,y1:q.c[4]})),kind:kd,u:0,dur:[2.3,2.8,1.9,1.3,1.7][kd],parts,y1:cu[4],fl,dx:Math.cos(a),dz:Math.sin(a),done:false,sc:-1,hit:false,hide:[],att:[]};
  // 範囲の中の灯り（光の板・点光源・灯台の光芒）は消し、回る部品（風車の羽根・レーダー・旗）は止めて一緒に倒す／落とす
  {const ex=4,bx=[cu[0]-ex,cu[1]-1,cu[2]-ex,cu[3]+ex,cu[4]+(kd===1?topM+4:ex),cu[5]+ex],ud=baseGroup.userData,spin=new Set(ud.spin||[]),beam=ud.lhBeam;
    const inBox=x=>{x.getWorldPosition(_bw);return _bw.x>bx[0]&&_bw.x<bx[3]&&_bw.y>bx[1]&&_bw.y<bx[4]&&_bw.z>bx[2]&&_bw.z<bx[5];};
    const walk=n=>{for(const x of n.children){if(x.userData.brkDead)continue;
      const glow=x===beam||x.isLight||x.isSprite||(x.isMesh&&!Array.isArray(x.material)&&x.material&&(x.material.blending===THREE.AdditiveBlending||x.material.blending===THREE.CustomBlending));
      const dyn=!glow&&!x.userData.noWeather&&(x.userData.dyn||spin.has(x));
      if((glow||dyn)&&!x.isPoints&&inBox(x)){x.userData.brkDead=true;
        if(glow){b.hide.push({x,v:x.visible});x.visible=false;}
        else{x.updateMatrixWorld(true);const wp=new V3(),wq=new THREE.Quaternion();x.getWorldPosition(wp);x.getWorldQuaternion(wq);const pq=new THREE.Quaternion();x.parent.getWorldQuaternion(pq);
          b.att.push({x,p0:x.position.clone(),q0:x.quaternion.clone(),wp,wq,pqi:pq.invert(),fl:Math.max(groundAt(wp.x,wp.z),3.5)});}
        continue;}
      walk(x);}};
    walk(baseGroup);}
  // 焼け焦げの範囲を登録（24 棟まで）
  if(BRK.sc<24){const i=BRK.sc++;b.sc=i;U.uScA.value[i].set(cu[0],cu[1],cu[2],0);U.uScB.value[i].set(cu[3],cu[4],cu[5],0);U.uScN.value=BRK.sc;}
  if((kd===0||kd===2)&&b.parts.length)fracInit(b);   // コンクリートの建物と倉庫：本物の部材が割れて落ち、瓦礫の山になる
  BRK.list.push(b);return b;}
const _bw=new V3(),_bq=new THREE.Quaternion(),_bax=new V3();
// ── 大きな火（建物・船・森）：ろうそくのような 1 枚の炎ではなく、広い根元から短命の炎の塊が次々に噴き上がり、乱流で揺れながらちぎれ、
// 冷えて黒煙になって立ち上る。火の粉が舞い、地面と煙の下側を揺らめく橙の光が照らす。近い火ほど多く出す（全体の数には上限）
const FIRE={init:false,fl:[],emb:null,ev:null,el:null,light:null,acc:new Map(),eacc:0};
function fireInit(){if(FIRE.init)return;FIRE.init=true;if(!BOOM.init)boomInit();const mu={value:null};
  for(let i=0;i<260;i++){const sp=new THREE.Mesh(quad1(),boomMat(mu,true,5));sp.visible=false;sp.renderOrder=3;sp.frustumCulled=false;overlay.add(sp);FIRE.fl.push({sp,vel:new V3(),t:0,life:0,s0:1,s1:1,delay:0,g:0,dr:1,a:1,c:new THREE.Color(),rs:0});}
  const N=320,g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(N*3).fill(-9999),3));
  FIRE.emb=new THREE.Points(g,new THREE.PointsMaterial({map:GLOWTEX,color:new THREE.Color(3.2,1.3,.35),size:.9,sizeAttenuation:true,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));FIRE.emb.frustumCulled=false;scene.add(FIRE.emb);
  FIRE.ev=Array.from({length:N},()=>({v:new V3(),life:0,t:0}));FIRE.ei=0;
  FIRE.light=new THREE.PointLight(0xff7a30,0,300,1.7);scene.add(FIRE.light);}
// 燃えている物を集める：{x,y(根元),z,r(広がり),k(勢い)}
function fireSources(){const out=[];if(STR.init)for(const b of STR.burn){if(!(b.k>.3))continue;out.push({x:b.x,y:b.y,z:b.z,r:b.r,k:b.k,id:b,h:b.r*.5,big:b.tank?1:0});}
  if(VEG.ok)for(const e of VEG.burn){const u=e.t/e.dur,k=Math.sin(Math.PI*Math.min(1,u*1.15));if(k<.08)continue;const id=e.id,r=VEG.R[id];out.push({x:VEG.X[id],y:Math.max(VEG.G[id],VEG.Y[id]-r*1.1),z:VEG.Z[id],r:r*.9,k,id:e,h:r*1.1,tree:1});/* 樹冠を包むように、樹冠の下から上まで */}
  return out;}
function fireUpdate(dt){if(!FIRE.init){if(!STR.burn||!STR.burn.length)if(!VEG.burn.length)return;fireInit();}
  const src=fireSources(),cp=camera.position,wx=2.2+(G.gust||0)*.1,wz=.8;
  for(const f of src)f.d=Math.hypot(f.x-cp.x,f.z-cp.z,f.y-cp.y);src.sort((a,b)=>a.d-b.d);
  // 炎の塊：近い火から順に、広がりと勢いに応じて出す
  let bud=Math.min(160,1/dt*1.2);   // 1 コマで出す数の上限の目安
  for(let n=0;n<src.length&&n<40;n++){const f=src[n],lod=f.d<700?1:f.d<1800?.55:f.d<5000?.3:f.d<12000?.12:0;if(!lod)break;   // 遠くの火も見えるように（数は減らす）
    const rate=(2.5+f.r*.6)*f.k*lod*(f.big?1.5:1);let a=(FIRE.acc.get(f.id)||Math.random())+rate*dt;
    while(a>=1&&bud>0){a-=1;bud--;const p=bget(FIRE.fl);if(!p)break;const ang=Math.random()*6.283,rr=Math.sqrt(Math.random())*f.r*.6;
      p.sp.position.set(f.x+Math.cos(ang)*rr,f.y+Math.random()*f.h,f.z+Math.sin(ang)*rr);p.vel.set(wx*.6+brn(-1.5,1.5),brn(3,6)+f.r*.35,wz*.6+brn(-1.5,1.5));
      p.t=0;p.life=brn(.7,1.3)*(1+f.r/40);{const sm=f.tree?1.4:1;p.s0=(f.r*brn(.45,.7)+1.5)*sm;p.s1=(f.r*brn(1,1.4)+3)*sm;}/* 炎の塊は物より大きく、外へはみ出す */p.delay=0;p.dr=.4;p.g=2.5;p.rs=0;p.sm=0;p.bk=f.r;p.sp.material.rotation=0;p.sp.material.uniforms.uSeed.value=Math.random()*10;p.big=f.big;}
    FIRE.acc.set(f.id,a);}
  if(FIRE.acc.size>200)FIRE.acc.clear();
  // 炎の塊を動かす：上へ加速しながら膨らみ、冷えて暗い赤になり、黒煙に変わる
  for(const f of FIRE.fl){if(!f.sp.visible&&f.t>=f.life)continue;const u=bfade(f,dt);if(u<0)continue;f.vel.x+=Math.sin(f.t*5+f.s0)*dt*3;   // 乱流の横揺れ
    const s=lerp(f.s0,f.s1,1-Math.pow(1-u,1.6));f.sp.scale.set(s*1.3,s*1.9,1);const m=f.sp.material;m.uniforms.uAge.value=u;m.uniforms.uHeat.value=Math.pow(1-u,.8)*1.05;m.opacity=Math.min(1,f.t*12)*Math.pow(1-u,.5);
    if(u>.55&&!f.sm){f.sm=1;if(Math.random()<(f.big?.75:.4)){const q=f.sp.position,bg=f.big?1.5:1;bpart(BOOM.smoke,q.x,q.y+s*.3,q.z,f.vel.x*.5+wx*.5,f.vel.y*.4+3*bg,f.vel.z*.5,brn(6,11)*bg,s*.8,s*brn(2.6,3.8)*bg,{g:2.2*bg,dr:.5,a:f.big?.95:.85,rs:.2,c:f.big?_bc.setRGB(.04,.037,.034):_bc.setRGB(.075,.068,.062)});}}}   // 油の火は真っ黒で太い煙
  // 火の粉：近い火から舞い上がり、乱れながら上って消える
  {const pa=FIRE.emb.geometry.attributes.position;FIRE.eacc+=dt*Math.min(60,src.slice(0,6).reduce((a,f)=>a+(f.d<900?(2+f.r*.4)*f.k:0),0));
    while(FIRE.eacc>=1){FIRE.eacc-=1;const f=src[Math.floor(Math.random()*Math.min(6,src.length))];if(!f||f.d>900)break;const e=FIRE.ev[FIRE.ei],i=FIRE.ei;FIRE.ei=(FIRE.ei+1)%FIRE.ev.length;
      const ang=Math.random()*6.283,rr=Math.random()*f.r*.5;pa.setXYZ(i,f.x+Math.cos(ang)*rr,f.y+f.r*brn(.3,1),f.z+Math.sin(ang)*rr);e.v.set(wx+brn(-3,3),brn(5,12),wz+brn(-3,3));e.life=brn(2,4.5);e.t=0;}
    for(let i=0;i<FIRE.ev.length;i++){const e=FIRE.ev[i];if(e.t>=e.life){if(e.life>0){pa.setXYZ(i,0,-9999,0);e.life=0;}continue;}e.t+=dt;e.v.x+=brn(-6,6)*dt;e.v.z+=brn(-6,6)*dt;e.v.y=Math.max(1,e.v.y-dt*1.5);
      pa.setXYZ(i,pa.getX(i)+e.v.x*dt,pa.getY(i)+e.v.y*dt,pa.getZ(i)+e.v.z*dt);}
    pa.needsUpdate=true;FIRE.emb.material.opacity=1;}
  // 揺らめく照り返し：いちばん近い大きな火
  {let best=null,bs=0;for(const f of src.slice(0,8)){const sc=f.r*f.k/(1+f.d/400);if(sc>bs){bs=sc;best=f;}}
    if(best&&best.d<2500){FIRE.light.position.set(best.x,best.y+best.r*.8,best.z);FIRE.light.distance=80+best.r*9;FIRE.light.intensity=(2+best.r*.35)*best.k*(.75+.15*Math.sin(G.t*17.3)+.1*Math.sin(G.t*7.1));}else FIRE.light.intensity=0;}}
function fireReset(){if(!FIRE.init)return;for(const f of FIRE.fl){f.sp.visible=false;f.t=f.life=0;}FIRE.acc.clear();const pa=FIRE.emb.geometry.attributes.position;for(let i=0;i<FIRE.ev.length;i++){FIRE.ev[i].life=0;pa.setXYZ(i,0,-9999,0);}pa.needsUpdate=true;FIRE.light.intensity=0;}
// ── 木の火災：ミサイル・墜落・燃える建物から木に火がつき、ときどき隣の木へ燃え広がる。燃えた木は黒く焦げ、樹冠が縮む
const VEG={ok:false,sets:[],X:null,Y:null,Z:null,R:null,G:null,S:null,set:null,idx:null,st:null,grid:new Map(),burn:[],spread:0,fx:[],smoke:[],emit:0,col:0,dirty:new Set(),touched:new Set()};
const _vm=new THREE.Matrix4(),_vp=new V3(),_vq=new THREE.Quaternion(),_vs=new V3(),_vc=new THREE.Color();
function vegInit(){if(VEG.ok)return;VEG.ok=true;const ud=baseGroup.userData,list=[];
  if(ud.trees)list.push({im:ud.trees,k:0,top:1.35,rad:1.5});if(ud.shrubs)list.push({im:ud.shrubs,k:1,top:1.4,rad:1.4});
  if(ud.avenue)list.push({im:ud.avenue[0],k:0,top:1.2,rad:1.4,trunk:ud.avenue[1]});if(ud.palms)list.push({im:ud.palms[0],k:2,top:.5,rad:3,trunk:ud.palms[1]});
  baseGroup.updateMatrixWorld(true);let n=0;for(const L of list)n+=L.im.count;
  const X=VEG.X=new Float32Array(n),Y=VEG.Y=new Float32Array(n),Z=VEG.Z=new Float32Array(n),R=VEG.R=new Float32Array(n),Gy=VEG.G=new Float32Array(n);VEG.set=new Uint8Array(n);VEG.idx=new Uint32Array(n);VEG.st=new Uint8Array(n);
  let id=0;list.forEach((L,si)=>{VEG.sets.push(L);for(let i=0;i<L.im.count;i++,id++){L.im.getMatrixAt(i,_vm);_vm.decompose(_vp,_vq,_vs);_vp.applyMatrix4(L.im.matrixWorld);
    X[id]=_vp.x;Z[id]=_vp.z;R[id]=Math.max(.8,_vs.x*L.rad);Y[id]=_vp.y+_vs.y*L.top;Gy[id]=groundAt(_vp.x,_vp.z);VEG.set[id]=si;VEG.idx[id]=i;
    const key=Math.floor(_vp.x/24)+','+Math.floor(_vp.z/24);let a=VEG.grid.get(key);if(!a)VEG.grid.set(key,a=[]);a.push(id);}});
  // 炎と煙
  for(let i=0;i<36;i++)VEG.fx.push(makeFlame());
  const dm={blendSrc:THREE.ZeroFactor,blendDst:THREE.OneMinusSrcColorFactor};
  for(let i=0;i<60;i++){const m=new THREE.Mesh(quad1(),glowMat(new V3(.42,.42,.44),3,dm));m.frustumCulled=false;m.visible=false;overlay.add(m);VEG.smoke.push({m,life:0,max:1,vel:new V3(),s:1});}}
function vegNear(x,z,R,fn){const c0=Math.floor((x-R)/24),c1=Math.floor((x+R)/24),d0=Math.floor((z-R)/24),d1=Math.floor((z+R)/24);
  for(let i=c0;i<=c1;i++)for(let j=d0;j<=d1;j++){const a=VEG.grid.get(i+','+j);if(a)for(const id of a)fn(id);}}
// 弾が木の樹冠を通ったか
function vegHit(q){if(!VEG.ok)vegInit();let hit=false;vegNear(q.x,q.z,16,id=>{if(hit||VEG.st[id]===2)return;const r=VEG.R[id];if(q.y<VEG.Y[id]&&q.y>VEG.G[id]&&(q.x-VEG.X[id])**2+(q.z-VEG.Z[id])**2<r*r*.6)hit=true;});return hit;}
function vegIgnite(x,z,R){if(!VEG.ok)vegInit();if(groundAt(x,z)<3)return;let n=0;vegNear(x,z,R+12,id=>{if(VEG.st[id]||VEG.burn.length>=60)return;const d=Math.hypot(VEG.X[id]-x,VEG.Z[id]-z);if(d<R+VEG.R[id]*.5&&Math.random()<1-d/(R+12)*.5){vegStart(id);n++;}});return n;}
function vegStart(id){VEG.st[id]=1;const k=VEG.sets[VEG.set[id]].k;VEG.burn.push({id,t:0,dur:k===1?12+Math.random()*8:k===2?24+Math.random()*10:32+Math.random()*20,sp:0});VEG.touched.add(id);}
function vegSetCol(id,u){const L=VEG.sets[VEG.set[id]],im=L.im,i=VEG.idx[id];if(!im.instanceColor)return;
  if(!L.c0)L.c0=im.instanceColor.array.slice();const o=L.c0;const a=sat(u*1.3),r=lerp(o[i*3],.07,a),g=lerp(o[i*3+1],.055,a),b=lerp(o[i*3+2],.045,a);
  _vc.setRGB(r+(u<.6?.25*Math.sin(u*Math.PI/.6):0),g,b);im.setColorAt(i,_vc);VEG.dirty.add(im);}   // 燃えている間は少し赤みを帯び、だんだん黒く
function vegChar(id){const L=VEG.sets[VEG.set[id]],im=L.im,i=VEG.idx[id];if(!L.m0)L.m0=im.instanceMatrix.array.slice();
  im.getMatrixAt(i,_vm);_vm.decompose(_vp,_vq,_vs);const k=L.k===1?.45:L.k===2?.3:.6;_vp.y-=_vs.y*(1-k)*.5;_vs.multiplyScalar(k);_vm.compose(_vp,_vq,_vs);im.setMatrixAt(i,_vm);im.instanceMatrix.needsUpdate=true;}
function vegUpdate(dt){if(!VEG.ok||!VEG.burn.length&&!VEG.smokeOn){return;}VEG.col-=dt;const doCol=VEG.col<=0;if(doCol)VEG.col=.2;
  for(let b=VEG.burn.length-1;b>=0;b--){const e=VEG.burn[b];e.t+=dt;const u=e.t/e.dur;if(doCol)vegSetCol(e.id,u);
    // ときどき燃え広がる（燃えさかっている間だけ。1 回の任務で広がるのは 300 本まで、同時に燃えるのは 60 本まで）
    e.sp-=dt;if(e.sp<=0){e.sp=1;if(u>.15&&u<.8&&VEG.spread<300&&VEG.burn.length<60&&Math.random()<(VEG.sets[VEG.set[e.id]].k===1?.05:.035)){
      const x=VEG.X[e.id],z=VEG.Z[e.id],rr=VEG.R[e.id]+10;let pick=-1,c=0;vegNear(x,z,rr,id=>{if(VEG.st[id])return;if(Math.hypot(VEG.X[id]-x,VEG.Z[id]-z)<rr+VEG.R[id]*.5&&Math.random()<1/(++c))pick=id;});
      if(pick>=0){vegStart(pick);VEG.spread++;}}}
    if(u>=1){VEG.st[e.id]=2;vegSetCol(e.id,1);vegChar(e.id);VEG.burn.splice(b,1);}}
  for(const im of VEG.dirty)if(im.instanceColor)im.instanceColor.needsUpdate=true;VEG.dirty.clear();
  // 炎・煙・火の粉は fireUpdate がまとめて描く
  let on=false;for(const p of VEG.smoke){if(p.life<=0)continue;on=true;p.life-=dt;if(p.life<=0){p.m.visible=false;continue;}const k=p.life/p.max;p.vel.multiplyScalar(Math.exp(-dt*.3));p.m.position.addScaledVector(p.vel,dt);
    const sc=p.s*(1+(1-k)*4);p.m.scale.set(sc,sc,1);p.m.quaternion.copy(camera.quaternion);p.m.material.uniforms.uAlpha.value=Math.min((1-k)*5,1)*k*.7;}VEG.smokeOn=on;}
function vegReset(){if(!VEG.ok)return;for(const L of VEG.sets){if(L.c0){L.im.instanceColor.array.set(L.c0);L.im.instanceColor.needsUpdate=true;}if(L.m0){L.im.instanceMatrix.array.set(L.m0);L.im.instanceMatrix.needsUpdate=true;}}
  for(const id of VEG.touched)VEG.st[id]=0;VEG.touched.clear();VEG.burn.length=0;VEG.spread=0;for(const f of VEG.fx)f.visible=false;for(const p of VEG.smoke){p.life=0;p.m.visible=false;}VEG.smokeOn=false;}
// ── コンテナ区画の破壊：爆風で上の段のコンテナが飛ばされ（回りながら落ち、岸壁で跳ねるか海に沈む）、残りは崩れて傾く
const CBRK={deb:[],geo:null,broken:[]},_cm=new THREE.Matrix4(),_cp=new V3(),_cq=new THREE.Quaternion(),_cs=new V3(),_cc=new THREE.Color();
function contBreak(o){const L=baseGroup.userData.lodPort,cn=L&&L.userData.cont;if(!cn)return;const blk=cn.blocks[o.c[11]];if(!blk||blk.dead)return;blk.dead=true;CBRK.broken.push(blk);
  const im=cn.im,arr=im.instanceMatrix.array;blk.orig=arr.slice(blk.i0*16,blk.i1*16);if(!cn.colors0&&im.instanceColor)cn.colors0=im.instanceColor.array.slice();
  if(!CBRK.geo){CBRK.geo=new THREE.BoxGeometry(2.44,2.59,6.06);const cm=containerMat();for(let i=0;i<90;i++){const m=new THREE.Mesh(CBRK.geo,cm.clone());m.castShadow=true;m.visible=false;scene.add(m);CBRK.deb.push({m,v:new V3(),av:new V3(),on:false});}}
  const c=o.c,cx=(c[0]+c[3])/2,cz=(c[2]+c[5])/2,top=c[4];L.updateMatrixWorld(true);
  for(let i=blk.i0;i<blk.i1;i++){im.getMatrixAt(i,_cm);_cm.decompose(_cp,_cq,_cs);const w=_cp.clone().applyMatrix4(L.matrixWorld),hi=w.y>top-3,lay=Math.round((w.y-c[1]-1.3)/2.62);
    const near=1-Math.min(1,Math.hypot(w.x-cx,w.z-cz)/26);
    const d=Math.random()<(hi?.5+near*.45:lay>=1?.12+near*.4:.03+near*.1)?CBRK.deb.find(q=>!q.on):null;   // 爆心に近い・上の段ほど飛ばされやすい
    if(d){// 飛ばされる：インスタンスは消して、本物の箱を飛ばす
      _cs.set(0,0,0);_cm.compose(_cp,_cq,_cs);im.setMatrixAt(i,_cm);im.getColorAt(i,_cc);d.m.material.color.copy(_cc).multiplyScalar(.75);
      d.on=true;d.m.visible=true;d.m.position.copy(w);d.m.quaternion.identity();const ox=w.x-cx,oz=w.z-cz,ol=Math.hypot(ox,oz)||1;
      d.v.set(ox/ol*(6+Math.random()*16),12+Math.random()*16,oz/ol*(6+Math.random()*16));d.av.set((Math.random()-.5)*4,(Math.random()-.5)*2,(Math.random()-.5)*4);d.rest=false;d.sink=0;d.t=0;}
    else{// 残る：上の段ほど大きく崩れてずれ、傾く。焼けて少し黒ずむ
      const k=Math.max(0,Math.round((_cp.y-c[1]-1.3)/2.62)),dr=k*Math.random()*1.4,tilt=(Math.random()-.5)*.25*(1+k*.5);
      _cp.y-=dr;_cp.x+=(Math.random()-.5)*k*.8;_cp.z+=(Math.random()-.5)*k*1.2;_cq.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt*.4,(Math.random()-.5)*.3*k,tilt)));
      _cm.compose(_cp,_cq,_cs);im.setMatrixAt(i,_cm);im.getColorAt(i,_cc);_cc.multiplyScalar(.55+Math.random()*.25);im.setColorAt(i,_cc);}}
  im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;
  if(c.cy0===undefined)c.cy0=c[4];c[4]=c[1]+Math.max(2.6,(c[4]-c[1])*.55);}   // 崩れたあとの当たりの高さ
function contUpdate(dt){if(!CBRK.deb.length)return;
  for(const d of CBRK.deb){if(!d.on||d.rest)continue;d.t+=dt;const m=d.m,p=m.position;
    if(d.sink>0){// 海に落ちた：ゆっくり傾きながら沈む
      d.sink+=dt;p.y-=dt*(.5+d.sink*.08);m.rotateX(dt*.05);if(p.y<-6){m.visible=false;d.rest=true;}continue;}
    d.v.y-=dt*16;p.addScaledVector(d.v,dt);m.rotateX(d.av.x*dt);m.rotateY(d.av.y*dt);m.rotateZ(d.av.z*dt);
    const gy=groundAt(p.x,p.z);
    if(gy<1.2&&p.y<.6){d.sink=.01;d.v.set(0,0,0);seaHit(p.x,p.z);if(p.distanceTo(camera.position)<600)SFX.splash();continue;}
    if(gy>=1.2&&p.y<gy+1.3){p.y=gy+1.3;if(Math.abs(d.v.y)>5){d.v.y*=-.22;d.v.x*=.5;d.v.z*=.5;d.av.multiplyScalar(.45);puff(p.x,gy+.5,p.z,0,2,0,1.6,.6,.9);if(p.distanceTo(camera.position)<500)SFX.scrape();}
      else{// 止まる：ほぼ水平に寝かせる
        d.rest=true;const e=new THREE.Euler().setFromQuaternion(m.quaternion,'YXZ');m.rotation.set(Math.round(e.x/(Math.PI/2))*(Math.PI/2)*0+(Math.random()-.5)*.06,e.y,(Math.random()-.5)*.08,'YXZ');}}}}
function contReset(){const L=baseGroup.userData.lodPort,cn=L&&L.userData.cont;if(cn){const arr=cn.im.instanceMatrix.array;
    for(const blk of CBRK.broken){arr.set(blk.orig,blk.i0*16);blk.dead=false;}
    if(CBRK.broken.length){cn.im.instanceMatrix.needsUpdate=true;if(cn.colors0){cn.im.instanceColor.array.set(cn.colors0);cn.im.instanceColor.needsUpdate=true;}}}
  CBRK.broken.length=0;for(const d of CBRK.deb){d.on=false;d.m.visible=false;}
  for(const c of baseGroup.userData.colliders)if(c[8]===5&&c.cy0!==undefined)c[4]=c.cy0;}
// 1 頂点の崩れ方（ワールド座標で計算）。塔は柱（b.c）の根元を支点に、ほかはひとまとめの範囲（b.cu）で崩す
function brkPos(b,X,Y,Z,u,out){const c=b.kind===1?b.c:b.cu,pv=b.kind===1&&b.c[9],x0=pv?pv[0]:c[0],x1=pv?pv[2]:c[3],z0=pv?pv[1]:c[2],z1=pv?pv[3]:c[5],y0=c[1],h=Math.max(1,b.y1-y0),w=x1-x0,d=z1-z0,cx=(x0+x1)/2,cz=(z0+z1)/2,ny=sat((Y-y0)/h);
  if(b.kind===1){// 塔：根元の端を支点に倒れる（加速しながら）
    const th=1.48*Math.min(1,u*u),px=cx+b.dx*w*.5,pz=cz+b.dz*d*.5,kx=b.dz,kz=-b.dx,vx=X-px,vy=Y-y0,vz=Z-pz,cs=Math.cos(th),sn=Math.sin(th),kd=kx*vx+kz*vz;
    // v cos + (k×v) sin + k(k·v)(1-cos)　k=(kx,0,kz)
    out.set(px+vx*cs+(-kz*vy)*sn+kx*kd*(1-cs),y0+vy*cs+(kz*vx-kx*vz)*sn,pz+vz*cs+(kx*vy)*sn+kz*kd*(1-cs));if(out.y<y0+.3*ny)out.y=y0+.3*ny;return out;}
  if(b.kind===4){// 落下：重力で落ち、少し傾き、地面で止まる
    const drop=(y0-b.fl)*Math.min(1,u*u*1.15),tl=.35*ease(sat(u)),dxv=X-cx,dzv=Z-cz,dyv=Y-y0;out.set(X+dyv*Math.sin(tl)*b.dx*.6,Math.max(b.fl+.2,Math.min(Y,Y-drop-dxv*Math.sin(tl)*b.dx*.5-dzv*Math.sin(tl)*b.dz*.5)),Z+dyv*Math.sin(tl)*b.dz*.6);return out;}
  const n=vn2(X/7.3+b.dx*9,Z/7.3+b.dz*9),n2=vn2(X/3.1+17,Z/3.1+5);
  // 縁への近さ 0〜1（判定の余白で箱の外にある頂点だと 1 を超え、4 乗で高さが何倍にも伸びていた）
  const ed=sat(1-Math.min(Math.min(X-x0,x1-X),Math.min(Z-z0,z1-Z))/Math.max(.5,.5*Math.min(w,d)));
  if(b.kind===2){// 倉庫：屋根が中央から落ち込み、壁は少し外へはらむ
    const uu=ease(sat(u*1.2-(1-ny)*.2)),cen=sat(1-ed);let Yn=Y;if(ny>.45)Yn=Y-(ny-.3)*h*(.5+.45*cen)*uu*(.8+.4*n);
    out.set(X+(X-cx)/Math.max(1,w*.5)*.06*h*ny*uu,Math.max(y0,Yn-(ny<.45?ny*h*.25*uu*n2:0)),Z+(Z-cz)/Math.max(1,d*.5)*.06*h*ny*uu);return out;}
  if(b.kind===3){// タンク：潰れて裂け、横へ膨らむ
    const uu=ease(sat(u)),f=.22+.25*n;out.set(X+(X-cx)*.28*uu*ny,y0+(Y-y0)*lerp(1,f,uu),Z+(Z-cz)*.28*uu*ny);return out;}
  // コンクリート：上の階から崩れ、外壁の一部がぎざぎざに残る。瓦礫は外へ広がる
  const uu=ease(sat(u*1.25-(1-ny)*.25)),f=.06+.3*n*n+.5*Math.pow(Math.max(0,ed),4)*n2;
  const Yn=Math.min(Y,y0+(Y-y0)*lerp(1,Math.min(1,f),uu)),sp=.12*uu*(1-Math.min(1,f))*(1-ny*.4);out.set(X+(X-cx)*sp,Yn-Math.abs(X-cx)*.03*uu*ny,Z+(Z-cz)*sp);return out;}   // 傾きは下がる向きだけ（広い建物で片側が持ち上がっていた）
const _bp=new V3();
// ── 建物が割れて崩れる：上の部分の本物の部材（壁・窓・屋根の三角形）を 4.5m 四方ごとの塊に分け、爆心から順に吹き飛ばして重力で落とす。
// 下の部分はぎざぎざの残骸として残し（一部の角や壁は高く残る）、大きすぎて割れない面は残骸の高さへ押し縮め、代わりに手続きの瓦礫で補う。
// 落ちた塊は地面や瓦礫の山の上で跳ねて止まり、山は積もっていく。残骸の上からは鉄筋が突き出す
const FR={im:null,n:0,max:2600,pile:new Map(),moving:[]},_fm=new THREE.Matrix4(),_fq=new THREE.Quaternion(),_gv=new V3(),_gv2=new V3(),_fs=new V3(),_fc=new THREE.Color();
function frInit(){if(FR.im)return;FR.im=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),std({color:0xffffff,roughness:.92,metalness:.05}),FR.max);FR.im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  FR.im.setColorAt(0,_fc.setRGB(1,1,1));FR.im.count=0;FR.im.castShadow=true;FR.im.receiveShadow=true;FR.im.frustumCulled=false;scene.add(FR.im);}
const pileKey=(x,z)=>Math.floor(x/3)+','+Math.floor(z/3);
const pileAt=(x,z)=>FR.pile.get(pileKey(x,z))||0;
function fracInit(b){frInit();const c=b.cu,y0=c[1],H=Math.max(4,b.y1-y0),kd=b.kind,cx=(c[0]+c[3])/2,cz=(c[2]+c[5])/2;
  const hp=b.o.hitP||new V3(cx,c[4],cz),seed=Math.random()*100;b.hp=hp;b.t=0;
  // 残骸の高さ：大半は低く、ところどころ角や壁が高く残る（倉庫は鉄骨の壁が多めに残る）
  const stump=(x,z)=>{const n=vn2(x/11+seed,z/11-seed),n2=vn2(x/4.3+seed*2,z/4.3);return y0+H*(kd===2?.2:.1)+Math.min(H*(kd===2?.55:.5),25)*Math.pow(n,kd===2?2.2:3)+n2*2.4;};   // 高く残る壁は 25m まで
  const F={chunks:[],pc:[],stumpAvg:0,dust:0};b.frac=F;const cells=new Map(),cs=kd===2?6:4.5,big=[];let sa=0,sn=0,domN=0,dom=null,bigA=0;
  for(const P0 of b.parts){const m=P0.m,I=P0.I,O=P0.O,n=I.length,geo=m.o.geometry,tri=!geo.index;P0.role=new Int32Array(n).fill(-1);P0.stY=new Float32Array(n);
    const na=geo.attributes.normal;if(na){P0.na=na;P0.N0=new Float32Array(n*3);for(let j=0;j<n;j++){P0.N0[j*3]=na.array[I[j]*3];P0.N0[j*3+1]=na.array[I[j]*3+1];P0.N0[j*3+2]=na.array[I[j]*3+2];}}
    if(n>domN&&m.o.material&&m.o.material.color){domN=n;dom=m.o.material.color;}
    for(let j=0;j<n;j++){P0.stY[j]=stump(O[j*3]+m.ox,O[j*3+2]+m.oz);}
    if(!tri)continue;
    for(let j=0;j+2<n;j+=3){if(I[j]%3!==0||I[j+1]!==I[j]+1||I[j+2]!==I[j]+2)continue;   // 三角形がそろっているものだけ
      const ax=O[j*3]+m.ox,ay=O[j*3+1]+m.oy,az=O[j*3+2]+m.oz,bx=O[j*3+3]+m.ox,by=O[j*3+4]+m.oy,bz=O[j*3+5]+m.oz,qx=O[j*3+6]+m.ox,qy=O[j*3+7]+m.oy,qz=O[j*3+8]+m.oz;
      const mx=(ax+bx+qx)/3,my=(ay+by+qy)/3,mz=(az+bz+qz)/3,L=Math.max(Math.hypot(ax-bx,ay-by,az-bz),Math.hypot(bx-qx,by-qy,bz-qz),Math.hypot(qx-ax,qy-ay,qz-az));
      if(my<stump(mx,mz))continue;
      const roof=kd===2&&my>y0+H*.6;if(!(L<9||(roof&&L<48))){   // 大きな面は割れない（残骸へ押し縮める）。倉庫の屋根板は大きなまま落ちる
        const ar=.5*Math.hypot((by-ay)*(qz-az)-(bz-az)*(qy-ay),(bz-az)*(qx-ax)-(bx-ax)*(qz-az),(bx-ax)*(qy-ay)-(by-ay)*(qx-ax));big.push([ax,ay,az,bx,by,bz,qx,qy,qz,ar,m.o.material&&m.o.material.color]);bigA+=ar;continue;}
      const key=Math.floor(mx/cs)+','+Math.floor(my/cs)+','+Math.floor(mz/cs);let ch=cells.get(key);if(!ch){ch={sx:0,sy:0,sz:0,k:0,v:[],r:0};cells.set(key,ch);F.chunks.push(ch);}
      ch.sx+=mx;ch.sy+=my;ch.sz+=mz;ch.k++;ch.r=Math.max(ch.r,L);for(let q=0;q<3;q++){P0.role[j+q]=F.chunks.indexOf(ch);ch.v.push(P0,j+q);}}}
  // 塊の中心と、中心から見た各頂点の位置
  for(const ch of F.chunks){ch.c0=new V3(ch.sx/ch.k,ch.sy/ch.k,ch.sz/ch.k);ch.pos=ch.c0.clone();ch.q=new THREE.Quaternion();ch.vel=new V3();ch.av=new V3();ch.st=0;ch.r=Math.min(Math.max(ch.r,cs*.6),14);
    ch.loc=new Float32Array(ch.v.length/2*3);for(let k=0;k<ch.v.length;k+=2){const P0=ch.v[k],j=ch.v[k+1],m=P0.m;ch.loc[k/2*3]=P0.O[j*3]+m.ox-ch.c0.x;ch.loc[k/2*3+1]=P0.O[j*3+1]+m.oy-ch.c0.y;ch.loc[k/2*3+2]=P0.O[j*3+2]+m.oz-ch.c0.z;}
    ch.delay=ch.c0.distanceTo(hp)/45+Math.random()*.3;}
  // 手続きの瓦礫：割れずに押し縮めた大きな面の上に、面積に応じて置く（その面の材質の色。何もなかった空間には置かない）
  {const w=c[3]-c[0],d=c[5]-c[2],N=Math.min(FR.max-FR.n,Math.round(Math.min(110,bigA/22)*(kd===2?.6:1)));
    for(let i=0;i<N;i++){let r=Math.random()*bigA,f=big[0];for(const g of big){r-=g[9];if(r<=0){f=g;break;}}
      let u1=Math.random(),u2=Math.random();if(u1+u2>1){u1=1-u1;u2=1-u2;}const x=f[0]+(f[3]-f[0])*u1+(f[6]-f[0])*u2,y=f[1]+(f[4]-f[1])*u1+(f[7]-f[1])*u2,z=f[2]+(f[5]-f[2])*u1+(f[8]-f[2])*u2;
      const k=FR.n++,typ=Math.random();
      const sz=typ<.45?new V3(brn(2,4.5),brn(.35,.8),brn(1.5,3.5)):typ<.8?new V3(brn(1.2,3.2),brn(1.2,3),brn(.3,.7)):new V3(brn(.4,.7),brn(2,4.5),brn(.4,.7));
      const col=f[10]&&Math.random()<.65?_fc.copy(f[10]).multiplyScalar(brn(.6,1.05)):_fc.setRGB(.5,.49,.46).multiplyScalar(brn(.55,1));FR.im.setColorAt(k,col);
      F.pc.push({k,c0:new V3(x,y,z),pos:new V3(x,y,z),q:new THREE.Quaternion().setFromEuler(new THREE.Euler(brn(-.3,.3),brn(0,6),brn(-.3,.3))),sz,vel:new V3(),av:new V3(),st:0,r:Math.max(sz.x,sz.y,sz.z),delay:Math.hypot(x-hp.x,y-hp.y,z-hp.z)/45+Math.random()*.3});}
    // 鉄筋：残骸の上から斜めに突き出す細い棒（動かない）
    const nR=Math.min(FR.max-FR.n,kd===2?6:12);for(let i=0;i<nR;i++){const x=c[0]+Math.random()*w,z=c[2]+Math.random()*d,st=stump(x,z),L=brn(1.5,4),k=FR.n++;
      _fq.setFromEuler(new THREE.Euler(brn(-.6,.6),brn(0,6),brn(-.6,.6)));_gv.set(x,st+L*.35,z);_fs.set(kd===2?.22:.09,L,kd===2?.22:.09);_fm.compose(_gv,_fq,_fs);FR.im.setMatrixAt(k,_fm);FR.im.setColorAt(k,_fc.setRGB(.2,.12,.08));}
    FR.im.count=FR.n;FR.im.instanceMatrix.needsUpdate=true;if(FR.im.instanceColor)FR.im.instanceColor.needsUpdate=true;
    for(const p of F.pc){_fm.compose(p.pos,p.q,p.sz);FR.im.setMatrixAt(p.k,_fm);}}
  for(const P0 of b.parts)for(let j=0;j<P0.stY.length;j++){sa+=P0.stY[j];sn++;}F.stumpAvg=sn?sa/sn:y0+H*.2;}
// 1 つの塊（本物の部材か手続きの瓦礫）を動かす。止まったら true
function fracBody(ch,b,dt){if(ch.st===2)return true;
  if(ch.st===0){if(b.t<ch.delay)return false;ch.st=1;const hp=b.hp,c=b.cu,cx=(c[0]+c[3])/2,cz=(c[2]+c[5])/2;_gv.copy(ch.c0).sub(hp);const d=_gv.length()||1;_gv.multiplyScalar(1/d);
    const H=b.y1-c[1],blast=Math.max(0,1-d/(H*.6+10))*(b.kind===2?6:9)*(.4+.6*Math.random());   // 爆心の近くだけ飛ばす。ほかは自分の重さで崩れ落ちる
    ch.vel.copy(_gv).multiplyScalar(blast).add(_gv2.set(ch.c0.x-cx,0,ch.c0.z-cz).normalize().multiplyScalar(brn(1,3.5)));ch.vel.y+=brn(-1,3);
    ch.av.set(brn(-1,1),brn(-1,1),brn(-1,1)).normalize().multiplyScalar(brn(.2,1.2)*(.4+blast*.08)*Math.min(1,6/ch.r));}   // 大きく重い塊ほどゆっくり回る
  ch.vel.y-=16*dt;ch.vel.multiplyScalar(Math.exp(-dt*(ch.r<2?.6:.15)));ch.pos.addScaledVector(ch.vel,dt);   // 小さく薄い破片は空気で速く減速する
  const al=ch.av.length();if(al>1e-4){_fq.setFromAxisAngle(_gv.copy(ch.av).multiplyScalar(1/al),al*dt);ch.q.premultiply(_fq);}
  const fl=Math.max(groundAt(ch.pos.x,ch.pos.z),b.fl)+pileAt(ch.pos.x,ch.pos.z),bot=ch.pos.y-ch.r*.3;
  if(bot<fl){ch.pos.y=fl+ch.r*.3;
    if(!ch.hit){ch.hit=1;if(b.frac.dust<14&&Math.random()<.5){b.frac.dust++;bpart(BOOM.dust,ch.pos.x,fl+1,ch.pos.z,brn(-3,3),brn(1,3),brn(-3,3),brn(4,7),brn(4,7),brn(16,28),{g:.5,dr:1,a:.8,c:_bc.setRGB(.4,.37,.32)});}}
    if(Math.abs(ch.vel.y)>3.5){ch.vel.y*=-.22;ch.vel.x*=.45;ch.vel.z*=.45;ch.av.multiplyScalar(.5);}
    else{ch.st=2;const k=pileKey(ch.pos.x,ch.pos.z);FR.pile.set(k,Math.min(9,(FR.pile.get(k)||0)+ch.r*.12));return true;}}
  return false;}
function fracUpdate(b,dt,rng){const F=b.frac;b.t+=dt;const u=ease(sat(b.t/1.4));let rest=true;
  // 残骸：上から押し縮める（爆発の火球に隠れているうちに）
  if(!F.stDone){for(const P0 of b.parts){const m=P0.m,arr=m.a.array;for(let j=0;j<P0.I.length;j++){if(P0.role[j]>=0)continue;const i=P0.I[j],oy=P0.O[j*3+1]+m.oy,sy=P0.stY[j];
        if(oy>sy){arr[i*3+1]=lerp(oy,sy,u)-m.oy;}}
      const r=rng.get(m.a);if(r){r[0]=Math.min(r[0],P0.lo);r[1]=Math.max(r[1],P0.hi);}else rng.set(m.a,[P0.lo,P0.hi]);}if(u>=1)F.stDone=true;}
  // 本物の部材の塊
  const touched=new Set();
  for(const ch of F.chunks){if(ch.st===2)continue;const done=fracBody(ch,b,dt);if(!done)rest=false;if(ch.st===0)continue;
    for(let k=0;k<ch.v.length;k+=2){const P0=ch.v[k],j=ch.v[k+1],m=P0.m,arr=m.a.array,i=P0.I[j],l=k/2*3;_gv.set(ch.loc[l],ch.loc[l+1],ch.loc[l+2]).applyQuaternion(ch.q).add(ch.pos);
      arr[i*3]=_gv.x-m.ox;arr[i*3+1]=_gv.y-m.oy;arr[i*3+2]=_gv.z-m.oz;if(P0.N0){_gv.set(P0.N0[j*3],P0.N0[j*3+1],P0.N0[j*3+2]).applyQuaternion(ch.q);P0.na.array[i*3]=_gv.x;P0.na.array[i*3+1]=_gv.y;P0.na.array[i*3+2]=_gv.z;touched.add(P0.na);}
      const r=rng.get(m.a);if(r){r[0]=Math.min(r[0],P0.lo);r[1]=Math.max(r[1],P0.hi);}else rng.set(m.a,[P0.lo,P0.hi]);}}
  for(const na of touched)na.needsUpdate=true;
  // 手続きの瓦礫
  let pcm=false;for(const p of F.pc){if(p.st===2)continue;const done=fracBody(p,b,dt);if(!done)rest=false;if(p.st===0)continue;_fm.compose(p.pos,p.q,p.sz);FR.im.setMatrixAt(p.k,_fm);pcm=true;}if(pcm)FR.im.instanceMatrix.needsUpdate=true;
  // 落ちる部品（照明の頭など）と焦げ
  for(const t of b.att){const k=Math.min(1,u*u*1.15);_bp.set(t.wp.x,Math.max(t.fl+1,t.wp.y-(t.wp.y-t.fl)*k),t.wp.z);_bq.setFromAxisAngle(_bax.set(b.dz,0,-b.dx),.9*ease(sat(u)));_bq.multiply(t.wq);t.x.position.copy(t.x.parent.worldToLocal(_bp));t.x.quaternion.copy(t.pqi).multiply(_bq);}
  if(b.sc>=0)U.uScA.value[b.sc].w=sat(b.t*1.1);
  if(rest&&F.stDone&&b.t>2){b.done=true;for(const q of b.asm){q.c[4]=Math.max(q.c[1]+2,F.stumpAvg+2);}}}
function fracResetAll(){for(const b of BRK.list){if(!b.frac)continue;for(const P0 of b.parts)if(P0.N0){for(let j=0;j<P0.I.length;j++){const i=P0.I[j];P0.na.array[i*3]=P0.N0[j*3];P0.na.array[i*3+1]=P0.N0[j*3+1];P0.na.array[i*3+2]=P0.N0[j*3+2];}P0.na.needsUpdate=true;}}
  FR.n=0;FR.pile.clear();if(FR.im){FR.im.count=0;}}
function brkUpdate(dt){if(!BRK.list.length)return;const rng=new Map();
  for(const b of BRK.list){if(b.done)continue;if(b.frac){fracUpdate(b,dt,rng);continue;}b.u=Math.min(1,b.u+dt/b.dur);const u=b.u;
    for(const P0 of b.parts){const m=P0.m,arr=m.a.array;for(let j=0;j<P0.I.length;j++){const i=P0.I[j];brkPos(b,P0.O[j*3]+m.ox,P0.O[j*3+1]+m.oy,P0.O[j*3+2]+m.oz,u,_bp);arr[i*3]=_bp.x-m.ox;arr[i*3+1]=_bp.y-m.oy;arr[i*3+2]=_bp.z-m.oz;}
      const r=rng.get(m.a);if(r){r[0]=Math.min(r[0],P0.lo);r[1]=Math.max(r[1],P0.hi);}else rng.set(m.a,[P0.lo,P0.hi]);}
    // 回る部品：塔と一緒に倒れる。ほかは傾きながら地面へ落ちる
    for(const t of b.att){if(b.kind===1){brkPos(b,t.wp.x,t.wp.y,t.wp.z,u,_bp);_bq.setFromAxisAngle(_bax.set(b.dz,0,-b.dx),1.48*Math.min(1,u*u));}
      else{const k=Math.min(1,u*u*1.15);_bp.set(t.wp.x,Math.max(t.fl+1,t.wp.y-(t.wp.y-t.fl)*k),t.wp.z);_bq.setFromAxisAngle(_bax.set(b.dz,0,-b.dx),.9*ease(sat(u)));}
      _bq.multiply(t.wq);t.x.position.copy(t.x.parent.worldToLocal(_bp));t.x.quaternion.copy(t.pqi).multiply(_bq);}
    if(b.sc>=0)U.uScA.value[b.sc].w=sat(u*1.6);
    // 倒れた塔が地面を打つ
    if(b.kind===1&&!b.hit&&u>.97){b.hit=true;const c=b.c,h=b.y1-c[1];explode(new V3((c[0]+c[3])/2+b.dx*h*.8,c[1]+2,(c[2]+c[5])/2+b.dz*h*.8),.7,'dust');G.shake=Math.max(G.shake,.4*sat(1-camera.position.distanceTo(_bp)/1500));}
    if(u>=1){b.done=true;for(const q of b.asm){const c=q.c;c[4]=b.kind===1||b.kind===4?c[1]+2:c[1]+(q.y1-c[1])*(b.kind===2?.5:.32);}}}
  for(const[a,r]of rng){a.updateRange.offset=r[0]*3;a.updateRange.count=(r[1]-r[0]+1)*3;a.needsUpdate=true;}}
function brkReset(){fracResetAll();for(let k=BRK.list.length-1;k>=0;k--){const b=BRK.list[k];for(const P0 of b.parts){const arr=P0.m.a.array;for(let j=0;j<P0.I.length;j++){const i=P0.I[j];arr[i*3]=P0.O[j*3];arr[i*3+1]=P0.O[j*3+1];arr[i*3+2]=P0.O[j*3+2];}P0.m.a.updateRange.offset=0;P0.m.a.updateRange.count=-1;P0.m.a.needsUpdate=true;}
    if(b.c[10])b.c[10].userData.dead=false;
    for(const q of b.asm)q.c[4]=q.y1;for(const h of b.hide){h.x.visible=h.v;h.x.userData.brkDead=false;}for(const t of b.att){t.x.position.copy(t.p0);t.x.quaternion.copy(t.q0);t.x.userData.brkDead=false;}}
  BRK.list.length=0;BRK.sc=0;U.uScN.value=0;BRK.claim.clear();if(G.hgDead){G.hgDead=false;hangarLight(1);}}
function updateCommon(dt){
  {const ip=G.mode==='play'||G.mode==='explore';if(ip!==G.inplayCls){G.inplayCls=ip;document.body.classList.toggle('inplay',ip);if(!ip){input.tx=input.ty=0;input.tAct=input.tBoost=input.tGun=input.tMsl=false;}}}
  updateExplosion(dt);
  // 稲光の減衰
  G.flash*=Math.exp(-dt*5.5);U.uFlashI.value=opts.calm?G.flash*.4:G.flash*(.55+.45*Math.sin(G.t*63)*Math.sin(G.t*41));   /* 光を抑える設定では明滅（ちらつき）をやめ、明るさも下げる */
  G.scr*=Math.exp(-dt*7);G.white=Math.max(0,G.white-dt*1.1);G.hurt*=Math.exp(-dt*1.6);G.shake*=Math.exp(-dt*2.2);
  updateStrikes(dt);ambientLightning(dt);updateRadio(dt);updateArmor(dt);
  if(bannerT>0){bannerT-=dt;if(bannerT<=0)$('banner').classList.remove('on');}
  // 環境
  const cp=camera.position,cs=stormAt(cp.x,cp.y,cp.z);
  {const want=U.uStorm.value>.5&&cs.r<EYE_R*U.uEye.value+1200?1:0,es=damp(G.eyeSun||0,want,cs.r<EYE_R*U.uEye.value?.6:1.2,dt);if(Math.abs(es-(G.eyeSun||0))>1e-4||want!==(G.eyeSun>.5?1:0)){G.eyeSun=es;U.uSunDir.value.copy(SUN_BASE).lerp(SUN_EYE,es).normalize();}}
  G.gloom=damp(G.gloom,cp.y<cs.top+300?cs.c:cs.c*.2,1.5,dt);
  G.rain=damp(G.rain,cp.y<lerp(900,500,cs.wall)+200?cs.rain:(cp.y<cs.top?cs.rain*.5:0),1.5,dt);
  cloudMat.uniforms.uGloom.value=G.gloom;cloudMat.uniforms.uHaze.value=lerp(.00004,.00013,G.gloom);
  const fu=finalMat.uniforms;fu.uGloomF.value=G.gloom*(1-(G.indoor||0));fu.uGoldF.value=G.gold;G.lensWet=(G.lensWet||0)*Math.exp(-dt*.22);G.wash=(G.wash||0)*Math.exp(-dt*1.4);fu.uLens.value=Math.max(damp(fu.uLens.value,G.mode==='play'&&!(G.indoor>0)?sat(G.rain*1.2-.15):0,G.mode==='play'?1.5:8,dt),G.lensWet*.95);fu.uWash.value=G.wash;   // 水を被ったあと：水滴はしばらく残り、水の膜はすぐ流れ落ちる   // レンズの雨粒はプレイ中の追尾カメラだけ（格納庫やカットの寄りでは、粒が明るいエンジンを映して色の点に見える）
  {const cd=camera.position.distanceTo(P.pos),want=G.mode==='cut'&&cd<95?1:0;fu.uDof.value=damp(fu.uDof.value,want,4,dt);fu.uFocus.value=cd;
    compMat.uniforms.uAO.value=fu.uDof.value;const pj=1/Math.tan(camera.fov*Math.PI/360);compMat.uniforms.uProj.value.set(pj*.5/camera.aspect,pj*.5);
    // 排気の陽炎：ノズルの後ろ 2 点を画面に投影し、その間をゆらめかせる
    const inG=G.mode==='play'||G.mode==='cut';fwdOf(P.yaw,P.pitch,tA);tB.copy(P.pos).addScaledVector(tA,-11);tB.y+=1.2;tC.copy(P.pos).addScaledVector(tA,-30);tC.y+=1.2;
    const dA=camera.position.distanceTo(tB);tB.project(camera);tC.project(camera);
    if(inG&&P.power>=.28&&tB.z<1&&tC.z<1&&dA<400){fu.uHeat.value.set(tB.x*.5+.5,tB.y*.5+.5,tC.x*.5+.5,tC.y*.5+.5);fu.uHeatR.value=3.4*pj*.5/dA;fu.uHeatD.value=dA;fu.uHeatAmt.value=sat(.35+P.power*.6);}else fu.uHeatAmt.value=0;}
  fu.uRain.value=Math.min(1.6,G.rain*1.6);fu.uRainAng.value=.32+P.roll*.5;fu.uExp.value=lerp(.64,.60,G.gloom)*lerp(1,1.12,G.gold)*(1+.5*(G.indoor||0));
  fu.uScr.value=G.scr*(opts.calm?.3:1);fu.uHurt.value=G.hurt+(P.hull<=30&&G.mode==='play'?.18+.1*Math.sin(G.t*5):0);{const wv=fu.uWhite.value;fu.uWhite.value=opts.calm&&G.white>wv?Math.min(G.white,wv+(G.dt||.016)*.9):G.white;}   /* 光を抑える設定：白い閃光は急に立ち上げず、ゆっくり明るくする（場面転換の白いフェードはそのまま） */
  {const wet=smooth(.15,.7,G.rain)*(1-(G.indoor||0));if(Math.abs(wet-(G.wet||0))>.01||G.wet===undefined){G.wet=wet;for(const m of WETM){m.roughness=lerp(m.userData.r0,m.userData.r0*.4,wet);m.color.copy(m.userData.c0).multiplyScalar(1-.2*wet);}}}
  {const inR=(G.mode==='play'&&G.phase==='ret')||(G.mode==='cut'&&CUT&&CUT.def===CUT_LAND)||G.mode==='result';const d=Math.hypot(P.pos.x-BASE.x,P.pos.z-BASE.z);applyDusk(inR&&U.uStorm.value<.2?.85*(1-smooth(2500,15000,d)):0);}
  const vis=sunVisAt(P.pos),sd=U.uSunDir.value,scol=U.uSunCol.value;
  // 海面に落ちる自機の影（低空ほど濃くくっきり、高いほど淡くぼやける。島の上は地面が影を受けるので出さない）
  {const inG=G.mode==='play'||G.mode==='cut'||G.mode==='dying';[P,W[0],W[1]].forEach((o,i)=>{const S=U.uPSh.value[i],h=o.pos.y-3.5;let k=0;
    if(inG&&o.mesh&&o.mesh.visible&&o.state!=='gone'&&sd.y>.12&&h>-1){const t=h/sd.y,sx=o.pos.x-sd.x*t,sz=o.pos.z-sd.z*t;k=vis*(1-smooth(8,140,h))*(1-.75*(G.gloom||0))*.62;if(islandH(sx-BASE.x,sz-BASE.z)>-1.5)k=0;S.set(sx,sz,o.yaw,k);U.uPSh2.value[i].set(.35+h*.045,Math.max(.25,Math.abs(Math.cos(o.roll||0))));}else S.w=0;});}
  {let sc=EX.on?EX.pos:P.pos;if(EX.on){// 影の範囲を影の画素の格子にそろえて動かす（輪郭が泳がない）
      const cam=sunL.shadow.camera,t=(cam.right-cam.left)/sunL.shadow.mapSize.x,u=_shU.crossVectors(sd,_shY).normalize(),v=_shV.crossVectors(u,sd).normalize(),a=sc.dot(u),b=sc.dot(v);
      sc=_shC.copy(sc).addScaledVector(u,Math.round(a/t)*t-a).addScaledVector(v,Math.round(b/t)*t-b);}
    sunL.position.copy(sc).addScaledVector(sd,300);sunL.target.position.copy(sc);}sunL.target.updateMatrixWorld();
  sunL.color.setRGB(scol.x/6,scol.y/6,scol.z/6);sunL.intensity=2.5*vis*(1-.45*(G.duskK||0));
  {const c=baseGroup.userData.cones,o=G.doorO===undefined?1:G.doorO,day=1-sat((G.gloom||0)*.9);c.spillM.opacity=.2*o*day;c.hazeM.opacity=.05*o*day;
    [P,W[0],W[1]].forEach((a,i)=>{const b=c.blobs[i],lx=a.pos.x-BASE.x,lz=a.pos.z-BASE.z-HANGAR_Z,inH=Math.abs(lx)<46&&Math.abs(lz)<88&&a.pos.y<RWY_Y+9&&a.mesh.visible;b.visible=inH;if(inH){b.position.set(lx,.09,lz);b.rotation.y=a.yaw;}});}
  finalMat.uniforms.uIndoorF.value=G.indoor||0;
  const ind=G.indoor||0;hemiL.intensity=(lerp(.8,.2,G.gloom)*(1-.6*(G.duskK||0))+G.flash*2.5)*(1-.82*ind);hemiL.groundColor&&hemiL.groundColor.setRGB(.11-.06*(G.duskK||0),.16-.08*(G.duskK||0),.21-.08*(G.duskK||0));hemiL.color.setRGB(.62+G.gold*.3,.74,.95-G.gold*.3);
  ENVMATS.forEach(m=>{if(m.envMapIntensity!==1.8)m.envMapIntensity=(.25+.75*vis)*(1-.8*ind)*(1-.45*(G.duskK||0));});
  spoutMat.uniforms.uLight.value=lerp(1.6,.8,G.gloom);
  // 海をカメラに追従
  ocean.material.uniforms.uSnap.value.set(cp.x,cp.z);
  // 竜巻・コア
  spouts.forEach(s=>{s.a+=dt*s.w;s.mesh.position.set(Math.cos(s.a)*s.r,0,Math.sin(s.a)*s.r);s.mesh.rotation.y-=dt*1.3;const k=sat(U.uStorm.value*2-.6);s.mesh.scale.set(k,k,k);if(k<=0)s.mesh.visible=false;});
  if(coreShell.visible){const d=camera.position.distanceTo(CORE),s=clamp(d*.07,34,460);coreShell.position.copy(CORE);coreShell.scale.setScalar(s);coreShell.quaternion.copy(camera.quaternion);coreShell.userData.inner.rotation.z+=dt*(G.lock>0?2.4:.5);
    const lk=G.lock>=1,pu=.75+.25*Math.sin(G.t*(lk?16:3));coreShell.traverse(o=>{if(o.isMesh){o.material.uniforms.uAlpha.value=pu;o.material.uniforms.uColor.value.set(lk?3.4:2.4,lk?.5:1.5,lk?.3:.5);}});}
  if(boomFx.visible){boomFx.userData.t+=dt;const u=boomFx.userData.t/1.4,s=boomFx.userData.t>=1.05&&G.mode!=='cut'?14*(1.5-u):80+u*520;boomFx.scale.set(s,s,1);boomFx.quaternion.copy(camera.quaternion);boomFx.material.uniforms.uAlpha.value=Math.max(0,1-u)*2;if(u>=1)boomFx.visible=false;}
  updateSeaLife(dt);strUpdate(dt);animCrew(dt);animFlags();updateScud();updateSat();updateRefl();
  if(strikeGlow&&strikeGlow.visible){const g=strikeGlow;g.userData.t+=dt;const u=g.userData.t/.45,s=260+u*520;g.scale.set(s,s*.5,1);g.quaternion.copy(camera.quaternion);g.material.uniforms.uAlpha.value=Math.max(0,1-u)*(0.6+0.4*Math.sin(G.t*90));if(u>=1)g.visible=false;}
  rings.forEach((r,i)=>{if(r.visible)r.rotation.z+=dt*.6;});
  gateRings.forEach(r=>{if(r.visible)r.material.uniforms.uAlpha.value=.7+.3*Math.sin(G.t*4);});
  animAircraft(P.mesh,G.t,P.power,0);if(G.mode==='cut')[P,...W].forEach(o=>{o.mesh.userData.strobe.visible=false;});
  // 音
  const inGame=G.mode==='play'||G.mode==='cut'||G.mode==='dying';
  sfxAmbient(dt,inGame&&G.mode!=='cut'?G.rain:0,G.mode==='play'?(P.turb||0):0,G.mode==='play'?(P.g||1):1,inGame?sat(1-P.pos.y/180):0,inGame?P.speed:0);
  {const bd=Math.hypot(camera.position.x-BASE.x,camera.position.z-BASE.z);baseGroup.userData.trees.visible=bd<14000;baseGroup.userData.palms.forEach(p=>{p.visible=bd<7000;});baseGroup.userData.avenue.forEach(p=>{p.visible=bd<6000;});baseGroup.userData.hangar.visible=bd<6000;baseGroup.userData.lod.visible=bd<8000;baseGroup.userData.lodLH.visible=bd<8000;baseGroup.userData.detail.visible=bd<9000&&!(G.indoor>.6);}
  baseGroup.userData.spin.forEach(o=>{if(!o.userData.brkDead)o.rotation[o.userData.ax]+=dt*o.userData.sp;});
  {let best=null,bd=1e9;W.forEach((w,i)=>{if(w.state==='gone')return;const d=camera.position.distanceTo(w.pos);if(d<bd){bd=d;best=i;}});
    if(best!==null&&inGame){const w=W[best];{const sw=spatial(w,spW[best]);if(G.mode!=='cut')sw.dop=clamp(sw.dop,.9,1.1);setWingVoice(G.mode==='dying'?0:w.state==='stall'?.08:(G.mode==='cut'?(w.power===undefined?.8:w.power):.8),sw);}}else setWingVoice(0,{prox:0,pan:0,dop:1,muf:1});}
  // 地上では排気が床の埃を吹き飛ばす
  if(inGame&&P.mesh.userData.gear.visible&&P.power>.3&&Math.random()<.5){fwdOf(P.yaw,0,tA);for(const s of[-1,1])puff(P.pos.x+tA.z*s*2.55-tA.x*(14+Math.random()*10),P.pos.y-2.8,P.pos.z-tA.x*s*2.55-tA.z*(14+Math.random()*10),-tA.x*(20+P.power*40),2+Math.random()*5,-tA.z*(20+P.power*40),2+Math.random()*2.5,.7+Math.random()*.5,.22);}
  if(P.elight){const ud=P.mesh.userData;P.elight.intensity=P.mesh.visible?((P.power>=.28?P.power*P.power*1.1:0)+(ud.ign||0)*5)*(.85+.15*Math.sin(G.t*41))*(G.indoor>0?1.6:.6):0;P.mesh.updateMatrixWorld();P.elight.position.set(0,1.2,14).applyMatrix4(P.mesh.matrixWorld);}
  // 自機のエンジン：追尾カメラは機体と一緒に動くので、プレイ中・墜落中はドップラーをほぼ掛けない（きりもみでカメラが回り込むと、唸りの音程が速く上下してキュルキュル鳴っていた）。墜落中は止まっていく
  const spE=inGame?spatial(P,spP):null;if(spE&&G.mode!=='cut')spE.dop=clamp(spE.dop,.97,1.03);
  const dieK=G.mode==='dying'?(G.crash?0:Math.max(0,1-G.dieT/1.2)):1;
  setLoops(inGame?sat(P.power*.9+.2)*(P.power<.2?P.power*5:1)*dieK:0,inGame&&(P.boosting||P.power>1.2)?1:0,inGame?sat(P.wind/55*.7+G.gloom*.3+(P.turb||0)*.2):G.mode==='title'?.25:0,inGame?G.rain:0,spE);
}
let last=0,fpsAcc=0,fpsN=0;
// 設定画面の機体の見せ方を終える（一時停止中に開いた場合は、元の視点へ戻す）
function endOptPrev(){if(!G.optPrev)return;const air=G.optPrev==='air';G.optPrev=false;G.orb=null;cloudReset=true;if(camera.view&&camera.view.enabled)camera.clearViewOffset();
  if(air){document.body.classList.remove('optair');if(G.mode==='pause')$('pause').hidden=false;}
  if(air&&G.pcam){camera.position.copy(G.pcam.p);camera.quaternion.copy(G.pcam.q);camera.fov=G.pcam.f;camera.updateProjectionMatrix();G.pcam=null;}else G.indoor=0;}
function pausePreview(dt){G.pt=(G.pt||0)+dt;const W=innerWidth,H=innerHeight,pr=document.querySelector('#opts .panel').getBoundingClientRect(),free=W-pr.width-12,ox=pr.left>W*.4?Math.round((W-free)/2):0;
  if(ox){if(!camera.view||!camera.view.enabled||camera.view.offsetX!==ox||camera.view.fullWidth!==W)camera.setViewOffset(W,H,ox,0,W,H);}else if(camera.view&&camera.view.enabled)camera.clearViewOffset();
  const o=G.orb,az=o?o.az:G.pt*.2+.9+P.yaw,el=o?o.el:.16,r=o?Math.max(14,o.r):34,ce=Math.cos(el);
  setCam(P.pos.x+Math.sin(az)*ce*r,P.pos.y+1+Math.sin(el)*r,P.pos.z+Math.cos(az)*ce*r,P.pos.x,P.pos.y+.6,P.pos.z,40);}
function step(dt){
  G.dt=dt;
  if(G.mode==='pause'){if(G.optPrev==='air')pausePreview(dt);renderFrame();return;}
  G.t+=dt;U.uTime.value+=dt;U.uSpin.value+=dt*.01;
  readInput();
  if(G.mode==='play'){G.missionT+=dt;updatePlayer(dt);updateWing(dt);updatePhase(dt);updateIntercept(dt);updateArmed(dt);if(G.mode==='play'){chaseCam(dt);updateHUD(dt);}}
  else if(G.mode==='cut')updateCut(dt);
  else if(G.mode==='dying'){updateDying(dt);updateWing(dt);updateIntercept(dt);}
  else if(G.mode==='explore')exploreUpdate(dt);
  if(G.mode!=='play'&&G.armed)$('lockBox').style.display='none';
  else if(G.mode==='title'||G.mode==='result'||G.mode==='over'){
    // 結果画面：パネルの左の空いた所に機体が来るように画面をずらす（空きが狭いときはずらさない）
    if(G.mode==='result'){const pr=$('resPlate').getBoundingClientRect(),W=innerWidth,H=innerHeight,free=pr.left,ox=free>W*.2?Math.round(W/2-free/2):0;if(ox?!camera.view||!camera.view.enabled||camera.view.offsetX!==ox||camera.view.fullWidth!==W||camera.view.fullHeight!==H:camera.view&&camera.view.enabled){if(ox)camera.setViewOffset(W,H,ox,0,W,H);else camera.clearViewOffset();}}
    else {const on=G.mode==='title'&&G.optPrev;if(on){const pr=document.querySelector('#opts .panel').getBoundingClientRect(),W=innerWidth,H=innerHeight,free=W-pr.width-12;
        const ox=pr.left>W*.4?Math.round((W-free)/2):0;if(ox?!camera.view||!camera.view.enabled||camera.view.offsetX!==ox||camera.view.fullWidth!==W||camera.view.fullHeight!==H:camera.view&&camera.view.enabled){if(ox)camera.setViewOffset(W,H,ox,0,W,H);else camera.clearViewOffset();}}
      else if(camera.view&&camera.view.enabled)camera.clearViewOffset();}
    if(G.mode==='title'&&G.optPrev&&G.insp){const q=G.insp,ce=Math.cos(q.el),tx=P.pos.x+(q.tx||0),ty=P.pos.y+(q.ty||0),tz=P.pos.z+(q.tz||0);G.indoor=q.indoor||0;setCam(tx+Math.sin(q.az)*ce*q.r,ty+Math.sin(q.el)*q.r,tz+Math.cos(q.az)*ce*q.r,tx,ty,tz,q.fov||30);}
    else if(G.mode==='title'&&G.optPrev&&G.orb){// ドラッグで回した視点（格納庫の床・天井・壁を突き抜けない範囲）
      const o=G.orb,ce=Math.cos(o.el),cx=Math.sin(o.az)*ce*o.r,cz=Math.cos(o.az)*ce*o.r,l=Math.hypot(cx,cz)||1,k=0;G.indoor=.5;
      setCam(P.pos.x+cx,P.pos.y+.6+Math.sin(o.el)*o.r,P.pos.z+2+cz,P.pos.x+cz/l*k,P.pos.y+.6,P.pos.z+2-cx/l*k,40);}
    else if(G.mode==='title'&&G.optPrev){const a=G.t*.2+.9,cx=Math.sin(a)*30,cz=Math.cos(a)*42,l=Math.hypot(cx,cz),k=0;G.indoor=.5;setCam(P.pos.x+cx,P.pos.y+5.5+Math.sin(a*.5)*4,P.pos.z+2+cz,P.pos.x+cz/l*k,P.pos.y+.6,P.pos.z+2-cx/l*k,40);}
    else if(G.mode==='title'){const a=G.t*.02+.6;G.indoor=0;setCam(Math.sin(a)*17000,33000,Math.cos(a)*17000+3000,0,0,-800,48);}
    else if(G.mode==='result'){const a=G.t*.045+2.2,r=72+8*Math.sin(G.t*.07);G.indoor=0;setCam(P.pos.x+Math.sin(a)*r,P.pos.y+3.2+1.6*Math.sin(G.t*.11),P.pos.z+Math.cos(a)*r,P.pos.x,P.pos.y+1.4,P.pos.z,30);}   // 低い位置から、夕日の中の機体をゆっくり回り込む
  }
  if(window.__PCAM)window.__PCAM(camera,dt);
  updateCommon(dt);
  {let dmin=camera.position.distanceTo(P.pos);for(const w of W)if(w.mesh.visible)dmin=Math.min(dmin,camera.position.distanceTo(w.pos));
    // カットで寄って撮る物（ディフューザー・受け渡しの予備弾・迎撃機）も、手前で切れないよう含める
    if(proj&&proj.g.visible)dmin=Math.min(dmin,camera.position.distanceTo(proj.g.position));if(HAND.pod&&HAND.pod.visible)dmin=Math.min(dmin,camera.position.distanceTo(HAND.pod.position));for(const f of ICP.f)if(f.mesh.visible)dmin=Math.min(dmin,camera.position.distanceTo(f.pos));
    const bx=camera.position.x-BASE.x,bz=camera.position.z-BASE.z,gnd=Math.abs(bx)<2400&&Math.abs(bz)<2700?Math.max(islandH(bx,bz),0):0,alt=camera.position.y-gnd;
    let nr=G.mode==='explore'?.8:(G.indoor>0||G.mode==='title'||G.mode==='boot')?1.5:Math.max(1.5,Math.min(20,dmin-19,alt*.45));if(nr>2&&Math.abs(bx)<2400&&Math.abs(bz)<2700&&camera.position.y<200){const c0=camera.position;let db=1e9;for(const c of baseGroup.userData.colliders){const dx=Math.max(c[0]-c0.x,0,c0.x-c[3]),dy=Math.max(c[1]-c0.y,0,c0.y-c[4]),dz=Math.max(c[2]-c0.z,0,c0.z-c[5]),d=dx*dx+dy*dy+dz*dz;if(d<db)db=d;}const hx=Math.max(Math.abs(bx)-53,0),hzz=Math.max(Math.abs(bz-HANGAR_Z)-92,0);db=Math.min(Math.sqrt(db),Math.hypot(hx,hzz));nr=Math.max(1.5,Math.min(nr,db*.6));}
    if(Math.abs(camera.near-nr)>.2){camera.near=nr;camera.updateProjectionMatrix();}}
  if(window.__PCAM)window.__PCAM(camera,dt);   // 予告編の撮影用：カメラを差し替える
  renderFrame();
}
let lastInput=0,lastDraw=0;
function frame(now){
  requestAnimationFrame(frame);
  if(document.hidden){last=now;return;}
  // タイトル・一時停止・結果画面は 24fps、1 分放置したら 3fps まで落とす（裏で開きっぱなしでも PC を重くしない）
  const idle=G.mode==='title'||G.mode==='pause'||G.mode==='over'||G.mode==='result';
  if(idle){const asleep=now-lastInput>300000;if(asleep!==G.asleep){G.asleep=asleep;$('sleep').hidden=!asleep;}if(asleep){last=now;return;}if(now-lastDraw<32)return;}
  else if(G.asleep){G.asleep=false;$('sleep').hidden=true;}
  lastDraw=now;
  const dt=Math.min((now-last)/1000,idle?.07:.05);last=now;if(dt<=0)return;
  {const k=G.mode==='cut'?.4:1;for(const[m,c0]of CUTDIM)m.color.copy(c0).multiplyScalar(k);}
  try{step(dt);}catch(e){console.error(e);if(G.mode==='cut'){try{endCut();}catch(_){showTitle();}}}
  fpsAcc+=dt;fpsN++;
  if(G.mode==='title'){fpsAcc=0;fpsN=0;}   // タイトルの重い俯瞰で下がった解像度を本編へ持ち込まない
  if(G.mode==='play'&&G.fastAdapt>0)G.fastAdapt-=dt;
  if(fpsAcc>(G.fastAdapt>0?.5:1.5)){const fps=fpsN/fpsAcc;fpsAcc=0;fpsN=0;const dk=G.fastAdapt>0?Math.max(.6,Math.min(.85,fps/48)):.85;
    // 重いときは、まず雲の歩数を減らす（機体や景色の解像度は落とさない）。それでも重ければ解像度を下げる
    if(fps<36&&(view.cs||1)>.66&&G.mode!=='title'){view.cs=Math.max(.65,(view.cs||1)*dk);cloudSteps();view.upT=-4;perfSave();}
    else if(fps<36&&view.scale>(view.minScale||.6)+.001){view.scale=Math.max(view.minScale||.6,view.scale*dk);view.upT=-8;resize();renderFrame();perfSave();}
    // 解像度を最低まで下げてもまだ重いときは、雲の細かさと木・低木の本数を段階的に減らす（軽くなれば戻す）
    else if(fps<30&&view.scale<=(view.minScale||.6)+.01&&(view.tier||0)<2&&G.mode==='play'){view.tierT=0;setTier((view.tier||0)+1);}
    else if(fps>55&&view.tier>0&&view.scale>=.99){view.tierT=(view.tierT||0)+1;if(view.tierT>=4){view.tierT=0;setTier(view.tier-1);}}
    else if(fps>58&&view.scale<1){view.upT=(view.upT||0)+1;if(view.upT>=3){view.upT=0;view.scale=Math.min(1,view.scale*1.1);resize();renderFrame();}}
    else if(fps>58&&(view.cs||1)<1){view.upT=(view.upT||0)+1;if(view.upT>=3){view.upT=0;view.cs=Math.min(1,(view.cs||1)*1.1);cloudSteps();}}
    else{view.upT=0;view.tierT=0;}
    if(G.mode==='play')perfSave();}
}

// ───────────────────────── 起動 ─────────────────────────
// 聞き手（カメラ）から見た機体の近さ・左右・遠ざかる速さ
function spatial(o,st){const d=camera.position.distanceTo(o.pos);tA.set(1,0,0).applyQuaternion(camera.quaternion);tB.copy(o.pos).sub(camera.position);
  const pan=clamp(tB.dot(tA)/(d+8)*1.5,-1,1),vr=st.d===undefined||Math.abs(d-st.d)>140?0:(d-st.d)/Math.max(G.dt||.016,1e-3);st.d=d;st.vr=damp(st.vr||0,vr,9,G.dt||.016);
  return{prox:clamp(Math.pow(48/Math.max(d,7),.9),.04,3.6),pan,dop:clamp(1-st.vr/343,.72,1.38),muf:clamp(100/Math.max(d,20),.3,1.2)};}
const spP={},spW=[{},{}];
let strikeGlow=null;
const _shU=new V3(),_shV=new V3(),_shY=new V3(0,1,0),_shC=new V3();
let sprayTrail,puffs=[],sprays=[],ships=[],dpods=[],tether;const qT=new THREE.Quaternion();
// しぶきの絵柄：中心の霧に、大小の水滴をまだらに散らす。白く、日の当たる側は明るい
// タイヤ痕：接地点から後ろへ伸びる黒いゴムの跡（滑走路に残る）
const TM=[];function tireMarks(x,z,yaw){if(!TM.length){const c=document.createElement('canvas');c.width=16;c.height=128;const q=c.getContext('2d');for(let i=0;i<128;i++){const a=(.45+.5*Math.random())*Math.min(1,i/10)*Math.min(1,(128-i)/60);q.fillStyle='rgba(8,7,7,'+a+')';q.fillRect(1+Math.random()*2,i,12-Math.random()*3,1);}
    const tx=new THREE.CanvasTexture(c);for(let i=0;i<8;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(.7,1),new THREE.MeshBasicMaterial({map:tx,transparent:true,opacity:.95,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,color:0xffffff}));m.rotation.order='YXZ';m.visible=false;scene.add(m);TM.push(m);}}
  TM.k=(TM.k||0);const fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw);
  for(const sd of[-1,1])for(let j=0;j<2;j++){const m=TM[TM.k++%TM.length],L=14+Math.random()*10,off=sd*(2.55+(j-.5)*.35),bk=j*3+Math.random()*3;m.scale.set(1,L,1);m.position.set(x+rx*off-fx*(bk+L/2),RWY_Y+.06,z+rz*off-fz*(bk+L/2));m.rotation.set(-Math.PI/2,yaw,0);m.visible=true;}}
const _spV=new V3(),_spQ=new THREE.Quaternion();
function sprayMat(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),r=mulberry(909);
  for(let i=0;i<18;i++){const a=r()*6.283,d=Math.pow(r(),.8)*30,px=64+Math.cos(a)*d,py=64+Math.sin(a)*d,rr=10+r()*20,g=x.createRadialGradient(px,py,0,px,py,rr);g.addColorStop(0,'rgba(255,255,255,'+(.05+r()*.07)+')');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(px-rr,py-rr,rr*2,rr*2);}
  for(let i=0;i<700;i++){const a=r()*6.283,d=Math.pow(r(),.55)*58,px=64+Math.cos(a)*d,py=64+Math.sin(a)*d,rr=.4+r()*r()*2.4;x.fillStyle='rgba(255,255,255,'+(.35+r()*.5)*(1-d/64)+')';x.beginPath();x.arc(px,py,rr,0,7);x.fill();}
  const t=new THREE.CanvasTexture(c);
  return new THREE.ShaderMaterial({uniforms:{map:{value:t},uAlpha:{value:0},uSun:U.uSunCol,tDepth:U.tDepth,uRes:U.uRes},transparent:true,depthTest:false,depthWrite:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform sampler2D map,tDepth;uniform float uAlpha;uniform vec3 uSun;uniform vec2 uRes;varying vec2 vUv;void main(){float d=texture2D(tDepth,gl_FragCoord.xy/uRes).x;if(gl_FragCoord.z>d)discard;float a=texture2D(map,vUv).a*uAlpha*0.75;vec3 c=vec3(0.78,0.82,0.86)+uSun*0.05;gl_FragColor=vec4(c,clamp(a,0.0,1.0));}'});}
function initSeaLife(){
  sprayTrail=makeTrail();sprayTrail.mesh.material.uniforms.uColor.value.set(1.0,1.06,1.12);
  for(let i=0;i<90;i++)puffs.push({m:makeBillboard(new V3(.95,1.0,1.06)),life:0,max:1,vel:new V3(),s:1});
  const spm=sprayMat();
  for(let i=0;i<200;i++){const m=new THREE.Mesh(quad1(),spm.clone());m.material.uniforms.map=spm.uniforms.map;m.material.uniforms.uSun=U.uSunCol;m.material.uniforms.tDepth=U.tDepth;m.material.uniforms.uRes=U.uRes;m.frustumCulled=false;m.visible=false;overlay.add(m);sprays.push({m,life:0,max:1,vel:new V3(),s:1,spray:1});}
  for(const[k,x,z,h,sp]of[['cargo',-1100,BASE.z-3600,2.5,7],['fish',420,BASE.z-2300,.6,4],['cargo',1700,BASE.z-5400,-.4,7],['fish',-380,BASE.z-4700,3.6,4],['patrol',900,BASE.z-1900,1.9,11],['fish',260,BASE.z-6100,5.2,4]]){const m=buildShip(k);if(m.userData.radar)m.userData.radar.userData.dyn=1;mergeStatic(m);scene.add(m);overlay.add(m.userData.wake);overlay.add(m.userData.bow);ships.push({m,x,z,h,sp,ph:x});}
  // 港に止まっている船（貨物船・巡視船・漁船・作業船）：動かないが、撃てば航行中の船と同じように沈む
  {const L=baseGroup.userData.lodPort;L.updateMatrixWorld(true);for(const[k,lx,lz,ry]of L.userData.moored||[]){const m=buildShip(k);if(m.userData.radar)m.userData.radar.userData.dyn=1;mergeStatic(m);scene.add(m);
    overlay.add(m.userData.wake);overlay.add(m.userData.bow);m.userData.wake.visible=m.userData.bow.visible=false;if(m.userData.foam){m.userData.foam.rb.uniforms.uAlpha.value=0;m.userData.foam.sw.uniforms.uAlpha.value=0;}
    const wp=L.localToWorld(new V3(lx,0,lz));ships.push({m,x:wp.x,z:wp.z,h:ry,sp:0,ph:lx*.37,moored:true,rope:(L.userData.ropes||{})[k]});}}
  for(const[x,z]of[[-55,BASE.z-3350],[70,BASE.z-4600],[35,BASE.z-1750]]){const pod={x,z,z0:z,d:[]};for(let i=0;i<5;i++){const m=buildDolphin();m.visible=false;scene.add(m);pod.d.push({m,ox:(i-2)*4.5+((i*7)%3),oz:(i%2)*6+i*2.2,ph:i*.37+x*.01,was:false});}dpods.push(pod);}
  const tg=new THREE.CylinderGeometry(.2,.2,1,6);tg.rotateX(Math.PI/2);tether=new THREE.Mesh(tg,glowMat(new V3(.5,2.6,3.6),0));tether.visible=false;tether.frustumCulled=false;overlay.add(tether);
}
// ── 機銃で撃てる船と施設（武装モード）
const STR={init:false,cols:[],burn:[],smoke:[],fire:[],said:{}},_sq=new V3();
function strInit(){STR.init=true;
  STR.cols.push({c:[BASE.x-58,RWY_Y-1,BASE.z+HANGAR_Z-97,BASE.x+58,RWY_Y+44,BASE.z+HANGAR_Z+97,0,0,2],hp:56,dead:false});   // 屋根のはみ出しまで含める（3 頂点とも箱の中の三角形だけ崩すため）   // 格納庫（当たり判定は別扱いなので足す）
  for(const c of baseGroup.userData.colliders)STR.cols.push({c,hp:Math.max(8,Math.min(56,Math.round((c[3]-c[0])*(c[5]-c[2])/90))),dead:false});
  const dm={blendSrc:THREE.ZeroFactor,blendDst:THREE.OneMinusSrcColorFactor};   // 黒煙は背景を暗くする合成
  for(let i=0;i<70;i++){const m=new THREE.Mesh(quad1(),glowMat(new V3(.5,.5,.52),3,dm));m.frustumCulled=false;m.visible=false;overlay.add(m);STR.smoke.push({m,life:0,max:1,vel:new V3(),s:1});}
  for(let i=0;i<16;i++)STR.fire.push(makeFlame());}
function strReset(){brkReset();boomReset();if(!STR.init)return;STR.cols.forEach(o=>{o.dead=false;o.pend=0;if(o.c[7])return;o.hp=Math.max(8,Math.min(56,Math.round((o.c[3]-o.c[0])*(o.c[5]-o.c[2])/90)));});STR.burn.length=0;STR.said={};
  STR.smoke.forEach(p=>{p.life=0;p.m.visible=false;});STR.fire.forEach(m=>m.visible=false);
  for(const s of ships){if(s.x0===undefined){s.x0=s.x;s.z0=s.z;s.sp0=s.sp;}s.dead=false;s.hp=undefined;s.x=s.x0;s.z=s.z0;s.sp=s.sp0;s.m.visible=true;s.m.userData.wake.visible=s.m.userData.bow.visible=!s.moored;if(s.rope)s.rope.visible=true;}contReset();vegReset();fireReset();}
const strSay=(k,who,t)=>{if(STR.said[k])return;STR.said[k]=1;say(who,t);};
// 弾の線分 a→p が船・施設・地面に当たったら true
// 施設が壊れる
function strKill(o){const c=o.c;o.dead=true;if(G.stats)G.stats.wreck=(G.stats.wreck||0)+1;const kd=c[8]||0,wd=Math.max(c[3]-c[0],c[5]-c[2]);_sq.set((c[0]+c[3])/2,kd===1?c[1]+4:c[4]+2,(c[2]+c[5])/2);/* 中心は屋根の上（建物の中だと壁に隠れて火球が見えない） */
  explode(_sq.clone(),kd===3?1:kd===1?.45:Math.min(1,.45+wd/70),['bldg','tower','shed','tank','bldg','shed'][kd]);if(kd===5)contBreak(o);else brkStart(o);
  if(kd===3){// 燃料タンク：火球が何段も上へ噴き上がり（約 100m）、爆風で隣のタンクへ誘爆する。そのあとは大きな池の火として長く燃え続ける
    const cx=_sq.x,cz=_sq.z,top=c[4];[[.22,25,.85],[.55,48,.75],[.95,72,.65],[1.5,98,.5]].forEach(([t,h,k2])=>BOOM.q.push({t,fn:()=>explode(new V3(cx+brn(-5,5),top+h,cz+brn(-5,5)),k2,'air')}));
    strBlast(new V3(cx,c[1]+5,cz),45,80,o);STR.burn.push({x:cx,y:c[1]+(c[4]-c[1])*.25,z:cz,r:Math.min(32,(c[3]-c[0])*.65+4),t:0,max:600,tank:true,fu:brn(8,14)});}
  else if(kd!==1)STR.burn.push({x:_sq.x,y:c[1]+(c[4]-c[1])*(kd===2?.45:.3),z:_sq.z,r:Math.min(14,(c[3]-c[0])/4+3),t:0,max:90});
  vegIgnite(_sq.x,_sq.z,Math.min(30,wd*.5+8));   // 燃える建物のまわりの木にも火が移る
  strSay('baseK','C','施設の損壊を確認……すべて記録しています');}
function strShipDmg(s,dmg){const L=s.m.userData.len;if(s.hp===undefined)s.hp=L>100?70:L>50?28:10;s.hp-=dmg;if(s.hp<=0&&!s.dead)strSink(s);}
// 爆風：まわりの施設・船にも距離に応じた損傷（直撃したものは除く）
function strBlast(q,R,dmg,skip){if(!STR.init)strInit();
  for(const o of STR.cols){if(o===skip||o.dead||o.c[7])continue;const c=o.c,dx=Math.max(c[0]-q.x,0,q.x-c[3]),dy=Math.max(c[1]-q.y,0,q.y-c[4]),dz=Math.max(c[2]-q.z,0,q.z-c[5]),d=Math.hypot(dx,dy,dz);
    if(d<R){o.hp-=dmg*(1-d/R);if(o.hp<=0){o.hitP=q.clone();if(c[8]===3){if(!o.pend){o.pend=1;BOOM.q.push({t:brn(.6,1.6),fn:()=>{if(!o.dead)strKill(o);}});}}else strKill(o);}}}   // タンクは少し遅れて次々に誘爆
  for(const s of ships){if(s===skip||s.dead)continue;const L=s.m.userData.len,d=Math.max(0,Math.hypot(q.x-s.x,q.z-s.z)-L*.4);if(d<R&&q.y<40)strShipDmg(s,dmg*(1-d/R));}}
// 弾の線分 a→p が船・施設・木・地面に当たったら true。dmg が大きい（ミサイル・激突）ときは爆風と火災も起こす
function strHit(t,a,st,dmg){dmg=dmg||1;
  if(!STR.init)strInit();const p=t.pos,big=dmg>=20;
  for(let k=0;k<2;k++){const q=k?p:_sq.copy(a).addScaledVector(t.dir,st*.5);
    for(const s of ships){if(s.dead)continue;const L=s.m.userData.len,B=s.m.userData.beam,dx=q.x-s.x,dz=q.z-s.z;if(Math.abs(dx)>L||Math.abs(dz)>L)continue;
      const c=Math.cos(s.h),sn=Math.sin(s.h),lx=dx*c-dz*sn,lz=dx*sn+dz*c,top=L>100?30:L>50?15:7;
      if(Math.abs(lx)<B/2+1&&Math.abs(lz)<L/2+1&&q.y<top){
        puff(q.x,q.y,q.z,0,3,0,1.6,.5,.9);if(Math.random()<.5&&q.distanceTo(camera.position)<500)SFX.ting(true);
        {const pt=s.m.userData.kind==='patrol';strSay(pt?'patrol':'ship','C',pt?'自国の巡視船を撃っています！　射撃を中止してください':'民間船への発砲を確認。ただちに射撃を中止してください');}
        strShipDmg(s,dmg);if(big)strBlast(q.clone(),24,dmg*.6,s);return true;}}
    const lx=q.x-BASE.x,lz=q.z-BASE.z;
    if(Math.abs(lx)<2700&&Math.abs(lz)<3100&&q.y<900){   // 丘の上の施設まで届くように（以前は高さ 260m まで）
      for(const o of STR.cols){const c=o.c;if(q.x>c[0]-1&&q.x<c[3]+1&&q.z>c[2]-1&&q.z<c[5]+1&&q.y>c[1]-1&&q.y<c[4]+1){
        puff(q.x,q.y,q.z,0,2,0,1.6,.5,.9);if(Math.random()<.5&&q.distanceTo(camera.position)<500)SFX.ting();
        if(!o.dead&&!c[7]){o.hp-=dmg;strSay('base','G',lx>1050?'おい、港を撃つな！　何やってる！':'おい！　そこは味方の基地だぞ！');if(o.hp<=0){o.hitP=q.clone();strKill(o);}}
        if(big){const h=q.clone();strBlast(h,24,dmg*.6,o);vegIgnite(h.x,h.z,16);}
        return true;}}
      const gy=Math.max(islandH(lx,lz),3.5);
      if(vegHit(q)){puff(q.x,q.y,q.z,0,3,0,1.8,.6,.8);if(big){const h=q.clone();strBlast(h,24,dmg*.6);vegIgnite(h.x,h.z,18);}return true;}   // 木に当たる
      if(q.y<gy){puff(q.x,gy,q.z,0,5,0,1.4,.6,.8);if(big){const h=new V3(q.x,gy,q.z);strBlast(h,24,dmg*.6);vegIgnite(h.x,h.z,16);}return true;}}
    else if(q.y<3.5){puff(q.x,3.6,q.z,0,7,0,1.3,.6);if(Math.random()<.25&&q.distanceTo(camera.position)<400)SFX.plip();return true;}}
  return false;
}
function strSink(s){s.dead=true;if(s.rope)s.rope.visible=false;   /* 係留索は切れる */if(G.stats)G.stats.sunk=(G.stats.sunk||0)+1;s.sinkT=0;const L=s.m.userData.len,dk=L>100?31:L>50?9:4;_sq.set(s.x,dk,s.z);explode(_sq.clone(),L>100?1:L>50?.7:.45,'ship');
  // 船体に沿って誘爆が続く（大きい船ほど多く、長く）
  {const n=L>100?5:L>50?3:1;for(let i=0;i<n;i++){const t=.5+i*(L>100?.85:.7)+Math.random()*.4,f=(Math.random()-.5)*L*.8;BOOM.q.push({t,fn:()=>{if(!s.dead)return;explode(new V3(s.x-Math.sin(s.h)*f,dk+Math.random()*4-s.sinkT*(L>100?.35:.7),s.z-Math.cos(s.h)*f),(L>100?.6:.4)*(.7+Math.random()*.5),'ship');}});}}STR.burn.push({ship:s,x:s.x,y:6,z:s.z,r:Math.min(14,L/8+3),t:0,max:L>100?80:45});
  strSay('sink','G',L>100?'貨物船が……沈んでいく。乗組員は無事なのか':'……船が沈んだ。何をしてるんだ、隊長');}
const _fv=new V3();
function exhaust(x,y,z,s){if(!STR.init)strInit();const p=STR.smoke.find(q=>q.life<=0);if(!p)return;p.life=p.max=7+Math.random()*3;p.s=3.4+Math.random();p.a=.9;
  p.m.position.set(x+(Math.random()-.5)*2,y,z+(Math.random()-.5)*2);p.vel.set(3.5+Math.sin(s.h)*s.sp*.4,4+Math.random()*2,Math.cos(s.h)*s.sp*.4);p.m.visible=true;}
function strUpdate(dt){
  if(!STR.init)return;let fi=0;
  for(let i=STR.burn.length-1;i>=0;i--){const b=STR.burn[i];b.t+=dt;if(b.ship){const s=b.ship;b.x=s.x;b.z=s.z;b.y=Math.max(1,6+s.m.position.y);}
    const k=sat(1-(b.t-b.max+15)/15);if(k<=0){STR.burn.splice(i,1);continue;}
    b.k=k;if(b.tank&&k>.5){b.fu-=dt;if(b.fu<=0){b.fu=brn(10,22);explode(new V3(b.x+brn(-4,4),b.y+b.r*.7,b.z+brn(-4,4)),.35,'air');}}}   // 炎・煙・火の粉は fireUpdate がまとめて描く。タンクはときどき炎が噴き上がる
  for(;fi<STR.fire.length;fi++)STR.fire[fi].visible=false;
  for(const p of STR.smoke){if(p.life<=0)continue;p.life-=dt;if(p.life<=0){p.m.visible=false;continue;}const k=p.life/p.max;p.vel.multiplyScalar(Math.exp(-dt*.3));p.m.position.addScaledVector(p.vel,dt);
    const s=p.s*(1+(1-k)*5);p.m.scale.set(s,s,1);p.m.quaternion.copy(camera.quaternion);p.m.material.uniforms.uAlpha.value=Math.min((1-k)*(p.a<1?14:5),1)*k*.85*(p.a||1);}
}
function puff(x,y,z,vx,vy,vz,s,life,a,pool){const p=(pool||puffs).find(q=>q.life<=0);if(!p)return;p.a=a||1;p.life=p.max=life;p.m.position.set(x,y,z);p.vel.set(vx,vy,vz);p.s=s;p.m.visible=true;}
// ── 港の動き：岸壁クレーンの荷役、RTG の走行、トレーラーの周回
function animPort(dt){const B=baseGroup.userData.lodPort;if(!B)return;if(camera.position.distanceTo(_fv.set(BASE.x+1250,0,BASE.z+150))>4000)return;const t=G.t;
  for(const c of B.userData.cranes||[]){if(c.userData.dead)continue;const a=c.userData.anim,T=(t*.035+a.ph)%1;
    // 1 周：船の上で降ろす→巻き上げ→陸側へ→降ろす→巻き上げ→船へ戻る
    const seg=[[0,0,30],[.12,0,21],[.2,0,21],[.3,0,31],[.48,-30,31],[.58,-30,4.5],[.66,-30,4.5],[.76,-30,31],[1,0,31]];let i=0;while(i<seg.length-2&&T>seg[i+1][0])i++;
    const s0=seg[i],s1=seg[i+1],u=ease(sat((T-s0[0])/(s1[0]-s0[0])));a.tro.position.x=lerp(s0[1],s1[1],u);const sy=lerp(s0[2],s1[2],u);a.sp.position.y=sy;a.bx.visible=T>.2&&T<.62;
    for(const r of a.r){const top=35,bot=sy+.4;r.scale.y=top-bot;r.position.y=(top+bot)/2;}}
  for(const g of B.userData.rtgs||[])g.position.z=g.userData.z0+Math.sin(t*.05+g.userData.z0)*14;
  // 港と基地を結ぶ道の車：端で折り返し、左側の車線を走る
  {const path=B.userData.roadPath;if(path)for(const c of B.userData.roadCars||[]){if(c.userData.pushed)continue;const L=path[path.length-1].d;let s=c.userData.s+dt*13*c.userData.dir;if(s>L-8){s=L-8;c.userData.dir=-1;}if(s<8){s=8;c.userData.dir=1;}c.userData.s=s;
    let i=0,j=path.length-1;while(j-i>1){const m=(i+j)>>1;if(path[m].d<s)i=m;else j=m;}const a=path[i],b=path[j],u=(s-a.d)/Math.max(.01,b.d-a.d),dir=c.userData.dir,tx=lerp(a.tx,b.tx,u)*dir,tz=lerp(a.tz,b.tz,u)*dir;
    c.position.set(lerp(a.x,b.x,u)+tz*2,lerp(a.y,b.y,u),lerp(a.z,b.z,u)-tx*2);c.rotation.y=Math.atan2(-tx,-tz);}}
  for(const tr of B.userData.trucks||[]){tr.userData.s=(tr.userData.s+dt*7)%1244;const d=tr.userData.s;let x,z,yaw;
    if(d<580){x=1276;z=-140+d;yaw=Math.PI;}else if(d<622){x=1276-(d-580);z=440;yaw=-Math.PI/2;}else if(d<1202){x=1234;z=440-(d-622);yaw=0;}else{x=1234+(d-1202);z=-140;yaw=Math.PI/2;}
    tr.position.set(x,4.65,z);let dy=yaw-tr.rotation.y;while(dy>Math.PI)dy-=6.2832;while(dy<-Math.PI)dy+=6.2832;tr.rotation.y+=dy*Math.min(1,dt*3);}}
// ── カモメ：港と船のまわりを旋回し、ときどき羽ばたく
const GULLS=[];
function initGulls(){const wm=new THREE.MeshStandardMaterial({color:0xe8eae8,roughness:.8,side:THREE.DoubleSide}),tip=new THREE.MeshStandardMaterial({color:0x2a2c2e,roughness:.8,side:THREE.DoubleSide});
  const wing=new THREE.Shape();wing.moveTo(0,0);wing.lineTo(.95,.18);wing.lineTo(.8,-.12);wing.lineTo(0,-.22);const wg=new THREE.ShapeGeometry(wing);wg.rotateX(Math.PI/2);
  for(let i=0;i<16;i++){const g=new THREE.Group();const b=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),wm);b.scale.set(1,1,2.6);g.add(b);const wl=[];
    for(const s of[-1,1]){const p=new THREE.Group();const w=new THREE.Mesh(wg,wm);w.scale.set(s,1,1);p.add(w);const tp=new THREE.Mesh(new THREE.BoxGeometry(.2,.01,.12),tip);tp.position.set(s*.85,0,0);p.add(tp);p.position.x=s*.08;g.add(p);wl.push(p);}
    g.scale.setScalar(2.2);scene.add(g);const port=i<10;GULLS.push({g,wl,cx:port?BASE.x+1200+Math.random()*250:0,cz:port?BASE.z+Math.random()*400-50:0,ship:port?null:ships[i%2?0:2],R:30+Math.random()*80,h:14+Math.random()*40,a:Math.random()*6.3,w:(.25+Math.random()*.2)*(Math.random()<.5?-1:1),ph:Math.random()*10});}}
function animGulls(dt){if(!GULLS.length)initGulls();const t=G.t;for(const q of GULLS){let cx=q.cx,cz=q.cz;if(q.ship&&q.ship.dead&&!q.ship.m.visible){q.g.visible=false;continue;}/* 沈んだ船のカモメは去る */if(q.ship){cx=q.ship.x+Math.sin(q.ship.h)*40;cz=q.ship.z+Math.cos(q.ship.h)*40;}
    if(camera.position.distanceTo(_fv.set(cx,q.h,cz))>2500){q.g.visible=false;continue;}q.g.visible=true;
    q.a+=q.w*dt;const x=cx+Math.cos(q.a)*q.R,z=cz+Math.sin(q.a)*q.R,y=q.h+Math.sin(t*.4+q.ph)*4;q.g.position.set(x,y,z);q.g.rotation.set(0,Math.atan2(Math.sin(q.a)*q.w,-Math.cos(q.a)*q.w),-q.w*1.1,'YXZ');
    const flap=(Math.sin(t*.5+q.ph)>.3)?Math.sin(t*11+q.ph)*.65:.12;q.wl[0].rotation.z=-flap;q.wl[1].rotation.z=flap;}}
function updateSeaLife(dt){
  animPort(dt);animGulls(dt);
  // 船
  for(const s of ships){
    // スクリュー：航行中は速さに応じて回す（係留中は止める）。撃沈されてもそのときの回転のまま回り続ける。2 軸は左右で逆回り
    {const pp=s.m.userData.props;if(pp){if(!s.dead)s.propW=s.moored?0:2.5+s.sp*.9;const w=(s.propW||0)*dt;for(let i=0;i<pp.length;i++)pp[i].rotation.z+=i%2?-w:w;}}
    if(s.dead){s.sinkT+=dt;s.sp=Math.max(0,s.sp-dt*1.5);const L=s.m.userData.len,dp=Math.min(s.sinkT*(L>100?.35:.7),L*.45);
      s.x-=Math.sin(s.h)*s.sp*dt;s.z-=Math.cos(s.h)*s.sp*dt;s.m.position.set(s.x,-dp,s.z);{const kd=s.m.userData.kind,t=s.sinkT;   // 貨物船は船首を上げて船尾から、漁船は転覆、巡視船は大きく傾いて沈む
        if(kd==='fish')s.m.rotation.set(Math.min(t*.05,.2),s.h,Math.min(t*.75,2.7),'YXZ');else if(kd==='patrol')s.m.rotation.set(-Math.min(t*.035,.42),s.h,Math.min(t*.09,.75),'YXZ');else s.m.rotation.set(-Math.min(t*.016,.34),s.h,Math.min(t*.01,.14),'YXZ');}
      const w=s.m.userData.wake;w.material.uniforms.uAlpha.value=.8*sat(s.sp/4);s.m.userData.bow.visible=false;{const fo=s.m.userData.foam;if(fo){fo.rb.uniforms.uAlpha.value=.3*sat(s.sp/4);fo.sw.uniforms.uAlpha.value=0;}}if(dp>=L*.45)s.m.visible=false;continue;}
    s.x-=Math.sin(s.h)*s.sp*dt;s.z-=Math.cos(s.h)*s.sp*dt;const L=s.m.userData.len;
    if(s.m.userData.radar)s.m.userData.radar.rotation.y+=dt*2;const bw=s.m.userData.bow;bw.position.set(s.x,.8,s.z);bw.rotation.y=s.h;bw.children.forEach(c=>c.material.uniforms.uAlpha.value=.7);
    if(s.moored){bw.visible=false;s.m.position.set(s.x,Math.sin(G.t*.4+s.ph)*.12,s.z);s.m.rotation.set(0,s.h,Math.sin(G.t*.5+s.ph)*.006,'YXZ');continue;}
    s.horn=(s.horn||0)-dt;if(L>60&&s.horn<=0&&G.mode==='play'&&Math.hypot(P.pos.x-s.x,P.pos.z-s.z)<700&&P.pos.y<500){s.horn=40;SFX.horn();}
    s.m.position.set(s.x,Math.sin(G.t*.5+s.ph)*.4,s.z);s.m.rotation.set(Math.sin(G.t*.4+s.ph)*.012,s.h,Math.sin(G.t*.6+s.ph)*.02,'YXZ');
    const w=s.m.userData.wake;w.position.set(s.x+Math.sin(s.h)*L*2.0,.7,s.z+Math.cos(s.h)*L*2.0);w.rotation.set(-Math.PI/2,s.h,0,'YXZ');w.material.uniforms.uAlpha.value=.6;w.material.uniforms.uSp.value=-s.sp;
    bw.children.forEach(c=>c.material.uniforms.uSp.value=-s.sp);
    {const fo=s.m.userData.foam;if(fo){const k=sat(s.sp/7);fo.rb.uniforms.uAlpha.value=.35+.6*k;fo.rb.uniforms.uSp.value=s.sp;fo.sw.uniforms.uAlpha.value=.8*k;fo.sw.uniforms.uSp.value=s.sp*.8;}}
    // 煙突の排気（近くにいるときだけ）
    if(s.m.userData.funnel&&camera.position.distanceTo(s.m.position)<2600){s.smk=(s.smk||0)-dt;if(s.smk<=0){s.smk=.3;_fv.copy(s.m.userData.funnel).applyMatrix4(s.m.matrixWorld);exhaust(_fv.x,_fv.y,_fv.z,s);}}}
  // イルカの群れ
  for(const pod of dpods){pod.z-=6*dt;if(pod.z<pod.z0-900)pod.z=pod.z0;const near=Math.hypot(P.pos.x-pod.x,P.pos.z-pod.z)<3000||Math.hypot(camera.position.x-pod.x,camera.position.z-pod.z)<3000;
    for(const d of pod.d){const T=3.6,ph=((G.t+d.ph*T)%T)/T,air=near&&ph<.34,u=ph/.34,x=pod.x+d.ox,z=pod.z+d.oz-(air?u*9:0);
      d.m.visible=air;if(air){d.m.position.set(x,Math.sin(u*Math.PI)*3.0-.5,z);d.m.rotation.set(Math.cos(u*Math.PI)*1.0,0,0,'YXZ');if(u>.9&&!d.spl){d.spl=1;puff(x,3.6,z-1,0,5,0,3,.8);}}
      if(air&&!d.was)puff(x,3.6,z,0,6,-3,2.8,.8);if(!air)d.spl=0;d.was=air;}}
  // 海面すれすれの飛沫
  const flying=G.mode==='play'||G.mode==='dying'||G.mode==='cut';
  let sp=flying&&islandH(P.pos.x-BASE.x,P.pos.z-BASE.z)<-3?sat(1.15-(P.pos.y-6)/16)*sat(P.speed/110):0;G.spray=sp;
  fwdOf(P.yaw,0,tA);tB.set(P.pos.x-tA.x*12,4.5,P.pos.z-tA.z*12);tC.set(tA.z,0,-tA.x);
  {const wob=Math.sin(G.t*7.3)*1.6+Math.sin(G.t*17.1)*.9;tB.addScaledVector(tC,wob);pushTrail(sprayTrail,tB,tC,sp*.3*(.6+.4*Math.sin(G.t*11.7)),dt,(5+sp*6)*(.75+.5*Math.abs(Math.sin(G.t*5.1))));tB.addScaledVector(tC,-wob);}
  if(sp>.05){
    const sv=P.speed*(P.boosting?1.15:1);G.spR=(G.spR||0)-dt;
    if(G.spR<=0){G.spR=.016;
      // 雄鶏の尾：尾翼の後ろから後ろ上へ噴き上がり、重力で弧を描いて落ちる
      for(let k=0;k<1+(sp>.5?1:0);k++){const r=(Math.random()-.5)*5;puff(P.pos.x-tA.x*(14+Math.random()*6)+tC.x*r,3.6,P.pos.z-tA.z*(14+Math.random()*6)+tC.z*r,tA.x*sv*.55+tC.x*r*2,(22+Math.random()*30)*sp,tA.z*sv*.55+tC.z*r*2,(1.0+Math.random()*1.3)*(.5+sp),.8+Math.random()*.6,1,sprays);}
      // V 字の幕：左右へ斜め後ろに広がる薄い水の壁
      for(const sd of[-1,1]){const off=6+Math.random()*10;puff(P.pos.x+tC.x*sd*off-tA.x*(4+Math.random()*10),3.6,P.pos.z+tC.z*sd*off-tA.z*(4+Math.random()*10),tA.x*sv*.75+tC.x*sd*(18+Math.random()*16),(9+Math.random()*14)*sp,tA.z*sv*.75+tC.z*sd*(18+Math.random()*16),(.8+Math.random()*1.0)*(.5+sp),.5+Math.random()*.4,1,sprays);}
      // 霧：ゆっくり漂って消える大きな淡い塊（重力の弱い粒）
      if(Math.random()<.35)puff(P.pos.x-tA.x*(18+Math.random()*25)+tC.x*(Math.random()-.5)*20,5+Math.random()*4,P.pos.z-tA.z*(18+Math.random()*25)+tC.z*(Math.random()-.5)*20,tA.x*sv*.25,4,tA.z*sv*.25,(3.5+Math.random()*3.5)*(.4+sp),2.0+Math.random()*1.2,.22,sprays);}
    G.spT=(G.spT||0)-dt;if(G.spT<=0){G.spT=.03+Math.random()*.05;const n=2+(Math.random()<sp?1:0)+(Math.random()<.4?1:0);
    for(let k=0;k<n;k++){const u=Math.random()*2-1,r=Math.sign(u)*Math.pow(Math.abs(u),.7)*17,ahead=-6+Math.random()*22,f=.8+Math.random()*.22,big=Math.random()<.12?1.5:1;
      puff(tB.x+tA.x*ahead+tC.x*r,3.6+Math.random()*1.5,tB.z+tA.z*ahead+tC.z*r,tA.x*P.speed*f+tC.x*(r*.6+(Math.random()-.5)*10),(12+Math.random()*26)*(.5+sp*.6)*big,tA.z*P.speed*f+tC.z*(r*.6+(Math.random()-.5)*10),(1.1+Math.random()*2.3)*(.5+sp)*big,.45+Math.random()*.75,1,sprays);}}}
  for(const p of puffs.concat(sprays)){if(p.life<=0)continue;p.life-=dt;if(p.life<=0){p.m.visible=false;continue;}const k=p.life/p.max;p.vel.y-=(p.a<.5?1.5:11)*dt;p.m.position.addScaledVector(p.vel,dt);if(p.m.position.y<3.5&&p.a===1)p.m.position.y=3.5;
    const s=p.s*(1+(1-k)*4.5);p.m.quaternion.copy(camera.quaternion);
    // しぶきの粒は飛ぶ向きに引き伸ばす（速いほど細長い水の筋に。霧の粒は丸いまま）
    if(p.spray&&p.a>=.5){_spV.copy(p.vel).applyQuaternion(_spQ.copy(camera.quaternion).invert());const vs=Math.hypot(_spV.x,_spV.y),st=1+Math.min(1.2,vs*.022);p.m.scale.set(s*st,s/Math.pow(st,.3),1);p.m.rotateZ(Math.atan2(_spV.y,_spV.x));}
    else{p.m.scale.set(s,s,1);p.m.rotateZ(p.rot||(p.rot=Math.random()*6.283));}
    p.m.material.uniforms.uAlpha.value=Math.min((1-k)*6,1)*k*.6*p.a;}
  {const u=baseGroup.userData;if(u.lhBeam){u.lhBeam.rotation.y=G.t*.5;u.lhBeamM.opacity=.22*sat((G.gloom||0)*.9+(G.gold||0)*.8);u.lhBeam.visible=u.lhBeamM.opacity>.01&&!u.lhBeam.userData.brkDead;}
    if(u.socks)u.socks.forEach((k,i)=>{k.rotation.z=Math.PI/2-.22+Math.sin(G.t*2.3+i)*.07;k.rotation.y=.5+Math.sin(G.t*.7+i*2)*.25;});}
  {const lh=baseGroup.userData.lhGlow;if(lh){const dk=sat((G.gloom||0)*.8+(G.gold||0)*.7),s=8+16*dk*(.8+.2*Math.sin(G.t*1.3));lh.scale.set(s,s,1);}}
  if(AU.spray)AU.spray.g.gain.setTargetAtTime(sp*.45,AU.ctx.currentTime,.08);
}

// 1 番機を、選ばれた塗装と形で作る（設定を変えたら作り直す）
function makePlayer(){
  const old=P.mesh;let gearOn=true,podOn=true;
  if(old){gearOn=old.userData.gear.visible;podOn=old.userData.pod.visible;if(P.armor)for(const a of P.armor){if(a.mesh.parent)a.mesh.parent.remove(a.mesh);}
    for(const m of old.userData.wetMats){const i=WETM.indexOf(m);if(i>=0)WETM.splice(i,1);}scene.remove(old);}
  const m=P.mesh=buildAircraft(0,'SR-01',opts.shape||0,SCHEMES[opts.color||0]);scene.add(m);
  if(!P.elight){P.elight=new THREE.PointLight(0xff9a52,0,70,1.8);scene.add(P.elight);}   // 機体には付けない（墜落で機体を隠すと光の数が変わり、全部の材質のシェーダが作り直しになって固まる）。位置は毎コマ機体に合わせる
  P.armor=addArmor(m);m.userData.gear=buildGear(m.userData.shape,m.userData.bodyHex);m.add(m.userData.gear);m.userData.gear.visible=gearOn;m.userData.pod.visible=podOn;
  m.traverse(o=>{if(o.isMesh&&o.material.isMeshStandardMaterial){o.castShadow=true;o.receiveShadow=true;}});
  m.userData.onIgn=()=>{if(G.mode==='cut')SFX.ignite();};G.wet=undefined;
  armMeshes();
  if(old){syncAC(P);if(G.mode==='title'){P.hull=100;resetArmor();}else shedArmor(true);}
}
let IS_TOUCH=false;
// 画面の大きさに合わせて、表示の縮尺を決める（高さ 620px 未満なら縮める）
function fitUI(){const h=innerHeight,w=innerWidth,ui=Math.max(.5,Math.min(1,h/620,w/860));document.documentElement.style.setProperty('--ui',ui.toFixed(3));document.body.classList.toggle('small',ui<.97);}
// タッチ端末向けに、案内文のキー名を画面のボタン名に置き換える
function tk(s){if(!IS_TOUCH)return s;return s.replace(/<kbd>A<\/kbd><kbd>D<\/kbd> 2 度押しロール/g,'左右へ 2 度すばやく倒してロール').replace(/<kbd>W<\/kbd><kbd>S<\/kbd> 機首の上げ下げ　<kbd>A<\/kbd><kbd>D<\/kbd> 旋回　<kbd>Shift<\/kbd> ブースト/,'画面の左側をなぞって操縦　<kbd>ブースト</kbd> で加速').replace(/<kbd>Space<\/kbd>/g,'<kbd>発射</kbd>').replace(/<kbd>Shift<\/kbd>/g,'<kbd>ブースト</kbd>').replace(/<kbd>F<\/kbd> 機銃/g,'<kbd>機銃</kbd>').replace(/<kbd>R<\/kbd> ミサイル/g,'<kbd>ミサイル</kbd>');}
// ───────────────────────── 武装モード（隠しコマンド） ─────────────────────────
const CHEAT=[];
function toast(t,s){const e=$('toast');e.textContent=t;e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),(s||2.4)*1000);}
function applyArmed(){document.body.classList.toggle('armed',!!G.armed);armMeshes();}
function toggleArmed(){G.armed=!G.armed;applyArmed();initAudio();
  if(G.armed){SFX.lockOn();setTimeout(()=>SFX.launch(),180);toast('武装モード：有効');}else{SFX.ui();toast('武装モード：無効');}}
// 翼下のミサイル（武装モードのときだけ、残弾ぶん見せる）
function armMeshes(){const m=P.mesh;if(!m)return;if(!m.userData.arm){const ud=m.userData,wh=new THREE.MeshStandardMaterial({color:lin(0xdfe3e6),roughness:.5,metalness:.3}),dk=new THREE.MeshStandardMaterial({color:lin(0x1c2024),roughness:.5});ENVMATS.push(wh,dk);ud.arm=[];
    for(const ax of[7.2,4.8])for(const s of[1,-1]){const q=ud.wingAt(ax),g2=new THREE.Group();g2.position.set(s*ax,q.y-.62,q.le+q.c*.42);const b=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,3.0,10),wh);b.rotation.x=Math.PI/2;g2.add(b);const nz=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),dk);nz.position.z=-1.5;g2.add(nz);
      for(const a of[Math.PI/4,-Math.PI/4]){const f=new THREE.Mesh(new THREE.BoxGeometry(.6,.02,.4),wh);f.rotation.z=a;f.position.z=1.25;g2.add(f);}const py=new THREE.Mesh(new THREE.BoxGeometry(.1,.4,1.4),dk);py.position.y=.32;g2.add(py);m.add(g2);ud.arm.push(g2);}}
  m.userData.arm.forEach((a,i)=>a.visible=!!G.armed&&i<(P.msl===undefined?4:P.msl));}
const PM=[];   // 自機のミサイル
function pmInit(){if(PM.length)return;for(let i=0;i<4;i++){const m=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,3.2,8).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({color:lin(0xdfe3e6),roughness:.5}));m.visible=false;m.frustumCulled=false;scene.add(m);
  const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(3,1.7,.6),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));gl.scale.set(8,8,1);gl.visible=false;scene.add(gl);PM.push({m,gl,pos:new V3(),dir:new V3(),life:0,smoke:0,tgt:null});}}
const _lp=new V3();
// 武装：ロックオン、ミサイル、機銃。迎撃機に撃たれた弾が当たれば撃墜できる
function updateArmed(dt){
  const wp=$('wpn');if(!G.armed){$('lockBox').style.display='none';return;}
  if(P.msl===undefined)P.msl=4;pmInit();if(!ICP.f.length)icpInit();
  const playing=G.mode==='play'&&!P.wingLost;fwdOf(P.yaw,P.pitch,tA);
  // ロックオン：機首から 28° 以内・3km 以内の迎撃機を 1.1 秒とらえ続ける
  let best=null,ba=1;if(playing)for(const f of ICP.f){if(!f.mesh.visible||f.dead)continue;tB.copy(f.pos).sub(P.pos);const dist=tB.length();if(dist>3000)continue;const a=Math.acos(clamp(tB.dot(tA)/dist,-1,1));if(a<.49&&a<ba){ba=a;best=f;}}
  if(best!==G.lockF){G.lockF=best;G.lockT=0;}else if(best){const was=G.lockT;G.lockT+=dt;if(was<1.1&&G.lockT>=1.1)SFX.lockOn();}
  const lb=$('lockBox');if(best){_lp.copy(best.pos).project(camera);if(_lp.z<1){lb.style.display='block';lb.style.left=((_lp.x*.5+.5)*view.cssW)+'px';lb.style.top=((-_lp.y*.5+.5)*view.cssH)+'px';lb.classList.toggle('ok',G.lockT>=1.1);}else lb.style.display='none';}else lb.style.display='none';
  // ミサイル発射
  // ロックしていなければ真っすぐ飛ばす（船や施設、地面に当たれば爆発する）
  if(playing&&input.mslHit){const lk=G.lockF&&G.lockT>=1.1;if(P.msl>0){const m=PM.find(q=>q.life<=0);if(m){P.msl--;armMeshes();m.pos.copy(P.pos).addScaledVector(tA,4);m.pos.y-=1.6;m.dir.copy(tA);m.life=8;m.tgt=lk?G.lockF:null;if(lk){m.tgt.evT=Math.max(m.tgt.evT||0,2.6);m.tgt.evDir=Math.random()<.5?-1:1;}m.m.visible=m.gl.visible=true;SFX.launch();
      if(lk&&Math.random()<.6)say(W[0].state!=='gone'?'G':'C',['FOX2！','ミサイル発射を確認','いけ…！'][Math.floor(Math.random()*3)],1.4);}}else SFX.warn();}
  for(const m of PM){if(m.life<=0)continue;m.life-=dt;const f=m.tgt;
    if(f&&!f.dead&&f.mesh.visible){const d0=f.pos.distanceTo(m.pos);tC.copy(f.pos).addScaledVector(f.vel,Math.min(.6,d0/460)*.8).sub(m.pos);const dist=tC.length();tC.normalize();const ang=Math.acos(clamp(m.dir.dot(tC),-1,1));
      // 近づくと迎撃機はフレアをまいて逃げることがある
      if(dist<420&&!m.flareChk){m.flareChk=1;if(Math.random()<.4){m.tgt=null;for(let k=0;k<10;k++)puff(f.pos.x,f.pos.y,f.pos.z,(Math.random()-.5)*40,-10-Math.random()*20,(Math.random()-.5)*40,2,1.4,1);say('C','フレア！　かわされた',1.4);}}
      if(m.tgt&&ang>1e-4)m.dir.lerp(tC,Math.min(1,1.8*dt/ang)).normalize();if(ang>1.4)m.tgt=null;}
    tB.copy(m.pos);m.pos.addScaledVector(m.dir,460*dt);if(m.tgt&&!m.tgt.dead&&segDist(tB,m.dir,460*dt,m.tgt.pos)<20){m.life=0;fighterHit(m.tgt,99);}
    else if(m.life<7.9&&strHit(m,tB,460*dt,45)){m.life=0;m.flareChk=0;m.m.visible=m.gl.visible=false;explode(m.pos.clone(),.55,'air');continue;}m.m.position.copy(m.pos);tD.copy(m.pos).add(m.dir);m.m.lookAt(tD);m.gl.position.copy(m.pos).addScaledVector(m.dir,-2.4);
    m.smoke-=dt;if(m.smoke<=0){m.smoke=.025;puff(m.pos.x-m.dir.x*3,m.pos.y-m.dir.y*3,m.pos.z-m.dir.z*3,0,1.5,0,2.2,1.5,.55);}
    if(m.life<=0||m.pos.y<4){m.life=0;m.flareChk=0;m.m.visible=m.gl.visible=false;explode(m.pos,.25);}}
  // 機銃：毎秒 14 発
  if(playing&&input.gun){G.gunT=(G.gunT||0)-dt;if(G.gunT<=0){G.gunT=1/14;tC.copy(P.pos).addScaledVector(tA,700);
    {let bt=null,bo=.1;for(const f of ICP.f){if(f.dead||!f.mesh.visible)continue;tB.copy(f.pos).sub(P.pos);const dd=tB.length();if(dd>1000)continue;const o=Math.acos(clamp(tB.dot(tA)/dd,-1,1));if(o<bo){bo=o;bt=f;}}
      if(bt){const tt=bt.pos.distanceTo(P.pos)/720;tC.copy(bt.pos).addScaledVector(bt.vel,tt);}
      else{let bs=null,bo2=.07;for(const q of ships){if(q.dead)continue;tB.set(q.x,q.m.userData.len>100?8:3,q.z).sub(P.pos);const dd=tB.length();if(dd>1000)continue;const o=Math.acos(clamp(tB.dot(tA)/dd,-1,1));if(o<bo2){bo2=o;bs=q;}}   // 船にも弱い照準補正
        if(bs){const tt=Math.hypot(bs.x-P.pos.x,bs.z-P.pos.z)/720;tC.set(bs.x-Math.sin(bs.h)*bs.sp*tt,bs.m.userData.len>100?8:3,bs.z-Math.cos(bs.h)*bs.sp*tt);}}}tD.copy(P.pos).addScaledVector(tA,8);tD.y+=.6;icpTracer(tD,tC,.006,'P');SFX.gun();G.shake=Math.max(G.shake,.06);}}
  wp.textContent='MSL '+'▮'.repeat(P.msl)+'▯'.repeat(Math.max(0,4-P.msl))+'　GUN'+(input.gun?' ●':'')+(G.lockF?(G.lockT>=1.1?'　LOCK':'　…'):'');
}
// 迎撃機が撃たれた
function fighterHit(f,dmg){if(f.dead)return;f.hp-=dmg;if(f.hp>0){if(Math.random()<.4)puff(f.pos.x,f.pos.y,f.pos.z,0,2,0,3,1,.8);return;}
  f.dead=true;f.downT=0;explode(f.pos,.6);G.stats.kills=(G.stats.kills||0)+1;
  say('F',['メーデー、メーデー！　被弾した、脱出する！','ぐっ…！　制御不能、脱出する！'][ICP.f.indexOf(f)%2],2.6);
  if(ICP.st>=1&&ICP.st<=3){ICP.st=4;ICP.t=0;ICP.misT=2;ICP.gunT=4;setAlarm(true);say('F','撃ってきたぞ！　全機、交戦せよ！',2.2);}
  if(ICP.f.every(q=>q.dead||!q.mesh.visible)){setAlarm(false);G.prompt=null;say('C','迎撃機、2 機とも撃墜を確認…。隊長、これは国際問題になりますよ',4);ICP.cleared=true;ICP.st=5;ICP.t=0;G.lockF=null;}}
function boot(){
  const steps=[
    ()=>{view.q=opts.q;resize(true);const N=IS_TOUCH?96:128;NOISE_JOB=noise3DAsync(N).then(d=>{U.tNoise.value=tex3D(d,N);});},   /* 雲の形の解像度（タッチ端末は読み込み時間を優先） */   /* 雲の形の解像度（タッチ端末は読み込み時間を優先） */
    ()=>{U.tDetail.value=makeDetail3D(32);},
    ()=>{buildGroundTex();},
    ()=>{U.tNoise2.value=makeNoise2D(256);GLOWTEX=glowTexture();buildEnv();buildOcean();},
    ()=>{sunL=new THREE.DirectionalLight(0xffffff,3);scene.add(sunL);scene.add(sunL.target);exKrLight();
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;sunL.castShadow=true;
      {const sh=sunL.shadow;sh.mapSize.set(2048,2048);sh.camera.left=sh.camera.bottom=-95;sh.camera.right=sh.camera.top=95;sh.camera.near=1;sh.camera.far=700;sh.bias=-0.0006;sh.normalBias=0.12;sh.camera.updateProjectionMatrix();}hemiL=new THREE.HemisphereLight(0xa8c4ee,0x1c2a36,1);scene.add(hemiL);
      const gear=buildGear;
      makePlayer();
      W.forEach((w,i)=>{w.mesh=buildAircraft(i?0x2f9e6b:0x2b6cc4,'SR-0'+(i+2));w.mesh.scale.setScalar(.92);w.mesh.userData.gear=gear();w.mesh.add(w.mesh.userData.gear);scene.add(w.mesh);});
      [P,...W].forEach(o=>o.mesh.traverse(m=>{if(m.isMesh&&m.material.isMeshStandardMaterial){m.castShadow=true;m.receiveShadow=true;}}));
      [P,...W].forEach(o=>{o.mesh.userData.onIgn=()=>{if(G.mode==='cut')SFX.ignite();};});},
    ()=>{buildBase();
      for(let i=0;i<12;i++){const m=buildSpout();scene.add(m);spouts.push({mesh:m,r:5200+((i*37)%5)*380,a:Math.PI/2+(i-2.5)*.15+((i*13)%3)*.025,w:.004+i*.0012});}
      for(let i=0;i<6;i++)bolts.push(makeBolt());for(let i=0;i<5;i++)columns.push(makeColumn());
      for(let i=0;i<5;i++){const r=makeRing(125,new V3(1.6,3.4,5),3.2),a=Math.PI/2-.55-i*1.2;r.position.set(Math.cos(a)*1450,[520,1050,1600,2150,2750][i],Math.sin(a)*1450);
        r.lookAt(r.position.x+Math.sin(a),r.position.y+.12,r.position.z-Math.cos(a));rings.push(r);}
      [[420,-4300],[250,-2900],[115,-1750]].forEach(([y,dz])=>{const r=makeRing(120,new V3(2.0,1.35,.45),2.2);r.position.set(0,y,BASE.z+dz);gateRings.push(r);});
      coreShell=new THREE.Group();{const mk=(geo,c)=>{const m=new THREE.Mesh(geo,glowMat(c,0));m.frustumCulled=false;coreShell.add(m);return m;};
        mk(new THREE.RingGeometry(.975,1,96),new V3(2.4,1.5,.5));const inner=new THREE.Group();coreShell.add(inner);coreShell.userData.inner=inner;
        for(let k=0;k<4;k++){const a=new THREE.Mesh(new THREE.RingGeometry(.66,.675,24,1,k*Math.PI/2+.25,Math.PI/2-.5),glowMat(new V3(2.4,1.5,.5),0));a.frustumCulled=false;inner.add(a);
          const t=mk(new THREE.PlaneGeometry(.012,.16),new V3(2.4,1.5,.5));t.position.set(Math.cos(k*Math.PI/2)*1.1,Math.sin(k*Math.PI/2)*1.1,0);t.rotation.z=k*Math.PI/2+Math.PI/2;}
        mk(new THREE.RingGeometry(.018,.03,16),new V3(3,1.8,.6));}
      coreShell.position.copy(CORE);coreShell.visible=false;overlay.add(coreShell);
      coreGlow=makeBillboard(new V3(0,0,0));coreGlow.material.uniforms.uAlpha.value=0;
      shock=new THREE.Mesh(new THREE.TorusGeometry(1,.012,6,120),glowMat(new V3(5,6,8),0));shock.rotation.x=Math.PI/2;shock.position.set(0,3000,0);shock.visible=false;shock.frustumCulled=false;overlay.add(shock);
      boomFx=makeBillboard(new V3(8,7,6));boomFx.userData.t=0;
      carrierRing=new THREE.Mesh(new THREE.RingGeometry(58,62,48),glowMat(new V3(.6,3,1.2),0));carrierRing.visible=false;carrierRing.frustumCulled=false;overlay.add(carrierRing);
      trails=[makeTrail(),makeTrail()];initSeaLife();strikeGlow=makeBillboard(new V3(9,10,15));strikeGlow.userData.t=0;
      const pg=new THREE.Group(),pd=buildDiffuser();pd.rotation.y=Math.PI;pg.add(pd);pg.visible=false;scene.add(pg);proj={g:pg,d:pd,glow:makeBillboard(new V3(.9,2.8,4.4)),trail:makeTrail(),from:new V3(),T:0};
            proj.trail.mesh.material.uniforms.uColor.value.set(.5,1.4,2.2);},
    ()=>NOISE_JOB,   /* 雲の形のノイズができるのを待つ（最初の描画より前に） */
    ()=>{rctx=$('radar').getContext('2d');hctx=$('fhud').getContext('2d');bindInput();showTitle();renderer.compile(scene,camera);step(.016);boomWarm();},
    ()=>{warmUp('sync');showTitle();step(.016);},   /* 任務で使う物をすべて先に描いておく（出撃カットを飛ばしても重くならない） */
  ];
  let i=0,NOISE_JOB=null;const BT=window.__bootT=[];const run=()=>{const _t=performance.now();let r;try{r=steps[i]();}catch(e){console.error(e);$('load').firstElementChild.textContent='起動に失敗しました：'+e.message;return;}
    if(r&&r.then&&!run.waited){run.waited=1;r.then(()=>{BT.push('wait'+Math.round(performance.now()-_t));run();},e=>{console.error(e);});return;}run.waited=0;
    BT.push(Math.round(performance.now()-_t));i++;$('loadBar').style.transform=`scaleX(${i/steps.length})`;
    if(i<steps.length)setTimeout(run,30);else{$('load').hidden=true;last=performance.now();requestAnimationFrame(frame);
      window.__SR={ramHit,ships,strHit,explode,BRK,BOOM,setTier,view,renderer,rings,gateRings,core:()=>coreShell,ICP,ships,STR,buildFighter,cloudMat,setCam,showTitle,damage,spouts,cloudCut:()=>{cloudReset=true;},setDoors,hangarLight,resize,opts,strikes,input,endCut:()=>{if(CUT)endCut();},G,P,W,U,step,camera,startRun,startCut,skipCut,curCut:()=>{if(!CUT)return "";for(const[k,v]of Object.entries({CUT_INTRO,CUT_FIRE1,CUT_HAND,CUT_FIRE2,CUT_LAND,CUT_ICP,CUT_KILL}))if(CUT===v||CUT.def===v)return k+":"+(CUT.i|0);return "other";},CUTS:{CUT_INTRO,CUT_FIRE1,CUT_FIRE2,CUT_LAND,CUT_ICP,CUT_KILL,CUT_HAND},togglePause,fail,view,tick(n,dt){for(let k=0;k<n;k++)step(dt||1/30);}};}};
  setTimeout(run,30);
}
boot();

// ───────────────────────── 状態 ─────────────────────────
const DIFFS=[
  {name:'訓練',desc:'落雷の予告が長く、機体も頑丈です。起こるトラブルは基本的なものだけです。',dmg:1,strk:1,warnT:2.1,rad:62,turb:1,wind:1,eyeT:95,heal:30,floor:75,spouts:6,stallT:30},
  {name:'実戦',desc:'受けるダメージと風が強くなり、着氷・計器故障・風向の急変・脚の油圧故障が起こります。',dmg:1.35,strk:.78,warnT:1.75,rad:72,turb:1.3,wind:1.2,eyeT:78,heal:20,floor:60,spouts:9,stallT:25},
  {name:'極限',desc:'さらに雹とエンジン火災が起こります。着陸では進入ゲートをすべて通過しなければなりません。',dmg:1.8,strk:.6,warnT:1.45,rad:84,turb:1.6,wind:1.4,eyeT:64,heal:10,floor:45,spouts:12,stallT:21}];
const DF=()=>DIFFS[opts.diff||0];
const opts=(()=>{let o={mus:70,sfx:80,inv:false,q:1,diff:0,color:0,shape:0};try{Object.assign(o,JSON.parse(localStorage.getItem('stormrider_opts')||'{}'));}catch(e){}return o;})();
const saveOpts=()=>{try{localStorage.setItem('stormrider_opts',JSON.stringify(opts));}catch(e){}};
const G={mode:'boot',phase:'',t:0,pt:0,missionT:0,retries:0,flags:{},flash:0,scr:0,hurt:0,shake:0,gust:0,down:0,gloom:0,rain:0,gold:0,
  target:null,targetLabel:'',lock:0,ringIdx:0,eyeT:0,dock:0,strikeT:4,ambT:1,ckpt:null,stats:{dmg:0,saved:null},fade:0,white:0,prompt:null,warnT:0,hintT:0,gate:0};
const P={pos:new V3(0,400,14400),vel:new V3(),yaw:0,pitch:0,roll:0,speed:150,hull:100,boost:100,inv:0,engineOut:false,restart:0,hasPod:true,power:1,mesh:null,camYaw:0,camPitch:0,fling:new V3(),spin:0,wind:0};
const W=[{who:'G',pos:new V3(),yaw:0,pitch:0,roll:0,state:'form',mesh:null,ph:1.3,side:-50,fw:24,up:3,ang:0},
         {who:'H',pos:new V3(),yaw:0,pitch:0,roll:0,state:'form',mesh:null,ph:4.1,side:46,fw:12,up:1,ang:0}];
const WHO={C:['ミズハ管制','#8fd4ff'],G:['2番機 ゴウ','#ffc57a'],H:['3番機 ハル','#a6f0b4'],S:['機体システム','#ff8a7a']};
const CORE=new V3(0,3400,0);
const input={x:0,y:0,boost:false,act:false,actHit:false,keys:{},tx:0,ty:0,tBoost:false,tAct:false};
let sunL,hemiL,trails=[],bolts=[],columns=[],rings=[],gateRings=[],spouts=[],coreShell,coreGlow,shock,boomFx,proj,carrierRing;
const strikes=[];
const tA=new V3(),tB=new V3(),tC=new V3(),tD=new V3();

// ───────────────────────── 環境（太陽・空） ─────────────────────────
const ENV_A={dir:new V3(-0.45,0.42,0.78).normalize(),sun:new V3(5.2,4.5,3.6),zen:new V3(0.045,0.115,0.30),hor:new V3(0.30,0.38,0.48)};
const ENV_B={dir:new V3(-0.20,0.20,0.95).normalize(),sun:new V3(7.8,4.7,2.4),zen:new V3(0.075,0.185,0.46),hor:new V3(0.60,0.60,0.68)};
function applyEnv(g){
  G.gold=g;U.uSunDir.value.copy(ENV_A.dir).lerp(ENV_B.dir,g).normalize();U.uSunCol.value.copy(ENV_A.sun).lerp(ENV_B.sun,g);
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
function syncAC(o){o.mesh.position.copy(o.pos);o.mesh.rotation.set(o.pitch,o.yaw,o.roll,'YXZ');}
function slotOf(w,out){
  const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw),rx=Math.cos(P.yaw),rz=-Math.sin(P.yaw);
  return out.set(P.pos.x+rx*w.side+fx*w.fw,P.pos.y+w.up,P.pos.z+rz*w.side+fz*w.fw);
}
function snapWing(){W.forEach(w=>{if(w.state==='gone')return;w.state='form';slotOf(w,w.pos);w.yaw=P.yaw;w.pitch=P.pitch;w.roll=0;w.mesh.visible=true;syncAC(w);});}
function gearOf(o,on){o.mesh.userData.gear.visible=on;}

// ───────────────────────── 雷 ─────────────────────────
function flashAt(x,y,z,I){U.uFlashPos.value.set(x,y,z);G.flash=Math.max(G.flash,I);const d=camera.position.distanceTo(U.uFlashPos.value);if(d<2200)G.scr=Math.max(G.scr,I*.35*(1-d/2200));}
function boltFromTo(a,b,w){let bo=bolts.find(q=>q.life<=0)||bolts[0];shapeBolt(bo,a,b,w||7);}
function strikeAt(x,z,danger){
  const top=rr(900,1700);tA.set(x+rr(-260,260),top,z+rr(-260,260));tB.set(x,0,z);boltFromTo(tA,tB,danger?9:7);
  flashAt(x,top*.6,z,danger?1.3:1);
  if(strikeGlow){strikeGlow.visible=true;strikeGlow.position.set(x,14,z);strikeGlow.userData.t=0;}
  const d=Math.hypot(camera.position.x-x,camera.position.z-z);SFX.thunder(d);
  if(danger&&G.mode==='play'){const pd=Math.hypot(P.pos.x-x,P.pos.z-z);
    if(pd<DF().rad){SFX.zap();damage(17,'落雷の直撃を受けた');hudFail(.8);}
    else if(pd<260){G.shake=Math.max(G.shake,.55);glitch();hudFail(.45);}}
}
function warnStrike(x,z){const c=columns.find(q=>!q.visible);if(!c)return;c.visible=true;c.position.set(x,1600,z);c.scale.set(DF().rad,3200,DF().rad);strikes.push({x,z,t:DF().warnT,t0:DF().warnT,col:c});SFX.warn();SFX.charge(Math.hypot(P.pos.x-x,P.pos.z-z));}
function updateStrikes(dt){
  for(let i=strikes.length-1;i>=0;i--){const s=strikes[i];s.t-=dt;
    s.col.material.uniforms.uAlpha.value=.55+.45*Math.sin(G.t*26);
    const k=1-s.t/s.t0;s.col.scale.x=s.col.scale.z=lerp(DF().rad*1.55,DF().rad,k);
    if(s.t<=0){s.col.visible=false;strikeAt(s.x,s.z,true);strikes.splice(i,1);}}
  bolts.forEach(b=>{if(b.life>0){b.life-=dt;b.mesh.material.uniforms.uAlpha.value=b.life>0?(.35+.65*Math.abs(Math.sin(b.life*70)))*sat(b.life/.12):0;if(b.life<=0)b.mesh.visible=false;}});
}
function ambientLightning(dt){
  if(U.uStorm.value<.3)return;
  G.ambT-=dt;if(G.ambT>0)return;
  const cx=camera.position.x,cz=camera.position.z;
  for(let k=0;k<6;k++){const a=rnd()*6.283,d=rr(1500,7500),x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d,s=stormAt(x,900,z);
    if(s.c>.55){const y=rr(900,2600);
      const cg=rnd()<.45;if(cg){tA.set(x,rr(700,1500),z);tB.set(x+rr(-300,300),0,z+rr(-300,300));boltFromTo(tA,tB,10+d*.0012);}
      flashAt(x,y,z,rr(.45,1));SFX.thunder(d*1.15,cg?'cg':'ic');break;}}
  G.ambT=rr(.4,2.0)/(0.35+G.gloom*1.4);
}
function glitch(){const h=$('hud');h.classList.remove('glitch');void h.offsetWidth;h.classList.add('glitch');}

// ───────────────────────── ダメージ ─────────────────────────
// 落雷で計器が落ちる（実戦以上）
function hudFail(p){if((opts.diff||0)<1||G.hudFail>0||Math.random()>p)return;G.hudFail=opts.diff>=2?10:6;if(!G.flags.hfSay){G.flags.hfSay=1;say('S','雷サージで計器が落ちた。復旧まで目視で飛べ');}}
// 損傷の出どころを数えておき、最後の文言に使う
function srcOf(c){return/落雷/.test(c)?'落雷':/竜巻/.test(c)?'海上竜巻':/雹/.test(c)?'雹':/火災/.test(c)?'エンジン火災':/海面/.test(c)?'海面との衝突':/建物|施設|灯台|格納庫/.test(c)?'建物との衝突':/滑走路|地面|山肌/.test(c)?'地面との衝突':'';}
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
  P.hull=Math.max(0,P.hull-n);P.inv=1.3;G.hurt=1;G.shake=1;G.stats.dmg+=n;SFX.hit();glitch();shedArmor(false);
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
function hitTest(){
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
function crashExplode(why){
  if(G.mode!=='play')return;P.inv=0;P.hull=Math.min(P.hull,1);damage(999,why);if(G.mode!=='dying')return;
  G.crash=1;G.dieT=0;P.speed=0;P.mesh.visible=false;explode(P.pos,1);
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
  if(hit&&!hit.wing){crashExplode('主翼を失い、'+hit.why);return;}
  if(P.pos.y<gy){P.pos.y=gy;crashExplode(P.wlWhat+'に主翼をぶつけて失い、'+(land?'地面に激突した':'海面に突っ込んだ'));}
}
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
  let pT=iy*.56*(P.ice?.6:1)+n2*tau*.035;
  const ceil=CEIL[G.phase]||3000;
  if(P.pos.y>ceil-200){pT=Math.min(pT,-(P.pos.y-(ceil-200))/200*.4);if(!G.flags.ceilWarn&&P.pos.y>ceil-60){G.flags.ceilWarn=1;say('S',G.phase==='eye'||G.phase==='spare'?'これ以上は上昇できない':'雲中は着氷の危険。高度を下げろ');}}
  if(P.pos.y<30&&G.down<.1)pT=Math.max(pT,(30-P.pos.y)/30*.34);
  P.pitch=damp(P.pitch,pT,2.6,dt);
  fwdOf(P.yaw,P.pitch,tA);
  P.wind=windAt(P.pos,tB);
  P.vel.copy(tA).multiplyScalar(P.speed).addScaledVector(tB,.8*DF().wind);
  P.vel.y+=n2*tau*9-G.down*62;P.vel.x+=n1*tau*7;P.vel.z+=n3*tau*7;
  P.vel.add(P.fling);P.fling.multiplyScalar(Math.exp(-dt*2.2));
  P.pos.addScaledVector(P.vel,dt);
  // 海面と島の地表への接触
  {const lx=P.pos.x-BASE.x,lz=P.pos.z-BASE.z;let gy=11,why='海面に突っ込んだ',land=false;
    if(Math.abs(lx)<2700&&Math.abs(lz)<3100){const h=islandH(lx,lz);if(h>4){land=true;gy=h+3.2;
      why=Math.abs(lx)<60&&Math.abs(lz-HANGAR_Z)<95?'格納庫に激突した':Math.abs(lx-30)<150&&Math.abs(lz-130)<1180?'滑走路に激突した':Math.abs(lx-250)<380&&Math.abs(lz-150)<480?'基地の地面に激突した':h>70?'島の山肌に激突した':'島の地面に激突した';}}
    if(P.pos.y<gy){P.pos.y=gy+2;P.pitch=.32;if(land)SFX.hit();else SFX.splash();damage(18,why);P.fling.y=30;}}
  // 建物・港の施設・灯台・格納庫の外殻への衝突。細長い柱は、胴体に当たれば即爆発、主翼に当たればその翼がもげる
  {const hit=hitTest();if(hit&&G.mode==='play'){if(hit.wing)loseWing(hit.wing,hit.why);else crashExplode(hit.why);}}
  P.inv=Math.max(0,P.inv-dt);
  syncAC(P);P.mesh.userData.ctlR=ix;P.mesh.userData.ctlP=iy;
  // 翼端雲
  P.mesh.updateMatrixWorld();
  const str=sat((s.c*.5+Math.abs(ix)*.5+(boosting?.35:0))*(P.pos.y<s.top+400?1:.4))*.5;
  tC.set(1,0,0).applyQuaternion(P.mesh.quaternion);
  for(let i=0;i<2;i++){const tp=P.mesh.userData.tipPos;tD.set(i?tp.x:-tp.x,tp.y,tp.z);P.mesh.localToWorld(tD);pushTrail(trails[i],tD,tC,str*.3,dt,.3);}
}
function updateWing(dt){
  const tau=P.turb||0,t=G.t;
  W.forEach((w,i)=>{
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
  const sh=G.shake*2.6+(P.turb||0)*1.3;
  const lowV=sat(1-(P.pos.y-12)/60);
  camera.position.copy(P.pos).addScaledVector(tA,-47).add(tB.set((Math.random()-.5)*sh,11.5+lowV*8+(Math.random()-.5)*sh,(Math.random()-.5)*sh));
  tC.copy(P.pos).addScaledVector(tA,70);tC.y+=5-lowV*13;
  camera.up.set(Math.sin(P.roll*.22)*Math.cos(P.camYaw)*-1,1,Math.sin(P.roll*.22)*Math.sin(P.camYaw)).normalize();
  camera.lookAt(tC);
  const fov=62+(P.speed-150)*.11;if(Math.abs(camera.fov-fov)>.05){camera.fov=damp(camera.fov,fov,4,dt);camera.updateProjectionMatrix();}
}
function setCam(px,py,pz,lx,ly,lz,fov){camera.up.set(0,1,0);camera.position.set(px,py,pz);camera.lookAt(lx,ly,lz);if(fov&&camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}}

// ───────────────────────── フェーズ ─────────────────────────
function saveCkpt(ph){G.ckpt={ph,hull:P.hull,w:W.map(w=>w.state==='gone'?'gone':'form'),saved:G.stats.saved};}
function resetHaz(){strikes.forEach(s=>s.col.visible=false);strikes.length=0;G.gust=0;G.down=0;G.prompt=null;G.hudFail=0;P.ice=0;P.iceT=0;P.fire=false;P.fireT=0;P.gearJam=false;P.gearN=0;G.gateHit=0;$('prompt').hidden=true;$('timer').hidden=true;$('warn').hidden=true;setAlarm(false);
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
    setObj('PHASE 2　壁雲','マーカーを頼りに壁雲を突き抜けろ');banner('PHASE 2','壁雲突入');MUS.intensity=2;G.strikeT=2;
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
    if(fresh)hint('2番機には発射装置が無い。並走して予備弾を受け取る',8);
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
function startRun0(){G.dmgBy={};G.crash=0;G.boomBig=0;if(P.mesh)P.mesh.visible=true;if(P.hidden){for(const c of P.hidden)c.visible=true;P.hidden=null;}P.wingLost=0;for(const d of DEBRIS)scene.remove(d.m);DEBRIS.length=0;}
function startRun(ph){startRun0();
  resetHaz();clearRadio();
  U.uStorm.value=1;U.uEye.value=1;applyEnv(0);P.hasPod=true;P.speed=150;P.boost=100;P.pitch=0;P.roll=0;
  G.flags={};G.spareGiven=(ph==='ret');if(ph==='ret'||ph==='spare')P.hasPod=false;$('fade').style.opacity=0;finalMat.uniforms.uWhite.value=0;G.white=0;
  spouts.forEach((s,i)=>s.mesh.visible=i<DF().spouts);
  if(G.ckpt&&ph!=='approach'){W.forEach((w,i)=>{w.state=G.ckpt.w[i];});G.stats.saved=G.ckpt.saved;P.hull=Math.max(G.ckpt.hull,DF().floor);}
  else{W.forEach(w=>w.state='form');P.hull=100;G.stats.saved=null;}
  if(ph==='approach'){P.pos.set(0,420,BASE.z-2700);P.yaw=0;}
  else if(ph==='eye'){P.pos.set(0,480,2100);P.yaw=0;G.flags.b1=G.flags.b2=G.flags.b3=G.flags.b4=G.flags.b5=1;}
  else if(ph==='spare'){P.pos.set(500,3000,2000);P.yaw=.25;}
  else if(ph==='ret'){P.pos.set(0,2400,4200);P.yaw=Math.PI;spouts.forEach(s=>s.mesh.visible=false);}
  P.camYaw=P.yaw;P.camPitch=0;snapWing();trails.forEach(resetTrail);resetArmor();G.indoor=0;setDoors(1);hangarLight(1);
  gearOf(P,false);W.forEach(w=>gearOf(w,false));
  G.mode='play';document.body.classList.remove('cine');$('hud').hidden=false;$('skip').hidden=true;
  ['title','over','res','pause','help','opts'].forEach(i=>$(i).hidden=true);
  enterPhase(ph,true);syncAC(P);chaseCam(0,true);
}

function updatePhase(dt){
  const r=Math.hypot(P.pos.x,P.pos.z),f=G.flags,D=opts.diff||0;G.pt+=dt;
  if(G.phase==='approach'){if(r<15300){saveCkpt('approach');enterPhase('bands');}}
  else if(G.phase==='bands'){
    if(!f.b1&&r<14300){f.b1=1;say('C','レインバンドに入りました。落雷の予兆は赤い光の柱で表示します。柱から離れてください');hint('赤い柱＝落雷の予告。旋回して離れる',7);}
    if(D>=1&&!f.ice&&r<13500){f.ice=1;P.ice=1;P.iceT=0;warn('着氷',3);say('C','翼に氷が付き始めました。舵が重くなります。ブーストの排熱で落としてください');}
    if(D>=2&&!f.hail&&r<9700&&!f.stall){f.hail=1;f.hailT=10;warn('雹　高度180m以下へ',4);say('C','雹の帯に入ります！　高度を180メートル以下まで下げて、下をくぐってください');}
    if(!f.b2&&r<12600){f.b2=1;f.gustT=8;warn('乱気流',3);say('G','くっ、揺れる…！　この旧式じゃ翼がもげそうだ');MUS.intensity=1;}
    if(!f.b3&&r<10800){f.b3=1;startStall();}
    if(!f.b4&&r<8600&&!f.stall){f.b4=1;f.downT=6.5;warn('ダウンバースト　機首を上げろ',4);setAlarm(true);say('C','上空から強い下降気流！　機首を上げて、ブーストで抜けてください');}
    if(!f.b5&&r<7300){f.b5=1;say('C','前方に海上竜巻を複数確認しました。触れないよう迂回してください');say('G','おい、あれには近づくなよ…うおっ、引っ張られる！');}
    if(r<4750)enterPhase('wall');
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
      if(G.dock>=2.6){P.hasPod=true;G.spareGiven=true;syncPods();tether.visible=false;SFX.pickup();SFX.launch();G.prompt=null;carrierRing.visible=false;w.state='form';
        say('G','受け渡し完了だ。…外すなよ、隊長');say('C','また落雷に撃ち落とされないよう、今度はコアのすぐ近くから撃ってください');
        setObj('PHASE 4　再攻撃','コアから1.5km以内でロックオンせよ');G.target=CORE;G.targetLabel='コア';}
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
      if(P.restart>=2.2){P.engineOut=false;G.prompt=null;setAlarm(false);SFX.restart();say('G','火が入ったな。まったく、最後まで世話の焼ける機体だ');}
    }
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
    else if(P.fireT>=2){P.fire=false;G.prompt=null;setAlarm(false);SFX.restart();say('S','消火を確認。推力は回復した');}}
  if(f.gustT>0){f.gustT-=dt;G.gust=damp(G.gust,f.gustT>0?.9:0,3,dt);}else G.gust=damp(G.gust,0,2,dt);
  if(f.downT>0){f.downT-=dt;G.down=damp(G.down,f.downT>1?1:0,2.5,dt);if(f.downT<=0)setAlarm(false);}else G.down=damp(G.down,0,2,dt);
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
function fail(cause){G.cause=cause;G.mode='dying';G.dieT=1.2;setAlarm(false);}

// ───────────────────────── カットシーン ─────────────────────────
let CUT=null;
function startCut(def){
  resetHaz();clearRadio();CUT={def,i:-1,t:0,tot:0,si:0,skip:false,fp:camera.position.clone(),fq:camera.quaternion.clone(),ff:camera.fov};G.mode='cut';
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
  const subs=c.def.subs||[];while(c.si<subs.length&&c.tot>=subs[c.si][0]){const u=subs[c.si++];if(u[1]!=='H'||W[1].state!=='gone')say(u[1],u[2],u[3]);}
  W.forEach(w=>{if(w.state!=='gone'){syncAC(w);animAircraft(w.mesh,G.t,w.power===undefined?.8:w.power,w.ph);}});syncAC(P);
}
function endCut(){
  const c=CUT;CUT=null;document.body.classList.remove('cine');$('skip').hidden=true;$('card').classList.remove('on');clearRadio();
  finalMat.uniforms.uWhite.value=0;G.white=0;shock.visible=false;boomFx.visible=false;proj.g.visible=false;proj.glow.visible=false;
  W.forEach(w=>{w.power=.8;});camera.fov=62;camera.updateProjectionMatrix();G.indoor=0;setDoors(1);hangarLight(1);
  c.def.end();
}
function skipCut(){if(!CUT||CUT.skip)return;CUT.skip=true;$('fade').style.opacity=1;setTimeout(()=>{if(CUT)endCut();$('fade').style.opacity=0;},520);}
function cutFly(dt,spd){fwdOf(P.yaw,P.pitch,tA);P.pos.addScaledVector(tA,spd*dt);W.forEach(w=>{if(w.state==='gone')return;slotOf(w,tB);tB.y+=Math.sin(G.t*1.1+w.ph)*3;w.pos.lerp(tB,1-Math.exp(-dt*3));w.yaw=P.yaw;w.pitch=P.pitch;w.roll=Math.sin(G.t*1.6+w.ph)*.05;});}
function card(a,b){const c=$('card');c.children[0].style.fontSize=a.length>12?'min(6.4vw,66px)':'';c.children[0].textContent=a;c.children[1].textContent=b;c.classList.add('on');}
const RZ0=()=>BASE.z+1060;
// 機体原点から車輪の下端までは 3.6m（僚機は 0.92 倍）。機首上げでは主脚が沈むぶんを持ち上げる
const GH=o=>RWY_Y+3.6*o.mesh.scale.y,GP=(o,p)=>(2.3*Math.sin(Math.max(p,0))+3.6*(1-Math.cos(p)))*o.mesh.scale.y;
function setDoors(o){G.doorO=o;const d=baseGroup.userData.doors;d[0].position.x=-23.75-o*46.5;d[1].position.x=23.75+o*46.5;}
function hangarLight(k){baseGroup.userData.hlight.intensity=2.2*k;{const c=baseGroup.userData.cones;c.coneM.opacity=.55*k;c.poolM.opacity=.1*k;}baseGroup.userData.strip.color.setRGB(2.6*k+.02,2.7*k+.02,3*k+.03);}
const CUT_INTRO={
  subs:[[.8,'C','台風13号〈オロチ〉、中心気圧890ヘクトパスカル。18時間後に本土へ上陸する見込みです',6.2],
    [8.6,'C','ストームライダー隊に発進を許可します。目標は台風の中心、コア',4.2],[13.2,'C','ディフューザーは1番機に1発、2番機に予備が1発。コアへ撃ち込み、嵐を内側から消してください',5],
    [18.8,'C','格納庫ゲートを開放します。進路上、障害なし',3.2],
    [22.6,'G','2番機ゴウ。この旧式に発射装置は無い。予備の運び屋だ、撃つのは隊長の仕事だぞ',4.2],[27,'H','3番機ハル、初出撃です…！　よ、よろしくお願いします！',3.4],
    [30.8,'C','ストームライダー1、発進どうぞ。…必ず、帰ってきてください',5]],
  begin(){U.uStorm.value=1;U.uEye.value=1;applyEnv(0);setMood('intro');P.hasPod=true;G.spareGiven=false;syncPods();P.hull=100;resetArmor();
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
function projMove(dt,T){
  proj.T+=dt;const u=sat(proj.T/T),e=u*u;proj.g.position.copy(proj.from).addScaledVector(proj.v0,proj.T);proj.g.position.y-=3.5*sat(proj.T/.5)*(1-e);proj.g.position.lerp(CORE,e);proj.g.lookAt(CORE);proj.d.userData.flame.visible=proj.T>.35;for(const q of proj.trail.pts)q.p.addScaledVector(proj.v0,dt);
  proj.glow.position.copy(proj.g.position);proj.glow.quaternion.copy(camera.quaternion);const s=5.5+Math.sin(G.t*40)*1.2;proj.glow.scale.set(s,s,1);
  tC.set(1,0,0).applyQuaternion(proj.g.quaternion);pushTrail(proj.trail,proj.g.position,tC,.55,dt,.5);
}
const CUT_FIRE1={
  blendIn:.9,blendOut:1.3,
  subs:[[.3,'C','ディフューザーの発射を確認'],[5.3,'H','ら、落雷…！？　ディフューザーが！',3],
    [8.5,'C','ディフューザーを喪失。コアの電位差が雷を引き寄せました。衝撃で目が閉じ始めています',5.4],
    [14.1,'C','予備は2番機にあります。空中で1番機へ受け渡してください',4.4],
    [18.7,'G','発射装置さえあれば俺が撃つんだがな。横に付く、受け取れ隊長',4.2]],
  begin(){setMood('storm');MUS.intensity=2;},
  shots:[
    {dur:2.6,setup(){projSetup();},update(t,u,dt){cutFly(dt,130);projMove(dt,5);fwdOf(P.yaw,P.pitch,tA);
      setCam(P.pos.x-tA.x*44+tA.z*10,P.pos.y+10,P.pos.z-tA.z*44-tA.x*10,proj.g.position.x,proj.g.position.y,proj.g.position.z,55);}},
    {dur:2.6,update(t,u,dt){cutFly(dt,130);if(proj.g.visible)projMove(dt,5);const p=proj.g.position;tA.copy(CORE).sub(proj.from).normalize();
      setCam(p.x-tA.x*38+tA.z*20,p.y+6,p.z-tA.z*38-tA.x*20,p.x,p.y,p.z,46);
      if(t>2&&proj.g.visible){proj.g.visible=false;proj.glow.visible=false;tB.set(p.x+900,p.y+1700,p.z+500);boltFromTo(tB,p,16);bolts.forEach(b=>{if(b.life>0)b.life=.7;});
        flashAt(p.x,p.y,p.z,2.2);G.white=.8;SFX.boom();SFX.zap();SFX.thunder(300);boomFx.visible=true;boomFx.position.copy(p);boomFx.userData.t=0;G.shake=1;}}},
    {dur:18.2,setup(){setMood('climax');setAlarm(true);},update(t,u,dt){cutFly(dt,130);P.roll=Math.sin(t*3)*.12*(1-u);G.shake=Math.max(G.shake,.25*(1-u));
      U.uEye.value=1-.08*u;if(t>3)setAlarm(false);
      fwdOf(P.yaw,P.pitch,tA);const a=.5+u*2.4;setCam(P.pos.x+tA.x*46*Math.cos(a)+tA.z*46*Math.sin(a),P.pos.y+5+u*6,P.pos.z+tA.z*46*Math.cos(a)-tA.x*46*Math.sin(a),P.pos.x,P.pos.y+1,P.pos.z,46);}}],
  end(){startRunKeep('spare');}
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
      setCam(42,RWY_Y+4+u*2,BASE.z-690,P.pos.x,P.pos.y+1,P.pos.z,17+u*16);
      if(u>.985&&!this.td){this.td=1;SFX.touch();G.shake=.4;}}},
    {dur:8,update(t,u){const gy=RWY_Y+3.6,z=BASE.z-760+78*t-.5*9.2*t*t;P.pitch=.07*(1-sat(t/1.5));P.pos.set(0,gy+GP(P,P.pitch),z);P.power=.2;
      W.forEach((w,i)=>{w.pos.set(i?55:-55,RWY_Y+70+i*14,BASE.z-2600+175*t-i*150);w.yaw=Math.PI;w.roll=(i?-1:1)*sat(t/6)*.5;w.pitch=.05;});
      setCam(-48+u*14,RWY_Y+6,P.pos.z+70-u*20,P.pos.x,P.pos.y+2,P.pos.z+10,40);}},
    {dur:8,setup(){card('MISSION COMPLETE','任務完了');},update(t,u){W.forEach((w,i)=>{w.pos.set((i?-1:1)*(300+u*200),320+u*90,BASE.z+600+i*200+t*150);w.yaw=Math.PI+(i?-.3:.3);w.roll=0;});
      setCam(-190-u*60,RWY_Y+40+u*150,BASE.z-760-u*260,60,RWY_Y+10,BASE.z+500,46);}}],
  end(){showResult();}
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
  view.scale=.72;cloudMat.uniforms.uSteps.value=64;resize();
  G.mode='title';P.hull=100;startRun0();resetHaz();clearRadio();CUT=null;AU.paused=false;if(AU.ctx)initAudio();document.body.classList.remove('cine');
  ['hud','over','res','pause','help','opts','skip'].forEach(i=>$(i).hidden=true);$('title').hidden=false;$('card').classList.remove('on');
  U.uStorm.value=1;U.uEye.value=1;applyEnv(0);setMood('title');$('fade').style.opacity=0;G.white=0;
  P.pos.set(0,RWY_Y+3.6,RZ0());P.yaw=0;P.pitch=0;P.roll=0;syncAC(P);W.forEach((w,i)=>{w.state='form';w.pos.set(i?24:-24,GH(w),RZ0()+45+i*35);w.yaw=0;w.pitch=0;w.roll=0;syncAC(w);});resetArmor();
  spouts.forEach((s,i)=>s.mesh.visible=i<DF().spouts);gateRings.forEach(g=>g.visible=false);P.hasPod=true;G.spareGiven=false;syncPods();
}
function showResult(){
  G.mode='result';$('res').hidden=false;$('hud').hidden=true;
  const t=G.missionT,mm=Math.floor(t/60),ss=Math.floor(t%60);
  let sc=100-Math.max(0,t-330)*.08-G.stats.dmg*.25-G.retries*8+(G.stats.saved?8:G.stats.saved===false?-8:0)+(opts.diff||0)*7;
  const rank=sc>=92?'S':sc>=78?'A':sc>=60?'B':'C';
  $('rank').textContent=rank;$('rankT').textContent={S:'伝説の嵐乗り',A:'一流のストームライダー',B:'頼れる隊長',C:'満身創痍の帰還'}[rank];
  $('resT').innerHTML=`<tr><td>難易度</td><td>${DF().name}</td></tr><tr><td>任務時間</td><td class="mono">${mm}:${String(ss).padStart(2,'0')}</td></tr><tr><td>機体の耐久（残り）</td><td class="mono">${Math.round(P.hull)}%</td></tr>`+
    `<tr><td>受けたダメージの合計</td><td class="mono">${Math.round(G.stats.dmg)}</td></tr><tr><td>3番機ハル</td><td>${G.stats.saved?'救援成功・全機帰還':G.stats.saved===false?'途中離脱（救助済み）':'無事帰還'}</td></tr>`+
    `<tr><td>再挑戦</td><td class="mono">${G.retries} 回</td></tr>`;
}
function updateDying(dt){
  G.dieT+=dt;if(G.crash){G.shake=Math.max(0,.8-G.dieT*.5);chaseCam(dt);if(G.dieT>2.6)$('fade').style.opacity=1;if(G.dieT>3.6){G.crash=0;P.mesh.visible=true;G.dieT=9;}else return;}
  P.pitch=damp(P.pitch,-.7,1.2,dt);P.roll+=dt*2.4;P.speed=damp(P.speed,90,1,dt);fwdOf(P.yaw,P.pitch,tA);P.pos.addScaledVector(tA,P.speed*dt);if(P.pos.y<8&&!G.crash){P.pos.y=8;G.crash=1;G.dieT=Math.min(G.dieT,.2);P.mesh.visible=false;explode(P.pos,.8);return;}syncAC(P);
  P.power=.1;G.shake=.5;chaseCam(dt);
  if(G.dieT>1.0)$('fade').style.opacity=1;
  if(G.dieT>2.1){G.mode='over';$('fade').style.opacity=0;$('over').hidden=false;$('hud').hidden=true;$('overT').textContent=P.hull<=0?'機体喪失':'任務失敗';$('overP').textContent=causeText();clearRadio();setMood('title');}
}

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
    W.forEach((w,i)=>{const el=$('w'+(i+1));const st=w.state==='gone'?['離脱','st-out']:w.state==='stall'?['失速','st-bad']:w.state==='carrier'||w.state==='dockfly'?['予備搭載','st-mid']:(P.turb>.6?['苦戦中','st-mid']:['編隊','st-ok']);
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
    const mx=hw-60,myT=hh-120,myB=hh-190,my=y>0?myB:myT;if(Math.abs(x)>mx||Math.abs(y)>my){const k=Math.min(mx/Math.max(Math.abs(x),1e-6),my/Math.max(Math.abs(y),1e-6));x*=k;y*=k;off=true;}
    el.style.transform=`translate(${hw+x}px,${hh+y}px)`;el.classList.toggle('off',off);el.classList.toggle('lock',G.lock>=1);
    el.firstElementChild.style.transform=off?`rotate(${Math.atan2(y,x)*180/Math.PI-45}deg)`:'';
    const d=G.target.distanceTo(P.pos);el.lastElementChild.textContent=G.targetLabel+' '+(d>=1000?(d/1000).toFixed(1)+'km':Math.round(d)+'m');
    el.lastElementChild.style.left=x>mx-140?'-150px':'22px';
  }else el.hidden=true;
  const pr=$('prompt');if(G.prompt){pr.hidden=false;if(pr.dataset.t!==G.prompt.t){pr.dataset.t=G.prompt.t;$('promptT').innerHTML=tk(G.prompt.t);}pr.querySelector('i').style.transform=`scaleX(${sat(G.prompt.p)})`;}else pr.hidden=true;
  if(G.warnT>0){G.warnT-=dt;if(G.warnT<=0)$('warn').hidden=true;}
  if(G.hintT>0){G.hintT-=dt;if(G.hintT<=0)$('hint').hidden=true;}
}
function drawRadar(){
  if(G.hudFail>0){rctx.clearRect(0,0,340,340);return;}
  const c=rctx,S=340,cx=S/2,cy=S/2,sc=(S/2-14)/4500;c.clearRect(0,0,S,S);
  c.save();c.beginPath();c.arc(cx,cy,S/2-4,0,6.283);c.fillStyle='rgba(4,14,22,.55)';c.fill();c.clip();
  const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw),rx=Math.cos(P.yaw),rz=-Math.sin(P.yaw);
  const tr=(x,z)=>{const dx=x-P.pos.x,dz=z-P.pos.z;return[cx+(dx*rx+dz*rz)*sc,cy-(dx*fx+dz*fz)*sc];};
  c.strokeStyle='rgba(190,233,255,.22)';c.lineWidth=2;for(const r of[1500,3000,4500]){c.beginPath();c.arc(cx,cy,r*sc,0,6.283);c.stroke();}
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
  let b=!!(k.ShiftLeft||k.ShiftRight),a=!!k.Space;
  x+=input.tx;y+=input.ty;b=b||input.tBoost;a=a||input.tAct;
  const gp=navigator.getGamepads?navigator.getGamepads()[0]:null;
  if(gp){if(Math.abs(gp.axes[0])>.15)x+=gp.axes[0];if(Math.abs(gp.axes[1])>.15)y-=gp.axes[1];b=b||gp.buttons[7]?.pressed||gp.buttons[1]?.pressed;a=a||gp.buttons[0]?.pressed;}
  input.x=damp(input.x,clamp(x,-1,1),9,.016);input.y=damp(input.y,clamp(y,-1,1),9,.016);input.boost=b;input.actHit=a&&!input.act;input.act=a;
}
function bindInput(){
  for(const ev of['keydown','pointerdown','pointermove','touchstart','wheel'])addEventListener(ev,()=>{lastInput=performance.now();},{passive:true});
  addEventListener('keydown',e=>{
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
    input.keys[e.code]=true;initAudio();
    if(e.code==='Enter'&&G.mode==='cut')skipCut();
    if((e.code==='Escape'||e.code==='KeyP')&&!e.repeat)togglePause();
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
  click('bStart',()=>{view.scale=1;view.upT=0;cloudMat.uniforms.uSteps.value=(IS_TOUCH?[52,80,112]:[72,100,136])[opts.q];resize();$('title').hidden=true;startCut(CUT_INTRO);});
  click('bHelp',()=>{$('help').hidden=false;if(G.mode==='title')$('title').hidden=true;});click('bOpts',()=>{$('opts').hidden=false;if(G.mode==='title'){G.optPrev=true;P.power=0;$('title').hidden=true;setDoors(1);hangarLight(1);gearOf(P,true);cloudReset=true;}});click('bPOpts',()=>{$('opts').hidden=false;});
  document.querySelectorAll('.bBack').forEach(b=>b.addEventListener('click',()=>{SFX.ui();$('help').hidden=true;$('opts').hidden=true;if(G.mode==='title')$('title').hidden=false;if(G.optPrev){G.optPrev=false;G.indoor=0;cloudReset=true;}}));
  // 機体の塗装と形
  const mkSel=(id,items,key,html)=>{const box=$(id);items.forEach((it,i)=>{const b=document.createElement('button');b.type='button';b.innerHTML=html(it);b.title=it.name;b.setAttribute('aria-label',it.name);b.addEventListener('click',()=>{initAudio();SFX.ui();opts[key]=i;saveOpts();upd();makePlayer();syncPods();});box.appendChild(b);});
    const upd=()=>{[...box.children].forEach((b,i)=>b.classList.toggle('on',i===(opts[key]||0)));const n=$(id+'N');if(n)n.textContent=items[opts[key]||0].name;};upd();};
  const hx=h=>'#'+h.toString(16).padStart(6,'0');
  mkSel('oColor',SCHEMES,'color',it=>`<i style="background:linear-gradient(135deg,${hx(it.body)} 0 58%,${hx(it.acc)} 58% 100%)"></i>`);
  mkSel('oShape',SHAPES,'shape',it=>it.name);
  click('bResume',togglePause);click('bPTitle',showTitle);click('bOTitle',showTitle);click('bRTitle',showTitle);
  click('bRetry',()=>{G.retries++;startRun(G.ckpt?G.ckpt.ph:'approach');});
  click('bAgain',()=>{view.scale=1;view.upT=0;cloudMat.uniforms.uSteps.value=(IS_TOUCH?[52,80,112]:[72,100,136])[opts.q];resize();$('res').hidden=true;startCut(CUT_INTRO);});
  $('skip').addEventListener('click',skipCut);
  $('oMus').value=opts.mus;$('oSfx').value=opts.sfx;$('oInv').checked=opts.inv;$('oQ').value=opts.q;
  $('oFix').addEventListener('click',()=>{restartAudio();setTimeout(()=>SFX.ui(),150);});
  const ap=()=>{opts.mus=+$('oMus').value;opts.sfx=+$('oSfx').value;opts.inv=$('oInv').checked;opts.q=+$('oQ').value;AU.musVol=opts.mus/100;AU.sfxVol=opts.sfx/100;setVolumes();
    if(view.q!==opts.q){view.q=opts.q;cloudMat.uniforms.uSteps.value=(IS_TOUCH?[52,80,112]:[72,100,136])[opts.q];resize(true);}saveOpts();};
  ['oMus','oSfx','oInv','oQ'].forEach(i=>$(i).addEventListener('input',ap));ap();
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
    hold('tbA','tAct');hold('tbB','tBoost');
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
  if(G.mode==='play'){G.mode='pause';$('pause').hidden=false;setAlarm(false);if(AU.ctx){AU.paused=true;AU.ctx.suspend();}}
  else if(G.mode==='pause'){G.mode='play';$('pause').hidden=true;$('opts').hidden=true;if(AU.ctx){AU.paused=false;AU.ctx.resume();}}
}

// ───────────────────────── メインループ ─────────────────────────
const EXP={fire:[],smoke:[],sparks:null,sv:[],ring:null,light:null,t:9,ringT:9};
function initExplosion(){
  const tex=(dark)=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');for(let i=0;i<26;i++){const a=Math.random()*6.283,r=Math.random()*30,px=64+Math.cos(a)*r,py=64+Math.sin(a)*r,s=14+Math.random()*22,g=x.createRadialGradient(px,py,0,px,py,s);g.addColorStop(0,dark?'rgba(255,255,255,.5)':'rgba(255,255,255,.75)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);}
    const m=x.createRadialGradient(64,64,30,64,64,64);m.addColorStop(0,'rgba(0,0,0,0)');m.addColorStop(1,'rgba(0,0,0,1)');x.globalCompositeOperation='destination-out';x.fillStyle=m;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);};
  const ft=tex(false),st=tex(true);
  for(let i=0;i<18;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:ft,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,rotation:Math.random()*6}));sp.visible=false;scene.add(sp);EXP.fire.push({sp,vel:new V3(),t:0,life:1,s0:1,s1:1});}
  for(let i=0;i<22;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:st,color:0x0c0b0a,depthWrite:false,transparent:true,rotation:Math.random()*6}));sp.visible=false;sp.renderOrder=2;scene.add(sp);EXP.smoke.push({sp,vel:new V3(),t:0,life:1,s0:1,s1:1,delay:0});}
  const N=90,pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(N*3),3));EXP.sparks=new THREE.Points(pg,new THREE.PointsMaterial({map:GLOWTEX,color:new THREE.Color(3,1.5,.4),size:1.6,sizeAttenuation:true,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));EXP.sparks.frustumCulled=false;EXP.sparks.visible=false;scene.add(EXP.sparks);for(let i=0;i<N;i++)EXP.sv.push(new V3());
  EXP.ring=new THREE.Mesh(new THREE.RingGeometry(.82,1,48),new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.3,1.0),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));EXP.ring.rotation.x=-Math.PI/2;EXP.ring.visible=false;scene.add(EXP.ring);
  EXP.light=new THREE.PointLight(0xffa050,0,700,1.6);scene.add(EXP.light);
}
// k は規模（1＝機体の爆発）
function explode(p,k){
  if(!EXP.sparks)initExplosion();EXP.t=0;EXP.k=k;
  for(const f of EXP.fire){f.t=0;f.life=(.7+Math.random()*.9)*(.6+.4*k);f.sp.position.copy(p).add(tD.set((Math.random()-.5)*8,(Math.random()-.3)*6,(Math.random()-.5)*8).multiplyScalar(k));f.vel.set((Math.random()-.5)*26,6+Math.random()*20,(Math.random()-.5)*26).multiplyScalar(k);f.s0=(5+Math.random()*6)*k;f.s1=(20+Math.random()*18)*k;f.sp.visible=true;}
  for(const f of EXP.smoke){f.t=0;f.delay=Math.random()*.5;f.life=(3+Math.random()*3)*(.5+.5*k);f.sp.position.copy(p).add(tD.set((Math.random()-.5)*10,Math.random()*5,(Math.random()-.5)*10).multiplyScalar(k));f.vel.set((Math.random()-.5)*16,5+Math.random()*13,(Math.random()-.5)*16).multiplyScalar(.5+.5*k);f.s0=(8+Math.random()*8)*k;f.s1=(34+Math.random()*30)*k;f.sp.visible=false;}
  const pa=EXP.sparks.geometry.attributes.position;for(let i=0;i<EXP.sv.length;i++){pa.setXYZ(i,p.x,p.y,p.z);const a=Math.random()*6.283,e=Math.random()*1.3-.15,v=(18+Math.random()*55)*k;EXP.sv[i].set(Math.cos(a)*Math.cos(e)*v,Math.sin(e)*v+8,Math.sin(a)*Math.cos(e)*v);}pa.needsUpdate=true;EXP.sparks.visible=true;EXP.sparks.material.opacity=1;
  const lx=p.x-BASE.x,lz=p.z-BASE.z,gy=Math.abs(lx)<2700&&Math.abs(lz)<3100?Math.max(islandH(lx,lz),3.5):3.5;EXP.ringOn=p.y-gy<28*k&&k>.5;if(EXP.ringOn){EXP.ring.position.set(p.x,gy+.4,p.z);EXP.ring.visible=true;}
  EXP.light.position.copy(p);EXP.light.position.y+=6;
  if(k>.5){G.white=Math.max(G.white||0,.38);G.shake=1;flashAt&&flashAt(p.x,p.y,p.z,1.2);SFX.boom();setTimeout(()=>SFX.hit(),90);}
}
function updateExplosion(dt){
  if(EXP.t>8&&!DEBRIS.length)return;EXP.t+=dt;const k=EXP.k||1;
  for(const f of EXP.fire){if(!f.sp.visible)continue;f.t+=dt;const u=f.t/f.life;if(u>=1){f.sp.visible=false;continue;}f.vel.multiplyScalar(Math.exp(-dt*2.6));f.vel.y+=5*dt;f.sp.position.addScaledVector(f.vel,dt);const s=lerp(f.s0,f.s1,1-Math.pow(1-u,2.2));f.sp.scale.set(s,s,1);
    const m=f.sp.material,h=1-u;m.color.setRGB(3.4*h+.5,1.6*h*h+.12*h,.5*h*h*h);m.opacity=Math.min(1,u*14)*Math.pow(h,.7);m.rotation+=dt*.5;}
  for(const f of EXP.smoke){f.t+=dt;const tt=f.t-f.delay;if(tt<0)continue;const u=tt/f.life;if(u>=1){f.sp.visible=false;continue;}f.sp.visible=true;f.vel.multiplyScalar(Math.exp(-dt*.9));f.vel.x+=2.2*dt;f.sp.position.addScaledVector(f.vel,dt);const s=lerp(f.s0,f.s1,1-Math.pow(1-u,1.8));f.sp.scale.set(s,s,1);
    const m=f.sp.material,gl=Math.max(0,1-tt*1.6);m.color.setRGB(.10+.9*gl+.1*u,.095+.3*gl+.1*u,.09+.04*gl+.1*u);m.opacity=Math.min(1,tt*4)*Math.pow(1-u,1.4)*.6;m.rotation+=dt*.15;}
  if(EXP.sparks&&EXP.sparks.visible){const pa=EXP.sparks.geometry.attributes.position;for(let i=0;i<EXP.sv.length;i++){const v=EXP.sv[i];v.y-=22*dt;v.multiplyScalar(Math.exp(-dt*.7));pa.setXYZ(i,pa.getX(i)+v.x*dt,Math.max(pa.getY(i)+v.y*dt,2),pa.getZ(i)+v.z*dt);}pa.needsUpdate=true;EXP.sparks.material.opacity=Math.max(0,1-EXP.t/2.4);if(EXP.t>2.4)EXP.sparks.visible=false;}
  if(EXP.ring&&EXP.ring.visible){const u=EXP.t/.9,r=(6+u*95)*k;EXP.ring.scale.set(r,r,1);EXP.ring.material.opacity=Math.max(0,.55*(1-u));if(u>=1)EXP.ring.visible=false;}
  if(EXP.light)EXP.light.intensity=Math.max(0,14*k*Math.exp(-EXP.t*4.5)+2.5*k*Math.max(0,1-EXP.t/1.4));
  for(let i=DEBRIS.length-1;i>=0;i--){const d=DEBRIS[i];d.life-=dt;d.vel.y-=14*dt;d.vel.multiplyScalar(Math.exp(-dt*.35));d.m.position.addScaledVector(d.vel,dt);d.m.rotation.x+=d.av.x*dt;d.m.rotation.y+=d.av.y*dt;d.m.rotation.z+=d.av.z*dt;
    d.smoke-=dt;if(d.smoke<=0){d.smoke=.05;puff(d.m.position.x,d.m.position.y,d.m.position.z,0,3,0,3,1.2,.6);}
    const lx=d.m.position.x-BASE.x,lz=d.m.position.z-BASE.z,gy=Math.abs(lx)<2700&&Math.abs(lz)<3100?Math.max(islandH(lx,lz),2):2;if(d.m.position.y<gy||d.life<=0){scene.remove(d.m);DEBRIS.splice(i,1);}}
}
function updateCommon(dt){
  {const ip=G.mode==='play';if(ip!==G.inplayCls){G.inplayCls=ip;document.body.classList.toggle('inplay',ip);if(!ip){input.tx=input.ty=0;input.tAct=input.tBoost=false;}}}
  updateExplosion(dt);
  // 稲光の減衰
  G.flash*=Math.exp(-dt*5.5);U.uFlashI.value=G.flash*(.55+.45*Math.sin(G.t*63)*Math.sin(G.t*41));
  G.scr*=Math.exp(-dt*7);G.white=Math.max(0,G.white-dt*1.1);G.hurt*=Math.exp(-dt*1.6);G.shake*=Math.exp(-dt*2.2);
  updateStrikes(dt);ambientLightning(dt);updateRadio(dt);updateArmor(dt);
  if(bannerT>0){bannerT-=dt;if(bannerT<=0)$('banner').classList.remove('on');}
  // 環境
  const cp=camera.position,cs=stormAt(cp.x,cp.y,cp.z);
  G.gloom=damp(G.gloom,cp.y<cs.top+300?cs.c:cs.c*.2,1.5,dt);
  G.rain=damp(G.rain,cp.y<lerp(900,500,cs.wall)+200?cs.rain:(cp.y<cs.top?cs.rain*.5:0),1.5,dt);
  cloudMat.uniforms.uGloom.value=G.gloom;cloudMat.uniforms.uHaze.value=lerp(.00004,.00013,G.gloom);
  const fu=finalMat.uniforms;fu.uGloomF.value=G.gloom*(1-(G.indoor||0));fu.uGoldF.value=G.gold;fu.uLens.value=damp(fu.uLens.value,G.mode==='play'||G.mode==='cut'?sat(G.rain*1.2-.15):0,1.5,dt);
  {const cd=camera.position.distanceTo(P.pos),want=G.mode==='cut'&&cd<95?1:0;fu.uDof.value=damp(fu.uDof.value,want,4,dt);fu.uFocus.value=cd;
    compMat.uniforms.uAO.value=fu.uDof.value;const pj=1/Math.tan(camera.fov*Math.PI/360);compMat.uniforms.uProj.value.set(pj*.5/camera.aspect,pj*.5);
    // 排気の陽炎：ノズルの後ろ 2 点を画面に投影し、その間をゆらめかせる
    const inG=G.mode==='play'||G.mode==='cut';fwdOf(P.yaw,P.pitch,tA);tB.copy(P.pos).addScaledVector(tA,-11);tB.y+=1.2;tC.copy(P.pos).addScaledVector(tA,-30);tC.y+=1.2;
    const dA=camera.position.distanceTo(tB);tB.project(camera);tC.project(camera);
    if(inG&&P.power>=.28&&tB.z<1&&tC.z<1&&dA<400){fu.uHeat.value.set(tB.x*.5+.5,tB.y*.5+.5,tC.x*.5+.5,tC.y*.5+.5);fu.uHeatR.value=3.4*pj*.5/dA;fu.uHeatD.value=dA;fu.uHeatAmt.value=sat(.35+P.power*.6);}else fu.uHeatAmt.value=0;}
  fu.uRain.value=Math.min(1.6,G.rain*1.6);fu.uRainAng.value=.32+P.roll*.5;fu.uExp.value=lerp(.64,.60,G.gloom)*lerp(1,1.12,G.gold)*(1+.5*(G.indoor||0));
  fu.uScr.value=G.scr;fu.uHurt.value=G.hurt+(P.hull<=30&&G.mode==='play'?.18+.1*Math.sin(G.t*5):0);fu.uWhite.value=G.white;
  {const wet=smooth(.15,.7,G.rain)*(1-(G.indoor||0));if(Math.abs(wet-(G.wet||0))>.01||G.wet===undefined){G.wet=wet;for(const m of WETM){m.roughness=lerp(m.userData.r0,m.userData.r0*.4,wet);m.color.copy(m.userData.c0).multiplyScalar(1-.2*wet);}}}
  const vis=sunVisAt(P.pos),sd=U.uSunDir.value,scol=U.uSunCol.value;
  sunL.position.copy(P.pos).addScaledVector(sd,300);sunL.target.position.copy(P.pos);sunL.target.updateMatrixWorld();
  sunL.color.setRGB(scol.x/6,scol.y/6,scol.z/6);sunL.intensity=2.5*vis;
  {const c=baseGroup.userData.cones,o=G.doorO===undefined?1:G.doorO,day=1-sat((G.gloom||0)*.9);c.spillM.opacity=.2*o*day;c.hazeM.opacity=.05*o*day;
    [P,W[0],W[1]].forEach((a,i)=>{const b=c.blobs[i],lx=a.pos.x-BASE.x,lz=a.pos.z-BASE.z-HANGAR_Z,inH=Math.abs(lx)<46&&Math.abs(lz)<88&&a.pos.y<RWY_Y+9&&a.mesh.visible;b.visible=inH;if(inH){b.position.set(lx,.09,lz);b.rotation.y=a.yaw;}});}
  finalMat.uniforms.uIndoorF.value=G.indoor||0;
  const ind=G.indoor||0;hemiL.intensity=(lerp(.8,.2,G.gloom)+G.flash*2.5)*(1-.82*ind);hemiL.color.setRGB(.62+G.gold*.3,.74,.95-G.gold*.3);
  ENVMATS.forEach(m=>{if(m.envMapIntensity!==1.8)m.envMapIntensity=(.25+.75*vis)*(1-.8*ind);});
  spoutMat.uniforms.uLight.value=lerp(1.6,.8,G.gloom);
  // 海をカメラに追従
  ocean.material.uniforms.uSnap.value.set(cp.x,cp.z);
  // 竜巻・コア
  spouts.forEach(s=>{s.a+=dt*s.w;s.mesh.position.set(Math.cos(s.a)*s.r,0,Math.sin(s.a)*s.r);s.mesh.rotation.y-=dt*1.3;const k=sat(U.uStorm.value*2-.6);s.mesh.scale.set(k,k,k);if(k<=0)s.mesh.visible=false;});
  if(coreShell.visible){const d=camera.position.distanceTo(CORE),s=clamp(d*.07,34,460);coreShell.position.copy(CORE);coreShell.scale.setScalar(s);coreShell.quaternion.copy(camera.quaternion);coreShell.userData.inner.rotation.z+=dt*(G.lock>0?2.4:.5);
    const lk=G.lock>=1,pu=.75+.25*Math.sin(G.t*(lk?16:3));coreShell.traverse(o=>{if(o.isMesh){o.material.uniforms.uAlpha.value=pu;o.material.uniforms.uColor.value.set(lk?3.4:2.4,lk?.5:1.5,lk?.3:.5);}});}
  if(boomFx.visible){boomFx.userData.t+=dt;const u=boomFx.userData.t/1.4,s=boomFx.userData.t>=1.05&&G.mode!=='cut'?14*(1.5-u):80+u*520;boomFx.scale.set(s,s,1);boomFx.quaternion.copy(camera.quaternion);boomFx.material.uniforms.uAlpha.value=Math.max(0,1-u)*2;if(u>=1)boomFx.visible=false;}
  updateSeaLife(dt);
  if(strikeGlow&&strikeGlow.visible){const g=strikeGlow;g.userData.t+=dt;const u=g.userData.t/.45,s=260+u*520;g.scale.set(s,s*.5,1);g.quaternion.copy(camera.quaternion);g.material.uniforms.uAlpha.value=Math.max(0,1-u)*(0.6+0.4*Math.sin(G.t*90));if(u>=1)g.visible=false;}
  rings.forEach((r,i)=>{if(r.visible)r.rotation.z+=dt*.6;});
  gateRings.forEach(r=>{if(r.visible)r.material.uniforms.uAlpha.value=.7+.3*Math.sin(G.t*4);});
  animAircraft(P.mesh,G.t,P.power,0);if(G.mode==='cut')[P,...W].forEach(o=>{o.mesh.userData.strobe.visible=false;});
  // 音
  const inGame=G.mode==='play'||G.mode==='cut'||G.mode==='dying';
  sfxAmbient(dt,inGame&&G.mode!=='cut'?G.rain:0,G.mode==='play'?(P.turb||0):0,G.mode==='play'?(P.g||1):1,inGame?sat(1-P.pos.y/180):0,inGame?P.speed:0);
  {const bd=Math.hypot(camera.position.x-BASE.x,camera.position.z-BASE.z);baseGroup.userData.trees.visible=bd<14000;baseGroup.userData.palms.forEach(p=>{p.visible=bd<7000;});baseGroup.userData.avenue.forEach(p=>{p.visible=bd<6000;});baseGroup.userData.hangar.visible=bd<6000;baseGroup.userData.lod.visible=bd<8000;baseGroup.userData.lodLH.visible=bd<8000;baseGroup.userData.detail.visible=bd<9000&&!(G.indoor>.6);}
  baseGroup.userData.spin.forEach(o=>{o.rotation[o.userData.ax]+=dt*o.userData.sp;});
  {let best=null,bd=1e9;W.forEach((w,i)=>{if(w.state==='gone')return;const d=camera.position.distanceTo(w.pos);if(d<bd){bd=d;best=i;}});
    if(best!==null&&inGame){const w=W[best];setWingVoice(w.state==='stall'?.08:(G.mode==='cut'?(w.power===undefined?.8:w.power):.8),spatial(w,spW[best]));}else setWingVoice(0,{prox:0,pan:0,dop:1,muf:1});}
  // 地上では排気が床の埃を吹き飛ばす
  if(inGame&&P.mesh.userData.gear.visible&&P.power>.3&&Math.random()<.5){fwdOf(P.yaw,0,tA);for(const s of[-1,1])puff(P.pos.x+tA.z*s*2.55-tA.x*(14+Math.random()*10),P.pos.y-2.8,P.pos.z-tA.x*s*2.55-tA.z*(14+Math.random()*10),-tA.x*(20+P.power*40),2+Math.random()*5,-tA.z*(20+P.power*40),2+Math.random()*2.5,.7+Math.random()*.5,.22);}
  if(P.elight){const ud=P.mesh.userData;P.elight.intensity=((P.power>=.28?P.power*P.power*1.1:0)+(ud.ign||0)*5)*(.85+.15*Math.sin(G.t*41))*(G.indoor>0?1.6:.6);}
  setLoops(inGame?sat(P.power*.9+.2)*(P.power<.2?P.power*5:1):0,inGame&&(P.boosting||P.power>1.2)?1:0,inGame?sat(P.wind/55*.7+G.gloom*.3+(P.turb||0)*.2):G.mode==='title'?.25:0,inGame?G.rain:0,inGame?spatial(P,spP):null);
}
let last=0,fpsAcc=0,fpsN=0;
function step(dt){
  G.dt=dt;
  if(G.mode==='pause'){renderFrame();return;}
  G.t+=dt;U.uTime.value+=dt;U.uSpin.value+=dt*.01;
  readInput();
  if(G.mode==='play'){G.missionT+=dt;updatePlayer(dt);updateWing(dt);updatePhase(dt);if(G.mode==='play'){chaseCam(dt);updateHUD(dt);}}
  else if(G.mode==='cut')updateCut(dt);
  else if(G.mode==='dying'){updateDying(dt);updateWing(dt);}
  else if(G.mode==='title'||G.mode==='result'||G.mode==='over'){
    if(G.mode==='title'&&G.optPrev&&G.insp){const q=G.insp,ce=Math.cos(q.el),tx=P.pos.x+(q.tx||0),ty=P.pos.y+(q.ty||0),tz=P.pos.z+(q.tz||0);G.indoor=q.indoor||0;setCam(tx+Math.sin(q.az)*ce*q.r,ty+Math.sin(q.el)*q.r,tz+Math.cos(q.az)*ce*q.r,tx,ty,tz,q.fov||30);}
    else if(G.mode==='title'&&G.optPrev){const a=G.t*.2+.9,cx=Math.sin(a)*30,cz=Math.cos(a)*42,l=Math.hypot(cx,cz),k=innerWidth>760?9:0;G.indoor=.5;setCam(P.pos.x+cx,P.pos.y+5.5+Math.sin(a*.5)*4,P.pos.z+2+cz,P.pos.x+cz/l*k,P.pos.y+.6,P.pos.z+2-cx/l*k,40);}
    else if(G.mode==='title'){const a=G.t*.02+.6;G.indoor=0;setCam(Math.sin(a)*17000,33000,Math.cos(a)*17000+3000,0,0,-800,48);}
    else if(G.mode==='result'){const a=G.t*.05;setCam(BASE.x-260*Math.cos(a),RWY_Y+120,P.pos.z-260*Math.sin(a),P.pos.x,P.pos.y,P.pos.z,46);}
  }
  if(window.__PCAM)window.__PCAM(camera,dt);
  updateCommon(dt);
  {let dmin=camera.position.distanceTo(P.pos);for(const w of W)if(w.mesh.visible)dmin=Math.min(dmin,camera.position.distanceTo(w.pos));
    const bx=camera.position.x-BASE.x,bz=camera.position.z-BASE.z,gnd=Math.abs(bx)<2400&&Math.abs(bz)<2700?Math.max(islandH(bx,bz),0):0,alt=camera.position.y-gnd;
    let nr=(G.indoor>0||G.mode==='title'||G.mode==='boot')?1.5:Math.max(1.5,Math.min(20,dmin-19,alt*.45));if(nr>2&&Math.abs(bx)<2400&&Math.abs(bz)<2700&&camera.position.y<200){const c0=camera.position;let db=1e9;for(const c of baseGroup.userData.colliders){const dx=Math.max(c[0]-c0.x,0,c0.x-c[3]),dy=Math.max(c[1]-c0.y,0,c0.y-c[4]),dz=Math.max(c[2]-c0.z,0,c0.z-c[5]),d=dx*dx+dy*dy+dz*dz;if(d<db)db=d;}const hx=Math.max(Math.abs(bx)-53,0),hzz=Math.max(Math.abs(bz-HANGAR_Z)-92,0);db=Math.min(Math.sqrt(db),Math.hypot(hx,hzz));nr=Math.max(1.5,Math.min(nr,db*.6));}
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
  try{step(dt);}catch(e){console.error(e);if(G.mode==='cut'){try{endCut();}catch(_){showTitle();}}}
  fpsAcc+=dt;fpsN++;
  if(G.mode==='title'){fpsAcc=0;fpsN=0;}   // タイトルの重い俯瞰で下がった解像度を本編へ持ち込まない
  if(fpsAcc>1.5){const fps=fpsN/fpsAcc;fpsAcc=0;fpsN=0;
    if(fps<36&&view.scale>.6){view.scale=Math.max(.6,view.scale*.85);view.upT=-8;resize();renderFrame();}
    else if(fps>55&&view.scale<1){view.upT=(view.upT||0)+1;if(view.upT>=3){view.upT=0;view.scale=Math.min(1,view.scale*1.1);resize();renderFrame();}}
    else view.upT=0;}
}

// ───────────────────────── 起動 ─────────────────────────
// 聞き手（カメラ）から見た機体の近さ・左右・遠ざかる速さ
function spatial(o,st){const d=camera.position.distanceTo(o.pos);tA.set(1,0,0).applyQuaternion(camera.quaternion);tB.copy(o.pos).sub(camera.position);
  const pan=clamp(tB.dot(tA)/(d+8)*1.5,-1,1),vr=st.d===undefined||Math.abs(d-st.d)>140?0:(d-st.d)/Math.max(G.dt||.016,1e-3);st.d=d;st.vr=damp(st.vr||0,vr,9,G.dt||.016);
  return{prox:clamp(Math.pow(48/Math.max(d,7),.9),.04,3.6),pan,dop:clamp(1-st.vr/343,.72,1.38),muf:clamp(100/Math.max(d,20),.3,1.2)};}
const spP={},spW=[{},{}];
let strikeGlow=null;
let sprayTrail,puffs=[],ships=[],dpods=[],tether;const qT=new THREE.Quaternion();
function initSeaLife(){
  sprayTrail=makeTrail();sprayTrail.mesh.material.uniforms.uColor.value.set(1.0,1.06,1.12);
  for(let i=0;i<70;i++)puffs.push({m:makeBillboard(new V3(.95,1.0,1.06)),life:0,max:1,vel:new V3(),s:1});
  for(const[k,x,z,h,sp]of[['cargo',-1100,BASE.z-3600,2.5,7],['fish',420,BASE.z-2300,.6,4],['cargo',1700,BASE.z-5400,-.4,7],['fish',-380,BASE.z-4700,3.6,4],['patrol',900,BASE.z-1900,1.9,11],['fish',260,BASE.z-6100,5.2,4]]){const m=buildShip(k);scene.add(m);overlay.add(m.userData.wake);overlay.add(m.userData.bow);ships.push({m,x,z,h,sp,ph:x});}
  for(const[x,z]of[[-55,BASE.z-3350],[70,BASE.z-4600],[35,BASE.z-1750]]){const pod={x,z,z0:z,d:[]};for(let i=0;i<5;i++){const m=buildDolphin();m.visible=false;scene.add(m);pod.d.push({m,ox:(i-2)*4.5+((i*7)%3),oz:(i%2)*6+i*2.2,ph:i*.37+x*.01,was:false});}dpods.push(pod);}
  const tg=new THREE.CylinderGeometry(.2,.2,1,6);tg.rotateX(Math.PI/2);tether=new THREE.Mesh(tg,glowMat(new V3(.5,2.6,3.6),0));tether.visible=false;tether.frustumCulled=false;overlay.add(tether);
}
function puff(x,y,z,vx,vy,vz,s,life,a){const p=puffs.find(q=>q.life<=0);if(!p)return;p.a=a||1;p.life=p.max=life;p.m.position.set(x,y,z);p.vel.set(vx,vy,vz);p.s=s;p.m.visible=true;}
function updateSeaLife(dt){
  // 船
  for(const s of ships){s.x-=Math.sin(s.h)*s.sp*dt;s.z-=Math.cos(s.h)*s.sp*dt;const L=s.m.userData.len;
    if(s.m.userData.radar)s.m.userData.radar.rotation.y+=dt*2;const bw=s.m.userData.bow;bw.position.set(s.x,.8,s.z);bw.rotation.y=s.h;bw.children.forEach(c=>c.material.uniforms.uAlpha.value=.7);
    s.horn=(s.horn||0)-dt;if(L>60&&s.horn<=0&&G.mode==='play'&&Math.hypot(P.pos.x-s.x,P.pos.z-s.z)<700&&P.pos.y<500){s.horn=40;SFX.horn();}
    s.m.position.set(s.x,Math.sin(G.t*.5+s.ph)*.4,s.z);s.m.rotation.set(Math.sin(G.t*.4+s.ph)*.012,s.h,Math.sin(G.t*.6+s.ph)*.02,'YXZ');
    const w=s.m.userData.wake;w.position.set(s.x+Math.sin(s.h)*L*2.0,.7,s.z+Math.cos(s.h)*L*2.0);w.rotation.set(-Math.PI/2,s.h,0,'YXZ');w.material.uniforms.uAlpha.value=.8;}
  // イルカの群れ
  for(const pod of dpods){pod.z-=6*dt;if(pod.z<pod.z0-900)pod.z=pod.z0;const near=Math.hypot(P.pos.x-pod.x,P.pos.z-pod.z)<3000||Math.hypot(camera.position.x-pod.x,camera.position.z-pod.z)<3000;
    for(const d of pod.d){const T=3.6,ph=((G.t+d.ph*T)%T)/T,air=near&&ph<.34,u=ph/.34,x=pod.x+d.ox,z=pod.z+d.oz-(air?u*9:0);
      d.m.visible=air;if(air){d.m.position.set(x,Math.sin(u*Math.PI)*3.0-.5,z);d.m.rotation.set(Math.cos(u*Math.PI)*1.0,0,0,'YXZ');if(u>.9&&!d.spl){d.spl=1;puff(x,3.6,z-1,0,5,0,3,.8);}}
      if(air&&!d.was)puff(x,3.6,z,0,6,-3,2.8,.8);if(!air)d.spl=0;d.was=air;}}
  // 海面すれすれの飛沫
  const flying=G.mode==='play'||G.mode==='dying'||G.mode==='cut';
  let sp=flying&&islandH(P.pos.x-BASE.x,P.pos.z-BASE.z)<-3?sat(1.12-(P.pos.y-8)/19)*sat(P.speed/110):0;G.spray=sp;
  fwdOf(P.yaw,0,tA);tB.set(P.pos.x-tA.x*12,4.5,P.pos.z-tA.z*12);tC.set(tA.z,0,-tA.x);
  {const wob=Math.sin(G.t*7.3)*1.6+Math.sin(G.t*17.1)*.9;tB.addScaledVector(tC,wob);pushTrail(sprayTrail,tB,tC,sp*.3*(.6+.4*Math.sin(G.t*11.7)),dt,(5+sp*6)*(.75+.5*Math.abs(Math.sin(G.t*5.1))));tB.addScaledVector(tC,-wob);}
  if(sp>.05){G.spT=(G.spT||0)-dt;if(G.spT<=0){G.spT=.012+Math.random()*.03;const n=2+(Math.random()<sp?1:0)+(Math.random()<.4?1:0);
    for(let k=0;k<n;k++){const u=Math.random()*2-1,r=Math.sign(u)*Math.pow(Math.abs(u),.7)*17,ahead=-6+Math.random()*22,f=.8+Math.random()*.22,big=Math.random()<.12?1.5:1;
      puff(tB.x+tA.x*ahead+tC.x*r,3.6+Math.random()*1.5,tB.z+tA.z*ahead+tC.z*r,tA.x*P.speed*f+tC.x*(r*.6+(Math.random()-.5)*10),(12+Math.random()*26)*(.5+sp*.6)*big,tA.z*P.speed*f+tC.z*(r*.6+(Math.random()-.5)*10),(1.1+Math.random()*2.3)*(.5+sp)*big,.45+Math.random()*.75);}}}
  for(const p of puffs){if(p.life<=0)continue;p.life-=dt;if(p.life<=0){p.m.visible=false;continue;}const k=p.life/p.max;p.vel.y-=11*dt;p.m.position.addScaledVector(p.vel,dt);if(p.m.position.y<3.5&&p.a===1)p.m.position.y=3.5;
    const s=p.s*(1+(1-k)*4.5);p.m.scale.set(s,s,1);p.m.quaternion.copy(camera.quaternion);p.m.material.uniforms.uAlpha.value=Math.min((1-k)*6,1)*k*.6*p.a;}
  {const u=baseGroup.userData;if(u.lhBeam){u.lhBeam.rotation.y=G.t*.5;u.lhBeamM.opacity=.22*sat((G.gloom||0)*.9+(G.gold||0)*.8);u.lhBeam.visible=u.lhBeamM.opacity>.01;}
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
  P.elight=new THREE.PointLight(0xff9a52,0,70,1.8);P.elight.position.set(0,1.2,14);m.add(P.elight);
  P.armor=addArmor(m);m.userData.gear=buildGear(m.userData.shape,m.userData.bodyHex);m.add(m.userData.gear);m.userData.gear.visible=gearOn;m.userData.pod.visible=podOn;
  m.traverse(o=>{if(o.isMesh&&o.material.isMeshStandardMaterial){o.castShadow=true;o.receiveShadow=true;}});
  m.userData.onIgn=()=>{if(G.mode==='cut')SFX.ignite();};G.wet=undefined;
  if(old){syncAC(P);if(G.mode==='title'){P.hull=100;resetArmor();}else shedArmor(true);}
}
let IS_TOUCH=false;
// 画面の大きさに合わせて、表示の縮尺を決める（高さ 620px 未満なら縮める）
function fitUI(){const h=innerHeight,w=innerWidth,ui=Math.max(.5,Math.min(1,h/620,w/860));document.documentElement.style.setProperty('--ui',ui.toFixed(3));document.body.classList.toggle('small',ui<.97);}
// タッチ端末向けに、案内文のキー名を画面のボタン名に置き換える
function tk(s){if(!IS_TOUCH)return s;return s.replace(/<kbd>W<\/kbd><kbd>S<\/kbd> 機首の上げ下げ　<kbd>A<\/kbd><kbd>D<\/kbd> 旋回　<kbd>Shift<\/kbd> ブースト/,'画面の左側をなぞって操縦　<kbd>ブースト</kbd> で加速').replace(/<kbd>Space<\/kbd>/g,'<kbd>発射</kbd>').replace(/<kbd>Shift<\/kbd>/g,'<kbd>ブースト</kbd>');}
function boot(){
  const steps=[
    ()=>{view.q=opts.q;resize(true);U.tNoise.value=makeNoise3D(96);},
    ()=>{U.tDetail.value=makeDetail3D(32);},
    ()=>{buildGroundTex();},
    ()=>{U.tNoise2.value=makeNoise2D(256);GLOWTEX=glowTexture();buildEnv();buildOcean();},
    ()=>{sunL=new THREE.DirectionalLight(0xffffff,3);scene.add(sunL);scene.add(sunL.target);
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
    ()=>{rctx=$('radar').getContext('2d');hctx=$('fhud').getContext('2d');bindInput();showTitle();renderer.compile(scene,camera);step(.016);},
  ];
  let i=0;const run=()=>{try{steps[i]();}catch(e){console.error(e);$('load').firstElementChild.textContent='起動に失敗しました：'+e.message;return;}
    i++;$('loadBar').style.transform=`scaleX(${i/steps.length})`;
    if(i<steps.length)setTimeout(run,30);else{$('load').hidden=true;last=performance.now();requestAnimationFrame(frame);
      window.__SR={cloudMat,setCam,showTitle,damage,spouts,cloudCut:()=>{cloudReset=true;},setDoors,hangarLight,resize,opts,strikes,input,endCut:()=>{if(CUT)endCut();},G,P,W,U,step,camera,startRun,startCut,skipCut,CUTS:{CUT_INTRO,CUT_FIRE1,CUT_FIRE2,CUT_LAND},view,tick(n,dt){for(let k=0;k<n;k++)step(dt||1/30);}};}};
  setTimeout(run,30);
}
boot();

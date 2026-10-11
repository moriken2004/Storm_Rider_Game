// 予告編の台本（第 2 版・95 秒）。ページ内で実行される。at＝開始秒。次のショットの at までが長さ。
// 音楽（メドレー）の強い音に合わせて切り替え位置を決めている：10.14／14.76／41.9〜44.2／57.2／89.74 秒
(()=>{const S=__SR,G=S.G,P=S.P,W=S.W,I=S.input,V=THREE.Vector3,BZ=21000;
const $=id=>document.getElementById(id);
const fw=new V(),rt=new V(),up=new V(0,1,0),cp=new V(),cl=new V();
const basis=(o)=>{const y=(o||P).yaw;fw.set(-Math.sin(y),0,-Math.cos(y));rt.set(Math.cos(y),0,-Math.sin(y));};
let pc=null,TT=0;window.__PCAM=(cam)=>{if(pc)pc(cam);};
const look=(cam,pos,tgt,fov)=>{cam.up.set(0,1,0);cam.position.copy(pos);cam.lookAt(tgt);if(fov&&cam.fov!==fov){cam.fov=fov;cam.updateProjectionMatrix();}};
const L=(a,b,k)=>a+(b-a)*k,ez=k=>k*k*(3-2*k);
// 機体基準のカメラ。fn(k) → [前,右,上, 注視点の前,右,上, 画角]。o は基準にする機体
const rel=(fn,o)=>cam=>{const a=fn(TT),q=o||P;basis(q);cp.copy(q.pos).addScaledVector(fw,a[0]).addScaledVector(rt,a[1]).addScaledVector(up,a[2]);cl.copy(q.pos).addScaledVector(fw,a[3]).addScaledVector(rt,a[4]).addScaledVector(up,a[5]);look(cam,cp,cl,a[6]);};
const auto=(alt,steer=true)=>{P.inv=1;const T=G.target;I.tx=0;I.ty=0;I.tBoost=false;I.tAct=false;
  if(T&&steer){const dx=T.x-P.pos.x,dz=T.z-P.pos.z;let e=Math.atan2(-dx,-dz)-P.yaw;while(e>Math.PI)e-=6.2832;while(e<-Math.PI)e+=6.2832;I.tx=Math.max(-1,Math.min(1,-e*2.5));}
  if(alt!==undefined)I.ty=Math.max(-1,Math.min(1,(alt-P.pos.y)/200));};
const run=(n,alt)=>{for(let i=0;i<n;i++){auto(alt);S.step(1/30);}};
const noCut=()=>{try{if(G.mode==='cut')S.endCut();}catch(e){}};
const ffCut=(def,t0)=>{S.startCut(S.CUTS[def]);S.tick(Math.round(t0*30),1/30);};
const fire2=t0=>{noCut();pc=null;S.opts.diff=0;S.startRun('spare');G.spareGiven=true;P.hasPod=true;S.tick(30,1/30);ffCut('CUT_FIRE2',t0);};
const SH=[];const add=o=>SH.push(o);
// ── 序：水平線にそびえる台風へ向かう編隊／衛星からの眺め
add({at:0,name:'horizon',bars:1,fadeIn:2.2,cap:['観測史上、最大の台風。',2,5.9],setup(){S.opts.diff=0;S.startRun('approach');P.pos.set(60,150,BZ-3400);run(30,150);
  pc=cam=>{const k=TT;look(cam,cp.set(-260+90*k,30+14*k,BZ-2700-260*k),cl.set(0,2300,7000),50);};},frame(){auto(150);}});
add({at:6.4,name:'orbit',bars:1,label:'台風 13 号〈オロチ〉　中心気圧 890hPa　上陸まで 18 時間',setup(){S.showTitle();$('title').hidden=true;
  pc=cam=>{const a=.5+TT*.06;look(cam,cp.set(Math.sin(a)*14500,L(25500,21500,ez(TT)),Math.cos(a)*14500+2500),cl.set(0,0,-600),44);};},frame(){}});
// ── 基地：ゲート開放・エンジン始動・離陸（本編の出撃カットから）
add({at:10,name:'gate',bars:1,fadeIn:.12,label:'ミズハ海洋気象基地',setup(){pc=null;S.showTitle();$('title').hidden=true;ffCut('CUT_INTRO',16.6);},frame(){}});
add({at:13,name:'ignite',bars:1,setup(){S.tick(Math.round(4.2*30),1/30);},frame(){}});
add({at:14.76,name:'takeoff',bars:1,cap:['嵐を消す翼、出撃。',.4,3],setup(){S.tick(Math.round(6.2*30),1/30);},frame(){}});
// ── 本編
add({at:18,name:'skim',bars:1,setup(){noCut();S.startRun('approach');P.pos.set(400,15.5,BZ-7000);S.tick(20,1/30);pc=rel(k=>[L(70,22,k),L(60,44,k),L(9,5,k),6,0,1,38]);},frame(){auto();P.pos.y=15.5;P.pitch=0;I.ty=0;}});
add({at:20.2,name:'formation',bars:1,setup(){P.pos.y=380;S.tick(40,1/30);pc=rel(k=>[L(85,58,k),L(-34,-8,k),L(7,15,k),0,5,0,27]);},frame(){auto(380);}});
add({at:22.4,name:'bands',hud:1,setup(){pc=null;S.opts.diff=2;S.startRun('bands');P.pos.set(0,420,7600);P.yaw=0;run(150,420);},frame(){auto(420);}});
add({at:25.3,name:'front',bars:1,setup(){pc=rel(k=>[L(54,40,k),L(-17,-10,k),L(4,6.5,k),0,0,1,36]);},frame(){auto(420);}});
add({at:27.5,name:'trio',bars:1,setup(){pc=rel(k=>[L(14,-8,k),L(66,56,k),L(9,5,k),0,0,0,30]);},frame(){auto(420);}});
add({at:29.7,name:'wall',hud:1,setup(){pc=null;S.startRun('wall');P.pos.set(0,420,4150);P.yaw=0;run(45,420);},frame(){auto(420);}});
add({at:32.6,name:'hit',bars:1,setup(){P.hull=100;pc=rel(k=>[L(-34,-26,k),L(18,12,k),7,6,0,1,46]);this.h=0;},frame(t){auto(420);if(t>.3&&this.h<1){this.h=1;P.inv=0;P.hull=100;S.damage(14,'落雷の直撃を受けた');}if(t>1.05&&this.h<2){this.h=2;P.inv=0;P.hull=100;S.damage(12,'落雷の直撃を受けた');}}});
add({at:34.8,name:'wingman',bars:1,setup(){pc=rel(k=>[L(30,20,k),L(-18,-12,k),L(3,5,k),0,0,.5,34],W[1]);},frame(){auto(420);}});
add({at:37,name:'cockpit',bars:1,setup(){S.startRun('bands');P.pos.set(0,420,9800);P.yaw=0;run(40,420);pc=rel(k=>[L(15.5,13.5,k),L(6.5,5.2,k),L(3.4,3,k),6.3,0,1.75,24]);},frame(t){auto(420);I.tx=Math.sin(t*2.6)*.75;}});
add({at:39.2,name:'break',bars:1,setup(){S.startRun('wall');P.pos.set(0,420,2800);P.yaw=0;run(8,420);pc=rel(k=>[-58,L(10,0,k),L(13,16,k),220,0,30,62]);},frame(){auto(420,false);}});
// ── 台風の目（音楽が静まる所）
add({at:41.9,name:'eye',bars:1,cap:['台風の目。',.5,2.8],setup(){S.opts.diff=0;S.startRun('eye');run(40);pc=rel(k=>[-74,30,L(22,62,ez(k)),220,-20,46,58]);},frame(){auto();}});
add({at:45,name:'calm',bars:1,cap:['嵐は、内側から消す。',.6,3.6],setup(){pc=rel(k=>{const a=L(-.5,.5,k);return[Math.cos(a)*46,Math.sin(a)*46-10,L(6,11,k),2,0,0,30];});},frame(){auto();}});
add({at:49,name:'lock',hud:1,cap:['コアを撃て。',.6,3.5],setup(){pc=null;S.startRun('eye');run(50);},frame(){auto();}});
// ── 発射 → 白く飛ぶ瞬間が 57.2 秒（音楽の頂点）→ 台風が崩れていく
add({at:53,name:'fire',bars:1,setup(){fire2(.75);},frame(){}});
add({at:57.2,name:'collapse',bars:1,setup(){},frame(){}});
// ── 機体の紹介（格納庫）
add({at:65,name:'show',bars:1,fadeIn:.25,cap:['7 種の機体　×　7 色の塗装　×　3 段階の難易度',.6,6.6],setup(){pc=null;noCut();S.showTitle();$('bOpts').click();$('opts').style.display='none';this.i=-1;},
  frame(t){const i=Math.min(6,Math.floor(t));if(i!==this.i){this.i=i;$('oShape').children[[0,6,3,2,4,5,1][i]].click();$('oColor').children[[0,6,2,1,4,3,5][i]].click();S.cloudCut();}
    const u=t-i;G.insp={az:-2.2+i*.9+u*.5,el:.2+.05*Math.sin(i*2.1),r:L(41,35,u),ty:1,fov:36,indoor:.5};}});
// ── 帰還
add({at:72,name:'return',bars:1,fadeIn:.3,cap:['必ず、帰ってこい。',.5,3.6],setup(){G.insp=null;$('opts').style.display='';document.querySelector('#opts .bBack').click();$('oShape').children[0].click();$('oColor').children[0].click();fire2(22.4);},frame(){}});
add({at:76,name:'land',bars:1,setup(){noCut();S.startRun('ret');P.pos.set(30,300,BZ-3600);P.yaw=Math.PI;S.tick(10,1/30);ffCut('CUT_LAND',5.4);},frame(){}});
add({at:81.4,name:'home',bars:1,setup(){S.tick(Math.round(5.2*30),1/30);},frame(){}});
add({at:84.9,name:'hero',bars:1,fadeOut:1.0,setup(){noCut();S.showTitle();$('bOpts').click();$('opts').style.display='none';P.pos.x=30;P.pos.z-=955;P.mesh.position.copy(P.pos);},
  frame(t,k){G.insp={az:L(-2.75,-2.25,k),el:L(.06,.12,k),r:L(30,25,k),ty:1.2,tz:-3,fov:30,indoor:0};}});
// ── 題名（最後の一撃に合わせて現れる）
add({at:89.74,name:'title',fadeOut:1.6,titleUI:1,label2:'ブラウザで遊べる 3D フライトアクション',setup(){G.insp=null;$('opts').style.display='';document.querySelector('#opts .bBack').click();S.showTitle();},frame(){}});
const END=95;SH.forEach((s,i)=>{s.dur=(i+1<SH.length?SH[i+1].at:END)-s.at;});
window.TR={SH,END,setT:k=>{TT=k;}};})();

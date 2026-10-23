// ───────────────────────── AquaTopia：水陸両用の 2 人乗りボートで、基地の島とまわりの海（海中も）を探検する ─────────────────────────
// 水上：波に揺られ、航跡としぶき。陸上：砂浜やゆるい坂を走る（急な崖は登れない）。海中：潜って海底を見る。
// 重くならないよう、細かく描くのはボートのまわりだけ：1.25m 間隔の地面（基地の地形の格子を補間＋細かな凹凸）、草、石、海藻、珊瑚、魚、泡
const EX={on:false,b:null,pos:new V3(),vel:new V3(),yaw:0,spd:0,depth:0,mode:'water',t:0,cam:new V3(),camL:new V3(),pc:new V3(1e9,0,1e9),gc:new V3(1e9,0,1e9),
  patch:null,grass:null,rocks:null,weed:null,coral:null,fish:null,surf:null,hud:null,bub:0,wake:0,lamp:null,yawRate:0,pitch:0,roll:0};
// ── ボート：添付の写真の「アクアトピア」型。テラコッタ色の丸い浮き輪の船体に黄土色の帯、水色の操縦塔（丸い灯・機番 24）、
// 赤い管を載せた柱、後ろの銀の網に囲まれた機関、手すり、ハンドル、2 人の乗員
let EXTEX=null;
function exNumTex(){if(EXTEX)return EXTEX;const c=document.createElement('canvas');c.width=128;c.height=64;const x=c.getContext('2d');x.fillStyle='rgba(0,0,0,0)';x.fillRect(0,0,128,64);
  x.fillStyle='#c4321e';x.font='bold 54px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText('24',64,34);EXTEX=new THREE.CanvasTexture(c);EXTEX.encoding=THREE.sRGBEncoding;return EXTEX;}
function buildAquaBoat(){
  const g=new THREE.Group(),S=(c,r,m,o)=>std(Object.assign({color:lin(c),roughness:r,metalness:m},o||{}));
  const rub=m=>{m.onBeforeCompile=sh=>{sh.uniforms.tN2=U.tNoise2;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vOp;').replace('#include <begin_vertex>','#include <begin_vertex>\nvOp=position;');
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D tN2;varying vec3 vOp;').replace('#include <color_fragment>','#include <color_fragment>\n{float n=texture2D(tN2,vOp.xz*1.3+vOp.y*0.7).b,f=texture2D(tN2,vOp.xz*7.0).b;diffuseColor.rgb*=0.86+0.22*n+0.06*f;diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.05,1.0,0.92),smoothstep(0.6,0.8,n)*0.4);}')
        .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor*=0.85+0.3*texture2D(tN2,vOp.xz*3.0).b;');};m.customProgramCacheKey=()=>'exRub'+m.color.getHex();return m;};
  const plate=m=>{m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vOp;').replace('#include <begin_vertex>','#include <begin_vertex>\nvOp=position;');
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vOp;').replace('#include <color_fragment>','#include <color_fragment>\n{vec2 q=vOp.xz*9.0;vec2 c=fract(q+vec2(step(1.0,mod(floor(q.y),2.0))*0.5,0.0))-0.5;float d=abs(c.x)+abs(c.y)*2.4;diffuseColor.rgb*=0.82+0.3*smoothstep(0.32,0.22,d);}');};m.customProgramCacheKey=()=>'exPlate';return m;};
  const tube=rub(S(0x9b5b46,.62,.05)),strap=S(0xc9a77c,.7,.05),deck=plate(S(0x8c8778,.85,.1)),teal=S(0x58b9b6,.45,.15),chrome=S(0xd6dadd,.18,1),dark=S(0x24282c,.6,.4),
    red=S(0xb2342a,.45,.2),brass=S(0xb08a3a,.35,.8),seat=S(0x3d4a52,.8,.05),glass=S(0xfff4d6,.1,0,{emissive:new THREE.Color(1.6,1.45,1.1)}),skin=S(0xc89878,.7,0),shirt=S(0x3a6fa8,.85,0),shirt2=S(0xd8a23a,.85,0),hair=S(0x2a1d14,.8,0);
  // 使い込んだ質感：喫水線の藻と水垢、縦に垂れた水の跡、細かなすり傷、すき間の汚れ、上面の日焼け、水に近いほど濡れて艶。k は効き具合（金属は弱め）
  const wear=(m,k)=>{const prev=m.onBeforeCompile,pk=m.customProgramCacheKey;m.onBeforeCompile=(sh,r2)=>{if(prev&&prev!==THREE.Material.prototype.onBeforeCompile)prev.call(m,sh,r2);Object.assign(sh.uniforms,{tWn:U.tNoise2,uBY:EXU.uBoatY});
      sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBw;varying vec3 vBn;').replace('#include <project_vertex>','#include <project_vertex>\nvBw=(modelMatrix*vec4(transformed,1.0)).xyz;vBn=normalize(mat3(modelMatrix)*objectNormal);');
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D tWn;uniform float uBY;varying vec3 vBw;varying vec3 vBn;').replace('#include <color_fragment>',`#include <color_fragment>
{float hg=vBw.y-uBY;vec3 c=diffuseColor.rgb;float K=${k.toFixed(2)};vec3 an=abs(normalize(vBn));vec2 tp=an.y>0.6?vBw.xz:(an.x>an.z?vBw.zy:vBw.xy);
 float n=texture2D(tWn,tp*0.9).b,f=texture2D(tWn,tp*6.0+0.3).b,ff=texture2D(tWn,tp*23.0+0.7).b;c*=mix(1.0,0.84+0.24*n+0.08*f,K);
 float wl=1.0-smoothstep(0.2,0.36+0.05*n,hg);c=mix(c,c*vec3(0.52,0.58,0.4)*(0.8+0.4*f),wl*K*0.85);
 float stn=smoothstep(0.55,0.85,texture2D(tWn,vec2((vBw.x+vBw.z)*1.6,hg*0.25)).b)*(1.0-an.y)*smoothstep(0.25,0.5,hg)*(1.0-smoothstep(0.9,1.6,hg));c=mix(c,c*vec3(0.8,0.78,0.72),stn*K*0.5);
 float scr=smoothstep(0.012,0.0,abs(texture2D(tWn,tp*vec2(9.0,1.3)+0.2).b-0.5))*smoothstep(0.55,0.75,texture2D(tWn,tp*1.7).b);c=mix(c,c*1.25+0.05,scr*K*0.45);
 c=mix(c,mix(c,vec3(dot(c,vec3(0.33))),0.15)*1.04+0.008,smoothstep(0.6,0.95,vBn.y)*K*0.35);
 c*=1.0-0.22*smoothstep(0.55,0.0,hg)*K;diffuseColor.rgb=c;}`).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor*=mix(0.45,1.0,smoothstep(0.15,0.55,vBw.y-uBY));roughnessFactor*=0.9+0.2*texture2D(tWn,vBw.xz*4.0).b;');};
    m.customProgramCacheKey=()=>(pk?pk.call(m):'')+'wear'+k;return m;};
  wear(tube,1);wear(strap,1);wear(deck,.9);wear(teal,.8);wear(dark,.7);wear(red,.7);wear(seat,.6);wear(chrome,.25);wear(brass,.4);
  const A=(geo,m,x,y,z,o)=>{const q=new THREE.Mesh(geo,m);q.position.set(x,y,z);if(o){if(o.rx)q.rotation.x=o.rx;if(o.ry)q.rotation.y=o.ry;if(o.rz)q.rotation.z=o.rz;if(o.s)q.scale.set(o.s[0],o.s[1],o.s[2]);}q.castShadow=true;g.add(q);return q;};
  // 船体：丸い浮き輪（上下にややつぶれた円環）と、まわりを巻く帯 16 本、底の黒いスカート
  const R=2.05,r=.5;A(new THREE.TorusGeometry(R,r,18,48),tube,0,.38,0,{rx:Math.PI/2,s:[1,1,.82]});
  for(let k=0;k<16;k++){const a=k/16*Math.PI*2,b=new THREE.Mesh(new THREE.TorusGeometry(r*1.02,.045,8,20),strap);b.position.set(Math.cos(a)*R,.38,Math.sin(a)*R);b.rotation.y=-a;b.scale.set(1,.82,1);b.castShadow=true;g.add(b);}
  A(new THREE.TorusGeometry(R,.06,8,48),strap,0,.79,0,{rx:Math.PI/2});   // 上の縁の帯
  A(new THREE.CylinderGeometry(R-.15,R-.35,.42,40),dark,0,.02,0);        // 底
  // 甲板と、縁の金属の帯
  A(new THREE.CylinderGeometry(R-.1,R-.1,.12,40),deck,0,.66,0);A(new THREE.TorusGeometry(R-.1,.035,6,40),chrome,0,.72,0,{rx:Math.PI/2});
  // 操縦塔（前）：角の丸い水色の箱、前面の丸い灯（真鍮の縁）、機番、小窓、計器
  const tw=new THREE.Group();tw.position.set(0,.72,-.85);g.add(tw);
  const T=(geo,m,x,y,z,o)=>{const q=new THREE.Mesh(geo,m);q.position.set(x,y,z);if(o){if(o.rx)q.rotation.x=o.rx;if(o.ry)q.rotation.y=o.ry;if(o.rz)q.rotation.z=o.rz;if(o.s)q.scale.set(o.s[0],o.s[1],o.s[2]);}q.castShadow=true;tw.add(q);return q;};
  {const sh=new THREE.Shape(),w=.62,h=1.15,rr=.18;sh.moveTo(-w+rr,0);sh.lineTo(w-rr,0);sh.quadraticCurveTo(w,0,w,rr);sh.lineTo(w,h-rr);sh.quadraticCurveTo(w,h,w-rr,h);sh.lineTo(-w+rr,h);sh.quadraticCurveTo(-w,h,-w,h-rr);sh.lineTo(-w,rr);sh.quadraticCurveTo(-w,0,-w+rr,0);
    const eg=new THREE.ExtrudeGeometry(sh,{depth:.8,bevelEnabled:true,bevelThickness:.06,bevelSize:.06,bevelSegments:3,curveSegments:8});eg.translate(0,0,-.4);T(eg,teal,0,0,0);}
  T(new THREE.CylinderGeometry(.2,.2,.08,24),brass,0,.55,-.47,{rx:Math.PI/2});T(new THREE.SphereGeometry(.16,20,14,0,Math.PI*2,0,Math.PI/2),glass,0,.55,-.5,{rx:-Math.PI/2});
  for(const s of[1,-1])T(new THREE.CylinderGeometry(.07,.07,.05,16),brass,s*.36,.85,-.47,{rx:Math.PI/2});
  {const nm=new THREE.MeshStandardMaterial({map:exNumTex(),transparent:true,alphaTest:.4,roughness:.5,polygonOffset:true,polygonOffsetFactor:-2});for(const s of[1,-1]){const d=T(new THREE.PlaneGeometry(.55,.28),nm,s*.69,.38,.05,{ry:s*Math.PI/2});d.castShadow=false;}}
  T(new THREE.BoxGeometry(.5,.3,.06),dark,0,.86,.45);T(new THREE.CylinderGeometry(.05,.05,.05,12),brass,-.12,.88,.49,{rx:Math.PI/2});T(new THREE.CylinderGeometry(.05,.05,.05,12),brass,.12,.88,.49,{rx:Math.PI/2});
  // 柱と赤い管（潜望鏡のような）、上の帽子と灯
  T(new THREE.CylinderGeometry(.065,.075,1.9,12),chrome,-.25,2.0,0);T(new THREE.CylinderGeometry(.12,.12,.12,14),chrome,-.25,2.98,0);
  T(new THREE.CylinderGeometry(.11,.11,1.25,16),red,-.05,2.55,.1,{rz:Math.PI/2-.12});for(const s of[1,-1])T(new THREE.CylinderGeometry(.13,.13,.08,16),dark,-.05+s*.62,2.55+s*.075,.1,{rz:Math.PI/2-.12});
  T(new THREE.BoxGeometry(.18,.22,.18),dark,-.25,2.35,0);
  const seatIx=[];   /* 座席・ハンドル・乗員は後で前（機関の籠の側）向きへ回す */
  // 座席 2 つ（横並び）と背もたれ、ハンドル
  seatIx.push(g.children.length);
  for(const s of[1,-1]){A(new THREE.BoxGeometry(.62,.16,.55),seat,s*.42,.88,.35);A(new THREE.BoxGeometry(.62,.55,.12),seat,s*.42,1.15,.66,{rx:-.15});}
  A(new THREE.CylinderGeometry(.03,.03,.5,8),dark,-.42,1.12,-.15,{rx:.5});A(new THREE.TorusGeometry(.17,.025,8,20),dark,-.42,1.33,-.27,{rx:.9});
  seatIx.push(g.children.length);
  // 後ろの機関：箱と、銀の網の籠（輪と縦の棒）、中の羽根
  A(new THREE.BoxGeometry(1.0,.55,.55),dark,0,1.0,1.25);
  {const cg=new THREE.Group();cg.position.set(0,1.15,1.62);g.add(cg);const ring=(rr,z)=>{const q=new THREE.Mesh(new THREE.TorusGeometry(rr,.025,6,28),chrome);q.position.z=z;cg.add(q);};
    ring(.62,0);ring(.62,.42);ring(.35,.48);for(let k=0;k<12;k++){const a=k/12*Math.PI*2,q=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.42,4),chrome);q.rotation.x=Math.PI/2;q.position.set(Math.cos(a)*.62,Math.sin(a)*.62,.21);cg.add(q);}
    for(let k=0;k<8;k++){const a=k/8*Math.PI*2,q=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.62,4),chrome);q.rotation.z=a;q.position.z=.46;cg.add(q);}
    const fan=new THREE.Group();fan.position.z=.2;cg.add(fan);for(let k=0;k<4;k++){const bl=new THREE.Mesh(new THREE.BoxGeometry(.1,.5,.02),dark);bl.position.y=.25;const h=new THREE.Group();h.rotation.z=k*Math.PI/2;h.add(bl);fan.add(h);}
    fan.add(new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.1,12),brass).rotateX(Math.PI/2));g.userData.fan=fan;}
  // 手すり：後ろの座席を囲む銀の管
  {const pts=[];for(let k=0;k<=16;k++){const a=Math.PI*.15+k/16*Math.PI*.7;pts.push(new V3(Math.cos(a)*1.45,1.2,Math.sin(a)*1.2+.2));}g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,.03,6),chrome));
    for(const k of[0,8,16]){const p=pts[k];A(new THREE.CylinderGeometry(.025,.025,.48,6),chrome,p.x,.96,p.z);}}
  // 乗員 2 人（運転手と同乗者）：胴・腕・頭（髪）
  // 乗員：関節でつないだ体（骨盤・腹・胸・首・頭、上腕・前腕・手、太もも・すね・靴）。半袖・半ズボン、救命胴衣（帯と留め具）、運転手は帽子とサングラス
  const shorts=S(0x2b3444,.9,0),shoe=S(0xe8e6e0,.6,0),lj=S(0xe0661c,.72,0),bk=S(0x1c1d20,.6,.2),capM=S(0xf0eee8,.85,0),lens=S(0x0b0d10,.08,.6);
  const ell=(m,x,y,z,sx,sy,sz,rx)=>A(new THREE.SphereGeometry(1,20,14),m,x,y,z,{s:[sx,sy,sz],rx});
  const seg=(a,b,r0,r1,m,j)=>{const d=new V3().subVectors(b,a),o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,d.length(),14),m);o.position.copy(a).addScaledVector(d,.5);o.quaternion.setFromUnitVectors(new V3(0,1,0),d.normalize());o.castShadow=true;g.add(o);
    if(j!==false){const s2=new THREE.Mesh(new THREE.SphereGeometry(r0,12,10),m);s2.position.copy(a);s2.castShadow=true;g.add(s2);}return o;};
  const hand=(at,dir,m)=>{const h=new THREE.Group();h.position.copy(at);h.quaternion.setFromUnitVectors(new V3(0,0,-1),dir.clone().normalize());g.add(h);
    const pm=new THREE.Mesh(new THREE.SphereGeometry(1,12,10),m);pm.scale.set(.042,.022,.055);h.add(pm);const fg=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),m);fg.scale.set(.04,.02,.035);fg.position.set(0,-.012,-.055);fg.rotation.x=.7;h.add(fg);};
  const person=(x,col,drv)=>{const V=(a,b,c)=>new V3(a,b,c);
    ell(shorts,x,1.0,.4,.17,.1,.14);ell(col,x,1.13,.42,.16,.11,.115,.1);ell(col,x,1.3,.44,.19,.14,.12,.1);
    // 救命胴衣：胸と背の厚い板、肩の帯、腹の 2 本の帯と留め具
    ell(lj,x,1.29,.43,.205,.15,.14,.1);for(const yy of[1.17,1.24]){A(new THREE.TorusGeometry(.19,.008,4,24),bk,x,yy,.43,{rx:Math.PI/2,s:[1.05,.72,1]});A(new THREE.BoxGeometry(.04,.025,.012),S(0x30343a,.4,.5),x,yy,.3);}
    A(new THREE.BoxGeometry(.03,.16,.006),S(0xd8d8d8,.35,.3),x+.07,1.32,.297,{rx:.1});
    seg(V(x,1.42,.45),V(x,1.52,.43),.05,.046,skin);
    // 頭：卵形、鼻、耳、髪（運転手は帽子）、サングラス
    ell(skin,x,1.6,.43,.092,.112,.1);A(new THREE.SphereGeometry(.02,8,6),skin,x,1.585,.33,{s:[.8,1,1.2]});for(const s2 of[1,-1])A(new THREE.SphereGeometry(.022,8,6),skin,x+s2*.09,1.6,.44,{s:[.5,1,.8]});
    A(new THREE.SphereGeometry(.1,18,10,0,Math.PI*2,0,Math.PI*.55),hair,x,1.62,.445,{s:[1,1,1.03]});
    if(drv){A(new THREE.SphereGeometry(.104,18,10,0,Math.PI*2,0,Math.PI*.5),capM,x,1.635,.44);A(new THREE.CylinderGeometry(.08,.08,.01,18,1,false,0,Math.PI),capM,x,1.64,.37,{rx:.12,ry:Math.PI});
      A(new THREE.BoxGeometry(.15,.035,.012),lens,x,1.615,.335);}
    // 腕：肩→ひじ→手。運転手は前のハンドルを握り、同乗者は膝の上
    for(const s2 of[1,-1]){const sh=V(x+s2*.2,1.42,.45),el=drv?V(x+s2*.23,1.27,.24):V(x+s2*.22,1.18,.34),hd=drv?V(-.42+s2*.13,1.34,-.2):V(x+s2*.12,1.05,.12);
      ell(col,sh.x,sh.y,sh.z,.075,.07,.075);seg(sh,el,.055,.046,col);seg(el,hd,.042,.033,skin);hand(hd,hd.clone().sub(el),skin);}
    // 脚：腰→膝（太もも）→足首（すね）→靴
    for(const s2 of[1,-1]){const hp=V(x+s2*.09,1.0,.36),kn=V(x+s2*.11,1.03,.0),an=V(x+s2*.115,.76,-.06);seg(hp,kn,.075,.062,shorts);seg(kn,an,.052,.04,skin);
      A(new THREE.BoxGeometry(.09,.06,.22),shoe,an.x,.75,an.z-.07);A(new THREE.BoxGeometry(.092,.015,.225),S(0x5a5d62,.8,0),an.x,.718,an.z-.07);}};
  seatIx.push(g.children.length);
  person(-.42,shirt,true);person(.42,shirt2,false);
  seatIx.push(g.children.length);
  {const sg=new THREE.Group();sg.rotation.y=Math.PI;sg.position.z=.45;const mv=[...g.children.slice(seatIx[0],seatIx[1]),...g.children.slice(seatIx[2],seatIx[3])];for(const o of mv)sg.add(o);g.add(sg);}
  // 浮き輪のまわりの掴みロープ（金具から金具へ垂れる）と、水線のこすれ帯
  {const rope=S(0xe8e0c8,.9,0),pts=[];const NB=16;for(let k=0;k<=NB*6;k++){const a=k/(NB*6)*Math.PI*2,sag=Math.sin((k%6)/6*Math.PI)*.07;pts.push(new V3(Math.cos(a)*(R+r*.92),.5-sag,Math.sin(a)*(R+r*.92)));}
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,true),NB*12,.018,5,true),rope));
    for(let k=0;k<NB;k++){const a=(k+.5)/NB*Math.PI*2;A(new THREE.BoxGeometry(.05,.06,.08),chrome,Math.cos(a)*(R+r*.9),.5,Math.sin(a)*(R+r*.9),{ry:-a});}}
  A(new THREE.TorusGeometry(R+r*.62,.05,8,48),S(0x2a2624,.8,.05),0,.12,0,{rx:Math.PI/2});
  // 操縦塔：パネルの継ぎ目・鋲・横の取っ手・警笛・前面の番号
  {const sd=S(0x2e6766,.6,.2);for(const y of[.32,.78])T(new THREE.BoxGeometry(1.26,.012,.02),sd,0,y,-.465);for(const s of[1,-1])T(new THREE.BoxGeometry(.012,1.1,.02),sd,s*.44,.56,-.465);
    for(let k=0;k<7;k++)for(const y of[.1,1.05])T(new THREE.SphereGeometry(.014,6,4),chrome,-.54+k*.18,y,-.47);
    for(const s of[1,-1]){const h=new THREE.Mesh(new THREE.TorusGeometry(.12,.016,6,14,Math.PI),chrome);h.position.set(s*.7,.6,0);h.rotation.set(0,s*Math.PI/2,Math.PI/2);tw.add(h);}
    T(new THREE.ConeGeometry(.07,.2,12,1,true),brass,.4,1.12,-.25,{rx:-Math.PI/2});
    const nm=new THREE.MeshStandardMaterial({map:exNumTex(),transparent:true,alphaTest:.4,roughness:.5,polygonOffset:true,polygonOffsetFactor:-2});const d=T(new THREE.PlaneGeometry(.4,.2),nm,0,.18,-.474,{ry:Math.PI});d.castShadow=false;}
  // 柱の上の航海灯（赤・緑）と小旗
  {const lg=(c,x)=>{const m=new THREE.MeshBasicMaterial({color:c});const q=new THREE.Mesh(new THREE.SphereGeometry(.05,10,8),m);q.position.set(x,2.82,-.85);g.add(q);};lg(new THREE.Color(2,.15,.1),-.4);lg(new THREE.Color(.15,2,.3),-.1);
    const fg=new THREE.PlaneGeometry(.5,.28,6,2);fg.translate(.25,0,0);const fl=new THREE.Mesh(fg,S(0xe8c23a,.8,0,{side:THREE.DoubleSide}));fl.position.set(-.25,3.15,-.85);g.add(fl);g.userData.flag=fl;fg.userData.p0=fg.attributes.position.array.slice();}
  // 機関の排気管と、座面の縁取り
  A(new THREE.CylinderGeometry(.05,.05,.7,10),chrome,.42,1.3,1.32,{rz:.15});A(new THREE.CylinderGeometry(.065,.065,.06,12),dark,.47,1.66,1.32);
  for(const s of[1,-1])A(new THREE.TorusGeometry(.3,.015,4,24),dark,s*.42,.965,.35,{rx:Math.PI/2,s:[1.05,.9,1]});
  // 模型全体の向き：写真と同じく、網の籠（機関）が前、水色の塔が後ろ
  const o=new THREE.Group();g.rotation.y=Math.PI;o.add(g);o.userData=g.userData;
  // 夜や海中で前を照らす灯（新しい前）
  const lamp=new THREE.SpotLight(0xfff0d0,0,40,.5,.6,1.5);lamp.position.set(0,1.2,-2.0);lamp.target.position.set(0,-1,-12);o.add(lamp);o.add(lamp.target);o.userData.lamp=lamp;
  return o;}
// ── 基地の地形の格子から高さと塗り分け（舗装・森・崖）を補間する（細かい地面がまわりと段差なくつながる）
function terrSample(x,z,out){const T=baseGroup.userData.terr;if(!T){out[0]=-30;out[1]=out[2]=out[3]=0;return out;}
  const lx=x-BASE.x+T.w/2,lz=z-BASE.z+T.d/2,fx=clamp(lx/T.dx,0,T.nx-1.001),fz=clamp(lz/T.dz,0,T.nz-1.001),ix=Math.floor(fx),iz=Math.floor(fz),u=fx-ix,v=fz-iz,N=T.nx;
  const i00=iz*N+ix,i10=i00+1,i01=i00+N,i11=i01+1,H=T.h,C=T.c;
  out[0]=(H[i00]*(1-u)+H[i10]*u)*(1-v)+(H[i01]*(1-u)+H[i11]*u)*v;
  for(let k=0;k<3;k++)out[k+1]=(C[i00*3+k]*(1-u)+C[i10*3+k]*u)*(1-v)+(C[i01*3+k]*(1-u)+C[i11*3+k]*u)*v;
  if(Math.abs(x-BASE.x)>T.w/2-1||Math.abs(z-BASE.z)>T.d/2-1)out[0]=-40;if(out[0]<0)out[0]=Math.min(out[0],exShoreH(x,z));   /* 海の底は水の色と同じ深さの図（陸から離れるほど深い大陸棚） */out[4]=out[5]=out[6]=0;if(out[0]<-.6)exSeabed(x,z,out);return out;}
// 海底の地形と底質（海の中だけ）：沖の砂の波、岩礁の尾根と張り出し、深場の溝、泥の平原。out[4]=岩 out[5]=泥 out[6]=貝殻まじりの砂利
function exSeabed(x,z,out){const h=out[0],lx=x-BASE.x,lz=z-BASE.z,w=smooth(-.6,-3.2,h)*(1-.85*exHarb(x,z));if(w<=0)return;
  const rz=Math.min(1,smooth(.56,.72,vnoise2(lx/90+3.3,lz/90+7.1))+out[3]*.8)*smooth(-1.5,-4,h),rg=Math.pow(1-Math.abs(2*vnoise2(lx/26+11.2,lz/26+5.4)-1),3),
    oc=rz*(rg*3.4+vnoise2(lx/5.5+1.7,lz/5.5+9.3)*1.2+vnoise2(lx/1.9,lz/1.9)*.35),mud=smooth(-20,-34,h),
    a=vnoise2(lx/320+2,lz/320+8)*3.5,sw=Math.sin((lx*Math.cos(a)+lz*Math.sin(a))/8.5*6.283+vnoise2(lx/45,lz/45)*5)*.38*(1-rz)*(1-mud)*smooth(-2.5,-6,h),
    gv=1-Math.abs(2*vnoise2(lx/75+20.3,lz/75+.7)-1),gl=-smooth(.86,.97,gv)*2.2*smooth(-9,-18,h)*(1-rz);
  out[0]=h+w*(oc+sw+gl)*(1-.55*mud);out[4]=w*Math.min(1,rz*(.35+rg*1.3+.4*vnoise2(lx/4,lz/4)));out[5]=w*mud*(1-rz);out[6]=w*smooth(.6,.74,vnoise2(lx/33+40.2,lz/33+3.3))*(1-rz)*(1-mud);}
const _ts=[0,0,0,0,0,0,0];
function exGround(x,z){return terrSample(x,z,_ts)[0];}
// ── 細かい地面（ボートのまわり 240m 四方）
const EXP_N=256,EXP_S=1.25,EXP_HALF=EXP_N*EXP_S/2;
function exBuildPatch(){const N=EXP_N+1,n=N*N,pos=new Float32Array((n+N*4)*3),col=new Float32Array((n+N*4)*3),idx=[];
  for(let j=0;j<EXP_N;j++)for(let i=0;i<EXP_N;i++){const a=j*N+i,b=a+1,c=a+N,d=c+1;idx.push(a,c,b,b,c,d);}
  // 縁のすそ（下へ垂らして、まわりの地形との継ぎ目の隙間を隠す）
  const edges=[[0,1,0],[N-1,0,1],[N*N-1,-1,0],[N*(N-1),0,-1]];let sk=n;const ring=[];for(let k=0;k<N;k++)ring.push(k);for(let k=1;k<N;k++)ring.push(k*N+N-1);for(let k=N-2;k>=0;k--)ring.push((N-1)*N+k);for(let k=N-2;k>0;k--)ring.push(k*N);
  const skirt=ring.map((v,i)=>[v,n+i]);for(let i=0;i<skirt.length;i++){const[a,b]=skirt[i],[c,d]=skirt[(i+1)%skirt.length];idx.push(a,b,c,c,b,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array((n+ring.length)*3),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array((n+ring.length)*3),3));
  g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array((n+ring.length)*3),3));g.setAttribute('aSub',new THREE.BufferAttribute(new Float32Array((n+ring.length)*3),3));g.setIndex(idx);g.userData.ring=ring;
  const tm=baseGroup.userData.terrMat,m=std({vertexColors:true,roughness:.95,metalness:0});
  m.onBeforeCompile=sh=>{tm.onBeforeCompile(sh);Object.assign(sh.uniforms,{uUw:EXU.uUw,uBoat:EXU.uBoat});
    sh.vertexShader=sh.vertexShader.replace('vWP=(modelMatrix*vec4(position,1.0)).xyz;','vSub=aSub;transformed.y+=exMic(position.xz)*(1.0-0.6*vColor.r)*(1.0-0.7*aSub.y);vWP=(modelMatrix*vec4(transformed,1.0)).xyz;')
      .replace('#include <common>','#include <common>\nuniform sampler2D tN2;attribute vec3 aSub;varying vec3 vSub;\nfloat exMic(vec2 p){float a=textureLod(tN2,p/3.3,0.0).b,b=textureLod(tN2,p/0.93+0.31,0.0).b;float uw=1.0-smoothstep(-1.5,0.5,position.y);float rp=sin(dot(p,vec2(0.82,0.57))*3.1+a*4.0)*0.06*uw;return (a-0.5)*0.32+(b-0.5)*0.07+rp;}');
    sh.fragmentShader=sh.fragmentShader.replace('if(hgt<-1.2)discard;','').replace('if(vWP.x>uDet.x&&vWP.x<uDet.z&&vWP.z>uDet.y&&vWP.z<uDet.w)discard;','')
      .replace('#include <common>','#include <common>\nuniform float uUw;uniform vec2 uBoat;varying vec3 vSub;')
      .replace('diffuseColor.rgb=tc;',`
// 海の中：砂の海底に、揺らめく光の模様（コースティクス）。深いほど暗く青く
if(hgt<0.3){float uw=1.0-smoothstep(-0.6,0.3,hgt);vec2 q=vWP.xz;float c1=texture2D(tN2,q/7.0+vec2(uT*0.021,uT*0.013)).b,c2=texture2D(tN2,q/5.3-vec2(uT*0.017,-uT*0.019)+0.4).b;
  float ca=pow(1.0-abs(c1-c2)*2.2,7.0);float dd=clamp(-hgt,0.0,40.0);
  vec3 sf=mix(sand*1.05,vec3(0.32,0.30,0.22)*(0.7+0.6*n3),smoothstep(0.55,0.75,texture2D(tN2,q/23.0).b)*0.5);
  {float gs=texture2D(tN2,q/0.09).b,gs2=texture2D(tN2,q/0.035+0.4).b;vec3 grv=sf*vec3(0.85,0.82,0.76)*(0.55+0.7*gs);grv=mix(grv,vec3(0.86,0.82,0.74),smoothstep(0.8,0.88,gs2)*0.7);sf=mix(sf,grv,vSub.z);   // 貝殻まじりの砂利
   vec3 md=vec3(0.19,0.2,0.16)*(0.75+0.35*n3)*(0.9+0.2*texture2D(tN2,q/2.0).b);md=mix(md,md*0.7,smoothstep(0.6,0.75,texture2D(tN2,q/0.6).b)*0.4);sf=mix(sf,md,vSub.y);   // 深場の泥（細かな穴と生き物の這った跡）
   vec3 rk=rock*vec3(0.85,0.9,0.85)*(0.7+0.5*texture2D(tN2,q/1.3).b);rk=mix(rk,vec3(0.18,0.24,0.12)*(0.6+0.7*n3),smoothstep(0.5,0.75,texture2D(tN2,q/3.1+0.3).b)*0.45*(1.0-smoothstep(4.0,20.0,dd)));sf=mix(sf,rk,smoothstep(0.15,0.6,vSub.x));}   // 岩（浅いと藻が付く）
  tc=mix(tc,sf,uw*smoothstep(0.0,2.0,-hgt));tc*=mix(vec3(1.0),exp(-dd*vec3(0.075,0.03,0.02)),uw);tc+=vec3(0.55,0.75,0.78)*ca*uw*exp(-dd*0.06)*0.6;}
// 波打ち際：寄せては返す波の届く高さ（場所と時間でゆらぐ）、その下は濡れて暗く光る砂、先端に泡の縁と残る泡の網、少し上に漂着した海藻の帯、乾いた砂に貝殻の粒
float exWetK=0.0;
{float fd=1.0-smoothstep(30.0,120.0,length(vViewPosition));float sb=max(mSand,1.0-smoothstep(1.5,4.0,hgt))*(1.0-smoothstep(0.35,0.6,slope));
 float run=0.45+0.32*sin(uT*0.52+dot(vWP.xz,vec2(0.013,0.021)))+0.14*sin(uT*1.21+vWP.x*0.043+vWP.z*0.02)+(n3-0.5)*0.25;
 float wet=(1.0-smoothstep(run,run+0.9+n1*0.5,hgt))*step(-0.8,hgt)*sb;exWetK=wet;
 tc=mix(tc,tc*vec3(0.52,0.5,0.47),wet*0.85);
 float lace=smoothstep(0.42,0.62,texture2D(tN2,vWP.xz/1.3+vec2(uT*0.015,0.0)).b*0.6+texture2D(tN2,vWP.xz/0.45).b*0.5);
 float edge=smoothstep(0.16,0.0,abs(hgt-run))*(0.55+0.45*lace),film=step(hgt,run)*smoothstep(-0.3,run,hgt)*smoothstep(0.55,0.8,lace)*0.6;
 tc=mix(tc,vec3(0.86,0.88,0.87)*(0.8+0.25*n3),clamp(edge+film,0.0,1.0)*sb*step(-0.4,hgt)*0.9);
 float wr=smoothstep(0.07,0.0,abs(hgt-1.45-(n1-0.5)*0.5))*smoothstep(0.5,0.72,texture2D(tN2,vWP.xz/0.9).b)*sb;tc=mix(tc,vec3(0.09,0.07,0.035)*(0.8+0.6*n3),wr*0.7*fd);
 float sp=smoothstep(0.86,0.93,texture2D(tN2,vWP.xz/0.06).b)*sb*step(1.0,hgt);tc=mix(tc,vec3(0.92,0.86,0.8),sp*fd*0.55);
 float gr=(1.0-smoothstep(52.0,62.0,distance(vWP.xz,uBoat)))*(1.0-mSand)*(1.0-mRock)*smoothstep(5.0,8.0,hgt)*(1.0-vColor.b);tc*=mix(vec3(1.0),vec3(0.48,0.56,0.36)*(0.85+0.3*n3),gr);}
diffuseColor.rgb=tc;`).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,0.22,exWetK);')
      .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n{float e=0.15;vec2 q=vWP.xz;float h0=texture2D(tN2,q/3.3).b,hx=texture2D(tN2,(q+vec2(e,0.0))/3.3).b,hz=texture2D(tN2,(q+vec2(0.0,e))/3.3).b;float k=0.32*(1.0-smoothstep(25.0,80.0,length(vViewPosition)));normal=normalize(normal-(viewMatrix*vec4((hx-h0)/e*k,0.0,(hz-h0)/e*k,0.0)).xyz);}');};
  m.customProgramCacheKey=()=>'exPatch';
  const mesh=new THREE.Mesh(g,m);mesh.receiveShadow=true;mesh.castShadow=false;mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);return mesh;}
// 航跡：船尾の泡の帯（中央）と、左右へ 19.5° で開くケルビン波の帯。0.12 秒ごとの足跡から毎コマ帯を組み直し、海面の高さに沿わせる
const EXWK={N:60,LIFE:9};
function exWakeInit(){const N=EXWK.N,V=3*N*2;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(V*3),3));g.setAttribute('aA',new THREE.BufferAttribute(new Float32Array(V*2),2));
  const idx=[];for(let r=0;r<3;r++)for(let i=0;i<N-1;i++){const a=(r*N+i)*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}g.setIndex(idx);
  const m=new THREE.ShaderMaterial({uniforms:{uT:U.uTime,tN2:U.tNoise2,uSun:U.uSunCol},transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:'attribute vec2 aA;varying vec2 vA;varying vec3 vW;void main(){vA=aA;vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader:'uniform float uT;uniform sampler2D tN2;uniform vec3 uSun;varying vec2 vA;varying vec3 vW;void main(){float age=vA.x,u=vA.y;'+
      'float n=texture2D(tN2,vW.xz/2.3+vec2(uT*0.01,0.0)).b*0.6+texture2D(tN2,vW.xz/0.7).b*0.5;float lace=smoothstep(0.5+age*0.3,0.72+age*0.2,n)*(0.6+0.4*texture2D(tN2,vW.xz/7.0).b);'+
      'float edge=1.0-smoothstep(0.55,1.0,abs(u));float a=lace*edge*pow(max(0.0,1.0-age),1.4)*(0.35+0.65*smoothstep(0.0,0.06,age));if(a<0.01)discard;'+
      'gl_FragColor=vec4(vec3(0.88,0.92,0.93)*(0.55+0.5*uSun.r),a*0.62);}'});
  const w=new THREE.Mesh(g,m);w.frustumCulled=false;w.renderOrder=3;scene.add(w);EXWK.m=w;EXWK.pts=[];EXWK.acc=0;
  // 船体のまわりの泡の輪：船首側ほど強く、速いほど広い
  const rg=new THREE.RingGeometry(2.3,3.9,48,2);rg.rotateX(-Math.PI/2);
  const rm=new THREE.ShaderMaterial({uniforms:{uT:U.uTime,tN2:U.tNoise2,uSpd:{value:0},uSun:U.uSunCol},transparent:true,depthWrite:false,
    vertexShader:'varying vec3 vL;varying vec3 vW;void main(){vL=position;vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader:'uniform float uT,uSpd;uniform sampler2D tN2;uniform vec3 uSun;varying vec3 vL;varying vec3 vW;void main(){float r=length(vL.xz),bow=smoothstep(0.3,-1.0,vL.z/r);'+
      'float n=texture2D(tN2,vW.xz/1.6+vec2(0.0,uT*0.05)).b*0.6+texture2D(tN2,vW.xz/0.55-uT*0.03).b*0.5;float w=mix(2.75,3.1+uSpd*0.08,bow);'+
      'float a=smoothstep(w,2.35,r)*smoothstep(0.4,0.6,n)*(0.25+0.75*clamp(uSpd/10.0,0.0,1.0))*(0.55+0.45*bow);if(a<0.01)discard;gl_FragColor=vec4(vec3(0.9,0.93,0.94)*(0.55+0.5*uSun.r),a);}'});
  const ring=new THREE.Mesh(rg,rm);ring.frustumCulled=false;ring.renderOrder=3;scene.add(ring);EXWK.ring=ring;}
function exWakeUpdate(dt,p,fx,fz){if(!EXWK.m)exWakeInit();const on=EX.mode==='water'&&EX.depth<.3,t=EX.t;EXWK.acc+=dt;
  if(EXWK.acc>.12){EXWK.acc=0;if(on&&Math.abs(EX.spd)>.8)EXWK.pts.unshift({x:p.x-fx*1.6,z:p.z-fz*1.6,fx,fz,v:Math.abs(EX.spd),t});else if(EXWK.pts.length)EXWK.pts.unshift(null);if(EXWK.pts.length>EXWK.N)EXWK.pts.length=EXWK.N;}
  const g=EXWK.m.geometry,P=g.attributes.position.array,A=g.attributes.aA.array,N=EXWK.N,tan=.354;let any=false;
  for(let r=0;r<3;r++)for(let i=0;i<N;i++){const q=EXWK.pts[i],o=(r*N+i)*2;if(!q){if(i>0){for(let k=0;k<2;k++){for(let c=0;c<3;c++)P[(o+k)*3+c]=P[(o-2+k)*3+c];A[(o+k)*2]=2;}}else{for(let k=0;k<2;k++){P[(o+k)*3+1]=-1e4;A[(o+k)*2]=2;}}continue;}
    const age=(t-q.t)/EXWK.LIFE;if(age>=1){for(let k=0;k<2;k++){if(i>0)for(let c=0;c<3;c++)P[(o+k)*3+c]=P[(o-2+k)*3+c];else P[(o+k)*3+1]=-1e4;A[(o+k)*2]=2;}continue;}any=true;const as=t-q.t,px=-q.fz,pz=q.fx;
    let c=0,hw;if(r===0)hw=1.0+as*.5;else{c=(r===1?1:-1)*(1.9+tan*q.v*as);hw=.3+as*.14;}
    for(let k=0;k<2;k++){const u=k?1:-1,x=q.x+px*(c+u*hw),z=q.z+pz*(c+u*hw);P[(o+k)*3]=x;P[(o+k)*3+1]=exWave(x,z)+.05;P[(o+k)*3+2]=z;A[(o+k)*2]=age;A[(o+k)*2+1]=u;}}
  g.attributes.position.needsUpdate=g.attributes.aA.needsUpdate=true;EXWK.m.visible=any;
  const R=EXWK.ring;R.visible=on;R.position.set(p.x,exWave(p.x,p.z)+.04,p.z);R.rotation.y=EX.yaw;R.material.uniforms.uSpd.value=Math.abs(EX.spd);}
// マリンスノー：カメラのまわり 40m の箱に漂う小さな粒（箱の中で繰り返して、いつも周りにある）。ゆっくり沈み、揺らぐ
function exSnowInit(){const N=1800,P=new Float32Array(N*3),S=new Float32Array(N);for(let i=0;i<N;i++){P[i*3]=Math.random()*40;P[i*3+1]=Math.random()*40;P[i*3+2]=Math.random()*40;S[i]=Math.random();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('aS',new THREE.BufferAttribute(S,1));
  const m=new THREE.ShaderMaterial({uniforms:{uT:U.uTime,uCam:{value:new V3()},uK:{value:1}},transparent:true,depthWrite:false,
    vertexShader:'uniform float uT,uK;uniform vec3 uCam;attribute float aS;varying float vA;void main(){vec3 p=position;p.y-=uT*(0.08+0.12*aS);p.x+=sin(uT*0.3+aS*30.0)*0.6;p.z+=cos(uT*0.23+aS*17.0)*0.6;'+
      'vec3 w=mod(p-uCam+20.0,40.0)-20.0+uCam;if(w.y>-0.4)w.y=-1e4;vec4 mv=viewMatrix*vec4(w,1.0);float d=-mv.z;gl_Position=projectionMatrix*mv;gl_PointSize=clamp((1.2+2.4*aS)*120.0/max(d,0.5),1.0,6.0);vA=(1.0-smoothstep(10.0,20.0,d))*(0.25+0.35*aS)*uK;}',
    fragmentShader:'varying float vA;void main(){vec2 c=gl_PointCoord-0.5;float a=smoothstep(0.5,0.1,length(c))*vA;if(a<0.01)discard;gl_FragColor=vec4(vec3(0.75,0.85,0.82),a);}'});
  EX.snow=new THREE.Points(g,m);EX.snow.frustumCulled=false;EX.snow.visible=false;scene.add(EX.snow);}
function exWakeOff(){if(EX.snow)EX.snow.visible=false;if(EXWK.m){EXWK.m.visible=EXWK.ring.visible=false;EXWK.pts.length=0;}}
const EXU={uBoatY:{value:0},uUw:{value:0},uBoat:{value:new THREE.Vector2(1e9,1e9)}};
function exPlacePatch(cx,cz){const P2=EX.patch,g=P2.geometry,pa=g.attributes.position.array,ca=g.attributes.color.array,sa=g.attributes.aSub.array,N=EXP_N+1,x0=cx-EXP_HALF,z0=cz-EXP_HALF,s=[0,0,0,0,0,0,0];
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,x=x0+i*EXP_S,z=z0+j*EXP_S;terrSample(x,z,s);pa[k*3]=x;pa[k*3+1]=s[0];pa[k*3+2]=z;ca[k*3]=s[1];ca[k*3+1]=s[2];ca[k*3+2]=s[3];sa[k*3]=s[4];sa[k*3+1]=s[5];sa[k*3+2]=s[6];}
  const ring=g.userData.ring,n=N*N;ring.forEach((v,i)=>{pa[(n+i)*3]=pa[v*3];pa[(n+i)*3+1]=pa[v*3+1]-3;pa[(n+i)*3+2]=pa[v*3+2];ca[(n+i)*3]=ca[v*3];ca[(n+i)*3+1]=ca[v*3+1];ca[(n+i)*3+2]=ca[v*3+2];for(let c=0;c<3;c++)sa[(n+i)*3+c]=sa[v*3+c];});
  g.attributes.position.needsUpdate=g.attributes.color.needsUpdate=g.attributes.aSub.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
  DETU.uDet.value.set(x0+.4,z0+.4,x0+EXP_N*EXP_S-.4,z0+EXP_N*EXP_S-.4);EX.pc.set(cx,0,cz);}
// ── まわりの小物：草（陸）、石（浜・崖・海底）、海藻・珊瑚（海底）、魚（海中）。決まった格子ごとに乱数を固定して置く（動いても同じ物が同じ所に）
// 格子を中心から近い順にたどる並び：数に上限がある物は近い物から埋まるので、動いても近くの物が入れ替わらない
const EXRING={};function exRing(r){if(EXRING[r])return EXRING[r];const a=[];for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++)if(i*i+j*j<=r*r)a.push([i,j,i*i+j*j]);a.sort((p,q)=>p[2]-q[2]||p[1]-q[1]||p[0]-q[0]);return EXRING[r]=a;}
const hash2=(x,z,k)=>{const v=Math.sin(x*127.1+z*311.7+k*74.7)*43758.5453;return v-Math.floor(v);};
function exGrassMat(){const m=std({color:0xffffff,roughness:.9,metalness:0,side:THREE.DoubleSide,vertexColors:false});
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,{uT:U.uTime});sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uT;attribute vec3 iCol;varying vec3 vIC;varying float vGy;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nvIC=iCol;vGy=position.y/0.5;{vec4 wp=instanceMatrix*vec4(0.0,0.0,0.0,1.0);float k=position.y*position.y;transformed.x+=sin(uT*1.7+wp.x*0.21+wp.z*0.13)*0.12*k+sin(uT*3.1+wp.z*0.5)*0.03*k;transformed.z+=sin(uT*1.3+wp.x*0.17)*0.06*k;}');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vIC;varying float vGy;').replace('vec4 diffuseColor = vec4( diffuse, opacity );','float gy=clamp(vGy,0.0,1.0);vec4 diffuseColor = vec4( mix(vIC*(0.28+0.9*gy),vIC*vec3(1.25,1.2,0.85),smoothstep(0.7,1.0,gy)*0.3), opacity );');};
  m.customProgramCacheKey=()=>'exGrass';return m;}
function exBladeGeo(NB,SG){NB=NB||12;SG=SG||3;// 葉を NB 本、根元から開いて弓なりに曲がる（SG 節、先が細る）。法線は上向き寄り（草むらは上からの光で明るく見える）
  const pos=[],nrm=[],idx=[];let v=0;for(let b=0;b<NB;b++){const a=b*2.39996+(b%3)*.2,lean=.06+.2*((b*5)%4)/3,h=.16+.34*((b*7)%5)/4,w=(.013+.008*((b*3)%3)/2)*(NB>12?1:1.5),r0=.07*Math.sqrt(((b*11)%7)/6),cx=Math.cos(a*1.7)*r0,cz=Math.sin(a*1.7)*r0,dx=Math.cos(a),dz=Math.sin(a),px=-dz,pz=dx;
    const L=SG===3?[[0,1],[.4,.85],[.75,.55],[1,0]]:[[0,1],[.55,.7],[1,0]];
    for(const[t,ww]of L){const bend=lean*t*t*1.4,y=h*(t-.18*t*t*lean*4),x=cx+dx*bend,z=cz+dz*bend;if(ww>0){pos.push(x-w*ww*px,y,z-w*ww*pz,x+w*ww*px,y,z+w*ww*pz);nrm.push(dx*.5,1,dz*.5,dx*.5,1,dz*.5);}else{pos.push(x,y,z);nrm.push(dx*.5,1,dz*.5);}}
    if(SG===3){idx.push(v,v+1,v+2,v+1,v+3,v+2,v+2,v+3,v+4,v+3,v+5,v+4,v+4,v+5,v+6);v+=7;}else{idx.push(v,v+1,v+2,v+1,v+3,v+2,v+2,v+3,v+4);v+=5;}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nrm,3));g.setIndex(idx);g.normalizeNormals();return g;}
function exRockGeo(seed){const src=new THREE.IcosahedronGeometry(1,4),sp=src.attributes.position,map=new Map(),P=[],I=[];
  for(let i=0;i<sp.count;i++){const k=Math.round(sp.getX(i)*1e4)+','+Math.round(sp.getY(i)*1e4)+','+Math.round(sp.getZ(i)*1e4);let j=map.get(k);if(j===undefined){j=P.length/3;map.set(k,j);P.push(sp.getX(i),sp.getY(i),sp.getZ(i));}I.push(j);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setIndex(I);const p=g.attributes.position;const n3=(x,y,z,f,k)=>{const v=Math.sin(x*f*1.7+k)*Math.sin(y*f*2.3+k*1.3)*Math.sin(z*f*1.9+k*.7)+.5*Math.sin(x*f*3.1-z*f*2.6+k*2.1);return v;};
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);let k=1+.18*n3(x,y,z,1.2,seed)+.08*n3(x,y,z,3.1,seed*2.1)+.035*n3(x,y,z,7.3,seed*3.7)+.015*n3(x,y,z,17,seed*1.3);
    k-=.05*Math.max(0,Math.abs(Math.sin(y*9+x*2))-.85)*6;   /* 層の筋 */const fl=y<-.2?.75:1;p.setXYZ(i,x*k,y*k*.62*fl,z*k);}
  g.computeVertexNormals();return g;}
function exWeedMat(){const m=std({color:0xffffff,roughness:.7,metalness:0,side:THREE.DoubleSide});
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,{uT:U.uTime});sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uT;attribute vec3 iCol;varying vec3 vIC;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nvIC=iCol;{vec4 wp=instanceMatrix*vec4(0.0,0.0,0.0,1.0);float k=position.y;transformed.x+=sin(uT*0.9+wp.x*0.3+k*1.4)*0.25*k;transformed.z+=cos(uT*0.7+wp.z*0.3+k*1.1)*0.18*k;}');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vIC;').replace('vec4 diffuseColor = vec4( diffuse, opacity );','vec4 diffuseColor = vec4( vIC, opacity );');};
  m.customProgramCacheKey=()=>'exWeed';return m;}
function exWeedGeo(){const g=new THREE.PlaneGeometry(.18,1,1,8);g.translate(0,.5,0);const g2=g.clone().rotateY(Math.PI/2);const m=new THREE.BufferGeometry();
  const a=g.toNonIndexed(),b=g2.toNonIndexed(),pa=new Float32Array(a.attributes.position.count*6);pa.set(a.attributes.position.array,0);pa.set(b.attributes.position.array,a.attributes.position.array.length);
  m.setAttribute('position',new THREE.BufferAttribute(pa,3));m.computeVertexNormals();return m;}
function exFishGeo(){const g=new THREE.SphereGeometry(.12,8,6);g.scale(.45,.7,1.6);const t=new THREE.ConeGeometry(.09,.18,4);t.rotateX(-Math.PI/2);t.translate(0,0,.27);
  const a=g.toNonIndexed(),b=t.toNonIndexed(),pa=new Float32Array((a.attributes.position.count+b.attributes.position.count)*3);pa.set(a.attributes.position.array,0);pa.set(b.attributes.position.array,a.attributes.position.array.length);
  const m=new THREE.BufferGeometry();m.setAttribute('position',new THREE.BufferAttribute(pa,3));m.computeVertexNormals();return m;}
function exInit(){if(!BOOM.init)boomInit();if(EX.b)return;
  EX.b=buildAquaBoat();EX.b.visible=false;scene.add(EX.b);EX.patch=exBuildPatch();
  const icol=(im,n)=>{im.geometry.setAttribute('iCol',new THREE.InstancedBufferAttribute(new Float32Array(n*3),3));};
  {const gm=exGrassMat();EX.grass=new THREE.InstancedMesh(exBladeGeo(14,3),gm,26000);EX.grass2=new THREE.InstancedMesh(exBladeGeo(9,2),gm,52000);
    for(const m of[EX.grass,EX.grass2]){icol(m,m.instanceMatrix.count);m.count=0;m.frustumCulled=false;m.receiveShadow=true;m.renderOrder=-3;scene.add(m);}}   /* 草を先に描いて、隠れた地面の重い計算を深度で省く */
  const rkm=std({color:0x8f8a80,roughness:.85,metalness:0});rkm.onBeforeCompile=sh=>{sh.uniforms.tN2=U.tNoise2;sh.uniforms.tRk=GT.rock;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRw;varying vec3 vRl;').replace('#include <begin_vertex>','#include <begin_vertex>\nvRl=position;vRw=(modelMatrix*instanceMatrix*vec4(position,1.0)).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D tN2,tRk;varying vec3 vRw;varying vec3 vRl;').replace('#include <color_fragment>',`#include <color_fragment>
{float y=vRw.y;vec3 c=diffuseColor.rgb;{vec3 an=abs(normalize(vRl*vec3(1.0,1.6,1.0)));an=pow(an,vec3(4.0));an/=an.x+an.y+an.z;vec3 tx=texture2D(tRk,vRw.zy/1.7).rgb*an.x+texture2D(tRk,vRw.xz/1.7).rgb*an.y+texture2D(tRk,vRw.xy/1.7).rgb*an.z;c*=tx*tx*2.6;}float n=texture2D(tN2,vRl.xz*1.7+vRl.y).b,f=texture2D(tN2,vRw.xz*7.0+vRw.y*5.0).b;c*=0.7+0.5*n;
 float tide=smoothstep(-1.8,-1.2,y)*(1.0-smoothstep(1.1,1.6,y));float wet=1.0-smoothstep(0.6,1.4,y);c*=mix(1.0,0.62,wet);
 float dots=smoothstep(0.72,0.8,texture2D(tN2,vRw.xz*23.0+vRw.y*17.0).b);c=mix(c,vec3(0.78,0.76,0.7)*(0.8+0.3*f),dots*tide*0.75);
 c=mix(c,vec3(0.16,0.22,0.08)*(0.7+0.6*n),smoothstep(-0.2,-0.8,y)*smoothstep(0.4,0.7,f)*0.7);diffuseColor.rgb=c;}`).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor*=mix(1.0,0.45,1.0-smoothstep(0.6,1.4,vRw.y));');};
  rkm.customProgramCacheKey=()=>'exRock';
  EX.rocks=new THREE.InstancedMesh(exRockGeo(5),rkm,1500);EX.rocks.count=0;EX.rocks.castShadow=EX.rocks.receiveShadow=true;EX.rocks.frustumCulled=false;EX.rocks.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(1500*3),3);scene.add(EX.rocks);
  // 海面の裏側（海中から見上げた水面）：明るい水色に揺らぐ光、真上ほど明るい窓（スネルの窓）
  EX.surf=new THREE.Mesh(new THREE.PlaneGeometry(600,600,1,1).rotateX(-Math.PI/2),new THREE.ShaderMaterial({uniforms:{uT:U.uTime,tN2:U.tNoise2,uSun:U.uSunCol},side:THREE.BackSide,
    vertexShader:'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader:'uniform float uT;uniform sampler2D tN2;uniform vec3 uSun;varying vec3 vW;void main(){vec3 v=normalize(vW-cameraPosition);float up=clamp(v.y,0.0,1.0);float w=smoothstep(0.62,0.8,up);'+
      'float n=texture2D(tN2,vW.xz/9.0+vec2(uT*0.02,uT*0.013)).b*0.6+texture2D(tN2,vW.xz/3.7-vec2(uT*0.031,0.0)).b*0.4;'+
      'vec3 c=mix(vec3(0.03,0.16,0.18),vec3(0.35,0.62,0.62)+uSun*0.08,w)*(0.75+0.5*n);c+=vec3(1.0,0.95,0.85)*pow(n,8.0)*w*1.5;gl_FragColor=vec4(c,1.0);}'}));
  EX.surf.visible=false;EX.surf.frustumCulled=false;scene.add(EX.surf);
  seaInit();exCratesInit();exDynInit();exKrakenBuild();   /* 巨大イカと光は最初から作っておく（途中で光を足すと全部の材質のシェーダが作り直しになり固まる） */
  // 水を透かして見せる物（層 1）：地面パッチ・岩・海の生き物・ボート。明かりも層 1 で照らす
  {const L1=o=>o.traverse(q=>q.layers.enable(1));L1(EX.patch);L1(EX.rocks);L1(EX.b);for(const m of SEA.all)L1(m);scene.traverse(q=>{if(q.isLight)q.layers.enable(1);});}
  // 水面に映す物（層 2）：ボート・船（係留・航行）・港の施設・島の地形と岩・護岸。明かりも層 2 で
  {const L2=o=>o&&o.traverse(q=>q.layers.enable(2));L2(EX.b);L2(EX.patch);L2(EX.rocks);if(typeof ships!=='undefined')for(const sh of ships)L2(sh.m);L2(baseGroup.userData.lodPort);
    baseGroup.traverse(q=>{if(q.isMesh&&(q.material===baseGroup.userData.terrMat||q.userData.rock||q.userData.exCol||q.userData.bump))q.layers.enable(2);});scene.traverse(q=>{if(q.isLight)q.layers.enable(2);});}
  EX.hud=$('exhud');
  // ボートで押せる車両：基地の中の車・牽引車・給油車など。台ごとの向きの箱（半幅・半長）と重さ、元の位置を覚える
  EX.push=[];baseGroup.updateMatrixWorld(true);const inv=new THREE.Matrix4(),bb=new THREE.Box3(),tb=new THREE.Box3();
  baseGroup.traverse(o=>{if(!o.userData.push)return;inv.copy(o.matrixWorld).invert();bb.makeEmpty();o.traverse(q=>{if(q.isMesh){q.geometry.computeBoundingBox();tb.copy(q.geometry.boundingBox).applyMatrix4(_m4.multiplyMatrices(inv,q.matrixWorld));bb.union(tb);}});
    if(bb.isEmpty())return;const hx=Math.max(Math.abs(bb.min.x),bb.max.x),hz=Math.max(Math.abs(bb.min.z),bb.max.z);
    const pq=new THREE.Quaternion();o.parent.getWorldQuaternion(pq);const pyaw=new THREE.Euler().setFromQuaternion(pq,'YXZ').y;
    EX.push.push({o,hx,hz,pyaw,piq:pq.clone().invert(),m:Math.max(.6,hx*hz*(o.userData.push==='fire'||o.userData.push==='fuel'?2.2:1)),p0:o.position.clone(),q0:o.quaternion.clone(),v:new V3(),w:0,moved:false});});}
const _m4=new THREE.Matrix4(),_pw=new V3(),_pl=new V3();
// 乗り越えられる凸凹（岩は楕円体、流木は丸太）。[中心x,y,z, 半径x,高さ,半径z, 向きcos,sin, 種類]。基地の物は一度だけ格子に、探検の小岩は置き直しのたびに
function exBumpTop(b,x,z){const dx=x-b[0],dz=z-b[2],lx=dx*b[6]-dz*b[7],lz=dx*b[7]+dz*b[6];if(b[8]===1){if(Math.abs(lx)>b[3])return -1e9;const q=1-(lz/b[5])**2;return q>0?b[1]+b[4]*Math.sqrt(q):-1e9;}
  const q=1-(lx/b[3])**2-(lz/b[5])**2;return q>0?b[1]+b[4]*Math.sqrt(q):-1e9;}
function exBumpsNear(x,z){if(!EX.bg){EX.bg=new Map();for(const b of baseGroup.userData.exBumps||[]){const r=Math.max(b[3],b[5]);for(let i=Math.floor((b[0]-r)/16);i<=Math.floor((b[0]+r)/16);i++)for(let j=Math.floor((b[2]-r)/16);j<=Math.floor((b[2]+r)/16);j++){const k=i*100000+j;let a=EX.bg.get(k);if(!a)EX.bg.set(k,a=[]);a.push(b);}}}
  const a=EX.bg.get(Math.floor(x/16)*100000+Math.floor(z/16))||[],c=EX.rbg&&EX.rbg.get(Math.floor(x/8)*100000+Math.floor(z/8));return c?a.concat(c):a;}
function exRockBumps(){EX.rbg=new Map();const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),ps=new V3(),sc=new V3(),e=new THREE.Euler();
  for(let i=0;i<EX.rocks.count;i++){EX.rocks.getMatrixAt(i,m4);m4.decompose(ps,q,sc);e.setFromQuaternion(q,'YXZ');const b=[ps.x,ps.y,ps.z,sc.x*.85,sc.y*.55,sc.z*.85,Math.cos(e.y),-Math.sin(e.y),0],r=Math.max(b[3],b[5]);
    for(let a=Math.floor((ps.x-r)/8);a<=Math.floor((ps.x+r)/8);a++)for(let c=Math.floor((ps.z-r)/8);c<=Math.floor((ps.z+r)/8);c++){const k=a*100000+c;let l=EX.rbg.get(k);if(!l)EX.rbg.set(k,l=[]);l.push(b);}}}
// 立てる高さ：地面か、0.7m までの段で乗れる物の上面（岸壁・舗装の台など）。上面は細かな凹凸がないので 0.2 下げて返す（あとで +0.22）
function exStandH(x,z,lvl){let g=exGround(x,z);for(const b of exBumpsNear(x,z)){const t=exBumpTop(b,x,z)-.2;if(t>g&&t<lvl+2.4)g=t;}for(const c of exColsNear(x,z,1)){if(c[4]<=g||c[4]>lvl+.7)continue;const dx=x-c[6],dz=z-c[7];if(Math.abs(dx*c[10]+dz*c[11])<=c[8]&&Math.abs(dx*c[12]+dz*c[13])<=c[9])g=c[4]-.2;}return g;}
// 動く物の当たり判定：船（係留・航行）、トレーラー、門型クレーン、格納庫の扉、駐機中の機体。開始時に物ごとの部品の箱を物自身の座標で作り、毎コマ近くの物だけ今の位置と向きへ動かす
function exDynInit(){const L=[],bx=new THREE.Box3(),inv=new THREE.Matrix4(),m4=new THREE.Matrix4();
  const addObj=(o,maxY)=>{o.updateMatrixWorld(true);inv.copy(o.matrixWorld).invert();const boxes=[];
    o.traverse(q=>{if(!q.isMesh||!q.visible)return;const mt=Array.isArray(q.material)?q.material[0]:q.material;if(mt.transparent||mt.depthWrite===false)return;if(!q.geometry.boundingBox)q.geometry.computeBoundingBox();
      if(q.isInstancedMesh){const gb=q.geometry.boundingBox;for(let i=0;i<q.count;i++){q.getMatrixAt(i,m4);m4.premultiply(q.matrixWorld).premultiply(inv);bx.copy(gb).applyMatrix4(m4);if(bx.min.y<maxY)boxes.push(bx.clone());}return;}
      m4.multiplyMatrices(inv,q.matrixWorld);bx.copy(q.geometry.boundingBox).applyMatrix4(m4);if(bx.isEmpty()||bx.min.y>=maxY)return;const sz=bx.getSize(new V3());if(sz.x<.15&&sz.z<.15)return;boxes.push(bx.clone());});
    if(boxes.length>220){/* 部品が多いときは近い物をまとめる（2m 格子） */const mp=new Map();for(const b of boxes){const k=Math.round((b.min.x+b.max.x)/4)+'_'+Math.round((b.min.z+b.max.z)/4);const e=mp.get(k);if(e)e.union(b);else mp.set(k,b.clone());}boxes.length=0;for(const b of mp.values())boxes.push(b);}
    if(boxes.length)L.push({o,boxes,r:Math.max(...boxes.map(b=>Math.hypot(Math.max(Math.abs(b.min.x),Math.abs(b.max.x)),Math.max(Math.abs(b.min.z),Math.abs(b.max.z)))))});};
  if(typeof ships!=='undefined')for(const sh of ships)addObj(sh.m,6);
  baseGroup.traverse(o=>{if(!o.userData.dyn||o.userData.push||o.userData.carton||o.isInstancedMesh)return;for(let q=o.parent;q&&q!==baseGroup;q=q.parent)if(q.userData.dyn||q.userData.push)return;if(!o.visible||o.userData.flag)return;
    bx.setFromObject(o);if(bx.isEmpty())return;const sz=bx.getSize(new V3());if(Math.max(sz.x,sz.z)<1||Math.max(sz.x,sz.z)>400)return;addObj(o,1e9);});   /* 動く物は今の位置に関係なく（走る前は原点にいることもある） */
  scene.children.forEach(o=>{if(o.userData&&o.userData.wingAt&&o.visible)addObj(o,1e9);});   // 駐機中の機体
  EX.dyn=L;}
const _dq=new V3(),_dc=new V3();
function exDynNear(x,z,r,out){if(!EX.dyn)return;for(const d of EX.dyn){const o=d.o;if(!o.visible||!o.parent)continue;const w=o.matrixWorld.elements,ox=w[12],oz=w[14];if(Math.hypot(ox-x,oz-z)>d.r+r+3)continue;
    const exx=w[0],exz=w[2],fx=w[8],fz=w[10],la=Math.hypot(exx,exz)||1,lb=Math.hypot(fx,fz)||1;
    for(const b of d.boxes){_dc.set((b.min.x+b.max.x)/2,(b.min.y+b.max.y)/2,(b.min.z+b.max.z)/2).applyMatrix4(o.matrixWorld);const hx=(b.max.x-b.min.x)/2*la,hz=(b.max.z-b.min.z)/2*lb;if(Math.hypot(_dc.x-x,_dc.z-z)>Math.hypot(hx,hz)+r+1)continue;
      const wy0=w[13]+(b.min.y)*w[5],wy1=w[13]+(b.max.y)*w[5];
      out.push([_dc.x-Math.max(hx,hz),Math.min(wy0,wy1),_dc.z-Math.max(hx,hz),_dc.x+Math.max(hx,hz),Math.max(wy0,wy1),_dc.z+Math.max(hx,hz),_dc.x,_dc.z,hx,hz,exx/la,exz/la,fx/lb,fz/lb]);}}}
// 細かい当たり判定を 32m の格子に分けて、近くの箱だけを調べる
function exColsNear(x,z,r){r=r||6;const L=baseGroup.userData.exCols;if(!L)return[];if(!EX.cg){EX.cg=new Map();for(const c of L){for(let i=Math.floor(c[0]/32);i<=Math.floor(c[3]/32);i++)for(let j=Math.floor(c[2]/32);j<=Math.floor(c[5]/32);j++){const k=i*100000+j;let a=EX.cg.get(k);if(!a)EX.cg.set(k,a=[]);a.push(c);}}}
  const out=[],seen=new Set();exDynNear(x,z,r,out);for(let i=Math.floor((x-r)/32);i<=Math.floor((x+r)/32);i++)for(let j=Math.floor((z-r)/32);j<=Math.floor((z+r)/32);j++){const a=EX.cg.get(i*100000+j);if(a)for(const c of a)if(!seen.has(c)){seen.add(c);out.push(c);}}return out;}
// ボートと車両の当たり：車両の向きの箱にボートの円（半径 2.5m）を当て、めり込みを重さの比で分け合う。車両は押された勢いで滑って回り、摩擦で止まる
function exPush(dt,p,fx,fz){if(!EX.push)return;const R=2.5,bv=_gv.set(fx*EX.spd,0,fz*EX.spd);
  for(const c of EX.push){const o=c.o;o.getWorldPosition(_pw);const dx0=p.x-_pw.x,dz0=p.z-_pw.z;
    if(c.moved){c.v.multiplyScalar(Math.max(0,1-dt*2.2));c.w*=Math.max(0,1-dt*2.5);if(c.v.lengthSq()<.0004&&Math.abs(c.w)<.01){c.v.set(0,0,0);c.w=0;}else{exMoveW(c,c.v.x*dt,c.v.z*dt);o.rotation.y+=c.w*dt;exVehWorld(c);}}
    if(dx0*dx0+dz0*dz0>(R+Math.max(c.hx,c.hz)+1)**2)continue;if(Math.abs(p.y-_pw.y)>3)continue;
    // ボートの中心を車両の向きへ直して、箱の最も近い点との距離
    const a=o.rotation.y+c.pyaw,ca=Math.cos(a),sa=Math.sin(a);const lx=ca*dx0-sa*dz0,lz=sa*dx0+ca*dz0;
    const qx=Math.max(-c.hx,Math.min(c.hx,lx)),qz=Math.max(-c.hz,Math.min(c.hz,lz));let nx=lx-qx,nz=lz-qz,d=Math.hypot(nx,nz);if(d>=R)continue;
    if(d<1e-4){if(c.hx-Math.abs(lx)<c.hz-Math.abs(lz)){nx=Math.sign(lx)||1;nz=0;}else{nx=0;nz=Math.sign(lz)||1;}d=0;}else{nx/=d;nz/=d;}
    const wx=ca*nx+sa*nz,wz=-sa*nx+ca*nz,pen=R-d,mb=3,share=mb/(mb+c.m);   // 世界の向きの押す方向（車両→ボート）
    p.x+=wx*pen*(1-share);p.z+=wz*pen*(1-share);exMoveW(c,-wx*pen*share,-wz*pen*share);
    const vn=bv.x*-wx+bv.z*-wz;if(vn>0){const imp=vn*share*1.6;c.v.x-=wx*imp;c.v.z-=wz*imp;   // 当たった所が中心からずれていれば回る
      const rx=_pw.x+(ca*qx+sa*qz)-_pw.x,rz=(-sa*qx+ca*qz);c.w+=(rz*-wx-rx*-wz)*imp*.35/Math.max(1,c.m*.5);EX.spd*=1-share*.6;if(imp>1.5&&SFX.hit)SFX.hit(.3);}
    c.moved=true;o.userData.pushed=1;}}
function exVehWorld(c){const o=c.o;o.getWorldPosition(_pw);const a=o.rotation.y+c.pyaw,ca=Math.cos(a),sa=Math.sin(a),r=Math.min(c.hx,c.hz)*.95,n=Math.max(1,Math.round(Math.max(c.hx,c.hz)/r)),L=Math.max(c.hx,c.hz)-r,alongZ=c.hz>=c.hx;let hit=false;
  for(let k=0;k<n;k++){const t=n===1?0:-L+2*L*k/(n-1),lx=alongZ?0:t,lz=alongZ?t:0,wx=_pw.x+ca*lx+sa*lz,wz=_pw.z-sa*lx+ca*lz;
    for(const b of exColsNear(wx,wz,1)){if(b[4]<_pw.y+.5||b[1]>_pw.y+2.2)continue;const dx=wx-b[6],dz=wz-b[7];let bx=dx*b[10]+dz*b[11],bz=dx*b[12]+dz*b[13];const qx=Math.max(-b[8],Math.min(b[8],bx)),qz=Math.max(-b[9],Math.min(b[9],bz));const d=Math.hypot(bx-qx,bz-qz);if(d>=r)continue;
      let ox,oz;if(d<1e-4){if(b[8]-Math.abs(bx)<b[9]-Math.abs(bz)){ox=(bx<0?-1:1)*(b[8]+r)-bx;oz=0;}else{ox=0;oz=(bz<0?-1:1)*(b[9]+r)-bz;}}else{ox=(qx+(bx-qx)/d*r)-bx;oz=(qz+(bz-qz)/d*r)-bz;}
      const mx=ox*b[10]+oz*b[12],mz=ox*b[11]+oz*b[13];exMoveW(c,mx,mz);_pw.x+=mx;_pw.z+=mz;const ml=Math.hypot(mx,mz)||1,vn=(c.v.x*mx+c.v.z*mz)/ml;if(vn<0){c.v.x-=mx/ml*vn*1.25;c.v.z-=mz/ml*vn*1.25;}c.w+=(lz*mx-lx*mz)*.08;hit=true;}}
  // ほかの車
  for(const e of EX.push){if(e===c)continue;const w=e.o.getWorldPosition(_pl.clone?new V3():new V3()),dx=_pw.x-w.x,dz=_pw.z-w.z,d=Math.hypot(dx,dz),rr=Math.max(c.hx,c.hz)*.7+Math.max(e.hx,e.hz)*.7;if(d>=rr||d<1e-4||Math.abs(w.y-_pw.y)>2)continue;
    const k=(rr-d)/d,sh=c.m/(c.m+e.m);exMoveW(c,dx*k*(1-sh),dz*k*(1-sh));exMoveW(e,-dx*k*sh,-dz*k*sh);const vn=(c.v.x*-dx+c.v.z*-dz)/d;if(vn>0){e.v.x+=-dx/d*vn*.6;e.v.z+=-dz/d*vn*.6;c.v.x-=-dx/d*vn*.6;c.v.z-=-dz/d*vn*.6;}e.moved=true;e.o.userData.pushed=1;hit=true;}
  return hit;}
function exMoveW(c,dx,dz){_pl.set(dx,0,dz).applyQuaternion(c.piq);c.o.position.x+=_pl.x;c.o.position.z+=_pl.z;}
// ── 深海の巨大電気イカ：45m より深い所に続けて 30 秒いると現れる。20 秒で暗がりに光る目と青い筋（予兆と警告）、30 秒で襲いかかり、腕を船体に巻き付けて電気を流す → ゲームオーバー
const KR={T_WARN:20,T_ATK:30,glow:{value:0},fade:{value:0}};   // fade：現れるときに暗い海から浮かび上がる（0＝見えない）
function exKrakenBuild(){if(EX.kr)return EX.kr;const g=new THREE.Group();g.visible=false;scene.add(g);
  // 肌：濃い赤紫に色素の斑点、角度で青緑に光る艶、発光器の点、電気が流れると青白い筋が走る
  const skinCode=(uvExpr)=>`{vec3 q=vKp;float n=texture2D(tN2,${uvExpr}*1.7).b,f=texture2D(tN2,${uvExpr}*6.3+0.3).b,sp=smoothstep(0.66,0.74,texture2D(tN2,${uvExpr}*11.0+0.7).b);
    diffuseColor.rgb=mix(vec3(0.34,0.07,0.1),vec3(0.55,0.16,0.14),n)*(0.75+0.4*f);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.16,0.03,0.05),sp*0.8);}`;
  const glowCode=(along)=>`{vec3 vd=normalize(vViewPosition);float fr=pow(1.0-abs(dot(normalize(vNormal),vd)),3.0);totalEmissiveRadiance+=vec3(0.05,0.25,0.35)*fr*0.6;
    float ph=smoothstep(0.82,0.9,texture2D(tN2,vKp.xz*0.9+vKp.y*0.7).b);totalEmissiveRadiance+=vec3(0.3,0.75,1.6)*ph*(0.25+uGlow);
    float pl=pow(max(0.0,sin(${along}*9.0-uT*7.0)),10.0);totalEmissiveRadiance+=vec3(0.6,1.4,3.2)*pl*uGlow;}`;
  const mk=(uvExpr,along,key)=>{const m=std({color:0xffffff,roughness:.32,metalness:.05});m.onBeforeCompile=sh=>{sh.uniforms.uT=U.uTime;sh.uniforms.uGlow=KR.glow;sh.uniforms.uKF=KR.fade;sh.uniforms.tN2=U.tNoise2;
      sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vKp;attribute vec2 aUV;varying vec2 vKu;').replace('#include <begin_vertex>','#include <begin_vertex>\nvKp=position;\n#ifdef KR_ARM\nvKu=aUV;\n#else\nvKu=vec2(0.0);\n#endif\n');
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uT,uGlow,uKF;uniform sampler2D tN2;varying vec3 vKp;varying vec2 vKu;').replace('#include <dithering_fragment>','#include <dithering_fragment>\n{float h=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);if(h>uKF*1.8)discard;gl_FragColor.rgb=mix(vec3(0.01,0.04,0.055),gl_FragColor.rgb,uKF*uKF);}').replace('#include <color_fragment>','#include <color_fragment>\n'+skinCode(uvExpr)+(key==='arm'?
        '{float inner=1.0-smoothstep(0.12,0.2,abs(vKu.y-0.5));vec2 sc=vec2(fract(vKu.x*90.0)-0.5,(vKu.y-0.5)*9.0);float sk=smoothstep(0.42,0.3,length(sc))*step(0.2,length(sc));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.85,0.7,0.62),sk*inner);diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.6+0.05,inner*0.35);}':''))
        .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n'+glowCode(along));if(key==='arm')sh.vertexShader='#define KR_ARM\n'+sh.vertexShader;};
    m.customProgramCacheKey=()=>'kr_'+key;return m;};
  const body=mk('vec2(q.y*0.18,atan(q.z,q.x)*0.5)','(-vKp.y*0.15)','body'),armM=mk('vec2(vKu.x*6.0,vKu.y*1.5)','vKu.x*3.0','arm'),finM=mk('q.xy*0.35','0.0','fin');finM.side=THREE.DoubleSide;
  // 外套：魚雷形（先が上）。頭より太い
  const prof=[[1.0,0],[1.18,.6],[1.32,1.6],[1.38,2.8],[1.3,4.0],[1.08,5.0],[.78,5.9],[.45,6.7],[.18,7.3],[0,7.6]].map(q=>new THREE.Vector2(q[0],q[1]));const mt=new THREE.LatheGeometry(prof,40);mt.scale(1,1,.9);const mm=new THREE.Mesh(mt,body);g.add(mm);
  // 菱形の大きなひれ（外套の先）
  {const sh=new THREE.Shape();sh.moveTo(0,5.2);sh.quadraticCurveTo(1.9,5.9,2.5,6.7);sh.quadraticCurveTo(1.4,7.25,0,7.65);sh.lineTo(0,5.2);const fg=new THREE.ExtrudeGeometry(sh,{depth:.06,bevelEnabled:true,bevelThickness:.03,bevelSize:.03,bevelSegments:2});fg.translate(0,0,-.03);
    for(const s2 of[-1,1]){const f=new THREE.Mesh(fg,finM);f.scale.x=s2;f.position.set(s2*.35,0,0);g.add(f);(g.userData.fins=g.userData.fins||[]).push(f);}}
  // 外套の口のふちと頭（外套より細い）、大きな目、漏斗
  const coll=new THREE.Mesh(new THREE.TorusGeometry(1.0,.08,8,32),body);coll.rotation.x=Math.PI/2;g.add(coll);
  const hp=[[0,-1.6],[.55,-1.5],[.82,-1.1],[.9,-.6],[.92,-.1],[.95,.1]].map(q=>new THREE.Vector2(q[0],q[1]));const hd=new THREE.Mesh(new THREE.LatheGeometry(hp,32),body);g.add(hd);
  const eyeBall=std({color:lin(0x050608),roughness:.05,metalness:.3});for(const s2 of[-1,1]){const e=new THREE.Mesh(new THREE.SphereGeometry(.42,24,18),eyeBall);e.position.set(s2*.78,-.75,-.12);e.scale.set(.6,1,1);(g.userData.eyes=g.userData.eyes||[]).push(e);g.add(e);
    const ir=new THREE.Mesh(new THREE.TorusGeometry(.26,.05,8,28),new THREE.MeshBasicMaterial({color:new THREE.Color(1.2,3.2,6)}));ir.position.set(s2*1.02,-.75,-.12);ir.rotation.y=Math.PI/2;g.add(ir);ir.userData.c0=ir.material.color.clone();g.userData.eyes.push(ir);
    const lid=new THREE.Mesh(new THREE.TorusGeometry(.44,.07,8,28),body);lid.position.set(s2*.98,-.75,-.12);lid.rotation.y=Math.PI/2;g.add(lid);}
  {const fn=new THREE.Mesh(new THREE.CylinderGeometry(.16,.28,.9,14,1,true),body);fn.position.set(0,-.6,.82);fn.rotation.x=-.9;g.add(fn);}
  // 腕 8 本と長い触腕 2 本（毎コマ曲線に沿って作り直す管。u＝根元→先、v＝周り。内側に吸盤）
  const arms=[];for(let k=0;k<10;k++){const SEG=40,RS=12,geo=new THREE.BufferGeometry();const n=(SEG+1)*RS;geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));const uv=new Float32Array(n*2);
    for(let i=0;i<=SEG;i++)for(let j=0;j<RS;j++){uv[(i*RS+j)*2]=i/SEG;uv[(i*RS+j)*2+1]=j/RS;}geo.setAttribute('aUV',new THREE.BufferAttribute(uv,2));
    const idx=[];for(let i=0;i<SEG;i++)for(let j=0;j<RS;j++){const a=i*RS+j,b=i*RS+(j+1)%RS,c=a+RS,d=b+RS;idx.push(a,c,b,b,c,d);}geo.setIndex(idx);
    const m=new THREE.Mesh(geo,armM);m.frustumCulled=false;m.castShadow=false;scene.add(m);m.visible=false;arms.push({m,geo,SEG,RS,ph:k*.7,long:k>=8});}
  const arcG=new THREE.BufferGeometry();arcG.setAttribute('position',new THREE.BufferAttribute(new Float32Array(1200*3),3));const arcs=new THREE.LineSegments(arcG,new THREE.LineBasicMaterial({color:new THREE.Color(1.6,2.4,4),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));arcs.frustumCulled=false;arcs.visible=false;scene.add(arcs);
  const lt=exKrLight();
  const spG=new THREE.BufferGeometry();spG.setAttribute('position',new THREE.BufferAttribute(new Float32Array(400*3),3));const spk=new THREE.Points(spG,new THREE.PointsMaterial({map:GLOWTEX,color:new THREE.Color(2.5,3.5,6),size:.9,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));spk.frustumCulled=false;spk.visible=false;scene.add(spk);
  return EX.kr={g,arms,arcs,lt,spk,mantle:mm,phase:0,t:0,dir:new V3(1,0,0),pos:new V3()};}
const _kv=new V3(),_kt=new V3(),_kn=new V3(),_kb=new V3(),_ku=new V3(0,1,0);
function exArm(a,pts,r0,r1){const c=new THREE.CatmullRomCurve3(pts),P=a.geo.attributes.position.array;for(let i=0;i<=a.SEG;i++){const t=i/a.SEG;c.getPoint(t,_kv);c.getTangent(t,_kt);_kn.crossVectors(_kt,_ku);if(_kn.lengthSq()<1e-4)_kn.set(1,0,0);_kn.normalize();_kb.crossVectors(_kt,_kn).normalize();
    let r=r0*Math.pow(1-t,.85)+r1;if(a.long){r=r0*.6*Math.pow(1-t,.5)+r1;if(t>.78&&t<.97)r+=.16*Math.sin((t-.78)/.19*Math.PI);}   /* 触腕は細く長く、先に吸盤の房 */
    for(let j=0;j<a.RS;j++){const an=j/a.RS*Math.PI*2,cs=Math.cos(an)*r,sn=Math.sin(an)*r*(.85),o=(i*a.RS+j)*3;P[o]=_kv.x+_kn.x*cs+_kb.x*sn;P[o+1]=_kv.y+_kn.y*cs+_kb.y*sn;P[o+2]=_kv.z+_kn.z*cs+_kb.z*sn;}}
  a.geo.attributes.position.needsUpdate=true;a.geo.computeVertexNormals();}
function exZap(v){if(!AU.ctx)return;const t=AU.ctx.currentTime;burst(AU.sfx,t,.08+Math.random()*.12,v,'bandpass',2600+Math.random()*2400,1800,.8,0,.002);if(Math.random()<.4)tone(AU.sfx,'sawtooth',90+Math.random()*60,60,t,.15,v*.5,.003);}
function exKraken(dt,p){const deep=EX.depth>45;if(!EX.krT)EX.krT=0;const K=EX.kr;
  if(!K||K.phase<2){EX.krT=deep?EX.krT+dt:Math.max(0,EX.krT-dt*3);}
  const w=$('exwarn');
  if(EX.krT>KR.T_WARN||(K&&K.phase>=2)){const k=exKrakenBuild();k.t+=dt;
    if(k.phase===0){k.phase=1;k.t=0;const a=Math.random()*6.283;k.dir.set(Math.cos(a),0,Math.sin(a));}
    // 予兆：正体は見せない。ボートより下の暗がりを、輪郭の定まらない大きな影がときどき横切る（目も青い筋も出さない）。
    // 闇の奥でかすかに瞬く光、低い唸り、ときどき船体に伝わる鈍い衝撃。正体は襲いかかる瞬間に暗がりから現れて初めて分かる
    if(k.phase===1){k.g.visible=true;{const cd=camera.getWorldDirection(_kt);const a0=Math.atan2(cd.z,cd.x),a=a0+Math.sin(k.t*.22)*1.3;k.dir.set(Math.cos(a),0,Math.sin(a));}
      {const R=30+4*Math.sin(k.t*.35),x=p.x+k.dir.x*R,z=p.z+k.dir.z*R,fl=Math.max(exGround(x,z),exGround(x+3,z),exGround(x,z+3),exGround(x-3,z),exGround(x,z-3));k.pos.set(x,Math.min(-12,Math.max(fl+12,p.y-9+Math.sin(k.t*.5)*2)),z);}   /* 海底に刺さらない（腕の長さぶん上）・水面から外套が出ない */
      {const fl=k.fl=(k.fl||0)-dt;if(fl<=0&&Math.random()<dt*.6)k.fl=.12+Math.random()*.15;KR.glow.value=k.fl>0?.35:0;}   /* 闇の奥で一瞬だけ瞬く */
      EX.shake=Math.max(0,(EX.shake||0)-dt*.8);if((k.thump=(k.thump===undefined?2.5:k.thump)-dt)<=0){k.thump=3+Math.random()*2.5;EX.shake=.22;if(AU.ctx)tone(AU.sfx,'sine',52,24,AU.ctx.currentTime,.9,.5,.01);}   /* 船体に伝わる鈍い衝撃 */
      if(w){w.hidden=false;const left=Math.max(0,Math.ceil(KR.T_ATK-EX.krT));w.textContent='深度45m超過　'+(left>6?'暗闇で何かが動いた……':left>3?'……下に、大きな何かがいる':'浮上しろ　残り '+left+' 秒');}
      if(AU.ctx&&(EX.krHum=(EX.krHum||0)-dt)<=0){EX.krHum=1.6;tone(AU.sfx,'sine',38,30,AU.ctx.currentTime,1.6,.35,.4);}
      if(EX.krT>=KR.T_ATK){k.phase=2;k.t=0;EX.krLock=true;k.from=k.pos.clone();k.f0=KR.fade.value;}
      if(!deep&&EX.krT<KR.T_WARN){k.phase=0;k.g.visible=false;EX.shake=0;k.thump=undefined;if(w)w.hidden=true;}}
    // 襲いかかる（1.6 秒）→ 巻き付く（1.8 秒）→ 電撃（3.2 秒）→ ゲームオーバー
    if(k.phase===2){const u=Math.min(1,k.t/1.6),e=u*u*(3-2*u);{const ax=p.x-camera.position.x,az=p.z-camera.position.z,al=Math.hypot(ax,az)||1;k.away=[ax/al,az/al];}k.pos.copy(k.from).lerp(_kv.set(p.x+k.away[0]*2.2,p.y+5.2,p.z+k.away[1]*2.2),e);k.pos.y=Math.max(k.pos.y,exGround(k.pos.x,k.pos.z)+10);KR.glow.value=.8+.2*Math.sin(k.t*9);if(w)w.textContent='巨大電気イカだ！';if(u>=1){k.phase=3;k.t=0;}}
    if(k.phase>=3){const aw=k.away||[0,1];k.pos.set(p.x+aw[0]*2.2+Math.sin(k.t*7)*.15,p.y+5.2,p.z+aw[1]*2.2+Math.cos(k.t*6)*.15);}
    if(k.phase===3&&k.t>1.8){k.phase=4;k.t=0;}
    if(k.phase===4){KR.glow.value=1.4+Math.random();k.arcs.visible=true;k.lt.intensity=6+Math.random()*14;k.lt.position.set(p.x,p.y+1.5,p.z);const fl=$('exflash');if(fl)fl.style.opacity=(Math.random()<.35?.55+Math.random()*.4:Math.random()*.15).toFixed(2);
      if(Math.random()<.5)exZap(.5+Math.random()*.5);G.lensWet=Math.max(G.lensWet||0,.2);
      if(k.t>3.2){k.phase=5;exGameOver();}}
    // 現れ方：予兆の間は影がかすかに見えるだけ（0.05〜0.18）。襲いかかる 0.7 秒で暗がりから浮かび上がる。目は影の間は出さない
    {const f=k.phase===1?.05+.13*Math.max(0,Math.sin(k.t*.6))*Math.min(1,k.t/2):k.phase===2?Math.min(1,(k.f0||0)+k.t/.7):1,fe=k.phase===1?f:f*f*(3-2*f);KR.fade.value=fe;
      for(const e of k.g.userData.eyes||[]){e.visible=fe>.3;if(e.userData.c0)e.material.color.copy(e.userData.c0).multiplyScalar(fe);}}
    // 体の向き：外套を上（外套の先が上、腕が下でボートへ）。頭が少しボートを向く
    {const pu=1+.06*Math.sin(k.t*(k.phase>=2?5:1.8));k.mantle.scale.set(pu,1,pu);for(const f of k.g.userData.fins||[])f.rotation.y=Math.sin(k.t*2.2)*.25*Math.sign(f.scale.x);}   /* 外套の脈動とひれの波打ち */
    k.g.position.copy(k.pos);k.g.rotation.set(k.phase>=2?0:.3,Math.atan2(k.dir.x,k.dir.z),0);
    // 腕：予兆では下へ垂れて揺れ、巻き付きでは船体の輪のまわりを螺旋に回って締まる
    const grab=k.phase===2?Math.max(0,(k.t-1.0)/.6):k.phase>=3?1:0;
    k.arms.forEach((a,i)=>{a.m.visible=true;const an=i/10*Math.PI*2,root=_kv.set(k.pos.x+Math.cos(an)*.42,k.pos.y-1.5,k.pos.z+Math.sin(an)*.42).clone(),pts=[root];const L=a.long?17:10;
      for(let j=1;j<=6;j++){const t=j/6;const free=new V3(root.x+Math.cos(an)*t*3+Math.sin(k.t*1.4+a.ph+t*3)*t*1.5,root.y-t*L,root.z+Math.sin(an)*t*3+Math.cos(k.t*1.2+a.ph+t*2.5)*t*1.5);
        const wa=an+t*3.2+(k.phase>=3?Math.sin(k.t*3+i)*.1:0),rr=2.45+.35*Math.sin(t*6+i),hy=p.y+.6+.9*Math.sin(t*4+i)-t*.4,wrap=new V3(p.x+Math.cos(wa)*rr,hy,p.z+Math.sin(wa)*rr);const q2=free.lerp(wrap,Math.min(1,grab*(1.3-t*.3)));q2.y=Math.max(q2.y,exGround(q2.x,q2.z)+.4);pts.push(q2);}
      exArm(a,pts,a.long?.34:.42,.025);a.last=pts[pts.length-1];a.mid=pts[3];});
    if(k.phase===4){const P=k.arcs.geometry.attributes.position.array,SP=k.spk.geometry.attributes.position.array;let n=0,ns=0;k.spk.visible=true;for(const a of k.arms)for(let rep=0;rep<2;rep++){const src=rep?a.last:a.mid;let x0=src.x,y0=src.y,z0=src.z;const ang=Math.random()*6.283,x1=p.x+Math.cos(ang)*(1+Math.random()*1.4),y1=p.y+.5+Math.random()*1.3,z1=p.z+Math.sin(ang)*(1+Math.random()*1.4);
        for(let s2=1;s2<=8&&n<1198;s2++){const t=s2/8,j=(1-Math.abs(t*2-1))*.5;const x=x0+(x1-x0)/(9-s2)+(Math.random()-.5)*j,y=y0+(y1-y0)/(9-s2)+(Math.random()-.5)*j,z=z0+(z1-z0)/(9-s2)+(Math.random()-.5)*j;P[n*3]=x0;P[n*3+1]=y0;P[n*3+2]=z0;n++;P[n*3]=x;P[n*3+1]=y;P[n*3+2]=z;n++;if(ns<400&&Math.random()<.5){SP[ns*3]=x;SP[ns*3+1]=y;SP[ns*3+2]=z;ns++;}x0=x;y0=y;z0=z;}}
      for(let i=n;i<1200;i++)P[i*3+1]=-1e4;for(let i=ns;i<400;i++)SP[i*3+1]=-1e4;k.arcs.geometry.attributes.position.needsUpdate=true;k.spk.geometry.attributes.position.needsUpdate=true;}
    else if(k.spk)k.spk.visible=false;
    // 揺れ：捕まってからはボートとカメラが震える
    if(k.phase>=3){EX.shake=k.phase===4?.35:.12;}}
  else if(w&&!w.hidden&&(!EX.kr||EX.kr.phase<2))w.hidden=true;}
// 読み込み中だけ、まだ出ていない物（数が 0 の一括描画・水中の水面・マリンスノー・航跡・イカ）を見える状態にして、シェーダを先に用意させる。
// three.js は描かれた物のシェーダしか作らないので、こうしないと初めて陸に上がる・潜る瞬間に作り直しで固まる
const _warm=[];
function exWarmAll(on){if(on){_warm.length=0;exKrakenWarm(true);const fwd=camera.getWorldDirection(new V3()).multiplyScalar(15).add(camera.position);
    scene.traverse(o=>{if(o.isInstancedMesh&&o.count===0&&o.instanceMatrix.count>0){_warm.push([o,'count',0,o.visible]);o.count=1;o.visible=true;const m=new THREE.Matrix4().setPosition(fwd);o.setMatrixAt(0,m);o.instanceMatrix.needsUpdate=true;}});
    for(const o of[EX.surf,EX.snow,EXWK.m,EXWK.ring])if(o&&!o.visible){_warm.push([o,'vis',0,false]);o.visible=true;}}
  else{exKrakenWarm(false);for(const[o,k,v,vis]of _warm){if(k==='count')o.count=v;o.visible=vis;}_warm.length=0;}}
// 読み込み中だけ、イカの全部の部品を見える状態にしてシェーダを用意させる
function exKrakenWarm(on){const k=EX.kr;if(!k)return;k.g.visible=on;k.arcs.visible=on;k.spk.visible=on;for(const a of k.arms)a.m.visible=on;if(on){k.g.position.copy(camera.position).add(camera.getWorldDirection(new V3()).multiplyScalar(20));}}
function exKrakenReset(){const K=EX.kr;EX.krT=0;EX.krLock=false;EX.shake=0;KR.fade.value=0;if(K){K.thump=undefined;K.fl=0;}const w=$('exwarn');if(w)w.hidden=true;const fl=$('exflash');if(fl)fl.style.opacity=0;if(!K)return;K.phase=0;K.t=0;K.g.visible=false;K.arcs.visible=false;if(K.spk)K.spk.visible=false;K.lt.intensity=0;for(const a of K.arms)a.m.visible=false;}
function exGameOver(){const o=$('exover');if(o)o.hidden=false;const fl=$('exflash');if(fl)fl.style.opacity=0;EX.over=true;if(!EX.ovBound){EX.ovBound=true;$('bExRetry').onclick=()=>{SFX.ui&&SFX.ui();exRetry();};$('bExTitle').onclick=()=>{SFX.ui&&SFX.ui();$('exover').hidden=true;exKrakenReset();EX.over=false;showTitle();};}}
function exRetry(){$('exover').hidden=true;exKrakenReset();EX.over=false;EX.pos.set(BASE.x+1420,0,BASE.z+150);EX.yaw=Math.PI*.5;EX.spd=0;EX.depth=0;EX.prevD=0;EX.camReset=true;EX.cam.set(EX.pos.x+14,5,EX.pos.z);}
// 段ボール箱：1 箱ずつの簡単な剛体。ボートに当たると押されて転がり、支えを失った上の箱は落ちて崩れる。止まると眠る（計算しない）。終了時に元へ
function exCratesInit(){EX.crates=[];EX.crSets=[];for(const S of (typeof CARTON_SETS!=='undefined'?CARTON_SETS:[])){S.par.updateMatrixWorld(true);const set={im:S.im,inv:new THREE.Matrix4().copy(S.par.matrixWorld).invert(),dirty:false};EX.crSets.push(set);
  S.list.forEach((b,i)=>{const w=new V3(b[0],b[1],b[2]).applyMatrix4(S.par.matrixWorld);EX.crates.push({i,set,p:w,p0:w.clone(),q:new THREE.Quaternion().setFromEuler(new THREE.Euler(0,b[6],0)),q0:null,v:new V3(),w:new V3(),hx:b[3]/2,hy:b[4]/2,hz:b[5]/2,sc:new V3(b[3],b[4],b[5]),awake:false,moved:false});});}
  for(const c of EX.crates)c.q0=c.q.clone();
  // 近くの箱だけを調べるための格子（元の位置で 8m）
  EX.crG=new Map();for(const c of EX.crates){const k=Math.floor(c.p0.x/8)*100000+Math.floor(c.p0.z/8);let a=EX.crG.get(k);if(!a)EX.crG.set(k,a=[]);a.push(c);}}
function exCratesNear(x,z,r){const out=[];if(!EX.crG)return out;for(let i=Math.floor((x-r)/8);i<=Math.floor((x+r)/8);i++)for(let j=Math.floor((z-r)/8);j<=Math.floor((z+r)/8);j++){const a=EX.crG.get(i*100000+j);if(a)for(const c of a)out.push(c);}return out;}
const _crq=new THREE.Quaternion(),_crm=new THREE.Matrix4(),_crv=new V3();
function exCrateWake(c){if(c.awake)return;c.awake=true;c.moved=true;for(const o of EX.crates)if(o!==c&&!o.awake&&o.p.y>c.p.y+.1&&Math.hypot(o.p.x-c.p.x,o.p.z-c.p.z)<.75)exCrateWake(o);}
function exCratesUpdate(dt,p){if(!EX.crates||!EX.crates.length)return;const NB=exCratesNear(p.x,p.z,6),near=NB.length>0;let any=false;
  // 押される相手：ボートと、動いている車（円で近似）
  const hitters=[[p.x,p.z,2.45,p.y,-Math.sin(EX.yaw)*EX.spd,-Math.cos(EX.yaw)*EX.spd,true]];if(EX.push)for(const v of EX.push){if(!v.moved||v.v.lengthSq()<.25)continue;const w=v.o.getWorldPosition(new V3());hitters.push([w.x,w.z,Math.max(v.hx,v.hz)*.8,w.y,v.v.x,v.v.z,false]);for(const c of exCratesNear(w.x,w.z,6))NB.push(c);}
  for(const H of hitters){const hp={x:H[0],z:H[1],y:H[3]},vb=_crv.set(H[4],0,H[5]);for(const c of (H[6]?NB:exCratesNear(H[0],H[1],6))){const dx=c.p.x-hp.x,dz=c.p.z-hp.z,dd=Math.hypot(dx,dz),rr=H[2]+Math.max(c.hx,c.hz);if(dd>rr||c.p.y-c.hy>hp.y+2.2||c.p.y+c.hy<hp.y-.5)continue;
      const nx=dx/(dd||1),nz=dz/(dd||1),pen=rr-dd;c.p.x+=nx*pen;c.p.z+=nz*pen;const vn=Math.max(0,vb.x*nx+vb.z*nz);c.v.x+=nx*(vn*1.1+.6)+vb.x*.3;c.v.z+=nz*(vn*1.1+.6)+vb.z*.3;c.v.y+=vn*.35;
      c.w.set((Math.random()-.5)*4+nz*vn*1.5,(Math.random()-.5)*3,(Math.random()-.5)*4-nx*vn*1.5);exCrateWake(c);if(H[6])EX.spd*=.985;}}
  for(const c of EX.crates){if(!c.awake)continue;any=true;c.set.dirty=true;c.v.y-=9.8*dt;c.p.addScaledVector(c.v,dt);const wl=c.w.length();if(wl>1e-4){_crq.setFromAxisAngle(_crv.copy(c.w).divideScalar(wl),wl*dt);c.q.premultiply(_crq);}
    // 支え：床（立てる高さ）か、下にある箱の上面
    let sup=exStandH(c.p.x,c.p.z,c.p.y)+.2;for(const o of exCratesNear(c.p.x,c.p.z,3)){if(o===c||o.p.y>=c.p.y-.05)continue;if(Math.hypot(o.p.x-c.p.x,o.p.z-c.p.z)<(Math.max(o.hx,o.hz)+Math.max(c.hx,c.hz))*.75)sup=Math.max(sup,o.p.y+o.hy);}
    const half=c.hy*.9+.05*Math.min(1,c.w.length());if(c.p.y-half<sup){c.p.y=sup+half;if(c.v.y<0)c.v.y*=-.18;c.v.x*=.86;c.v.z*=.86;c.w.multiplyScalar(.8);
      // 寝かせる：上向きに近い面へ少しずつ回して落ち着かせる
      const up=_crv.set(0,1,0).applyQuaternion(c.q);if(up.y<.98){const ax=new V3(up.z,0,-up.x);if(ax.lengthSq()>1e-6){ax.normalize();c.q.premultiply(_crq.setFromAxisAngle(ax,Math.min(.15,Math.acos(Math.min(1,Math.abs(up.y))))*(up.y>0?1:-1)*.5));}}
      if(c.v.lengthSq()<.004&&c.w.lengthSq()<.004)c.awake=false;}
    // 箱どうし：重なったら押し離す
    // 壁・建物（当たり判定の箱）にぶつかったら止まる
    for(const k of exColsNear(c.p.x,c.p.z,1)){if(k[4]<c.p.y-c.hy+.3||k[1]>c.p.y+c.hy)continue;const ex2=c.p.x-k[6],ez2=c.p.z-k[7];let lx=ex2*k[10]+ez2*k[11],lz=ex2*k[12]+ez2*k[13];const R2=Math.max(c.hx,c.hz)*.8;const qx=Math.max(-k[8],Math.min(k[8],lx)),qz=Math.max(-k[9],Math.min(k[9],lz));const d2=Math.hypot(lx-qx,lz-qz);if(d2>=R2)continue;
      if(d2<1e-4){if(k[8]-Math.abs(lx)<k[9]-Math.abs(lz))lx=(lx<0?-1:1)*(k[8]+R2);else lz=(lz<0?-1:1)*(k[9]+R2);}else{lx=qx+(lx-qx)/d2*R2;lz=qz+(lz-qz)/d2*R2;}c.p.x=k[6]+lx*k[10]+lz*k[12];c.p.z=k[7]+lx*k[11]+lz*k[13];c.v.x*=-.2;c.v.z*=-.2;}
    for(const o of exCratesNear(c.p.x,c.p.z,3)){if(o===c)continue;const dx=c.p.x-o.p.x,dz=c.p.z-o.p.z,dy=Math.abs(c.p.y-o.p.y);const dd=Math.hypot(dx,dz),rr=(Math.max(o.hx,o.hz)+Math.max(c.hx,c.hz))*.8;if(dd<rr&&dy<(o.hy+c.hy)*.9){const k=(rr-dd)*.5/(dd||1);c.p.x+=dx*k;c.p.z+=dz*k;if(!o.awake){o.p.x-=dx*k*.6;o.p.z-=dz*k*.6;exCrateWake(o);}}}}
  if(any)for(const c of EX.crates){if(!c.set.dirty||!c.moved)continue;_crm.compose(c.p,c.q,c.sc).premultiply(c.set.inv);c.set.im.setMatrixAt(c.i,_crm);}
  for(const S of EX.crSets)if(S.dirty){S.im.instanceMatrix.needsUpdate=true;S.dirty=false;}}
function exCratesReset(){if(!EX.crates)return;for(const c of EX.crates){if(!c.moved)continue;c.p.copy(c.p0);c.q.copy(c.q0);c.v.set(0,0,0);c.w.set(0,0,0);c.awake=false;c.moved=false;_crm.compose(c.p,c.q,c.sc).premultiply(c.set.inv);c.set.im.setMatrixAt(c.i,_crm);c.set.im.instanceMatrix.needsUpdate=true;}}
function exPushReset(){if(!EX.push)return;for(const c of EX.push){if(!c.moved)continue;c.o.position.copy(c.p0);c.o.quaternion.copy(c.q0);c.v.set(0,0,0);c.w=0;c.moved=false;c.o.userData.pushed=0;}}
// 草・石・海藻・珊瑚を、ボートのまわりに置き直す
function exScatter(cx,cz){const s=[0,0,0,0],d=new THREE.Object3D(),col=new THREE.Color();let ng=0,nr=0,nw=0,nc=0;
  const RR=110,CB=exColsNear(cx,cz,64);
  // 草：近く（14m まで）は細かい株を 0.2m 間隔、その外（40m まで）は軽い株を 0.36m 間隔
  for(const[gi,R0,R,GS]of[[EX.grass,0,18,.24],[EX.grass2,17,60,.44]]){const gc=gi.geometry.attributes.iCol;ng=0;const cap=gi.instanceMatrix.count;
  {const c0=Math.round(cx/GS),c1=Math.round(cz/GS);for(const o of exRing(Math.ceil(R/GS)+1)){if(ng>=cap)break;const x=c0+o[0],z=c1+o[1];
    const wx=x*GS+hash2(x,z,1)*GS,wz=z*GS+hash2(x,z,2)*GS,ed=Math.sqrt((wx-cx)**2+(wz-cz)**2);if(ed>R||ed<R0)continue;terrSample(wx,wz,s);const h=s[0];if(h<5+3*hash2(Math.floor(wx/4),Math.floor(wz/4),13)||s[1]>.2)continue;   /* 砂浜（高さ 8m まで）には生やさない */
    const sl=Math.abs(exGround(wx+1,wz)-h)+Math.abs(exGround(wx,wz+1)-h);if(sl>.7||s[3]>.4)continue;if(nearRoad(wx-BASE.x,wz-BASE.z,10.5)||onAirRoad(wx-BASE.x,wz-BASE.z,1.2))continue;
    {let inB=false;for(const c of CB)if(wx>c[0]-.3&&wx<c[3]+.3&&wz>c[2]-.3&&wz<c[5]+.3&&c[1]<h+1){inB=true;break;}if(inB)continue;}
    const fm=s[2],dens=.7+.3*hash2(Math.floor(wx/9),Math.floor(wz/9),3);if(hash2(x,z,4)>dens)continue;
    const fade=R>20?Math.min(1,(R-ed)/16):1,patch=hash2(Math.floor(wx/3.1),Math.floor(wz/3.1),14),sc=(.55+.5*hash2(x,z,5)+.35*patch)*(1+fm*.3)*Math.max(.15,fade)*(R>20?1.15:1);
    d.position.set(wx,h+((hash2(x,z,6)-.5)*.06)-.03,wz);d.rotation.set((hash2(x,z,7)-.5)*.25,hash2(x,z,8)*6.28,(hash2(x,z,9)-.5)*.25);d.scale.set(sc*(.9+.3*hash2(x,z,15)),sc*(.55+.5*hash2(x,z,10)),sc);d.updateMatrix();gi.setMatrixAt(ng,d.matrix);
    const dry=Math.pow(hash2(Math.floor(wx/7),Math.floor(wz/7),11),3)*.8+Math.pow(hash2(x,z,16),6)*.6,lush=hash2(Math.floor(wx/2.3),Math.floor(wz/2.3),17);
    col.setRGB(.075+.2*dry,.17+.07*dry+.04*lush,.035+.045*dry).multiplyScalar(.75+.45*hash2(x,z,12));gc.setXYZ(ng,col.r,col.g,col.b);ng++;}
  }gi.count=ng;gi.instanceMatrix.needsUpdate=true;gc.needsUpdate=true;}
  // 石：浜・崖の下・海底
  {const c0=Math.round(cx/3),c1=Math.round(cz/3);for(const o of exRing(Math.ceil(RR/3)+1)){const x=c0+o[0],z=c1+o[1];const wx=x*3+hash2(x,z,21)*3,wz=z*3+hash2(x,z,22)*3;if((wx-cx)**2+(wz-cz)**2>RR*RR)continue;
    terrSample(wx,wz,s);const h=s[0],cl=s[3];const p=h<-0.5?.1:h<3?.08+cl*.5:cl*.35;if(hash2(x,z,23)>p)continue;
    // 海底：海藻と珊瑚
    if(nr>=EX.rocks.instanceMatrix.count)continue;const sc=(h<3?.15+.5*hash2(x,z,29)**2:.3+1.4*hash2(x,z,29)**2);d.position.set(wx,h+sc*.15,wz);d.rotation.set(hash2(x,z,31)*3,hash2(x,z,32)*6,hash2(x,z,33)*3);d.scale.set(sc*(.8+.5*hash2(x,z,34)),sc,sc*(.8+.5*hash2(x,z,35)));d.updateMatrix();
    EX.rocks.setMatrixAt(nr,d.matrix);const k=.55+.4*hash2(x,z,36);EX.rocks.setColorAt(nr,h<0?col.setRGB(.42*k,.43*k,.38*k):col.setRGB(.5*k,.47*k,.42*k));nr++;}
  }EX.rocks.count=nr;EX.rocks.instanceMatrix.needsUpdate=true;exRockBumps();EX.rocks.instanceMatrix.needsUpdate=true;EX.rocks.instanceColor.needsUpdate=true;
  EX.gc.set(cx,0,cz);exTrees(cx,cz);}
// 水面の高さ（海の波と同じ式の大きな 3 つ）
const EXWAV=[[.955,.296,.02027,2.6],[.454,.891,.03307,1.7],[.878,-.479,.05236,1.1],[-.416,.909,.08378,.6],[.697,.717,.1366,.38],[.267,-.964,.2167,.22]];
// 海面の高さ：水の頂点シェーダと同じ式（凪の 0.3 倍・港内の減衰・浅瀬の減衰）
function exHarb(x,z){const lx=x,lz=z-21000,u=Math.min(1,Math.max(0,(lx-1282)/358)),zn=-246+96*u,zs=556-116*u;return smooth(1268,1296,lx)*(1-smooth(1648,1672,lx))*smooth(zn-6,zn+14,lz)*(1-smooth(zs-14,zs+6,lz));}
function exShoreH0(x,z){const im=U.tShore.value.image,N=im.width,d=im.data;let u=(x+3200)/6400*N-.5,v=(z-21000+3400)/6800*N-.5;u=Math.max(0,Math.min(N-1.001,u));v=Math.max(0,Math.min(N-1.001,v));
  const i=Math.floor(u),j=Math.floor(v),fu=u-i,fv=v-j,g=(a,b)=>d[(b*N+a)*4];return ((g(i,j)*(1-fu)+g(i+1,j)*fu)*(1-fv)+(g(i,j+1)*(1-fu)+g(i+1,j+1)*fu)*fv)/255*72-64;}
// 海の底の深さ：水の色の図（-64m まで）に、沖の大陸斜面（島の中心から 2.4km より先で深くなる）を足す
function exShoreH(x,z){const h=exShoreH0(x,z);if(h>-40)return h;const d=Math.hypot(x-BASE.x,z-BASE.z);return h-Math.max(0,d-2400)*.06*smooth(-40,-60,h);}
function exWave(x,z){const t=U.uTime.value;let y=0;for(const W of EXWAV)y+=W[3]*Math.sin(W[2]*(W[0]*x+W[1]*z)-Math.sqrt(9.8*W[2])*t);
  return y*.3*(1-.88*exHarb(x,z))*(.12+.88*smooth(0,9,-exShoreH(x,z)));}
// ── 始める・やめる
const EXREF=window.EXREF={on:false,rt:null};
// 読み込み画面を出してから、重い準備（形・草・木・シェーダの用意）をコマを分けて進める。終わったら画面を切り替える
let exLoading=false;
// 描画プログラム（シェーダ）を、画面を止めずに用意する。three r128 はプログラムを作るとすぐ中身を問い合わせ、組み立ての完了を待つ
// （初めての環境では 1 本 0.15 秒ほど、全部で 20 秒以上画面が止まっていた）。そこで 3 段に分ける：
//  1) 問い合わせの直前で抜けて、組み立ての指示だけを全部出す（GPU 側で並行して進む）
//  2) 終わったかを軽く確かめながら待つ。この間は読み込み中のミニゲームが動ける
//  3) もう一度通して仕上げる（組み立て済みなので待たない）
// 通常の描画と水面の映り込み（切り取り面つき）の 2 通り。切り取り面の有無は render() のときに決まるので、空の場面を一度描いて切り替える
async function exPrecompile(prog){const gl=renderer.getContext(),ext=gl.getExtension('KHR_parallel_shader_compile');
  const objs=[];scene.traverse(o=>{if(o.material)objs.push(o);});const empty=new THREE.Scene(),rt0=renderer.getRenderTarget(),au=renderer.shadowMap.autoUpdate,dbg=renderer.debug.checkShaderErrors;
  const SKIP={},AU_=gl.ACTIVE_UNIFORMS;let skip=false;const gpp=gl.getProgramParameter;
  const pass=async(k0,k1)=>{for(const clip of[false,true]){
      renderer.shadowMap.autoUpdate=false;renderer.clippingPlanes=clip?(EXREF.clip||(EXREF.clip=[new THREE.Plane(new V3(0,1,0),.05)])):[];renderer.setRenderTarget(rtScene);renderer.render(empty,camera);
      let i=0;const px={isScene:true,fog:scene.fog,environment:scene.environment,traverseVisible:f=>scene.traverseVisible(f),
        traverse:f=>{const t=performance.now();while(i<objs.length&&performance.now()-t<10){try{f(objs[i++]);}catch(e){if(e!==SKIP)throw e;}}}};
      while(i<objs.length){renderer.setRenderTarget(rtScene);renderer.compile(px,camera);prog(k0+(k1-k0)*((clip?objs.length:0)+i)/(objs.length*2));await new Promise(r=>setTimeout(r,0));}}};
  try{exWarmAll(true);renderer.debug.checkShaderErrors=false;   /* エラー確認は組み立ての完了を待つので切る（失敗しても描画で分かる） */
    if(ext){gl.getProgramParameter=function(q,n){if(skip&&n===AU_)throw SKIP;return gpp.call(gl,q,n);};
      skip=true;await pass(0,.2);skip=false;
      const ps=renderer.info.programs.map(q=>q.program),t0=performance.now();
      let n=0;for(;;){while(n<ps.length&&gpp.call(gl,ps[n],ext.COMPLETION_STATUS_KHR))n++;prog(.2+.7*n/ps.length);if(n>=ps.length||performance.now()-t0>60000)break;await new Promise(r=>setTimeout(r,60));}   /* 作った順に確かめ、まだのものに当たったら次の回へ（問い合わせは GPU が混むと 1 回でも待たされる） */
      await pass(.9,1);}
    else await pass(0,1);}   /* 並行して組み立てられない環境：少しずつ組み立てる */
  finally{skip=false;if(Object.prototype.hasOwnProperty.call(gl,'getProgramParameter'))delete gl.getProgramParameter;renderer.debug.checkShaderErrors=dbg;
    renderer.clippingPlanes=[];renderer.setRenderTarget(rtScene);renderer.render(empty,camera);renderer.setRenderTarget(rt0);renderer.shadowMap.autoUpdate=au;exWarmAll(false);}}
// 巨大イカの光はゲームの起動時から置いておく（探検に入って初めて足すと、本編に戻ったときに全部の材質のシェーダが作り直しになる）
function exKrLight(){if(!EX.krLt){EX.krLt=new THREE.PointLight(0x88bbff,0,40,1.6);scene.add(EX.krLt);}return EX.krLt;}
async function exStartAsync(){if(exLoading||EX.on)return;exLoading=true;const L=$('exload'),bar=L.querySelector('.bar i'),msg=L.querySelector('.m');L.classList.remove('out');L.hidden=false;
  /* 読み込み中のミニゲーム（船体のアカフジツボはがし） */try{bnStart(L.querySelector('.bnh'));}catch(e){console.error(e);}EX.loadLock=true;const go=$('bExGo');go.hidden=true;
  EX.ldT0=performance.now();const y=()=>new Promise(r=>setTimeout(r,30));let kMax=0;const st=(k,t)=>{kMax=Math.max(kMax,k);bar.style.width=kMax+'%';msg.textContent=t;};   /* バーは戻さない */
  try{st(8,'ボートを用意しています');await y();await y();EXREF.hold=true;exInit();
    st(30,'島と海を細かく描いています');await y();startExplore();
    st(45,'光と影を準備しています');await y();EX.pcRun=true;try{await exPrecompile(k=>st(45+Math.round(k*40),'光と影を準備しています'));}finally{EX.pcRun=false;}
    // 読み込みは最低 15 秒（準備が早く終わってもミニゲームで遊ぶ間を残す）。自動テストのときは待たない
    if(!navigator.webdriver){const T0=EX.ldT0,MIN=15000;for(;;){const e=performance.now()-T0;if(e>=MIN)break;st(85+Math.round(10*Math.min(1,e/MIN)),'まもなく出発');await new Promise(r=>setTimeout(r,200));}}
    // 最後に本物の描画を始める。Safari（Metal）は最初に描く瞬間に描画パイプラインを作るので、初めての環境では数秒止まる。
    // ミニゲームの途中で止まらないよう、遊ぶ時間が終わってからここで一度だけ止まる（表示を先に出してから）
    st(96,'仕上げています');await new Promise(r=>setTimeout(r,80));EXREF.hold=false;
    try{exWarmAll(true);__SR.step(1/60);exWarmAll(false);}catch(e){exWarmAll(false);}if(EX.on)__SR.step(1/60);
    st(100,'準備完了');await y();
    // 読み込みが終わったら「出発する」を出す（自動テストのときはそのまま進む）
    if(!navigator.webdriver){go.textContent='出発する'+(BN.score&&BN.score()?'（はがした数 '+BN.score()+'）':'');go.hidden=false;await new Promise(res=>{const iv=setInterval(()=>{if(BN.score)go.textContent='出発する'+(BN.score()?'（はがした数 '+BN.score()+'）':'');},300);const f=()=>{clearInterval(iv);go.removeEventListener('click',f);res();};go.addEventListener('click',f);});}}
  catch(e){console.error('AquaTopia の準備に失敗',e);try{stopExplore();}catch(_){}showTitle();}
  finally{exLoading=false;EX.loadLock=false;EXREF.hold=false;bnStop();$('bExGo').hidden=true;L.classList.add('out');setTimeout(()=>{if(L.classList.contains('out'))L.hidden=true;},500);}}
function startExplore(){exInit();EX.on=true;G.mode='explore';document.body.classList.add('explore');$('tbA').textContent='浮く';$('tbB').textContent='潜る';
  ['title','hud','over','res','pause','help','opts','skip'].forEach(i=>$(i).hidden=true);$('exhud').hidden=false;
  EX.pos.set(BASE.x+1420,0,BASE.z+150);EX.yaw=Math.PI*.5;/* 港の中の水面から（東へ向いて） */EX.spd=0;EX.vel.set(0,0,0);EX.depth=0;EX.mode='water';EX.t=0;EX.b.visible=true;EX.patch.visible=true;EX.surf.visible=false;
  EX.pc.set(1e9,0,1e9);EX.gc.set(1e9,0,1e9);exPlacePatch(Math.round(EX.pos.x/10)*10,Math.round(EX.pos.z/10)*10);exScatter(EX.pos.x,EX.pos.z);
  {const pg=baseGroup.userData.palmGeo,pm=baseGroup.userData.palms;if(pg&&pm){if(!pg.hi)pg.hi=pg.mk();pm[0].geometry=pg.hi;}}   /* 探検ではヤシの冠を細かい形に */
  EX.cam.set(EX.pos.x+14,EX.pos.y+5,EX.pos.z);EX.camReset=true;U.uStorm.value=1;U.uCalm.value=1;U.uExD.value=1;setMood('title');cloudReset=true;if(AU.ctx)initAudio();}
function stopExplore(){exKrakenReset();if($('exover'))$('exover').hidden=true;EX.over=false;{const pg=baseGroup.userData.palmGeo,pm=baseGroup.userData.palms;if(pg&&pm)pm[0].geometry=pg.lo;}EXREF.on=false;EXREF.refl=false;U.uCalm.value=0;U.uExD.value=0;if(!EX.b)return;exWakeOff();EX.camUw=undefined;exPushReset();exCratesReset();exTreesOff();EX.on=false;EX.b.visible=EX.patch.visible=EX.surf.visible=false;EX.grass.count=EX.grass2.count=EX.rocks.count=0;seaOff();
  DETU.uDet.value.set(1e9,1e9,-1e9,-1e9);EXU.uUw.value=0;finalMat.uniforms.uUnder.value=0;document.body.classList.remove('explore');$('exhud').hidden=true;$('tbA').textContent='発射';$('tbB').textContent='ブースト';}
// ── 毎コマ：操縦、水上・陸上・海中の動き、カメラ、まわりの描き直し
const EX_NOIN={x:0,y:0,boost:false,act:false,xb:false};
function exploreUpdate(dt){const I=(EX.krLock||EX.loadLock)?EX_NOIN:input,b=EX.b,p=EX.pos;EX.t+=dt;
  const gnd=exStandH(p.x,p.z,p.y),wv=exWave(p.x,p.z),dive=I.boost,up=I.act;
  // 走る場所：陸（地面が水面より上）・水上・海中
  const onLand=gnd>wv-.3&&EX.depth<.3;EX.mode=onLand?'land':EX.depth>.3?'dive':'water';
  // ブースト（E／加速ボタン）：最高速度 2.2 倍・加速も強く。ゲージを使い切ると回復するまで使えない
  if(EX.bst===undefined){EX.bst=100;EX.bLock=false;}const bOn=I.xb&&!EX.bLock&&EX.bst>0&&I.y>0;EX.bst=bOn?Math.max(0,EX.bst-dt*9):Math.min(100,EX.bst+dt*(EX.bLock?18:12));if(EX.bst<=0)EX.bLock=true;if(EX.bLock&&EX.bst>35)EX.bLock=false;EX.boosting=bOn;
  const bk=bOn?2.2:1,vmax=(EX.mode==='land'?8:EX.mode==='dive'?6.5:15)*bk,acc=(EX.mode==='land'?6:4.5)*(bOn?1.8:1);
  EX.spd=damp(EX.spd,I.y*vmax,I.y?acc*.25:EX.mode==='land'?1.6:.6,dt);EX.fovK=damp(EX.fovK||0,bOn?1:0,3,dt);
  EX.yawRate=damp(EX.yawRate,-I.x*(EX.mode==='land'?.9:.75)*(.35+.65*Math.min(1,Math.abs(EX.spd)/4))*(EX.spd<-.1?-1:1),4,dt);EX.yaw+=EX.yawRate*dt;
  // 潜る・浮く（海の上だけ。海底の 1.5m 上まで）
  if(EX.mode!=='land'){const floor=-(gnd)-1.6;if(dive)EX.depth=Math.min(EX.depth+dt*2.2,Math.max(0,floor));else if(up||EX.depth<1)EX.depth=Math.max(0,EX.depth-dt*(up?2.6:.8));
    EX.depth=Math.min(EX.depth,Math.max(0,floor));}
  const fx=-Math.sin(EX.yaw),fz=-Math.cos(EX.yaw);let nx=p.x+fx*EX.spd*dt,nz=p.z+fz*EX.spd*dt;
  // 陸の急な坂・建物は通れない
  const ng=exStandH(nx,nz,p.y),ngT=exGround(nx,nz),gT=exGround(p.x,p.z);if(ngT>wv-.3&&(ngT-Math.max(gT,wv-.3))>.55*Math.max(.2,Math.abs(EX.spd*dt))*2.2){nx=p.x;nz=p.z;EX.spd*=-.2;}
  // 当たり判定：ボートを半径 2.4m の円、物を箱として、めり込んだ分だけ押し戻す（壁に沿って滑れる）。高さはボートの底〜屋根（3m）と重なる物だけ
  {const C=exColsNear(nx,nz),lvl=p.y,R=2.4;let hit=false;
    for(let it=0;it<3;it++)for(const c of C){if(c[4]<=lvl+.7||c[1]>lvl+3)continue;   /* 0.7m までの段は乗り越える／頭より上は通れる */
      const dx=nx-c[6],dz=nz-c[7];let lx=dx*c[10]+dz*c[11],lz=dx*c[12]+dz*c[13];const qx=Math.max(-c[8],Math.min(c[8],lx)),qz=Math.max(-c[9],Math.min(c[9],lz));const ex=lx-qx,ez=lz-qz,d=Math.hypot(ex,ez);if(d>=R)continue;
      if(d<1e-4){if(c[8]-Math.abs(lx)<c[9]-Math.abs(lz))lx=(lx<0?-1:1)*(c[8]+R);else lz=(lz<0?-1:1)*(c[9]+R);}else{lx=qx+ex/d*R;lz=qz+ez/d*R;}
      nx=c[6]+lx*c[10]+lz*c[12];nz=c[7]+lx*c[11]+lz*c[13];hit=true;}
    if(hit)EX.spd*=Math.pow(.2,dt*4);}
  // 木：幹のまわり（樹冠の 3 割）は通れない
  if(VEG.ok&&ng>0){let hit=false;vegNear(nx,nz,10,id=>{if(hit||VEG.st[id]===2)return;const rr=Math.max(.8,VEG.R[id]*.3);if((VEG.X[id]-nx)**2+(VEG.Z[id]-nz)**2<rr*rr)hit=true;});if(hit){nx=p.x;nz=p.z;EX.spd*=-.2;}}
  p.x=nx;p.z=nz;
  exPush(dt,p,fx,fz);exCratesUpdate(dt,p);exKraken(dt,p);
  // 高さと傾き：水上は波に乗る（前後左右の波の高さから傾く）、陸は地面に沿う、海中は深さ
  const h0=onLand?exStandH(p.x,p.z,p.y):wv,hf=onLand?exStandH(p.x+fx*1.6,p.z+fz*1.6,p.y):exWave(p.x+fx*1.6,p.z+fz*1.6),hs=onLand?exStandH(p.x-fz*1.6,p.z+fx*1.6,p.y):exWave(p.x-fz*1.6,p.z+fx*1.6);
  let sup=-1e9;for(let k=0;k<9;k++){const a=k/8*Math.PI*2,r=k===8?0:2.35,sx=p.x+Math.cos(a)*r,sz=p.z+Math.sin(a)*r;
    const tilt=k===8?0:((hf-h0)/1.6*(Math.cos(a)*fx+Math.sin(a)*fz)+(hs-h0)/1.6*(Math.cos(a)*-fz+Math.sin(a)*fx))*r*.8;sup=Math.max(sup,exStandH(sx,sz,p.y)-tilt);}
  sup+=.22;   /* 輪の底（中心より 0.12m 下）＋地面の細かな凹凸 */
  let ty=onLand?sup:EX.depth>0?Math.min(wv,-EX.depth):h0-.25;ty=Math.max(ty,EX.depth>0?sup+.9:sup);
  {const cl=sup-(EX.supP===undefined?sup:EX.supP);if(cl>.01)EX.spd*=Math.max(.55,1-cl*1.2);EX.supP=sup;}   /* 岩や流木に乗り上げると減速 */
  p.y=damp(p.y,ty,onLand?10:3,dt);if(p.y<sup-.05)p.y=sup-.05;
  EX.pitch=damp(EX.pitch,EX.depth>.5?(dive?.12:up?-.1:0):Math.atan2(hf-h0,1.6)*.8,3,dt);EX.roll=damp(EX.roll,EX.depth>.5?EX.yawRate*.2:Math.atan2(hs-h0,1.6)*.8+EX.yawRate*.08,3,dt);
  EXU.uBoat.value.set(EX.gc.x,EX.gc.z);EXU.uBoatY.value=p.y;b.position.copy(p);b.rotation.set(EX.pitch,EX.yaw,EX.roll,'YXZ');if(b.userData.fan)b.userData.fan.rotation.z+=dt*(4+Math.abs(EX.spd)*3);
  {const f=b.userData.flag;if(f){const pa=f.geometry.attributes.position,p0=f.geometry.userData.p0,w=1+Math.abs(EX.spd)*.15;for(let i=0;i<pa.count;i++){const x=p0[i*3];pa.setZ(i,Math.sin(EX.t*8*w-x*9)*.06*x*w);}pa.needsUpdate=true;}}
  // 航跡としぶき（水上）、泡（海中）
  /* 水上の航跡は泡の帯と船首の泡の輪で描く（大きな粒は煙に見えるので出さない） */
  EX.bub-=dt;if(EX.bub<=0&&EX.depth>.5){EX.bub=.09;bpart(BOOM.water,p.x+brn(-.6,.6),p.y+.8,p.z+brn(-.6,.6)+fz*-1.6,0,brn(1.2,2.2),0,Math.min(3,EX.depth/1.8),.12,.3,{g:.8,dr:.4,a:.75,c:_bc.setRGB(.8,.92,.95)});}
  exWakeUpdate(dt,p,fx,fz);
  {const pd=EX.prevD||0,d=EX.depth;const wy=exWave(p.x,p.z);
    if(pd<.3&&d>=.3){// 潜り始め：船体のまわりから外へ跳ねる水、水中へ巻き込まれる泡
      for(let k=0;k<110;k++){const a=k/110*6.283+brn(-.1,.1),r=2.6+brn(0,.5),sp=brn(2,6);bpart(BOOM.water,p.x+Math.cos(a)*r,wy+.2,p.z+Math.sin(a)*r,Math.cos(a)*sp,brn(2.5,7),Math.sin(a)*sp,brn(.6,1.2),.12,brn(.25,.55),{g:-9.8,dr:.6,a:.8,c:_bc.setRGB(.92,.95,.97)});}
      for(let k=0;k<70;k++){const a=Math.random()*6.283,r=brn(.5,2.8);bpart(BOOM.water,p.x+Math.cos(a)*r,wy-brn(.3,1.6),p.z+Math.sin(a)*r,brn(-.4,.4),brn(.6,2.2),brn(-.4,.4),brn(1.2,3),.08,brn(.12,.35),{g:1.6,dr:.5,a:.8,c:_bc.setRGB(.82,.93,.96)});}
      if(SFX.splash)SFX.splash();EX.dive0=0;}
    if(pd>=.45&&d<.3){// 浮上：持ち上がった水が縁から流れ落ちる（1.6 秒）、まわりに泡
      EX.drain=1.6;for(let k=0;k<100;k++){const a=k/100*6.283,r=2.7;bpart(BOOM.water,p.x+Math.cos(a)*r,wy+.3,p.z+Math.sin(a)*r,Math.cos(a)*brn(1,3),brn(3,7),Math.sin(a)*brn(1,3),brn(.7,1.3),.14,brn(.3,.6),{g:-9.8,dr:.5,a:.85,c:_bc.setRGB(.92,.95,.97)});}
      if(SFX.splash)SFX.splash();}
    if(EX.drain>0){EX.drain-=dt;EX.dr2=(EX.dr2||0)-dt;if(EX.dr2<=0){EX.dr2=.03;const a=Math.random()*6.283,r=2.45;bpart(BOOM.water,p.x+Math.cos(a)*r,p.y+.9,p.z+Math.sin(a)*r,Math.cos(a)*.6,brn(-.5,.3),Math.sin(a)*.6,brn(.4,.7),.15,brn(.35,.7),{g:-9.8,dr:.3,a:.7*Math.min(1,EX.drain),c:_bc.setRGB(.9,.94,.96)});}}
    EX.prevD=d;}
  // 海中を進むときの泡：機関から、速いほど多く。潜り始めの 2 秒は船体の隙間からも
  EX.dive0=(EX.dive0||0)+dt;if(EX.depth>.5){EX.bb2=(EX.bb2||0)-dt;if(EX.bb2<=0){EX.bb2=EX.dive0<2?.02:.12-.08*Math.min(1,Math.abs(EX.spd)/6);const a=Math.random()*6.283,r=EX.dive0<2?brn(.5,2.4):brn(0,.4);
    bpart(BOOM.water,p.x+Math.cos(a)*r-fx*(EX.dive0<2?0:-1.7),p.y+brn(.6,1.4),p.z+Math.sin(a)*r-fz*(EX.dive0<2?0:-1.7),brn(-.3,.3),brn(.8,1.8),brn(-.3,.3),Math.min(4,EX.depth/1.5),.06,brn(.1,.28),{g:1.2,dr:.5,a:.8,c:_bc.setRGB(.85,.94,.97)});}}
  // 灯：海中と夕方に点ける
  b.userData.lamp.intensity=EX.depth>1?3.2:0;
  // カメラ：後ろ上から追う。海中ではボートの少し上、水面より下に保つ
  // カメラ：向きはボートの向きをなめらかに追う。後ろの視線上で樹冠・地面・建物にぶつからない距離を毎コマ求め、近づくときは速く、離れるときはゆっくり寄せる（ぶつかるたびに跳ねない）
  {const wantD=EX.depth>.5?9:12,hi=EX.depth>.5?2.5:4.5;if(EX.cyaw===undefined||EX.camReset){EX.camResetP=true;EX.cyaw=EX.yaw;EX.camD=wantD;EX.camG=exGround(p.x,p.z);EX.lookY=p.y;EX.camReset=false;}
    let dy=EX.yaw-EX.cyaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));EX.cyaw+=dy*(1-Math.exp(-3*dt));const cfx=-Math.sin(EX.cyaw),cfz=-Math.cos(EX.cyaw);
    if(!EX.cp||EX.camResetP){EX.cp=p.clone();EX.camResetP=false;}EX.cp.x=damp(EX.cp.x,p.x,7,dt);EX.cp.z=damp(EX.cp.z,p.z,7,dt);EX.cp.y=p.y;const P0=EX.cp;   /* 木にぶつかって急に止まっても、カメラは滑らかに */
    EX.lookY=damp(EX.lookY,p.y,5,dt);
    const blocked=(x,y,z)=>{if(y<exGround(x,z)+.9)return true;if(VEG.ok&&EX.mode==='land'){let ins=false;vegNear(x,z,14,id=>{if(ins||VEG.st[id]===2)return;const r=VEG.R[id],ddx=VEG.X[id]-x,ddz=VEG.Z[id]-z;if(ddx*ddx+ddz*ddz<r*r*.9&&y<VEG.Y[id]+1.2&&y>VEG.G[id]-.5)ins=true;});if(ins)return true;}
      for(const c of exColsNear(x,z,1)){if(y>c[4]+.3||y<c[1])continue;const ddx=x-c[6],ddz=z-c[7];if(Math.abs(ddx*c[10]+ddz*c[11])<c[8]+.4&&Math.abs(ddx*c[12]+ddz*c[13])<c[9]+.4)return true;}return false;};
    let lim=wantD;if(EX.depth<=.5)for(let t=1.6;t<=wantD;t+=.5){const x=P0.x-cfx*t,z=P0.z-cfz*t,y=EX.lookY+1.2+(hi-1.2)*t/wantD;if(blocked(x,y,z)){lim=Math.max(1.6,t-.9);break;}}
    {const tv=Math.max(-6,Math.min(2.5,(lim-EX.camD)*(lim<EX.camD?5:1.2)));EX.camDv=damp(EX.camDv||0,tv,9,dt);EX.camD=Math.max(1.6,EX.camD+EX.camDv*dt);}   /* 寄る速さにも上限となめらかさ（急に寄ると揺れて見える） */const D=EX.camD,cx=P0.x-cfx*D,cz=P0.z-cfz*D;
    EX.camG=damp(EX.camG,Math.max(exGround(cx,cz),exGround(cx+cfx*1.5,cz+cfz*1.5)),4,dt);
    let cy=EX.lookY+1.2+(hi-1.2)*(.4+.6*D/wantD);cy=Math.max(cy,EX.camG+1.2);if(EX.depth>.5)cy=Math.min(cy,-.6);else cy=Math.max(cy,exWave(cx,cz)+1.2);
    EX.cam.x=damp(EX.cam.x,cx,8,dt);EX.cam.y=damp(EX.cam.y,cy,6,dt);EX.cam.z=damp(EX.cam.z,cz,8,dt);
    EX.camL.set(P0.x+cfx*3,EX.lookY+1.2,P0.z+cfz*3);}
  if(EX.camFix){const f=EX.camFix;EX.cam.set(f[0],f[1],f[2]);EX.camL.set(f[3],f[4],f[5]);}   /* 検査用の固定視点 */
  setCam(EX.cam.x,EX.cam.y,EX.cam.z,EX.camL.x,EX.camL.y,EX.camL.z,55+9*(EX.fovK||0));
  if(EX.shake>0){camera.position.x+=(Math.random()-.5)*EX.shake;camera.position.y+=(Math.random()-.5)*EX.shake;camera.position.z+=(Math.random()-.5)*EX.shake;b.rotation.z+=(Math.random()-.5)*EX.shake*.3;}
  // まわりの描き直し：地面は 24m、草・石は 12m 動くごと
  if(Math.abs(p.x-EX.pc.x)>30||Math.abs(p.z-EX.pc.z)>30)exPlacePatch(Math.round(p.x/10)*10,Math.round(p.z/10)*10);   /* 10m＝頂点 8 つ分：置き直しても頂点が同じ場所に来るので、地形の形が変わらない */
  if(Math.abs(p.x-EX.gc.x)>12||Math.abs(p.z-EX.gc.z)>12)exScatter(p.x,p.z);
  // 海中：見上げた水面、色と霞、魚の群れ
  const uw=camera.position.y<exWave(camera.position.x,camera.position.z)-.15;EX.surf.visible=uw;EX.surf.position.set(camera.position.x,exWave(camera.position.x,camera.position.z)*.3,camera.position.z);
  if(EX.camUw!==undefined&&EX.camUw!==uw){if(!uw){G.lensWet=1;G.wash=.7;}else{for(let k=0;k<26;k++)bpart(BOOM.water,camera.position.x+brn(-1,1),camera.position.y-brn(.2,1),camera.position.z+brn(-1,1),brn(-.3,.3),brn(.5,1.5),brn(-.3,.3),brn(.6,1.4),.05,brn(.08,.2),{g:1.5,dr:.5,a:.7,c:_bc.setRGB(.85,.94,.97)});}}EX.camUw=uw;
  {const fu=finalMat.uniforms,cd=Math.max(0,-camera.position.y);fu.uUwVis.value=lerp(34,15,smooth(3,36,cd));
    _gv.copy(camera.position);_gv.y+=300;_gv.project(camera);const dir=camera.getWorldDirection(new V3());if(_gv.z<1&&_gv.z>-1)fu.uUwUp.value.set(_gv.x*.5+.5,_gv.y*.5+.5,Math.max(0,dir.y));else fu.uUwUp.value.set(.5,2.2,0);
    if(!EX.snow)exSnowInit();EX.snow.visible=uw;EX.snow.material.uniforms.uCam.value.copy(camera.position);EX.snow.material.uniforms.uK.value=lerp(.5,1,smooth(2,25,cd));}
  finalMat.uniforms.uUnder.value=uw?1:0;finalMat.uniforms.uUwD.value=Math.max(0,-camera.position.y);EXU.uUw.value=uw?1:0;finalMat.uniforms.uCamNF.value.set(camera.near,camera.far);
  seaUpdate(dt,p,true);EXREF.on=!uw;EXREF.refl=!uw;
  // 計器
  if(EX.hud){const md={water:'水上',land:'陸上',dive:'潜航'}[EX.mode];EX.hud.querySelector('.m').textContent=md;EX.hud.querySelector('.s').textContent=Math.round(Math.abs(EX.spd)*3.6)+' km/h'+(EX.boosting?'  ブースト':'');{const bb=EX.hud.querySelector('.b');if(bb){bb.firstChild.style.transform='scaleX('+(EX.bst/100).toFixed(3)+')';bb.classList.toggle('low',EX.bLock);}}
    EX.hud.querySelector('.d').textContent=EX.depth>.3?'深さ '+EX.depth.toFixed(1)+' m':gnd>wv?'標高 '+Math.max(0,gnd).toFixed(0)+' m':'水深 '+Math.max(0,-gnd).toFixed(0)+' m';}
}
// ── 近くの木と茂み：基地の簡単な樹冠（かたまり）を隠し、幹・枝・葉の板（葉の絵）でできた木に置き換える（70m 以内）
let EXLEAF=null;
function exLeafTex(){if(EXLEAF)return EXLEAF;const N=512,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d'),r=mulberry(4321);
  // 小枝の束：細い枝が分かれ、先の方に小さな葉（長さ 5〜8cm 相当）が 70 枚ほど。葉ごとに明るさと色合いをずらし、表は艶、葉脈は細く
  const twig=(x0,y0,a,L,w,d)=>{const x1=x0+Math.cos(a)*L,y1=y0+Math.sin(a)*L;x.strokeStyle='rgb(74,58,38)';x.lineWidth=w;x.beginPath();x.moveTo(x0,y0);x.quadraticCurveTo((x0+x1)/2+(r()-.5)*L*.2,(y0+y1)/2,x1,y1);x.stroke();
    if(d<3){const n=2+(r()<.5?1:0);for(let i=0;i<n;i++){const t=.35+r()*.55;twig(x0+(x1-x0)*t,y0+(y1-y0)*t,a+(r()<.5?-1:1)*(.35+r()*.5),L*(.45+r()*.25),w*.6,d+1);}}
    leaves.push([x0,y0,x1,y1,d]);};
  const leaves=[];twig(N*.5,N*.98,-Math.PI/2+(r()-.5)*.2,N*.55,5,0);
  const leaf=(px,py,a,L)=>{const W=L*(.36+r()*.1),h=88+r()*34,l=24+r()*18,sat=45+r()*20,g=x.createLinearGradient(0,-W,0,W);
    g.addColorStop(0,`hsl(${h},${sat}%,${l-9}%)`);g.addColorStop(.45,`hsl(${h-4},${sat+5}%,${l+7}%)`);g.addColorStop(1,`hsl(${h+4},${sat-5}%,${l-12}%)`);
    x.save();x.translate(px,py);x.rotate(a);x.fillStyle=g;x.beginPath();x.moveTo(0,0);x.bezierCurveTo(L*.25,-W*1.05,L*.75,-W*.8,L,0);x.bezierCurveTo(L*.75,W*.8,L*.25,W*1.05,0,0);x.fill();
    x.strokeStyle=`hsla(${h},40%,${l+16}%,.55)`;x.lineWidth=.8;x.beginPath();x.moveTo(1,0);x.lineTo(L*.9,0);x.stroke();
    x.strokeStyle=`hsla(${h},40%,${l+12}%,.3)`;for(let k=1;k<4;k++){const t=k/4*L;x.beginPath();x.moveTo(t,0);x.lineTo(t+L*.12,-W*.6);x.moveTo(t,0);x.lineTo(t+L*.12,W*.6);x.stroke();}x.restore();};
  for(const[x0,y0,x1,y1,d]of leaves){const n=d>=2?7:d===1?4:2;for(let i=0;i<n;i++){const t=.25+i/n*.75,px=x0+(x1-x0)*t,py=y0+(y1-y0)*t,ba=Math.atan2(y1-y0,x1-x0),sd=i%2?1:-1;leaf(px,py,ba+sd*(.7+r()*.5),26+r()*22);}
    leaf(x1,y1,Math.atan2(y1-y0,x1-x0)+(r()-.5)*.3,28+r()*18);}
  EXLEAF=new THREE.CanvasTexture(c);EXLEAF.encoding=THREE.sRGBEncoding;EXLEAF.anisotropy=8;return EXLEAF;}
// 木の形（高さ 1・樹冠の半径 0.42 に正規化）：根元の広がった幹、曲がった主枝と小枝、葉の小枝束を枝先ごとの塊（樹冠の房）に。房の内側ほど暗い
function exTreeGeo(seed){const r=mulberry(seed),wood=[],leaf=[];
  const cyl=(a,b,r0,r1,n)=>{const g=new THREE.CylinderGeometry(r1,r0,a.distanceTo(b),n||7,3);const pa=g.attributes.position;for(let i=0;i<pa.count;i++){pa.setX(i,pa.getX(i)*(1+(r()-.5)*.15));pa.setZ(i,pa.getZ(i)*(1+(r()-.5)*.15));}
    const m=new THREE.Matrix4(),q=new THREE.Quaternion().setFromUnitVectors(new V3(0,1,0),b.clone().sub(a).normalize());m.compose(a.clone().lerp(b,.5),q,new V3(1,1,1));g.applyMatrix4(m);wood.push(g.toNonIndexed());};
  // 曲がった枝：3 節に分けて少しずつ向きを変える
  const limb=(a,b,r0,r1,n)=>{let p=a.clone();for(let k=1;k<=3;k++){const t=k/3,q=a.clone().lerp(b,t);if(k<3)q.add(new V3((r()-.5)*.05,(r()-.5)*.03,(r()-.5)*.05));cyl(p,q,r0+(r1-r0)*(k-1)/3,r0+(r1-r0)*t,n);p=q;}};
  const top=new V3((r()-.5)*.05,.52,(r()-.5)*.05);limb(new V3(0,-.05,0),top,.04,.02,10);
  for(let k=0;k<5;k++){const a=k/5*Math.PI*2+r()*.5;cyl(new V3(0,.04,0),new V3(Math.cos(a)*.06,-.04,Math.sin(a)*.06),.016,.004,5);}   // 根の張り
  const lobes=[];for(let k=0;k<7;k++){const a=k/7*Math.PI*2+r()*.6,base=new V3(0,.3+r()*.22,0),tip=new V3(Math.cos(a)*(.24+r()*.1),.5+r()*.3,Math.sin(a)*(.24+r()*.1));limb(base,tip,.017,.006,6);
    lobes.push({c:tip.clone().add(new V3(0,.03,0)),r:.11+r()*.06});const mid=base.clone().lerp(tip,.55);for(let j=0;j<2;j++){const t2=mid.clone().add(new V3((r()-.5)*.28,.1+r()*.12,(r()-.5)*.28));cyl(mid,t2,.007,.003,4);lobes.push({c:t2,r:.08+r()*.05});}}
  lobes.push({c:top.clone().add(new V3(0,.18,0)),r:.15});
  // 葉の板：房の表面近く（外から見える殻）に多く、内側にも少し。板は房の外向きに少し寄せた向き、大きさは樹冠の 1 割弱
  const AO=[];for(let k=0;k<520;k++){const L=lobes[Math.floor(r()*lobes.length)],u=r()*2-1,a=r()*6.283,sq=Math.sqrt(1-u*u),dpt=k<420?.8+r()*.3:.3+r()*.5;
    const o=new V3(Math.cos(a)*sq,u*.85,Math.sin(a)*sq),p=L.c.clone().addScaledVector(o,L.r*dpt);
    const sz=.075+r()*.04,g=new THREE.PlaneGeometry(sz,sz*1.1);const e=new THREE.Euler(r()*6.28,r()*6.28,r()*6.28);g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(e));g.translate(p.x,p.y,p.z);
    const n=g.attributes.normal,on=p.clone().sub(new V3(0,.62,0)).normalize().lerp(o,.5).normalize();for(let i=0;i<n.count;i++)n.setXYZ(i,on.x,on.y,on.z);
    const shade=Math.min(1,.38+.62*Math.pow(dpt,1.6)*(.75+.25*(p.y-.4)/.5));const cc=new Float32Array(n.count*3).fill(shade);g.setAttribute('color',new THREE.BufferAttribute(cc,3));leaf.push(g.toNonIndexed());}
  const merge=list=>{let n=0;for(const g of list)n+=g.attributes.position.count;const P=new Float32Array(n*3),N=new Float32Array(n*3),UV=new Float32Array(n*2),C=new Float32Array(n*3).fill(1);let o=0;
    for(const g of list){P.set(g.attributes.position.array,o*3);N.set(g.attributes.normal.array,o*3);if(g.attributes.uv)UV.set(g.attributes.uv.array,o*2);if(g.attributes.color)C.set(g.attributes.color.array,o*3);o+=g.attributes.position.count;}
    const m=new THREE.BufferGeometry();m.setAttribute('position',new THREE.BufferAttribute(P,3));m.setAttribute('normal',new THREE.BufferAttribute(N,3));m.setAttribute('uv',new THREE.BufferAttribute(UV,2));m.setAttribute('color',new THREE.BufferAttribute(C,3));return m;};
  return{wood:merge(wood),leaf:merge(leaf)};}
function exBarkMat(){const m=std({color:0x5a4a3c,roughness:.95,metalness:0});m.onBeforeCompile=sh=>{sh.uniforms.tN2=U.tNoise2;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vOp;').replace('#include <begin_vertex>','#include <begin_vertex>\nvOp=position;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D tN2;varying vec3 vOp;').replace('#include <color_fragment>','#include <color_fragment>\n{float a=atan(vOp.z,vOp.x);float n=texture2D(tN2,vec2(a*0.6,vOp.y*1.6)).b,f=texture2D(tN2,vec2(a*2.3,vOp.y*9.0)).b;diffuseColor.rgb*=(0.55+0.7*n)*(0.7+0.5*smoothstep(0.3,0.7,f));}');};
  m.customProgramCacheKey=()=>'exBark';return m;}
function exTreeInit(){if(EX.trees)return;EX.trees=[];EX.hidden=new Map();
  const lm=std({color:0xffffff,map:exLeafTex(),alphaTest:.42,side:THREE.DoubleSide,roughness:.7,metalness:0,vertexColors:true}),bm=exBarkMat();
  lm.onBeforeCompile=sh=>{Object.assign(sh.uniforms,{uT:U.uTime,uSunDir:U.uSunDir});
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uT;').replace('#include <begin_vertex>','#include <begin_vertex>\n{vec4 wp=instanceMatrix*vec4(transformed,1.0);float k=max(0.0,position.y-0.3);transformed.x+=(sin(uT*1.9+wp.x*0.7+wp.y*0.5)*0.012+sin(uT*4.3+wp.z*2.1)*0.004)*k;transformed.z+=sin(uT*1.5+wp.z*0.6)*0.009*k;transformed.y+=sin(uT*5.1+wp.x*3.0+wp.z*2.0)*0.003*k;}');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uSunDir;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n{vec3 vd=normalize(vViewPosition);vec3 sd=normalize((viewMatrix*vec4(uSunDir,0.0)).xyz);float bl=pow(max(0.0,dot(vd,sd)),3.0);totalEmissiveRadiance+=diffuseColor.rgb*vec3(0.9,1.1,0.4)*bl*0.22*vColor.r;}');};
  lm.customProgramCacheKey=()=>'exLeaf';
  for(let v=0;v<3;v++){const tg=exTreeGeo(101+v*17),w=new THREE.InstancedMesh(tg.wood,bm,110),l=new THREE.InstancedMesh(tg.leaf,lm,110);for(const m of[w,l]){m.count=0;m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;scene.add(m);}
    l.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(110*3),3);EX.trees.push({w,l});}}
const _hm=new THREE.Matrix4(),_hz=new THREE.Matrix4().makeScale(0,0,0);
function exTrees(cx,cz){exTreeInit();if(!VEG.ok)vegInit();const R=110,want=new Map(),d=new THREE.Object3D(),col=new THREE.Color(),cnt=[0,0,0];
  vegNear(cx,cz,R,id=>{const st=VEG.set[id];if(st!==0&&st!==1)return;if((VEG.X[id]-cx)**2+(VEG.Z[id]-cz)**2>R*R)return;want.set(id,st);});
  // 遠くなった物は元の簡単な形に戻す
  for(const[id,m0]of EX.hidden)if(!want.has(id)){const L=VEG.sets[VEG.set[id]];L.im.setMatrixAt(VEG.idx[id],m0);L.im.instanceMatrix.needsUpdate=true;if(L.trunk){}EX.hidden.delete(id);}
  for(const[id,st]of want){const L=VEG.sets[st],i=VEG.idx[id];if(!EX.hidden.has(id)){L.im.getMatrixAt(i,_hm);EX.hidden.set(id,_hm.clone());L.im.setMatrixAt(i,_hz);L.im.instanceMatrix.needsUpdate=true;}
    const v=id%3,T=EX.trees[v];if(cnt[v]>=110)continue;const H=Math.max(2,VEG.Y[id]-VEG.G[id]),Rc=VEG.R[id];
    if(st===0){d.position.set(VEG.X[id],VEG.G[id]-.2,VEG.Z[id]);d.scale.set(Rc/.42*.9,H*1.02,Rc/.42*.9);}else{d.position.set(VEG.X[id],VEG.G[id]-H*.55,VEG.Z[id]);d.scale.set(Rc/.42,H*1.6,Rc/.42);}   // 茂みは木の上半分（樹冠）だけを地面から出す
    d.rotation.set(0,(id*1.37)%6.28,0);d.updateMatrix();T.w.setMatrixAt(cnt[v],st===0?d.matrix:_hz);T.l.setMatrixAt(cnt[v],d.matrix);
    col.setHSL(.24+((id*7)%10)/100,.45,.42+((id*13)%10)/60);T.l.setColorAt(cnt[v],col);cnt[v]++;}
  EX.trees.forEach((T,v)=>{T.w.count=T.l.count=cnt[v];T.w.instanceMatrix.needsUpdate=T.l.instanceMatrix.needsUpdate=true;T.l.instanceColor.needsUpdate=true;});}
function exTreesOff(){if(!EX.trees)return;for(const[id,m0]of EX.hidden){const L=VEG.sets[VEG.set[id]];L.im.setMatrixAt(VEG.idx[id],m0);L.im.instanceMatrix.needsUpdate=true;}EX.hidden.clear();EX.trees.forEach(T=>{T.w.count=T.l.count=0;});}

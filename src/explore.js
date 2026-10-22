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
  const person=(x,col,drv)=>{A(new THREE.SphereGeometry(1,14,10),col,x,1.28,.38,{s:[.2,.26,.15]});A(new THREE.SphereGeometry(.12,16,12),skin,x,1.66,.36);A(new THREE.SphereGeometry(.125,16,10,0,Math.PI*2,0,Math.PI*.55),hair,x,1.69,.38);
    for(const s of[1,-1]){const a=new THREE.Mesh(new THREE.CylinderGeometry(.045,.04,.42,8),col);a.position.set(x+s*.2,1.24,drv?.12:.25);a.rotation.x=drv?1.05:.4;a.castShadow=true;g.add(a);}
    for(const s of[1,-1])A(new THREE.CylinderGeometry(.06,.05,.45,8),S(0x2f3640,.9,0),x+s*.09,.98,.08,{rx:1.45});};
  seatIx.push(g.children.length);
  person(-.42,shirt,true);person(.42,shirt2,false);
  const vest=S(0xe0661c,.75,0);for(const x of[-.42,.42]){A(new THREE.SphereGeometry(1,14,10),vest,x,1.3,.38,{s:[.215,.2,.165]});A(new THREE.BoxGeometry(.03,.2,.01),S(0xd8d8d8,.4,.3),x+.05,1.3,.215);}   // 救命胴衣と反射帯
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
  if(Math.abs(x-BASE.x)>T.w/2-1||Math.abs(z-BASE.z)>T.d/2-1)out[0]=-40;return out;}
const _ts=[0,0,0,0];
function exGround(x,z){return terrSample(x,z,_ts)[0];}
// ── 細かい地面（ボートのまわり 240m 四方）
const EXP_N=192,EXP_S=1.25,EXP_HALF=EXP_N*EXP_S/2;
function exBuildPatch(){const N=EXP_N+1,n=N*N,pos=new Float32Array((n+N*4)*3),col=new Float32Array((n+N*4)*3),idx=[];
  for(let j=0;j<EXP_N;j++)for(let i=0;i<EXP_N;i++){const a=j*N+i,b=a+1,c=a+N,d=c+1;idx.push(a,c,b,b,c,d);}
  // 縁のすそ（下へ垂らして、まわりの地形との継ぎ目の隙間を隠す）
  const edges=[[0,1,0],[N-1,0,1],[N*N-1,-1,0],[N*(N-1),0,-1]];let sk=n;const ring=[];for(let k=0;k<N;k++)ring.push(k);for(let k=1;k<N;k++)ring.push(k*N+N-1);for(let k=N-2;k>=0;k--)ring.push((N-1)*N+k);for(let k=N-2;k>0;k--)ring.push(k*N);
  const skirt=ring.map((v,i)=>[v,n+i]);for(let i=0;i<skirt.length;i++){const[a,b]=skirt[i],[c,d]=skirt[(i+1)%skirt.length];idx.push(a,b,c,c,b,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array((n+ring.length)*3),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array((n+ring.length)*3),3));
  g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array((n+ring.length)*3),3));g.setIndex(idx);g.userData.ring=ring;
  const tm=baseGroup.userData.terrMat,m=std({vertexColors:true,roughness:.95,metalness:0});
  m.onBeforeCompile=sh=>{tm.onBeforeCompile(sh);Object.assign(sh.uniforms,{uUw:EXU.uUw,uBoat:EXU.uBoat});
    sh.vertexShader=sh.vertexShader.replace('vWP=(modelMatrix*vec4(position,1.0)).xyz;','transformed.y+=exMic(position.xz)*(1.0-0.6*vColor.r);vWP=(modelMatrix*vec4(transformed,1.0)).xyz;')
      .replace('#include <common>','#include <common>\nuniform sampler2D tN2;\nfloat exMic(vec2 p){float a=textureLod(tN2,p/3.3,0.0).b,b=textureLod(tN2,p/0.93+0.31,0.0).b;float uw=1.0-smoothstep(-1.5,0.5,position.y);float rp=sin(dot(p,vec2(0.82,0.57))*3.1+a*4.0)*0.06*uw;return (a-0.5)*0.32+(b-0.5)*0.07+rp;}');
    sh.fragmentShader=sh.fragmentShader.replace('if(hgt<-1.2)discard;','').replace('if(vWP.x>uDet.x&&vWP.x<uDet.z&&vWP.z>uDet.y&&vWP.z<uDet.w)discard;','')
      .replace('#include <common>','#include <common>\nuniform float uUw;uniform vec2 uBoat;')
      .replace('diffuseColor.rgb=tc;',`
// 海の中：砂の海底に、揺らめく光の模様（コースティクス）。深いほど暗く青く
if(hgt<0.3){float uw=1.0-smoothstep(-0.6,0.3,hgt);vec2 q=vWP.xz;float c1=texture2D(tN2,q/7.0+vec2(uT*0.021,uT*0.013)).b,c2=texture2D(tN2,q/5.3-vec2(uT*0.017,-uT*0.019)+0.4).b;
  float ca=pow(1.0-abs(c1-c2)*2.2,7.0);float dd=clamp(-hgt,0.0,40.0);
  vec3 sf=mix(sand*1.05,vec3(0.32,0.30,0.22)*(0.7+0.6*n3),smoothstep(0.55,0.75,texture2D(tN2,q/23.0).b)*0.5);
  tc=mix(tc,sf,uw*smoothstep(0.0,2.0,-hgt));tc*=mix(vec3(1.0),exp(-dd*0.035)*vec3(0.65,0.92,1.0),uw);tc+=vec3(0.55,0.75,0.78)*ca*uw*exp(-dd*0.06)*0.6;}
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
 float gr=(1.0-smoothstep(28.0,36.0,distance(vWP.xz,uBoat)))*(1.0-mSand)*(1.0-mRock)*smoothstep(5.0,8.0,hgt)*(1.0-vColor.b);tc*=mix(vec3(1.0),vec3(0.66,0.78,0.55),gr);}
diffuseColor.rgb=tc;`).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,0.22,exWetK);')
      .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n{float e=0.15;vec2 q=vWP.xz;float h0=texture2D(tN2,q/3.3).b,hx=texture2D(tN2,(q+vec2(e,0.0))/3.3).b,hz=texture2D(tN2,(q+vec2(0.0,e))/3.3).b;float k=0.32*(1.0-smoothstep(25.0,80.0,length(vViewPosition)));normal=normalize(normal-(viewMatrix*vec4((hx-h0)/e*k,0.0,(hz-h0)/e*k,0.0)).xyz);}');};
  m.customProgramCacheKey=()=>'exPatch';
  const mesh=new THREE.Mesh(g,m);mesh.receiveShadow=true;mesh.castShadow=false;mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);return mesh;}
const EXU={uUw:{value:0},uBoat:{value:new THREE.Vector2(1e9,1e9)}};
function exPlacePatch(cx,cz){const P2=EX.patch,g=P2.geometry,pa=g.attributes.position.array,ca=g.attributes.color.array,N=EXP_N+1,x0=cx-EXP_HALF,z0=cz-EXP_HALF,s=[0,0,0,0];
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,x=x0+i*EXP_S,z=z0+j*EXP_S;terrSample(x,z,s);pa[k*3]=x;pa[k*3+1]=s[0];pa[k*3+2]=z;ca[k*3]=s[1];ca[k*3+1]=s[2];ca[k*3+2]=s[3];}
  const ring=g.userData.ring,n=N*N;ring.forEach((v,i)=>{pa[(n+i)*3]=pa[v*3];pa[(n+i)*3+1]=pa[v*3+1]-3;pa[(n+i)*3+2]=pa[v*3+2];ca[(n+i)*3]=ca[v*3];ca[(n+i)*3+1]=ca[v*3+1];ca[(n+i)*3+2]=ca[v*3+2];});
  g.attributes.position.needsUpdate=g.attributes.color.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
  DETU.uDet.value.set(x0+.4,z0+.4,x0+EXP_N*EXP_S-.4,z0+EXP_N*EXP_S-.4);EX.pc.set(cx,0,cz);}
// ── まわりの小物：草（陸）、石（浜・崖・海底）、海藻・珊瑚（海底）、魚（海中）。決まった格子ごとに乱数を固定して置く（動いても同じ物が同じ所に）
const hash2=(x,z,k)=>{const v=Math.sin(x*127.1+z*311.7+k*74.7)*43758.5453;return v-Math.floor(v);};
function exGrassMat(){const m=std({color:0xffffff,roughness:.9,metalness:0,side:THREE.DoubleSide,vertexColors:false});
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,{uT:U.uTime});sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uT;attribute vec3 iCol;varying vec3 vIC;varying float vGy;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nvIC=iCol;vGy=position.y/0.5;{vec4 wp=instanceMatrix*vec4(0.0,0.0,0.0,1.0);float k=position.y*position.y;transformed.x+=sin(uT*1.7+wp.x*0.21+wp.z*0.13)*0.12*k+sin(uT*3.1+wp.z*0.5)*0.03*k;transformed.z+=sin(uT*1.3+wp.x*0.17)*0.06*k;}');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vIC;varying float vGy;').replace('vec4 diffuseColor = vec4( diffuse, opacity );','float gy=clamp(vGy,0.0,1.0);vec4 diffuseColor = vec4( mix(vIC*(0.35+0.85*gy),vIC*vec3(1.5,1.35,0.75),smoothstep(0.65,1.0,gy)*0.45), opacity );');};
  m.customProgramCacheKey=()=>'exGrass';return m;}
function exBladeGeo(){// 葉を 12 本、根元から開いて弓なりに曲がる（3 節、先が細る）。法線は上向き寄り（草むらは上からの光で明るく見える）
  const pos=[],nrm=[],idx=[];let v=0;for(let b=0;b<12;b++){const a=b*2.39996+(b%3)*.2,lean=.08+.16*((b*5)%4)/3,h=.2+.32*((b*7)%5)/4,w=.011+.007*((b*3)%3)/2,r0=.06*((b*3)%4)/3,cx=Math.cos(a)*r0,cz=Math.sin(a)*r0,dx=Math.cos(a),dz=Math.sin(a),px=-dz,pz=dx;
    const L=[[0,1],[.4,.85],[.75,.55],[1,0]];   // 高さの割合と幅の割合
    for(const[t,ww]of L){const bend=lean*t*t*1.4,y=h*(t-.18*t*t*lean*4),x=cx+dx*bend,z=cz+dz*bend;if(ww>0){pos.push(x-w*ww*px,y,z-w*ww*pz,x+w*ww*px,y,z+w*ww*pz);nrm.push(dx*.5,1,dz*.5,dx*.5,1,dz*.5);}else{pos.push(x,y,z);nrm.push(dx*.5,1,dz*.5);}}
    idx.push(v,v+1,v+2,v+1,v+3,v+2,v+2,v+3,v+4,v+3,v+5,v+4,v+4,v+5,v+6);v+=7;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nrm,3));g.setIndex(idx);g.normalizeNormals();return g;}
function exRockGeo(seed){const g=new THREE.IcosahedronGeometry(1,2),p=g.attributes.position,r=mulberry(seed);for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=.75+.5*hash2(Math.round(x*7),Math.round(y*7)+Math.round(z*5)*13,seed);p.setXYZ(i,x*k,y*k*.62,z*k);}g.computeVertexNormals();return g;}
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
  EX.grass=new THREE.InstancedMesh(exBladeGeo(),exGrassMat(),24000);icol(EX.grass,24000);EX.grass.count=0;EX.grass.frustumCulled=false;EX.grass.receiveShadow=true;scene.add(EX.grass);
  EX.rocks=new THREE.InstancedMesh(exRockGeo(5),std({color:0x8f8a80,roughness:.85,metalness:0}),900);EX.rocks.count=0;EX.rocks.castShadow=EX.rocks.receiveShadow=true;EX.rocks.frustumCulled=false;EX.rocks.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(900*3),3);scene.add(EX.rocks);
  EX.weed=new THREE.InstancedMesh(exWeedGeo(),exWeedMat(),1400);icol(EX.weed,1400);EX.weed.count=0;EX.weed.frustumCulled=false;scene.add(EX.weed);
  EX.coral=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),std({color:0xffffff,roughness:.75,metalness:0}),500);EX.coral.count=0;EX.coral.frustumCulled=false;EX.coral.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(500*3),3);scene.add(EX.coral);
  EX.fish=new THREE.InstancedMesh(exFishGeo(),std({color:0xffffff,roughness:.35,metalness:.5}),240);EX.fish.count=240;EX.fish.frustumCulled=false;EX.fish.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(240*3),3);scene.add(EX.fish);
  EX.fishD=[];for(let i=0;i<240;i++){const sc=Math.floor(i/30);EX.fishD.push({sc,ph:Math.random()*6.28,o:new V3((Math.random()-.5)*4,(Math.random()-.5)*2,(Math.random()-.5)*4)});EX.fish.setColorAt(i,new THREE.Color().setHSL([.12,.55,.6,.08,.15,.5,.95,.13][sc%8],.55,.5+Math.random()*.15));}
  EX.schools=[];for(let k=0;k<8;k++)EX.schools.push({p:new V3(),v:new V3(1,0,0),t:Math.random()*10});
  // 海面の裏側（海中から見上げた水面）：明るい水色に揺らぐ光、真上ほど明るい窓（スネルの窓）
  EX.surf=new THREE.Mesh(new THREE.PlaneGeometry(600,600,1,1).rotateX(-Math.PI/2),new THREE.ShaderMaterial({uniforms:{uT:U.uTime,tN2:U.tNoise2,uSun:U.uSunCol},side:THREE.BackSide,
    vertexShader:'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader:'uniform float uT;uniform sampler2D tN2;uniform vec3 uSun;varying vec3 vW;void main(){vec3 v=normalize(vW-cameraPosition);float up=clamp(v.y,0.0,1.0);float w=smoothstep(0.62,0.8,up);'+
      'float n=texture2D(tN2,vW.xz/9.0+vec2(uT*0.02,uT*0.013)).b*0.6+texture2D(tN2,vW.xz/3.7-vec2(uT*0.031,0.0)).b*0.4;'+
      'vec3 c=mix(vec3(0.03,0.16,0.18),vec3(0.35,0.62,0.62)+uSun*0.08,w)*(0.75+0.5*n);c+=vec3(1.0,0.95,0.85)*pow(n,8.0)*w*1.5;gl_FragColor=vec4(c,1.0);}'}));
  EX.surf.visible=false;EX.surf.frustumCulled=false;scene.add(EX.surf);
  EX.hud=$('exhud');
  // ボートで押せる車両：基地の中の車・牽引車・給油車など。台ごとの向きの箱（半幅・半長）と重さ、元の位置を覚える
  EX.push=[];baseGroup.updateMatrixWorld(true);const inv=new THREE.Matrix4(),bb=new THREE.Box3(),tb=new THREE.Box3();
  baseGroup.traverse(o=>{if(!o.userData.push)return;inv.copy(o.matrixWorld).invert();bb.makeEmpty();o.traverse(q=>{if(q.isMesh){q.geometry.computeBoundingBox();tb.copy(q.geometry.boundingBox).applyMatrix4(_m4.multiplyMatrices(inv,q.matrixWorld));bb.union(tb);}});
    if(bb.isEmpty())return;const hx=Math.max(Math.abs(bb.min.x),bb.max.x),hz=Math.max(Math.abs(bb.min.z),bb.max.z);
    const pq=new THREE.Quaternion();o.parent.getWorldQuaternion(pq);const pyaw=new THREE.Euler().setFromQuaternion(pq,'YXZ').y;
    EX.push.push({o,hx,hz,pyaw,piq:pq.clone().invert(),m:Math.max(.6,hx*hz*(o.userData.push==='fire'||o.userData.push==='fuel'?2.2:1)),p0:o.position.clone(),q0:o.quaternion.clone(),v:new V3(),w:0,moved:false});});}
const _m4=new THREE.Matrix4(),_pw=new V3(),_pl=new V3();
// ボートと車両の当たり：車両の向きの箱にボートの円（半径 2.5m）を当て、めり込みを重さの比で分け合う。車両は押された勢いで滑って回り、摩擦で止まる
function exPush(dt,p,fx,fz){if(!EX.push)return;const R=2.5,bv=_gv.set(fx*EX.spd,0,fz*EX.spd);
  for(const c of EX.push){const o=c.o;o.getWorldPosition(_pw);const dx0=p.x-_pw.x,dz0=p.z-_pw.z;
    if(c.moved){c.v.multiplyScalar(Math.max(0,1-dt*2.2));c.w*=Math.max(0,1-dt*2.5);if(c.v.lengthSq()<.0004&&Math.abs(c.w)<.01){c.v.set(0,0,0);c.w=0;}else{exMoveW(c,c.v.x*dt,c.v.z*dt);o.rotation.y+=c.w*dt;}}
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
function exMoveW(c,dx,dz){_pl.set(dx,0,dz).applyQuaternion(c.piq);c.o.position.x+=_pl.x;c.o.position.z+=_pl.z;}
function exPushReset(){if(!EX.push)return;for(const c of EX.push){if(!c.moved)continue;c.o.position.copy(c.p0);c.o.quaternion.copy(c.q0);c.v.set(0,0,0);c.w=0;c.moved=false;c.o.userData.pushed=0;}}
// 草・石・海藻・珊瑚を、ボートのまわりに置き直す
function exScatter(cx,cz){const s=[0,0,0,0],d=new THREE.Object3D(),col=new THREE.Color();let ng=0,nr=0,nw=0,nc=0;
  const gi=EX.grass,gc=gi.geometry.attributes.iCol,R=36,RR=80,GS=.46;
  for(let z=Math.floor((cz-R)/GS);z<=Math.ceil((cz+R)/GS);z++)for(let x=Math.floor((cx-R)/GS);x<=Math.ceil((cx+R)/GS);x++){if(ng>=gi.instanceMatrix.count)break;
    const wx=x*GS+hash2(x,z,1)*GS,wz=z*GS+hash2(x,z,2)*GS;if((wx-cx)**2+(wz-cz)**2>R*R)continue;terrSample(wx,wz,s);const h=s[0];if(h<5+3*hash2(Math.floor(wx/4),Math.floor(wz/4),13)||s[1]>.2)continue;   /* 砂浜（高さ 8m まで）には生やさない */
    const sl=Math.abs(exGround(wx+1,wz)-h)+Math.abs(exGround(wx,wz+1)-h);if(sl>.7||s[3]>.4)continue;
    const fm=s[2],dens=.55+.45*hash2(Math.floor(wx/9),Math.floor(wz/9),3);if(hash2(x,z,4)>dens)continue;
    const ed=Math.sqrt((wx-cx)**2+(wz-cz)**2),fade=Math.min(1,(R-ed)/9),sc=(.6+.6*hash2(x,z,5)*(1+fm*.4))*Math.max(.15,fade);   /* 外周 9m で小さくして、草の切れ目を目立たなくする */d.position.set(wx,h+((hash2(x,z,6)-.5)*.1),wz);d.rotation.set((hash2(x,z,7)-.5)*.2,hash2(x,z,8)*6.28,(hash2(x,z,9)-.5)*.2);d.scale.set(sc,sc*(.8+.5*hash2(x,z,10)),sc);d.updateMatrix();gi.setMatrixAt(ng,d.matrix);
    const dry=Math.pow(hash2(Math.floor(wx/13),Math.floor(wz/13),11),2.5);col.setRGB(.13+.22*dry,.27+.08*dry,.055+.04*dry).multiplyScalar(.75+.5*hash2(x,z,12));   /* 青い草が中心、ところどころ乾いた草 */gc.setXYZ(ng,col.r,col.g,col.b);ng++;}
  gi.count=ng;gi.instanceMatrix.needsUpdate=true;gc.needsUpdate=true;
  // 石：浜・崖の下・海底
  for(let z=Math.floor((cz-RR)/3);z<=Math.ceil((cz+RR)/3);z++)for(let x=Math.floor((cx-RR)/3);x<=Math.ceil((cx+RR)/3);x++){const wx=x*3+hash2(x,z,21)*3,wz=z*3+hash2(x,z,22)*3;if((wx-cx)**2+(wz-cz)**2>RR*RR)continue;
    terrSample(wx,wz,s);const h=s[0],cl=s[3];const p=h<-0.5?.1:h<3?.08+cl*.5:cl*.35;if(hash2(x,z,23)>p)continue;
    // 海底：海藻と珊瑚
    if(h<-1.5){const t=hash2(x,z,24);if(t<.55&&nw<EX.weed.instanceMatrix.count){for(let k=0;k<3&&nw<EX.weed.instanceMatrix.count;k++){const ox=(hash2(x,z,30+k)-.5)*1.6,oz=(hash2(x,z,40+k)-.5)*1.6,hh=Math.min(-h*.7,1.2+3*hash2(x,z,50+k));
          d.position.set(wx+ox,exGround(wx+ox,wz+oz)-.05,wz+oz);d.rotation.set(0,hash2(x,z,60+k)*6.28,0);d.scale.set(1,hh,1);d.updateMatrix();EX.weed.setMatrixAt(nw,d.matrix);col.setRGB(.12+.1*hash2(x,z,70),.25+.12*hash2(x,z,71),.06);EX.weed.geometry.attributes.iCol.setXYZ(nw,col.r,col.g,col.b);nw++;}continue;}
      if(t<.75&&nc<EX.coral.instanceMatrix.count&&cl>.2){const sc=.4+.8*hash2(x,z,25);d.position.set(wx,h,wz);d.rotation.set(0,hash2(x,z,26)*6,0);d.scale.set(sc,sc*(.5+hash2(x,z,27)),sc);d.updateMatrix();EX.coral.setMatrixAt(nc,d.matrix);
        EX.coral.setColorAt(nc,col.setHSL([.0,.05,.92,.12,.55][Math.floor(hash2(x,z,28)*5)],.55,.45));nc++;continue;}}
    if(nr>=EX.rocks.instanceMatrix.count)continue;const sc=(h<3?.15+.5*hash2(x,z,29)**2:.3+1.4*hash2(x,z,29)**2);d.position.set(wx,h+sc*.15,wz);d.rotation.set(hash2(x,z,31)*3,hash2(x,z,32)*6,hash2(x,z,33)*3);d.scale.set(sc*(.8+.5*hash2(x,z,34)),sc,sc*(.8+.5*hash2(x,z,35)));d.updateMatrix();
    EX.rocks.setMatrixAt(nr,d.matrix);const k=.55+.4*hash2(x,z,36);EX.rocks.setColorAt(nr,h<0?col.setRGB(.42*k,.43*k,.38*k):col.setRGB(.5*k,.47*k,.42*k));nr++;}
  EX.rocks.count=nr;EX.rocks.instanceMatrix.needsUpdate=true;EX.rocks.instanceColor.needsUpdate=true;EX.weed.count=nw;EX.weed.instanceMatrix.needsUpdate=true;EX.weed.geometry.attributes.iCol.needsUpdate=true;
  EX.coral.count=nc;EX.coral.instanceMatrix.needsUpdate=true;EX.coral.instanceColor.needsUpdate=true;EX.gc.set(cx,0,cz);exTrees(cx,cz);}
// 水面の高さ（海の波と同じ式の大きな 3 つ）
const EXWAV=[[.955,.296,.02027,2.6],[.454,.891,.03307,1.7],[.878,-.479,.05236,1.1]];
// 海面の高さ：水の頂点シェーダと同じ式（凪の 0.3 倍・港内の減衰・浅瀬の減衰）
function exHarb(x,z){const lx=x,lz=z-21000,u=Math.min(1,Math.max(0,(lx-1282)/358)),zn=-246+96*u,zs=556-116*u;return smooth(1268,1296,lx)*(1-smooth(1648,1672,lx))*smooth(zn-6,zn+14,lz)*(1-smooth(zs-14,zs+6,lz));}
function exShoreH(x,z){const im=U.tShore.value.image,N=im.width,d=im.data;let u=(x+3200)/6400*N-.5,v=(z-21000+3400)/6800*N-.5;u=Math.max(0,Math.min(N-1.001,u));v=Math.max(0,Math.min(N-1.001,v));
  const i=Math.floor(u),j=Math.floor(v),fu=u-i,fv=v-j,g=(a,b)=>d[(b*N+a)*4];return ((g(i,j)*(1-fu)+g(i+1,j)*fu)*(1-fv)+(g(i,j+1)*(1-fu)+g(i+1,j+1)*fu)*fv)/255*72-64;}
function exWave(x,z){const t=U.uTime.value;let y=0;for(const W of EXWAV)y+=W[3]*Math.sin(W[2]*(W[0]*x+W[1]*z)-Math.sqrt(9.8*W[2])*t);
  return y*.3*(1-.88*exHarb(x,z))*(.12+.88*smooth(0,9,-exShoreH(x,z)));}
// ── 始める・やめる
function startExplore(){exInit();EX.on=true;G.mode='explore';document.body.classList.add('explore');$('tbA').textContent='浮く';$('tbB').textContent='潜る';
  ['title','hud','over','res','pause','help','opts','skip'].forEach(i=>$(i).hidden=true);$('exhud').hidden=false;
  EX.pos.set(BASE.x+1420,0,BASE.z+150);EX.yaw=Math.PI*.5;/* 港の中の水面から（東へ向いて） */EX.spd=0;EX.vel.set(0,0,0);EX.depth=0;EX.mode='water';EX.t=0;EX.b.visible=true;EX.patch.visible=true;EX.surf.visible=false;
  EX.pc.set(1e9,0,1e9);EX.gc.set(1e9,0,1e9);exPlacePatch(EX.pos.x,EX.pos.z);exScatter(EX.pos.x,EX.pos.z);
  EX.cam.set(EX.pos.x+14,EX.pos.y+5,EX.pos.z);U.uStorm.value=1;U.uCalm.value=1;U.uExD.value=1;setMood('title');cloudReset=true;if(AU.ctx)initAudio();}
function stopExplore(){U.uCalm.value=0;U.uExD.value=0;if(!EX.b)return;exPushReset();exTreesOff();EX.on=false;EX.b.visible=EX.patch.visible=EX.surf.visible=false;EX.grass.count=EX.rocks.count=EX.weed.count=EX.coral.count=0;EX.fish.visible=false;
  DETU.uDet.value.set(1e9,1e9,-1e9,-1e9);EXU.uUw.value=0;finalMat.uniforms.uUnder.value=0;document.body.classList.remove('explore');$('exhud').hidden=true;$('tbA').textContent='発射';$('tbB').textContent='ブースト';}
// ── 毎コマ：操縦、水上・陸上・海中の動き、カメラ、まわりの描き直し
function exploreUpdate(dt){const I=input,b=EX.b,p=EX.pos;EX.t+=dt;
  const gnd=exGround(p.x,p.z),wv=exWave(p.x,p.z),dive=I.boost,up=I.act;
  // 走る場所：陸（地面が水面より上）・水上・海中
  const onLand=gnd>wv-.3&&EX.depth<.3;EX.mode=onLand?'land':EX.depth>.3?'dive':'water';
  const vmax=EX.mode==='land'?7:EX.mode==='dive'?6:13,acc=EX.mode==='land'?4:3;
  EX.spd=damp(EX.spd,I.y*vmax,I.y?acc*.25:EX.mode==='land'?1.6:.6,dt);
  EX.yawRate=damp(EX.yawRate,-I.x*(EX.mode==='land'?.9:.75)*(.35+.65*Math.min(1,Math.abs(EX.spd)/4))*(EX.spd<-.1?-1:1),4,dt);EX.yaw+=EX.yawRate*dt;
  // 潜る・浮く（海の上だけ。海底の 1.5m 上まで）
  if(EX.mode!=='land'){const floor=-(gnd)-1.6;if(dive)EX.depth=Math.min(EX.depth+dt*2.2,Math.max(0,Math.min(45,floor)));else if(up||EX.depth<1)EX.depth=Math.max(0,EX.depth-dt*(up?2.6:.8));
    EX.depth=Math.min(EX.depth,Math.max(0,floor));}
  const fx=-Math.sin(EX.yaw),fz=-Math.cos(EX.yaw);let nx=p.x+fx*EX.spd*dt,nz=p.z+fz*EX.spd*dt;
  // 陸の急な坂・建物は通れない
  const ng=exGround(nx,nz);if(ng>wv-.3&&(ng-Math.max(gnd,wv-.3))>.55*Math.max(.2,Math.abs(EX.spd*dt))*2.2){nx=p.x;nz=p.z;EX.spd*=-.2;}
  if(Math.abs(nx-BASE.x)<2700&&Math.abs(nz-BASE.z)<3100&&baseGroup.userData.colliders)for(const c of baseGroup.userData.colliders){if(nx>c[0]-2&&nx<c[3]+2&&nz>c[2]-2&&nz<c[5]+2&&c[4]>Math.max(ng,0)+1&&c[1]<Math.max(ng,0)+2){nx=p.x;nz=p.z;EX.spd*=-.2;break;}}
  // 木：幹のまわり（樹冠の 3 割）は通れない
  if(VEG.ok&&ng>0){let hit=false;vegNear(nx,nz,10,id=>{if(hit||VEG.st[id]===2)return;const rr=Math.max(.8,VEG.R[id]*.3);if((VEG.X[id]-nx)**2+(VEG.Z[id]-nz)**2<rr*rr)hit=true;});if(hit){nx=p.x;nz=p.z;EX.spd*=-.2;}}
  p.x=nx;p.z=nz;
  exPush(dt,p,fx,fz);
  // 高さと傾き：水上は波に乗る（前後左右の波の高さから傾く）、陸は地面に沿う、海中は深さ
  const h0=onLand?exGround(p.x,p.z):wv,hf=onLand?exGround(p.x+fx*1.6,p.z+fz*1.6):exWave(p.x+fx*1.6,p.z+fz*1.6),hs=onLand?exGround(p.x-fz*1.6,p.z+fx*1.6):exWave(p.x-fz*1.6,p.z+fx*1.6);
  let sup=-1e9;for(let k=0;k<9;k++){const a=k/8*Math.PI*2,r=k===8?0:2.35,sx=p.x+Math.cos(a)*r,sz=p.z+Math.sin(a)*r;
    const tilt=k===8?0:((hf-h0)/1.6*(Math.cos(a)*fx+Math.sin(a)*fz)+(hs-h0)/1.6*(Math.cos(a)*-fz+Math.sin(a)*fx))*r*.8;sup=Math.max(sup,exGround(sx,sz)-tilt);}
  sup+=.22;   /* 輪の底（中心より 0.12m 下）＋地面の細かな凹凸 */
  let ty=onLand?sup:EX.depth>0?Math.min(wv,-EX.depth):h0-.25;ty=Math.max(ty,EX.depth>0?sup+.9:sup);
  p.y=damp(p.y,ty,onLand?10:3,dt);if(p.y<sup-.05)p.y=sup-.05;
  EX.pitch=damp(EX.pitch,EX.depth>.5?(dive?.12:up?-.1:0):Math.atan2(hf-h0,1.6)*.8,3,dt);EX.roll=damp(EX.roll,EX.depth>.5?EX.yawRate*.2:Math.atan2(hs-h0,1.6)*.8+EX.yawRate*.08,3,dt);
  EXU.uBoat.value.set(EX.gc.x,EX.gc.z);b.position.copy(p);b.rotation.set(EX.pitch,EX.yaw,EX.roll,'YXZ');if(b.userData.fan)b.userData.fan.rotation.z+=dt*(4+Math.abs(EX.spd)*3);
  {const f=b.userData.flag;if(f){const pa=f.geometry.attributes.position,p0=f.geometry.userData.p0,w=1+Math.abs(EX.spd)*.15;for(let i=0;i<pa.count;i++){const x=p0[i*3];pa.setZ(i,Math.sin(EX.t*8*w-x*9)*.06*x*w);}pa.needsUpdate=true;}}
  // 航跡としぶき（水上）、泡（海中）
  EX.wake-=dt;if(EX.wake<=0&&EX.mode==='water'&&Math.abs(EX.spd)>2){EX.wake=Math.max(.04,.22-Math.abs(EX.spd)*.012);for(const s of[-1,1])bpart(BOOM.water,p.x-fx*2+s*fz*1.8,.3,p.z-fz*2-s*fx*1.8,-fx*EX.spd*.2+s*fz*1.5,1+Math.abs(EX.spd)*.18,-fz*EX.spd*.2-s*fx*1.5,brn(.7,1.2),.5,2.4+Math.abs(EX.spd)*.12,{g:-12,dr:.8,a:.7,c:_bc.setRGB(.9,.93,.96)});}
  EX.bub-=dt;if(EX.bub<=0&&EX.depth>.5){EX.bub=.09;bpart(BOOM.water,p.x+brn(-.6,.6),p.y+.8,p.z+brn(-.6,.6)+fz*-1.6,0,brn(1.2,2.2),0,Math.min(3,EX.depth/1.8),.12,.3,{g:.8,dr:.4,a:.75,c:_bc.setRGB(.8,.92,.95)});}
  // 灯：海中と夕方に点ける
  b.userData.lamp.intensity=EX.depth>1?3.2:0;
  // カメラ：後ろ上から追う。海中ではボートの少し上、水面より下に保つ
  const behind=EX.depth>.5?9:12,hi=EX.depth>.5?2.5:4.5;const cx=p.x-fx*behind,cz=p.z-fz*behind;let cy=p.y+hi;
  const cg=exGround(cx,cz);cy=Math.max(cy,cg+1.2);if(EX.depth>.5)cy=Math.min(cy,-.6);else cy=Math.max(cy,exWave(cx,cz)+1.2);
  EX.cam.x=damp(EX.cam.x,cx,4,dt);EX.cam.y=damp(EX.cam.y,cy,4,dt);EX.cam.z=damp(EX.cam.z,cz,4,dt);
  // カメラが木の樹冠の中に入ったら、ボートの方へ寄せる
  if(VEG.ok&&EX.mode==='land'){for(let k=0;k<6;k++){let inside=false;vegNear(EX.cam.x,EX.cam.z,16,id=>{if(inside)return;const r=VEG.R[id],dx=VEG.X[id]-EX.cam.x,dz=VEG.Z[id]-EX.cam.z;if(dx*dx+dz*dz<r*r*.8&&EX.cam.y<VEG.Y[id]+1&&EX.cam.y>VEG.G[id])inside=true;});if(!inside)break;EX.cam.lerp(_gv.set(p.x,p.y+2.2,p.z),.25);}}EX.camL.set(p.x+fx*3,p.y+1.2,p.z+fz*3);
  if(EX.camFix){const f=EX.camFix;EX.cam.set(f[0],f[1],f[2]);EX.camL.set(f[3],f[4],f[5]);}   /* 検査用の固定視点 */
  setCam(EX.cam.x,EX.cam.y,EX.cam.z,EX.camL.x,EX.camL.y,EX.camL.z,55);
  // まわりの描き直し：地面は 24m、草・石は 12m 動くごと
  if(Math.abs(p.x-EX.pc.x)>24||Math.abs(p.z-EX.pc.z)>24)exPlacePatch(Math.round(p.x/8)*8,Math.round(p.z/8)*8);
  if(Math.abs(p.x-EX.gc.x)>12||Math.abs(p.z-EX.gc.z)>12)exScatter(p.x,p.z);
  // 海中：見上げた水面、色と霞、魚の群れ
  const uw=camera.position.y<exWave(camera.position.x,camera.position.z)-.15;EX.surf.visible=uw;EX.surf.position.set(camera.position.x,exWave(camera.position.x,camera.position.z)*.3,camera.position.z);
  finalMat.uniforms.uUnder.value=uw?1:0;finalMat.uniforms.uUwD.value=Math.max(0,-camera.position.y);EXU.uUw.value=uw?1:0;finalMat.uniforms.uCamNF.value.set(camera.near,camera.far);
  EX.fish.visible=EX.depth>.2||uw;if(EX.fish.visible){const d=new THREE.Object3D();
    EX.schools.forEach((s,k)=>{s.t+=dt;const a=s.t*.12+k*.8,r=14+k*2.5;s.p.set(p.x+Math.cos(a)*r,0,p.z+Math.sin(a)*r);const gy=exGround(s.p.x,s.p.z);s.p.y=Math.max(gy+1.5,Math.min(-1.5,gy*.5));s.v.set(-Math.sin(a),0,Math.cos(a));});
    for(let i=0;i<EX.fishD.length;i++){const f=EX.fishD[i],s=EX.schools[f.sc];const w=Math.sin(EX.t*2+f.ph);d.position.copy(s.p).add(f.o).addScaledVector(s.v,Math.sin(EX.t*.7+f.ph)*.6);d.position.y+=w*.15;
      if(exGround(d.position.x,d.position.z)>-1){d.scale.setScalar(0);}else d.scale.setScalar(.8+.4*((i*37)%10)/10);d.rotation.set(0,Math.atan2(s.v.x,s.v.z)+Math.sin(EX.t*6+f.ph)*.15,0);d.updateMatrix();EX.fish.setMatrixAt(i,d.matrix);}
    EX.fish.instanceMatrix.needsUpdate=true;}
  // 計器
  if(EX.hud){const md={water:'水上',land:'陸上',dive:'潜航'}[EX.mode];EX.hud.querySelector('.m').textContent=md;EX.hud.querySelector('.s').textContent=Math.round(Math.abs(EX.spd)*3.6)+' km/h';
    EX.hud.querySelector('.d').textContent=EX.depth>.3?'深さ '+EX.depth.toFixed(1)+' m':gnd>wv?'標高 '+Math.max(0,gnd).toFixed(0)+' m':'水深 '+Math.max(0,-gnd).toFixed(0)+' m';}
}
// ── 近くの木と茂み：基地の簡単な樹冠（かたまり）を隠し、幹・枝・葉の板（葉の絵）でできた木に置き換える（70m 以内）
let EXLEAF=null;
function exLeafTex(){if(EXLEAF)return EXLEAF;const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),r=mulberry(4321);
  // 小枝に付いた葉：葉ごとに色をずらし、中央の葉脈と縁の暗さ
  x.strokeStyle='rgba(70,52,30,1)';x.lineWidth=3;x.beginPath();x.moveTo(128,250);x.quadraticCurveTo(120,140,132,20);x.stroke();
  for(let i=0;i<34;i++){const t=r(),bx=128+(r()-.5)*30*t,by=250-t*230,a=(r()<.5?-1:1)*(.6+r()*.9)+(r()-.5)*.4,L=34+r()*30,W=L*(.32+r()*.12),g=x.createLinearGradient(0,-W,0,W);
    const h=95+r()*30,l=22+r()*16;g.addColorStop(0,`hsl(${h},55%,${l-8}%)`);g.addColorStop(.5,`hsl(${h-6},60%,${l+8}%)`);g.addColorStop(1,`hsl(${h},50%,${l-10}%)`);
    x.save();x.translate(bx,by);x.rotate(a-Math.PI/2);x.fillStyle=g;x.beginPath();x.moveTo(0,0);x.quadraticCurveTo(L*.5,-W,L,0);x.quadraticCurveTo(L*.5,W,0,0);x.fill();
    x.strokeStyle='rgba(30,50,20,.6)';x.lineWidth=1;x.beginPath();x.moveTo(2,0);x.lineTo(L*.92,0);x.stroke();x.restore();}
  EXLEAF=new THREE.CanvasTexture(c);EXLEAF.encoding=THREE.sRGBEncoding;EXLEAF.anisotropy=8;return EXLEAF;}
// 木の形（高さ 1・樹冠の半径 0.42 に正規化）：幹と 6 本の枝、葉の板を樹冠の殻と内側に
function exTreeGeo(seed){const r=mulberry(seed),wood=[],leaf=[];
  const cyl=(a,b,r0,r1,n)=>{const g=new THREE.CylinderGeometry(r1,r0,a.distanceTo(b),n||7,3);const pa=g.attributes.position;for(let i=0;i<pa.count;i++){const y=pa.getY(i);pa.setX(i,pa.getX(i)*(1+(r()-.5)*.15));pa.setZ(i,pa.getZ(i)*(1+(r()-.5)*.15));}
    const m=new THREE.Matrix4(),q=new THREE.Quaternion().setFromUnitVectors(new V3(0,1,0),b.clone().sub(a).normalize());m.compose(a.clone().lerp(b,.5),q,new V3(1,1,1));g.applyMatrix4(m);wood.push(g.toNonIndexed());};
  const top=new V3((r()-.5)*.04,.5,(r()-.5)*.04);cyl(new V3(0,-.05,0),top,.035,.022,9);
  const tips=[];for(let k=0;k<6;k++){const a=k/6*Math.PI*2+r()*.6,s=.35+r()*.2,tip=new V3(Math.cos(a)*.3,.55+r()*.25,Math.sin(a)*.3),base=new V3(0,s,0);cyl(base,tip,.016,.006,5);tips.push(tip);
    const mid=base.clone().lerp(tip,.6);for(let j=0;j<2;j++){const t2=mid.clone().add(new V3((r()-.5)*.25,.08+r()*.12,(r()-.5)*.25));cyl(mid,t2,.007,.003,4);tips.push(t2);}}
  // 葉の板：樹冠の楕円体の表面近くに多く、内側にも少し。板の向きはばらばら、法線は樹冠の外向き
  for(let k=0;k<140;k++){let p;if(k<100){const u=r()*2-1,a=r()*6.283,s=Math.sqrt(1-u*u),rr=.85+r()*.2;p=new V3(Math.cos(a)*s*.42*rr,.62+u*.36*rr,Math.sin(a)*s*.42*rr);}else{const t=tips[Math.floor(r()*tips.length)];p=t.clone().add(new V3((r()-.5)*.15,(r()-.5)*.12,(r()-.5)*.15));}
    const g=new THREE.PlaneGeometry(.2+r()*.08,.2+r()*.08);const e=new THREE.Euler(r()*6.28,r()*6.28,r()*6.28);g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(e));g.translate(p.x,p.y,p.z);
    const n=g.attributes.normal,o=p.clone().sub(new V3(0,.6,0)).normalize();for(let i=0;i<n.count;i++)n.setXYZ(i,o.x,o.y,o.z);leaf.push(g.toNonIndexed());}
  const merge=list=>{let n=0;for(const g of list)n+=g.attributes.position.count;const P=new Float32Array(n*3),N=new Float32Array(n*3),UV=new Float32Array(n*2);let o=0;
    for(const g of list){P.set(g.attributes.position.array,o*3);N.set(g.attributes.normal.array,o*3);if(g.attributes.uv)UV.set(g.attributes.uv.array,o*2);o+=g.attributes.position.count;}
    const m=new THREE.BufferGeometry();m.setAttribute('position',new THREE.BufferAttribute(P,3));m.setAttribute('normal',new THREE.BufferAttribute(N,3));m.setAttribute('uv',new THREE.BufferAttribute(UV,2));return m;};
  return{wood:merge(wood),leaf:merge(leaf)};}
function exBarkMat(){const m=std({color:0x5a4a3c,roughness:.95,metalness:0});m.onBeforeCompile=sh=>{sh.uniforms.tN2=U.tNoise2;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vOp;').replace('#include <begin_vertex>','#include <begin_vertex>\nvOp=position;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D tN2;varying vec3 vOp;').replace('#include <color_fragment>','#include <color_fragment>\n{float a=atan(vOp.z,vOp.x);float n=texture2D(tN2,vec2(a*0.6,vOp.y*1.6)).b,f=texture2D(tN2,vec2(a*2.3,vOp.y*9.0)).b;diffuseColor.rgb*=(0.55+0.7*n)*(0.7+0.5*smoothstep(0.3,0.7,f));}');};
  m.customProgramCacheKey=()=>'exBark';return m;}
function exTreeInit(){if(EX.trees)return;EX.trees=[];EX.hidden=new Map();
  const lm=std({color:0xffffff,map:exLeafTex(),alphaTest:.45,side:THREE.DoubleSide,roughness:.85,metalness:0}),bm=exBarkMat();
  for(let v=0;v<3;v++){const tg=exTreeGeo(101+v*17),w=new THREE.InstancedMesh(tg.wood,bm,60),l=new THREE.InstancedMesh(tg.leaf,lm,60);for(const m of[w,l]){m.count=0;m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;scene.add(m);}
    l.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(60*3),3);EX.trees.push({w,l});}}
const _hm=new THREE.Matrix4(),_hz=new THREE.Matrix4().makeScale(0,0,0);
function exTrees(cx,cz){exTreeInit();if(!VEG.ok)vegInit();const R=70,want=new Map(),d=new THREE.Object3D(),col=new THREE.Color(),cnt=[0,0,0];
  vegNear(cx,cz,R,id=>{const st=VEG.set[id];if(st!==0&&st!==1)return;if((VEG.X[id]-cx)**2+(VEG.Z[id]-cz)**2>R*R)return;want.set(id,st);});
  // 遠くなった物は元の簡単な形に戻す
  for(const[id,m0]of EX.hidden)if(!want.has(id)){const L=VEG.sets[VEG.set[id]];L.im.setMatrixAt(VEG.idx[id],m0);L.im.instanceMatrix.needsUpdate=true;if(L.trunk){}EX.hidden.delete(id);}
  for(const[id,st]of want){const L=VEG.sets[st],i=VEG.idx[id];if(!EX.hidden.has(id)){L.im.getMatrixAt(i,_hm);EX.hidden.set(id,_hm.clone());L.im.setMatrixAt(i,_hz);L.im.instanceMatrix.needsUpdate=true;}
    const v=id%3,T=EX.trees[v];if(cnt[v]>=60)continue;const H=Math.max(2,VEG.Y[id]-VEG.G[id]),Rc=VEG.R[id];
    if(st===0){d.position.set(VEG.X[id],VEG.G[id]-.2,VEG.Z[id]);d.scale.set(Rc/.42*.9,H*1.02,Rc/.42*.9);}else{d.position.set(VEG.X[id],VEG.G[id]-H*.55,VEG.Z[id]);d.scale.set(Rc/.42,H*1.6,Rc/.42);}   // 茂みは木の上半分（樹冠）だけを地面から出す
    d.rotation.set(0,(id*1.37)%6.28,0);d.updateMatrix();T.w.setMatrixAt(cnt[v],st===0?d.matrix:_hz);T.l.setMatrixAt(cnt[v],d.matrix);
    col.setHSL(.24+((id*7)%10)/100,.45,.42+((id*13)%10)/60);T.l.setColorAt(cnt[v],col);cnt[v]++;}
  EX.trees.forEach((T,v)=>{T.w.count=T.l.count=cnt[v];T.w.instanceMatrix.needsUpdate=T.l.instanceMatrix.needsUpdate=true;T.l.instanceColor.needsUpdate=true;});}
function exTreesOff(){if(!EX.trees)return;for(const[id,m0]of EX.hidden){const L=VEG.sets[VEG.set[id]];L.im.setMatrixAt(VEG.idx[id],m0);L.im.instanceMatrix.needsUpdate=true;}EX.hidden.clear();EX.trees.forEach(T=>{T.w.count=T.l.count=0;});}

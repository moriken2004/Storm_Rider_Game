// ───────────────────────── AquaTopia の海の生き物と海底 ─────────────────────────
// 魚の群れ・イカ・ヒラメ・エイ・サメ（泳ぐ動きは頂点シェーダ）、サンゴ礁・アマモ場・カジメの林、潮間帯のフジツボ。
// どれもボートのまわりだけに置き、海の中にいるときだけ描く。
const SEA={on:false};

// 泳ぐ物の材質：iPh（動きの位相）で尾を振る・翼を打つ・外套を脈打たせる。背は暗く腹は明るい（カウンターシェーディング）
function seaSwimMat(key,vcode,fcode,o){o=o||{};const m=std({color:0xffffff,roughness:o.ro==null?.45:o.ro,metalness:o.me==null?.15:o.me,side:o.ds?THREE.DoubleSide:THREE.FrontSide,transparent:!!o.tr,opacity:o.op||1});
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,{uT:U.uTime,tN2:U.tNoise2});
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uT;attribute float iPh;varying vec3 vLp;varying float vPh;varying vec3 vLn;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvLp=position;vLn=objectNormal;vPh=iPh;{float ph=uT+iPh;'+vcode+'}').replace('#include <project_vertex>','#include <project_vertex>\n{vec4 wq=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nwq=instanceMatrix*wq;\n#endif\nvWp=(modelMatrix*wq).xyz;}');
    sh.vertexShader=sh.vertexShader.replace('varying float vPh;','varying float vPh;varying vec3 vWp;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uT;uniform sampler2D tN2;varying vec3 vLp;varying float vPh;varying vec3 vWp;varying vec3 vLn;')
      .replace('#include <color_fragment>','#include <color_fragment>\n{vec3 c=diffuseColor.rgb;'+fcode+SEA_UWF+'diffuseColor.rgb=c;}');};
  m.customProgramCacheKey=()=>'sea'+key;return m;}
function seaIM(geo,mat,n,sh){const m=new THREE.InstancedMesh(geo,mat,n);m.count=0;m.frustumCulled=false;m.castShadow=!!sh;m.receiveShadow=true;m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(n*3).fill(1),3);
  const ph=new Float32Array(n);for(let i=0;i<n;i++)ph[i]=Math.random()*40;geo.setAttribute('iPh',new THREE.InstancedBufferAttribute(ph,1));scene.add(m);return m;}
// 頂点を並べて形を作る小さな道具
function seaGeo(pos,idx){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;}
function seaMerge(list){const gs=list.map(g=>g.index?g.toNonIndexed():g);let n=0;for(const g of gs)n+=g.attributes.position.count;const P=new Float32Array(n*3),N=new Float32Array(n*3);let o=0;
  for(const g of gs){if(!g.attributes.normal)g.computeVertexNormals();P.set(g.attributes.position.array,o*3);N.set(g.attributes.normal.array,o*3);o+=g.attributes.position.count;}
  const m=new THREE.BufferGeometry();m.setAttribute('position',new THREE.BufferAttribute(P,3));m.setAttribute('normal',new THREE.BufferAttribute(N,3));return m;}
// 紡錘形の胴（頭が -z、長さ 1）：断面は縦長の楕円、尾の付け根で細くなる。背びれ・尾びれ・胸びれ付き
function seaBodyGeo(o){const R=o.r,S=14,K=18,pos=[],idx=[];
  const rad=t=>{const a=Math.sin(Math.PI*Math.pow(t,o.blunt||.62));return Math.max(.012,R*a*(1-.75*Math.max(0,t-.78)/.22));};
  for(let k=0;k<=K;k++){const t=k/K,z=-.5+t*.9,r=rad(t);for(let s=0;s<S;s++){const a=s/S*Math.PI*2;pos.push(Math.cos(a)*r*(o.w||.55),Math.sin(a)*r+(o.hump||0)*r*Math.max(0,Math.sin(a))*(1-t),z);}}
  for(let k=0;k<K;k++)for(let s=0;s<S;s++){const a=k*S+s,b=k*S+(s+1)%S,c=a+S,d=b+S;idx.push(a,c,b,b,c,d);}
  const tip=pos.length/3;pos.push(0,0,-.52);for(let s=0;s<S;s++)idx.push(tip,s,(s+1)%S);
  const parts=[seaGeo(pos,idx)];
  // 尾びれ（二又）、背びれ、胸びれ、（サメは）しりびれ
  const tri=(a,b,c)=>{const g=seaGeo([...a,...b,...c],[0,1,2,0,2,1]);parts.push(g);};
  const tz=.4,th=o.tail||.17;tri([0,0,tz-.03],[0,th,tz+.16],[0,th*.25,tz+.07]);tri([0,0,tz-.03],[0,-th*(o.lowTail||1),tz+.15],[0,-th*.25,tz+.07]);
  const dh=o.dorsal||.1,dz=o.dz||-.05;tri([0,R*.95,dz-.12],[0,R*.95+dh,dz+.02],[0,R*.9,dz+.18]);
  const pf=o.pect||.07;for(const s of[-1,1])tri([s*R*.5,-R*.35,-.22],[s*(R*.5+pf*1.6),-R*.7,-.12],[s*R*.48,-R*.4,-.1]);
  if(o.anal)tri([0,-R*.9,.18],[0,-R*.9-o.anal,.28],[0,-R*.85,.32]);
  return seaMerge(parts);}
// 海の中の光：水面の揺らめく光の模様（上を向いた面ほど強い）と、深さで赤から先に吸われる色
const SEA_UWF='if(vWp.y<0.2){float dd=max(0.0,-vWp.y);vec2 q=vWp.xz;float c1=texture2D(tN2,q/7.0+vec2(uT*0.021,uT*0.013)).b,c2=texture2D(tN2,q/5.3-vec2(uT*0.017,-uT*0.019)+0.4).b;float ca=pow(1.0-abs(c1-c2)*2.2,7.0);'+
  'c+=c*vec3(0.6,0.85,0.9)*ca*exp(-dd*0.06)*1.4;c*=exp(-dd*vec3(0.075,0.03,0.02));}';
// 尾を振る：後ろほど大きく。速く泳ぐ物ほど細かく
const SEA_WAG='float w=smoothstep(-0.35,0.5,position.z);transformed.x+=sin(ph*WF-position.z*5.0)*WA*w*w+sin(ph*WF*0.5)*WA*0.25;';
const SEA_FISHF='float up=smoothstep(-0.03,0.06,vLp.y);c=mix(c*vec3(1.05,1.08,1.1)+0.12,c*0.42,up);'+
  'float ln=smoothstep(0.012,0.0,abs(vLp.y-0.005))*0.25;c*=1.0-ln;'+
  'float ey=smoothstep(0.022,0.012,length(vec2(vLp.z+0.4,vLp.y-0.022)));c=mix(c,vec3(0.02),ey);'+
  'c*=0.85+0.3*texture2D(tN2,vLp.zy*3.0+vPh).b;';

function seaInit(){if(SEA.ok)return;SEA.ok=true;const g=new THREE.Group();scene.add(g);SEA.g=g;
  // 魚（群れ 10 × 28）
  SEA.fish=seaIM(seaBodyGeo({r:.13,tail:.16,dorsal:.07,pect:.05}),seaSwimMat('fish',SEA_WAG.replace(/WF/g,'9.0').replace(/WA/g,'0.06'),SEA_FISHF,{ro:.3,me:.35}),280);
  // 礁の小魚（色の派手な平たい魚）
  SEA.reef=seaIM(seaBodyGeo({r:.22,w:.3,tail:.13,dorsal:.14,dz:0,pect:.04,blunt:.5,anal:.1}),seaSwimMat('reef',SEA_WAG.replace(/WF/g,'7.0').replace(/WA/g,'0.05'),
    'float st=smoothstep(0.35,0.5,abs(fract(vLp.z*4.0+vPh*0.13)-0.5)*2.0);c=mix(c,vec3(0.95,0.93,0.88),st*step(0.5,fract(vPh*0.37)));float ey=smoothstep(0.03,0.018,length(vec2(vLp.z+0.38,vLp.y-0.04)));c=mix(c,vec3(0.02),ey);',{ro:.35,me:.1}),90);
  // サメ：細長い胴、高い背びれ、上が長い尾、大きな胸びれ
  // サメ：専用の形（尖った鼻先、エラ 5 本、口、後ろへ流れた大きな胸びれ、高い第 1 背びれと小さな第 2 背びれ、腹びれ・しりびれ、上の葉が長い尾びれ、尾の付け根の隆起）
  SEA.shark=seaIM(seaSharkGeo(),seaSwimMat('shark','float zz=position.z;float A=0.012+0.085*pow(smoothstep(-0.2,0.5,zz),2.0);transformed.x+=sin(ph*2.1-zz*4.6)*A-sin(ph*2.1+0.6)*0.012*(1.0-smoothstep(-0.5,-0.2,zz));',
    'vec3 n=normalize(vLn);float bn=(texture2D(tN2,vec2(vLp.z*2.2,0.31)).b-0.5)*0.06+sin(vLp.z*31.0)*0.004;float up=smoothstep(-0.3,0.2,n.y*0.6+(vLp.y-0.002+bn)*14.0);'+
    'vec3 top=vec3(0.19,0.22,0.25)*(0.82+0.3*texture2D(tN2,vLp.zx*vec2(9.0,5.0)).b),bel=vec3(0.83,0.84,0.83)*(0.95+0.08*texture2D(tN2,vLp.zx*7.0).b);c=mix(bel,top,up);'+
    'float tipd=smoothstep(0.15,0.2,length(vLp.xy))*smoothstep(0.0,0.3,n.y+0.3);c*=1.0-0.35*tipd;c*=0.92+0.12*smoothstep(0.72,0.8,texture2D(tN2,vLp.zx*40.0).b);'+
    'float gl=0.0;for(int i=0;i<5;i++){float z0=-0.335+float(i)*0.021;gl=max(gl,smoothstep(0.0035,0.0,abs(vLp.z-z0+0.08*(vLp.y+0.01)))*step(abs(vLp.y+0.008),0.038)*step(0.035,abs(vLp.x)));}c=mix(c,c*0.35,gl);'+
    'float mo=smoothstep(0.0035,0.0,abs(vLp.y+0.04-0.5*(vLp.z+0.45)*(vLp.z+0.45)))*step(vLp.z,-0.37)*step(-0.49,vLp.z)*step(0.01,abs(vLp.x));c=mix(c,vec3(0.1,0.08,0.08),mo*0.8);'+
    'if(length(vLp-vec3(sign(vLp.x)*0.043,0.016,-0.415))<0.0095)c=vec3(0.006);',{ro:.32,me:.06}),3,true);
  // エイ：菱形の平たい体を羽ばたかせ、細い尾を引く
  {const pos=[0,.05,0],idx=[],RG=7,S=28;for(let k=1;k<=RG;k++){const f=k/RG;for(let s=0;s<S;s++){const a=s/S*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a),R=1/(Math.abs(ca)/.5+Math.abs(sa)/(sa<0?.36:.3));pos.push(ca*R*f,.05*(1-f*f)*(1-Math.abs(ca)*.5),sa*R*f*(sa<0?1:1.05));}}
    for(let s=0;s<S;s++)idx.push(0,1+(s+1)%S,1+s);for(let k=0;k<RG-1;k++)for(let s=0;s<S;s++){const a=1+k*S+s,b=1+k*S+(s+1)%S,c=a+S,d=b+S;idx.push(a,b,c,b,d,c);}
    const body=seaGeo(pos,idx),tail=new THREE.CylinderGeometry(.004,.012,.9,5);tail.rotateX(Math.PI/2);tail.translate(0,0,.72);
    SEA.ray=seaIM(seaMerge([body,tail]),seaSwimMat('ray','float ax=abs(position.x);transformed.y+=sin(ph*2.2-ax*3.0)*ax*0.32;transformed.x+=step(0.3,position.z)*sin(ph*1.5-position.z*4.0)*0.05*(position.z-0.3);',
      'float b=gl_FrontFacing?1.0:0.0;c=mix(vec3(0.86,0.84,0.8),c*(0.75+0.5*texture2D(tN2,vLp.xz*2.5+vPh).b),b);c=mix(c,c*0.6,smoothstep(0.22,0.4,length(vLp.xz*vec2(1.0,1.4)))*b*0.5);',{ds:true,ro:.6,me:0}),6,true);}
  // アオリイカ：上下に少し平たい長楕円の外套、外套のほぼ全長にわたる大きなひれ（縁が波打つ）、大きな目（黒い瞳と青緑に光る縁）、
  // 短めの腕 8 本と細長い触腕 2 本。半透明の淡い褐色に、明滅する赤褐色の色素の点・白い虹色の斑点・背の白い筋・ひれの付け根の白い点列。外套の先（-z）が前
  {const parts=[];
    // 外套：z に沿った輪の重なり（輪ごとの半径）
    {const Z=[-.44,-.425,-.39,-.33,-.25,-.15,-.05,.02,.06],R=[0,.018,.038,.056,.068,.075,.074,.07,.066],S=18,pos=[],idx=[];
      Z.forEach((z,k)=>{for(let s2=0;s2<S;s2++){const a=s2/S*Math.PI*2;pos.push(Math.cos(a)*R[k],Math.sin(a)*R[k]*.78,z);}});
      for(let k=0;k<Z.length-1;k++)for(let s2=0;s2<S;s2++){const a=k*S+s2,b=k*S+(s2+1)%S,c=a+S,d=b+S;idx.push(a,c,b,b,c,d);}parts.push(seaGeo(pos,idx));}
    // ひれ：外套の側面から外へ、先端の手前から外套の口の近くまで（幅は後ろ寄り 3 割の所で最大）。両面
    {const pos=[],idx=[],NZ=16,NX=3,rad=z=>{const t=(z+.44)/.5;return .075*Math.sin(Math.min(1,Math.max(0,t))*Math.PI*.62+.25);};
      for(const sd of[-1,1])for(const face of[1,-1]){const base=pos.length/3;for(let k=0;k<=NZ;k++){const z=-.415+k/NZ*.445,u=k/NZ,w=.145*Math.pow(Math.sin(Math.PI*Math.pow(u,.8)),.75)+.004;for(let j=0;j<=NX;j++){const x=sd*(rad(z)*.92+w*j/NX);pos.push(x,.004+face*.0015*(1-j/NX),z);}}
        for(let k=0;k<NZ;k++)for(let j=0;j<NX;j++){const a=base+k*(NX+1)+j,b=a+1,c=a+NX+1,d=c+1;if(face*sd>0)idx.push(a,c,b,b,c,d);else idx.push(a,b,c,b,d,c);}}   /* 表と裏は頂点を分ける（同じ頂点だと法線が打ち消し合って明るさがでたらめになる） */
      parts.push(seaGeo(pos,idx));}
    // 頭と目
    {const hd=new THREE.SphereGeometry(.064,14,10);hd.scale(1,.82,1.2);hd.translate(0,0,.1);parts.push(hd);for(const sd of[-1,1]){const e=new THREE.SphereGeometry(.029,12,8);e.translate(sd*.058,.012,.098);parts.push(e);}}
    // 腕 8 本（根元の輪から前へ、先が少し寄る）と触腕 2 本（細長い）
    {const up=new V3(0,0,1),q=new THREE.Quaternion();const arm=(a,r0,len,rb,rt)=>{const p0=new V3(Math.cos(a)*r0,Math.sin(a)*r0*.8,.14),p1=new V3(Math.cos(a)*r0*.75,Math.sin(a)*r0*.6-.006,.14+len),dir=p1.clone().sub(p0),L=dir.length();
        const c=new THREE.CylinderGeometry(rt,rb,L,6,3);c.rotateX(Math.PI/2);c.translate(0,0,L/2);q.setFromUnitVectors(up,dir.normalize());c.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));c.translate(p0.x,p0.y,p0.z);return c;};
      for(let k=0;k<8;k++){const a=(k+.5)/8*Math.PI*2;parts.push(arm(a,.036,.1+.035*Math.abs(Math.sin(a)),.013,.003));}
      for(const sd of[-1,1])parts.push(arm(-Math.PI/2+sd*.35,.022,.17,.006,.003));}
    SEA.squid=seaIM(seaMerge(parts),seaSwimMat('squid',
      'float fx=abs(position.x),fin=smoothstep(0.075,0.2,fx)*step(position.z,0.04);transformed.y+=sin(ph*5.5+position.z*26.0)*0.034*fin*(fx-0.06)*6.0;'+   /* ひれの縁の波 */
      'transformed.xy*=1.0+0.05*sin(ph*1.8)*step(position.z,0.06)*step(fx,0.08);'+   /* 外套の呼吸 */
      'float ak=max(0.0,position.z-0.14);transformed.x+=sin(ph*2.2-position.z*14.0)*0.05*ak;transformed.y+=cos(ph*1.7-position.z*11.0)*0.03*ak;',   /* 腕のゆらぎ */
      'float ax=abs(vLp.x),dors=smoothstep(-0.012,0.03,vLp.y);'+
      'c*=vec3(0.8,0.62,0.46);'+   /* 淡い褐色の地 */
      'float n1=texture2D(tN2,vLp.xz*vec2(9.0,5.5)+vPh).b*0.55+texture2D(tN2,vLp.xz*vec2(19.0,12.0)+vPh*1.7).b*0.45,fl=0.55+0.45*sin(uT*1.6+vPh*6.0+vLp.z*18.0+vLp.x*30.0);c=mix(c,vec3(0.42,0.16,0.07),smoothstep(0.5,0.58,n1)*fl*(0.3+0.7*dors)*0.85);c=mix(c,c*vec3(0.75,0.6,0.5),smoothstep(0.45,0.7,texture2D(tN2,vLp.xz*2.2+vPh).b)*dors*0.5);'+   /* 色素の点（明滅） */
      'float n2=texture2D(tN2,vLp.xz*vec2(6.0,3.8)+3.1+vPh*.3).b;c=mix(c,vec3(0.8,0.92,0.88),smoothstep(0.8,0.84,n2)*0.55*dors);'+   /* 白い虹色の斑点 */
      'c=mix(c,vec3(0.92,0.92,0.86),smoothstep(0.86,1.0,sin(vLp.x*92.0))*step(ax,0.055)*step(vLp.z,0.04)*dors*0.38);'+   /* 背の白い筋 */
      'c=mix(c,vec3(0.97),step(0.066,ax)*(1.0-smoothstep(0.08,0.1,ax))*smoothstep(0.7,0.85,sin(vLp.z*130.0))*step(vLp.z,0.03)*0.55);'+   /* ひれの付け根の白い点列 */
      'c=mix(c,c*1.15+0.04,smoothstep(0.17,0.215,ax)*step(vLp.z,0.04));c=mix(c*1.08+vec3(0.06,0.05,0.04),c,dors);'+   /* ひれの縁は明るく、腹は白っぽく */
      'float ed=length(vLp-vec3(sign(vLp.x)*0.058,0.012,0.098));if(ed<0.031){c=mix(vec3(0.01,0.012,0.015),vec3(0.08,0.3,0.28),smoothstep(0.019,0.025,ed));c=mix(c,vec3(0.45,0.55,0.45),smoothstep(0.028,0.031,ed)*0.4);}',   /* 目：黒い瞳と青緑の縁 */
      {ro:.22,me:0,tr:true,op:.84}),8);}
  // ヒラメ：砂に伏せた楕円の平たい体、ふちのひれ、上に目。背は砂の色の斑
  {const pos=[0,.035,0],idx=[],S=26,RG=5;for(let k=1;k<=RG;k++){const f=k/RG;for(let s=0;s<S;s++){const a=s/S*Math.PI*2;const fr=k===RG?1.18:1;pos.push(Math.cos(a)*.21*f*fr,(.035*(1-f*f))*(k===RG?0:1),Math.sin(a)*.42*f*fr+(Math.sin(a)>0?.04*f:0));}}
    for(let s=0;s<S;s++)idx.push(0,1+(s+1)%S,1+s);for(let k=0;k<RG-1;k++)for(let s=0;s<S;s++){const a=1+k*S+s,b=1+k*S+(s+1)%S,c=a+S,d=b+S;idx.push(a,b,c,b,d,c);}
    const eyes=[-1,1].map(s=>{const e=new THREE.SphereGeometry(.018,8,6);e.translate(s*.035+.03,.04,-.28);return e;});
    SEA.flat=seaIM(seaMerge([seaGeo(pos,idx),...eyes]),seaSwimMat('flat','float rr=length(position.xz*vec2(2.4,1.2));transformed.y+=sin(ph*4.0-position.z*12.0)*0.012*smoothstep(0.38,0.5,rr);',
      'vec2 q=vLp.xz*vec2(14.0,14.0)+vPh;float n=texture2D(tN2,q).b,n2=texture2D(tN2,q*2.7).b;c*=0.62+0.55*n;c=mix(c,c*1.5+0.05,smoothstep(0.78,0.86,n2)*0.6);c=mix(c,c*0.35,smoothstep(0.7,0.8,texture2D(tN2,q*0.6+3.0).b)*0.5);'+
      'c=mix(c,vec3(0.03),smoothstep(0.02,0.012,min(length(vLp.xz-vec2(-0.005,-0.28)),length(vLp.xz-vec2(0.065,-0.28)))));',{ro:.8,me:0}),10);}
  // 海底：サンゴ（枝・脳・テーブル・ウミウチワ・ソフトコーラル）、アマモ、カジメ、フジツボ
  const cm=(k,f,o)=>seaSwimMat(k,o&&o.v||'',f,Object.assign({ro:.8,me:0},o||{}));
  const polyp='c*=0.78+0.32*texture2D(tN2,vLp.xz*11.0+vLp.y*7.0).b;c*=0.7+0.3*smoothstep(-0.1,0.6,vLp.y);';
  SEA.coralB=seaIM(seaCoralBranch(11),cm('cB',polyp+'c=mix(c,c*vec3(1.25,1.15,1.3)+0.06,smoothstep(0.55,0.9,vLp.y)*0.6);'),1100,false);   /* 細い枝の影は水中でほとんど見分けられないので落とさない（影の計算で 2 度描くのが重い） */
  {const g2=new THREE.SphereGeometry(.5,28,14,0,Math.PI*2,0,Math.PI/2);const p=g2.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const k=1+.06*Math.sin(x*9+z*4)*Math.cos(z*8);p.setXYZ(i,x*k,y*.75*k,z*k);}g2.computeVertexNormals();
    SEA.coralM=seaIM(g2,cm('cM','float m=sin((vLp.x*31.0+texture2D(tN2,vLp.xz*1.3).b*14.0)+sin(vLp.z*27.0+texture2D(tN2,vLp.zx*1.7+0.5).b*12.0)*2.0);c*=0.62+0.45*smoothstep(-0.4,0.6,m);c*=0.85+0.25*texture2D(tN2,vLp.xz*5.0).b;'),300,true);}
  {const pl=new THREE.CylinderGeometry(.5,.46,.035,24,1);const p=pl.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),a=Math.atan2(z,x),k=1+.12*Math.sin(a*5)+.06*Math.sin(a*11+1);p.setX(i,x*k);p.setZ(i,z*k);}
    pl.translate(0,.32,0);const st=new THREE.CylinderGeometry(.04,.07,.32,7);st.translate(0,.16,0);SEA.coralT=seaIM(seaMerge([pl,st]),cm('cT',polyp+'c*=1.0-0.4*smoothstep(0.3,0.0,vLp.y);'),140,true);}
  SEA.fan=seaIM(seaFanGeo(),seaSwimMat('fan','transformed.x+=sin(ph*0.9+position.y*1.5)*0.05*position.y;','c*=0.75+0.35*texture2D(tN2,vLp.xy*6.0).b;',{ds:true,ro:.85,me:0}),320);
  SEA.soft=seaIM(seaSoftGeo(),seaSwimMat('soft','float k=max(0.0,position.y);transformed.x+=sin(ph*1.3+position.y*3.0)*0.06*k;transformed.z+=cos(ph*1.1)*0.04*k;','c=mix(c*0.6,c*1.2+0.05,smoothstep(0.0,0.4,vLp.y));',{ro:.7,me:0}),260);
  SEA.eel=seaIM(seaEelGeo(707),seaSwimMat('eel',
    'float k=max(0.0,position.y-0.05);transformed.x+=(0.16+sin(ph*0.9+position.y*1.7)*0.14+sin(ph*2.3+position.y*4.0)*0.025)*k*k;transformed.z+=(cos(ph*0.7+position.y*1.3)*0.08)*k*k;',   /* 潮の流れの向きへ傾き、上ほど揺れる */
    'float t=vLp.y,e=fract(vPh*7.31);c=mix(vec3(0.62,0.66,0.42),c,smoothstep(0.03,0.14,t));c*=mix(1.15,0.72,smoothstep(0.3,1.0,t));'+   /* 根元の鞘は淡い黄緑、上ほど暗い緑 */
    'float ep=smoothstep(0.62,0.72,texture2D(tN2,vec2(vLp.x*40.0+vLp.z*40.0,t*9.0)+vPh).b)*smoothstep(0.45,0.9,t);c=mix(c,vec3(0.36,0.3,0.16),ep*0.75);'+   /* 先の方に茶色い付着物の斑点 */
    'c=mix(c,vec3(0.42,0.33,0.15),step(0.78,e)*smoothstep(0.82,0.97,t)*0.85);'+   /* ときどき枯れて褐色の葉先 */
    'c*=0.92+0.08*sin(vLp.x*900.0+vLp.z*900.0);',   /* 葉の筋 */
    {ds:true,ro:.38,me:0}),3200);
  SEA.kelp=seaIM(seaKelpGeo(),seaSwimMat('kelp','float k=position.y;transformed.x+=(sin(ph*0.6+position.y*0.9)*0.12+sin(ph*1.7)*0.03)*k*k;transformed.z+=cos(ph*0.5+position.y)*0.07*k*k;','float lb=smoothstep(0.5,0.6,vLp.y);c*=mix(0.5,1.0,lb);c=mix(c,c*vec3(1.25,1.15,0.75)+vec3(0.03,0.02,0.0),lb*smoothstep(0.1,0.3,length(vLp.xz))*0.5);c*=0.8+0.35*texture2D(tN2,vLp.xz*7.0+vLp.y*3.0).b;',{ds:true,ro:.4,me:0}),480,false);   /* 茎は濃く、葉は透けた黄褐色、まだら */
  SEA.barn=seaIM(seaBarnacleGeo(),seaSwimMat('barn','',
    'float rb=pow(abs(sin(atan(vLp.z,vLp.x)*9.0)),0.6),gl=0.5+0.5*sin(vLp.y*70.0);c*=(0.55+0.45*rb)*(0.85+0.15*gl);c*=1.0-0.35*pow(abs(cos(atan(vLp.z,vLp.x)*3.0)),12.0);c*=0.6+0.5*smoothstep(0.0,0.5,vLp.y);c=mix(c,vec3(0.05,0.05,0.04),smoothstep(0.62,0.66,vLp.y)*smoothstep(0.24,0.18,length(vLp.xz)));'+
    'c=mix(c,c*vec3(0.8,0.95,0.7),smoothstep(0.6,0.8,texture2D(tN2,vLp.xz*3.0+vPh).b)*0.5);',{ro:.75,me:0}),3200);
  SEA.mus=seaIM(seaMusselGeo(),seaSwimMat('mus','','c*=0.55+0.6*pow(abs(sin(length(vLp.xz-vec2(0.0,-0.5))*40.0)),3.0)*0.4+0.3;c+=vec3(0.02,0.03,0.06)*smoothstep(0.0,0.1,vLp.y);',{ro:.3,me:.2}),900);
  SEA.star=seaIM(seaStarGeo(),seaSwimMat('star','float k=length(position.xz);transformed.y+=sin(ph*0.4+atan(position.z,position.x)*5.0)*0.01*k;','c*=0.7+0.45*texture2D(tN2,vLp.xz*30.0).b;c=mix(c,c*1.4+0.06,smoothstep(0.8,0.9,texture2D(tN2,vLp.xz*55.0+0.3).b)*0.6);',{ro:.7,me:0}),260,true);
  SEA.urch=seaIM(seaUrchinGeo(),seaSwimMat('urch','','c*=0.55+0.6*smoothstep(0.0,0.5,length(vLp));',{ro:.5,me:.1}),260,true);
  SEA.spB=seaIM(seaBarrelGeo(),seaSwimMat('spB','','c*=0.65+0.5*texture2D(tN2,vec2(atan(vLp.z,vLp.x)*1.5,vLp.y*3.0)).b;c*=0.7+0.3*pow(abs(sin(atan(vLp.z,vLp.x)*11.0)),0.5);c=mix(c,c*0.35,smoothstep(0.85,0.8,vLp.y)*step(length(vLp.xz),0.42));',{ro:.9,me:0}),120,true);
  SEA.spT=seaIM(seaTubesGeo(),seaSwimMat('spT','','c*=0.65+0.45*texture2D(tN2,vLp.xy*9.0).b;c=mix(c,c*0.3,smoothstep(0.92,1.0,fract(vLp.y*0.999))*0.0);',{ro:.85,me:0}),260,true);
  SEA.whip=seaIM(seaWhipGeo(),seaSwimMat('whip','float k=max(0.0,position.y);transformed.x+=sin(ph*0.7+position.y*1.3)*0.12*k*k;transformed.z+=cos(ph*0.55)*0.07*k*k;','c*=0.7+0.4*texture2D(tN2,vLp.xy*14.0).b;',{ro:.75,me:0}),400,true);
  SEA.pen=seaIM(seaPenGeo(),seaSwimMat('pen','float k=max(0.0,position.y);transformed.x+=sin(ph*0.8)*0.06*k;','c=mix(c,c*1.3+0.08,smoothstep(0.3,1.0,vLp.y)*0.5);',{ro:.6,me:0,ds:true}),260);
  SEA.cuke=seaIM(seaCukeGeo(),seaSwimMat('cuke','transformed.x+=sin(ph*0.3+position.z*4.0)*0.02;','c*=0.6+0.55*texture2D(tN2,vLp.xz*12.0+vLp.y*5.0).b;c=mix(c,c*1.6+0.05,smoothstep(0.75,0.85,texture2D(tN2,vLp.xz*25.0).b)*step(0.0,vLp.y)*0.6);',{ro:.55,me:0}),160,true);
  {const jm=seaSwimMat('jelly','float pu=sin(ph*1.8);transformed.xz*=1.0+0.18*pu*smoothstep(-0.1,0.2,position.y);transformed.y*=1.0-0.12*pu*step(0.0,position.y);transformed.x+=step(position.y,0.0)*sin(ph*1.2-position.y*5.0)*0.06*(-position.y);',
      'c=mix(c,vec3(0.9,0.95,1.0),0.25);',{ro:.2,me:0,tr:true,op:.45,ds:true});jm.depthWrite=false;jm.emissive=new THREE.Color(.35,.55,.75);jm.blending=THREE.AdditiveBlending;SEA.jelly=seaIM(seaJellyGeo(),jm,18);}
  SEA.all=[SEA.star,SEA.urch,SEA.spB,SEA.spT,SEA.whip,SEA.pen,SEA.cuke,SEA.jelly,SEA.fish,SEA.reef,SEA.shark,SEA.ray,SEA.squid,SEA.flat,SEA.coralB,SEA.coralM,SEA.coralT,SEA.fan,SEA.soft,SEA.eel,SEA.kelp,SEA.barn,SEA.mus];
  // 動く物の状態
  SEA.schools=[];for(let k=0;k<10;k++)SEA.schools.push({p:new V3(),v:new V3(1,0,0),seed:k*7.3,col:new THREE.Color().setHSL([.58,.55,.6,.1,.12,.52,.6,.08,.55,.5][k],[.25,.35,.2,.5,.45,.3,.2,.6,.15,.25][k],.55)});
  SEA.fishD=[];for(let i=0;i<280;i++)SEA.fishD.push({sc:Math.floor(i/28),o:new V3((Math.random()-.5)*5,(Math.random()-.5)*2.2,(Math.random()-.5)*5),ph:Math.random()*6.28,s:.75+Math.random()*.5,prev:new V3(),yaw:0,pit:0});
  SEA.mov=[];   // サメ・エイ・イカ・ヒラメ・礁の魚：1 匹ずつ
  const add=(kind,n)=>{for(let i=0;i<n;i++)SEA.mov.push({kind,i,p:new V3(),prev:new V3(),yaw:0,pit:0,t:Math.random()*100,seed:Math.random()*1000,home:new V3(),ok:false});};
  add('shark',3);add('ray',6);add('squid',8);   /* アオリイカは 4 匹ずつの群れ 2 つ（以前は 24 匹で多すぎた） */add('flat',10);add('reef',90);add('jelly',18);
  for(const m of[SEA.shark,SEA.ray,SEA.squid,SEA.flat,SEA.reef,SEA.fish,SEA.jelly])m.count=m.instanceMatrix.count;for(let i=0;i<18;i++)SEA.jelly.setColorAt(i,new THREE.Color().setHSL([.55,.6,.85,.95][i%4],.5,.6));
  for(let i=0;i<280;i++)SEA.fish.setColorAt(i,SEA.schools[Math.floor(i/28)].col);
  const pal=[[.98,.55,.12],[.95,.85,.15],[.2,.45,.95],[.92,.3,.55],[.3,.8,.85],[.98,.98,.95]];for(let i=0;i<90;i++){const c=pal[i%pal.length];SEA.reef.setColorAt(i,new THREE.Color(c[0],c[1],c[2]));}
  for(let i=0;i<8;i++)SEA.squid.setColorAt(i,new THREE.Color(.95,.86,.78));for(let i=0;i<10;i++)SEA.flat.setColorAt(i,new THREE.Color(.62,.55,.42));
  for(let i=0;i<6;i++)SEA.ray.setColorAt(i,new THREE.Color(.36,.32,.27));for(let i=0;i<3;i++)SEA.shark.setColorAt(i,new THREE.Color(.5,.55,.58));
  for(const m of SEA.all)if(m.instanceColor)m.instanceColor.needsUpdate=true;SEA.gc=new V3(1e9,0,1e9);}

// サメの形（頭が -z、長さ 1）：紡錘の胴は断面がやや三角（背が細く腹が平ら）、鼻先は円錐で尖る。ひれは厚みのある板
function seaSharkGeo(){const S=24,K=48,pos=[],idx=[];
  // 胴の太さ（t：鼻先 0 → 尾 1）。最も太いのは 1/3 の所、尾の付け根は細く
  const rad=t=>{const r=t<.33?Math.pow(Math.sin(Math.PI/2*t/.33),.62):1-Math.pow((t-.33)/.67,1.45)*.88;return Math.max(.01,.086*r);};
  for(let k=0;k<=K;k++){const t=k/K,z=-.5+t*.97,r=rad(t),nose=1-Math.min(1,t/.12);
    for(let s2=0;s2<S;s2++){const a=s2/S*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a);const ky=sa>0?1.02-.16*sa*sa:.8-.08*sa*sa,kx=.9+.06*Math.abs(ca);pos.push(ca*r*kx,sa*r*ky*(1-.22*nose)-.012*nose*nose,z);}}
  for(let k=0;k<K;k++)for(let s2=0;s2<S;s2++){const a=k*S+s2,b=k*S+(s2+1)%S,c=a+S,d=b+S;idx.push(a,c,b,b,c,d);}
  const tip=pos.length/3;pos.push(0,-.014,-.508);for(let s2=0;s2<S;s2++)idx.push(tip,s2,(s2+1)%S);const tail=pos.length/3;pos.push(0,0,.472);for(let s2=0;s2<S;s2++)idx.push(tail,K*S+(s2+1)%S,K*S+s2);
  const parts=[seaGeo(pos,idx)];
  // ひれ：外形（root の 2 点＋縁の点列）を面の向きに押し出す。厚みは根元で th、先へ行くほど薄く
  const fin=(pts,th,nrm)=>{const n=pts.length,P=[],I=[],ctr=pts.reduce((a,q)=>a.add(new V3(...q)),new V3()).divideScalar(n),nv=new V3(...nrm).normalize();
    const r0=new V3(...pts[0]),r1=new V3(...pts[n-1]),rl=new V3().subVectors(r1,r0),rl2=rl.lengthSq();
    const w=pts.map(q=>{const v=new V3(...q),t=Math.max(0,Math.min(1,v.clone().sub(r0).dot(rl)/rl2)),d=v.distanceTo(r0.clone().addScaledVector(rl,t));return Math.max(.12,1-d/.2);});
    for(let i=0;i<n;i++){P.push(pts[i][0]+nv.x*th*w[i]/2,pts[i][1]+nv.y*th*w[i]/2,pts[i][2]+nv.z*th*w[i]/2);}for(let i=0;i<n;i++){P.push(pts[i][0]-nv.x*th*w[i]/2,pts[i][1]-nv.y*th*w[i]/2,pts[i][2]-nv.z*th*w[i]/2);}
    P.push(ctr.x+nv.x*th*.45,ctr.y+nv.y*th*.45,ctr.z+nv.z*th*.45,ctr.x-nv.x*th*.45,ctr.y-nv.y*th*.45,ctr.z-nv.z*th*.45);const ca=2*n,cb=2*n+1;
    for(let i=0;i<n;i++){const j=(i+1)%n;I.push(ca,i,j);I.push(cb,n+j,n+i);I.push(i,n+i,j,j,n+i,n+j);}parts.push(seaGeo(P,I));};
  // 第 1 背びれ：前縁はふくらみ、後縁はえぐれる
  fin([[0,.07,-.13],[0,.11,-.095],[0,.155,-.05],[0,.19,-.01],[0,.205,.02],[0,.2,.03],[0,.165,.032],[0,.12,.042],[0,.085,.06],[0,.07,.07]],.016,[1,0,0]);
  fin([[0,.045,.2],[0,.07,.225],[0,.078,.245],[0,.06,.25],[0,.042,.265]],.006,[1,0,0]);   // 第 2 背びれ
  fin([[0,-.038,.22],[0,-.062,.24],[0,-.068,.258],[0,-.05,.262],[0,-.034,.27]],.006,[1,0,0]);   // しりびれ
  for(const s2 of[-1,1]){// 胸びれ：後ろへ流れ、後縁が反る
    fin([[s2*.06,-.042,-.25],[s2*.11,-.07,-.2],[s2*.17,-.1,-.13],[s2*.23,-.125,-.06],[s2*.25,-.13,-.02],[s2*.22,-.12,-.04],[s2*.16,-.095,-.09],[s2*.1,-.07,-.12],[s2*.06,-.05,-.15]],.014,[s2*.3,1,.05]);
    fin([[s2*.035,-.05,.12],[s2*.07,-.075,.16],[s2*.095,-.085,.19],[s2*.07,-.07,.195],[s2*.035,-.052,.2]],.006,[s2*.3,1,0]);   // 腹びれ
    fin([[s2*.011,-.004,.33],[s2*.04,0,.37],[s2*.042,0,.4],[s2*.011,.004,.43]],.004,[0,1,0]);}   // 尾の付け根の隆起
  // 尾びれ（三日月形：上の葉が少し長い）
  fin([[0,.016,.415],[0,.07,.47],[0,.13,.54],[0,.175,.61],[0,.168,.625],[0,.11,.57],[0,.045,.53],[0,.01,.515],[0,-.035,.53],[0,-.09,.565],[0,-.125,.6],[0,-.13,.592],[0,-.09,.52],[0,-.04,.46],[0,-.012,.425]],.012,[1,0,0]);
  // 目（少し飛び出した黒い球）
  for(const s2 of[-1,1]){const e=new THREE.SphereGeometry(.009,10,8);e.translate(s2*.043,.016,-.415);parts.push(e);}
  return seaMerge(parts);}
// 枝サンゴ：根元から分かれる太めの枝（3 段）
function seaCoralBranch(seed){const r=mulberry(seed),parts=[];const br=(a,dir,len,rad,d)=>{const b=a.clone().addScaledVector(dir,len);const c=new THREE.CylinderGeometry(rad*.7,rad,len,5,1,true);   /* 端のふたは見えないので省く（三角形を減らす） */
    c.applyMatrix4(new THREE.Matrix4().compose(a.clone().lerp(b,.5),new THREE.Quaternion().setFromUnitVectors(new V3(0,1,0),dir),new V3(1,1,1)));parts.push(c);
    if(d<3){const n=d===0?5:d===1?3:2;for(let k=0;k<n;k++){const nd=dir.clone().add(new V3((r()-.5)*1.3,.35+r()*.5,(r()-.5)*1.3)).normalize();br(b,nd,len*(.66+r()*.18),rad*.7,d+1);}}   /* ミドリイシのように細い先が多い */
    else{const t=new THREE.SphereGeometry(rad*.75,5,3);t.translate(b.x,b.y,b.z);parts.push(t);}};
  br(new V3(0,0,0),new V3(0,1,0),.22,.055,0);return seaMerge(parts);}
// ウミウチワ：根元から平面に扇状に枝分かれし、細い枝が網のようにつながる（両面）
function seaFanGeo(){const r=mulberry(515),pos=[],idx=[];const seg=(x0,y0,x1,y1,w0,w1)=>{const dx=x1-x0,dy=y1-y0,l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l,v=pos.length/3;pos.push(x0+nx*w0,y0+ny*w0,0,x0-nx*w0,y0-ny*w0,0,x1+nx*w1,y1+ny*w1,0,x1-nx*w1,y1-ny*w1,0);idx.push(v,v+2,v+1,v+1,v+2,v+3);};
  const tips=[];const br=(x,y,a,len,w,d)=>{const x1=x+Math.sin(a)*len,y1=y+Math.cos(a)*len;seg(x,y,x1,y1,w,w*.8);if(d<6&&y1<.85){const n=d<2?3:2;for(let k=0;k<n;k++)br(x1,y1,a+(k-(n-1)/2)*(.5-.04*d)+(r()-.5)*.25,len*(.82+r()*.1),w*.78,d+1);}else tips.push([x1,y1]);};
  seg(0,0,0,.12,.022,.018);br(0,.12,0,.14,.016,0);
  // 網目：近い枝先どうしと、枝の途中を細い横糸でつなぐ
  for(let i=0;i<tips.length;i++)for(let j=i+1;j<tips.length;j++){const a=tips[i],b=tips[j],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(d<.09&&r()<.7)seg(a[0],a[1],b[0],b[1],.004,.004);}
  for(let k=0;k<70;k++){const y=.15+r()*.62,w=(.15+y*.55)*(.3+r()*.7),x=(r()-.5)*2*w;seg(x,y,x+(r()-.5)*.08,y+(r()-.5)*.05,.0035,.0035);}
  return seaGeo(pos,idx);}
// ソフトコーラル・イソギンチャク：根元から広がる細い触手の束
function seaSoftGeo(){const parts=[];const r=mulberry(77);for(let k=0;k<16;k++){const a=k/16*Math.PI*2+r()*.3,l=.25+r()*.25,c=new THREE.ConeGeometry(.022,l,5);c.translate(0,l/2,0);c.rotateX(Math.sin(a)*.45);c.rotateZ(-Math.cos(a)*.45);parts.push(c);}
  const base=new THREE.CylinderGeometry(.08,.11,.12,10);base.translate(0,.06,0);parts.push(base);return seaMerge(parts);}
// アマモ：株の集まり（半径約 0.35 に 4 株）。株は根元の白っぽい鞘から、細長い葉が 4〜6 枚。葉は先が丸く、流れに沿って外へしなだれ、ゆるくねじれる（高さ 1 に正規化）
function seaEelGeo(seed){const r=mulberry(seed),pos=[],idx=[],parts=[];let v=0;const SG=4;
  for(let c=0;c<4;c++){const ca=r()*6.28,cr=c?(.12+r()*.23):0,ox=Math.cos(ca)*cr,oz=Math.sin(ca)*cr,hs=c?.7+r()*.35:1;
    const sh=new THREE.CylinderGeometry(.008,.01,.08*hs,4,1,true);sh.translate(ox,.04*hs,oz);parts.push(sh);
    const NB=4;for(let b=0;b<NB;b++){const a=b/NB*Math.PI*2+r()*.6,L=(.62+r()*.38)*hs,bend=.18+r()*.22,tw=(r()-.5)*1.6,w=.0075+r()*.002;
      for(let k=0;k<=SG;k++){const t=k/SG,y=.06*hs+t*L*(1-.22*t*bend*2),rr=bend*t*t*L+.005,cx=ox+Math.cos(a)*rr,cz=oz+Math.sin(a)*rr,ang=a+Math.PI/2+tw*t,ww=w*(t>.9?Math.sqrt(Math.max(0,(1-t)/.1))*.8+.2:1);
        pos.push(cx+Math.cos(ang)*ww,y,cz+Math.sin(ang)*ww,cx-Math.cos(ang)*ww,y,cz-Math.sin(ang)*ww);}
      for(let k=0;k<SG;k++){const q=v+k*2;idx.push(q,q+1,q+2,q+1,q+3,q+2);}v+=(SG+1)*2;}}
  return seaMerge([seaGeo(pos,idx),...parts]);}
// アマモ（旧）：細長い葉の束（NB 枚、高さ 1 に正規化、先が少し細る）
function seaRibbonGeo(NB,w,h,spread){const pos=[],idx=[];let v=0;const SG=6;for(let b=0;b<NB;b++){const a=b*2.4,ox=Math.cos(a)*spread*((b*3)%4)/4,oz=Math.sin(a)*spread*((b*3)%4)/4,hh=h*(.65+.35*((b*5)%4)/3),px=-Math.sin(a),pz=Math.cos(a);
    for(let k=0;k<=SG;k++){const t=k/SG,ww=w*(1-.5*t);pos.push(ox+px*ww+Math.cos(a)*t*.08,t*hh,oz+pz*ww+Math.sin(a)*t*.08,ox-px*ww+Math.cos(a)*t*.08,t*hh,oz-pz*ww+Math.sin(a)*t*.08);}
    for(let k=0;k<SG;k++){const q=v+k*2;idx.push(q,q+1,q+2,q+1,q+3,q+2);}v+=(SG+1)*2;}return seaGeo(pos,idx);}
// カジメ：岩をつかむ付着器、まっすぐな茎、先に房状の葉（中央の葉と、外へ広がってから垂れる側葉 10 枚。縁は波打つ）。高さ 1 に正規化
function seaKelpGeo(){const parts=[],r=mulberry(313);
  for(let k=0;k<7;k++){const a=k/7*Math.PI*2+r()*.4,c=new THREE.ConeGeometry(.012,.09,4);c.translate(0,.045,0);c.rotateZ(1.0+r()*.3);c.rotateY(a);c.translate(0,.02,0);parts.push(c);}   /* 付着器 */
  const st=new THREE.CylinderGeometry(.011,.018,.56,7);st.translate(0,.28,0);parts.push(st);
  const blade=(a,L,W,up,droop,tw)=>{const pos=[],idx=[],NS=10;for(let k=0;k<=NS;k++){const t=k/NS,rr=t*L,y=.56+up*t-droop*t*t,w=W*Math.sin(Math.min(1,t*1.15)*Math.PI*.95)*(1-.25*t)*(1+.12*Math.sin(t*41+a*3))+.004,ru=Math.sin(t*30+a*5)*.022*t;   /* 縁のぎざぎざと、しわの波打ち */
      const cx=Math.cos(a)*rr,cz=Math.sin(a)*rr,px=-Math.sin(a+tw*t),pz=Math.cos(a+tw*t);pos.push(cx+px*w,y+ru,cz+pz*w,cx-px*w,y-ru*.6,cz-pz*w);if(k){const q=(k-1)*2;idx.push(q,q+2,q+1,q+1,q+2,q+3);}}return seaGeo(pos,idx);};
  parts.push(blade(r()*6,.18,.05,.3,.05,.3));   /* 中央の葉（上へ） */
  for(let k=0;k<13;k++)parts.push(blade(k/13*Math.PI*2+r()*.3,.3+r()*.14,.065+r()*.02,.18,.4+r()*.15,(r()-.5)*.9));   /* 側葉：幅広で、外へ広がって垂れる */
  return seaMerge(parts);}
// フジツボ：6 枚の殻板の継ぎ目が縦の溝になった火山形。上の口に 2 枚の蓋、殻板には細い横じま（成長線）
function seaBarnacleGeo(){const S=36,K=8,pos=[],idx=[];for(let k=0;k<=K;k++){const t=k/K,y=t*.62,r0=1-.62*Math.pow(t,1.15);for(let s=0;s<S;s++){const a=s/S*Math.PI*2,rib=1+.09*Math.pow(Math.abs(Math.cos(a*3)),8)-.05*Math.pow(Math.abs(Math.sin(a*3)),.5)+.03*Math.sin(t*40)*(1-t);pos.push(Math.cos(a)*r0*rib,y,Math.sin(a)*r0*rib);}}
  for(let k=0;k<K;k++)for(let s=0;s<S;s++){const a=k*S+s,b=k*S+(s+1)%S,c=a+S,d=b+S;idx.push(a,c,b,b,c,d);}
  // 口の内側へ落ち込む縁と、2 枚の蓋（くちばし形）
  const top=K*S,in0=pos.length/3;for(let s=0;s<S;s++){const a=s/S*Math.PI*2;pos.push(Math.cos(a)*.3,.55,Math.sin(a)*.3);}for(let s=0;s<S;s++){const a=top+s,b=top+(s+1)%S,c=in0+s,d=in0+(s+1)%S;idx.push(a,c,b,b,c,d);}
  const ct=pos.length/3;pos.push(0,.52,0);for(let s=0;s<S;s++)idx.push(ct,in0+(s+1)%S,in0+s);
  const g=seaGeo(pos,idx);const lids=[-1,1].map(s=>{const l=new THREE.SphereGeometry(.16,8,4,0,Math.PI);l.scale(1,.35,.9);l.rotateY(s>0?0:Math.PI);l.translate(s*.02,.56,0);return l;});return seaMerge([g,...lids]);}
// ムラサキイガイ：細長い 2 枚貝（縦に立って束になる）
function seaMusselGeo(){const g=new THREE.SphereGeometry(.5,12,8);const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const t=(z+.5);p.setXYZ(i,x*.42*(.4+.6*t),y*.28,z*1.0);}g.rotateX(-1.1);g.translate(0,.35,0);g.computeVertexNormals();return g;}

// 岩の形の表面：向き nrm（単位）に一番近い頂点の距離と法線（岩の形は exRockGeo と同じ物を使う）
function seaRockPrep(){if(SEA.rk)return;const g=EX.rocks.geometry,pa=g.attributes.position,na=g.attributes.normal,D=[];for(let i=0;i<pa.count;i++){const v=new V3(pa.getX(i),pa.getY(i),pa.getZ(i));const L=v.length();D.push({d:v.clone().divideScalar(L),L,n:new V3(na.getX(i),na.getY(i),na.getZ(i))});}SEA.rk=D;}
let _rkBest=null;function seaRockR(d){seaRockPrep();let b=null,bd=-2;for(const q of SEA.rk){const k=q.d.dot(d);if(k>bd){bd=k;b=q;}}_rkBest=b;return b.L*Math.max(.9,bd)*.985;}
function seaRockN(d){return _rkBest.n.clone();}
// ヒトデ：5 本の腕、上がふくらみ、腕の先が細る（直径 1 に正規化）
function seaStarGeo(){const pos=[0,.12,0],idx=[],S=60,R=6;for(let k=1;k<=R;k++){const f=k/R;for(let s=0;s<S;s++){const a=s/S*Math.PI*2,arm=Math.pow(Math.abs(Math.cos(a*2.5)),2.2),r=f*(.17+.33*arm);pos.push(Math.cos(a)*r,.12*(1-f)*(.5+.5*arm),Math.sin(a)*r);}}
  for(let s=0;s<S;s++)idx.push(0,1+(s+1)%S,1+s);for(let k=0;k<R-1;k++)for(let s=0;s<S;s++){const a=1+k*S+s,b=1+k*S+(s+1)%S,c=a+S,d=b+S;idx.push(a,b,c,b,d,c);}return seaGeo(pos,idx);}
// ウニ：丸い殻に細い棘を放射状に（直径 1 に正規化）
function seaUrchinGeo(){const parts=[];const b=new THREE.SphereGeometry(.2,10,8);b.scale(1,.75,1);parts.push(b);const r=mulberry(91);for(let k=0;k<70;k++){const u=r()*1.1-.15,a=r()*6.283,sq=Math.sqrt(Math.max(0,1-u*u)),d=new V3(Math.cos(a)*sq,u,Math.sin(a)*sq);
    const c=new THREE.ConeGeometry(.012,.32+r()*.12,3);c.translate(0,.2+.17,0);c.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0,1,0),d)));parts.push(c);}return seaMerge(parts);}
// 樽形カイメン：上が開いた厚い壺（高さ 1）
function seaBarrelGeo(){const pts=[];for(let k=0;k<=10;k++){const t=k/10;pts.push(new THREE.Vector2(.28+.3*Math.sin(t*2.6)+.03*Math.sin(t*20),t*.95));}for(let k=10;k>=2;k--){const t=k/10;pts.push(new THREE.Vector2(.18+.28*Math.sin(t*2.6),t*.92));}
  return new THREE.LatheGeometry(pts,26);}
// 筒形カイメン：根元から伸びる筒の束
function seaTubesGeo(){const parts=[];const r=mulberry(57);for(let k=0;k<6;k++){const h=.45+r()*.55,a=k*1.05+r()*.4,o=.08+r()*.07,c=new THREE.CylinderGeometry(.07,.06,h,10,1,true);c.translate(0,h/2,0);c.rotateZ((r()-.5)*.35);c.translate(Math.cos(a)*o,0,Math.sin(a)*o);parts.push(c);
    const rim=new THREE.TorusGeometry(.07,.012,5,10);rim.rotateX(Math.PI/2);rim.translate(Math.cos(a)*o,h,Math.sin(a)*o);parts.push(rim);}return seaMerge(parts);}
// ムチヤギ：細長い枝が数本（高さ 1）
function seaWhipGeo(){const parts=[];const r=mulberry(63);for(let k=0;k<5;k++){const h=.6+r()*.4,c=new THREE.CylinderGeometry(.006,.014,h,5,4);c.translate(0,h/2,0);c.rotateZ((r()-.5)*.5);c.rotateX((r()-.5)*.5);parts.push(c);}return seaMerge(parts);}
// ウミエラ：細い軸に羽根状の葉（高さ 1）
function seaPenGeo(){const parts=[];const st=new THREE.CylinderGeometry(.012,.02,1,5);st.translate(0,.5,0);parts.push(st);for(let k=0;k<14;k++){const y=.35+k*.045,l=.12*Math.sin((k+1)/15*Math.PI);for(const s of[-1,1]){const g=seaGeo([0,y,0,s*l,y+.03,0,s*l*.8,y+.07,0],[0,1,2]);parts.push(g);}}return seaMerge(parts);}
// ナマコ：いぼのある太い円筒（長さ 1）
function seaCukeGeo(){const g=new THREE.SphereGeometry(.5,16,10);g.scale(.24,.2,1);
  const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const k=1+.12*Math.max(0,Math.sin(x*60)*Math.sin(z*40))*(y>0?1:0);p.setXYZ(i,x*k,y*k*.8+.1,z);}g.computeVertexNormals();return g;}
// クラゲ：半透明の傘と、垂れる触手（傘の直径 1）
function seaJellyGeo(){const parts=[];const b=new THREE.SphereGeometry(.5,20,10,0,Math.PI*2,0,Math.PI*.5);b.scale(1,.7,1);parts.push(b);
  for(let k=0;k<16;k++){const a=k/16*Math.PI*2,l=.8+((k*7)%5)*.25,c=new THREE.CylinderGeometry(.006,.003,l,3);c.translate(Math.cos(a)*.42,-l/2,Math.sin(a)*.42);parts.push(c);}
  for(let k=0;k<4;k++){const a=k*1.571,c=new THREE.CylinderGeometry(.03,.01,.7,5);c.translate(Math.cos(a)*.08,-.35,Math.sin(a)*.08);parts.push(c);}return seaMerge(parts);}
// ── 置き直し（ボートが 12m 動くごと）：決まった格子ごとに乱数を固定して置く
function seaScatter(cx,cz){seaInit();const d=new THREE.Object3D(),col=new THREE.Color(),s=[0,0,0,0];const n={cB:0,cM:0,cT:0,fan:0,soft:0,eel:0,kelp:0,barn:0,mus:0,star:0,urch:0,spB:0,spT:0,whip:0,pen:0,cuke:0};
  const put=(m,key,x,y,z,sc,ry,c,rx,rz)=>{if(n[key]>=m.instanceMatrix.count)return false;if(key!=='barn'&&key!=='mus'&&seaNearStruct(x,z,.3,y+.3))return false;   /* 岸壁・防波堤の土台・船の中から生やさない（岩に張り付くフジツボ・イガイは別） */d.position.set(x,y,z);d.rotation.set(rx||0,ry,rz||0);if(typeof sc==='number')d.scale.setScalar(sc);else d.scale.set(sc[0],sc[1],sc[2]);d.updateMatrix();m.setMatrixAt(n[key],d.matrix);if(c)m.setColorAt(n[key],c);n[key]++;return true;};
  const R=95;const G=1.6;
  {const c0=Math.round(cx/G),c1=Math.round(cz/G);for(const o of exRing(Math.ceil(R/G)+1)){const x=c0+o[0],z=c1+o[1];const wx=x*G+hash2(x,z,81)*G,wz=z*G+hash2(x,z,82)*G,dd=(wx-cx)**2+(wz-cz)**2;if(dd>R*R)continue;
    terrSample(wx,wz,s);const h=s[0],cl=s[3];if(h>2.2)continue;const rnd=k=>hash2(x,z,k);
    // 帯の種類：サンゴ礁（深さ 2〜18m・40m 区画の 4 割）、アマモ場（砂地 1.2〜9m・30m 区画の半分）、カジメの林（岩場 3〜16m）
    const reef=h<-3&&h>-15&&hash2(Math.floor(wx/40),Math.floor(wz/40),91)>.58,eel=!reef&&h<-1.2&&h>-7&&cl<.25&&hash2(Math.floor(wx/30),Math.floor(wz/30),92)<.5,kelp=!reef&&h<-3&&h>-16&&(cl>.2||hash2(Math.floor(wx/25),Math.floor(wz/25),93)>.82);
    if(reef&&dd<60*60)for(let rep=0;rep<2;rep++){   /* 60m より先は水のかすみでほとんど見えない */const t=hash2(x,z,83+rep*31);const gy=exGround(wx+rep*.7,wz-rep*.5);if(rep){if(t>.75)continue;}
      if(t<.4){const vivid=rnd(85)<.2,c=vivid?col.setHSL([.78,.58,.93][Math.floor(rnd(84)*3)],.35,.42+.1*rnd(86)):col.setHSL(.07+.08*rnd(84),.3+.2*rnd(85),.3+.14*rnd(86));put(SEA.coralB,'cB',wx,gy-.05,wz,.9+1.4*rnd(87),rnd(88)*6.3,c);}
      else if(t<.54){put(SEA.coralM,'cM',wx,gy-.08,wz,[.6+1.1*rnd(87),.6+1.0*rnd(89),.6+1.1*rnd(90)],rnd(88)*6.3,col.setHSL(.09+.07*rnd(84),.28,.38+.14*rnd(85)));}
      else if(t<.62){put(SEA.coralT,'cT',wx,gy-.05,wz,.55+.9*rnd(87),rnd(88)*6.3,col.setHSL(.1+.04*rnd(84),.25,.4+.1*rnd(85)));}
      else if(t<.72){put(SEA.fan,'fan',wx,gy-.03,wz,1.0+1.2*rnd(87),rnd(88)*6.3,col.setHSL([.97,.02,.08,.8,.12][Math.floor(rnd(84)*5)],.5,.36));}
      else if(t<.88){put(SEA.soft,'soft',wx,gy-.02,wz,.7+.9*rnd(87),rnd(88)*6.3,col.setHSL([.85,.12,.5,.95,.15,.1][Math.floor(rnd(84)*6)],.35,.45+.12*rnd(85)));}}
    if(eel&&dd<60*60){const ed=hash2(Math.floor(wx/6),Math.floor(wz/6),96);const nk=ed<.15?1:3;   /* 数は距離で変えない（変えると動いたときに並び順がずれて近くの物まで入れ替わる） */for(let k=0;k<nk;k++){const ox=(rnd(100+k)-.5)*G,oz=(rnd(110+k)-.5)*G,gx=wx+ox,gz=wz+oz,ht=(.7+.6*rnd(130+k))*Math.min(1,-h/2.5);put(SEA.eel,'eel',gx,exGround(gx,gz)-.02,gz,[1.1+.3*rnd(120+k),ht,1.1+.3*rnd(120+k)],rnd(140+k)*.6+.0,col.setRGB(.1+.06*rnd(150+k),.3+.1*rnd(160+k),.07+.03*rnd(150+k)));}}   /* 密に（所々まばら）。向きはほぼそろえて流れに沿って傾く */
    // 帯ごとの生き物：浅場（〜4m）＝ヒトデ・ウニ、中層（4〜14m）＝筒形カイメン、深場（14〜35m）＝樽形カイメン・ムチヤギ・ウミウチワ・ウミエラ、さらに深い所（35m〜）＝ナマコ・ウミエラ
    if(dd<75*75){const gy=exGround(wx,wz),q=rnd(170),sub=exSub(wx,wz);
      if(h>-6&&h<-.8){if(q<.035&&sub.rock<.4)put(SEA.star,'star',wx,gy+.005,wz,.2+.18*rnd(171),rnd(172)*6.3,col.setHSL([.04,.0,.08,.8,.95][Math.floor(rnd(173)*5)],.65,.42));
        else if(q<.12&&(sub.rock>.3||cl>.2))put(SEA.urch,'urch',wx,gy+.04,wz,.18+.12*rnd(171),rnd(172)*6.3,col.setHSL(.78+.1*rnd(173),.4,.12+.06*rnd(174)));}
      else if(h<=-6&&h>-14){if(q<.04&&!reef)put(SEA.spT,'spT',wx,gy-.05,wz,.6+.8*rnd(171),rnd(172)*6.3,col.setHSL([.8,.13,.05,.55][Math.floor(rnd(173)*4)],.5,.42));}
      else if(h<=-14&&h>-35){if(q<.05)put(SEA.spB,'spB',wx,gy-.08,wz,[.7+1.2*rnd(171),.7+1.4*rnd(174),.7+1.2*rnd(171)],rnd(172)*6.3,col.setHSL(.05+.04*rnd(173),.45,.32+.1*rnd(175)));
        else if(q<.14)put(SEA.whip,'whip',wx,gy-.03,wz,[1,.9+1.6*rnd(171),1],rnd(172)*6.3,col.setHSL([.02,.1,.13,.95][Math.floor(rnd(173)*4)],.6,.42));
        else if(q<.18)put(SEA.fan,'fan',wx,gy-.03,wz,1+1.2*rnd(171),rnd(172)*6.3,col.setHSL([.95,.02,.1,.8][Math.floor(rnd(173)*4)],.5,.38));
        else if(q<.22&&sub.mud+sub.sand>.5)put(SEA.pen,'pen',wx,gy-.05,wz,[1,.5+.5*rnd(171),1],rnd(172)*6.3,col.setHSL(.07,.55,.5+.1*rnd(173)));
        else if(q<.25)put(SEA.spT,'spT',wx,gy-.05,wz,.8+.8*rnd(171),rnd(172)*6.3,col.setHSL([.8,.13,.55][Math.floor(rnd(173)*3)],.45,.38));}
      else if(h<=-35){if(q<.05)put(SEA.cuke,'cuke',wx,gy-.02,wz,.5+.5*rnd(171),rnd(172)*6.3,col.setHSL([.05,.02,.9][Math.floor(rnd(173)*3)],.4,.25+.1*rnd(174)));
        else if(q<.1)put(SEA.pen,'pen',wx,gy-.05,wz,[1,.6+.6*rnd(171),1],rnd(172)*6.3,col.setHSL(.06,.6,.55));}}
    if(kelp&&dd<80*80&&rnd(94)<.6){const hh=Math.min(-h-.8,1.4+.8*rnd(95));put(SEA.kelp,'kelp',wx,exGround(wx,wz)-.03,wz,hh,rnd(96)*6.3,col.setRGB(.24+.06*rnd(97),.17+.04*rnd(98),.05+.02*rnd(97)));}}
  }
  // フジツボとイガイ：潮間帯（水面の 1.6m 下〜1.4m 上）の岩に群生。岩の上半分の面に、外向きに張り付ける
  const R2=40;if(EX.rocks){const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new V3(),sc=new V3(),up=new V3(0,1,0),nrm=new V3(),qq=new THREE.Quaternion();
    for(let i=0;i<EX.rocks.count;i++){EX.rocks.getMatrixAt(i,m4);m4.decompose(p,q,sc);if(p.y<-1.8||p.y>1.5||(p.x-cx)**2+(p.z-cz)**2>R2*R2)continue;
      const NB=Math.min(90,Math.round(30+sc.x*sc.z*60));for(let k=0;k<NB;k++){const a=hash2(i,k,201)*6.283,u=hash2(i,k,202)*1.3-.3,sq=Math.sqrt(Math.max(0,1-u*u));nrm.set(Math.cos(a)*sq,u,Math.sin(a)*sq);
        const sr=seaRockR(nrm);const lp=nrm.clone().multiplyScalar(sr).applyQuaternion(q).multiply(sc).add(p);if(lp.y>1.4||lp.y<-1.6)continue;const wn=seaRockN(nrm).applyQuaternion(q).divide(sc).normalize();
        qq.setFromUnitVectors(up,wn);d.position.copy(lp);d.quaternion.copy(qq);const bs=.012+.016*hash2(i,k,203);
        if(lp.y<-.2&&hash2(i,k,204)<.35){if(n.mus<SEA.mus.instanceMatrix.count){d.rotateY(hash2(i,k,205)*6.3);d.scale.setScalar(.035+.025*hash2(i,k,206));d.updateMatrix();SEA.mus.setMatrixAt(n.mus,d.matrix);SEA.mus.setColorAt(n.mus,col.setRGB(.06,.07,.1));n.mus++;}continue;}
        if(n.barn>=SEA.barn.instanceMatrix.count)break;d.scale.set(bs,bs*(.8+.6*hash2(i,k,207)),bs);d.updateMatrix();SEA.barn.setMatrixAt(n.barn,d.matrix);const w=.36+.16*hash2(i,k,208);SEA.barn.setColorAt(n.barn,col.setRGB(w,w*.95,w*.86));n.barn++;
        // まわりに小さな株を何個か
        for(let j=0;j<3&&n.barn<SEA.barn.instanceMatrix.count;j++){const off=new V3((hash2(i,k*3+j,209)-.5)*.07,0,(hash2(i,k*3+j,210)-.5)*.07).applyQuaternion(qq);d.position.copy(lp).add(off);const b2=bs*(.4+.5*hash2(i,k*3+j,211));d.scale.set(b2,b2,b2);d.updateMatrix();SEA.barn.setMatrixAt(n.barn,d.matrix);SEA.barn.setColorAt(n.barn,col);n.barn++;}}}}
  const map={cB:SEA.coralB,cM:SEA.coralM,cT:SEA.coralT,fan:SEA.fan,soft:SEA.soft,eel:SEA.eel,kelp:SEA.kelp,barn:SEA.barn,mus:SEA.mus,star:SEA.star,urch:SEA.urch,spB:SEA.spB,spT:SEA.spT,whip:SEA.whip,pen:SEA.pen,cuke:SEA.cuke};
  for(const k in map){const m=map[k];m.count=n[k];m.instanceMatrix.needsUpdate=true;m.instanceColor.needsUpdate=true;}SEA.gc.set(cx,0,cz);SEA.n=n;
  // 礁の魚とヒラメの居場所：礁の帯・砂地から選び直す
  }   /* 動く生き物の居場所はそのまま（75m 以上離れたときだけ選び直す） */

// 生き物の居場所を探す：ボートのまわりで条件に合う海底
function exSub(x,z){const o=terrSample(x,z,[0,0,0,0,0,0,0]);return{rock:o[4],mud:o[5],gravel:o[6],sand:Math.max(0,1-o[4]-o[5]-o[6])};}
function seaFindHome(f,cx,cz,want){for(let k=0;k<24;k++){const a=Math.random()*6.283,r=want.r0+Math.random()*(want.r1-want.r0),x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r,h=exGround(x,z);
    if(h<want.hmax&&h>want.hmin&&(!want.reef||hash2(Math.floor(x/40),Math.floor(z/40),91)>.58)&&!seaNearStruct(x,z,want.clear||6)){f.home.set(x,h,z);return true;}}return false;}   /* 回遊の半径ぶん構造物から離す */
// 構造物（向き付きの箱：岸壁・防波堤・船・トレーラーなど）と岩の凸凹から、生き物を押し出す。めり込みの浅い向きへ、横か上に（下へは押さない）。
// 海底より下・水面より上には出さない
// ボートの船体（半径 2.6m・上下はボートの高さの前後）から横へ押し出す
function seaBoatPush(p,rad){if(!EX.on||!EX.b)return false;const B=EX.pos,dy=p.y-B.y;if(dy<-1.2-rad||dy>1.7+rad)return false;const dx=p.x-B.x,dz=p.z-B.z,d=Math.hypot(dx,dz),R=2.6+rad;if(d>=R)return false;
  const k=d>1e-3?1/d:0,ux=d>1e-3?dx*k:1,uz=d>1e-3?dz*k:0;p.x=B.x+ux*R;p.z=B.z+uz*R;return true;}
function seaPush(p,rad,boxOnly){seaBoatPush(p,rad);for(const c of exColsNear(p.x,p.z,rad+1)){if(p.y<c[1]-rad||p.y>c[4]+rad)continue;const dx=p.x-c[6],dz=p.z-c[7],u=dx*c[10]+dz*c[11],v=dx*c[12]+dz*c[13],pu=c[8]+rad-Math.abs(u),pv=c[9]+rad-Math.abs(v);if(pu<=0||pv<=0)continue;
    const pyu=c[4]+rad<-.4?c[4]+rad-p.y:1e9;   /* 上へ出せるのは上面が水面より下のときだけ */
    if(pyu<pu&&pyu<pv)p.y+=pyu;else if(pu<pv){const sg=Math.sign(u)||1;p.x+=c[10]*sg*pu;p.z+=c[11]*sg*pu;}else{const sg=Math.sign(v)||1;p.x+=c[12]*sg*pv;p.z+=c[13]*sg*pv;}}
  if(boxOnly)return p;   /* 群れの 1 匹ずつは箱からの押し出しだけ（海底や岩の凸凹で高さが小刻みに跳ねないように。そちらは群れの中心で） */
  for(const b of exBumpsNear(p.x,p.z)){const t=exBumpTop(b,p.x,p.z);if(t>-1e8&&p.y<t+rad&&p.y>b[1]-rad)p.y=t+rad;}
  const g=exGround(p.x,p.z);if(p.y<g+rad*.6)p.y=g+rad*.6;if(p.y>-.3)p.y=-.3;return p;}
// その点のまわり r に構造物があるか（住みかや海底の置き物を決めるとき）。y を渡すと、その高さを含む物だけ
function seaNearStruct(x,z,r,y){{for(const c of exColsNear(x,z,r+1)){   /* 係留中の船も含める（船底は海底より上なので、航行中の船で海底の置き物が変わることはほぼない） */if(y!==undefined&&(y<c[1]-.3||y>c[4]+.3))continue;if(c[4]<exGround(x,z)-.5)continue;const dx=x-c[6],dz=z-c[7],u=Math.abs(dx*c[10]+dz*c[11])-c[8],v=Math.abs(dx*c[12]+dz*c[13])-c[9];if(u<r&&v<r)return true;}return false;}}
const _so=new THREE.Object3D();
// 向きは実際に動いた方向から決める（頭が進む向き）
function seaFace(o,prev,cur,f,dt,k){const dx=cur.x-prev.x,dy=cur.y-prev.y,dz=cur.z-prev.z,h=Math.hypot(dx,dz);let turn=0;if(h>1e-4){const ty=Math.atan2(-dx,-dz);let dyaw=ty-f.yaw;dyaw=Math.atan2(Math.sin(dyaw),Math.cos(dyaw));const st=dyaw*Math.min(1,dt*(k||6));f.yaw+=st;turn=st/Math.max(dt,1e-3);f.pit=damp(f.pit,Math.atan2(dy,h)*.8,4,dt);}
  f.roll=damp(f.roll||0,Math.max(-.6,Math.min(.6,-turn*.9)),3,dt);o.rotation.set(f.pit,f.yaw,f.roll,'YXZ');}
function seaUpdate(dt,p,show){if(!SEA.ok)seaInit();if(Math.abs(p.x-SEA.gc.x)>12||Math.abs(p.z-SEA.gc.z)>12)seaScatter(p.x,p.z);
  for(const m of SEA.all)m.visible=show||m===SEA.barn||m===SEA.mus;if(!show)return;const t=U.uTime.value;   /* 潮間帯のフジツボ・イガイは水の上からも見える */
  // 魚の群れ：群れごとに海の中の居場所を持ち、そのまわりをゆっくり泳ぐ（ボートには付いて来ない）。ボートから 60m 離れたら、見通しの外（30〜45m 先）へ移す。深さはなめらかに
  SEA.schools.forEach((sc,k)=>{if(!sc.home)sc.home=new V3();const far=sc.ok&&Math.hypot(sc.home.x-p.x,sc.home.z-p.z)>60;
    if(!sc.ok||far){for(let tr=0;tr<16;tr++){const a=Math.random()*6.283,r=sc.placed?30+Math.random()*15:8+Math.random()*25,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r,gy=exGround(x,z);if(gy<-4&&!seaNearStruct(x,z,12)){sc.home.set(x,gy,z);sc.ok=true;break;}}
      if(sc.ok&&(!sc.placed||far)){const gy=sc.home.y;sc.p.set(sc.home.x,Math.max(gy+1.8,Math.min(-1.8,gy*.5)),sc.home.z);sc.ty=sc.p.y;sc.v.set(0,0,0);sc.jump=true;sc.jn=(sc.jn||0)+1;}sc.placed=true;}
    if(!sc.ok)return;sc.t=(sc.t||0)+dt;if(EX.on){const dx=sc.p.x-EX.pos.x,dz=sc.p.z-EX.pos.z,d=Math.hypot(dx,dz)||1;if(d<9&&Math.abs(sc.p.y-EX.pos.y)<6){const k=(9-d)/9*dt*7;sc.home.x+=dx/d*k;sc.home.z+=dz/d*k;sc.p.x+=dx/d*k*.6;sc.p.z+=dz/d*k*.6;}}   /* ボートが近づくと群れごと逃げる */const tx=sc.home.x+Math.sin(sc.t*.07+sc.seed)*9,tz=sc.home.z+Math.cos(sc.t*.05+sc.seed*1.3)*9;
    const dx=tx-sc.p.x,dz=tz-sc.p.z,dl=Math.hypot(dx,dz)||1;sc.v.x=damp(sc.v.x,dx/dl*1.3,.8,dt);sc.v.z=damp(sc.v.z,dz/dl*1.3,.8,dt);sc.p.x+=sc.v.x*dt;sc.p.z+=sc.v.z*dt;
    const gy=Math.min(exGround(sc.p.x,sc.p.z),exGround(sc.p.x+3,sc.p.z),exGround(sc.p.x,sc.p.z+3)),want=Math.max(gy+1.8,Math.min(-1.8,gy*.5+Math.sin(sc.t*.11+k)*1.2));sc.ty=damp(sc.ty,want,.5,dt);sc.p.y=damp(sc.p.y,sc.ty,1.2,dt);seaPush(sc.p,2.2,true);});   /* 群れの中心も構造物の外へ */
  const o=_so;for(let i=0;i<SEA.fishD.length;i++){const f=SEA.fishD[i],sc=SEA.schools[f.sc];
    const cur=_gv.copy(sc.p).add(f.o);cur.x+=Math.sin(t*.5+f.ph)*.7;cur.y+=Math.sin(t*.35+f.ph*2)*.15;cur.z+=Math.cos(t*.45+f.ph)*.7;if(sc.ok)seaPush(cur,.25,true);
    if(!f.init||sc.jump){f.prev.copy(cur);f.init=true;}o.position.copy(cur);seaFace(o,f.prev,cur,f,dt,4);f.prev.copy(cur);o.scale.setScalar(sc.ok?.35*f.s:0);o.updateMatrix();SEA.fish.setMatrixAt(i,o.matrix);}
  SEA.schools.forEach(sc=>sc.jump=false);
  SEA.fish.instanceMatrix.needsUpdate=true;
  // 1 匹ずつ動く物
  const cnt={shark:0,ray:0,squid:0,flat:0,reef:0,jelly:0};const M={shark:SEA.shark,ray:SEA.ray,squid:SEA.squid,flat:SEA.flat,reef:SEA.reef,jelly:SEA.jelly};
  for(const f of SEA.mov){f.t+=dt;const m=M[f.kind],idx=cnt[f.kind]++;
    // アオリイカは群れ（4 匹）で動く。群れの先頭が置き場所を探し、3 割の確率でしか現れない（外れたら 10 秒は探さない）。ほかは先頭の場所に付く
    if(f.kind==='squid'&&f.i%4){const ld=SEA.mov.find(q=>q.kind==='squid'&&q.i===f.i-f.i%4);f.ok=!!(ld&&ld.ok);if(f.ok){if(!f.home)f.home=new V3();if(f.home.distanceTo(ld.home)>5){f.home.copy(ld.home);f.p.copy(ld.p);f.prev.copy(f.p);f.reN=(f.reN||0)+1;}else f.home.copy(ld.home);}}   /* 置き直し（5m 以上）のときだけ先頭の位置へ。逃げて少しずれるのは追いかける */
    else if(!f.ok&&f.kind==='squid'){f.wait=(f.wait||0)-dt;if(f.wait<=0){f.wait=10;if(Math.random()<.3){f.wait=0;f.tryNow=true;}}}
    if(!f.ok&&(f.kind!=='squid'||(f.i%4===0&&f.tryNow))){f.tryNow=false;let w={shark:{r0:22,r1:40,hmin:-80,hmax:-9,clear:18},ray:{r0:8,r1:35,hmin:-30,hmax:-3,clear:10},squid:{r0:6,r1:30,hmin:-60,hmax:-4,clear:12},flat:{r0:3,r1:28,hmin:-25,hmax:-1.5,clear:3},reef:{r0:3,r1:40,hmin:-15,hmax:-3,reef:true,clear:3},jelly:{r0:5,r1:35,hmin:-90,hmax:-14,clear:6}}[f.kind];
      if(f.placed)w=Object.assign({},w,{r0:Math.max(w.r0,28),r1:Math.max(w.r1,45)});   /* 2 回目からは見通しの外に置き直す（目の前に急に現れない） */
      f.ok=seaFindHome(f,p.x,p.z,w);if(f.ok){f.placed=true;f.reN=(f.reN||0)+1;f.p.copy(f.home);f.p.y=f.home.y+1;f.prev.copy(f.p);f.yaw=Math.random()*6.28;}}
    if(f.ok&&f.home.distanceTo(_gv.set(p.x,f.home.y,p.z))>75)f.ok=false;
    if(!f.ok){o.position.set(0,-1e4,0);o.scale.setScalar(0);o.updateMatrix();m.setMatrixAt(idx,o.matrix);continue;}
    if(EX.on&&f.kind!=='shark'&&f.kind!=='jelly'&&f.kind!=='flat'){const dx=f.p.x-EX.pos.x,dz=f.p.z-EX.pos.z,d=Math.hypot(dx,dz)||1,R=f.kind==='reef'?5:8;if(d<R&&Math.abs(f.p.y-EX.pos.y)<5){const k=(R-d)/R*dt*(f.kind==='reef'?5:3);f.home.x+=dx/d*k;f.home.z+=dz/d*k;}}   /* 近づくと離れる（サメは寄ってくる） */
    f.prev.copy(f.p);const H=f.home,sd=f.seed;let sc=1;
    if(f.kind==='shark'){const a=f.t*.06+sd,r=12+4*Math.sin(f.t*.05+sd);f.p.set(H.x+Math.cos(a)*r,0,H.z+Math.sin(a)*r);const gy=exGround(f.p.x,f.p.z);f.p.y=Math.min(-3,Math.max(gy+2.5,H.y*.5));sc=2.6+.4*((f.i*7)%3);}
    else if(f.kind==='ray'){const a=f.t*.09*(f.i%2?1:-1)+sd,r=6+3*Math.sin(f.t*.07+sd);f.p.set(H.x+Math.cos(a)*r,0,H.z+Math.sin(a)*r*.8);f.p.y=exGround(f.p.x,f.p.z)+.6+.4*Math.sin(f.t*.3+sd);sc=1.4+.6*((f.i*5)%3)/2;}
    else if(f.kind==='squid'){const grp=Math.floor(f.i/4),a=f.t*.05+grp*1.7,r=5+grp*1.5;const pulse=Math.max(0,Math.sin(f.t*3.0+f.i));f.u=(f.u||0)+dt*(.15+.9*pulse*pulse);
      const lt=SEA.mov.find(q=>q.kind==='squid'&&q.i===f.i-f.i%4)||f,gt=lt.t;f.p.set(H.x+Math.cos(gt*.05+grp*1.7+(lt.u||0)*.08)*r+(f.i%4-1.5)*.9,H.y+3+Math.sin(f.t*.4+f.i)*.4+(f.i%2)*.5,H.z+Math.sin(gt*.05+grp*1.7+(lt.u||0)*.08)*r+((f.i*3)%4-1.5)*.6);f.p.y=Math.min(f.p.y,-1.5);sc=.95+.3*((f.i*3)%4)/3;}   /* 群れで並んで同じ向きに */
    else if(f.kind==='flat'){const dB=Math.hypot(p.x-f.p.x,p.z-f.p.z);if(dB<4.5&&p.y<-.5&&!f.flee){f.flee=1.6;f.fv=new V3(f.p.x-p.x,0,f.p.z-p.z).normalize();}
      if(f.flee>0){f.flee-=dt;f.p.addScaledVector(f.fv,dt*2.6);f.p.y=exGround(f.p.x,f.p.z)+.12+Math.sin(Math.min(1,f.flee/1.6)*Math.PI)*.4;}else{f.flee=0;f.p.y=exGround(f.p.x,f.p.z)+.03;}sc=.9+.6*((f.i*3)%4)/3;}
    else if(f.kind==='jelly'){f.p.set(H.x+Math.sin(f.t*.05+sd)*4,Math.min(-3,H.y*.55+Math.sin(f.t*.12+sd)*2+2),H.z+Math.cos(f.t*.04+sd)*4);sc=.35+.5*((f.i*7)%5)/4;seaPush(f.p,.4*sc+.2);o.position.copy(f.p);o.rotation.set(Math.sin(f.t*.3+sd)*.2,0,Math.cos(f.t*.27+sd)*.2);o.scale.setScalar(sc);o.updateMatrix();m.setMatrixAt(idx,o.matrix);continue;}
    else{const a=f.t*.4+sd,r=1.2+.8*Math.sin(f.t*.3+sd);f.p.set(H.x+Math.cos(a)*r,H.y+.6+.5*Math.sin(f.t*.5+sd),H.z+Math.sin(a*1.3)*r);sc=.12+.1*((f.i*7)%4)/3;}
    if(f.kind!=='flat')seaPush(f.p,{shark:.9*sc,ray:.6*sc,squid:.45*sc,reef:.15}[f.kind]||.4);   /* 構造物を透過しない */
    if(f.reN!==f.reSeen||f.sy===undefined){f.sy=f.p.y;f.reSeen=f.reN;}else f.sy=damp(f.sy,f.p.y,f.kind==='flat'?6:1.6,dt);f.p.y=f.sy;
    o.position.copy(f.p);if(f.kind==='flat'&&!(f.flee>0))o.rotation.set(0,f.yaw,0,'YXZ');else seaFace(o,f.prev,f.p,f,dt,f.kind==='shark'?1.5:5);
    if(f.kind==='squid'){/* イカは外套の先（-z）が前。動いた向きに向ける */}
    o.scale.setScalar(sc);o.updateMatrix();m.setMatrixAt(idx,o.matrix);}
  for(const k in M)M[k].instanceMatrix.needsUpdate=true;}
function seaOff(){if(!SEA.ok)return;for(const m of SEA.all)m.visible=false;SEA.gc.set(1e9,0,1e9);}

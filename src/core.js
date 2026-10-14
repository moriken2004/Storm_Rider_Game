'use strict';
// ───────────────────────── 基本ユーティリティ ─────────────────────────
const $=id=>document.getElementById(id);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)), lerp=(a,b,t)=>a+(b-a)*t, sat=x=>clamp(x,0,1);
// 機体の灯火やエンジンの光の玉は、カメラが D0 より近いと小さくする（寄りの画で胴体を覆う大きな丸にならないように）
const _glP=new THREE.Vector3();
function glowLOD(sp,D0,kmin){sp.onBeforeRender=function(r,s,cam){if(!this.parent)return;this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix);_glP.setFromMatrixPosition(this.matrixWorld);
  const k=clamp(_glP.distanceTo(cam.position)/D0,kmin,1);if(k<1){const e=this.matrixWorld.elements;for(let i=0;i<3;i++){e[i]*=k;e[4+i]*=k;}}};return sp;}
const smooth=(a,b,x)=>{const t=sat((x-a)/(b-a));return t*t*(3-2*t);};
const damp=(a,b,k,dt)=>lerp(a,b,1-Math.exp(-k*dt));
const ease=t=>t*t*(3-2*t);
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd=mulberry(20261009);
const rr=(a,b)=>a+(b-a)*rnd();
const V3=THREE.Vector3;
const lin=h=>new THREE.Color(h).convertSRGBToLinear();

// 台風の寸法（m）。GLSL 側の定数と必ず揃える
const EYE_R=2400,WALL_OUT=4600,RO=15000;
const BASE=new V3(0,0,21000), RWY_Y=15;

// ───────────────────────── レンダラ ─────────────────────────
const canvas=$('gl');
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
renderer.autoClear=false;
renderer.setClearColor(0x000000,1);
const scene=new THREE.Scene(), overlay=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(60,1,3,90000);
const fsScene=new THREE.Scene(), fsCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),null);quad.frustumCulled=false;fsScene.add(quad);

// 全シェーダ共有の uniform
const U={
  uTime:{value:0},uSpin:{value:0},uStorm:{value:1},uEye:{value:1},
  uSunDir:{value:new V3(-0.45,0.55,0.70).normalize()},uSunCol:{value:new V3(6.2,5.6,4.7)},
  uSkyZen:{value:new V3(0.085,0.21,0.52)},uSkyHor:{value:new V3(0.46,0.60,0.78)},
  uFlashPos:{value:new V3(0,1500,0)},uFlashI:{value:0},
  tNoise:{value:null},tDetail:{value:null},tNoise2:{value:null},tDepth:{value:null},uRes:{value:new THREE.Vector2(1,1)},
};

// ───────────────────────── ノイズテクスチャ ─────────────────────────
function noiseTools(seed){
  const rand=mulberry(seed);
  const lat=P=>{const a=new Float32Array(P*P*P);for(let i=0;i<a.length;i++)a[i]=rand();return a;};
  const vn=(L,P,x,y,z)=>{
    const x0=Math.floor(x),y0=Math.floor(y),z0=Math.floor(z);let fx=x-x0,fy=y-y0,fz=z-z0;
    fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz);
    const x1=(x0+1)%P,y1=(y0+1)%P,z1=(z0+1)%P;
    const a=L[(z0*P+y0)*P+x0],b=L[(z0*P+y0)*P+x1],c=L[(z0*P+y1)*P+x0],d=L[(z0*P+y1)*P+x1];
    const e=L[(z1*P+y0)*P+x0],f=L[(z1*P+y0)*P+x1],g=L[(z1*P+y1)*P+x0],h=L[(z1*P+y1)*P+x1];
    const ab=a+(b-a)*fx,cd=c+(d-c)*fx,ef=e+(f-e)*fx,gh=g+(h-g)*fx;
    const p=ab+(cd-ab)*fy,q=ef+(gh-ef)*fy;return p+(q-p)*fz;};
  const wp=C=>{const a=new Float32Array(C*C*C*3);for(let i=0;i<a.length;i++)a[i]=rand();return a;};
  const wor=(pts,C,x,y,z)=>{
    const cx=Math.floor(x),cy=Math.floor(y),cz=Math.floor(z);let m=9;
    for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const ix=(cx+dx+C)%C,iy=(cy+dy+C)%C,iz=(cz+dz+C)%C,o=((iz*C+iy)*C+ix)*3;
      const px=cx+dx+pts[o]-x,py=cy+dy+pts[o+1]-y,pz=cz+dz+pts[o+2]-z,d=px*px+py*py+pz*pz;if(d<m)m=d;}
    return Math.min(1,Math.sqrt(m));};
  return{lat,vn,wp,wor};
}
function tex3D(data,N){
  const t=new THREE.DataTexture3D(data,N,N,N);
  t.format=THREE.RGBAFormat;t.type=THREE.UnsignedByteType;t.minFilter=t.magFilter=THREE.LinearFilter;
  t.wrapS=t.wrapT=t.wrapR=THREE.RepeatWrapping;t.unpackAlignment=1;t.needsUpdate=true;return t;
}
// 雲の大きな形（Perlin‐Worley）
function makeNoise3D(N){
  const{lat,vn,wp,wor}=noiseTools(7);
  const L1=lat(4),L2=lat(8),L3=lat(16),L4=lat(32),W1=wp(3),W2=wp(6),W3=wp(12),W4=wp(24);
  const R=new Float32Array(N*N*N),G=new Float32Array(N*N*N);let mn=9,mx=-9;
  for(let k=0;k<N;k++)for(let j=0;j<N;j++)for(let i=0;i<N;i++){
    const u=(i+.5)/N,v=(j+.5)/N,w=(k+.5)/N,o=(k*N+j)*N+i;
    const f=.5*vn(L1,4,u*4,v*4,w*4)+.25*vn(L2,8,u*8,v*8,w*8)+.15*vn(L3,16,u*16,v*16,w*16)+.1*vn(L4,32,u*32,v*32,w*32);
    const a=1-wor(W1,3,u*3,v*3,w*3),b=1-wor(W2,6,u*6,v*6,w*6),c=1-wor(W3,12,u*12,v*12,w*12),d=1-wor(W4,24,u*24,v*24,w*24);
    const billow=a*.52+b*.27+c*.14+d*.07;
    const r=f*.5+billow*.62;R[o]=r;if(r<mn)mn=r;if(r>mx)mx=r;G[o]=f;}
  const data=new Uint8Array(N*N*N*4);
  for(let o=0;o<R.length;o++){data[o*4]=255*sat((R[o]-mn)/(mx-mn));data[o*4+1]=255*sat(G[o]);data[o*4+2]=0;data[o*4+3]=255;}
  return tex3D(data,N);
}
// 縁を削る細かい Worley
function makeDetail3D(N){
  const{wp,wor}=noiseTools(23);
  const W1=wp(4),W2=wp(8),W3=wp(16),data=new Uint8Array(N*N*N*4);
  for(let k=0;k<N;k++)for(let j=0;j<N;j++)for(let i=0;i<N;i++){
    const u=(i+.5)/N,v=(j+.5)/N,w=(k+.5)/N,o=((k*N+j)*N+i)*4;
    const a=1-wor(W1,4,u*4,v*4,w*4),b=1-wor(W2,8,u*8,v*8,w*8),c=1-wor(W3,16,u*16,v*16,w*16);
    data[o]=255*sat(a*.58+b*.28+c*.14);data[o+1]=255*sat(b*.6+c*.4);data[o+3]=255;}
  return tex3D(data,N);
}
function makeNoise2D(N){
  const rand=mulberry(11),H=new Float32Array(N*N);
  [[4,.42],[8,.26],[16,.15],[32,.09],[64,.05],[128,.03]].forEach(([P,amp])=>{
    const L=new Float32Array(P*P);for(let i=0;i<L.length;i++)L[i]=rand();
    for(let j=0;j<N;j++)for(let i=0;i<N;i++){
      const x=i/N*P,y=j/N*P,x0=Math.floor(x),y0=Math.floor(y);let fx=x-x0,fy=y-y0;fx=fx*fx*fx*(fx*(fx*6-15)+10);fy=fy*fy*fy*(fy*(fy*6-15)+10);
      const x1=(x0+1)%P,y1=(y0+1)%P,a=L[y0*P+x0],b=L[y0*P+x1],c=L[y1*P+x0],d=L[y1*P+x1];
      H[j*N+i]+=amp*((a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy);
    }});
  const data=new Uint8Array(N*N*4);
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
    const o=j*N+i,hx=H[j*N+(i+1)%N]-H[j*N+(i+N-1)%N],hy=H[((j+1)%N)*N+i]-H[((j+N-1)%N)*N+i];
    data[o*4]=255*sat(.5+hx*9);data[o*4+1]=255*sat(.5+hy*9);data[o*4+2]=255*sat(H[o]);data[o*4+3]=255;}
  const t=new THREE.DataTexture(data,N,N,THREE.RGBAFormat);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;t.anisotropy=8;t.needsUpdate=true;return t;
}

// ───────────────────────── GLSL 共通 ─────────────────────────
const GLSL_COMMON=`
uniform float uTime,uSpin,uStorm,uEye;
uniform vec3 uSunDir,uSunCol,uSkyZen,uSkyHor,uFlashPos;
uniform float uFlashI;
const float EYE_R=2400.0;const float WALL_OUT=4600.0;const float RO=15000.0;
float sat(float x){return clamp(x,0.0,1.0);}
// x:雲量 y:壁雲 z:雨 w:雲頂高度
vec4 stormCover(vec3 p){
  float r=length(p.xz);
  float er=EYE_R*uEye+max(p.y-200.0,0.0)*0.45;
  float life=smoothstep(0.0,1.0,uStorm*1.8-0.8*(1.0-sat(r/RO)));
  float inEye=smoothstep(er-150.0,er+350.0,r);
  float wall=inEye*(1.0-smoothstep(WALL_OUT-500.0,WALL_OUT+1400.0,r));
  float sp=atan(p.z,p.x)*2.0+8.0*log(max(r,300.0)/EYE_R)+uSpin;
  float band=smoothstep(-0.15,0.62,cos(sp));
  float outer=1.0-smoothstep(RO*0.72,RO,r);
  float cdo=1.0-smoothstep(4400.0,7800.0,r);
  float c=max(max(wall,cdo*0.86),band*outer*0.97+outer*0.06)*inEye*life;
  float top=mix(mix(2400.0,3600.0,cdo),4300.0,wall);
  float rain=max(wall,band*outer*0.8+cdo*0.35)*inEye*life;
  return vec4(c,wall*life,rain,top);
}
vec3 skyColor(vec3 d){
  float h=sat(d.y);
  vec3 c=mix(uSkyHor,uSkyZen,1.0-exp(-h*3.6));
  c=mix(c,uSkyHor*1.08,exp(-h*18.0)*0.5);
  if(d.y<0.0)c=mix(uSkyHor,uSkyHor*0.6,sat(-d.y*5.0));
  float s=max(dot(d,uSunDir),0.0);
  c+=uSunCol*(0.010*pow(s,4.0)+0.05*pow(s,48.0)+0.16*pow(s,700.0));
  float az=max(dot(normalize(d.xz+vec2(1e-5)),normalize(uSunDir.xz)),0.0);
  c+=uSunCol*vec3(1.0,0.82,0.62)*0.045*az*az*az*exp(-abs(d.y)*7.0)*(1.4-uSunDir.y*1.6);
  return c;
}
float hazeAmt(vec3 ro,vec3 rd,float t,float k){
  float H=2600.0;float a=exp(-max(ro.y,0.0)/H);float b=rd.y/H;
  float od=a*(abs(b*t)<1e-3?t:(1.0-exp(-b*t))/b);
  return 1.0-exp(-k*od);
}
// 遠くの雲による日陰（壁雲が目の底に落とす影など）
float farShadow(vec3 p){
  float v=1.0;
  vec3 q=p+uSunDir*2500.0;vec4 s=stormCover(q);if(q.y<s.w)v*=1.0-0.9*s.x;
  q=p+uSunDir*6500.0;s=stormCover(q);if(q.y<s.w)v*=1.0-0.9*s.x;
  return v;
}
`;
const FS_VERT=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;

// ───────────────────────── 雲のレイマーチ ─────────────────────────
const cloudMat=new THREE.ShaderMaterial({
  uniforms:Object.assign({uInvPV:{value:new THREE.Matrix4()},uCam:{value:new V3()},uSteps:{value:110},uBud:{value:18},uFrame:{value:0},uGloom:{value:0},uHaze:{value:0.00004}},U),
  vertexShader:FS_VERT,depthTest:false,depthWrite:false,
  fragmentShader:`
precision highp sampler3D;
uniform sampler3D tNoise,tDetail;uniform sampler2D tDepth;
uniform mat4 uInvPV;uniform vec3 uCam;uniform float uSteps,uFrame,uGloom,uHaze,uBud;
varying vec2 vUv;
${GLSL_COMMON}
const float SLAB=5600.0;
const float DENSE=0.0016;
// 消散係数（1/m）。hi=true で縁の細部まで計算
float ext(vec3 p,bool hi,out vec4 sc,out float hf,out float rnE){
  sc=stormCover(p);hf=0.0;rnE=0.0;
  float wall=sc.y;
  float base=mix(720.0,210.0,wall);
  vec3 q=p*vec3(1.0,1.3,1.0)/6200.0+vec3(uTime*0.0011,0.0,uTime*0.0006);
  vec4 nz=texture(tNoise,q);float n=nz.r;
  float top=sc.w*(0.58+0.62*sat((nz.g-0.28)*2.3));
  base+=(0.42-nz.g)*340.0*(1.0-0.55*wall);
  float cv=0.0;
  if(p.y>base&&p.y<top){
    hf=(p.y-base)/(top-base);
    cv=sc.x*smoothstep(0.0,0.10,hf)*(1.0-smoothstep(mix(0.45,0.62,wall),1.0,hf));
  }
  // 晴天の積雲
  if(sc.x<0.5&&p.y>900.0&&p.y<2700.0){
    float fn=texture(tNoise,vec3(p.xz*0.000037,0.37)).g;
    float ft=1500.0+fn*1300.0;
    float fc=smoothstep(0.50,0.70,fn)*0.55*(1.0-sat(sc.x*2.4))*mix(1.0,smoothstep(RO*0.82,RO*1.1,length(p.xz)),sat(uStorm*4.0));
    float fh=(p.y-900.0)/(ft-900.0);
    float f2=fc*smoothstep(0.0,0.10,fh)*(1.0-smoothstep(0.35,1.0,fh));
    if(f2>cv){cv=f2;hf=fh;}
  }
  float e=0.0;
  if(cv>0.01){
    float d=sat((n-(1.0-cv))/0.30);
    if(hi&&d>0.0&&d<0.999){
      vec4 g=texture(tDetail,p/760.0+vec3(0.0,-uTime*0.004,0.0));
      float er=(1.0-g.r)*0.62+(1.0-g.g)*0.16*(1.0-d);
      d=sat((d-er*(1.0-d*0.75))/(1.0-er*0.55));
    }
    e=d*0.030;
  }
  if(p.y<base+150.0){
    float rn=sc.z*sc.z;
    // 雨の幕は、既に読んだ雲の形のノイズを使い回す（追加のテクスチャ参照は主光線だけ）
    if(rn>0.002){rnE=rn*(0.00020+0.00075*wall)*smoothstep(0.34,0.62,nz.g)*2.6;e+=rnE;
      if(hi&&p.y>base-330.0){float sk=smoothstep(0.50,0.72,texture(tDetail,p*vec3(1.0,2.2,1.0)/2300.0+vec3(uTime*0.004,0.0,uTime*0.003)).r);e+=sc.x*sk*0.0045*smoothstep(base-330.0,base-40.0,p.y);}}
  }
  return e;
}
float hg(float mu,float g){float g2=g*g;return (1.0-g2)/pow(1.0+g2-2.0*g*mu,1.5);}
void main(){
  vec4 w1=uInvPV*vec4(vUv*2.0-1.0,1.0,1.0);vec3 rd=normalize(w1.xyz/w1.w-uCam);
  float dep=texture2D(tDepth,vUv).x;float sd=1e9;
  if(dep<0.999999){vec4 w0=uInvPV*vec4(vUv*2.0-1.0,dep*2.0-1.0,1.0);sd=length(w0.xyz/w0.w-uCam);}
  float ry=abs(rd.y)<1e-4?1e-4:rd.y;
  float ta=-uCam.y/ry,tb=(SLAB-uCam.y)/ry;
  float t0=max(min(ta,tb),0.0),t1=min(max(ta,tb),sd);
  t1=min(t1,t0+42000.0);
  if(t1<=t0){gl_FragColor=vec4(0.0,0.0,0.0,1.0);return;}
  float jit=fract(52.9829189*fract(dot(gl_FragCoord.xy+uFrame*vec2(5.588,3.167),vec2(0.06711056,0.00583715))));
  float T=1.0;vec3 L=vec3(0.0);
  float mu=dot(rd,uSunDir);
  float ph1=mix(hg(mu,-0.22),min(hg(mu,0.78),7.0),0.55),ph2=mix(hg(mu,-0.1),hg(mu,0.36),0.5);
  vec3 ambHi=uSkyZen*1.05+uSkyHor*0.50,ambLo=mix(uSkyHor*0.22,vec3(0.022,0.026,0.033),0.85);
  vec3 haze=mix(uSkyHor,vec3(0.050,0.057,0.068),uGloom);
  float t=t0+jit*max(130.0,t0*0.045);
  bool coarse=true;int zero=0;
  int N=int(uSteps);
  for(int i=0;i<N;i++){
    if(t>=t1)break;
    vec3 p=uCam+rd*t;vec4 sc;float hf;
    float fs=max(26.0,min(t*0.010,90.0+t*0.003));
    float rnE;float e=ext(p,!coarse,sc,hf,rnE);float ec=e-rnE;
    float dsC=max(130.0,t*0.045);
    // 歩数の残りで終点まで届くかを見る。手前の雲の薄い縁で細かい歩みを使い切ると、奥の雲まで進めずに消えてしまうため、
    // 届かなくなりそうなら粗い歩みに切り替えて（雲も粗いまま積分して）必ず終点まで進む
    float kLeft=float(N-i);float tGoal=min(t1,t0+uBud*1000.0);float dsNeed=tGoal>t?max(t,1.0)*(pow(tGoal/max(t,1.0),1.0/kLeft)-1.0):0.0;
    bool forced=uBud>0.5&&dsNeed>dsC*1.5;
    if(forced)coarse=true;
    float ds=coarse?dsC:fs;
    if(forced)ds=max(dsC,dsNeed);
    else if(!coarse&&uBud>0.5&&e<DENSE*0.2)ds=fs*1.8;   // ごく薄い縁は少し大股で（歩数の節約）
    if(coarse&&!forced&&ec>2e-5){t=max(t0,t-dsC*0.92);coarse=false;zero=0;continue;}
    if(e>1e-6){
      float colm=max(sc.w-p.y,0.0)*sc.x;
      float sunT=exp(-colm*0.0024);
      vec3 S;
      if(e>DENSE){
        // 太陽方向へ光学的厚さを積む
        float od=0.0,st=50.0;vec3 q=p;vec4 s2;float h2,r2;
        for(int k=0;k<3;k++){q+=uSunDir*st;od+=ext(q,false,s2,h2,r2)*st;st*=2.7;}
        float tr=exp(-od)*ph1+0.42*exp(-od*0.28)*ph2+0.16*exp(-od*0.07);
        float pw=1.0-0.7*exp(-e*90.0-od*2.0);
        sunT*=farShadow(p);
        vec3 amb=mix(ambLo,ambHi,exp(-colm*0.0016)*(0.30+0.70*hf));
        S=uSunCol*sunT*tr*pw+amb;
        zero=0;
      }else{
        vec3 amb=mix(ambLo,ambHi,exp(-colm*0.0016)*0.5);
        S=uSunCol*sunT*0.55*ph2+amb;
        if(!coarse&&!forced){if(ec<2e-5)zero++;else zero=0;if(zero>4)coarse=true;}
      }
      vec3 fq=(p-uFlashPos)/700.0;S+=vec3(8.0,9.5,13.5)*uFlashI/(1.0+dot(fq,fq));
      S=mix(S,haze,hazeAmt(uCam,rd,t,uHaze));
      float a=1.0-exp(-e*ds);
      L+=T*a*S;T*=1.0-a;
      if(T<0.01){T=0.0;break;}
    }else if(!coarse&&!forced){zero++;if(zero>4)coarse=true;}
    t+=ds;
  }
  gl_FragColor=vec4(L,T);
}`});

// ───────────────────────── 合成・ブルーム・最終 ─────────────────────────
const compMat=new THREE.ShaderMaterial({
  uniforms:Object.assign({tScene:{value:null},tCloud:{value:null},uInvPV:cloudMat.uniforms.uInvPV,uCam:cloudMat.uniforms.uCam,
    uGloom:cloudMat.uniforms.uGloom,uCRes:{value:new THREE.Vector2(1,1)},uHaze:cloudMat.uniforms.uHaze,uAO:{value:0},uSharp:{value:.35},uProj:{value:new THREE.Vector2(1,1)}},U),
  vertexShader:FS_VERT,depthTest:false,depthWrite:false,
  fragmentShader:`
uniform sampler2D tScene,tCloud,tDepth,tNoise2;uniform mat4 uInvPV;uniform vec3 uCam;uniform vec2 uCRes,uProj;uniform float uGloom,uHaze,uAO,uSharp;
float lz(float z){return 270000.0/(90000.0-z*89997.0);}
varying vec2 vUv;
${GLSL_COMMON}
void main(){
  vec4 w1=uInvPV*vec4(vUv*2.0-1.0,1.0,1.0);vec3 rd=normalize(w1.xyz/w1.w-uCam);
  float dep=texture2D(tDepth,vUv).x;vec3 col;
  if(dep>=0.999999){
    col=skyColor(rd);
    float s=max(dot(rd,uSunDir),0.0);col+=uSunCol*smoothstep(0.99962,0.99990,s)*22.0;
    // 高層の巻雲
    if(rd.y>0.015){
      float tc=(10500.0-uCam.y)/rd.y;vec2 h=(uCam.xz+rd.xz*tc)*0.000021;
      float c1=texture2D(tNoise2,h*vec2(1.0,0.32)+vec2(uTime*0.0004,0.0)).b,c2=texture2D(tNoise2,h*vec2(3.1,1.2)+vec2(0.3,0.7)).b;
      float ci=smoothstep(0.50,0.80,c1*0.72+c2*0.42)*smoothstep(0.015,0.14,rd.y)*0.42;
      vec3 cc=uSunCol*(0.11+0.35*pow(s,6.0))+uSkyZen*0.5;
      col=mix(col,cc,ci);
    }
  }else{
    vec4 w0=uInvPV*vec4(vUv*2.0-1.0,dep*2.0-1.0,1.0);float d=length(w0.xyz/w0.w-uCam);
    vec3 hz=mix(skyColor(normalize(vec3(rd.x,0.03,rd.z))),vec3(0.050,0.057,0.068),uGloom);
    vec3 sc0=texture2D(tScene,vUv).rgb;
    if(uAO>0.01){float zc=lz(dep);if(zc<160.0){float occ=0.0;float rot=mod(floor(gl_FragCoord.x)+floor(gl_FragCoord.y)*2.0,4.0)*0.19635;
        for(int i=0;i<4;i++){float a=rot+float(i)*0.7854;vec2 dv=vec2(cos(a),sin(a))*uProj*(0.55+0.3*float(i))/zc;
          float z1=lz(texture2D(tDepth,vUv+dv).x),z2=lz(texture2D(tDepth,vUv-dv).x);float dz=zc-0.5*(min(z1,zc+1.2)+min(z2,zc+1.2));occ+=smoothstep(0.03,0.42,dz);}
        sc0*=1.0-uAO*0.62*occ*0.25*(1.0-smoothstep(90.0,160.0,zc));}}
    col=mix(sc0,hz,hazeAmt(uCam,rd,d,uHaze));
  }
  vec2 o=0.5/uCRes;
  vec4 cb=0.25*(texture2D(tCloud,vUv+o*2.0)+texture2D(tCloud,vUv-o*2.0)+texture2D(tCloud,vUv+vec2(o.x,-o.y)*2.0)+texture2D(tCloud,vUv+vec2(-o.x,o.y)*2.0));
  vec4 c=cb;if(uSharp>0.01){vec4 cc=texture2D(tCloud,vUv);c=cc+(cc-cb)*uSharp;c.rgb=max(c.rgb,vec3(0.0));c.a=clamp(c.a,0.0,1.0);}
  gl_FragColor=vec4(col*c.a+c.rgb,1.0);
}`});
const brightMat=new THREE.ShaderMaterial({uniforms:{tSrc:{value:null}},vertexShader:FS_VERT,depthTest:false,depthWrite:false,
  fragmentShader:`uniform sampler2D tSrc;varying vec2 vUv;void main(){vec3 c=texture2D(tSrc,vUv).rgb;float l=max(c.r,max(c.g,c.b));
  gl_FragColor=vec4(min(c*smoothstep(2.2,6.0,l),vec3(30.0)),1.0);}`});
const blurMat=new THREE.ShaderMaterial({uniforms:{tSrc:{value:null},uDir:{value:new THREE.Vector2()}},vertexShader:FS_VERT,depthTest:false,depthWrite:false,
  fragmentShader:`uniform sampler2D tSrc;uniform vec2 uDir;varying vec2 vUv;void main(){
  vec3 c=texture2D(tSrc,vUv).rgb*0.2270;
  c+=(texture2D(tSrc,vUv+uDir*1.385).rgb+texture2D(tSrc,vUv-uDir*1.385).rgb)*0.3162;
  c+=(texture2D(tSrc,vUv+uDir*3.231).rgb+texture2D(tSrc,vUv-uDir*3.231).rgb)*0.0703;
  gl_FragColor=vec4(c,1.0);}`});
// 太陽からの光の筋（明るい部分を太陽の位置へ向けて放射状にぼかす）
const raysMat=new THREE.ShaderMaterial({uniforms:{tSrc:{value:null},uSun:{value:new THREE.Vector2(.5,.5)}},vertexShader:FS_VERT,depthTest:false,depthWrite:false,
  fragmentShader:`uniform sampler2D tSrc;uniform vec2 uSun;varying vec2 vUv;void main(){vec2 d=(uSun-vUv)/18.0*0.92;vec2 uv=vUv;vec3 c=vec3(0.0);float w=1.0;
  for(int i=0;i<18;i++){c+=texture2D(tSrc,uv).rgb*w;w*=0.93;uv+=d;}gl_FragColor=vec4(c/9.0,1.0);}`});
const finalMat=new THREE.ShaderMaterial({
  uniforms:{tHDR:{value:null},tBloom:{value:null},tRays:{value:null},tDepth:U.tDepth,uTime:U.uTime,uRain:{value:0},uRainAng:{value:0.3},uExp:{value:0.9},uFade:{value:0},uWhite:{value:0},
    uHurt:{value:0},uAspect:{value:1},uScr:{value:0},uPx:{value:new THREE.Vector2()},uGloomF:{value:0},uGoldF:{value:0},uIndoorF:{value:0},uRays:{value:0},uLens:{value:0},uDof:{value:0},uFocus:{value:50},uSun:raysMat.uniforms.uSun,uHeat:{value:new THREE.Vector4()},uHeatR:{value:0},uHeatAmt:{value:0},uHeatD:{value:0}},
  vertexShader:FS_VERT,depthTest:false,depthWrite:false,
  fragmentShader:`
uniform sampler2D tHDR,tBloom,tRays,tDepth;uniform float uTime,uRain,uRainAng,uExp,uFade,uWhite,uHurt,uAspect,uScr,uIndoorF,uGloomF,uGoldF,uRays,uLens,uDof,uFocus,uHeatR,uHeatAmt,uHeatD;uniform vec2 uPx,uSun;uniform vec4 uHeat;
varying vec2 vUv;
float sat(float x){return clamp(x,0.0,1.0);}
float h1(float n){return fract(sin(n*127.1)*43758.5453);}
float streaks(vec2 uv,float sc,float sp,float seed){
  float cs=cos(uRainAng),sn=sin(uRainAng);
  vec2 q=vec2(uv.x*cs-uv.y*sn,uv.x*sn+uv.y*cs);
  q.x*=sc;float id=floor(q.x);float h=h1(id+seed);
  float y=fract(q.y*(0.7+h*0.9)+uTime*sp*(0.8+h*0.7)+h*17.0);
  float s=smoothstep(0.0,0.02,y)*smoothstep(0.16,0.03,y);
  float w=smoothstep(0.10,0.0,abs(fract(q.x)-0.5));
  return s*w*step(0.45,h);
}
vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
float luma(vec3 c){return dot(c,vec3(0.299,0.587,0.114));}
vec3 T(vec2 uv){return texture2D(tHDR,uv).rgb;}
float lum(vec3 c){c=c/(1.0+c);return dot(c,vec3(0.299,0.587,0.114));}
// 輪郭の段差をならす（FXAA）
vec3 fxaa(vec2 uv){
  vec3 m=T(uv);float lM=lum(m),lNW=lum(T(uv+vec2(-1.0,-1.0)*uPx)),lNE=lum(T(uv+vec2(1.0,-1.0)*uPx)),lSW=lum(T(uv+vec2(-1.0,1.0)*uPx)),lSE=lum(T(uv+vec2(1.0,1.0)*uPx));
  float lMin=min(lM,min(min(lNW,lNE),min(lSW,lSE))),lMax=max(lM,max(max(lNW,lNE),max(lSW,lSE)));
  if(lMax-lMin<max(0.02,lMax*0.11))return m;
  vec2 dir=vec2(-((lNW+lNE)-(lSW+lSE)),((lNW+lSW)-(lNE+lSE)));
  float rm=1.0/(min(abs(dir.x),abs(dir.y))+max((lNW+lNE+lSW+lSE)*0.03125,0.0078125));
  dir=clamp(dir*rm,vec2(-8.0),vec2(8.0))*uPx;
  vec3 a=0.5*(T(uv+dir*(1.0/3.0-0.5))+T(uv+dir*(2.0/3.0-0.5)));
  vec3 b=a*0.5+0.25*(T(uv-dir*0.5)+T(uv+dir*0.5));
  float lB=lum(b);return (lB<lMin||lB>lMax)?a:b;
}
// レンズに付いて流れる雨粒（像を屈折させる）
vec2 drops(vec2 uv){
  vec2 off=vec2(0.0);
  for(int L=0;L<2;L++){float sc=L==0?6.0:11.0;vec2 g=vec2(uv.x*uAspect,uv.y)*sc;g.y+=uTime*(L==0?0.05:0.09);vec2 id=floor(g),f=fract(g)-0.5;
    float h=fract(sin(dot(id,vec2(127.1,311.7))+float(L)*7.3)*43758.5453);if(h>uLens*0.62)continue;
    float life=fract(h*17.0+uTime*(0.10+h*0.16));vec2 c=(vec2(fract(h*91.0),fract(h*37.0))-0.5)*0.5;float r=(0.09+0.15*fract(h*53.0))*(1.0-life*0.45);
    vec2 d=f-c;d.y*=0.82;float dd=length(d)/r;if(dd<1.0)off-=d*(1.0-dd*dd)*0.55/sc*smoothstep(1.0,0.85,life);}
  return off;
}
void main(){
  vec2 uv=(vUv-0.5)*vec2(uAspect,1.0);
  float v=dot(uv,uv);
  vec2 suv=vUv;float drop=0.0;
  if(uLens>0.02){vec2 o=drops(vUv);suv+=o;drop=length(o)*40.0;}
  if(uHeatAmt>0.002){vec2 as=vec2(uAspect,1.0),pa=(vUv-uHeat.xy)*as,ba=(uHeat.zw-uHeat.xy)*as;float hh=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.0,1.0);float dd=length(pa-ba*hh)/uHeatR;
    if(dd<1.0){float zz=texture2D(tDepth,vUv).x;float zl=zz>=0.999999?1e5:270000.0/(90000.0-zz*89997.0);
      if(zl>uHeatD-5.0){float f=(1.0-dd)*(1.0-dd)*(1.0-hh*0.65)*uHeatAmt;
        vec2 n=vec2(sin(vUv.y*310.0+uTime*37.0)+sin(vUv.x*190.0-uTime*23.0+vUv.y*90.0),sin(vUv.x*260.0+uTime*29.0)+sin(vUv.y*170.0+uTime*19.0));suv+=n*uPx*2.6*f;}}}
  vec3 col=fxaa(suv);float cocv=0.0;
  // 被写界深度（ムービーの寄りの場面だけ）
  if(uDof>0.01){float z=texture2D(tDepth,suv).x;float d=z>=0.999999?1e5:(3.0*90000.0)/(90000.0-z*(90000.0-3.0));
    float coc=sat(abs(d-uFocus)/max(uFocus,1.0)*0.55-0.16)*uDof;cocv=coc;
    if(coc>0.03){vec2 r=uPx*coc*4.2;vec3 a=T(suv+r*vec2(1.0,0.0))+T(suv+r*vec2(-1.0,0.0))+T(suv+r*vec2(0.0,1.0))+T(suv+r*vec2(0.0,-1.0))+T(suv+r*vec2(0.7,0.7))+T(suv+r*vec2(-0.7,0.7))+T(suv+r*vec2(0.7,-0.7))+T(suv+r*vec2(-0.7,-0.7));
      vec2 r2=r*0.5;a+=T(suv+r2*vec2(0.38,0.92))+T(suv+r2*vec2(-0.92,0.38))+T(suv+r2*vec2(-0.38,-0.92))+T(suv+r2*vec2(0.92,-0.38));
      col=mix(col,(col+a)/13.0,sat(coc*3.0));}}
  // レンズの色収差（周辺だけ）
  vec2 ca=(vUv-0.5)*v*0.0045;
  float caw=0.8*(1.0-sat(cocv*6.0));col.r=mix(col.r,texture2D(tHDR,suv+ca).r,caw);col.b=mix(col.b,texture2D(tHDR,suv-ca).b,caw);
  col+=texture2D(tBloom,suv).rgb*0.42;
  // 光条とレンズフレア
  if(uRays>0.01){col+=texture2D(tRays,vUv).rgb*uRays*0.16;
    vec2 gv=vec2(1.0)-vUv;col+=texture2D(tBloom,0.5+(gv-0.5)*0.55).rgb*vec3(0.35,0.55,0.9)*0.05*uRays+texture2D(tBloom,0.5+(gv-0.5)*1.6).rgb*vec3(0.9,0.6,0.3)*0.03*uRays;
    vec2 sd=(vUv-uSun)*vec2(uAspect,1.0);col+=vec3(1.0,0.86,0.66)*uRays*0.05*exp(-abs(sd.y)*90.0)*exp(-abs(sd.x)*2.6)*sat(luma(texture2D(tBloom,uSun).rgb)*0.25);}
  col+=vec3(0.7,0.8,0.9)*drop*0.05;
  if(uRain>0.01){
    float r=streaks(uv,150.0,3.1,1.0)*0.5+streaks(uv*1.6,240.0,4.0,31.0)*0.4+streaks(uv*0.7,80.0,2.3,77.0)*0.55;
    float amb=0.22+luma(col)*0.9;
    col+=vec3(0.62,0.68,0.75)*r*uRain*amb*0.34;
    col=mix(col,vec3(luma(col)),uRain*0.10);
  }
  col*=uExp;
  col+=vec3(0.8,0.88,1.0)*uScr;
  col=aces(col);
  col=pow(col,vec3(1.0/2.2));
  // 階調と色調：晴れは影を青緑・光を暖色に、嵐は彩度を落として冷たく硬く、夕方は暖かく
  col=mix(col,col*col*(3.0-2.0*col),0.22);
  float l=luma(col);
  vec3 clr=mix(col*vec3(0.955,1.0,1.055),col*vec3(1.045,1.0,0.95),smoothstep(0.12,0.85,l));
  vec3 gold=col*vec3(1.06,1.0,0.9);
  vec3 storm=(mix(vec3(l),col,0.76)*vec3(0.93,0.985,1.06)-0.5)*1.09+0.5;
  col=mix(mix(clr,gold,uGoldF*0.7),storm,uGloomF);
  {float li=luma(col);vec3 ic=mix(vec3(li),col,0.72)*vec3(1.03,1.0,0.94);ic=mix(ic,ic*ic*(3.0-2.0*ic),0.35);col=mix(col,ic,uIndoorF);}
  col*=1.0-0.30*smoothstep(0.20,1.0,v);
  col=mix(col,vec3(0.62,0.05,0.03),uHurt*smoothstep(0.22,0.95,v)*0.5);
  col+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233))+fract(uTime)*37.0)*43758.5453)-0.5)*0.014;
  col=mix(col,vec3(1.0),uWhite);
  col*=1.0-uFade;
  gl_FragColor=vec4(col,1.0);
}`});

// 発光オーバーレイ用マテリアル（深度は手動テスト）
function glowMat(color,mode,opts){
  const m=new THREE.ShaderMaterial(Object.assign({
    uniforms:{uColor:{value:color.clone?color.clone():new V3(color[0],color[1],color[2])},uAlpha:{value:1},tDepth:U.tDepth,uRes:U.uRes},
    defines:{MODE:mode},
    vertexShader:`varying vec2 vUv;varying vec3 vN;varying vec3 vV;varying float vA;
#ifdef USE_AA
attribute float aA;
#endif
void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.0);vN=normalMatrix*normal;vV=-mv.xyz;vA=1.0;
#ifdef USE_AA
vA=aA;
#endif
gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform vec3 uColor;uniform float uAlpha;uniform sampler2D tDepth;uniform vec2 uRes;
varying vec2 vUv;varying vec3 vN;varying vec3 vV;varying float vA;
void main(){
  float d=texture2D(tDepth,gl_FragCoord.xy/uRes).x;if(gl_FragCoord.z>d)discard;
  float a=uAlpha*vA;
#if MODE==1
  a*=pow(max(1.0-abs(vUv.x-0.5)*2.0,0.0),1.6);
#elif MODE==2
  float f=abs(dot(normalize(vN),normalize(vV)));a*=pow(1.0-f,2.2)+0.06;
#elif MODE==3
  float r=length(vUv-0.5)*2.0;a*=pow(max(1.0-r,0.0),2.4);
#elif MODE==5
  a*=pow(max(1.0-abs(vUv.x-0.5)*2.0,0.0),1.6)*pow(vUv.y,1.4);
#elif MODE==4
  a*=0.35+0.65*pow(abs(sin(vUv.y*40.0)),6.0);float f=abs(dot(normalize(vN),normalize(vV)));a*=0.02+0.98*pow(1.0-f,2.0);
#endif
  gl_FragColor=vec4(uColor*a,1.0);
}`,
    transparent:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide,
    blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor},opts||{}));
  return m;
}

// ───────────────────────── レンダーターゲットと描画 ─────────────────────────
let rtScene,rtCloud,rtHDR,rtB1,rtB2,rtCH=[null,null],chI=0,RW=0,RH=0;
const resolveMat=new THREE.ShaderMaterial({uniforms:{tCur:{value:null},tHist:{value:null},uInvPV:cloudMat.uniforms.uInvPV,uCam:cloudMat.uniforms.uCam,uPrevPV:{value:new THREE.Matrix4()},uBlend:{value:1},uCRes:compMat.uniforms.uCRes},
  vertexShader:FS_VERT,depthTest:false,depthWrite:false,
  fragmentShader:`uniform sampler2D tCur,tHist;uniform mat4 uInvPV,uPrevPV;uniform vec3 uCam;uniform float uBlend;uniform vec2 uCRes;varying vec2 vUv;
void main(){vec4 cur=texture2D(tCur,vUv);
  vec4 w1=uInvPV*vec4(vUv*2.0-1.0,1.0,1.0);vec3 rd=normalize(w1.xyz/w1.w-uCam);
  vec4 pp=uPrevPV*vec4(uCam+rd*12000.0,1.0);vec2 puv=pp.xy/pp.w*0.5+0.5;
  float a=uBlend;if(pp.w<=0.0||puv.x<0.0||puv.x>1.0||puv.y<0.0||puv.y>1.0)a=1.0;
  vec2 o=1.0/uCRes;vec4 n1=texture2D(tCur,vUv+vec2(o.x,0.0)),n2=texture2D(tCur,vUv-vec2(o.x,0.0)),n3=texture2D(tCur,vUv+vec2(0.0,o.y)),n4=texture2D(tCur,vUv-vec2(0.0,o.y));
  vec4 mn=min(cur,min(min(n1,n2),min(n3,n4))),mx=max(cur,max(max(n1,n2),max(n3,n4)));vec4 pad=(mx-mn)*1.3+0.06;
  vec4 h=clamp(texture2D(tHist,puv),mn-pad,mx+pad);
  gl_FragColor=mix(h,cur,a);}`});
const _prevPV=new THREE.Matrix4(),_prevCam=new V3(),_prevDir=new V3(),_dir=new V3();let cloudReset=true;
const view={scale:1,q:1,cssW:1,cssH:1};
function makeRT(w,h,depth){
  const o={minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,type:THREE.HalfFloatType,depthBuffer:!!depth,stencilBuffer:false};
  const rt=new THREE.WebGLRenderTarget(w,h,o);
  if(depth){rt.depthTexture=new THREE.DepthTexture(w,h);rt.depthTexture.type=THREE.UnsignedIntType;rt.depthTexture.minFilter=rt.depthTexture.magFilter=THREE.NearestFilter;}
  return rt;
}
function resize(force){
  const cw=window.innerWidth||800,ch=window.innerHeight||600;
  const dpr=Math.min(window.devicePixelRatio||1,(view.touch?[1.3,1.6,2]:[1,1.5,2])[view.q]);
  const w=Math.max(320,Math.round(cw*dpr*view.scale)),h=Math.max(200,Math.round(ch*dpr*view.scale));
  view.cssW=cw;view.cssH=ch;
  if(!force&&w===RW&&h===RH)return;
  RW=w;RH=h;
  renderer.setSize(w,h,false);
  [rtScene,rtCloud,rtHDR,rtB1,rtB2,rtCH[0],rtCH[1]].forEach(r=>{if(r){if(r.depthTexture)r.depthTexture.dispose();r.dispose();}});
  rtScene=makeRT(w,h,true);rtHDR=makeRT(w,h,false);
  const cs=[0.5,0.5,0.75][view.q],cwd=Math.round(w*cs),chd=Math.round(h*cs);
  rtCloud=makeRT(cwd,chd,false);rtCH=[makeRT(cwd,chd,false),makeRT(cwd,chd,false)];cloudReset=true;
  rtB1=makeRT(w>>2,h>>2,false);rtB2=makeRT(w>>2,h>>2,false);
  U.tDepth.value=rtScene.depthTexture;U.uRes.value.set(w,h);
  compMat.uniforms.uCRes.value.set(cwd,chd);
  finalMat.uniforms.uAspect.value=w/h;finalMat.uniforms.uPx.value.set(1/w,1/h);
  camera.aspect=w/h;camera.updateProjectionMatrix();
}
const _pv=new THREE.Matrix4();
let frameNo=0;
function renderFrame(){
  camera.updateMatrixWorld();
  _pv.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  cloudMat.uniforms.uInvPV.value.copy(_pv).invert();
  cloudMat.uniforms.uCam.value.copy(camera.position);
  cloudMat.uniforms.uFrame.value=(frameNo++)%16;
  renderer.setRenderTarget(rtScene);renderer.clear();renderer.render(scene,camera);
  quad.material=cloudMat;renderer.setRenderTarget(rtCloud);renderer.render(fsScene,fsCam);
  // 視点が飛んだとき（場面転換）は履歴を捨てる
  camera.getWorldDirection(_dir);if(camera.position.distanceTo(_prevCam)>350||_dir.dot(_prevDir)<.9)cloudReset=true;
  resolveMat.uniforms.tCur.value=rtCloud.texture;resolveMat.uniforms.tHist.value=rtCH[chI].texture;resolveMat.uniforms.uPrevPV.value.copy(_prevPV);resolveMat.uniforms.uBlend.value=cloudReset?1:.16;
  quad.material=resolveMat;renderer.setRenderTarget(rtCH[1-chI]);renderer.render(fsScene,fsCam);chI=1-chI;cloudReset=false;
  _prevPV.copy(_pv);_prevCam.copy(camera.position);_prevDir.copy(_dir);
  compMat.uniforms.tScene.value=rtScene.texture;compMat.uniforms.tCloud.value=rtCH[chI].texture;
  quad.material=compMat;renderer.setRenderTarget(rtHDR);renderer.render(fsScene,fsCam);
  renderer.render(overlay,camera);
  brightMat.uniforms.tSrc.value=rtHDR.texture;quad.material=brightMat;renderer.setRenderTarget(rtB1);renderer.render(fsScene,fsCam);
  quad.material=blurMat;
  for(let i=0;i<2;i++){
    blurMat.uniforms.tSrc.value=rtB1.texture;blurMat.uniforms.uDir.value.set((1+i*1.5)/rtB1.width,0);renderer.setRenderTarget(rtB2);renderer.render(fsScene,fsCam);
    blurMat.uniforms.tSrc.value=rtB2.texture;blurMat.uniforms.uDir.value.set(0,(1+i*1.5)/rtB1.height);renderer.setRenderTarget(rtB1);renderer.render(fsScene,fsCam);
  }
  // 太陽が画面の近くにあるときだけ光条を作る
  {const sd=U.uSunDir.value;_dir.set(camera.position.x+sd.x*1e5,camera.position.y+sd.y*1e5,camera.position.z+sd.z*1e5).project(camera);
    const on=_dir.z<1&&Math.abs(_dir.x)<1.5&&Math.abs(_dir.y)<1.5;finalMat.uniforms.uRays.value=on?Math.max(0,1-Math.max(Math.abs(_dir.x),Math.abs(_dir.y))/1.5):0;
    if(on){raysMat.uniforms.uSun.value.set(_dir.x*.5+.5,_dir.y*.5+.5);raysMat.uniforms.tSrc.value=rtB1.texture;quad.material=raysMat;renderer.setRenderTarget(rtB2);renderer.render(fsScene,fsCam);finalMat.uniforms.tRays.value=rtB2.texture;}}
  finalMat.uniforms.tHDR.value=rtHDR.texture;finalMat.uniforms.tBloom.value=rtB1.texture;
  quad.material=finalMat;renderer.setRenderTarget(null);renderer.render(fsScene,fsCam);
}

// ───────────────────────── 台風場の CPU 版（シェーダと同じ式） ─────────────────────────
const _sc={c:0,wall:0,rain:0,top:0};
function stormAt(x,y,z,out){
  out=out||_sc;
  const r=Math.hypot(x,z),er=EYE_R*U.uEye.value+Math.max(y-200,0)*0.45;
  const life=smooth(0,1,U.uStorm.value*1.8-0.8*(1-sat(r/RO)));
  const inEye=smooth(er-150,er+350,r);
  const wall=inEye*(1-smooth(WALL_OUT-500,WALL_OUT+1400,r));
  const sp=Math.atan2(z,x)*2+8*Math.log(Math.max(r,300)/EYE_R)+U.uSpin.value;
  const band=smooth(-0.15,0.62,Math.cos(sp));
  const outer=1-smooth(RO*0.72,RO,r),cdo=1-smooth(4400,7800,r);
  out.c=Math.max(wall,cdo*0.86,band*outer*0.97+outer*0.06)*inEye*life;
  out.top=lerp(lerp(2400,3600,cdo),4300,wall);
  out.rain=Math.max(wall,band*outer*0.8+cdo*0.35)*inEye*life;
  out.wall=wall*life;out.r=r;
  return out;
}
const _sv={c:0,wall:0,rain:0,top:0};
function sunVisAt(p){
  const s=stormAt(p.x,p.y,p.z,_sv);let v=p.y<s.top?1-0.92*s.c:1;
  const d=U.uSunDir.value;
  for(const k of[2500,6500]){const q=stormAt(p.x+d.x*k,p.y+d.y*k,p.z+d.z*k,_sv);if(p.y+d.y*k<q.top)v*=1-0.9*q.c;}
  return v;
}
// 風（反時計回りの接線風＋わずかな吹き込み）
function windAt(p,out){
  const r=Math.hypot(p.x,p.z)||1,er=EYE_R*U.uEye.value,pk=er+900;
  let v;
  if(r<er)v=0.22*Math.pow(r/er,2);
  else if(r<pk)v=lerp(0.22,1,smooth(er,pk,r));
  else v=Math.pow(pk/r,0.62)*(1-smooth(RO,RO*1.25,r));
  v*=50*U.uStorm.value;
  const tx=p.z/r,tz=-p.x/r;
  out.set(tx*v-p.x/r*v*0.12,0,tz*v-p.z/r*v*0.12);
  return v;
}

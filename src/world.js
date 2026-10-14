// ───────────────────────── 海 ─────────────────────────
const GLSL_WAVES=`
const vec4 WAV[6]=vec4[6](vec4(0.955,0.296,0.02027,2.6),vec4(0.454,0.891,0.03307,1.7),vec4(0.878,-0.479,0.05236,1.1),
  vec4(-0.416,0.909,0.08378,0.6),vec4(0.697,0.717,0.1366,0.38),vec4(0.267,-0.964,0.2167,0.22));
float harb(vec2 xz){vec2 l=xz-vec2(0.0,21000.0);float u=clamp((l.x-1282.0)/358.0,0.0,1.0);float zn=mix(-246.0,-150.0,u),zs=mix(556.0,440.0,u);
  return smoothstep(1268.0,1296.0,l.x)*(1.0-smoothstep(1648.0,1672.0,l.x))*smoothstep(zn-6.0,zn+14.0,l.y)*(1.0-smoothstep(zs-14.0,zs+6.0,l.y));}
float seaState(vec2 xz,float c){return max(c,(1.0-smoothstep(2500.0,14000.0,length(xz)))*0.75*uStorm);}
`;
let ocean;
function buildOcean(){
  const RINGS=210,SEG=200,pos=[],idx=[];
  for(let i=0;i<=RINGS;i++){const r=i===0?0:5*Math.pow(1.047,i);
    for(let j=0;j<SEG;j++){const a=j/SEG*Math.PI*2;pos.push(Math.cos(a)*r,0,Math.sin(a)*r);}}
  for(let i=0;i<RINGS;i++)for(let j=0;j<SEG;j++){const a=i*SEG+j,b=i*SEG+(j+1)%SEG,c=a+SEG,d=b+SEG;idx.push(a,b,c,b,d,c);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);
  const m=new THREE.ShaderMaterial({
    uniforms:Object.assign({uSnap:{value:new THREE.Vector2()}},U),
    vertexShader:`uniform vec2 uSnap;varying vec3 vW;varying vec2 vP;
${GLSL_COMMON}${GLSL_WAVES}
void main(){
  vec3 p=position;float R=length(p.xz);p.xz+=uSnap;vP=p.xz;
  float c=stormCover(vec3(p.x,0.0,p.z)).x;float sea=0.3+1.3*seaState(p.xz,c);
  vec3 d=vec3(0.0);
  for(int i=0;i<3;i++){vec4 W=WAV[i];float lam=6.2832/W.z;float f=1.0-smoothstep(lam*3.0,lam*5.5,R);
    float ph=W.z*dot(W.xy,p.xz)-sqrt(9.8*W.z)*uTime;d.y+=W.w*sin(ph)*f;}
  p+=d*sea*(1.0-0.88*harb(p.xz));vW=p;
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);
}`,
    fragmentShader:`precision highp sampler3D;
uniform sampler3D tNoise;uniform sampler2D tNoise2;varying vec3 vW;varying vec2 vP;
float smN(vec2 uv){uv=uv*256.0+0.5;vec2 i=floor(uv),f=fract(uv);f=f*f*f*(f*(f*6.0-15.0)+10.0);return texture2D(tNoise2,(i+f-0.5)/256.0).b;}
${GLSL_COMMON}${GLSL_WAVES}
// 晴天の積雲が落とす影：雲の層（高度 1700m 付近）まで太陽方向へたどった位置の雲量
float cumShadow(vec2 xz,float y){vec2 q=xz+uSunDir.xz/max(uSunDir.y,0.12)*(1700.0-y);float fn=texture(tNoise,vec3(q*0.000037,0.37)).g;
  return smoothstep(0.52,0.66,fn)*mix(1.0,smoothstep(12300.0,16500.0,length(q)),clamp(uStorm*4.0,0.0,1.0));}
vec2 rot(vec2 v,float a){float c=cos(a),s=sin(a);return vec2(c*v.x-s*v.y,s*v.x+c*v.y);}
void main(){
  vec2 xz=vP;float dist=length(vW-cameraPosition);
  vec4 sc=stormCover(vec3(xz.x,0.0,xz.y));
  float wp=seaState(xz,sc.x),sea=0.3+1.3*wp;
  vec2 sl=vec2(0.0);float crest=0.0;float lod=1.0/(1.0+dist*0.00016);
  for(int i=0;i<6;i++){vec4 W=WAV[i];float ph=W.z*dot(W.xy,xz)-sqrt(9.8*W.z)*uTime;float a=W.w*W.z*sea;
    float lam=6.2832/W.z;float f=1.0/(1.0+pow(dist/(lam*13.0),2.0));sl+=W.xy*a*cos(ph)*f;crest+=a*sin(ph)*f;}
  // さざ波から風浪まで 5 段。タイルが見えないよう毎段回転させる
  vec2 wd=vec2(0.8,0.6)*uTime;float k=dist*0.00045,k2=k*k;
  vec2 g=rot(texture2D(tNoise2,rot(xz,0.3)/310.0+wd*0.0022).rg-0.5,-0.3)/(1.0+k2*0.12);
  g+=rot(texture2D(tNoise2,rot(xz,1.1)/117.0-wd*0.006).rg-0.5,-1.1)*0.9/(1.0+k2*0.6);
  g+=rot(texture2D(tNoise2,rot(xz,2.3)/43.0+wd*0.013).rg-0.5,-2.3)*0.8/(1.0+k2);
  g+=rot(texture2D(tNoise2,rot(xz,0.8)/15.1-wd*0.03).rg-0.5,-0.8)*0.7/(1.0+k2*6.0);
  g+=rot(texture2D(tNoise2,rot(xz,1.9)/5.3+wd*0.06).rg-0.5,-1.9)*0.6/(1.0+k2*40.0);
  g+=rot(texture2D(tNoise2,rot(xz,2.9)/1.7-wd*0.11).rg-0.5,-2.9)*0.5/(1.0+k2*700.0);
  // 数キロ規模の風のむら（凪の帯と波立つ帯）
  float m1=0.5*(smN(rot(xz,0.7)/6100.0+wd*0.0002)+smN(rot(xz,1.9)/9300.0+0.37)),m2=0.5*(smN(rot(xz,2.0)/1900.0-wd*0.0005)+smN(rot(xz,0.4)/3100.0+0.61));
  float wPat=clamp(1.0+(m1-0.5)*2.4+(m2-0.5)*1.7,0.4,1.75);
  sl+=g*(0.42+0.85*wp)*0.6*wPat;sl*=1.0-0.78*harb(xz);
  vec3 N=normalize(vec3(-sl.x,1.0,-sl.y));
  vec3 V=normalize(cameraPosition-vW);
  float NdV=max(dot(N,V),0.02);
  float F=0.02+0.98*pow(1.0-NdV,5.0);
  F=mix(F,F*0.72+0.02,sat(dist/9000.0));
  vec3 R=reflect(-V,N);R.y=abs(R.y)+0.015;R=normalize(R);
  // 反射した視線が雲底に当たる場所の雲量
  vec2 hit=xz+clamp(R.xz/R.y,vec2(-9.0),vec2(9.0))*1300.0;
  float cR=stormCover(vec3(hit.x,1300.0,hit.y)).x;
  float sv=(1.0-0.92*sc.x)*farShadow(vec3(xz.x,5.0,xz.y))*(1.0-0.62*cumShadow(xz,0.0));
  vec2 fd=(xz-uFlashPos.xz)/1800.0;vec3 fl=vec3(1.6,1.9,2.6)*uFlashI/(1.0+dot(fd,fd));
  vec3 cloudRef=mix(vec3(0.34,0.37,0.41),vec3(0.058,0.066,0.078),sat(sc.x*1.1))+fl*0.25;
  vec3 refl=mix(skyColor(R),cloudRef,sat(cR*1.25));
  vec3 E=uSunCol*sv*0.16+mix(uSkyHor*0.7,vec3(0.11,0.12,0.14),sat(sc.x*1.2))+fl*0.2;
  vec3 body=mix(vec3(0.006,0.040,0.085),vec3(0.026,0.058,0.062),wp)*(E+0.04);
  // 波頭の透過色。うねり 3 本の重なりは規則的な格子になるので、遠目（上空）では消し、近くでもむらを掛ける
  body+=vec3(0.0,0.050,0.046)*sat(crest/(0.317*sea))*sv*(1.0-smoothstep(220.0,950.0,dist))*(0.3+1.1*smN(rot(xz,1.3)/370.0+wd*0.001));
  body*=0.78+0.26*wPat;
  // 島のまわりの浅瀬
  vec2 il=(xz-vec2(0.0,21000.0))/vec2(1500.0,1750.0);float idv=length(il)+(texture2D(tNoise2,xz/2600.0).b-0.5)*0.22;
  float hbm=harb(xz);
  float shal=(1.0-smoothstep(0.78,1.25,idv))*(1.0-hbm);
  body=mix(body,vec3(0.035,0.30,0.29)*(E+0.04),shal*shal*0.8);
  body=mix(body,vec3(0.012,0.085,0.090)*(E+0.04),hbm*0.85);
  vec3 col=mix(body,refl,F);
  // 太陽のきらめき
  vec3 Hh=normalize(V+uSunDir);float NdH=max(dot(N,Hh),0.0);
  float al=(0.040+0.05*wp)*(0.6+0.5*wPat)+sat(dist/14000.0)*0.11,a2=al*al;
  float Dg=a2/(3.14159*pow(NdH*NdH*(a2-1.0)+1.0,2.0));
  float Fs=0.02+0.98*pow(1.0-max(dot(V,Hh),0.0),5.0);
  col+=uSunCol*min(Dg*Fs*0.25,24.0)*sv*0.30;
  // 白波
  float n1=texture2D(tNoise2,xz/71.0+wd*0.010).b,n2=texture2D(tNoise2,rot(xz,1.3)/19.0-wd*0.02).b,n3=texture2D(tNoise2,rot(xz,2.1)/6.3+wd*0.03).b;
  float cn=crest/(0.317*sea);
  float th=mix(1.28,0.52,sat(wp*1.1));
  float cap=smoothstep(th,th+0.22,cn*0.6+n1*0.75);
  float lace=smoothstep(0.43,0.60,n2*0.62+n3*0.48);
  float foam=cap*lace;
  // 磯波
  {float ph=uTime*0.55+n1*7.0,w1=0.030*sin(ph),w2=0.030*sin(ph-1.7);
    float b1=smoothstep(0.050,0.0,abs(idv-0.845-w1))*smoothstep(0.28,0.60,n2*0.7+n3*0.5);
    float b2=smoothstep(0.038,0.0,abs(idv-0.900-w2))*smoothstep(0.36,0.66,n2*0.6+n3*0.6)*0.75;
    float lace2=smoothstep(0.50,0.72,n3*0.6+n2*0.5)*smoothstep(0.800,0.835,idv)*(1.0-smoothstep(0.86,0.90,idv))*0.45;
    foam=max(foam,max(max(b1,b2),lace2)*0.95);}
  float rr0=length(xz);
  float st=texture2D(tNoise2,vec2(atan(xz.y,xz.x)*35.65+rr0/900.0+uTime*0.004,(rr0+(n1-0.5)*520.0)/52.0)).b;
  foam=max(foam,smoothstep(0.52,0.74,st)*smoothstep(0.40,0.66,n2*0.5+n3*0.6)*sat(sc.x*2.2-0.8)*0.7*(1.0-sat(dist/6000.0)));
  foam*=mix(1.0,0.4,sat(dist/7000.0))*(1.0-hbm);
  col=mix(col,vec3(0.78,0.82,0.84)*(E+0.02),foam*0.92);
  gl_FragColor=vec4(col,1.0);
}`});
  ocean=new THREE.Mesh(g,m);ocean.frustumCulled=false;scene.add(ocean);
}

// ───────────────────────── テクスチャ小物 ─────────────────────────
function glowTexture(){
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);
}
let GLOWTEX,envRT;
function buildEnv(){
  const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,128);
  g.addColorStop(0,'#5f86bd');g.addColorStop(.42,'#b9cde0');g.addColorStop(.5,'#dfe7ee');g.addColorStop(.52,'#3d566b');g.addColorStop(1,'#101c28');
  x.fillStyle=g;x.fillRect(0,0,256,128);
  const s=x.createRadialGradient(170,34,0,170,34,40);s.addColorStop(0,'rgba(255,250,235,1)');s.addColorStop(1,'rgba(255,250,235,0)');x.fillStyle=s;x.fillRect(0,0,256,128);
  const t=new THREE.CanvasTexture(c);t.mapping=THREE.EquirectangularReflectionMapping;t.encoding=THREE.sRGBEncoding;
  const pm=new THREE.PMREMGenerator(renderer);envRT=pm.fromEquirectangular(t);scene.environment=envRT.texture;pm.dispose();t.dispose();
}

// ───────────────────────── 機体 ─────────────────────────
const ENVMATS=[];
function std(o){const m=new THREE.MeshStandardMaterial(o);ENVMATS.push(m);return m;}
// wx：排気の煤の中心（エンジン軸の位置。機体座標）
function panelize(m,wx){m.onBeforeCompile=sh=>{
  sh.uniforms.uEng={value:wx||new V3(2.55,1.57,6.3)};
  sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nvarying vec3 vOP;\nvarying vec3 vON;").replace("#include <begin_vertex>","#include <begin_vertex>\nvOP=position;vON=normal;");
  sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nvarying vec3 vOP;\nvarying vec3 vON;\nuniform vec3 uEng;\nfloat pl(float x,float w){float f=abs(fract(x)-0.5);return smoothstep(0.5-w,0.5-w*0.3,f);}\nfloat hsh(vec3 p){return fract(sin(dot(floor(p),vec3(12.9898,78.233,37.719)))*43758.5453);}\nfloat vn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hsh(i),hsh(i+vec3(1,0,0)),f.x),mix(hsh(i+vec3(0,1,0)),hsh(i+vec3(1,1,0)),f.x),f.y),mix(mix(hsh(i+vec3(0,0,1)),hsh(i+vec3(1,0,1)),f.x),mix(hsh(i+vec3(0,1,1)),hsh(i+vec3(1,1,1)),f.x),f.y),f.z);}")
    .replace("#include <color_fragment>","#include <color_fragment>\nfloat pln=max(pl(vOP.z/1.9,0.016),max(pl(vOP.x/1.55+0.5,0.02),pl(vOP.y/1.1,0.026)*0.5));\nfloat ptn=hsh(vec3(vOP.x/1.55+0.5,vOP.y/1.1,vOP.z/1.9));\nfloat pst=fract(sin(floor(vOP.x*7.0)*91.7)*4375.5);\nfloat aoc=1.0-0.30*(1.0-smoothstep(1.2,3.4,abs(vOP.x)))*smoothstep(1.1,-0.5,vOP.y)*smoothstep(-9.0,-4.0,vOP.z)-0.18*(1.0-smoothstep(1.7,2.6,abs(vOP.x)))*smoothstep(0.1,0.9,vOP.y)*smoothstep(-3.5,-1.0,vOP.z)*(1.0-smoothstep(4.5,8.0,vOP.z));\ndiffuseColor.rgb*=aoc*(0.96+0.06*ptn)*(1.0-0.38*pln)*(1.0-0.15*smoothstep(0.55,1.0,pst)*smoothstep(-2.0,9.0,vOP.z));\nfloat gr=vn(vOP*vec3(1.1,1.1,0.3))*0.6+vn(vOP*vec3(3.1,3.1,0.9)+7.0)*0.4;\nfloat stv=vn(vec3(vOP.z*2.6,vOP.y*0.22,3.0+step(0.0,vOP.x)));\nfloat sd=length(vec2(abs(vOP.x)-uEng.x,vOP.y-uEng.y));\nfloat soot=smoothstep(uEng.z+1.0,uEng.z+4.2,vOP.z)*(1.0-smoothstep(0.6,2.9,sd));\ndiffuseColor.rgb*=(1.0-0.42*smoothstep(0.38,0.72,gr))*(1.0-0.34*smoothstep(0.52,0.8,stv)*smoothstep(1.4,-1.6,vOP.y)*smoothstep(0.8,0.35,abs(normalize(vON).y)))*(1.0-0.22*smoothstep(0.55,0.85,vn(vec3(vOP.x*3.2,5.0,vOP.z*0.22)))*smoothstep(0.7,0.95,abs(normalize(vON).y)));\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.015,0.014,0.013),0.92*soot*(0.6+0.4*gr));")
    .replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(ptn-0.5)*0.2+pln*0.3+smoothstep(0.38,0.72,gr)*0.3+soot*0.4,0.05,1.0);");
};return m;}
function loft(secs){
  const n=secs[0].length,pos=[],idx=[];
  secs.forEach(s=>s.forEach(p=>pos.push(p.x,p.y,p.z)));
  for(let i=0;i<secs.length-1;i++)for(let j=0;j<n;j++){const a=i*n+j,b=i*n+(j+1)%n,c=a+n,d=b+n;idx.push(a,c,b,b,c,d);}
  const last=(secs.length-1)*n;for(let j=1;j<n-1;j++){idx.push(0,j,j+1);idx.push(last,last+j+1,last+j);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
// 翼断面：origin=前縁、chord は +z 方向、厚みは up 方向
function foil(o,chord,thick,up,n){
  n=n||18;const a=[];
  for(let k=0;k<n;k++){const t=k/n*Math.PI*2,c=0.5-0.5*Math.cos(t),y=thick*chord*0.5*Math.sin(t)*(1-0.62*c)*1.5;
    a.push(new V3(o.x+up.x*y,o.y+up.y*y,o.z+chord*c+up.z*y));}
  return a;
}
function latheZ(pts,seg){
  const c=new THREE.SplineCurve(pts.map(p=>new THREE.Vector2(p[1],p[0])));
  const g=new THREE.LatheGeometry(c.getPoints(44),seg||28);g.rotateX(Math.PI/2);return g;
}
// 装甲板が剥がれた跡の下地。防錆塗装の骨組み（縦通材とフレーム、鋲）、肉抜き穴、配線と配管、焦げ、裂けた縁。
// 色・発光・凹凸の 3 枚を同じ配置で描く。v は絵柄の種類
const SCART={};
function scarTex(v){if(SCART[v])return SCART[v];let sd=1234+v*977;const R=()=>{sd=(sd*1664525+1013904223)>>>0;return sd/4294967296;};
  const mk=()=>{const c=document.createElement('canvas');c.width=c.height=256;return c;},cc=mk(),ce=mk(),cb=mk(),x=cc.getContext('2d'),e=ce.getContext('2d'),b=cb.getContext('2d');
  // 裂けた輪郭（ぎざぎざの多角形）
  const pts=[];for(let k=0;k<44;k++){const a=k/44*Math.PI*2,sq=Math.max(Math.abs(Math.cos(a)),Math.abs(Math.sin(a))),r=(104+R()*18-(k%5===0?R()*22:0))/sq*.92;pts.push([128+Math.cos(a)*Math.min(r,122),128+Math.sin(a)*Math.min(r,122)]);}
  const path=c=>{c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();};
  e.fillStyle='#000';e.fillRect(0,0,256,256);b.fillStyle='#808080';b.fillRect(0,0,256,256);
  x.save();path(x);x.clip();b.save();path(b);b.clip();
  // 下地：防錆塗装（黄緑）にむら
  x.fillStyle='#4b5330';x.fillRect(0,0,256,256);b.fillStyle='#585858';b.fillRect(0,0,256,256);
  for(let k=0;k<260;k++){x.fillStyle='rgba('+(R()<.5?'40,46,20':'150,160,90')+','+(.05+R()*.08)+')';x.beginPath();x.arc(R()*256,R()*256,3+R()*14,0,7);x.fill();}
  // 奥の暗がり（外板の内側の空間）と肉抜き穴
  const holes=[];for(let iy=0;iy<3;iy++)for(let ix=0;ix<4;ix++){if(R()<.3)continue;holes.push([32+ix*64,44+iy*84,15+R()*5,22+R()*6]);}
  for(const[hx,hy,rx,ry]of holes){x.fillStyle='#07090b';x.beginPath();x.ellipse(hx,hy,rx,ry,0,0,7);x.fill();x.strokeStyle='#aeb69a';x.lineWidth=2;x.beginPath();x.ellipse(hx,hy,rx+1.5,ry+1.5,0,0,7);x.stroke();
    b.fillStyle='#101010';b.beginPath();b.ellipse(hx,hy,rx,ry,0,0,7);b.fill();b.strokeStyle='#b0b0b0';b.lineWidth=3;b.beginPath();b.ellipse(hx,hy,rx+2,ry+2,0,0,7);b.stroke();}
  // フレーム（縦）と縦通材（横）：明るい金属の帯、下に影、鋲
  const beam=(X,Y,W,H)=>{x.fillStyle='#6d7548';x.fillRect(X,Y,W,H);x.fillStyle='rgba(255,255,230,.28)';x.fillRect(X,Y,W>H?W:2,W>H?2:H);x.fillStyle='rgba(0,0,0,.45)';x.fillRect(W>H?X:X+W,W>H?Y+H:Y,W>H?W:3,W>H?3:H);
    b.fillStyle='#e0e0e0';b.fillRect(X,Y,W,H);b.fillStyle='#303030';b.fillRect(W>H?X:X+W,W>H?Y+H:Y,W>H?W:3,W>H?3:H);};
  for(let i=0;i<5;i++)beam(-2+i*64,0,9,256);for(let j=0;j<4;j++)beam(0,2+j*84,256,7);
  for(let i=0;i<5;i++)for(let k=0;k<22;k++){x.fillStyle='#3d4420';x.beginPath();x.arc(2.5+i*64,6+k*12,1.3,0,7);x.fill();b.fillStyle='#f5f5f5';b.beginPath();b.arc(2.5+i*64,6+k*12,1.6,0,7);b.fill();}
  for(let j=0;j<4;j++)for(let k=0;k<22;k++){x.fillStyle='#3d4420';x.beginPath();x.arc(6+k*12,5.5+j*84,1.3,0,7);x.fill();}
  // 配管（銀）と配線の束（赤・黄・青）。1 本は途中でちぎれて火花
  const wire=(col,y0,amp,w,cutAt)=>{x.strokeStyle=col;x.lineWidth=w;x.lineCap='round';x.beginPath();let lx=0,ly=0;for(let X=0;X<=(cutAt||256);X+=8){const Y=y0+Math.sin(X*.03+y0)*amp+X*.12;X?x.lineTo(X,Y):x.moveTo(X,Y);lx=X;ly=Y;}x.stroke();
    b.strokeStyle='#c8c8c8';b.lineWidth=w;b.beginPath();for(let X=0;X<=(cutAt||256);X+=8){const Y=y0+Math.sin(X*.03+y0)*amp+X*.12;X?b.lineTo(X,Y):b.moveTo(X,Y);}b.stroke();return[lx,ly];};
  x.shadowColor='rgba(0,0,0,.6)';x.shadowBlur=3;x.shadowOffsetY=2;
  wire('#b9bec2',70+R()*30,5,4.5);wire('#a3261c',118+R()*20,9,2.4);wire('#c9a01c',124+R()*20,8,2.4);const cut=wire('#2a55a8',132+R()*20,10,2.4,120+R()*60);
  x.shadowColor='transparent';
  for(let k=0;k<6;k++){const X=20+k*44;x.fillStyle='#22262a';x.fillRect(X,112,5,34);} // 束線バンド
  // 焦げ：縁に向かって黒く、ところどころ煤の染み
  const g=x.createRadialGradient(128,128,30,128,128,150);g.addColorStop(0,'rgba(0,0,0,.12)');g.addColorStop(.4,'rgba(0,0,0,.4)');g.addColorStop(.72,'rgba(0,0,0,.9)');g.addColorStop(1,'rgba(0,0,0,.97)');x.fillStyle=g;x.fillRect(0,0,256,256);
  for(let k=0;k<22;k++){const X=R()*256,Y=R()*256,r=10+R()*30,gg=x.createRadialGradient(X,Y,0,X,Y,r);gg.addColorStop(0,'rgba(0,0,0,.6)');gg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gg;x.fillRect(X-r,Y-r,r*2,r*2);}
  x.restore();b.restore();
  // 裂けた縁：めくれた外板の地金（明るい線）と、その内側の焦げ
  path(x);x.strokeStyle='rgba(6,6,6,.96)';x.lineWidth=12;x.stroke();path(x);x.strokeStyle='#d5d9dc';x.lineWidth=2.5;x.stroke();path(b);b.strokeStyle='#ffffff';b.lineWidth=4;b.stroke();
  // 発光：ちぎれた配線の火花、縁の残り火、穴の奥の赤い非常灯
  const glow=(X,Y,r,col)=>{const gg=e.createRadialGradient(X,Y,0,X,Y,r);gg.addColorStop(0,col);gg.addColorStop(1,'rgba(0,0,0,0)');e.fillStyle=gg;e.fillRect(X-r,Y-r,r*2,r*2);};
  glow(cut[0],cut[1],16,'rgba(190,220,255,1)');glow(cut[0],cut[1],5,'#fff');
  for(let k=0;k<26;k++){const p=pts[Math.floor(R()*pts.length)],t=.86+R()*.1;glow(128+(p[0]-128)*t,128+(p[1]-128)*t,3+R()*6,'rgba(255,120,30,.95)');}
  if(holes.length){const h=holes[Math.floor(R()*holes.length)];glow(h[0],h[1],h[3],'rgba(200,30,20,.7)');}
  // 輪郭の外は透明にする（alphaTest 用）
  x.globalCompositeOperation='destination-in';x.lineJoin='round';path(x);x.fillStyle='#fff';x.lineWidth=5;x.strokeStyle='#fff';x.fill();x.globalCompositeOperation='source-over';
  const T=c=>{const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t;},map=T(cc);map.encoding=THREE.sRGBEncoding;
  return SCART[v]={map,em:T(ce),bump:T(cb)};}
// 計器盤の画面：気象レーダー・姿勢指示・エンジン計器の 3 面と、下段のスイッチ・警告灯
let MFDT=null,CONT=null,HUDT=null;
function mfdTex(){if(MFDT)return MFDT;const c=document.createElement('canvas');c.width=512;c.height=192;const x=c.getContext('2d');
  x.fillStyle='#0b0d10';x.fillRect(0,0,512,192);x.font='9px monospace';x.textBaseline='top';
  const bez=(X,Y,W,H)=>{x.fillStyle='#1b2026';x.fillRect(X-4,Y-4,W+8,H+8);x.fillStyle='#020605';x.fillRect(X,Y,W,H);for(let k=0;k<5;k++){x.fillStyle='#3a424a';x.fillRect(X+8+k*((W-22)/4),Y+H+1,6,2);x.fillRect(X+8+k*((W-22)/4),Y-3,6,2);}};
  // 左：気象レーダー（渦を巻く雨雲、距離環、自機）
  bez(12,12,152,124);x.save();x.beginPath();x.rect(12,12,152,124);x.clip();
  x.strokeStyle='#0f3a2a';x.lineWidth=1;for(let r=22;r<130;r+=22){x.beginPath();x.arc(88,128,r,Math.PI,2*Math.PI);x.stroke();}
  for(let a=0;a<5;a++){x.beginPath();x.moveTo(88,128);x.lineTo(88+Math.cos(Math.PI*(1+a/4))*130,128+Math.sin(Math.PI*(1+a/4))*130);x.stroke();}
  for(const[col,w,off]of[['#1fa85a',9,0],['#d9c12a',5,.25],['#e0452a',2.5,.4]]){x.strokeStyle=col;x.lineWidth=w;for(let arm=0;arm<3;arm++){x.beginPath();for(let t=off;t<3.6;t+=.1){const r=6+t*13,an=t*1.5+arm*2.094,px=92+Math.cos(an)*r,py=60+Math.sin(an)*r*.8;t===off?x.moveTo(px,py):x.lineTo(px,py);}x.stroke();}}
  x.fillStyle='#020605';x.beginPath();x.arc(92,60,5,0,7);x.fill();x.fillStyle='#9fffd0';x.beginPath();x.moveTo(88,122);x.lineTo(84,132);x.lineTo(92,132);x.fill();
  x.restore();x.fillStyle='#35e0a0';x.fillText('WX RDR 40NM',16,15);x.fillText('TILT +2',118,15);
  // 中：姿勢指示（傾いた水平線、ピッチ目盛、速度・高度の帯）
  bez(180,12,152,124);x.save();x.beginPath();x.rect(180,12,152,124);x.clip();x.translate(256,74);x.rotate(-.14);
  x.fillStyle='#1d5f9a';x.fillRect(-140,-140,280,146);x.fillStyle='#6a4520';x.fillRect(-140,6,280,140);x.strokeStyle='#fff';x.lineWidth=1.5;x.beginPath();x.moveTo(-140,6);x.lineTo(140,6);x.stroke();
  x.lineWidth=1;for(let k=-3;k<=3;k++){if(!k)continue;const w=k%2?12:22;x.beginPath();x.moveTo(-w,6-k*13);x.lineTo(w,6-k*13);x.stroke();}
  x.restore();x.strokeStyle='#ffd23a';x.lineWidth=2.5;x.beginPath();x.moveTo(226,76);x.lineTo(246,76);x.lineTo(256,84);x.lineTo(266,76);x.lineTo(286,76);x.stroke();
  x.fillStyle='rgba(0,0,0,.55)';x.fillRect(182,30,22,88);x.fillRect(308,30,22,88);x.fillStyle='#fff';for(let k=0;k<6;k++){x.fillRect(200,34+k*16,4,1);x.fillRect(308,34+k*16,4,1);}x.fillText('292',184,68);x.fillText('3.2',310,68);x.fillStyle='#35e0a0';x.fillText('HDG 000',236,15);
  // 右：エンジン（回転計 2 つ、温度と燃料の棒）
  bez(348,12,152,124);for(let e=0;e<2;e++){const cx=386+e*76,cy=52;x.strokeStyle='#27313a';x.lineWidth=5;x.beginPath();x.arc(cx,cy,24,.75*Math.PI,2.25*Math.PI);x.stroke();
    x.strokeStyle='#35e0a0';x.beginPath();x.arc(cx,cy,24,.75*Math.PI,(1.86+e*.05)*Math.PI);x.stroke();x.strokeStyle='#e0452a';x.beginPath();x.arc(cx,cy,24,2.12*Math.PI,2.25*Math.PI);x.stroke();
    x.strokeStyle='#fff';x.lineWidth=1.5;x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+Math.cos((1.86+e*.05)*Math.PI)*20,cy+Math.sin((1.86+e*.05)*Math.PI)*20);x.stroke();x.fillStyle='#cfe';x.fillText(e?'N1 89':'N1 87',cx-15,cy+12);}
  for(let k=0;k<6;k++){const h=[30,28,34,22,36,35][k];x.fillStyle='#16202a';x.fillRect(358+k*23,92,12,38);x.fillStyle=k===3?'#ffb020':'#35e0a0';x.fillRect(358+k*23,130-h,12,h);}
  // 下段：予備計器、スイッチ列、警告灯
  x.fillStyle='#14181c';x.fillRect(8,150,496,36);x.strokeStyle='#cfd8dc';x.lineWidth=1.5;x.beginPath();x.arc(30,168,13,0,7);x.stroke();x.beginPath();x.moveTo(30,168);x.lineTo(38,160);x.stroke();
  for(let k=0;k<22;k++){x.fillStyle='#2b333b';x.fillRect(56+k*17,156,11,11);x.fillStyle=['#35e0a0','#1b2228','#1b2228','#ffb020','#1b2228','#39c8ff'][k%6];x.fillRect(58+k*17,158,7,4);x.fillStyle='#59636c';x.fillRect(59+k*17,172,5,9);}
  for(let k=0;k<3;k++){x.fillStyle=['#e0452a','#ffb020','#ffb020'][k];x.fillRect(436+k*22,156,18,10);x.fillStyle='#35e0a0';x.fillRect(436+k*22,171,18,10);}
  MFDT=new THREE.CanvasTexture(c);MFDT.anisotropy=4;return MFDT;}
// 側方の操作盤（スイッチ・つまみ・表示灯の列）
function consoleTex(){if(CONT)return CONT;const c=document.createElement('canvas');c.width=64;c.height=256;const x=c.getContext('2d');x.fillStyle='#101418';x.fillRect(0,0,64,256);
  for(let r=0;r<11;r++){const y=6+r*23;x.strokeStyle='#262e35';x.strokeRect(3.5,y-2.5,57,20);
    if(r%3===1){for(let k=0;k<2;k++){x.fillStyle='#2e363d';x.beginPath();x.arc(18+k*28,y+8,7,0,7);x.fill();x.strokeStyle='#cfd8dc';x.beginPath();x.moveTo(18+k*28,y+8);x.lineTo(18+k*28+4,y+3);x.stroke();}}
    else for(let k=0;k<4;k++){x.fillStyle='#59636c';x.fillRect(8+k*13,y+7,6,9);x.fillStyle=['#35e0a0','#17202a','#ffb020','#17202a','#39c8ff','#e0452a','#17202a'][(r*3+k)%7];x.fillRect(8+k*13,y,6,4);}}
  CONT=new THREE.CanvasTexture(c);return CONT;}
// HUD の表示（ピッチ目盛、進路記号、方位の帯）
function hudTex(){if(HUDT)return HUDT;const c=document.createElement('canvas');c.width=128;c.height=96;const x=c.getContext('2d');x.strokeStyle='#5dffa0';x.fillStyle='#5dffa0';x.lineWidth=1.6;
  for(let k=-2;k<=2;k++){if(!k)continue;x.beginPath();x.moveTo(34,48-k*15);x.lineTo(52,48-k*15);x.moveTo(76,48-k*15);x.lineTo(94,48-k*15);x.stroke();}
  x.beginPath();x.arc(64,50,5,0,7);x.moveTo(52,50);x.lineTo(59,50);x.moveTo(69,50);x.lineTo(76,50);x.moveTo(64,45);x.lineTo(64,40);x.stroke();
  x.beginPath();x.moveTo(20,10);x.lineTo(108,10);for(let k=0;k<8;k++){x.moveTo(24+k*12,10);x.lineTo(24+k*12,k%2?14:17);}x.stroke();x.strokeRect(6,40,20,14);x.strokeRect(102,40,20,14);
  HUDT=new THREE.CanvasTexture(c);return HUDT;}
// 射出座席と操縦士。p の座標で、床が y=0、機首が -z。頭と操縦桿は動かせるように返す
function crewSeat(p,x,z,suit){
  const dk=std({color:lin(0x15181b),roughness:.7,metalness:.3}),pad=std({color:lin(0x343b33),roughness:.95,metalness:0}),st=std({color:lin(suit),roughness:.85,metalness:0}),hm=std({color:lin(0xe4e7ea),roughness:.28,metalness:.2}),
    vz=std({color:lin(0x0a0d12),roughness:.06,metalness:.95}),yl=std({color:lin(0xd9a21b),roughness:.6,metalness:.1}),web=std({color:lin(0x8a8f94),roughness:.9,metalness:0}),
    vest=std({color:lin(0x8a5a22),roughness:.9,metalness:0}),mt=std({color:lin(0x9aa0a6),roughness:.35,metalness:.9}),red=std({color:lin(0xb3261c),roughness:.6,metalness:.1});
  const A=(geo,m,px,py,pz,rx)=>{const o=new THREE.Mesh(geo,m);o.position.set(x+px,py,z+pz);if(rx)o.rotation.x=rx;p.add(o);return o;};
  const limb=(a,b,r,m)=>{const d=new V3().subVectors(b,a),o=new THREE.Mesh(new THREE.CylinderGeometry(r,r*.85,d.length(),10),m);o.position.set(x,0,z).add(a).addScaledVector(d,.5);o.quaternion.setFromUnitVectors(new V3(0,1,0),d.normalize());p.add(o);};
  // 座席：座面と背もたれ（枠＋クッション）、頭当て、レール、頭上の傘収納、射出ハンドル 2 つ
  A(new THREE.BoxGeometry(.5,.14,.5),dk,0,-.01,.32);A(new THREE.BoxGeometry(.42,.05,.4),pad,0,.075,.3);
  A(new THREE.BoxGeometry(.48,.74,.09),dk,0,.2,.62,.2);A(new THREE.BoxGeometry(.38,.5,.05),pad,0,.2,.565,.2);
  for(const s of[1,-1]){A(new THREE.BoxGeometry(.05,.8,.07),mt,s*.27,.2,.7,.2);A(new THREE.BoxGeometry(.06,.3,.2),dk,s*.25,.14,.47,.2);}
  A(new THREE.BoxGeometry(.3,.2,.13),dk,0,.52,.73);A(new THREE.BoxGeometry(.22,.14,.03),pad,0,.52,.66);
  A(new THREE.BoxGeometry(.34,.13,.2),dk,0,.44,.86);A(new THREE.BoxGeometry(.2,.02,.12),red,0,.51,.86);
  const eh=A(new THREE.TorusGeometry(.055,.014,6,14),yl,0,.13,.08);eh.rotation.x=Math.PI/2;
  // 操縦士：胴、救命胴衣、肩、首、ハーネス、両腕と手袋、太ももと脛と靴
  A(new THREE.BoxGeometry(.42,.44,.24),st,0,.27,.47,.12);A(new THREE.BoxGeometry(.34,.26,.05),vest,0,.3,.345,.12);
  A(new THREE.CylinderGeometry(.07,.08,.1,10),st,0,.5,.47);
  for(const s of[1,-1]){A(new THREE.SphereGeometry(.13,12,10),st,s*.22,.44,.48);A(new THREE.BoxGeometry(.05,.4,.02),web,s*.09,.31,.315,.12);A(new THREE.BoxGeometry(.06,.05,.03),mt,s*.09,.2,.3);
    limb(new V3(s*.25,.42,.45),new V3(s*.35,.2,.22),.06,st);
    const hand=s>0?new V3(.03,.3,-.04):new V3(-.42,.27,-.08);limb(new V3(s*.35,.2,.22),hand,.05,st);A(new THREE.SphereGeometry(.052,10,8),dk,hand.x,hand.y,hand.z);
    limb(new V3(s*.11,.13,.34),new V3(s*.16,.24,-.14),.078,st);limb(new V3(s*.16,.24,-.14),new V3(s*.16,.1,-.58),.058,st);A(new THREE.BoxGeometry(.1,.08,.2),dk,s*.16,.08,-.64);}
  // 頭：ヘルメット、帯、耳当て、バイザー、酸素マスク
  const head=new THREE.Group();head.position.set(x,.63,z+.45);p.add(head);
  const H=(geo,m,px,py,pz)=>{const o=new THREE.Mesh(geo,m);o.position.set(px,py,pz);head.add(o);return o;};
  H(new THREE.SphereGeometry(.19,20,16),hm,0,0,0);const sp=H(new THREE.TorusGeometry(.19,.012,6,24),red,0,0,0);sp.rotation.y=Math.PI/2;
  for(const s of[1,-1]){const e=H(new THREE.CylinderGeometry(.07,.07,.04,12),dk,s*.185,-.02,.0);e.rotation.z=Math.PI/2;}
  const v=H(new THREE.SphereGeometry(.165,18,12),vz,0,.005,-.055);v.scale.set(1.08,.72,1);
  const mk=H(new THREE.CylinderGeometry(.055,.07,.1,10),dk,0,-.09,-.16);mk.rotation.x=Math.PI/2;
  limb(new V3(.03,.5,.28),new V3(.12,.3,.33),.022,dk);
  {const kb=A(new THREE.BoxGeometry(.11,.012,.15),std({color:lin(0xe8e6dc),roughness:.9,metalness:0}),.15,.315,.05);kb.rotation.x=-.2;A(new THREE.BoxGeometry(.11,.016,.02),dk,.15,.325,.115).rotation.x=-.2;
    for(const sd of[1,-1])A(new THREE.BoxGeometry(.11,.14,.03),mt,sd*.16,.14,-.75,.5);A(new THREE.BoxGeometry(.5,.04,.04),dk,0,.1,-.76);}
  // 操縦桿（付け根を軸に動く）
  const stick=new THREE.Group();stick.position.set(x+.03,.09,z-.04);p.add(stick);
  const s1=new THREE.Mesh(new THREE.CylinderGeometry(.022,.03,.24,8),dk);s1.position.y=.1;stick.add(s1);const s2=new THREE.Mesh(new THREE.BoxGeometry(.05,.1,.06),dk);s2.position.y=.22;stick.add(s2);
  return{head,stick};
}
// 計器盤（覆いと画面）を p に置く。w は幅
function instrPanel(p,w,y,z){
  const dk=std({color:lin(0x101316),roughness:.8,metalness:.2});
  const hood=new THREE.Mesh(new THREE.BoxGeometry(w,.4,.5),dk);hood.position.set(0,y,z);p.add(hood);
  const lip=new THREE.Mesh(new THREE.BoxGeometry(w*1.04,.035,.66),dk);lip.position.set(0,y+.215,z+.06);p.add(lip);
  const face=new THREE.Mesh(new THREE.PlaneGeometry(w*.96,.36),new THREE.MeshBasicMaterial({map:mfdTex(),color:new THREE.Color(1.5,1.5,1.5)}));face.position.set(0,y,z+.257);face.rotation.x=-.08;face.castShadow=false;p.add(face);
  const cmp=new THREE.Mesh(new THREE.BoxGeometry(.1,.07,.08),dk);cmp.position.set(w*.36,y+.26,z+.1);p.add(cmp);
}
// 操作盤の上面に貼る板
function consoleTop(p,w,l,x,y,z){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,l),new THREE.MeshBasicMaterial({map:consoleTex(),color:new THREE.Color(1.2,1.2,1.2)}));m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.castShadow=false;p.add(m);return m;}
// 2 点をつなぐ翼断面の支柱（厚みは支柱の向きに直交）
function strutFoil(p0,p1,chord,thick){const d=p1.clone().sub(p0);d.z=0;const n=new V3(-d.y,d.x,0).normalize();
  return loft([foil(new V3(p0.x,p0.y,p0.z-chord/2),chord,thick,n),foil(new V3(p1.x,p1.y,p1.z-chord*.45),chord*.9,thick,n)]);}
const WETM=[];
// 塗装（胴体・腹・差し色）
const SCHEMES=[{name:'標準',body:0x98a1a9,belly:0x48515a,acc:0xe8641b},{name:'海洋',body:0x2b4a70,belly:0x1b2d44,acc:0xe6bd74},{name:'白銀',body:0xdadee1,belly:0x8a9299,acc:0x1f8f96},
  {name:'警戒',body:0xd6a01b,belly:0x2a2c2f,acc:0x1a1c1f},{name:'漆黒',body:0x2b2f34,belly:0x17191c,acc:0xc2261c},{name:'銅',body:0xb4673a,belly:0x56392a,acc:0xe4dabf},{name:'原型',body:0xc6cace,belly:0xc4702a,acc:0x7ea4cc}];
// 形：主翼の断面位置 [x, y, 前縁 z, 翼弦, 厚み比] を付け根・中間・翼端の順に
const SHAPES=[{name:'後退翼',eng:[0,.32,0,1],st:[[1.1,.15,-2.9,7.8,.12],[6.2,.3,.1,4.8,.105],[12.4,.62,3.5,2.3,.09]],winglet:true,tail:'v'},
  {name:'デルタ翼',eng:[0,.32,0,1],st:[[1.1,.1,-5.4,11.4,.085],[6.0,.24,-.2,6.0,.075],[11.6,.42,4.5,1.6,.065]],winglet:false,tail:'fin',canard:true},
  {name:'前進翼',eng:[0,.32,0,1],st:[[1.1,.15,-.1,6.6,.12],[6.2,.32,-1.2,4.4,.105],[12.2,.66,-2.8,2.4,.09]],winglet:true,tail:'twin'},
  // 全翼機：幅広の胴体と主翼がつながり、尾翼を持たない。エンジンは背中に半分埋まる
  {name:'全翼機',fus:1.6,st:[[1.7,.2,-6.6,14.6,.1],[6.6,.3,1.0,6.2,.09],[13.6,.5,6.3,2.2,.08]],winglet:true,tail:'none',eng:[-.7,1.08,1.3,1],saddle:true},
  // 連結翼：垂直尾翼の上から前へ伸びる後ろの翼が、主翼の端とつながる
  {name:'結合翼',eng:[0,.32,0,1],st:[[1.1,-.3,-4.6,5.2,.11],[6,-.05,-.6,3.6,.1],[11.6,.25,3.5,2.2,.09]],winglet:false,tail:'join'},
  // 逆ガル翼：翼が一度下がってから上がる。脚は折れ目に付く
  {name:'逆ガル翼',eng:[0,.32,0,1],st:[[1.1,.9,-2.6,7.0,.12],[5.0,-.75,-.9,5.0,.11],[12.6,1.5,2.6,2.2,.09]],winglet:false,tail:'h',gear:[4.6,-.6],fil:.15},
  // 原型機：丸い風防の胴体、背中の支柱に載る長い直線翼、両脇のエンジン、腹下の左右のフロート
  {name:'原型機',orig:true,st:[[0,3.3,-4.2,4.6,.12],[6.5,3.42,-3.9,4.0,.11],[13,3.55,-3.3,3.0,.1]],winglet:false,tail:'orig',eng:[.76,-1.65,-6.9,.72],gear:[2.75,-2.2]}];
function buildAircraft(accentHex,label,shapeI,scheme){
  const SH=SHAPES[shapeI||0],ST=SH.st;scheme=scheme||{body:0x98a1a9,belly:0x48515a,acc:accentHex};accentHex=scheme.acc;
  const g=new THREE.Group(),ud=g.userData;
  const EO=SH.eng||[0,0,0,1],WX=new V3(2.55+EO[0],1.25+EO[1],6.3+EO[2]+4*((EO[3]||1)-1));ud.wx=WX;
  const body=panelize(std({color:lin(scheme.body),metalness:.62,roughness:.42,side:THREE.DoubleSide}),WX);
  const belly=panelize(std({color:lin(scheme.belly),metalness:.6,roughness:.5,side:THREE.DoubleSide}),WX);
  const dark=std({color:lin(0x1b2026),metalness:.7,roughness:.42,side:THREE.DoubleSide});
  const acc=panelize(std({color:lin(accentHex),metalness:.3,roughness:.5,side:THREE.DoubleSide}),WX);
  for(const m of[body,belly,acc]){m.userData.r0=m.roughness;m.userData.c0=m.color.clone();WETM.push(m);}
  ud.wetMats=[body,belly,acc];ud.shape=SH;ud.bodyHex=scheme.body;
  // 翼幅位置 ax での断面（y・前縁・翼弦・厚み）
  ud.wingAt=ax=>{const i=ax<ST[1][0]?0:1,a=ST[i],b=ST[i+1],t=clamp((ax-a[0])/(b[0]-a[0]),0,1);return{y:lerp(a[1],b[1],t),le:lerp(a[2],b[2],t),c:lerp(a[3],b[3],t),th:lerp(a[4],b[4],t)};};
  const glass=std({color:lin(0x0b141c),metalness:.95,roughness:.06});glass.envMapIntensity=1.8;
  const UP=new V3(0,1,0);
  // 胴体
  const FW=SH.fus||1,XA=new V3(1,0,0);
  if(SH.orig){
    const fus=new THREE.Mesh(latheZ(ORIG_PTS),body);fus.scale.set(1,.86,1);g.add(fus);
    const keel=new THREE.Mesh(latheZ([[-10.2,.02],[-8,1.9],[-4,2.3],[0,1.75],[3,.85],[4.7,.02]],22),belly);keel.scale.set(.96,.43,1);keel.position.y=-1.25;g.add(keel);
    const can=new THREE.Mesh(new THREE.SphereGeometry(2.36,30,20),glass);can.scale.set(1,.84,1.5);can.position.set(0,-.02,-10.2);g.add(can);ud.canopy=can;
    // 風防の枠（縦横と斜め）
    const fg=new THREE.Group();fg.position.copy(can.position);fg.scale.copy(can.scale);g.add(fg);
    const qx=new THREE.Quaternion().setFromAxisAngle(XA,-Math.PI/2);
    for(const a of[0,Math.PI/2,Math.PI/4,-Math.PI/4]){const t=new THREE.Mesh(new THREE.TorusGeometry(2.39,.055,6,26,Math.PI),dark);t.quaternion.setFromAxisAngle(new V3(0,0,1),a).multiply(qx);fg.add(t);}
    const rim=new THREE.Mesh(new THREE.TorusGeometry(2.4,.1,6,30),dark);rim.scale.set(1,.85,1);rim.position.set(0,-.02,-10.05);g.add(rim);
    const rim2=new THREE.Mesh(new THREE.TorusGeometry(1.86,.06,6,26),dark);rim2.scale.set(1,.84,1);rim2.position.set(0,-.02,-12.4);g.add(rim2);
    // 胴体の輪（外板の継ぎ目）
    for(const[z,r]of[[-8.2,2.56],[-6.2,2.64],[-4.2,2.6],[-2.2,2.4]]){const rb=new THREE.Mesh(new THREE.TorusGeometry(r,.05,6,30),body);rb.scale.set(1,.86,1);rb.position.z=z;g.add(rb);}
    // 主翼を載せる流線形の支柱と、翼の上の丸い覆い
    g.add(new THREE.Mesh(loft([foil(new V3(0,1.5,-4.9),6.0,.3,XA),foil(new V3(0,2.6,-4.6),5.2,.24,XA),foil(new V3(0,3.3,-4.3),4.8,.2,XA)]),body));
    const dome=new THREE.Mesh(new THREE.SphereGeometry(1,22,12),acc);dome.scale.set(.95,.42,1.9);dome.position.set(0,3.6,-1.9);g.add(dome);
    // 側面の丸窓：実際の胴体表面に光線を当てて位置と向きを決める（装甲板の下端より下に並べる）
    {fus.updateMatrixWorld(true);const rc=new THREE.Raycaster(),nm=new THREE.Matrix3().getNormalMatrix(fus.matrixWorld);
      for(const s of[1,-1])for(let k=0;k<5;k++){const z=-8.0+k*1.3,wy=.2;rc.set(new V3(s*6,wy,z),new V3(-s,0,0));const h=rc.intersectObject(fus)[0];if(!h)continue;
        const n=h.face.normal.clone().applyMatrix3(nm).normalize();if(n.x*s<0)n.negate();const q=new THREE.Quaternion().setFromUnitVectors(new V3(0,1,0),n);
        const fr=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.1,18),body);fr.position.copy(h.point).addScaledVector(n,.01);fr.quaternion.copy(q);g.add(fr);
        const wn=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,.1,18),glass);wn.position.copy(h.point).addScaledVector(n,.03);wn.quaternion.copy(q);g.add(wn);}}
    for(const s of[1,-1]){
      // フロート（上は機体色、下は腹の色）と、胴体につなぐ 2 本の支柱
      const fl=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),belly);fl.scale.set(1.15,.5,6.0);fl.position.set(s*2.75,-2.0,-1.4);g.add(fl);
      const ft=new THREE.Mesh(new THREE.SphereGeometry(1,24,10,0,Math.PI*2,0,Math.PI/2),body);ft.scale.set(1.17,.42,6.03);ft.position.set(s*2.75,-1.96,-1.4);g.add(ft);
      for(const z of[-4.4,.4])g.add(new THREE.Mesh(strutFoil(new V3(s*1.2,-1.5,z),new V3(s*2.7,-1.75,z),2.4,.2),body));
    }
  }else{
    const fus=new THREE.Mesh(latheZ([[-12.6,.02],[-12.1,.3],[-10.6,.82],[-8.2,1.32],[-5,1.74],[-1,1.95],[4,1.86],[8,1.42],[11,.82],[12.2,.42],[12.4,.02]]),body);
    fus.scale.set(FW,.9,1);g.add(fus);
    const keel=new THREE.Mesh(latheZ([[-8.5,.02],[-6,1.0],[-1,1.5],[5,1.35],[9,.6],[10.5,.02]],20),belly);keel.scale.set(.86*FW,.6,1);keel.position.y=-.82;g.add(keel);
    const nose=new THREE.Mesh(latheZ([[-13.9,.02],[-13.5,.09],[-12.3,.26],[-12.1,.31]],12),dark);nose.scale.set(FW,.9,1);g.add(nose);
    // 風防：機首側を細く絞り、胴体上面の傾きに合わせて前下がりに置く（胴体の幅からはみ出さないように）
    const cg=new THREE.Group();cg.position.set(0,1.12,-6.2);cg.rotation.x=-.08;g.add(cg);ud.canopyG=cg;
    const cgeo=new THREE.SphereGeometry(1.2,28,18);{const pa=cgeo.attributes.position;for(let i=0;i<pa.count;i++){const z=pa.getZ(i);if(z<0)pa.setX(i,pa.getX(i)*(1-.5*(z/1.2)**2));}cgeo.computeVertexNormals();}
    const can=new THREE.Mesh(cgeo,glass);can.scale.set(.72*(FW>1?1.25:1),.9,2.9);cg.add(can);ud.canopy=can;
  }
  // 主翼・尾翼（形の選択で変わる）
  const T=ST[2],WK=SH.winglet==='down'?-1:1,tipP=SH.winglet?new V3(T[0]+1.1,T[1]+2.18*WK,T[2]+2.2):new V3(T[0]+.15,T[1]+.12,T[2]+T[3]*.55);ud.tipPos=tipP;
  for(const s of[1,-1]){
    g.add(new THREE.Mesh(loft(ST.map(a=>foil(new V3(s*a[0],a[1],a[2]),a[3],a[4],UP))),body));
    if(!SH.orig){const a=ST[0],b=ST[1],rr=fusR(a[2]+a[3]*.4),hw=FW*Math.sqrt(Math.max(.3,rr*rr-(a[1]/.9)**2));
      const sec=(x,kc,kt)=>{const t=clamp((x-a[0])/(b[0]-a[0]),0,1),c=lerp(a[3],b[3],t);return foil(new V3(s*x,lerp(a[1],b[1],t),lerp(a[2],b[2],t)-c*(kc-1)*.45),c*kc,lerp(a[4],b[4],t)*(1+(kt-1)*(SH.fil||1))/kc,UP);};
      g.add(new THREE.Mesh(loft([sec(hw-.35,1.2,2.3),sec(hw+.2,1.1,1.5),sec(hw+.75,1.015,1.04)]),body));}
    if(SH.winglet)g.add(new THREE.Mesh(loft([foil(new V3(s*T[0],T[1],T[2]),T[3],T[4],UP),foil(new V3(s*(T[0]+.75),T[1]+.68*WK,T[2]+.75),T[3]*.76,.09,new V3(-s*.6,.8*WK,0)),foil(new V3(s*(T[0]+1.1),T[1]+2.08*WK,T[2]+1.7),T[3]*.46,.08,new V3(-s,.15*WK,0))]),acc));
    else if(SH.tail!=='join')g.add(new THREE.Mesh(loft([foil(new V3(s*(T[0]-.5),T[1]-.02,T[2]-.45),T[3]+.5,T[4]*1.05,UP),foil(new V3(s*(T[0]+.25),T[1]+.02,T[2]+.2),T[3]*.7,T[4],UP)]),acc));
    if(SH.canard){g.add(new THREE.Mesh(loft([foil(new V3(s*1.15,.55,-8.6),2.6,.08,UP),foil(new V3(s*4.4,.66,-7.1),1.15,.07,UP)]),body));}
    if(SH.tail==='v'){
      const up2=new V3(-.86*s,.51,0);
      g.add(new THREE.Mesh(loft([foil(new V3(s*.9,.9,6.6),4.4,.1,up2),foil(new V3(s*2.6,3.75,9.3),2.5,.09,up2),foil(new V3(s*3.4,4.85,10.5),1.5,.08,up2)]),body));
      g.add(new THREE.Mesh(loft([foil(new V3(s*3.4,4.85,10.5),1.5,.08,up2),foil(new V3(s*3.75,5.35,11.05),1.0,.08,up2)]),acc));
    }else if(SH.tail==='twin'){
      const up2=new V3(.98,-.2*s,0).normalize();
      g.add(new THREE.Mesh(loft([foil(new V3(s*2.55,2.11+(SH.eng?SH.eng[1]:0),6.3),4.2,.09,up2),foil(new V3(s*3.2,5.3,8.7),2.5,.08,up2),foil(new V3(s*3.42,6.3,9.75),1.5,.075,up2)]),body));
      g.add(new THREE.Mesh(loft([foil(new V3(s*3.42,6.3,9.75),1.5,.075,up2),foil(new V3(s*3.52,6.85,10.3),1.0,.07,up2)]),acc));
    }else if(SH.tail==='h'){
      // 水平尾翼の両端に垂直尾翼
      g.add(new THREE.Mesh(loft([foil(new V3(s*.4,.1,8.3),3.6,.09,UP),foil(new V3(s*4.8,.22,9.6),2.3,.08,UP)]),body));
      g.add(new THREE.Mesh(loft([foil(new V3(s*4.8,-1.1,9.2),2.9,.08,XA),foil(new V3(s*4.8,.22,9.5),2.7,.08,XA),foil(new V3(s*4.8,3.4,10.9),1.4,.07,XA)]),body));
      g.add(new THREE.Mesh(loft([foil(new V3(s*4.8,3.4,10.9),1.4,.07,XA),foil(new V3(s*4.8,3.9,11.4),.9,.07,XA)]),acc));
    }else if(SH.tail==='join'){
      if(s>0)g.add(new THREE.Mesh(loft([foil(new V3(0,1.2,5.6),5.6,.085,XA),foil(new V3(0,6.1,9.5),2.9,.075,XA)]),body));
      g.add(new THREE.Mesh(loft([foil(new V3(0,5.85,9.2),3.3,.12,UP),foil(new V3(s*6,3.45,6.7),2.7,.115,UP),foil(new V3(s*T[0],T[1]+1.0,T[2]+.2),2.0,.11,UP)]),body));
      g.add(new THREE.Mesh(loft([foil(new V3(s*T[0],T[1]-.3,T[2]-.5),T[3]+.9,.06,XA),foil(new V3(s*T[0],T[1]+.45,T[2]-.2),T[3]+.4,.06,XA),foil(new V3(s*T[0],T[1]+1.45,T[2]+.5),1.9,.055,XA)]),acc));
      if(s>0){const bl=new THREE.Mesh(new THREE.SphereGeometry(.3,14,10),body);bl.scale.set(1,1.1,5);bl.position.set(0,5.95,10.9);g.add(bl);}
    }else if(SH.tail==='orig'){
      // 細い尾部の先に、斜め上へ開く 2 枚と下向きの 1 枚
      const up2=new V3(-.78*s,.62,0);
      g.add(new THREE.Mesh(loft([foil(new V3(s*.2,.3,10.2),2.8,.09,up2),foil(new V3(s*2.5,3.2,11.6),1.6,.08,up2)]),body));
      g.add(new THREE.Mesh(loft([foil(new V3(s*2.5,3.2,11.6),1.6,.08,up2),foil(new V3(s*2.85,3.65,12.0),1.1,.07,up2)]),acc));
      if(s>0)g.add(new THREE.Mesh(loft([foil(new V3(0,-.2,10.5),2.5,.09,XA),foil(new V3(0,-1.8,11.6),1.3,.08,XA)]),belly));
    }else if(SH.tail==='none'){
    }else if(s>0){
      const up2=new V3(1,0,0);
      g.add(new THREE.Mesh(loft([foil(new V3(0,1.25,5.2),6.4,.085,up2),foil(new V3(0,5.3,9.4),2.9,.075,up2),foil(new V3(0,6.6,10.9),1.5,.07,up2)]),body));
      g.add(new THREE.Mesh(loft([foil(new V3(0,6.6,10.9),1.5,.07,up2),foil(new V3(0,7.25,11.5),1.0,.065,up2)]),acc));
    }
    // エンジン
    const nac=new THREE.Mesh(latheZ([[-3.6,.78],[-3.3,.96],[-1.5,1.08],[1.5,1.02],[3.3,.86],[3.8,.74]],22),body);nac.position.set(s*2.55,1.25,6.3);g.add(nac);
    const lip=new THREE.Mesh(new THREE.TorusGeometry(.86,.1,8,22),dark);lip.position.set(s*2.55,1.25,2.72);g.add(lip);
    const intake=new THREE.Mesh(new THREE.CircleGeometry(.84,20),new THREE.MeshBasicMaterial({color:0x020304}));intake.position.set(s*2.55,1.25,2.9);intake.rotation.y=Math.PI;g.add(intake);
    const py=new THREE.Mesh(new THREE.BoxGeometry(.5,1.1,3.6),body);py.position.set(s*1.9,.8,6.2);py.rotation.z=-s*.6;py.userData.pylon=1;g.add(py);
    const noz=new THREE.Mesh(new THREE.CylinderGeometry(.7,.76,.9,20,1,true),dark);noz.rotation.x=Math.PI/2;noz.position.set(s*2.55,1.25,10.3);g.add(noz);
    const fire=new THREE.Mesh(new THREE.CircleGeometry(.66,18),new THREE.MeshBasicMaterial({color:new THREE.Color(5,2.4,.9)}));fire.position.set(s*2.55,1.25,10.35);g.add(fire);
    const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(1.0,.5,.22),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
    gl.position.set(s*2.55,1.25,11.2);gl.scale.set(5,5,1);g.add(glowLOD(gl,30,.3));
    (ud.fires=ud.fires||[]).push(fire);(ud.glows=ud.glows||[]).push(gl);
    {const hb=new THREE.Mesh(new THREE.CylinderGeometry(.775,.885,.52,24,1,true),std({color:lin(0x6b5f52),metalness:.95,roughness:.38,side:THREE.DoubleSide}));hb.rotation.x=Math.PI/2;hb.position.set(s*2.55,1.25,9.86);g.add(hb);
      const wr=new THREE.Mesh(new THREE.TorusGeometry(.985,.02,6,30),std({color:lin(0xb3261c),roughness:.6,metalness:.1}));wr.position.set(s*2.55,1.25,3.35);g.add(wr);}
    // 航法灯
    const nv=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:s>0?new THREE.Color(.1,1.6,.3):new THREE.Color(1.9,.12,.08),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
    nv.position.set(s*tipP.x,tipP.y+.15,tipP.z+.3);nv.scale.set(1.3,1.3,1);g.add(glowLOD(nv,70,.18));
  }
  if(!SH.orig){
    const rd=std({color:lin(0x2b3036),roughness:.75,metalness:.1});
    const br=new THREE.Mesh(new THREE.SphereGeometry(1,24,14),rd);br.scale.set(1.05*FW,.36,1.75);br.position.set(0,-1.5,5.7);g.add(br);
    const tb=new THREE.Mesh(latheZ([[11.4,.4],[12.6,.31],[14.6,.21],[15.2,.14]],14),body);g.add(tb);
    const tt=new THREE.Mesh(latheZ([[15.2,.14],[15.9,.1],[16.2,.02]],12),dark);g.add(tt);
    const eo=new THREE.Mesh(new THREE.SphereGeometry(.3,18,14),std({color:lin(0x0c0f13),roughness:.12,metalness:.9}));eo.position.set(0,-1.02,-9.5);g.add(eo);
    const er=new THREE.Mesh(new THREE.CylinderGeometry(.34,.36,.14,18),dark);er.position.set(0,-.86,-9.5);g.add(er);
    const el=new THREE.Mesh(new THREE.CircleGeometry(.11,14),new THREE.MeshBasicMaterial({color:new THREE.Color(.12,.3,.5)}));el.rotation.y=Math.PI;el.position.set(0,-1.08,-9.795);g.add(el);
  }else{
    // 原型機：胴体に沿う縦通材
    for(const th of[.78,-.78,1.95,-1.95,2.5,-2.5]){const pts=[];for(let k=0;k<=14;k++){const z=-9.7+k*.78,r=origR(z)+.01;pts.push(new V3(Math.sin(th)*r,Math.cos(th)*r*.86,z));}
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),40,.04,6),body));}
  }
  // 胴体の帯
  const band=new THREE.Mesh(new THREE.CylinderGeometry(1.965,1.93,1.3,28,1,true),acc);band.rotation.x=Math.PI/2;band.scale.set(FW,1,.9);band.position.z=1.2;band.visible=!SH.orig;g.add(band);
  // 背面のセンサーフェアリング
  const sens=new THREE.Mesh(new THREE.SphereGeometry(.8,16,10),dark);sens.scale.set(.7,.32,2.6);sens.position.set(0,1.72,.4);sens.visible=!SH.orig;g.add(sens);
  // ディフューザー（腹下のパイロンに懸架）
  const PY=SH.orig?-2.76:-2.32;
  const pod=buildDiffuser();pod.position.set(0,PY,-.3);g.add(pod);ud.pod=pod;
  const pyl=new THREE.Mesh(new THREE.BoxGeometry(.34,.52,3.4),belly);pyl.position.set(0,PY+.54,-.2);pyl.userData.podm=1;g.add(pyl);ud.podY=PY;
  for(const z of[-1.6,1.1]){const br=new THREE.Mesh(new THREE.TorusGeometry(.48,.04,6,16,Math.PI),dark);br.position.set(0,PY,z);br.userData.podm=1;g.add(br);}
  // 衝突防止灯
  const stb=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(1.6,1.6,1.8),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
  stb.position.set(0,-1.2,4);stb.scale.set(1.4,1.4,1);g.add(glowLOD(stb,70,.18));ud.strobe=stb;
  const bcn=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(5,.3,.2),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
  bcn.position.set(0,SH.orig?4.1:2.1,SH.orig?-1.9:3);bcn.scale.set(1.6,1.6,1);g.add(glowLOD(bcn,70,.18));ud.beacon=bcn;
  detailAircraft(g,accentHex,label||'SR-01');
  ud.power=1;
  return g;
}
function animAircraft(g,t,power,phase){
  const ud=g.userData;
  // 点火：出力が燃焼開始の線をまたいだ瞬間に炎が噴く
  if(ud.lastP!==undefined&&ud.lastP<.28&&power>=.28){ud.ign=1;if(ud.onIgn)ud.onIgn();}
  ud.lastP=power;ud.ign=Math.max(0,(ud.ign||0)-.012);
  const ab=sat((power-1.02)/.4),lit=power>=.28?1:0,T=sat((power-.2)/1.1),fl=1+Math.sin(t*37+phase)*.06;
  // ノズル奥の色は温度で変わる（暗赤→橙→白）
  const r=lit*(.5+3.6*T)+ud.ign*3,gc=lit*(.05+1.9*T*T)+ud.ign*1.2,b=lit*(.9*T*T*T+ab*1.6)+ud.ign*.2;
  ud.fires.forEach(f=>f.material.color.setRGB(r*fl,gc*fl,b*fl));
  ud.glows.forEach(s=>{const q=(1.0+T*1.2+ab*1.6+ud.ign*.7)*lit+ud.ign*.5;s.scale.set(q,q,1);s.material.color.setRGB((.25+.8*T+ud.ign)*fl,(.1+.42*T+ud.ign*.4)*fl,(.04+.2*T+ab*.5)*fl);s.visible=q>.05;});
  if(ud.plumeMat){const u=ud.plumeMat.uniforms;u.uPow.value=lit*(.25+.75*T);u.uAB.value=ab;u.uIgn.value=ud.ign*ud.ign;const L=2.2+T*2.5+ab*9+ud.ign*6;ud.plumes.forEach(p=>p.scale.set(1+ud.ign*.5,1+ud.ign*.5,L));}
  if(ud.ail){const rr=ud.ctlR||0,p=ud.ctlP||0;ud.ail[0].rotation.x=ud.ail[1].rotation.x=-rr*.32;ud.ruv[0].rotation.x=-p*.3-rr*.08;ud.ruv[1].rotation.x=p*.3-rr*.08;
    if(ud.scarMats){ud.scarMats[0].emissiveIntensity=.55+.45*Math.sin(t*13+phase)*Math.sin(t*3.1);ud.scarMats[1].emissiveIntensity=.55+.45*Math.sin(t*17+1.7+phase)*Math.sin(t*4.3);}
    if(ud.heads){const look=Math.abs(rr)<.06?Math.sin(t*.35+phase*3)*.3:0;ud.heads.forEach((h,i)=>{h.rotation.y+=((i?-1:1)*look-rr*.55-h.rotation.y)*.08;h.rotation.z+=(rr*.16-h.rotation.z)*.08;h.rotation.x+=(-p*.18-h.rotation.x)*.08;});ud.sticks.forEach(k=>{k.rotation.z=-rr*.32;k.rotation.x=p*.26;});}
    ud.fans.forEach(f=>{f.rotation.z+=.015+Math.min(power,1.5)*1.3;});const ns=1.06-Math.min(power,1.5)*.12;ud.noz.forEach(n=>n.scale.set(ns,ns,1));}
  const st=((t+phase)%1.3);ud.strobe.visible=st<0.06||(st>0.18&&st<0.24);
  ud.beacon.visible=((t*0.9+phase)%1)<0.18;
}

// ───────────────────────── 基地の島 ─────────────────────────
let baseGroup,runwayLights;const HANGAR_Z=1085;
const _iL=(()=>{const r=mulberry(77),a=new Float32Array(4096);for(let i=0;i<4096;i++)a[i]=r();return a;})();
function vnoise2(x,y){const x0=Math.floor(x),y0=Math.floor(y);let fx=x-x0,fy=y-y0;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
  const g=(i,j)=>_iL[((j&63)<<6)|(i&63)],a=g(x0,y0),b=g(x0+1,y0),c=g(x0,y0+1),d=g(x0+1,y0+1);return(a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;}
function fbm2(x,y){let s=0,a=.5,f=1;for(let i=0;i<5;i++){s+=a*vnoise2(x*f,y*f);a*=.5;f*=2.03;}return s/.97;}
// 島の高さ（基地ローカル座標）。西側は尾根の立った山地、東は滑走路のある平地
function islandH(x,z){
  const d=Math.hypot(x/1500,z/1750)+(fbm2(x*.0016+3,z*.0016+7)-.5)*.12;
  let h=(1-smooth(.5,1,d))*30-9+(fbm2(x*.004,z*.004)-.5)*10;
  const rg=1-Math.abs(fbm2(x*.0011+11,z*.0011+5)*2-1),m=smooth(-250,-800,x)*(1-smooth(.4,.9,d));
  h+=m*(50+250*rg*rg+(fbm2(x*.006+1,z*.006)-.5)*46);
  h+=(1-smooth(0,460,Math.hypot(x-560,z+1080)))*(1-smooth(.5,.95,d))*(60+(fbm2(x*.008,z*.008)-.5)*30);
  const w=(1-smooth(150,340,Math.abs(x-30)))*(1-smooth(1180,1420,Math.abs(z-130)));
  const ap=(1-smooth(380,520,Math.abs(x-250)))*(1-smooth(480,640,Math.abs(z-150)));
  // 港の敷地は岸壁の高さより少し下で平らにする
  const pm=smooth(1080,1108,x)*(1-smooth(1286,1296,x))*smooth(-200,-174,z)*(1-smooth(474,500,z));
  return lerp(lerp(h,RWY_Y-.5,Math.max(w,ap)),4.2,pm);
}
const inPort=(x,z)=>x>1070&&x<1310&&z>-215&&z<515;
// 継ぎ目なく並ぶ地表テクスチャを作る。rgb=色（ガンマ2で格納）a=高さ。別に勾配テクスチャ（凹凸用）
const GT={};
function buildGroundTex(){
  const N=512;
  const lat=(px,py,seed)=>{const r=mulberry(seed),L=new Float32Array(px*py);for(let i=0;i<L.length;i++)L[i]=r();return(u,v)=>{const x=u*px,y=v*py,x0=Math.floor(x),y0=Math.floor(y);let fx=x-x0,fy=y-y0;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const i0=((x0%px)+px)%px,i1=(i0+1)%px,j0=((y0%py)+py)%py,j1=(j0+1)%py;const a=L[j0*px+i0],b=L[j0*px+i1],c=L[j1*px+i0],d=L[j1*px+i1];return(a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;};};
  const fbm=(bx,by,o,seed)=>{const ls=[];for(let i=0;i<o;i++)ls.push(lat(bx<<i,by<<i,seed+i*7));return(u,v)=>{let s=0,a=.5,t=0;for(let i=0;i<o;i++){s+=a*ls[i](u,v);t+=a;a*=.5;}return s/t;};};
  const make=(name,fn)=>{const d=new Uint8Array(N*N*4),H=new Float32Array(N*N);
    for(let j=0;j<N;j++)for(let i=0;i<N;i++){const c=fn(i/N,j/N),o=(j*N+i)*4;d[o]=255*Math.sqrt(sat(c[0]));d[o+1]=255*Math.sqrt(sat(c[1]));d[o+2]=255*Math.sqrt(sat(c[2]));d[o+3]=255*sat(c[3]);H[j*N+i]=c[3];}
    const g=new Uint8Array(N*N*4);for(let j=0;j<N;j++)for(let i=0;i<N;i++){const o=(j*N+i)*4;g[o]=255*sat(.5+(H[j*N+(i+1)%N]-H[j*N+(i+N-1)%N])*4);g[o+1]=255*sat(.5+(H[((j+1)%N)*N+i]-H[((j+N-1)%N)*N+i])*4);g[o+3]=255;}
    const mk=a=>{const t=new THREE.DataTexture(a,N,N,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;t.anisotropy=8;t.needsUpdate=true;return t;};
    GT[name]={value:mk(d)};GT[name+'N']={value:mk(g)};};
  // 草地：葉先の細かな筋、枯れ草の斑、土の覗く所
  {const a=fbm(6,6,6,11),bl=fbm(96,24,3,31),bl2=fbm(28,110,3,37),dry=fbm(5,5,4,41),sp=fbm(64,64,2,53);
    make('grass',(u,v)=>{const n=a(u,v),b=bl(u,v)*.55+bl2(u,v)*.45,d=smooth(.55,.72,dry(u,v)),s=sp(u,v);
      let r=lerp(.030,.115,n),g=lerp(.070,.165,n),bb=lerp(.016,.045,n);const k=.62+.75*b;r*=k;g*=k;bb*=k;
      r=lerp(r,.21*k,d*.7);g=lerp(g,.175*k,d*.7);bb=lerp(bb,.07*k,d*.7);
      const soil=smooth(.74,.82,s)*.6;r=lerp(r,.07,soil);g=lerp(g,.05,soil);bb=lerp(bb,.03,soil);return[r,g,bb,b*.7+n*.3];});}
  // 岩：割れ目、地層の縞、地衣類
  {const a=fbm(4,4,6,61),w=fbm(3,3,4,71),c=fbm(7,7,5,81),li=fbm(5,5,4,91),gr=fbm(80,80,2,97);
    make('rock',(u,v)=>{const n=a(u,v),cr=Math.abs(c(u,v)*2-1),crack=1-smooth(0,.07,cr),st=.5+.5*Math.sin((v*9+w(u,v)*2.6)*6.2832),l=smooth(.6,.72,li(u,v)),g=gr(u,v);
      let k=(.55+.7*n)*(.82+.26*st)*(1-.62*crack)*(.9+.2*g);let r=.21*k,gg=.195*k,b=.17*k;r=lerp(r,.16,l*.45);gg=lerp(gg,.18,l*.45);b=lerp(b,.085,l*.45);
      return[r,gg,b,sat(n*.6+st*.15+.25-crack*.6)];});}
  // 砂：粒と風紋
  {const a=fbm(5,5,4,101),gr=fbm(128,128,2,111),w=fbm(4,4,3,121);
    make('sand',(u,v)=>{const rp=.5+.5*Math.sin((v*17+w(u,v)*1.7)*6.2832),g=gr(u,v),n=a(u,v),k=.8+.22*n+.14*g+.07*rp;return[.50*k,.44*k,.315*k,rp*.6+g*.4];});}
}
function forestMask(x,z){return smooth(.46,.6,fbm2(x*.0023+9,z*.0023+4));}
function buildBase(){
  const B=baseGroup=new THREE.Group();B.position.copy(BASE);scene.add(B);
  // 地形
  const tg=new THREE.PlaneGeometry(3800,4200,250,276);tg.rotateX(-Math.PI/2);
  const p=tg.attributes.position,col=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,islandH(x,z));
    // r:舗装のマスク g:森のマスク
    col[i*3]=Math.max((1-smooth(105,135,Math.abs(x-262)))*(1-smooth(175,205,Math.abs(z+30))),(1-smooth(95,120,Math.abs(x-330)))*(1-smooth(60,85,Math.abs(z-400))),(1-smooth(14,22,Math.abs(x-150)))*(1-smooth(200,230,Math.abs(z-120))));
    col[i*3+1]=forestMask(x,z);}
  tg.setAttribute('color',new THREE.BufferAttribute(col,3));tg.computeVertexNormals();
  const tm=std({vertexColors:true,roughness:.95,metalness:0});
  tm.onBeforeCompile=sh=>{sh.uniforms.tN2=U.tNoise2;Object.assign(sh.uniforms,{tN3:U.tNoise,uSunDir:U.uSunDir,uStorm:U.uStorm,tGr:GT.grass,tGrN:GT.grassN,tRk:GT.rock,tRkN:GT.rockN,tSd:GT.sand,tSdN:GT.sandN});
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;varying vec3 vNw;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*vec4(position,1.0)).xyz;vNw=normal;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nprecision highp sampler3D;\nvarying vec3 vWP;varying vec3 vNw;uniform sampler2D tN2,tGr,tGrN,tRk,tRkN,tSd,tSdN;uniform sampler3D tN3;uniform vec3 uSunDir;uniform float uStorm;').replace('#include <color_fragment>',`
float hgt=vWP.y,slope=1.0-normalize(vNw).y;
if(hgt<-1.2)discard;
float n1=texture2D(tN2,vWP.xz/41.0).b,n2=texture2D(tN2,vWP.xz/263.0).b,n3=texture2D(tN2,vWP.xz/6.7).b,n4=texture2D(tN2,vWP.xz/900.0+0.3).b;
// 近景用（13m）と中景用（71m・回転）の 2 段で貼り、繰り返しを目立たなくする
vec2 uA=vWP.xz/13.0,uB=vec2(vWP.x*0.8+vWP.z*0.6,vWP.z*0.8-vWP.x*0.6)/71.0;
vec4 gA=texture2D(tGr,uA),gB=texture2D(tGr,uB);
vec3 grass=gA.rgb*gA.rgb*(0.45+1.25*gB.a)*(0.62+0.8*n2);
grass=mix(grass,grass*vec3(1.75,1.25,0.95)+vec3(0.03,0.02,0.0),smoothstep(0.52,0.72,n4)*0.55);
vec3 an=abs(normalize(vNw));vec2 uR=(an.x>an.z?vWP.zy:vWP.xy)/19.0;uR=mix(vWP.xz/19.0,uR,smoothstep(0.25,0.5,slope));
vec4 rA=texture2D(tRk,uR),rB=texture2D(tRk,uR*0.23+0.37);
vec4 sA=texture2D(tSd,vWP.xz/9.0);
vec3 forest=vec3(0.016,0.040,0.013)*(0.6+0.9*n3);
vec3 rock=rA.rgb*rA.rgb*vec3(0.80,0.70,0.58)*(0.42+1.0*rB.a)*(0.80+0.36*sin(hgt*0.33+n2*7.0))*(0.75+0.5*n3);
vec3 sand=sA.rgb*sA.rgb*(0.8+0.4*n1);
vec3 tc=mix(grass,forest,vColor.g*smoothstep(6.0,16.0,hgt)*0.85);
float mRock=clamp(smoothstep(0.34,0.42,slope+(n1-0.5)*0.05+(n3-0.5)*0.10+(gA.a-0.5)*0.10)+smoothstep(190.0,280.0,hgt)*0.5*smoothstep(0.35,0.6,n3+gA.a*0.5),0.0,1.0);
float mSand=(1.0-smoothstep(3.0,8.0,hgt+(n1-0.5)*3.5))*(1.0-smoothstep(0.3,0.55,slope));
tc=mix(tc,rock,mRock);tc=mix(tc,sand,mSand);
// 凹凸（勾配テクスチャ）
float bf=1.0/(1.0+length(vViewPosition)/260.0);
vec2 bmp=(texture2D(tGrN,uA).rg-0.5)*1.5*(1.0-mRock)*(1.0-mSand)*(1.0-vColor.r)+(texture2D(tRkN,uR).rg-0.5)*3.2*mRock+(texture2D(tSdN,vWP.xz/9.0).rg-0.5)*1.0*mSand;bmp*=bf;
tc=mix(tc,tc*0.42,1.0-smoothstep(0.1,1.7,hgt));
tc=mix(tc,vec3(0.19,0.195,0.19)*(0.8+0.4*n3),vColor.r);
{vec2 q=vWP.xz+uSunDir.xz/max(uSunDir.y,0.12)*(1700.0-vWP.y);float fn=texture(tN3,vec3(q*0.000037,0.37)).g;tc*=1.0-0.5*smoothstep(0.52,0.66,fn)*mix(1.0,smoothstep(12300.0,16500.0,length(q)),clamp(uStorm*4.0,0.0,1.0));}
diffuseColor.rgb=tc;`).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(0.95,0.55,1.0-smoothstep(0.1,1.7,vWP.y));').replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(normal-(viewMatrix*vec4(bmp.x,0.0,bmp.y,0.0)).xyz);');};
  const terr=new THREE.Mesh(tg,tm);terr.receiveShadow=true;B.add(terr);
  // 森：ごつごつした樹冠を森のマスクに沿って密に植える
  {const tgm=new THREE.IcosahedronGeometry(1,1),tp=tgm.attributes.position,tn0=new Float32Array(tp.array);
    for(let i=0;i<tp.count;i++){const x=tp.getX(i),y=tp.getY(i),z=tp.getZ(i),k=.78+.44*vnoise2(x*2.3+y*1.7+5,z*2.3-y*1.1+2);tp.setXYZ(i,x*k,y*k*(y<0?.55:1),z*k);}
    tgm.setAttribute('normal',new THREE.BufferAttribute(tn0,3));
    const tmat=std({color:0xffffff,roughness:1,metalness:0});
    tmat.onBeforeCompile=sh=>{sh.uniforms.tGr=GT.grass;sh.uniforms.tGrN=GT.grassN;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying float vTy;varying vec3 vTp;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTy=position.y;vTp=position*3.0+vec3(instanceMatrix[3][0],0.0,instanceMatrix[3][2])*0.13;');
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vTy;varying vec3 vTp;uniform sampler2D tGr,tGrN;').replace('#include <color_fragment>','#include <color_fragment>\nfloat lf=texture2D(tGr,vTp.xy*0.31+vTp.z*0.17).a*0.6+texture2D(tGr,vTp.zy*0.9).a*0.4;\ndiffuseColor.rgb*=(0.35+0.9*smoothstep(-0.5,0.95,vTy))*(0.35+1.5*lf*lf);').replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nvec2 tgn=texture2D(tGrN,vTp.xy*0.31+vTp.z*0.17).rg-0.5;normal=normalize(normal+vec3(tgn,0.0)*1.5);');};
    const N=7000,im=new THREE.InstancedMesh(tgm,tmat,N),d=new THREE.Object3D(),rd=mulberry(5),tc=new THREE.Color();let n=0,g=0;
    while(n<N&&g++<90000){const x=(rd()-.5)*3300,z=(rd()-.5)*3700,h=islandH(x,z);if(inPort(x,z))continue;
      if(h<6||h>235||(Math.abs(x-30)<270&&Math.abs(z-130)<1420)||(Math.abs(x-250)<330&&Math.abs(z-150)<440))continue;
      if(rd()>forestMask(x,z)*.95+.05)continue;
      if(Math.abs(islandH(x+10,z)-h)+Math.abs(islandH(x,z+10)-h)>9)continue;
      const sc=3.2+rd()*5.2;d.position.set(x,h+sc*.62,z);d.scale.set(sc*(.8+rd()*.5),sc*(.95+rd()*.8),sc*(.8+rd()*.5));d.rotation.y=rd()*6;d.updateMatrix();im.setMatrixAt(n,d.matrix);
      tc.setRGB(.020+rd()*.022,.050+rd()*.045,.014+rd()*.016);im.setColorAt(n,tc);n++;}
    im.count=n;im.instanceColor.needsUpdate=true;im.frustumCulled=false;B.userData.trees=im;B.add(im);}
  // 滑走路沿いと建物まわりの並木（幹＋3 つの葉むら）
  {const base=new THREE.IcosahedronGeometry(1,1),bp=base.attributes.position,pos=[],nor=[],lobes=[[0,0,0,1],[.75,-.25,.2,.72],[-.55,-.2,.55,.68],[.1,.55,-.15,.6],[-.2,-.3,-.7,.66]];
    for(const[ox,oy,oz,sc]of lobes)for(let i=0;i<bp.count;i++){const x=bp.getX(i),y=bp.getY(i),z=bp.getZ(i),k=(.8+.4*vnoise2(x*2.3+y*1.7+ox*9,z*2.3-y*1.1+oz*5))*sc;pos.push(ox+x*k,oy+y*k*.9,oz+z*k);nor.push(x,y,z);}
    const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));cg.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
    const cm=std({color:0xffffff,roughness:1,metalness:0});cm.onBeforeCompile=sh=>{sh.uniforms.tGr=GT.grass;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying float vTy;varying vec3 vTp;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTy=position.y;vTp=position*2.0;');
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vTy;varying vec3 vTp;uniform sampler2D tGr;').replace('#include <color_fragment>','#include <color_fragment>\nfloat lf=texture2D(tGr,vTp.xy*0.4+vTp.z*0.2).a*0.6+texture2D(tGr,vTp.zy*1.1).a*0.4;\ndiffuseColor.rgb*=(0.30+0.95*smoothstep(-0.7,1.0,vTy))*(0.35+1.5*lf*lf);');};
    const N=420,crown=new THREE.InstancedMesh(cg,cm,N),tgm=new THREE.CylinderGeometry(.16,.3,1,7);tgm.translate(0,.5,0);
    const trunk=new THREE.InstancedMesh(tgm,std({color:lin(0x3d3226),roughness:.95,metalness:0}),N),d=new THREE.Object3D(),rd=mulberry(61),tc=new THREE.Color();let n=0;
    const put=(x,z)=>{if(n>=N)return;const h=islandH(x,z);if(h<6)return;const H=3.2+rd()*2.6,s=2.6+rd()*1.8;d.position.set(x,h-.2,z);d.rotation.set(0,rd()*6,0);d.scale.set(1+rd()*.5,H,1+rd()*.5);d.updateMatrix();trunk.setMatrixAt(n,d.matrix);
      d.position.set(x,h+H+s*.45,z);d.scale.set(s,s*(.85+rd()*.3),s);d.updateMatrix();crown.setMatrixAt(n,d.matrix);tc.setRGB(.022+rd()*.02,.055+rd()*.04,.016+rd()*.014);crown.setColorAt(n,tc);n++;};
    for(let z=-1000;z<=900;z+=16+rd()*10){put(-150-rd()*26,z);if(rd()<.6)put(-190-rd()*30,z+6);}
    for(let z=-250;z<=600;z+=22+rd()*10)put(226+rd()*6,z);
    for(let i=0;i<60;i++)put(150+rd()*330,575+rd()*60);for(let i=0;i<50;i++)put(480+rd()*40,-250+rd()*800);
    crown.count=trunk.count=n;crown.instanceColor.needsUpdate=true;crown.castShadow=true;trunk.castShadow=true;crown.frustumCulled=trunk.frustumCulled=false;B.add(crown);B.add(trunk);B.userData.avenue=[crown,trunk];}
  // 浜辺のヤシ（幹と葉を別々に一括描画）
  {const pos=[],idx=[];for(let k=0;k<9;k++){const a=k/9*6.283+((k*7)%3)*.2,L=3.6+((k*5)%3)*.5;for(let i=0;i<=5;i++){const t=i/5,cx=Math.cos(a)*L*t,cz=Math.sin(a)*L*t,cy=.7*t-2.3*t*t,w=.5*(1-t*.75)*(i?1:.3);pos.push(cx-Math.sin(a)*w,cy,cz+Math.cos(a)*w,cx+Math.sin(a)*w,cy-.12,cz-Math.cos(a)*w);if(i<5){const o=k*12+i*2;idx.push(o,o+1,o+2,o+1,o+3,o+2);}}}
    const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));cg.setIndex(idx);cg.computeVertexNormals();
    const N=260,crown=new THREE.InstancedMesh(cg,std({color:lin(0x2f5a22),roughness:.8,metalness:0,side:THREE.DoubleSide}),N),tg2=new THREE.CylinderGeometry(.14,.24,1,6);tg2.translate(0,.5,0);
    const trunk=new THREE.InstancedMesh(tg2,std({color:lin(0x6b5a45),roughness:.95,metalness:0}),N),d=new THREE.Object3D(),rd=mulberry(19);let n=0,g=0;
    while(n<N&&g++<60000){const a=rd()*6.283,rr3=.7+rd()*.2,x=Math.cos(a)*1500*rr3,z=Math.sin(a)*1750*rr3,h=islandH(x,z);if(inPort(x,z))continue;if(h<2.4||h>6.5||(Math.abs(x-30)<200&&Math.abs(z-130)<1450))continue;
      const H=5.5+rd()*4.5,lx=(rd()-.5)*.28,lz=(rd()-.5)*.28;d.position.set(x,h-.3,z);d.rotation.set(lz,rd()*6,-lx);d.scale.set(1,H,1);d.updateMatrix();trunk.setMatrixAt(n,d.matrix);
      d.position.set(x+lx*H,h-.3+H*.98,z+lz*H);d.rotation.set(0,rd()*6,0);const s=.8+rd()*.5;d.scale.set(s,s,s);d.updateMatrix();crown.setMatrixAt(n,d.matrix);n++;}
    crown.count=trunk.count=n;crown.frustumCulled=trunk.frustumCulled=false;B.add(crown);B.add(trunk);B.userData.palms=[crown,trunk];}
  // 沖の岩礁と北岬の灯台
  {const rg=new THREE.IcosahedronGeometry(1,4),rp=rg.attributes.position;for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),k=.62+.5*vnoise2(x*1.7+y*2.1+3,z*1.7+y+8)+.2*vnoise2(x*5+y*4,z*5-y*3)+.08*vnoise2(x*13,z*13+y*11);rp.setXYZ(i,x*k,y*k*(y>0?1:.4),z*k);}rg.computeVertexNormals();
    const rm=std({color:lin(0x3d3832),roughness:.95,metalness:0});rm.onBeforeCompile=sh=>{sh.uniforms.tN2=U.tNoise2;sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nvarying vec3 vRP;").replace("#include <begin_vertex>","#include <begin_vertex>\nvRP=(modelMatrix*vec4(position,1.0)).xyz;");
      sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nvarying vec3 vRP;uniform sampler2D tN2;").replace("#include <color_fragment>","#include <color_fragment>\nfloat ra=texture2D(tN2,vRP.xy/23.0+vRP.z*0.03).b,rb=texture2D(tN2,vRP.zy/7.0).b;diffuseColor.rgb*=(0.5+1.1*ra)*(0.7+0.6*rb)*(0.85+0.3*sin(vRP.y*0.6+ra*6.0));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.02,0.03,0.025),1.0-smoothstep(0.5,5.0,vRP.y));");};
    for(const[x,z,s,hh]of[[-1420,-760,34,60],[-1500,-640,22,38],[-1380,-900,18,26],[-1250,1480,30,44],[-1330,1400,16,22],[900,-1620,20,24]]){const r=new THREE.Mesh(rg,rm);r.position.set(x,hh*.2,z);r.scale.set(s,hh,s*.8);r.rotation.y=x;r.userData.rock=1;B.add(r);}
    const lx=250,lz=-1330,ly=Math.max(islandH(lx,lz),2);
    const LH=new THREE.Group();B.add(LH);B.userData.lodLH=LH;buildLighthouse(LH,lx,ly,lz);Object.assign(B.userData,LH.userData,{lodLH:LH});}
  // 滑走路（幅64m×長さ1900m、方位 18/36）。標識は実際の精密進入滑走路の並びに合わせる
  const RW=512,RH=8192,c=document.createElement('canvas');c.width=RW;c.height=RH;const x=c.getContext('2d'),rr2=mulberry(31);
  const PX=RW/64,PY=RH/1900,X=m=>(m+32)*PX,Y=m=>m*PY;          // m: 幅方向は中心 0、長さ方向は北端 0
  x.fillStyle='#2a2c2f';x.fillRect(0,0,RW,RH);
  // 舗装の色むら・補修跡・継ぎ目・横溝
  for(let i=0;i<9000;i++){const g=30+rr2()*34|0;x.fillStyle='rgba('+g+','+g+','+(g+3)+','+(.04+rr2()*.07)+')';x.fillRect(rr2()*RW,rr2()*RH,6+rr2()*70,6+rr2()*160);}
  for(let i=0;i<26;i++){x.fillStyle='rgba(18,19,21,.55)';const w=30+rr2()*120,h=60+rr2()*260;x.fillRect(rr2()*(RW-w),rr2()*(RH-h),w,h);}
  x.strokeStyle='rgba(14,15,16,.55)';x.lineWidth=1;for(let m=0;m<1900;m+=7.5){x.beginPath();x.moveTo(0,Y(m));x.lineTo(RW,Y(m));x.stroke();}
  for(const m of[-21.3,-10.7,0,10.7,21.3]){x.beginPath();x.moveTo(X(m),0);x.lineTo(X(m),RH);x.stroke();}
  for(let i=0;i<60;i++){x.strokeStyle='rgba(8,8,9,.5)';x.beginPath();let px=rr2()*RW,py=rr2()*RH;x.moveTo(px,py);for(let k=0;k<6;k++){px+=(rr2()-.5)*40;py+=rr2()*50;x.lineTo(px,py);}x.stroke();}
  const W='#e4e4de';x.fillStyle=W;
  // 側線と中心線（30m の線・20m の間隔）
  x.fillRect(X(-29.4),Y(0),PX*.9,RH);x.fillRect(X(28.5),Y(0),PX*.9,RH);
  for(let m=92;m<1900-92;m+=50)x.fillRect(X(-.45),Y(m),PX*.9,Y(30));
  // 両端：滑走路末端標識・指示標識・接地帯標識・目標点標識
  const end=(flip,label)=>{x.save();if(flip){x.translate(RW,RH);x.rotate(Math.PI);}
    x.fillStyle=W;x.fillRect(X(-30),Y(4),PX*60,Y(1.8));                                              // 末端の横線
    for(let k=0;k<8;k++)for(const s of[-1,1]){const cx=s*(3+k*3.4);x.fillRect(X(cx-(s<0?1.8:0)),Y(9),PX*1.8,Y(30));}   // 縞
    x.save();x.translate(X(0),Y(47));x.scale(1,PY/PX*.92);x.rotate(Math.PI);x.font='bold '+(PX*15)+'px "Helvetica Neue",Arial,sans-serif';x.textAlign='center';x.textBaseline='alphabetic';x.fillText(label,0,0);x.restore();
    for(const[d,n]of[[150,3],[300,2],[450,2],[600,1],[750,1]])for(const s of[-1,1])for(let k=0;k<n;k++){const cx=s*(9.2+k*3.2);x.fillRect(X(cx-(s<0?1.8:0)),Y(d),PX*1.8,Y(22.5));}
    for(const s of[-1,1])x.fillRect(X(s<0?-17:9),Y(400),PX*8,Y(52));                                   // 目標点
    // 接地帯のタイヤのゴム跡
    for(let i=0;i<520;i++){const d=120+Math.pow(rr2(),1.6)*620,cx=(rr2()<.5?-1:1)*(1.6+rr2()*7)+(rr2()-.5)*2;x.fillStyle='rgba(8,8,9,'+(.05+rr2()*.12)+')';x.fillRect(X(cx),Y(d),PX*(.35+rr2()*.5),Y(18+rr2()*90));}
    x.restore();};
  end(false,'18');end(true,'36');
  const rt=new THREE.CanvasTexture(c);rt.encoding=THREE.sRGBEncoding;rt.anisotropy=16;
  const rw=new THREE.Mesh(new THREE.PlaneGeometry(64,1900),std({map:rt,roughness:.84,metalness:0}));rw.rotation.x=-Math.PI/2;rw.position.set(0,RWY_Y,0);rw.receiveShadow=true;B.add(rw);
  const conc=std({color:lin(0x8a8d8b),roughness:.9,metalness:0});
  // 路肩
  for(const s of[-1,1]){const sh=new THREE.Mesh(new THREE.PlaneGeometry(7,1900),std({color:lin(0x5d6062),roughness:.9,metalness:0}));sh.rotation.x=-Math.PI/2;sh.position.set(s*35.5,RWY_Y-.03,0);sh.receiveShadow=true;B.add(sh);}
  // 過走帯（北端）と、格納庫までつながる発進エプロン（南端）。どちらも進入禁止の黄色い山形
  const padTex=(w,h,draw)=>{const pc=document.createElement('canvas');pc.width=512;pc.height=Math.round(512*h/w);const px=pc.getContext('2d');px.fillStyle='#34373a';px.fillRect(0,0,pc.width,pc.height);
    for(let i=0;i<1400;i++){const g=38+rr2()*30|0;px.fillStyle='rgba('+g+','+g+','+g+','+(.05+rr2()*.08)+')';px.fillRect(rr2()*pc.width,rr2()*pc.height,5+rr2()*50,5+rr2()*50);}
    draw(px,pc.width/w,pc.height);const t=new THREE.CanvasTexture(pc);t.encoding=THREE.sRGBEncoding;t.anisotropy=16;return t;};
  {const t=padTex(64,60,(px,k,H)=>{px.strokeStyle='#d9a21b';px.lineWidth=k*.9;for(let i=0;i<4;i++){const y0=H-(8+i*14)*k;px.beginPath();px.moveTo(2*k,y0);px.lineTo(32*k,y0-12*k);px.lineTo(62*k,y0);px.stroke();}});
    const m=new THREE.Mesh(new THREE.PlaneGeometry(64,60),std({map:t,roughness:.88,metalness:0}));m.rotation.x=-Math.PI/2;m.position.set(0,RWY_Y-.01,-980);m.receiveShadow=true;B.add(m);}
  {// 南端 z=950 から格納庫の床 z=995 まで。上が滑走路側、下が格納庫側
    const t=padTex(104,48,(px,k,H)=>{const cx=52*k;px.fillStyle='#3a3d40';px.fillRect(0,0,104*k,H);
      for(let i=0;i<900;i++){const g=44+rr2()*30|0;px.fillStyle='rgba('+g+','+g+','+g+','+(.05+rr2()*.08)+')';px.fillRect(rr2()*104*k,rr2()*H,5+rr2()*40,5+rr2()*40);}
      px.strokeStyle='rgba(16,17,18,.6)';px.lineWidth=1;for(let i=1;i<13;i++){px.beginPath();px.moveTo(i*8*k,0);px.lineTo(i*8*k,H);px.stroke();}for(let j=1;j<6;j++){px.beginPath();px.moveTo(0,j*8*k);px.lineTo(104*k,j*8*k);px.stroke();}
      // 格納庫の 3 本の誘導線が滑走路の中心線へ集まる
      px.strokeStyle='#d9a21b';px.lineWidth=k*.5;for(const lx of[-24,0,24]){px.beginPath();px.moveTo(cx+lx*k,H);px.bezierCurveTo(cx+lx*k,H*.45,cx,H*.5,cx,0);px.stroke();}
      // 停止位置標識（実線 2 本＋破線 2 本）
      const hy=9*k;px.lineWidth=k*.45;for(let i=0;i<2;i++){px.beginPath();px.moveTo(cx-30*k,hy+i*k*1.1);px.lineTo(cx+30*k,hy+i*k*1.1);px.stroke();}
      px.setLineDash([k*1.4,k*1.4]);for(let i=2;i<4;i++){px.beginPath();px.moveTo(cx-30*k,hy+i*k*1.1);px.lineTo(cx+30*k,hy+i*k*1.1);px.stroke();}px.setLineDash([]);
      px.fillStyle='#b3261c';px.fillRect(cx-9*k,hy+6*k,18*k,4.4*k);px.fillStyle='#f1f1ec';px.font='bold '+(3.3*k)+'px Arial';px.textAlign='center';px.textBaseline='middle';px.fillText('18 - 36',cx,hy+8.3*k);
      // 両脇の縁線
      px.strokeStyle='#d9a21b';px.lineWidth=k*.35;px.beginPath();px.moveTo(cx-32*k,0);px.lineTo(cx-48*k,H);px.moveTo(cx+32*k,0);px.lineTo(cx+48*k,H);px.stroke();});
    const m=new THREE.Mesh(new THREE.PlaneGeometry(104,48),std({map:t,roughness:.86,metalness:0}));m.rotation.x=-Math.PI/2;m.position.set(0,RWY_Y-.005,974.3);m.receiveShadow=true;B.add(m);}
  const tw=new THREE.Mesh(new THREE.PlaneGeometry(26,300),conc);tw.rotation.x=-Math.PI/2;tw.rotation.z=Math.PI/2;tw.position.set(120,RWY_Y-.05,120);B.add(tw);
  // 建物（やや近未来の意匠）
  const hullM=std({color:lin(0x1c6a70),roughness:.5,metalness:.45}),paleM=std({color:lin(0xe4dabf),roughness:.62,metalness:.08}),
    copperM=std({color:lin(0xb8683a),roughness:.34,metalness:.9}),brassM=std({color:lin(0xdcb663),roughness:.28,metalness:.95}),
    darkM=std({color:lin(0x13171b),roughness:.6,metalness:.6}),floorM=std({color:lin(0x262a2f),roughness:.55,metalness:.3}),
    glassM=std({color:lin(0x0e1a24),roughness:.06,metalness:.95});glassM.envMapIntensity=1.8;
  const cyM=new THREE.MeshBasicMaterial({color:new THREE.Color(.25,1.9,2.6)}),amM=new THREE.MeshBasicMaterial({color:new THREE.Color(2.8,1.3,.25)}),
    whM=new THREE.MeshBasicMaterial({color:new THREE.Color(2.6,2.7,3.0)});
  const box=(par,w,h,d,m,x,y,z,sh)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);if(sh){o.castShadow=true;o.receiveShadow=true;}par.add(o);return o;};
  // 発進格納庫（滑走路の南端に直結）
  const HG=new THREE.Group();HG.position.set(0,RWY_Y,HANGAR_Z);B.add(HG);
  box(HG,100,.5,180,floorM,0,-.36,0,false).receiveShadow=true;
  for(const s of[-1,1]){
    const wl=box(HG,5,31,178,hullM,s*49,15,0,true);wl.rotation.z=s*.1;
    box(HG,.5,.04,172,std({color:lin(0xc9a01c),roughness:.7,metalness:.1}),s*43,.03,0);
    for(let k=-3;k<=3;k++)box(HG,1.2,24,1.6,darkM,s*45.4,13,k*25);
  }
  const arch=[[-47,29],[-30,35],[0,38],[30,35],[47,29]];
  for(let i=0;i<4;i++){const a=arch[i],b=arch[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]),ang=Math.atan2(b[1]-a[1],b[0]-a[0]);
    const r=box(HG,len+1.5,1.6,180,hullM,(a[0]+b[0])/2,(a[1]+b[1])/2,0,true);r.rotation.z=ang;
    for(let k=-4;k<=4;k++){const rib=box(HG,len+1,2.6,1.6,darkM,(a[0]+b[0])/2,(a[1]+b[1])/2-1.2,k*21);rib.rotation.z=ang;}}
  box(HG,100,40,3,hullM,0,19,89.5,true);
  box(HG,104,7,5,hullM,0,31.5,-89.5,true);box(HG,86,.5,.4,cyM,0,28.2,-92.2);
  const strips=[];for(const x of[-17,17]){strips.push(box(HG,1.4,.3,160,whM,x,33.6,0));}
  hangarInterior(HG,{hullM,paleM,darkM,glassM,cyM,amM,whM,box});
  B.userData.cones=hangarDetail(HG,{hullM,paleM,darkM,glassM,cyM,amM,whM,box});
  const doors=[-1,1].map(s=>{const d=new THREE.Group();d.userData.dyn=true;d.position.set(s*23.75,0,-88.5);HG.add(d);
    box(d,47.5,28,1.6,std({color:lin(0x4f6e70),roughness:.6,metalness:.4}),0,14,0,true);box(d,47.38,1.2,1.8,darkM,0,9,0);box(d,47.38,1.2,1.8,darkM,0,19,0);box(d,40,.5,.3,amM,0,14,-.9);{const dm=new THREE.Mesh(new THREE.PlaneGeometry(47.3,27.8),B.userData.cones.doorM);dm.position.set(0,14,.82);d.add(dm);for(const y of[4.5,14,23.5])box(d,47.5,.5,.5,darkM,0,y,1.0);}return d;});
  const hlight=new THREE.PointLight(0xcfe2ff,2.2,300,1.4);hlight.position.set(0,27,0);HG.add(hlight);
  B.userData.hangar=HG;B.userData.doors=doors;B.userData.hlight=hlight;B.userData.strip=whM;
  // 滑走路の縁の発光ライン
  const LOD=new THREE.Group();B.add(LOD);B.userData.lod=LOD;
  runwayExtras(LOD,{darkM,paleM,box,conc});
  // 管制塔：細い塔に浮き輪状の管制室
  const tw2=new THREE.Mesh(new THREE.CylinderGeometry(2.6,5.5,74,8),paleM);tw2.position.set(200,RWY_Y+37,360);tw2.castShadow=true;B.add(tw2);
  const cab=new THREE.Mesh(new THREE.SphereGeometry(13,24,12),glassM);cab.scale.set(1,.36,1);cab.position.set(200,RWY_Y+70,360);B.add(cab);
  for(let k=0;k<4;k++){const bd=new THREE.Mesh(new THREE.TorusGeometry(5.25-k*.72,.34,6,24),copperM);bd.rotation.x=Math.PI/2;bd.position.set(200,RWY_Y+6+k*17,360);B.add(bd);}
  {const cap=new THREE.Mesh(new THREE.SphereGeometry(9,24,10,0,6.283,0,1.571),copperM);cap.scale.set(1,.5,1);cap.position.set(200,RWY_Y+74.6,360);B.add(cap);
    const ball=new THREE.Mesh(new THREE.SphereGeometry(1.5,14,10),brassM);ball.position.set(200,RWY_Y+98,360);B.add(ball);}
  const ringA=new THREE.Mesh(new THREE.TorusGeometry(15.5,1.3,8,40),copperM);ringA.rotation.x=Math.PI/2;ringA.position.set(200,RWY_Y+70,360);B.add(ringA);
  const ringB=new THREE.Mesh(new THREE.TorusGeometry(16.9,.22,6,48),cyM);ringB.rotation.x=Math.PI/2;ringB.position.set(200,RWY_Y+70,360);B.add(ringB);
  const spire=new THREE.Mesh(new THREE.CylinderGeometry(.2,.8,22,6),brassM);spire.position.set(200,RWY_Y+86,360);B.add(spire);
  // 気象制御センター：段状の本棟とドーム
  detailBase(B,{hullM,paleM,darkM,glassM,cyM,amM,whM,box,conc,copperM,brassM});
  box(B,.4,2.2,70,cyM,254.7,RWY_Y+8,400);box(B,.4,1.6,46,whM,269.7,RWY_Y+20,400);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(30,48,32),std({color:0xffffff,map:radomeTex(),roughness:.38,metalness:.35}));dome.position.set(360,RWY_Y+40,400);dome.castShadow=true;B.add(dome);
  for(let k=0;k<8;k++){const rb=new THREE.Mesh(new THREE.TorusGeometry(30.25,.42,6,40,Math.PI),copperM);rb.rotation.y=k*Math.PI/8;rb.position.set(360,RWY_Y+40,400);B.add(rb);}
  {const eq=new THREE.Mesh(new THREE.TorusGeometry(30.4,.7,8,60),brassM);eq.rotation.x=Math.PI/2;eq.position.set(360,RWY_Y+40,400);B.add(eq);
    const fn=new THREE.Mesh(new THREE.ConeGeometry(1.6,12,10),brassM);fn.position.set(360,RWY_Y+76,400);B.add(fn);const fb=new THREE.Mesh(new THREE.SphereGeometry(2,14,10),brassM);fb.position.set(360,RWY_Y+70.6,400);B.add(fb);
    const drum=new THREE.Mesh(new THREE.CylinderGeometry(31.5,33,6,48),paleM);drum.position.set(360,RWY_Y+22,400);B.add(drum);const dc=new THREE.Mesh(new THREE.TorusGeometry(32.4,.6,6,60),copperM);dc.rotation.x=Math.PI/2;dc.position.set(360,RWY_Y+25,400);B.add(dc);}
  const dr=new THREE.Mesh(new THREE.TorusGeometry(30.5,.5,6,60),cyM);dr.rotation.x=Math.PI/2;dr.position.set(360,RWY_Y+25,400);B.add(dr);
  for(let k=0;k<3;k++){const a=k*2.094+.5,px=360+Math.cos(a)*62,pz=400+Math.sin(a)*62,y0=Math.max(islandH(px,pz),RWY_Y);
    const m=new THREE.Mesh(new THREE.CylinderGeometry(.5,1.6,64,8),copperM);m.position.set(px,y0+32,pz);{const bl=new THREE.Mesh(new THREE.SphereGeometry(1.4,12,8),brassM);bl.position.set(px,y0+65,pz);B.add(bl);}B.add(m);
    for(const hh of[40,52,62]){const t=new THREE.Mesh(new THREE.TorusGeometry(4.5-hh*.03,.25,6,28),cyM);t.rotation.x=Math.PI/2;t.position.set(px,y0+hh,pz);B.add(t);}}
  // 垂直離着陸パッド
  for(const pz of[-120,60]){const pad=new THREE.Mesh(new THREE.CylinderGeometry(34,34,.4,40),floorM);pad.position.set(250,RWY_Y-.1,pz);pad.receiveShadow=true;B.add(pad);
    const pr=new THREE.Mesh(new THREE.TorusGeometry(31,.3,6,64),cyM);pr.rotation.x=Math.PI/2;pr.position.set(250,RWY_Y+.25,pz);B.add(pr);
    box(B,16,.1,2,amM,250,RWY_Y+.2,pz);box(B,2,.1,16,amM,250,RWY_Y+.2,pz);}
  for(const[mx,mz,mh]of[[-520,-300,70],[-640,260,90],[430,-330,46]]){
    const y0=islandH(mx,mz);const m=new THREE.Mesh(new THREE.CylinderGeometry(.8,1.8,mh,6),hullM);m.position.set(mx,y0+mh/2,mz);B.add(m);
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(5,.4,.3),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));s.position.set(mx,y0+mh+2,mz);s.scale.set(14,14,1);B.add(s);
  }
  // ── 基地の作り込み ──
  const spin=B.userData.spin=[];
  const txt=(s,w,h,col)=>{const c=document.createElement('canvas');c.width=1024;c.height=128;const x=c.getContext('2d');x.fillStyle=col||'#dfe9ef';x.font='600 44px "Helvetica Neue",Arial,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(s,512,68);
    const t=new THREE.CanvasTexture(c);const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,transparent:true,color:new THREE.Color(1.5,1.6,1.7)}));return m;};
  // 格納庫正面の銘板と機番
  {const a=txt('MIZUHA  WEATHER  CONTROL  ・  LAUNCH BAY 01',64,8);a.rotation.y=Math.PI;a.position.set(0,RWY_Y+31.6,HANGAR_Z-92.3);B.add(a);
   for(const s of[-1,1]){const fin=box(B,3,46,26,hullM,s*54,RWY_Y+21,HANGAR_Z-78,true);fin.rotation.z=s*.1;box(B,.4,30,.6,cyM,s*55.6,RWY_Y+22,HANGAR_Z-91);}}
  // 風力発電（丘の稜線）
  for(const[x,z]of[[-560,-520],[-700,-180],[-610,180],[-760,520],[-480,820]]){const y0=islandH(x,z);
    const tw=new THREE.Mesh(new THREE.CylinderGeometry(1.4,2.6,82,10),paleM);tw.position.set(x,y0+41,z);B.add(tw);
    const nc=new THREE.Mesh(new THREE.BoxGeometry(3.4,3.2,8),paleM);nc.position.set(x+3.4,y0+83,z);nc.rotation.y=Math.PI/2;B.add(nc);
    const rot=new THREE.Group();rot.position.set(x+7.8,y0+83,z);rot.rotation.y=Math.PI/2;
    for(let k=0;k<3;k++){const bl=new THREE.Mesh(new THREE.BoxGeometry(1.5,34,.4),paleM);bl.position.y=17;const h=new THREE.Group();h.rotation.z=k*2.094;h.add(bl);rot.add(h);}
    rot.add(new THREE.Mesh(new THREE.SphereGeometry(1.8,10,8),paleM));rot.userData={ax:'z',sp:.9+((x*7)%5)*.06};
    const holder=new THREE.Group();holder.add(rot);B.add(holder);spin.push(rot);
    const lt=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(4,.3,.25),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));lt.position.set(x,y0+86,z);lt.scale.set(9,9,1);B.add(lt);}
  // 屋上の回転レーダーとアンテナ群
  {const rd=new THREE.Group();rd.position.set(300,RWY_Y+25,372);const dish=new THREE.Mesh(new THREE.BoxGeometry(12,4.5,.6),paleM);dish.position.y=5;dish.rotation.x=-.25;rd.add(dish);
    rd.add(new THREE.Mesh(new THREE.CylinderGeometry(.6,.9,5,8),darkM));rd.userData={ax:'y',sp:1.3};B.add(rd);spin.push(rd);
    for(let k=0;k<5;k++){const m=new THREE.Mesh(new THREE.CylinderGeometry(.12,.2,9+k*2.5,5),darkM);m.position.set(276+k*5,RWY_Y+28+k*1.2,424);B.add(m);}}
  // 燃料タンクと配管
  for(let k=0;k<3;k++){const t=new THREE.Mesh(new THREE.CylinderGeometry(15,15,20,28),paleM);t.position.set(440,RWY_Y+10,-40+k*44);t.castShadow=true;B.add(t);
    const cap=new THREE.Mesh(new THREE.SphereGeometry(15,28,8,0,6.283,0,1.2),hullM);cap.scale.y=.42;for(const by of[4,10,16]){const bnd=new THREE.Mesh(new THREE.TorusGeometry(15.15,.3,6,48),copperM);bnd.rotation.x=Math.PI/2;bnd.position.set(440,RWY_Y+by,-40+k*44);B.add(bnd);}cap.position.set(440,RWY_Y+20,-40+k*44);B.add(cap);
    const r=new THREE.Mesh(new THREE.TorusGeometry(15.2,.25,6,48),cyM);r.rotation.x=Math.PI/2;r.position.set(440,RWY_Y+15,-40+k*44);B.add(r);}
  box(B,1.2,1.2,130,darkM,418,RWY_Y+1.2,4);box(B,90,1.2,1.2,darkM,372,RWY_Y+1.2,-62);
  // 太陽光パネルの列
  {// 地面の起伏に合わせて 1 枚ずつ高さを決め、支柱で持ち上げる
    const pg=new THREE.BoxGeometry(11,.3,5.5),pm=std({color:lin(0x0c1a33),roughness:.12,metalness:.9}),N=96,im=new THREE.InstancedMesh(pg,pm,N),d=new THREE.Object3D();
    const lg=new THREE.BoxGeometry(.25,1,.25),legs=new THREE.InstancedMesh(lg,darkM,N*2);let n=0,m=0;
    for(let i=0;i<12;i++)for(let j=0;j<8;j++){const x=170+i*13,z=-470+j*9;
      const g=Math.max(islandH(x-5.5,z-2.6),islandH(x+5.5,z-2.6),islandH(x-5.5,z+2.6),islandH(x+5.5,z+2.6),islandH(x,z)),y=g+2.4;
      d.position.set(x,y,z);d.rotation.set(-.42,0,0);d.scale.set(1,1,1);d.updateMatrix();im.setMatrixAt(n++,d.matrix);
      for(const sx of[-4,4]){const gy=islandH(x+sx,z)-.6,h=y-gy;d.position.set(x+sx,gy+h/2,z);d.rotation.set(0,0,0);d.scale.set(1,h,1);d.updateMatrix();legs.setMatrixAt(m++,d.matrix);}}
    im.castShadow=true;B.add(im);B.add(legs);}
  // 駐機中の無人機と地上車両
  for(const pz of[-120,60]){const dr=new THREE.Group();dr.position.set(250,RWY_Y+1.6,pz);dr.add(new THREE.Mesh(new THREE.BoxGeometry(5,1.3,8),hullM));
    for(const[ax,az]of[[-5,-4],[5,-4],[-5,4],[5,4]]){const arm=new THREE.Mesh(new THREE.BoxGeometry(.4,.3,.4),darkM);arm.position.set(ax,.5,az);dr.add(arm);const rt=new THREE.Mesh(new THREE.CylinderGeometry(3.2,3.2,.12,20),darkM);rt.position.set(ax,.9,az);dr.add(rt);
      const bm=new THREE.Mesh(new THREE.BoxGeometry(Math.abs(ax)*2,.25,.5),hullM);bm.position.set(0,.4,az);dr.add(bm);}
    dr.traverse(o=>{if(o.isMesh)o.castShadow=true;});B.add(dr);}
  for(const[kind,x,z,c,ry]of[['tug',225,150,0xd9a21b,.5],['gpu',243,146,0xd9a21b,-.4],['fuel',253,176,0xc9ced2,1.2],['fire',235,112,0xb3261c,-1.3],['follow',215,70,0xd9a21b,3.0],['tug',262,128,0xe8e8e0,2.2]]){const v=buildVehicle(kind,c);v.position.set(x,RWY_Y+.02,z);v.rotation.y=ry;LOD.add(v);}
  // 進入灯の柱と PAPI
  for(let k=0;k<4;k++)box(B,1.2,.8,1.2,new THREE.MeshBasicMaterial({color:k<2?new THREE.Color(4,.3,.2):new THREE.Color(4,4,4)}),-48-k*4,RWY_Y+.8,-820);
  buildPort(LOD,{darkM,paleM,box,conc,glassM});Object.assign(B.userData,{socks:LOD.userData.socks});
  // 灯火
  const lp=[],lc=[];const add=(x,y,z,r,g,b)=>{lp.push(x,y,z);lc.push(r,g,b);};
  for(let z=-940;z<=940;z+=60){add(-34,RWY_Y+.8,z,3,2.8,2.2);add(34,RWY_Y+.8,z,3,2.8,2.2);}
  for(let k=-4;k<=4;k++){add(k*7,RWY_Y+.8,-952,.3,4,.6);add(k*7,RWY_Y+.25,951,4,.3,.2);}
  for(let z=-900;z<=900;z+=30)add(0,RWY_Y+.25,z,z>600?3.2:2.4,z>600?(z>780?.4:1.6):2.3,z>600?(z>780?.3:1.2):2.0);
  for(let z=-900;z<=-150;z+=30)for(const s of[-1,1])for(let k=0;k<3;k++)add(s*(9+k*1.5),RWY_Y+.25,z,2.4,2.3,2.0);
  const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(lp,3));lg.setAttribute('color',new THREE.Float32BufferAttribute(lc,3));
  runwayLights=new THREE.Points(lg,new THREE.PointsMaterial({map:GLOWTEX,size:2.6,sizeAttenuation:true,vertexColors:true,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
  B.add(runwayLights);
  // 動かない部品は材質ごとに 1 つへまとめる（描画の呼び出し回数を減らす）
  {B.updateMatrixWorld(true);const cols=[],bx=new THREE.Box3(),skip=o=>{for(let q=o;q&&q!==B;q=q.parent)if(q===HG)return true;return false;};
    B.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||!o.visible||skip(o))return;const m=o.material;if(Array.isArray(m)||m.transparent||m.depthWrite===false||m.blending===THREE.AdditiveBlending)return;if(o.geometry.attributes.position.count>20000)return;
      bx.setFromObject(o);const hy=bx.max.y-bx.min.y,sx=bx.max.x-bx.min.x,sz=bx.max.z-bx.min.z,gy=Math.max(islandH(bx.min.x/2+bx.max.x/2-BASE.x,bx.min.z/2+bx.max.z/2-BASE.z),0);
      if(hy<2.5||bx.max.y<gy+5||sx>700||sz>700)return;const wd=Math.max(sx,sz);cols.push([bx.min.x,bx.min.y,bx.min.z,bx.max.x,bx.max.y,bx.max.z,wd<11&&hy>wd*2.2?1:0,o.userData.rock?1:0]);});
    B.userData.colliders=cols;}
  mergeStatic(HG);mergeStatic(LOD);mergeStatic(B.userData.lodLH);
}

// ───────────────────────── 竜巻（海上竜巻） ─────────────────────────
let spoutMat;
function buildSpout(){
  if(!spoutMat)spoutMat=new THREE.ShaderMaterial({
    uniforms:{uTime:U.uTime,tNoise2:U.tNoise2,uLight:{value:1},uFlashI:U.uFlashI},transparent:true,depthWrite:true,side:THREE.DoubleSide,
    vertexShader:`uniform float uTime;varying vec2 vUv;varying vec3 vN;varying vec3 vV;
void main(){vUv=uv;vec3 p=position;float h=uv.y;
  p.x+=sin(h*5.0+uTime*0.7)*26.0*h*(1.0-h)*2.0+h*h*40.0;p.z+=cos(h*4.0+uTime*0.5)*22.0*h*(1.0-h)*2.0;
  vec4 mv=modelViewMatrix*vec4(p,1.0);vN=normalMatrix*normal;vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uTime,uLight,uFlashI;uniform sampler2D tNoise2;varying vec2 vUv;varying vec3 vN;varying vec3 vV;
float sat(float x){return clamp(x,0.0,1.0);}
void main(){
  float n=texture2D(tNoise2,vec2(vUv.x*3.0+vUv.y*2.4-uTime*0.8,vUv.y*2.2-uTime*0.22)).b;
  float n2=texture2D(tNoise2,vec2(vUv.x*8.0-uTime*1.5,vUv.y*6.0-uTime*0.5)).b;
  float f=abs(dot(normalize(vN),normalize(vV)));
  float a=smoothstep(0.0,0.85,f)*(0.35+0.65*n)*smoothstep(0.0,0.04,vUv.y);
  float far=1.0-smoothstep(3200.0,5200.0,length(vV));a*=(1.0-smoothstep(0.94,1.0,vUv.y)*0.9)*far;if(a<0.2)discard;
  vec3 c=mix(vec3(0.05,0.057,0.068),vec3(0.2,0.22,0.25),n*0.55+n2*0.45)*(uLight+uFlashI*2.0);
  gl_FragColor=vec4(c*0.8,sat(a*1.7));
}`});
  const g=new THREE.Group();
  const col=new THREE.Mesh(new THREE.CylinderGeometry(84,17,640,28,48,true),spoutMat);col.position.y=310;g.add(col);
  const spray=new THREE.Mesh(new THREE.CylinderGeometry(14,95,46,28,6,true),spoutMat);spray.position.y=20;g.add(spray);
  const fun=new THREE.Mesh(new THREE.CylinderGeometry(260,60,170,28,8,true),spoutMat);fun.position.y=700;g.add(fun);
  g.traverse(o=>{o.frustumCulled=false;});
  return g;
}

// ───────────────────────── 雷・マーカーなどのオーバーレイ ─────────────────────────
const BOLT_MAX=140;
function makeBolt(){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(BOLT_MAX*8*3),3));
  const uv=new Float32Array(BOLT_MAX*8*2);for(let i=0;i<BOLT_MAX*2;i++){uv.set([0,0,1,0,0,1,1,1],i*8);}
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  const idx=[];for(let i=0;i<BOLT_MAX*2;i++){const o=i*4;idx.push(o,o+1,o+2,o+1,o+3,o+2);}
  g.setIndex(idx);
  const m=new THREE.Mesh(g,glowMat(new V3(26,30,44),1));m.frustumCulled=false;m.visible=false;overlay.add(m);
  return{mesh:m,life:0};
}
const _ba=new V3(),_bb=new V3(),_bu=new V3(),_bv=new V3(),_bd=new V3();
function shapeBolt(b,from,to,width){
  const pts=[];
  const sub=(a,c,amp,depth,out)=>{
    if(depth===0){out.push(a);return;}
    const m=a.clone().lerp(c,.5);m.x+=(rnd()-.5)*amp;m.y+=(rnd()-.5)*amp*.4;m.z+=(rnd()-.5)*amp;
    sub(a,m,amp*.52,depth-1,out);sub(m,c,amp*.52,depth-1,out);};
  const len=from.distanceTo(to),main=[];sub(from.clone(),to.clone(),len*.22,5,main);main.push(to.clone());
  const segs=[];for(let i=0;i<main.length-1;i++)segs.push([main[i],main[i+1],1]);
  for(let k=0;k<6;k++){const i=3+Math.floor(rnd()*24),a=main[i],e=a.clone().add(new V3((rnd()-.5)*len*(k<3?.5:.26),-len*(.08+rnd()*(k<3?.22:.12)),(rnd()-.5)*len*(k<3?.5:.26))),br=[];
    sub(a.clone(),e,len*.08,3,br);br.push(e);for(let j=0;j<br.length-1;j++)segs.push([br[j],br[j+1],.45]);}
  const p=b.mesh.geometry.attributes.position;let n=0;
  for(const[a,c,w]of segs){if(n>=BOLT_MAX)break;
    _bd.subVectors(c,a).normalize();_bu.set(_bd.z,0,-_bd.x);if(_bu.lengthSq()<1e-4)_bu.set(1,0,0);_bu.normalize();_bv.crossVectors(_bd,_bu);
    for(const ax of[_bu,_bv]){const o=n*8+(ax===_bv?4:0),ww=width*w;
      p.setXYZ(o,a.x-ax.x*ww,a.y-ax.y*ww,a.z-ax.z*ww);p.setXYZ(o+1,a.x+ax.x*ww,a.y+ax.y*ww,a.z+ax.z*ww);
      p.setXYZ(o+2,c.x-ax.x*ww,c.y-ax.y*ww,c.z-ax.z*ww);p.setXYZ(o+3,c.x+ax.x*ww,c.y+ax.y*ww,c.z+ax.z*ww);}
    n++;}
  p.needsUpdate=true;b.mesh.geometry.setDrawRange(0,n*12);b.mesh.visible=true;b.life=.32;
}
function makeRing(radius,color,tube){
  const m=new THREE.Mesh(new THREE.TorusGeometry(radius,tube||3,8,56),glowMat(color,0));m.frustumCulled=false;m.visible=false;overlay.add(m);return m;
}
function makeBillboard(color){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),glowMat(color,3));m.frustumCulled=false;m.visible=false;overlay.add(m);return m;
}
function makeColumn(){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,28,1,true),glowMat(new V3(.8,.085,.05),4));m.frustumCulled=false;m.visible=false;overlay.add(m);return m;
}
// 翼端の飛行機雲リボン
const TRAIL_N=34;
function makeTrail(){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(TRAIL_N*2*3),3));
  g.setAttribute('aA',new THREE.BufferAttribute(new Float32Array(TRAIL_N*2),1));
  const uv=new Float32Array(TRAIL_N*4),idx=[];
  for(let i=0;i<TRAIL_N;i++){uv[i*4]=0;uv[i*4+1]=i/TRAIL_N;uv[i*4+2]=1;uv[i*4+3]=i/TRAIL_N;if(i<TRAIL_N-1){const o=i*2;idx.push(o,o+1,o+2,o+1,o+3,o+2);}}
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(idx);
  const m=new THREE.Mesh(g,glowMat(new V3(.9,.95,1),1,{defines:{MODE:1,USE_AA:1}}));m.frustumCulled=false;overlay.add(m);
  return{mesh:m,pts:[],acc:0};
}
function pushTrail(tr,pos,right,str,dt,w){
  tr.acc+=dt;
  if(tr.acc>0.035||!tr.pts.length){tr.acc=0;tr.pts.unshift({p:pos.clone(),r:right.clone(),s:str});if(tr.pts.length>TRAIL_N)tr.pts.pop();}
  else{tr.pts[0].p.copy(pos);tr.pts[0].r.copy(right);tr.pts[0].s=str;}
  const P=tr.mesh.geometry.attributes.position,A=tr.mesh.geometry.attributes.aA;
  for(let i=0;i<TRAIL_N;i++){const q=tr.pts[Math.min(i,tr.pts.length-1)],ww=(w||.5)*(1+i*.12),f=1-i/(TRAIL_N-1);
    P.setXYZ(i*2,q.p.x-q.r.x*ww,q.p.y-q.r.y*ww,q.p.z-q.r.z*ww);P.setXYZ(i*2+1,q.p.x+q.r.x*ww,q.p.y+q.r.y*ww,q.p.z+q.r.z*ww);
    const a=i<tr.pts.length?q.s*f*f:0;A.setX(i*2,a);A.setX(i*2+1,a);}
  P.needsUpdate=true;A.needsUpdate=true;
}
function resetTrail(tr){tr.pts.length=0;}

// ───────────────────────── 装甲板（被弾で剥がれる） ─────────────────────────
const FUS=[[-12.6,.02],[-12.1,.3],[-10.6,.82],[-8.2,1.32],[-5,1.74],[-1,1.95],[4,1.86],[8,1.42],[11,.82],[12.2,.42],[12.4,.02]];
function fusR(z){for(let i=0;i<FUS.length-1;i++){const a=FUS[i],b=FUS[i+1];if(z<=b[0])return lerp(a[1],b[1],(z-a[0])/(b[0]-a[0]));}return 0;}
// 原型機の胴体断面（旋盤形状と同じスプラインから半径を引く）
const ORIG_PTS=[[-9.9,2.3],[-9,2.42],[-6.5,2.62],[-3,2.5],[1,1.85],[5,.95],[9,.56],[12.8,.42],[13.3,.02]];let ORIG_TAB=null;
function origR(z){if(!ORIG_TAB)ORIG_TAB=new THREE.SplineCurve(ORIG_PTS.map(p=>new THREE.Vector2(p[1],p[0]))).getPoints(44);const T=ORIG_TAB;for(let i=0;i<T.length-1;i++)if(z<=T[i+1].y){const t=(z-T[i].y)/(T[i+1].y-T[i].y);return lerp(T[i].x,T[i+1].x,clamp(t,0,1));}return .02;}
function shellGeo(z0,z1,t0,t1,off,rf,sy){
  const n=6,pos=[],idx=[];
  for(let i=0;i<=n;i++)for(let j=0;j<=n;j++){const z=lerp(z0,z1,i/n),th=lerp(t0,t1,j/n),r=(rf||fusR)(z)+off;pos.push(Math.sin(th)*r,Math.cos(th)*r*(sy||.9),z);}
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){const a=i*(n+1)+j,b=a+1,c=a+n+1,d=c+1;idx.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function addArmor(g){
  const plates=[],pc=lin(g.userData.bodyHex||0x98a1a9).multiplyScalar(.7),pm=panelize(std({color:pc,metalness:.72,roughness:.36,side:THREE.DoubleSide})),
    sms=[0,1].map(v=>{const t=scarTex(v),m=std({map:t.map,emissiveMap:t.em,emissive:new THREE.Color(2.4,2.2,2.0),bumpMap:t.bump,bumpScale:.05,alphaTest:.5,metalness:.35,roughness:.62,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});return m;});g.userData.scarMats=sms;let sn=0;
  const SHA=g.userData.shape,fit=q=>{if(SHA.fus)q.scale(SHA.fus,1,1);return q;};
  const add=(geo,sgeo,x,y,z,ry,rz)=>{const k=sn++,uv=sgeo.attributes.uv;if(uv){for(let i=0;i<uv.count;i++)uv.setXY(i,k&2?1-uv.getX(i):uv.getX(i),k&4?1-uv.getY(i):uv.getY(i));}
    const s=new THREE.Mesh(sgeo,sms[k&1]),p=new THREE.Mesh(geo,pm);
    for(const m of[s,p]){m.position.set(x,y,z);m.rotation.set(0,ry,rz||0);g.add(m);}if(sgeo.type==='PlaneGeometry')s.position.y-=.004;s.visible=false;p.castShadow=true;
    plates.push({mesh:p,scar:s,home:p.position.clone(),homeQ:p.quaternion.clone(),on:true,vel:new V3(),av:new V3(),life:0});};
  // 原型機は機首寄りの胴体に（支柱と丸窓を避ける）
  if(SHA.orig)for(const[z0,z1]of[[-9.7,-8.3],[-8.1,-6.7],[-6.5,-5.1]])for(const[t0,t1]of[[-1.25,-.45],[-.4,.4],[.45,1.25]])
    add(shellGeo(z0,z1,t0,t1,.07,origR,.86),shellUV(z0+.02,z1-.02,t0+.01,t1-.01,.012,origR,.86),0,0,0,0);
  else for(const[z0,z1,tt]of[[-2.4,.3,[[-1.3,-.62],[-.52,.18],[.3,1.2]]],[.6,4.1,[[-1.15,-.2],[-.1,.7],[.82,1.32]]],[4.4,6.9,[[-1.32,-.7],[-.58,.42],[.54,1.1]]]])for(const[t0,t1]of tt)
    add(fit(shellGeo(z0,z1,t0,t1,.07)),fit(shellUV(z0+.02,z1-.02,t0+.01,t1-.01,.012)),0,0,0,0);
  const WA=g.userData.wingAt,S0=g.userData.shape.st;
  const ar=mulberry(77);
  for(const s of[1,-1])for(const[fx0,w0]of(s>0?[[.24,2.9],[.55,2.2],[.84,2.1]]:[[.36,2.3],[.66,2.8],[.9,1.6]])){const fx=fx0+(ar()-.5)*.05,w=w0;const ax=lerp(S0[0][0],S0[2][0],fx),q=WA(ax),q2=WA(ax+1),d=Math.min(1.9,q.c*.3);
    add(new THREE.BoxGeometry(w,.07,d),new THREE.PlaneGeometry(w*.98,d*.98).rotateX(-Math.PI/2),s*ax,q.y+q.th*q.c*.55+.015,q.le+q.c*(s>0?.3:.4),-s*Math.atan2((q2.le+q2.c*.34)-(q.le+q.c*.34),1)+(ar()-.5)*.25,s*Math.atan2(q2.y-q.y,1));}
  // 剥がれる順番（散らす）
  const ord=[4,9,1,12,7,10,3,13,0,6,11,5,14,2,8];
  return ord.map(i=>plates[i]);
}

// ───────────────────────── ディフューザー（気象制御弾） ─────────────────────────
function buildDiffuser(){
  const g=new THREE.Group();
  const white=std({color:lin(0xc4cace),metalness:.6,roughness:.34}),dark=std({color:lin(0x14181c),metalness:.75,roughness:.4}),
    amber=std({color:lin(0xd69a14),metalness:.3,roughness:.5}),cy=new THREE.MeshBasicMaterial({color:new THREE.Color(.35,2.6,3.6)});
  g.add(new THREE.Mesh(latheZ([[-3.7,.02],[-3.45,.17],[-2.8,.34],[-1.9,.42],[2.5,.42],[3.0,.36],[3.35,.27]],20),white));
  const seek=new THREE.Mesh(new THREE.SphereGeometry(.19,14,10),dark);seek.position.z=-3.52;g.add(seek);
  // 放射リングと、その間の黒い帯
  for(const z of[-1.5,-.5,.5]){const r=new THREE.Mesh(new THREE.TorusGeometry(.445,.04,8,28),cy);r.position.z=z;g.add(r);
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.428,.428,.5,24,1,true),dark);b.rotation.x=Math.PI/2;b.position.z=z+.5;g.add(b);}
  const hz=new THREE.Mesh(new THREE.CylinderGeometry(.43,.43,.22,24,1,true),amber);hz.rotation.x=Math.PI/2;hz.position.z=1.85;g.add(hz);
  const hz2=hz.clone();hz2.position.z=-2.35;hz2.scale.set(.92,1,.92);g.add(hz2);
  // 後退角つきの安定翼 4 枚
  const fs=new THREE.Shape();fs.moveTo(0,0);fs.lineTo(1.25,0);fs.lineTo(1.25,.34);fs.lineTo(.95,.78);fs.lineTo(.55,.78);fs.closePath();
  const fg=new THREE.ExtrudeGeometry(fs,{depth:.045,bevelEnabled:false});fg.translate(0,0,-.022);fg.rotateY(-Math.PI/2);
  for(let k=0;k<4;k++){const f=new THREE.Group();f.rotation.z=k*Math.PI/2+Math.PI/4;const m=new THREE.Mesh(fg,white);m.position.set(0,.36,2.05);f.add(m);g.add(f);}
  const noz=new THREE.Mesh(new THREE.CylinderGeometry(.2,.29,.4,16,1,true),dark);noz.rotation.x=Math.PI/2;noz.position.z=3.5;g.add(noz);
  const fl=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(1.6,3.2,5),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
  fl.position.z=4.1;fl.scale.set(2.6,2.6,1);fl.visible=false;g.add(fl);g.userData.flame=fl;
  g.traverse(o=>{if(o.isMesh&&o.material.isMeshStandardMaterial)o.castShadow=true;});
  return g;
}

// ───────────────────────── 機体の細部 ─────────────────────────
function shellUV(z0,z1,t0,t1,off,rf,sy){
  const n=8,pos=[],uv=[],idx=[];
  for(let i=0;i<=n;i++)for(let j=0;j<=n;j++){const z=lerp(z0,z1,i/n),th=lerp(t0,t1,j/n),r=(rf||fusR)(z)+off;pos.push(Math.sin(th)*r,Math.cos(th)*r*(sy||.9),z);uv.push(i/n,1-j/n);}
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){const a=i*(n+1)+j,b=a+1,c=a+n+1,d=c+1;idx.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
let RESCT=null;
function rescueTex(){if(RESCT)return RESCT;const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');
  x.fillStyle='#e3b21c';x.beginPath();x.moveTo(250,32);x.lineTo(214,6);x.lineTo(214,18);x.lineTo(96,18);x.lineTo(96,46);x.lineTo(214,46);x.lineTo(214,58);x.fill();
  x.fillStyle='#10151a';x.font='bold 20px Arial';x.textBaseline='middle';x.fillText('RESCUE',106,33);
  x.fillStyle='#b3261c';x.beginPath();x.moveTo(44,6);x.lineTo(84,58);x.lineTo(4,58);x.fill();x.fillStyle='#fff';x.beginPath();x.moveTo(44,18);x.lineTo(72,52);x.lineTo(16,52);x.fill();
  x.fillStyle='#b3261c';x.font='bold 9px Arial';x.textAlign='center';x.fillText('EJECTION',44,40);x.fillText('SEAT',44,48);
  RESCT=new THREE.CanvasTexture(c);RESCT.encoding=THREE.sRGBEncoding;RESCT.anisotropy=8;return RESCT;}
function labelTex(txt,accent){
  const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');
  x.fillStyle='#'+accent.toString(16).padStart(6,'0');x.fillRect(8,96,300,10);
  x.fillStyle='#10151a';x.font='bold 84px "Helvetica Neue",Arial,sans-serif';x.textBaseline='alphabetic';x.fillText(txt,8,84);
  x.font='bold 22px Arial';x.fillText('MIZUHA WX CONTROL',320,104);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return t;
}
let FANTEX;
function fanTex(){
  if(FANTEX)return FANTEX;const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#050607';x.fillRect(0,0,128,128);x.translate(64,64);
  for(let i=0;i<22;i++){x.rotate(Math.PI*2/22);x.fillStyle=i%2?'#3a3f45':'#22262b';x.beginPath();x.moveTo(0,0);x.lineTo(60,-5);x.lineTo(62,7);x.closePath();x.fill();}
  x.fillStyle='#5a6067';x.beginPath();x.arc(0,0,15,0,7);x.fill();
  return FANTEX=new THREE.CanvasTexture(c);
}
function hinge(g,p0,p1,depth,mat,tk){
  tk=tk||.2;
  // p0→p1 がヒンジ線。後縁側へ depth だけ伸びる動翼
  const xA=p1.clone().sub(p0),len=xA.length();xA.normalize();
  const zA=new V3(0,0,1);zA.addScaledVector(xA,-zA.dot(xA)).normalize();const yA=new V3().crossVectors(zA,xA);
  const h=new THREE.Group();h.position.copy(p0).add(p1).multiplyScalar(.5);h.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA,yA,zA));
  // 厚みは翼に合わせ、後縁へ向かって薄くする（翼の中に埋もれないように）
  const geo=new THREE.BoxGeometry(len,tk,depth,1,1,4);geo.translate(0,0,depth/2);{const pa=geo.attributes.position;for(let i=0;i<pa.count;i++)pa.setY(i,pa.getY(i)*(1-.86*pa.getZ(i)/depth));geo.computeVertexNormals();}
  const m=new THREE.Mesh(geo,mat);m.castShadow=true;h.add(m);
  const gap=new THREE.Mesh(new THREE.BoxGeometry(len,tk+.012,.05),new THREE.MeshBasicMaterial({color:0x050607}));h.add(gap);
  g.add(h);return m;
}
function detailAircraft(g,accentHex,label){
  const ud=g.userData;
  const dark=std({color:lin(0x14181c),metalness:.7,roughness:.45}),metal=std({color:lin(0x80858a),metalness:.95,roughness:.26}),
    hot=std({color:lin(0x54463a),metalness:.92,roughness:.36,side:THREE.DoubleSide}),ctrl=panelize(std({color:lin(ud.bodyHex||0x98a1a9).multiplyScalar(.86),metalness:.62,roughness:.44}),ud.wx);
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  // 機首の観測ブームと風向ベーン（台風観測機の定番装備）
  const boom=add(new THREE.CylinderGeometry(.04,.085,5.4,8),metal,0,0,-16.5);boom.rotation.x=Math.PI/2;
  add(new THREE.BoxGeometry(.7,.02,.14),dark,0,0,-18.0);add(new THREE.BoxGeometry(.02,.7,.14),dark,0,0,-18.4);
  const tip=add(new THREE.CylinderGeometry(.06,.06,.5,8),std({color:lin(0xb3261c),roughness:.5,metalness:.2}),0,0,-18.95);tip.rotation.x=Math.PI/2;
  const OR=ud.shape.orig;
  if(!OR)for(const s of[1,-1]){const pt=add(new THREE.CylinderGeometry(.022,.022,1,6),metal,s*.98,.3,-10.9);pt.rotation.x=Math.PI/2;pt.rotation.z=s*.12;}
  // ブレードアンテナと排気口
  const bl=new THREE.BoxGeometry(.05,.5,.55);if(!OR){add(bl,dark,0,1.98,-1.9);add(bl,dark,0,1.9,3.6);add(bl,dark,0,-1.72,5.2);add(bl,dark,.5,-1.6,-6.5);}else{add(bl,dark,0,2.44,-6.6);add(bl,dark,0,.84,6.5);}
  const STD=!OR&&!(ud.shape.fus>1);
  if(STD)for(const s of[1,-1]){add(new THREE.BoxGeometry(.04,.3,.9),dark,s*1.94,.55,-3.6).rotation.z=-s*.12;}
  // 操縦席：風防を半透明にして中を作る
  if(ud.canopy){const cm=ud.canopy.material=ud.canopy.material.clone();ENVMATS.push(cm);cm.transparent=true;cm.opacity=.46;cm.depthWrite=false;cm.envMapIntensity=1.8;cm.color=lin(0x1a2a36);}
  const ckDark=std({color:lin(0x101316),roughness:.8,metalness:.2}),lamp=c=>new THREE.MeshBasicMaterial({color:c}),ckMetal=std({color:lin(0x3a4148),roughness:.45,metalness:.8});
  ud.heads=[];ud.sticks=[];
  if(!OR){
    // 風防の内側：胴体上面の傾きに合わせた床の上に、計器盤・HUD・側方の操作盤・座席と操縦士を置く
    const ck=new THREE.Group();ck.position.set(0,1.36,-6.3);ck.rotation.x=-.1;g.add(ck);
    const C=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);ck.add(o);return o;};
    {const dg=new THREE.CylinderGeometry(1,1,.12,32),pa=dg.attributes.position;for(let i=0;i<pa.count;i++){const z=pa.getZ(i);if(z<0)pa.setX(i,pa.getX(i)*(1-.5*z*z));}C(dg,ckDark,0,.03,.1).scale.set(.8,1,3.1);}
    // 風防の縁をぐるりと回る枠
    {const pts=[];for(let k=0;k<40;k++){const a=k/40*Math.PI*2,sz=Math.sin(a);pts.push(new V3(Math.cos(a)*.79*(sz<0?1-.5*sz*sz:1),.1,.1+sz*3.06));}
      C(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,true),80,.035,6,true),ckMetal,0,0,0);}
    instrPanel(ck,1.0,.29,-1.5);
    // HUD：支柱 2 本と、表示の映る合成ガラス
    for(const s of[1,-1])C(new THREE.BoxGeometry(.02,.2,.02),dark,s*.17,.6,-1.5);
    const hg=C(new THREE.PlaneGeometry(.38,.26),new THREE.MeshBasicMaterial({map:hudTex(),color:new THREE.Color(1.4,1.4,1.4),transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}),0,.66,-1.5);hg.rotation.x=-.3;hg.castShadow=false;
    const hgl=C(new THREE.PlaneGeometry(.38,.26),new THREE.MeshBasicMaterial({color:new THREE.Color(.12,.5,.25),transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}),0,.66,-1.499);hgl.rotation.x=-.3;hgl.castShadow=false;
    // 風防枠の後写鏡
    for(const s of[1,-1])C(new THREE.BoxGeometry(.12,.05,.02),ckMetal,s*.3,.63,-1.86);
    for(const s of[1,-1]){
      C(new THREE.BoxGeometry(.28,.2,2.2),ckDark,s*.5,.16,-.05);consoleTop(ck,.24,2.1,s*.5,.262,-.05);
      for(let k=0;k<2;k++){const kn=C(new THREE.CylinderGeometry(.03,.035,.04,10),ckMetal,s*.5,.28,-.7+k*1.2);}
    }
    // スロットル（左の操作盤の上、2 本）
    for(const dx of[-.035,.035]){C(new THREE.BoxGeometry(.03,.14,.03),ckMetal,-.42+dx,.33,-.1);C(new THREE.BoxGeometry(.05,.05,.09),dark,-.42+dx,.41,-.1);}
    const cw=new THREE.Group();cw.scale.setScalar(.9);cw.position.set(0,.01,.04);ck.add(cw);
    const cr=crewSeat(cw,0,0,0x5a6a3c);ud.heads.push(cr.head);ud.sticks.push(cr.stick);
    // 座席の後ろ：電子機器の棚と、風防を押し上げる支柱
    C(new THREE.BoxGeometry(.62,.26,.8),ckDark,0,.2,1.45);consoleTop(ck,.5,.6,0,.332,1.45);
    {const a=new V3(0,.33,1.15),b=new V3(0,.62,1.0),d=new V3().subVectors(b,a),o=C(new THREE.CylinderGeometry(.025,.03,d.length(),8),ckMetal,0,0,0);o.position.copy(a).addScaledVector(d,.5);o.quaternion.setFromUnitVectors(new V3(0,1,0),d.normalize());}
    // 風防の枠：弓形 3 本（風防と同じ傾き・同じ絞り）と、後ろ 2 本をつなぐ背骨
    const cs=ud.canopy.scale.x,cy=ud.canopy.scale.y;
    for(const zl of[-1.8,.9,2.2]){const r=1.2*Math.sqrt(1-(zl/3.48)**2),b=new THREE.Mesh(new THREE.TorusGeometry(r,zl<0?.06:.045,6,26,Math.PI),dark);b.position.z=zl;b.scale.set(cs*(zl<0?1-.5*(zl/3.48)**2:1),cy,1);ud.canopyG.add(b);}
    {const pts=[];for(let k=0;k<=8;k++){const zl=.9+k/8*1.3;pts.push(new V3(0,1.2*cy*Math.sqrt(1-(zl/3.48)**2),zl));}ud.canopyG.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,.03,6),dark));}
  }else{
    // 原型機：丸い風防の中の操縦室。床・後ろの隔壁・並列 2 席・計器盤・中央の操作台・頭上の操作盤
    const fl=add(new THREE.CylinderGeometry(1,1,.08,36),ckDark,0,-.82,-10.2);fl.scale.set(2.08,1,3.1);
    const bh=add(new THREE.CircleGeometry(2.26,36),ckDark,0,-.02,-9.72);bh.rotation.y=Math.PI;bh.scale.set(1,.86,1);
    add(new THREE.BoxGeometry(.9,1.7,.06),ckMetal,0,.05,-9.76);add(new THREE.BoxGeometry(.06,.2,.05),ckDark,.32,.05,-9.8);
    add(new THREE.BoxGeometry(.5,.05,.03),lamp(0x8a5a12),0,1.0,-9.8).castShadow=false;
    // 隔壁の左右の機器棚
    for(const s of[1,-1]){add(new THREE.BoxGeometry(.8,1.2,.2),ckDark,s*1.25,-.1,-9.84);const r=new THREE.Mesh(new THREE.PlaneGeometry(.7,1.1),new THREE.MeshBasicMaterial({map:consoleTex(),color:new THREE.Color(1.2,1.2,1.2)}));r.position.set(s*1.25,-.1,-9.945);r.rotation.y=Math.PI;r.castShadow=false;g.add(r);}
    const ck=new THREE.Group();ck.position.set(0,-.54,-11.5);ck.scale.setScalar(1.5);g.add(ck);
    const C=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);ck.add(o);return o;};
    for(const s of[1,-1]){C(new THREE.BoxGeometry(.56,.16,.62),ckDark,s*.56,-.09,.38);const cr=crewSeat(ck,s*.56,0,s>0?0x5a6a3c:0x6a5a3c);ud.heads.push(cr.head);ud.sticks.push(cr.stick);
      C(new THREE.BoxGeometry(.2,.3,1.3),ckDark,s*1.02,.0,.1);consoleTop(ck,.17,1.2,s*1.02,.152,.1);}
    instrPanel(ck,1.5,.22,-.95);
    C(new THREE.BoxGeometry(.3,.34,1.1),ckDark,0,.0,-.3);consoleTop(ck,.26,1.0,0,.172,-.3);
    for(const dx of[-.05,.05]){C(new THREE.BoxGeometry(.03,.14,.03),ckMetal,dx,.24,-.35);C(new THREE.BoxGeometry(.05,.05,.09),dark,dx,.32,-.35);}
    // 頭上の操作盤（隔壁から伸びる梁に吊る）
    C(new THREE.BoxGeometry(.1,.07,1.75),ckMetal,0,1.02,.33);C(new THREE.BoxGeometry(.7,.06,.6),ckDark,0,.97,-.1);
    {const o=consoleTop(ck,.6,.5,0,.938,-.1);o.rotation.x=Math.PI/2;}
  }
  // エンジン：ファン、可変ノズル
  ud.noz=[];
  for(const s of[1,-1]){
    const sp=add(new THREE.ConeGeometry(.27,.7,14),metal,s*2.55,1.25,2.6);sp.rotation.x=-Math.PI/2;
    const fan=add(new THREE.CircleGeometry(.82,26),new THREE.MeshBasicMaterial({map:fanTex(),color:0x9aa0a6}),s*2.55,1.25,2.88);fan.rotation.y=Math.PI;fan.castShadow=false;(ud.fans=ud.fans||[]).push(fan);
    const ng=new THREE.Group();ng.position.set(s*2.55,1.25,10.1);g.add(ng);
    for(let k=0;k<16;k++){const a=k/16*Math.PI*2,p=new THREE.Mesh(new THREE.BoxGeometry(.29,.035,1.15),hot);p.position.set(Math.cos(a)*.74,Math.sin(a)*.74,.5);p.rotation.z=a+Math.PI/2;p.rotation.order='ZXY';p.rotation.x=-.1;ng.add(p);}
    const ab=new THREE.Mesh(new THREE.TorusGeometry(.5,.05,6,24),new THREE.MeshBasicMaterial({color:new THREE.Color(2.4,.9,.25)}));ab.position.z=.2;ng.add(ab);
    ud.noz.push(ng);
    // 排気炎（始動時の炎と、ブースト時のショックダイヤモンド）
    {if(!ud.plumeMat)ud.plumeMat=new THREE.ShaderMaterial({uniforms:{uPow:{value:0},uAB:{value:0},uIgn:{value:0},uT:U.uTime},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
        vertexShader:'varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.0);vN=normalMatrix*normal;vV=-mv.xyz;gl_Position=projectionMatrix*mv;}',
        fragmentShader:'uniform float uPow,uAB,uIgn,uT;varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){float y=vUv.y;float f=abs(dot(normalize(vN),normalize(vV)));float core=pow(f,1.4);float dia=0.5+0.5*pow(abs(sin(y*16.0)),2.0);float fl=0.82+0.18*sin(uT*71.0+y*26.0)*sin(uT*43.0);vec3 ab=mix(vec3(0.45,0.7,2.2),vec3(2.6,1.0,0.25),smoothstep(0.0,0.75,y))*2.4*dia;vec3 dry=vec3(1.3,0.5,0.16)*0.22;vec3 ig=vec3(3.2,1.25,0.25)*(0.6+0.4*sin(uT*37.0+y*9.0));vec3 c=mix(dry,ab,uAB)+ig*uIgn;float a=pow(1.0-y,1.5)*core*fl*(uPow+uIgn);gl_FragColor=vec4(c*a,1.0);}'});
      const pg=new THREE.CylinderGeometry(.2,.62,1,18,10,true);pg.translate(0,.5,0);pg.rotateX(Math.PI/2);const pl=new THREE.Mesh(pg,ud.plumeMat);pl.position.set(s*2.55,1.25,10.5);pl.frustumCulled=false;g.add(pl);(ud.plumes=ud.plumes||[]).push(pl);}
    // 補助吸気口と編隊灯
    add(new THREE.BoxGeometry(.03,.09,1.3),new THREE.MeshBasicMaterial({color:new THREE.Color(.10,.34,.09)}),s*3.62,1.25,5.9).castShadow=false;
    if(STD&&(q=>-1.5<q.le-.2||-2.9>q.le+q.c)(ud.wingAt(2)))add(new THREE.BoxGeometry(.03,.08,1.2),new THREE.MeshBasicMaterial({color:new THREE.Color(.10,.34,.09)}),s*1.96,.2,-2.2).castShadow=false;
    add(new THREE.BoxGeometry(.6,.04,.5),dark,s*2.55,2.33,5.2);
  }
  for(const c of g.children){const p=c.position,ax=Math.abs(p.x);if(ax>1.7&&ax<3.8&&p.y>.6&&p.y<2.5&&p.z>2.4&&p.z<11.5)c.userData.eng=1;}
  ud.engPos=new V3(2.55,1.25,6.3);ud.engSc=1;
  // 形によってはエンジンを別の場所へ移す。左右それぞれを 1 つの組にまとめ、位置と大きさを変える
  if(ud.shape.eng){const e=ud.shape.eng,sc=e[3]||1,ex=2.55+e[0],ey=1.25+e[1],ez=6.3+e[2],grp={};
    for(const s of[1,-1]){grp[s]=new THREE.Group();grp[s].position.set(s*ex,ey,ez);grp[s].scale.setScalar(sc);}
    for(const c of g.children.slice()){const p=c.position,ax=Math.abs(p.x);if(ax>1.7&&ax<3.8&&p.y>.6&&p.y<2.5&&p.z>2.4&&p.z<11.5){const s=Math.sign(p.x);g.remove(c);if(c.userData.pylon)continue;p.x-=s*2.55;p.y-=1.25;p.z-=6.3;grp[s].add(c);}}
    const bm=ud.wetMats[0];
    for(const s of[1,-1]){g.add(grp[s]);
      if(ud.shape.saddle){const sd=add(new THREE.SphereGeometry(1,22,14),bm,s*ex,ey-.8,ez+.7);sd.scale.set(1.25,.95,4.0);sd.userData.eng=1;}
      else if(OR)add(strutFoil(new V3(s*1.7,ey+.05,ez-.2),new V3(s*(ex-.5),ey+.05,ez-.2),3.0,.2),bm,0,0,0).userData.eng=1;
      else add(strutFoil(new V3(s*.6,ey-.45,ez),new V3(s*(ex-.75),ey-.12,ez),4.4,.15),bm,0,0,0).userData.eng=1;}
    ud.engPos=new V3(ex,ey,ez);ud.engSc=sc;}
  // 動翼（補助翼・フラップ・ラダベーター）
  ud.ail=[];ud.ruv=[];
  for(const s of[1,-1]){
    const SHP=ud.shape,S0=SHP.st,hp=(ax,fr)=>{const q=ud.wingAt(ax);return new V3(s*ax,q.y,q.le+q.c*fr);},wtk=(a,b)=>{const p=ud.wingAt(a),q=ud.wingAt(b);return(p.th*p.c+q.th*q.c)*.32+.03;};
    const x1=lerp(S0[1][0],S0[2][0],.14),x2=lerp(S0[1][0],S0[2][0],.9),ch=(ud.wingAt(x1).c+ud.wingAt(x2).c)*.5;
    ud.ail.push(hinge(g,hp(x1,.78),hp(x2,.78),ch*.2,ctrl,wtk(x1,x2)));
    {const y1=lerp(S0[0][0],S0[1][0],.22),y2=lerp(S0[0][0],S0[1][0],.94);hinge(g,hp(y1,.82),hp(y2,.8),Math.min(1.1,(ud.wingAt(y1).c+ud.wingAt(y2).c)*.08),ctrl,wtk(y1,y2));}
    if(SHP.tail==='v')ud.ruv.push(hinge(g,new V3(s*1.16,1.33,10.3),new V3(s*2.52,3.6,11.24),.8,ctrl));
    else if(SHP.tail==='twin')ud.ruv.push(hinge(g,new V3(s*2.72,2.9,9.75),new V3(s*3.26,5.5,10.75),.8,ctrl));
    else if(SHP.tail==='h')ud.ruv.push(hinge(g,new V3(s*4.8,.9,11.7),new V3(s*4.8,3.15,12.0),.5,ctrl));
    else if(SHP.tail==='orig')ud.ruv.push(hinge(g,new V3(s*.75,1.0,12.55),new V3(s*2.3,2.95,12.9),.5,ctrl));
    else if(SHP.tail==='none')ud.ruv.push(new THREE.Group());
    else if(SHP.tail==='join'){if(s>0){const rd=hinge(g,new V3(0,2.0,10.55),new V3(0,5.6,11.9),.75,ctrl);ud.ruv.push(rd,rd);}}
    else{if(s>0){const rd=hinge(g,new V3(0,1.9,10.35),new V3(0,5.4,11.75),.95,ctrl);ud.ruv.push(rd,rd);}}
    // 放電索
    for(let k=0;k<4;k++){const ax=lerp(S0[1][0]+1.5,S0[2][0]-.3,k/3),q=ud.wingAt(ax),d=add(new THREE.CylinderGeometry(.012,.012,.55,4),dark,s*ax,q.y+.02,q.le+q.c+.25);d.rotation.x=Math.PI/2;d.castShadow=false;}
    // フラップの軌道覆い（主翼下面の舟形）
    for(const f of[.38,.82]){const ax=lerp(S0[0][0],S0[1][0],f),q=ud.wingAt(ax),cn=add(new THREE.SphereGeometry(1,14,10),ud.wetMats[0],s*ax,q.y-.3*q.th*q.c-.02,q.le+q.c*.8);cn.scale.set(.13,.13,Math.min(1.0,q.c*.16));}
    // 主翼下の観測ポッド（雲粒子の計測器）：支柱・胴・先端の検出部
    {const ax=lerp(S0[1][0],S0[2][0],.42),q=ud.wingAt(ax),py=q.y-.3*q.th*q.c,pz=q.le+q.c*.42,wh=std({color:lin(0xdfe3e6),roughness:.4,metalness:.3});
      add(strutFoil(new V3(s*ax,py+.12,pz+.1),new V3(s*ax,py-.5,pz+.1),.8,.12),ud.wetMats[0],0,0,0);
      const pb=add(latheZ([[-1.15,.02],[-.95,.13],[-.4,.17],[.6,.17],[1.0,.1],[1.15,.02]],14),wh,s*ax,py-.62,pz);
      const rg=add(new THREE.CylinderGeometry(.175,.175,.16,14,1,true),ud.wetMats[2],s*ax,py-.62,pz-.2);rg.rotation.x=Math.PI/2;
      for(const d of[-.07,.07]){const pr=add(new THREE.CylinderGeometry(.018,.018,.5,6),metal,s*ax+d,py-.62,pz-1.25);pr.rotation.x=Math.PI/2;}}
    // 翼端灯の電球
    {const tp=ud.tipPos,bl=add(new THREE.SphereGeometry(.07,10,8),new THREE.MeshBasicMaterial({color:s>0?new THREE.Color(.2,2.2,.5):new THREE.Color(2.4,.2,.15)}),s*tp.x,tp.y,tp.z);bl.castShadow=false;}
    // 前縁の防氷ブーツ
    for(let k=0;k<2;k++){const a=S0[k],b=S0[k+1],ax=k?a[0]:1.9,qa=ud.wingAt(ax),L=Math.hypot(b[0]-ax,b[2]-qa.le),le=add(new THREE.BoxGeometry(L,OR?.16:.1,OR?.5:.2),OR?ud.wetMats[2]:dark,s*(ax+b[0])/2,(qa.y+b[1])/2+.01,(qa.le+b[2])/2+.07);le.rotation.y=-s*Math.atan2(b[2]-qa.le,b[0]-ax);le.rotation.z=s*Math.atan2(b[1]-qa.y,b[0]-ax);}
  }
  // 救出標識と射出座席の警告（操縦席の下）
  if(!OR){const rm=new THREE.MeshStandardMaterial({map:rescueTex(),transparent:true,roughness:.6,metalness:.1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});ENVMATS.push(rm);
    for(const q of[shellUV(-4.1,-5.7,1.0,1.26,.012),shellUV(-5.7,-4.1,-1.0,-1.26,.012)]){q.scale(ud.shape.fus||1,1,1);g.add(new THREE.Mesh(q,rm));}}
  // 機番
  const lm=new THREE.MeshStandardMaterial({map:labelTex(label,accentHex),transparent:true,roughness:.6,metalness:.2,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});ENVMATS.push(lm);
  if(!OR)for(const q of[shellUV(-7.2,-10.6,1.12,1.72,.012),shellUV(-10.6,-7.2,-1.12,-1.72,.012)]){q.scale(ud.shape.fus||1,1,1);g.add(new THREE.Mesh(q,lm));}
}
function buildGear(sh,hex){
  const chrome=std({color:lin(0xdfe3e6),metalness:1,roughness:.12});
  const g=new THREE.Group(),st=std({color:lin(0xb9bec2),metalness:.9,roughness:.3}),tire=std({color:lin(0x0c0d0e),metalness:0,roughness:.95}),hub=std({color:lin(0x6d7277),metalness:.8,roughness:.4}),door=std({color:lin(hex||0x98a1a9).multiplyScalar(.86),metalness:.6,roughness:.45,side:THREE.DoubleSide});
  // top：脚柱の付け根の高さ（前脚は胴体下面の中、主脚は主翼下面の中まで）
  const leg=(x,z,twin,top)=>{
    const h=top+2.35,a=new THREE.Mesh(new THREE.CylinderGeometry(.13,.15,h,10),st);a.position.set(x,top-h/2,z);g.add(a);
    const tr=new THREE.Mesh(new THREE.BoxGeometry(.6,.34,1.0),hub);tr.position.set(x,top-.1,z);g.add(tr);
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.085,.085,1.1,12),chrome);b.position.set(x,-2.55,z);g.add(b);
    // トルクリンク（くの字の 2 枚）と、内筒の付け根の環
    {const bar=(y0,z0,y1,z1)=>{const L=Math.hypot(y1-y0,z1-z0),m=new THREE.Mesh(new THREE.BoxGeometry(.12,L,.045),hub);m.position.set(x,(y0+y1)/2,z+(z0+z1)/2);m.rotation.x=Math.atan2(z1-z0,y1-y0);g.add(m);};
      const yt=Math.min(top-.05,-2.12);bar(yt,-.12,-2.62,-.4);bar(-2.62,-.4,-3.0,-.1);
      const pin=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.2,8),chrome);pin.rotation.z=Math.PI/2;pin.position.set(x,-2.62,z-.4);g.add(pin);
      const col=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.1,12),hub);col.position.set(x,Math.min(top-.02,-2.3),z);g.add(col);}
    if(x===0){// 前脚：着陸灯と泥よけ
      const lh=new THREE.Mesh(new THREE.CylinderGeometry(.11,.09,.14,12),hub);lh.rotation.x=Math.PI/2;lh.position.set(0,-2.05,z-.2);g.add(lh);
      const ll=new THREE.Mesh(new THREE.CircleGeometry(.095,14),new THREE.MeshBasicMaterial({color:new THREE.Color(3,2.9,2.5)}));ll.rotation.y=Math.PI;ll.position.set(0,-2.05,z-.275);g.add(ll);
      const mg=new THREE.Mesh(new THREE.CylinderGeometry(.56,.56,.72,16,1,true,Math.PI*.15,Math.PI*.55),door);mg.rotation.z=Math.PI/2;mg.position.set(0,-3.1,z);g.add(mg);}
    const l=new THREE.Mesh(new THREE.BoxGeometry(.05,.7,.07),hub);l.position.set(x,-2.35,z+.22);l.rotation.x=.5;g.add(l);
    const bl=Math.hypot(top+2.1,1.2),br=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,bl,6),st);br.position.set(x,(top-2.1)/2,z+.6);br.rotation.x=Math.atan2(1.2,top+2.1);g.add(br);
    for(const o of twin?[-.3,.3]:[0]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.26,18),tire);w.rotation.z=Math.PI/2;w.position.set(x+o,-3.1,z);g.add(w);
      const hb=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.28,12),hub);hb.rotation.z=Math.PI/2;hb.position.set(x+o,-3.1,z);g.add(hb);
      const rim=new THREE.Mesh(new THREE.TorusGeometry(.31,.03,6,20),chrome);rim.rotation.y=Math.PI/2;rim.position.set(x+o+(o<0||(!o&&x<0)?-.135:.135),-3.1,z);g.add(rim);}
    const ax=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,twin?.8:.4,8),hub);ax.rotation.z=Math.PI/2;ax.position.set(x,-3.1,z);g.add(ax);
    const dh=(top+2.35)*.62,d=new THREE.Mesh(new THREE.BoxGeometry(.04,dh,1.6),door);d.position.set(x+(x===0?.5:Math.sign(x)*.55),top-dh/2-.05,z);d.rotation.z=x===0?.22:Math.sign(x)*.26;g.add(d);
  };
  const gp=sh&&sh.gear||[2.5,.02];
  leg(0,-7.6,true,-1.0);leg(-gp[0],2.3,false,gp[1]);leg(gp[0],2.3,false,gp[1]);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  return g;
}

// ───────────────────────── 船とイルカ ─────────────────────────
function buildShip(kind){
  const g=new THREE.Group();g.userData.kind=kind;
  const sec=(z,w,top,d)=>[new V3(-w,top,z),new V3(-w,0,z),new V3(-w*.82,-d,z),new V3(w*.82,-d,z),new V3(w,0,z),new V3(w,top,z)];
  if(kind==='cargo'){
    const hull=std({color:lin(0x18222e),metalness:.4,roughness:.6,side:THREE.DoubleSide}),red=std({color:lin(0x6e1f18),metalness:.3,roughness:.7,side:THREE.DoubleSide}),deck=std({color:lin(0x5a2f26),roughness:.85,metalness:.1}),white=std({color:lin(0xd6d9da),roughness:.6,metalness:.1});
    g.add(new THREE.Mesh(loft([sec(-98,.6,12,7),sec(-84,9,11,8),sec(-55,15,10,9),sec(70,15,10,9),sec(92,13,11,8),sec(98,10,11.5,5)]),hull));
    const boot=new THREE.Mesh(loft([sec(-97,.7,1.6,7.2),sec(-84,9.1,1.6,8.2),sec(-55,15.1,1.6,9.2),sec(70,15.1,1.6,9.2),sec(92,13.1,1.6,8.2),sec(98.2,10.1,1.6,5.2)]),red);g.add(boot);
    const dk=new THREE.Mesh(new THREE.BoxGeometry(29,.4,176),deck);dk.position.set(0,10,-3);g.add(dk);
    const cols=[0x9c3b2a,0x2f5d8a,0x3f7d52,0xb9862c,0x7b7f84,0x8a4a6e].map(lin),N=420,im=new THREE.InstancedMesh(new THREE.BoxGeometry(2.4,2.6,12),std({color:0xffffff,roughness:.8,metalness:.2}),N),d=new THREE.Object3D(),r=mulberry(kind.length+g.id);let n=0;
    for(let bay=0;bay<10;bay++)for(let row=0;row<10;row++){const h=2+Math.floor(r()*4);for(let k=0;k<h&&n<N;k++){d.position.set(-11.7+row*2.6,11.6+k*2.65,-74+bay*13.2);d.updateMatrix();im.setMatrixAt(n,d.matrix);im.setColorAt(n,cols[Math.floor(r()*cols.length)]);n++;}}
    im.count=n;im.instanceColor.needsUpdate=true;g.add(im);
    const br=new THREE.Mesh(new THREE.BoxGeometry(27,22,13),white);br.position.set(0,21,78);g.add(br);
    const wn=new THREE.Mesh(new THREE.BoxGeometry(27.2,1.8,13.2),std({color:lin(0x0f1a24),roughness:.1,metalness:.9}));wn.position.set(0,29.5,78);g.add(wn);
    const fn=new THREE.Mesh(new THREE.CylinderGeometry(2.6,3.2,11,12),std({color:lin(0x1f4f7a),roughness:.6,metalness:.3}));fn.position.set(0,37,84);g.add(fn);
    const ms=new THREE.Mesh(new THREE.CylinderGeometry(.25,.4,14,6),white);ms.position.set(0,39,74);g.add(ms);
    // 船首楼・船橋ウイング・救命艇・レーダー・手すり・船名
    const fc=new THREE.Mesh(loft([sec(-98,.5,3.2,0),sec(-86,8.6,3.2,0),sec(-72,13.6,3.2,0),sec(-70,13.6,3.2,0)]),hull);fc.position.y=10;g.add(fc);
    for(const s of[-1,1]){const wg=new THREE.Mesh(new THREE.BoxGeometry(7,1.2,5),white);wg.position.set(s*16.5,30,74);g.add(wg);
      const lb=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,8,10),std({color:lin(0xd9571b),roughness:.6,metalness:.1}));lb.rotation.x=Math.PI/2;lb.position.set(s*12,14,90);g.add(lb);
      const rl=new THREE.Mesh(new THREE.BoxGeometry(.15,.15,176),white);rl.position.set(s*14.6,11.6,-3);g.add(rl);
      for(let k=0;k<12;k++){const p=new THREE.Mesh(new THREE.BoxGeometry(.12,1.4,.12),white);p.position.set(s*14.6,10.9,-88+k*16);g.add(p);}}
    const rdr=new THREE.Mesh(new THREE.BoxGeometry(5,.4,.5),white);rdr.position.set(0,46.4,74);g.add(rdr);g.userData.radar=rdr;
    const band=new THREE.Mesh(new THREE.CylinderGeometry(2.72,2.9,2.4,12,1,true),std({color:lin(0xe8e8e2),roughness:.6}));band.position.set(0,39.5,84);g.add(band);
    const mast2=new THREE.Mesh(new THREE.CylinderGeometry(.2,.35,12,6),white);mast2.position.set(0,17,-90);g.add(mast2);
    {const c=document.createElement('canvas');c.width=512;c.height=64;const x=c.getContext('2d');x.fillStyle='#e9ecec';x.font='bold 46px Arial';x.fillText('OCEAN LARK',6,48);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;
      for(const s of[-1,1]){const nm=new THREE.Mesh(new THREE.PlaneGeometry(26,3.2),new THREE.MeshStandardMaterial({map:t,transparent:true,roughness:.7}));nm.position.set(s*13.3,7.4,-76);nm.rotation.y=s*Math.PI/2-s*.19;g.add(nm);}}
    for(const[x,y,z]of[[0,48,74],[-13,32,78],[13,32,78],[0,24,-90]]){const l=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(2.2,2,1.6),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));l.position.set(x,y,z);l.scale.set(5,5,1);g.add(l);}
    g.userData.len=196;g.userData.beam=30;
  }else if(kind==='patrol'){
    const grey=std({color:lin(0xa9b1b7),metalness:.4,roughness:.5,side:THREE.DoubleSide}),dk=std({color:lin(0x3a4149),metalness:.5,roughness:.5}),glass=std({color:lin(0x0e1a24),roughness:.08,metalness:.9});
    g.add(new THREE.Mesh(loft([sec(-36,.3,6.5,2.6),sec(-26,4.2,6,3),sec(-6,6,5.2,3.2),sec(28,6,4.6,3),sec(35,5,4.6,1.8)]),grey));
    const dk1=new THREE.Mesh(new THREE.BoxGeometry(11.4,.3,58),dk);dk1.position.set(0,5,4);g.add(dk1);
    const s1=new THREE.Mesh(new THREE.BoxGeometry(9,4.2,20),grey);s1.position.set(0,7.3,-8);g.add(s1);
    const s2=new THREE.Mesh(new THREE.BoxGeometry(7.4,3,9),grey);s2.position.set(0,10.9,-11);g.add(s2);
    const wn=new THREE.Mesh(new THREE.BoxGeometry(7.6,1.1,9.2),glass);wn.position.set(0,11.4,-11);g.add(wn);
    const ms=new THREE.Mesh(new THREE.CylinderGeometry(.2,.5,10,6),dk);ms.position.set(0,17.4,-8);g.add(ms);
    const yd=new THREE.Mesh(new THREE.BoxGeometry(7,.25,.3),dk);yd.position.set(0,19.5,-8);g.add(yd);
    const rdr=new THREE.Mesh(new THREE.BoxGeometry(3.4,.3,.4),dk);rdr.position.set(0,13.4,-12);g.add(rdr);g.userData.radar=rdr;
    const fn=new THREE.Mesh(new THREE.BoxGeometry(3,4.5,5),dk);fn.position.set(0,9.6,5);g.add(fn);
    const pad=new THREE.Mesh(new THREE.CylinderGeometry(5.4,5.4,.2,24),dk);pad.position.set(0,5.3,24);g.add(pad);
    const pr=new THREE.Mesh(new THREE.TorusGeometry(4.4,.14,5,32),new THREE.MeshBasicMaterial({color:new THREE.Color(1.8,1.8,1.6)}));pr.rotation.x=Math.PI/2;pr.position.set(0,5.45,24);g.add(pr);
    const gun=new THREE.Mesh(new THREE.SphereGeometry(1.3,10,8),grey);gun.position.set(0,6.2,-24);g.add(gun);
    const st=new THREE.Mesh(new THREE.BoxGeometry(12.3,.9,10),std({color:lin(0x1f4f7a),roughness:.6}));st.position.set(0,3.2,-14);st.rotation.z=0;g.add(st);
    g.userData.len=72;g.userData.beam=12;
  }else{
    const hull=std({color:lin(0xe4e6e3),metalness:.2,roughness:.6,side:THREE.DoubleSide}),blue=std({color:lin(0x1f4a78),roughness:.6,metalness:.2});
    g.add(new THREE.Mesh(loft([sec(-14,.3,3.4,1.6),sec(-9,3,3,1.9),sec(8,3.6,2.6,1.9),sec(13,3,2.6,1.2)]),hull));
    const cb=new THREE.Mesh(new THREE.BoxGeometry(4.6,3.2,6),hull);cb.position.set(0,4.2,-2);g.add(cb);
    const rf=new THREE.Mesh(new THREE.BoxGeometry(5.2,.3,6.8),blue);rf.position.set(0,5.9,-2);g.add(rf);
    const ms=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,7,6),blue);ms.position.set(0,8,2.5);g.add(ms);
    const bm=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,7,6),blue);bm.position.set(0,6.4,6);bm.rotation.x=1.1;g.add(bm);
    // 窓・船体の帯・張り出し竿・網の巻き取り機・浮き
    const wn=new THREE.Mesh(new THREE.BoxGeometry(4.7,.9,6.1),std({color:lin(0x0e1a24),roughness:.1,metalness:.9}));wn.position.set(0,4.9,-2);g.add(wn);
    const stp=new THREE.Mesh(loft([sec(-13.9,.35,.5,0),sec(-9,3.05,.5,0),sec(8,3.65,.5,0),sec(12.9,3.05,.5,0)]),blue);stp.position.y=1.9;g.add(stp);
    for(const s of[-1,1]){const o=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,11,5),blue);o.position.set(s*5,7,1);o.rotation.z=-s*1.0;g.add(o);
      for(let k=0;k<3;k++){const b=new THREE.Mesh(new THREE.SphereGeometry(.45,8,6),std({color:lin(0xe0651c),roughness:.6}));b.position.set(s*2.9,3.1,6+k*1.6);g.add(b);}}
    const drum=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,3.4,12),std({color:lin(0x2f6b4f),roughness:.9}));drum.rotation.z=Math.PI/2;drum.position.set(0,3.9,9);g.add(drum);
    const lt=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(2.4,2.1,1.5),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));lt.position.set(0,11.6,2.5);lt.scale.set(2.4,2.4,1);g.add(lt);
    g.userData.len=28;g.userData.beam=7;
  }
  // 航跡（白い泡の帯）
  const L=g.userData.len,wk=new THREE.Mesh(new THREE.PlaneGeometry(1,1),glowMat(new V3(.4,.43,.45),5));wk.rotation.x=-Math.PI/2;wk.scale.set(g.userData.beam*1.5,L*3.4,1);wk.position.set(0,.6,L*2.0);wk.frustumCulled=false;
  g.userData.wake=wk;
  {const bw=new THREE.Group(),a=.3,len=L*1.15;for(const s of[-1,1]){const p=new THREE.Mesh(new THREE.PlaneGeometry(1,1),glowMat(new V3(.34,.37,.39),5));p.frustumCulled=false;p.rotation.set(-Math.PI/2,s*a,0,'YXZ');p.scale.set(g.userData.beam*.42,len,1);p.position.set(s*Math.sin(a)*len*.5,0,-L/2+Math.cos(a)*len*.5);bw.add(p);}g.userData.bow=bw;}g.traverse(o=>{if(o.isMesh)o.castShadow=false;});
  return g;
}
function buildDolphin(){
  const g=new THREE.Group(),top=std({color:lin(0x3d4a56),metalness:.2,roughness:.28}),bel=std({color:lin(0xb9c0c4),metalness:.1,roughness:.35});
  const b=new THREE.Mesh(latheZ([[-1.45,.02],[-1.3,.09],[-1.0,.2],[-.4,.3],[.2,.29],[.8,.19],[1.25,.09],[1.5,.05]],14),top);g.add(b);
  const u=new THREE.Mesh(latheZ([[-1.0,.02],[-.5,.22],[.2,.24],[.8,.12],[1.1,.02]],10),bel);u.scale.set(.82,.7,1);u.position.y=-.1;g.add(u);
  const fin=new THREE.Mesh(new THREE.ConeGeometry(.16,.42,6),top);fin.scale.set(.25,1,1.5);fin.position.set(0,.42,.05);fin.rotation.x=.5;g.add(fin);
  for(const s of[1,-1]){const fl=new THREE.Mesh(new THREE.ConeGeometry(.16,.5,6),top);fl.scale.set(1,1,.2);fl.rotation.z=s*-1.5;fl.rotation.y=s*.5;fl.position.set(s*.26,0,1.55);g.add(fl);
    const pc=new THREE.Mesh(new THREE.ConeGeometry(.09,.4,5),top);pc.scale.set(1,1,.25);pc.rotation.z=s*-2.1;pc.position.set(s*.3,-.16,-.45);g.add(pc);}
  g.scale.setScalar(1.7);return g;
}

// ───────────────────────── 格納庫の内装 ─────────────────────────
// 動かない Mesh を材質ごとに 1 つの形状へまとめる。userData.dyn の付いた枝、非表示のもの、一括描画・点・線・スプライトはそのまま残す
function mergeStatic(root){
  if(window.__NOMERGE)return;
  root.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(root.matrixWorld).invert(),bins=new Map(),kill=[];
  const walk=o=>{if(o.userData.dyn||!o.visible)return;if(o.isMesh&&!o.isInstancedMesh&&!Array.isArray(o.material)&&o.geometry.attributes.position&&!o.geometry.morphAttributes.position){
      const k=o.material.uuid+(o.castShadow?'c':'')+(o.receiveShadow?'r':'')+(o.renderOrder||0);let b=bins.get(k);if(!b)bins.set(k,b={m:o.material,c:o.castShadow,r:o.receiveShadow,ro:o.renderOrder,list:[]});b.list.push(o);kill.push(o);}
    for(const c of o.children.slice())walk(c);};
  for(const c of root.children.slice())walk(c);
  const M=new THREE.Matrix4(),N=new THREE.Matrix3(),v=new V3();
  for(const b of bins.values()){if(b.list.length<2){kill.splice(kill.indexOf(b.list[0]),1);continue;}
    let n=0;const parts=b.list.map(o=>{const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry;n+=g.attributes.position.count;return[o,g];});
    const P=new Float32Array(n*3),Nn=new Float32Array(n*3),Uv=new Float32Array(n*2);let i=0;
    for(const[o,g]of parts){M.multiplyMatrices(inv,o.matrixWorld);N.getNormalMatrix(M);const p=g.attributes.position,nm=g.attributes.normal,uv=g.attributes.uv,flip=M.determinant()<0;
      for(let k=0;k<p.count;k++){const kk=flip?k-(k%3)+(2-(k%3)):k;v.fromBufferAttribute(p,kk).applyMatrix4(M);P.set([v.x,v.y,v.z],i*3);if(nm){v.fromBufferAttribute(nm,kk).applyMatrix3(N).normalize();Nn.set([v.x,v.y,v.z],i*3);}if(uv)Uv.set([uv.getX(kk),uv.getY(kk)],i*2);i++;}
      if(g!==o.geometry)g.dispose();}
    const G=new THREE.BufferGeometry();G.setAttribute('position',new THREE.BufferAttribute(P,3));G.setAttribute('normal',new THREE.BufferAttribute(Nn,3));G.setAttribute('uv',new THREE.BufferAttribute(Uv,2));
    const m=new THREE.Mesh(G,b.m);m.castShadow=b.c;m.receiveShadow=b.r;m.renderOrder=b.ro||0;root.add(m);}
  for(const o of kill){if(o.children.length){const g=new THREE.Group();g.position.copy(o.position);g.quaternion.copy(o.quaternion);g.scale.copy(o.scale);for(const c of o.children.slice())g.add(c);o.parent.add(g);}o.parent.remove(o);}
}
// 迎撃機：双発・双垂直尾翼の制空戦闘機（架空）。機首は -z。
// 平たい胴体の下に左右のエンジン、前縁の張り出し、斜めに開いた垂直尾翼、翼下と翼端のミサイル
let FTR_DECAL=null;
function fighterDecal(){if(FTR_DECAL)return FTR_DECAL;const c=document.createElement('canvas');c.width=128;c.height=64;const x=c.getContext('2d');
  // 架空の国籍標識：白縁の赤い山形 2 本
  x.lineJoin='miter';for(const[col,lw]of[['#f2f0ea',13],['#b3261c',8]]){x.strokeStyle=col;x.lineWidth=lw;for(const oy of[0,16]){x.beginPath();x.moveTo(8,44-oy+8);x.lineTo(32,20-oy+8);x.lineTo(56,44-oy+8);x.stroke();}}
  x.fillStyle='#f2f0ea';x.font='bold 30px Arial';x.fillText('27',74,44);
  FTR_DECAL=new THREE.CanvasTexture(c);FTR_DECAL.encoding=THREE.sRGBEncoding;FTR_DECAL.anisotropy=4;return FTR_DECAL;}
function buildFighter(){
  const g=new THREE.Group(),ud=g.userData,WX=new V3(1.25,-.35,5.5);
  const top=panelize(std({color:lin(0x56626d),metalness:.55,roughness:.46,side:THREE.DoubleSide}),WX),top2=panelize(std({color:lin(0x3f4a54),metalness:.55,roughness:.46,side:THREE.DoubleSide}),WX),
    bot=panelize(std({color:lin(0x93a0aa),metalness:.5,roughness:.5,side:THREE.DoubleSide}),WX),dk=std({color:lin(0x16191c),metalness:.7,roughness:.45,side:THREE.DoubleSide}),
    radome=std({color:lin(0x2c3338),metalness:.2,roughness:.6}),hot=std({color:lin(0x4a4038),metalness:.95,roughness:.34,side:THREE.DoubleSide}),metal=std({color:lin(0x9aa0a6),metalness:.95,roughness:.25}),
    wh=std({color:lin(0xdfe3e6),roughness:.5,metalness:.3}),red=std({color:lin(0xb3261c),roughness:.6,metalness:.2,side:THREE.DoubleSide}),glass=std({color:lin(0x4a3a12),metalness:.95,roughness:.06});glass.envMapIntensity=2;
  const UP=new V3(0,1,0);
  const A=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x||0,y||0,z||0);o.castShadow=true;g.add(o);return o;};
  const L=(secs,m)=>{const o=new THREE.Mesh(loft(secs),m);o.castShadow=true;g.add(o);return o;};
  // 機首：レドーム、前部胴体、ピトー管、光学センサー
  A(latheZ([[-15.2,.02],[-14.6,.2],[-13.2,.5],[-11.8,.72]],16),radome).scale.set(1,.92,1);
  A(latheZ([[-11.8,.72],[-9,1.0],[-6,1.15],[-2.5,1.1],[0,.9]],18),top).scale.set(1,.95,1);
  {const p=A(new THREE.CylinderGeometry(.02,.045,1.9,6),metal,0,0,-16.0);p.rotation.x=Math.PI/2;}
  A(new THREE.SphereGeometry(.2,12,10),glass,.0,.98,-9.6);
  // 風防と枠、背中の盛り上がり
  const can=A(new THREE.SphereGeometry(1,22,14),glass,0,1.02,-7.2);can.scale.set(.58,.62,2.5);
  for(const z of[-8.6,-6.4]){const r=.6*Math.sqrt(1-((z+7.2)/2.5)**2),b=A(new THREE.TorusGeometry(r,.035,6,18,Math.PI),dk,0,1.02,z);b.scale.set(1,.62/.58,1);}
  A(new THREE.SphereGeometry(1,16,10),top2,0,.85,-2.6).scale.set(.6,.5,4.6);
  // 平たい中央胴体（左右のエンジンの間まで続く揚力胴体）
  L([foil(new V3(-2.5,.1,-4.6),15.2,.07,UP),foil(new V3(0,.22,-5.2),16.2,.085,UP),foil(new V3(2.5,.1,-4.6),15.2,.07,UP)],top);
  for(const s of[1,-1]){
    // 前縁の張り出し（LERX）
    L([foil(new V3(s*.7,.2,-9.6),5.2,.03,UP),foil(new V3(s*2.5,.12,-4.6),6.0,.05,UP)],top);
    // エンジン：吸気口（斜めの口と境界層の隙間）、胴、可変ノズル、噴射
    const ex=s*1.3,ey=-.55;
    A(new THREE.BoxGeometry(1.3,1.15,3.4),bot,ex,ey,-2.2);{const lip=A(new THREE.BoxGeometry(1.34,1.19,.5),bot,ex,ey+.12,-4.05);lip.rotation.x=.42;}
    A(new THREE.BoxGeometry(1.1,.95,.06),dk,ex,ey+.02,-3.86).rotation.x=.42;
    A(new THREE.BoxGeometry(1.3,.08,2.4),dk,ex,ey+.62,-2.6);
    A(latheZ([[-.6,.72],[1.5,.86],[5,.88],[8,.8],[9.3,.74]],18),bot,ex,ey+.12,0);
    A(latheZ([[9.3,.76],[10.0,.72],[10.9,.6]],18),hot,ex,ey+.12,0);
    for(let k=0;k<12;k++){const a=k/12*6.283,p=A(new THREE.BoxGeometry(.3,.03,1.0),hot,ex+Math.cos(a)*.66,ey+.12+Math.sin(a)*.66,10.4);p.rotation.z=a+Math.PI/2;}
    A(new THREE.CircleGeometry(.55,16),new THREE.MeshBasicMaterial({color:new THREE.Color(4.2,2.0,.7)}),ex,ey+.12,10.5);
    const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(1.3,.65,.25),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));gl.position.set(ex,ey+.12,11.5);gl.scale.set(5,5,1);g.add(glowLOD(gl,30,.3));(ud.glows=ud.glows||[]).push(gl);
    {const pg=new THREE.CylinderGeometry(.12,.56,1,14,1,true);pg.translate(0,.5,0);pg.rotateX(Math.PI/2);const pl=new THREE.Mesh(pg,new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,.75,.35),transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));pl.position.set(ex,ey+.12,10.9);pl.frustumCulled=false;g.add(pl);(ud.plumes=ud.plumes||[]).push(pl);}
    // 主翼（後退角 42°、わずかな下反角）と動翼の線、翼端のランチャー
    L([foil(new V3(s*2.5,.1,-3.2),8.6,.05,UP),foil(new V3(s*5.2,.04,-.6),5.4,.045,UP),foil(new V3(s*8.0,-.04,2.2),2.4,.04,UP)],top);
    L([foil(new V3(s*4.6,.07,-2.6),2.2,.06,UP),foil(new V3(s*7.4,-.01,.6),1.6,.05,UP)],top2);
    {const h=A(new THREE.BoxGeometry(3.6,.07,.06),dk,s*5.3,.06,3.6);h.rotation.y=-s*.2;const h2=A(new THREE.BoxGeometry(2.0,.07,.06),dk,s*3.4,.1,4.3);h2.rotation.y=-s*.06;}
    A(new THREE.BoxGeometry(.12,.12,3.4),dk,s*8.05,-.04,3.3);
    // 水平尾翼（全遊動式）
    L([foil(new V3(s*2.1,-.05,7.4),4.0,.05,UP),foil(new V3(s*5.3,-.12,10.0),1.5,.04,UP)],top);
    // 垂直尾翼（外へ 14° 開く）、方向舵の線、先端のアンテナ、腹びれ
    const cu=new V3(.97,-.24*s,0).normalize();
    L([foil(new V3(s*2.0,.5,4.2),5.0,.055,cu),foil(new V3(s*2.5,2.6,6.2),3.3,.05,cu),foil(new V3(s*2.95,4.5,8.0),1.9,.045,cu)],top2);
    L([foil(new V3(s*2.95,4.5,8.0),1.9,.05,cu),foil(new V3(s*3.06,4.95,8.4),1.5,.05,cu)],dk);
    {const r=A(new THREE.BoxGeometry(.05,3.0,.07),dk,s*2.56,2.75,8.75);r.rotation.z=-s*.245;r.rotation.x=-.42;}
    L([foil(new V3(s*1.9,-1.2,6.6),2.6,.05,new V3(1,0,0)),foil(new V3(s*2.2,-2.1,7.4),1.3,.04,new V3(1,0,0))],bot);
    // 標識（主翼上面と垂直尾翼の外側）
    {const dm=new THREE.MeshStandardMaterial({map:fighterDecal(),alphaTest:.5,roughness:.6,metalness:.1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3});ENVMATS.push(dm);
      const d1=A(new THREE.PlaneGeometry(2.8,1.4),dm,s*5.0,.25,1.3);d1.rotation.x=-Math.PI/2;d1.castShadow=false;
      const n=new V3(s*.97,-.24,0).normalize(),u=new V3(s*.24,.97,0).normalize(),xa=new V3().crossVectors(u,n);
      const d2=A(new THREE.PlaneGeometry(2.0,1.0),dm,s*2.48,2.5,7.75);d2.position.addScaledVector(n,.17);d2.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xa,u,n));d2.castShadow=false;}
    // 兵装：翼下のパイロン 2 つと翼端。ミサイルは胴・前後の小翼・先端のシーカー
    const missile=(x,y,z,len)=>{const m=A(new THREE.CylinderGeometry(.1,.1,len,10),wh,x,y,z);m.rotation.x=Math.PI/2;A(new THREE.SphereGeometry(.1,10,8),dk,x,y,z-len/2);
      for(const[fz,fs]of[[len/2-.25,.34],[-len/2+.9,.2]])for(const a of[Math.PI/4,-Math.PI/4]){const f=A(new THREE.BoxGeometry(fs*2,.02,.42),wh,x,y,z+fz);f.rotation.z=a;}};
    for(const[mx,mz,my,ln]of[[4.0,.6,-.52,3.6],[6.0,1.9,-.5,3.0]]){A(new THREE.BoxGeometry(.1,.34,1.6),bot,s*mx,my+.24,mz);missile(s*mx,my,mz,ln);}
    missile(s*8.05,-.2,3.1,2.9);
    // 翼端灯と編隊灯
    const nv=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:s>0?new THREE.Color(.1,1.6,.3):new THREE.Color(1.9,.12,.08),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));nv.position.set(s*8.1,0,4.6);nv.scale.set(1.2,1.2,1);g.add(glowLOD(nv,70,.18));
    A(new THREE.BoxGeometry(.03,.08,1.2),new THREE.MeshBasicMaterial({color:new THREE.Color(.5,.9,.3)}),s*1.02,.35,-10.4).castShadow=false;
  }
  // 腹：機関砲の覆い、増槽、アンテナ
  A(new THREE.BoxGeometry(.24,.2,2.6),dk,.95,.55,-8.6);
  {const t=A(latheZ([[-3.2,.02],[-2.6,.34],[0,.46],[2.4,.36],[3.2,.02]],14),bot,0,-1.25,1.4);A(new THREE.BoxGeometry(.14,.5,1.8),bot,0,-.75,1.4);}
  for(const[z,y]of[[-3.6,1.35],[2.2,.72]])A(new THREE.BoxGeometry(.04,.42,.5),dk,0,y,z);
  // 衝突防止灯
  const bc=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(4,.3,.2),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));bc.position.set(0,1.0,3.5);bc.scale.set(1.5,1.5,1);g.add(glowLOD(bc,70,.18));ud.beacon=bc;
  g.traverse(o=>{if(o.isMesh)o.frustumCulled=false;});
  // 推力に合わせて噴射の長さと光を変える
  ud.setPower=k=>{for(const p of ud.plumes)p.scale.set(1,1,1.5+k*9);for(const s of ud.glows){const q=2+k*3.5;s.scale.set(q,q,1);}};ud.setPower(.3);
  return g;
}
// 地上車両。原点は車体中央の接地面、前が -z。kind：tug 牽引車／fuel 給油車／fire 化学消防車／gpu 電源車（台車）／follow 誘導車／car 乗用車／cart 工具車
const VEH={};
function buildVehicle(kind,hex){
  if(!VEH.m){const m=(h,ro,me)=>std({color:lin(h),roughness:ro,metalness:me});
    VEH.m={tire:m(0x0d0e0f,.95,0),hub:m(0x9aa0a6,.4,.85),dark:m(0x15181b,.7,.4),steel:m(0x8b9298,.38,.85),glass:(()=>{const g=m(0x0e1a24,.06,.95);g.envMapIntensity=1.8;return g;})(),
      head:new THREE.MeshBasicMaterial({color:new THREE.Color(2.2,2.1,1.8)}),tail:new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,.12,.08)}),amber:new THREE.MeshBasicMaterial({color:new THREE.Color(2.4,1.2,.15)}),
      white:m(0xe6e8e6,.5,.2),black:m(0x101214,.6,.3),haz:null};
    const c=document.createElement('canvas');c.width=64;c.height=16;const x=c.getContext('2d');for(let i=0;i<8;i++){x.fillStyle=i%2?'#d9a21b':'#17191a';x.beginPath();x.moveTo(i*8,16);x.lineTo(i*8+8,16);x.lineTo(i*8+16,0);x.lineTo(i*8+8,0);x.fill();}
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=THREE.RepeatWrapping;VEH.m.haz=std({map:t,roughness:.6,metalness:.2});}
  const M=VEH.m,g=new THREE.Group(),paint=std({color:lin(hex),roughness:.42,metalness:.45});
  const B=(w,h,d,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);g.add(o);return o;};
  const C=(r0,r1,h,m,x,y,z,ax)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r0,r1,h,16),m);o.position.set(x,y,z);if(ax==='x')o.rotation.z=Math.PI/2;if(ax==='z')o.rotation.x=Math.PI/2;g.add(o);return o;};
  // 車輪：タイヤ・ホイール・泥よけ
  const wheel=(x,z,r,w,fender)=>{C(r,r,w,M.tire,x,r,z,'x');C(r*.55,r*.55,w+.04,M.hub,x,r,z,'x');C(r*.2,r*.2,w+.08,M.dark,x,r,z,'x');
    if(fender){const f=new THREE.Mesh(new THREE.CylinderGeometry(r*1.22,r*1.22,w*1.25,14,1,true,-Math.PI/2,Math.PI),paint);f.rotation.z=Math.PI/2;f.rotation.order='ZYX';f.position.set(x,r,z);g.add(f);}};
  const axle=(z,hw,r,w,f)=>{wheel(-hw,z,r,w,f);wheel(hw,z,r,w,f);C(.07,.07,hw*2,M.dark,0,r,z,'x');};
  // 前照灯・尾灯・バンパー・ミラー
  const face=(w,y,zf,zr)=>{for(const sx of[-1,1]){B(.34,.2,.06,M.head,sx*(w/2-.3),y,zf-.03);B(.3,.18,.06,M.tail,sx*(w/2-.28),y,zr+.03);B(.12,.1,.06,M.amber,sx*(w/2-.08),y+.18,zf-.03);}
    B(w+.12,.22,.18,M.dark,0,y-.32,zf-.06);B(w+.12,.22,.18,M.dark,0,y-.32,zr+.06);};
  const mirrors=(w,y,z)=>{for(const sx of[-1,1]){B(.28,.04,.04,M.dark,sx*(w/2+.14),y,z);B(.06,.3,.2,M.dark,sx*(w/2+.3),y,z);}};
  const beacon=(x,y,z)=>{C(.1,.12,.16,M.amber,x,y,z);const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(2.2,1.0,.15),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.position.set(x,y+.1,z);sp.scale.set(1.3,1.3,1);g.add(sp);};
  // 運転台：下半分は車体色、上半分は窓（前・左右・後ろ）と屋根
  const cab=(w,d,x,y0,z,hh)=>{hh=hh||1.0;B(w,.9,d,paint,x,y0+.45,z);B(w-.1,hh*.72,d-.16,M.glass,x,y0+.9+hh*.36,z);B(w,.1,d,paint,x,y0+.9+hh*.74,z);
    for(const sx of[-1,1])for(const sz of[-1,1])B(.09,hh*.74,.09,paint,x+sx*(w/2-.045),y0+.9+hh*.37,z+sz*(d/2-.045));
    B(w-.3,.06,.5,M.dark,x,y0+.93,z-d/2+.3);};
  if(kind==='tug'){ // 低い車体に大きな車輪、中央の運転席、前後の連結器
    B(2.5,.75,4.6,paint,0,.85,0);B(2.3,.5,1.5,paint,0,1.42,-1.45);B(2.3,.5,1.3,paint,0,1.42,1.55);B(2.6,.14,4.7,M.haz,0,.5,0);
    cab(1.9,1.5,0,1.2,.05,.95);for(const sx of[-1,1])B(.1,.5,.1,M.dark,sx*.7,1.55,-.2);
    axle(-1.5,1.15,.6,.5,true);axle(1.5,1.15,.6,.5,true);face(2.5,.95,-2.3,2.3);
    B(.3,.2,.5,M.steel,0,.55,-2.6);B(.3,.2,.5,M.steel,0,.55,2.6);C(.07,.07,.3,M.steel,0,.7,2.8);
    for(let k=0;k<5;k++)B(1.6,.03,.05,M.dark,0,1.62,-2.0+k*.14);beacon(0,2.95,.05);C(.05,.05,.7,M.steel,.7,2.15,1.9);
  }else if(kind==='fuel'){ // 運転台＋楕円の油槽、上面の歩み板、後部のホース巻き取り、はしご
    B(2.4,.3,9.2,M.dark,0,.95,0);cab(2.45,2.1,0,1.0,-3.4,1.15);B(2.45,.9,.5,paint,0,1.45,-4.55);mirrors(2.45,2.2,-4.2);
    for(let k=0;k<6;k++)B(1.5,.04,.05,M.dark,0,1.25+k*.09,-4.82);
    const tk=C(1.25,1.25,6.2,M.white,0,2.35,1.2,'z');tk.scale.set(1,.82,1);for(const z of[-1.9,4.3]){const e=new THREE.Mesh(new THREE.SphereGeometry(1.25,18,12),M.white);e.scale.set(1,.82,.28);e.position.set(0,2.35,z);g.add(e);}
    for(const z of[-.6,1.2,3.0]){const b=C(1.27,1.27,.14,paint,0,2.35,z,'z');b.scale.set(1,.82,1);}
    B(.9,.06,6,M.steel,0,3.42,1.2);for(const z of[-.3,2.7])C(.3,.3,.14,M.steel,0,3.46,z);
    for(const sx of[-1,1]){B(.1,.5,6.6,paint,sx*1.2,1.15,1.2);B(.5,.7,1.2,M.steel,sx*1.25,1.3,2.4);}
    B(.06,2.3,.06,M.steel,.35,2.25,4.62);B(.06,2.3,.06,M.steel,-.35,2.25,4.62);for(let k=0;k<6;k++)B(.7,.05,.05,M.steel,0,1.3+k*.38,4.62);
    const reel=new THREE.Mesh(new THREE.TorusGeometry(.42,.16,8,18),M.black);reel.rotation.y=Math.PI/2;reel.position.set(1.28,1.45,3.7);g.add(reel);
    B(2.2,.5,.04,M.haz,0,1.25,4.58);axle(-3.5,1.1,.52,.42,false);axle(2.3,1.1,.52,.6,false);axle(3.5,1.1,.52,.6,false);face(2.5,1.25,-4.8,4.6);beacon(0,3.25,-3.4);
  }else if(kind==='fire'){ // 空港用化学消防車：背の高い箱形、前に張り出した運転台、屋根の放水銃、3 軸
    B(2.9,2.1,8.4,paint,0,2.0,.9);B(2.8,.3,8.3,M.dark,0,.86,.9);cab(2.9,2.4,0,1.0,-4.3,1.5);B(2.92,.5,.3,M.white,0,1.3,-5.42);mirrors(2.9,2.5,-5.0);
    for(const sx of[-1,1]){for(let k=0;k<3;k++)B(.04,1.3,1.9,M.steel,sx*1.47,2.1,-1.4+k*2.3);B(.05,.16,8.2,M.white,sx*1.47,1.25,.9);}
    B(1.2,.3,1.6,M.steel,0,3.2,1.5);const tr=C(.3,.36,.4,M.dark,0,3.55,-2.6);const noz=C(.1,.14,1.9,M.steel,0,3.75,-3.5,'z');noz.rotation.x=Math.PI/2-.18;
    for(const sx of[-1,1])B(.06,.06,7.4,M.steel,sx*1.3,3.2,1.2);for(let k=0;k<5;k++)B(2.6,.05,.06,M.steel,0,3.2,-2.2+k*1.7);
    B(1.0,.5,.3,M.dark,0,.75,-5.55);C(.09,.11,.5,M.steel,0,.8,-5.8,'z');
    axle(-3.9,1.25,.72,.55,false);axle(1.6,1.25,.72,.55,false);axle(3.4,1.25,.72,.55,false);face(2.9,1.35,-5.5,5.1);
    B(1.6,.14,.3,M.dark,0,3.55,-4.6);for(const sx of[-1,1])beacon(sx*.6,3.62,-4.6);
  }else if(kind==='gpu'){ // 電源車：箱形の台車、放熱の鎧戸、操作盤、巻いたケーブル、牽引棒
    B(2.0,1.5,3.6,paint,0,1.35,0);B(2.05,.12,3.65,M.dark,0,.58,0);B(2.02,.1,3.62,M.dark,0,2.12,0);
    for(const sx of[-1,1])for(let k=0;k<8;k++)B(.04,.08,1.3,M.dark,sx*1.01,.9+k*.13,-.8);
    B(.05,.8,1.0,M.black,1.01,1.5,.9);for(let k=0;k<3;k++){B(.06,.1,.1,[M.head,M.amber,M.tail][k],1.04,1.75,.6+k*.3);C(.07,.07,.05,M.steel,1.04,1.45,.6+k*.3,'x');}
    const cb=new THREE.Mesh(new THREE.TorusGeometry(.38,.09,8,18),M.black);cb.rotation.y=Math.PI/2;cb.position.set(-1.08,1.3,.9);g.add(cb);C(.1,.1,.5,M.steel,.5,2.4,-1.2);
    axle(-1.1,.95,.36,.26,false);axle(1.1,.95,.36,.26,false);const tb=B(.1,.1,2.0,M.steel,0,.5,-2.7);tb.rotation.x=.12;C(.12,.12,.06,M.steel,0,.4,-3.7);B(2.0,.3,.04,M.haz,0,.85,1.82);
  }else if(kind==='follow'){ // 誘導車：小型トラック、荷台、屋根の表示灯、市松模様
    B(1.95,.7,5.0,paint,0,.95,0);B(1.95,.35,1.5,paint,0,1.45,-1.75);cab(1.9,1.7,0,1.25,-.3,.85);B(1.9,.5,.08,paint,0,1.55,2.46);for(const sx of[-1,1])B(.08,.5,1.9,paint,sx*.93,1.55,1.5);
    B(2.05,.25,5.1,M.haz,0,.74,0);axle(-1.6,.92,.4,.3,true);axle(1.6,.92,.4,.3,true);face(1.95,1.0,-2.5,2.5);mirrors(1.9,1.95,-1.0);
    B(1.3,.16,.3,M.dark,0,3.05,-.3);for(const sx of[-1,1])beacon(sx*.45,3.12,-.3);B(1.2,.6,.06,M.black,0,3.0,.5);
  }else if(kind==='car'){ // 乗用車：ボンネット・客室・トランクの 3 箱、丸めた屋根
    B(1.8,.55,4.4,paint,0,.72,0);B(1.72,.2,1.3,paint,0,1.05,-1.5).rotation.x=.06;B(1.72,.2,.9,paint,0,1.05,1.7);
    B(1.62,.5,2.1,M.glass,0,1.25,.15);B(1.56,.08,1.6,paint,0,1.53,.2);for(const sx of[-1,1])for(const z of[-.85,.2,1.2])B(.07,.5,.08,paint,sx*.78,1.25,z);
    axle(-1.4,.84,.34,.24,false);axle(1.35,.84,.34,.24,false);face(1.8,.8,-2.2,2.2);mirrors(1.7,1.12,-.75);
  }else{ // 工具車：引き出しの並ぶ箱、天板、押し手、小さな車輪
    B(1.1,1.5,2.4,paint,0,1.05,0);B(1.2,.08,2.5,M.steel,0,1.84,0);for(let k=0;k<5;k++){B(.03,.24,2.2,M.dark,.56,.48+k*.27,0);B(.05,.04,1.2,M.steel,.6,.5+k*.27,0);}
    for(const sz of[-1,1]){B(.05,.5,.05,M.steel,-.45,2.1,sz*1.15);}B(.05,.05,2.35,M.steel,-.45,2.35,0);
    for(const sx of[-.42,.42])for(const sz of[-1,1]){C(.13,.13,.1,M.tire,sx,.13,sz*.95,'x');B(.08,.16,.08,M.steel,sx,.25,sz*.95);}
    B(.5,.2,.4,M.amber,0,1.98,-.6);B(.3,.14,.7,M.dark,.1,1.95,.5);
  }
  g.traverse(o=>{if(o.isMesh&&o.material.isMeshStandardMaterial){o.castShadow=true;o.receiveShadow=true;}});
  return g;
}
// 灯台：石積みの台、赤い帯の入った先細りの塔、回廊と手すり、ガラスの灯室、銅の屋根、官舎。光芒が回る
function buildLighthouse(B,lx,ly,lz){
  const g=new THREE.Group();g.position.set(lx,ly,lz);B.add(g);
  const A=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
  const c=document.createElement('canvas');c.width=64;c.height=256;const x=c.getContext('2d');x.fillStyle='#ecece6';x.fillRect(0,0,64,256);x.fillStyle='#a8261c';for(const[y,h]of[[28,34],[112,34],[196,34]])x.fillRect(0,y,64,h);
  for(let i=0;i<60;i++){const X=Math.random()*64,Y=Math.random()*200;const gr=x.createLinearGradient(0,Y,0,Y+50);gr.addColorStop(0,'rgba(70,60,45,.25)');gr.addColorStop(1,'rgba(70,60,45,0)');x.fillStyle=gr;x.fillRect(X,Y,1.5,50);}
  for(const[y,sx]of[[80,10],[150,40],[230,22]]){x.fillStyle='#1b2228';x.fillRect(sx,y,5,9);}
  const tt=new THREE.CanvasTexture(c);tt.encoding=THREE.sRGBEncoding;
  const stone=std({color:lin(0x8d8a80),roughness:.95,metalness:0}),white=std({map:tt,roughness:.7,metalness:.05}),iron=std({color:lin(0x1c2024),roughness:.5,metalness:.7}),copper=std({color:lin(0x4f8f7c),roughness:.5,metalness:.6}),glass=std({color:lin(0x9fc4d0),roughness:.05,metalness:.6,transparent:true,opacity:.35});
  A(new THREE.CylinderGeometry(9,10.5,4,20),stone,0,1,0);A(new THREE.CylinderGeometry(5.2,5.6,2.4,20),stone,0,4.2,0);
  A(new THREE.CylinderGeometry(2.9,4.6,36,24),white,0,23.4,0);
  A(new THREE.BoxGeometry(1.6,2.6,.5),iron,0,6.6,4.5);
  A(new THREE.CylinderGeometry(4.6,3.4,1.0,24),iron,0,41.6,0);A(new THREE.CylinderGeometry(4.7,4.7,.25,24),iron,0,42.2,0);
  A(new THREE.TorusGeometry(4.55,.07,6,32),iron,0,43.4,0).rotation.x=Math.PI/2;for(let k=0;k<16;k++){const a=k/16*6.283;A(new THREE.CylinderGeometry(.05,.05,1.2,5),iron,Math.cos(a)*4.55,42.9,Math.sin(a)*4.55);}
  A(new THREE.CylinderGeometry(2.5,2.7,1.2,16),white,0,42.9,0);
  A(new THREE.CylinderGeometry(2.4,2.4,4.2,16,1,true),glass,0,45.6,0).castShadow=false;for(let k=0;k<8;k++){const a=k/8*6.283;A(new THREE.BoxGeometry(.12,4.2,.12),iron,Math.cos(a)*2.42,45.6,Math.sin(a)*2.42);}
  A(new THREE.CylinderGeometry(.55,.75,2.2,12),new THREE.MeshBasicMaterial({color:new THREE.Color(2.2,1.9,1.2)}),0,45.3,0);
  A(new THREE.ConeGeometry(3.1,2.6,16),copper,0,49,0);A(new THREE.SphereGeometry(.45,10,8),copper,0,50.5,0);A(new THREE.CylinderGeometry(.04,.04,2.6,5),iron,0,52,0);
  // 官舎と倉庫、石垣
  const wall=std({color:lin(0xe6e2d6),roughness:.8,metalness:0}),roof=std({color:lin(0x8a3a2a),roughness:.75,metalness:.05});
  A(new THREE.BoxGeometry(11,4.2,7),wall,-15,3.9,3);{const rf=A(new THREE.CylinderGeometry(4.6,4.6,11.6,3,1),roof,-15,7.1,3);rf.rotation.z=Math.PI/2;rf.scale.set(.62,1,1);}
  for(const wx of[-18.5,-15,-11.5])A(new THREE.BoxGeometry(1.2,1.4,.1),iron,wx,4.2,-.52);A(new THREE.BoxGeometry(.9,.9,1.6),stone,-12,8.6,4);
  A(new THREE.BoxGeometry(5,3,4),wall,-9,3.3,-8);A(new THREE.BoxGeometry(5.4,.3,4.4),roof,-9,4.95,-8);
  for(const[a0,a1]of[[.4,2.6],[3.2,6.0]]){for(let a=a0;a<a1;a+=.11)A(new THREE.BoxGeometry(2.6,1.3,.8),stone,Math.cos(a)*23,1.9,Math.sin(a)*23).rotation.y=-a+Math.PI/2;}
  A(new THREE.BoxGeometry(3,.12,26),stone,-2,3.06,17).receiveShadow=true;A(new THREE.CylinderGeometry(.09,.12,12,6),iron,8,9,10);{const fl=A(new THREE.PlaneGeometry(3.2,1.9),new THREE.MeshStandardMaterial({color:lin(0xe8e6dc),side:THREE.DoubleSide,roughness:.9}),9.7,14,10);ENVMATS.push(fl.material);const dot=A(new THREE.CircleGeometry(.55,14),new THREE.MeshBasicMaterial({color:0xb3261c,side:THREE.DoubleSide}),9.7,14,10.02);}
  {const sp=A(new THREE.BoxGeometry(3.4,.1,2.2),std({color:lin(0x14202c),roughness:.2,metalness:.8}),-22,4.6,-4);sp.rotation.x=.5;A(new THREE.BoxGeometry(.15,2,.15),iron,-22,3.4,-4);}
  for(const sx of[-.5,.5]){const h=A(new THREE.CylinderGeometry(.5,.18,1.6,10),iron,sx*1.2,42.9,-3.2);h.rotation.x=-Math.PI/2;}
  // 灯火のにじみと、回転する 2 本の光芒
  const ls=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(4,3.6,2.6),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));ls.position.set(0,45.4,0);ls.scale.set(8,8,1);g.add(ls);B.userData.lhGlow=ls;
  const bc=document.createElement('canvas');bc.width=8;bc.height=64;const bx=bc.getContext('2d'),bg=bx.createLinearGradient(0,0,0,64);bg.addColorStop(0,'#000');bg.addColorStop(.2,'#444');bg.addColorStop(1,'#fff');bx.fillStyle=bg;bx.fillRect(0,0,8,64);
  const bm=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(bc),color:new THREE.Color(1,.93,.72),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
  const beam=new THREE.Group();beam.userData.dyn=true;beam.position.y=45.4;g.add(beam);for(const sgn of[1,-1]){const geo=new THREE.CylinderGeometry(9,.5,420,14,1,true);geo.translate(0,210,0);const m=new THREE.Mesh(geo,bm);m.rotation.z=-sgn*Math.PI/2;m.rotation.x=0;m.frustumCulled=false;beam.add(m);}
  B.userData.lhBeam=beam;B.userData.lhBeamM=bm;
}
// 滑走路まわり：舗装の路肩、誘導路、進入灯、PAPI、距離標識、吹き流し
function runwayExtras(B,M){
  const{darkM,paleM,box}=M,Y=RWY_Y,asph=std({color:lin(0x3a3c3f),roughness:.92,metalness:0}),steel=std({color:lin(0x8b9298),roughness:.4,metalness:.8}),org=std({color:lin(0xe8641b),roughness:.7,metalness:0});
  const flat=(w,d,m,x,y,z)=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(w,d),m);p.rotation.x=-Math.PI/2;p.position.set(x,y,z);p.receiveShadow=true;B.add(p);return p;};
  // 路肩（両側 7.5m）と、端の転回場
  for(const sx of[-43.5,43.5])flat(8,1900,asph,sx,Y-.03,0);for(const z of[-900,900])flat(40,70,asph,-67.5,Y-.03,z*.97);
  // 誘導路（駐機場 → 滑走路）：黄色の中心線、停止位置標識、青い縁灯
  const tc=document.createElement('canvas');tc.width=512;tc.height=128;const x=tc.getContext('2d');x.fillStyle='#35373a';x.fillRect(0,0,512,128);for(let i=0;i<500;i++){const gq=44+Math.random()*26|0;x.fillStyle='rgba('+gq+','+gq+','+gq+',.12)';x.fillRect(Math.random()*512,Math.random()*128,4+Math.random()*40,4+Math.random()*24);}
  x.fillStyle='#d9a21b';x.fillRect(0,61,512,6);x.fillRect(0,3,512,3);x.fillRect(0,122,512,3);
  for(const X of[40,52]){x.fillRect(X,10,4,108);}x.setLineDash([10,8]);x.strokeStyle='#d9a21b';x.lineWidth=4;for(const X of[66,78]){x.beginPath();x.moveTo(X,10);x.lineTo(X,118);x.stroke();}
  const tt=new THREE.CanvasTexture(tc);tt.encoding=THREE.sRGBEncoding;tt.anisotropy=8;
  for(const z of[150,-420,560]){flat(112.5,26,std({map:tt,roughness:.9,metalness:0,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}),103.75,Y-.012,z);}
  {const t2=tt.clone();t2.needsUpdate=true;t2.wrapS=THREE.RepeatWrapping;t2.repeat.set(8,1);const p=flat(1010,26,std({map:t2,roughness:.9,metalness:0}),147,Y-.026,70);p.rotation.z=Math.PI/2;}
  for(const z of[150,-420,560]){for(const sz of[-15,15]){box(B,.5,1.0,.5,steel,44,Y+.5,z+sz);const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(3,1.6,.2),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.position.set(44,Y+1.2,z+sz);sp.scale.set(2.4,2.4,1);B.add(sp);}
    const sc=document.createElement('canvas');sc.width=128;sc.height=48;const sx=sc.getContext('2d');sx.fillStyle='#b3261c';sx.fillRect(0,0,128,48);sx.fillStyle='#fff';sx.font='bold 34px Arial';sx.textAlign='center';sx.textBaseline='middle';sx.fillText('18-36',64,26);const sm=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sc),color:new THREE.Color(1.3,1.3,1.3)});
    box(B,.3,1.2,3.2,sm,50,Y+1.4,z-18);for(const o of[-1.2,1.2])box(B,.12,.8,.12,steel,50,Y+.4,z-18+o);}
  // 進入灯（北側の進入端から 420m）：横木と支柱。灯りは点で描く
  const pos=[],col=[],L=(px,py,pz,r,g,b)=>{pos.push(px,py,pz);col.push(r,g,b);};
  for(let i=1;i<=14;i++){const z=-952-i*30,gy=Math.max(islandH(0,z),0),top=Y+1.2,h=top-gy,wide=i===10;
    box(B,.22,h,.22,darkM,0,gy+h/2,z);box(B,wide?30:5,.14,.14,darkM,0,top,z);if(wide)for(const sx of[-12,12])box(B,.2,h,.2,darkM,sx,gy+h/2,z);
    for(let k=-2;k<=2;k++)L(k*1.1,top+.3,z,3,3,2.8);if(wide)for(let k=-13;k<=13;k++)if(Math.abs(k)>2)L(k*1.1,top+.3,z,3,3,2.8);
    if(i<=9)for(const sx of[-1,1]){box(B,3,.14,.14,darkM,sx*9,top,z);box(B,.18,h,.18,darkM,sx*9,gy+h/2,z);for(let k=-1;k<=1;k++)L(sx*9+k*1.1,top+.3,z,3.2,.25,.15);}}
  // 進入端の緑・終端の赤、誘導路の青
  for(let k=-14;k<=14;k++){L(k*2.2,Y+.4,-951,.3,3,.5);L(k*2.2,Y+.4,951,3.2,.25,.15);}
  for(const z of[150,-420,560])for(let k=0;k<9;k++)for(const sz of[-13.5,13.5])L(38+k*14,Y+.4,z+sz,.25,.5,3.2);
  for(let k=0;k<26;k++)for(const sx of[-13.5,13.5])L(147+sx,Y+.4,-430+k*40,.25,.5,3.2);
  const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));lg.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  B.add(new THREE.Points(lg,new THREE.PointsMaterial({map:GLOWTEX,size:2.2,sizeAttenuation:true,vertexColors:true,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true})));
  // PAPI：両進入端の左側に 4 灯ずつ（脚付きの箱）
  for(const[z,dir]of[[-640,1],[640,-1]])for(let k=0;k<4;k++){const px=-(44+k*9)*dir;box(B,1.5,.7,1.9,org,px,Y+1.0,z,true);for(const sz of[-.6,.6])box(B,.1,.7,.1,steel,px,Y+.35,z+sz);
    const lens=new THREE.Mesh(new THREE.CircleGeometry(.26,10),new THREE.MeshBasicMaterial({color:k<2?new THREE.Color(4,.3,.2):new THREE.Color(4,4,4)}));lens.position.set(px,Y+1.05,z-dir*.96);lens.rotation.y=dir>0?Math.PI:0;B.add(lens);}
  // 残距離標識（300m ごと、黒地に白い数字）
  for(let n=1;n<=5;n++){const sc=document.createElement('canvas');sc.width=sc.height=64;const sx=sc.getContext('2d');sx.fillStyle='#0c0d0e';sx.fillRect(0,0,64,64);sx.fillStyle='#f2f2ee';sx.font='bold 52px Arial';sx.textAlign='center';sx.textBaseline='middle';sx.fillText(String(n),32,35);
    const st=new THREE.CanvasTexture(sc),sm=new THREE.MeshBasicMaterial({map:st,color:new THREE.Color(1.2,1.2,1.2)});for(const side of[-1,1]){const z=-950+n*300+(side>0?0:100);if(Math.abs(z)>900)continue;const b=box(B,.25,1.5,1.5,sm,side*46,Y+1.3,z);box(B,.12,.6,.12,steel,side*46,Y+.3,z);}}
  // 吹き流し（2 か所）
  const socks=[];for(const[wx,wz]of[[-58,-560],[-58,520]]){box(B,.14,7,.14,steel,wx,Y+3.5,wz);const tr=new THREE.Mesh(new THREE.TorusGeometry(.55,.04,6,14),steel);tr.position.set(wx,Y+7,wz);tr.rotation.y=Math.PI/2;B.add(tr);
    const sg=new THREE.CylinderGeometry(.55,.22,4.2,12,6,true);sg.translate(0,-2.1,0);const sk=new THREE.Mesh(sg,new THREE.MeshStandardMaterial({roughness:.9,side:THREE.DoubleSide,map:(()=>{const c=document.createElement('canvas');c.width=8;c.height=64;const x=c.getContext('2d');for(let i=0;i<5;i++){x.fillStyle=i%2?'#f2f0e8':'#e8641b';x.fillRect(0,i*12.8,8,12.8);}const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;})()}));ENVMATS.push(sk.material);sk.userData.dyn=true;sk.position.set(wx,Y+7,wz);sk.rotation.z=Math.PI/2-.25;B.add(sk);socks.push(sk);}
  B.userData.socks=socks;
}
// 港：東岸の岸壁、突堤 2 本、石積みの防波堤と入口の標識灯、門型クレーン、コンテナ、上屋、燃料タンク、係留船、基地からの道
function buildPort(B,M){
  const{darkM,paleM,box,conc,glassM}=M,r=mulberry(1717);
  const col=(h,ro,me)=>std({color:lin(h),roughness:ro===undefined?.7:ro,metalness:me===undefined?.2:me});
  const steel=col(0x8b9298,.4,.8),rust=col(0x7a4a2e,.85,.3),yel=col(0xd9a21b,.55,.3),red=col(0xb3261c,.6,.2),grn=col(0x1f8a4c,.6,.2),wht=col(0xe6e4dc,.7,.05),asph=col(0x3c3e41,.92,0),quayM=col(0x9a9890,.9,0);
  const QY=4.6,X0=1105,X1=1292,Z0=-170,Z1=470;
  // 岸壁（上面は舗装、海側に防舷材と車止め）
  box(B,X1-X0,18,Z1-Z0,quayM,(X0+X1)/2,QY-9,(Z0+Z1)/2,true);{const c=document.createElement('canvas');c.width=512;c.height=1024;const x=c.getContext('2d');x.fillStyle='#46484a';x.fillRect(0,0,512,1024);
    for(let i=0;i<2600;i++){const g=52+r()*36|0;x.fillStyle='rgba('+g+','+g+','+(g+2)+','+(.05+r()*.08)+')';x.fillRect(r()*512,r()*1024,6+r()*60,6+r()*60);}
    x.strokeStyle='rgba(20,21,22,.7)';x.lineWidth=1.5;for(let i=1;i<10;i++){x.beginPath();x.moveTo(i*51.2,0);x.lineTo(i*51.2,1024);x.stroke();}for(let j=1;j<32;j++){x.beginPath();x.moveTo(0,j*32);x.lineTo(512,j*32);x.stroke();}
    for(let i=0;i<50;i++){x.fillStyle='rgba(10,10,11,'+(.1+r()*.25)+')';x.beginPath();x.ellipse(r()*512,r()*1024,8+r()*40,6+r()*26,r()*3,0,7);x.fill();}
    x.strokeStyle='#d9a21b';x.lineWidth=3;x.strokeRect(420,10,60,1004);x.setLineDash([14,10]);x.beginPath();x.moveTo(330,0);x.lineTo(330,1024);x.moveTo(120,0);x.lineTo(120,1024);x.stroke();x.setLineDash([]);
    for(let i=0;i<60;i++){x.fillStyle=i%2?'#d9a21b':'#17191a';x.beginPath();x.moveTo(498,i*18);x.lineTo(512,i*18);x.lineTo(512,i*18+18);x.lineTo(498,i*18+18);x.fill();}
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;
    const p=new THREE.Mesh(new THREE.PlaneGeometry(X1-X0-2,Z1-Z0-2),std({map:t,roughness:.85,metalness:.05}));p.rotation.x=-Math.PI/2;p.position.set((X0+X1)/2,QY+.03,(Z0+Z1)/2);p.receiveShadow=true;B.add(p);}
  box(B,.6,.5,Z1-Z0,yel,X1-1,QY+.25,(Z0+Z1)/2);
  for(let z=Z0+12;z<Z1;z+=16){const f=new THREE.Mesh(new THREE.CylinderGeometry(1.0,1.0,3.2,10),darkM);f.position.set(X1+.5,QY-2.4,z);B.add(f);}
  // 突堤 2 本
  for(const pz of[20,330]){box(B,170,14,20,quayM,X1+85,QY-7.6,pz,true);box(B,170,.4,.5,yel,X1+85,QY-.4,pz-9.6);box(B,170,.4,.5,yel,X1+85,QY-.4,pz+9.6);
    for(let k=0;k<7;k++){const pl=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,16,8),rust);pl.position.set(X1+14+k*25,QY-9,pz+10.4);B.add(pl);const p2=pl.clone();p2.position.z=pz-10.4;B.add(p2);}}
  // 係船柱（一括描画）
  {const bg=new THREE.CylinderGeometry(.34,.44,.9,8),im=new THREE.InstancedMesh(bg,darkM,120),d=new THREE.Object3D();let n=0;const put=(x,z)=>{d.position.set(x,QY+.45,z);d.updateMatrix();im.setMatrixAt(n++,d.matrix);};
    for(let z=Z0+10;z<Z1;z+=18)put(X1-3,z);for(const pz of[20,330])for(let k=0;k<9;k++){put(X1+12+k*18,pz-8.4);put(X1+12+k*18,pz+8.4);}im.count=n;B.add(im);}
  // 石積みの防波堤：芯のコンクリートと、外側に積んだ捨て石（一括描画）
  const segs=[[X1-10,-250,1640,-150],[1640,-150,1668,40],[X1-10,560,1640,440],[1640,440,1668,250]];
  {const rg=new THREE.DodecahedronGeometry(1,0),im=new THREE.InstancedMesh(rg,col(0x6e6a62,.95,0),900),d=new THREE.Object3D();let n=0;
    for(const[ax,az,bx,bz]of segs){const L=Math.hypot(bx-ax,bz-az),ang=Math.atan2(bz-az,bx-ax),m=box(B,L+8,12,9,quayM,(ax+bx)/2,-2.6,(az+bz)/2,true);m.rotation.y=-ang;
      const w=box(B,L+8,1.2,2.2,quayM,(ax+bx)/2,3.9,(az+bz)/2);w.rotation.y=-ang;
      for(let t=0;t<L;t+=3.2)for(const side of[-1,1])for(let row=0;row<2;row++){if(n>=900)break;const u=t/L,off=side*(5.5+row*3.2+r()*1.5);d.position.set(ax+(bx-ax)*u-Math.sin(ang)*off,1.6-row*2.2+r()*.8,az+(bz-az)*u+Math.cos(ang)*off);const sc=2+r()*1.6;d.scale.set(sc,sc*.75,sc);d.rotation.set(r()*3,r()*3,r()*3);d.updateMatrix();im.setMatrixAt(n++,d.matrix);}}
    im.count=n;im.castShadow=true;B.add(im);}
  // 港口の標識灯（左舷側は赤、右舷側は緑）
  for(const[x,z,m,c]of[[1668,44,red,[3.5,.25,.15]],[1668,246,grn,[.25,3.2,.6]]]){const t=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.7,11,12),m);t.position.set(x,9,z);t.castShadow=true;B.add(t);box(B,3.2,.3,3.2,darkM,x,14.6,z);
    const lamp=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,1.2,10),new THREE.MeshBasicMaterial({color:new THREE.Color(c[0],c[1],c[2])}));lamp.position.set(x,15.4,z);B.add(lamp);
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(c[0],c[1],c[2]),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.position.set(x,15.4,z);sp.scale.set(7,7,1);B.add(sp);}
  // 門型クレーン 2 基（脚・桁・海へ張り出す腕・運転室・つり具）
  const crane=(cz,hex)=>{const g=new THREE.Group();g.position.set(X1-16,QY,cz);B.add(g);const pm=col(hex,.5,.4);const A=(w,h,d,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
    for(const sx of[-9,9])for(const sz of[-11,11]){A(1.4,34,1.4,pm,sx,17,sz);A(2.4,1.2,3.4,darkM,sx,.6,sz);}
    for(const sz of[-11,11]){A(19.4,1.4,1.4,pm,0,12,sz);A(19.4,1.6,1.6,pm,0,34,sz);const br=A(1,25,1,pm,0,23,sz);br.rotation.z=.67;const b2=A(1,25,1,pm,0,23,sz);b2.rotation.z=-.67;}
    for(const sx of[-9,9])A(1.4,1.4,22,pm,sx,34,0);
    A(78,2.2,2.4,pm,22,36.5,-4.5);A(78,2.2,2.4,pm,22,36.5,4.5);for(let k=0;k<9;k++)A(1,1,9,pm,-14+k*9,36.5,0);
    A(1.2,16,1.2,pm,0,45,0);for(const[x0,a]of[[30,-.42],[-14,.9]]){const L=x0>0?34:22,t=A(L,.7,.7,pm,x0/2,45,0);t.rotation.z=x0>0?-.27:.62;t.position.set(x0>0?16:-7,48.6,0);}
    A(6,4,6,pm,-11,39.6,0);A(4.4,3,4.4,wht,28,33.6,0);A(4.5,1.4,.1,glassM,28,33.4,-2.26);
    A(.14,18,.14,steel,36,26,-1.6);A(.14,18,.14,steel,36,26,1.6);A(6.4,.7,2.6,yel,36,16.8,0);return g;};
  crane(60,0xc23a24);crane(230,0x1f6f8a);
  // クレーンの走行レール
  for(const rx of[X1-25,X1-7])box(B,.25,.14,Z1-Z0-30,steel,rx,QY+.1,(Z0+Z1)/2);
  // コンテナの山（色つきの一括描画）
  {const cg=new THREE.BoxGeometry(2.44,2.6,6.06),cm=new THREE.MeshStandardMaterial({roughness:.7,metalness:.35,map:(()=>{const c=document.createElement('canvas');c.width=128;c.height=64;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,128,64);for(let i=0;i<32;i++){x.fillStyle=i%2?'rgba(0,0,0,.22)':'rgba(255,255,255,.0)';x.fillRect(i*4,0,2,64);}x.fillStyle='rgba(0,0,0,.35)';x.fillRect(0,0,128,3);x.fillRect(0,61,128,3);x.fillRect(0,0,3,64);x.fillRect(125,0,3,64);x.fillStyle='rgba(255,255,255,.85)';x.fillRect(80,8,34,9);x.fillStyle='rgba(0,0,0,.5)';x.fillRect(63,4,1.5,56);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;})()});ENVMATS.push(cm);const im=new THREE.InstancedMesh(cg,cm,400),d=new THREE.Object3D(),cc=new THREE.Color();let n=0;
    const pal=[0xa8321e,0x1f5f8a,0x2f7a4a,0xc98a1c,0x7a7f84,0x8a3a5a,0xd8d4c8,0x244a6a];
    for(const[bx,bz,nx,nz]of[[1175,-125,7,6],[1175,-60,7,6],[1208,95,5,8],[1168,300,8,7]])for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const hh=r()<.15?0:1+Math.floor(r()*r()*4.2);for(let k=0;k<hh&&n<400;k++){d.position.set(bx+i*2.75,QY+1.3+k*2.62,bz+j*6.5);d.rotation.set(0,0,0);d.scale.set(1,1,1);d.updateMatrix();im.setMatrixAt(n,d.matrix);cc.set(pal[Math.floor(r()*pal.length)]).convertSRGBToLinear();im.setColorAt(n,cc);n++;}}
    im.count=n;im.castShadow=true;im.receiveShadow=true;B.add(im);}
  // 上屋 2 棟（切妻屋根、海側に大きな引き戸）と港務所
  const shedM=std({roughness:.75,metalness:.25,map:(()=>{const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');x.fillStyle='#d9d6cb';x.fillRect(0,0,512,128);for(let i=0;i<128;i++){x.fillStyle=i%2?'rgba(0,0,0,.12)':'rgba(255,255,255,.05)';x.fillRect(i*4,0,2,128);}x.fillStyle='#3d6f78';x.fillRect(0,96,512,32);for(let i=0;i<40;i++){const X=r()*512,g=x.createLinearGradient(0,0,0,90);g.addColorStop(0,'rgba(92,52,24,.3)');g.addColorStop(1,'rgba(92,52,24,0)');x.fillStyle=g;x.fillRect(X,r()*30,2+r()*3,90);}x.fillStyle='rgba(30,40,46,.85)';x.font='bold 56px Arial';x.fillText('SHED',40,72);x.fillText('MIZUHA PORT',250,72);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return t;})()});
  for(const[wx,wz,L]of[[1130,160,90],[1130,410,70]]){box(B,26,9,L,shedM,wx,QY+4.5,wz,true);const rg=new THREE.CylinderGeometry(15.2,15.2,L+2,3,1);rg.rotateX(Math.PI/2);rg.rotateZ(Math.PI);rg.scale(1,.3,1);const rf=new THREE.Mesh(rg,col(0x5f7f86,.6,.5));rf.position.set(wx,QY+11.3,wz);rf.castShadow=true;B.add(rf);
    for(let k=0;k<Math.floor(L/22);k++)box(B,.3,6.5,10,col(0x4a5a60,.6,.5),wx+13.1,QY+3.3,wz-L/2+14+k*22);}
  box(B,14,10,12,wht,1125,QY+5,-130,true);box(B,15,.5,13,col(0x8a3a2a),1125,QY+10.2,-130);box(B,10,6,.2,glassM,1132.1,QY+6,-130).rotation.y=Math.PI/2;box(B,5,4,5,wht,1125,QY+12.5,-130,true);box(B,5.2,1.6,5.2,glassM,1125,QY+13.2,-130);
  // 燃料タンク 3 基と配管
  for(let k=0;k<3;k++){const t=new THREE.Mesh(new THREE.CylinderGeometry(7,7,11,24),wht);t.position.set(1128,QY+5.5,-60+k*19);t.castShadow=true;B.add(t);const top=new THREE.Mesh(new THREE.SphereGeometry(7,24,8,0,6.3,0,1.2),wht);top.scale.y=.3;top.position.set(1128,QY+11,-60+k*19);B.add(top);
    const st=new THREE.Mesh(new THREE.TorusGeometry(7.05,.12,6,28),yel);st.rotation.x=Math.PI/2;st.position.set(1128,QY+8,-60+k*19);B.add(st);}
  {const p=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,150,8),steel);p.rotation.z=Math.PI/2;p.position.set(1210,QY+.8,-70);B.add(p);}
  // 照明塔 4 基
  for(const[lx,lz]of[[1160,-150],[1160,120],[1160,300],[1160,455]]){box(B,.5,30,.5,steel,lx,QY+15,lz);box(B,5,1.2,.6,darkM,lx,QY+30.4,lz);
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(2.6,2.4,1.9),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.position.set(lx,QY+30.4,lz);sp.scale.set(7,7,1);B.add(sp);}
  // 係留中の船：岸壁に貨物船、突堤に巡視船と漁船
  for(const[k,x,z,ry]of[['cargo',X1+17,150,0],['patrol',X1+70,20+17,Math.PI/2],['fish',X1+50,330-15,Math.PI/2],['fish',X1+95,330-15,-Math.PI/2],['fish',X1+130,330+15,Math.PI/2]]){const sh=buildShip(k);sh.position.set(x,0,z);sh.rotation.y=ry;B.add(sh);}
  // クレーンの航空障害灯と作業灯
  for(const cz of[60,230]){for(const[x,y]of[[X1-16,QY+53.2],[X1+44,QY+38.2],[X1-34,QY+38.2]]){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(3.4,.25,.15),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.position.set(x,y,cz);sp.scale.set(5,5,1);B.add(sp);}
    for(const x of[X1-6,X1+14,X1+34]){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(2.4,2.2,1.7),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.position.set(x,QY+35,cz);sp.scale.set(3.5,3.5,1);B.add(sp);}
    // はしごと踊り場
    box(B,.9,34,.12,steel,X1-25.8,QY+17,cz-11);for(let k=0;k<3;k++)box(B,2.4,.15,2.4,steel,X1-26.4,QY+9+k*9,cz-11);}
  // 構内の車両と荷
  for(const[k,x,z,c,ry]of[['tug',1215,-40,0xd9a21b,.4],['tug',1240,280,0xd9a21b,2.2],['follow',1195,200,0xe8e8e0,1.6],['fuel',1150,-20,0xc9ced2,0],['car',1140,-150,0x2c4f7a,1.57],['car',1146,-150,0xc9ced2,1.57],['cart',1262,120,0xa3261c,0],['gpu',1255,200,0xd9a21b,.3]]){const v=buildVehicle(k,c);v.position.set(x,QY+.05,z);v.rotation.y=ry;B.add(v);}
  {const pg=new THREE.BoxGeometry(1.2,1.0,1.2),im=new THREE.InstancedMesh(pg,col(0x8a6d45,.9,0),160),d=new THREE.Object3D();let n=0;for(const[bx,bz]of[[1250,-100],[1232,60],[1258,300],[1225,430],[1188,255]])for(let i=0;i<5;i++)for(let j=0;j<4;j++){const hh=1+Math.floor(r()*3);for(let k=0;k<hh&&n<160;k++){d.position.set(bx+i*1.35,QY+.5+k*1.02,bz+j*1.35);d.rotation.y=(r()-.5)*.1;d.updateMatrix();im.setMatrixAt(n++,d.matrix);}}im.count=n;im.castShadow=true;B.add(im);}
  // 係留索（船首・船尾から係船柱へ）と、岸壁の古タイヤの防舷材
  {const rope=new THREE.LineBasicMaterial({color:0x1a1a18}),pts=[];const ln=(a,b)=>{pts.push(a[0],a[1],a[2],b[0],(a[1]+b[1])/2-1.2,(a[2]+b[2])/2,b[0],(a[1]+b[1])/2-1.2,(a[2]+b[2])/2,b[0],b[1],b[2]);};
    for(const dz of[-62,-40,40,62])ln([X1+9,7.5,150+dz],[X1-3,QY+.9,150+dz+(dz>0?10:-10)]);
    for(const dx of[-18,18])ln([X1+70+dx,3.2,20+13],[X1+70+dx*1.5,QY-.2,20+8.4]);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));B.add(new THREE.LineSegments(g,rope));
    const tg=new THREE.TorusGeometry(.75,.28,6,12),im=new THREE.InstancedMesh(tg,col(0x0d0e0f,.95,0),60),d=new THREE.Object3D();let n=0;for(let z=Z0+20;z<Z1&&n<60;z+=16){d.position.set(X1+.35,QY-1.6,z+8);d.rotation.y=Math.PI/2;d.updateMatrix();im.setMatrixAt(n++,d.matrix);}im.count=n;B.add(im);}
  // 航路の浮標（港口の外に赤・緑の対）と、港内の作業船
  for(let k=0;k<3;k++)for(const[z,c,m]of[[75,[3.2,.25,.15],red],[215,[.25,3,.6],grn]]){const x=1720+k*110,bz=z+(z<150?-k*14:k*14);const b=new THREE.Mesh(new THREE.CylinderGeometry(.5,1.5,2.6,10),m);b.position.set(x,1.1,bz);B.add(b);box(B,.12,2.6,.12,steel,x,3.6,bz);
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(c[0],c[1],c[2]),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.position.set(x,5,bz);sp.scale.set(4,4,1);B.add(sp);}
  {const tb=buildShip('fish');tb.position.set(1480,0,190);tb.rotation.y=2.1;B.add(tb);}
  // 基地から港への道（地形に沿わせる）
  {const pts=[[470,300],[620,330],[800,300],[960,240],[1060,200],[1112,190]],P=[],U=[],I=[];let acc=0;const N=90;
    const at=t=>{const f=t*(pts.length-1),i=Math.min(pts.length-2,Math.floor(f)),u=f-i;return[lerp(pts[i][0],pts[i+1][0],u),lerp(pts[i][1],pts[i+1][1],u)];};
    for(let i=0;i<=N;i++){const[x,z]=at(i/N),[x2,z2]=at(Math.min(1,(i+1)/N)),[x1,z1]=at(Math.max(0,(i-1)/N)),dx=x2-x1,dz=z2-z1,l=Math.hypot(dx,dz)||1,nx=-dz/l*4.5,nz=dx/l*4.5;
      const y=Math.max(islandH(x,z),islandH(x+nx,z+nz),islandH(x-nx,z-nz))+.35;P.push(x+nx,y,z+nz,x-nx,y,z-nz);acc+=l/2;U.push(0,acc/12,1,acc/12);if(i<N){const a=i*2;I.push(a,a+1,a+2,a+1,a+3,a+2);}}
    const rc=document.createElement('canvas');rc.width=64;rc.height=64;const x=rc.getContext('2d');x.fillStyle='#3a3c3f';x.fillRect(0,0,64,64);x.fillStyle='#e9e6dc';x.fillRect(2,0,2,64);x.fillRect(60,0,2,64);x.fillStyle='#d9a21b';x.fillRect(31,0,2,36);
    const rt=new THREE.CanvasTexture(rc);rt.encoding=THREE.sRGBEncoding;rt.wrapT=THREE.RepeatWrapping;rt.anisotropy=8;
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();
    const m=new THREE.Mesh(g,std({map:rt,roughness:.9,metalness:0,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2}));m.receiveShadow=true;B.add(m);}
}
// 格納庫の内装の作り込み：天井の内張りと明かり取り、光の筋、奥壁の管制室と換気扇、区画の表示板、
// 整備機材（作業台・牽引車・ディフューザーの台車・予備エンジン・部品棚）、整備員、扉の内側
function hangarDetail(HG,M){
  const{hullM,paleM,darkM,glassM,cyM,amM,whM,box}=M,r=mulberry(909);
  const cv=(w,h,draw,rep)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');draw(x,w,h);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rep[0],rep[1]);}return t;};
  const col=(h,ro,me)=>std({color:lin(h),roughness:ro===undefined?.6:ro,metalness:me===undefined?.3:me});
  const steel=col(0x7d858c,.4,.85),yel=col(0xd9a21b,.5,.3),red=col(0xb3261c,.5,.3),blue=col(0x2c4f7a,.5,.4),rubber=col(0x0e0f10,.95,0),orange=col(0xe8641b,.7,0),skin=col(0xc9a184,.8,0);
  const add=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;HG.add(o);return o;};
  // ── 内壁の内張り：下は濃い腰壁、上は褪せた塗装鋼板。継ぎ目・鋲・雨だれの錆・手の届く高さの汚れ
  const linerT=cv(1024,512,(x,w,h)=>{x.fillStyle='#8f9a94';x.fillRect(0,0,w,h);
    for(let i=0;i<1400;i++){const g=120+r()*50|0;x.fillStyle='rgba('+g+','+(g+6)+','+(g+2)+','+(.04+r()*.06)+')';x.fillRect(r()*w,r()*h,6+r()*90,4+r()*50);}
    x.fillStyle='#39424a';x.fillRect(0,h*.68,w,h*.32);x.fillStyle='#b8902a';x.fillRect(0,h*.68-5,w,5);
    for(let i=0;i<16;i++){const X=i*64;x.fillStyle='rgba(0,0,0,.32)';x.fillRect(X,0,2,h);x.fillStyle='rgba(255,255,255,.10)';x.fillRect(X+2,0,2,h);for(let j=0;j<16;j++){x.fillStyle='rgba(20,22,24,.55)';x.fillRect(X+8,10+j*32,2,2);x.fillRect(X+54,10+j*32,2,2);}}
    for(const y of[.22,.45])for(let k=0;k<1;k++){x.fillStyle='rgba(0,0,0,.28)';x.fillRect(0,h*y,w,2);}
    for(let i=0;i<90;i++){const X=r()*w,Y=r()*h*.5,L=40+r()*200,g=x.createLinearGradient(0,Y,0,Y+L);g.addColorStop(0,'rgba(92,52,24,'+(.15+r()*.3)+')');g.addColorStop(1,'rgba(92,52,24,0)');x.fillStyle=g;x.fillRect(X,Y,1.5+r()*4,L);}
    {const g=x.createLinearGradient(0,0,0,h*.2);g.addColorStop(0,'rgba(0,0,0,.5)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,w,h*.2);}
    {const g=x.createLinearGradient(0,h*.8,0,h);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.6)');x.fillStyle=g;x.fillRect(0,h*.8,w,h*.2);}
    for(let i=0;i<60;i++){x.fillStyle='rgba(12,12,12,'+(.05+r()*.14)+')';x.beginPath();x.ellipse(r()*w,h*(.7+r()*.3),8+r()*40,6+r()*22,0,0,7);x.fill();}
},[2,1]);
  const linerM=std({map:linerT,roughness:.72,metalness:.25});
  for(const s of[-1,1]){const l=new THREE.Mesh(new THREE.BoxGeometry(.12,31,177),linerM);l.position.set(s*46.36,15,0);l.rotation.z=s*.1;l.receiveShadow=true;HG.add(l);}
  {const endT=linerT.clone();endT.needsUpdate=true;endT.repeat.set(1,1);const em=std({map:endT,roughness:.72,metalness:.25});
    const bw=new THREE.Mesh(new THREE.PlaneGeometry(96,40),em);bw.rotation.y=Math.PI;bw.position.set(0,19,87.96);HG.add(bw);
    const fw=new THREE.Mesh(new THREE.PlaneGeometry(96,7),std({color:lin(0x7d8782),roughness:.75,metalness:.25}));fw.position.set(0,31.5,-86.95);HG.add(fw);}
  // ── 床と壁の境目の暗がり（隅に光が回らない感じ）
  const aoT=cv(64,8,(x,w,h)=>{const g=x.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(0,0,0,.75)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,w,h);});
  const aoM=new THREE.MeshBasicMaterial({map:aoT,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  for(const s of[-1,1]){const a=new THREE.Mesh(new THREE.PlaneGeometry(9,176),aoM);a.rotation.x=-Math.PI/2;a.rotation.z=s>0?Math.PI:0;a.position.set(s*43.6,.05,0);HG.add(a);
    const v=new THREE.Mesh(new THREE.PlaneGeometry(7,176),aoM);v.rotation.set(0,s>0?-Math.PI/2:Math.PI/2,s>0?-Math.PI/2:-Math.PI/2);v.position.set(s*47.2,3.4,0);v.visible=false;HG.add(v);}
  {const a=new THREE.Mesh(new THREE.PlaneGeometry(9,96),aoM);a.rotation.x=-Math.PI/2;a.rotation.z=Math.PI/2;a.position.set(0,.05,83.5);HG.add(a);}
  // ── 床：油じみ・補修跡・水たまりの照り返し
  const stainT=cv(512,512,(x,w,h)=>{x.clearRect(0,0,w,h);for(let i=0;i<46;i++){const X=r()*w,Y=r()*h,R=14+r()*60,g=x.createRadialGradient(X,Y,0,X,Y,R);g.addColorStop(0,'rgba(8,8,9,'+(.25+r()*.4)+')');g.addColorStop(.6,'rgba(8,8,9,'+(.08+r()*.12)+')');g.addColorStop(1,'rgba(8,8,9,0)');x.fillStyle=g;x.beginPath();x.ellipse(X,Y,R,R*(.5+r()*.6),r()*3,0,7);x.fill();}
    for(let i=0;i<10;i++){x.fillStyle='rgba(120,124,128,'+(.25+r()*.25)+')';x.fillRect(r()*w,r()*h,20+r()*70,14+r()*50);}});
  {const m=new THREE.MeshBasicMaterial({map:stainT,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});stainT.wrapS=stainT.wrapT=THREE.RepeatWrapping;stainT.repeat.set(2,4);const p=new THREE.Mesh(new THREE.PlaneGeometry(96,176),m);p.rotation.x=-Math.PI/2;p.position.y=.035;HG.add(p);}
  // ── 入口から差し込む外光（扉の開き具合に連動）：床に伸びる明るい帯と、空気中のかすみ
  const spillT=cv(64,128,(x,w,h)=>{const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h);
    const e=x.createLinearGradient(0,0,w,0);e.addColorStop(0,'rgba(0,0,0,1)');e.addColorStop(.2,'rgba(0,0,0,0)');e.addColorStop(.8,'rgba(0,0,0,0)');e.addColorStop(1,'rgba(0,0,0,1)');x.globalCompositeOperation='destination-out';x.fillStyle=e;x.fillRect(0,0,w,h);});
  const spillM=new THREE.MeshBasicMaterial({map:spillT,color:new THREE.Color(1.0,.97,.88),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
  const spill=new THREE.Mesh(new THREE.PlaneGeometry(92,120),spillM);spill.rotation.x=-Math.PI/2;spill.position.set(0,.07,-28);HG.add(spill);
  const hazeM=new THREE.MeshBasicMaterial({map:spillT,color:new THREE.Color(.85,.9,1),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
  for(const z of[-70,-45,-18]){const hz=new THREE.Mesh(new THREE.PlaneGeometry(94,30),hazeM);hz.rotation.z=Math.PI;hz.position.set(0,15,z);HG.add(hz);}
  // ── 機体の下の影（屋内は太陽の影が届かないので、ぼかした影を置く）
  const blobM=new THREE.MeshBasicMaterial({map:GLOWTEX,color:0x000000,transparent:true,opacity:.62,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3});
  const blobs=[0,1,2].map(()=>{const g=new THREE.Group();g.userData.dyn=true;for(const[w,d,x,z]of[[34,20,0,2],[9,34,0,0],[9,9,0,-7.5],[7,7,-2.6,2.3],[7,7,2.6,2.3]]){const b=new THREE.Mesh(new THREE.PlaneGeometry(w,d),blobM);b.rotation.x=-Math.PI/2;b.position.set(x,0,z);g.add(b);}g.position.y=.09;HG.add(g);return g;});
  // ── 天井の内張り：波板と梁の影、ところどころに明かり取り
  const ceilT=cv(512,512,(x,w,h)=>{x.fillStyle='#27414a';x.fillRect(0,0,w,h);for(let i=0;i<64;i++){const g=x.createLinearGradient(i*8,0,i*8+8,0);g.addColorStop(0,'rgba(0,0,0,.3)');g.addColorStop(.5,'rgba(255,255,255,.08)');g.addColorStop(1,'rgba(0,0,0,.3)');x.fillStyle=g;x.fillRect(i*8,0,8,h);}
    for(let j=0;j<8;j++){x.fillStyle='rgba(8,12,14,.6)';x.fillRect(0,j*64,w,3);}for(let i=0;i<50;i++){x.fillStyle='rgba(10,10,8,'+(.05+r()*.15)+')';x.fillRect(r()*w,r()*h,20+r()*70,6+r()*30);}},[4,10]);
  const ceilM=std({map:ceilT,roughness:.75,metalness:.35,side:THREE.DoubleSide});
  const skyM=new THREE.MeshBasicMaterial({color:new THREE.Color(.55,.72,.85)});
  const arch=[[-47,29],[-30,35],[0,38],[30,35],[47,29]];
  for(let i=0;i<4;i++){const a=arch[i],b=arch[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]),ang=Math.atan2(b[1]-a[1],b[0]-a[0]),cx=(a[0]+b[0])/2,cy=(a[1]+b[1])/2-.95;
    const p=new THREE.Mesh(new THREE.PlaneGeometry(len,176),ceilM);p.rotation.set(Math.PI/2,0,0);p.rotation.order='ZXY';p.rotation.z=ang;p.position.set(cx,cy,0);HG.add(p);
    if(i===0||i===3)for(let k=-3;k<=3;k++){const sk=new THREE.Mesh(new THREE.PlaneGeometry(len*.5,9),skyM);sk.rotation.order='ZXY';sk.rotation.set(Math.PI/2,0,ang);sk.position.set(cx,cy-.06,k*21+10.5);HG.add(sk);}}
  // ── 天井灯からの光の筋（明るさは灯りに連動）
  const coneM=new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(.9,.95,1),transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false});
  const poolM=new THREE.MeshBasicMaterial({map:GLOWTEX,color:new THREE.Color(.8,.88,1),transparent:true,opacity:.1,blending:THREE.AdditiveBlending,depthWrite:false});
  for(let k=-4;k<=4;k++)for(const lx of[-28,-9,9,28]){const h=new THREE.Sprite(coneM);h.position.set(lx,25.6,k*21);h.scale.set(6.5,6.5,1);HG.add(h);
    if((k+4+(lx>0?1:0))%2===0){const pl=new THREE.Mesh(new THREE.PlaneGeometry(46+r()*14,40+r()*14),poolM);pl.rotation.x=-Math.PI/2;pl.position.set(lx+(r()-.5)*6,.06,k*21+(r()-.5)*8);HG.add(pl);}}
  // ── 奥の壁：隊の標識、管制室（足場の上）、換気扇
  const signT=cv(1024,96,(x,w,h)=>{x.fillStyle='#0d2a33';x.fillRect(0,0,w,h);x.strokeStyle='#c98a4b';x.lineWidth=4;x.strokeRect(4,4,w-8,h-8);x.fillStyle='#e6bd74';x.font='600 50px "Helvetica Neue",Arial';x.textAlign='center';x.textBaseline='middle';x.fillText('S T O R M   R I D E R   F L I G H T',w/2,40);x.font='500 18px Arial';x.fillStyle='#7fd0d6';x.fillText('MIZUHA MARINE WEATHER STATION  ·  HANGAR 1',w/2,76);});
  const sg=new THREE.Mesh(new THREE.PlaneGeometry(46,4.3),new THREE.MeshBasicMaterial({map:signT,color:new THREE.Color(1.3,1.3,1.3)}));sg.rotation.y=Math.PI;sg.position.set(0,33.4,87.9);HG.add(sg);
  const winT=cv(256,64,(x,w,h)=>{x.fillStyle='#1b2a30';x.fillRect(0,0,w,h);for(let i=0;i<4;i++){x.fillStyle='#ffe3a6';x.fillRect(6+i*63,8,54,48);x.fillStyle='rgba(20,30,40,.85)';x.fillRect(14+i*63+(i*17%30),30,10,26);x.fillStyle='rgba(60,200,220,.9)';x.fillRect(34+i*63,36,18,10);}});
  for(const s of[-1,1]){box(HG,9.6,4.2,4.4,paleM,s*30,9.3,85.6,true);box(HG,10.2,.3,5,darkM,s*30,11.5,85.4);
    const w=new THREE.Mesh(new THREE.PlaneGeometry(8.8,2.2),new THREE.MeshBasicMaterial({map:winT,color:new THREE.Color(1.5,1.4,1.2)}));w.rotation.y=Math.PI;w.position.set(s*30,9.6,83.38);HG.add(w);
    for(let k=0;k<6;k++)box(HG,.08,1.1,.08,paleM,s*30-4.6+k*1.84,7.7,81.6);box(HG,9.4,.08,.08,paleM,s*30,8.25,81.6);
    // 換気扇
    const fg=new THREE.Group();fg.position.set(s*36.5,27,87.6);HG.add(fg);
    fg.add(new THREE.Mesh(new THREE.TorusGeometry(3.1,.28,8,28),steel));const bk=new THREE.Mesh(new THREE.CircleGeometry(3.1,28),new THREE.MeshBasicMaterial({color:new THREE.Color(.35,.5,.62)}));bk.rotation.y=Math.PI;bk.position.z=.25;fg.add(bk);
    for(let k=0;k<7;k++){const bl=new THREE.Mesh(new THREE.BoxGeometry(.9,2.7,.06),darkM);bl.position.set(Math.cos(k/7*6.283)*1.55,Math.sin(k/7*6.283)*1.55,0);bl.rotation.z=k/7*6.283+Math.PI/2+.35;bl.rotation.order='ZYX';bl.rotation.y=.4;fg.add(bl);}
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.4,14),steel);hub.rotation.x=Math.PI/2;fg.add(hub);for(const a of[0,Math.PI/2]){const g=new THREE.Mesh(new THREE.BoxGeometry(6.2,.08,.08),steel);g.rotation.z=a;g.position.z=-.25;fg.add(g);}}
  // ── 区画ごとの表示板（壁）
  const bayT=(n,st)=>cv(256,128,(x,w,h)=>{x.fillStyle='#04121c';x.fillRect(0,0,w,h);x.strokeStyle='#39c8ff';x.lineWidth=3;x.strokeRect(3,3,w-6,h-6);x.fillStyle='#bfe9ff';x.font='bold 44px Arial';x.fillText('SR-0'+n,14,48);x.fillStyle=st?'#35e0a0':'#ffb020';x.fillRect(150,16,92,34);x.fillStyle='#04121c';x.font='bold 20px Arial';x.fillText(st?'READY':'ARMING',158,41);
    x.fillStyle='#7fd0d6';x.font='15px Menlo,monospace';['FUEL  ██████████ 100%','HYD   █████████░  94%','DIFF  '+(n<3?'LOADED':'―')].forEach((t,i)=>x.fillText(t,14,76+i*19));});
  [[1,-46.05,-25],[2,-46.05,20],[3,46.05,55]].forEach(([n,x,z])=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(6.4,3.2),new THREE.MeshBasicMaterial({map:bayT(n,n!==1),color:new THREE.Color(1.5,1.6,1.7)}));m.rotation.y=x<0?Math.PI/2:-Math.PI/2;m.position.set(x,7.2,z);HG.add(m);box(HG,.3,3.6,6.8,darkM,x+(x<0?-.12:.12),7.2,z);});
  // ── 整備機材
  // 作業台（車輪付きの階段と踊り場）
  const stand=(x,z,ry)=>{const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=ry;HG.add(g);const B2=(w,h,d,m,px,py,pz)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(px,py,pz);o.castShadow=true;g.add(o);return o;};
    B2(2.4,.12,2.2,steel,0,3.2,0);for(const sx of[-1.1,1.1])for(const sz of[-1,1]){B2(.1,3.2,.1,yel,sx,1.6,sz);B2(.1,1.1,.1,yel,sx,3.8,sz);}
    for(const sz of[-1,1])B2(2.3,.08,.08,yel,0,4.3,sz);B2(.08,.08,2.1,yel,-1.1,4.3,0);
    for(let k=0;k<8;k++)B2(.5,.06,1.6,steel,1.4+k*.42,3.0-k*.38,0);for(const sz of[-.85,.85]){const rl=B2(4.6,.08,.08,yel,3,2.6,sz);rl.rotation.z=-.735;}
    for(const sx of[-1,1,4.4])for(const sz of[-.9,.9]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.14,10),rubber);w.rotation.x=Math.PI/2;w.position.set(sx,.2,sz);g.add(w);}};
  stand(-40,-34,Math.PI/2);stand(40,8,-Math.PI/2);stand(-40,42,Math.PI/2);
  // 牽引車と電源車
  {const v=buildVehicle('tug',0xd9a21b);v.position.set(40.5,.02,-52);v.rotation.y=.25;HG.add(v);const p=buildVehicle('gpu',0xd9a21b);p.position.set(-40.5,.02,12);p.rotation.y=Math.PI/2+.1;HG.add(p);}
  // ディフューザーの台車（予備弾を 3 本載せた架台）
  {const g=new THREE.Group();g.position.set(-40.5,0,-58);HG.add(g);const B2=(w,h,d,m,px,py,pz)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(px,py,pz);o.castShadow=true;g.add(o);return o;};
    B2(2.6,.2,6,steel,0,.7,0);for(const sz of[-2.4,2.4])for(const sx of[-1.1,1.1]){B2(.12,2.6,.12,yel,sx,1.9,sz);const w=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.2,12),rubber);w.rotation.z=Math.PI/2;w.position.set(sx*1.1,.3,sz);g.add(w);}
    for(let k=0;k<3;k++){const d=buildDiffuser();d.position.set(0,1.3+k*.85,0);g.add(d);for(const sz of[-1.6,1.6])B2(2.3,.1,.3,darkM,0,.88+k*.85,sz);}
    B2(.5,.5,.06,new THREE.MeshBasicMaterial({color:new THREE.Color(2.2,1.6,.2)}),1.32,2.2,0);}
  // 予備エンジン（整備台の上）
  {const g=new THREE.Group();g.position.set(40.5,0,38);HG.add(g);const e=new THREE.Mesh(latheZ([[-3.6,.78],[-3.3,.96],[-1.5,1.08],[1.5,1.02],[3.3,.86],[3.8,.74]],22),steel);e.position.y=2.0;e.castShadow=true;g.add(e);
    const f=new THREE.Mesh(new THREE.CircleGeometry(.84,22),new THREE.MeshBasicMaterial({map:fanTex(),color:0x9aa0a6}));f.position.set(0,2,-3.4);f.rotation.y=Math.PI;g.add(f);
    for(const sz of[-2.2,2.2]){const c=new THREE.Mesh(new THREE.TorusGeometry(1.12,.09,6,20,Math.PI),yel);c.position.set(0,2,sz);c.rotation.z=Math.PI;g.add(c);for(const sx of[-1.1,1.1]){const l=new THREE.Mesh(new THREE.BoxGeometry(.12,2,.12),yel);l.position.set(sx,1,sz);g.add(l);}}
    const bs=new THREE.Mesh(new THREE.BoxGeometry(2.6,.14,5.4),yel);bs.position.y=.3;g.add(bs);}
  // 部品棚（点検通路の下）と壁の消火ホース
  for(const s of[-1,1])for(const z of[-12,62]){const X=s*45;box(HG,1.2,5.4,8,darkM,X,2.9,z*(s>0?1:-1)+ (s>0?0:6));
    for(let j=0;j<4;j++)for(let k=0;k<5;k++){if(r()<.2)continue;box(HG,1.0,.9+r()*.3,1.2,[blue,red,yel,steel,col(0x8a6d45,.9,0)][Math.floor(r()*5)],X-s*.2,.7+j*1.3,z*(s>0?1:-1)+(s>0?0:6)-3.1+k*1.55);}}
  for(const s of[-1,1])for(const z of[-70,-10,50]){const hr=new THREE.Mesh(new THREE.TorusGeometry(.7,.22,8,18),red);hr.rotation.y=Math.PI/2;hr.position.set(s*45.9,3.2,z);HG.add(hr);box(HG,.2,1.9,1.9,col(0x8f1f17),s*46.1,3.2,z);}
  // 安全コーンと車止め
  for(const[x,z]of[[37.5,-62],[37.5,-44],[-37.5,-50],[-37.5,-66],[37.5,30],[37.5,46],[-37.5,34],[-37.5,50]]){const c=add(new THREE.ConeGeometry(.3,.85,10),orange,x,.43,z);add(new THREE.CylinderGeometry(.22,.22,.1,10),new THREE.MeshBasicMaterial({color:0xf2f2f2}),x,.52,z);box(HG,.7,.06,.7,rubber,x,.03,z);}
  // ── 整備員（安全ベストと耳当て）
  // 関節のある人形にして、game.js の animCrew で動かす（mergeStatic で固めないよう dyn）
  const CREW=[];
  const crew=(x,z,ry,role,path)=>{const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=ry;g.userData.dyn=1;HG.add(g);const suit=col([0x2b3a4a,0x3b4b3a,0x4a4038][Math.floor(r()*3)],.9,0),vest=new THREE.MeshStandardMaterial({color:lin(0xd8e02a),roughness:.8,emissive:new THREE.Color(.05,.06,.0)});ENVMATS.push(vest);
    const M=(par,geo,m,px,py,pz)=>{const o=new THREE.Mesh(geo,m);o.position.set(px,py,pz);o.castShadow=true;par.add(o);return o;},J=(par,px,py,pz)=>{const j=new THREE.Group();j.position.set(px,py,pz);par.add(j);return j;};
    const body=J(g,0,.86,0),c={g,body,role,path,x,z,ry,home:{x,z,ry},ph:r()*6.3,wp:0,dir:1,legs:[],arms:[]};
    for(const sx of[-1,1]){const hip=J(body,sx*.12,0,0);M(hip,new THREE.CylinderGeometry(.095,.085,.44,8),suit,0,-.22,0);const kn=J(hip,0,-.44,0);M(kn,new THREE.CylinderGeometry(.08,.07,.4,8),suit,0,-.2,0);M(kn,new THREE.BoxGeometry(.13,.08,.26),rubber,0,-.4,.05);c.legs.push({hip,kn});}
    const torso=J(body,0,0,0);M(torso,new THREE.BoxGeometry(.42,.6,.24),suit,0,.3,0);M(torso,new THREE.BoxGeometry(.44,.42,.26),vest,0,.34,0);
    const head=J(torso,0,.66,0);M(head,new THREE.SphereGeometry(.12,12,10),skin,0,.1,0);M(head,new THREE.SphereGeometry(.135,12,8,0,6.3,0,1.5),yel,0,.13,0);for(const sx of[-.14,.14])M(head,new THREE.SphereGeometry(.06,8,6),rubber,sx,.1,0);
    for(const sx of[-1,1]){const sh=J(torso,sx*.27,.56,0);M(sh,new THREE.CylinderGeometry(.055,.05,.32,8),suit,0,-.16,0);const el=J(sh,0,-.32,0);M(el,new THREE.CylinderGeometry(.05,.045,.28,8),suit,0,-.14,0);M(el,new THREE.SphereGeometry(.05,8,6),skin,0,-.3,0);
      if(role==='marshal'){M(el,new THREE.CylinderGeometry(.03,.03,.5,6),new THREE.MeshBasicMaterial({color:new THREE.Color(3,1.2,.15)}),0,-.55,0);}
      c.arms.push({sh,el});}
    if(role==='clip')M(c.arms[0].el,new THREE.BoxGeometry(.22,.3,.02),paleClip,0,-.33,.08);
    c.torso=torso;c.head=head;CREW.push(c);};
  const paleClip=new THREE.MeshStandardMaterial({color:0xd8d4c8,roughness:.8});
  // 誘導員 2 人（扉の手前で機体と向き合う）、歩く人、作業する人、書類を持つ人
  crew(-37,-76,0,'marshal');crew(37,-76,0,'marshal');
  crew(-39,-36,1.6,'walk',[-36,12]);crew(39,36,-1.5,'walk',[36,-22]);crew(-38.8,44,1.9,'walk',[44,72]);
  crew(39.4,-49,.4,'work');crew(38.6,10,1.2,'work');crew(-41.5,70,.3,'work');
  crew(-39.2,-55,-1.2,'clip');crew(41,71,-.5,'clip');
  HG.userData.crew=CREW;
  // ── 扉の内側：補強の枠、区画番号、危険帯
  const doorT=cv(512,512,(x,w,h)=>{x.fillStyle='#6a746f';x.fillRect(0,0,w,h);for(let i=0;i<70;i++){const X=r()*w,Y=r()*h*.5,L=40+r()*220,g=x.createLinearGradient(0,Y,0,Y+L);g.addColorStop(0,'rgba(92,52,24,'+(.12+r()*.28)+')');g.addColorStop(1,'rgba(92,52,24,0)');x.fillStyle=g;x.fillRect(X,Y,1.5+r()*4,L);}for(let i=0;i<8;i++){const g=x.createLinearGradient(i*64,0,i*64+64,0);g.addColorStop(0,'rgba(0,0,0,.35)');g.addColorStop(.1,'rgba(255,255,255,.08)');g.addColorStop(1,'rgba(0,0,0,.12)');x.fillStyle=g;x.fillRect(i*64,0,64,h);}
    for(let i=0;i<24;i++){x.fillStyle=i%2?'#d9a21b':'#17191a';x.beginPath();const a=i*w/24;x.moveTo(a,h);x.lineTo(a+w/24,h);x.lineTo(a+w/24+30,h-54);x.lineTo(a+30,h-54);x.fill();}
    x.fillStyle='rgba(40,46,50,.8)';x.font='bold 150px Arial';x.textAlign='center';x.fillText('1',w/2,300);x.font='bold 26px Arial';x.fillStyle='rgba(217,162,27,.95)';x.fillText('DOOR MOVES WITHOUT WARNING',w/2,360);
    for(let i=0;i<50;i++){x.fillStyle='rgba(10,10,10,'+r()*.14+')';x.fillRect(r()*w,r()*h*.6,1+r()*3,60+r()*200);}});
  const doorM=std({map:doorT,roughness:.55,metalness:.5});
  return{coneM,poolM,doorM,spillM,hazeM,blobs};
}
function hangarInterior(HG,M){
  const{hullM,paleM,darkM,cyM,amM,whM,box}=M;
  const cv=(w,h,draw,rep)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');draw(x,w,h);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rep[0],rep[1]);}return t;};
  const r=mulberry(404);
  // 床：打ち継ぎ目・しみ・タイヤ痕・塗装線・駐機枠
  const floorT=cv(1024,2048,(x,w,h)=>{x.fillStyle='#6a6862';x.fillRect(0,0,w,h);
    for(let i=0;i<2600;i++){const g=84+r()*44|0;x.fillStyle='rgba('+g+','+(g-2)+','+(g-8)+','+(.05+r()*.07)+')';x.fillRect(r()*w,r()*h,4+r()*60,4+r()*60);}
    for(let i=0;i<70;i++){x.fillStyle='rgba(20,22,24,'+(.08+r()*.16)+')';x.beginPath();x.ellipse(r()*w,r()*h,10+r()*50,8+r()*34,r()*3,0,7);x.fill();}
    x.strokeStyle='rgba(25,27,30,.75)';x.lineWidth=2;for(let i=1;i<12;i++){x.beginPath();x.moveTo(i*w/12,0);x.lineTo(i*w/12,h);x.stroke();}for(let j=1;j<22;j++){x.beginPath();x.moveTo(0,j*h/22);x.lineTo(w,j*h/22);x.stroke();}
    // タイヤ痕（3 本の走路）
    for(const cx of[512,256,768])for(let i=0;i<26;i++){x.strokeStyle='rgba(12,12,13,'+(.05+r()*.1)+')';x.lineWidth=3+r()*5;const o=(r()-.5)*40;x.beginPath();x.moveTo(cx+o-28,r()*h*.4);x.lineTo(cx+o-28+(r()-.5)*14,h*.4+r()*h*.6);x.stroke();x.beginPath();x.moveTo(cx+o+28,r()*h*.4);x.lineTo(cx+o+28+(r()-.5)*14,h*.4+r()*h*.6);x.stroke();}
    // 誘導線と駐機枠（1024px=96m, 2048px=176m）
    const X=m=>512+m/96*1024,Z=m=>1024+m/176*2048;
    x.strokeStyle='#d9a21b';x.lineWidth=6;for(const lx of[0,-24,24]){x.beginPath();x.moveTo(X(lx),Z(-88));x.lineTo(X(lx),Z(lx?72:8));x.stroke();}
    x.setLineDash([26,18]);x.lineWidth=4;x.strokeStyle='rgba(235,235,225,.85)';for(const[px,pz]of[[0,-25],[-24,20],[24,55]]){x.strokeRect(X(px-15),Z(pz-17),30/96*1024,34/176*2048);}x.setLineDash([]);
    x.fillStyle='rgba(235,235,225,.9)';x.font='bold 54px Arial';x.textAlign='center';[['01',0,-45],['02',-24,0],['03',24,35]].forEach(([s,px,pz])=>{x.save();x.translate(X(px),Z(pz));x.rotate(Math.PI);x.fillText(s,0,0);x.restore();});
    // 扉前の危険帯
    for(let i=0;i<40;i++){x.fillStyle=i%2?'#d9a21b':'#1a1b1c';x.beginPath();const a=i*w/40;x.moveTo(a,Z(-86));x.lineTo(a+w/40,Z(-86));x.lineTo(a+w/40-14,Z(-83));x.lineTo(a-14,Z(-83));x.fill();}
    x.fillStyle='rgba(180,40,30,.8)';x.font='bold 30px Arial';x.save();x.translate(X(0),Z(-79));x.rotate(Math.PI);x.fillText('JET BLAST  ―  KEEP CLEAR',0,0);x.restore();});
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(96,176),std({map:floorT,roughness:.34,metalness:.3}));fl.rotation.x=-Math.PI/2;fl.position.y=.02;fl.receiveShadow=true;HG.add(fl);
  // 壁：パネルの継ぎ目・リベット・汚れ・ステンシル
  const wallT=cv(1024,256,(x,w,h)=>{x.fillStyle='#3d454d';x.fillRect(0,0,w,h);
    for(let i=0;i<16;i++){const g=x.createLinearGradient(i*64,0,i*64+64,0);g.addColorStop(0,'rgba(0,0,0,.28)');g.addColorStop(.06,'rgba(255,255,255,.07)');g.addColorStop(.5,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.18)');x.fillStyle=g;x.fillRect(i*64,0,64,h);
      x.fillStyle='rgba(15,18,20,.6)';for(let j=0;j<8;j++){x.fillRect(i*64+5,8+j*32,2,2);x.fillRect(i*64+57,8+j*32,2,2);}}
    x.fillStyle='rgba(18,20,22,.55)';x.fillRect(0,84,w,5);x.fillRect(0,170,w,5);
    const g=x.createLinearGradient(0,150,0,h);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(8,8,8,.6)');x.fillStyle=g;x.fillRect(0,150,w,h-150);
    for(let i=0;i<60;i++){x.fillStyle='rgba(10,10,10,'+r()*.18+')';x.fillRect(r()*w,90+r()*60,1+r()*2,30+r()*110);}
    x.fillStyle='rgba(225,228,230,.8)';x.font='bold 40px Arial';x.fillText('BAY 01',40,62);x.fillText('BAY 01',560,62);x.font='bold 15px Arial';x.fillStyle='rgba(217,162,27,.9)';x.fillText('▲ EAR PROTECTION REQUIRED   FOD CHECK BEFORE ENGINE START',40,82);},[2,1]);
  for(const s of[-1,1]){const w=new THREE.Mesh(new THREE.PlaneGeometry(176,28),std({map:wallT,roughness:.6,metalness:.5}));w.rotation.y=-s*Math.PI/2;w.rotation.z=0;w.position.set(s*46.2,14,0);w.rotation.order='YXZ';w.rotation.x=-s*0;w.visible=false;HG.add(w);
    // 点検通路・手すり・配管・ダクト
    box(HG,3.2,.25,170,darkM,s*44.2,11,0,true);box(HG,.12,.12,170,paleM,s*42.7,12.2,0);box(HG,.1,.1,170,paleM,s*42.7,11.6,0);
    for(let k=-10;k<=10;k++)box(HG,.1,1.2,.1,paleM,s*42.7,11.6,k*8.5);
    for(let k=-3;k<=3;k++){const br=box(HG,.25,3.2,.25,darkM,s*43.6,9.6,k*25+2);br.rotation.z=s*.6;}
    for(let k=0;k<3;k++){const p=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,172,10),k===1?std({color:lin(0xb3261c),roughness:.5,metalness:.4}):paleM);p.rotation.x=Math.PI/2;p.position.set(s*45.7,5.2+k*.7,0);HG.add(p);}
    const duct=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.25,168,16),std({color:lin(0x8b9298),roughness:.35,metalness:.85}));duct.rotation.x=Math.PI/2;duct.position.set(s*38.5,24.5,0);HG.add(duct);
    for(let k=-4;k<=4;k++){const fl2=new THREE.Mesh(new THREE.TorusGeometry(1.3,.1,6,18),darkM);fl2.position.set(s*38.5,24.5,k*19);HG.add(fl2);box(HG,.12,5,.12,darkM,s*38.5,27.4,k*19);}
    // 天井クレーンのレール
    box(HG,.9,1.1,170,std({color:lin(0xc79a1c),roughness:.5,metalness:.5}),s*31,26.2,0,true);
    // 壁際の機材：工具車・発電車・ドラム缶・木箱・消火器
    for(let k=0;k<5;k++){const z=-66+k*31+(s>0?9:0);
      {const ct=buildVehicle('cart',k%2?0xa3261c:0x2c4f7a);ct.position.set(s*43.6,.02,z);ct.rotation.y=s>0?Math.PI:0;HG.add(ct);}
      const ex=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.9,10),std({color:lin(0xc2261c),roughness:.4,metalness:.3}));ex.position.set(s*45.2,1.6,z+8);HG.add(ex);}
    {const gp=buildVehicle(s>0?'gpu':'follow',0xd9a21b);gp.position.set(s*40,.02,62);gp.rotation.y=s>0?.3:Math.PI-.2;HG.add(gp);}
    for(let k=0;k<5;k++){const b=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,1.7,14),std({color:lin(k%2?0x2c4f7a:0x8a8f93),roughness:.5,metalness:.6}));b.position.set(s*(40.5-k%2*1.3),.87,74+Math.floor(k/2)*1.4);HG.add(b);}
    for(let k=0;k<6;k++)box(HG,2.2,1.6,2.2,std({color:lin(0x8a6d45),roughness:.9,metalness:0}),s*(37-(k%3)*2.4),.82+Math.floor(k/3)*1.62,80,true);
  }
  // 小屋組み（下弦材と斜材）と天井灯
  for(let k=-4;k<=4;k++){const z=k*21;box(HG,92,.7,.7,darkM,0,27.2,z);
    for(let j=-4;j<4;j++){const x0=j*11.5+5.75,top=36.5-Math.abs(x0)*.19,d=box(HG,.35,Math.hypot(11.5,top-27.2),.35,darkM,x0,(27.2+top)/2,z);d.rotation.z=(j%2?1:-1)*Math.atan2(11.5,top-27.2);}
    for(const lx of[-28,-9,9,28]){const lamp=new THREE.Mesh(new THREE.CylinderGeometry(.9,1.3,.9,14),darkM);lamp.position.set(lx,26.4,z);HG.add(lamp);const em=new THREE.Mesh(new THREE.CircleGeometry(1.1,14),whM);em.rotation.x=Math.PI/2;em.position.set(lx,25.92,z);HG.add(em);}}
  // 走行クレーンの桁とフック
  box(HG,62.6,1.8,2.2,std({color:lin(0xc79a1c),roughness:.5,metalness:.5}),0,26.4,48,true);box(HG,3,1.6,3,darkM,12,25,48);box(HG,.12,7,.12,darkM,12,21,48);
  {const hk=new THREE.Mesh(new THREE.TorusGeometry(.5,.14,6,14,Math.PI*1.4),std({color:lin(0xc79a1c),roughness:.4,metalness:.8}));hk.position.set(12,17.2,48);HG.add(hk);}
  // 奥の壁：気象状況の大型表示と整備足場
  // 奥の壁の大型表示装置：LED の表示盤を並べた壁。左に気象衛星の画像と予想進路、右に観測値・時系列・出撃状況
  const scr=cv(2048,1024,(x,w,h)=>{x.fillStyle='#02070c';x.fillRect(0,0,w,h);const mono='"SF Mono",Menlo,Consolas,monospace',sans='"Helvetica Neue",Arial,sans-serif';
    // 上段の帯
    x.fillStyle='#071a26';x.fillRect(0,0,w,64);x.fillStyle='#9fd8ee';x.font='600 30px '+sans;x.fillText('MIZUHA MARINE WEATHER STATION  ／  OPERATIONS',28,43);x.textAlign='right';x.font='500 28px '+mono;x.fillStyle='#cfe9f5';x.fillText('17:42:08 JST   08:42:08 UTC',w-28,43);x.textAlign='left';
    // ── 左：衛星画像（赤外）
    const MX=24,MY=84,MW=1180,MH=760;x.save();x.beginPath();x.rect(MX,MY,MW,MH);x.clip();
    const sea=x.createLinearGradient(0,MY,0,MY+MH);sea.addColorStop(0,'#06243a');sea.addColorStop(1,'#041826');x.fillStyle=sea;x.fillRect(MX,MY,MW,MH);
    // 陸地（架空の海岸線）
    x.fillStyle='#16321f';x.strokeStyle='#3f6a45';x.lineWidth=2;for(const pts of[[[900,84],[980,150],[1010,260],[1090,300],[1204,280],[1204,84]],[[1050,420],[1120,400],[1204,430],[1204,560],[1130,600],[1070,540]],[[60,700],[150,680],[210,730],[170,800],[70,790]]]){x.beginPath();pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.closePath();x.fill();x.stroke();}
    // 緯経線
    x.strokeStyle='rgba(120,190,220,.22)';x.lineWidth=1;x.font='16px '+mono;x.fillStyle='rgba(150,205,230,.6)';for(let i=1;i<8;i++){const X=MX+i*MW/8;x.beginPath();x.moveTo(X,MY);x.lineTo(X,MY+MH);x.stroke();x.fillText((128+i*2)+'E',X+4,MY+MH-8);}for(let j=1;j<5;j++){const Y=MY+j*MH/5;x.beginPath();x.moveTo(MX,Y);x.lineTo(MX+MW,Y);x.stroke();x.fillText((34-j*2)+'N',MX+6,Y-6);}
    // 台風の雲：渦の腕に沿って、ぼかした雲の塊を重ねる
    const cx=520,cy=470;for(let arm=0;arm<3;arm++)for(let t=.25;t<6.4;t+=.035){const rr=26*Math.exp(.36*t),a=t+arm*2.094,px=cx+Math.cos(a)*rr,py=cy+Math.sin(a)*rr*.9,sz=(16+t*11)*(.6+r()*.9),al=(.05+.13*Math.exp(-t*.25))*(.5+r());
      const g=x.createRadialGradient(px,py,0,px,py,sz);const c=t<2.2?'255,255,255':t<4?'225,232,238':'170,188,200';g.addColorStop(0,'rgba('+c+','+al+')');g.addColorStop(1,'rgba('+c+',0)');x.fillStyle=g;x.fillRect(px-sz,py-sz,sz*2,sz*2);}
    for(let i=0;i<260;i++){const a=r()*6.283,rr=30+r()*70,px=cx+Math.cos(a)*rr,py=cy+Math.sin(a)*rr*.9,sz=10+r()*26,g=x.createRadialGradient(px,py,0,px,py,sz);g.addColorStop(0,'rgba(255,255,255,.16)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(px-sz,py-sz,sz*2,sz*2);}
    {const g=x.createRadialGradient(cx,cy,0,cx,cy,26);g.addColorStop(0,'rgba(3,18,30,1)');g.addColorStop(.6,'rgba(3,18,30,.9)');g.addColorStop(1,'rgba(3,18,30,0)');x.fillStyle=g;x.fillRect(cx-26,cy-26,52,52);}
    // 暴風域の円と、予想進路（予報円つき）
    x.strokeStyle='#ff5a4a';x.lineWidth=2.5;x.beginPath();x.arc(cx,cy,150,0,7);x.stroke();x.strokeStyle='#ffd23a';x.setLineDash([10,8]);x.beginPath();x.arc(cx,cy,270,0,7);x.stroke();
    const trk=[[cx,cy],[660,400],[800,330],[930,255],[1040,170]];x.strokeStyle='#ffffff';x.setLineDash([6,8]);x.lineWidth=2;x.beginPath();trk.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.stroke();x.setLineDash([]);
    trk.forEach((p,i)=>{if(!i)return;x.strokeStyle='rgba(255,255,255,.8)';x.lineWidth=1.5;x.beginPath();x.arc(p[0],p[1],22+i*14,0,7);x.stroke();x.fillStyle='#fff';x.beginPath();x.arc(p[0],p[1],4,0,7);x.fill();x.font='18px '+mono;x.fillText('+'+(i*6)+'h',p[0]+10,p[1]-12);});
    x.strokeStyle='#ff5a4a';x.lineWidth=3;x.beginPath();x.moveTo(cx-14,cy);x.lineTo(cx+14,cy);x.moveTo(cx,cy-14);x.lineTo(cx,cy+14);x.stroke();
    // 基地の位置
    x.fillStyle='#35e0a0';x.beginPath();x.moveTo(820,640);x.lineTo(832,662);x.lineTo(808,662);x.fill();x.font='600 20px '+sans;x.fillText('MIZUHA',838,660);
    x.restore();x.strokeStyle='#2a5d78';x.lineWidth=2;x.strokeRect(MX,MY,MW,MH);
    x.fillStyle='rgba(2,7,12,.75)';x.fillRect(MX+2,MY+2,330,40);x.fillStyle='#9fd8ee';x.font='600 22px '+sans;x.fillText('IR SATELLITE  ・  10 min',MX+14,MY+30);
    // 色の凡例
    for(let i=0;i<120;i++){x.fillStyle='hsl('+(220-i*1.8)+',70%,'+(22+i*.5)+'%)';x.fillRect(MX+MW-150+i,MY+MH-34,1,14);}x.fillStyle='#9fd8ee';x.font='14px '+mono;x.fillText('-80        -20 °C',MX+MW-150,MY+MH-40);
    // ── 右：台風の諸元
    const RX=1232;x.fillStyle='#ff5a4a';x.fillRect(RX,84,8,58);x.fillStyle='#eaf6fb';x.font='700 44px '+sans;x.fillText('TYPHOON 13  OROCHI',RX+22,128);
    x.font='500 26px '+mono;[['CENTER PRESSURE','890 hPa'],['MAX SUSTAINED WIND','72 m/s'],['GUST','100 m/s'],['MOVEMENT','NNE 22 km/h'],['LANDFALL IN','18 h 00 m']].forEach(([k,v],i)=>{const Y=186+i*46;x.fillStyle='#7fb6cc';x.fillText(k,RX+8,Y);x.fillStyle=i===4?'#ffd23a':'#eaf6fb';x.textAlign='right';x.fillText(v,w-36,Y);x.textAlign='left';x.fillStyle='rgba(120,190,220,.2)';x.fillRect(RX+8,Y+12,w-36-RX-8,1);});
    // 気圧と風速の時系列
    const GX=RX+8,GY=430,GW=w-36-RX-8,GH=190;x.strokeStyle='#2a5d78';x.lineWidth=1.5;x.strokeRect(GX,GY,GW,GH);x.strokeStyle='rgba(120,190,220,.18)';for(let i=1;i<6;i++){x.beginPath();x.moveTo(GX+i*GW/6,GY);x.lineTo(GX+i*GW/6,GY+GH);x.stroke();}for(let j=1;j<4;j++){x.beginPath();x.moveTo(GX,GY+j*GH/4);x.lineTo(GX+GW,GY+j*GH/4);x.stroke();}
    const plot=(col,f)=>{x.strokeStyle=col;x.lineWidth=3;x.beginPath();for(let i=0;i<=60;i++){const u=i/60,X=GX+u*GW,Y=GY+GH-f(u)*GH;i?x.lineTo(X,Y):x.moveTo(X,Y);}x.stroke();};
    plot('#39c8ff',u=>.86-.7*Math.pow(u,1.6)+.02*Math.sin(u*40));plot('#ffb020',u=>.14+.72*Math.pow(u,1.4)+.03*Math.sin(u*31+1));
    x.font='18px '+mono;x.fillStyle='#39c8ff';x.fillText('■ PRESSURE',GX+10,GY+24);x.fillStyle='#ffb020';x.fillText('■ WIND',GX+150,GY+24);x.fillStyle='#7fb6cc';x.fillText('-48h',GX,GY+GH+22);x.textAlign='right';x.fillText('NOW',GX+GW,GY+GH+22);x.textAlign='left';
    // 出撃状況
    x.fillStyle='#9fd8ee';x.font='600 22px '+sans;x.fillText('FLIGHT STATUS',GX,690);
    [['SR-01','LEAD','DIFFUSER','READY'],['SR-02','WING','SPARE','READY'],['SR-03','WING','SENSOR','READY']].forEach((row,i)=>{const Y=706+i*46;x.fillStyle='rgba(20,60,80,.55)';x.fillRect(GX,Y,GW,38);x.font='600 24px '+mono;x.fillStyle='#eaf6fb';x.fillText(row[0],GX+12,Y+27);x.font='22px '+mono;x.fillStyle='#7fb6cc';x.fillText(row[1],GX+130,Y+27);x.fillText(row[2],GX+250,Y+27);x.fillStyle='#35e0a0';x.fillRect(GX+GW-140,Y+6,128,26);x.fillStyle='#02070c';x.font='700 20px '+sans;x.fillText(row[3],GX+GW-112,Y+26);});
    // 下段：警報の帯と流れる文字
    x.fillStyle='#b3261c';x.fillRect(0,872,w,74);for(let i=0;i<12;i++){x.fillStyle='rgba(0,0,0,.25)';x.beginPath();x.moveTo(i*40,872);x.lineTo(i*40+20,872);x.lineTo(i*40-34,946);x.lineTo(i*40-54,946);x.fill();}
    x.fillStyle='#fff';x.font='700 44px '+sans;x.fillText('SCRAMBLE  ―  STORM RIDER FLIGHT  ―  HANGAR 1 DOORS OPENING',470,926);
    x.fillStyle='#071a26';x.fillRect(0,946,w,78);x.fillStyle='#9fd8ee';x.font='24px '+mono;x.fillText('WX ADVISORY 13-27 ▸ STORM SURGE WARNING ALL COASTS ▸ RWY 18/36 OPEN ▸ WIND 190/08 ▸ QNH 1004 ▸ NEXT SAT PASS 17:50',28,994);
    // 表示盤の継ぎ目（8×4 枚）と、LED らしい細かな格子
    x.fillStyle='rgba(0,0,0,.10)';for(let Y=0;Y<h;Y+=4)x.fillRect(0,Y,w,1);for(let X=0;X<w;X+=4)x.fillRect(X,0,1,h);
    x.fillStyle='rgba(0,0,0,.55)';for(let i=1;i<8;i++)x.fillRect(i*256-1,0,2,h);for(let j=1;j<4;j++)x.fillRect(0,j*256-1,w,2);
    // 1 枚だけ少し暗い表示盤（保守待ち）
    x.fillStyle='rgba(0,0,0,.28)';x.fillRect(5*256+1,256+1,254,254);});
  const sm=new THREE.Mesh(new THREE.PlaneGeometry(44,22),new THREE.MeshBasicMaterial({map:scr,color:new THREE.Color(1.25,1.28,1.32)}));sm.rotation.y=Math.PI;sm.position.set(0,19,87.28);HG.add(sm);box(HG,45.2,23.2,.5,darkM,0,19,87.56);
  {const fr=std({color:lin(0x2a3036),roughness:.5,metalness:.7});for(const y of[7.2,30.8])box(HG,46,.5,.9,fr,0,y,87.45);for(const sx of[-22.8,22.8])box(HG,.5,24,.9,fr,sx,19,87.45);
    for(const sx of[-18,-6,6,18]){box(HG,.5,7.2,.5,fr,sx,3.6,87.5);const br=box(HG,.3,5,.3,fr,sx,3.2,86.2);br.rotation.x=-.5;}
    box(HG,46,.2,1.6,fr,0,6.6,86.6);for(let k=-11;k<=11;k++)box(HG,.08,1.1,.08,paleM,k*2,7.2,85.9);box(HG,46,.08,.08,paleM,0,7.75,85.9);
    for(const sx of[-24.6,24.6]){box(HG,1.6,3.4,1.2,darkM,sx,27,87.2);for(let k=0;k<3;k++){const c=new THREE.Mesh(new THREE.CircleGeometry(.42,14),fr);c.rotation.y=Math.PI;c.position.set(sx,26+k*1.0,86.59);HG.add(c);}}
    for(let k=-5;k<=5;k++)box(HG,.14,.14,1.2,fr,k*4,31.4,87.6);}
  for(const s of[-1,1]){box(HG,10,.3,5,darkM,s*30,7,84,true);for(const px of[-4.5,4.5])box(HG,.25,7,.25,paleM,s*30+px,3.5,82);for(let st=0;st<9;st++)box(HG,2.2,.18,.7,paleM,s*30+(s>0?-7:7)*(.4+st*.09)-0,st*.78+.4,80.5-st*.2+ (st*0));}
  // 扉の走行レールと警告灯
  box(HG,190,.12,.5,darkM,0,.08,-87.6);box(HG,190,.12,.5,darkM,0,.08,-89.4);
  for(const s of[-1,1]){const l=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(3.4,1.5,.2),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));l.position.set(s*44,26,-86.5);l.scale.set(5,5,1);HG.add(l);}
}

// ───────────────────────── 基地の建物の作り込み ─────────────────────────
function radomeTex(){
  // レドームの三角パネルの継ぎ目
  const c=document.createElement('canvas');c.width=1024;c.height=512;const x=c.getContext('2d');x.fillStyle='#e9e0c8';x.fillRect(0,0,1024,512);
  const r=mulberry(9);for(let j=0;j<16;j++)for(let i=0;i<33;i++){const w=1024/32,h=512/16,ox=(j%2)*w/2,g=214+r()*26|0;x.fillStyle='rgb('+(g+14)+','+(g+6)+','+(g-22)+')';
    x.beginPath();x.moveTo(i*w-ox,j*h);x.lineTo(i*w-ox+w,j*h);x.lineTo(i*w-ox+w/2,j*h+h);x.fill();const g2=206+r()*26|0;x.fillStyle='rgb('+(g2+14)+','+(g2+6)+','+(g2-22)+')';x.beginPath();x.moveTo(i*w-ox+w,j*h);x.lineTo(i*w-ox+w*1.5,j*h+h);x.lineTo(i*w-ox+w/2,j*h+h);x.fill();
    x.strokeStyle='rgba(28,106,112,.7)';x.lineWidth=1.4;x.beginPath();x.moveTo(i*w-ox,j*h);x.lineTo(i*w-ox+w,j*h);x.lineTo(i*w-ox+w/2,j*h+h);x.closePath();x.stroke();}
  const g=x.createLinearGradient(0,330,0,512);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(40,44,48,.35)');x.fillStyle=g;x.fillRect(0,330,1024,182);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return t;
}
function detailBase(B0,M){
  const B=new THREE.Group();B0.add(B);B0.userData.detail=B;
  const{hullM,paleM,darkM,glassM,cyM,amM,box,conc}=M,r=mulberry(52);
  const cv=(w,h,draw,rep)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');draw(x,w,h);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rep[0],rep[1]);}return t;};
  // 外壁：コンクリートパネルと連窓（一部に灯り）
  const facade=(floors,cols,lit)=>cv(1024,256,(x,w,h)=>{x.fillStyle='#e4dabf';x.fillRect(0,0,w,h);
    for(let i=0;i<700;i++){const g=150+r()*60|0;x.fillStyle='rgba('+g+','+g+','+g+',.10)';x.fillRect(r()*w,r()*h,3+r()*40,3+r()*30);}
    const fh=h/floors,cw=w/cols;for(let f=0;f<floors;f++){x.fillStyle='#1c6a70';x.fillRect(0,f*fh+fh*.80,w,fh*.16);x.fillStyle='#b8683a';x.fillRect(0,f*fh+fh*.78,w,fh*.025);x.fillRect(0,f*fh+fh*.03,w,fh*.03);
      for(let c=0;c<cols;c++){const on=r()<lit,x0=c*cw+cw*.2,ww=cw*.6,y0=f*fh+fh*.22,hh=fh*.5;
        x.fillStyle='#8f5330';x.beginPath();x.moveTo(x0-2,y0+hh+2);x.lineTo(x0-2,y0+ww/2);x.arc(x0+ww/2,y0+ww/2,ww/2+2,Math.PI,0);x.lineTo(x0+ww+2,y0+hh+2);x.fill();
        x.fillStyle=on?'rgba(255,214,150,'+(.7+r()*.3)+')':'rgb('+(18+r()*14|0)+','+(52+r()*20|0)+','+(64+r()*20|0)+')';x.beginPath();x.moveTo(x0,y0+hh);x.lineTo(x0,y0+ww/2);x.arc(x0+ww/2,y0+ww/2,ww/2,Math.PI,0);x.lineTo(x0+ww,y0+hh);x.fill();
        x.fillStyle='#8f5330';x.fillRect(x0+ww/2-.7,y0,1.4,hh);}
      x.fillStyle='rgba(40,44,48,.5)';x.fillRect(0,f*fh+fh*.985,w,2);}
    const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(0,0,0,.0)');g.addColorStop(1,'rgba(30,30,28,.28)');x.fillStyle=g;x.fillRect(0,0,w,h);
    for(let i=0;i<40;i++){x.fillStyle='rgba(40,38,34,'+r()*.16+')';x.fillRect(r()*w,0,1+r()*2,20+r()*h*.7);}});
  const{copperM,brassM}=M;
  const wallA=std({map:facade(2,34,.3),roughness:.75,metalness:.05}),wallB=std({map:facade(1,24,.45),roughness:.7,metalness:.05});
  const roof=std({color:lin(0x1c6a70),roughness:.55,metalness:.4});
  const bld=(w,h,d,x,y,z,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),[mat,mat,roof,roof,mat,mat]);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;B.add(m);return m;};
  // 本棟（低層）＋上層、庇、屋上設備
  bld(150,14,76,330,RWY_Y+7,400,wallA);bld(104,10,52,322,RWY_Y+19,400,wallB);
  box(B,154,.6,80,copperM,330,RWY_Y+14.3,400,true);
  for(const s of[-1,1]){const end=new THREE.Mesh(new THREE.CylinderGeometry(38,38,14,32,1,false,0,Math.PI),wallA.clone());end.material.map=wallA.map;end.rotation.y=s>0?-Math.PI/2:Math.PI/2;end.position.set(330+s*75,RWY_Y+7,400);end.castShadow=true;B.add(end);
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(39.5,39.5,.6,32,1,false,0,Math.PI),copperM);cap.rotation.y=s>0?-Math.PI/2:Math.PI/2;cap.position.set(330+s*75,RWY_Y+14.3,400);B.add(cap);}
  {// 上層の棟に、低いかまぼこ形の銅屋根と真鍮のリブ
    const vg=new THREE.CylinderGeometry(26,26,104,32);vg.rotateZ(Math.PI/2);const vault=new THREE.Mesh(vg,copperM);vault.scale.set(1,.3,1);vault.position.set(322,RWY_Y+24.2,400);vault.castShadow=true;B.add(vault);
    for(let k=-4;k<=4;k++){const rib=new THREE.Mesh(new THREE.TorusGeometry(26.25,.35,6,32),brassM);rib.rotation.y=Math.PI/2;rib.scale.set(1,.3,1);rib.position.set(322+k*12.5,RWY_Y+24.2,400);B.add(rib);}
    const cup=new THREE.Mesh(new THREE.SphereGeometry(9,24,12,0,6.283,0,1.571),roof);cup.position.set(286,RWY_Y+35,400);B.add(cup);const cdr=new THREE.Mesh(new THREE.CylinderGeometry(9,9.6,11,24),M.paleM);cdr.position.set(286,RWY_Y+29.5,400);B.add(cdr);
    const cr=new THREE.Mesh(new THREE.TorusGeometry(9.2,.4,6,28),brassM);cr.rotation.x=Math.PI/2;cr.position.set(286,RWY_Y+35,400);B.add(cr);
    const fin=new THREE.Mesh(new THREE.ConeGeometry(.9,9,8),brassM);fin.position.set(286,RWY_Y+48.5,400);B.add(fin);
    for(let k=0;k<10;k++){const a=k/10*6.283,ph=new THREE.Mesh(new THREE.TorusGeometry(1.0,.2,6,14),brassM);ph.position.set(286+Math.cos(a)*9.35,RWY_Y+32,400+Math.sin(a)*9.35);ph.rotation.y=-a+Math.PI/2;B.add(ph);
      const gl=new THREE.Mesh(new THREE.CircleGeometry(.95,12),new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.3,.8)}));gl.position.copy(ph.position);gl.rotation.y=-a+Math.PI/2;B.add(gl);}}
  box(B,26,.5,9,hullM,254,RWY_Y+4.4,400,true);for(const dz of[-10,10])box(B,.5,4.4,.5,M.paleM,246,RWY_Y+2.2,400+dz);
  box(B,.3,3.4,8,new THREE.MeshBasicMaterial({color:new THREE.Color(1.9,1.6,1.1)}),254.6,RWY_Y+1.9,400);
  for(let k=0;k<7;k++){box(B,5,2.4,4,M.paleM,286+k*13,RWY_Y+25.7,384+(k%2)*30,true);const f=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,.5,14),darkM);f.position.set(286+k*13,RWY_Y+27.1,384+(k%2)*30);B.add(f);}
  for(let k=0;k<4;k++){const p=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,96,8),M.paleM);p.rotation.z=Math.PI/2;p.position.set(322,RWY_Y+25,378+k*1.2);B.add(p);}
  // 構内道路（センターライン入り）
  const roadT=cv(64,512,(x,w,h)=>{x.fillStyle='#303236';x.fillRect(0,0,w,h);for(let i=0;i<300;i++){const g=40+r()*30|0;x.fillStyle='rgba('+g+','+g+','+g+',.12)';x.fillRect(r()*w,r()*h,2+r()*8,4+r()*40);}
    x.fillStyle='#d8d8d0';x.fillRect(3,0,2,h);x.fillRect(w-5,0,2,h);x.fillStyle='#d9a21b';for(let y=0;y<h;y+=64)x.fillRect(w/2-1,y,2,36);},[1,1]);
  let roadN=0;const road=(x0,z0,x1,z1,wd)=>{const ri=roadN++;const L=Math.hypot(x1-x0,z1-z0),t=roadT.clone();t.needsUpdate=true;t.repeat.set(1,L/40);const m=new THREE.Mesh(new THREE.PlaneGeometry(wd,L),std({map:t,roughness:.9,metalness:0,polygonOffset:true,polygonOffsetFactor:-ri,polygonOffsetUnits:-ri*2}));
    m.rotation.set(-Math.PI/2,0,-Math.atan2(x1-x0,z1-z0),'YXZ');m.rotation.order='YXZ';m.rotation.y=Math.atan2(x1-x0,z1-z0);m.rotation.x=-Math.PI/2;m.rotation.z=0;m.position.set((x0+x1)/2,RWY_Y-.1+ri*.03,(z0+z1)/2);m.receiveShadow=true;B.add(m);};
  road(210,-240,210,620,9);road(210,400,252,400,9);road(210,620,535,640,9);road(60,975,210,620,9);road(210,-40,420,-40,8);
  // 街灯
  for(let z=-220;z<=600;z+=58){const p=new THREE.Mesh(new THREE.CylinderGeometry(.14,.2,9,6),copperM);p.position.set(216,RWY_Y+4.5,z);B.add(p);{const gb=new THREE.Mesh(new THREE.SphereGeometry(.55,10,8),new THREE.MeshBasicMaterial({color:new THREE.Color(2.2,1.9,1.3)}));gb.position.set(216,RWY_Y+9.4,z);B.add(gb);const cp=new THREE.Mesh(new THREE.ConeGeometry(.7,.6,8),copperM);cp.position.set(216,RWY_Y+10.1,z);B.add(cp);}
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(2.4,2.1,1.5),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));s.position.set(216,RWY_Y+9.4,z);s.scale.set(3.2,3.2,1);B.add(s);}
  // 駐車場と車
  {const lot=new THREE.Mesh(new THREE.PlaneGeometry(46,30),std({color:lin(0x35383b),roughness:.9}));lot.rotation.x=-Math.PI/2;lot.position.set(240,RWY_Y-.02,470);lot.receiveShadow=true;B.add(lot);
    const cols=[0xc9ced2,0x23272b,0x7a1f1a,0x2c4f7a,0xd8d8d0,0x4d5a66];for(let i=0;i<11;i++){if(r()<.25)continue;const c=new THREE.Group();c.position.set(221+(i%6)*7.2,RWY_Y+.75,i<6?462:478);
      const cc=buildVehicle('car',cols[i%cols.length]);c.add(cc);c.position.y=RWY_Y;c.rotation.y=i<6?0:Math.PI;B.add(c);}}
  // 外周フェンス（支柱は一括描画）
  {const pts=[[150,-260],[470,-260],[470,560],[150,560]],pg=new THREE.CylinderGeometry(.07,.07,2.6,5),im=new THREE.InstancedMesh(pg,darkM,400),d=new THREE.Object3D();let n=0;
    for(let k=0;k<4;k++){const[a,b]=[pts[k],pts[(k+1)%4]],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(k===3)continue;
      for(let s=0;s<=L;s+=6){d.position.set(a[0]+(b[0]-a[0])*s/L,RWY_Y+1.3,a[1]+(b[1]-a[1])*s/L);d.updateMatrix();im.setMatrixAt(n++,d.matrix);}
      const rail=new THREE.Mesh(new THREE.BoxGeometry(L,1.9,.04),new THREE.MeshStandardMaterial({color:0x7a8288,transparent:true,opacity:.28,roughness:.6,metalness:.6,side:THREE.DoubleSide}));rail.position.set((a[0]+b[0])/2,RWY_Y+1.45,(a[1]+b[1])/2);rail.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);B.add(rail);}
    im.count=n;B.add(im);}
  // 管制塔の胴に窓の帯、足元に基部棟
  for(let k=0;k<5;k++){const w=new THREE.Mesh(new THREE.CylinderGeometry(4.6-k*.42,4.8-k*.42,1.1,12,1,true),new THREE.MeshBasicMaterial({color:new THREE.Color(.18,.5,.6)}));w.position.set(200,RWY_Y+10+k*12,360);B.add(w);}
  bld(26,7,20,200,RWY_Y+3.5,360,wallA);
}

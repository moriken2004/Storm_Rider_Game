// ───────────────────────── 海 ─────────────────────────
const GLSL_WAVES=`
const vec4 WAV[6]=vec4[6](vec4(0.955,0.296,0.02027,2.6),vec4(0.454,0.891,0.03307,1.7),vec4(0.878,-0.479,0.05236,1.1),
  vec4(-0.416,0.909,0.08378,0.6),vec4(0.697,0.717,0.1366,0.38),vec4(0.267,-0.964,0.2167,0.22));
float harb(vec2 xz){vec2 l=xz-vec2(0.0,21000.0);float u=clamp((l.x-1282.0)/358.0,0.0,1.0);float zn=mix(-246.0,-150.0,u),zs=mix(556.0,440.0,u);
  return smoothstep(1268.0,1296.0,l.x)*(1.0-smoothstep(1648.0,1672.0,l.x))*smoothstep(zn-6.0,zn+14.0,l.y)*(1.0-smoothstep(zs-14.0,zs+6.0,l.y));}
float seaState(vec2 xz,float c){return max(c,(1.0-smoothstep(2500.0,14000.0,length(xz)))*0.75*uStorm)*(1.0-uCalm);}   // uCalm：探検中は凪
`;
let ocean;
function shoreTex(){const N=512,d=new Uint8Array(N*N*4),H=new Float32Array(N*N),D=new Float32Array(N*N),cs=6400/N;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=-3200+6400*(i+.5)/N,z=-3400+6800*(j+.5)/N,h=islandH(x,z);H[j*N+i]=h;D[j*N+i]=h>0?0:1e9;}
  // 陸からの距離（2 回の走査で近似）
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i;let v=D[k];if(i>0)v=Math.min(v,D[k-1]+cs);if(j>0)v=Math.min(v,D[k-N]+cs);if(i>0&&j>0)v=Math.min(v,D[k-N-1]+cs*1.414);if(i<N-1&&j>0)v=Math.min(v,D[k-N+1]+cs*1.414);D[k]=v;}
  for(let j=N-1;j>=0;j--)for(let i=N-1;i>=0;i--){const k=j*N+i;let v=D[k];if(i<N-1)v=Math.min(v,D[k+1]+cs);if(j<N-1)v=Math.min(v,D[k+N]+cs);if(i<N-1&&j<N-1)v=Math.min(v,D[k+N+1]+cs*1.414);if(i>0&&j<N-1)v=Math.min(v,D[k+N-1]+cs*1.414);D[k]=v;}
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,x=-3200+6400*(i+.5)/N,z=-3400+6800*(j+.5)/N,h=H[k];let v=h;
    if(h<=0){const dd=D[k],nz=.75+.5*vnoise2(x/420+3,z/420+7)+.25*vnoise2(x/90,z/90),shelf=Math.pow(dd/900,1.25)*30*nz+8*cliffAt(x,z)*Math.min(1,dd/50)*(1-smooth(80,300,dd));v=-Math.max(-h*Math.max(0,1-dd/260),.4+shelf);}
    const q=Math.max(0,Math.min(255,Math.round((v+64)/72*255))),o=k*4;d[o]=d[o+1]=d[o+2]=q;d[o+3]=255;}
  const t=new THREE.DataTexture(d,N,N,THREE.RGBAFormat);t.minFilter=t.magFilter=THREE.LinearFilter;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.needsUpdate=true;return t;}
function buildCanopy(){
  const m=new THREE.ShaderMaterial({uniforms:Object.assign({},U),transparent:true,depthTest:false,depthWrite:false,
    vertexShader:'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader:`uniform sampler2D tNoise2;varying vec3 vW;
${GLSL_COMMON}
void main(){
  float fade=smoothstep(6500.0,15000.0,cameraPosition.y)*sat(uStorm*1.5);if(fade<0.01)discard;
  vec2 xz=vW.xz;float r=length(xz),th=atan(xz.y,xz.x);
  vec4 sc=stormCover(vec3(xz.x,300.0,xz.y));
  float n1=texture2D(tNoise2,xz/5200.0+uTime*0.0004).b,n2=texture2D(tNoise2,xz/1400.0).b,n3=texture2D(tNoise2,xz/430.0).b;
  float cl=smoothstep(0.30,0.80,sc.x*0.95+(n1-0.5)*0.45+(n2-0.5)*0.35+(n3-0.5)*0.18);
  // 上空の巻雲：中心から時計回りに吹き出し、ふちは羽毛状の筋。目は穴
  float ph=-th*3.0+log(max(r,500.0)/2000.0)*5.5+uTime*0.002;
  float fib=texture2D(tNoise2,vec2(ph*0.11,r/9000.0)).b;
  float cir=(1.0-smoothstep(7500.0+2500.0*n1,15500.0+3500.0*n1,r))*smoothstep(0.30,0.62,fib*0.8+n2*0.35);
  cir*=smoothstep(EYE_R*uEye*1.15,EYE_R*uEye*1.9,r)*0.62;
  float a=max(cl,cir)*fade;if(a<0.003)discard;
  // 雲頂の凹凸（日の向きにずらした差で陰影）と、目の内壁の陰
  float g=n3-texture2D(tNoise2,xz/430.0+uSunDir.xz*0.004).b+(n2-texture2D(tNoise2,xz/1400.0+uSunDir.xz*0.003).b)*0.7;
  float lit=(0.72+0.28*sat(sc.w/4300.0))*(0.92+g*1.6)*(1.0-0.35*(1.0-smoothstep(EYE_R*uEye,EYE_R*uEye*1.5,r)));
  vec3 col=(uSunCol*0.42*max(uSunDir.y,0.2)+uSkyZen*0.5+uSkyHor*0.35)*lit*mix(0.8,1.08,cl);
  gl_FragColor=vec4(col,a);
}`});
  const p=new THREE.Mesh(new THREE.PlaneGeometry(46000,46000),m);p.rotation.x=-Math.PI/2;p.position.y=4900;p.frustumCulled=false;p.renderOrder=-1;overlay.add(p);return p;}
function buildOcean(){
  U.tShore.value=shoreTex();buildCanopy();
  const RINGS=210,SEG=200,pos=[],idx=[];
  for(let i=0;i<=RINGS;i++){const r=i===0?0:5*Math.pow(1.047,i);
    for(let j=0;j<SEG;j++){const a=j/SEG*Math.PI*2;pos.push(Math.cos(a)*r,0,Math.sin(a)*r);}}
  for(let i=0;i<RINGS;i++)for(let j=0;j<SEG;j++){const a=i*SEG+j,b=i*SEG+(j+1)%SEG,c=a+SEG,d=b+SEG;idx.push(a,b,c,b,d,c);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);
  const m=new THREE.ShaderMaterial({
    uniforms:Object.assign({uSnap:{value:new THREE.Vector2()},tRefC:{value:null},tRefD:{value:null},uRefOn:{value:0},tRefl:{value:null},uReflOn:{value:0},uReflPV:{value:new THREE.Matrix4()},uRefRes:{value:new THREE.Vector2(1,1)},uRefNF:{value:new THREE.Vector2(1,1000)}},U),
    vertexShader:`uniform vec2 uSnap;uniform sampler2D tShore;varying vec3 vW;varying vec2 vP;
float shoreHv(vec2 xz){vec2 u=(xz-vec2(0.0,21000.0)+vec2(3200.0,3400.0))/vec2(6400.0,6800.0);float e=smoothstep(0.0,0.06,min(min(u.x,1.0-u.x),min(u.y,1.0-u.y)));return mix(-64.0,texture2D(tShore,clamp(u,0.0,1.0)).r*72.0-64.0,e);}
${GLSL_COMMON}${GLSL_WAVES}
void main(){
  vec3 p=position;float R=length(p.xz);p.xz+=uSnap;vP=p.xz;
  float c=stormCover(vec3(p.x,0.0,p.z)).x;float wpv=seaState(p.xz,c),sea=0.3+2.2*wpv;   // 嵐ほど高い波
  vec3 d=vec3(0.0);
  for(int i=0;i<6;i++){vec4 W=WAV[i];float lam=6.2832/W.z;float f=1.0-smoothstep(lam*3.0,lam*5.5,R);
    float ph=W.z*dot(W.xy,p.xz)-sqrt(9.8*W.z)*uTime;d.y+=W.w*sin(ph)*f;d.xz+=W.xy*W.w*cos(ph)*f*(0.75*wpv);}   // 嵐では波頭を尖らせる（頂点を波の進む向きへ寄せる）
  p+=d*sea*(1.0-0.88*harb(p.xz))*mix(0.12,1.0,smoothstep(0.0,9.0,-shoreHv(p.xz)));vW=p;   // 浅瀬ではうねりを小さく（浜に乗り上げない）
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);
}`,
    fragmentShader:`precision highp sampler3D;
uniform sampler3D tNoise;uniform sampler2D tNoise2,tShore;uniform vec4 uPSh[3];uniform vec2 uPSh2[3];varying vec3 vW;varying vec2 vP;
// 地形の高さ（島の外は深い海）
float shoreH(vec2 xz){vec2 u=(xz-vec2(0.0,21000.0)+vec2(3200.0,3400.0))/vec2(6400.0,6800.0);float e=smoothstep(0.0,0.06,min(min(u.x,1.0-u.x),min(u.y,1.0-u.y)));return mix(-64.0,texture2D(tShore,clamp(u,0.0,1.0)).r*72.0-64.0,e);}
uniform sampler2D tRefC,tRefD,tRefl;uniform float uRefOn,uReflOn;uniform vec2 uRefRes,uRefNF;uniform mat4 uReflPV;
float smN(vec2 uv){uv=uv*256.0+0.5;vec2 i=floor(uv),f=fract(uv);f=f*f*f*(f*(f*6.0-15.0)+10.0);return texture2D(tNoise2,(i+f-0.5)/256.0).b;}
${GLSL_COMMON}${GLSL_WAVES}
// 晴天の積雲が落とす影：雲の層（高度 1700m 付近）まで太陽方向へたどった位置の雲量
float cumShadow(vec2 xz,float y){vec2 q=xz+uSunDir.xz/max(uSunDir.y,0.12)*(1700.0-y);float fn=texture(tNoise,vec3(q*0.000037,0.37)).g;
  return smoothstep(0.47,0.72,fn)*mix(1.0,smoothstep(12300.0,16500.0,length(q)),clamp(uStorm*4.0,0.0,1.0));}
vec2 rot(vec2 v,float a){float c=cos(a),s=sin(a);return vec2(c*v.x-s*v.y,s*v.x+c*v.y);}
// 自機の影の形（胴体・後退翼・尾翼。機首は -z）。b はぼけの幅
float planeShadow1(vec2 xz,vec4 S,vec2 S2){if(S.w<0.003)return 0.0;vec2 d=xz-S.xy;if(dot(d,d)>900.0)return 0.0;float c=cos(S.z),s=sin(S.z);vec2 l=vec2(c*d.x-s*d.y,s*d.x+c*d.y);l.x/=max(S2.y,0.2);float b=S2.x;
  float fus=1.0-smoothstep(-b,b,length(vec2(l.x/1.3,l.y/9.0))*9.0-9.0);
  float hw=8.6*clamp((l.y+2.0)/5.5,0.0,1.0);float wing=(1.0-smoothstep(-b,b,abs(l.x)-hw))*smoothstep(-b-0.2,b+0.2,l.y+2.0)*(1.0-smoothstep(-b,b,l.y-3.6));
  float tw=3.4*clamp((l.y-6.0)/3.0,0.0,1.0);float tail=(1.0-smoothstep(-b,b,abs(l.x)-tw))*smoothstep(-b,b,l.y-6.0)*(1.0-smoothstep(-b,b,l.y-9.2));
  return clamp(max(fus,max(wing,tail)),0.0,1.0)*S.w;}
float planeShadow(vec2 xz){return max(planeShadow1(xz,uPSh[0],uPSh2[0]),max(planeShadow1(xz,uPSh[1],uPSh2[1]),planeShadow1(xz,uPSh[2],uPSh2[2])));}
void main(){
  vec2 xz=vP;float dist=length(vW-cameraPosition);
  vec4 sc=stormCover(vec3(xz.x,0.0,xz.y));
  float wp=seaState(xz,sc.x),sea=0.3+2.2*wp;
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
  {float sk=smN(rot(xz,0.35)/vec2(420.0,95.0)+wd*0.00035)*0.65+smN(rot(xz,1.2)/170.0-wd*0.0006)*0.35;float slick=smoothstep(0.6,0.7,sk)*(1.0-sat(wp*2.0))*(1.0-smoothstep(1500.0,4000.0,dist));g*=1.0-0.72*slick;}   // 凪の帯（さざ波が消えて鏡のよう）
  sl+=g*(0.42+0.85*wp+0.9*wp*wp)*0.6*wPat;sl*=1.0-0.78*harb(xz);
  vec3 N=normalize(vec3(-sl.x,1.0,-sl.y));
  vec3 V=normalize(cameraPosition-vW);
  float NdV=max(dot(N,V),0.02);
  float F=0.02+0.98*pow(1.0-NdV,5.0);
  F=mix(F,F*0.72+0.02,sat(dist/9000.0));
  vec3 R=reflect(-V,N);R.y=abs(R.y)+0.015;R=normalize(R);
  // 反射した視線が雲底に当たる場所の雲量
  vec2 hit=xz+clamp(R.xz/R.y,vec2(-9.0),vec2(9.0))*1300.0;
  float cR=stormCover(vec3(hit.x,1300.0,hit.y)).x;
  // 海面の影は淡く、輪郭も柔らかく（海はおもに空を映すので、影が効くのは日のきらめきと水中の色だけ）
  float sv=(1.0-0.92*sc.x)*mix(1.0,farShadow(vec3(xz.x,5.0,xz.y)),0.75)*(1.0-0.36*cumShadow(xz,0.0));
  float psh=planeShadow(xz);sv*=1.0-psh;
  vec2 fd=(xz-uFlashPos.xz)/1800.0;vec3 fl=vec3(1.6,1.9,2.6)*uFlashI/(1.0+dot(fd,fd));
  // 空からの明かりは小さな雲の下でも届く（遮られるのは直射だけ）。暗さは嵐の大きな広がりで決め、その地点の雲量は少しだけ効かせる
  float rr1=length(xz),bigC=smoothstep(EYE_R*uEye*0.9,EYE_R*uEye*1.4,rr1)*(1.0-smoothstep(4500.0,15500.0,rr1))*clamp(uStorm,0.0,1.0),ambC=max(sc.x*0.38,bigC*0.92);
  vec3 cloudRef=mix(vec3(0.34,0.37,0.41),vec3(0.058,0.066,0.078),sat(max(sc.x*0.5,bigC)*1.1))+fl*0.25;
  vec3 refl=mix(skyColor(R),cloudRef,sat(cR*1.25));
  vec3 E=uSunCol*sv*0.16+mix(uSkyHor*0.7,vec3(0.11,0.12,0.14),sat(ambC*1.2))+fl*0.2;
  vec3 body=mix(vec3(0.006,0.040,0.085),vec3(0.026,0.058,0.062),wp)*(E+0.04);
  // 波頭の透過色。うねり 3 本の重なりは規則的な格子になるので、遠目（上空）では消し、近くでもむらを掛ける
  body+=vec3(0.0,0.050,0.046)*sat(crest/(0.317*sea))*sv*(1.0-smoothstep(220.0,950.0,dist))*(0.3+1.1*smN(rot(xz,1.3)/370.0+wd*0.001));
  body*=0.78+0.26*wPat;
  // 島のまわりの浅瀬
  vec2 il=(xz-vec2(0.0,21000.0))/vec2(1500.0,1750.0);float idv=length(il)+(texture2D(tNoise2,xz/2600.0).b-0.5)*0.22;
  float hbm=harb(xz);
  float sh=shoreH(xz),dep=max(-sh,0.0);
  float shal=(1.0-smoothstep(1.0,38.0,dep));shal=shal*shal*(1.0-hbm*0.55);
  body=mix(body,vec3(0.02,0.16,0.20)*(E+0.04),(1.0-smoothstep(10.0,45.0,dep))*0.6);
  body=mix(body,vec3(0.035,0.30,0.29)*(E+0.04),shal*0.85);
  body=mix(body,vec3(0.36,0.33,0.25)*(E+0.06),(1.0-smoothstep(0.0,2.2,dep))*(1.0-hbm)*0.55);
  // 港の中：浚渫して少し深く、濁った青緑。むらを付けて周りの海から急に色が変わらないように
  {float hn=texture2D(tNoise2,xz/180.0).b;body=mix(body,vec3(0.022,0.15,0.14)*(0.85+0.3*hn)*(E+0.04),hbm*0.55);}
  body*=1.0-0.3*psh;
  // 探検の近景：水を透かして底を見る。水の中を通る道のりだけ赤から先に吸われ、青緑の散乱光が足される。さざ波で像がゆがむ
  if(uRefOn>0.5&&dist<130.0){vec2 suv=gl_FragCoord.xy/uRefRes;float nn=uRefNF.x,ff=uRefNF.y;
    float zs=nn*ff/(ff-gl_FragCoord.z*(ff-nn));vec2 off=vec2(N.x,N.z)*0.09/(1.0+dist*0.04);vec2 uv2=clamp(suv+off,0.001,0.999);float d0=texture2D(tRefD,uv2).x;float zb=nn*ff/(ff-d0*(ff-nn));
    if(zb<zs){uv2=suv;d0=texture2D(tRefD,suv).x;zb=nn*ff/(ff-d0*(ff-nn));}
    if(d0<0.99999){float path=max(0.0,zb-zs)*dist/max(zs,0.01);vec3 ext=exp(-path*vec3(0.42,0.095,0.07));vec3 und=texture2D(tRefC,uv2).rgb;
      vec3 sca=vec3(0.02,0.14,0.15)*(E+0.04)*(1.0-ext.g)*(1.0+0.6*shal);vec3 tr=und*ext+sca;float k=(1.0-smoothstep(70.0,125.0,dist));
      body=mix(body,tr,k*(1.0-hbm*0.35));}}
  // 近くの物の映り込み（探検）：鏡のカメラで描いた絵を、さざ波の向きでゆがめて重ねる。遠いほど薄く
  // 近くの物の映り込み（探検）：波の傾きでゆがめ（縦に大きく）、縦に引き伸ばして 7 点でぼかす。波が立つほど薄く、ちぎれる
  if(uReflOn>0.5&&dist<1200.0){vec4 rp=uReflPV*vec4(vW.x,0.0,vW.z,1.0);vec2 ruv=rp.xy/rp.w*0.5+0.5;float slp=length(sl)+length(g)*0.12;
    vec2 off=vec2(N.x*0.9,N.z*2.4)*(0.55/(1.0+dist*0.004));ruv+=off;float spr=0.004+slp*0.05;vec4 rc=vec4(0.0);
    for(int i=0;i<7;i++){float t=float(i)-3.0;rc+=texture2D(tRefl,clamp(ruv+vec2(0.0,t*spr),0.001,0.999))*(1.0-abs(t)*0.12);}rc/=5.56;
    float br=smoothstep(0.35,0.75,texture2D(tNoise2,xz/1.3+wd*0.05).b*0.6+texture2D(tNoise2,xz/0.47-wd*0.08).b*0.5);   // 細かな波でちぎれる
    float a=clamp(rc.a,0.0,1.0)*(0.92-0.55*smoothstep(0.03,0.16,slp))*(1.0-0.35*br*smoothstep(0.02,0.1,slp))*(1.0-smoothstep(600.0,1200.0,dist));
    refl=mix(refl,rc.rgb/max(rc.a,0.001),a);}
  vec3 col=mix(body,refl,F*(1.0-0.25*psh));
  // 太陽のきらめき
  vec3 Hh=normalize(V+uSunDir);float NdH=max(dot(N,Hh),0.0);
  float al=(0.040+0.05*wp)*(0.6+0.5*wPat)+sat(dist/14000.0)*0.11,a2=al*al;
  float Dg=a2/(3.14159*pow(NdH*NdH*(a2-1.0)+1.0,2.0));
  float Fs=0.02+0.98*pow(1.0-max(dot(V,Hh),0.0),5.0);
  col+=uSunCol*min(Dg*Fs*0.25,24.0)*sv*0.30;
  // 白波
  float n1=texture2D(tNoise2,xz/71.0+wd*0.010).b,n2=texture2D(tNoise2,rot(xz,1.3)/19.0-wd*0.02).b,n3=texture2D(tNoise2,rot(xz,2.1)/6.3+wd*0.03).b;
  float cn=crest/(0.317*sea);
  float th=mix(1.28,0.22,sat(wp*1.1));
  float cap=smoothstep(th,th+0.22,cn*0.6+n1*0.75);
  // 白波は風下へ引き伸ばされた筋で、内側はレース状にほどける（丸い綿のかたまりに見せない）
  float strk=texture2D(tNoise2,rot(xz,0.64)/vec2(64.0,7.5)+wd*0.004).b*0.65+texture2D(tNoise2,rot(xz,0.64)/vec2(23.0,3.1)-wd*0.009).b*0.35;
  cap*=smoothstep(0.38,0.66,strk);
  float lace=smoothstep(0.43,0.62,n2*0.62+n3*0.48)*(0.55+0.45*smoothstep(0.3,0.7,strk));
  float foam=cap*lace;
  // 磯波
  {float sw=texture2D(tNoise2,xz/260.0).b*6.0,ph=dep*0.85+uTime*1.05+sw;
    float brk=pow(max(sin(ph),0.0),22.0)*smoothstep(7.5,2.0,dep)*smoothstep(0.25,0.9,dep)*smoothstep(0.34,0.6,n3*0.75+n2*0.35);   // 砕け波の列
    float trail=pow(max(sin(ph-0.45),0.0),5.0)*smoothstep(4.0,1.0,dep)*smoothstep(0.1,0.6,dep)*smoothstep(0.52,0.74,n3*0.7+n2*0.4)*0.5; // 崩れたあとの泡
    float edge=0.55+0.45*sin(uTime*0.55+sw);float swash=smoothstep(0.0,0.08,dep)*(1.0-smoothstep(0.15+0.55*edge,0.35+0.75*edge,dep))*smoothstep(0.32,0.6,n2*0.5+n3*0.6);  // 波打ち際
    foam=max(foam,max(max(brk,trail),swash*0.9)*(1.0-hbm));}
  float rr0=length(xz);
  float st=texture2D(tNoise2,vec2(atan(xz.y,xz.x)*35.65+rr0/900.0+uTime*0.004,(rr0+(n1-0.5)*520.0)/52.0)).b;
  foam=max(foam,smoothstep(0.48,0.72,st)*smoothstep(0.38,0.64,n2*0.5+n3*0.6)*sat(sc.x*2.2-0.6)*0.85*(1.0-sat(dist/7000.0)));
  // 嵐：風に吹き流された泡の長い筋（風下へ伸びる）と、波の背の泡の膜
  {float sk=texture2D(tNoise2,rot(xz,0.64)/vec2(140.0,9.0)+wd*0.003).b*0.6+texture2D(tNoise2,rot(xz,0.64)/vec2(47.0,3.2)-wd*0.007).b*0.4;foam=max(foam,smoothstep(0.48,0.66,sk)*sat(wp*1.6-0.3)*0.85*(1.0-sat(dist/6000.0)));
   foam=max(foam,smoothstep(0.3,0.62,cn*0.6+n1*0.5)*smoothstep(0.4,0.66,n3)*sat(wp*1.5-0.4)*0.7);}
  foam*=mix(1.0,0.4,sat(dist/7000.0))*(1.0-hbm);
  col=mix(col,vec3(0.78,0.82,0.84)*(E+0.02)*(1.0+0.5*wp),foam*(0.82+0.12*wp));
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

// ───────────────────────── 経年の汚れ ─────────────────────────
// 単色の大きな面をなくすため、実際の位置で決まる汚れを足す。壁は外板の継ぎ目と雨だれ、上向きの面は染みと骨材の粒、
// 銅は緑青のむら。自前の onBeforeCompile を持つ材質（地形・葉・岩・機体など）とガラス、発光は対象外
function weatherMat(m){if(m.userData.wx||m.hasOwnProperty('onBeforeCompile')||!m.isMeshStandardMaterial)return;if(m.metalness>.9&&m.roughness<.15)return;m.userData.wx=1;
  const pat=(m.color&&m.color.r>m.color.g*1.6&&m.metalness>.6)?1:0;   // 銅らしい色の金属
  const rib=(!m.map&&m.metalness>.35&&m.metalness<.9)?1:0;            // 金属の外壁は波板の縦リブ
  m.extensions={derivatives:true};
  m.onBeforeCompile=sh=>{sh.uniforms.tWN=U.tNoise2;sh.uniforms.tWS=U.tShore;sh.uniforms.uExD=U.uExD;sh.uniforms.uScA=U.uScA;sh.uniforms.uScB=U.uScB;sh.uniforms.uScN=U.uScN;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWxP;varying vec3 vWxN;').replace('#include <project_vertex>',`#include <project_vertex>
{vec4 wq=vec4(transformed,1.0);vec3 nq=objectNormal;
#ifdef USE_INSTANCING
wq=instanceMatrix*wq;nq=mat3(instanceMatrix)*nq;
#endif
vWxP=(modelMatrix*wq).xyz;vWxN=normalize(mat3(modelMatrix)*nq);}`);
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWxP;varying vec3 vWxN;uniform sampler2D tWN,tWS;uniform vec4 uScA[24],uScB[24];uniform int uScN;uniform float uExD;\n// 探検（近景）だけの細かい汚れ：面の向きで投影面を選ぶ座標\nvec2 exTp(vec3 P,vec3 n){return abs(n.y)>0.7?P.xz:(abs(n.x)>abs(n.z)?P.zy:P.xy);}\nfloat exCrk(vec3 P){return smoothstep(0.012,0.0,abs(texture2D(tWN,P.xz/9.0).b-0.5))*smoothstep(0.45,0.6,texture2D(tWN,P.xz/23.0+0.2).b)+0.7*smoothstep(0.008,0.0,abs(texture2D(tWN,P.xz/3.1+0.5).b-0.5))*smoothstep(0.55,0.7,texture2D(tWN,P.xz/13.0+0.7).b);}').replace('#include <color_fragment>',`#include <color_fragment>
{vec3 n=normalize(vWxN);float vt=1.0-abs(n.y),up=smoothstep(0.6,0.95,n.y);
 float bl=texture2D(tWN,vWxP.xz/23.0+vWxP.y/31.0).b,bl2=texture2D(tWN,vWxP.xz/5.3-vWxP.y/7.0).b;
 float st=texture2D(tWN,vec2((vWxP.x+vWxP.z)*0.085,vWxP.y*0.011)).b;
 vec2 pc=vec2(abs(n.x)>abs(n.z)?vWxP.z:vWxP.x,vWxP.y);vec2 fq=fract(pc/vec2(3.0,2.4));float seam=max(smoothstep(0.018,0.0,min(fq.x,1.0-fq.x)),smoothstep(0.025,0.0,min(fq.y,1.0-fq.y)))*vt;
 float gr=texture2D(tWN,vWxP.xz/1.3).b*0.6+texture2D(tWN,vWxP.xz/0.37).b*0.4;
 float k=(0.78+0.4*bl)*(0.9+0.2*bl2)*(1.0-0.34*smoothstep(0.48,0.82,st)*vt)*(1.0-0.28*seam)*mix(1.0,0.82+0.34*gr,up);
 {vec2 su=(vWxP.xz-vec2(0.0,21000.0)+vec2(3200.0,3400.0))/vec2(6400.0,6800.0);float gh=texture2D(tWS,clamp(su,0.0,1.0)).r*72.0-64.0;k*=1.0-0.3*vt*(1.0-smoothstep(0.0,1.8+bl*1.5,vWxP.y-gh));}   // 地面際の泥はね
 k*=mix(1.0,0.9+0.16*fract(sin(dot(floor(pc/vec2(3.0,2.4)),vec2(12.9898,78.233)))*43758.5453),vt);   // 外板 1 枚ごとの色の違い
 k*=1.0-0.38*up*smoothstep(0.66,0.84,texture2D(tWN,vWxP.xz/11.0+3.7).b);                                       // 上向きの面の油の染み
 ${rib?'k*=1.0-0.16*vt*pow(abs(sin((abs(n.x)>abs(n.z)?vWxP.z:vWxP.x)*10.5)),3.0);':''}
 diffuseColor.rgb*=k;
 // 壊れた建物の焼け焦げ（すすの濃さにむら、上ほど濃い）
 for(int i=0;i<24;i++){if(i>=uScN)break;vec3 a=uScA[i].xyz-1.5,b=uScB[i].xyz+1.5;if(all(greaterThan(vWxP,a))&&all(lessThan(vWxP,b))){float sn=texture2D(tWN,vWxP.xz/7.0+vWxP.y/5.0).b;diffuseColor.rgb*=mix(1.0,0.16+0.3*sn,uScA[i].w*smoothstep(0.25,0.75,sn*0.7+0.45));}}
 ${pat?'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.16,0.34,0.28)*(0.7+0.5*bl2),smoothstep(0.55,0.8,bl*0.6+bl2*0.6)*0.55);':''}
 // 探検の近景：細かな色むら、舗装の骨材の粒・ひび・補修跡・タイヤ跡、金属の塗装はがれと錆の流れ
 if(uExD>0.5){float fd=1.0-smoothstep(40.0,160.0,length(vViewPosition));vec2 tp=exTp(vWxP,n);
  float f1=texture2D(tWN,tp/0.21).b,f2=texture2D(tWN,tp/0.067+0.3).b,f3=texture2D(tWN,tp/0.73+0.6).b,f4=texture2D(tWN,tp/2.3+0.1).b;
  vec3 c=diffuseColor.rgb;c*=1.0+((f1-0.5)*0.26+(f2-0.5)*0.18+(f3-0.5)*0.2)*fd;
  float ag=smoothstep(0.78,0.86,texture2D(tWN,vWxP.xz/0.045).b),ag2=smoothstep(0.8,0.9,texture2D(tWN,vWxP.xz/0.031+0.5).b);
  c=mix(c,c*1.7+0.025,up*ag*fd*0.4);c*=1.0-up*ag2*fd*0.3;
  c*=1.0-up*fd*0.6*min(1.0,exCrk(vWxP));
  {vec2 pq=floor(vWxP.xz/vec2(4.3,2.9));float pr=fract(sin(dot(pq,vec2(41.3,17.9)))*4375.85);vec2 pf=fract(vWxP.xz/vec2(4.3,2.9));float pin=step(0.86,pr)*step(0.08,pf.x)*step(pf.x,0.92)*step(0.1,pf.y)*step(pf.y,0.9);c*=mix(1.0,0.72+0.1*f3,up*pin*fd);}   // 補修の継ぎ当て
  {float tr=abs(fract((vWxP.x*0.6+vWxP.z*0.8)/3.7+texture2D(tWN,vWxP.xz/40.0).b*0.8)-0.5);c*=1.0-up*fd*0.16*smoothstep(0.07,0.02,abs(tr-0.22))*smoothstep(0.4,0.7,texture2D(tWN,vWxP.xz/31.0+0.4).b);}   // タイヤ跡
  float mt=step(0.25,metalness);
  float chip=smoothstep(0.83,0.86,texture2D(tWN,tp/0.31+0.2).b*0.5+f4*0.6)*mt*step(0.3,roughness);c=mix(c,vec3(0.21,0.11,0.06)*(0.55+0.7*f1),chip*fd*0.7);
  float rs=smoothstep(0.55,0.85,texture2D(tWN,vec2(dot(vWxP.xz,vec2(0.71,0.71))*1.3,vWxP.y*0.04)).b)*vt*mt;c=mix(c,c*vec3(0.8,0.62,0.48),rs*fd*0.35*step(0.3,roughness));
  c*=1.0-vt*fd*0.18*smoothstep(0.6,0.9,texture2D(tWN,vec2(dot(vWxP.xz,vec2(0.71,0.71))*2.1,vWxP.y*0.09+0.3)).b);   // 縦の雨筋
  {float y=vWxP.y,tide=smoothstep(-2.2,-1.4,y)*(1.0-smoothstep(1.0,1.6,y))*vt;   // 水際（潮の満ち引きの帯）：濡れて暗く、フジツボの白い粒、下は海藻の緑、水中は藻で暗い緑
   c*=mix(1.0,0.55,(1.0-smoothstep(0.4,1.5,y))*vt);float bd=smoothstep(0.74,0.8,texture2D(tWN,tp/0.05+0.2).b)*smoothstep(0.4,0.6,texture2D(tWN,tp/0.9).b);c=mix(c,vec3(0.62,0.6,0.55)*(0.8+0.3*f1),bd*tide*0.85);
   c=mix(c,vec3(0.07,0.12,0.05)*(0.7+0.6*f3),smoothstep(-0.3,-1.2,y)*vt*smoothstep(0.35,0.6,f4)*0.75);c=mix(c,c*vec3(0.45,0.6,0.5),smoothstep(-1.0,-3.0,y)*vt);}
  diffuseColor.rgb=c;}}`).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor*(0.85+0.3*texture2D(tWN,vWxP.xz/9.0+vWxP.y/13.0).b),0.04,1.0);').replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
if(uExD>0.5){vec3 nw=normalize(vWxN);vec2 tp=exTp(vWxP,nw);float fd=1.0-smoothstep(25.0,110.0,length(vViewPosition)),up=smoothstep(0.6,0.95,nw.y);
 float h=(texture2D(tWN,tp/0.21).b*0.6+texture2D(tWN,tp/0.067+0.3).b*0.4)*0.006+up*(smoothstep(0.82,0.9,texture2D(tWN,vWxP.xz/0.045).b)*0.004-min(1.0,exCrk(vWxP))*0.012);h*=fd;
 vec3 eSx=dFdx(-vViewPosition),eSy=dFdy(-vViewPosition),eR1=cross(eSy,normal),eR2=cross(normal,eSx);float eDt=dot(eSx,eR1);vec2 eDh=vec2(dFdx(h),dFdy(h));
 normal=normalize(abs(eDt)*normal-sign(eDt)*(eDh.x*eR1+eDh.y*eR2));}`);};
  m.needsUpdate=true;}
function weatherize(root){root.traverse(o=>{if(o.userData.noWeather)return;if(!o.isMesh)return;for(let q=o;q;q=q.parent)if(q.userData.noWeather)return;(Array.isArray(o.material)?o.material:[o.material]).forEach(weatherMat);});}

// ───────────────────────── 木 ─────────────────────────
// 葉の束の絵柄：ふちが不規則な塊の中に、色の違う小さな葉を何百枚も重ねる（外は透明）
let LEAFTEX;function leafTex(){if(LEAFTEX)return LEAFTEX;const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),r=mulberry(1234);
  const pal=['#18290f','#1f3414','#284019','#314c1f','#3b5826','#142410','#46622d'];
  for(let i=0;i<900;i++){const a=r()*6.283,rad=Math.pow(r(),.6)*112*(.75+.25*Math.sin(a*5+1)+.1*Math.sin(a*13)),X=128+Math.cos(a)*rad,Y=128+Math.sin(a)*rad*.92;
    const lit=1-rad/120;x.fillStyle=pal[Math.min(pal.length-1,Math.floor(r()*4+lit*3))];x.save();x.translate(X,Y);x.rotate(r()*6.283);x.beginPath();x.ellipse(0,0,7+r()*5,3+r()*2.2,0,0,6.283);x.fill();
    x.fillStyle='rgba(255,255,230,'+(.05+lit*.08)+')';x.beginPath();x.ellipse(-1,-1,4,1.4,0,0,6.283);x.fill();x.restore();}
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return LEAFTEX=t;}
// 葉群：単位球の中に葉の束の板を散らす。7 割は外向き、3 割は向きをばらす。法線は球の外向き（陰影がまとまって見える）。aIn は中心からの距離
function crownGeo(nq,seed){const r=mulberry(seed),P=[],N=[],U=[],A=[],I=[];let k=0;
  while(k<nq){const v=new V3(r()*2-1,r()*2-1,r()*2-1);if(v.length()>1)continue;const rad=.35+.65*Math.cbrt(r());v.normalize();const c=v.clone().multiplyScalar(rad);c.y*=.85;
    let n=v.clone();if(r()<.3)n.set(r()*2-1,r()*2-1,r()*2-1).normalize();const t1=new V3().crossVectors(n,Math.abs(n.y)<.9?new V3(0,1,0):new V3(1,0,0)).normalize(),t2=new V3().crossVectors(n,t1);const a=r()*6.283,ca=Math.cos(a),sa=Math.sin(a),e1=t1.clone().multiplyScalar(ca).addScaledVector(t2,sa),e2=t1.clone().multiplyScalar(-sa).addScaledVector(t2,ca);
    const sz=.55+r()*.35,b=P.length/3;for(const[u,w]of[[-1,-1],[1,-1],[1,1],[-1,1]]){const p=c.clone().addScaledVector(e1,u*sz).addScaledVector(e2,w*sz);P.push(p.x,p.y,p.z);const nn=p.clone().normalize();N.push(nn.x,nn.y,nn.z);U.push((u+1)/2,(w+1)/2);A.push(Math.min(1,p.length()));}
    I.push(b,b+1,b+2,b,b+2,b+3);k++;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setAttribute('aIn',new THREE.Float32BufferAttribute(A,1));g.setIndex(I);return g;}
// 葉群の材質：透過は切り抜き。内側と下側を暗く、上側をわずかに明るく
function leafMat(){const m=std({color:0xffffff,map:leafTex(),alphaTest:.38,side:THREE.DoubleSide,roughness:.9,metalness:0});
  m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aIn;varying float vIn;varying float vTy;').replace('#include <begin_vertex>','#include <begin_vertex>\nvIn=aIn;vTy=position.y;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vIn;varying float vTy;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=(0.32+0.75*smoothstep(0.25,1.0,vIn))*(0.55+0.55*smoothstep(-0.9,0.8,vTy));');};return m;}

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
function loft(secs,noStart){
  const n=secs[0].length,pos=[],idx=[];
  secs.forEach(s=>s.forEach(p=>pos.push(p.x,p.y,p.z)));
  for(let i=0;i<secs.length-1;i++)for(let j=0;j<n;j++){const a=i*n+j,b=i*n+(j+1)%n,c=a+n,d=b+n;idx.push(a,c,b,b,c,d);}
  const last=(secs.length-1)*n;for(let j=1;j<n-1;j++){if(!noStart)idx.push(0,j,j+1);idx.push(last,last+j+1,last+j);}   // noStart：中心線から始まる翼は根元の蓋を作らない（左右の蓋が重なる）
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
// 操縦士と射出座席。p の中に座席の中心 (x, z) で置く。前が -z、上が +y（単位 m）。返す head は首振り、stick は操縦桿の動きに使う
// 体は丸い形（楕円体と、関節を球でつないだ先細りの円柱）で作る。飛行服・耐 G スーツ・救命胴衣・サバイバルベスト・ハーネス・手袋・ブーツ・
// ヘルメット（バイザーの覆い・色付きバイザー・酸素マスクとホース）
function crewSeat(p,x,z,suit){
  const S=(c,r,m)=>std({color:lin(c),roughness:r,metalness:m});
  const dk=S(0x15181b,.7,.3),pad=S(0x2f352e,.95,0),st=S(suit,.9,0),gsuit=S(0x545740,.92,0),vest=S(0x4c4a38,.9,0),lpu=S(0xb8952a,.75,0),web=S(0x2a2d30,.85,0),
    glove=S(0x3a3c34,.9,0),boot=S(0x141517,.6,.1),hm=S(0xc9ced2,.3,.2),vz=S(0x0a0f16,.05,.95),msk=S(0x3a3f44,.6,.1),mt=S(0x9aa0a6,.35,.9),yl=S(0xd9a21b,.6,.1),red=S(0xb3261c,.6,.1);
  const V=(a,b,c)=>new V3(a,b,c),grp=new THREE.Group();grp.position.set(x,0,z);grp.userData.crew=1;p.add(grp);   /* 操縦士と座席：右手で操縦桿・左手でスロットル（左右非対称は正しい） */
  const add=(geo,m,px,py,pz,o)=>{const q=new THREE.Mesh(geo,m);q.position.set(px,py,pz);if(o&&o.rx)q.rotation.x=o.rx;if(o&&o.ry)q.rotation.y=o.ry;if(o&&o.rz)q.rotation.z=o.rz;if(o&&o.s)q.scale.set(o.s[0],o.s[1],o.s[2]);grp.add(q);return q;};
  const ell=(c,sx,sy,sz,m,rx)=>add(new THREE.SphereGeometry(1,18,12),m,c.x,c.y,c.z,{s:[sx,sy,sz],rx});
  // 先細りの円柱（a→b）と、a 側の関節の球
  const seg=(a,b,r0,r1,m,joint)=>{const d=new V3().subVectors(b,a),o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,d.length(),12),m);o.position.copy(a).addScaledVector(d,.5);o.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());grp.add(o);
    if(joint!==false)add(new THREE.SphereGeometry(r0,12,10),m,a.x,a.y,a.z);return o;};
  // ── 射出座席：座面の箱（左右の側板）、クッション、背もたれ、頭部の箱（落下傘の収納）、案内レール、射出ハンドル
  add(new THREE.BoxGeometry(.5,.12,.52),dk,0,-.02,.33);add(new THREE.BoxGeometry(.4,.05,.42),pad,0,.072,.31);
  for(const s of[1,-1])add(new THREE.BoxGeometry(.04,.2,.5),dk,s*.25,.08,.33);
  add(new THREE.BoxGeometry(.46,.62,.1),dk,0,.25,.66,{rx:.2});add(new THREE.BoxGeometry(.36,.46,.05),pad,0,.26,.6,{rx:.2});
  add(new THREE.BoxGeometry(.34,.3,.2),dk,0,.62,.76,{rx:.2});add(new THREE.BoxGeometry(.3,.02,.14),red,0,.775,.79,{rx:.2});add(new THREE.BoxGeometry(.24,.16,.035),pad,0,.6,.655,{rx:.2});
  for(const s of[1,-1]){add(new THREE.BoxGeometry(.04,.95,.06),mt,s*.22,.32,.74,{rx:.2});add(new THREE.BoxGeometry(.06,.24,.16),dk,s*.25,.18,.5,{rx:.2});}
  {const eh=add(new THREE.TorusGeometry(.05,.013,6,14),yl,0,.1,.055,{rx:Math.PI/2-.35});eh.scale.set(1.2,1,1);}   // 射出ハンドル：座面の前縁から少し起こす
  // ── 胴：骨盤・腹・胸（飛行服）。その上にサバイバルベスト（ポケット）と、首まわりの救命胴衣
  ell(V(0,.1,.42),.18,.1,.16,st);ell(V(0,.21,.45),.17,.12,.13,st,.12);ell(V(0,.35,.49),.21,.16,.13,st,.12);
  ell(V(0,.3,.46),.22,.18,.125,vest,.12);
  for(const s of[1,-1]){add(new THREE.BoxGeometry(.08,.07,.03),vest,s*.08,.29,.342,{rx:.12});add(new THREE.BoxGeometry(.06,.05,.03),vest,s*.13,.2,.36,{rx:.12});
    seg(V(s*.07,.45,.43),V(s*.14,.27,.37),.024,.022,lpu);}   // 救命胴衣（たたんで首から胸へ）
  // ハーネス：肩から腰へ 2 本、胸の横帯、留め具
  for(const s of[1,-1]){const c=new THREE.CatmullRomCurve3([V(s*.1,.48,.5),V(s*.115,.38,.335),V(s*.095,.2,.35),V(s*.085,.08,.31)]);grp.add(new THREE.Mesh(new THREE.TubeGeometry(c,16,.013,6),web));}
  add(new THREE.BoxGeometry(.26,.028,.012),web,0,.31,.324,{rx:.12});add(new THREE.BoxGeometry(.05,.045,.02),mt,0,.31,.314,{rx:.12});
  // 首と肩
  seg(V(0,.47,.48),V(0,.55,.46),.055,.05,st);
  const sh=[V(.215,.46,.5),V(-.215,.46,.5)];for(const q of sh)add(new THREE.SphereGeometry(.085,14,10),st,q.x,q.y,q.z);
  // 腕：右手は操縦桿、左手はスロットル（関節は球）。手袋は甲・指・親指
  const grip=[V(.03,.3,-.04),V(-.42,.29,-.1)],elb=[V(.27,.24,.27),V(-.36,.26,.24)];
  for(let k=0;k<2;k++){const s=k?-1:1,a=sh[k],e=elb[k],h=grip[k];seg(a,e,.066,.056,st);seg(e,h.clone().lerp(e,.12),.055,.044,st);
    const hd=new THREE.Group();hd.position.copy(h);const dd=h.clone().sub(e).normalize();hd.quaternion.setFromUnitVectors(V(0,0,-1),dd);grp.add(hd);
    const pm=new THREE.Mesh(new THREE.SphereGeometry(1,12,10),glove);pm.scale.set(.045,.028,.06);hd.add(pm);
    const fg=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),glove);fg.scale.set(.042,.026,.035);fg.position.set(0,-.02,-.05);fg.rotation.x=.6;hd.add(fg);
    const th=new THREE.Mesh(new THREE.CylinderGeometry(.012,.014,.05,8),glove);th.position.set(s*.035,.012,-.03);th.rotation.set(-1.2,0,s*.6);hd.add(th);
    const cf=new THREE.Mesh(new THREE.CylinderGeometry(.046,.044,.04,12),glove);cf.position.set(0,0,.05);cf.rotation.x=Math.PI/2;hd.add(cf);}   // 手袋の袖口
  // 脚：太もも（耐 G スーツ）、膝、すね、ブーツ。足は踏み板の上
  for(const s of[1,-1]){const hip=V(s*.1,.1,.38),kn=V(s*.15,.24,-.14),an=V(s*.16,.09,-.56);
    seg(hip,kn,.095,.078,gsuit);seg(kn,an,.07,.055,gsuit);add(new THREE.SphereGeometry(.078,12,10),gsuit,kn.x,kn.y,kn.z);
    add(new THREE.BoxGeometry(.05,.13,.02),web,s*.155,.2,-.06,{rx:-.4});   // 耐 G スーツの袋の縫い目
    ell(V(s*.16,.07,-.62),.05,.045,.11,boot,-.2);add(new THREE.BoxGeometry(.1,.025,.22),boot,s*.16,.035,-.64,{rx:-.2});}
  // 膝板（右ももの上）
  {const kb=add(new THREE.BoxGeometry(.1,.008,.14),S(0xe8e6dc,.9,0),.15,.3,.06,{rx:-.4});kb.position.y=.315;}
  // 方向舵ペダル
  for(const sd of[1,-1])add(new THREE.BoxGeometry(.11,.14,.03),mt,sd*.16,.12,-.72,{rx:.5});add(new THREE.BoxGeometry(.5,.04,.04),dk,0,.06,-.74);
  // ── 頭（首振りする）：ヘルメット、バイザーの覆い、色付きバイザー、耳当て、酸素マスク、ホース
  const head=new THREE.Group();head.position.set(x,.63,z+.45);head.userData.dyn=1;head.userData.crew=1;p.add(head);
  const H=(geo,m,px,py,pz,o)=>{const q=new THREE.Mesh(geo,m);q.position.set(px,py,pz);if(o&&o.s)q.scale.set(o.s[0],o.s[1],o.s[2]);if(o&&o.rx!==undefined)q.rotation.x=o.rx;if(o&&o.rz!==undefined)q.rotation.z=o.rz;head.add(q);return q;};
  H(new THREE.SphereGeometry(1,22,16),hm,0,.01,.01,{s:[.135,.145,.155]});
  H(new THREE.SphereGeometry(1,18,10,Math.PI*.15,Math.PI*.7,0,Math.PI*.42),hm,0,.02,-.005,{s:[.145,.15,.16],rx:-.25});   // バイザーの覆い（額の上のふくらみ）
  H(new THREE.SphereGeometry(1,20,12,Math.PI*1.12,Math.PI*.76,Math.PI*.3,Math.PI*.32),vz,0,.0,.0,{s:[.142,.15,.158]});   // 色付きバイザー（目の前）
  for(const s of[1,-1]){const e=H(new THREE.CylinderGeometry(.05,.05,.03,14),hm,s*.135,-.015,.02,{rz:Math.PI/2});}
  H(new THREE.SphereGeometry(.012,8,6),mt,0,.085,-.14);   // バイザーの留め具
  {const mk=H(latheZ([[-.07,.012],[-.05,.04],[-.01,.058],[.03,.06]],14),msk,0,-.075,-.115);mk.rotation.x=-.25;mk.scale.set(1,.85,1);   // 酸素マスク
    for(const s of[1,-1]){const sp=H(new THREE.BoxGeometry(.012,.012,.11),web,s*.07,-.05,-.07);sp.rotation.y=-s*.5;}
    const c=new THREE.CatmullRomCurve3([V(0,-.12,-.17),V(.02,-.2,-.16),V(.06,-.3,-.1),V(.09,-.36,-.05)]);head.add(new THREE.Mesh(new THREE.TubeGeometry(c,14,.018,8),msk));}
  // 操縦桿：付け根を軸に動く。握り（傾いた握り・頭の上のボタン・人差し指の引き金）
  const stick=new THREE.Group();stick.position.set(x+.03,.09,z-.04);stick.userData.dyn=1;stick.userData.crew=1;p.add(stick);
  {const sm=new THREE.Mesh(new THREE.CylinderGeometry(.018,.026,.2,10),dk);sm.position.y=.1;stick.add(sm);const bt=new THREE.Mesh(new THREE.CylinderGeometry(.04,.045,.035,12),pad);bt.position.y=.012;stick.add(bt);   // 付け根の蛇腹
    const gr=new THREE.Mesh(latheZ([[-.06,.02],[-.03,.026],[.03,.024],[.055,.017]],12),dk);gr.rotation.x=-Math.PI/2+.25;gr.position.y=.23;stick.add(gr);
    const hb=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.012,8),mt);hb.position.set(0,.288,.004);stick.add(hb);const tg=new THREE.Mesh(new THREE.BoxGeometry(.012,.02,.01),red);tg.position.set(0,.23,-.026);stick.add(tg);}
  return{head,stick};
}
// 計器盤（覆いと画面）を p に置く。w は幅
function instrPanel(p,w,y,z){
  const dk=std({color:lin(0x23272c),roughness:.75,metalness:.2}),bz=std({color:lin(0x1c2126),roughness:.6,metalness:.4}),key=std({color:lin(0x2a3036),roughness:.7,metalness:.2});
  const hood=new THREE.Mesh(new THREE.BoxGeometry(w,.4,.5),dk);hood.position.set(0,y,z);p.add(hood);
  const lip=new THREE.Mesh(new THREE.BoxGeometry(w*1.04,.035,.66),dk);lip.position.set(0,y+.215,z+.06);p.add(lip);
  // 表示面（3 つの画面の絵）と、その上に立体の縁・押しボタンの列。面と同じ傾きの組にまとめる
  const fp=new THREE.Group();fp.position.set(0,y,z+.257);fp.rotation.x=-.08;p.add(fp);
  const W=w*.96,face=new THREE.Mesh(new THREE.PlaneGeometry(W,.36),new THREE.MeshBasicMaterial({map:mfdTex(),color:new THREE.Color(1.5,1.5,1.5)}));face.castShadow=false;fp.add(face);
  const sw=152/512*W,shh=124/192*.36,cy=(.5-74/192)*.36,fr=.014,dp=.014;
  for(const u of[88,256,424]){const cx=(u/512-.5)*W;
    for(const[bx,by,bw,bh]of[[cx,cy+shh/2+fr/2,sw+fr*2,fr],[cx,cy-shh/2-fr/2,sw+fr*2,fr],[cx-sw/2-fr/2,cy,fr,shh],[cx+sw/2+fr/2,cy,fr,shh]]){const b=new THREE.Mesh(new THREE.BoxGeometry(bw,bh,dp),bz);b.position.set(bx,by,dp/2);fp.add(b);}
    for(const sy of[1,-1])for(let k=0;k<5;k++){const b=new THREE.Mesh(new THREE.BoxGeometry(.016,.011,.008),key);b.position.set(cx-sw*.38+k*sw*.19,cy+sy*(shh/2+fr+.011),.004);fp.add(b);}}
  // 画面の下の予備計器の窓と、スイッチ列の段
  {const b=new THREE.Mesh(new THREE.BoxGeometry(W*.98,.012,.02),bz);b.position.set(0,(.5-146/192)*.36,.01);fp.add(b);}
  const cmp=new THREE.Mesh(new THREE.BoxGeometry(.1,.07,.08),dk);cmp.position.set(w*.36,y+.26,z+.1);p.add(cmp);
  // HUD の下の操作パネル（キーの並び）
  {const uf=new THREE.Mesh(new THREE.BoxGeometry(.24,.09,.07),dk);uf.position.set(0,y+.175,z+.27);uf.rotation.x=-.5;p.add(uf);
    for(let r=0;r<2;r++)for(let k=0;k<5;k++){const b=new THREE.Mesh(new THREE.BoxGeometry(.028,.018,.012),key);b.position.set(-.08+k*.04,.015-r*.03,.04);uf.add(b);}}
}
// 操作盤の上面に貼る板
function consoleTop(p,w,l,x,y,z){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,l),new THREE.MeshBasicMaterial({map:consoleTex(),color:new THREE.Color(1.2,1.2,1.2)}));m.rotation.x=-Math.PI/2;m.position.set(x,y+.006,z);   /* 箱の上面から少し離す（同じ高さだとちらつく） */m.castShadow=false;p.add(m);return m;}
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
  {name:'結合翼',eng:[0,.32,0,1],st:[[1.1,-.3,-4.6,5.2,.11],[6,-.05,-.6,3.6,.1],[11.6,.25,3.5,2.2,.09]],winglet:false,tail:'join',gear:[2.5,-.25,-1.0]},   // 主脚は主翼の下（主翼が前寄りで、既定の位置だと何もない所から下がっていた）
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
      const fl=new THREE.Mesh(new THREE.SphereGeometry(1,24,8,0,Math.PI*2,Math.PI/2,Math.PI/2),belly);fl.scale.set(1.15,.5,6.0);fl.position.set(s*2.75,-2.0,-1.4);g.add(fl);   /* 下半分（腹の色） */
      const ft=new THREE.Mesh(new THREE.SphereGeometry(1,24,8,0,Math.PI*2,0,Math.PI/2),body);ft.scale.set(1.15,.5,6.0);ft.position.set(s*2.75,-2.0,-1.4);g.add(ft);   /* 上半分（機体色）。下半分と赤道で突き合わせる（重ねると面がちらつく） */
      for(const z of[-4.4,.4])g.add(new THREE.Mesh(strutFoil(new V3(s*1.2,-1.5,z),new V3(s*2.7,-1.75,z),2.4,.2),body));
    }
  }else{
    const fus=new THREE.Mesh(latheZ([[-12.6,.02],[-12.1,.3],[-10.6,.82],[-8.2,1.32],[-5,1.74],[-1,1.95],[4,1.86],[8,1.42],[11,.82],[12.2,.42],[12.4,.02]]),body);
    fus.scale.set(FW,.9,1);g.add(fus);
    const keel=new THREE.Mesh(latheZ([[-8.5,.02],[-6,1.0],[-1,1.5],[5,1.35],[9,.6],[10.5,.02]],20),belly);keel.scale.set(.86*FW,.64,1);keel.position.y=-.88;g.add(keel);
    const nose=new THREE.Mesh(latheZ([[-13.9,.02],[-13.5,.09],[-12.3,.26],[-12.1,.31]],12),dark);nose.scale.set(FW,.9,1);g.add(nose);
    // 風防：機首側を細く絞り、胴体上面の傾きに合わせて前下がりに置く（胴体の幅からはみ出さないように）
    const cg=new THREE.Group();cg.position.set(0,1.12,-6.2);cg.rotation.x=-.08;g.add(cg);ud.canopyG=cg;
    const cgeo=new THREE.SphereGeometry(1.2,28,18);{const pa=cgeo.attributes.position;for(let i=0;i<pa.count;i++){const z=pa.getZ(i);if(z<0)pa.setX(i,pa.getX(i)*(1-.5*(z/1.2)**2));}cgeo.computeVertexNormals();}
    const can=new THREE.Mesh(cgeo,glass);can.scale.set(.72*(FW>1?1.25:1),.9,2.9);cg.add(can);ud.canopy=can;
  }
  // 主翼・尾翼（形の選択で変わる）
  const T=ST[2],WK=SH.winglet==='down'?-1:1,tipP=SH.winglet?new V3(T[0]+1.1,T[1]+2.18*WK,T[2]+2.2):new V3(T[0]+.15,T[1]+.12,T[2]+T[3]*.55);ud.tipPos=tipP;
  for(const s of[1,-1]){
    g.add(new THREE.Mesh(loft(ST.map(a=>foil(new V3(s*a[0],a[1],a[2]),a[3],a[4],UP)),ST[0][0]===0),body));
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
      g.add(new THREE.Mesh(loft([foil(new V3(s*.14,5.85,9.2),3.3,.12,UP),foil(new V3(s*6,3.45,6.7),2.7,.115,UP),foil(new V3(s*T[0],T[1]+1.0,T[2]+.2),2.0,.11,UP)]),body));
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
    const intake=new THREE.Mesh(new THREE.CircleGeometry(.93,20),new THREE.MeshBasicMaterial({color:0x020304}));intake.position.set(s*2.55,1.25,2.9);intake.rotation.y=Math.PI;g.add(intake);
    const py=new THREE.Mesh(new THREE.BoxGeometry(.5,1.1,3.6),body);py.position.set(s*1.9,.8,6.2);py.rotation.z=-s*.6;py.userData.pylon=1;g.add(py);
    const noz=new THREE.Mesh(new THREE.CylinderGeometry(.7,.76,.9,20,1,true),dark);noz.rotation.x=Math.PI/2;noz.position.set(s*2.55,1.25,10.3);g.add(noz);
    const fire=new THREE.Mesh(new THREE.CircleGeometry(.74,18),new THREE.MeshBasicMaterial({color:new THREE.Color(5,2.4,.9)}));fire.position.set(s*2.55,1.25,10.35);g.add(fire);
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
  {const XA=new V3(1,0,0),pyl=new THREE.Mesh(loft([foil(new V3(0,PY+.36,-1.85),3.3,.11,XA),foil(new V3(0,PY+1.05,-1.95),3.5,.11,XA)]),belly);pyl.userData.podm=1;g.add(pyl);   // 翼断面のパイロン（下端は弾の中、上端は胴体の中）
    for(const z of[-1.15,.75])for(const s of[1,-1]){const a=new V3(s*.12,PY+.62,z-.3),b=new V3(s*.31,PY+.31,z-.3),d=b.clone().sub(a),br=new THREE.Mesh(new THREE.CylinderGeometry(.026,.026,d.length(),8),dark);br.position.copy(a).addScaledVector(d,.5);br.quaternion.setFromUnitVectors(new V3(0,1,0),d.normalize());br.userData.podm=1;g.add(br);
      const pad=new THREE.Mesh(new THREE.BoxGeometry(.1,.04,.14),dark);pad.position.set(s*.3,PY+.3,z-.3);pad.rotation.z=-s*Math.PI/4;pad.userData.podm=1;g.add(pad);}}   // 揺れ止め（弾を斜め上から押さえる）
  ud.podY=PY;
  for(const z of[-1.6,1.1]){const br=new THREE.Mesh(new THREE.TorusGeometry(.48,.04,6,16,Math.PI),dark);br.position.set(0,PY,z);br.userData.podm=1;g.add(br);}
  // 衝突防止灯
  const stb=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(1.6,1.6,1.8),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
  stb.position.set(0,-1.2,4);stb.scale.set(1.4,1.4,1);g.add(glowLOD(stb,70,.18));ud.strobe=stb;
  const bcn=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(2.4,.2,.12),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
  bcn.position.set(0,SH.orig?4.1:2.1,SH.orig?-1.9:3);bcn.scale.set(1.6,1.6,1);g.add(glowLOD(bcn,70,.18));ud.beacon=bcn;
  detailAircraft(g,accentHex,label||'SR-01');snapParts(g);
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
  const r=lit*(.5+3.6*T)+ud.ign*1.2,gc=lit*(.05+1.9*T*T)+ud.ign*.5,b=lit*(.9*T*T*T+ab*1.6)+ud.ign*.2;
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
// 海岸線を元のまま保つ場所（滑走路の両端・港・灯台）
function coastKeep(x,z){return Math.min(1,Math.max((1-smooth(250,520,Math.abs(x-30)))*smooth(900,1250,Math.abs(z-130)),(1-smooth(150,420,Math.hypot(x-1200,z-150)))*.9+(1-smooth(200,480,Math.abs(z-150)))*smooth(850,1050,x)*.9,1-smooth(120,330,Math.hypot(x-250,z+1330))));}
// 崖になる海岸の度合い（方角で決まる。沖でも同じ値なので海底の深さにも使う）
// 西（山側）・南西・北西・北東の 4 か所に崖。幅は方角のむらで少し揺らす
function cliffAt(x,z){const a=Math.atan2(z,x),w=.24+.06*(fbm2(Math.cos(a)*3+1,Math.sin(a)*3+4)-.5)*4;let c=0;
  for(const[ac,k]of[[Math.PI,1.3],[2.35,.8],[-2.15,1],[-.6,.8]]){let d=a-ac;while(d>Math.PI)d-=6.2832;while(d<-Math.PI)d+=6.2832;c=Math.max(c,1-smooth(w*k*.55,w*k,Math.abs(d)));}
  return c*(1-coastKeep(x,z));}
function coastD(x,z){
  // 海岸線：楕円に、角度ごとの岬と入り江（周期の違う波の重ね合わせ）と大きなむらを足す。滑走路の両端・港・灯台のまわりは元の線
  const a=Math.atan2(z,x),keep=coastKeep(x,z);
  const coast=(.075*Math.sin(3*a+1.3)+.05*Math.sin(5*a-.7)+.035*Math.sin(7*a+2.1)+.02*Math.sin(11*a+.4)+(fbm2(x*.00055+9,z*.00055+4)-.5)*.32+(fbm2(x*.0015+21,z*.0015+13)-.5)*.13)*(1-Math.min(1,keep));
  const d=Math.hypot(x/1500,z/1750)*(1+coast)+(fbm2(x*.0016+3,z*.0016+7)-.5)*.12;
  return d;}
function islandH(x,z){
  const d=coastD(x,z);
  let h=(1-smooth(.5,1,d))*30-9+(fbm2(x*.004,z*.004)-.5)*10;
  // 崖：海岸の手前で一段高く持ち上げ、海側は砂浜を作らずにすぐ深くする
  {const c=cliffAt(x,z);if(c>0){const top=1-smooth(.832,.846,d),H=18+16*fbm2(x*.003+7,z*.003+1);h+=c*top*H*(.6+.4*smooth(.6,.82,d));h=lerp(h,Math.min(h,-6-8*smooth(.85,.95,d)),c*smooth(.836,.849,d));}}
  const rg=1-Math.abs(fbm2(x*.0011+11,z*.0011+5)*2-1),m=smooth(-250,-800,x)*(1-smooth(.4,.9,d));
  h+=m*(50+250*rg*rg+(fbm2(x*.006+1,z*.006)-.5)*46);
  h+=(1-smooth(0,460,Math.hypot(x-560,z+1080)))*(1-smooth(.5,.95,d))*(60+(fbm2(x*.008,z*.008)-.5)*30);
  const w=(1-smooth(150,340,Math.abs(x-30)))*(1-smooth(1180,1420,Math.abs(z-130)));
  const ap=(1-smooth(380,520,Math.abs(x-250)))*(1-smooth(480,640,Math.abs(z-150)));
  // 港の敷地は岸壁の高さより少し下で平らにする
  const pm=smooth(1080,1108,x)*(1-smooth(1286,1296,x))*smooth(-200,-174,z)*(1-smooth(474,500,z));
  h=lerp(lerp(h,RWY_Y-.15,Math.max(w,ap)),4.2,pm);
  // 港の泊地は浚渫して深く（岸壁の前は 15m、外へ 12m）。港口の外の航路も 12m まで掘る。岸壁の面でほぼ垂直に落とす
  {const u=sat((x-1282)/358),zn=-246+96*u,zs=556-116*u;const bm=smooth(1293,1301,x)*(1-smooth(1640,1665,x))*smooth(zn-2,zn+16,z)*(1-smooth(zs-16,zs+2,z));
    const ch=smooth(1630,1660,x)*(1-smooth(1900,2150,x))*(1-smooth(55,85,Math.abs(z-145)));const dep=-12-3*(1-smooth(1340,1420,x))+(fbm2(x*.02,z*.02)-.5)*1.6;
    const k=Math.max(bm,ch);if(k>0)h=Math.min(h,lerp(h,dep,k));}
  return h;
}
const inPort=(x,z)=>x>1070&&x<1310&&z>-215&&z<515;
// 飛行場の構内道路（[x0,z0,x1,z1,幅]）：管制塔（200,360）の基部の前は東へ迂回する。草や木はこの上に生やさない
const AIR_ROADS=[[210,-240,210,318,9],[210,318,224,338,9],[224,338,224,384,9],[224,384,210,402,9],[210,400,252,400,9],[210,400,210,620,9],[210,620,535,640,9],[60,975,210,620,9],[210,-40,420,-40,8]];
function onAirRoad(x,z,m){for(const r of AIR_ROADS){const dx=r[2]-r[0],dz=r[3]-r[1],L2=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-r[0])*dx+(z-r[1])*dz)/L2));if(Math.hypot(r[0]+dx*t-x,r[1]+dz*t-z)<r[4]/2+(m||0))return true;}return false;}
const harbRev=(x,z)=>smooth(1150,1185,x)*(1-smooth(1500,1560,x))*Math.max(smooth(-290,-268,z)*(1-smooth(-168,-160,z)),smooth(462,470,z)*(1-smooth(580,600,z)));   // 港内の護岸の範囲
const ROAD_PTS=[[210,300],[470,300],[560,312],[640,326],[800,300],[960,240],[1060,200],[1112,190]];
// 道路の中心線：路面と同じなめらかな曲線を 4m ごとの点にして、その点列からの距離で判定する（折れ線のままだと曲がり角で数 m ずれる）
let ROAD_SMP=null;
function roadSmp(){if(ROAD_SMP)return ROAD_SMP;const P=ROAD_PTS,out=[],cr=(p0,p1,p2,p3,t)=>{const t2=t*t,t3=t2*t;return .5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3);};
  for(let i=0;i<P.length-1;i++){const p0=P[Math.max(0,i-1)],p1=P[i],p2=P[i+1],p3=P[Math.min(P.length-1,i+2)],L=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]),n=Math.ceil(L/4);for(let k=0;k<n;k++){const t=k/n;out.push([cr(p0[0],p1[0],p2[0],p3[0],t),cr(p0[1],p1[1],p2[1],p3[1],t)]);}}out.push(P[P.length-1]);return ROAD_SMP=out;}
function nearRoad(x,z,r){r=r||15;const S=roadSmp();if(x<190-r||x>1130+r||z<170-r||z>340+r)return false;for(let i=0;i<S.length-1;i++){const a=S[i],b=S[i+1],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));if(Math.hypot(a[0]+dx*t-x,a[1]+dz*t-z)<r)return true;}return false;}
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
const DETU={uDet:{value:new THREE.Vector4(1e9,1e9,-1e9,-1e9)}};   // 探検（AquaTopia）中、基地の地形のこの範囲は描かない（細かい地面に任せる）
function forestMask(x,z){return smooth(.46,.6,fbm2(x*.0023+9,z*.0023+4));}
function buildBase(){
  const B=baseGroup=new THREE.Group();B.position.copy(BASE);scene.add(B);
  // 地形
  const tg=new THREE.PlaneGeometry(3800,4200,250,276);tg.rotateX(-Math.PI/2);
  const p=tg.attributes.position,col=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,islandH(x,z));
    // r:舗装のマスク g:森のマスク
    col[i*3]=Math.max((1-smooth(105,135,Math.abs(x-262)))*(1-smooth(175,205,Math.abs(z+30))),(1-smooth(95,120,Math.abs(x-330)))*(1-smooth(60,85,Math.abs(z-400))),(1-smooth(14,22,Math.abs(x-150)))*(1-smooth(200,230,Math.abs(z-120))));
    col[i*3+1]=forestMask(x,z);col[i*3+2]=Math.max(cliffAt(x,z)*smooth(.76,.81,coastD(x,z)),harbRev(x,z)*(1-smooth(4,7,islandH(x,z))));}
  tg.setAttribute('color',new THREE.BufferAttribute(col,3));tg.computeVertexNormals();
  {const H=new Float32Array(p.count);for(let i=0;i<p.count;i++)H[i]=p.getY(i);B.userData.terr={h:H,c:col,nx:251,nz:277,w:3800,d:4200,dx:3800/250,dz:4200/276};}   // 探検で細かい地面を作るときに補間する
  const tm=std({vertexColors:true,roughness:.95,metalness:0});
  B.userData.terrMat=tm;
  tm.onBeforeCompile=sh=>{sh.uniforms.tN2=U.tNoise2;sh.uniforms.uDet=DETU.uDet;Object.assign(sh.uniforms,{uT:U.uTime,tN3:U.tNoise,uSunDir:U.uSunDir,uStorm:U.uStorm,tGr:GT.grass,tGrN:GT.grassN,tRk:GT.rock,tRkN:GT.rockN,tSd:GT.sand,tSdN:GT.sandN});
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;varying vec3 vNw;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*vec4(position,1.0)).xyz;vNw=normal;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nprecision highp sampler3D;\nvarying vec3 vWP;varying vec3 vNw;uniform vec4 uDet;uniform sampler2D tN2,tGr,tGrN,tRk,tRkN,tSd,tSdN;uniform sampler3D tN3;uniform vec3 uSunDir;uniform float uStorm,uT;').replace('#include <color_fragment>',`
float hgt=vWP.y,slope=1.0-normalize(vNw).y;
if(hgt<-1.2)discard;
if(vWP.x>uDet.x&&vWP.x<uDet.z&&vWP.z>uDet.y&&vWP.z<uDet.w)discard;
float n1=texture2D(tN2,vWP.xz/41.0).b,n2=texture2D(tN2,vWP.xz/263.0).b,n3=texture2D(tN2,vWP.xz/6.7).b,n4=texture2D(tN2,vWP.xz/900.0+0.3).b;
// 近景用（13m）と中景用（71m・回転）の 2 段で貼り、繰り返しを目立たなくする
vec2 uA=vWP.xz/13.0,uB=vec2(vWP.x*0.8+vWP.z*0.6,vWP.z*0.8-vWP.x*0.6)/71.0;
// 繰り返しを崩す：向きと縮尺の違う 2 枚を場所ごとのむらで混ぜ、近くは細かい凹凸、遠くは周期の違う 2 つの色むら
vec2 uA2=vec2(vWP.x*0.54-vWP.z*0.84,vWP.x*0.84+vWP.z*0.54)/11.3+0.37,uC=vec2(vWP.x*0.97+vWP.z*0.26,vWP.z*0.97-vWP.x*0.26)/3.1;
vec2 uA3=vec2(vWP.x*-0.35+vWP.z*0.94,vWP.x*-0.94-vWP.z*0.35)/17.9+0.71;
float w1=0.25+texture2D(tN2,vWP.xz/57.0).b,w2=0.25+texture2D(tN2,vWP.xz/57.0+0.43).b,w3=0.25+texture2D(tN2,vWP.xz/57.0+0.77).b;w1*=w1*w1;w2*=w2*w2;w3*=w3*w3;
vec4 gA=(texture2D(tGr,uA)*w1+texture2D(tGr,uA2)*w2+texture2D(tGr,uA3)*w3)/(w1+w2+w3);float gC=texture2D(tGr,uC).a;
// 中景の斑：周期の違う 3 枚（71・97・139m、向きもずらす）を混ぜて周期をなくす
float gBa=(texture2D(tGr,uB).a+texture2D(tGr,vec2(vWP.x*0.31+vWP.z*0.95,vWP.z*0.31-vWP.x*0.95)/97.0+0.29).a+texture2D(tGr,vec2(vWP.x*-0.88+vWP.z*0.47,vWP.x*0.47+vWP.z*0.88)/139.0+0.53).a)/3.0;
gBa=0.5+(gBa-0.5)*1.6;
// 遠くでは草の細かい模様（縞に見える）を平均の色へ
float gd=smoothstep(70.0,420.0,length(vViewPosition));gA.rgb=mix(gA.rgb,vec3(0.27,0.36,0.17),gd*0.75);
vec3 grass=gA.rgb*gA.rgb*(0.55+1.0*gBa)*(0.62+0.8*n2)*mix(1.0,0.82+0.36*gC,1.0-smoothstep(40.0,160.0,length(vViewPosition)));
float gq1=texture2D(tN2,vWP.xz/1700.0+0.61).b;float gq2=texture2D(tN2,vec2(vWP.x*0.8-vWP.z*0.6,vWP.x*0.6+vWP.z*0.8)/620.0+0.13).b;float gqm=gq1*0.6+gq2*0.4;
grass*=mix(vec3(0.66,0.9,0.62),vec3(1.22,1.08,0.82),smoothstep(0.25,0.75,gqm));                              // 青々とした草〜乾き気味
grass=mix(grass,grass*vec3(1.55,1.22,0.9)+vec3(0.02,0.015,0.0),smoothstep(0.58,0.76,n4*0.5+gq2*0.5)*0.5);     // 枯れ草の斑
grass=mix(grass,grass*vec3(0.62,0.78,0.6),smoothstep(0.62,0.8,gq1*0.4+n2*0.6)*0.45);                         // 湿った濃い草
vec3 an=abs(normalize(vNw));vec2 uR=(an.x>an.z?vWP.zy:vWP.xy)/19.0;uR=mix(vWP.xz/19.0,uR,smoothstep(0.25,0.5,slope));
vec4 rA=texture2D(tRk,uR),rB=texture2D(tRk,uR*0.23+0.37);
vec2 sU2=vec2(vWP.x*0.6-vWP.z*0.8,vWP.x*0.8+vWP.z*0.6)/13.0+0.4;float sw2=smoothstep(0.3,0.7,texture2D(tN2,vWP.xz/47.0).b);
vec4 sA=mix(texture2D(tSd,vWP.xz/9.0),texture2D(tSd,sU2),sw2);
vec3 forest=vec3(0.016,0.040,0.013)*(0.6+0.9*n3);
vec3 rock=rA.rgb*rA.rgb*vec3(0.80,0.70,0.58)*(0.42+1.0*rB.a)*(0.80+0.36*sin(hgt*0.33+n2*7.0))*(0.75+0.5*n3);
vec3 sand=sA.rgb*sA.rgb*(0.8+0.4*n1);
vec3 tc=mix(grass,forest,vColor.g*smoothstep(6.0,16.0,hgt)*0.85);
float mRock=clamp(smoothstep(0.34,0.42,slope+(n1-0.5)*0.05+(n3-0.5)*0.10+(gA.a-0.5)*0.10)+smoothstep(190.0,280.0,hgt)*0.5*smoothstep(0.35,0.6,n3+gA.a*0.5),0.0,1.0);
float mSand=(1.0-smoothstep(3.0,8.0,hgt+(n1-0.5)*3.5))*(1.0-smoothstep(0.3,0.55,slope));
// 崖の岩肌：3 方向から投影した岩の模様、厚さと色の不ぞろいな地層（うねりと傾き）、張り出しの影、縦の亀裂と浸食の溝、雨水の跡、張り出しの草
if(vColor.b>0.01){
  vec3 nw=normalize(vNw),wt=pow(abs(nw),vec3(4.0));wt/=wt.x+wt.y+wt.z;
  vec3 tA=texture2D(tRk,vWP.zy/7.0).rgb*wt.x+texture2D(tRk,vWP.xz/7.0).rgb*wt.y+texture2D(tRk,vWP.xy/7.0).rgb*wt.z;
  float tB=texture2D(tRk,vWP.zy/23.0+0.3).a*wt.x+texture2D(tRk,vWP.xz/23.0+0.3).a*wt.y+texture2D(tRk,vWP.xy/23.0+0.3).a*wt.z;
  vec2 lp=vWP.xz-vec2(0.0,21000.0);float ht=atan(lp.y,lp.x)*1650.0;                    // 崖に沿った横方向の座標（島の中心からの角度×おおよその半径。面の向きに頼ると三角形ごとに飛ぶ）
  float yw=vWP.y+(texture2D(tN2,vWP.xz/140.0).b-0.5)*9.0+(texture2D(tN2,vec2(ht/37.0,0.21)).b-0.5)*3.0+dot(vWP.xz,vec2(0.012,-0.008));
  float L=texture2D(tN2,vec2(yw/21.0,0.37)).b*0.72+texture2D(tN2,vec2(yw/6.5,0.71)).b*0.18+(texture2D(tN2,vec2(ht/48.0,yw/26.0)).b-0.5)*0.45;   // 地層は厚く、横に行くと途切れる
  vec3 cs=mix(vec3(0.20,0.19,0.17),vec3(0.42,0.38,0.33),smoothstep(0.3,0.7,L));
  cs=mix(cs,vec3(0.44,0.32,0.21),smoothstep(0.58,0.78,texture2D(tN2,vec2(yw/31.0,0.53)).b+(texture2D(tN2,vec2(ht/70.0,0.4)).b-0.5)*0.4)*0.55);   // 鉄分の黄土色の層
  float ledge=smoothstep(0.03,0.0,abs(fract(yw/9.0+texture2D(tN2,vec2(ht/60.0,0.9)).b*1.5)-0.5)-0.47)*smoothstep(0.35,0.6,texture2D(tN2,vec2(ht/30.0,yw/40.0)).b);cs*=1.0-0.45*ledge;   // 張り出しの下の影
  float cr=smoothstep(0.70,0.86,texture2D(tN2,vec2(ht/3.5+texture2D(tN2,vec2(yw/12.0,ht/50.0)).b*0.6,yw/45.0)).b);float gul=smoothstep(0.55,0.8,texture2D(tN2,vec2(ht/22.0,yw/300.0)).b);
  cs*=(1.0-0.5*cr)*(1.0-0.28*gul)*(0.9+0.2*texture2D(tN2,vec2(floor(ht/2.6)*0.13,floor(yw/3.5)*0.17)).b);   // 割れ目・溝・節理で割れたブロックごとの色
  cs*=1.0-0.25*smoothstep(0.6,0.85,texture2D(tN2,vec2(ht/2.7,yw/55.0)).b);                    // 雨水が流れた黒い筋
  vec3 cr2=cs*(0.35+1.6*tA*tA)*(0.65+0.7*tB);
  cr2=mix(cr2,vec3(0.10,0.15,0.06)*(0.7+0.6*n3),smoothstep(0.86,0.95,nw.y)*smoothstep(0.35,0.6,texture2D(tN2,vWP.xz/9.0).b)*0.8);  // 張り出しの草
  cr2=mix(cr2,vec3(0.55,0.53,0.48),(1.0-smoothstep(0.4,1.4,abs(hgt-1.8)))*smoothstep(0.55,0.8,n3)*0.18);   // 波しぶきの塩の帯
  rock=mix(rock,cr2,smoothstep(0.1,0.5,vColor.b));
}
mRock=max(mRock,vColor.b*max(smoothstep(0.08,0.22,slope),1.0-smoothstep(3.0,7.0,hgt))*smoothstep(-2.0,0.5,hgt));mSand*=1.0-smoothstep(0.2,0.6,vColor.b);
tc=mix(tc,rock,mRock);tc=mix(tc,sand,mSand);
// 凹凸（勾配テクスチャ）
float bf=1.0/(1.0+length(vViewPosition)/260.0);
vec2 gN=(texture2D(tGrN,uA).rg*w1+texture2D(tGrN,uA2).rg*w2+texture2D(tGrN,uA3).rg*w3)/(w1+w2+w3);
vec2 bmp=(gN-0.5)*1.1*(1.0-gd*0.8)*(1.0-mRock)*(1.0-mSand)*(1.0-vColor.r)+(texture2D(tRkN,uR).rg-0.5)*3.2*mRock+(mix(texture2D(tSdN,vWP.xz/9.0).rg,texture2D(tSdN,sU2).rg,sw2)-0.5)*0.45*(0.4+0.8*texture2D(tN2,vWP.xz/31.0).b)*mSand;bmp*=bf;
tc=mix(tc,tc*0.42,1.0-smoothstep(0.1,1.7,hgt));
{vec2 sl=vWP.xz/7.5,fi=floor(sl),fr=fract(sl);float hs=fract(sin(dot(fi,vec2(12.9898,78.233)))*43758.5453);
  vec3 pv=vec3(0.30,0.305,0.30)*(0.82+0.2*hs)*(0.8+0.4*n3);float jt=max(smoothstep(0.035,0.0,min(fr.x,1.0-fr.x)),smoothstep(0.035,0.0,min(fr.y,1.0-fr.y)));pv*=1.0-0.45*jt;
  float st=texture2D(tN2,vWP.xz/37.0).b;pv*=1.0-0.35*smoothstep(0.62,0.8,st);pv*=1.0-0.18*smoothstep(0.55,0.75,texture2D(tN2,vec2(vWP.x/3.0,vWP.z/90.0)).b);
  tc=mix(tc,pv,vColor.r);}
{vec2 q=vWP.xz+uSunDir.xz/max(uSunDir.y,0.12)*(1700.0-vWP.y);float fn=texture(tN3,vec3(q*0.000037,0.37)).g;tc*=1.0-0.5*smoothstep(0.52,0.66,fn)*mix(1.0,smoothstep(12300.0,16500.0,length(q)),clamp(uStorm*4.0,0.0,1.0));}
{float sw=texture2D(tN2,vWP.xz/260.0).b*6.0,edge=0.55+0.45*sin(uT*0.55+sw),lv=-0.05+0.55*edge;float wetS=1.0-smoothstep(lv,lv+0.9,hgt);tc=mix(tc,tc*0.5,wetS*mSand*0.8);
  tc=mix(tc,vec3(0.82,0.84,0.84),smoothstep(0.10,0.0,abs(hgt-lv-0.05))*smoothstep(0.35,0.65,texture2D(tN2,vWP.xz/9.0).b)*mSand*0.6);}
diffuseColor.rgb=tc;`).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(0.95,0.55,1.0-smoothstep(0.1,1.7,vWP.y));').replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(normal-(viewMatrix*vec4(bmp.x,0.0,bmp.y,0.0)).xyz);');};
  const terr=new THREE.Mesh(tg,tm);terr.receiveShadow=true;B.add(terr);
  // 森：ごつごつした樹冠を森のマスクに沿って密に植える
  {const tgm=crownGeo(22,7),tmat=leafMat();
    const N=9000,im=new THREE.InstancedMesh(tgm,tmat,N),d=new THREE.Object3D(),rd=mulberry(5),tc=new THREE.Color();let n=0,g=0;
    while(n<N&&g++<120000){const x=(rd()-.5)*3300,z=(rd()-.5)*3700,h=islandH(x,z);if(inPort(x,z)||nearRoad(x,z,18)||onAirRoad(x,z,8))continue;
      if(h<6||h>235||(Math.abs(x-30)<270&&Math.abs(z-130)<1420)||(Math.abs(x-250)<330&&Math.abs(z-150)<440))continue;
      if(rd()>forestMask(x,z)*.95+.05)continue;
      if(Math.abs(islandH(x+10,z)-h)+Math.abs(islandH(x,z+10)-h)>9)continue;
      const sc=4+rd()*5.6;d.position.set(x,h+sc*.62,z);d.scale.set(sc*(.8+rd()*.5),sc*(.95+rd()*.8),sc*(.8+rd()*.5));d.rotation.y=rd()*6;d.updateMatrix();im.setMatrixAt(n,d.matrix);
      tc.setRGB(.5+rd()*.28,.55+rd()*.25,.42+rd()*.22);im.setColorAt(n,tc);n++;}
    im.count=n;im.instanceColor.needsUpdate=true;im.frustumCulled=false;B.userData.trees=im;B.add(im);}
  // 低木の茂み：森の縁に多く、草地にもまばらに（のっぺりした草地を崩す）
  {const sg=crownGeo(8,23),sm=leafMat(),N=13000,im=new THREE.InstancedMesh(sg,sm,N),d=new THREE.Object3D(),rd=mulberry(29),tc=new THREE.Color();let n=0,g=0;
    while(n<N&&g++<160000){const x=(rd()-.5)*3300,z=(rd()-.5)*3700,h=islandH(x,z);if(inPort(x,z)||nearRoad(x,z,14)||onAirRoad(x,z,5))continue;
      if(h<4||h>240||(Math.abs(x-30)<200&&Math.abs(z-130)<1400)||(Math.abs(x-250)<300&&Math.abs(z-150)<420))continue;
      if(Math.abs(islandH(x+6,z)-h)+Math.abs(islandH(x,z+6)-h)>4.5)continue;   // 崖などの急斜面には生やさない
      const fm=forestMask(x,z),p=.12+.88*Math.max(0,1-Math.abs(fm-.45)*2.2);if(rd()>p)continue;
      const sc=1.6+rd()*rd()*3.2;d.position.set(x,h+sc*.25,z);d.scale.set(sc*(.9+rd()*.5),sc*(.6+rd()*.35),sc*(.9+rd()*.5));d.rotation.y=rd()*6;d.updateMatrix();im.setMatrixAt(n,d.matrix);
      tc.setRGB(.45+rd()*.3,.5+rd()*.28,.36+rd()*.22);im.setColorAt(n,tc);n++;}
    im.count=n;im.instanceColor.needsUpdate=true;im.frustumCulled=false;B.userData.shrubs=im;B.add(im);}
  // 滑走路沿いと建物まわりの並木（幹＋3 つの葉むら）
  {const cg=crownGeo(34,11),cm=leafMat();
    const N=420,crown=new THREE.InstancedMesh(cg,cm,N),tgm=new THREE.CylinderGeometry(.16,.3,1,7);tgm.translate(0,.5,0);
    const trunk=new THREE.InstancedMesh(tgm,std({color:lin(0x3d3226),roughness:.95,metalness:0}),N),d=new THREE.Object3D(),rd=mulberry(61),tc=new THREE.Color();let n=0;
    const put=(x,z)=>{if(n>=N)return;const h=islandH(x,z);if(h<6)return;const H=3.2+rd()*2.6,s=2.6+rd()*1.8;d.position.set(x,h-.2,z);d.rotation.set(0,rd()*6,0);d.scale.set(1+rd()*.5,H,1+rd()*.5);d.updateMatrix();trunk.setMatrixAt(n,d.matrix);
      d.position.set(x,h+H+s*.45,z);d.scale.set(s,s*(.85+rd()*.3),s);d.updateMatrix();crown.setMatrixAt(n,d.matrix);tc.setRGB(.55+rd()*.25,.6+rd()*.25,.45+rd()*.2);crown.setColorAt(n,tc);n++;};
    for(let z=-1000;z<=900;z+=16+rd()*10){put(-150-rd()*26,z);if(rd()<.6)put(-190-rd()*30,z+6);}
    for(let z=-250;z<=600;z+=22+rd()*10)put(226+rd()*6,z);
    for(let i=0;i<60;i++)put(150+rd()*330,575+rd()*60);for(let i=0;i<50;i++)put(480+rd()*40,-250+rd()*800);
    crown.count=trunk.count=n;crown.instanceColor.needsUpdate=true;crown.castShadow=true;trunk.castShadow=true;crown.frustumCulled=trunk.frustumCulled=false;B.add(crown);B.add(trunk);B.userData.avenue=[crown,trunk];}
  // 浜辺のヤシ：ゆるく曲がった幹（根元のふくらみ、葉の落ちた跡の輪）と、羽状の葉 14 枚（葉軸がアーチを描いて垂れ、小葉が V 字に並ぶ）、枯れて垂れた葉、実の房
  {const r9=mulberry(4242);
    // 幹（高さ 1 に正規化）：x 方向へ少し弓なり。輪の凹凸は頂点で、色の輪は描画で
    const tgp=[],tgi=[],TS=14,TK=40;for(let k=0;k<=TK;k++){const t=k/TK,bx=.3*Math.sin(t*Math.PI*.9),r=(.055+.05*Math.pow(1-t,3)+.012*Math.exp(-Math.pow((t-.97)/.04,2)))*(1+.07*Math.pow(Math.abs(Math.sin(t*Math.PI*26)),3));
      for(let j=0;j<=TS;j++){const a=j/TS*Math.PI*2;tgp.push(bx+Math.cos(a)*r,t,Math.sin(a)*r);}}
    for(let k=0;k<TK;k++)for(let j=0;j<TS;j++){const a=k*(TS+1)+j,b=a+1,c=a+TS+1,dd=c+1;tgi.push(a,c,b,b,c,dd);}
    const tg2=new THREE.BufferGeometry();tg2.setAttribute('position',new THREE.Float32BufferAttribute(tgp,3));tg2.setIndex(tgi);tg2.computeVertexNormals();
    // 葉の冠（幹の頂点が原点、大きさは m）
    // 葉の冠を 2 段階の細かさで作る：飛行中は軽い冠（節 12・葉 10 枚）、探検の近くでは細かい冠（節 34・葉 14 枚と実の房）に差し替える
    const palmCrown=(NS0,NF,NUTS)=>{const r9=mulberry(4242);
    const P=[],Cc=[],I=[];const frond=(a,el,L,dead)=>{const ca=Math.cos(a),sa=Math.sin(a),NS=NS0;let prev=null;
      for(let i=0;i<=NS;i++){const t=i/NS,hz=L*t,y=dead?-L*.9*t:L*(Math.sin(el)*t-(.55+.25*Math.cos(el))*t*t),x0=ca*hz,z0=sa*hz;
        if(i===0)continue;const ll=(dead?.45:1.05)*Math.sin(Math.PI*Math.min(1,t*1.12))*(L/3.6),droop=(dead?.1:.5+.45*t)*ll,px=-sa,pz=ca;
        const col=dead?[.22,.15,.07]:[.15-.07*t,.25-.09*t,.05-.025*t];
        for(const sd of[-1,1]){const b=P.length/3,fwd=.32*L/NS;P.push(x0,y,z0, x0+ca*fwd,y,z0+sa*fwd, x0+px*sd*ll+ca*fwd*1.8,y-droop,z0+pz*sd*ll+sa*fwd*1.8, x0+px*sd*ll*1.02+ca*fwd*2.4,y-droop*1.05,z0+pz*sd*ll*1.02+sa*fwd*2.4);
          for(let q=0;q<4;q++)Cc.push(col[0]*(q<2?1.15:.9),col[1]*(q<2?1.1:.9),col[2]);I.push(b,b+1,b+2,b+1,b+3,b+2);}
        // 葉軸
        {const b=P.length/3,w=.03*(1-t)+.01;P.push(x0-sa*w,y+.02,z0+ca*w,x0+sa*w,y+.02,z0-ca*w);for(let q=0;q<2;q++)Cc.push(.24,.24,.09);if(prev!==null)I.push(prev,prev+1,b,prev+1,b+1,b);prev=b;}}};
    for(let k=0;k<NF;k++){const a=k*2.399+r9()*.3,el=k<4?1.05+r9()*.2:k<10?.6+r9()*.3:.15+r9()*.25;frond(a,el,3.2+r9()*1.4,false);}
    for(let k=0;k<3;k++)frond(k*2.1+.5,0,2.2,true);
    const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(P,3));cg.setAttribute('color',new THREE.Float32BufferAttribute(Cc,3));cg.setIndex(I);cg.computeVertexNormals();
    {const nn=cg.attributes.normal;for(let i=0;i<nn.count;i++){if(nn.getY(i)<0)nn.setXYZ(i,-nn.getX(i),-nn.getY(i),-nn.getZ(i));}}   // 葉は上から照らされる向きに
    // 実の房（冠に合わせて同じ一括描画に入れる）
    if(NUTS){const cn=new THREE.SphereGeometry(.14,8,6);for(let k=0;k<6;k++){const a=k*1.05,g2=cn.clone();g2.translate(Math.cos(a)*.2,-.25-(k%2)*.12,Math.sin(a)*.2);const p2=g2.attributes.position,b=P.length/3;
      const ix=g2.index.array;for(let i=0;i<p2.count;i++){P.push(p2.getX(i),p2.getY(i),p2.getZ(i));Cc.push(.32,.26,.12);}for(let i=0;i<ix.length;i++)I.push(b+ix[i]);}
      cg.setAttribute('position',new THREE.Float32BufferAttribute(P,3));cg.setAttribute('color',new THREE.Float32BufferAttribute(Cc,3));cg.setIndex(I);cg.deleteAttribute('normal');cg.computeVertexNormals();
      {const nn=cg.attributes.normal;for(let i=0;i<nn.count;i++){if(nn.getY(i)<0)nn.setXYZ(i,-nn.getX(i),-nn.getY(i),-nn.getZ(i));}}}
    return cg;};
    const cg=palmCrown(12,10,false);B.userData.palmGeo={lo:cg,hi:null,mk:()=>palmCrown(34,14,true)};
    const lm=std({color:0xffffff,vertexColors:true,roughness:.6,metalness:0,side:THREE.DoubleSide});
    lm.onBeforeCompile=sh=>{sh.uniforms.uT=U.uTime;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uT;').replace('#include <begin_vertex>','#include <begin_vertex>\n{vec4 wp=instanceMatrix*vec4(0.0,0.0,0.0,1.0);float r=length(position.xz);float ph=uT*1.4+wp.x*0.13+wp.z*0.11;transformed.y+=sin(ph+r*1.3)*0.06*r+sin(uT*7.0+r*9.0+wp.x)*0.012*r;transformed.x+=sin(ph*0.7)*0.05*r;}');};
    lm.customProgramCacheKey=()=>'palmLeaf';
    const bm=std({color:lin(0x7a6a55),roughness:.95,metalness:0});bm.onBeforeCompile=sh=>{sh.uniforms.tN2=U.tNoise2;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vPl;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPl=position;');
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D tN2;varying vec3 vPl;').replace('#include <color_fragment>','#include <color_fragment>\n{float rg=pow(abs(sin(vPl.y*3.14159*26.0)),6.0);float n=texture2D(tN2,vec2(atan(vPl.z,vPl.x)*0.8,vPl.y*6.0)).b;diffuseColor.rgb*=(0.78+0.35*n)*(1.0-0.35*rg)*(0.85+0.3*smoothstep(0.0,0.3,vPl.y));diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(0.75,0.7,0.6),smoothstep(0.9,1.0,vPl.y));}');};
    bm.customProgramCacheKey=()=>'palmBark';
    const N=260,crown=new THREE.InstancedMesh(cg,lm,N),trunk=new THREE.InstancedMesh(tg2,bm,N),d=new THREE.Object3D(),rd=mulberry(19),tc=new THREE.Color();let n=0,g=0;crown.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(N*3),3);
    while(n<N&&g++<200000){const x=(rd()-.5)*3600,z=(rd()-.5)*4000,h=islandH(x,z);if(cliffAt(x,z)>.2)continue;if(inPort(x,z))continue;if(h<2.4||h>6.5||(Math.abs(x-30)<200&&Math.abs(z-130)<1450))continue;
      const H=5.5+rd()*4.5,ry=rd()*6.283,lean=.04+rd()*.12;d.position.set(x,h-.3,z);d.rotation.set(0,ry,lean,'YXZ');d.scale.set(3,H,3);d.updateMatrix();trunk.setMatrixAt(n,d.matrix);
      const top=new V3(.3*Math.sin(Math.PI*.9)*3,H,0).applyEuler(new THREE.Euler(0,ry,lean,'YXZ'));d.position.set(x+top.x,h-.3+top.y,z+top.z);d.rotation.set(0,rd()*6,0);const sc=.85+rd()*.35;d.scale.set(sc,sc,sc);d.updateMatrix();crown.setMatrixAt(n,d.matrix);
      tc.setRGB(.85+rd()*.25,.85+rd()*.2,.8+rd()*.2);crown.setColorAt(n,tc);n++;}
    crown.count=trunk.count=n;crown.frustumCulled=trunk.frustumCulled=false;B.add(crown);B.add(trunk);B.userData.palms=[crown,trunk];}
  // 岸辺の小物：砂浜と草地の境目の草むら、波打ち際の上の流木と小石（崖・港・道・滑走路は避ける）
  {const okAt=(x,z)=>!inPort(x,z)&&!nearRoad(x,z,15)&&!onAirRoad(x,z,4)&&cliffAt(x,z)<.2&&!(Math.abs(x-30)<120&&Math.abs(z-130)<1500);
    // 草むら：細い葉を十字に重ねた板（切り抜き）
    const gc=document.createElement('canvas');gc.width=128;gc.height=128;const gx=gc.getContext('2d'),gr=mulberry(5150);
    for(let i=0;i<70;i++){const x0=10+gr()*108,h=40+gr()*84,lean=(gr()-.5)*40;gx.strokeStyle=['#5f6f35','#74813f','#8a8a4a','#4f5f2c','#9a9258'][Math.floor(gr()*5)];gx.lineWidth=1.2+gr()*1.6;gx.beginPath();gx.moveTo(x0,128);gx.quadraticCurveTo(x0+lean*.3,128-h*.6,x0+lean,128-h);gx.stroke();}
    const gt=new THREE.CanvasTexture(gc);gt.encoding=THREE.sRGBEncoding;
    const gg=new THREE.BufferGeometry(),P=[],U=[],I=[];for(let k=0;k<3;k++){const a=k*Math.PI/3,c=Math.cos(a),s=Math.sin(a),b=P.length/3;P.push(-c,0,-s,c,0,s,c,1,s,-c,1,-s);U.push(0,0,1,0,1,1,0,1);I.push(b,b+1,b+2,b,b+2,b+3);}
    gg.setAttribute('position',new THREE.Float32BufferAttribute(P,3));gg.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));gg.setIndex(I);gg.computeVertexNormals();
    const gm=std({map:gt,alphaTest:.4,side:THREE.DoubleSide,roughness:.9,metalness:0});const N=6000,im=new THREE.InstancedMesh(gg,gm,N),d=new THREE.Object3D(),r=mulberry(811),tc=new THREE.Color();let n=0,g=0;
    while(n<N&&g++<200000){const x=(r()-.5)*3600,z=(r()-.5)*4000,h=islandH(x,z);if(h<3.0||h>8||!okAt(x,z))continue;const sc=1.4+r()*1.8;d.position.set(x,h-.1,z);d.rotation.set(0,r()*6,0);d.scale.set(sc*1.3,sc*(.8+r()*.5),sc*1.3);d.updateMatrix();im.setMatrixAt(n,d.matrix);tc.setRGB(.75+r()*.3,.75+r()*.3,.7+r()*.25);im.setColorAt(n,tc);n++;}
    im.count=n;im.instanceColor.needsUpdate=true;im.frustumCulled=false;B.add(im);
    // 流木：白っぽく乾いた丸太
    const wg=new THREE.CylinderGeometry(.18,.26,1,7);wg.rotateZ(Math.PI/2);const wc=document.createElement('canvas');wc.width=256;wc.height=64;{const x=wc.getContext('2d'),q=mulberry(77);x.fillStyle='#8f8576';x.fillRect(0,0,256,64);
      for(let i=0;i<90;i++){const y=q()*64;x.strokeStyle='rgba('+(q()<.5?'60,52,44':'190,182,168')+','+(.15+q()*.3)+')';x.lineWidth=.6+q()*1.6;x.beginPath();x.moveTo(0,y);for(let X=0;X<=256;X+=16)x.lineTo(X,y+Math.sin(X*.05+i)*2);x.stroke();}
      for(let i=0;i<12;i++){x.fillStyle='rgba(40,34,28,.6)';x.fillRect(q()*256,q()*64,8+q()*30,1.5);}for(let i=0;i<6;i++){x.fillStyle='rgba(60,50,40,.5)';x.beginPath();x.ellipse(q()*256,q()*64,4,3,0,0,7);x.fill();}}
    const wtex=new THREE.CanvasTexture(wc);wtex.encoding=THREE.sRGBEncoding;wtex.wrapS=wtex.wrapT=THREE.RepeatWrapping;
    const wm=std({map:wtex,roughness:.95,metalness:0}),wd=new THREE.InstancedMesh(wg,wm,420);let nw=0;g=0;
    while(nw<420&&g++<200000){const x=(r()-.5)*3600,z=(r()-.5)*4000,h=islandH(x,z);if(h<1.1||h>2.6||!okAt(x,z))continue;const L=2.5+r()*6,t=1+r()*1.2;d.position.set(x,h+.15*t,z);d.rotation.set(0,r()*6,(r()-.5)*.15);d.scale.set(L,t,t);d.updateMatrix();wd.setMatrixAt(nw++,d.matrix);}
    wd.count=nw;wd.castShadow=true;wd.userData.bump='log';B.add(wd);}
  // 沖の岩礁と北岬の灯台
  {const rm=std({color:lin(0x4a443c),roughness:.92,metalness:0});rm.onBeforeCompile=sh=>{sh.uniforms.tN2=U.tNoise2;
      sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nattribute float aCav;varying float vCav;varying vec3 vRP;varying vec3 vRN;").replace("#include <begin_vertex>","#include <begin_vertex>\nvCav=aCav;{mat4 rkM=modelMatrix;\n#ifdef USE_INSTANCING\nrkM=modelMatrix*instanceMatrix;\n#endif\nvRP=(rkM*vec4(position,1.0)).xyz;vRN=normalize(mat3(rkM)*normal);}");
      sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nvarying float vCav;varying vec3 vRP;varying vec3 vRN;uniform sampler2D tN2;float gRockH=0.0,gRockWet=0.0;").replace("#include <normal_fragment_maps>","#include <normal_fragment_maps>\n{vec3 rkP=-vViewPosition,rkX=dFdx(rkP),rkY=dFdy(rkP);float rkHx=dFdx(gRockH),rkHy=dFdy(gRockH);vec3 rkA=cross(rkY,normal),rkB=cross(normal,rkX);float rkD=dot(rkX,rkA);vec3 rkG=sign(rkD)*(clamp(rkHx,-0.08,0.08)*rkA+clamp(rkHy,-0.08,0.08)*rkB);normal=normalize(abs(rkD)*normal-rkG*0.9);}").replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,0.55,gRockWet);").replace("#include <color_fragment>",`#include <color_fragment>
// 3 方向から投影したノイズ（斜めの面で引き伸びない）
vec3 bw=pow(abs(vRN),vec3(4.0));bw/=bw.x+bw.y+bw.z;
#define TRI(S,O) (texture2D(tN2,vRP.zy/S+O).b*bw.x+texture2D(tN2,vRP.xz/S+O).b*bw.y+texture2D(tN2,vRP.xy/S+O).b*bw.z)
float ra=TRI(23.0,0.11),rb=TRI(7.0,0.37),rc=TRI(2.2,0.71),rd=TRI(0.7,0.53);
// 地層：わずかに傾き、ノイズで波打つ横縞。縞の境は段になって陰る
float sy=vRP.y*(0.26+0.14*TRI(53.0,0.29))+vRP.x*0.03-vRP.z*0.02+(ra-0.5)*3.2+(rb-0.5)*0.9;float lay=fract(sy),lid=floor(sy);
  float lv=fract(sin(lid*12.9898)*43758.5453);   /* 層ごとの硬さ（目立つ層・溶けて消えかけた層） */
  float strata=mix(1.0,smoothstep(0.0,0.18+0.25*lv,lay)*(1.0-smoothstep(0.82,1.0,lay))+smoothstep(0.82,1.0,lay)*0.0,smoothstep(0.25,0.6,TRI(29.0,0.83)+lv*0.3))*(0.7+0.3*rb);
  float layc=0.85+0.3*lv;   /* 地層：段の上は張り出し、下は陰 */
// 割れ目：縦に走る細い筋
float crk=(1.0-smoothstep(0.0,0.02,abs(TRI(17.0,0.9)-0.5)))*smoothstep(0.6,0.75,TRI(41.0,0.47))*(1.0-bw.y);   /* 割れ目はまばらに、縦の面だけ */
float rH=ra*0.9+rb*0.3+rc*0.06+strata*0.35-crk*0.15;
vec3 c=0.32*mix(vec3(0.20,0.19,0.18),vec3(0.42,0.38,0.32),smoothstep(0.25,0.8,ra*0.7+rb*0.5));      // 玄武岩の灰と砂岩の茶
c=mix(c,0.32*vec3(0.47,0.31,0.18),smoothstep(0.62,0.82,TRI(31.0,0.23))*0.55);                        // 鉄さびの赤茶
c*=0.8+0.35*rc;c*=0.8+0.2*strata;c*=layc;c*=1.0-0.55*crk;
// 上から流れた黒い筋（雨だれ）
c*=1.0-0.35*smoothstep(0.55,0.8,texture2D(tN2,vec2(vRP.x*0.09+vRP.z*0.07,vRP.y*0.006)).b)*(1.0-bw.y);
c*=mix(0.4,1.1,smoothstep(0.0,0.75,vCav));                                                       // くぼみの暗がり
float up=smoothstep(0.5,0.9,vRN.y);c=mix(c,0.4*vec3(0.34,0.37,0.2)*(0.7+0.6*rc),up*smoothstep(0.45,0.7,rb)*0.65);   // 上向きの面の地衣類
c=mix(c,0.55*vec3(0.8,0.79,0.74),smoothstep(0.64,0.8,rc)*up*smoothstep(8.0,20.0,vRP.y)*0.7);          // 鳥のふん
float wet=1.0-smoothstep(1.0,4.5,vRP.y+(ra-0.5)*1.6);c=mix(c,c*0.35,wet);c=mix(c,vec3(0.05,0.09,0.05),wet*smoothstep(0.4,0.7,rb)*0.7);  // 水際の濡れと海藻
c=mix(c,0.35*vec3(0.56,0.54,0.49),(1.0-smoothstep(0.5,1.6,abs(vRP.y-1.7)))*smoothstep(0.55,0.75,rc)*0.5);   // フジツボの帯
gRockH=rH;gRockWet=wet;
diffuseColor.rgb=c;`);};
    // 岩の形：頂点をつなげて滑らかにし、尾根のある起伏・地層の縞・平らな底を付ける。くぼみの度合いは aCav に残す
    const rockGeo=(seed,det)=>{const src=new THREE.IcosahedronGeometry(1,det||5),sp=src.attributes.position,map=new Map(),P=[],I=[],cav=[];
      for(let i=0;i<sp.count;i++){const x=sp.getX(i),y=sp.getY(i),z=sp.getZ(i),key=Math.round(x*1e4)+','+Math.round(y*1e4)+','+Math.round(z*1e4);let id=map.get(key);
        if(id===undefined){id=P.length/3;map.set(key,id);const o=seed*13.7,n1=vnoise2(x*1.6+y*1.9+o,z*1.6-y*.7+o*.3),n2=vnoise2(x*4.2-y*2.3+o,z*4.2+y*3.1-o),n3=vnoise2(x*11+y*7+o,z*11-y*9),ridge=1-Math.abs(2*n2-1);
          let k=.66+.42*n1+.16*ridge+.05*n3+.035*Math.sin(y*16+n1*5);const yy=y<-.05?y*.3:y*(1.0+.15*n1);P.push(x*k,yy*k,z*k*(.85+.3*vnoise2(o+3,y*2)));cav.push(Math.min(1,Math.max(0,(k-.62)*1.6)));}I.push(id);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('aCav',new THREE.Float32BufferAttribute(cav,1));g.setIndex(I);g.computeVertexNormals();return g;};
    const RG=[rockGeo(1),rockGeo(2),rockGeo(3)],RGs=rockGeo(4,2),rr=mulberry(808);
    const small=new THREE.InstancedMesh(RGs,rm,120),d=new THREE.Object3D();let ns=0;
    for(const[x,z,sc,hh,v]of[[-1420,-760,34,60,0],[-1500,-640,22,38,1],[-1380,-900,18,26,2],[-1250,1480,30,44,1],[-1330,1400,16,22,0],[900,-1620,20,24,2]]){const r=new THREE.Mesh(RG[v],rm);r.position.set(x,hh*.12,z);r.scale.set(sc,hh,sc*.8);r.rotation.y=x;r.userData.rock=1;r.castShadow=true;r.receiveShadow=true;B.add(r);
      // 根元に寄せる白波の輪（x＝外向き、0 が岩側）
      {const R1=sc*.72,R2=sc*1.05+14,NA=64,P=[],U=[],I=[];for(let i=0;i<=NA;i++){const a=i/NA*6.2832,c=Math.cos(a),s2=Math.sin(a);P.push(c*R1,.8,s2*R1*.85,c*R2,.8,s2*R2*.85);U.push(0,a*R2,1,a*R2);if(i<NA){const q=i*2;I.push(q,q+1,q+2,q+1,q+3,q+2);}}
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(I);
        const fm=new THREE.Mesh(g,foamMat(3,{alpha:.8,sx:R2-R1,sy:1,speed:.05,inScene:1}));fm.position.set(x,0,z);fm.rotation.y=x;fm.frustumCulled=false;B.add(fm);}
      for(let k=0;k<14&&ns<120;k++){const a=rr()*6.28,rad=sc*(.9+rr()*1.4),s3=1.5+rr()*rr()*sc*.22;d.position.set(x+Math.cos(a)*rad,-s3*.25,z+Math.sin(a)*rad*.85);d.rotation.set(rr()*.6,rr()*6,rr()*.6);d.scale.set(s3,s3*(.5+rr()*.6),s3);d.updateMatrix();small.setMatrixAt(ns++,d.matrix);}}
    small.count=ns;small.castShadow=true;small.userData.rock=1;B.add(small);
    // 崖のふもとに崩れ落ちた岩
    {const fall=new THREE.InstancedMesh(RGs,rm,260),d2=new THREE.Object3D();let nf=0;
      for(let k=0;k<3000&&nf<260;k++){const a2=rr()*6.2832,c=cliffAt(Math.cos(a2)*1400,Math.sin(a2)*1600);if(c<.5)continue;let r2=600;while(r2<2600&&islandH(Math.cos(a2)*r2,Math.sin(a2)*r2)>0)r2+=3;
        const rr2=r2+(rr()-.3)*22,x=Math.cos(a2)*rr2,z=Math.sin(a2)*rr2,sc=1.5+rr()*rr()*7;d2.position.set(x,Math.max(islandH(x,z),-2)-sc*.25,z);d2.rotation.set(rr()*.8,rr()*6,rr()*.8);d2.scale.set(sc,sc*(.5+rr()*.5),sc);d2.updateMatrix();fall.setMatrixAt(nf++,d2.matrix);}
      fall.count=nf;fall.castShadow=true;fall.userData.rock=1;B.add(fall);}
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
  for(let l=0;l<6;l++){const t=rr2();x.fillStyle=t<.5?'rgba(0,0,0,'+(.04+t*.08)+')':'rgba(255,255,255,'+((t-.5)*.06)+')';x.fillRect(X(-32+l*10.7),0,PX*10.7,RH);}
  for(let i=0;i<14;i++){const y0=rr2()*RH,h=Y(20+rr2()*80);x.fillStyle='rgba(12,13,14,.35)';x.fillRect(X(-32+Math.floor(rr2()*6)*10.7),y0,PX*10.7,h);}   // 打ち替えた区画
  // 中央の帯（車輪が通る）は少し黒く
  {const g=x.createLinearGradient(X(-14),0,X(14),0);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.3,'rgba(0,0,0,.12)');g.addColorStop(.7,'rgba(0,0,0,.12)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(X(-14),0,PX*28,RH);}
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
  // ペンキのかすれと汚れ（白い標示の上にだけ目立つ細かい点）
  for(let i=0;i<60000;i++){x.fillStyle='rgba(40,42,45,'+(.25+rr2()*.5)+')';x.fillRect(rr2()*RW,rr2()*RH,1+rr2()*1.5,1+rr2()*2);}
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
  const HG=new THREE.Group();HG.position.set(0,RWY_Y,HANGAR_Z);B.add(HG);B.userData.HG=HG;
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
    box(d,47.5,27.8,1.6,std({color:lin(0x4f6e70),roughness:.6,metalness:.4}),0,13.9,0,true);box(d,47.38,1.2,1.8,darkM,0,9,0);box(d,47.38,1.2,1.8,darkM,0,19,0);box(d,40,.5,.3,amM,0,14,-.9);{const dm=new THREE.Mesh(new THREE.PlaneGeometry(47.3,27.8),B.userData.cones.doorM);dm.position.set(0,14,.82);d.add(dm);for(const y of[4.5,14,23.5])box(d,47.5,.5,.5,darkM,0,y,1.0);}return d;});
  const hlight=new THREE.PointLight(0xcfe2ff,2.2,300,1.4);hlight.position.set(0,RWY_Y+27,HANGAR_Z);B.add(hlight);   // 格納庫の天井照明。格納庫は遠いと隠すが、光は隠さない（光の数が変わると全部の材質のシェーダが作り直しになり固まる。届くのは 300 m まで）
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
    const cap=new THREE.Mesh(new THREE.SphereGeometry(15,28,8,0,6.283,0,1.2),hullM);cap.scale.y=.42;for(const by of[4,10,16]){const bnd=new THREE.Mesh(new THREE.TorusGeometry(15.15,.3,6,48),copperM);bnd.rotation.x=Math.PI/2;bnd.position.set(440,RWY_Y+by,-40+k*44);B.add(bnd);}cap.position.set(440,RWY_Y+20-15*Math.cos(1.2)*.42,-40+k*44);B.add(cap);
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
  for(const pz of[-120,60]){const dr=buildUAV();dr.position.set(250,RWY_Y,pz);dr.rotation.y=pz>0?.6:-.4;B.add(dr);}
  for(const[kind,x,z,c,ry]of[['tug',225,150,0xd9a21b,.5],['gpu',243,146,0xd9a21b,-.4],['fuel',253,176,0xc9ced2,1.2],['fire',235,112,0xb3261c,-1.3],['follow',215,70,0xd9a21b,3.0],['tug',262,128,0xe8e8e0,2.2]]){const v=buildVehicle(kind,c);v.position.set(x,RWY_Y+.02,z);v.rotation.y=ry;LOD.add(v);}
  // 進入灯の柱と PAPI
  for(let k=0;k<4;k++)box(B,1.2,.8,1.05,new THREE.MeshBasicMaterial({color:k<2?new THREE.Color(4,.3,.2):new THREE.Color(4,4,4)}),-48-k*4,RWY_Y+.3,-820);
  buildPort(LOD,{darkM,paleM,box,conc,glassM});Object.assign(B.userData,{socks:LOD.userData.socks,lodPort:LOD});
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
    const units=new Map();
    B.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||!o.visible||skip(o))return;const m=Array.isArray(o.material)?o.material[0]:o.material;if(m.transparent||m.depthWrite===false||m.blending===THREE.AdditiveBlending)return;
      {let u=null;for(let q=o;q&&q!==B;q=q.parent)if(q.userData.unit){u=q;break;}if(u){bx.setFromObject(o);const e=units.get(u);if(e)e.union(bx);else units.set(u,bx.clone());return;}}   /* クレーンなどは部品をまとめて 1 つの施設に。面ごとに材質が違う建物（bld）も当たり判定に入れる */
      if(o.geometry.attributes.position.count>20000)return;
      bx.setFromObject(o);const hy=bx.max.y-bx.min.y,sx=bx.max.x-bx.min.x,sz=bx.max.z-bx.min.z,gy=Math.max(islandH(bx.min.x/2+bx.max.x/2-BASE.x,bx.min.z/2+bx.max.z/2-BASE.z),0);
      if(hy<2.5||bx.max.y<gy+5||sx>700||sz>700)return;const wd=Math.max(sx,sz),tall=wd<11&&hy>wd*2.2?1:0,gt=o.geometry.type||'';
      // 壊れ方の種類：0 コンクリート（崩れ落ちる）・1 塔（倒れる）・2 倉庫（屋根が抜ける）・3 タンク（裂けて潰れる）
      const kind=tall||(wd<16&&hy>wd*4)?1:(/Cylinder/.test(gt)&&Math.abs(sx-sz)<.25*wd&&hy<wd*1.6&&hy>wd*.3&&wd>4?3:(wd>28&&hy<wd*.55?2:0));
      cols.push([bx.min.x,bx.min.y,bx.min.z,bx.max.x,bx.max.y,bx.max.z,tall,o.userData.rock?1:0,kind]);});
    for(const[u,b]of units){const wp=new V3();u.getWorldPosition(wp);const pv=u.userData.unit.pivot;cols.push([b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z,0,0,u.userData.unit.kind,[wp.x+pv[0],wp.z+pv[1],wp.x+pv[2],wp.z+pv[3]],u]);}   // [9] 倒れるときの支点の範囲（脚）、[10] そのグループ
    // コンテナの区画（一括描画なので部品からは拾えない）：区画ごとに 1 つ。[11] 区画の番号
    {const cn=LOD.userData.cont;if(cn){LOD.updateMatrixWorld(true);cn.blocks.forEach((k,i)=>{const a=new V3(k.box[0],k.box[1],k.box[2]).applyMatrix4(LOD.matrixWorld),b=new V3(k.box[3],k.box[4],k.box[5]).applyMatrix4(LOD.matrixWorld);cols.push([Math.min(a.x,b.x),a.y,Math.min(a.z,b.z),Math.max(a.x,b.x),b.y,Math.max(a.z,b.z),0,0,5,null,null,i]);});}}
    B.userData.colliders=cols;
    {const ex=[],bumps=[],q=new THREE.Quaternion(),ps=new V3(),sc=new V3(),ax=new V3(),az=new V3(),up=new V3();
      // 1 つの当たり：[x0,y0,z0,x1,y1,z1（外接の箱）, 中心x,中心z, 半幅, 半奥行き, 幅の向き(x,z), 奥行きの向き(x,z)]
      const add=(b,cx,cz,hx,hz,ex2,ez2,fx,fz)=>ex.push([b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z,cx,cz,hx,hz,ex2,ez2,fx,fz]);
      B.traverse(o=>{if(!o.isMesh||!o.visible||o.userData.dyn)return;for(let q2=o;q2&&q2!==B;q2=q2.parent)if(q2.userData.dyn||q2.userData.push)return;const m=Array.isArray(o.material)?o.material[0]:o.material;if(m.transparent||m.depthWrite===false)return;
        if(o.isInstancedMesh&&(o.userData.rock||o.userData.bump)){o.geometry.computeBoundingBox();const gb=o.geometry.boundingBox,m4=new THREE.Matrix4(),e=new THREE.Euler();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m4);m4.premultiply(o.matrixWorld);m4.decompose(ps,q,sc);e.setFromQuaternion(q,'YXZ');
            if(o.userData.bump==='log'){const L=(gb.max.x-gb.min.x)*sc.x,rr=(gb.max.y-gb.min.y)/2*sc.y;bumps.push([ps.x,ps.y,ps.z,L/2,rr,rr,Math.cos(e.y),-Math.sin(e.y),1]);continue;}
            const rx=(gb.max.x-gb.min.x)/2*sc.x*.85,ry=gb.max.y*sc.y*.9,rz=(gb.max.z-gb.min.z)/2*sc.z*.85,top=ps.y+ry,g0=Math.max(islandH(ps.x-BASE.x,ps.z-BASE.z),-30);
            if(top-Math.max(g0,0)>2.2&&top>0.5){bx.min.set(ps.x-rx,ps.y-ry,ps.z-rz);bx.max.set(ps.x+rx,top,ps.z+rz);add(bx,ps.x,ps.z,rx*.85,rz*.85,1,0,0,1);}   /* 大岩は乗り越えられない */
            else bumps.push([ps.x,ps.y,ps.z,rx,ry,rz,Math.cos(e.y),-Math.sin(e.y),0]);}return;}
        if(o.isInstancedMesh&&!o.userData.exCol){const ud=B.userData,veg=[ud.trees,ud.shrubs,...(ud.avenue||[]),...(ud.palms||[])];if(veg.includes(o)||o.userData.carton||(LOD.userData.cont&&o===LOD.userData.cont.im))return;const mt=Array.isArray(o.material)?o.material[0]:o.material;if(mt.alphaTest>0&&mt.side===THREE.DoubleSide)return;
          o.geometry.computeBoundingBox();const gb=o.geometry.boundingBox,m4=new THREE.Matrix4(),lc=new V3();gb.getCenter(lc);for(let i=0;i<o.count;i++){o.getMatrixAt(i,m4);m4.premultiply(o.matrixWorld);m4.decompose(ps,q,sc);bx.copy(gb).applyMatrix4(m4);
            const gy=Math.max(islandH((bx.min.x+bx.max.x)/2-BASE.x,(bx.min.z+bx.max.z)/2-BASE.z),0);if(bx.max.y<gy+.3||bx.min.y>Math.max(gy,0)+3.6||bx.max.y-bx.min.y<.2)continue;
            up.set(0,1,0).applyQuaternion(q);const cw=lc.clone().applyMatrix4(m4);if(up.y>.985){ax.set(1,0,0).applyQuaternion(q);az.set(0,0,1).applyQuaternion(q);const la=Math.hypot(ax.x,ax.z),lb=Math.hypot(az.x,az.z);add(bx,cw.x,cw.z,(gb.max.x-gb.min.x)/2*sc.x,(gb.max.z-gb.min.z)/2*sc.z,ax.x/la,ax.z/la,az.x/lb,az.z/lb);}
            else add(bx,cw.x,cw.z,(bx.max.x-bx.min.x)/2,(bx.max.z-bx.min.z)/2,1,0,0,1);}return;}
        if(o.isInstancedMesh){if(!o.userData.exCol)return;o.geometry.computeBoundingSphere();const R0=o.geometry.boundingSphere.radius*.72,m4=new THREE.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m4);m4.premultiply(o.matrixWorld);m4.decompose(ps,q,sc);const rr=R0*sc.x;bx.min.set(ps.x-rr,ps.y-rr,ps.z-rr);bx.max.set(ps.x+rr,ps.y+rr,ps.z+rr);add(bx,ps.x,ps.z,rr,rr,1,0,0,1);}return;}
        bx.setFromObject(o);const sx=bx.max.x-bx.min.x,sz=bx.max.z-bx.min.z,hy=bx.max.y-bx.min.y;if(hy<.35)return;
        const gy=Math.max(islandH((bx.min.x+bx.max.x)/2-BASE.x,(bx.min.z+bx.max.z)/2-BASE.z),0);if(bx.max.y<gy+.45&&bx.max.y<.6)return;
        const box=o.geometry.type==='BoxGeometry';if(!box){if(sx>320||sz>320)return;if(sx*sz>2500&&hy<.12*Math.max(sx,sz))return;if(bx.min.y>gy+3.6)return;add(bx,(bx.min.x+bx.max.x)/2,(bx.min.z+bx.max.z)/2,sx/2,sz/2,1,0,0,1);return;}
        o.matrixWorld.decompose(ps,q,sc);up.set(0,1,0).applyQuaternion(q);if(Math.abs(up.y)<.985){if(sx>320||sz>320||bx.min.y>gy+3.6)return;add(bx,(bx.min.x+bx.max.x)/2,(bx.min.z+bx.max.z)/2,sx/2,sz/2,1,0,0,1);return;}
        if(bx.min.y>Math.max(gy,0)+3.6&&bx.min.y>3.6)return;const P=o.geometry.parameters;ax.set(1,0,0).applyQuaternion(q);az.set(0,0,1).applyQuaternion(q);const la=Math.hypot(ax.x,ax.z),lb=Math.hypot(az.x,az.z);
        add(bx,ps.x,ps.z,P.width*sc.x/2,P.depth*sc.z/2,ax.x/la,ax.z/la,az.x/lb,az.z/lb);});
      const cn=LOD.userData.cont;if(cn){LOD.updateMatrixWorld(true);const m4=new THREE.Matrix4(),pp=new V3();for(let i=0;i<cn.im.count;i++){cn.im.getMatrixAt(i,m4);pp.setFromMatrixPosition(m4);if(pp.y>4.6+3)continue;pp.applyMatrix4(LOD.matrixWorld);bx.min.set(pp.x-1.22,pp.y-1.3,pp.z-3.03);bx.max.set(pp.x+1.22,pp.y+1.3,pp.z+3.03);add(bx,pp.x,pp.z,1.22,3.03,1,0,0,1);}}
      B.userData.exCols=ex;B.userData.exBumps=bumps;}}
  weatherize(B);
  for(const o of B.userData.spin||[])o.userData.dyn=1;for(const o of(B.userData.detail&&B.userData.detail.userData.flags)||[])o.userData.dyn=1;
  mergeStatic(HG);mergeStatic(LOD);mergeStatic(B.userData.lodLH);mergeStatic(B);
  {const dg=[];B.traverse(o=>{if(o.userData.dyn&&!o.isMesh&&!o.userData.noWeather&&!o.userData.noMerge)dg.push(o);});for(const g of dg){g.userData.dyn=0;mergeStatic(g);g.userData.dyn=1;}}
}

// ───────────────────────── 竜巻（海上竜巻） ─────────────────────────
let spoutMat;
function buildSpout(){
  if(!spoutMat)spoutMat=new THREE.ShaderMaterial({
    uniforms:{uTime:U.uTime,tNoise2:U.tNoise2,uLight:{value:1},uFlashI:U.uFlashI},transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`uniform float uTime;varying vec2 vUv;varying vec3 vN;varying vec3 vV;
void main(){vUv=uv;vec3 p=position;float h=uv.y;
  p.x+=sin(h*5.0+uTime*0.7)*26.0*h*(1.0-h)*2.0+h*h*40.0;p.z+=cos(h*4.0+uTime*0.5)*22.0*h*(1.0-h)*2.0;
  vec4 mv=modelViewMatrix*vec4(p,1.0);vN=normalMatrix*normal;vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uTime,uLight,uFlashI;uniform sampler2D tNoise2;varying vec2 vUv;varying vec3 vN;varying vec3 vV;
float sat(float x){return clamp(x,0.0,1.0);}
void main(){
  // らせん状に巻き上がる筋（上ほど速くねじれる）、ふちは柔らかく、芯は濃い
  float tw=vUv.x*3.0+vUv.y*(5.0+vUv.y*4.0)-uTime*1.1;
  float n=texture2D(tNoise2,vec2(tw,vUv.y*1.6-uTime*0.25)).b;
  float n2=texture2D(tNoise2,vec2(vUv.x*9.0+vUv.y*12.0-uTime*2.2,vUv.y*7.0-uTime*0.6)).b;
  float streak=smoothstep(0.35,0.75,texture2D(tNoise2,vec2(tw*2.0,vUv.y*0.4)).b);
  float f=abs(dot(normalize(vN),normalize(vV)));
  float a=smoothstep(0.0,0.55,f)*(0.6+0.4*n)*smoothstep(0.0,0.05,vUv.y)*(0.8+0.3*streak);
  float far=1.0-smoothstep(3200.0,5200.0,length(vV));a*=(1.0-smoothstep(0.9,1.0,vUv.y)*0.85)*far;if(a<0.03)discard;
  vec3 c=mix(vec3(0.045,0.05,0.06),vec3(0.24,0.26,0.29),n*0.4+n2*0.3+streak*0.3)*(1.0-0.35*smoothstep(0.6,1.0,f))*(uLight+uFlashI*2.0);
  gl_FragColor=vec4(c*0.8,sat(a*2.2));
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
// 粒の板は全部で 1 枚を共有する（1 粒ずつ別の形状だと、初めて使われた粒が出るたびに GPU へ送る形状が増えていく）
let QUAD1=null;const quad1=()=>QUAD1||(QUAD1=new THREE.PlaneGeometry(1,1));
function makeBillboard(color){
  const m=new THREE.Mesh(quad1(),glowMat(color,3));m.frustumCulled=false;m.visible=false;overlay.add(m);return m;
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
function shellSlab(z0,z1,t0,t1,o0,o1,rf,sy){
  const n=6,pos=[],idx=[],N=(n+1)*(n+1);
  for(const off of[o1,o0])for(let i=0;i<=n;i++)for(let j=0;j<=n;j++){const z=lerp(z0,z1,i/n),th=lerp(t0,t1,j/n),r=(rf||fusR)(z)+off;pos.push(Math.sin(th)*r,Math.cos(th)*r*(sy||.9),z);}
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){const a=i*(n+1)+j,b=a+1,c=a+n+1,d=c+1;idx.push(a,c,b,b,c,d);idx.push(N+a,N+b,N+c,N+b,N+d,N+c);}
  const ring=[];for(let j=0;j<=n;j++)ring.push(j);for(let i=1;i<=n;i++)ring.push(i*(n+1)+n);for(let j=n-1;j>=0;j--)ring.push(n*(n+1)+j);for(let i=n-1;i>0;i--)ring.push(i*(n+1));
  for(let k=0;k<ring.length;k++){const a=ring[k],b=ring[(k+1)%ring.length];idx.push(a,b,N+a,b,N+b,N+a);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;}
function addArmor(g){
  const plates=[],pc=lin(g.userData.bodyHex||0x98a1a9).multiplyScalar(.7),pm=panelize(std({color:pc,metalness:.72,roughness:.36,side:THREE.DoubleSide})),
    sms=[0,1].map(v=>{const t=scarTex(v),m=std({map:t.map,emissiveMap:t.em,emissive:new THREE.Color(2.4,2.2,2.0),bumpMap:t.bump,bumpScale:.05,alphaTest:.5,metalness:.35,roughness:.62,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});return m;});g.userData.scarMats=sms;let sn=0;
  const SHA=g.userData.shape,fit=q=>{if(SHA.fus)q.scale(SHA.fus,1,1);return q;};
  const add=(geo,sgeo,x,y,z,ry,rz)=>{const k=sn++,uv=sgeo.attributes.uv;if(uv){for(let i=0;i<uv.count;i++)uv.setXY(i,k&2?1-uv.getX(i):uv.getX(i),k&4?1-uv.getY(i):uv.getY(i));}
    const s=new THREE.Mesh(sgeo,sms[k&1]),p=new THREE.Mesh(geo,pm);
    for(const m of[s,p]){m.position.set(x,y,z);m.rotation.set(0,ry,rz||0);g.add(m);}if(sgeo.type==='PlaneGeometry')s.position.y-=.004;s.visible=false;p.castShadow=true;
    plates.push({mesh:p,scar:s,home:p.position.clone(),homeQ:p.quaternion.clone(),on:true,vel:new V3(),av:new V3(),life:0});};
  // 原型機は機首寄りの胴体に（支柱と丸窓を避ける）
  if(SHA.orig)for(const[z0,z1]of[[-9.45,-8.3],[-8.1,-6.7],[-6.5,-5.1]])for(const[t0,t1]of[[-1.25,-.45],[-.4,.4],[.45,1.25]])
    add(shellSlab(z0,z1,t0,t1,-.04,.07,origR,.86),shellUV(z0+.02,z1-.02,t0+.01,t1-.01,.012,origR,.86),0,0,0,0);
  else for(const[z0,z1,tt]of[[-2.4,.3,[[-1.3,-.62],[-.52,.18],[.3,1.2]]],[.6,4.1,[[-1.15,-.2],[-.1,.7],[.82,1.32]]],[4.4,6.9,[[-1.32,-.7],[-.58,.42],[.54,1.1]]]])for(const[t0,t1]of tt)
    add(fit(shellSlab(z0,z1,t0,t1,-.01,.07)),fit(shellUV(z0+.02,z1-.02,t0+.01,t1-.01,.012)),0,0,0,0);
  const WA=g.userData.wingAt,S0=g.userData.shape.st;
  const ar=mulberry(77);
  for(const s of[1,-1])for(const[fx0,w0]of(s>0?[[.24,2.9],[.55,2.2],[.84,2.1]]:[[.36,2.3],[.66,2.8],[.9,1.6]])){const fx=fx0+(ar()-.5)*.05,w=w0;const ax=lerp(S0[0][0],S0[2][0],fx),q=WA(ax),q2=WA(ax+1),d=Math.min(1.9,q.c*.3);
    add(new THREE.BoxGeometry(w,.07,d),new THREE.PlaneGeometry(w*.98,d*.98).rotateX(-Math.PI/2),s*ax,q.y+q.th*q.c*.55+.015,q.le+q.c*(s>0?.3:.4),-s*Math.atan2((q2.le+q2.c*.34)-(q.le+q.c*.34),1)+(ar()-.5)*.25,s*Math.atan2(q2.y-q.y,1));}
  // 剥がれる順番（散らす）
  const ord=[4,9,1,12,7,10,3,13,0,6,11,5,14,2,8];
  return ord.map(i=>plates[i]);
}

// ───────────────────────── ディフューザー（気象制御弾） ─────────────────────────
// 外形は半径 0.42・全長約 7.5m（機体の腹下の懸架環や格納庫の架台に合わせる）。前から：レドームと観測窓、前の小翼 4 枚、
// 放射部（へこんだ帯に放射素子が 18 個ずつ並ぶ 3 本の帯）、後部胴体（危険表示の帯・機番の刷り込み・点検口）、ガンメタルの絞り胴、切り落とし三角の安定翼 4 枚、ロケットのノズル
let DFTEX=null;
// 絵柄は 512×200（横:縦＝2.56）。胴に貼る面も同じ比率（長さ 0.70m × 周方向 0.273m）にする（比率が違うと文字が歪む）
const DF_W=512,DF_H=200,DF_L=.70;
function diffuserTex(){if(DFTEX)return DFTEX;const c=document.createElement('canvas');c.width=DF_W;c.height=DF_H;const x=c.getContext('2d');
  x.fillStyle='#1a1f24';x.textBaseline='middle';x.font='bold 58px Arial';x.fillText('WX-7',14,52);x.font='bold 28px Arial';x.fillText('DIFFUSER',176,36);x.font='18px Arial';x.fillText('MIZUHA WEATHER CONTROL',176,70);
  x.fillStyle='#d69a14';x.fillRect(14,100,484,8);x.fillStyle='#1a1f24';x.font='bold 18px Arial';x.fillText('DANGER  HIGH VOLTAGE',14,136);x.fillText('DO NOT TOUCH EMITTERS',14,166);
  // 稲妻の警告三角（文字と重ならない右下）
  x.fillStyle='#d69a14';x.beginPath();x.moveTo(445,116);x.lineTo(498,194);x.lineTo(392,194);x.fill();x.fillStyle='#1a1f24';x.beginPath();x.moveTo(450,136);x.lineTo(433,166);x.lineTo(446,166);x.lineTo(439,186);x.lineTo(461,158);x.lineTo(447,158);x.lineTo(456,136);x.fill();
  DFTEX=new THREE.CanvasTexture(c);DFTEX.encoding=THREE.sRGBEncoding;DFTEX.anisotropy=8;return DFTEX;}
function buildDiffuser(){
  const g=new THREE.Group(),R=.42;
  const white=std({color:lin(0xd6dadd),metalness:.35,roughness:.42}),rad=std({color:lin(0xaab1b8),metalness:.15,roughness:.55}),gun=std({color:lin(0x3b4148),metalness:.85,roughness:.38}),
    dark=std({color:lin(0x14181c),metalness:.75,roughness:.4,side:THREE.DoubleSide}),amber=std({color:lin(0xd69a14),metalness:.3,roughness:.5}),
    hot=std({color:lin(0x4a3f36),metalness:.9,roughness:.45,side:THREE.DoubleSide}),sap=std({color:lin(0x0e2436),metalness:.9,roughness:.06}),
    cy=new THREE.MeshBasicMaterial({color:new THREE.Color(.1,.62,.85)});CUTDIM.push([cy,cy.color.clone()]);
  const M=(geo,m,z,rx)=>{const o=new THREE.Mesh(geo,m);o.position.z=z||0;if(rx!==undefined)o.rotation.x=rx;g.add(o);return o;};
  const cyl=(r0,r1,z0,z1,m,open)=>M(new THREE.CylinderGeometry(r1,r0,z1-z0,36,1,!!open),m,(z0+z1)/2,Math.PI/2);   // z0 側の半径 r0、z1 側の半径 r1
  // レドーム（なめらかなオジーブ）と、先端のサファイアの観測窓と縁
  M(latheZ([[-3.72,.02],[-3.64,.1],[-3.45,.19],[-3.15,.28],[-2.8,.36],[-2.55,.405],[-2.4,R]],36),rad);
  M(new THREE.SphereGeometry(.075,16,12),sap,-3.69);M(new THREE.TorusGeometry(.07,.012,6,18),dark,-3.67);
  // 胴体：前部・放射部の間・後部（継ぎ目は細い溝の輪）
  const bands=[-1.45,-.55,.35],BL=.62,RC=.392;
  const segs=[[-2.4,bands[0]-BL/2],[bands[0]+BL/2,bands[1]-BL/2],[bands[1]+BL/2,bands[2]-BL/2],[bands[2]+BL/2,2.3]];
  for(const[z0,z1]of segs)cyl(R,R,z0,z1,white,true);
  for(const z of[-2.4,-1.95,1.95,2.3])M(new THREE.TorusGeometry(R,.007,6,40),dark,z);   // 後部の継ぎ目は危険表示の帯より後ろ（機番の刷り込みを横切らない）
  // 放射部：へこんだ帯（段の面も閉じる）、縁の金属環、放射素子の列
  for(const zc of bands){const z0=zc-BL/2,z1=zc+BL/2;cyl(RC,RC,z0,z1,dark,true);
    for(const[z,f]of[[z0,1],[z1,-1]]){const rg=M(new THREE.RingGeometry(RC,R,36),dark,z);rg.rotation.y=f>0?0:Math.PI;}
    for(const z of[z0+.012,z1-.012])M(new THREE.TorusGeometry(R-.004,.014,6,40),gun,z);
    for(let k=0;k<18;k++){const a=k/18*Math.PI*2,e=new THREE.Mesh(new THREE.BoxGeometry(.045,.014,BL-.2),cy);e.position.set(Math.cos(a)*(RC+.008),Math.sin(a)*(RC+.008),zc);e.rotation.z=a+Math.PI/2;g.add(e);}}
  // 危険表示の帯と、機番の刷り込み（左右）
  cyl(R+.006,R+.006,1.48,1.62,amber,true);for(const z of[1.48,1.62]){const rg=M(new THREE.RingGeometry(R-.002,R+.006,36),amber,z);rg.rotation.y=z<1.5?Math.PI:0;}
  // 機番の刷り込み：後部胴体の左右に、胴の長さ方向に読めるように（絵柄を 90° 回す）
  for(const s of[1,-1]){const t=diffuserTex().clone();t.needsUpdate=true;t.center.set(.5,.5);t.rotation=s>0?-Math.PI/2:Math.PI/2;
    const dm=std({map:t,transparent:true,alphaTest:.4,metalness:.2,roughness:.5,polygonOffset:true,polygonOffsetFactor:-2});
    const arc=DF_L*DF_H/DF_W/(R+.005);const d=new THREE.Mesh(new THREE.CylinderGeometry(R+.005,R+.005,DF_L,20,1,true,(s>0?Math.PI/2:Math.PI*1.5)-arc/2,arc),dm);d.rotation.x=Math.PI/2;d.position.z=1.07;g.add(d);}   // 放射部の端 0.66 と危険表示の帯 1.48 の間
  // 懸架の金具（上面、懸架環の位置）
  for(const z of[-1.3,1.4]){const lg=M(new THREE.BoxGeometry(.1,.07,.16),gun,z);lg.position.y=R+.025;}
  // 絞り胴（ガンメタル）とノズル：外のベル、奥の喉、燃焼の光
  M(latheZ([[2.3,R],[2.6,.412],[2.95,.375],[3.25,.325],[3.42,.3]],36),gun);
  cyl(.3,.3,3.42,3.45,gun,true);M(new THREE.RingGeometry(.22,.3,36),gun,3.45);   // 端の板はノズルのベルまで届かせる（ベルが浮いていた）
  M(latheZ([[3.3,.2],[3.5,.235],[3.78,.27]],28),hot);
  M(new THREE.TorusGeometry(.27,.014,6,32),gun,3.78);
  {M(new THREE.CircleGeometry(.2,24),dark,3.305);M(new THREE.CircleGeometry(.11,20),new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,.6,.2)}),3.325);}   // 喉と燃焼の光（後ろから見える向き。少し離して重ねない）
  // 小翼：前の 4 枚（小さな台形）と後ろの安定翼 4 枚（切り落とし三角）。どちらも根元を胴に少し埋める
  const fin=(pts,th)=>{const sh=new THREE.Shape();sh.moveTo(pts[0][0],pts[0][1]);for(const q of pts.slice(1))sh.lineTo(q[0],q[1]);sh.closePath();const fg=new THREE.ExtrudeGeometry(sh,{depth:th,bevelEnabled:false});fg.translate(0,0,-th/2);fg.rotateY(-Math.PI/2);return fg;};
  const cg=fin([[0,0],[.44,0],[.36,.24],[.16,.24]],.024),tg=fin([[0,0],[1.22,0],[1.22,.3],[.92,.66],[.6,.66]],.032);
  for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;
    const f1=new THREE.Group();f1.rotation.z=a;const m1=new THREE.Mesh(cg,white);m1.position.set(0,R-.03,-2.42);f1.add(m1);g.add(f1);
    const f2=new THREE.Group();f2.rotation.z=a;const m2=new THREE.Mesh(tg,white);m2.position.set(0,.31,2.12);f2.add(m2);
    const rf=new THREE.Mesh(new THREE.BoxGeometry(.06,.05,1.1),gun);rf.position.set(0,.37,2.62);rf.rotation.x=-.05;f2.add(rf);g.add(f2);}   // 安定翼の根元の覆い
  const fl=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(1.6,3.2,5),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
  fl.position.z=4.1;fl.scale.set(2.6,2.6,1);fl.visible=false;g.add(fl);g.userData.flame=fl;
  g.traverse(o=>{if(o.isMesh&&o.material.isMeshStandardMaterial)o.castShadow=true;});
  mergeStatic(g);   // 部品が多い（放射素子だけで 54 個）ので材質ごとに 1 つへまとめる（機体・格納庫・カットで何本も出る）
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
  const gap=new THREE.Mesh(new THREE.BoxGeometry(len*.985,tk+.012,.05),new THREE.MeshBasicMaterial({color:0x050607}));h.add(gap);
  g.add(h);return m;
}
// 表面に付く小物（ピトー管・排気口・電球など）を、いちばん近い機体の面へ寄せる（数 cm 浮いていた）
function snapParts(g){g.updateMatrixWorld(true);const items=[],others=[];g.traverse(o=>{if(!o.isMesh||!o.visible)return;if(o.userData.snap)items.push(o);else{const m=Array.isArray(o.material)?o.material[0]:o.material;if(m.transparent||m.blending===THREE.AdditiveBlending)return;others.push(o);}});
  const tri=new THREE.Triangle(),a=new V3(),b=new V3(),c=new V3(),cp=new V3(),best=new V3(),v=new V3(),bb=new THREE.Box3();
  for(const it of items){bb.setFromObject(it);const C=bb.getCenter(new V3()),R=bb.getSize(new V3()).length()+.6;let bd=1e9;
    for(const o of others){const ob=new THREE.Box3().setFromObject(o);if(ob.distanceToPoint(C)>R)continue;const pa=o.geometry.attributes.position,ix=o.geometry.index,n=ix?ix.count:pa.count;
      for(let i=0;i<n;i+=3){const g0=ix?ix.getX(i):i,g1=ix?ix.getX(i+1):i+1,g2=ix?ix.getX(i+2):i+2;tri.set(a.fromBufferAttribute(pa,g0).applyMatrix4(o.matrixWorld),b.fromBufferAttribute(pa,g1).applyMatrix4(o.matrixWorld),c.fromBufferAttribute(pa,g2).applyMatrix4(o.matrixWorld));tri.closestPointToPoint(C,cp);const d=cp.distanceToSquared(C);if(d<bd){bd=d;best.copy(cp);}}}
    if(bd>=1e9)continue;
    // 部品の頂点のうち、その面にいちばん近いものを面へ。少しだけ埋める
    const pa=it.geometry.attributes.position;let vd=1e9;const vb=new V3();for(let i=0;i<pa.count;i++){v.fromBufferAttribute(pa,i).applyMatrix4(it.matrixWorld);const d=v.distanceToSquared(best);if(d<vd){vd=d;vb.copy(v);}}
    const dir=best.clone().sub(C).normalize(),sh=best.clone().sub(vb).addScaledVector(dir,.006);
    const inv=new THREE.Matrix4().copy(it.parent.matrixWorld).invert(),p0=it.getWorldPosition(new V3()).add(sh).applyMatrix4(inv);it.position.copy(p0);it.updateMatrixWorld(true);}}
// 操縦席の動かない部品（操縦士の体・座席・計器）を材質ごとにまとめる。首と操縦桿（dyn）は動くので残す
function ckMerge(ck){ck.updateMatrixWorld(true);mergeStatic(ck);}
function detailAircraft(g,accentHex,label){
  const ud=g.userData;
  const dark=std({color:lin(0x14181c),metalness:.7,roughness:.45}),metal=std({color:lin(0x80858a),metalness:.95,roughness:.26}),
    hot=std({color:lin(0x54463a),metalness:.92,roughness:.36,side:THREE.DoubleSide}),ctrl=panelize(std({color:lin(ud.bodyHex||0x98a1a9).multiplyScalar(.86),metalness:.62,roughness:.44}),ud.wx);
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  // 機首の観測ブームと風向ベーン（台風観測機の定番装備）
  const boom=add(new THREE.CylinderGeometry(.04,.085,5.4,8),metal,0,0,-16.5);boom.rotation.x=Math.PI/2;
  add(new THREE.BoxGeometry(.7,.02,.14),dark,0,0,-18.0);add(new THREE.BoxGeometry(.02,.7,.14),dark,0,0,-18.4);
  const tip=add(new THREE.CylinderGeometry(.06,.06,.5,8),std({color:lin(0xb3261c),roughness:.5,metalness:.2}),0,0,-18.98);tip.rotation.x=Math.PI/2;
  const OR=ud.shape.orig;
  if(!OR)for(const s of[1,-1]){const pt=add(new THREE.CylinderGeometry(.022,.022,1,6),metal,s*.98,.3,-10.9);pt.rotation.x=Math.PI/2;pt.rotation.z=s*.12;pt.userData.snap=1;}
  // ブレードアンテナと排気口
  const bl=new THREE.BoxGeometry(.05,.5,.55);if(!OR){add(bl,dark,0,1.98,-1.9);add(bl,dark,0,1.9,3.6);add(bl,dark,0,-1.72,5.2);add(bl,dark,.5,-1.6,-6.5);}else{add(bl,dark,0,2.44,-6.6);add(bl,dark,0,.84,6.5);}
  const STD=!OR&&!(ud.shape.fus>1);
  if(STD)for(const s of[1,-1]){const v=add(new THREE.BoxGeometry(.04,.3,.9),dark,s*1.94,.55,-3.6);v.rotation.z=-s*.12;v.userData.snap=1;}
  // 操縦席：風防を半透明にして中を作る
  if(ud.canopy){const cm=ud.canopy.material=ud.canopy.material.clone();ENVMATS.push(cm);cm.transparent=true;cm.opacity=.46;cm.depthWrite=false;cm.envMapIntensity=1.8;cm.color=lin(0x1a2a36);}
  const ckDark=std({color:lin(0x2a2f34),roughness:.75,metalness:.2}),lamp=c=>new THREE.MeshBasicMaterial({color:c}),ckMetal=std({color:lin(0x3a4148),roughness:.45,metalness:.8});
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
    for(const s of[1,-1]){
      C(new THREE.BoxGeometry(.28,.2,2.2),ckDark,s*.5,.16,-.05);consoleTop(ck,.24,2.1,s*.5,.262,-.05);
      for(let k=0;k<2;k++){const kn=C(new THREE.CylinderGeometry(.03,.035,.04,10),ckMetal,s*.5,.28,-.7+k*1.2);}
    }
    // スロットル（左の操作盤の上、2 本）
    for(const dx of[-.035,.035]){C(new THREE.BoxGeometry(.03,.14,.03),ckMetal,-.42+dx,.33,-.1);const tg=C(latheZ([[-.055,.018],[-.03,.03],[.03,.03],[.055,.02]],12),dark,-.42+dx,.415,-.1);tg.rotation.x=.15;}   // スロットルの握り（丸みのある形）
    const cw=new THREE.Group();cw.scale.setScalar(.9);cw.position.set(0,.01,.04);ck.add(cw);
    const cr=crewSeat(cw,0,0,0x6a6e58);ud.heads.push(cr.head);ud.sticks.push(cr.stick);
    // 座席の後ろ：電子機器の棚と、風防を押し上げる支柱
    C(new THREE.BoxGeometry(.62,.26,.8),ckDark,0,.2,1.45);consoleTop(ck,.5,.6,0,.332,1.45);
    {const a=new V3(0,.33,1.15),b=new V3(0,.62,1.0),d=new V3().subVectors(b,a),o=C(new THREE.CylinderGeometry(.025,.03,d.length(),8),ckMetal,0,0,0);o.position.copy(a).addScaledVector(d,.5);o.quaternion.setFromUnitVectors(new V3(0,1,0),d.normalize());}
    // 風防の枠：弓形 3 本（風防と同じ傾き・同じ絞り）と、後ろ 2 本をつなぐ背骨
    const cs=ud.canopy.scale.x,cy=ud.canopy.scale.y;
    for(const zl of[-1.8,.9,2.2]){const r=1.2*Math.sqrt(1-(zl/3.48)**2),b=new THREE.Mesh(new THREE.TorusGeometry(r,zl<0?.06:.045,6,26,Math.PI),dark);b.position.z=zl;b.scale.set(cs*(zl<0?1-.5*(zl/3.48)**2:1),cy,1);ud.canopyG.add(b);}
    {const pts=[];for(let k=0;k<=8;k++){const zl=.9+k/8*1.3;pts.push(new V3(0,1.2*cy*Math.sqrt(1-(zl/3.48)**2),zl));}ud.canopyG.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,.03,6),dark));}
    ckMerge(ck);
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
    for(const s of[1,-1]){C(new THREE.BoxGeometry(.56,.16,.62),ckDark,s*.56,-.12,.4);const cr=crewSeat(ck,s*.56,0,s>0?0x6a6e58:0x6e6a58);ud.heads.push(cr.head);ud.sticks.push(cr.stick);
      C(new THREE.BoxGeometry(.2,.3,1.3),ckDark,s*1.02,.0,.1);consoleTop(ck,.17,1.2,s*1.02,.152,.1);}
    instrPanel(ck,1.5,.22,-.95);
    C(new THREE.BoxGeometry(.3,.34,1.1),ckDark,0,.0,-.3);consoleTop(ck,.26,1.0,0,.172,-.3);
    for(const dx of[-.05,.05]){C(new THREE.BoxGeometry(.03,.14,.03),ckMetal,dx,.24,-.35);C(new THREE.BoxGeometry(.05,.05,.09),dark,dx,.32,-.35);}
    // 頭上の操作盤（隔壁から伸びる梁に吊る）
    C(new THREE.BoxGeometry(.1,.07,1.75),ckMetal,0,1.02,.33);C(new THREE.BoxGeometry(.7,.06,.6),ckDark,0,.97,-.1);
    {const o=consoleTop(ck,.6,.5,0,.938,-.1);o.rotation.x=Math.PI/2;}
    ckMerge(ck);
  }
  // エンジン：ファン、可変ノズル
  ud.noz=[];
  for(const s of[1,-1]){
    const sp=add(new THREE.ConeGeometry(.27,.7,14),metal,s*2.55,1.25,2.6);sp.rotation.x=-Math.PI/2;
    const fan=add(new THREE.CircleGeometry(.9,26),new THREE.MeshBasicMaterial({map:fanTex(),color:0x9aa0a6}),s*2.55,1.25,2.88);fan.rotation.y=Math.PI;fan.castShadow=false;(ud.fans=ud.fans||[]).push(fan);
    const ng=new THREE.Group();ng.position.set(s*2.55,1.25,10.1);g.add(ng);
    for(let k=0;k<16;k++){const a=k/16*Math.PI*2,p=new THREE.Mesh(new THREE.BoxGeometry(.29,.035,1.15),hot);p.position.set(Math.cos(a)*.74,Math.sin(a)*.74,.5);p.rotation.z=a+Math.PI/2;p.rotation.order='ZXY';p.rotation.x=-.1;ng.add(p);}
    const ab=new THREE.Mesh(new THREE.TorusGeometry(.5,.05,6,24),new THREE.MeshBasicMaterial({color:new THREE.Color(2.4,.9,.25)}));ab.position.z=.2;ng.add(ab);
    for(let k=0;k<4;k++){const a=k/4*Math.PI*2+.4,st=new THREE.Mesh(new THREE.BoxGeometry(.3,.035,.035),dark);st.position.set(Math.cos(a)*.66,Math.sin(a)*.66,.2);st.rotation.z=a;ng.add(st);}   // 保炎環の支え（ノズルの内壁へ）
    ud.noz.push(ng);
    // 排気炎（始動時の炎と、ブースト時のショックダイヤモンド）
    {if(!ud.plumeMat)ud.plumeMat=new THREE.ShaderMaterial({uniforms:{uPow:{value:0},uAB:{value:0},uIgn:{value:0},uT:U.uTime},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
        vertexShader:'varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.0);vN=normalMatrix*normal;vV=-mv.xyz;gl_Position=projectionMatrix*mv;}',
        fragmentShader:'uniform float uPow,uAB,uIgn,uT;varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){float y=vUv.y;float f=abs(dot(normalize(vN),normalize(vV)));float core=pow(f,1.4);float dia=0.5+0.5*pow(abs(sin(y*16.0)),2.0);float fl=0.82+0.18*sin(uT*71.0+y*26.0)*sin(uT*43.0);vec3 ab=mix(vec3(0.45,0.7,2.2),vec3(2.6,1.0,0.25),smoothstep(0.0,0.75,y))*2.4*dia;vec3 dry=vec3(1.3,0.5,0.16)*0.22;vec3 ig=vec3(3.2,1.25,0.25)*(0.6+0.4*sin(uT*37.0+y*9.0));vec3 c=mix(dry,ab,uAB)+ig*uIgn;float a=pow(1.0-y,1.5)*core*fl*(uPow+uIgn);gl_FragColor=vec4(c*a,1.0);}'});
      const pg=new THREE.CylinderGeometry(.2,.62,1,18,10,true);pg.translate(0,.5,0);pg.rotateX(Math.PI/2);const pl=new THREE.Mesh(pg,ud.plumeMat);pl.position.set(s*2.55,1.25,10.5);pl.frustumCulled=false;g.add(pl);(ud.plumes=ud.plumes||[]).push(pl);}
    // 補助吸気口と編隊灯
    add(new THREE.BoxGeometry(.03,.09,1.3),new THREE.MeshBasicMaterial({color:new THREE.Color(.10,.34,.09)}),s*3.62,1.25,5.9).castShadow=false;
    if(STD&&(q=>-1.5<q.le-.2||-2.9>q.le+q.c)(ud.wingAt(2))){const fm=add(new THREE.BoxGeometry(.03,.08,1.2),new THREE.MeshBasicMaterial({color:new THREE.Color(.10,.34,.09)}),s*1.96,.2,-2.2);fm.castShadow=false;fm.userData.snap=1;}
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
    {const tp=ud.tipPos,bl=add(new THREE.SphereGeometry(.07,10,8),new THREE.MeshBasicMaterial({color:s>0?new THREE.Color(.12,.95,.25):new THREE.Color(1.0,.1,.07)}),s*tp.x,tp.y,tp.z);bl.userData.snap=1;CUTDIM.push([bl.material,bl.material.color.clone()]);bl.castShadow=false;}
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
    {const bar=(y0,z0,y1,z1,w)=>{const L=Math.hypot(y1-y0,z1-z0),m=new THREE.Mesh(new THREE.BoxGeometry(w||.12,L,.045),hub);m.position.set(x,(y0+y1)/2,z+(z0+z1)/2);m.rotation.x=Math.atan2(z1-z0,y1-y0);g.add(m);};
      const yt=Math.min(top-.05,-2.12);bar(yt,-.12,-2.62,-.4);bar(-2.62,-.4,-3.0,-.1,.105);   // 下の腕は少し細く（上の腕と側面が同じ面になっていた）
      const pin=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.2,8),chrome);pin.rotation.z=Math.PI/2;pin.position.set(x,-2.62,z-.4);g.add(pin);
      const col=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.1,12),hub);col.position.set(x,Math.min(top-.02,-2.31),z);   /* 脚柱の端と環の端を同じ高さにしない */g.add(col);}
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
    const dh=(top+2.35)*.62;for(const ds of x===0?[-1,1]:[Math.sign(x)]){const d=new THREE.Mesh(new THREE.BoxGeometry(.04,dh,1.6),door);d.position.set(x+ds*(x===0?.5:.55),top-dh/2-.05,z);d.rotation.z=ds*(x===0?.22:.26);g.add(d);}   /* 前脚の扉は左右 2 枚 */
  };
  const gp=sh&&sh.gear||[2.5,.02],gz=gp[2]!==undefined?gp[2]:2.3;   // [横の位置, 脚柱の付け根の高さ, 前後の位置]
  /* 原型機は胴体が太いので前脚の付け根を胴体の下面のすぐ内側に（扉が胴体の中に埋もれていた） */
  leg(0,-7.6,true,sh&&sh.orig?-1.9:-1.0);leg(-gp[0],gz,false,gp[1]);leg(gp[0],gz,false,gp[1]);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  return g;
}

// ───────────────────────── 船とイルカ ─────────────────────────
// 船体：船首から船尾へ断面を並べた外板。y=0 が喫水線、z の負の側が船首。
// 断面は 平らな船底 → 湾曲部 → 垂直な舷側 → 喫水線より上は甲板の幅までフレア。船首は上ほど前へ（レーキ）、船尾は上ほど後ろへ張り出す。
// uv は u＝長さ（船首 0）、v＝高さ（-T〜Dm を 0〜1）。右舷は u を反転して、船名が裏返らないようにする
function hullGeo(o){
  const{L,B,D,T}=o,half=B/2,rake=o.rake,sF=o.sheerF||0,sA=o.sheerA||0,trans=o.trans,entry=o.entry,run=o.run,flat=o.flat,NU=64,Dm=D+Math.max(sF,sA);
  const stn=[];for(let i=0;i<=NU;i++){const t=i/NU;stn.push(t<.5?.5*Math.pow(2*t,1.6):1-.5*Math.pow(2*(1-t),1.6));}
  const S=stn.map(u=>{
    const dW=u<entry?half*Math.pow(Math.sin(Math.PI/2*u/entry),.7):u>1-run?half*lerp(1,trans,Math.pow((u-1+run)/run,2.4)):half;
    const e2=entry*1.3,r2=run*1.25,wW=u<e2?half*Math.pow(Math.sin(Math.PI/2*u/e2),1.3):u>1-r2?half*lerp(1,trans*.9,Math.pow((u-1+r2)/r2,2.2)):half;
    const dk=D+sF*Math.pow(Math.max(0,1-u/.28),2)+sA*Math.pow(Math.max(0,(u-.8)/.2),2);
    const keel=-T*Math.min(1,.3+u/.05)*(u>.86?lerp(1,.15,Math.pow((u-.86)/.14,1.3)):1);
    const fW=wW*flat*Math.min(1,u/(entry*1.5),(1-u)/(run*1.4)),rx=Math.max(.01,wW-fW),ry=Math.min(-keel*.7,rx*1.1+.2);
    const pts=[[0,keel],[fW,keel]];for(let k=1;k<=4;k++){const a=k/4*Math.PI/2;pts.push([fW+rx*Math.sin(a),keel+ry*(1-Math.cos(a))]);}
    if(keel+ry<-.05)pts.push([wW,0]);for(let k=1;k<=4;k++){const q=k/4,y=dk*q;pts.push([wW+(dW-wW)*Math.pow(q,1.4),y]);}
    while(pts.length<12)pts.splice(pts.length-4,0,[wW,(keel+ry)*.5]);   // 断面ごとの点の数をそろえる
    pts.sort((a,b)=>a[1]-b[1]);pts[0][0]=0;
    return{u,pts,dk,dW,keel,wW};});
  const zOf=(u,y,s)=>{const h=(y-s.keel)/(s.dk-s.keel+1e-6);let z=-L/2+u*L;if(u<.14)z-=rake*h*Math.pow(1-u/.14,1.5);if(u>.88)z+=(o.sRake||0)*h*Math.pow((u-.88)/.12,1.5);return z;};
  // 絵柄の横方向：断面の番号ではなく、外板に沿って船体中央から測った長さ（船首の傾きや幅の絞りで文字が斜めに引きずられたり縮んだりしない）
  const n0=S[0].pts.length,im=S.findIndex(s=>s.u>=.5),AU=S.map(()=>new Float32Array(n0));
  for(let j=0;j<n0;j++){const pz=(i)=>zOf(S[i].u,S[i].pts[j][1],S[i]),d=(a,b)=>Math.hypot(S[a].pts[j][0]-S[b].pts[j][0],pz(a)-pz(b))*Math.sign(pz(a)-pz(b)||1);
    AU[im][j]=.5+(pz(im))/L;for(let i=im+1;i<S.length;i++)AU[i][j]=AU[i-1][j]+Math.abs(d(i,i-1))/L;for(let i=im-1;i>=0;i--)AU[i][j]=AU[i+1][j]-Math.abs(d(i+1,i))/L;}
  const mk=(sd)=>{const P=[],UV=[],I=[],n=S[0].pts.length;
    S.forEach((s,i)=>s.pts.forEach(([x,y],j)=>{P.push(sd*x,y,zOf(s.u,y,s));const u=AU[i][j];UV.push(sd>0?1-u:u,(y+T)/(Dm+T));}));
    for(let i=0;i<S.length-1;i++)for(let j=0;j<n-1;j++){const a=i*n+j,b=a+1,c=a+n,d=c+1;if(sd>0)I.push(a,b,c,b,d,c);else I.push(a,c,b,b,c,d);}
    // 船尾の鏡板（トランサム）：甲板の中心を頂点に、断面の輪郭（竜骨の中心→舷縁）へ扇形に張って中心線まで閉じる。
    // 頂点は外板と分けて、絵柄の文字や喫水標が載らない列の uv を使う
    const l=(S.length-1)*n,sl=S[S.length-1],c0=P.length/3;P.push(0,sl.dk,zOf(1,sl.dk,sl));UV.push(.3,(sl.dk+T)/(Dm+T));
    for(let j=0;j<n;j++){P.push(P[(l+j)*3],P[(l+j)*3+1],P[(l+j)*3+2]);UV.push(.3,(P[(l+j)*3+1]+T)/(Dm+T));}
    for(let j=0;j<n-1;j++){if(sd>0)I.push(c0,c0+1+j,c0+2+j);else I.push(c0,c0+2+j,c0+1+j);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));g.setIndex(I);g.computeVertexNormals();return g;};
  // 甲板：左右の舷縁を結ぶ帯
  const DP=[],DU=[],DI=[];S.forEach((s,i)=>{const z=zOf(s.u,s.dk,s);for(let k=0;k<=4;k++){const xx=-s.dW+s.dW*k/2;DP.push(xx,s.dk,z);DU.push(.5+xx/B,s.u*L/8);}if(i<S.length-1){const a=i*5;for(let k=0;k<4;k++)DI.push(a+k,a+5+k,a+k+1,a+k+1,a+5+k,a+6+k);}});
  const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.Float32BufferAttribute(DP,3));dg.setAttribute('uv',new THREE.Float32BufferAttribute(DU,2));dg.setIndex(DI);dg.computeVertexNormals();
  return{port:mk(-1),stbd:mk(1),deck:dg,Dm,S,zOf,deckAt:u=>{const i=Math.min(S.length-1,Math.round(u*NU));return S.reduce((b,s)=>Math.abs(s.u-u)<Math.abs(b.u-u)?s:b,S[0]);}};
}
// 船体沿いの白波の帯：喫水線に沿って外へ広がる。船首と船尾では幅が広い（uv x=0 が船体側、y=船首からの距離）
function hullFoamGeo(h,B,L){const P=[],U=[],I=[];let n=0;
  for(const sd of[-1,1]){const base=n;h.S.forEach(s=>{const u=s.u,w=B*(.32+.7*Math.pow(Math.max(0,1-u/.2),1.4)+.35*Math.pow(Math.max(0,(u-.78)/.22),1.4)),z=h.zOf(u,0,s),xi=Math.max(s.wW,.05);
      P.push(sd*xi,.7,z,sd*(xi+w),.7,z+w*.25*(u<.2?1-u/.2:0));U.push(0,u,1,u);n+=2;});
    for(let i=0;i<h.S.length-1;i++){const a=base+i*2;I.push(a,a+1,a+2,a+1,a+3,a+2);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(I);return g;}
// 外板の絵柄：船底塗装・喫水線の帯・外板の継ぎ目・錆の筋・喫水標・船名・帯（巡視船）
function hullTex(o){
  const W=2048,H=512,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),r=mulberry(o.seed||7);
  const{L,T,Dm}=o,Y=y=>H*(1-(y+T)/(Dm+T)),X=u=>u*W,B=u=>o.side==='S'?1-u:u,ppmX=W/L,ppmY=H/(Dm+T),sx=ppmX/ppmY;
  const g=x.createLinearGradient(0,Y(Dm),0,Y(0));g.addColorStop(0,o.hullTop||o.hull);g.addColorStop(1,o.hull);x.fillStyle=g;x.fillRect(0,0,W,H);
  // 外板の継ぎ目（横の条板と縦の突合せ）とへこみ
  x.strokeStyle='rgba(0,0,0,.16)';x.lineWidth=1;for(let y=1.6;y<Dm;y+=o.strake||2.4){x.beginPath();x.moveTo(0,Y(y));x.lineTo(W,Y(y));x.stroke();}
  x.strokeStyle='rgba(0,0,0,.08)';for(let z=0;z<L;z+=o.butt||9){x.beginPath();x.moveTo(X(z/L),Y(Dm));x.lineTo(X(z/L),Y(-T));x.stroke();}
  for(let i=0;i<260;i++){const px=r()*W,py=Y(r()*Dm),rr=4+r()*30;const gg=x.createRadialGradient(px,py,0,px,py,rr);const d=r()<.5;gg.addColorStop(0,d?'rgba(0,0,0,.07)':'rgba(255,255,255,.05)');gg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gg;x.fillRect(px-rr,py-rr,rr*2,rr*2);}
  // 帯（巡視船の斜めの帯など）
  if(o.stripes)for(const[w,colr,off]of o.stripes){x.fillStyle=colr;{const flip=o.side==='S'?1:0,u0=B(off);x.save();x.translate(X(u0),0);x.scale(flip?-1:1,1);x.beginPath();x.moveTo(0,Y(Dm));x.lineTo(w*ppmX,Y(Dm));x.lineTo(w*ppmX+Dm*ppmY*.55,Y(.4));x.lineTo(Dm*ppmY*.55,Y(.4));x.fill();x.restore();}}
  if(o.sheerLine){x.fillStyle=o.sheerLine;x.fillRect(0,Y(Dm)-2,W,o.sheerW||4);}
  // 錆の筋：舷縁の排水口や錨の穴から下へ
  const streak=(px,py,len,a,w)=>{const gg=x.createLinearGradient(0,py,0,py+len);gg.addColorStop(0,'rgba(120,58,22,'+a+')');gg.addColorStop(.5,'rgba(110,52,20,'+a*.5+')');gg.addColorStop(1,'rgba(110,52,20,0)');x.fillStyle=gg;x.fillRect(px-w/2,py,w,len);};
  const rust=o.rust||0;for(let i=0;i<120*rust;i++){const u=r(),py=Y(o.deckY?o.deckY(u):Dm*.9)+r()*6;streak(X(u),py,20+r()*90,.08+r()*.3*rust,1.5+r()*3.5);}
  // 錨鎖孔（ホースパイプ）と錆
  if(o.hawse)for(const u of[B(o.hawse)]){const px=X(u),py=Y(o.hawseY);x.fillStyle='#16110e';x.beginPath();x.ellipse(px,py,o.hawseR*ppmX,o.hawseR*ppmY*.8,0,0,7);x.fill();streak(px,py,90,.55*rust+.15,o.hawseR*ppmX*1.6);}
  // 喫水線の帯と船底塗装
  x.fillStyle=o.boot||'#151617';x.fillRect(0,Y(o.bootTop||.8),W,Y(-.4)-Y(o.bootTop||.8));
  x.fillStyle=o.bottom||'#6b2a1f';x.fillRect(0,Y(-.4),W,H-Y(-.4));
  for(let i=0;i<80;i++){x.fillStyle='rgba(30,28,20,'+(.05+r()*.1)+')';x.fillRect(r()*W,Y(o.bootTop||.8)+r()*6,20+r()*120,2+r()*4);}   // 喫水線の汚れ
  // 喫水標（白い数字と目盛）
  if(o.draft){x.fillStyle='rgba(235,235,228,.9)';x.font='bold '+Math.max(9,Math.round(Math.min(.9,o.D*.12)*ppmY))+'px Arial';for(const u of[.015,.985,.5]){for(let m=Math.ceil(-T+1);m<Math.min(4,o.D-1);m++){const py=Y(m);x.save();x.translate(X(u),py);x.scale(sx>1?1:1,1);x.fillText(Math.round(m+T)+'M',-.4*ppmX,0);x.restore();}}}
  // 船名（両端に書く。どちらの舷から見ても船首側と船尾側に名前が読める）
  const name=(t,u,y,hgt,colr,font)=>{x.save();x.fillStyle=colr;x.font=(font||'bold')+' '+Math.round(hgt*ppmY)+'px '+(o.face||'Arial');x.textBaseline='alphabetic';const w=x.measureText(t).width*sx;x.translate(X(u)-w/2,Y(y));x.scale(sx,1);x.fillText(t,0,0);x.restore();};
  if(o.name)name(o.name,B(o.nameU),o.nameY,o.nameH,o.nameCol||'#e8eae6');
  if(o.stern)name(o.stern,B(.93),o.sternY,o.sternH,o.nameCol||'#e8eae6');
  if(o.num)name(o.num,B(o.numU),o.numY,o.numH,o.numCol||'#16181a','900');
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return t;
}
// 甲板の絵柄：横＝船幅 B（uv 0〜1）、縦＝長さ 8m で繰り返す。鋼板の継ぎ目と溶接線、塗装のむらとすり減り、錆、
// 舷側沿いの安全線、通路の塗り分け、固定金具。o:{B,base,walk,line,rust,anti(滑り止めの粒),plate:[横,縦]m}
function deckTex(o){const key='deck_'+o.key;if(SHIPTEX[key])return SHIPTEX[key];const W=512,H=Math.round(512*8/o.B*1.0),c=document.createElement('canvas');c.width=W;c.height=Math.max(128,Math.min(2048,H));
  const x=c.getContext('2d'),r=mulberry(o.key.length*71+3),px=W/o.B,py=c.height/8;x.fillStyle=o.base;x.fillRect(0,0,W,c.height);
  for(let i=0;i<500;i++){const g=r();x.fillStyle=g<.5?'rgba(0,0,0,'+(.03+r()*.07)+')':'rgba(255,255,255,'+(.02+r()*.04)+')';x.beginPath();x.ellipse(r()*W,r()*c.height,8+r()*60,6+r()*40,r()*3,0,7);x.fill();}
  if(o.walk){x.fillStyle=o.walk;x.fillRect(W*.5-1.1*px,0,2.2*px,c.height);}                         // 中央の通路
  if(o.anti)for(let i=0;i<9000;i++){x.fillStyle='rgba(0,0,0,'+(.08+r()*.12)+')';x.fillRect(r()*W,r()*c.height,1.2,1.2);}
  // 鋼板の継ぎ目（横方向の突合せと縦の条板）と溶接の盛り上がり
  const[pw,ph]=o.plate||[2.4,6];x.lineWidth=1.6;for(let y=0;y<8;y+=ph/2){x.strokeStyle='rgba(0,0,0,.35)';x.beginPath();x.moveTo(0,y*py);x.lineTo(W,y*py);x.stroke();x.strokeStyle='rgba(255,255,255,.1)';x.beginPath();x.moveTo(0,y*py+1.5);x.lineTo(W,y*py+1.5);x.stroke();}
  for(let xm=pw;xm<o.B;xm+=pw){x.strokeStyle='rgba(0,0,0,.3)';x.beginPath();x.moveTo(xm*px,0);x.lineTo(xm*px,c.height);x.stroke();}
  // 錆：継ぎ目と金具のまわりに染み、筋
  for(let i=0;i<70*o.rust;i++){const X=r()*W,Y=r()*c.height,rr=3+r()*18,g=x.createRadialGradient(X,Y,0,X,Y,rr);g.addColorStop(0,'rgba(120,58,24,'+(.25+r()*.35)+')');g.addColorStop(1,'rgba(120,58,24,0)');x.fillStyle=g;x.fillRect(X-rr,Y-rr,rr*2,rr*2);}
  // 固定金具（D リング）と排水口
  for(let k=0;k<6;k++){const X=(k%2?.18:.82)*W,Y=(k+.5)/6*c.height;x.fillStyle='rgba(30,30,30,.8)';x.beginPath();x.arc(X,Y,3,0,7);x.fill();x.strokeStyle='rgba(200,200,190,.5)';x.lineWidth=1.5;x.beginPath();x.arc(X,Y-2,4,Math.PI,0);x.stroke();}
  // 舷側沿いの安全線（すり減り）
  if(o.line){x.fillStyle=o.line;for(const X0 of[.35*px,W-.65*px]){x.fillRect(X0,0,.3*px,c.height);}for(let i=0;i<300;i++){x.fillStyle=o.base;x.fillRect((r()<.5?.35:o.B-.65)*px+r()*.3*px,r()*c.height,2+r()*4,1+r()*3);}}
  // 汚れの流れ（排水口から舷へ）と靴跡のすり減り
  for(let i=0;i<40;i++){x.fillStyle='rgba(20,18,14,'+(.05+r()*.08)+')';x.fillRect(r()*W,r()*c.height,1+r()*2,10+r()*60);}
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=THREE.ClampToEdgeWrapping;t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return SHIPTEX[key]=t;}
// 艙口蓋の絵柄（上面 1 枚＝27m×12.6m）：パネルの継ぎ目、補強のリブ、錆、番号
function hatchTex(){if(SHIPTEX.hatch)return SHIPTEX.hatch;const c=document.createElement('canvas');c.width=1024;c.height=480;const x=c.getContext('2d'),r=mulberry(919);
  x.fillStyle='#5b3427';x.fillRect(0,0,1024,480);for(let i=0;i<300;i++){x.fillStyle='rgba(0,0,0,'+(.03+r()*.07)+')';x.beginPath();x.ellipse(r()*1024,r()*480,10+r()*50,6+r()*30,r()*3,0,7);x.fill();}
  for(let k=1;k<3;k++){x.fillStyle='rgba(0,0,0,.45)';x.fillRect(k*1024/3-2,0,4,480);}for(let k=0;k<12;k++){x.fillStyle='rgba(255,255,255,.06)';x.fillRect(0,20+k*38,1024,3);x.fillStyle='rgba(0,0,0,.12)';x.fillRect(0,23+k*38,1024,2);}
  for(let i=0;i<60;i++){const X=r()*1024,Y=r()*480,rr=4+r()*16,g=x.createRadialGradient(X,Y,0,X,Y,rr);g.addColorStop(0,'rgba(140,70,28,.5)');g.addColorStop(1,'rgba(140,70,28,0)');x.fillStyle=g;x.fillRect(X-rr,Y-rr,rr*2,rr*2);}
  x.fillStyle='rgba(230,226,210,.7)';x.font='bold 54px Arial';x.fillText('HC',60,260);x.fillStyle='#d9a21b';x.fillRect(0,0,1024,8);x.fillRect(0,472,1024,8);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return SHIPTEX.hatch=t;}
// 箱の uv をメートル単位にする（繰り返しの絵柄が面の大きさによらず同じ縮尺で貼られる）
function boxM(w,h,d,unit){const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv,dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for(let f=0;f<6;f++)for(let k=0;k<4;k++){const i=f*4+k;uv.setXY(i,uv.getX(i)*dims[f][0]/unit[0],uv.getY(i)*dims[f][1]/unit[1]);}return g;}
// 居住区の壁：1 区画 4m×3m に窓 1 枚。白い外壁の雨だれ・継ぎ目つき
const SHIPTEX={};
function winTex(kind){if(SHIPTEX[kind])return SHIPTEX[kind];if(kind==='white'||kind==='grey')return SHIPTEX[kind]=winTex2(kind);const c=document.createElement('canvas');c.width=256;c.height=192;const x=c.getContext('2d'),r=mulberry(kind.length*31);
  const wall=kind==='bridge'?'#d8dad6':kind==='grey'?'#a9b0b4':'#dcdcd6';x.fillStyle=wall;x.fillRect(0,0,256,192);
  for(let i=0;i<40;i++){const X=r()*256,g=x.createLinearGradient(0,0,0,192);g.addColorStop(0,'rgba(90,70,50,'+(r()*.12)+')');g.addColorStop(1,'rgba(90,70,50,0)');x.fillStyle=g;x.fillRect(X,r()*40,1+r()*3,150);}
  x.fillStyle='rgba(0,0,0,.18)';x.fillRect(0,186,256,6);x.fillStyle='rgba(255,255,255,.25)';x.fillRect(0,180,256,3);
  const glass=(X,Y,w,h)=>{const g=x.createLinearGradient(X,Y,X+w*.4,Y+h);g.addColorStop(0,'#3c4f5c');g.addColorStop(.45,'#18232b');g.addColorStop(1,'#0b1116');x.fillStyle='#5d6266';x.fillRect(X-3,Y-3,w+6,h+6);x.fillStyle=g;x.fillRect(X,Y,w,h);x.fillStyle='rgba(255,255,255,.08)';x.fillRect(X,Y,w,h*.18);};
  if(kind==='bridge'){for(let i=0;i<4;i++)glass(6+i*63,30,56,110);x.fillStyle='rgba(60,64,66,.9)';x.fillRect(0,24,256,6);x.fillRect(0,140,256,8);}else glass(70,40,116,92);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return SHIPTEX[kind]=t;}
// 16m×6m（1 区画 4m、1 層 3m）。emissive 用に明かりの付いた窓だけを描いた絵柄も作る
function winTex2(kind){const W=1024,H=384,ppm=64,c=document.createElement('canvas'),e=document.createElement('canvas');c.width=e.width=W;c.height=e.height=H;const x=c.getContext('2d'),y=e.getContext('2d'),r=mulberry(kind.length*97+5);
  x.fillStyle=kind==='grey'?'#a7aeb2':'#d9d9d3';x.fillRect(0,0,W,H);y.fillStyle='#000';y.fillRect(0,0,W,H);
  for(let i=0;i<90;i++){const X=r()*W,g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'rgba(80,66,50,'+(r()*.1)+')');g.addColorStop(1,'rgba(80,66,50,0)');x.fillStyle=g;x.fillRect(X,r()*H*.5,1+r()*2.5,H*.6);}
  for(const dy of[0,192]){x.fillStyle='rgba(0,0,0,.2)';x.fillRect(0,dy+186,W,6);x.fillStyle='rgba(255,255,255,.3)';x.fillRect(0,dy+181,W,3);}
  const rr=(X,Y,w,h,q)=>{x.beginPath();x.moveTo(X+q,Y);x.lineTo(X+w-q,Y);x.quadraticCurveTo(X+w,Y,X+w,Y+q);x.lineTo(X+w,Y+h-q);x.quadraticCurveTo(X+w,Y+h,X+w-q,Y+h);x.lineTo(X+q,Y+h);x.quadraticCurveTo(X,Y+h,X,Y+h-q);x.lineTo(X,Y+q);x.quadraticCurveTo(X,Y,X+q,Y);x.closePath();};
  for(let dk=0;dk<2;dk++)for(let b=0;b<4;b++){const X0=b*256,Y0=dk*192,q=r();
    if(q<.1)continue;                                                 // 窓のない区画
    if(dk===1&&q<.17){x.fillStyle='#8d9396';x.fillRect(X0+90,Y0+60,58,128);x.fillStyle='rgba(0,0,0,.35)';x.fillRect(X0+90,Y0+60,58,4);continue;}  // 扉
    const w=96,h=72,X=X0+80+r()*20,Y=Y0+46;
    x.fillStyle='#6d7276';rr(X-5,Y-5,w+10,h+10,12);x.fill();
    const a=r()*.6,g=x.createLinearGradient(X,Y,X+w*a,Y+h);g.addColorStop(0,'#8ea3b2');g.addColorStop(.35+r()*.2,'#33454f');g.addColorStop(1,'#10171c');x.fillStyle=g;rr(X,Y,w,h,9);x.fill();
    const lit=r()<.22;if(r()<.3){x.fillStyle=lit?'rgba(236,214,170,.85)':'rgba(196,182,150,.8)';const half=r()<.5;x.fillRect(half?X+4:X+w*.45,Y+4,w*.5,h-8);}
    if(lit){y.fillStyle='rgba(255,214,150,1)';rr(X+2,Y+2,w-4,h-4,8);y.fill();}
    x.fillStyle='rgba(255,255,255,.12)';x.fillRect(X+6,Y+5,w*.35,4);
    const sg=x.createLinearGradient(0,Y+h+5,0,Y+h+70);sg.addColorStop(0,'rgba(110,60,30,.22)');sg.addColorStop(1,'rgba(110,60,30,0)');x.fillStyle=sg;x.fillRect(X+4,Y+h+5,2,65);x.fillRect(X+w-6,Y+h+5,2,55);}
  const T=cv=>{const t=new THREE.CanvasTexture(cv);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return t;};const t=T(c);t.userData={em:T(e)};return t;}
// コンテナ：波板・扉・隅金具・汚れの白っぽい絵柄（色はインスタンスごとに掛ける）。港と船で共用
function containerMat(){if(SHIPTEX.cont)return SHIPTEX.cont;const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d'),r=mulberry(404);
  x.fillStyle='#e6e6e2';x.fillRect(0,0,512,128);
  for(let i=0;i<128;i++){x.fillStyle=i%2?'rgba(0,0,0,.20)':'rgba(255,255,255,.10)';x.fillRect(i*4,6,2,116);}
  x.fillStyle='rgba(0,0,0,.42)';x.fillRect(0,0,512,7);x.fillRect(0,121,512,7);x.fillRect(0,0,8,128);x.fillRect(504,0,8,128);
  x.fillStyle='rgba(0,0,0,.55)';for(const[X,Y]of[[0,0],[496,0],[0,114],[496,114]])x.fillRect(X,Y,16,14);
  for(let i=0;i<60;i++){x.fillStyle='rgba(110,56,24,'+(.05+r()*.18)+')';x.beginPath();x.ellipse(r()*512,r()*128,2+r()*10,1+r()*5,0,0,7);x.fill();}
  const g=x.createLinearGradient(0,60,0,128);g.addColorStop(0,'rgba(40,30,20,0)');g.addColorStop(1,'rgba(40,30,20,.35)');x.fillStyle=g;x.fillRect(0,0,512,128);
  x.fillStyle='rgba(255,255,255,.5)';x.fillRect(370,16,90,14);x.fillRect(370,36,60,8);   // 番号の札
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;
  const m=new THREE.MeshStandardMaterial({map:t,roughness:.72,metalness:.3});ENVMATS.push(m);return SHIPTEX.cont=m;}
// 落ち着いた実際の色に近いコンテナの色
const CONT_PAL=[0x41799e,0x1e3a5c,0x8b2e1e,0xb8592a,0x8f9290,0xd2d0c8,0x2f5a40,0xb89530,0x6a2a2a,0x3b5f8a,0x9c9a8e,0x274b6d].map(h=>new THREE.Color(h).convertSRGBToLinear());
// 自由降下式の救命艇：船体は断面を並べた形（船首は細く、船底は V 字）、上は丸い屋根と窓、白いハッチ。+z が船首
function lifeboat(){const g=new THREE.Group(),L=8.6,B=3.1,orange=std({color:lin(0xe2621c),roughness:.5,metalness:.1}),wh=std({color:lin(0xe8e8e2),roughness:.5,metalness:.1}),gl=std({color:lin(0x0e1a24),roughness:.1,metalness:.8});
  const N=14,sec=[];for(let i=0;i<=N;i++){const u=i/N,w=B/2*Math.pow(Math.sin(Math.PI*Math.min(1,u*1.15+.08)),.55)*(u>.85?1-(u-.85)*2.2:1),z=-L/2+u*L,keel=-1.1+.5*u*u,top=1.25-.15*Math.pow(2*u-1,2);
    sec.push([[0,keel,z],[w*.55,keel+.25,z],[w,-.2,z],[w*1.02,.45,z],[w*.92,top*.75,z],[w*.55,top,z],[0,top+.08,z]]);}
  const P=[],I=[],n=7;for(const sd of[-1,1]){const base=P.length/3;sec.forEach(r=>r.forEach(([x,y,z])=>P.push(sd*x,y,z)));for(let i=0;i<N;i++)for(let j=0;j<n-1;j++){const a=base+i*n+j,b=a+1,c=a+n,d=c+1;if(sd>0)I.push(a,c,b,b,c,d);else I.push(a,b,c,b,d,c);}}
  const ge=new THREE.BufferGeometry();ge.setAttribute('position',new THREE.Float32BufferAttribute(P,3));ge.setIndex(I);ge.computeVertexNormals();const hull=new THREE.Mesh(ge,orange);hull.material.side=THREE.DoubleSide;g.add(hull);
  const M2=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);g.add(o);return o;};
  for(const sd of[-1,1]){for(let k=0;k<5;k++)M2(new THREE.BoxGeometry(.05,.32,.55),gl,sd*1.42,.72,-2.6+k*1.15);}   // 窓
  M2(new THREE.BoxGeometry(1.5,.5,1.8),orange,0,1.45,-2.6);M2(new THREE.BoxGeometry(1.1,.12,1.2),wh,0,1.76,-2.6);   // 操縦席の天窓
  M2(new THREE.BoxGeometry(1.2,.1,1.4),wh,0,1.38,1.2);M2(new THREE.BoxGeometry(.12,.12,7.4),wh,0,1.35,-.4);       // ハッチと手すり
  M2(new THREE.BoxGeometry(.06,.5,.5),gl,0,.2,-L/2-.1);                                                            // 船尾の舵
  return g;}
// 船の細部：甲板の縁に沿った手すり（柱と 2 本の手すり棒）、係船柱、救命浮輪、水面下の舵・推進器・ビルジキール、船底の汚れ（喫水線の下の藻と付着物）
const SHIPKIT={};
function shipKit(g,kind){const h=g.userData._h,o=g.userData._o;delete g.userData._h;delete g.userData._o;if(!h)return;const S=h.S,k=Math.max(.35,o.B/30);
  if(!SHIPKIT.m){const C=(c,r,m)=>std({color:lin(c),roughness:r,metalness:m});SHIPKIT.m={rail:C(0xd8d9d4,.45,.5),post:C(0xd0d1cc,.5,.5),bol:C(0x2b2e31,.55,.6),buoy:C(0xe2521a,.55,0),band:C(0xeeeeea,.6,0),prop:C(0xb08440,.28,.95),rud:C(0x6a2b20,.7,.3),keel:C(0x5a2a22,.75,.3)};}
  const Mt=SHIPKIT.m,add=(geo,m,x,y,z)=>{const q=new THREE.Mesh(geo,m);q.position.set(x,y,z);g.add(q);return q;};
  // 甲板の縁の点（左右）：船首から船尾まで、だいたい 1.6m ごと
  const step=Math.max(1,Math.floor(S.length/Math.max(8,o.L/1.6)));const E=[[],[]];for(let i=0;i<S.length;i+=step){const s2=S[i];if(s2.dW<.3)continue;const z=h.zOf(s2.u,s2.dk,s2);E[0].push(new V3(-(s2.dW-.18*k),s2.dk,z));E[1].push(new V3(s2.dW-.18*k,s2.dk,z));}
  const pg=new THREE.CylinderGeometry(.03*k+.015,.035*k+.015,1.1,6);pg.translate(0,.55,0);const nP=E[0].length+E[1].length,posts=new THREE.InstancedMesh(pg,Mt.post,nP),d=new THREE.Object3D();let np=0;
  for(const side of E){if(side.length<2)continue;for(const yy of[.55,1.08]){const c=new THREE.CatmullRomCurve3(side.map(p=>p.clone().add(new V3(0,yy,0))));g.add(new THREE.Mesh(new THREE.TubeGeometry(c,side.length*3,.028*k+.012,5,false),Mt.rail));}
    for(const p of side){d.position.copy(p);d.updateMatrix();posts.setMatrixAt(np++,d.matrix);}}
  posts.count=np;g.add(posts);
  // 係船柱（2 本の太い柱の組）と救命浮輪
  const bg=new THREE.CylinderGeometry(.24*k,.28*k,.6*k+.1,12);for(const u of[.08,.14,.86,.92]){const s2=h.deckAt(u),z=h.zOf(s2.u,s2.dk,s2);for(const sd of[-1,1])for(const dz of[-.45,.45].map(v=>v*k*1.6)){const b=add(bg,Mt.bol,sd*(s2.dW-.9*k-.2),s2.dk+(.6*k+.1)/2,z+dz);}}
  const tg=new THREE.TorusGeometry(.33,.085,8,20);for(const u of[.35,.62])for(const sd of[-1,1]){const s2=h.deckAt(u),z=h.zOf(s2.u,s2.dk,s2);const t=add(tg,Mt.buoy,sd*(s2.dW+.02),s2.dk+.75,z);t.rotation.y=Math.PI/2;
    for(let q=0;q<4;q++){const bd=add(new THREE.TorusGeometry(.335,.09,6,4,.35),Mt.band,sd*(s2.dW+.02),s2.dk+.75,z);bd.rotation.set(q*Math.PI/2,Math.PI/2,0);}}
  // 水面下：推進器（羽根 4〜5 枚とハブ）、軸、舵、ビルジキール。船体の断面から、推進器の円盤が船体に入らない位置（船尾の切り上がりの後ろ）を求めて置き、
  // 舵はその後ろで上端を船底に付ける。収まらなければ推進器を小さくする。羽根はハブごと 1 つの組にまとめて回す（g.userData.props）
  const T=o.T,twin=kind==='patrol',Sst=S.filter(q=>q.u>.5);
  const halfW=(q,y)=>{if(y<q.keel||y>q.dk)return -1;const P2=q.pts;for(let i=0;i<P2.length-1;i++){const[a0,b0]=P2[i],[a1,b1]=P2[i+1];if(y>=b0&&y<=b1)return b1-b0<1e-6?Math.max(a0,a1):a0+(a1-a0)*(y-b0)/(b1-b0);}return -1;};
  const cover=(x,y)=>{let z=-1e9;for(const q of Sst)if(Math.abs(x)<=halfW(q,y))z=Math.max(z,h.zOf(q.u,y,q));return z;};   // その点を覆う船体の、いちばん後ろの z
  const zEnd=h.zOf(1,S[S.length-1].keel,S[S.length-1]);
  const fit=(px,pr)=>{const py=-T+pr*1.05+T*.04;let zc=cover(px,py);for(let i=0;i<16;i++){const a=i/16*Math.PI*2;zc=Math.max(zc,cover(px+Math.cos(a)*pr*1.05,py+Math.sin(a)*pr*1.05));}
    const hubZ=zc+pr*.38,ch=pr*1.1,rudZ=hubZ+pr*.36+ch/2;return{py,hubZ,ch,rudZ,ok:rudZ+ch*.3<=zEnd};};
  const pxs=twin?[-o.B*.2,o.B*.2]:[0];let pr=T*.36,F=null;for(let it=0;it<8;it++){F=pxs.map(px=>fit(px,pr));if(F.every(f=>f.ok))break;pr*=.88;}
  const props=g.userData.props=[];
  pxs.forEach((px,j)=>{const{py,hubZ,ch,rudZ}=F[j];const rot=new THREE.Group();rot.userData.dyn=1;rot.position.set(px,py,hubZ);g.add(rot);   // dyn：材質ごとにまとめる処理から外す（回すため）
    const hub=new THREE.Mesh(new THREE.SphereGeometry(pr*.22,12,8),Mt.prop);hub.scale.set(1,1,1.5);rot.add(hub);
    const nb=kind==='cargo'?5:4;for(let b2=0;b2<nb;b2++){const bl=new THREE.Mesh(new THREE.SphereGeometry(1,10,6),Mt.prop);bl.scale.set(pr*.46,pr*.56,pr*.07);const pv=new THREE.Group();pv.rotation.z=b2/nb*Math.PI*2;rot.add(pv);bl.position.set(0,pr*.5,0);bl.rotation.y=.62;pv.add(bl);}
    props.push(rot);
    // 軸：ハブから船体の中まで
    const botAt=z=>{let best=Sst[0];for(const q of Sst)if(Math.abs(h.zOf(q.u,q.keel,q)-z)<Math.abs(h.zOf(best.u,best.keel,best)-z))best=q;return best.keel;};
    {const zf=hubZ-pr*1.7,yf=Math.max(py,botAt(zf)+.15*k);beam(g,new V3(px,py,hubZ-pr*.15),new V3(px*.85,yf+pr*.12,zf),pr*.1,Mt.keel);}   // 軸：ハブから斜め前上へ、すぐ船底に入る
    if(twin){const zb=hubZ-pr*.55;beam(g,new V3(px,py,zb),new V3(px*.55,botAt(zb)+.2*k,zb),pr*.07,Mt.keel);}   // 2 軸の船は軸を支える支柱
    // 舵：推進器の後ろ。上端は舵の位置の船底（少し船体に入れる）、下端は推進器の下端あたり
    const yTop=(()=>{let y=-T;for(const q of Sst){const zq=h.zOf(q.u,q.keel,q);if(zq<=rudZ+ch*.5)y=Math.max(y,q.keel);}return y+.3*k;})(),yBot=py-pr*.95;
    add(new THREE.BoxGeometry(.3*k+.1,yTop-yBot,ch),Mt.rud,px,(yTop+yBot)/2,rudZ);});
  for(const sd of[-1,1]){const bk=add(new THREE.BoxGeometry(.08,.5*k+.1,o.L*.3),Mt.keel,sd*o.B*.45,-T*.82,0);bk.rotation.z=sd*.6;}}
// 小さな船の外壁の絵柄（1 枚＝実寸 8m×3m、ExtrudeGeometry の世界座標の uv に合わせて repeat）
//  pt：巡視船の甲板室（丸窓の列、扉、継ぎ目、雨だれ）／fs：漁船の操舵室（側面の窓 2 枚と扉）
function shipWall(kind){const key='sw_'+kind;if(SHIPTEX[key])return SHIPTEX[key];const W=1024,H=384,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),r=mulberry(kind==='pt'?71:83);
  x.fillStyle=kind==='pt'?'#e9ebe9':'#efede6';x.fillRect(0,0,W,H);for(let i=0;i<600;i++){x.fillStyle=`rgba(${120+r()*60|0},${120+r()*60|0},${120+r()*60|0},.035)`;x.fillRect(r()*W,r()*H,2+r()*30,1+r()*5);}
  x.strokeStyle='rgba(90,95,100,.35)';x.lineWidth=2;for(let k=1;k<4;k++){x.beginPath();x.moveTo(k*W/4,0);x.lineTo(k*W/4,H);x.stroke();}x.beginPath();x.moveTo(0,H*.12);x.lineTo(W,H*.12);x.stroke();
  const port=(cx,cy,rr)=>{x.fillStyle='#d8dad8';x.beginPath();x.arc(cx,cy,rr+7,0,7);x.fill();x.fillStyle='#16222c';x.beginPath();x.arc(cx,cy,rr,0,7);x.fill();x.fillStyle='rgba(255,255,255,.18)';x.beginPath();x.arc(cx-rr*.3,cy-rr*.3,rr*.35,0,7);x.fill();
    const g2=x.createLinearGradient(0,cy+rr,0,cy+rr+60);g2.addColorStop(0,'rgba(120,90,60,.25)');g2.addColorStop(1,'rgba(120,90,60,0)');x.fillStyle=g2;x.fillRect(cx-3,cy+rr+6,6,60);};
  const door=(dx)=>{x.fillStyle='#cfd2cf';x.strokeStyle='#5a6066';x.lineWidth=4;const w=90,h=230,y=H-h-8;x.beginPath();x.moveTo(dx+16,y);x.lineTo(dx+w-16,y);x.quadraticCurveTo(dx+w,y,dx+w,y+16);x.lineTo(dx+w,H-8);x.lineTo(dx,H-8);x.lineTo(dx,y+16);x.quadraticCurveTo(dx,y,dx+16,y);x.fill();x.stroke();
    x.fillStyle='#16222c';x.beginPath();x.arc(dx+w/2,y+55,18,0,7);x.fill();x.fillStyle='#3a3f44';for(const yy of[y+110,y+150])x.fillRect(dx+w-22,yy,14,8);x.fillRect(dx+w-30,y+128,22,5);};
  if(kind==='pt'){for(let k=0;k<8;k++){if(k===3)continue;port(64+k*128,H*.46,24);}door(3*128+18);x.fillStyle='rgba(30,60,120,.85)';x.font='bold 26px sans-serif';x.fillText('救命胴衣',3*128+20,60);}
  else{for(const wx of[90,620]){x.fillStyle='#d8d6cf';x.fillRect(wx-10,90,300,170);x.fillStyle='#16222c';x.fillRect(wx,100,280,150);x.fillStyle='rgba(255,255,255,.14)';x.fillRect(wx+8,108,110,50);x.strokeStyle='#d8d6cf';x.lineWidth=8;x.beginPath();x.moveTo(wx+140,100);x.lineTo(wx+140,250);x.stroke();}door(440);}
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1/8,1/3);t.anisotropy=8;return SHIPTEX[key]=t;}
// 網の絵柄（kind 2＝濃い緑の漁網、それ以外＝灰色の安全網）。透明な目
function netTex(kind){const key='net_'+(kind||1);if(SHIPTEX[key])return SHIPTEX[key];const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.clearRect(0,0,128,128);
  x.strokeStyle=kind===2?'#3e4f34':'#b8bec2';x.lineWidth=kind===2?3:2;for(let i=-128;i<256;i+=12){x.beginPath();x.moveTo(i,0);x.lineTo(i+128,128);x.stroke();x.beginPath();x.moveTo(i,128);x.lineTo(i+128,0);x.stroke();}
  if(kind===2){x.globalCompositeOperation='destination-over';x.fillStyle='rgba(40,55,35,.85)';x.fillRect(0,0,128,128);}
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(kind===2?4:6,kind===2?2:10);return SHIPTEX[key]=t;}
// 段ボール箱の山（探検ではボートや車で崩せる）。list は親の座標で [x,y,z,幅,高さ,奥行き,向き]。CARTON_SETS に登録し、explore.js が剛体にする
const CARTON_SETS=[];let CARTON_M=null;
function cartonMat(){if(CARTON_M)return CARTON_M;const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),q=mulberry(808);x.fillStyle='#b48a5a';x.fillRect(0,0,256,256);
  for(let i=0;i<1400;i++){x.fillStyle=`rgba(${120+q()*60|0},${85+q()*40|0},${45+q()*30|0},.12)`;x.fillRect(q()*256,q()*256,1+q()*3,1+q()*3);}
  for(let i=0;i<40;i++){x.strokeStyle='rgba(90,60,30,.12)';x.beginPath();const y=q()*256;x.moveTo(0,y);x.lineTo(256,y+(q()-.5)*6);x.stroke();}
  x.fillStyle='rgba(200,170,120,.55)';x.fillRect(0,112,256,32);x.strokeStyle='rgba(120,90,50,.4)';x.strokeRect(0,112,256,32);
  x.fillStyle='rgba(40,30,20,.75)';x.font='bold 22px sans-serif';x.fillText('THIS SIDE UP',18,60);x.fillText('↑ ↑',190,60);x.font='16px monospace';x.fillText('NO. 24-'+(100+q()*800|0),18,200);
  x.strokeStyle='rgba(60,40,20,.5)';x.lineWidth=3;x.strokeRect(2,2,252,252);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return CARTON_M=std({map:t,roughness:.92,metalness:0});}
function cartonSet(par,list){const im=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),cartonMat(),list.length),d=new THREE.Object3D();list.forEach((b,i)=>{d.position.set(b[0],b[1],b[2]);d.rotation.set(0,b[6],0);d.scale.set(b[3],b[4],b[5]);d.updateMatrix();im.setMatrixAt(i,d.matrix);});
  im.castShadow=im.receiveShadow=true;im.userData.dyn=1;im.userData.noMerge=1;im.userData.carton=1;par.add(im);CARTON_SETS.push({im,list,par});return im;}
// 駐機中の大型無人機（物流用マルチコプター）：流線形の胴、先細りの炭素の腕 4 本、冷却ひれのあるモーター、ねじれた 2 枚羽根、スキッドと支柱、カメラのジンバル、荷物ポッド、灯火
function buildUAV(){const g=new THREE.Group(),S=(c,r,m,o)=>std(Object.assign({color:lin(c),roughness:r,metalness:m},o||{}));
  const body=S(0xd9dcdf,.38,.2),carbon=S(0x22262a,.45,.35),dkM=S(0x15181b,.5,.5),alu=S(0xa8aeb3,.3,.85),glass=S(0x0b121a,.05,.9),yel=S(0xd9a21b,.5,.2);
  const A=(geo,m,x,y,z,o)=>{const q=new THREE.Mesh(geo,m);q.position.set(x,y,z);if(o){if(o.rx)q.rotation.x=o.rx;if(o.ry)q.rotation.y=o.ry;if(o.rz)q.rotation.z=o.rz;if(o.s)q.scale.set(o.s[0],o.s[1],o.s[2]);}q.castShadow=true;g.add(q);return q;};
  const tube=(a,b,r0,r1,m)=>{const d=new V3().subVectors(b,a),q=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,d.length(),12),m);q.position.copy(a).addScaledVector(d,.5);q.quaternion.setFromUnitVectors(new V3(0,1,0),d.normalize());q.castShadow=true;g.add(q);return q;};
  // 胴：上下につぶれた卵形、上のフェアリング、機首の窓、後ろのしぼり
  A(new THREE.SphereGeometry(1,28,18),body,0,2.0,0,{s:[1.35,.85,3.0]});A(new THREE.SphereGeometry(1,20,12,0,Math.PI*2,0,Math.PI*.5),body,0,2.55,.3,{s:[.9,.55,1.9]});
  A(new THREE.SphereGeometry(.55,18,12,0,Math.PI*2,0,Math.PI*.55),glass,0,2.15,-2.65,{rx:-Math.PI/2,s:[1,1,.6]});
  for(const s2 of[-1,1]){A(new THREE.BoxGeometry(.02,.5,2.4),dkM,s2*1.33,2.0,.2);A(new THREE.BoxGeometry(.6,.03,.03),dkM,s2*1.0,2.62,-1.1);}   // 点検口の継ぎ目
  // 腕（胴の肩から斜め外へ）と、先のモーター・ひれ・羽根
  for(const[sx,sz]of[[-1,-1],[1,-1],[-1,1],[1,1]]){const a0=new V3(sx*1.0,2.25,sz*1.4),a1=new V3(sx*5.0,2.45,sz*4.0);tube(a0,a1,.2,.12,carbon);A(new THREE.SphereGeometry(.26,12,10),body,a0.x,a0.y,a0.z);
    A(new THREE.CylinderGeometry(.42,.48,.55,20),alu,a1.x,a1.y+.1,a1.z);for(let k=0;k<5;k++)A(new THREE.TorusGeometry(.47,.025,4,20),dkM,a1.x,a1.y-.08+k*.09,a1.z,{rx:Math.PI/2});
    A(new THREE.CylinderGeometry(.18,.24,.22,14),dkM,a1.x,a1.y+.48,a1.z);A(new THREE.CylinderGeometry(.06,.06,.25,8),alu,a1.x,a1.y+.66,a1.z);
    const pg=new THREE.Group();pg.position.set(a1.x,a1.y+.66,a1.z);pg.rotation.y=(sx*sz>0?.4:1.9);g.add(pg);
    for(const bs of[-1,1]){for(let k=0;k<3;k++){const bl=new THREE.Mesh(new THREE.BoxGeometry(1.0,.035,.26-.05*k),carbon);bl.position.set(bs*(.55+k*.95),0,0);bl.rotation.x=bs*(.32-.1*k);bl.castShadow=true;pg.add(bl);}
      const tip=new THREE.Mesh(new THREE.BoxGeometry(.25,.036,.14),yel);tip.position.set(bs*3.0,0,0);tip.rotation.x=bs*.1;pg.add(tip);}
    // 腕の先の灯（左が赤、右が緑、後ろは白）
    const lc=sx<0?new THREE.Color(2.2,.15,.1):new THREE.Color(.15,2,.4);A(new THREE.SphereGeometry(.08,8,6),new THREE.MeshBasicMaterial({color:sz>0?new THREE.Color(2,2,1.8):lc}),a1.x,a1.y-.25,a1.z);}
  // スキッド（前後が上へ反った管）と支柱
  for(const s2 of[-1,1]){const x=s2*1.7,pts=[];for(let k=0;k<=12;k++){const t=k/12,z=-3.4+6.8*t,y=.12+.35*Math.pow(Math.max(0,Math.abs(t-.5)*2-.75)*4,2);pts.push(new V3(x,y,z));}
    const sk=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,.09,8),alu);sk.castShadow=true;g.add(sk);
    for(const z of[-1.6,1.6]){tube(new V3(x,.15,z),new V3(s2*.8,1.35,z*.7),.07,.07,alu);}}
  // ジンバルのカメラ（機首の下）、荷物ポッド、GPS、アンテナ、衝突防止灯
  A(new THREE.CylinderGeometry(.12,.12,.25,10),dkM,0,1.15,-2.1);A(new THREE.SphereGeometry(.34,16,12),dkM,0,.85,-2.1);A(new THREE.CircleGeometry(.14,14),glass,0,.85,-2.45,{ry:Math.PI});
  {const pd=A(new THREE.BoxGeometry(1.5,.75,2.6),body,0,.95,.6);A(new THREE.BoxGeometry(1.52,.04,.04),dkM,0,1.1,.6);A(new THREE.BoxGeometry(.04,.5,2.62),dkM,0,.95,.6);}
  A(new THREE.CylinderGeometry(.22,.22,.08,16),S(0xf0f0ec,.4,.1),0,3.08,.6);for(const x of[-.5,.5])A(new THREE.CylinderGeometry(.015,.03,.9,5),dkM,x,3.1,1.6);
  A(new THREE.SphereGeometry(.09,8,6),new THREE.MeshBasicMaterial({color:new THREE.Color(2.4,.3,.2)}),0,3.05,-.4);
  // 機番の表記（両側）
  {const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');x.fillStyle='rgba(20,24,28,.9)';x.font='bold 40px sans-serif';x.fillText('UAV-24',16,46);x.fillStyle='#d9a21b';x.fillRect(200,10,40,44);
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const m=new THREE.MeshStandardMaterial({map:t,transparent:true,roughness:.5,polygonOffset:true,polygonOffsetFactor:-2});
    for(const s2 of[-1,1]){const q=A(new THREE.PlaneGeometry(1.6,.4),m,s2*1.37,2.15,.6,{ry:s2*Math.PI/2});q.castShadow=false;q.rotation.z=0;}}
  return g;}
function buildShip(kind){
  const g=new THREE.Group();g.userData.kind=kind;g.userData.noWeather=1;
  const M=(geo,m,x,y,z,par)=>{const o=new THREE.Mesh(geo,m);o.position.set(x||0,y||0,z||0);(par||g).add(o);return o;};
  const C=(h,ro,me,o)=>std(Object.assign({color:lin(h),roughness:ro,metalness:me},o||{}));
  const light=(x,y,z,c,s)=>{const l=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:c,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));l.position.set(x,y,z);l.scale.set(s,s,1);g.add(glowLOD(l,90,.2));};
  const navLights=(yM,zM,ys,zs,hw)=>{light(0,yM,zM,new THREE.Color(2.4,2.3,2),3);light(-hw,ys,zs,new THREE.Color(2.6,.2,.15),2.2);light(hw,ys,zs,new THREE.Color(.2,2.4,.5),2.2);};
  // 船体の形と外板の材質は船の種類ごとに 1 度だけ作って使い回す（大きな絵柄を船の数だけ持たない）
  const hullOf=(o,tex)=>{const key='hull_'+kind;if(!SHIPTEX[key]){const h=hullGeo(o),mat=sd=>C(0xffffff,tex.rough||.62,tex.metal===undefined?.35:tex.metal,{side:THREE.DoubleSide,map:hullTex(Object.assign({},o,tex,{Dm:h.Dm,side:sd}))});SHIPTEX[key]={h,mp:mat('P'),ms:mat('S')};}
    {const c=SHIPTEX[key];if(!c.foul){c.foul=1;for(const mm of[c.mp,c.ms]){mm.onBeforeCompile=sh=>{sh.uniforms.tFn=U.tNoise2;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vHp;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHp=position;');
        sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D tFn;varying vec3 vHp;').replace('#include <color_fragment>','#include <color_fragment>\n{vec2 pl=vec2(vHp.z/7.5,vHp.y/2.2);vec2 fq=abs(fract(pl+vec2(step(1.0,mod(floor(pl.y),2.0))*0.5,0.0))-0.5);float sm=max(smoothstep(0.494,0.5,fq.x),smoothstep(0.488,0.5,fq.y));diffuseColor.rgb*=1.0-0.13*sm;diffuseColor.rgb*=0.95+0.1*texture2D(tFn,floor(pl+vec2(step(1.0,mod(floor(pl.y),2.0))*0.5,0.0))*0.137).b;}   /* 外板の継ぎ目と、板ごとのわずかな色の違い */\n{float y=vHp.y;if(y<0.4){float n=texture2D(tFn,vHp.zy*0.35).b,f=texture2D(tFn,vHp.zy*3.1).b;float k=smoothstep(0.4,-0.8,y+(n-0.5)*0.6);diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(0.5,0.62,0.42)*(0.7+0.5*f),k*0.75);float bd=smoothstep(0.78,0.86,texture2D(tFn,vHp.zy*9.0+0.3).b)*smoothstep(0.2,-0.3,y)*smoothstep(-2.5,-0.6,y);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.6,0.58,0.52),bd*0.7);}}');};mm.customProgramCacheKey=()=>'hullFoul';mm.needsUpdate=true;}}}
    const c=SHIPTEX[key];M(c.h.port,c.mp);M(c.h.stbd,c.ms);return c.h;};
  if(kind==='cargo'){
    const o={L:196,B:30,D:11,T:10,rake:9,sheerF:3.2,sheerA:1.2,trans:.9,entry:.2,run:.18,flat:.88,sRake:4};
    const h=hullOf(o,{hull:'#1c2733',hullTop:'#243241',bottom:'#6a2b20',boot:'#141516',bootTop:1.2,rust:1,deckY:u=>o.D+(u<.28?o.sheerF*Math.pow(1-u/.28,2):0)-.3,hawse:.035,hawseY:o.D+1.2,hawseR:1.3,draft:1,name:'OCEAN LARK',nameU:.11,nameY:o.D-2.6,nameH:3.4,stern:'OCEAN LARK  MIZUHA',sternY:o.D-1.6,sternH:1.6,seed:11});
    const deckM=C(0xffffff,.82,.2,{map:deckTex({key:'cargo',B:30,base:'#6a3b2c',line:'#c9a43a',rust:1.2,plate:[2.5,6]})}),grn=C(0x3f5f48,.8,.2),wht=C(0xd9dad5,.62,.15),dark=C(0x22272c,.6,.5),stl=C(0x8a9196,.45,.7);
    M(h.deck,deckM);
    // 船首楼のブルワーク（波よけの V 字の壁）、係船機、前マスト
    const yF=h.deckAt(.06).dk;{const bw=M(new THREE.BoxGeometry(24,2.6,.4),dark,0,o.D+1.3,-69);bw.rotation.y=0;for(const s of[-1,1]){const w2=M(new THREE.BoxGeometry(12,2.6,.4),dark,s*7.5,o.D+1.3,-72.5);w2.rotation.y=s*.42;}}
    for(const s of[-1,1]){M(new THREE.CylinderGeometry(1.1,1.1,2.4,14),grn,s*4,yF+1.2,-84).rotation.z=Math.PI/2;M(new THREE.BoxGeometry(2.4,1.6,3),grn,s*7,yF+.8,-84);for(let k=0;k<3;k++)M(new THREE.CylinderGeometry(.35,.42,.9,8),dark,s*10,yF+.45,-78+k*5);}
    M(new THREE.CylinderGeometry(.18,.3,10,8),wht,0,yF+5,-90);light(0,yF+10.2,-90,new THREE.Color(2.4,2.3,2),3);
    // 艙口蓋とコンテナ（40ft、ベイの間にラッシングブリッジ）
    const cm=containerMat(),cg=new THREE.BoxGeometry(2.44,2.59,12.19),im=new THREE.InstancedMesh(cg,cm,900),d=new THREE.Object3D(),r=mulberry(kind.length+g.id);let n=0;
    const bays=[];for(let z=-60;z<50;z+=13.2)bays.push(z);
    const hatchM=C(0xffffff,.8,.25,{map:hatchTex()});
    bays.forEach((bz,bi)=>{M(new THREE.BoxGeometry(27,.8,12.6),hatchM,0,o.D+.4,bz);
      const maxT=bi===0?3:bi<2?4:6;for(let row=0;row<11;row++){const edge=row===0||row===10;let hh=Math.max(1,maxT-(edge?1:0)-Math.floor(r()*r()*3));if(r()<.06)hh=0;
        for(let k=0;k<hh&&n<900;k++){d.position.set(-12.2+row*2.44,o.D+.8+1.3+k*2.6,bz);d.updateMatrix();im.setMatrixAt(n,d.matrix);im.setColorAt(n,CONT_PAL[Math.floor(r()*CONT_PAL.length)]);n++;}}
      if(bi>0){const lb=new THREE.Group();lb.position.set(0,o.D+.8,bz-6.6);g.add(lb);M(new THREE.BoxGeometry(28,.35,.35),stl,0,5.4,0,lb);M(new THREE.BoxGeometry(28,.35,.35),stl,0,2.7,0,lb);for(let k=0;k<8;k++)M(new THREE.BoxGeometry(.3,5.4,.3),stl,-13.5+k*3.85,2.7,0,lb);}});
    im.count=n;im.instanceColor.needsUpdate=true;g.add(im);
    // 居住区（7 層・後ろへ段々）、船橋とウイング、煙突、マストとレーダー、救命艇
    const wt=winTex('white'),wm=C(0xffffff,.6,.1,{map:wt,emissive:new THREE.Color(1,.92,.8),emissiveMap:wt.userData.em,emissiveIntensity:.55}),bt=winTex('bridge'),bm=C(0xffffff,.5,.15,{map:bt}),yA=o.D;
    const acc=(w,hh,dd,y,z,m)=>M(boxM(w,hh,dd,m?[4,3]:[16,6]),m||wm,0,y+hh/2,z);
    acc(24,15,13,yA,64);acc(22,6,11,yA+15,63);acc(30,3,9,yA+21,62,bm);M(new THREE.BoxGeometry(31,.5,10),wht,0,yA+24.2,62);
    for(const s of[-1,1]){M(new THREE.BoxGeometry(2.4,1.2,7),wht,s*15.6,yA+21.6,62);light(s*15.8,yA+22.6,60,s<0?new THREE.Color(2.6,.2,.15):new THREE.Color(.2,2.4,.5),2.4);}
    for(let k=0;k<6;k++)M(new THREE.BoxGeometry(24.4,.25,.6),wht,0,yA+3*k+3,57.2);   // 各層の張り出し通路
    {const cw=winTex('grey');const cm2=C(0xffffff,.6,.15,{map:cw});const cs=M(boxM(10,24.4,11,[16,6]),cm2,0,yA+12.2,72.5);M(new THREE.BoxGeometry(10.6,.4,11.6),wht,0,yA+24.5,72.5);
      for(let k=1;k<8;k++)M(new THREE.BoxGeometry(10.3,.2,.5),wht,0,yA+3*k,78.2);}   // 囲壁と後ろの通路
    const fun=M(new THREE.CylinderGeometry(3.2,4.2,12,4,1),C(0x1d2c44,.55,.35),0,yA+30,72);fun.rotation.y=Math.PI/4;fun.scale.set(1,1,1.5);
    const band=M(new THREE.CylinderGeometry(3.45,3.62,2.2,4,1,true),C(0xdedfd8,.6,.1),0,yA+31.5,72);band.rotation.y=Math.PI/4;band.scale.set(1,1,1.5);
    const band2=M(new THREE.CylinderGeometry(3.38,3.45,.7,4,1,true),C(0xa4302a,.6,.1),0,yA+31.5,72);band2.rotation.y=Math.PI/4;band2.scale.set(1.01,1,1.51);
    g.userData.funnel=new V3(0,yA+37.2,72);const top=M(new THREE.CylinderGeometry(3.1,3.2,1.2,4,1),C(0x111214,.8,.2),0,yA+36.4,72);top.rotation.y=Math.PI/4;top.scale.set(1,1,1.5);
    M(new THREE.CylinderGeometry(.25,.35,9,8),wht,0,yA+29,60);M(new THREE.BoxGeometry(6,.25,.25),wht,0,yA+31,60);
    const rdr=M(new THREE.BoxGeometry(5.2,.35,.5),dark,0,yA+33.8,60);g.userData.radar=rdr;M(new THREE.CylinderGeometry(.5,.5,.6,10),wht,0,yA+33.3,60);
    M(new THREE.CylinderGeometry(.35,.45,1.4,10),wht,2.6,yA+25.1,63.5);M(new THREE.BoxGeometry(3.6,.3,.4),dark,2.6,yA+25.95,63.5);
    // 自由降下式の救命艇：機関室の囲壁の後ろ、高い位置の滑走台に船尾へ頭を下げて載る。滑走台は囲壁と甲板の柱で支える
    {const top=yA+15,low=yA+10.5,z0=78.6,z1=88,ang=Math.atan2(top-low,z1-z0),P=(x,y,z)=>new V3(x,y,z);
      for(const x of[-1.7,1.7]){beam(g,P(x,top,z0),P(x,low,z1),.45,stl);beam(g,P(x,low,z1),P(x,yA,z1),.5,stl);beam(g,P(x,(top+low)/2,(z0+z1)/2),P(x,yA,(z0+z1)/2),.4,stl);beam(g,P(x,yA+.3,z0),P(x,(top+low)/2,(z0+z1)/2),.3,stl);}
      for(const t of[.1,.5,.9])beam(g,P(-1.7,lerp(top,low,t),lerp(z0,z1,t)),P(1.7,lerp(top,low,t),lerp(z0,z1,t)),.3,stl);
      M(new THREE.BoxGeometry(5,.3,3.2),stl,0,top+.1,z0-1.2);      // 乗り込み口の踊り場
      const boat=new THREE.Group();boat.position.set(0,(top+low)/2+1.35,(z0+z1)/2);boat.rotation.x=ang;g.add(boat);boat.add(lifeboat());}

    navLights(yA+38,60,yA+22.6,60,15.8);light(0,yA+3,80,new THREE.Color(2.4,2.3,2),3);
    for(const[x,y,z]of[[-11,yA+16,57],[11,yA+16,57]])light(x,y,z,new THREE.Color(2.2,2,1.6),4);
    // ── 細部：船首の錨とバウスラスターの標示、船尾の係船甲板、居住区の外階段・浮輪・空調機・ドーム・旗竿、甲板の通風筒、水先人の縄梯子
    {const ank=C(0x1d1f22,.6,.6),grnW=C(0x3f5f48,.7,.25),rope=C(0xd8ccb0,.9,0),orng=C(0xe2521a,.55,0),P=(x,y,z)=>new V3(x,y,z);
      // 錨（ホースパイプから吊るした形）：軸、冠、2 本の爪
      for(const sd of[-1,1]){const s2=h.deckAt(.035),x=sd*(s2.dW+.25),z=h.zOf(s2.u,s2.dk,s2)+1.5,y=o.D-1.6;const ag=new THREE.Group();ag.position.set(x,y,z);ag.rotation.z=sd*.12;g.add(ag);
        const sh=new THREE.Mesh(new THREE.BoxGeometry(.4,2.8,.4),ank);sh.position.y=-1.4;ag.add(sh);const cr=new THREE.Mesh(new THREE.BoxGeometry(1.6,.5,.5),ank);cr.position.y=-2.9;ag.add(cr);
        for(const fs of[-1,1]){const fl=new THREE.Mesh(new THREE.BoxGeometry(.3,1.5,.55),ank);fl.position.set(fs*.85,-2.3,0);fl.rotation.z=fs*.55;ag.add(fl);}
        const rg=new THREE.Mesh(new THREE.TorusGeometry(.95,.18,8,18),ank);rg.position.set(x,o.D-1.2,z);rg.rotation.y=Math.PI/2;g.add(rg);}
      // バウスラスターの標示（丸に×）
      {const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.strokeStyle='#f2f0ea';x.lineWidth=10;x.beginPath();x.arc(64,64,52,0,7);x.stroke();x.beginPath();x.moveTo(28,28);x.lineTo(100,100);x.moveTo(100,28);x.lineTo(28,100);x.stroke();
        const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const m=new THREE.MeshStandardMaterial({map:t,transparent:true,alphaTest:.3,roughness:.6,polygonOffset:true,polygonOffsetFactor:-3});for(const sd of[-1,1]){const s2=h.deckAt(.09),q=new THREE.Mesh(new THREE.PlaneGeometry(2.4,2.4),m);q.position.set(sd*(s2.dW-1.2),1.4,h.zOf(s2.u,s2.dk,s2));q.rotation.y=sd*Math.PI/2;g.add(q);}}
      // 船尾の係船甲板：ウインチ 2 基（太鼓と台）、係船柱、フェアリーダー（ローラー）、ロープの束
      {const s2=h.deckAt(.95),y=s2.dk,z=h.zOf(s2.u,s2.dk,s2);for(const sd of[-1,1]){const dr=M(new THREE.CylinderGeometry(1.0,1.0,2.2,16),grnW,sd*5,y+1.3,z-4);dr.rotation.z=Math.PI/2;for(const dx of[-1.2,1.2]){const f2=M(new THREE.CylinderGeometry(1.3,1.3,.15,16),grnW,sd*5+dx,y+1.3,z-4);f2.rotation.z=Math.PI/2;}M(new THREE.BoxGeometry(3.4,.6,2.2),grnW,sd*5,y+.3,z-4);
          for(let k=0;k<5;k++){const rc=M(new THREE.TorusGeometry(.85-k*.03,.12,6,18),rope,sd*9,y+.12+k*.18,z-7);rc.rotation.x=Math.PI/2;}
          for(const dz of[0,-8]){const ro=M(new THREE.CylinderGeometry(.35,.35,1.4,12),C(0x9aa0a4,.4,.7),sd*(s2.dW-.8),y+.9,z+dz);ro.rotation.x=Math.PI/2;M(new THREE.BoxGeometry(.6,1.2,1.8),grnW,sd*(s2.dW-.8),y+.6,z+dz);}}}
      // 居住区：外階段（両舷・各層）、浮輪、空調機、衛星ドーム、旗竿
      const stlW=C(0xd9dad5,.5,.4);for(const sd of[-1,1])for(let k=0;k<6;k++){const y0=yA+3*k,x=sd*12.6,z0=56.4,z1=59.2;beam(g,P(x-sd*.35,y0,z0),P(x-sd*.35,y0+3,z1),.08,stlW);beam(g,P(x+sd*.35,y0,z0),P(x+sd*.35,y0+3,z1),.08,stlW);
          for(let j=1;j<10;j++){const t=j/10;M(new THREE.BoxGeometry(.7,.04,.22),stlW,x,y0+3*t,lerp(z0,z1,t));}beam(g,P(x+sd*.4,y0+1,z0),P(x+sd*.4,y0+4,z1),.05,stlW);}
      for(const sd of[-1,1])for(const k of[1,3,5]){const lb=M(new THREE.TorusGeometry(.38,.09,8,18),orng,sd*12.25,yA+3*k+1.2,66);lb.rotation.y=Math.PI/2;}
      for(const sd of[-1,1])for(const k of[0,2,4]){M(new THREE.BoxGeometry(.8,1.0,1.4),C(0xe6e6e0,.6,.1),sd*12.3,yA+3*k+1.0,69);M(new THREE.CylinderGeometry(.35,.35,.05,14),dark,sd*12.71,yA+3*k+1.0,69).rotation.z=Math.PI/2;}
      for(const x of[-3,3])M(new THREE.SphereGeometry(.9,16,10),C(0xf2f2ee,.4,.05),x,yA+25.4,58.5);M(new THREE.CylinderGeometry(.06,.1,9,6),stlW,0,o.D+5,97);
      // 甲板の通風筒（きのこ形）
      for(let k=0;k<8;k++){const sd=k%2?1:-1,z=-55+k*13.2;M(new THREE.CylinderGeometry(.3,.35,1.1,10),C(0xd9dad5,.6,.2),sd*13.3,o.D+.55,z);M(new THREE.CylinderGeometry(.55,.45,.35,12),C(0xd9dad5,.6,.2),sd*13.3,o.D+1.25,z);}
      // 水先人の縄梯子（右舷の中央から水面近くまで）
      {const s2=h.deckAt(.5),x=s2.dW+.06,z=h.zOf(s2.u,s2.dk,s2);for(const dz of[-.35,.35])M(new THREE.CylinderGeometry(.025,.025,o.D-.4,4),rope,x,(o.D+.4)/2,z+dz);for(let k=0;k<Math.floor((o.D-.6)/.35);k++)M(new THREE.BoxGeometry(.06,.05,.75),C(0x8a5a2a,.8,0),x+.02,.6+k*.35,z);}}
    g.userData._h=h;g.userData._o=o;
    g.userData.len=196;g.userData.beam=30;
  }else if(kind==='patrol'){
    const o={L:72,B:12,D:5,T:3.4,rake:6,sheerF:2.6,sheerA:.3,trans:.86,entry:.34,run:.2,flat:.45,sRake:.6};
    const h=hullOf(o,{hull:'#e6e8e6',hullTop:'#eef0ee',bottom:'#6a2b20',boot:'#141516',bootTop:.7,rust:.25,deckY:u=>o.D+(u<.28?o.sheerF*Math.pow(1-u/.28,2):0)-.2,hawse:.06,hawseY:o.D+1.5,hawseR:.45,draft:1,
      stripes:[[2.4,'#1f4f8f',.16],[.8,'#b3261c',.205]],num:'MZ 31',numU:.085,numY:o.D-.9,numH:2.2,stern:'みずは',sternY:o.D-1.2,sternH:1.1,nameCol:'#1a1c1e',face:'"Hiragino Sans","Yu Gothic",sans-serif',seed:23});
    const grey=C(0xe2e4e2,.55,.2),dk=C(0x5e666c,.7,.3),dkD=C(0x3b4249,.7,.3),gl=C(0x101820,.08,.9),blk=C(0x1a1d20,.6,.3);
    M(h.deck,C(0xffffff,.88,.15,{map:deckTex({key:'patrol',B:12,base:'#5a6066',walk:'#4a5056',line:'#e8e4d6',rust:.25,anti:1,plate:[1.5,4]})}));
    // ── 上部構造（実寸に近い作り）：1 層目の甲板室（丸窓・扉・継ぎ目）、2 層目、船橋（傾いた窓 7 枚と窓枠、両舷のウイング）、屋上の機器
    const wallT=shipWall('pt'),wallM=C(0xffffff,.5,.15,{map:wallT}),glassB=C(0x16222c,.05,.9),frameM=C(0xe8eae8,.45,.2),blkM=C(0x1d2024,.6,.4),orng=C(0xd9571b,.55,.1),stlM=C(0x9aa0a6,.4,.7);
    const house=(pts,y,hh,m)=>{const sh=new THREE.Shape(pts.map(q=>new THREE.Vector2(q[0],-q[1])));const ge=new THREE.ExtrudeGeometry(sh,{depth:hh,bevelEnabled:false});ge.rotateX(-Math.PI/2);ge.computeVertexNormals();const q=M(ge,m,0,y,0);return q;};
    const rect=(hx,z0,z1,ch)=>[[-hx+ch,z0],[hx-ch,z0],[hx,z0+ch*1.6],[hx,z1],[-hx,z1],[-hx,z0+ch*1.6]];
    house(rect(4.7,-14,10,1.4),o.D,2.8,wallM);M(new THREE.BoxGeometry(9.8,.18,24.6),grey,0,o.D+2.9,-2);   // 1 層目と屋根のふち
    house(rect(4.1,-12.5,1,1.2),o.D+2.95,2.6,wallM);M(new THREE.BoxGeometry(8.6,.16,13.8),grey,0,o.D+5.62,-5.7);
    // 船橋：前面は後ろへ傾いた窓の帯（窓 7 枚、白い窓枠）、横と後ろにも窓
    {const y0=o.D+5.7,hh=2.5,z0=-11.6,z1=-3.2,hx=3.9;house(rect(hx,z0+.8,z1,1.0),y0,1.0,grey);house(rect(hx,z0+1.4,z1,1.0),y0+hh-.35,.35,grey);
      const fr=new THREE.Group();fr.position.set(0,y0+1.0,z0+.95);fr.rotation.x=.28;g.add(fr);const W=hx*2-2.2;for(let k=0;k<7;k++){const pw=W/7,x=-W/2+pw*(k+.5);const pane=new THREE.Mesh(new THREE.PlaneGeometry(pw-.1,1.2),glassB);pane.position.set(x,.62,0);pane.rotation.y=Math.PI;fr.add(pane);
        const mu=new THREE.Mesh(new THREE.BoxGeometry(.09,1.3,.12),frameM);mu.position.set(-W/2+pw*k,.62,.02);fr.add(mu);}const mu2=new THREE.Mesh(new THREE.BoxGeometry(.09,1.3,.12),frameM);mu2.position.set(W/2,.62,.02);fr.add(mu2);
      for(const yy of[0,1.25]){const b2=new THREE.Mesh(new THREE.BoxGeometry(W+.2,.1,.14),frameM);b2.position.set(0,yy,.02);fr.add(b2);}
      for(const s of[-1,1]){const cw=new THREE.Mesh(new THREE.PlaneGeometry(1.4,1.1),glassB);cw.position.set(s*(hx-.55),y0+1.6,z0+1.35);cw.rotation.y=s*.65+Math.PI;g.add(cw);
        for(let k=0;k<3;k++){const sw=M(new THREE.PlaneGeometry(1.5,1.0),glassB,s*(hx+.01),y0+1.55,z0+3.2+k*1.9);sw.rotation.y=s*Math.PI/2;M(new THREE.BoxGeometry(.06,1.12,.08),frameM,s*(hx+.03),y0+1.55,z0+2.4+k*1.9);}
        // ウイング：船橋の横へ張り出す床、手すり、操作台
        M(new THREE.BoxGeometry(2.2,.15,3.2),grey,s*(hx+1.1),y0+.02,z0+2.6);for(let k=0;k<5;k++)M(new THREE.BoxGeometry(.05,1.05,.05),frameM,s*(hx+2.15),y0+.55,z0+1.1+k*.75);M(new THREE.BoxGeometry(.06,.06,3.2),frameM,s*(hx+2.15),y0+1.08,z0+2.6);
        M(new THREE.BoxGeometry(.6,1.0,.5),grey,s*(hx+1.4),y0+.55,z0+1.6);}
      for(const s of[-1,1])for(let k=0;k<3;k++){const wp=new THREE.Mesh(new THREE.BoxGeometry(.03,.5,.03),blkM);wp.position.set(-W/2+W/7*(2*k+1.5)*.5+s*0,.55,-.03);wp.rotation.z=.5;fr.add(wp);}   // ワイパー
      // 屋上：三脚のマスト（格子の腕木・航海灯）、レーダー 2 基、通信のドーム、探照灯、放水銃、鞭形アンテナ
      const yr=y0+hh,P=(x,y,z)=>new V3(x,y,z);for(const[a,b]of[[P(-1.6,yr,-7.6),P(0,yr+7.5,-6.4)],[P(1.6,yr,-7.6),P(0,yr+7.5,-6.4)],[P(0,yr,-4.2),P(0,yr+7.5,-6.4)]])beam(g,a,b,.18,grey);
      M(new THREE.BoxGeometry(3.2,.12,1.6),grey,0,yr+4.2,-6.6);for(let k=0;k<6;k++)M(new THREE.BoxGeometry(.04,.7,.04),frameM,-1.5+k*.6,yr+4.6,-7.4);
      M(new THREE.BoxGeometry(6.5,.16,.2),grey,0,yr+6.3,-6.5);for(const s of[-1,1])M(new THREE.SphereGeometry(.14,8,6),C(0xfff8e0,.3,0,{emissive:new THREE.Color(.6,.55,.4)}),s*3.1,yr+6.5,-6.5);
      const rdr=M(new THREE.BoxGeometry(4.2,.22,.36),blkM,0,yr+4.75,-6.6);g.userData.radar=rdr;M(new THREE.CylinderGeometry(.25,.32,.4,10),grey,0,yr+4.45,-6.6);
      M(new THREE.BoxGeometry(2.6,.18,.3),blkM,0,yr+7.9,-6.4);M(new THREE.CylinderGeometry(.2,.2,.3,8),grey,0,yr+7.65,-6.4);
      const dm=M(new THREE.SphereGeometry(.65,16,10),C(0xf2f2ee,.4,.05),1.9,yr+1.2,-4.4);M(new THREE.CylinderGeometry(.4,.5,.8,12),grey,1.9,yr+.4,-4.4);
      for(const s of[-1,1]){M(new THREE.CylinderGeometry(.22,.26,.35,12),stlM,s*2.6,yr+.25,-10.4);const sl=M(new THREE.CylinderGeometry(.24,.2,.42,14),grey,s*2.6,yr+.65,-10.6);sl.rotation.x=Math.PI/2;M(new THREE.CircleGeometry(.2,14),C(0xfff4d8,.1,0,{emissive:new THREE.Color(.4,.38,.3)}),s*2.6,yr+.65,-10.82).rotation.y=Math.PI;
        const mon=M(new THREE.CylinderGeometry(.1,.16,1.5,10),stlM,s*1.2,yr+.7,-10.8);mon.rotation.x=-1.2;M(new THREE.CylinderGeometry(.2,.22,.4,10),stlM,s*1.2,yr+.25,-10.4);
        const wh=M(new THREE.CylinderGeometry(.015,.03,4.5,4),blkM,s*3.2,yr+2.2,-4);wh.rotation.z=s*.08;}}
    // 1 層目の屋根の救命いかだ（白い筒の容器）と、甲板の扉の庇
    for(const s of[-1,1]){for(let k=0;k<3;k++){const cn=M(new THREE.CylinderGeometry(.42,.42,1.5,14),C(0xf0f0ec,.45,.05),s*4.0,o.D+3.45,3+k*1.6);cn.rotation.z=Math.PI/2;for(const dx of[-.5,.5])M(new THREE.CylinderGeometry(.44,.44,.08,14),C(0x2a2d30,.6,.2),s*4.0+dx,o.D+3.45,3+k*1.6).rotation.z=Math.PI/2;}
      M(new THREE.BoxGeometry(.6,.1,4.8),stlM,s*4.0,o.D+3.0,4.6);}
    // 煙突 2 本：角を丸めた先細りの筒、青い帯、上の格子と排気口
    for(const s of[-1,1]){const fsh=new THREE.Shape();const w=.75,d=1.4,r=.35;fsh.moveTo(-w+r,-d);fsh.lineTo(w-r,-d);fsh.quadraticCurveTo(w,-d,w,-d+r);fsh.lineTo(w,d-r);fsh.quadraticCurveTo(w,d,w-r,d);fsh.lineTo(-w+r,d);fsh.quadraticCurveTo(-w,d,-w,d-r);fsh.lineTo(-w,-d+r);fsh.quadraticCurveTo(-w,-d,-w+r,-d);
      const fg=new THREE.ExtrudeGeometry(fsh,{depth:3.2,bevelEnabled:false});fg.rotateX(-Math.PI/2);const fn=M(fg,grey,s*1.7,o.D+2.9,6.5);fn.rotation.x=-.08;M(new THREE.BoxGeometry(1.56,.5,2.85),C(0x1f4f8f,.55,.2),s*1.7,o.D+5.3,6.4);M(new THREE.BoxGeometry(1.4,.12,2.6),blkM,s*1.7,o.D+6.15,6.35);
      for(const dz of[-.5,.5])M(new THREE.CylinderGeometry(.18,.18,.6,10),blkM,s*1.7,o.D+6.4,6.35+dz);}
    // 艦首の機関砲：台座、丸い砲塔、砲身と先端の制退器、弾薬箱
    {const yb=h.deckAt(.17).dk;M(new THREE.CylinderGeometry(1.3,1.5,.6,18),grey,0,yb+.3,-24);const tu=M(new THREE.SphereGeometry(1.05,18,12,0,Math.PI*2,0,Math.PI*.55),grey,0,yb+.6,-24);tu.scale.set(1,.85,1.25);
      M(new THREE.BoxGeometry(1.0,.7,.9),grey,0,yb+1.1,-23.6);const br=M(new THREE.CylinderGeometry(.08,.11,2.8,10),blkM,0,yb+1.25,-25.8);br.rotation.x=Math.PI/2;const mz=M(new THREE.CylinderGeometry(.14,.14,.3,10),blkM,0,yb+1.25,-27.2);mz.rotation.x=Math.PI/2;
      M(new THREE.BoxGeometry(.5,.4,.6),grey,.75,yb+.95,-23.6);M(new THREE.BoxGeometry(2.2,.9,.12),grey,0,yb+.45,-22.6);}
    // 艦首：揚錨機、旗竿
    {const yb=h.deckAt(.06).dk;for(const s of[-1,1]){const wd=M(new THREE.CylinderGeometry(.45,.45,.7,14),C(0x3f5f48,.7,.2),s*1.1,yb+.5,-30.5);wd.rotation.z=Math.PI/2;M(new THREE.BoxGeometry(.8,.5,1.1),C(0x3f5f48,.7,.2),s*1.1,yb+.25,-30.5);}
      M(new THREE.CylinderGeometry(.04,.06,3,6),frameM,0,yb+1.5,-34.6);}
    // 救助艇（硬い船底とオレンジの浮き袋、操縦台、船外機）とダビット
    for(const s of[-1,1]){const bx=s*5.0,by=o.D+2.4,bz=3;const tube=M(new THREE.TorusGeometry(1,.26,10,24),orng,bx,by,bz);tube.rotation.x=Math.PI/2;tube.scale.set(.85,2.4,1);
      const hl=M(new THREE.SphereGeometry(1,14,8,0,Math.PI*2,Math.PI*.5,Math.PI*.5),C(0x3a3f44,.6,.2),bx,by,bz);hl.scale.set(.82,.5,2.3);M(new THREE.BoxGeometry(.5,.6,.5),C(0xe6e8e6,.5,.1),bx,by+.25,bz-.3);M(new THREE.BoxGeometry(.35,.55,.4),blkM,bx,by+.05,bz+2.3);
      for(const dz of[.6,5.4]){beam(g,new V3(s*3.9,o.D,dz-1.6),new V3(s*4.6,o.D+3.6,dz-1.6),.18,grey);beam(g,new V3(s*4.6,o.D+3.6,dz-1.6),new V3(s*5.0,o.D+3.4,dz-1.6),.16,grey);M(new THREE.CylinderGeometry(.02,.02,1,4),blkM,s*5.0,o.D+2.9,dz-1.6);}}
    // ヘリ甲板のまわりの安全網（外へ傾いた網の帯）と照明
    {const net=C(0x8a9196,.6,.5,{map:netTex(),transparent:true,alphaTest:.3,side:THREE.DoubleSide});for(const s of[-1,1]){const n2=M(new THREE.PlaneGeometry(1.4,10),net,s*6.3,o.D+.95,22);n2.rotation.set(-Math.PI/2,0,s*.35);}for(let k=0;k<4;k++)M(new THREE.SphereGeometry(.09,8,6),C(0xfff4d8,.3,0,{emissive:new THREE.Color(.8,.7,.4)}),(k<2?-1:1)*5.6,o.D+.4,19+(k%2)*6);}
    const pad=M(new THREE.CylinderGeometry(5.4,5.4,.2,32),C(0xffffff,.8,.1,{map:(()=>{const c=document.createElement('canvas');c.width=256;c.height=256;const x=c.getContext('2d');x.fillStyle='#3a4046';x.fillRect(0,0,256,256);x.strokeStyle='#e8e4d6';x.lineWidth=7;x.beginPath();x.arc(128,128,96,0,7);x.stroke();x.fillStyle='#e8e4d6';x.font='bold 120px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText('H',128,134);x.strokeStyle='#d9a21b';x.lineWidth=6;x.strokeRect(12,12,232,232);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;})()}),0,o.D+.15,24);

    navLights(o.D+15.8,-4.4,o.D+5.4,-7,4.2);
    g.userData._h=h;g.userData._o=o;
    g.userData.len=72;g.userData.beam=12;
  }else{
    const o={L:28,B:7,D:2.1,T:1.8,rake:3,sheerF:1.7,sheerA:.4,trans:.9,entry:.36,run:.18,flat:.4,sRake:.3};
    const h=hullOf(o,{hull:'#eceae4',hullTop:'#f2f0ea',bottom:'#8a2a20',boot:'#1f4f8a',bootTop:.5,rust:.5,deckY:u=>o.D+(u<.28?o.sheerF*Math.pow(1-u/.28,2):0)-.1,sheerLine:'#1f4f8a',sheerW:10,hawse:.07,hawseY:o.D+1.2,hawseR:.22,
      name:'第八 瑞穂丸',nameU:.16,nameY:o.D-.75,nameH:.68,nameCol:'#1a2a44',face:'"Hiragino Mincho ProN","Yu Mincho",serif',seed:31,strake:1.2,butt:4,rough:.55,metal:.1});
    const wht=C(0xeceae4,.55,.1),blue=C(0x1f4a78,.6,.2),dk=C(0x6a6e6a,.8,.1),stl=C(0x9aa0a4,.45,.6);
    M(h.deck,C(0xffffff,.9,.05,{map:deckTex({key:'fish',B:7,base:'#7d8278',walk:'#6f746b',line:'#2a5a8a',rust:.8,anti:1,plate:[1.2,2.5]})}));
    // ── 操舵室：前が傾いた窓 3 枚の箱（窓枠・扉・継ぎ目）、屋上のレーダー・GPS・アンテナ・汽笛・探照灯、後ろの排気筒
    const wallF=C(0xffffff,.5,.1,{map:shipWall('fs')}),glassF=C(0x16222c,.05,.9),frameF=C(0xf2f0ea,.45,.1),blkF=C(0x1d2024,.6,.4),stlF=C(0x9aa0a4,.4,.7);
    {const y0=o.D,hh=2.5,z0=-1.2,z1=3.6,hx=2.2;const sh=new THREE.Shape([[-hx+.4,z0],[hx-.4,z0],[hx,z0+.5],[hx,z1],[-hx,z1],[-hx,z0+.5]].map(q=>new THREE.Vector2(q[0],-q[1])));const ge=new THREE.ExtrudeGeometry(sh,{depth:hh,bevelEnabled:false});ge.rotateX(-Math.PI/2);M(ge,wallF,0,y0,0);
      const fr=new THREE.Group();fr.position.set(0,y0+1.25,z0-.02);fr.rotation.x=.18;g.add(fr);for(let k=0;k<3;k++){const pw=(hx*2-.9)/3,x=-(hx*2-.9)/2+pw*(k+.5);const pn=new THREE.Mesh(new THREE.PlaneGeometry(pw-.1,.95),glassF);pn.position.set(x,.5,0);pn.rotation.y=Math.PI;fr.add(pn);const mu=new THREE.Mesh(new THREE.BoxGeometry(.08,1.05,.08),frameF);mu.position.set(x-pw/2,.5,.01);fr.add(mu);}
      {const mu=new THREE.Mesh(new THREE.BoxGeometry(.08,1.05,.08),frameF);mu.position.set((hx*2-.9)/2,.5,.01);fr.add(mu);const tb=new THREE.Mesh(new THREE.BoxGeometry(hx*2-.8,.08,.1),frameF);tb.position.set(0,1.0,.01);fr.add(tb);}
      M(new THREE.BoxGeometry(hx*2+.5,.18,z1-z0+.9),blue,0,y0+hh+.09,(z0+z1)/2);M(new THREE.BoxGeometry(hx*2+.6,.06,.12),blue,0,y0+hh-.02,z0-.38);
      // 屋上：レーダー（台と回る板）、GPS のきのこ、アンテナ、汽笛、探照灯、手すり、マスト
      const yr=y0+hh+.18;M(new THREE.BoxGeometry(2.6,.6,1.8),wht,0,yr+.3,1.6);M(new THREE.CylinderGeometry(.18,.22,.5,10),blkF,0,yr+.85,1.6);const rdr=M(new THREE.BoxGeometry(2.4,.14,.24),blkF,0,yr+1.15,1.6);g.userData.radar=rdr;
      for(const[x,z]of[[-1.3,.2],[1.3,.2]]){M(new THREE.CylinderGeometry(.03,.03,.4,6),wht,x,yr+.2,z);M(new THREE.SphereGeometry(.13,10,8),C(0xf4f4f0,.4,0),x,yr+.45,z);}
      for(const x of[-1.8,1.8]){const wa=M(new THREE.CylinderGeometry(.012,.025,3.2,4),blkF,x,yr+1.6,2.6);wa.rotation.z=x*.03;}
      M(new THREE.ConeGeometry(.09,.3,10,1,true),C(0xb8bcbe,.35,.8),.6,yr+.75,.6).rotation.x=-Math.PI/2;const sl=M(new THREE.CylinderGeometry(.16,.13,.3,12),stlF,-.7,yr+.75,.4);sl.rotation.x=Math.PI/2;
      for(let k=0;k<8;k++)M(new THREE.BoxGeometry(.04,.6,.04),stlF,-hx+.1+k*(hx*2-.2)/7,yr+.3,z0+.1);M(new THREE.BoxGeometry(hx*2-.1,.04,.04),stlF,0,yr+.6,z0+.1);
      // 排気筒（黒い管と雨よけの帽子）、操舵室の横の扉
      M(new THREE.CylinderGeometry(.16,.18,3.4,10),blkF,1.5,y0+2.6,4.2);M(new THREE.CylinderGeometry(.24,.2,.15,10),blkF,1.5,y0+4.35,4.2);}
    const ms=M(new THREE.CylinderGeometry(.08,.13,7.5,8),wht,0,o.D+6.5,-1.4);M(new THREE.BoxGeometry(3.4,.1,.1),wht,0,o.D+8.3,-1.4);
    {const bulbG=new THREE.SphereGeometry(.16,8,6),bulbM=C(0xf4f0e0,.3,0,{emissive:new THREE.Color(.5,.48,.38)});for(let k=0;k<9;k++){M(bulbG,bulbM,0,o.D+5.4,-9+k*1.8);}M(new THREE.CylinderGeometry(.02,.02,16,4),dk,0,o.D+5.6,-2).rotation.x=Math.PI/2;}
    // 網の巻き取り機：両側の円盤、巻いた網（網の絵柄）、油圧の箱
    {const nm=C(0xffffff,.9,0,{map:netTex(2)});const dr=M(new THREE.CylinderGeometry(1.0,1.0,2.6,22),nm,0,o.D+1.25,9);dr.rotation.z=Math.PI/2;for(const s of[-1,1]){const f2=M(new THREE.CylinderGeometry(1.25,1.25,.12,22),C(0x2f6b4f,.7,.3),s*1.36,o.D+1.25,9);f2.rotation.z=Math.PI/2;M(new THREE.BoxGeometry(.3,1.3,.5),C(0x2f6b4f,.7,.3),s*1.45,o.D+.6,9);}
      M(new THREE.BoxGeometry(.8,.6,.7),C(0x3a5a8a,.6,.3),1.9,o.D+.3,8.1);}
    // 船尾のやぐら（A 形の門と滑車）、網の山、魚箱の積み、ロープの束
    for(const s of[-1,1]){beam(g,new V3(s*2.6,o.D,12.6),new V3(s*1.8,o.D+3.6,12.2),.2,stlF);beam(g,new V3(s*2.6,o.D,11.4),new V3(s*1.8,o.D+3.6,12.2),.16,stlF);}M(new THREE.BoxGeometry(3.8,.22,.22),stlF,0,o.D+3.65,12.2);
    for(const x of[-.8,.8]){const pl=M(new THREE.CylinderGeometry(.25,.25,.12,14),C(0xd9a21b,.5,.3),x,o.D+3.35,12.25);pl.rotation.z=Math.PI/2;}
    {const hp=new THREE.SphereGeometry(1,16,10);const pp=hp.attributes.position;for(let i=0;i<pp.count;i++){const x=pp.getX(i),y=pp.getY(i),z=pp.getZ(i);const k=1+.18*Math.sin(x*5+z*3)*Math.cos(z*4);pp.setXYZ(i,x*k,Math.max(0,y)*.45*k,z*k);}hp.computeVertexNormals();
      M(hp,C(0x58664a,.95,0,{map:netTex(2)}),-1.0,o.D+.02,11).scale.set(1.3,1,1.6);}
    {const bxG=new THREE.BoxGeometry(.62,.28,.42),bc=[C(0x2f6fb0,.55,0),C(0xe07a1c,.55,0)];for(let k=0;k<12;k++){const c2=k%4,r2=Math.floor(k/4);M(bxG,bc[(k+r2)%2],1.6+(c2%2)*.66,o.D+.15+r2*.29,10.2+Math.floor(c2/2)*.46);}}
    for(const[x,z]of[[-2.2,6.2],[2.3,-4.5]]){for(let k=0;k<4;k++){const t2=M(new THREE.TorusGeometry(.42-k*.02,.045,6,20),C(0xd8ccb0,.9,0),x,o.D+.05+k*.06,z);t2.rotation.x=Math.PI/2;}}
    // 舷側に吊るしたタイヤの防舷材（綱つき）と、船べりのこすれ帯
    for(const s of[-1,1]){for(let k=0;k<6;k++){const z=-4.5+k*2.7,   /* 前の船名にかからない位置から */s2=h.deckAt(.5+z/o.L),xw=s2.dW+.15;const ty=M(new THREE.TorusGeometry(.32,.12,8,16),blkF,s*(xw+.05),o.D-.9,z);ty.rotation.y=Math.PI/2;M(new THREE.CylinderGeometry(.015,.015,1,4),C(0xd8ccb0,.9,0),s*xw,o.D-.3,z);}}
    for(let k=0;k<4;k++)M(new THREE.SphereGeometry(.38,10,8),C(0xe0651c,.6,.1),-3.1,o.D+.5,4+k*1.4);
    // 舷墻（ブルワーク）：船首から船尾まで外板と面をそろえて一続きに立ち上げ、上端に青い笠木、下端に排水口。船首では左右が合わさる
    {const BH=.75,TH=.09,secs=h.S.filter(q=>q.u>=.004&&q.u<=.985),wM=C(0xf2f0ea,.55,.1,{side:THREE.DoubleSide}),capM=C(0x1f4f8a,.5,.25),slotM=C(0x4a5056,.8,.1);
      for(const sd of[-1,1]){const P=[],I=[];const row=q=>{const z=h.zOf(q.u,q.dk,q),hh=BH*(1+.35*Math.pow(Math.max(0,1-q.u/.2),2)),xo=sd*(q.dW+.005),xi=sd*Math.max(0,q.dW-TH);return[[xo,q.dk-.06,z],[xo,q.dk+hh,z],[xi,q.dk+hh,z],[xi,q.dk-.02,z]];};
        secs.forEach(q=>row(q).forEach(v=>P.push(...v)));for(let i=0;i<secs.length-1;i++)for(let k=0;k<3;k++){const a0=i*4+k,b0=a0+1,c0=a0+4,d0=c0+1;if(sd>0)I.push(a0,c0,b0,b0,c0,d0);else I.push(a0,b0,c0,b0,d0,c0);}
        const ge=new THREE.BufferGeometry();ge.setAttribute('position',new THREE.Float32BufferAttribute(P,3));ge.setIndex(I);ge.computeVertexNormals();M(ge,wM);
        const top=secs.map(q=>{const r=row(q);return new V3((r[1][0]+r[2][0])/2,r[1][1]+.03,r[1][2]);});M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(top),secs.length*2,.07,6,false),capM);
        for(let z=-5;z<=10;z+=2.5){const q=h.deckAt(.5+z/o.L);if(q.u<.3||q.u>.93)continue;const sl=M(new THREE.BoxGeometry(.02,.11,.36),slotM,sd*(q.dW+.012),q.dk+.06,h.zOf(q.u,q.dk,q));}}}   /* 排水口 */
    for(const s of[-1,1]){const o2=M(new THREE.CylinderGeometry(.05,.07,8,6),blue,s*3.6,o.D+4.2,4);o2.rotation.z=-s*.9;}
    light(0,o.D+10.4,-1.4,new THREE.Color(2.4,2.1,1.5),2.4);light(-2.4,o.D+3,-.5,new THREE.Color(2.6,.2,.15),1.4);light(2.4,o.D+3,-.5,new THREE.Color(.2,2.4,.5),1.4);
    g.userData._h=h;g.userData._o=o;
    g.userData.len=28;g.userData.beam=7;
  }
  shipKit(g,kind);
  // 白波：船体沿いの帯（形は種類ごとに共用、材質は船ごと）と船尾の泡立ち。動く船は game.js で濃さと流れを変える
  {const c=SHIPTEX['hull_'+kind],B=g.userData.beam,L=g.userData.len;if(!c.foam)c.foam=hullFoamGeo(c.h,B,L);
    const fm=foamMat(1,{alpha:.3,sx:B*.7,sy:L,speed:.3,inScene:1}),rb=new THREE.Mesh(c.foam,fm);rb.frustumCulled=false;g.add(rb);
    const sw=new THREE.Mesh(new THREE.PlaneGeometry(B*1.15,L*.55),foamMat(2,{alpha:0,sx:B*1.15,sy:L*.55,speed:.5,inScene:1}));sw.rotation.x=-Math.PI/2;sw.position.set(0,.75,L*.5+L*.27);sw.frustumCulled=false;g.add(sw);
    g.userData.foam={rb:fm,sw:sw.material};}
  // 航跡（白い泡の帯）
  const L=g.userData.len,wk=new THREE.Mesh(new THREE.PlaneGeometry(1,1),foamMat(4,{sx:g.userData.beam*1.5,sy:L*3.4}));wk.rotation.x=-Math.PI/2;wk.scale.set(g.userData.beam*1.5,L*3.4,1);wk.position.set(0,.6,L*2.0);wk.frustumCulled=false;
  g.userData.wake=wk;
  {const bw=new THREE.Group(),a=.3,len=L*1.15;for(const s of[-1,1]){const p=new THREE.Mesh(new THREE.PlaneGeometry(1,1),foamMat(4,{sx:g.userData.beam*.42,sy:len}));p.frustumCulled=false;p.rotation.set(-Math.PI/2,s*a,0,'YXZ');p.scale.set(g.userData.beam*.42,len,1);p.position.set(s*Math.sin(a)*len*.5,0,-L/2+Math.cos(a)*len*.5);bw.add(p);}g.userData.bow=bw;}g.traverse(o=>{if(o.isMesh)o.castShadow=false;});
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
const MATSIG=new WeakMap();
function matSig(m){if(MATSIG.has(m))return MATSIG.get(m);let k=m.uuid;
  if(m.isMeshStandardMaterial&&(!m.hasOwnProperty('onBeforeCompile')||m.userData.wx)){const c=x=>x?x.getHexString():'';k=['S',c(m.color),m.roughness,m.metalness,m.map?m.map.uuid:'',c(m.emissive),m.emissiveIntensity,m.emissiveMap?m.emissiveMap.uuid:'',m.side,m.transparent,m.opacity,m.alphaTest,m.vertexColors,m.polygonOffset,m.polygonOffsetFactor,m.envMapIntensity,m.userData.wx?1:0,m.depthWrite].join('|');}
  else if(m.isMeshBasicMaterial&&!m.hasOwnProperty('onBeforeCompile')){const c=m.color;k=['B',c.r.toFixed(3),c.g.toFixed(3),c.b.toFixed(3),m.map?m.map.uuid:'',m.side,m.transparent,m.opacity,m.blending,m.depthWrite,m.polygonOffset].join('|');}
  MATSIG.set(m,k);return k;}
function mergeStatic(root){
  if(window.__NOMERGE)return;
  root.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(root.matrixWorld).invert(),bins=new Map(),kill=[];
  const walk=o=>{if(o.userData.dyn||!o.visible)return;if(o.isMesh&&!o.isInstancedMesh&&!Array.isArray(o.material)&&o.geometry.attributes.position&&!o.geometry.morphAttributes.position&&Object.keys(o.geometry.attributes).every(a=>a==='position'||a==='normal'||a==='uv')){
      const k=matSig(o.material)+(o.castShadow?'c':'')+(o.receiveShadow?'r':'')+(o.renderOrder||0);let b=bins.get(k);if(!b)bins.set(k,b={m:o.material,c:o.castShadow,r:o.receiveShadow,ro:o.renderOrder,list:[]});b.list.push(o);kill.push(o);}
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
    radome=std({color:lin(0x2c3338),metalness:.2,roughness:.6}),hot=std({color:lin(0x4a4038),metalness:.9,roughness:.5,side:THREE.DoubleSide}),flap=std({color:lin(0x3a342e),metalness:.55,roughness:.78}),metal=std({color:lin(0x9aa0a6),metalness:.95,roughness:.25}),
    wh=std({color:lin(0xdfe3e6),roughness:.5,metalness:.3}),red=std({color:lin(0xb3261c),roughness:.6,metalness:.2,side:THREE.DoubleSide}),glass=std({color:lin(0x4a3a12),metalness:.95,roughness:.06});glass.envMapIntensity=2;
  const UP=new V3(0,1,0);
  const A=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x||0,y||0,z||0);o.castShadow=true;g.add(o);return o;};
  const L=(secs,m,ns)=>{const o=new THREE.Mesh(loft(secs,ns),m);o.castShadow=true;g.add(o);return o;};
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
    L([foil(new V3(s*2.5,.12,-4.6),6.0,.05,UP),foil(new V3(s*.7,.2,-9.6),5.2,.03,UP)],top,true);   // 中央胴体の側面から始まる（根元の蓋が胴体の蓋と重なっていた）
    // エンジン：吸気口（斜めの口と境界層の隙間）、胴、可変ノズル、噴射
    const ex=s*1.3,ey=-.55;
    A(new THREE.BoxGeometry(1.3,1.15,3.4),bot,ex,ey,-2.2);{const lip=A(new THREE.BoxGeometry(1.34,1.19,.5),bot,ex,ey+.12,-4.05);lip.rotation.x=.42;}
    A(new THREE.BoxGeometry(1.1,.95,.06),dk,ex,ey+.02,-3.86).rotation.x=.42;
    A(new THREE.BoxGeometry(1.3,.08,2.4),dk,ex,ey+.62,-2.6);
    A(latheZ([[-.6,.72],[1.5,.86],[5,.88],[8,.8],[9.3,.74]],18),bot,ex,ey+.12,0);
    A(latheZ([[9.3,.76],[10.0,.72],[10.9,.6]],18),hot,ex,ey+.12,0);
    for(let k=0;k<12;k++){const a=k/12*6.283,p=A(new THREE.BoxGeometry(.3,.07,1.0),flap,ex+Math.cos(a)*.66,ey+.12+Math.sin(a)*.66,10.4);p.rotation.z=a+Math.PI/2;}
    A(new THREE.CircleGeometry(.55,16),new THREE.MeshBasicMaterial({color:new THREE.Color(4.2,2.0,.7)}),ex,ey+.12,10.5);
    const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(1.3,.65,.25),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));gl.position.set(ex,ey+.12,11.5);gl.scale.set(5,5,1);g.add(glowLOD(gl,30,.3));(ud.glows=ud.glows||[]).push(gl);
    {const pg=new THREE.CylinderGeometry(.12,.56,1,14,1,true);pg.translate(0,.5,0);pg.rotateX(Math.PI/2);const pl=new THREE.Mesh(pg,new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,.75,.35),transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));pl.position.set(ex,ey+.12,10.9);pl.frustumCulled=false;g.add(pl);(ud.plumes=ud.plumes||[]).push(pl);}
    // 主翼（後退角 42°、わずかな下反角）と動翼の線、翼端のランチャー
    L([foil(new V3(s*2.5,.1,-3.2),8.6,.05,UP),foil(new V3(s*5.2,.04,-.6),5.4,.045,UP),foil(new V3(s*8.0,-.04,2.2),2.4,.04,UP)],top,true);
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
    L([foil(new V3(s*1.9,-1.0,6.6),2.6,.05,new V3(1,0,0)),foil(new V3(s*2.2,-2.1,7.4),1.3,.04,new V3(1,0,0))],bot);   // 腹びれの根元をエンジンの下面に付ける（15cm 浮いていた）
    // 標識（主翼上面と垂直尾翼の外側）
    {const dm=new THREE.MeshStandardMaterial({map:fighterDecal(),alphaTest:.5,roughness:.6,metalness:.1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3});ENVMATS.push(dm);
      const d1=A(new THREE.PlaneGeometry(2.8,1.4),dm,s*5.0,.25,1.3);d1.rotation.x=-Math.PI/2;d1.castShadow=false;
      const n=new V3(s*.97,-.24,0).normalize(),u=new V3(s*.24,.97,0).normalize(),xa=new V3().crossVectors(u,n);
      const d2=A(new THREE.PlaneGeometry(2.0,1.0),dm,s*2.48,2.5,7.75);d2.position.addScaledVector(n,.088);d2.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xa,u,n));d2.castShadow=false;}
    // 兵装：翼下のパイロン 2 つと翼端。ミサイルは胴・前後の小翼・先端のシーカー
    const missile=(x,y,z,len)=>{const m=A(new THREE.CylinderGeometry(.1,.1,len,10),wh,x,y,z);m.rotation.x=Math.PI/2;A(new THREE.SphereGeometry(.1,10,8),dk,x,y,z-len/2);
      for(const[fz,fs]of[[len/2-.25,.34],[-len/2+.9,.2]])for(const a of[Math.PI/4,-Math.PI/4]){const f=A(new THREE.BoxGeometry(fs*2,.02,a>0?.42:.4),wh,x,y,z+fz);f.rotation.z=a;}};   // 十字の小翼の前後の面が重ならないよう片方を少し短く
    for(const[mx,mz,my,ln]of[[4.0,.6,-.52,3.6],[6.0,1.9,-.5,3.0]]){A(new THREE.BoxGeometry(.1,.34,1.6),bot,s*mx,my+.24,mz);missile(s*mx,my,mz,ln);}
    missile(s*8.05,-.2,3.1,2.9);
    // 翼端灯と編隊灯
    const nv=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:s>0?new THREE.Color(.1,1.6,.3):new THREE.Color(1.9,.12,.08),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));nv.position.set(s*8.1,0,4.6);nv.scale.set(1.2,1.2,1);g.add(glowLOD(nv,70,.18));
    {const fm=A(new THREE.BoxGeometry(.03,.08,1.2),new THREE.MeshBasicMaterial({color:new THREE.Color(.5,.9,.3)}),s*1.02,.35,-10.4);fm.castShadow=false;fm.userData.snap=1;}
  }
  // 腹：機関砲の覆い、増槽、アンテナ
  A(new THREE.BoxGeometry(.24,.2,2.6),dk,.95,.55,-8.6);
  {const t=A(latheZ([[-3.2,.02],[-2.6,.34],[0,.46],[2.4,.36],[3.2,.02]],14),bot,0,-1.25,1.4);A(new THREE.BoxGeometry(.14,.5,1.8),bot,0,-.75,1.4);}
  for(const[z,y]of[[-3.6,1.35],[2.2,.72]])A(new THREE.BoxGeometry(.04,.42,.5),dk,0,y,z);
  // 衝突防止灯
  const bc=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(2.2,.18,.1),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));bc.position.set(0,1.0,3.5);bc.scale.set(1.5,1.5,1);g.add(glowLOD(bc,70,.18));ud.beacon=bc;
  snapParts(g);g.traverse(o=>{if(o.isMesh)o.frustumCulled=false;});
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
  g.userData.dyn=1;g.userData.push=kind;   /* 探検のボートで押せるよう、まとめずに 1 台ずつ残す（台の中はまとめる） */
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
  }else if(kind==='car'){ // 乗用車：横から見た輪郭を押し出した丸みのある車体、窓の箱と柱・屋根、輪のくぼみ、5 本スポークの車輪、灯火、扉の継ぎ目
    paint.roughness=.26;paint.metalness=.55;paint.envMapIntensity=1.4;
    const ext=(pts,w,bev,m,holes)=>{const sh=new THREE.Shape(pts.map(q=>new THREE.Vector2(q[0],q[1])));if(holes)for(const h of holes)sh.holes.push(h);
      const ge=new THREE.ExtrudeGeometry(sh,{depth:w-bev*2,bevelEnabled:true,bevelThickness:bev,bevelSize:bev*.8,bevelSegments:3,curveSegments:10});ge.translate(0,0,-(w-bev*2)/2);ge.rotateY(-Math.PI/2);ge.computeVertexNormals();const o=new THREE.Mesh(ge,m);g.add(o);return o;};
    // 下の車体（輪のところはくり抜く）
    const arch=(z0,r)=>{const pp=[];for(let k=0;k<=12;k++){const a=Math.PI*k/12;pp.push([z0+Math.cos(a)*r,.3+Math.sin(a)*r*.95]);}return pp;};
    {const pts=[[-2.22,.34],[-2.27,.52],[-2.2,.74],[-2.0,.84],[-1.0,.95],[1.55,.98],[2.12,.92],[2.24,.74],[2.24,.45],[2.15,.34]];const a1=arch(1.35,.43),a2=arch(-1.4,.43);
      ext([...pts,[1.78,.34],...a1.slice(1,-1),[.92,.34],[-.97,.34],...a2.slice(1,-1),[-1.83,.34]],1.82,.1,paint);}
    // 窓の箱：ガラス、上に屋根、柱
    ext([[-.98,.93],[-.2,1.42],[.92,1.44],[1.58,.96]],1.6,.06,M.glass);
    {const rf=ext([[-.24,1.4],[-.2,1.47],[.94,1.49],[.9,1.42]],1.64,.04,paint);}
    for(const sx of[-1,1]){const ap=B(.06,.07,.92,paint,sx*.79,1.18,-.6);ap.rotation.x=-.59;const cp=B(.06,.07,.82,paint,sx*.79,1.2,1.24);cp.rotation.x=.65;B(.06,.5,.1,paint,sx*.8,1.19,.36);
      B(.02,.03,2.4,M.dark,sx*.8,.97,.25);   // 窓の下の縁
      for(const z of[-.95,.36,1.45])B(.012,.55,.015,M.dark,sx*.915,.66,z);B(.012,.012,2.4,M.dark,sx*.915,.4,.25);   // 扉の継ぎ目
      for(const z of[-.25,1.05])B(.02,.04,.18,M.steel,sx*.92,.86,z);   // 取っ手
      const mi=B(.2,.12,.08,paint,sx*.98,1.02,-.85);B(.02,.1,.06,M.glass,sx*1.08,1.02,-.81);
      // 灯火：前は横長の前照灯と方向指示器、後ろは車体の角を回る尾灯
      const hl=B(.42,.12,.08,M.head,sx*.58,.72,-2.2);hl.rotation.x=-.35;B(.14,.06,.06,M.amber,sx*.84,.66,-2.17);
      B(.36,.12,.06,M.tail,sx*.62,.8,2.24);B(.05,.12,.24,M.tail,sx*.9,.8,2.12);}
    B(.7,.16,.05,M.dark,0,.58,-2.25);B(.52,.12,.02,M.white,0,.42,-2.3);B(.52,.12,.02,M.white,0,.58,2.27);B(1.86,.12,.16,M.dark,0,.38,-2.18);B(1.86,.12,.16,M.dark,0,.4,2.18);
    B(1.5,.36,3.6,M.dark,0,.5,0);   // 車輪のくぼみの奥と床下
    // 車輪：丸いタイヤ、5 本スポーク、中心
    for(const z of[-1.4,1.35])for(const sx of[-1,1]){const w=new THREE.Group();w.position.set(sx*.8,.34,z);g.add(w);
      const t=new THREE.Mesh(new THREE.TorusGeometry(.25,.1,10,24),M.tire);t.rotation.y=Math.PI/2;t.scale.z=1.15;w.add(t);
      const rim=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.16,20),M.hub);rim.rotation.z=Math.PI/2;w.add(rim);
      for(let k=0;k<5;k++){const sp=new THREE.Mesh(new THREE.BoxGeometry(.03,.16,.045),M.steel);sp.position.set(sx*.085,Math.cos(k*1.2566)*.1,Math.sin(k*1.2566)*.1);sp.rotation.x=-k*1.2566;w.add(sp);}
      const hb=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.05,10),M.dark);hb.rotation.z=Math.PI/2;hb.position.x=sx*.09;w.add(hb);}
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
// 2 点 a・b を結ぶ角材（太さ w、奥行き d）。両端を太さの半分だけ延ばして、つなぎ目にすき間を出さない
function beam(par,a,b,w,m,d){const v=new V3().subVectors(b,a),L=v.length()+w;const o=new THREE.Mesh(new THREE.BoxGeometry(w,L,d||w),m);o.position.copy(a).add(b).multiplyScalar(.5);
  o.quaternion.setFromUnitVectors(new V3(0,1,0),v.normalize());o.castShadow=true;par.add(o);return o;}
// 消波ブロック：中心から四面体の頂点方向へ伸びる 4 本の脚
function tetrapodGeo(){const dirs=[[1,1,1],[-1,-1,1],[-1,1,-1],[1,-1,-1]].map(v=>new V3(...v).normalize()),P=[],N=[];
  for(const d of dirs){const c=new THREE.CylinderGeometry(.28,.5,1.1,9,1);c.translate(0,.55,0);c.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0,1,0),d)));const g=c.toNonIndexed();P.push(...g.attributes.position.array);N.push(...g.attributes.normal.array);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));
  const uv=[];for(let i=0;i<P.length/3;i++)uv.push(P[i*3]+P[i*3+2],P[i*3+1]);g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;}
let CONCTEX;function concreteTex(){if(CONCTEX)return CONCTEX;const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),r=mulberry(77);x.fillStyle='#b8b5ae';x.fillRect(0,0,128,128);
  for(let i=0;i<500;i++){const g=150+r()*70|0;x.fillStyle='rgba('+g+','+(g-2)+','+(g-6)+','+(.1+r()*.2)+')';x.fillRect(r()*128,r()*128,1+r()*4,1+r()*4);}for(let i=0;i<30;i++){x.fillStyle='rgba(60,70,50,'+(r()*.18)+')';x.beginPath();x.arc(r()*128,r()*128,3+r()*10,0,7);x.fill();}
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;return CONCTEX=t;}
// 岸壁の海側の面（幅 24m 分で繰り返す）。上ほど乾いた灰色、喫水線のあたりは濡れて黒く、海藻の緑と貝の白い粒
function quayFaceTex(){const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d'),r=mulberry(91),H=256,Y=y=>H*(1-(y+4.5)/(4.6+4.5));
  x.fillStyle='#9d9a92';x.fillRect(0,0,512,H);for(let i=0;i<14;i++){x.fillStyle='rgba(0,0,0,.12)';x.fillRect(i*36.6,0,2,H);}x.fillStyle='rgba(0,0,0,.18)';x.fillRect(0,Y(3.8),512,2);
  for(let i=0;i<70;i++){const X=r()*512,g=x.createLinearGradient(0,Y(4.4),0,Y(.8));g.addColorStop(0,'rgba(60,50,40,'+(r()*.25)+')');g.addColorStop(1,'rgba(60,50,40,0)');x.fillStyle=g;x.fillRect(X,Y(4.4),2+r()*5,Y(.8)-Y(4.4));}
  const w=x.createLinearGradient(0,Y(1.6),0,Y(-.2));w.addColorStop(0,'rgba(40,42,38,0)');w.addColorStop(.6,'rgba(36,40,34,.75)');w.addColorStop(1,'rgba(30,36,28,.95)');x.fillStyle=w;x.fillRect(0,Y(1.6),512,H-Y(1.6));
  for(let i=0;i<400;i++){x.fillStyle=r()<.7?'rgba(52,78,40,'+(.3+r()*.4)+')':'rgba(200,196,180,'+(.3+r()*.4)+')';x.fillRect(r()*512,Y(.7)+r()*(Y(-.6)-Y(.7)),2+r()*5,1+r()*3);}
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=THREE.RepeatWrapping;t.anisotropy=8;return t;}
function buildPort(B,M){
  const{darkM,paleM,box,conc,glassM}=M,r=mulberry(1717);
  const col=(h,ro,me)=>std({color:lin(h),roughness:ro===undefined?.7:ro,metalness:me===undefined?.2:me});
  const steel=col(0x8b9298,.4,.8),rust=col(0x7a4a2e,.85,.3),yel=col(0xd9a21b,.55,.3),red=col(0xb3261c,.6,.2),grn=col(0x1f8a4c,.6,.2),wht=col(0xe6e4dc,.7,.05),asph=col(0x3c3e41,.92,0),quayM=col(0x9a9890,.9,0);
  const QY=4.6,X0=1105,X1=1292,Z0=-170,Z1=470;
  // 岸壁（上面は舗装、海側に防舷材と車止め）
  box(B,X1-X0,24,Z1-Z0,quayM,(X0+X1)/2,QY-12,(Z0+Z1)/2,true);   /* 浚渫した泊地（15m）の底まで届く岸壁 */{const c=document.createElement('canvas');c.width=1024;c.height=2048;const x=c.getContext('2d');x.scale(2,2);x.fillStyle='#46484a';x.fillRect(0,0,512,1024);
    for(let i=0;i<2600;i++){const g=52+r()*36|0;x.fillStyle='rgba('+g+','+g+','+(g+2)+','+(.05+r()*.08)+')';x.fillRect(r()*512,r()*1024,6+r()*60,6+r()*60);}
    x.strokeStyle='rgba(20,21,22,.7)';x.lineWidth=1.5;for(let i=1;i<10;i++){x.beginPath();x.moveTo(i*51.2,0);x.lineTo(i*51.2,1024);x.stroke();}for(let j=1;j<32;j++){x.beginPath();x.moveTo(0,j*32);x.lineTo(512,j*32);x.stroke();}
    for(let i=0;i<50;i++){x.fillStyle='rgba(10,10,11,'+(.1+r()*.25)+')';x.beginPath();x.ellipse(r()*512,r()*1024,8+r()*40,6+r()*26,r()*3,0,7);x.fill();}
    x.strokeStyle='#d9a21b';x.lineWidth=3;x.strokeRect(420,10,60,1004);x.setLineDash([14,10]);x.beginPath();x.moveTo(330,0);x.lineTo(330,1024);x.moveTo(120,0);x.lineTo(120,1024);x.stroke();x.setLineDash([]);
    for(let i=0;i<60;i++){x.fillStyle=i%2?'#d9a21b':'#17191a';x.beginPath();x.moveTo(498,i*18);x.lineTo(512,i*18);x.lineTo(512,i*18+18);x.lineTo(498,i*18+18);x.fill();}
    // 6m ごとの舗装の目地、タイヤの跡、油の染み
    x.strokeStyle='rgba(18,19,20,.28)';x.lineWidth=.6;for(let X=0;X<512;X+=512/187*6){x.beginPath();x.moveTo(X,0);x.lineTo(X,1024);x.stroke();}for(let Y=0;Y<1024;Y+=1024/640*6){x.beginPath();x.moveTo(0,Y);x.lineTo(512,Y);x.stroke();}
    for(let i=0;i<160;i++){const X=r()*512,Y=r()*1024,L=40+r()*200,a=(r()-.5)*.6;x.strokeStyle='rgba(14,14,15,'+(.05+r()*.08)+')';x.lineWidth=1+r()*1.2;for(const o of[0,3.2]){x.beginPath();x.moveTo(X+o,Y);x.quadraticCurveTo(X+o+Math.sin(a)*L*.5+(r()-.5)*30,Y+L*.5,X+o+Math.sin(a)*L,Y+L);x.stroke();}}
    for(let i=0;i<120;i++){x.fillStyle='rgba(12,12,10,'+(.04+r()*.12)+')';x.beginPath();x.ellipse(r()*512,r()*1024,1+r()*7,1+r()*5,r()*3,0,7);x.fill();}
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;
    const p=new THREE.Mesh(new THREE.PlaneGeometry(X1-X0-2,Z1-Z0-2),std({map:t,roughness:.85,metalness:.05}));p.rotation.x=-Math.PI/2;p.position.set((X0+X1)/2,QY+.03,(Z0+Z1)/2);p.receiveShadow=true;B.add(p);}
  box(B,.6,.5,Z1-Z0,yel,X1-1,QY+.25,(Z0+Z1)/2);
  for(let z=Z0+12;z<Z1;z+=16){const f=new THREE.Mesh(new THREE.CylinderGeometry(1.0,1.0,3.2,10),darkM);f.position.set(X1+.5,QY-2.4,z);B.add(f);}
  {const fm=std({map:quayFaceTex(),roughness:.9,metalness:0});const face=(x0,z0,x1,z1)=>{const L=Math.hypot(x1-x0,z1-z0),pg=new THREE.PlaneGeometry(L,QY+4.5);const uv=pg.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,uv.getX(i)*L/24);
      const m=new THREE.Mesh(pg,fm);m.position.set((x0+x1)/2,(QY-4.5)/2,(z0+z1)/2);m.rotation.y=Math.atan2(x1-x0,z1-z0)-Math.PI/2;B.add(m);};
    face(X1+.08,Z1,X1+.08,Z0);for(const pz of[20,330]){face(X1,pz+10.1,X1+170,pz+10.1);face(X1+170,pz-10.1,X1,pz-10.1);face(X1+170.1,pz+10,X1+170.1,pz-10);}}
  // 突堤 2 本
  for(const pz of[20,330]){box(B,170,14,20,quayM,X1+85,QY-7.6,pz,true);box(B,170,.4,.5,yel,X1+85,QY-.4,pz-9.6);box(B,170,.4,.5,yel,X1+85,QY-.4,pz+9.6);
    for(let k=0;k<7;k++){const pl=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,16,8),rust);pl.position.set(X1+14+k*25,QY-9,pz+10.4);B.add(pl);const p2=pl.clone();p2.position.z=pz-10.4;B.add(p2);}}
  // 係船柱（一括描画）
  {const bg=new THREE.CylinderGeometry(.34,.44,.9,8),im=new THREE.InstancedMesh(bg,darkM,120),d=new THREE.Object3D();let n=0;const put=(x,z)=>{d.position.set(x,QY+.45,z);d.updateMatrix();im.setMatrixAt(n++,d.matrix);};
    for(let z=Z0+10;z<Z1;z+=18)put(X1-3,z);for(const pz of[20,330])for(let k=0;k<9;k++){put(X1+12+k*18,pz-8.4);put(X1+12+k*18,pz+8.4);}im.count=n;B.add(im);}
  // 石積みの防波堤：芯のコンクリートと、外側に積んだ捨て石（一括描画）
  const segs=[[X1-10,-250,1640,-150],[1640,-150,1668,40],[X1-10,560,1640,440],[1640,440,1668,250]];
  {const rg=tetrapodGeo(),im=new THREE.InstancedMesh(rg,std({color:lin(0x8f8c85),roughness:.95,metalness:0,map:concreteTex()}),900),d=new THREE.Object3D();let n=0;
    for(const[ax,az,bx,bz]of segs){const L=Math.hypot(bx-ax,bz-az),ang=Math.atan2(bz-az,bx-ax),m=box(B,L+8,12,9,quayM,(ax+bx)/2,-2.6,(az+bz)/2,true);m.rotation.y=-ang;
      const w=box(B,L+8,1.2,2.2,quayM,(ax+bx)/2,3.9,(az+bz)/2);w.rotation.y=-ang;
      for(let t=0;t<L;t+=3.2)for(const side of[-1,1])for(let row=0;row<2;row++){if(n>=900)break;const u=t/L,off=side*(5.5+row*3.2+r()*1.5);d.position.set(ax+(bx-ax)*u-Math.sin(ang)*off,1.6-row*2.2+r()*.8,az+(bz-az)*u+Math.cos(ang)*off);const sc=1.6+r()*.5;d.scale.set(sc,sc,sc);d.rotation.set(r()*3,r()*3,r()*3);d.updateMatrix();im.setMatrixAt(n++,d.matrix);}}
    im.count=n;im.castShadow=true;im.userData.exCol=1;B.add(im);
    // 港内の護岸：岸壁の端から防波堤の付け根までの水際に消波ブロックを積む（砂浜のままにしない）
    {const rv=new THREE.InstancedMesh(rg,im.material,700);let m=0;for(let z=-290;z<=600;z+=2.6)for(let x=1150;x<=1560;x+=2.6){if(m>=700)break;const jx=x+(r()-.5)*1.6,jz=z+(r()-.5)*1.6,k=harbRev(jx,jz);if(k<.5)continue;if(jx<X1+2&&jz>Z0-1&&jz<Z1+1)continue;
        const h=islandH(jx,jz);if(h<-3.2||h>2.6)continue;const sc=1.5+r()*.6;d.position.set(jx,Math.max(h,-3)+sc*.45,jz);d.scale.set(sc,sc,sc);d.rotation.set(r()*3,r()*3,r()*3);d.updateMatrix();rv.setMatrixAt(m++,d.matrix);}
      rv.count=m;rv.castShadow=true;rv.receiveShadow=true;rv.userData.exCol=1;B.add(rv);}}
  // 港口の標識灯（左舷側は赤、右舷側は緑）
  for(const[x,z,m,c]of[[1668,44,red,[3.5,.25,.15]],[1668,246,grn,[.25,3.2,.6]]]){const t=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.7,11,12),m);t.position.set(x,9,z);t.castShadow=true;B.add(t);box(B,3.2,.3,3.2,darkM,x,14.6,z);
    const lamp=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,1.2,10),new THREE.MeshBasicMaterial({color:new THREE.Color(c[0],c[1],c[2])}));lamp.position.set(x,15.4,z);B.add(lamp);
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(c[0],c[1],c[2]),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.position.set(x,15.4,z);sp.scale.set(7,7,1);B.add(sp);}
  // 門型クレーン 2 基（脚・桁・海へ張り出す腕・運転室・つり具）
  // 岸壁クレーン：部材はすべて 2 点を結ぶ梁で組む（端が柱や桁にきちんと届くように）。x＋が海側
  const crane=(cz,hex)=>{const g=new THREE.Group();g.position.set(X1-16,QY,cz);B.add(g);g.userData.unit={kind:1,pivot:[-10,-12,10,12]};const pm=col(hex,.5,.4),wh2=col(0xd9d8d2,.55,.3);const P=(x,y,z)=>new V3(x,y,z);
    const A=(w,h,d,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
    const bm=(p,q,w,m,d)=>beam(g,p,q,w,m||pm,d);
    const LX=[-9,9],LZ=[-11,11],HT=34,GY=37;
    // 脚・台車・敷居梁・門形梁・X 字の筋交い（各側面）
    for(const x of LX)for(const z of LZ){bm(P(x,1.2,z),P(x,HT,z),1.5);A(2.6,1.2,3.6,darkM,x,.6,z);for(const dz of[-1.1,1.1])A(.9,.9,.9,darkM,x,.45,z+dz);}
    for(const z of LZ){bm(P(-9,2.2,z),P(9,2.2,z),1.2);bm(P(-9,13,z),P(9,13,z),1.3);bm(P(-9,HT,z),P(9,HT,z),1.6);bm(P(-9,13,z),P(9,HT,z),.9);bm(P(9,13,z),P(-9,HT,z),.9);}
    for(const x of LX){bm(P(x,HT,-11),P(x,HT,11),1.6);bm(P(x,13,-11),P(x,13,11),1.1);}
    // 桁（陸側の後ろ張り出し〜海側のブーム）。左右 2 本と横つなぎ、脚の頂部から桁への束
    const X0=-30,X2=62,GZ=[-4.5,4.5];for(const z of GZ){bm(P(X0,GY,z),P(X2,GY,z),2.2,pm,2.4);for(const x of LX)bm(P(x,HT,z),P(x,GY-1,z),1.1);}
    for(let x=X0;x<=X2;x+=9.2)bm(P(x,GY,-4.5),P(x,GY,4.5),.8);
    for(let x=X0;x<X2-9;x+=18.4){bm(P(x,GY,-4.5),P(x+9.2,GY,4.5),.5);}
    // 頂部の A 形の塔と、そこから桁を吊るステー（前 2 本・後ろ 1 本）
    const AP=GY+19;for(const z of GZ){bm(P(-9,GY+1,z),P(-2,AP,z),1.3);bm(P(9,GY+1,z),P(-2,AP,z),1.3);
      bm(P(-2,AP,z),P(30,GY+1,z),.55,wh2);bm(P(-2,AP,z),P(54,GY+1,z),.55,wh2);bm(P(-2,AP,z),P(X0+1,GY+1,z),.55,wh2);}
    bm(P(-2,AP,-4.5),P(-2,AP,4.5),1.3);bm(P(-5.5,GY+9.5,-4.5),P(-5.5,GY+9.5,4.5),.9);
    // 機械室（後ろ張り出しの上）と手すり
    A(11,5,9.6,wh2,-22,GY+3.6,0);A(11.4,.4,10,pm,-22,GY+6.3,0);for(const z of GZ)A(X2-X0,.08,.08,steel,(X0+X2)/2,GY+2.1,z*1.12);
    // 横行台車（運転室・つり索・つり具・荷）。game.js の animPort が動かす
    const tro=new THREE.Group();tro.userData.dyn=1;tro.userData.noMerge=1;g.add(tro);const T2=(m)=>{g.remove(m);tro.add(m);return m;};
    T2(A(5,1.6,10.6,darkM,36,GY-1.8,0));T2(A(4.4,3,4.4,wh2,36,GY-4.1,-4.4));T2(A(4.5,1.4,.1,glassM,36,GY-4.3,-6.66));
    const r1=T2(A(.14,1,.14,steel,36,26,-1.6)),r2=T2(A(.14,1,.14,steel,36,26,1.6)),sp=T2(A(6.4,.7,12.6,yel,36,16.8,0));
    const bx=new THREE.Mesh(new THREE.BoxGeometry(2.44,2.59,12.19),containerMat());bx.position.set(0,-1.65,0);sp.add(bx);
    g.userData.anim={tro,sp,r:[r1,r2],bx,ph:cz*.013};return g;};
  const cranes=[crane(60,0xa8442e),crane(230,0x2f7891)];
  // クレーンの走行レール
  for(const rx of[X1-25,X1-7])box(B,.25,.14,Z1-Z0-30,steel,rx,QY+.1,(Z0+Z1)/2);
  // コンテナの山（色つきの一括描画）
  {const cg=new THREE.BoxGeometry(2.44,2.59,6.06),cm=containerMat();const im=new THREE.InstancedMesh(cg,cm,2600),d=new THREE.Object3D(),cc=new THREE.Color();let n=0;
    const pal=[0xa8321e,0x1f5f8a,0x2f7a4a,0xc98a1c,0x7a7f84,0x8a3a5a,0xd8d4c8,0x244a6a];
    // ヤード：2 列×10 区画のブロック（各 6 列×8 個）。区画の端ほど低く、ところどころ空き
    const blocks=[];for(const bx of[1164,1190])for(let bz=-112;bz+7*6.5+3.2<=Z1-8;bz+=60)if(!(bz>100&&bz<230&&bx<1170))blocks.push([bx,bz,6,8]);   /* 岸壁の端（Z1）から 8m 内側まで。列の間は車とボートが通れる 7m */
    const cb=[];
    for(const[bx,bz,nx,nz]of blocks){const i0=n;let top=QY;
    for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const edge=j===0||j===nz-1;const hh=r()<.08?0:Math.min(4,1+Math.floor(r()*3.2)+(edge?-1:0)+(r()<.25?1:0));for(let k=0;k<hh&&n<2600;k++){d.position.set(bx+i*2.75,QY+1.3+k*2.62,bz+j*6.5);d.rotation.set(0,0,0);d.scale.set(1,1,1);d.updateMatrix();im.setMatrixAt(n,d.matrix);cc.copy(CONT_PAL[Math.floor(r()*CONT_PAL.length)]);im.setColorAt(n,cc);n++;top=Math.max(top,QY+k*2.62+2.6);}}
      if(n>i0)cb.push({i0,i1:n,box:[bx-1.4,QY,bz-3.2,bx+(nx-1)*2.75+1.4,top,bz+(nz-1)*6.5+3.2]});}
    im.count=n;B.userData.cont={im,blocks:cb};im.castShadow=true;im.receiveShadow=true;B.add(im);}
  {const ym=std({color:lin(0xd2a52a),roughness:.55,metalness:.4}),dm=darkM;
    for(const[bx,bz]of[[1166,-112],[1188,128],[1166,308]]){const g=new THREE.Group();g.position.set(bx+6.9,QY,bz+20);g.userData.z0=bz+20;g.userData.dyn=1;(B.userData.rtgs=B.userData.rtgs||[]).push(g);B.add(g);const A=(w,h,d,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
      for(const sx of[-11,11])for(const sz of[-6,6]){A(.9,18,.9,ym,sx,9,sz);A(1.6,1.4,2.4,dm,sx,.9,sz);}for(const sx of[-11,11])A(.9,1.2,13,ym,sx,1.8,0);for(const sz of[-6,6])A(23,1.6,1.2,ym,0,18.6,sz);
      A(4,2.4,13,ym,3,19.8,0);A(2.6,2.2,2.6,std({color:lin(0xe8e8e2),roughness:.6}),-9,16.4,6.4);A(.12,10,.12,dm,3,13,-1);A(.12,10,.12,dm,3,13,1);A(2.6,.5,12.4,ym,3,8.2,0);}}
  // 上屋 2 棟（切妻屋根、海側に大きな引き戸）と港務所
  const shedM=std({roughness:.75,metalness:.25,map:(()=>{const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');x.fillStyle='#d9d6cb';x.fillRect(0,0,512,128);for(let i=0;i<128;i++){x.fillStyle=i%2?'rgba(0,0,0,.12)':'rgba(255,255,255,.05)';x.fillRect(i*4,0,2,128);}x.fillStyle='#3d6f78';x.fillRect(0,96,512,32);for(let i=0;i<40;i++){const X=r()*512,g=x.createLinearGradient(0,0,0,90);g.addColorStop(0,'rgba(92,52,24,.3)');g.addColorStop(1,'rgba(92,52,24,0)');x.fillStyle=g;x.fillRect(X,r()*30,2+r()*3,90);}x.fillStyle='rgba(30,40,46,.85)';x.font='bold 56px Arial';x.fillText('SHED',40,72);x.fillText('MIZUHA PORT',250,72);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return t;})()});
  for(const[wx,wz,L]of[[1130,160,90],[1130,410,70]]){box(B,26,9,L,shedM,wx,QY+4.5,wz,true);const rg=new THREE.CylinderGeometry(15.2,15.2,L+2,3,1);rg.rotateX(Math.PI/2);rg.rotateZ(Math.PI);rg.scale(1,.3,1);const rf=new THREE.Mesh(rg,col(0x5f7f86,.6,.5));rf.position.set(wx,QY+11.3,wz);rf.castShadow=true;B.add(rf);
    for(let k=0;k<Math.floor(L/22);k++)box(B,.3,6.5,10,col(0x4a5a60,.6,.5),wx+13.1,QY+3.3,wz-L/2+14+k*22);}
  box(B,14,10,12,wht,1125,QY+5,-130,true);box(B,15,.5,13,col(0x8a3a2a),1125,QY+10.2,-130);box(B,10,6,.2,glassM,1132.1,QY+6,-130).rotation.y=Math.PI/2;box(B,5,4,5,wht,1125,QY+12.5,-130,true);box(B,5.2,1.6,5.2,glassM,1125,QY+13.2,-130);
  // 燃料タンク 3 基と配管
  for(let k=0;k<3;k++){const t=new THREE.Mesh(new THREE.CylinderGeometry(7,7,11,24),wht);t.position.set(1128,QY+5.5,-60+k*19);t.castShadow=true;B.add(t);const top=new THREE.Mesh(new THREE.SphereGeometry(7,24,8,0,6.3,0,1.2),wht);top.scale.y=.3;top.position.set(1128,QY+11-7*Math.cos(1.2)*.3,-60+k*19);B.add(top);
    const st=new THREE.Mesh(new THREE.TorusGeometry(7.05,.12,6,28),yel);st.rotation.x=Math.PI/2;st.position.set(1128,QY+8,-60+k*19);B.add(st);}
  {const H=5.6,ZP=-128,XP=1138;   /* 配管橋：タンクの脇から北へ（コンテナ区画の外側）→ 岸壁まで東へ。車とボートが下をくぐれる高さ */
    const run=(x0,z0,x1,z1)=>{const L=Math.hypot(x1-x0,z1-z0),a=Math.atan2(x1-x0,z1-z0);for(const o of[-.35,.35]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,L,10),steel);p.rotation.order='YXZ';p.rotation.set(Math.PI/2,a,0);p.position.set((x0+x1)/2+Math.cos(a)*o,QY+H+.25,(z0+z1)/2-Math.sin(a)*o);B.add(p);}
      const n=Math.max(1,Math.round(L/12));for(let k=0;k<=n;k++){const t=k/n,x=x0+(x1-x0)*t,z=z0+(z1-z0)*t,ca=Math.cos(a),sa=Math.sin(a);for(const sd of[-1,1])box(B,.3,H,.3,darkM,x+ca*sd,QY+H/2,z-sa*sd);const cb=box(B,2.3,.3,.3,darkM,x,QY+H,z);cb.rotation.y=a;}};
    run(XP,-58,XP,ZP);run(XP,ZP,1284,ZP);
    for(let k=0;k<3;k++){const v=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,H-3,8),steel);v.position.set(XP-.6,QY+3+(H-3)/2,-60+k*19);B.add(v);const h2=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,3.2,8),steel);h2.rotation.z=Math.PI/2;h2.position.set(XP-2.2,QY+3.2,-60+k*19);B.add(h2);}}
  // 水面に映す灯り：[x,z,高さ,色]（game.js が夕方に水面の縦の光の帯を出す）
  B.userData.refl=[[1668,44,15.4,[3.5,.25,.15]],[1668,246,15.4,[.25,3.2,.6]],[X1+2,60,QY+35,[2.4,2.2,1.7]],[X1+2,230,QY+35,[2.4,2.2,1.7]],[X1-1,-150,QY+30,[2.6,2.4,1.9]],[X1-1,120,QY+30,[2.6,2.4,1.9]],[X1-1,300,QY+30,[2.6,2.4,1.9]],[X1-1,455,QY+30,[2.6,2.4,1.9]],[X1+44,60,QY+38,[3.4,.25,.15]],[X1+44,230,QY+38,[3.4,.25,.15]]];
  // 照明塔 4 基
  for(const[lx,lz]of[[1160,-150],[1160,120],[1160,300],[1160,455]]){box(B,.5,30,.5,steel,lx,QY+15,lz);box(B,5,1.2,.6,darkM,lx,QY+30.4,lz);
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(2.6,2.4,1.9),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.position.set(lx,QY+30.4,lz);sp.scale.set(7,7,1);B.add(sp);}
  // 係留中の船：岸壁に貨物船、突堤に巡視船と漁船
  // 基地の一部（建物）にすると崩れ方が建物になるので、ここでは置き場所だけ記録し、game.js で「止まっている船」として作る（撃てば沈む）
  B.userData.moored=[['cargo',X1+17,150,0],['patrol',X1+70,20+17,Math.PI/2],['fish',X1+50,330-15,Math.PI/2],['fish',X1+95,330-15,-Math.PI/2],['fish',X1+130,330+15,Math.PI/2]];
  // クレーンの航空障害灯と作業灯
  for(const cz of[60,230]){for(const[x,y]of[[X1-18,QY+57],[X1+46,QY+38.6],[X1-46,QY+38.6]]){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(3.4,.25,.15),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.position.set(x,y,cz);sp.scale.set(5,5,1);B.add(sp);}
    for(const x of[X1-6,X1+14,X1+34]){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(2.4,2.2,1.7),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.position.set(x,QY+35,cz);sp.scale.set(3.5,3.5,1);B.add(sp);}
    // はしごと踊り場
    box(B,.9,34,.12,steel,X1-25.8,QY+17,cz-11);for(let k=0;k<3;k++)box(B,2.4,.15,2.4,steel,X1-26.4,QY+9+k*9,cz-11);}
  // 構内の車両と荷
  for(const[k,x,z,c,ry]of[['tug',1215,-40,0xd9a21b,.4],['fuel',1150,-20,0xc9ced2,0],['car',1140,-150,0x2c4f7a,1.57],['car',1146,-150,0xc9ced2,1.57],['gpu',1212,330,0xd9a21b,.3]]){const v=buildVehicle(k,c);v.position.set(x,QY+.05,z);v.rotation.y=ry;B.add(v);}
  {const L=[];for(const[bx,bz]of[[1214,-100],[1219,60],[1214,300],[1214,430],[1219,250]])for(let i=0;i<5;i++)for(let j=0;j<4;j++){const hh=1+Math.floor(r()*3);for(let k=0;k<hh&&L.length<160;k++)L.push([bx+i*1.3,QY+.5+k*1.01,bz+j*1.3,1.2,1.0,1.2,(r()-.5)*.1]);}cartonSet(B,L);}   /* 港の段ボールの山 */
  // 係留索（船首・船尾から係船柱へ）と、岸壁の古タイヤの防舷材
  {const rope=new THREE.LineBasicMaterial({color:0x1a1a18}),pts=[];const ln=(a,b)=>{pts.push(a[0],a[1],a[2],b[0],(a[1]+b[1])/2-1.2,(a[2]+b[2])/2,b[0],(a[1]+b[1])/2-1.2,(a[2]+b[2])/2,b[0],b[1],b[2]);};
    // 船ごとに分けておき、船が沈んだら game.js で消す
    const mk=k=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts.splice(0),3));const l=new THREE.LineSegments(g,rope);l.userData.noMerge=1;B.add(l);(B.userData.ropes=B.userData.ropes||{})[k]=l;};
    for(const dz of[-62,-40,40,62])ln([X1+9,7.5,150+dz],[X1-3,QY+.9,150+dz+(dz>0?10:-10)]);mk('cargo');
    for(const dx of[-18,18])ln([X1+70+dx,3.2,20+13],[X1+70+dx*1.5,QY-.2,20+8.4]);mk('patrol');
    const tg=new THREE.TorusGeometry(.75,.28,6,12),im=new THREE.InstancedMesh(tg,col(0x0d0e0f,.95,0),60),d=new THREE.Object3D();let n=0;for(let z=Z0+20;z<Z1&&n<60;z+=16){d.position.set(X1+.35,QY-1.6,z+8);d.rotation.y=Math.PI/2;d.updateMatrix();im.setMatrixAt(n++,d.matrix);for(const dz of[-.45,.45]){const rp=box(B,.04,1.35,.04,col(0x3a3328,.95,0),X1+.33,QY-.55,z+8+dz);rp.rotation.x=dz*.35;}}im.count=n;B.add(im);}   /* タイヤは岸壁の上から 2 本の綱で吊る */
  // 航路の浮標（港口の外に赤・緑の対）と、港内の作業船
  for(let k=0;k<3;k++)for(const[z,c,m]of[[75,[3.2,.25,.15],red],[215,[.25,3,.6],grn]]){const x=1720+k*110,bz=z+(z<150?-k*14:k*14);const b=new THREE.Mesh(new THREE.CylinderGeometry(.5,1.5,2.6,10),m);b.position.set(x,1.1,bz);B.add(b);box(B,.12,2.6,.12,steel,x,3.6,bz);
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(c[0],c[1],c[2]),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.position.set(x,5,bz);sp.scale.set(4,4,1);B.add(sp);}
  B.userData.moored.push(['fish',1480,190,2.1]);   // 港内の作業船
  // 防波堤の外側に寄せては返す白波（帯の x が外向き、0 が防波堤側）
  {const cx=1450,cz=150;for(const[ax,az,bx2,bz2]of segs){const L=Math.hypot(bx2-ax,bz2-az),mx=(ax+bx2)/2,mz=(az+bz2)/2;let nx=-(bz2-az)/L,nz=(bx2-ax)/L;
      if(Math.hypot(mx+nx*10-cx,mz+nz*10-cz)<Math.hypot(mx-cx,mz-cz)){nx=-nx;nz=-nz;}
      const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),foamMat(3,{alpha:.75,sx:16,sy:L,speed:.05,inScene:1}));m.rotation.order='YXZ';m.rotation.set(-Math.PI/2,Math.atan2(-nz,nx),0);m.scale.set(16,L+10,1);
      m.position.set(mx+nx*16,.8,mz+nz*16);m.frustumCulled=false;B.add(m);}}
  // コンテナを運ぶトレーラー（岸壁クレーンの下を往復する周回路）
  {const tm=std({color:lin(0x2c3e5a),roughness:.55,metalness:.4}),blk=std({color:lin(0x15181b),roughness:.7,metalness:.3}),gl=std({color:lin(0x0e1a24),roughness:.08,metalness:.9}),cm=containerMat();B.userData.trucks=[];
    for(let k=0;k<5;k++){const t=new THREE.Group();const A=(w,h,d,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;t.add(o);return o;};
      A(2.5,2.6,2.4,k%2?std({color:lin(0xb8382a),roughness:.5,metalness:.3}):tm,0,1.9,-6.6);A(2.52,1,.1,gl,0,2.5,-7.85);A(2.4,.4,12.6,blk,0,1.1,.6);
      for(const z of[-6.8,-5,3.5,4.7,5.9])for(const sx of[-1.05,1.05]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.4,12),blk);w.rotation.z=Math.PI/2;w.position.set(sx,.5,z);t.add(w);}
      if(k!==2){const c=new THREE.Mesh(new THREE.BoxGeometry(2.44,2.59,12.19),cm);c.position.set(0,2.6,.6);t.add(c);}
      t.userData.s=k*240;t.userData.dyn=1;B.add(t);B.userData.trucks.push(t);}}
  B.userData.cranes=cranes;
  // 基地から港への道：中心線をなめらかにつなぎ、高さは地形をならして決める。路面・路肩・法面（地面まで）・ガードレール・街灯・標識・走る車
  {const smp=[];{const P=ROAD_PTS,cr=(p0,p1,p2,p3,t)=>{const t2=t*t,t3=t2*t;return .5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3);};
      for(let i=0;i<P.length-1;i++){const p0=P[Math.max(0,i-1)],p1=P[i],p2=P[i+1],p3=P[Math.min(P.length-1,i+2)],L=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]),n=Math.ceil(L/4);
        for(let k=0;k<n;k++){const t=k/n;smp.push([cr(p0[0],p1[0],p2[0],p3[0],t),cr(p0[1],p1[1],p2[1],p3[1],t)]);}}smp.push(P[P.length-1]);}
    const N=smp.length,tg=[],hh=[];for(let i=0;i<N;i++){const p=smp[Math.min(N-1,i+1)],q=smp[Math.max(0,i-1)],dx=p[0]-q[0],dz=p[1]-q[1],l=Math.hypot(dx,dz)||1;tg.push([dx/l,dz/l]);const nx=-dz/l,nz=dx/l,[x,z]=smp[i];
      hh.push(Math.max(islandH(x,z),islandH(x+nx*4,z+nz*4),islandH(x-nx*4,z-nz*4),QY));}
    const hs=hh.map((_,i)=>{let a2=0,w=0;for(let k=-6;k<=6;k++){const j=Math.min(N-1,Math.max(0,i+k));a2+=hh[j];w++;}return Math.max(a2/w,hh[i]-.2)+.3;});
    const path=[];let acc=0;for(let i=0;i<N;i++){if(i)acc+=Math.hypot(smp[i][0]-smp[i-1][0],smp[i][1]-smp[i-1][1]);path.push({x:smp[i][0],y:hs[i],z:smp[i][1],d:acc,tx:tg[i][0],tz:tg[i][1]});}
    B.userData.roadPath=path;
    // 帯状の面を作る：オフセット o0〜o1、高さは関数で
    const strip=(o0,o1,y0f,y1f,mat,uw)=>{const P=[],U=[],I=[];path.forEach((q,i)=>{const nx=-q.tz,nz=q.tx;for(const[o,yf,u]of[[o0,y0f,0],[o1,y1f,1]]){const x=q.x+nx*o,z=q.z+nz*o;P.push(x,yf(q,x,z),z);U.push(u*(uw||1),q.d/12);}if(i<N-1){const a2=i*2;I.push(a2,a2+1,a2+2,a2+1,a2+3,a2+2);}});
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();const m=new THREE.Mesh(g,mat);m.receiveShadow=true;B.add(m);return m;};
    const rc=document.createElement('canvas');rc.width=128;rc.height=256;const x=rc.getContext('2d'),rr=mulberry(66);x.fillStyle='#38393c';x.fillRect(0,0,128,256);
    for(let i=0;i<500;i++){const g2=44+rr()*26|0;x.fillStyle='rgba('+g2+','+g2+','+(g2+2)+',.18)';x.fillRect(rr()*128,rr()*256,1+rr()*4,2+rr()*16);}
    for(let i=0;i<6;i++){x.fillStyle='rgba(20,20,22,.18)';x.fillRect(26+rr()*6,0,10,256);x.fillRect(90+rr()*6,0,10,256);}   // 轍
    x.fillStyle='#e7e4da';x.fillRect(5,0,3,256);x.fillRect(120,0,3,256);x.fillStyle='#d9a21b';x.fillRect(62,0,4,150);
    const rt=new THREE.CanvasTexture(rc);rt.encoding=THREE.sRGBEncoding;rt.wrapT=THREE.RepeatWrapping;rt.anisotropy=8;
    const flat=q=>q.y,po={polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2};
    strip(-4,4,flat,flat,std(Object.assign({map:rt,roughness:.88,metalness:0},po)));
    const gravel=std(Object.assign({color:lin(0x7c7a72),roughness:.95,metalness:0},po));strip(4,5.4,flat,q=>q.y-.05,gravel);strip(-5.4,-4,q=>q.y-.05,flat,gravel);
    const bank=std(Object.assign({color:lin(0x56603a),roughness:1,metalness:0,side:THREE.DoubleSide},po)),gy=(q,x,z)=>Math.max(islandH(x,z),QY-1)-.15;
    strip(5.4,10,q=>q.y-.05,gy,bank);strip(-10,-5.4,gy,q=>q.y-.05,bank);
    // ガードレール：路面と地面の差が 1.2m を超える区間の両側（支柱と波形の板を一括描画）
    {const pm=std({color:lin(0xb8bcbe),roughness:.4,metalness:.8}),pg=new THREE.BoxGeometry(.16,1.1,.16),bg=new THREE.BoxGeometry(1,1,1),posts=new THREE.InstancedMesh(pg,pm,900),rails=new THREE.InstancedMesh(bg,pm,900),d=new THREE.Object3D();let np=0,nr=0;
      for(const sd of[-1,1]){let prev=null;for(let i=0;i<N;i+=1){const q=path[i],nx=-q.tz*sd,nz=q.tx*sd,x2=q.x+nx*5,z2=q.z+nz*5,drop=q.y-islandH(q.x+nx*8,q.z+nz*8);
          if(drop>1.2&&np<900){d.position.set(x2,q.y+.45,z2);d.rotation.set(0,0,0);d.scale.set(1,1,1);d.updateMatrix();posts.setMatrixAt(np++,d.matrix);
            const cur=new V3(x2,q.y+.75,z2);if(prev&&prev.distanceTo(cur)<9&&nr<900){const v=new V3().subVectors(cur,prev),L=v.length();d.position.copy(prev).add(cur).multiplyScalar(.5);d.quaternion.setFromUnitVectors(new V3(1,0,0),v.normalize());d.scale.set(L+.1,.32,.06);d.updateMatrix();rails.setMatrixAt(nr++,d.matrix);d.quaternion.identity();}prev=cur;}else prev=null;}}
      posts.count=np;rails.count=nr;posts.castShadow=rails.castShadow=true;B.add(posts);B.add(rails);}
    // 街灯：60m ごとに左右交互
    {const pm=std({color:lin(0x8e9599),roughness:.45,metalness:.7});let k=0;for(let i=4;i<N;i+=15){const q=path[i],sd=k++%2?1:-1,nx=-q.tz*sd,nz=q.tx*sd,x2=q.x+nx*6,z2=q.z+nz*6;
        const gy=Math.min(q.y,Math.max(islandH(x2,z2),QY-1)),ph=q.y+9-gy;const pole=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,ph,8),pm);pole.position.set(x2,gy+ph/2,z2);B.add(pole);beam(B,new V3(x2,q.y+8.8,z2),new V3(q.x+nx*3.6,q.y+9.1,q.z+nz*3.6),.14,pm);
        const head=new THREE.Mesh(new THREE.BoxGeometry(.9,.22,.45),pm);head.position.set(q.x+nx*3.4,q.y+9.0,q.z+nz*3.4);head.rotation.y=Math.atan2(nx,nz);B.add(head);
        const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(2.4,2.1,1.5),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.position.set(q.x+nx*3.4,q.y+8.75,q.z+nz*3.4);sp.scale.set(3,3,1);B.add(glowLOD(sp,80,.25));}}
    // 案内標識（青地に白字）
    {const sign=(i,sd,t1,t2)=>{const q=path[i],nx=-q.tz*sd,nz=q.tx*sd,x2=q.x+nx*7,z2=q.z+nz*7,c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');g.fillStyle='#1f4f8f';g.fillRect(0,0,512,256);g.strokeStyle='#eef';g.lineWidth=8;g.strokeRect(10,10,492,236);
        g.fillStyle='#fff';g.font='bold 72px "Hiragino Sans","Yu Gothic",sans-serif';g.fillText(t1,40,110);g.font='bold 44px Arial';g.fillText(t2,40,190);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;
        const bd=new THREE.Mesh(new THREE.PlaneGeometry(4,2),new THREE.MeshStandardMaterial({map:t,roughness:.6,side:THREE.DoubleSide}));bd.position.set(x2,q.y+3.6,z2);bd.rotation.y=Math.atan2(-q.tx*sd,-q.tz*sd);B.add(bd);
        for(const o of[-1.5,1.5]){const px=x2+q.tz*o,pz=z2-q.tx*o,gy=Math.min(q.y,Math.max(islandH(px,pz),QY-1)),hh=q.y+2.6-gy;const p2=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,hh,6),std({color:lin(0x9aa0a4),roughness:.5,metalness:.7}));p2.position.set(px,gy+hh/2,pz);B.add(p2);}};
      sign(Math.floor(N*.12),1,'ミズハ港','MIZUHA PORT  1.5km');sign(Math.floor(N*.9),-1,'気象基地','WEATHER STATION  1.4km');}
    // 走る車（左側通行）
    {B.userData.roadCars=[];const cols=[0xc9ced2,0x23272b,0x7a1f1a,0x2c4f7a,0xe6e6e0,0x3a5a40];for(let k=0;k<5;k++){const c=buildVehicle(k===2?'fuel':'car',cols[k]);c.userData.dyn=1;c.userData.s=k*acc/5;c.userData.dir=k%2?1:-1;B.add(c);B.userData.roadCars.push(c);}}
  }
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
  const crew=(x,z,ry,role,path)=>{const g=new THREE.Group();g.userData.noWeather=1;g.position.set(x,0,z);g.rotation.y=ry;g.userData.dyn=1;HG.add(g);const suit=col([0x2b3a4a,0x3b4b3a,0x4a4038][Math.floor(r()*3)],.9,0),vest=new THREE.MeshStandardMaterial({color:lin(0xd8e02a),roughness:.8,emissive:new THREE.Color(.05,.06,.0)});ENVMATS.push(vest);
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
    // 段ボール箱の山：パレット 2 枚に 3×2×4 段（探検ではボートで崩せる）
    {const L=HG.userData.cartons||(HG.userData.cartons={list:[]});for(let pl=0;pl<2;pl++){const px=s*(36.2-pl*2.6),pz=80+pl*.4;box(HG,1.22,.15,1.02,std({color:lin(0x9a8460),roughness:.95,metalness:0}),px,.075,pz,true);
      const hgt=4-(pl&1);for(let iy=0;iy<hgt;iy++)for(let ix=0;ix<3;ix++)for(let iz=0;iz<2;iz++){if(iy===hgt-1&&((ix+iz+pl)%4===0))continue;L.list.push([px-.4+ix*.4,.15+.2+iy*.405,pz-.25+iz*.5,.39,.4,.48,(ix*7+iy*3+iz)%5*.012]);}}}
  }
  {const L=HG.userData.cartons;if(L)cartonSet(HG,L.list);}
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
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(39.5,39.5,.6,32,1,false,0,Math.PI),copperM);cap.rotation.y=s>0?-Math.PI/2:Math.PI/2;cap.position.set(330+s*75,RWY_Y+14.27,400);B.add(cap);}   /* 屋根の板と上面がそろうとちらつくので少し下げる */
  {// 上層の棟に、低いかまぼこ形の銅屋根と真鍮のリブ
    const vg=new THREE.CylinderGeometry(25.5,25.5,103,32,1,false,0,Math.PI);vg.rotateZ(Math.PI/2);const vault=new THREE.Mesh(vg,copperM);vault.scale.set(1,.3,1);vault.position.set(322,RWY_Y+24.01,400);   /* 壁の面と重ならないよう 0.5m 内側に（重なるとちらつく） */vault.castShadow=true;B.add(vault);
    for(let k=-4;k<=4;k++){const rib=new THREE.Mesh(new THREE.TorusGeometry(25.75,.35,6,32,Math.PI),brassM);rib.rotation.y=Math.PI/2;rib.scale.set(1,.3,1);rib.position.set(322+k*12.5,RWY_Y+24.01,400);B.add(rib);}
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
  for(const r of AIR_ROADS)road(r[0],r[1],r[2],r[3],r[4]+(r[2]!==r[0]&&r[3]!==r[1]?1.2:0));   /* 斜めの区間は継ぎ目が開かないよう少し広く */
  // 街灯
  for(let z=-220;z<=600;z+=58){const p=new THREE.Mesh(new THREE.CylinderGeometry(.14,.2,9,6),copperM);p.position.set(216,RWY_Y+4.5,z);B.add(p);{const gb=new THREE.Mesh(new THREE.SphereGeometry(.55,10,8),new THREE.MeshBasicMaterial({color:new THREE.Color(2.2,1.9,1.3)}));gb.position.set(216,RWY_Y+9.4,z);B.add(gb);const cp=new THREE.Mesh(new THREE.ConeGeometry(.7,.6,8),copperM);cp.position.set(216,RWY_Y+10.1,z);B.add(cp);}
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(2.4,2.1,1.5),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));s.position.set(216,RWY_Y+9.4,z);s.scale.set(3.2,3.2,1);B.add(s);}
  // 駐車場と車
  {const lot=new THREE.Mesh(new THREE.PlaneGeometry(46,30),std({color:lin(0x35383b),roughness:.9}));lot.rotation.x=-Math.PI/2;lot.position.set(240,RWY_Y-.02,470);lot.receiveShadow=true;B.add(lot);
    const cols=[0xc9ced2,0x23272b,0x7a1f1a,0x2c4f7a,0xd8d8d0,0x4d5a66];for(let i=0;i<11;i++){if(r()<.25)continue;const c=new THREE.Group();c.position.set(221+(i%6)*7.2,RWY_Y+.75,i<6?462:478);
      const cc=buildVehicle('car',cols[i%cols.length]);c.add(cc);c.position.y=RWY_Y;c.rotation.y=i<6?0:Math.PI;B.add(c);}}
  // 外周フェンス（支柱は一括描画）
  {const pts=[[150,-260],[470,-260],[470,560],[150,560]],pg=new THREE.CylinderGeometry(.07,.07,2.6,5),im=new THREE.InstancedMesh(pg,darkM,400),d=new THREE.Object3D();let n=0;
    const segs2=[[pts[0],pts[1]],[[470,-260],[470,291]],[[470,309],[470,560]],[pts[2],pts[3]]];
    {const gm=std({color:lin(0xb8b0a0),roughness:.7}),rw=std({color:lin(0xd9d9d0),roughness:.6});for(const gz of[291,309]){const gp=new THREE.Mesh(new THREE.BoxGeometry(.8,3,.8),gm);gp.position.set(470,RWY_Y+1.5,gz);B.add(gp);}
      const arm=new THREE.Mesh(new THREE.BoxGeometry(.14,.14,17.2),std({color:lin(0xd23a2a),roughness:.6}));arm.position.set(470,RWY_Y+1.1,300);B.add(arm);for(let i=0;i<5;i++){const w=new THREE.Mesh(new THREE.BoxGeometry(.16,.16,1.4),rw);w.position.set(470,RWY_Y+1.1,293.5+i*3);B.add(w);}
      const booth=new THREE.Mesh(new THREE.BoxGeometry(3.4,2.8,3.4),wallB);booth.position.set(463,RWY_Y+1.4,288);B.add(booth);const br=new THREE.Mesh(new THREE.BoxGeometry(4,.3,4),roof);br.position.set(463,RWY_Y+2.95,288);B.add(br);}
    for(let k=0;k<4;k++){const[a,b]=segs2[k],L=Math.hypot(b[0]-a[0],b[1]-a[1]);
      for(let s=0;s<=L;s+=6){d.position.set(a[0]+(b[0]-a[0])*s/L,RWY_Y+1.3,a[1]+(b[1]-a[1])*s/L);d.updateMatrix();im.setMatrixAt(n++,d.matrix);}
      const rail=new THREE.Mesh(new THREE.BoxGeometry(L,1.9,.04),new THREE.MeshStandardMaterial({color:0x7a8288,transparent:true,opacity:.28,roughness:.6,metalness:.6,side:THREE.DoubleSide}));rail.position.set((a[0]+b[0])/2,RWY_Y+1.45,(a[1]+b[1])/2);rail.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);B.add(rail);}
    im.count=n;B.add(im);}
  // 管制塔の胴に窓の帯、足元に基部棟
  for(let k=0;k<5;k++){const w=new THREE.Mesh(new THREE.CylinderGeometry(4.6-k*.42,4.8-k*.42,1.1,12,1,true),new THREE.MeshBasicMaterial({color:new THREE.Color(.18,.5,.6)}));w.position.set(200,RWY_Y+10+k*12,360);B.add(w);}
  bld(26,7,20,200,RWY_Y+3.5,360,wallA);
  baseBuildings(B,{bld,box,facade,cv,wallA,wallB,roof,hullM,paleM,darkM,glassM,cyM,amM,copperM,brassM});
}
// 基地の建物の作り込み：格納庫の外まわり、本棟の玄関、管制塔、燃料タンク、新しい建物（消防庁舎・整備工場・変電所・職員宿舎）
function baseBuildings(B,M){
  const{bld,box,facade,cv,wallA,wallB,roof,hullM,paleM,darkM,glassM,cyM,amM,copperM,brassM}=M,r=mulberry(77),Y=RWY_Y,P=(x,y,z)=>new V3(x,y,z);
  const steel=std({color:lin(0x8d949a),roughness:.45,metalness:.75}),concM=std({color:lin(0xa8a59c),roughness:.9,metalness:0}),redM=std({color:lin(0xa8281c),roughness:.55,metalness:.2});
  const mesh=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;B.add(o);return o;};
  // 屋上の空調機（箱＋ファン）
  const acUnit=(x,y,z,ry)=>{const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ry||0;B.add(g);const b=new THREE.Mesh(new THREE.BoxGeometry(3.2,1.6,2.2),paleM);b.position.y=.8;g.add(b);
    for(const dx of[-.8,.8]){const f=new THREE.Mesh(new THREE.CylinderGeometry(.62,.62,.12,16),darkM);f.position.set(dx,1.66,0);g.add(f);}const gr=new THREE.Mesh(new THREE.BoxGeometry(3.3,.08,.2),darkM);gr.position.set(0,.4,1.12);g.add(gr);};
  // 巻き上げ扉の絵柄
  const doorT=cv(256,256,(x,w,h)=>{x.fillStyle='#9aa1a4';x.fillRect(0,0,w,h);for(let i=0;i<32;i++){x.fillStyle=i%2?'rgba(0,0,0,.16)':'rgba(255,255,255,.1)';x.fillRect(0,i*8,w,4);}x.fillStyle='rgba(0,0,0,.35)';x.fillRect(0,h-10,w,10);x.fillStyle='#d9a21b';for(let i=0;i<8;i++)x.fillRect(i*32+(i%2)*0,h-10,16,10);});
  const doorM=std({map:doorT,roughness:.6,metalness:.45});
  // ── 格納庫の外まわり（中心 0, Y, 1085、壁は x=±49 で外へ 0.1 傾く）
  {const HZ=1085;
    for(const sd of[-1,1]){
      // 両脇の作業棟（窓のある低い棟 2 つ）と、その屋上の空調機・換気筒
      for(const[z0,L]of[[-53,49],[18,62]]){const wx=sd*58.5;bld(10.5,8,L,wx,Y+4,HZ+z0+L/2-29,wallB);box(B,11.2,.5,L+.6,copperM,wx,Y+8.2,HZ+z0+L/2-29,true);
        for(let k=0;k<Math.floor(L/16);k++)acUnit(wx,Y+8.45,HZ+z0-29+8+k*16,0);
        for(let k=0;k<3;k++){const v=mesh(new THREE.CylinderGeometry(.35,.35,2.4,10),steel,wx+sd*2.5,Y+9.6,HZ+z0-29+6+k*L/3);}
        const dz=HZ+z0-29+L/2;const dr=mesh(new THREE.BoxGeometry(.2,4.2,5.5),doorM,sd*63.8,Y+2.1,dz);box(B,.6,.4,6.6,darkM,sd*63.9,Y+4.45,dz);}
      // 控え柱（21m ごと）と地面への筋交い
      for(let k=-4;k<=4;k++){const z=HZ+k*21,top=P(sd*50.9,Y+30.5,z),bot=P(sd*53.6,Y,z);beam(B,bot,top,1.4,hullM,2.2);if(Math.abs(k)===4||k===0){}else beam(B,P(sd*63.5,Y+.3,z),P(sd*52.6,Y+16,z),.7,steel);}
      // 雨どいと縦どい
      box(B,.6,.6,178,darkM,sd*51.7,Y+30.8,HZ,false);for(let k=-4;k<=2;k+=2){const dp=mesh(new THREE.CylinderGeometry(.18,.18,30,8),darkM,sd*52.8,Y+15.4,HZ+k*21+10.5);dp.rotation.z=sd*.09;}}
    // 屋根の頂部：明かり取りの帯と換気口
    const sky=std({color:lin(0x9fb6c2),roughness:.15,metalness:.6});box(B,9,.35,170,sky,0,Y+38.9,HZ,false);for(const sd of[-1,1])box(B,.5,.9,170,darkM,sd*4.7,Y+38.8,HZ,false);
    for(let k=-3;k<=3;k++){const v=mesh(new THREE.CylinderGeometry(1.1,1.4,1.8,12),steel,(k%2?11:-11),Y+37.4,HZ+k*24);const c=mesh(new THREE.ConeGeometry(1.6,.9,12),steel,(k%2?11:-11),Y+38.7,HZ+k*24);}
    // 背面のよろい戸と非常階段
    for(let k=-2;k<=2;k++){const lv=mesh(new THREE.BoxGeometry(7,4,.4),darkM,k*16,Y+24,HZ+91.4);for(let j=0;j<6;j++)box(B,6.8,.12,.5,steel,k*16,Y+22.3+j*.65,HZ+91.6);}
    for(let k=0;k<4;k++){beam(B,P(30+k*0,Y+k*6,HZ+93),P(42,Y+(k+1)*6,HZ+93),.5,steel,1.6);box(B,4,.25,2,steel,44,Y+(k+1)*6,HZ+93);}
    beam(B,P(46,Y,HZ+93),P(46,Y+24.3,HZ+93),.3,steel);beam(B,P(42,Y,HZ+94),P(42,Y+24.3,HZ+94),.3,steel);}
  // ── 本棟（中心 330, 400、正面は z=362 の北側）
  {const fz=361.5;
    box(B,40,1,12,copperM,330,Y+9.2,fz-5,true);box(B,40.6,.4,12.6,brassM,330,Y+9.8,fz-5,false);                  // 玄関ひさし
    for(let k=0;k<6;k++){const c=mesh(new THREE.CylinderGeometry(.55,.65,8.7,16),paleM,312+k*7.2,Y+4.35,fz-10);const cap=mesh(new THREE.CylinderGeometry(.9,.6,.5,16),brassM,312+k*7.2,Y+8.6,fz-10);}
    for(let k=0;k<3;k++)box(B,44-k*2,.3,3-k*.6,concM,330,Y+.15+k*.3,fz-12.5+k*.5,true);                          // 階段
    for(const dx of[-6,0,6]){box(B,4.2,5.6,.2,glassM,330+dx,Y+2.8,fz-.1,false);box(B,4.6,.3,.3,brassM,330+dx,Y+5.75,fz-.15,false);}  // 玄関のガラス扉
    {const t=cv(1024,96,(x,w,h)=>{x.fillStyle='rgba(0,0,0,0)';x.clearRect(0,0,w,h);x.fillStyle='#d9b45c';x.font='600 54px "Helvetica Neue",Arial';x.textAlign='center';x.textBaseline='middle';x.fillText('MIZUHA  WEATHER  CONTROL  CENTER',w/2,h/2);});
      const sg=new THREE.Mesh(new THREE.PlaneGeometry(34,3.2),new THREE.MeshStandardMaterial({map:t,transparent:true,roughness:.4,metalness:.8}));sg.rotation.y=Math.PI;sg.position.set(330,Y+11.6,fz-11.3);sg.rotation.y=Math.PI;B.add(sg);}
    // 旗竿 3 本と旗
    for(let k=0;k<3;k++){const x=318+k*12;mesh(new THREE.CylinderGeometry(.12,.16,14,8),steel,x,Y+7,fz-26);mesh(new THREE.SphereGeometry(.25,8,6),brassM,x,Y+14.1,fz-26);
      const fl=new THREE.Mesh(new THREE.PlaneGeometry(3.6,2.2,8,1),std({color:lin([0x1f4f8f,0xe8e6dc,0x1c6a70][k]),roughness:.8,side:THREE.DoubleSide}));fl.position.set(x+1.85,Y+12.6,fz-26);fl.userData.flag=1;(B.userData.flags=B.userData.flags||[]).push(fl);B.add(fl);}
    // 屋上の手すり（低層の屋根のふち）と給水槽
    for(const[a,b]of[[[256,362.2],[404,362.2]],[[256,437.8],[404,437.8]]]){box(B,b[0]-a[0],.08,.08,steel,(a[0]+b[0])/2,Y+15.6,a[1],false);for(let x=a[0];x<=b[0];x+=3)box(B,.08,1,.08,steel,x,Y+15.1,a[1],false);}
    mesh(new THREE.CylinderGeometry(3,3,4,20),paleM,390,Y+16.6,372);for(let k=0;k<4;k++){const a=k*1.571+.785;mesh(new THREE.CylinderGeometry(.2,.2,2,6),steel,390+Math.cos(a)*2.4,Y+15.6,372+Math.sin(a)*2.4);}
    for(const[x,z]of[[270,372],[270,428],[392,428],[262,400]])acUnit(x,Y+14.6,z,0);}
  // ── 管制塔：管制室の窓枠とキャットウォーク、頂部のアンテナ
  {for(let k=0;k<20;k++){const a=k/20*6.283;const m=mesh(new THREE.BoxGeometry(.25,4.4,.25),darkM,200+Math.cos(a)*12.6,Y+70,360+Math.sin(a)*12.6);m.rotation.y=-a;}
    for(let k=0;k<36;k++){const a=k/36*6.283;box(B,.08,1.1,.08,steel,200+Math.cos(a)*16.4,Y+71.8,360+Math.sin(a)*16.4,false);}
    const rl=new THREE.Mesh(new THREE.TorusGeometry(16.4,.06,4,64),steel);rl.rotation.x=Math.PI/2;rl.position.set(200,Y+72.3,360);B.add(rl);
    for(const[dx,dz,h]of[[3,0,9],[-2,2.5,6],[-1.5,-3,7]]){mesh(new THREE.CylinderGeometry(.06,.1,h,6),steel,200+dx,Y+79+h/2,360+dz);}
    mesh(new THREE.BoxGeometry(2.2,.2,.3),darkM,203,Y+86,360);}
  // ── 燃料タンク：斜めの階段・頂部の手すり・防油堤
  {for(let k=0;k<3;k++){const z=-40+k*44;
      for(let j=0;j<16;j++){const a=-.6+j*.09,y=Y+1+j*1.18;box(B,1.4,.12,.9,steel,440+Math.cos(a)*15.6,y,z+Math.sin(a)*15.6,false).rotation.y=-a;}
      beam(B,P(440+Math.cos(-.6)*16.3,Y,z+Math.sin(-.6)*16.3),P(440+Math.cos(.75)*16.3,Y+19.8,z+Math.sin(.75)*16.3),.12,steel);
      const tr=new THREE.Mesh(new THREE.TorusGeometry(14.2,.07,4,56),steel);tr.rotation.x=Math.PI/2;tr.position.set(440,Y+21.3,z);B.add(tr);for(let j=0;j<24;j++){const a=j/24*6.283;box(B,.08,1.2,.08,steel,440+Math.cos(a)*14.2,Y+20.7,z+Math.sin(a)*14.2,false);}}
    for(const[w,d,x,z]of[[44,1,440,-66],[44,1,440,74],[1,140,418,4],[1,140,462,4]])box(B,w,1.6,d,concM,x,Y+.8,z,true);}
  // ── 消防庁舎（道の南、扉は道の側 +z）
  {const cx=325,cz=262;bld(44,9,20,cx,Y+4.5,cz,wallB);box(B,45,.6,21,copperM,cx,Y+9.3,cz,true);
    for(let k=0;k<4;k++){const x=cx-16.5+k*11;mesh(new THREE.BoxGeometry(8,6,.2),doorM,x,Y+3,cz+10.05);box(B,9,.6,.6,redM,x,Y+6.3,cz+10.2,false);for(const dx of[-4.3,4.3])box(B,.6,6.6,.6,redM,x+dx,Y+3.3,cz+10.2,false);}
    bld(5,20,5,cx+24.5,Y+10,cz-6,wallA);box(B,6,.6,6,copperM,cx+24.5,Y+20.3,cz-6,true);                                     // ホース乾燥塔
    {const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWTEX,color:new THREE.Color(3,.3,.2),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.position.set(cx+24.5,Y+21.4,cz-6);sp.scale.set(3,3,1);B.add(glowLOD(sp,90,.2));}
    for(const x of[cx-13,cx+2])acUnit(x,Y+9.6,cz-4,0);
    for(let k=0;k<2;k++){const v=buildVehicle('fire',0xb3261c);v.position.set(cx-16.5+k*11,Y,cz+17);v.rotation.y=Math.PI;B.add(v);}}
  // ── 整備工場（のこぎり屋根）
  {const cx=405,cz=262,W=34,D=24;bld(W,8,D,cx,Y+4,cz,wallA);
    for(let k=0;k<4;k++){const x0=cx-W/2+k*(W/4);const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(W/4,0);sh.lineTo(W/4,3.6);sh.lineTo(0,0);const g=new THREE.ExtrudeGeometry(sh,{depth:D,bevelEnabled:false});const m=mesh(g,roof,x0,Y+8,cz-D/2);
      const gl=mesh(new THREE.BoxGeometry(.15,3.2,D-1),std({color:lin(0x9fb6c2),roughness:.15,metalness:.6}),x0+W/4-.1,Y+9.7,cz);}
    mesh(new THREE.BoxGeometry(9,6.5,.2),doorM,cx-6,Y+3.25,cz+12.05);mesh(new THREE.BoxGeometry(9,6.5,.2),doorM,cx+7,Y+3.25,cz+12.05);
    beam(B,P(cx+W/2+.4,Y,cz-6),P(cx+W/2+.4,Y+11.8,cz-6),.12,steel);beam(B,P(cx+W/2+.4,Y,cz-5.4),P(cx+W/2+.4,Y+11.8,cz-5.4),.12,steel);for(let j=0;j<24;j++)box(B,.1,.06,.6,steel,cx+W/2+.4,Y+.4+j*.48,cz-5.7,false);
    const tug=buildVehicle('tug',0xd9a21b);tug.position.set(cx+14,Y,cz+18);tug.rotation.y=2.6;B.add(tug);}
  // ── 変電所（本棟の南）：基礎・変圧器・がいし・鉄骨の架構・フェンス
  {const cx=330,cz=500;box(B,34,.3,24,concM,cx,Y+.15,cz,true);
    const tf=std({color:lin(0x6e7a6e),roughness:.6,metalness:.4});for(let k=0;k<3;k++){const x=cx-10+k*10;mesh(new THREE.BoxGeometry(4.4,3.6,3.2),tf,x,Y+2.1,cz-3);for(let j=0;j<7;j++)box(B,4.6,2.6,.08,tf,x,Y+2,cz-1.3+(j-3)*.0,false).position.z=cz-1.25-(j%2)*.0;
      for(let j=0;j<3;j++){mesh(new THREE.CylinderGeometry(.18,.25,1.6,10),std({color:lin(0x8a5a3a),roughness:.3,metalness:.1}),x-1.2+j*1.2,Y+4.7,cz-3);}}
    for(const x of[cx-15,cx-5,cx+5,cx+15]){beam(B,P(x,Y,cz+6),P(x,Y+12,cz+6),.35,steel);beam(B,P(x,Y,cz-8),P(x,Y+12,cz-8),.35,steel);beam(B,P(x,Y+12,cz-8),P(x,Y+12,cz+6),.3,steel);beam(B,P(x,Y,cz-8),P(x,Y+12,cz+6),.15,steel);}
    beam(B,P(cx-15,Y+12,cz+6),P(cx+15,Y+12,cz+6),.3,steel);beam(B,P(cx-15,Y+12,cz-8),P(cx+15,Y+12,cz-8),.3,steel);
    {const wm=new THREE.LineBasicMaterial({color:0x222426}),pts=[];for(let k=0;k<3;k++){const x=cx-10+k*10;pts.push(x-1.2,Y+5.5,cz-3,x-1.2,Y+11.8,cz+6,x+1.2,Y+5.5,cz-3,x+1.2,Y+11.8,cz+6);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));B.add(new THREE.LineSegments(g,wm));}
    const fp=new THREE.InstancedMesh(new THREE.CylinderGeometry(.06,.06,2.6,5),darkM,80),d=new THREE.Object3D();let n=0;for(const[a,b]of[[[cx-18,cz-13],[cx+18,cz-13]],[[cx+18,cz-13],[cx+18,cz+13]],[[cx+18,cz+13],[cx-18,cz+13]],[[cx-18,cz+13],[cx-18,cz-13]]]){const L=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let t=0;t<L;t+=3){d.position.set(a[0]+(b[0]-a[0])*t/L,Y+1.3,a[1]+(b[1]-a[1])*t/L);d.updateMatrix();fp.setMatrixAt(n++,d.matrix);}
      const rl=new THREE.Mesh(new THREE.BoxGeometry(L,.06,.06),steel);rl.position.set((a[0]+b[0])/2,Y+2.55,(a[1]+b[1])/2);rl.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);B.add(rl);}
    fp.count=n;B.add(fp);}
  // ── 職員宿舎（3 階建て、ベランダと屋上の水槽）
  {const cx=405,cz=505,dorm=std({map:facade(3,22,.35),roughness:.75,metalness:.05});bld(48,11,14,cx,Y+5.5,cz,dorm);box(B,49,.5,15,copperM,cx,Y+11.25,cz,true);
    for(let f=1;f<3;f++){box(B,48,.25,1.6,concM,cx,Y+f*3.67,cz-7.8,true);box(B,48,.9,.08,steel,cx,Y+f*3.67+.55,cz-8.55,false);}
    mesh(new THREE.BoxGeometry(6,2.4,4),paleM,cx+16,Y+12.7,cz);for(const dx of[-4,6])acUnit(cx+dx,Y+11.5,cz+2,0);
    bld(6,3.2,5,cx-27,Y+1.6,cz-3,wallB);}
}

// ───────────────────────── 読み込み中のミニゲーム：船体のアカフジツボはがし ─────────────────────────
// 2D の canvas だけで動く軽い遊び。フジツボの絵は大きさ・形の違う物を最初に数十枚だけ描いておき、使い回す。
const BN={on:false};
function bnRand(seed){let a=seed|0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
// アカフジツボ 1 個：真上から少し斜めに見た火山形。紅色の 6 枚の殻板（継ぎ目・縦の筋・成長線）、ぎざぎざの口、白っぽい蓋板と紫の合わせ目、つや、ところどころ白い石灰と藻
function bnSprite(R,seed){const r=bnRand(seed),S=Math.ceil(R*2.6),c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d'),cx=S/2,cy=S/2+R*.06;
  const hue=356+r()*10,sat=44+r()*16,lit=47+r()*8;const col=(h,s,l,a)=>`hsla(${h},${s}%,${l}%,${a==null?1:a})`;
  // 影
  x.fillStyle='rgba(30,10,5,.35)';x.beginPath();x.ellipse(cx+R*.12,cy+R*.16,R*1.05,R*.98,0,0,7);x.fill();
  // 殻の外形：6 枚の殻板の継ぎ目で少し角ばる
  const P=[];const N=72,ph=r()*6.28;for(let i=0;i<N;i++){const a=i/N*Math.PI*2,k=1+.05*Math.pow(Math.abs(Math.cos(3*(a+ph))),6)-.03*Math.abs(Math.sin(3*(a+ph)))+(r()-.5)*.04;P.push([cx+Math.cos(a)*R*k,cy+Math.sin(a)*R*k*.94]);}
  x.beginPath();P.forEach((q,i)=>i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]));x.closePath();
  x.fillStyle=col(hue,sat,lit);x.fill();x.save();x.clip();
  // 円錐の陰影：口の縁から外へ向かう細い扇形を、左上の光に対する面の向きで塗り分ける（火山形に見せる）
  {const NW=72,lA=-2.3;for(let i=0;i<NW;i++){const a0=i/NW*Math.PI*2,a1=(i+1.08)/NW*Math.PI*2,am=(a0+a1)/2,ln=Math.cos(am-lA);const L=lit-14+ln*20,Sa=sat-6+ln*4;
      const gg=x.createRadialGradient(cx,cy,R*.36,cx,cy,R*1.06);gg.addColorStop(0,col(hue+6,Sa-18,L+22));gg.addColorStop(.35,col(hue+2,Sa-6,L+8));gg.addColorStop(1,col(hue-6,Sa+4,L-12));x.fillStyle=gg;
      x.beginPath();x.moveTo(cx+Math.cos(a0)*R*.36,cy+Math.sin(a0)*R*.34);x.lineTo(cx+Math.cos(a0)*R*1.1,cy+Math.sin(a0)*R*1.04);x.lineTo(cx+Math.cos(a1)*R*1.1,cy+Math.sin(a1)*R*1.04);x.lineTo(cx+Math.cos(a1)*R*.36,cy+Math.sin(a1)*R*.34);x.closePath();x.fill();}}
  // 縦の筋（殻板の細い肋）
  for(let i=0;i<70;i++){const a=i/70*Math.PI*2+r()*.04,l0=R*(.42+r()*.06),l1=R*(.98+r()*.06);x.strokeStyle=col(hue+6,sat-10,lit+(i%2?22:-4),.35+r()*.2);x.lineWidth=Math.max(.6,R*.035);x.beginPath();x.moveTo(cx+Math.cos(a)*l0,cy+Math.sin(a)*l0*.94);x.lineTo(cx+Math.cos(a)*l1,cy+Math.sin(a)*l1*.94);x.stroke();}
  // 成長線（同心の細い輪）
  for(let k=0;k<7;k++){const rr=R*(.5+k*.075);x.strokeStyle=col(hue-4,sat,lit-14,.28);x.lineWidth=Math.max(.5,R*.022);x.beginPath();x.ellipse(cx,cy,rr,rr*.94,0,0,7);x.stroke();}
  // 殻板の継ぎ目（6 本、少しずれる）
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2+ph+(r()-.5)*.12;x.strokeStyle=col(hue-8,sat+10,lit-24,.75);x.lineWidth=Math.max(.8,R*.05);x.beginPath();x.moveTo(cx+Math.cos(a)*R*.42,cy+Math.sin(a)*R*.4);x.lineTo(cx+Math.cos(a)*R*1.05,cy+Math.sin(a)*R*.98);x.stroke();
    x.strokeStyle=col(hue+8,sat-14,lit+30,.45);x.lineWidth=Math.max(.5,R*.02);x.beginPath();x.moveTo(cx+Math.cos(a+.03)*R*.45,cy+Math.sin(a+.03)*R*.42);x.lineTo(cx+Math.cos(a+.03)*R*1.0,cy+Math.sin(a+.03)*R*.94);x.stroke();}
  // 白い石灰の付着と、緑の藻
  for(let i=0;i<4+r()*6;i++){const a=r()*6.28,d=R*(.6+r()*.4);x.fillStyle=`rgba(236,228,214,${.25+r()*.35})`;x.beginPath();x.ellipse(cx+Math.cos(a)*d,cy+Math.sin(a)*d*.94,R*(.04+r()*.1),R*(.03+r()*.07),r()*3,0,7);x.fill();}
  if(r()<.6)for(let i=0;i<8;i++){const a=r()*6.28,d=R*(.75+r()*.3);x.fillStyle=`rgba(70,95,40,${.15+r()*.25})`;x.beginPath();x.arc(cx+Math.cos(a)*d,cy+Math.sin(a)*d*.94,R*(.03+r()*.07),0,7);x.fill();}
  x.restore();
  // 口：ぎざぎざの縁（殻板の歯）、暗い内側
  const oa=R*.44,ob=R*.36,rot=(r()-.5)*.8;x.save();x.translate(cx,cy-R*.03);x.rotate(rot);
  x.beginPath();for(let i=0;i<=36;i++){const a=i/36*Math.PI*2,k=1+(i%2?.12:-.04)+(r()-.5)*.06;const px=Math.cos(a)*oa*k,py=Math.sin(a)*ob*k;i?x.lineTo(px,py):x.moveTo(px,py);}x.closePath();
  const og=x.createRadialGradient(0,0,0,0,0,oa);og.addColorStop(0,'#12040a');og.addColorStop(.55,'#2a0814');og.addColorStop(.85,col(hue-4,sat,lit-20));og.addColorStop(1,col(hue+4,sat-16,lit+26));x.fillStyle=og;x.fill();
  x.strokeStyle=col(hue+6,sat-20,lit+34,.8);x.lineWidth=Math.max(.6,R*.03);x.stroke();
  // 蓋板 2 対（楯板と背板）：白っぽい桃色、合わせ目は紫がかった暗い線、くちばしの形
  x.save();x.scale(.62,.62);x.translate(0,ob*.12);const lid=(sx)=>{x.beginPath();x.moveTo(0,-ob*.82);x.quadraticCurveTo(sx*oa*.95,-ob*.5,sx*oa*.82,ob*.1);x.quadraticCurveTo(sx*oa*.6,ob*.75,0,ob*.82);x.closePath();
    const lg=x.createLinearGradient(sx*oa,0,0,0);lg.addColorStop(0,'rgba(238,214,214,.95)');lg.addColorStop(1,'rgba(210,170,185,.95)');x.fillStyle=lg;x.fill();
    x.strokeStyle='rgba(120,60,90,.6)';x.lineWidth=Math.max(.5,R*.018);for(let k=1;k<4;k++){x.beginPath();x.moveTo(sx*oa*.2*k,-ob*.6);x.lineTo(sx*oa*.22*k,ob*.6);x.stroke();}};
  lid(-1);lid(1);x.strokeStyle='rgba(80,30,70,.95)';x.lineWidth=Math.max(1,R*.05);x.beginPath();x.moveTo(0,-ob*.8);x.lineTo(0,ob*.8);x.stroke();x.beginPath();x.moveTo(-oa*.8,ob*.05);x.lineTo(oa*.8,-ob*.05);x.lineWidth=Math.max(.6,R*.025);x.stroke();x.restore();
  x.restore();
  // つや（左上から光）
  const hg=x.createRadialGradient(cx-R*.45,cy-R*.5,0,cx-R*.45,cy-R*.5,R*.6);hg.addColorStop(0,'rgba(255,240,240,.45)');hg.addColorStop(1,'rgba(255,240,240,0)');x.fillStyle=hg;x.beginPath();x.ellipse(cx,cy,R,R*.94,0,0,7);x.fill();
  return c;}
// 船体の面（テラコッタの浮き輪の外板）：帯、汚れ、水滴、藻の膜
function bnHull(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),r=bnRand(4242);
  const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#b56a52');g.addColorStop(.5,'#9b5743');g.addColorStop(1,'#6e3b2e');x.fillStyle=g;x.fillRect(0,0,w,h);
  for(let i=0;i<2500;i++){x.fillStyle=`rgba(${60+r()*60|0},${30+r()*30|0},${20+r()*20|0},${.04+r()*.08})`;x.fillRect(r()*w,r()*h,1+r()*3,1+r()*3);}
  for(let i=0;i<40;i++){const y=r()*h;x.strokeStyle=`rgba(40,20,10,${.05+r()*.06})`;x.lineWidth=1+r()*3;x.beginPath();x.moveTo(0,y);x.bezierCurveTo(w*.3,y+(r()-.5)*20,w*.7,y+(r()-.5)*20,w,y+(r()-.5)*10);x.stroke();}
  // 帯（浮き輪を巻く麻色の帯）
  for(const bx of[w*.18,w*.82]){x.fillStyle='#c9a77c';x.fillRect(bx-12,0,24,h);x.fillStyle='rgba(90,60,30,.35)';for(let y=0;y<h;y+=6)x.fillRect(bx-12,y,24,1);x.strokeStyle='rgba(60,40,20,.5)';x.strokeRect(bx-12,0,24,h);}
  // 下の方ほど藻の膜（喫水線より下）
  const ag=x.createLinearGradient(0,h*.55,0,h);ag.addColorStop(0,'rgba(70,90,40,0)');ag.addColorStop(1,'rgba(70,90,40,.35)');x.fillStyle=ag;x.fillRect(0,0,w,h);
  for(let i=0;i<60;i++){const px=r()*w,py=r()*h;x.fillStyle='rgba(255,255,255,.18)';x.beginPath();x.ellipse(px,py,2+r()*3,1.5+r()*2,0,0,7);x.fill();x.fillStyle='rgba(255,255,255,.35)';x.beginPath();x.arc(px-1,py-1,.8,0,7);x.fill();}
  return c;}
function bnStart(host,onDone){bnStop();const cv=document.createElement('canvas');cv.className='bn';host.appendChild(cv);const ctx=cv.getContext('2d');const info=document.createElement('div');info.className='bni';host.appendChild(info);
  const dpr=Math.min(2,window.devicePixelRatio||1),W=Math.min(560,window.innerWidth-32),H=Math.round(W*.52);cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';ctx.scale(dpr,dpr);
  const hull=bnHull(W,H),r=bnRand(77);const sprites=[];for(let i=0;i<28;i++){const R=10+r()*16;sprites.push({R,c:bnSprite(R,1000+i)});}
  const B=[];const spawn=(n)=>{for(let k=0;k<n;k++){let tries=0;while(tries++<40){const sp=sprites[Math.floor(r()*sprites.length)],x0=20+r()*(W-40),y0=20+r()*(H-40);if(B.some(b=>!b.gone&&Math.hypot(b.x-x0,b.y-y0)<b.sp.R+sp.R+2))continue;B.push({x:x0,y:y0,sp,hp:1+Math.round(sp.R/9),hit:0,cr:[],gone:false});break;}}};
  spawn(22);const scars=[],bits=[];let score=0,combo=0,lastHit=0,mx=W/2,my=H/2,swing=0;
  const pos=e=>{const b=cv.getBoundingClientRect();const t=e.touches?e.touches[0]:e;return[(t.clientX-b.left)*W/b.width,(t.clientY-b.top)*H/b.height];};
  const down=e=>{e.preventDefault();[mx,my]=pos(e);swing=1;const now=performance.now();BN.lastT=now;let hitAny=false;
    for(let i=B.length-1;i>=0;i--){const b=B[i];if(b.gone)continue;if(Math.hypot(b.x-mx,b.y-my)<b.sp.R*1.05){hitAny=true;b.hp--;b.hit=1;const rr=bnRand(i*31+b.hp);b.cr.push([rr()*6.28,.3+rr()*.6]);for(let k=0;k<5;k++)bits.push({x:mx,y:my,vx:(Math.random()-.5)*160,vy:-Math.random()*140,a:Math.random()*6,s:1.5+Math.random()*2.5,t:0,c:'#e8b4b0'});
        if(typeof AU!=='undefined'&&AU.ctx&&typeof burst==='function')burst(AU.sfx,AU.ctx.currentTime,.06,.35,'bandpass',2200+Math.random()*1500,1200,1.2,0,.001);
        if(b.hp<=0){b.gone=true;combo=now-lastHit<900?combo+1:1;lastHit=now;score+=1;scars.push({x:b.x,y:b.y,R:b.sp.R});b.fly={vx:(Math.random()-.5)*220,vy:-120-Math.random()*160,rot:0,vr:(Math.random()-.5)*12,t:0};for(let k=0;k<12;k++)bits.push({x:b.x,y:b.y,vx:(Math.random()-.5)*260,vy:-Math.random()*220,a:Math.random()*6,s:2+Math.random()*3,t:0,c:Math.random()<.5?'#c8505a':'#f0d8d0'});
          if(typeof AU!=='undefined'&&AU.ctx&&typeof burst==='function')burst(AU.sfx,AU.ctx.currentTime,.12,.55,'lowpass',1600,500,.8,0,.002);}
        break;}}
    if(!hitAny)combo=0;if(B.filter(b=>!b.gone).length<6)spawn(10);};
  const move=e=>{[mx,my]=pos(e);};cv.addEventListener('pointerdown',down);cv.addEventListener('pointermove',move);
  let last=performance.now(),raf=0;const loop=t=>{const dt=Math.min(.05,(t-last)/1000);last=t;
    ctx.drawImage(hull,0,0);
    for(const s of scars){ctx.fillStyle='rgba(240,232,220,.55)';ctx.beginPath();ctx.ellipse(s.x,s.y,s.R*.9,s.R*.84,0,0,7);ctx.fill();ctx.strokeStyle='rgba(200,180,165,.7)';ctx.lineWidth=1.2;for(let k=1;k<4;k++){ctx.beginPath();ctx.ellipse(s.x,s.y,s.R*.25*k,s.R*.23*k,0,0,7);ctx.stroke();}}
    for(const b of B){const S=b.sp.c.width;if(b.gone){if(!b.fly||b.fly.t>1.2)continue;const f=b.fly;f.t+=dt;f.vy+=420*dt;b.x+=f.vx*dt;b.y+=f.vy*dt;f.rot+=f.vr*dt;ctx.save();ctx.globalAlpha=Math.max(0,1-f.t/1.2);ctx.translate(b.x,b.y);ctx.rotate(f.rot);ctx.drawImage(b.sp.c,-S/2,-S/2);ctx.restore();continue;}
      const sh=b.hit>0?(Math.random()-.5)*3*b.hit:0;b.hit=Math.max(0,b.hit-dt*6);ctx.drawImage(b.sp.c,b.x-S/2+sh,b.y-S/2);
      for(const[a,l]of b.cr){ctx.strokeStyle='rgba(60,15,20,.85)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(b.x+sh,b.y);let px=b.x,py=b.y;for(let k=1;k<=4;k++){px=b.x+Math.cos(a+(k%2?.25:-.2))*b.sp.R*l*k/4;py=b.y+Math.sin(a+(k%2?.25:-.2))*b.sp.R*l*k/4;ctx.lineTo(px+sh,py);}ctx.stroke();}}
    for(let i=bits.length-1;i>=0;i--){const p=bits[i];p.t+=dt;p.vy+=500*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.t>.8){bits.splice(i,1);continue;}ctx.fillStyle=p.c;ctx.globalAlpha=1-p.t/.8;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a+p.t*8);ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.7);ctx.restore();ctx.globalAlpha=1;}
    // スクレーパー（へら）：ポインターの位置、たたくと振り下ろす
    swing=Math.max(0,swing-dt*7);ctx.save();ctx.translate(mx,my);ctx.rotate(-.7+swing*.6);ctx.fillStyle='#c8ccd0';ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(10,0);ctx.lineTo(7,-16);ctx.lineTo(-7,-16);ctx.closePath();ctx.fill();ctx.strokeStyle='#7d858c';ctx.stroke();
    ctx.fillStyle='#2d5f8a';ctx.fillRect(-4,-40,8,25);ctx.fillStyle='#e0b23a';ctx.fillRect(-4.5,-19,9,3);ctx.restore();
    info.textContent='船体のアカフジツボをたたいてはがそう　はがした数 '+score+(combo>1?'　'+combo+'連続！':'');
    raf=requestAnimationFrame(loop);};
  raf=requestAnimationFrame(loop);BN.on=true;BN.stop=()=>{cancelAnimationFrame(raf);cv.remove();info.remove();BN.on=false;};BN.score=()=>score;BN.list=B;BN.cv=cv;BN.W=W;BN.H=H;}
function bnStop(){if(BN.stop)BN.stop();BN.stop=null;}

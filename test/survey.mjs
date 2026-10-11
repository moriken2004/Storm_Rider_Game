// 描画の総点検：さまざまな場面を撮って一覧にする。node test/survey.mjs [セット名] → test/out/survey_<セット>.png
import puppeteer from 'puppeteer';
const set=process.argv[2]||'a';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage();await p.setViewport({width:960,height:540});p.on('pageerror',e=>console.log('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR');
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const st=document.createElement('style');st.textContent='#radio,#hint,#banner{display:none!important}';document.head.appendChild(st);
  const S=__SR,P=S.P,G=S.G,I=S.input;
  window.fly=(n,alt,steer)=>{for(let i=0;i<n;i++){P.inv=1;I.tx=0;const T=G.target;if(T&&steer!==false){const dx=T.x-P.pos.x,dz=T.z-P.pos.z;let e=Math.atan2(-dx,-dz)-P.yaw;while(e>3.1416)e-=6.2832;while(e<-3.1416)e+=6.2832;I.tx=Math.max(-1,Math.min(1,-e*2.5));}I.ty=alt===undefined?0:Math.max(-1,Math.min(1,(alt-P.pos.y)/200));S.step(1/30);}};
  // 自由カメラ：位置と向き
  window.cam=(x,y,z,yaw,pit,fov)=>{window.__PCAM=c=>{c.up.set(0,1,0);c.position.set(x,y,z);const cy=Math.cos(pit);c.lookAt(x-Math.sin(yaw)*cy*100,y+Math.sin(pit)*100,z-Math.cos(yaw)*cy*100);c.fov=fov||62;c.updateProjectionMatrix();};};
  window.free=()=>{window.__PCAM=null;};window.hud=on=>{document.getElementById('hud').style.visibility=on?'':'hidden';document.getElementById('fhud').style.visibility=on?'':'hidden';};});
const BZ=21000;
const SETS={
 // 通常の追尾カメラ：各局面と高度
 a:[['接近・低空','S.startRun("approach");P.pos.y=40;fly(60,40)'],['接近・高空','S.startRun("approach");P.pos.y=2600;fly(60,2600)'],['接近・雲の中','S.startRun("approach");P.pos.set(0,1500,15200);fly(40,1500)'],
    ['バンド','S.startRun("bands");fly(120,420)'],['バンド奥','S.startRun("bands");P.pos.set(0,420,7600);fly(120,420)'],['バンド高空','S.startRun("bands");P.pos.set(0,3200,8000);fly(60,3200)'],
    ['壁雲','S.startRun("wall");fly(60,420)'],['壁雲の中','S.startRun("wall");P.pos.set(0,420,3800);fly(60,420)'],['壁雲・高空','S.startRun("wall");P.pos.set(0,3000,3600);fly(40,3000)'],
    ['目','S.startRun("eye");fly(60)'],['目・上向き','S.startRun("eye");fly(20);P.pitch=.9;fly(25,undefined,false)'],['目・海面','S.startRun("eye");P.pos.y=30;fly(50,30)'],
    ['帰還','S.startRun("ret");fly(80,600)'],['帰還・基地手前','S.startRun("ret");P.pos.set(30,300,'+(BZ-3000)+');P.yaw=Math.PI;fly(40,300,false)'],['帰還・夕景高空','S.startRun("ret");P.pos.set(0,4000,12000);P.yaw=Math.PI;fly(40,4000,false)'],
    ['急旋回','S.startRun("approach");fly(20,600);for(let i=0;i<40;i++){S.input.tx=1;P.inv=1;S.step(1/30);}']],
 // 自由カメラ：島と基地、海、地平線、雲の境目
 b:[['島・遠景','S.startRun("approach");cam(-3500,600,'+(BZ+2500)+',-2.2,-.08)'],['島・真上','cam(0,2500,'+BZ+',0,-1.45)'],['基地・低空','cam(260,60,'+(BZ-900)+',3.0,-.05)'],['滑走路・地面すれすれ','cam(30,17,'+(BZ-700)+',3.1416,0)'],
    ['海岸線','cam(1700,25,'+(BZ+300)+',1.6,-.03)'],['山の裏','cam(-1500,300,'+(BZ-200)+',-1.5,-.1)'],['桟橋と船','cam(600,40,'+(BZ-1500)+',2.6,-.05)'],['灯台','cam(700,120,'+(BZ-1500)+',.4,-.1)'],
    ['海面すれすれ・順光','cam(0,3,16000,0,.02)'],['海面すれすれ・逆光','cam(0,3,16000,3.1416,.02)'],['真下の海','cam(0,800,15000,0,-1.5)'],['水平線と空','cam(4000,9000,16000,1.2,-.05)'],
    ['雲の上','cam(0,6500,6000,0,-.25)'],['雲底の下','cam(0,250,6000,0,.25)'],['雲の中から外','cam(0,1200,4300,3.1416,0)'],['目の壁を内側から','cam(0,1500,0,1.0,.15)']],
 // 演出と特殊な状態
 c:[['落雷の瞬間','S.opts.diff=2;S.startRun("bands");P.pos.set(0,420,7600);fly(150,420);for(let i=0;i<200&&!(S.U.uFlashI&&S.U.uFlashI.value>.3);i++)fly(1,420)'],['被弾','S.opts.diff=0;S.startRun("wall");fly(30,420);P.inv=0;P.hull=100;S.damage(14,"落雷の直撃を受けた");for(let i=0;i<6;i++)S.step(1/30)'],
    ['瀕死','S.startRun("wall");fly(30,420);P.hull=18;for(let i=0;i<20;i++)S.step(1/30)'],['海面のしぶき','S.startRun("approach");P.pos.y=14;for(let i=0;i<50;i++){P.pos.y=14;P.pitch=0;P.inv=1;S.step(1/30)}'],
    ['竜巻','S.startRun("bands");(()=>{const sp=S.spouts.find(s=>s.mesh.visible);if(sp){const q=sp.mesh.position;cam(q.x+700,300,q.z+900,Math.atan2(700,900),.1);}})()'],['竜巻・近く','(()=>{const sp=S.spouts.find(s=>s.mesh.visible);if(sp){const q=sp.mesh.position;cam(q.x+160,120,q.z+200,Math.atan2(160,200),.35);}})()'],
    ['ゲート環','free();S.startRun("eye");fly(90)'],['発射カット 2s','S.startCut(S.CUTS.CUT_FIRE1);S.tick(60,1/30)'],['発射カット 4s','S.tick(60,1/30)'],['崩壊 8s','S.endCut();S.startRun("spare");G.spareGiven=true;P.hasPod=true;S.tick(20,1/30);S.startCut(S.CUTS.CUT_FIRE2);S.tick(240,1/30)'],['崩壊 14s','S.tick(180,1/30)'],
    ['着陸 3s','S.endCut();S.startRun("ret");P.pos.set(30,300,'+(BZ-3600)+');P.yaw=Math.PI;S.tick(10,1/30);S.startCut(S.CUTS.CUT_LAND);S.tick(90,1/30)'],['着陸 10s','S.tick(210,1/30)'],['着陸 20s','S.tick(300,1/30)'],
    ['出撃 3s','S.endCut();S.startCut(S.CUTS.CUT_INTRO);S.tick(90,1/30)'],['出撃 34s','S.tick(930,1/30)']]};
const list=SETS[set],shots=[];
for(const[name,code]of list){await p.evaluate(c=>{const S=__SR,P=S.P,G=S.G;if(!/cam\(/.test(c)&&!/tick\(/.test(c))free();hud(false);eval(c);S.cloudCut();if(window.__PCAM){G.mode=G.mode==='cut'?'cut':'title';G.optPrev=false;}for(let i=0;i<10;i++)S.step(1/60);},code).catch(e=>console.log(name,e.message));
  await new Promise(r=>setTimeout(r,200));shots.push([name,(await p.screenshot({type:'jpeg',quality:80})).toString('base64')]);}
const q=await b.newPage(),cols=4,rows=Math.ceil(shots.length/cols);await q.setViewport({width:1920,height:rows*270});
await q.setContent('<!doctype html><body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(4,480px);grid-auto-rows:270px;font:13px sans-serif;color:#fff">'+shots.map(([n,d],i)=>`<div style="position:relative"><img style="display:block" width=480 height=270 src="data:image/jpeg;base64,${d}"><b style="position:absolute;left:3px;top:3px;background:rgba(0,0,0,.7);padding:0 4px">${i+1} ${n}</b></div>`).join('')+'</body>');
await q.screenshot({path:new URL(`./out/survey_${set}.png`,import.meta.url).pathname});console.log('done',set);await b.close();

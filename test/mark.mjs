// 次の目標の印：画面のあちこちに目標を置き、画面内なら印がその場所に、画面外なら縁に矢印で出るかを確かめる（スマートフォン横向きとパソコン）
import puppeteer from 'puppeteer';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;
for(const[dev,vp]of[['phone',{width:844,height:390,deviceScaleFactor:3,isMobile:true,hasTouch:true,isLandscape:true}],['phoneSE',{width:667,height:375,deviceScaleFactor:2,isMobile:true,hasTouch:true,isLandscape:true}],['desk',{width:1280,height:720}]]){
  const b=await puppeteer.launch({headless:'new'});const p=await b.newPage();
  if(vp.isMobile)await p.emulate({viewport:vp,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});else await p.setViewport(vp);
  await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
  const r=await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR,G=S.G,P=S.P;S.startRun('approach');if(G.mode==='cut')S.endCut();S.step(1/30);const out=[];const cam=S.camera,V=cam.position.constructor;
    for(const[nx,ny]of[[0,0],[0,.3],[0,.6],[0,.85],[.5,.4],[-.6,-.5],[.9,0],[0,-.7],[2,0],[0,2],[0,-2]]){   // 画面の正規化座標（±1 が端、2 は画面外）
      const v=new V(nx,-ny,.98).unproject(cam);G.target=v;S.step(0);const el=document.getElementById('mark'),m=el.style.transform.match(/translate\(([-\d.]+)px, ?([-\d.]+)px\)/);
      const sx=(nx*.5+.5)*innerWidth,sy=(ny*.5+.5)*innerHeight;out.push({n:[nx,ny],want:[Math.round(sx),Math.round(sy)],got:m?[Math.round(+m[1]),Math.round(+m[2])]:null,off:el.classList.contains('off')});}
    return{W:innerWidth,H:innerHeight,out};});
  let bad=0;for(const o of r.out){const inside=Math.abs(o.n[0])<1&&Math.abs(o.n[1])<1;const err=o.got?Math.hypot(o.got[0]-o.want[0],o.got[1]-o.want[1]):999;
    const ok=inside?(!o.off?err<3:(Math.abs(o.n[1])>.6||Math.abs(o.n[0])>.85)):o.off;if(!ok)bad++;console.log(dev,JSON.stringify(o),ok?'':'  ← おかしい');}
  console.log(dev+' '+r.W+'×'+r.H+' おかしいもの '+bad+'\n');await b.close();}

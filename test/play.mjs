// 自動操縦で通しプレイ。node test/play.mjs [god]
import puppeteer from 'puppeteer';
const god=process.argv.includes('god');const diff=+(process.argv.find(a=>/^d[0-2]$/.test(a))||'d0')[1];
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--window-size=960,540']});
const p=await b.newPage();await p.setViewport({width:960,height:540});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/404/.test(m.text()))errs.push(m.text());});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:40000});
await p.evaluate((diff)=>{__SR.opts.diff=diff;document.getElementById('title').hidden=true;const S=__SR;S.startCut(S.CUTS.CUT_INTRO);S.tick(30);S.endCut();window.LOG=[];window.lastPh='';},diff);
let done=false;
for(let chunk=0;chunk<140&&!done;chunk++){
  const r=await p.evaluate((god)=>{const S=__SR,G=S.G,P=S.P,I=S.input;const t0=performance.now();
    for(let k=0;k<150;k++){
      if(G.mode==='cut'){S.tick(20);S.endCut();continue;}
      if(G.mode==='over'){LOG.push('OVER '+G.cause+' @'+G.phase);document.getElementById('bRetry').click();continue;}
      if(G.mode==='result'){return{done:true,log:LOG,res:document.getElementById('resT').innerText,rank:document.getElementById('rank').textContent};}
      if(god)P.inv=1;
      const T=G.target;if(T){const dx=T.x-P.pos.x,dz=T.z-P.pos.z,dy=T.y-P.pos.y,d=Math.hypot(dx,dz);
        let e=Math.atan2(-dx,-dz)-P.yaw;while(e>Math.PI)e-=6.2832;while(e<-Math.PI)e+=6.2832;
        I.tx=Math.max(-1,Math.min(1,-e*2.5));
        let dp=Math.atan2(dy,Math.max(d,150));if((G.phase==='bands'||G.phase==='wall'||G.phase==='approach')&&!G.flags.stall)dp=(420-P.pos.y)/400;
        I.ty=Math.max(-1,Math.min(1,dp/0.5));}
      for(const s of S.strikes){const px=P.pos.x+P.vel.x*s.t,pz=P.pos.z+P.vel.z*s.t;if(Math.hypot(px-s.x,pz-s.z)<135){const c=P.vel.z*(s.x-P.pos.x)-P.vel.x*(s.z-P.pos.z);I.tx=c>0?1:-1;break;}}
      I.tAct=G.prompt?(k%2===0||P.engineOut||P.fire):false;I.tBoost=G.phase==='ret'||!!P.ice;if(G.flags.hailT>0)I.ty=Math.max(-1,Math.min(1,(140-P.pos.y)/120));
      S.step(1/30);
      if(G.phase!==lastPh){lastPh=G.phase;LOG.push(G.phase+' t='+G.missionT.toFixed(0)+' hull='+P.hull.toFixed(0));}
    }
    return{done:false,ph:G.phase,t:+G.missionT.toFixed(0),hull:P.hull,r:Math.round(Math.hypot(P.pos.x,P.pos.z)),y:Math.round(P.pos.y),ring:G.ringIdx,ms:+((performance.now()-t0)/150).toFixed(1),mode:G.mode};},god);
  if(r.done){console.log('RESULT',r.rank,JSON.stringify(r.res),'\n'+r.log.join('\n'));done=true;break;}
  if(chunk%5===0)console.log(JSON.stringify(r));
}
if(!done)console.log('NOT FINISHED',await p.evaluate(()=>LOG.join(' | ')));
if(errs.length)console.log(errs.slice(0,10).join('\n'));
await b.close();

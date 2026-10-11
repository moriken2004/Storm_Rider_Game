import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--window-size=1600,900']});
const p=await b.newPage();await p.setViewport({width:1600,height:900,deviceScaleFactor:1.5});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' | '+(e.stack||'').split('\n').slice(1,3).join(' ')));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:60000});
const fps=async(label,setup,ms=2500)=>{await p.evaluate(setup);await new Promise(r=>setTimeout(r,500));
  const r=await p.evaluate((ms)=>new Promise(res=>{let n=0,t0=performance.now();const f=()=>{n++;if(performance.now()-t0<ms)requestAnimationFrame(f);else res(+(n/(performance.now()-t0)*1000).toFixed(1));};requestAnimationFrame(f);}),ms);
  console.log(label.padEnd(34),'fps',r,'scale',await p.evaluate('__SR.view.scale.toFixed(2)+" "+RW+"x"+RH'));};
// 解像度の自動調整を止めて比べる
await p.evaluate('document.getElementById("title").hidden=true;__SR.startRun("approach");__SR.G.flags.b3=1;__SR.P.pos.set(0,400,11000);window.__lock=1;__SR.view.scale=.7;__SR.view.ups=99;resize();');
const lock='__SR.view.scale=.7;resize();';
await fps('bands scale.7',lock);
await fps('  base hidden',lock+'baseGroup.visible=false');
await fps('  + ships/sea life hidden',lock+'ships.forEach(s=>s.m.visible=false)');
await fps('  + shadows off',lock+'renderer.shadowMap.enabled=false;sunL.castShadow=false');
await fps('  + cloud steps 60',lock+'cloudMat.uniforms.uSteps.value=60');
await fps('  + cloud steps 30',lock+'cloudMat.uniforms.uSteps.value=30');
await fps('  + ocean hidden',lock+'ocean.visible=false');
// 着陸ムービーを最後まで
await p.evaluate('baseGroup.visible=true;ocean.visible=true;cloudMat.uniforms.uSteps.value=112;__SR.startRun("ret");__SR.G.flags.e1=1;__SR.P.pos.set(0,300,21000-1700);__SR.P.yaw=Math.PI;__SR.startCut(__SR.CUTS.CUT_LAND)');
const st=await p.evaluate('(()=>{const o=[];for(let i=0;i<26;i++){try{__SR.tick(30);}catch(e){o.push("THROW "+e.message+" "+(e.stack||"").split("\\n")[1]);break;}o.push(__SR.G.mode);}return o.join(",");})()');
console.log('LAND',st);console.log(errs.slice(0,4).join('\n')||'no page errors');
await b.close();

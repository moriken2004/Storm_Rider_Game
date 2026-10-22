// 理想的でない環境での通し確認：起動→出撃→ゲームオーバー→タイトル→設定（格納庫と機体のプレビュー）を、
// 遅い CPU・遅い回線・裏のタブ・WebGL の喪失と復帰・繰り返しで行い、格納庫が見えるか・エラーが出ないかを調べる。node test/stress.mjs [case...]
import puppeteer from 'puppeteer';
const dir=new URL('./out/',import.meta.url).pathname,only=process.argv.slice(2);
const CASES={a:'遅いCPU(6倍)',b:'遅い回線(3G)',c:'読み込み中に裏のタブ',d:'WebGLの喪失と復帰',e:'5回繰り返し'};
const W=ms=>new Promise(r=>setTimeout(r,ms));let bad=0;
for(const[k,name]of Object.entries(CASES)){if(only.length&&!only.includes(k))continue;
  const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
  const p=await b.newPage();await p.setViewport({width:960,height:540});const cdp=await p.createCDPSession();
  const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{const t=m.text();if(m.type()==='error'&&!/404/.test(t))errs.push('CONSOLE '+t.slice(0,160));});
  if(k==='a')await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});
  if(k==='b'){await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:300,downloadThroughput:400*1024/8,uploadThroughput:200*1024/8});}
  const t0=Date.now();await p.goto('http://127.0.0.1:8795/index.html',{timeout:300000});
  if(k==='c'){await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
    await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});await W(8000);await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});document.dispatchEvent(new Event('visibilitychange'));});}
  await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:600000});const tl=((Date.now()-t0)/1000).toFixed(1);
  const st=()=>p.evaluate(()=>{const S=__SR,G=S.G,HG=baseGroup.userData.hangar;let hv=true;for(let q=HG;q;q=q.parent)if(!q.visible)hv=false;const gl=S.renderer.getContext();
    return{mode:G.mode,optPrev:!!G.optPrev,hangar:hv,plane:S.P.mesh.visible,lost:gl.isContextLost(),calls:S.renderer.info.render.calls};});
  const rounds=k==='e'?5:1;const res=[];
  for(let r=0;r<rounds;r++){
    await p.click('#bStart');await W(k==='a'?8000:2500);await p.keyboard.press('Enter');await W(k==='a'?6000:2500);
    if(k==='d'){await p.evaluate(()=>{const e=__SR.renderer.getContext().getExtension('WEBGL_lose_context');window._lc=e;e.loseContext();});await W(1500);await p.evaluate(()=>window._lc.restoreContext());await W(3000);}
    await p.evaluate(()=>{const P=__SR.P;P.inv=0;__SR.damage(999,'t');});
    for(let i=0;i<60;i++){await W(500);if(await p.evaluate(()=>__SR.G.mode==='over'))break;}
    await p.click('#bOTitle');await W(k==='a'?6000:2500);await p.click('#bOpts');await W(k==='a'?8000:3000);
    const s=await st();res.push(s);await p.screenshot({path:dir+'stress_'+k+'_'+r+'.png'});
    await p.evaluate(()=>document.querySelector('#opts .bBack').click());await W(1500);}
  const ok=res.every(s=>s.mode==='title'&&s.optPrev&&s.hangar&&s.plane&&!s.lost)&&!errs.length;if(!ok)bad++;
  console.log((ok?'✓ ':'✗ ')+name+' 読み込み'+tl+'秒 '+JSON.stringify(res)+(errs.length?'\n  '+errs.slice(0,4).join('\n  '):''));
  await b.close();}
console.log(bad?'問題 '+bad+' 件':'問題なし');

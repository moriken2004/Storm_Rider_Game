// 重さの計測：版ごと・場面ごとに 1 コマの描画時間（GPU の完了まで待つ）と描画回数・ポリゴン数を測る
// node test/perf.mjs  → 現在の版・v72・v63 を比べる。旧版は test/out/ に置く（例: git show 76f66e2:index.html > test/out/v72.html）。無い版は飛ばす
import puppeteer from 'puppeteer';import fs from 'fs';
const out=n=>new URL('./out/'+n,import.meta.url).pathname;
const VERS=[['現在','/index.html'],['v72','/test/out/v72.html'],['v63','/test/out/v63.html']];
const Z=21000;
// 場面：[名前, 開始局面, カメラ位置, 注視点]（高さは地面からではなく絶対）
const SCN=[['基地の低空',[300,40,Z-150],[300,15,Z+300]],['島の上空',[-600,350,Z-900],[400,0,Z+300]],['港の低空',[1380,30,Z+560],[1240,10,Z+150]],['森の低空',[650,80,Z-950],[300,40,Z-700]],['外洋',[0,400,Z-6000],[0,0,Z-9000]],['台風の目',[0,3000,9000],[0,1500,0]]];
async function run(mobile){
  const res={};
  for(const[vn,url]of VERS){if(url.includes('/test/out/')&&!fs.existsSync(new URL('..'+url,import.meta.url)))continue;const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();
    if(mobile)await p.emulate({viewport:{width:844,height:390,deviceScaleFactor:3,isMobile:true,hasTouch:true,isLandscape:true},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
    else await p.setViewport({width:1280,height:720});
    p.on('pageerror',e=>console.log(vn,'PAGEERR '+e.message));
    await p.goto('http://127.0.0.1:8795'+url);await p.waitForFunction('window.__SR',{timeout:200000});
    res[vn]={};
    for(const[sn,c,l]of SCN){
      const r=await p.evaluate(async(c,l)=>{window.requestAnimationFrame=()=>0;const S=__SR;if(S.G.mode!=='play'){S.startRun('approach');if(S.G.mode==='cut')S.endCut();}
        window.__PCAM=cam=>{cam.position.set(...c);cam.lookAt(...l);cam.fov=62;cam.updateProjectionMatrix();};
        const gl=document.getElementById('gl').getContext('webgl2');S.cloudCut&&S.cloudCut();for(let i=0;i<20;i++){S.step(1/30);}gl.finish();
        const N=40,t0=performance.now();for(let i=0;i<N;i++){S.step(1/30);gl.finish();}const ms=(performance.now()-t0)/N;
        let inf=null;if(S.renderer){const R=S.renderer;R.info.autoReset=false;R.info.reset();S.step(1/30);inf={calls:R.info.render.calls,triangles:R.info.render.triangles};R.info.autoReset=true;}return{ms:+ms.toFixed(1),calls:inf?inf.calls:null,tri:inf?Math.round(inf.triangles/1000):null};},c,l);
      res[vn][sn]=r;}
    await b.close();}
  return res;}
for(const mobile of[false,true]){const r=await run(mobile);console.log('\n=== '+(mobile?'スマートフォン相当（844×390・画素3倍・軽い画質から）':'パソコン（1280×720）')+' ===');
  console.log('場面'.padEnd(8),VERS.map(v=>v[0].padStart(16)).join(''));
  for(const[sn]of SCN)console.log(sn.padEnd(8),VERS.map(([vn])=>{const x=r[vn]&&r[vn][sn];if(!x)return '-'.padStart(16);return((x.ms+'ms')+(x.calls!=null?' '+x.calls+'回/'+x.tri+'k':'')).padStart(16);}).join(''));}

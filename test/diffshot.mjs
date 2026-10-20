// ディフューザーの見た目の確認：滑走路の上に置いて 4 方向から撮る。node test/diffshot.mjs <接頭辞>
import puppeteer from 'puppeteer';import {execFileSync} from 'child_process';
const pre=process.argv[2]||'a',dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:300000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('title').hidden=true;document.getElementById('hud').hidden=true;const S=__SR;S.startRun('approach');if(S.G.mode==='cut')S.endCut();S.P.pos.set(0,2000,0);
  const d=buildDiffuser();d.position.set(60,RWY_Y+3,BASE.z+200);d.rotation.y=.5;scene.add(d);window._d=d;d.updateMatrixWorld(true);for(let i=0;i<5;i++)S.step(1/30);});
const V=[[-.6,.25,9],[1.571,.08,8.5],[2.6,.3,9],[-.3,.12,4.2],[2.9,.05,3.8],[-1.2,1.1,8]],shots=[];
for(let i=0;i<V.length;i++){await p.evaluate(v=>{const S=__SR,c=S.camera,d=window._d,cx=d.position.x,cy=d.position.y,cz=d.position.z;const fw=new THREE.Vector3(0,0,1).applyQuaternion(d.quaternion);
    const tz=v[2]<5?(v[0]>2?3:-3):0;const tc=new THREE.Vector3(cx,cy,cz).addScaledVector(fw,tz);const a=v[0]+d.rotation.y;
    for(let k=0;k<4;k++){c.position.set(tc.x+Math.sin(a)*Math.cos(v[1])*v[2],tc.y+Math.sin(v[1])*v[2],tc.z+Math.cos(a)*Math.cos(v[1])*v[2]);c.lookAt(tc);c.fov=40;c.updateProjectionMatrix();if(!k)S.cloudCut();renderFrame();}},V[i]);
  const f=dir+'df_'+pre+'_'+i+'.png';await p.screenshot({path:f});shots.push(f);}
execFileSync('/opt/homebrew/bin/ffmpeg',['-v','error','-y',...shots.flatMap(f=>['-i',f]),'-filter_complex',shots.map((_,i)=>'['+i+']scale=640:-1['+i+'s]').join(';')+';'+shots.map((_,i)=>'['+i+'s]').join('')+'xstack=inputs=6:layout=0_0|w0_0|w0+w1_0|0_h0|w0_h0|w0+w1_h0',dir+'df_'+pre+'.jpg']);
console.log(errs.slice(0,3).join('\n')||'エラーなし');await b.close();

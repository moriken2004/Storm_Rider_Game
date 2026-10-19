// 爆発と炎の見た目を時間を追って撮る（見た目の確認用）。node test/boomshot.mjs <接頭辞>
import puppeteer from 'puppeteer';import {execFileSync} from 'child_process';
const pre=process.argv[2]||'a',url=process.argv[3]||'/index.html',dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:600000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
await p.evaluateOnNewDocument(()=>{let a=3;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|ERROR/i.test(m.text()))errs.push(m.text().slice(0,400));});
await p.goto('http://127.0.0.1:8795'+url);await p.waitForFunction('window.__SR',{timeout:200000});
const ev=(f,...a)=>p.evaluate(f,...a);
await ev(()=>{window.requestAnimationFrame=()=>0;document.getElementById('title').hidden=true;document.getElementById('hud').hidden=true;document.body.classList.add('nohud');document.getElementById('fhud').style.display='none';const S=__SR,G=S.G;S.startRun('approach');if(G.mode==='cut')S.endCut();G.mode='play';S.P.inv=1e9;});
// カメラを固定して時間を進め、決まった時刻に撮る
const seq=async(name,cam,fire,times)=>{await ev((cam,fire)=>{const S=__SR;S.P.pos.set(cam[0],2500,cam[2]+3000);(0,eval)(fire);window._t=0;S.cloudCut();},cam,fire);
  const shots=[];for(const t of times){await ev((cam,t)=>{const S=__SR,c=S.camera;while(window._t<t){S.P.pos.y=2500;S.step(1/30);window._t+=1/30;}for(let k=0;k<3;k++){c.position.set(cam[0],cam[1],cam[2]);c.lookAt(cam[3],cam[4],cam[5]);c.fov=40;c.updateProjectionMatrix();updateExplosion(0);if(typeof vegUpdate==='function')vegUpdate(0);if(STR.init)strUpdate(0);renderFrame();}},cam,t);
    const f=dir+'bs_'+pre+'_'+name+'_'+t+'.png';await p.screenshot({path:f});shots.push(f);}
  execFileSync('/opt/homebrew/bin/ffmpeg',['-v','error','-y',...shots.flatMap(f=>['-i',f]),'-filter_complex',shots.map((_,i)=>'['+i+']scale=480:-1['+i+'s]').join(';')+';'+shots.map((_,i)=>'['+i+'s]').join('')+'xstack=inputs='+shots.length+':layout='+shots.map((_,i)=>(i%2?'w0':'0')+'_'+(i>=2?'h0':'0')).join('|'),dir+'bs_'+pre+'_'+name+'.jpg']);};
const B=await ev(()=>[BASE.x,BASE.z]);
// 1 空中の機体の爆発（海の上）
await seq('air',[0,320,B[1]-2400,0,300,B[1]-2600],'explode(new THREE.Vector3(0,300,BASE.z-2600),1,"air")',[0.15,0.5,1.2,3]);
// 2 建物（基地の施設を壊す）
const bc=await ev(()=>{strInit();const o=STR.cols.find(o=>!o.dead&&o.c[8]===0&&!o.c[7]&&(o.c[3]-o.c[0])>18&&Math.abs((o.c[0]+o.c[3])/2-BASE.x)<600&&(o.c[4]-o.c[1])>12);const c=o.c;window._bo=o;return[(c[0]+c[3])/2,c[1],(c[2]+c[5])/2,c[4]-c[1]];});
await seq('bldg',[bc[0]-150,bc[1]+60,bc[2]+150,bc[0],bc[1]+bc[3]*.5,bc[2]],'strKill(window._bo)',[0.15,0.6,2,6]);
// 3 燃料タンク
const tc=await ev(()=>{const o=STR.cols.find(o=>!o.dead&&o.c[8]===3);const c=o.c;window._to=o;return[(c[0]+c[3])/2,c[1],(c[2]+c[5])/2];});
await seq('tank',[tc[0]-170,tc[1]+50,tc[2]+130,tc[0],tc[1]+20,tc[2]],'strKill(window._to)',[0.2,0.8,2.5,8]);
// 4 海面
await seq('sea',[300,40,B[1]-2200,0,20,B[1]-2500],'explode(new THREE.Vector3(0,6,BASE.z-2500),.8,"air")',[0.2,0.7,1.5,3]);
// 5 森の火災
const T=await ev(()=>{vegInit();let id=-1;for(let j=0;j<VEG.X.length;j+=41)if(VEG.set[j]===0&&VEG.G[j]>25){id=j;break;}return[VEG.X[id],VEG.G[id],VEG.Z[id]];});
await seq('forest',[T[0]-110,T[1]+45,T[2]+110,T[0],T[1]+8,T[2]],`vegIgnite(${T[0]},${T[2]},20)`,[1,6,15,30]);
console.log(errs.slice(0,5).join('\n')||'エラーなし');await b.close();

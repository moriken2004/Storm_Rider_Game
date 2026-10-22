// 係留中の船を、船の向きに合わせた視点から撮る。node test/shipinsp.mjs [cargo|patrol|fish] [接頭辞]
import puppeteer from 'puppeteer';import {execFileSync} from 'child_process';
const kind=process.argv[2]||'patrol',pre=process.argv[3]||'sh';const dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{const t=m.text();if((m.type()==='error'||/shader error/.test(t))&&!/Failed to load resource/.test(t))errs.push(t.slice(0,200));});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('bExplore').click();});await p.waitForFunction('EX.on&&!exLoading',{timeout:120000,polling:100});
// 視点：[名前, 船の座標での カメラ(x,y,z), 注視点(x,y,z)]。船首は -z、L は船の長さ
const V={patrol:[['fq',[14,9,-46],[0,6,-20]],['side',[24,6,0],[0,5,0]],['stern',[10,8,46],[0,5,20]],['bridge',[6,12,-16],[0,9,-6]],['deck',[3,10,14],[0,6,4]],['bow',[4,9,-38],[0,6,-26]]],
  fish:[['fq',[8,5,-20],[0,2.5,-6]],['side',[11,3.5,0],[0,2.5,0]],['stern',[5,5,20],[0,2.5,6]],['cabin',[3.5,5.5,-3],[0,3.5,1.2]],['deck',[2.5,6,13],[0,2.5,8]],['bow',[2,4.5,-14],[0,2.5,-9]]],
  cargo:[['fq',[40,25,-150],[0,15,-80]],['side',[60,12,0],[0,10,0]],['stern',[30,22,140],[0,20,70]],['bridge',[22,32,40],[0,30,60]],['deck',[10,18,-40],[0,12,-60]],['bow',[8,16,-110],[0,12,-90]]]}[kind];
const shots=[];
for(const[n,c,l]of V){await p.evaluate((kind,c,l)=>{const s=__SR.ships.find(x=>x.moored&&x.m.userData.kind===kind);const m=s.m;m.updateMatrixWorld(true);const C=new THREE.Vector3(...c).applyMatrix4(m.matrixWorld),L=new THREE.Vector3(...l).applyMatrix4(m.matrixWorld);
   EX.pos.set(C.x+30,0,C.z+30);EX.camReset=true;for(let i=0;i<4;i++)__SR.step(1/30);EX.camFix=[C.x,C.y,C.z,L.x,L.y,L.z];for(let i=0;i<4;i++)__SR.step(1/30);},kind,c,l);
  const f=dir+pre+'_'+n+'.png';await p.screenshot({path:f});shots.push(f);}
execFileSync('/opt/homebrew/bin/ffmpeg',['-v','error','-y',...shots.flatMap(f=>['-i',f]),'-filter_complex',shots.map((_,i)=>'['+i+']scale=640:-1['+i+'s]').join(';')+';'+shots.map((_,i)=>'['+i+'s]').join('')+'xstack=inputs=6:layout=0_0|w0_0|w0+w1_0|0_h0|w0_h0|w0+w1_h0',dir+pre+'_grid.jpg']);
console.log(errs.slice(0,4).join('\n')||'エラーなし');await b.close();

// AquaTopia の近景検査：決めた視点ごとに撮って 1 枚に並べる。node test/exinsp.mjs [名前,...]
import puppeteer from 'puppeteer';import {execFileSync} from 'child_process';
const dir=new URL('./out/',import.meta.url).pathname;
// [名前, 船の位置(基地からの相対 x,z), カメラ(相対 x,y,z), 注視点(相対 x,y,z)]  y は絶対
const V=[
 ['car',[1150,-140],[1136,6.4,-160],[1143,5,-150]],
 ['crane',[1240,60],[1255,8,40],[1276,22,60]],
 ['bldg',[1150,-60],[1135,8,-90],[1110,10,-60]],
 ['tree',[-300,-1000],[-300,21,-1012],[-280,22,-990]],
 ['beach',[735,-1270],[720,3.4,-1262],[762,0,-1318]],
 ['shore',[770,-1310],[778,1.6,-1325],[735,1,-1262]],
 ['apron',[1150,-100],[1160,6.2,-110],[1150,4.6,-95]],
 ['ground',[-300,-1000],[-292,20.5,-1006],[-300,17.5,-985]],
 ['push',[1150,-150],[1155,8,-138],[1140,4.6,-150]],
 ['forest',[-300,-1000],[-318,22,-1030],[-300,24,-990]],
 ['grassz',[-300,-1000],[-296,19.6,-1010],[-300,18.5,-1000]],
 ['roofA',[300,330],[372,41,350],[390,31,372]],
 ['roofB',[300,330],[230,36,330],[300,28,400]],
 ['tower',[300,330],[172,32,330],[200,20,360]],
 ['pipe',[1150,-150],[1146,10,-150],[1200,6,-125]],
 ['contEnd',[1240,470],[1212,16,500],[1190,6,450]],
 ['road',[700,330],[690,30,340],[720,22,300]],
 ['harbTop',[1400,150],[1330,330,150],[1331,0,150]],
 ['harbN',[1330,-200],[1360,14,-140],[1290,0,-200]],
 ['harbS',[1330,500],[1360,14,440],[1290,0,500]],
 ['clear',[760,-1305],[752,3.2,-1292],[770,-1.5,-1318]],
 ['boatC',[1420,150],[1416.5,2.0,147.5],[1420,1.1,150]],
 ['cargoC',[1345,180],[1330,3,215],[1309,6,170]],
 ['cargoU',[1335,150],[1330,-6,250],[1309,-6,225]],
 ['patrolC',[1380,60],[1385,4,70],[1362,3,37]],
 ['fishC',[1350,330],[1352,3,326],[1342,1.5,315]],
 ['start',[1420,150],[1440,4,150],[1400,2,150]],
 ['boat',[1420,150],[1414,2.6,145],[1420,1,150]],
];
const want=process.argv[2]?process.argv[2].split(','):null;const views=V.filter(v=>!want||want.includes(v[0]));
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{const t=m.text();if((m.type()==='error'||/shader error|ERROR:/.test(t))&&!/Failed to load resource/.test(t))errs.push('CONSOLE '+t.replace(/\n/g,' ').slice(0,400));});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('bExplore').click();});await p.waitForFunction('EX.on&&!exLoading',{timeout:120000,polling:100});
const shots=[];
for(const[n,bp,c,l]of views){const ms=await p.evaluate((bp,c,l)=>{const S=__SR;const x=BASE.x+bp[0],z=BASE.z+bp[1];EX.pos.set(x,Math.max(0,exGround(x,z)),z);EX.depth=0;EX.vel&&EX.vel.set(0,0,0);EX.spd=0;
  EX.camFix=[BASE.x+c[0],c[1],BASE.z+c[2],BASE.x+l[0],l[1],BASE.z+l[2]];const gl=S.renderer.getContext(),px=new Uint8Array(4);let ms=0;for(let i=0;i<40;i++){const t0=performance.now();S.step(1/30);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);if(i>=30)ms+=performance.now()-t0;}return +(ms/10).toFixed(1);},bp,c,l);
  const f=dir+'xi_'+n+'.png';await p.screenshot({path:f});shots.push(f);console.log(n.padEnd(8),ms+' ms');}
if(shots.length>1){const cols=3,rows=Math.ceil(shots.length/cols);const fl=[...shots];while(fl.length<cols*rows)fl.push(fl[0]);
  execFileSync('/opt/homebrew/bin/ffmpeg',['-v','error','-y',...fl.flatMap(f=>['-i',f]),'-filter_complex',fl.map((_,i)=>'['+i+']scale=640:-1['+i+'s]').join(';')+';'+fl.map((_,i)=>'['+i+'s]').join('')+'xstack=inputs='+fl.length+':layout='+fl.map((_,i)=>{const cx=i%cols,cy=Math.floor(i/cols);return (cx?Array(cx).fill('w0').join('+'):'0')+'_'+(cy?Array(cy).fill('h0').join('+'):'0');}).join('|'),dir+'xi_grid.jpg']);}
console.log(errs.slice(0,6).join('\n')||'エラーなし');await b.close();

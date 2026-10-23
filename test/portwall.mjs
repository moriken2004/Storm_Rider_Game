// 港の沿岸を探検のボートから、時間を変えて何枚か撮る（波で現れたり消えたりする物がないか）。node test/portwall.mjs [接頭辞]
import puppeteer from 'puppeteer';
const pre=process.argv[2]||'pw',dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:600000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:900,height:500});
await p.goto('http://127.0.0.1:8795/index.html',{timeout:120000});await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:300000,polling:300});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('bExplore').click();});await p.waitForFunction('EX.on&&!exLoading',{timeout:200000,polling:200});
const POS=process.argv[3]?[process.argv[3].split(',').map(Number)]:[[1400,150,-1.57],[1450,-150,2.6],[1350,-120,0],[1500,380,-.4]];
for(let i=0;i<4;i++){const pos=POS[i%POS.length];await p.evaluate(([x,z,a])=>{EX.pos.set(x+BASE.x,0,z+BASE.z);EX.yaw=a;EX.vel.set(0,0,0);for(let k=0;k<40;k++)__SR.step(1/30);},pos);
  await p.screenshot({path:dir+pre+'_'+i+'.jpg',type:'jpeg',quality:85});}
const {execSync}=await import('child_process');execSync(`python3 -c "
from PIL import Image
W=Image.new('RGB',(900,500))
for i in range(4):W.paste(Image.open('${dir}${pre}_'+str(i)+'.jpg').resize((450,250)),((i%2)*450,(i//2)*250))
W.save('${dir}${pre}_grid.jpg')"`);console.log('撮影');await b.close();

// 台風の海で港の防波堤まわりを、時間を進めながら撮る（波の谷で現れる物がないか）。node test/stormport.mjs [接頭辞]
import puppeteer from 'puppeteer';
const pre=process.argv[2]||'sp',dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:600000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:900,height:500});
await p.goto('http://127.0.0.1:8795/index.html',{timeout:120000});await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:300000,polling:300});
const views=process.env.LOW?[[1590,3.5,-120,1540,-1,-185],[1660,3.5,-100,1600,-1,-175],[1500,4,-230,1440,-1,-210]]:[[1760,22,-40,1640,0,-150],[1720,14,150,1668,0,40],[1480,12,-320,1460,0,-200]];
for(let v=0;v<views.length;v++)for(let i=0;i<4;i++){await p.evaluate(([cx,cy,cz,tx,ty,tz],i)=>{window.requestAnimationFrame=()=>0;document.getElementById('title').hidden=true;
    window.__PCAM=(cam)=>{cam.position.set(BASE.x+cx,cy,BASE.z+cz);cam.lookAt(BASE.x+tx,ty,BASE.z+tz);cam.fov=55;cam.updateProjectionMatrix();};for(let k=0;k<12+i*7;k++)__SR.step(1/30);},views[v],i);
  await p.screenshot({path:dir+pre+'_'+v+'_'+i+'.jpg',type:'jpeg',quality:82});}
const {execSync}=await import('child_process');execSync(`python3 -c "
from PIL import Image
W=Image.new('RGB',(1200,600))
for v in range(3):
  for i in range(4):W.paste(Image.open('${dir}${pre}_'+str(v)+'_'+str(i)+'.jpg').resize((300,200)),(i*300,v*200))
W.save('${dir}${pre}_grid.jpg')"`);console.log('撮影');await b.close();

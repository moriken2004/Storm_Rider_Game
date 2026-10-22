import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:540});
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000});
const r=await p.evaluate(async()=>{window.requestAnimationFrame=()=>0;document.getElementById('bExplore').click();const S=__SR,I=S.input;const cv=document.createElement('canvas');cv.width=480;cv.height=120;const cx=cv.getContext('2d');
 const run=(label,setup)=>{EX.pos.set(BASE.x+1900,0,BASE.z+150);EX.yaw=Math.PI*.5;EX.spd=12;cloudReset=true;if(setup)setup();for(let i=0;i<60;i++){I.ty=1;S.step(1/60);}
  let prev=null,acc=0,n=0;for(let i=0;i<40;i++){I.ty=1;S.step(1/60);cx.drawImage(S.renderer.domElement,0,0,S.renderer.domElement.width,S.renderer.domElement.height*.32,0,0,480,120);const d=cx.getImageData(0,0,480,120).data;
   if(prev){let s=0;for(let k=0;k<d.length;k+=4)s+=Math.abs(d[k]-prev[k])+Math.abs(d[k+1]-prev[k+1]);acc+=s/(d.length/4);n++;}prev=d.slice();}return label+' '+(acc/n).toFixed(3);};
 const out=[];for(const n of[.35,.8,1.0,1.5,3]){window.__NEAR=n;out.push(run('near'+n));}return out;});
console.log(r.join('\n'));await b.close();

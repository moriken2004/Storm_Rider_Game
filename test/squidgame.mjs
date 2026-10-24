// ゲームの画面（色調整あり）でアオリイカの群れを撮る。node test/squidgame.mjs [接頭辞]
import puppeteer from 'puppeteer';
const pre=process.argv[2]||'sg',dir=new URL('./out/',import.meta.url).pathname;
const b=await puppeteer.launch({headless:'new',protocolTimeout:900000,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:900,height:500});
await p.goto('http://127.0.0.1:8795/index.html',{timeout:120000});await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:300000,polling:300});
await p.evaluate(()=>{window.requestAnimationFrame=()=>0;document.getElementById('bExplore').click();});await p.waitForFunction('EX.on&&!exLoading',{timeout:200000,polling:200});
const ok=await p.evaluate(()=>{let q=null;for(let rr=600;rr<2600&&!q;rr+=40)for(let a=0;a<6.28;a+=.2){const x=BASE.x+Math.cos(a)*rr,z=BASE.z+Math.sin(a)*rr;if(exGround(x,z)<-20){q=[x,z];break;}}
  EX.pos.set(q[0],-10,q[1]);EX.depth=10;EX.mode='dive';for(const f of SEA.mov)if(f.kind==='squid'){f.wait=0;f.tryNow=f.i%4===0;}
  // 先頭が現れるまで進める（3 割の確率なので、出なければ何度か試す）
  const m4=new THREE.Matrix4(),pp=new V3(),qq=new THREE.Quaternion(),ss=new V3();let t=0;for(;t<2400;t++){EX.pos.set(q[0],-10,q[1]);EX.depth=10;__SR.step(1/30);SEA.squid.getMatrixAt(0,m4);m4.decompose(pp,qq,ss);if(ss.x>0)break;if(t%60===0)for(const f of SEA.mov)if(f.kind==='squid'&&f.i%4===0&&!f.ok){f.wait=0;}}
  for(let i=0;i<40;i++){EX.pos.set(q[0],-10,q[1]);__SR.step(1/30);}
  window.__PCAM=(cam)=>{EX.b.visible=false;SEA.squid.getMatrixAt(1,m4);m4.decompose(pp,qq,ss);const c=pp.clone();SEA.squid.getMatrixAt(0,m4);m4.decompose(pp,qq,ss);c.add(pp).multiplyScalar(.5);cam.position.set(c.x+2.2,c.y+.9,c.z+2.4);cam.lookAt(c);};
  for(let i=0;i<3;i++)__SR.step(1/30);return t;});
await p.screenshot({path:dir+pre+'_0.jpg',type:'jpeg',quality:88});
await p.evaluate(()=>{for(let i=0;i<45;i++)__SR.step(1/30);});await p.screenshot({path:dir+pre+'_1.jpg',type:'jpeg',quality:88});
console.log('現れるまでのコマ',ok);await b.close();

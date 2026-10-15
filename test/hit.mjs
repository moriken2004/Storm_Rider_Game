import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new'});const p=await b.newPage();
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR',{timeout:200000});
console.log(await p.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR,G=S.G,P=S.P,out=[];
  for(const[n,x,z,y]of[['本棟',330,330,22],['消防庁舎',325,230,20],['職員宿舎',405,480,20],['格納庫の作業棟',58,1000,19],['整備工場',405,235,18]]){S.startRun('approach');if(G.mode==='cut')S.endCut();P.inv=0;P.hull=100;P.pos.set(x,y,21000+z-60);P.yaw=Math.PI;P.pitch=0;let res='通り抜けた';
    for(let i=0;i<120;i++){S.input.tx=0;S.input.ty=0;P.pos.y=y;S.step(1/30);if(G.mode!=='play'){res='激突 ('+G.cause+')';break;}}out.push(n+': '+res);}
  return out.join('\n');}));
await b.close();
const b2=await puppeteer.launch({headless:'new'});const q=await b2.newPage();await q.goto('http://127.0.0.1:8795/index.html');await q.waitForFunction('window.__SR',{timeout:200000});
console.log(await q.evaluate(()=>{window.requestAnimationFrame=()=>0;const S=__SR,G=S.G,P=S.P,out=[];
  for(const[i,y,ok]of[[0,20,1],[0,60,0],[1,4,1],[4,10,1],[0,35,1]]){S.startRun('approach');if(G.mode==='cut')S.endCut();const s=S.ships[i];P.inv=0;P.hull=100;const dir=s.h+Math.PI/2;P.pos.set(s.x+Math.sin(dir)*150,y,s.z+Math.cos(dir)*150);P.yaw=dir;let r='通り抜けた';
    for(let k=0;k<90;k++){P.pos.y=y;S.input.tx=0;S.input.ty=0;S.step(1/30);if(G.mode!=='play'){r='激突 ('+G.cause+')';break;}}out.push(s.m.userData.kind+' 高さ'+y+': '+r+(ok?'':'（当たらないのが正しい）'));}
  return out.join('\n');}));await b2.close();

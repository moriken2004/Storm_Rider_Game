// 読み込み中のミニゲーム（アカフジツボはがし）：表示して、フジツボの中心をたたくとはがれるか。node test/bngame.mjs
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:640,deviceScaleFactor:2});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000});
await p.evaluate(()=>{const L=document.getElementById('exload');L.hidden=false;L.classList.remove('out');bnStart(L.querySelector('.bnh'));});
await new Promise(r=>setTimeout(r,500));
const cv=await p.$('canvas.bn');const bb=await cv.boundingBox();
// 何回かたたく（中央付近の数か所）
{const pts=await p.evaluate(()=>BN.list.slice(0,5).map(b=>[b.x/BN.W,b.y/BN.H,b.hp]));for(const[fx,fy,hp]of pts){for(let k=0;k<hp+1;k++){await p.mouse.click(bb.x+bb.width*fx,bb.y+bb.height*fy);await new Promise(r=>setTimeout(r,40));}}
  const p2=await p.evaluate(()=>BN.list.slice(5,8).map(b=>[b.x/BN.W,b.y/BN.H]));for(const[fx,fy]of p2){await p.mouse.click(bb.x+bb.width*fx,bb.y+bb.height*fy);await new Promise(r=>setTimeout(r,40));}}
await p.mouse.move(bb.x+bb.width*.45,bb.y+bb.height*.45);await new Promise(r=>setTimeout(r,120));
await p.screenshot({path:'test/out/barnacle_game.png'});await p.screenshot({path:'test/out/barnacle_zoom.png',clip:{x:bb.x+bb.width*.1,y:bb.y+bb.height*.1,width:bb.width*.4,height:bb.height*.45}});
const sc=await p.evaluate(()=>BN.score());console.log('はがした数',sc);console.log(errs[0]||(sc>=5?'ミニゲームよし':'ミニゲームに問題'));await b.close();

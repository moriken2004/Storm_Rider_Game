// 光の数が場面で変わらないか（変わると全部の材質のシェーダが作り直しになり固まる）。node test/lightcount.mjs
import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const p=await b.newPage();await p.setViewport({width:960,height:640,deviceScaleFactor:1});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8795/index.html');await p.waitForFunction('window.__SR&&document.getElementById("load").hidden',{timeout:200000,polling:100});
const r=await p.evaluate(async()=>{const cnt=()=>{const c={};scene.traverseVisible(o=>{if(o.isLight)c[o.type]=(c[o.type]||0)+1;});return JSON.stringify(c);};const out={};
  const HG=baseGroup.userData.hangar;out['タイトル']=cnt();const v=HG.visible;HG.visible=!v;out['格納庫の表示を反転']=cnt();HG.visible=v;
  P.mesh.visible=false;out['機体を隠す（墜落）']=cnt();P.mesh.visible=true;
  await exStartAsync();const n0=renderer.info.programs.length;out['探検']=cnt();HG.visible=!HG.visible;out['探検・格納庫反転']=cnt();
  // 探検中に格納庫を出し入れしても新しいプログラムが作られない
  for(let i=0;i<4;i++){HG.visible=!HG.visible;__SR.step(1/60);}const add=renderer.info.programs.length-n0;stopExplore();showTitle();out['タイトルに戻る']=cnt();return{out,add};});
console.log(JSON.stringify(r,null,1));
const pt=Object.entries(r.out).filter(([k])=>!k.startsWith('探検')).map(([,v])=>JSON.parse(v).PointLight),ex=Object.entries(r.out).filter(([k])=>k.startsWith('探検')).map(([,v])=>JSON.parse(v).PointLight);
const ok=new Set(pt).size===1&&new Set(ex).size===1&&r.add===0;console.log(errs[0]||(ok?'光の数は変わらない':'光の数が変わる'));await b.close();

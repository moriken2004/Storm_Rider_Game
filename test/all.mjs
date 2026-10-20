// 主な検査をまとめて流し、結果を一覧にする。node test/all.mjs [quick]
// quick: 通しプレイを訓練 1 回だけにし、時間のかかる長時間検査を省く
import {spawn} from 'child_process';import fs from 'fs';
const quick=process.argv.includes('quick');
const T=[
  ['通しプレイ（訓練）','play.mjs',['d0'],o=>/RESULT [SABC]/.test(o)],
  ['入念な検査','soak.mjs',quick?['quick']:[],o=>/見つかった問題 0 件/.test(o)],
  ['でたらめ操作','chaos.mjs',[],o=>/^=== 問題 0 件/m.test(o),true],
  ['変なプレイ','abuse.mjs',[],o=>/^問題なし/m.test(o)],
  ['建物の崩壊','wreck.mjs',[],o=>/^問題なし/m.test(o)],
  ['海面への接触（水没・水を被る・着水と離水）','water.mjs',[],o=>/^問題なし/m.test(o)&&/エラーなし/.test(o)],
  ['木の火災と爆風','fire.mjs',[],o=>/木に命中 true/.test(o)&&/"roofDead":true,"wallDead":true/.test(o)&&/"dead":true\}/.test(o)&&/やり直し後 \{"burn":0,"burnt":0,"brk":0,"dead":0\}/.test(o)&&/エラーなし/.test(o)],
  ['港の破壊（係留船・クレーン・コンテナ）','portwreck.mjs',[],o=>/✓ 船として沈む/.test(o)&&/"kind":1/.test(o)&&/やり直し後 \{"brk":0,"deb":0,"broken":0,"cargo":false,"crane":false\}/.test(o)&&/エラーなし/.test(o)],
  ['目標の印','mark.mjs',[],o=>(o.match(/おかしいもの 0/g)||[]).length===3],
  ['スマートフォン表示','mtest.mjs',[],o=>/重なり: なし/.test(o)&&!/PAGEERR/.test(o)],
  ['機銃で船・施設','strafe.mjs',[],o=>/沈没/.test(o)&&/"dead":true/.test(o)],
  ['カットの割り込み','midcut.mjs',[],o=>/"gates":3/.test(o)&&!/PAGEERR/.test(o)],
  ['武装モード','armed.mjs',[],o=>/読み込み直し後 false/.test(o)&&!/PAGEERR/.test(o)],
  ['バレルロール','roll.mjs',[],o=>/2度押し \{/.test(o)&&!/PAGEERR/.test(o)],
  ['機体の作り（浮き・面の重なり）','acheck.mjs',[],o=>(o.match(/浮き 0  重なり 0/g)||[]).length===8&&/エラーなし/.test(o)],
  ['浮いている部品','float.mjs',[],o=>{const m=o.match(/浮いている候補 (\d+)/);return m&&+m[1]<=24;}],   // 岸壁に掛けた防舷材のタイヤは壁から下がっているので候補に入る（係留船を基地から外したため 16→24）
  ['設定画面の機体プレビュー','preview.mjs',[],o=>!/✗/.test(o)&&/✓/.test(o)],
  ['画面遷移とキー操作','ui.mjs',[],o=>/問題 0 件/.test(o)],
  ['画面遷移（スマートフォン）','ui.mjs',['mobile'],o=>/問題 0 件/.test(o)],
  ['建物と船の当たり判定','hit.mjs',[],o=>(o.match(/激突/g)||[]).length>=7&&/高さ60: 通り抜けた/.test(o)],
  ['自動の画質調整','adapt.mjs',[],o=>/その後3 \{"scale":1,"tier":0/.test(o)],
];
const run=(f,a)=>new Promise(res=>{const p=spawn(process.execPath,[new URL('./'+f,import.meta.url).pathname,...a]);let o='';p.stdout.on('data',d=>o+=d);p.stderr.on('data',d=>o+=d);p.on('close',c=>res({o,c}));});
const rows=[];const t0=Date.now();
for(const[name,f,a,ok,long]of T){if(quick&&long){rows.push([name,'省略']);continue;}const s=Date.now();const r=await run(f,a);const pass=r.c===0&&ok(r.o);rows.push([name,pass?'合格':'不合格',((Date.now()-s)/1000).toFixed(0)+'s']);
  console.log((pass?'✓ ':'✗ ')+name+'  '+((Date.now()-s)/1000).toFixed(0)+'s');if(!pass){const fn=new URL('./out/fail_'+f.replace('.mjs','')+'.txt',import.meta.url).pathname;fs.writeFileSync(fn,r.o);console.log(r.o.split('\n').slice(-12).join('\n')+'\n（全文 '+fn+'）');}}
console.log('\n'+rows.map(r=>r.join('  ')).join('\n')+'\n合計 '+((Date.now()-t0)/60000).toFixed(1)+' 分');
process.exit(rows.some(r=>r[1]==='不合格')?1:0);

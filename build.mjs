// src/ を 1 枚の index.html にまとめる
import fs from 'node:fs';import {execFileSync} from 'node:child_process';
// まず注釈の点検：行内の // 注釈にコードが飲み込まれていたら止める（右の主脚が消えた不具合の再発防止）
try{execFileSync(process.execPath,[new URL('./lintcomments.mjs',import.meta.url).pathname,...['core.js','world.js','audio.js','game.js','explore.js','sea.js','barnacle.js'].map(f=>new URL('./src/'+f,import.meta.url).pathname)],{stdio:'inherit'});}catch(e){console.error('組み立てを中止しました（注釈にコードが飲み込まれています）');process.exit(1);}
const d=new URL('./src/',import.meta.url);
const r=f=>fs.readFileSync(new URL(f,d),'utf8');
const js=['core.js','world.js','audio.js','game.js','explore.js','sea.js','barnacle.js'].map(r).join('\n');
// 文法の点検：かっこの数違いなどがあると、全体が読み込めず起動しなくなる（気付きにくい）ので組み立てを止める
{const tmp=new URL('./.buildcheck.js',import.meta.url);fs.writeFileSync(tmp,js);try{execFileSync(process.execPath,['--check',tmp.pathname],{stdio:'pipe'});}catch(e){console.error(String(e.stderr||e).split('\n').slice(0,6).join('\n'));console.error('組み立てを中止しました（文法の誤り）');fs.unlinkSync(tmp);process.exit(1);}fs.unlinkSync(tmp);}
const html=r('head.html')+
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n<script>\n'+js+'\n</script>\n</body>\n</html>\n';
// アーティファクト用（公開時に骨組みが付くので doctype/head/body を外す）。版の確認は io 版だけ（アーティファクトには付けない）
const art=html.replace(/<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport"[^\n]*\n/,"").replace("</head>\n<body>\n","").replace("</body>\n</html>\n","");
fs.writeFileSync(new URL("./artifact.html",import.meta.url),art);
// io 版：開いたときに version.json をキャッシュを使わずに読み、版が違えば版番号付きのアドレスで最新を読み直す（1 回だけ）。ページ自体もキャッシュしない指定
const ver=(await import('node:crypto')).createHash('sha1').update(html).digest('hex').slice(0,10);
const guard='<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">\n<meta http-equiv="Pragma" content="no-cache">\n<meta http-equiv="Expires" content="0">\n'+
  '<script>(function(){var V="'+ver+'";if(!/^https?:$/.test(location.protocol))return;fetch("version.json?t="+Date.now(),{cache:"no-store"}).then(function(r){return r.ok?r.json():null}).then(function(j){if(!j||j.v===V)return;var u=new URL(location.href);if(u.searchParams.get("v")===j.v)return;u.searchParams.set("v",j.v);location.replace(u.href);}).catch(function(){});})();</script>\n';
const html2=html.replace(/(<meta name="viewport"[^\n]*\n)/,'$1'+guard);
fs.writeFileSync(new URL('./index.html',import.meta.url),html2);
fs.writeFileSync(new URL('./version.json',import.meta.url),JSON.stringify({v:ver})+'\n');
console.log('index.html',(html.length/1024).toFixed(0)+'KB');

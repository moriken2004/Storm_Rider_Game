// src/ を 1 枚の index.html にまとめる
import fs from 'node:fs';
const d=new URL('./src/',import.meta.url);
const r=f=>fs.readFileSync(new URL(f,d),'utf8');
const js=['core.js','world.js','audio.js','game.js','explore.js'].map(r).join('\n');
const html=r('head.html')+
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n<script>\n'+js+'\n</script>\n</body>\n</html>\n';
fs.writeFileSync(new URL('./index.html',import.meta.url),html);
// アーティファクト用（公開時に骨組みが付くので doctype/head/body を外す）
const art=html.replace(/<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport"[^\n]*\n/,"").replace("</head>\n<body>\n","").replace("</body>\n</html>\n","");
fs.writeFileSync(new URL("./artifact.html",import.meta.url),art);
console.log('index.html',(html.length/1024).toFixed(0)+'KB');

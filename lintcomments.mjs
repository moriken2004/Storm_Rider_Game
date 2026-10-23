// 行内の // 注釈に、実行されるはずのコードが飲み込まれていないかを調べる（2026-10 の右主脚の消失はこれが原因）。
// 文字列・テンプレート文字列（GLSL を含む）・/* */ の中の // は対象外。注釈の中に「名前(…);」「const/let/var …=」「for(」「if(」などの文があれば問題として出す。
import fs from 'fs';
const files=process.argv.slice(2);let bad=0;
const CODE=[/[A-Za-z_$][\w$]*(?:\.[\w$]+)*\s*\([^\n]*\)\s*;/, /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=/, /\bfor\s*\(\s*(?:const|let|var)\b/, /\bif\s*\([^)]*\)\s*[{\w]/, /\breturn\s+[\w$(]/, /[A-Za-z_$][\w$]*\s*=\s*[^=][^\n]*;/, /[\u3000-\u30ff\u4e00-\u9fff\uff00-\uffef][A-Za-z_$][\w$]*(?:\.[\w$]+)+\s*\(/];
for(const f of files){const src=fs.readFileSync(f,'utf8');let st='code',q='',depth=0,line=1,i=0;const tpl=[];
  while(i<src.length){const c=src[i],n=src[i+1];
    if(c==='\n'){line++;if(st==='str'){/* 文字列は改行で終わる（壊れた文字列は無視） */st='code';}i++;continue;}
    if(st==='code'){
      if(c==='/'&&n==='/'){let j=src.indexOf('\n',i);if(j<0)j=src.length;const cm=src.slice(i+2,j);if(CODE.some(re=>re.test(cm))){bad++;console.log(`${f}:${line}: 注釈の中にコードがあります → ${cm.trim().slice(0,140)}`);}i=j;continue;}
      if(c==='/'&&n==='*'){const j=src.indexOf('*/',i+2);const seg=src.slice(i,j<0?src.length:j+2);line+=(seg.match(/\n/g)||[]).length;i=j<0?src.length:j+2;continue;}
      if(c==='"'||c==="'"){st='str';q=c;i++;continue;}
      if(c==='`'){st='tpl';tpl.push(0);i++;continue;}
      if(c==='}'&&tpl.length&&tpl[tpl.length-1]>0){tpl[tpl.length-1]--;if(tpl[tpl.length-1]===0){st='tpl';}i++;continue;}
      if(c==='{'&&tpl.length&&tpl[tpl.length-1]>0){tpl[tpl.length-1]++;i++;continue;}
      // 正規表現の文字列：直前が演算子・括弧・カンマなら / から次の / まで飛ばす
      if(c==='/'){let k=i-1;while(k>=0&&/\s/.test(src[k]))k--;if(k<0||/[=(,:;!&|?{}\[+\-*%<>~^]/.test(src[k])){let j=i+1,cls=false;while(j<src.length&&src[j]!=='\n'){if(src[j]==='\\'){j+=2;continue;}if(src[j]==='[')cls=true;else if(src[j]===']')cls=false;else if(src[j]==='/'&&!cls)break;j++;}if(src[j]==='/'){i=j+1;continue;}}}
      i++;continue;}
    if(st==='str'){if(c==='\\'){i+=2;continue;}if(c===q)st='code';i++;continue;}
    if(st==='tpl'){if(c==='\\'){i+=2;continue;}if(c==='`'){tpl.pop();st='code';i++;continue;}if(c==='$'&&n==='{'){tpl[tpl.length-1]=1;st='code';i+=2;continue;}i++;continue;}}}
if(bad){console.log(`注釈に飲み込まれたコードの疑い ${bad} 件`);process.exit(1);}else console.log('注釈の点検：問題なし');

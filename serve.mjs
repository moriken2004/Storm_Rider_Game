// 開発用の簡易サーバー：node serve.mjs → http://127.0.0.1:8795/
import http from 'http';import fs from 'fs';import path from 'path';import {fileURLToPath} from 'url';
const root=path.dirname(fileURLToPath(import.meta.url)),port=+(process.env.PORT||8795);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.wav':'audio/wav','.css':'text/css'};
http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(root,path.normalize(p));
  if(!f.startsWith(root)){r.writeHead(403);r.end();return;}
  fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end('not found');return;}r.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});r.end(d);});
}).listen(port,'127.0.0.1',()=>console.log('STORM RIDER → http://127.0.0.1:'+port+'/'));

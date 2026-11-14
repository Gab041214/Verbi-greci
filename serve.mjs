/* Server statico minimale per sviluppo: node serve.mjs [cartella] [porta] */
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {join,extname,normalize} from 'node:path';
const root=process.argv[2]||'src',port=+(process.argv[3]||process.env.PORT||8080);
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
createServer(async(req,res)=>{
  let p=normalize(decodeURIComponent(new URL(req.url,'http://x').pathname)).replace(/^(\.\.[\/\\])+/,'');
  if(p.endsWith('/'))p+='index.html';
  try{const f=join(root,p);if((await stat(f)).isDirectory())throw 0;res.writeHead(200,{'Content-Type':T[extname(f)]||'application/octet-stream'});res.end(await readFile(f));}
  catch{res.writeHead(404);res.end('not found');}
}).listen(port,()=>console.log(`http://localhost:${port}  (${root})`));

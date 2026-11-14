/* Build senza dipendenze: copia src/ in dist/ e genera l'elenco dei file per il service worker. */
import {cpSync,rmSync,mkdirSync,readdirSync,statSync,readFileSync,writeFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
const SRC='src',OUT='dist';
rmSync(OUT,{recursive:true,force:true});mkdirSync(OUT,{recursive:true});
cpSync(SRC,OUT,{recursive:true});
const files=[];
(function walk(d){for(const f of readdirSync(d)){const p=join(d,f);statSync(p).isDirectory()?walk(p):files.push(relative(OUT,p).replaceAll('\\','/'));}})(OUT);
const skip=new Set(['sw.js','_headers']);
const list=['./',...files.filter(f=>!skip.has(f))];
const hash=createHash('sha1');for(const f of list.slice(1))hash.update(f).update(readFileSync(join(OUT,f)));
const build=hash.digest('hex').slice(0,10);
let sw=readFileSync(join(OUT,'sw.js'),'utf8').replaceAll('__BUILD__',build).replaceAll('__FILES__',JSON.stringify(list));
writeFileSync(join(OUT,'sw.js'),sw);
console.log(`dist/ pronto: ${list.length} file, build ${build}`);

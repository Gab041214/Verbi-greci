/* Correggi forme: dalla nuova prima persona singolare ricalcola le altre cinque persone dello stesso tempo.
   Le desinenze restano quelle delle forme attuali, cambia solo la radice; l'accento resta alla stessa
   sillaba contata dalla fine (spostata se l'utente ha cambiato la posizione dell'accento nella 1ª persona). */
import {nuclei,stressEnd,strip} from './engine.js';
const PAREN=/\([α-ω]\)$/;
const split=f=>{
  const parts=String(f).split(' / '),first=parts[0].trim(),m=first.match(PAREN);
  return {w:m?first.slice(0,-m[0].length):first,suf:m?m[0]:'',rest:parts.slice(1)};
};
/* posizione dell'accento contata dalla fine (1 = ultima sillaba), 0 = nessun accento */
const jEnd=w=>{
  const m=w.search(/[άέήίόύώΐΰ]/);if(m<0)return 0;
  const ns=nuclei(strip(w));
  for(let k=0;k<ns.length;k++)if(m>=ns[k][0]&&m<ns[k][1])return ns.length-k;
  return 0;
};
export function cascadeForms(old,new0){
  if(!Array.isArray(old)||old.length<6||!new0||!new0.trim())return null;
  const o=old.map(split),n=split(new0.trim());
  const ob=o.map(x=>strip(x.w));
  let L=0;
  while(ob.every(x=>x.length>L&&x[L]===ob[0][L]))L++;
  const end0=ob[0].slice(L),nb=strip(n.w);
  if(!nb.endsWith(end0)||nb.length<=end0.length)return null;
  const stem=nb.slice(0,nb.length-end0.length);
  const j0o=jEnd(o[0].w);let j0n=jEnd(n.w);if(!j0n)j0n=j0o;
  const out=[new0.trim()];
  for(let i=1;i<6;i++){
    const w=stem+ob[i].slice(L),jo=jEnd(o[i].w);
    let f=w;
    if(jo&&nuclei(w).length>1){
      const j=Math.max(1,Math.min(3,jo+(j0n-j0o)));
      f=stressEnd(w,j);
    }
    out.push(f+o[i].suf+(o[i].rest.length?' / '+o[i].rest.join(' / '):''));
  }
  return out;
}

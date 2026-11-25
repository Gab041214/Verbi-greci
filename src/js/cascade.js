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
/* aumento nelle forme singolari (έπλεξα / πλέξαμε, υπέβαλα / υποβάλαμε): trovo la posizione q dell'ε;
   «ins» = l'ε è inserito, «rep» = prende il posto della vocale finale del prefisso */
function augInfo(ob){
  const a=ob[0],b=ob[3];let q=0;
  while(q<a.length&&q<b.length&&a[q]===b[q])q++;
  if(a[q]!=='ε')return null;
  const s=a.slice(q+1),ins=b.slice(q),rep=b.slice(q+1);
  let kind=null;
  if(ins.length>=3&&s.startsWith(ins.slice(0,3)))kind='ins';
  else if(rep.length>=3&&s.startsWith(rep.slice(0,3)))kind='rep';
  if(!kind)return null;
  for(const i of [1,2,5])if(ob[i][q]!=='ε')return null;
  return {q,kind,v:kind==='rep'?b[q]:''};
}
const SING=[0,1,2,5];
function cascade1(old,new0){
  if(!Array.isArray(old)||old.length<6||!new0||!new0.trim())return null;
  const o=old.map(split),n=split(new0.trim());
  let ob=o.map(x=>strip(x.w));
  let nb=strip(n.w);
  const au=augInfo(ob);
  let newAug=false;
  if(au){
    ob=ob.map((x,i)=>SING.includes(i)?x.slice(0,au.q)+au.v+x.slice(au.q+1):x);
    if(nb[au.q]==='ε'&&nb.slice(0,au.q)===ob[0].slice(0,au.q)){newAug=true;nb=nb.slice(0,au.q)+au.v+nb.slice(au.q+1);}
  }
  let L=0;
  while(ob.every(x=>x.length>L&&x[L]===ob[0][L]))L++;
  const end0=ob[0].slice(L);
  if(!nb.endsWith(end0)||nb.length<=end0.length)return null;
  const stem=nb.slice(0,nb.length-end0.length);
  const j0o=jEnd(o[0].w);let j0n=jEnd(n.w);if(!j0n)j0n=j0o;
  const out=[new0.trim()];
  for(let i=1;i<6;i++){
    let w=stem+ob[i].slice(L);
    if(au&&newAug&&SING.includes(i))w=w.slice(0,au.q)+'ε'+w.slice(au.q+(au.kind==='rep'?1:0));
    const jo=jEnd(o[i].w);
    let f=w;
    if(jo&&nuclei(w).length>1){
      const j=Math.max(1,Math.min(3,jo+(j0n-j0o)));
      f=stressEnd(w,j);
    }
    out.push(f+o[i].suf+(o[i].rest.length?' / '+o[i].rest.join(' / '):''));
  }
  return out;
}

/* se nella 1ª persona ci sono più varianti («ζούλησα / ζούληξα») ricalcolo le altre persone per ciascuna e le unisco */
export function cascadeForms(old,new0){
  const vs=String(new0||'').split(' / ').map(x=>x.trim()).filter(Boolean);
  if(vs.length<2)return cascade1(old,new0);
  const rs=vs.map(v=>cascade1(old,v));
  if(rs.some(r=>!r))return null;
  const out=[vs.join(' / ')];
  for(let i=1;i<6;i++)out.push([...new Set(rs.flatMap(r=>r[i].split(' / ')))].join(' / '));
  return out;
}

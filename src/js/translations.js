/* Traduzioni da rivedere: esportazione in CSV/TSV dei verbi con la traduzione solo inglese
   e importazione delle traduzioni italiane corrette. Solo logica, senza interfaccia. */
export const HEAD=['verbo','inglese','italiano','voce passiva','italiano passivo'];

/* verbi dell'utente la cui traduzione è ancora quella inglese di Wiktionary */
export const needsReview=e=>!!e&&e._origin==='user'&&((!!e.gloss_en&&e.gloss===e.gloss_en)||!String(e.gloss||'').trim());

/* una riga per verbo; passLemma(e) dà la forma passiva (o '') */
export function buildRows(list,passLemma){
  return list.filter(needsReview)
    .sort((a,b)=>String(a.lemma).localeCompare(String(b.lemma),'el'))
    .map(e=>[e.lemma,e.gloss_en||'','',(passLemma&&passLemma(e))||'','']);
}

const csvCell=s=>{s=String(s??'');return /[;"\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
export const toCsv=rows=>[HEAD,...rows].map(r=>r.map(csvCell).join(';')).join('\r\n')+'\r\n';
/* per incollare in un foglio di calcolo: celle separate da tabulazioni */
export const toTsv=rows=>[HEAD,...rows].map(r=>r.map(c=>String(c??'').replace(/[\t\r\n]+/g,' ')).join('\t')).join('\n');

/* legge CSV/TSV: riconosce da solo il separatore (tab, ; o ,) e le virgolette */
export function parseTable(text){
  text=String(text||'').replace(/^﻿/,'');
  const first=text.split(/\r?\n/).find(l=>l.trim())||'';
  let d=';',best=0;
  for(const c of ['\t',';',',']){
    let n=0,q=false;
    for(const ch of first){if(ch==='"')q=!q;else if(ch===c&&!q)n++;}
    if(n>best){best=n;d=c;}
  }
  const rows=[];let row=[],cur='',q=false;
  const endRow=()=>{row.push(cur);cur='';if(row.some(x=>x.trim()!==''))rows.push(row);row=[];};
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(q){
      if(ch==='"'){if(text[i+1]==='"'){cur+='"';i++;}else q=false;}
      else cur+=ch;
    }else if(ch==='"'&&cur==='')q=true;
    else if(ch===d){row.push(cur);cur='';}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;endRow();}
    else cur+=ch;
  }
  if(cur!==''||row.length)endRow();
  return rows;
}

/* riepilogo di ciò che l'importazione cambierebbe; find(lemma) trova il verbo, hasPass(e) dice se ha la voce passiva */
export function planImport(rows,find,hasPass){
  const out={changes:[],nIt:0,nPass:0,empty:0,unchanged:0,passIgnored:0,missing:[],badFormat:false};
  let i=0;
  if(rows.length&&/^verbo$/i.test(String(rows[0][0]||'').trim()))i=1;
  const body=rows.slice(i);
  if(body.length&&body.every(r=>r.length<3)){out.badFormat=true;return out;}
  for(const r of body){
    const lemma=String(r[0]||'').trim();if(!lemma)continue;
    const it=String(r[2]||'').trim(),ip=String(r[4]||'').trim();
    if(!it&&!ip){out.empty++;continue;}
    const e=find(lemma);
    if(!e){out.missing.push(lemma);continue;}
    const ch={e,gloss:null,gloss_p:null};
    if(it&&it!==e.gloss){ch.gloss=it;out.nIt++;}
    if(ip){
      if(hasPass&&!hasPass(e))out.passIgnored++;
      else if(ip!==(e.gloss_p||'')){ch.gloss_p=ip;out.nPass++;}
    }
    if(ch.gloss===null&&ch.gloss_p===null){out.unchanged++;continue;}
    out.changes.push(ch);
  }
  return out;
}

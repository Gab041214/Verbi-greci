/* Tabella di coniugazione della Wiktionary greca (el.wiktionary.org), usata quando en.wiktionary non ha la tabella.
   Le colonne non sono fisse (la prima riga di ogni gruppo ha una cella in più): le forme si riconoscono dal prefisso
   «θα» (futuro) che le separa, contando le celle a ritroso. */
import {htmlToRows,cleanCell,inferClass,fetchVerb} from './wiktionary.js';

const EL_API='https://el.wiktionary.org/w/api.php';
const PERSON=/^([αβγ])['’ʹ]\s*(ενικ|πληθ)/i;
const P6=['α ενικ','β ενικ','γ ενικ','α πληθ','β πληθ','γ πληθ'];
const persIdx=c=>{const m=String(c||'').trim().match(PERSON);return m?P6.indexOf(m[1].toLowerCase()+' '+m[2].toLowerCase().slice(0,4)):-1;};
const bare=s=>String(s||'').replace(/^\s*(θα|να)\s+/i,'');
const isFut=s=>/^\s*θα\s/i.test(s||'');

/* righe (celle di testo) -> {entry,report} oppure null se non c'è una tabella riconoscibile */
export function rowsToEntryEl(rows,title){
  const passTitle=/(ομαι|άμαι|ιέμαι|ούμαι)$/.test(title);
  let voice=passTitle?'pass':'act',sec='';
  const A={},P={};   // forme per voce: A = attiva, P = passiva
  const set=(v,k,i,val)=>{const o=v==='pass'?P:A;(o[k]=o[k]||[])[i]=val;};
  for(const r of rows){
    const head=r.join(' ');
    if(/Παθητική\s+φωνή/i.test(head))voice='pass';
    else if(/Ενεργητική\s+φωνή/i.test(head))voice='act';
    if(/Εξακολουθητικοί\s+χρόνοι/i.test(head))sec='imp';
    else if(/Συνοπτικοί\s+χρόνοι/i.test(head))sec='perf';
    else if(/Συντελεσμένοι\s+χρόνοι/i.test(head))sec='comp';
    const li=r.findIndex(c=>persIdx(c)>=0);
    if(li<0||!sec||sec==='comp')continue;
    const i=persIdx(r[li]),cells=r.slice(li+1);
    const f=cells.findIndex(isFut);
    if(f<2&&sec==='imp'||f<1)continue;
    if(sec==='imp'){
      set(voice,'pres',i,cleanCell(cells[f-2]));set(voice,'impf',i,cleanCell(cells[f-1]));
      if(i===1||i===4)set(voice,'ipres',i===1?0:1,cleanCell(cells[f+2]));
      if(i===0){const p=cleanCell(cells[f+3]);if(p)A.ptc=[p.split(' / ')[0]];}
    }else{
      set(voice,'aor',i,cleanCell(cells[f-1]));set(voice,'subj',i,cleanCell(bare(cells[f+1])));
      if(i===1||i===4)set(voice,'iaor',i===1?0:1,cleanCell(cells[f+2]));
    }
  }
  const O={},report={found:[],missing:[],el:true};
  const six=a=>a&&a.length>=6&&a.slice(0,6).every(Boolean);
  const two=a=>a&&a.length>=2&&a[0]&&a[1];
  const take=(src,pfx)=>{
    for(const k of ['pres','impf','aor','subj']){
      const key=pfx?{pres:'ppres',impf:'pimpf',aor:'paor',subj:'psubj'}[k]:k;
      if(six(src[k]))O[key]=src[k].slice(0,6);
      else if(src[k]&&src[k].some(Boolean))report.missing.push(key+' (incompleto)');
    }
    for(const k of ['ipres','iaor']){
      const key=pfx?{ipres:'pipres',iaor:'piaor'}[k]:k;
      if(two(src[k]))O[key]=src[k].slice(0,2);
    }
  };
  take(A,false);take(P,true);
  if(!O.pres&&!O.ppres)return null;
  if(passTitle){   // verbo deponente: la tabella è tutta passiva
    for(const [from,to] of [['pres','ppres'],['impf','pimpf'],['aor','paor'],['subj','psubj'],['iaor','piaor']])if(O[from]&&!O[to]){O[to]=O[from];}
    for(const k of ['pres','impf','aor','subj','iaor','ipres'])delete O[k];
  }
  delete O.pipres;
  if(A.ptc)O.ptc=A.ptc;
  const cls=inferClass(title,O);
  const entry={forms:[title],cls,gloss:'',O,source:'wiktionary',updated:new Date().toISOString().slice(0,10)};
  const want=cls.startsWith('D')?['ppres','pimpf','paor','psubj']:['pres','impf','aor','subj'];
  want.forEach(k=>{if(O[k])report.found.push(k);else if(!report.missing.some(m=>m.startsWith(k)))report.missing.push(k);});
  if(!cls.startsWith('D')&&(O.ppres||O.paor))report.found.push('passivo');
  ['ipres','iaor','ptc'].forEach(k=>{if(O[k])report.found.push(k);});
  return {entry,report};
}

/* scarica la pagina dalla Wiktionary greca: {entry,report} oppure null */
export async function fetchElEntry(title,f=fetch){
  try{
    const u=EL_API+'?'+new URLSearchParams({format:'json',formatversion:'2',origin:'*',action:'parse',page:title,prop:'text',redirects:'1'});
    const r=await f(u);if(!r.ok)return null;
    const j=await r.json();if(j.error||!j.parse)return null;
    return rowsToEntryEl(htmlToRows(j.parse.text),title);
  }catch(_){return null;}
}

/* come fetchVerb, ma se en.wiktionary non ha la tabella prova quella greca; la traduzione resta quella inglese */
export async function fetchVerbFull(title,f=fetch){
  let en=null,err=null;
  try{en=await fetchVerb(title,f);}catch(e){err=e;}
  if(en&&!en.entry.fromHeadword&&!en.report.redirect)return en;
  if(en&&en.report.redirect)return en;
  const el=await fetchElEntry(title,f);
  if(!el){if(err)throw err;return en;}
  if(en&&en.entry){const g=en.entry.gloss_en||en.entry.gloss;if(g){el.entry.gloss=g;el.entry.gloss_en=g;}}
  return el;
}

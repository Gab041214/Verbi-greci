/* Verbi con prefisso avverbiale (ξανα- = «di nuovo»): senza tabella su Wiktionary,
   si ottengono scrivendo il prefisso davanti a ciascuna forma del verbo base già conosciuto.
   Con ξανα- l'aumento resta dentro la parola base (ξανα+έβλεπα = ξαναέβλεπα). */
import {conjugate,finalizeEntry,nuclei,stressEnd,strip,overrideKey} from './engine.js';
const isVow=c=>/[αεηιουωάέήίόύώϊϋΐΰ]/i.test(c||'');

export const PREFIXES=['ξανα'];

export function splitPrefix(lemma){
  const l=String(lemma||'').trim().toLowerCase();
  for(const p of PREFIXES)if(l.startsWith(p)&&l.length>p.length+2)return {prefix:p,rest:l.slice(p.length)};
  return null;
}

/* ανα-, κατα-, παρα-, μετα-, επι-, υπο-, απο-, αντι-: il prefisso perde la vocale finale davanti all'aumento (ανα+έπλεξα = ανέπλεξα) e davanti alla vocale iniziale del verbo (ανα+αρπάζω = αναρπάζω).
   Si provano due letture: ανα+verbo che inizia per consonante, oppure αν+verbo che inizia per vocale. */
export const AUG_PREFIXES=['ανα','κατα','παρα','μετα','επι','υπο','απο','αντι'];
export function splitAna(lemma){
  const l=String(lemma||'').trim().toLowerCase();
  const out=[];
  for(const p of AUG_PREFIXES){
    if(!l.startsWith(p)||l.length<=p.length+3)continue;
    const r=l.slice(p.length);
    if(!isVow(r[0])&&r[0]!=='ρ')out.push({prefix:p,rest:r,kind:'ana'});
  }
  if(/^ανα/.test(l)&&l.length>6){const r2=l.slice(2);if(isVow(r2[0])&&r2.length>3)out.push({prefix:'αν',rest:r2,kind:'ana'});}
  else if(/^ανε/.test(l)&&l.length>6)out.push({prefix:'αν',rest:l.slice(2),kind:'ana'});
  return out;
}
/* forma con prefisso ανα-/αν-: il resto della forma resta com'è (l'accento non si sposta);
   solo l'imperativo singolare ritira l'accento alla terzultima (πλέξε → ανάπλεξε) */
export function anaForm(prefix,form,sgImp){
  if(form==null)return form;
  return String(form).split(' / ').map(part=>{
    let eps='';
    if(part.endsWith('(ε)')){eps='(ε)';part=part.slice(0,-3);}
    let w;
    if(AUG_PREFIXES.includes(prefix)&&part.startsWith('έ'))w=prefix.slice(0,-1)+part;      // aumento: ανα+έπλεξα, κατα+έβαλα, υπο+έβαλα
    else w=prefix+part;
    if(sgImp&&nuclei(strip(part)).length>1)w=stressEnd(strip(w),3);
    else if(sgImp&&part===strip(part))w=stressEnd(w,1);
    return w+eps;
  }).join(' / ');
}

/* una forma (o più varianti « / ») con il prefisso; se la forma base ha una sola sillaba e nessun accento
   (δες, δω, δουν(ε)) l'accento va scritto: ξαναδές, ξαναδώ, ξαναδούν(ε) */
export function prefixForm(prefix,form){
  if(!prefix||form==null)return form;
  return String(form).split(' / ').map(part=>{
    let eps='';
    if(part.endsWith('(ε)')){eps='(ε)';part=part.slice(0,-3);}
    let w=part;
    if(w===strip(w)&&nuclei(w).length===1)w=stressEnd(prefix+w,1);
    else w=prefix+w;
    return w+eps;
  }).join(' / ');
}

/* entry derivato dal verbo base: tutte le forme come sostituzioni (O.*) */
export function deriveEntry(base,prefix,kind){
  const voices=conjugate(base);
  const act=voices.find(v=>v.id==='act'),pass=voices.find(v=>v.id==='pass');
  const dep=base.cls.startsWith('D');
  const e={forms:base.forms.map(f=>prefix+f.replace(/\./g,'')),cls:base.cls,gloss:'',O:{},source:'derived',updated:new Date().toISOString().slice(0,10)};
  if(base.no)e.no=base.no;
  const pf=(x,k)=>Array.isArray(x)?x.map((y,i)=>kind==='ana'?anaForm(prefix,y,/^i(pres|aor)$/.test(k||'')&&i===0):prefixForm(prefix,y)):[kind==='ana'?anaForm(prefix,x):prefixForm(prefix,x)];
  const put=(k,v)=>{if(v&&(!Array.isArray(v)||v.length))e.O[k]=pf(v,k);};
  if(act){
    ['pres','impf','aor','subj','ipres','iaor'].forEach(k=>put(k,act.raw[k]));
    put('ptc',act.raw.ptc);
  }
  if(pass){
    if(dep){
      ['pres','impf','aor','subj','iaor'].forEach(k=>put(overrideKey(base,'pass',k),pass.raw[k]));
      put('ptc',pass.raw.ptc);
    }else{
      put('ppres',pass.raw.pres);put('pimpf',pass.raw.impf);put('paor',pass.raw.aor);
      put('psubj',pass.raw.subj);put('piaor',pass.raw.iaor);
      if(pass.raw.inf)put('pinf',pass.raw.inf);
    }
    if(pass.raw.m)e.m=kind==='ana'?anaForm(prefix,pass.raw.m):prefixForm(prefix,pass.raw.m);
  }
  if(!act&&!pass)return null;
  return finalizeEntry(e);
}

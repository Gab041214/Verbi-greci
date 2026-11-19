/* Verbi con prefisso avverbiale (ξανα- = «di nuovo»): senza tabella su Wiktionary,
   si ottengono scrivendo il prefisso davanti a ciascuna forma del verbo base già conosciuto.
   Con ξανα- l'aumento resta dentro la parola base (ξανα+έβλεπα = ξαναέβλεπα). */
import {conjugate,finalizeEntry,nuclei,stressEnd,strip,overrideKey} from './engine.js';

export const PREFIXES=['ξανα'];

export function splitPrefix(lemma){
  const l=String(lemma||'').trim().toLowerCase();
  for(const p of PREFIXES)if(l.startsWith(p)&&l.length>p.length+2)return {prefix:p,rest:l.slice(p.length)};
  return null;
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
export function deriveEntry(base,prefix){
  const voices=conjugate(base);
  const act=voices.find(v=>v.id==='act'),pass=voices.find(v=>v.id==='pass');
  const dep=base.cls.startsWith('D');
  const e={forms:base.forms.map(f=>prefix+f.replace(/\./g,'')),cls:base.cls,gloss:'',O:{},source:'derived',updated:new Date().toISOString().slice(0,10)};
  if(base.no)e.no=base.no;
  const pf=x=>Array.isArray(x)?x.map(y=>prefixForm(prefix,y)):[prefixForm(prefix,x)];
  const put=(k,v)=>{if(v&&(!Array.isArray(v)||v.length))e.O[k]=pf(v);};
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
    if(pass.raw.m)e.m=prefixForm(prefix,pass.raw.m);
  }
  if(!act&&!pass)return null;
  return finalizeEntry(e);
}

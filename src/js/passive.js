/* Voce passiva ricavata dal verbo attivo: forma passiva attesa, voce calcolata con le regole */
import {guessEntry,conjugate,finalizeEntry} from './engine.js';

export const PASS_END=/(ομαι|άμαι|ιέμαι|ούμαι)$/;
export const isPassTitle=t=>PASS_END.test(String(t||'').trim());

/* verbo attivo da cui può derivare una forma passiva (χορεύομαι → χορεύω) */
export function activeCandidates(p){
  p=String(p||'').trim();
  if(/ούμαι$/.test(p))return [p.replace(/ούμαι$/,'ώ'),p.replace(/ούμαι$/,'ω')];
  if(/ιέμαι$/.test(p))return [p.replace(/ιέμαι$/,'ώ'),p.replace(/ιέμαι$/,'άω')];
  if(/άμαι$/.test(p))return [p.replace(/άμαι$/,'ώ'),p.replace(/άμαι$/,'άω')];
  if(/ομαι$/.test(p))return [p.replace(/ομαι$/,'ω')];
  return [];
}
/* forme passive da cercare per un verbo attivo (χορεύω → χορεύομαι) */
export function passiveCandidates(a,cls){
  a=String(a||'').trim();
  if(/άω$/.test(a)){const s=a.replace(/άω$/,'');return [s+'ιέμαι',s+'άμαι'];}
  if(/ώ$/.test(a)){
    const s=a.replace(/ώ$/,''),L=[s+'ούμαι',s+'ιέμαι',s+'άμαι'];
    return cls==='B1'?[L[1],L[2],L[0]]:L;
  }
  if(/ω$/.test(a))return [a.replace(/ω$/,'ομαι')];
  return [];
}
/* il verbo può avere una voce passiva da aggiungere? (non deponente, non irregolare, non ancora presente) */
export function lacksPassive(e){
  if(!e||String(e.cls||'').startsWith('D')||e.cls==='X')return false;
  try{return !conjugate(e).some(v=>v.id==='pass');}catch(_){return false;}
}
/* copia del verbo con la voce passiva calcolata a partire dalla forma `pform`;
   `src` (facoltativo) è una voce già letta, per esempio da una tabella di Wiktionary */
export function withPassive(e,pform,src){
  let pv=null;
  try{const g=src||guessEntry(pform);pv=g&&conjugate(g).find(v=>v.id==='pass');}catch(_){pv=null;}
  if(!pv)return null;
  const r=pv.raw,ne=finalizeEntry({...e,O:JSON.parse(JSON.stringify(e.O||{}))});
  ne.O.ppres=r.pres;ne.O.pimpf=r.impf;
  if(r.aor)ne.O.paor=r.aor;
  if(r.subj)ne.O.psubj=r.subj;
  if(r.iaor)ne.O.piaor=r.iaor;
  if(!ne.source||ne.source==='base'||ne.source==='extra')ne.source=e.source||'manual';
  return ne;
}
/* copia del verbo senza voce passiva (per verbi intransitivi ricavati con le regole) */
export function withoutPassive(e){
  const ne=finalizeEntry({...e,O:JSON.parse(JSON.stringify(e.O||{}))});
  delete ne.p;
  for(const k of ['ppres','pimpf','paor','psubj','piaor','pipres'])delete ne.O[k];
  return ne;
}
/* il verbo ha la voce passiva (non deponente) */
export function hasPassive(e){
  if(!e||String(e.cls||'').startsWith('D')||e.cls==='X')return false;
  try{return conjugate(e).some(v=>v.id==='pass');}catch(_){return false;}
}

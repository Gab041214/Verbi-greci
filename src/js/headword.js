/* Verbo senza tabella su Wiktionary: forme calcolate con le regole, correggendo aoristo e participio
   con quanto scritto nella riga del lemma (past / ppp). */
import {guessEntry,conjugate,strip,finalizeEntry} from './engine.js';
export function fromHeadword(entry,cls){
  const h=entry.fromHeadword||{};
  const g=guessEntry(entry.forms[0],cls);
  if(!g)throw new Error('Non riconosco la desinenza del verbo');
  const e={...g,gloss:entry.gloss||'',gloss_en:entry.gloss_en,source:'wiktionary',updated:entry.updated,O:{}};
  delete e.guessed;
  const notes=[];
  if(h.past&&!e.cls.startsWith('D')){
    const aor0=t=>{try{const v=conjugate(t).find(x=>x.id==='act');return v&&v.raw.aor&&v.raw.aor[0].split(' / ')[0];}catch(_){return null;}};
    if(aor0(e)===h.past)notes.push('aoristo confermato dalla riga del lemma');
    else{
      const b=strip(h.past).replace(/α$/,'');
      const ok=[b,b.slice(1),b.replace(/^ε/,'')].find(a=>a&&aor0(finalizeEntry({...e,a,O:{}}))===h.past);
      if(ok){e.a=ok;notes.push('aoristo corretto con la riga del lemma');}
      else notes.push('aoristo '+h.past+' non riproducibile con le regole: correggilo a mano');
    }
  }
  if(h.ppp)e.m=h.ppp;
  return {entry:finalizeEntry(e),notes};
}

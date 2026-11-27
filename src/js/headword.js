/* Verbo senza tabella su Wiktionary: forme calcolate con le regole, correggendo aoristo e participio
   con quanto scritto nella riga del lemma (past / ppp). */
import {guessEntry,conjugate,strip,finalizeEntry} from './engine.js';
export function fromHeadword(entry,cls){
  const h=entry.fromHeadword||{};
  const g=guessEntry(entry.forms[0],cls);
  if(!g)throw new Error('Non riconosco la desinenza del verbo');
  const e={...g,gloss:entry.gloss||'',gloss_en:entry.gloss_en,source:'wiktionary',updated:entry.updated,O:{...(g.O||{})}};
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
  /* deponente: l'aoristo della riga del lemma (-ηκα) dà il tema passivo (καταριέμαι → καταράστηκα) */
  const dp=e.cls.startsWith('D')&&(h.pasts||[h.past]).find(x=>/ηκα$/.test(x||''));
  if(dp){
    const t=finalizeEntry({...e,p:strip(dp).replace(/ηκα$/,''),O:{}});
    const v=conjugate(t).find(x=>x.id==='pass');
    if(v&&v.raw.aor&&v.raw.aor[0].split(' / ').includes(dp)){e.p=t.p;notes.push('aoristo preso dalla riga del lemma');}
    else notes.push('aoristo '+dp+' non riproducibile con le regole: correggilo a mano');
  }
  if(h.ppp)e.m=h.ppp;
  /* voce passiva: la riga del lemma dà la forma «passive X»; se le regole non la producono, non invento una passiva sbagliata */
  const pps=(h.passives&&h.passives.length?h.passives:(h.passive?[h.passive]:[]));
  if(pps.length&&!e.cls.startsWith('D')&&e.cls!=='X'){
    const passForms=t=>{try{const v=conjugate(finalizeEntry({...t,O:{...(t.O||{})}})).find(x=>x.id==='pass');return v||null;}catch(_){return null;}};
    const rv=passForms(e),rule=rv&&rv.raw.pres?rv.raw.pres[0].split(' / '):[];
    const tith=pps.find(x=>/τίθεμαι$/.test(x));
    const okRule=pps.some(x=>rule.includes(x));
    if(tith){
      /* famiglia di τίθεμαι (υποτίθεμαι, προστίθεμαι, επιτίθεμαι…) */
      const P=tith.replace(/τίθεμαι$/,'');
      const pres=[P+'τίθεμαι',P+'τίθεσαι',P+'τίθεται',P+'τιθέμαστε',P+'τίθεστε / '+P+'τιθέσαστε',P+'τίθενται'];
      const impf=[P+'τιθόμουν(α)',P+'τιθόσουν(α)',P+'τιθόταν(ε)',P+'τιθόμασταν',P+'τιθόσασταν',P+'τίθονταν'];
      /* se Wiktionary dà anche la forma regolare (προστίθεμαι/προσθέτομαι) la aggiungo come variante */
      const mix=(a,b)=>a.map((x,i)=>b&&b[i]&&!x.split(' / ').includes(b[i].split(' / ')[0])?x+' / '+b[i].split(' / ')[0]:x);
      e.O={...e.O,
        ppres:okRule?mix(pres,rv.raw.pres):pres,
        pimpf:okRule?mix(impf,rv.raw.impf):impf,
        paor:[P+'τέθηκα',P+'τέθηκες',P+'τέθηκε',P+'τεθήκαμε',P+'τεθήκατε',P+'τέθηκαν / '+P+'τεθήκαν(ε)'],
        psubj:[P+'τεθώ',P+'τεθείς',P+'τεθεί',P+'τεθούμε',P+'τεθείτε',P+'τεθούν(ε)']};
      e.p=undefined;
      notes.push('voce passiva ricavata dalla famiglia di τίθεμαι («'+tith+'»): controllala');
    }else if(!okRule){
      e.p=undefined;
      notes.push('Wiktionary indica «'+pps.join(' / ')+'» come passivo, che le regole non producono: la voce passiva non è stata creata, aggiungila con «Correggi forme»');
    }
  }
  return {entry:finalizeEntry(e),notes};
}

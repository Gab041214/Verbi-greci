import {loadLexicon,finalizeEntry,parseDslLine,entryToDsl,buildIndex,conjugate,guessEntry,keyOf,overrideKey,CLASS_DESC} from './engine.js';
import {LEXICON} from './lexicon.js';
import * as store from './store.js';
import {fetchVerb,listVerbs,parsePastedText} from './wiktionary.js';
import {fromHeadword} from './headword.js';
import {initClearable} from './clearable.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const PERS=['εγώ','εσύ','αυτός/-ή/-ό','εμείς','εσείς','αυτοί/-ές/-ά'];
const GROUPS=[['ind','Indicativo','Οριστική'],['sub','Congiuntivo (με «να»)','Υποτακτική'],['imp','Imperativo','Προστακτική'],['nom','Forme nominali','Άκλιτοι τύποι']];
const cell=f=>String(f).split(' / ').map(x=>'<span lang="el">'+esc(x)+'</span>').join('<br>');
const glossIsEn=e=>!!e.gloss_en&&e.gloss===e.gloss_en;
const EN_TAG=' <span class="tag warn" title="Significato in inglese: correggilo in italiano">EN</span>';
const SRC={base:'Lessico',extra:'Repository',wiktionary:'Wiktionary',manual:'Manuale',user:'Mio'};

let BASE=[],EXTRA=[],USER=[],LIST=[],INDEX=new Map(),BYID=new Map();
let current=null;

/* ---------- dati ---------- */
const hydrate=rec=>{const e=finalizeEntry({...rec,O:JSON.parse(JSON.stringify(rec.O||{}))});return e;};
function rebuild(){
  const m=new Map();
  for(const [arr,origin] of [[BASE,'base'],[EXTRA,'extra'],[USER,'user']]){
    for(const e of arr){e._origin=origin;m.set(keyOf(e.forms[0]),e);}
  }
  LIST=[...m.values()].sort((a,b)=>keyOf(a.lemma).localeCompare(keyOf(b.lemma),'el'));
  BYID=m;INDEX=buildIndex(LIST);if(typeof renderChips==='function'&&$('chips'))renderChips();
  $('count').textContent=LIST.length+' verbi in archivio.';
  $('acount').textContent=LIST.length+' verbi';
}
async function loadAll(){
  BASE=loadLexicon(LEXICON);
  try{const r=await fetch('data/extra.json',{cache:'no-cache'});if(r.ok){const j=await r.json();EXTRA=(j.entries||j||[]).map(x=>Object.assign(hydrate(x),{source:x.source||'extra'}));}}catch(_){}
  await store.init();
  USER=(await store.getAll()).map(hydrate);
  $('storewarn').hidden=store.persistent();
  rebuild();
}
async function saveUser(entry,extra={}){
  const e=hydrate({...entry,...extra,updated:new Date().toISOString().slice(0,10)});
  await store.put(e);
  USER=(await store.getAll()).map(hydrate);rebuild();return e;
}
function toast(t){const el=$('toast');el.textContent=t;el.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('on'),2600);}

/* ---------- resa ---------- */
function card(c){
  if(c.value!==undefined)return `<article class="card nom"><h4>${esc(c.it)} <small lang="el">${esc(c.gr)}</small></h4><p class="big">${cell(c.value)}</p></article>`;
  const rows=c.forms.map((f,i)=>`<tr><th lang="el">${c.imp?['εσύ','εσείς'][i]:PERS[i]}</th><td>${cell(f)}</td></tr>`).join('');
  return `<article class="card"><h4>${esc(c.it)} <small lang="el">${esc(c.gr)}</small></h4><table>${rows}</table></article>`;
}
function safeConj(e){
  try{return e._voices=conjugate(e);}catch(err){return null;}
}
/* disegna la scheda di un verbo in `el`. opts.actions: bottoni extra */
function renderEntry(el,e,voiceId,opts={}){
  const vs=safeConj(e);
  if(!vs||!vs.length){el.innerHTML='<p class="msg bad">Non riesco a coniugare questo verbo con i dati attuali.</p>';return;}
  const v=vs.find(x=>x.id===voiceId)||vs[0];
  let h=`<section class="hero"><div class="lemma" lang="el">${esc(e.display)}</div>`;
  if(e.gloss)h+=`<div class="gloss">${esc(e.gloss)}${glossIsEn(e)?EN_TAG:''}</div>`;
  h+=`<div class="tags"><span class="tag">${esc(CLASS_DESC[e.cls]||e.cls)}</span>`;
  const o=e._origin||e.source;
  if(o&&!e.guessed)h+=`<span class="tag">${esc(SRC[e.edited?'user':(e.source==='wiktionary'?'wiktionary':o)]||o)}${e.edited?' · corretto':''}</span>`;
  if(e.guessed)h+=`<span class="tag warn">Non presente nel database: forme ipotizzate con regole, da verificare</span>`;
  h+=`</div>${opts.actions?`<div class="acts">${opts.actions}</div>`:''}</section>`;
  h+=vs.length>1?`<div class="seg">`+vs.map(x=>`<button type="button" data-v="${x.id}" class="${x.id===v.id?'on':''}">${esc(x.label)}</button>`).join('')+`</div>`:`<div class="voice-name">${esc(v.label)}</div>`;
  for(const [g,it,gr] of GROUPS){
    const cs=v.cards[g];if(!cs.length)continue;
    h+=`<h3 class="grp">${it} <small lang="el">${gr}</small></h3><div class="grid">${cs.map(card).join('')}</div>`;
  }
  el.innerHTML=h;
  el.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{opts.onVoice&&opts.onVoice(b.dataset.v);renderEntry(el,e,b.dataset.v,opts);});
}

/* ---------- ricerca ---------- */
function show(e,voice){
  current=e;
  const actions=`<button type="button" class="btn" data-a="edit">Correggi forme</button>`+
    (e.guessed?'':`<button type="button" class="btn" data-a="gloss">Correggi traduzione</button>`)+
    (e.guessed?`<button type="button" class="btn pri" data-a="save">Salva nell'archivio</button>`:'');
  renderEntry($('out'),e,voice,{actions,onVoice:v=>{show.voice=v;}});
  $('out').onclick=ev=>{
    const a=ev.target.dataset&&ev.target.dataset.a;if(!a)return;
    if(a==='edit')openEditor(e,show.voice||voice);
    if(a==='gloss')openGloss(e);
    if(a==='save')saveUser(e,{source:'manual'}).then(()=>{toast('Salvato');search(e.lemma);});
  };
  show.voice=voice;
}
async function delUser(e){
  if(!confirm('Eliminare «'+e.lemma+'» dal tuo archivio? Se esiste nel lessico di base tornerà la versione originale.'))return false;
  await store.del(keyOf(e.forms[0]));USER=(await store.getAll()).map(hydrate);rebuild();
  if(current&&keyOf(current.forms[0])===keyOf(e.forms[0]))$('out').innerHTML='';
  renderArchive();toast('Eliminato');return true;
}
function search(q){
  const k=keyOf(q);if(!k){$('out').innerHTML='';return;}
  $('sugg').innerHTML='';
  const hit=INDEX.get(k);
  if(hit){show(hit.e,hit.voice);return;}
  $('wq').value=q.trim();   // verbo non nel database: precompila il campo di importazione
  const g=guessEntry(q);
  if(g){g._origin='guess';show(g,'act');return;}
  $('out').innerHTML=`<p class="msg">Verbo non trovato. Scrivi la 1ª persona singolare del presente indicativo, ad esempio <b lang="el">γράφω</b>, <b lang="el">αγαπώ</b> o <b lang="el">έρχομαι</b>.</p>`;
}
function suggest(q){
  const k=keyOf(q);if(!k){$('sugg').innerHTML='';return;}
  const out=[];
  for(const e of LIST){
    if(e.keys.some(f=>keyOf(f).startsWith(k))){out.push(e);if(out.length>=6)break;}
  }
  $('sugg').innerHTML=out.map(e=>`<button type="button" data-l="${esc(e.lemma)}"><span lang="el">${esc(e.display)}</span><em>${esc(e.gloss)}</em></button>`).join('');
  $('sugg').querySelectorAll('button').forEach(b=>b.onclick=()=>{$('q').value=b.dataset.l;search(b.dataset.l);});
}

/* ---------- editor delle forme ---------- */
const FIELDS=[['pres','Presente',6],['impf','Imperfetto',6],['aor','Aoristo',6],['subj','Cong. aoristo',6],['ipres','Imper. presente',2],['iaor','Imper. aoristo',2]];
function openEditor(e,voiceId){
  const vs=safeConj(e);if(!vs)return;
  const v=vs.find(x=>x.id===voiceId)||vs[0];
  const labels=n=>n===2?['εσύ','εσείς']:PERS;
  let h=`<div class="editor" id="ed"><h3>Correggi: <span lang="el">${esc(e.lemma)}</span> — ${esc(v.label)}</h3><p class="mute">Scrivi le forme esatte. Più varianti separate da « / ». Le celle lasciate invariate continuano a seguire le regole.</p><div class="ef">`;
  for(const [f,name,n] of FIELDS){
    const raw=v.raw[f];if(!raw)continue;
    h+=`<fieldset><legend>${name}</legend>`+raw.map((x,i)=>`<label><span lang="el">${labels(n)[i]}</span><input lang="el" data-f="${f}" data-i="${i}" data-o="${esc(x)}" value="${esc(x)}" spellcheck="false"></label>`).join('')+`</fieldset>`;
  }
  if(v.raw.ptc!==undefined)h+=`<fieldset><legend>Gerundio / participio</legend><label><span>Gerundio</span><input lang="el" data-f="ptc" data-i="0" data-o="${esc(v.raw.ptc)}" value="${esc(v.raw.ptc)}"></label>${typeof v.raw.m==='string'?`<label><span>Part. passato</span><input lang="el" data-f="m" data-i="0" data-o="${esc(v.raw.m)}" value="${esc(v.raw.m)}"></label>`:''}</fieldset>`;
  h+=`</div>
  <div class="row wrapbtn"><button type="button" class="btn pri" id="ed-s">Salva correzioni</button><button type="button" class="btn" id="ed-x">Annulla</button></div></div>`;
  $('out').insertAdjacentHTML('afterbegin',h);
  $('ed').scrollIntoView({block:'nearest'});
  $('ed-x').onclick=()=>$('ed').remove();
  $('ed-s').onclick=async()=>{
    const ne=hydrate({...e,O:e.O});
    ne.O=JSON.parse(JSON.stringify(e.O||{}));
    const groups={};
    $('ed').querySelectorAll('input[data-f]').forEach(inp=>{
      (groups[inp.dataset.f]??=[])[+inp.dataset.i]=[inp.value.trim(),inp.dataset.o];
    });
    for(const [f,arr] of Object.entries(groups)){
      if(!arr.some(([n,o])=>n!==o))continue;
      const key=(f==='ptc'||f==='m')?f:overrideKey(e,v.id,f);
      if(!key)continue;
      ne.O[key]=arr.map(([n,o])=>(n||o).replace(/\s*\/\s*/g,' / '));
    }
    delete ne.guessed;
    if(!ne.source||ne.source==='base'||ne.source==='extra')ne.source=e.source||'manual';
    const saved=await saveUser(ne,{edited:true});
    toast('Correzioni salvate');
    show(BYID.get(keyOf(saved.forms[0])),voiceId);
  };
}

/* ---------- pop-up informazioni ---------- */
const ovlClose=()=>document.querySelectorAll('.ovl').forEach(x=>{if(x.id==='gl')x.remove();else x.hidden=true;});
(function(){
  const mb=$('set-btn'),mn=$('set-menu');if(!mb)return;
  const menu=open=>{mn.hidden=!open;mb.setAttribute('aria-expanded',open?'true':'false');};
  const open=id=>{menu(false);ovlClose();const o=$(id);o.hidden=false;const c=o.querySelector('[data-close]');c&&c.focus();};
  mb.onclick=ev=>{ev.stopPropagation();menu(mn.hidden);};
  $('info-btn').onclick=()=>open('info');
  mn.querySelectorAll('[data-ovl]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.ovl)));
  mn.addEventListener('click',ev=>{if(ev.target.closest('button')&&!ev.target.closest('[data-ovl]'))menu(false);});
  $('imp').addEventListener('change',()=>menu(false));
  document.addEventListener('click',ev=>{if(!mn.hidden&&!mn.contains(ev.target))menu(false);});
  document.querySelectorAll('.ovl').forEach(o=>{
    o.addEventListener('click',ev=>{if(ev.target===o||ev.target.closest('[data-close]'))o.hidden=true;});
  });
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ovlClose();menu(false);}});
})();

/* ---------- pop-up: correggi traduzione ---------- */
function openGloss(e){
  closeGloss();
  const d=document.createElement('div');d.className='ovl';d.id='gl';
  d.innerHTML=`<div class="pop" role="dialog" aria-modal="true" aria-labelledby="gl-t"><h3 id="gl-t">Traduzione di <span lang="el">${esc(e.lemma)}</span></h3>${glossIsEn(e)?'<p class="mute">Il significato è ancora in inglese: scrivilo in italiano.</p>':''}<input id="gl-i" value="${esc(e.gloss)}" placeholder="es. votare" autocomplete="off"><div class="row wrapbtn"><button type="button" class="btn pri" id="gl-s">Salva</button><button type="button" class="btn" id="gl-x">Chiudi</button></div></div>`;
  document.body.appendChild(d);
  d.onclick=ev=>{if(ev.target===d)closeGloss();};
  $('gl-x').onclick=closeGloss;
  $('gl-s').onclick=async()=>{
    const g=$('gl-i').value.trim();
    const ne=hydrate({...e,O:e.O});ne.O=JSON.parse(JSON.stringify(e.O||{}));ne.gloss=g;
    if(!ne.source||ne.source==='base'||ne.source==='extra')ne.source=e.source||'manual';
    const saved=await saveUser(ne,{edited:true});
    closeGloss();toast('Traduzione salvata');
    show(BYID.get(keyOf(saved.forms[0])),show.voice);
  };
  setTimeout(()=>{const i=$('gl-i');i&&i.focus();i&&i.select();},30);
}
function closeGloss(){const d=$('gl');if(d)d.remove();}

/* ---------- archivio ---------- */
function renderArchive(){
  const k=keyOf($('afilter').value||'');
  const rows=LIST.filter(e=>!k||e.keys.some(f=>keyOf(f).includes(k))||keyOf(e.gloss).includes(k));
  const shown=rows.slice(0,300);
  $('alist').innerHTML=shown.map((e,i)=>`<div class="sw" data-i="${i}">${e._origin==='user'?'<button type="button" class="sw-del">Elimina</button>':''}<div class="item" data-l="${esc(e.lemma)}"><span><b lang="el">${esc(e.display)}</b><em>${esc(e.gloss)}</em>${glossIsEn(e)?EN_TAG:''}</span><span class="badge ${e._origin==='user'?'user':''}">${esc(e._origin==='user'?(e.edited?'corretto':SRC[e.source]||'mio'):SRC[e._origin])}</span></div></div>`).join('')+(rows.length>300?`<p class="mute">Mostrati i primi 300 di ${rows.length}: affina il filtro.</p>`:'');
  const W=96;
  const closeAll=except=>$('alist').querySelectorAll('.sw.open').forEach(x=>{if(x!==except){x.classList.remove('open','drag');const t=x.querySelector('.item');t.style.transition='transform .22s ease';t.style.transform='';}});
  $('alist').querySelectorAll('.sw').forEach(sw=>{
    const e=shown[+sw.dataset.i],it=sw.querySelector('.item'),del=sw.querySelector('.sw-del');
    let x0=0,y0=0,dx=0,on=false,moved=false,lock=null,base=0;
    const set=(v,anim)=>{it.style.transition=anim?'transform .22s ease':'none';it.style.transform=v?`translateX(${v}px)`:'';};
    if(del){
      it.addEventListener('pointerdown',ev=>{if(ev.pointerType==='mouse'&&ev.button!==0)return;on=true;moved=false;lock=null;x0=ev.clientX;y0=ev.clientY;dx=0;base=sw.classList.contains('open')?-W:0;closeAll(sw);});
      it.addEventListener('pointermove',ev=>{
        if(!on)return;const mx=ev.clientX-x0,my=ev.clientY-y0;
        if(!lock){if(Math.abs(mx)<6&&Math.abs(my)<6)return;lock=Math.abs(mx)>Math.abs(my)?'h':'v';if(lock==='h'){try{it.setPointerCapture(ev.pointerId);}catch(_){}}}
        if(lock!=='h')return;
        moved=true;dx=Math.max(-W-20,Math.min(0,base+mx));sw.classList.add('drag');set(dx,false);
      });
      const end=()=>{
        if(!on)return;on=false;
        if(lock==='h'){const open=dx<-W/2;sw.classList.toggle('open',open);sw.classList.toggle('drag',open);set(open?-W:0,true);}
      };
      it.addEventListener('pointerup',end);it.addEventListener('pointercancel',end);
      del.onclick=async()=>{const ok=await delUser(e);if(!ok){sw.classList.remove('open','drag');set(0,true);}};
    }
    it.onclick=()=>{
      if(moved){moved=false;return;}
      if(sw.classList.contains('open')){sw.classList.remove('open','drag');set(0,true);return;}
      go('cerca');$('q').value=it.dataset.l;search(it.dataset.l);window.scrollTo(0,0);
    };
  });
}
function download(name,text){
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}

/* ---------- importazione da Wiktionary ---------- */
function reportHtml(r){
  if(!r)return '';
  if(r.noTable)return `<p class="warn">Wiktionary non ha la tabella di coniugazione per questo verbo. Le forme sono calcolate con le regole${r.notes&&r.notes.length?' ('+esc(r.notes.join('; '))+')':''}: controllale e correggile se serve.</p>`;
  const miss=(r.missing||[]);
  return miss.length?`<p class="warn">Dati non trovati nella tabella (verranno calcolati con le regole): ${esc(miss.join(', '))}</p>`:'<p class="ok">Tabella letta completamente.</p>';
}
function failBox(el,err,intro){
  const d=err.diag?`<details class="box"><summary>Dettagli tecnici (da inviare a Claude)</summary><textarea id="diag" rows="8" class="full" readonly>${esc(err.diag)}</textarea><button type="button" class="btn" id="diagcopy">Copia</button></details>`:'';
  el.innerHTML=`<p class="warn">${esc(intro)}: ${esc(err.message)}.</p>${d}`;
  const b=$('diagcopy');if(b)b.onclick=async()=>{try{await navigator.clipboard.writeText(err.diag);toast('Copiato');}catch(_){$('diag').select();toast('Seleziona e copia');}};
}
function showPreview(el,entry,report){
  entry._origin='preview';
  const gl=esc(entry.gloss||'');
  el.innerHTML=reportHtml(report)+'<div id="pv-card"></div><label class="pvg">Significato in italiano'+(glossIsEn(entry)?' <em>(da Wiktionary, in inglese: sostituiscilo con la traduzione)</em>':'')+'<input id="pv-g" value="'+gl+'" placeholder="es. votare"></label><div class="row wrapbtn"><button type="button" class="btn pri" id="pv-s">Salva nell\'archivio</button><button type="button" class="btn" id="pv-x">Scarta</button></div>';
  renderEntry($('pv-card'),entry,'act');
  $('pv-x').onclick=()=>{el.innerHTML='';};
  $('pv-s').onclick=async()=>{
    const g=$('pv-g').value.trim();
    if(g)entry.gloss=g;
    await saveUser(entry,{});el.innerHTML='';$('wq').value='';$('pt').value='';$('pp').value='';toast('Salvato: '+entry.lemma);
  };
}
async function importOne(title){
  let {entry,report}=await fetchVerb(title);
  if(entry.fromHeadword){
    const r=fromHeadword(entry);
    entry=r.entry;
    report={found:[],missing:[],noTable:true,notes:r.notes};
  }
  return {entry,report};
}
$('wf').onsubmit=async ev=>{
  ev.preventDefault();
  const t=$('wq').value.trim();if(!t)return;
  $('prev').innerHTML='<p class="mute">Scarico da Wiktionary…</p>';
  try{const {entry,report}=await importOne(t);showPreview($('prev'),entry,report);}
  catch(err){failBox($('prev'),err,'Importazione non riuscita');}
};
$('pgo').onclick=()=>{
  const t=$('pt').value.trim(),p=$('pp').value;
  if(!t||!p.trim()){toast('Serve il verbo e la tabella incollata');return;}
  try{const {entry,report}=parsePastedText(p,t);ovlClose();go('aggiungi');showPreview($('prev'),entry,report);$('prev').scrollIntoView({block:'start'});}
  catch(err){ovlClose();go('aggiungi');failBox($('prev'),err,'Tabella non letta');}
};
let stopBulk=false,bulkCont=null;
$('bulk').onclick=async()=>{
  stopBulk=false;$('bulk').disabled=true;$('bulkstop').disabled=false;$('bprog').hidden=false;
  let done=0,skipped=0,fail=0;
  try{
    do{
      const {titles,next}=await listVerbs(bulkCont);
      bulkCont=next;
      $('bprog').max=Math.max(titles.length,1);
      let i=0;
      for(const t of titles){
        if(stopBulk)break;
        i++;$('bprog').value=i;
        if(BYID.has(keyOf(t))&&BYID.get(keyOf(t))._origin!=='base'){skipped++;continue;}
        if(BYID.has(keyOf(t))){skipped++;continue;}
        try{const {entry}=await importOne(t);await saveUser(entry,{});done++;}catch(_){fail++;}
        $('blog').textContent=`Importati ${done} · saltati ${skipped} · errori ${fail} — ultimo: ${t}`;
        await new Promise(r=>setTimeout(r,150));
      }
    }while(bulkCont&&!stopBulk);
  }catch(err){$('blog').textContent='Interrotto: '+err.message;}
  $('bulk').disabled=false;$('bulkstop').disabled=true;
  $('blog').textContent+=bulkCont?' (ripresa possibile)':' — fine elenco';
};
$('bulkstop').onclick=()=>{stopBulk=true;};

/* ---------- inserimento manuale ---------- */
$('m-c').innerHTML=Object.entries(CLASS_DESC).map(([k,v])=>`<option value="${k}">${k} — ${esc(v)}</option>`).join('');
$('classhelp').innerHTML='<ul>'+Object.entries(CLASS_DESC).map(([k,v])=>`<li><b>${k}</b>: ${esc(v)}</li>`).join('')+'</ul><p>Esempio DSL: <code>γράφω | A | scrivere | a=γράψ | p=γραφ</code>. I campi O.* (es. <code>O.aor=έγραψα,έγραψες,…</code>) forzano forme esatte.</p>';
function manualEntry(){
  const d=$('m-d').value.trim();
  if(d)return parseDslLine(d);
  const l=$('m-l').value.trim();if(!l)throw new Error('Scrivi il verbo');
  const e={forms:[l],cls:$('m-c').value,gloss:$('m-g').value.trim(),O:{}};
  if($('m-a').value.trim())e.a=$('m-a').value.trim();
  if($('m-p').value.trim())e.p=$('m-p').value.trim();
  return finalizeEntry(e);
}
/* ---------- forma avanzata (pop-up che compila la stringa DSL) ---------- */
const ADV_O=['pres','impf','aor','subj','ipres','iaor','ptc','ppres','pimpf','paor','psubj','piaor','pinf'];
const ADV_X=['s','m','i','ps','pc','no'];
$('adv-c').innerHTML=$('m-c').innerHTML;
function advEntry(){
  const v=id=>$('adv-'+id).value.trim();
  const l=v('l');if(!l)throw new Error('Scrivi il verbo');
  const e={forms:l.split('/').map(x=>x.trim()),cls:v('c'),gloss:v('g'),O:{}};
  ['a','p',...ADV_X].forEach(k=>{if(v(k))e[k]=v(k);});
  ADV_O.forEach(k=>{if(v(k))e.O[k]=v(k).split(',').map(x=>x.trim().replace(/\s*\/\s*/g,' / '));});
  return e;
}
function advLine(){try{return entryToDsl(advEntry());}catch(_){return '';}}
function advRefresh(){$('adv-out').textContent=advLine()||'—';}
$('ov-adv').addEventListener('input',advRefresh);
$('adv-open').onclick=()=>{
  ovlClose();
  const d=$('m-d').value.trim();
  if(d){try{const e=parseDslLine(d);
    $('adv-l').value=e.forms.join('/');$('adv-c').value=e.cls;$('adv-g').value=e.gloss;
    ['a','p',...ADV_X].forEach(k=>$('adv-'+k).value=e[k]||'');
    ADV_O.forEach(k=>$('adv-'+k).value=e.O[k]?e.O[k].map(x=>x.replace(/ \/ /g,'/')).join(','):'');}catch(_){}}
  else{$('adv-l').value=$('m-l').value;$('adv-c').value=$('m-c').value;$('adv-g').value=$('m-g').value;$('adv-a').value=$('m-a').value;$('adv-p').value=$('m-p').value;}
  $('adv-prev').innerHTML='';advRefresh();$('ov-adv').hidden=false;
};
$('adv-pv').onclick=()=>{
  try{const e=parseDslLine(advLine()||advEntry());e._origin='preview';renderEntry($('adv-prev'),e,'act');}
  catch(err){$('adv-prev').innerHTML=`<p class="warn">${esc(err.message)}</p>`;}
};
$('adv-ok').onclick=()=>{
  try{advEntry();}catch(err){$('adv-prev').innerHTML=`<p class="warn">${esc(err.message)}</p>`;return;}
  $('m-d').value=advLine();
  $('m-l').value=$('adv-l').value;$('m-c').value=$('adv-c').value;$('m-g').value=$('adv-g').value;
  $('adv-state').hidden=false;ovlClose();toast('Forma avanzata applicata');
};
$('adv-off').onclick=ev=>{ev.preventDefault();$('m-d').value='';$('adv-state').hidden=true;};

$('m-pv').onclick=()=>{
  try{const e=manualEntry();e._origin='preview';renderEntry($('mprev'),e,'act');}
  catch(err){$('mprev').innerHTML=`<p class="warn">${esc(err.message)}</p>`;}
};
$('mf').onsubmit=async ev=>{
  ev.preventDefault();
  try{
    const e=manualEntry();
    if(!safeConj(e))throw new Error('Con questi dati non è possibile coniugare il verbo');
    const s=await saveUser(e,{source:'manual'});
    $('mprev').innerHTML='';$('mf').reset();$('adv-state').hidden=true;toast('Salvato: '+s.lemma);
    go('cerca');$('q').value=s.lemma;search(s.lemma);
  }catch(err){$('mprev').innerHTML=`<p class="warn">${esc(err.message)}</p>`;}
};

/* ---------- esporta / importa ---------- */
$('exp').onclick=()=>{
  if(!USER.length){toast('Non hai ancora dati tuoi da esportare');return;}
  download('extra.json',store.toJson(USER));
};
$('imp').onchange=async ev=>{
  const f=ev.target.files[0];if(!f)return;
  try{
    const arr=store.fromJson(await f.text());
    for(const r of arr)await store.put(hydrate(r));
    USER=(await store.getAll()).map(hydrate);rebuild();renderArchive();toast('Importati '+arr.length+' verbi');
  }catch(err){toast('File non valido: '+err.message);}
  ev.target.value='';
};
$('clr').onclick=async()=>{
  if(!confirm('Cancellare tutti i verbi importati, inseriti o corretti da te su questo dispositivo?'))return;
  await store.clearAll();USER=[];rebuild();renderArchive();$('out').innerHTML='';toast('Archivio personale svuotato');
};
$('afilter').oninput=renderArchive;

/* ---------- navigazione ---------- */
const EXAMPLES=['γράφω','αγαπώ','θεωρώ','έρχομαι','κοιμάμαι','γεννιέμαι','ασχολούμαι','είμαι'];
function renderChips(){
  $('chips').innerHTML=EXAMPLES.map(x=>{const h=INDEX.get(keyOf(x));return `<button type="button" data-v="${x}">${h?`<b class="cls">${h.e.cls}</b>`:''}<span lang="el">${x}</span></button>`;}).join('');
  $('chips').querySelectorAll('button').forEach(b=>b.onclick=()=>{ovlClose();go('cerca');$('q').value=b.dataset.v;search(b.dataset.v);window.scrollTo(0,0);});
}
function go(tab){
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  document.querySelectorAll('.pane').forEach(p=>p.hidden=p.id!=='tab-'+tab);
  if(tab==='archivio')renderArchive();
}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>go(b.dataset.tab));
$('q-clear').onclick=()=>{const q=$('q');q.value='';q.dispatchEvent(new Event('input',{bubbles:true}));$('out').innerHTML='';$('sugg').innerHTML='';current=null;window.scrollTo(0,0);};
$('w-clear').onclick=()=>{const w=$('wq');w.value='';w.dispatchEvent(new Event('input',{bubbles:true}));$('prev').innerHTML='';$('mprev').innerHTML='';window.scrollTo(0,0);};
$('f').addEventListener('submit',ev=>{ev.preventDefault();search($('q').value);});
$('q').addEventListener('input',()=>suggest($('q').value));

initClearable();
loadAll().then(()=>{window.__ready=true;});
if('serviceWorker' in navigator&&location.protocol!=='file:'){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

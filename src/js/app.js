import {loadLexicon,finalizeEntry,parseDslLine,entryToDsl,buildIndex,buildFormIndex,formVariants,conjugate,guessEntry,keyOf,overrideKey,CLASS_DESC} from './engine.js';
import {cascadeForms} from './cascade.js';
import {LEXICON} from './lexicon.js';
import * as store from './store.js';
import {fetchVerb,lookupForm,listVerbs,parsePastedText,fetchDiag} from './wiktionary.js';
import {fromHeadword} from './headword.js';
import {fetchVerbFull,fetchElEntry} from './elwikt.js';
import {isPassTitle,activeCandidates,passiveCandidates,lacksPassive,withPassive,withoutPassive,hasPassive} from './passive.js';
import {splitPrefix,splitAna,deriveEntry} from './derive.js';
import {initClearable} from './clearable.js';
import * as marks from './marks.js';
import {buildRows,toCsv,toTsv,parseTable,planImport} from './translations.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const PERS=['εγώ','εσύ','αυτός/-ή/-ό','εμείς','εσείς','αυτοί/-ές/-ά'];
const GROUPS=[['ind','Indicativo','Οριστική'],['sub','Congiuntivo (με «να»)','Υποτακτική'],['imp','Imperativo','Προστακτική'],['nom','Forme nominali','Άκλιτοι τύποι']];
const cell=f=>String(f).split(' / ').map(x=>'<span lang="el">'+esc(x)+'</span>').join('<br>');
const glossIsEn=e=>!!e.gloss_en&&e.gloss===e.gloss_en;
const EN_TAG=' <span class="tag warn" title="Significato in inglese: correggilo in italiano">EN</span>';
const SRC={base:'Lessico',extra:'Repository',wiktionary:'Wiktionary',manual:'Manuale',derived:'Derivato',user:'Mio'};

let BASE=[],EXTRA=[],USER=[],LIST=[],INDEX=new Map(),FORMS=new Map(),BYID=new Map();
let current=null;

/* ---------- dati ---------- */
const hydrate=rec=>{const e=finalizeEntry({...rec,O:JSON.parse(JSON.stringify(rec.O||{}))});return e;};
function rebuild(){
  const m=new Map();
  for(const [arr,origin] of [[BASE,'base'],[EXTRA,'extra'],[USER,'user']]){
    for(const e of arr){e._origin=origin;m.set(keyOf(e.forms[0]),e);}
  }
  LIST=[...m.values()].sort((a,b)=>keyOf(a.lemma).localeCompare(keyOf(b.lemma),'el'));
  BYID=m;INDEX=buildIndex(LIST);FORMS=buildFormIndex(LIST);if(typeof renderChips==='function'&&$('chips'))renderChips();
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

/* ---------- «da controllare» ---------- */
/* piccolo menu in stile vetro sotto un pulsante; si chiude toccando fuori, scorrendo o con Esc */
function chkMenu(anchor,items){
  document.querySelectorAll('.cscrim,.cmenu').forEach(x=>x.remove());
  const sc=document.createElement('div');sc.className='cscrim';
  const m=document.createElement('div');m.className='cmenu';m.setAttribute('role','menu');
  m.innerHTML=items.map((x,i)=>`<button type="button" role="menuitem" data-i="${i}"><span>${esc(x.label)}</span><span class="ck">${x.check?'✓':''}</span></button>`).join('');
  document.body.append(sc,m);
  const r=anchor.getBoundingClientRect(),mh=m.offsetHeight,mw=m.offsetWidth;
  let top=r.bottom+4;if(top+mh>innerHeight-8)top=Math.max(8,r.top-mh-4);
  m.style.top=top+'px';m.style.left=Math.max(8,Math.min(innerWidth-mw-8,r.right-mw+8))+'px';
  const onk=ev=>{if(ev.key==='Escape')close();};
  function close(){sc.remove();m.remove();document.removeEventListener('keydown',onk);window.removeEventListener('scroll',onsc,true);}
  const t0=Date.now(),onsc=()=>{if(Date.now()-t0>400)close();};   // uno scorrimento appena finito non lo chiude
  sc.onclick=close;
  document.addEventListener('keydown',onk);window.addEventListener('scroll',onsc,true);
  m.querySelectorAll('button').forEach(b=>b.onclick=()=>{const x=items[+b.dataset.i];close();x.run();});
}
function openFormMenu(btn,ctx){
  const k=btn.dataset.k,all=+btn.dataset.all||0,on=btn.classList.contains('on');
  const keys=all?Array.from({length:all},(_,j)=>k.replace(/:0$/,':'+j)):[k];
  chkMenu(btn,[
    {label:all?'Da controllare (tutto il tempo)':'Da controllare',check:on,run:()=>{marks.setMany(ctx.id,keys,true);btn.classList.add('on');}},
    {label:'Controllato',check:!on,run:()=>{marks.setMany(ctx.id,keys,false);btn.classList.remove('on');}}
  ]);
}
/* tutti i segni possibili di un verbo (voce:scheda:posizione) */
function allMarkKeys(e){
  const o=[];
  for(const v of safeConj(e)||[])for(const g of Object.keys(v.cards))for(const c of v.cards[g]){
    const n=c.forms?c.forms.length:1;for(let i=0;i<n;i++)o.push(marks.markKey(v.id,c.id,i));
  }
  return o;
}
/* verbi ricavati o calcolati con le regole: segna da subito le forme più incerte (aoristo e derivati) */
function autoMark(saved,report){
  if(!saved||!report||!(report.derived||report.addPass||report.noTable||report.el))return;
  const id=keyOf(saved.forms[0]),voices=report.addPass?['pass']:['act','pass'];
  const keys=[];
  for(const v of safeConj(saved)||[]){
    if(!voices.includes(v.id))continue;
    for(const g of Object.keys(v.cards))for(const c of v.cards[g]){
      if(!['aor','saor','iaor'].includes(c.id))continue;
      for(let i=0;i<(c.forms?c.forms.length:1);i++)keys.push(marks.markKey(v.id,c.id,i));
    }
  }
  marks.setMany(id,keys,true);
}

/* ---------- resa ---------- */
/* pallino «da controllare» di una forma; ctx = {id del verbo, voce} */
function dotBtn(ctx,cardId,i,all){
  const k=marks.markKey(ctx.voice,cardId,i);
  /* all = numero di forme del tempo: un solo puntino sulla prima persona vale per tutte */
  const on=all?Array.from({length:all},(_,j)=>marks.has(ctx.id,marks.markKey(ctx.voice,cardId,j))).some(Boolean):marks.has(ctx.id,k);
  return `<button type="button" class="dotbtn${on?' on':''}" data-k="${k}"${all?` data-all="${all}"`:''} aria-label="${all?'Controllo del tempo':'Controllo della forma'}" aria-haspopup="true"><i></i></button>`;
}
function card(c,ctx){
  if(c.value!==undefined)return `<article class="card nom"><h4>${esc(c.it)} <small lang="el">${esc(c.gr)}</small></h4><p class="big${ctx?' chkrow':''}"><span>${cell(c.value)}</span>${ctx?dotBtn(ctx,c.id,0):''}</p></article>`;
  const six=!c.imp&&c.forms.length===6;
  const rows=c.forms.map((f,i)=>`<tr><th lang="el">${c.imp?['εσύ','εσείς'][i]:PERS[i]}</th><td>${cell(f)}</td>${ctx?`<td class="chk">${six?(i===0?dotBtn(ctx,c.id,0,6):''):dotBtn(ctx,c.id,i)}</td>`:''}</tr>`).join('');
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
  const pas=v.id==='pass'&&vs.length>1&&v.raw&&v.raw.pres&&v.raw.pres[0];
  let h=`<section class="hero"><div class="lemma" lang="el">${esc(pas?v.raw.pres[0]:e.display)}</div>`;
  const gl=pas&&e.gloss_p?e.gloss_p:e.gloss;
  const ver=pas&&!e.gloss_p;   // la voce passiva usa ancora la traduzione dell'attiva: testo nel colore d'avviso
  if(gl)h+=`<div class="gloss${ver?' gl-ver':''}"${ver?' title="Traduzione della voce attiva: la voce passiva può avere un altro significato"':''}>${esc(gl)}${!(pas&&e.gloss_p)&&glossIsEn(e)?EN_TAG:''}</div>`;
  h+=`<div class="tags"><span class="tag">${esc(CLASS_DESC[e.cls]||e.cls)}</span>`;
  const o=e._origin||e.source;
  if(o&&!e.guessed)h+=`<span class="tag">${esc(SRC[e.edited?'user':(e.source==='wiktionary'?'wiktionary':o)]||o)}${e.edited?' · corretto':''}</span>`;
  if(e.guessed)h+=`<span class="tag warn">Non presente nel database: forme ipotizzate con regole, da verificare</span>`;
  h+=`</div>${opts.actions?`<div class="acts">${opts.actions}</div>`:''}</section>`;
  h+=vs.length>1?`<div class="seg">`+vs.map(x=>`<button type="button" data-v="${x.id}" class="${x.id===v.id?'on':''}">${esc(x.label)}</button>`).join('')+`</div>`:`<div class="voice-name">${esc(v.label)}</div>`;
  /* i pallini ci sono solo per i verbi dell'archivio, non per le anteprime */
  const ctx=['base','extra','user'].includes(e._origin)?{id:keyOf(e.forms[0]),voice:v.id}:null;
  for(const [g,it,gr] of GROUPS){
    const cs=v.cards[g];if(!cs.length)continue;
    h+=`<h3 class="grp">${it} <small lang="el">${gr}</small></h3><div class="grid">${cs.map(c=>card(c,ctx)).join('')}</div>`;
  }
  el.innerHTML=h;
  if(ctx)el.querySelectorAll('.dotbtn').forEach(b=>b.onclick=()=>openFormMenu(b,ctx));
  el.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{opts.onVoice&&opts.onVoice(b.dataset.v);renderEntry(el,e,b.dataset.v,opts);});
}

/* ---------- ricerca ---------- */
function show(e,voice){
  current=e;shownQ=shownKeyFor(e);syncGo();
  const actions=`<button type="button" class="btn" data-a="edit">Correggi forme</button>`+
    (e.guessed?'':`<button type="button" class="btn" data-a="gloss">Correggi traduzione</button>`)+
    (!e.guessed&&lacksPassive(e)?`<button type="button" class="btn" data-a="addps">Aggiungi voce passiva</button>`:'')+
    (e.guessed?`<button type="button" class="btn" data-a="paste">Incolla tabella</button><button type="button" class="btn pri" data-a="save">Salva nell'archivio</button>`:'');
  renderEntry($('out'),e,voice,{actions,onVoice:v=>{show.voice=v;}});
  $('out').onclick=ev=>{
    const a=ev.target.dataset&&ev.target.dataset.a;if(!a)return;
    if(a==='edit')openEditor(e,show.voice||voice);
    if(a==='gloss')openGloss(e,ev.target);
    if(a==='addps'){const p=passiveCandidates(e.forms[0],e.cls)[0];if(p)addPassive(e,p);else toast('Non riesco a calcolare la voce passiva');}
    if(a==='paste'){openOvl('ov-paste',ev.target);$('pt').value=e.lemma;}
    if(a==='save')saveUser(e,{source:'manual'}).then(()=>{toast('Salvato');search(e.lemma);});
  };
  show.voice=voice;
}
async function delUser(e){
  if(!confirm('Eliminare «'+e.lemma+'» dal tuo archivio? Se esiste nel lessico di base tornerà la versione originale.'))return false;
  await store.del(keyOf(e.forms[0]));USER=(await store.getAll()).map(hydrate);rebuild();if(!BYID.has(keyOf(e.forms[0])))marks.clearEntry(keyOf(e.forms[0]));
  if(current&&keyOf(current.forms[0])===keyOf(e.forms[0]))$('out').innerHTML='';
  renderArchive();toast('Eliminato');return true;
}
let searchSeq=0;
function formNote(q,h){
  const k=keyOf(q),tags=h.tags.join(' · ');
  $('out').insertAdjacentHTML('afterbegin',`<p class="msg formnote">«<b lang="el">${esc(q.trim())}</b>» è una forma di <b lang="el">${esc(h.e.display)}</b>: ${esc(tags)}</p>`);
  /* evidenzia la forma nelle tabelle */
  $('out').querySelectorAll('*').forEach(el=>{
    if(el.children.length||el.closest('.formnote'))return;
    if(formVariants(el.textContent).some(w=>keyOf(w)===k))el.classList.add('hit');
  });
  const first=$('out').querySelector('.hit');
  if(first)first.scrollIntoView({block:'center',behavior:'smooth'});
}
function candidates(q,list,note,el=$('out')){
  el.innerHTML=`<p class="msg">«<b lang="el">${esc(q.trim())}</b>» ${note||'può essere una forma di più verbi'}:</p><div class="cands">`+
    list.map(h=>`<button type="button" data-l="${esc(h.e?h.e.lemma:h.title)}" data-v="${h.voice||'act'}" data-q="${esc(q.trim())}"><span lang="el"><b>${esc(h.e?h.e.display:h.title)}</b></span><em>${esc(h.e?`${h.e.gloss} · ${h.tags.join(' · ')}`:h.desc)}</em></button>`).join('')+`</div>`;
  el.querySelectorAll('.cands button').forEach(b=>b.onclick=()=>pickLemma(b.dataset.l,b.dataset.v,b.dataset.q,el));
}
/* verbo in -ώ senza tabella: la classe (B1 αγαπώ / B2 θεωρώ) non si può dedurre, la chiedo */
const needsClass=l=>{const t=String(l||'').trim().toLowerCase();return /ώ$/.test(t)&&!/ποιώ$/.test(t);};
function askClass(el,lemma,onPick,why){
  const f=c=>{try{const g=guessEntry(lemma,c);const v=conjugate(g).find(x=>x.id==='act');return v.cards.ind[0].forms[1];}catch(_){return '';}};
  el.innerHTML=`<div class="box clsq"><p><b lang="el">${esc(lemma)}</b> è un verbo in -ώ e ${esc(why||'su Wiktionary non ho trovato la tabella di coniugazione')}. Di quale classe è?</p><div class="clsg"><div><button type="button" class="btn" data-c="B1">B1</button><div class="clsx">come <span lang="el">αγαπώ</span><br><span lang="el">${esc(f('B1'))}</span></div></div><div><button type="button" class="btn" data-c="B2">B2</button><div class="clsx">come <span lang="el">θεωρώ</span><br><span lang="el">${esc(f('B2'))}</span></div></div></div></div>`;
  el.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>onPick(b.dataset.c));
}
/* verbo con prefisso (ξανα-) senza tabella: lo ricavo dal verbo base che conosco già (archivio, oppure tabella completa su Wiktionary) */
async function tryDerive(title,wik,web=true){
  const cands=[splitPrefix(title),...splitAna(title)].filter(Boolean);
  let sp=null,base=null;
  for(const c of cands){
    base=null;
    const h=INDEX.get(keyOf(c.rest));
    if(h)base=h.e;
    else if(/ομαι$/.test(c.rest)){const h2=INDEX.get(keyOf(c.rest.replace(/ομαι$/,'ω')));if(h2)base=h2.e;}
    if(!base&&web){
      try{const r=await fetchVerb(c.rest);const ok=!r.entry.fromHeadword&&!(r.report.missing&&r.report.missing.length)&&!(r.report.repairs&&r.report.repairs.length);if(ok)base=finalizeEntry(r.entry);}catch(_){}
    }
    if(base){sp=c;break;}
  }
  if(!base)return null;
  const d=deriveEntry(base,sp.prefix,sp.kind);if(!d)return null;
  if(wik&&wik.gloss){d.gloss=wik.gloss;if(wik.gloss_en)d.gloss_en=wik.gloss_en;}
  else if(base.gloss){const en=glossIsEn(base);d.gloss=base.gloss+(en?' again':' di nuovo');if(en)d.gloss_en=d.gloss;}
  d.keys=[...new Set([...d.keys])];
  /* forme alternative dell'aoristo scritte nella riga del verbo (es. ξαναείδα/ξανάδα) */
  const extra=[];
  const hp=wik&&wik.fromHeadword&&wik.fromHeadword.pasts;
  if(hp&&hp.length&&Array.isArray(d.O.aor)&&d.O.aor.length){
    const have=d.O.aor[0].split(' / ');
    hp.forEach(p=>{if(!have.includes(p)){have.push(p);extra.push(p);}});
    if(extra.length)d.O.aor=[have.join(' / '),...d.O.aor.slice(1)];
  }
  return {entry:d,report:{found:[],missing:[],derived:{extra,from:base.lemma,prefix:sp.prefix,noPass:/ομαι$/.test(title)&&!d.O.ppres&&!d.cls.startsWith('D')}}};
}
async function resolveHeadword(el,entry){
  const ev=await fetchElEntry(entry.forms[0]);
  if(ev){const g=entry.gloss_en||entry.gloss;if(g){ev.entry.gloss=g;ev.entry.gloss_en=g;}showPreview(el,ev.entry,ev.report);return;}
  const dv=await tryDerive(entry.forms[0],entry);
  if(dv){showPreview(el,dv.entry,dv.report);return;}
  const done=cls=>{const r=fromHeadword(entry,cls);showPreview(el,r.entry,{found:[],missing:[],noTable:true,notes:r.notes});};
  if(needsClass(entry.forms[0]))askClass(el,entry.forms[0],done,'la pagina non ha la tabella di coniugazione');else done();
}
/* forma passiva cercata (es. χορεύομαι) di un verbo che nell'archivio non ha la voce passiva: offro di aggiungerla */
function passiveOffer(e,q){
  q=String(q||'').trim();
  if(!/μαι$/.test(q)||!e||e.cls.startsWith('D')||e.cls==='X')return;
  const vs=safeConj(e);if(!vs||vs.some(v=>v.id==='pass'))return;
  $('out').insertAdjacentHTML('afterbegin',`<div class="box addpass"><p><b lang="el">${esc(q)}</b> è la voce passiva di <b lang="el">${esc(e.display)}</b>, che nel tuo archivio non ha la voce passiva.</p><div class="row wrapbtn"><button type="button" class="btn pri" id="addpass">Aggiungi la voce passiva</button></div></div>`);
  $('addpass').onclick=()=>addPassive(e,q);
}
function addPassive(e,q){
  const ne=withPassive(e,q);
  if(!ne){toast('Non riesco a calcolare la voce passiva');return;}
  ne.edited=true;
  showPreview($('out'),finalizeEntry(ne),{found:[],missing:[],addPass:{form:q,lemma:e.lemma}});
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
/* pagina della forma passiva su Wiktionary: {kind:'table'} se ha la tabella completa, {kind:'rules'} se no; null se la pagina non c'è */
async function passiveSource(p){
  try{
    const fv=await fetchVerbFull(p);
    if(fv&&!fv.report.redirect&&!fv.entry.fromHeadword&&!(fv.report.missing&&fv.report.missing.length)&&!(fv.report.repairs&&fv.report.repairs.length))return {kind:'table',entry:finalizeEntry(fv.entry)};
    return {kind:'rules'};
  }catch(_){return null;}
}
/* cerca su Wiktionary la forma passiva di un verbo attivo */
async function lookupPassive(e){
  for(const p of passiveCandidates(e.forms[0],e.cls)){
    const pre=await passiveSource(p);
    if(pre)return {pform:p,pre};
    await sleep(150);
  }
  return null;
}
/* aggiunge e salva la voce passiva: dalla tabella se c'è, altrimenti con le regole e il pallino «da controllare» sull'aoristo */
async function attachPassive(e,pform,pre){
  const ne=withPassive(e,pform,pre&&pre.kind==='table'?pre.entry:null);
  if(!ne)return null;
  const saved=await saveUser(ne,{});
  if(!(pre&&pre.kind==='table'))autoMark(saved,{addPass:{form:pform,lemma:e.lemma}});
  return saved;
}
async function pickLemma(l,voice,q,el=$('out')){
  const hit=INDEX.get(keyOf(l));
  if(hit){show(hit.e,voice||hit.voice);const fh=FORMS.get(keyOf(q||''));const h=fh&&fh.find(x=>x.e===hit.e);if(h)formNote(q,h);else passiveOffer(hit.e,q);return;}
  el.innerHTML='<p class="mute">Scarico da Wiktionary…</p>';
  try{const {entry,report}=await fetchVerb(l);if(entry.fromHeadword)resolveHeadword(el,entry);else showPreview(el,entry,report);}
  catch(err){failBox(el,err,'Importazione non riuscita',l);}
}
/* «Coniuga» resta inattivo finché la tabella del verbo scritto è già sullo schermo */
let shownQ='';
function shownKeyFor(e){
  const k=keyOf($('q').value);if(!k)return '';
  const h=INDEX.get(k);if(h&&h.e===e)return k;
  if((FORMS.get(k)||[]).some(x=>x.e===e))return k;
  return e.forms&&keyOf(e.forms[0])===k?k:'';
}
function syncGo(){const b=$('go-btn');if(b)b.disabled=!!shownQ&&keyOf($('q').value)===shownQ;}
async function search(q){
  const seq=++searchSeq;
  const k=keyOf(q);if(!k){$('out').innerHTML='';return;}
  $('sugg').innerHTML='';
  const hit=INDEX.get(k);
  if(hit){show(hit.e,hit.voice);return;}
  const fh=FORMS.get(k);
  if(fh&&fh.length===1){show(fh[0].e,fh[0].voice);formNote(q,fh[0]);return;}
  if(fh&&fh.length>1){candidates(q,fh);return;}
  /* non è nell'archivio: provo su Wiktionary */
  $('out').innerHTML='<p class="msg">Non è nell\'archivio: cerco su Wiktionary…</p>';
  let res=null,lerr=null;
  try{res=await lookupForm(q.trim());}catch(e){res=null;lerr=e;}
  if(seq!==searchSeq)return;
  if(res&&res.kind==='forms'){candidates(q,res.lemmas,'è una forma di');return;}
  if(res&&res.kind==='lemma'){
    let {entry,report}=res;
    if(entry.fromHeadword){resolveHeadword($('out'),entry);return;}
    showPreview($('out'),entry,report);return;
  }
  const dv=await tryDerive(q.trim(),null);
  if(seq!==searchSeq)return;
  if(dv){showPreview($('out'),dv.entry,dv.report);return;}
  if(needsClass(q)&&guessEntry(q)){
    if(lerr&&lerr.diag){failBox($('out'),lerr,'Pagina trovata ma non letta',q);return;}
    askClass($('out'),q.trim(),c=>{const g2=guessEntry(q,c);g2._origin='guess';show(g2,'act');});return;
  }
  const g=guessEntry(q);
  if(g){g._origin='guess';show(g,'act');return;}
  if(lerr&&lerr.diag){failBox($('out'),lerr,'Forma non trovata',q);return;}
  $('out').innerHTML=`<p class="msg">Non trovo «<b lang="el">${esc(q.trim())}</b>» né nell'archivio né su Wiktionary. Prova con un'altra forma del verbo, ad esempio <b lang="el">γράφω</b>, <b lang="el">αγαπώ</b> o <b lang="el">έρχομαι</b>.</p>`+rescue($('out'),q);
  wireRescue($('out'),q);
}
function suggest(q){
  const k=keyOf(q);if(!k){$('sugg').innerHTML='';return;}
  const out=[];const seen=new Set();
  for(const e of LIST){
    if(e.keys.some(f=>keyOf(f).startsWith(k))){out.push({e,q:e.lemma,tag:e.gloss});seen.add(e);if(out.length>=6)break;}
  }
  if(out.length<6){
    for(const [fk,arr] of FORMS){
      if(!fk.startsWith(k))continue;
      for(const h of arr){
        if(seen.has(h.e))continue;seen.add(h.e);
        out.push({e:h.e,q:h.w,tag:`forma di ${h.e.display}`,form:true});
        if(out.length>=6)break;
      }
      if(out.length>=6)break;
    }
  }
  $('sugg').innerHTML=out.map((o,i)=>`<button type="button" data-i="${i}"><span lang="el">${esc(o.form?o.q:o.e.display)}</span><em>${esc(o.tag)}</em></button>`).join('');
  $('sugg').querySelectorAll('button').forEach(b=>b.onclick=()=>{
    const o=out[+b.dataset.i];
    /* per le forme cerco quella digitata, non la chiave senza accenti */
    $('q').value=o.q;search(o.q);
  });
}

/* ---------- editor delle forme ---------- */
const FIELDS=[['pres','Presente',6],['impf','Imperfetto',6],['aor','Aoristo',6],['subj','Cong. aoristo',6],['ipres','Imper. presente',2],['iaor','Imper. aoristo',2]];
function openEditor(e,voiceId){
  const vs=safeConj(e);if(!vs)return;
  const v=vs.find(x=>x.id===voiceId)||vs[0];
  const labels=n=>n===2?['εσύ','εσείς']:PERS;
  let h=`<div class="editor" id="ed"><h3>Correggi: <span lang="el">${esc(e.lemma)}</span> — ${esc(v.label)}</h3><p class="mute">Scrivi le forme esatte. Più varianti separate da « / ». Le celle lasciate invariate continuano a seguire le regole. Se correggi la 1ª persona singolare di un tempo, le altre persone di quel tempo si ricalcolano (puoi comunque correggerle una per una).</p><div class="ef">`;
  for(const [f,name,n] of FIELDS){
    const raw=v.raw[f];if(!raw)continue;
    const okey=overrideKey(e,v.id,f);
    h+=`<fieldset data-f="${f}"><legend>${name}${okey&&e.O&&e.O[okey]?` <button type="button" class="lnk" data-reset="${f}">Ripristina calcolo automatico</button>`:''}</legend>`+raw.map((x,i)=>`<label><span lang="el">${labels(n)[i]}</span><input lang="el" data-f="${f}" data-i="${i}" data-o="${esc(x)}" value="${esc(x)}" spellcheck="false"></label>`).join('')+`</fieldset>`;
  }
  if(v.raw.ptc!==undefined)h+=`<fieldset><legend>Gerundio / participio</legend><label><span>Gerundio</span><input lang="el" data-f="ptc" data-i="0" data-o="${esc(v.raw.ptc)}" value="${esc(v.raw.ptc)}"></label>${typeof v.raw.m==='string'?`<label><span>Part. passato</span><input lang="el" data-f="m" data-i="0" data-o="${esc(v.raw.m)}" value="${esc(v.raw.m)}"></label>`:''}</fieldset>`;
  h+=`</div>
  <div class="row wrapbtn"><button type="button" class="btn pri" id="ed-s">Salva correzioni</button><button type="button" class="btn" id="ed-x">Annulla</button></div></div>`;
  $('out').insertAdjacentHTML('afterbegin',h);
  $('ed').scrollIntoView({block:'nearest'});
  $('ed-x').onclick=()=>$('ed').remove();
  /* «Ripristina calcolo automatico»: alla chiusura il tempo torna a essere ricavato dalle regole e dalle altre forme */
  $('ed').querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>{
    const fs=b.closest('fieldset');const on=fs.dataset.reset!=='1';
    fs.dataset.reset=on?'1':'';fs.classList.toggle('rst',on);
    b.textContent=on?'Verrà ricalcolato: annulla':'Ripristina calcolo automatico';
  });
  /* dalla 1ª persona singolare alle altre cinque dello stesso tempo */
  $('ed').addEventListener('change',ev=>{
    const t=ev.target;
    if(!t.matches||!t.matches('input[data-i="0"]')||!['pres','impf','aor','subj'].includes(t.dataset.f))return;
    const inps=[...$('ed').querySelectorAll(`input[data-f="${t.dataset.f}"]`)].sort((a,b)=>+a.dataset.i-+b.dataset.i);
    if(inps.length<6)return;
    const res=cascadeForms(inps.map(x=>x.dataset.o),t.value);
    if(!res){toast('Non riesco a ricalcolare le altre persone: correggile a mano');return;}
    inps.slice(1).forEach((x,k)=>{
      if(x.value!==x.dataset.o&&!x.dataset.casc)return;   /* già corretta a mano */
      x.value=res[k+1];x.dataset.casc='1';
    });
  });
  $('ed-s').onclick=async()=>{
    const ne=hydrate({...e,O:e.O});
    ne.O=JSON.parse(JSON.stringify(e.O||{}));
    const groups={};
    $('ed').querySelectorAll('input[data-f]').forEach(inp=>{
      (groups[inp.dataset.f]??=[])[+inp.dataset.i]=[inp.value.trim(),inp.dataset.o];
    });
    const rst=new Set([...$('ed').querySelectorAll('fieldset[data-reset="1"]')].map(x=>x.dataset.f));
    for(const f of rst){const k=overrideKey(e,v.id,f);if(k)delete ne.O[k];}
    for(const [f,arr] of Object.entries(groups)){
      if(rst.has(f))continue;
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
/* pop-up in stile iOS: nascono dal punto del tocco, chiusura breve */
const ovlGone=x=>{x.classList.remove('closing');if(x.id==='gl')x.remove();else x.hidden=true;};
const ovlClose=instant=>document.querySelectorAll('.ovl').forEach(x=>{
  if(x.hidden||x.classList.contains('closing'))return;
  if(instant===true){ovlGone(x);return;}
  x.classList.add('closing');setTimeout(()=>ovlGone(x),190);
});
function ovlOrigin(o,src){
  const p=o.querySelector('.pop');if(!p)return;
  if(!src||!src.getBoundingClientRect){p.style.transformOrigin='50% 0';return;}
  const s=src.getBoundingClientRect();
  p.style.transformOrigin=`${Math.round(s.left+s.width/2-p.offsetLeft)}px ${Math.round(s.top+s.height/2-p.offsetTop)}px`;
}
const openOvl=(id,src)=>{ovlClose(true);const o=$(id);o.hidden=false;ovlOrigin(o,src);};
function openManual(lemma,src){
  openOvl('ov-manual',src);
  if(lemma){$('m-l').value=lemma;$('m-l').dispatchEvent(new Event('input',{bubbles:true}));}
}
(function(){
  const mb=$('set-btn'),mn=$('set-menu');if(!mb)return;
  const menu=(open,instant)=>{
    mb.setAttribute('aria-expanded',open?'true':'false');
    if(open){mn.classList.remove('closing');mn.hidden=false;return;}
    if(mn.hidden)return;
    if(instant){mn.classList.remove('closing');mn.hidden=true;return;}
    mn.classList.add('closing');
    setTimeout(()=>{mn.classList.remove('closing');if(mb.getAttribute('aria-expanded')!=='true')mn.hidden=true;},190);
  };
  const open=(id,src)=>{menu(false);ovlClose(true);const o=$(id);o.hidden=false;ovlOrigin(o,src);};
  mb.onclick=ev=>{ev.stopPropagation();menu(mb.getAttribute('aria-expanded')!=='true');};
  $('info-btn').onclick=()=>open('info',$('info-btn'));
  mn.querySelectorAll('[data-ovl]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.ovl,b)));
  mn.addEventListener('click',ev=>{if(ev.target.closest('button')&&!ev.target.closest('[data-ovl]'))menu(false);});
  $('imp').addEventListener('change',()=>menu(false));
  document.addEventListener('click',ev=>{if(!mn.hidden&&!mn.contains(ev.target))menu(false);});
  document.querySelectorAll('.ovl').forEach(o=>{
    o.addEventListener('click',ev=>{if(ev.target===o||ev.target.closest('[data-close]'))ovlClose();});
  });
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ovlClose();menu(false);}});
})();

/* ---------- pop-up: correggi traduzione ---------- */
function openGloss(e,src){
  closeGloss(true);
  const pv=show.voice==='pass'&&e._voices&&e._voices.length>1&&e._voices.find(x=>x.id==='pass');
  const pl=pv&&pv.raw&&pv.raw.pres&&pv.raw.pres[0];
  const gv=pl?(e.gloss_p||e.gloss):e.gloss;
  const d=document.createElement('div');d.className='ovl';d.id='gl';
  d.innerHTML=`<div class="pop" role="dialog" aria-modal="true" aria-labelledby="gl-t"><h3 id="gl-t">Traduzione di <span lang="el">${esc(pl||e.lemma)}</span>${pl?' (voce passiva)':''}</h3>${!pl&&glossIsEn(e)?'<p class="mute">Il significato è ancora in inglese: scrivilo in italiano.</p>':''}<input id="gl-i" value="${esc(gv)}" placeholder="es. votare" autocomplete="off"><div class="row wrapbtn"><button type="button" class="btn pri" id="gl-s">Salva</button><button type="button" class="btn" id="gl-x">Chiudi</button></div></div>`;
  document.body.appendChild(d);ovlOrigin(d,src);
  d.onclick=ev=>{if(ev.target===d)closeGloss();};
  $('gl-x').onclick=closeGloss;
  $('gl-s').onclick=async()=>{
    const g=$('gl-i').value.trim();
    const ne=hydrate({...e,O:e.O});ne.O=JSON.parse(JSON.stringify(e.O||{}));if(pl){if(g)ne.gloss_p=g;else delete ne.gloss_p;}else ne.gloss=g;
    if(!ne.source||ne.source==='base'||ne.source==='extra')ne.source=e.source||'manual';
    const saved=await saveUser(ne,{edited:true});
    closeGloss();toast('Traduzione salvata');
    show(BYID.get(keyOf(saved.forms[0])),show.voice);
  };
  setTimeout(()=>{const i=$('gl-i');i&&i.focus();i&&i.select();},30);
}
function closeGloss(instant){const d=$('gl');if(!d)return;if(instant===true){d.remove();return;}ovlClose();}

/* ---------- archivio ---------- */
let onlyChk=false;
function renderArchive(){
  const k=keyOf($('afilter').value||'');
  const nChk=LIST.filter(e=>marks.count(keyOf(e.forms[0]))>0).length;
  $('achk-n').textContent=nChk?' · '+nChk:'';$('achk').classList.toggle('on',onlyChk);$('achk').setAttribute('aria-pressed',onlyChk);
  const rows=LIST.filter(e=>(!k||e.keys.some(f=>keyOf(f).startsWith(k))||keyOf(e.gloss).split(/[^\p{L}]+/u).some(w=>w.startsWith(k)))&&(!onlyChk||marks.count(keyOf(e.forms[0]))>0));
  const shown=rows.slice(0,300);
  $('alist').innerHTML=shown.map((e,i)=>`<div class="sw" data-i="${i}">${e._origin==='user'?'<button type="button" class="sw-del">Elimina</button>':''}<div class="item" data-l="${esc(e.lemma)}"><span><b lang="el">${esc(e.display)}</b><em>${esc(e.gloss)}</em>${glossIsEn(e)?EN_TAG:''}</span><span class="rt"><span class="badge ${e._origin==='user'?'user':''}">${esc(e._origin==='user'?(e.edited?'corretto':SRC[e.source]||'mio'):SRC[e._origin])}</span><button type="button" class="dotbtn${marks.count(keyOf(e.forms[0]))?' on':''}" aria-label="Controllo del verbo" aria-haspopup="true"><i></i></button></span></div></div>`).join('')+(rows.length>300?`<p class="mute">Mostrati i primi 300 di ${rows.length}: affina il filtro.</p>`:'');
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
    const db=it.querySelector('.dotbtn');
    db.addEventListener('pointerdown',ev=>ev.stopPropagation());
    db.onclick=ev=>{
      ev.stopPropagation();
      const id=keyOf(e.forms[0]),n=marks.count(id);
      chkMenu(db,[
        {label:'Segna tutto da controllare',check:false,run:()=>{marks.setMany(id,allMarkKeys(e),true);renderArchive();}},
        {label:'Segna tutto controllato',check:n===0,run:()=>{marks.clearEntry(id);renderArchive();}}
      ]);
    };
    it.onclick=()=>{
      if(moved){moved=false;return;}
      if(sw.classList.contains('open')){sw.classList.remove('open','drag');set(0,true);return;}
      go('cerca');$('q').value=it.dataset.l;search(it.dataset.l);window.scrollTo(0,0);
    };
  });
}
function download(name,text,type='application/json'){
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}

/* ---------- traduzioni da rivedere ---------- */
let TRPLAN=null;
const passLemmaOf=e=>{const v=(safeConj(e)||[]).find(x=>x.id==='pass');return v&&v.raw&&v.raw.pres?v.raw.pres[0]:'';};
const trRows=()=>buildRows(LIST,passLemmaOf);
function trReset(){
  TRPLAN=null;$('tr-sum').hidden=true;$('tr-go').disabled=true;$('tr-ta').value='';$('tr-ta').hidden=true;$('tr-file').value='';
}
function trRefresh(){
  const n=trRows().length;
  $('tr-n').innerHTML=n?`<b>${n} ${n===1?'verbo ha':'verbi hanno'}</b> la traduzione solo in inglese. Esporta l'elenco, scrivi la traduzione italiana nella terza colonna (e, se serve, nella quinta per la voce passiva), poi importa il file.`:'Nessun verbo ha la traduzione solo in inglese.';
  $('tr-dl').disabled=$('tr-copy').disabled=!n;
  trReset();
}
function trAnalyze(text){
  const plan=planImport(parseTable(text),l=>BYID.get(keyOf(l))||null,e=>(e._voices||(safeConj(e),e._voices||[])).some(v=>v.id==='pass'));
  TRPLAN=plan;
  const L=[];
  if(plan.badFormat)L.push('Non riconosco le colonne: servono almeno verbo, inglese e italiano.');
  else{
    L.push(plan.nIt+(plan.nIt===1?' traduzione italiana':' traduzioni italiane'));
    L.push(plan.nPass+(plan.nPass===1?' traduzione della voce passiva':' traduzioni della voce passiva'));
    if(plan.unchanged)L.push(plan.unchanged+(plan.unchanged===1?' riga già uguale':' righe già uguali')+', saltate');
    L.push(plan.empty+(plan.empty===1?' riga vuota':' righe vuote')+', '+(plan.empty===1?'saltata':'saltate'));
    if(plan.passIgnored)L.push(plan.passIgnored+' traduzioni passive ignorate (il verbo non ha la voce passiva)');
    if(plan.missing.length)L.push(plan.missing.length+(plan.missing.length===1?' verbo non trovato':' verbi non trovati')+' nell\'archivio: '+plan.missing.slice(0,5).map(x=>'<span lang="el">'+esc(x)+'</span>').join(', ')+(plan.missing.length>5?'…':''));
  }
  $('tr-sum-t').textContent=plan.changes.length?'Pronto da applicare':'Niente da applicare';
  $('tr-sum-l').innerHTML=L.join('<br>');
  $('tr-sum').hidden=false;$('tr-go').disabled=!plan.changes.length;
}
async function trApply(){
  if(!TRPLAN||!TRPLAN.changes.length)return;
  const ch=TRPLAN.changes;let n=0;
  $('tr-go').disabled=true;
  for(const c of ch){
    const ne=hydrate({...c.e,O:c.e.O});ne.O=JSON.parse(JSON.stringify(c.e.O||{}));
    if(c.gloss!==null)ne.gloss=c.gloss;
    if(c.gloss_p!==null)ne.gloss_p=c.gloss_p;
    if(!ne.source||ne.source==='base'||ne.source==='extra')ne.source=c.e.source||'manual';
    await saveUser(ne,{edited:true});n++;
  }
  ovlClose();renderArchive();trReset();
  toast(n+(n===1?' verbo aggiornato':' verbi aggiornati'));
}
function trInit(){
  const menuItem=document.querySelector('[data-ovl="ov-tr"]');
  menuItem.addEventListener('click',trRefresh);
  $('tr-dl').onclick=()=>{const r=trRows();if(r.length){download('traduzioni-da-rivedere.csv','\ufeff'+toCsv(r),'text/csv;charset=utf-8');toast('File scaricato');}};
  $('tr-copy').onclick=async()=>{
    const r=trRows(),t=toTsv(r);
    try{await navigator.clipboard.writeText(t);toast('Elenco copiato ('+r.length+' verbi)');}
    catch(_){$('tr-ta').hidden=false;$('tr-ta').value=t;$('tr-ta').select();toast('Seleziona e copia');}
  };
  $('tr-file').onchange=async()=>{
    const f=$('tr-file').files[0];if(!f)return;
    const t=await f.text();
    if(t.includes('\ufffd'))toast('Il file non è in UTF-8: salvalo come CSV UTF-8');
    trAnalyze(t);
  };
  $('tr-paste').onclick=()=>{const a=$('tr-ta');a.hidden=!a.hidden;if(!a.hidden)a.focus();};
  $('tr-ta').addEventListener('input',()=>{if($('tr-ta').value.trim())trAnalyze($('tr-ta').value);});
  $('tr-go').onclick=trApply;
}

/* ---------- importazione da Wiktionary ---------- */
function reportHtml(r){
  if(!r)return '';
  if(r.addPass)return `<p class="warn">La voce passiva è calcolata con le regole a partire da «${esc(r.addPass.form)}»: controllala, soprattutto l'aoristo passivo (nei verbi irregolari può essere diverso). Il significato e la voce attiva restano quelli del verbo. Salvando, la modifica va nel tuo archivio.</p>`;
  if(r.derived)return `<p class="warn">Wiktionary non ha la tabella di questo verbo. Le forme sono ottenute da «${esc(r.derived.from)}» aggiungendo «${esc(r.derived.prefix)}-» a ogni forma (nelle forme di una sola sillaba l'accento è aggiunto): controllale.${r.derived.extra&&r.derived.extra.length?' Alla prima persona dell\'aoristo ho aggiunto '+r.derived.extra.map(esc).join(', ')+', scritta nella riga del verbo su Wiktionary.':''}${r.derived.noPass?' Le forme passive del verbo base non sono nell\'archivio, quindi mancano anche qui.':''}</p>`;
  if(r.noTable)return `<p class="warn">Wiktionary non ha la tabella di coniugazione per questo verbo. Le forme sono calcolate con le regole${r.notes&&r.notes.length?' ('+esc(r.notes.join('; '))+')':''}: controllale e correggile se serve.</p>`;
  const miss=(r.missing||[]);
  const rd=r.redirect?`<p class="ok">«${esc(r.redirect.from)}» rimanda a «${esc(r.redirect.to)}»: ecco la coniugazione di ${esc(r.redirect.to)}.</p>`:'';
  const rep=rd+((r.repairs&&r.repairs.length)?`<p class="warn">Forme corrette per caratteri non greci (controllale): ${esc(r.repairs.join('; '))}</p>`:'');
  const elN=r.el?'<p class="warn">Tabella letta dalla Wiktionary greca: la traduzione è quella inglese, sostituiscila con l\'italiano. L\'aoristo ha il pallino «da controllare».</p>':'';
  return rep+elN+(miss.length?`<p class="warn">Dati non trovati nella tabella (verranno calcolati con le regole): ${esc(miss.join(', '))}</p>`:'<p class="ok">Tabella letta completamente.</p>');
}
function rescue(el,verb){
  const v=(verb||'').trim();
  return `<div class="row wrapbtn resc"><button type="button" class="btn" data-r="man">Aggiungi a mano</button><button type="button" class="btn" data-r="paste">Incolla tabella</button></div>`;
}
function wireRescue(el,verb){
  const v=(verb||'').trim();
  el.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{
    if(b.dataset.r==='man')openManual(v,b);
    else{openOvl('ov-paste',b);$('pt').value=v;}
  });
}
function failBox(el,err,intro,verb){
  const d=err.diag?`<details class="box"><summary>Dettagli tecnici (da inviare a Claude)</summary><textarea id="diag" rows="8" class="full" readonly>${esc(err.diag)}</textarea><button type="button" class="btn" id="diagcopy">Copia</button></details>`:'';
  el.innerHTML=`<p class="warn">${esc(intro)}: ${esc(err.message)}.</p>${d}`+(verb!==undefined?rescue(el,verb):'');
  if(verb!==undefined)wireRescue(el,verb);
  const b=$('diagcopy');if(b)b.onclick=async()=>{try{await navigator.clipboard.writeText(err.diag);toast('Copiato');}catch(_){$('diag').select();toast('Seleziona e copia');}};
}
function showPreview(el,entry,report){
  entry._origin='preview';
  const gl=esc(entry.gloss||'');
  el.innerHTML='<div class="box pvbox fix"><div class="pvhead">'+(report&&report.addPass?'Anteprima della voce passiva di '+esc(report.addPass.lemma)+' · non ancora salvata':report&&report.derived?'Anteprima ricavata da '+esc(report.derived.from)+' · non ancora salvata':'Anteprima da Wiktionary · non ancora salvato')+'</div><label class="pvg">Significato in italiano'+(glossIsEn(entry)?' <em>(in inglese: sostituiscilo con la traduzione)</em>':'')+'<input class="pv-g" value="'+gl+'" placeholder="es. votare"></label><div class="row wrapbtn"><button type="button" class="btn pri pv-s">Salva nell\'archivio</button><button type="button" class="btn pv-x">Scarta</button></div></div>'+reportHtml(report)+'<div class="pv-card"></div>';
  const q=sel=>el.querySelector(sel);
  renderEntry(q('.pv-card'),entry,report&&report.addPass?'pass':'act');
  q('.pv-x').onclick=()=>{el.innerHTML='';};
  q('.pv-s').onclick=async()=>{
    const g=q('.pv-g').value.trim();
    if(g)entry.gloss=g;
    const sv=await saveUser(entry,{});autoMark(sv,report);const inSearch=el===$('out');el.innerHTML='';$('pt').value='';$('pp').value='';toast('Salvato: '+entry.lemma);if(inSearch){const h=INDEX.get(keyOf(sv.forms[0]));if(h)show(h.e,report&&report.addPass?'pass':'act');}
  };
}
$('pgo').onclick=()=>{
  const t=$('pt').value.trim(),p=$('pp').value;
  if(!t||!p.trim()){toast('Serve il verbo e la tabella incollata');return;}
  try{const {entry,report}=parsePastedText(p,t);ovlClose();go('cerca');$('q').value=entry.lemma||t;$('sugg').innerHTML='';showPreview($('out'),entry,report);window.scrollTo(0,0);}
  catch(err){ovlClose();go('cerca');failBox($('out'),err,'Tabella non letta',t);}
};
const PROB=[];
let stopBulk=false,bulkCont=null;
const BK='vg-bulk';
const bulkState=()=>{try{return JSON.parse(localStorage.getItem(BK)||'{}')||{};}catch(_){return {};}};
const bulkStore=o=>{try{localStorage.setItem(BK,JSON.stringify(o));}catch(_){}};
function bulkMarks(){
  const st=bulkState();
  [...$('bletter').options].forEach(o=>{const l=o.dataset.l||(o.dataset.l=o.value);if(!l)return;const x=st[l];o.textContent=l+(x?(x.complete?' ✓':' …'):'');});
  const L=$('bletter').value,x=st[L];
  $('binfo').hidden=!L;
  const np=x&&x.problems?x.problems.length:0;
  $('bmodewrap').hidden=!(L&&np);$('bmode').options[1].textContent='Solo gli scartati ('+np+')';if(!(L&&np))$('bmode').value='all';
  $('binfo').textContent=!L?'':x?(x.complete?'Completata':'Iniziata, non completata')+' il '+x.date+' · salvati '+x.saved+' · saltati con problemi '+(x.problems||[]).length:'Lettera non ancora importata.';
}
/* più lettere: rilegge gli scartati di ogni lettera selezionata, una dopo l'altra */
const bmSel=new Set();let bmSeen=false;
function bmRender(){
  const st=bulkState();
  const ls=Object.keys(st).filter(l=>(st[l].problems||[]).length).sort((a,b)=>a.localeCompare(b,'el'));
  $('bmulti').hidden=!ls.length;
  if(!bmSeen&&ls.length){ls.forEach(l=>bmSel.add(l));bmSeen=true;}
  $('bm-list').innerHTML=ls.map(l=>`<div class="rlrow"><label><input type="checkbox" data-l="${l}"${bmSel.has(l)?' checked':''}><span><b lang="el">${l}</b> <em>${st[l].problems.length} scartati</em></span></label></div>`).join('');
  bmCount(ls);
}
function bmCount(ls){
  const st=bulkState();ls=ls||Object.keys(st).filter(l=>(st[l].problems||[]).length);
  const n=ls.filter(l=>bmSel.has(l)).length,tot=ls.filter(l=>bmSel.has(l)).reduce((a,l)=>a+st[l].problems.length,0);
  $('bm-go').disabled=!n||$('bulkstop').disabled===false;
  $('bm-go').textContent='Avvia selezionate';$('bm-count').textContent=n?n+(n===1?' lettera, ':' lettere, ')+tot+(tot===1?' verbo':' verbi'):'Nessuna lettera selezionata';
}
$('bm-list').addEventListener('change',ev=>{const c=ev.target;if(!c.dataset||!c.dataset.l)return;c.checked?bmSel.add(c.dataset.l):bmSel.delete(c.dataset.l);bmCount();});
$('bm-all').onclick=()=>{$('bm-list').querySelectorAll('input').forEach(c=>{c.checked=true;bmSel.add(c.dataset.l);});bmCount();};
$('bm-none').onclick=()=>{$('bm-list').querySelectorAll('input').forEach(c=>{c.checked=false;bmSel.delete(c.dataset.l);});bmCount();};
$('bm-go').onclick=async()=>{
  const st0=bulkState();
  const letters=Object.keys(st0).filter(l=>bmSel.has(l)&&(st0[l].problems||[]).length).sort((a,b)=>a.localeCompare(b,'el'));
  if(!letters.length)return;
  let n=0,tot=0;stopBulk=false;$('bmulti').open=false;
  for(const l of letters){
    n++;
    const x=bulkState()[l];if(!x||!(x.problems||[]).length)continue;
    $('bletter').value=l;bulkCont=null;PROB.length=0;PROB.push(...x.problems);bulkProblems();bulkMarks();$('bmode').value='skip';
    $('bm-log').textContent='Lettera '+l+' ('+n+' di '+letters.length+')…';
    await runBulk(true);
    if(stopBulk)break;
  }
  $('bulk').disabled=false;$('bulkstop').disabled=true;
  $('bm-log').textContent=(stopBulk?'Interrotto alla lettera ':'Finito. Ultima lettera: ')+$('bletter').value+' · restano scartati: '+Object.values(bulkState()).reduce((a,y)=>a+(y.problems||[]).length,0);
  bmRender();
};
$('bletter').onchange=()=>{bulkCont=null;const x=bulkState()[$('bletter').value];PROB.length=0;if(x)PROB.push(...(x.problems||[]));bulkProblems();bulkMarks();};
setTimeout(()=>{bulkMarks();bmRender();},0);
let ALT=0,DER=0,EL=0,PASSN=0,bulkPend=[],bulkNeed=[],bulkSeen=new Set(),bulkAlt=new Map();
const bulkLog=(done,skipped,t)=>{$('blog').textContent=`Importati ${done} · già presenti ${skipped} · passive aggiunte ${PASSN} · da Wiktionary greca ${EL} · in attesa ${bulkPend.length} · forme alternative ${ALT} · derivati ${DER} · saltati con problemi ${PROB.length}`+(t?` — ultimo: ${t}`:'');};
function bulkProblems(){
  $('bprob').hidden=!PROB.length;
  $('bprob-list').textContent=PROB.map(p=>p.t+' — '+p.why).join('\n');
  const n=rulesEligible().filter(p=>isPassTitle(p.t)||RULES_END.test(p.t)||splitAna(p.t).some(c=>INDEX.has(keyOf(c.rest)))).length;$('brules').hidden=!n;$('brules').textContent='Importa con le regole ('+n+')';
}
/* forma passiva trovata (χορεύομαι): la aggiungo al verbo attivo che è già nell'archivio. 'defer' = l'attivo non c'è ancora, riprovo alla fine */
async function bulkPassive(t,final){
  for(const c of activeCandidates(t)){
    const h=INDEX.get(keyOf(c));if(!h)continue;
    if(!lacksPassive(h.e))return 'have';
    const pre=(await passiveSource(t))||{kind:'rules'};
    return (await attachPassive(h.e,t,pre))?'done':'none';
  }
  return final?'none':'defer';
}
async function runBulk(multi){
  stopBulk=false;$('bulk').disabled=true;$('bm-go').disabled=true;$('bulkstop').disabled=false;$('bprog').hidden=false;
  let done=0,skipped=0;const L0=$('bletter').value;
  /* «solo gli scartati»: rileggo soltanto i verbi dell'elenco, senza scorrere tutta la categoria */
  let snap=null;const why0=new Map(),doneSet=new Set();
  if(L0&&$('bmode').value==='skip'&&!bulkCont&&PROB.length){snap=PROB.map(p=>p.t);PROB.forEach(p=>why0.set(p.t,p.why));}
  if(!bulkCont){PROB.length=0;ALT=0;DER=0;PASSN=0;EL=0;bulkPend=[];bulkNeed=[];bulkSeen=new Set();bulkAlt=new Map();}bulkProblems();
  /* un verbo: restituisce 'q' se non ha usato la rete */
  const one=async(t,final)=>{
    if(!final)bulkSeen.add(keyOf(t));
    if(BYID.has(keyOf(t))||INDEX.has(keyOf(t))){skipped++;return 'q';}
    if(isPassTitle(t)){
      const r=await bulkPassive(t,final);
      if(r==='done'){PASSN++;return;}
      if(r==='have'){skipped++;return 'q';}
      if(r==='defer'){bulkPend.push(t);return 'q';}
      /* il verbo attivo era una forma alternativa di un verbo già in archivio (στεναχωρώ → στενοχωρώ): anche questo passivo è una forma alternativa */
      if(final){
        const ca=activeCandidates(t).find(c=>bulkAlt.has(keyOf(c)));
        const X=ca&&bulkAlt.get(keyOf(ca));
        if(X&&(BYID.has(keyOf(X))||INDEX.has(keyOf(X)))){ALT++;return 'q';}
      }
      if(final&&activeCandidates(t).some(c=>bulkSeen.has(keyOf(c)))){PROB.push({t,why:'verbo attivo non in archivio: importalo e usa «Cerca le voci passive mancanti»'});bulkProblems();return 'q';}
    }
    try{
      /* in blocco nessuno controlla le forme: si salvano solo verbi con la tabella letta per intero */
      let fv=null,ferr=null;
      try{fv=await fetchVerbFull(t);}catch(err){ferr=err;}
      if(fv&&fv.report.redirect){ALT++;bulkAlt.set(keyOf(t),fv.report.redirect.to);return;}
      if(!fv||fv.entry.fromHeadword){
        const dv=await tryDerive(t,fv&&fv.entry,false);
        if(dv){
          if(BYID.has(keyOf(dv.entry.forms[0]))){skipped++;}
          else{const sv=await saveUser(dv.entry,{});autoMark(sv,dv.report);DER++;if(lacksPassive(sv))bulkNeed.push(keyOf(sv.forms[0]));}
          return;
        }
        if(ferr)throw ferr;
      }
      const {entry,report}=fv;
      const why=entry.fromHeadword?'pagina senza tabella di coniugazione'
        :(report.missing&&report.missing.length)?'tabella incompleta ('+report.missing.join(', ')+')'
        :(report.repairs&&report.repairs.length)?'forme con caratteri non greci ('+report.repairs.join('; ')+')':'';
      if(why){PROB.push({t,why});bulkProblems();}
      else{const sv=await saveUser(entry,{});autoMark(sv,report);done++;if(report.el)EL++;if(lacksPassive(sv))bulkNeed.push(keyOf(sv.forms[0]));}
    }catch(err){PROB.push({t,why:'non letta: '+(err&&err.message||'errore')});bulkProblems();}
  };
  try{
    do{
      const L=$('bletter').value;
      let {titles,next}=snap?{titles:snap.slice(),next:null}:await listVerbs(bulkCont);
      bulkCont=next;
      if(L)titles=titles.filter(t=>keyOf(t).startsWith(L));
      /* le forme passive (-μαι) per ultime: così, se il verbo attivo viene importato in questa stessa pagina, la sua voce passiva trova già l'attivo */
      titles=[...titles.filter(t=>!isPassTitle(t)),...titles.filter(t=>isPassTitle(t))];
      $('bprog').max=Math.max(titles.length,1);
      let i=0;
      for(const t of titles){
        if(stopBulk)break;
        i++;$('bprog').value=i;
        const q=await one(t,false);doneSet.add(t);
        bulkLog(done,skipped,t);
        if(q!=='q')await sleep(150);
      }
    }while(bulkCont&&!stopBulk);
    if(!bulkCont&&!stopBulk){
      /* passata finale: passive rimaste in attesa e verbi senza voce passiva (cerco la loro forma in -ομαι su Wiktionary) */
      $('bprog').max=Math.max(bulkPend.length+bulkNeed.length,1);$('bprog').value=0;let j=0;
      while(bulkPend.length&&!stopBulk){const t=bulkPend.shift();$('bprog').value=++j;const q=await one(t,true);bulkLog(done,skipped,t);if(q!=='q')await sleep(150);}
      while(bulkNeed.length&&!stopBulk){
        const k=bulkNeed.shift();$('bprog').value=++j;
        const e=BYID.get(k);if(!e||!lacksPassive(e))continue;
        if(passiveCandidates(e.forms[0],e.cls).some(p=>bulkSeen.has(keyOf(p))))continue;   // la sua forma passiva è già passata dall'elenco
        const r=await lookupPassive(e);
        if(r&&await attachPassive(e,r.pform,r.pre))PASSN++;
        bulkLog(done,skipped,e.lemma);
      }
    }
  }catch(err){$('blog').textContent='Interrotto: '+err.message;}
  if(!multi){$('bulk').disabled=false;$('bulkstop').disabled=true;bmRender();}
  /* se la ricerca degli scartati è stata fermata, quelli non ancora riletti restano nell'elenco */
  if(snap){snap.filter(t=>!doneSet.has(t)||bulkPend.includes(t)).forEach(t=>PROB.push({t,why:why0.get(t)||'non riletto'}));bulkProblems();}
  if(L0){const st=bulkState(),old=st[L0]||{saved:0};st[L0]={complete:snap?!!old.complete:!bulkCont&&!stopBulk,saved:(old.saved||0)+done,problems:PROB.map(p=>({...p})),date:new Date().toLocaleDateString('it-IT')};bulkStore(st);bulkMarks();}
  bulkLog(done,skipped);
  $('blog').textContent+=bulkCont?' (ripresa possibile)':(bulkPend.length||bulkNeed.length)?' (passate finali interrotte)':' — fine elenco';
  renderArchive&&renderArchive();
}
$('bulk').onclick=()=>runBulk(false);
/* campione di verbi saltati: per ogni tipo di problema, uno non in -ομαι e uno in -ομαι (o i primi due) */
function bulkSample(){
  const by={};
  PROB.forEach(p=>{const k=p.why.split(' (')[0].replace(/:.*/,'');(by[k]=by[k]||[]).push(p);});
  const out=[];
  Object.values(by).forEach(list=>{
    const pass=list.find(p=>/(ομαι)$/.test(p.t)),act=list.find(p=>!/(ομαι)$/.test(p.t));
    const pick=[act,pass].filter(Boolean);
    if(pick.length<2)list.forEach(p=>{if(pick.length<2&&!pick.includes(p))pick.push(p);});
    out.push(...pick);
  });
  return out.slice(0,6);
}
$('bdiag').onclick=async()=>{
  const s=bulkSample();if(!s.length)return;
  $('bdiag').disabled=true;$('bdiag').textContent='Scarico…';
  const parts=[];
  for(const p of s){try{parts.push('=== '+p.t+' — '+p.why+'\n'+await fetchDiag(p.t));}catch(err){parts.push('=== '+p.t+' — dettagli non scaricati: '+err.message);}await new Promise(r=>setTimeout(r,150));}
  const t=parts.join('\n\n');
  try{await navigator.clipboard.writeText(t);toast('Dettagli copiati ('+s.length+' verbi)');}catch(_){$('bprob-list').textContent=t;toast('Seleziona e copia');}
  $('bdiag').disabled=false;$('bdiag').textContent='Copia dettagli di alcuni verbi';
};
$('bd1go').onclick=async()=>{
  const t=$('bd1').value.trim();if(!t)return;
  const b=$('bd1go');b.disabled=true;b.textContent='Scarico…';
  let out;
  try{out='=== '+t+' — richiesta manuale\n'+await fetchDiag(t);}catch(err){out='=== '+t+' — dettagli non scaricati: '+err.message;}
  try{await navigator.clipboard.writeText(out);toast('Dettagli copiati');}catch(_){$('bprob').hidden=false;$('bprob-list').textContent=out;toast('Seleziona e copia');}
  b.disabled=false;b.textContent='Copia dettagli';
};
$('bcopy').onclick=async()=>{const t=PROB.map(p=>p.t+'\t'+String(p.why).replace(/[\t\r\n]+/g,' ')).join('\n');try{await navigator.clipboard.writeText(t);toast('Elenco copiato');}catch(_){const r=document.createRange();r.selectNodeContents($('bprob-list'));const s2=getSelection();s2.removeAllRanges();s2.addRange(r);toast('Seleziona e copia');}};
$('bulkstop').onclick=()=>{stopBulk=true;};

/* ---------- importa con le regole (verbi regolari senza tabella) ---------- */
const RULES_END=/(ίζω|ώνω|εύω|άζω|σσω|ττω|ποιώ)$/;
/* deponente = titolo in -μαι il cui verbo attivo non è né in archivio né tra gli scartati */
function isDeponent(t){
  if(!isPassTitle(t))return false;
  const acts=activeCandidates(t);
  if(!acts.length)return false;
  const listed=new Set(PROB.map(p=>keyOf(p.t)));
  return !acts.some(a=>INDEX.has(keyOf(a))||listed.has(keyOf(a)));
}
const DEP_REG=/(ίζομαι|άζομαι|εύομαι|ώνομαι|[^ούιέά]ομαι)$/;
function rulesEligible(){return PROB.filter(p=>/^pagina senza tabella/.test(p.why)&&!INDEX.has(keyOf(p.t))&&(isPassTitle(p.t)?isDeponent(p.t):(RULES_END.test(p.t)||splitAna(p.t).length)));}
const aorOf=(e,voice)=>{try{const v=conjugate(e).find(x=>x.id===voice);const c=v&&[].concat(...Object.values(v.cards)).find(x=>x.id==='aor');return c&&c.forms?c.forms[0]:'';}catch(_){return '';}};
let rlRows=[],rlBusy=false;
/* possibili prefissi: l'aumento dell'aoristo è da controllare, quindi non preselezionati */
const RL_PREF=/^(ανα|ανε|αντι|απα|απε|απο|αφα|κατα|παρα|μετα|επι|υπο)/;
async function rlOpen(){
  openOvl('ov-rl',$('brules'));
  if(rlBusy)return;rlBusy=true;
  const todo=rulesEligible().map(p=>p.t),listed=new Set(PROB.map(p=>keyOf(p.t)));
  rlRows=[];const rlSkip=[];$('rl-skip').textContent='';$('rl-list').innerHTML='';$('rl-go').disabled=true;$('rl-log').textContent='';$('rl-prog').hidden=false;$('rl-prog').max=Math.max(todo.length,1);
  let i=0;
  for(const t of todo){
    $('rl-prog').value=++i;$('rl-log').textContent='Leggo '+t+'…';
    try{
      const fv=await fetchVerb(t);
      if(!fv.entry.fromHeadword)throw new Error('ora la pagina ha una tabella: importala dalla ricerca');
      /* con prefisso ανα-: prima provo a ricavarlo dal verbo semplice (calco) */
      const dep=isPassTitle(t);
      const dv=!dep&&splitAna(t).length?await tryDerive(t,fv.entry,true):null;
      if(!dep&&!dv&&!RULES_END.test(t)){rlSkip.push(t);continue;}
      const r=dv?{entry:dv.entry}:fromHeadword(fv.entry);
      const ent=finalizeEntry(r.entry);
      const pf=dep?null:passiveCandidates(t,ent.cls)[0];
      /* le regole danno di norma anche la passiva: preparo le due varianti, con e senza */
      const withP=hasPassive(ent)?ent:(pf?withPassive(ent,pf):null);
      const noP=withP?withoutPassive(withP):ent;
      /* la passiva è preselezionata se la sua forma compare nell'elenco di Wiktionary (cioè esiste una pagina in -ομαι) */
      const pre=!!withP&&passiveCandidates(t,ent.cls).some(x=>listed.has(keyOf(x)));
      rlRows.push({t,withP,noP,pre,dep,depcls:dep&&!DEP_REG.test(t),calc:dv?dv.report.derived.from:'',pref:!dv&&!dep&&RL_PREF.test(t),sel:dep?DEP_REG.test(t):!(!dv&&RL_PREF.test(t)),psel:pre,aor:aorOf(noP,dep?'pass':'act'),paor:withP?aorOf(withP,'pass'):'',disp:noP.display,gloss:noP.gloss,cls:noP.cls});
    }catch(err){rlRows.push({t,err:err&&err.message||'errore'});}
    renderRl();await sleep(150);
  }
  $('rl-prog').hidden=true;$('rl-log').textContent=rlRows.filter(x=>x.noP).length+' verbi pronti';
  if(rlSkip.length)$('rl-skip').textContent=rlSkip.length+' non preparati (verbo senza prefisso non trovato, da fare a mano): '+rlSkip.join(', ');
  rlBusy=false;renderRl();
}
function renderRl(){
  $('rl-list').innerHTML=rlRows.map((r,i)=>r.err
    ?`<div class="rlrow bad"><span><b lang="el">${esc(r.t)}</b><em>non preparato: ${esc(r.err)}</em></span></div>`
    :`<div class="rlrow"><label><input type="checkbox" data-i="${i}" data-k="v"${r.sel?' checked':''}><span><b lang="el">${esc(r.disp)}</b> ${esc(r.gloss||'')}<em>aoristo <span lang="el">${esc(r.aor)}</span> · ${esc(CLASS_DESC[r.cls]||r.cls)}${r.calc?' · <span class="rlcalc">calco di <span lang="el">'+esc(r.calc)+'</span></span>':''}${r.dep?' · <span class="rlcalc">deponente</span>':''}${r.depcls?' · <span class="rlpref">classe da controllare</span>':''}${r.pref?' · <span class="rlpref">prefisso: controlla l\'aoristo</span>':''}</em></span></label>${r.withP?`<label class="rlps"><input type="checkbox" data-i="${i}" data-k="p"${r.psel?' checked':''}><span>con voce passiva <span lang="el">${esc(r.paor)}</span></span></label>`:''}</div>`).join('');
  rlCount();
}
function rlCount(){
  const n=rlRows.filter(r=>r.noP&&r.sel).length;
  $('rl-go').disabled=rlBusy||!n;
  $('rl-go').textContent=n?'Salva le selezionate ('+n+')':'Salva le selezionate';
}
$('rl-list').addEventListener('change',ev=>{
  const c=ev.target;if(!c.dataset||c.dataset.i===undefined)return;
  const r=rlRows[+c.dataset.i];if(!r)return;
  if(c.dataset.k==='v')r.sel=c.checked;else r.psel=c.checked;
  rlCount();
});
$('rl-all').onclick=()=>{rlRows.forEach(r=>{if(r.noP)r.sel=true;});renderRl();};
$('rl-none').onclick=()=>{rlRows.forEach(r=>{if(r.noP)r.sel=false;});renderRl();};
async function rlSave(){
  let n=0,np=0;
  for(const [i,r] of rlRows.entries()){
    if(!r.noP)continue;
    if(!r.sel)continue;
    const ne=r.psel&&r.withP?r.withP:r.noP;
    if(BYID.has(keyOf(ne.forms[0])))continue;
    const sv=await saveUser(ne,{});autoMark(sv,{noTable:true});n++;if(ne===r.withP){np++;passiveCandidates(r.t,ne.cls).forEach(x=>{const j=PROB.findIndex(p=>p.t===x);if(j>=0)PROB.splice(j,1);});}
    const k=PROB.findIndex(p=>p.t===r.t);if(k>=0)PROB.splice(k,1);
  }
  const L=$('bletter').value,st=bulkState();if(L&&st[L]){st[L].problems=PROB.map(p=>({...p}));bulkStore(st);}
  bulkProblems();bulkMarks();renderArchive();
  openOvl('ov-bulk',$('brules'));
  toast(n+(n===1?' verbo salvato':' verbi salvati')+(np?' · '+np+' con voce passiva':''));
}
$('brules').onclick=rlOpen;
$('rl-go').onclick=rlSave;

/* ---------- cerca le voci passive mancanti ---------- */
let psFound=[],psStop=false,psBusy=false;
function psRefresh(){
  if(psBusy)return;
  const n=USER.filter(lacksPassive).length;
  $('ps-n').textContent=n?n+(n===1?' verbo del tuo archivio non ha':' verbi del tuo archivio non hanno')+' la voce passiva. Cerco su Wiktionary se esiste la forma in -ομαι.':'Tutti i verbi del tuo archivio hanno già la voce passiva, o non la possono avere.';
  $('ps-go').disabled=!n;$('ps-add').disabled=true;$('ps-list').innerHTML='';$('ps-log').textContent='';psFound=[];
}
function renderPs(){
  $('ps-list').innerHTML=psFound.map((r,i)=>`<div class="rlrow"><label><input type="checkbox" data-i="${i}" checked><span><b lang="el">${esc(r.e.display)}</b> → <b lang="el">${esc(r.pform)}</b><em>${r.pre.kind==='table'?'tabella di Wiktionary':'calcolata con le regole · aoristo da controllare'}</em></span></label></div>`).join('');
  $('ps-add').disabled=psBusy||!psFound.length;
}
async function psRun(){
  psBusy=true;psStop=false;psFound=[];renderPs();
  $('ps-go').disabled=true;$('ps-stop').disabled=false;$('ps-prog').hidden=false;
  const todo=USER.filter(lacksPassive);$('ps-prog').max=Math.max(todo.length,1);
  let i=0;
  for(const e of todo){
    if(psStop)break;
    $('ps-prog').value=++i;$('ps-log').textContent=i+' / '+todo.length+' · '+e.lemma+' · trovate '+psFound.length;
    const r=await lookupPassive(e);
    if(r){psFound.push({e,...r});renderPs();}
  }
  psBusy=false;$('ps-stop').disabled=true;$('ps-prog').hidden=true;$('ps-go').disabled=false;
  $('ps-log').textContent=(psStop?'Fermata · ':'')+'Voci passive trovate: '+psFound.length+' su '+todo.length+' verbi controllati';
  renderPs();
}
async function psAdd(){
  let n=0;
  for(const [i,r] of psFound.entries()){
    const cb=$('ps-list').querySelector(`input[data-i="${i}"]`);if(!cb||!cb.checked)continue;
    const e=BYID.get(keyOf(r.e.forms[0]));if(!e||!lacksPassive(e))continue;
    if(await attachPassive(e,r.pform,r.pre))n++;
  }
  ovlClose();renderArchive();
  toast(n+(n===1?' voce passiva aggiunta':' voci passive aggiunte'));
}
function psInit(){
  document.querySelector('[data-ovl="ov-ps"]').addEventListener('click',psRefresh);
  $('ps-go').onclick=psRun;$('ps-stop').onclick=()=>{psStop=true;};$('ps-add').onclick=psAdd;
}


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
  ovlClose(true);
  const d=$('m-d').value.trim();
  if(d){try{const e=parseDslLine(d);
    $('adv-l').value=e.forms.join('/');$('adv-c').value=e.cls;$('adv-g').value=e.gloss;
    ['a','p',...ADV_X].forEach(k=>$('adv-'+k).value=e[k]||'');
    ADV_O.forEach(k=>$('adv-'+k).value=e.O[k]?e.O[k].map(x=>x.replace(/ \/ /g,'/')).join(','):'');}catch(_){}}
  else{$('adv-l').value=$('m-l').value;$('adv-c').value=$('m-c').value;$('adv-g').value=$('m-g').value;$('adv-a').value=$('m-a').value;$('adv-p').value=$('m-p').value;}
  $('adv-prev').innerHTML='';advRefresh();$('ov-adv').hidden=false;ovlOrigin($('ov-adv'),$('adv-open'));
};
$('adv-pv').onclick=()=>{
  try{const e=parseDslLine(advLine()||advEntry());e._origin='preview';renderEntry($('adv-prev'),e,'act');}
  catch(err){$('adv-prev').innerHTML=`<p class="warn">${esc(err.message)}</p>`;}
};
$('adv-ok').onclick=()=>{
  try{advEntry();}catch(err){$('adv-prev').innerHTML=`<p class="warn">${esc(err.message)}</p>`;return;}
  $('m-d').value=advLine();
  $('m-l').value=$('adv-l').value;$('m-c').value=$('adv-c').value;$('m-g').value=$('adv-g').value;
  $('adv-state').hidden=false;ovlClose();setTimeout(()=>openManual(),200);toast('Forma avanzata applicata');
};
$('ov-adv').addEventListener('click',ev=>{if(ev.target===$('ov-adv')||ev.target.closest('[data-close]'))setTimeout(()=>openManual(),200);});
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
    $('mprev').innerHTML='';$('mf').reset();$('adv-state').hidden=true;ovlClose();toast('Salvato: '+s.lemma);
    go('cerca');$('q').value=s.lemma;search(s.lemma);
  }catch(err){$('mprev').innerHTML=`<p class="warn">${esc(err.message)}</p>`;}
};

/* ---------- esporta / importa ---------- */
$('exp').onclick=()=>{
  const bk=bulkState(),ck=marks.toObject();
  if(!USER.length&&!Object.keys(bk).length&&!Object.keys(ck).length){toast('Non hai ancora dati tuoi da esportare');return;}
  const ex={};if(Object.keys(bk).length)ex.bulk=bk;if(Object.keys(ck).length)ex.chk=ck;
  download('extra.json',store.toJson(USER,Object.keys(ex).length?ex:null));
};
$('imp').onchange=async ev=>{
  const f=ev.target.files[0];if(!f)return;
  try{
    const txt=await f.text();
    const arr=store.fromJson(txt);
    for(const r of arr)await store.put(hydrate(r));
    const ib=store.bulkFromJson(txt);let nl=0;
    if(ib){const st=bulkState();for(const [l,x] of Object.entries(ib)){const o=st[l];if(!o||(x.complete&&!o.complete)){st[l]=x;nl++;}}bulkStore(st);bulkMarks();}
    const nc=marks.merge(marks.fromJson(txt));
    USER=(await store.getAll()).map(hydrate);rebuild();renderArchive();toast('Importati '+arr.length+' verbi'+(nl?' e lo stato di '+nl+' lettere':'')+(nc?' e '+nc+' segni da controllare':''));
  }catch(err){toast('File non valido: '+err.message);}
  ev.target.value='';
};
$('clr').onclick=async()=>{
  if(!confirm('Cancellare tutti i verbi importati, inseriti o corretti da te su questo dispositivo?'))return;
  await store.clearAll();marks.clearAll();USER=[];rebuild();renderArchive();$('out').innerHTML='';toast('Archivio personale svuotato');
};
$('afilter').oninput=renderArchive;
$('achk').onclick=()=>{onlyChk=!onlyChk;renderArchive();};

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
$('q').addEventListener('input',syncGo);
$('q-clear').addEventListener('click',()=>{shownQ='';syncGo();});
$('f').addEventListener('submit',ev=>{ev.preventDefault();search($('q').value);});
$('q').addEventListener('input',()=>suggest($('q').value));

initClearable();psInit();
trInit();
loadAll().then(()=>{window.__ready=true;});
if('serviceWorker' in navigator&&location.protocol!=='file:'){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

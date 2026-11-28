/* ================= Utilità greche ================= */
const AC={'ά':'α','έ':'ε','ή':'η','ί':'ι','ό':'ο','ύ':'υ','ώ':'ω','ΐ':'ϊ','ΰ':'ϋ'};
const TA={'α':'ά','ε':'έ','η':'ή','ι':'ί','ο':'ό','υ':'ύ','ω':'ώ','ϊ':'ΐ','ϋ':'ΰ'};
const VOW='αεηιουωϊϋ';
const isV=c=>c!==undefined&&c!==''&&VOW.includes(c);
const strip=s=>s.replace(/[άέήίόύώΐΰ]/g,c=>AC[c]);
const keyOf=s=>strip(s.toLowerCase().trim()).replace(/ς/g,'σ').replace(/[.\s]/g,'');
const DIPH=['αι','ει','οι','υι','ου','αυ','ευ','ηυ'];

/* nuclei sillabici di una parola SENZA accenti. '.' = confine forzato. */
function nuclei(w){
  const r=[];let i=0;
  while(i<w.length){
    const c=w[i];
    if(!isV(c)){i++;continue;}
    if(c==='ι'&&i>0&&!isV(w[i-1])&&isV(w[i+1])&&w[i+1]!=='ι'){
      const end=(w[i+1]==='ο'&&w[i+2]==='υ')?i+3:i+2;
      r.push([i,end]);i=end;continue;
    }
    if(DIPH.includes(w.substr(i,2))){r.push([i,i+2]);i+=2;continue;}
    r.push([i,i+1]);i++;
  }
  return r;
}
function accentNucleus(w,n){const p=n[1]-1;return w.slice(0,p)+(TA[w[p]]||w[p])+w.slice(p+1);}
/* accento sulla sillaba j (da sinistra), ma mai oltre la terzultima */
function stressSyl(w,j,cap=3){
  w=strip(w);const ns=nuclei(w);
  if(ns.length<2)return w;
  let k=Math.max(0,Math.min(j,ns.length-1));
  if(ns.length-k>cap)k=ns.length-cap;
  return accentNucleus(w,ns[k]);
}
/* accento sulla k-esima sillaba dalla fine (1 = ultima) */
function stressEnd(w,k){
  w=strip(w);const ns=nuclei(w);
  if(ns.length<2)return w;
  return accentNucleus(w,ns[Math.max(0,ns.length-k)]);
}
/* indice di sillaba dell'accento in una forma accentata */
function accentIdx(form){
  const m=form.search(/[άέήίόύώΐΰ]/);if(m<0)return 0;
  const ns=nuclei(strip(form));
  for(let k=0;k<ns.length;k++)if(m>=ns[k][0]&&m<ns[k][1])return k;
  return 0;
}
const lastSyl=s=>Math.max(0,nuclei(strip(s)).length-1);

/* rifinitura: monosillabi senza accento, sigma finale, (ε) */
function fin(s){
  return s.split(' / ').map(part=>{
    let eps=false;
    if(part.endsWith('(ε)')){eps=true;part=part.slice(0,-3);}
    part=part.replace(/\./g,'');
    if(nuclei(strip(part)).length===1)part=strip(part);
    part=part.replace(/σ$/,'ς');
    return part+(eps?'(ε)':'');
  }).join(' / ');
}
const pre=(arr,p)=>arr.map(f=>f.split(' / ').map(x=>p+x).join(' / '));

/* unisce radice + desinenza; se la desinenza è accentata la radice perde l'accento */
function join(stem,j,en){
  let eps=false;if(en.endsWith('(ε)')){eps=true;en=en.slice(0,-3);}
  const w=/[άέήίόύώΐΰ]/.test(en)?strip(stem)+en:stressSyl(strip(stem)+en,j);
  return fin(w+(eps?'(ε)':''));
}
const joinAlt=(stem,j,en)=>en.split(' / ').map(x=>join(stem,j,x)).join(' / ');

/* ================= Costruttori di forme ================= */
const PERS_LABELS=['εγώ','εσύ','αυτός/-ή/-ό','εμείς','εσείς','αυτοί/-ές/-ά'];
const E_PAST=['α','ες','ε','αμε','ατε','αν(ε)'];
/* prefisso ανα- + verbo che inizia per consonante e ha la radice di una sola sillaba (πλέκω → ανέπλεξα):
   l'aumento si mette dopo il prefisso, che perde la α finale; con radici più lunghe non serve (αναδιπλάσιασα) */
const ANA_CL=/^(?:πλ|βλ|γλ|κλ|φλ|χλ|πρ|βρ|γρ|κρ|φρ|χρ|τρ|δρ|θρ|θλ|στ|σκ|σπ|σφ|σμ|σν|σχ|κτ|πτ|φθ|χθ|γν|κν|πν|μν|τσ|τζ|μπ|ντ|γκ|σθ|[βγδζθκλμνπρστφχψξ])/;
function anaAug(stem){
  const pm=stem.match(/^(ανα|κατα|παρα|μετα|επι|υπο|απο|αντι)/);
  if(!pm)return null;
  const rest=stem.slice(pm[1].length);
  if(!rest||isV(rest[0])||rest[0]==='ρ'||nuclei(rest).length!==1)return null;
  const m=rest.match(ANA_CL);
  if(!m)return null;
  if(m[0].length===1&&!isV(rest[1]||''))return null;
  return {pre:pm[1],rest};
}
function pastForms(stem,ends=E_PAST,noAug=false){
  if(stem[0]==='='){noAug=true;stem=stem.slice(1);}
  stem=strip(stem);
  const ana=!noAug?anaAug(stem):null;
  const needAug=!noAug&&!ana&&!isV(stem[0])&&nuclei(stem).length===1;
  return ends.map((e,i)=>{
    const eps=e.endsWith('(ε)');const en=eps?e.slice(0,-3):e;
    const pl=(i===3||i===4);
    const w=ana&&!pl?ana.pre.slice(0,-1)+'ε'+ana.rest+en:((needAug&&!pl)?'ε':'')+stem+en;
    return fin(stressEnd(w,3)+(eps?'(ε)':''));
  });
}
function subjForms(s){
  s=strip(s.replace('=',''));const j=lastSyl(s);
  return ['ω','εις','ει','ουμε','ετε','ουν(ε)'].map(en=>join(s,j,en));
}
function imp2pl(s){
  s=strip(s.replace('=',''));const last=s.slice(-1);
  if('σψξλρ'.includes(last))return fin(stressSyl(s+'τε',lastSyl(s)));
  return fin(stressEnd(s+'ετε',3));
}
const imp2sg=s=>fin(stressEnd(strip(s.replace('=',''))+'ε',3));

/* ================= Modelli di classe ================= */
const TPL={
  A:{pres:['ω','εις','ει','ουμε','ετε','ουν(ε)']},
  B1:{pres:['ώ / άω','άς','ά / άει','άμε / ούμε','άτε','ούν(ε) / άνε'],
      impf:['ούσα','ούσες','ούσε','ούσαμε','ούσατε','ούσαν(ε)']},
  B2:{pres:['ώ','είς','εί','ούμε','είτε','ούν(ε)'],
      impf:['ούσα','ούσες','ούσε','ούσαμε','ούσατε','ούσαν(ε)']}
};
const PTPL={
  PA:{pres:['ομαι','εσαι','εται','όμαστε','εστε / όσαστε','ονται'],
      impf:['όμουν','όσουν','όταν','όμασταν','όσασταν','ονταν / όντουσαν']},
  PB1:{pres:['ιέμαι','ιέσαι','ιέται','ιόμαστε','ιέστε / ιόσαστε','ιούνται'],
      impf:['ιόμουν','ιόσουν','ιόταν','ιόμασταν','ιόσασταν','ιούνταν / ιόντουσαν']},
  PB2:{pres:['ούμαι','είσαι','είται','ούμαστε','είστε','ούνται'],
      impf:['ούμουν','ούσουν','ούνταν','ούμασταν','ούσασταν','ούνταν']},
  PDA:{pres:['άμαι','άσαι','άται','όμαστε','άστε / όσαστε','ούνται'],
      impf:['όμουν','όσουν','όταν','όμασταν','όσασταν','όντουσαν / ούνταν']}
};
const PASSCLS={A:'PA',B1:'PB1',B2:'PB2',D:'PA',DA:'PDA',DB1:'PB1',DB2:'PB2'};
const CLASS_DESC={
  A:'Gruppo A · verbi in -ω (tipo γράφω)',
  B1:'Gruppo B1 · verbi contratti in -ώ/-άω (tipo αγαπώ)',
  B2:'Gruppo B2 · verbi in -ώ/-είς (tipo θεωρώ)',
  D:'Verbo deponente in -ομαι (solo forma passiva)',
  DA:'Verbo deponente in -άμαι (solo forma passiva)',
  DB1:'Verbo deponente in -ιέμαι (solo forma passiva)',
  DB2:'Verbo deponente in -ούμαι (solo forma passiva)',
  X:'Verbo irregolare'
};

function presentStem(e){
  const f=e.forms[0];let base=f;
  switch(e.cls){
    case 'A':base=f.replace(/ω$/,'');break;
    case 'B1':case 'B2':base=f.replace(/(άω|ώ|ω)$/,'');break;
    case 'D':base=f.replace(/ομαι$/,'');break;
    case 'DA':base=f.replace(/άμαι$/,'');break;
    case 'DB1':base=f.replace(/ιέμαι$/,'');break;
    case 'DB2':base=f.replace(/ούμαι$/,'');break;
  }
  return {base,j:accentIdx(base)};
}

/* radici dell'aoristo quando la 1ª persona ha più varianti («ζούλησα / ζούληξα»): servono a congiuntivo, futuro e imperativo.
   La prima variante resta sempre la radice del verbo (sStem); l'aumento eventuale si toglie anche dalle altre. */
function aoristStems(O,sStem){
  const forms=O.aor&&O.aor[0]?String(O.aor[0]).split(' / '):[];
  if(forms.length<2||!sStem)return null;
  const stems=forms.map(x=>strip(x.replace(/\([α-ω]\)$/,'').trim())).map(x=>/α$/.test(x)?x.slice(0,-1):null);
  if(stems.some(x=>!x))return null;
  const first=stems[0];
  if(!first.endsWith(sStem))return null;
  const pre=first.slice(0,first.length-sStem.length);
  const out=stems.map((x,i)=>i===0?sStem:(pre?(x.startsWith(pre)?x.slice(pre.length):null):x));
  return out.some(x=>!x)?null:[...new Set(out)];
}
const mergeVariants=lists=>lists[0].map((_,i)=>[...new Set(lists.flatMap(l=>String(l[i]).split(' / ')))].join(' / '));
function aoristBlock(e){
  const O=e.O,r={};
  const sStem=(e.s||e.a||'').replace('=','');
  const st=aoristStems(O,strip(sStem));
  r.aor=O.aor||(e.a?pastForms(e.a):null);
  r.subj=O.subj||(sStem?subjForms(sStem):null);
  if(!O.subj&&st&&st.length>1)r.subj=mergeVariants(st.map(x=>subjForms(x)));
  r.inf=r.subj?r.subj[2].split(' / ')[0]:null;
  r.iaor=O.iaor||(sStem?[imp2sg(sStem),imp2pl(sStem)]:null);
  if(!O.iaor&&st&&st.length>1)r.iaor=mergeVariants(st.map(x=>[imp2sg(x),imp2pl(x)]));
  return r;
}

function buildActive(e){
  const O=e.O,cls=e.cls,f={};
  let base='',j=0;
  if(cls!=='X'){const p=presentStem(e);base=p.base;j=p.j;}
  const tpl=TPL[cls];
  f.pres=O.pres||(tpl?tpl.pres.map(en=>joinAlt(base,j,en)):null);
  if(O.impf)f.impf=O.impf;
  else if(cls==='A')f.impf=pastForms(strip(base));
  else if(tpl&&tpl.impf){
    const a1=tpl.impf.map(en=>joinAlt(base,0,en));
    if(cls==='B1'){
      const a2=pastForms(strip(base),['αγα','αγες','αγε','αγαμε','αγατε','αγαν(ε)'],true);
      f.impf=a1.map((x,i)=>x+' / '+a2[i]);
    }else f.impf=a1;
  }
  const ab=aoristBlock(e);
  f.aor=ab.aor;f.subj=ab.subj;f.inf=ab.inf;f.iaor=ab.iaor;
  if(O.ipres)f.ipres=O.ipres;
  else if(f.pres){
    const b=strip(base);
    if(cls==='A')f.ipres=[fin(stressEnd(b+'ε',3)),f.pres[4]];
    else if(cls==='B1')f.ipres=[fin(stressSyl(b+'α',lastSyl(b))),f.pres[4].split(' / ')[0]];
    else if(cls==='B2')f.ipres=[fin(stressSyl(b+'ει',lastSyl(b))),f.pres[4]];
  }
  if(O.ptc)f.ptc=O.ptc[0];
  else if(cls==='A')f.ptc=fin(stressSyl(strip(base)+'οντας',j));
  else if(cls==='B1'||cls==='B2')f.ptc=fin(strip(base)+'ώντας');
  return f;
}

function buildPassive(e){
  const O=e.O,cls=e.cls,f={};
  if(cls==='X'&&!O.ppres)return null;
  const pc=e.pc||PASSCLS[cls];const tpl=PTPL[pc];
  let base='',j=0;
  if(cls!=='X'){
    if(e.ps){base=e.ps;j=accentIdx(e.ps);}else{const p=presentStem(e);base=p.base;j=p.j;}
  }
  f.pres=O.ppres||(tpl?tpl.pres.map(en=>joinAlt(base,j,en)):null);
  f.impf=O.pimpf||(tpl?tpl.impf.map(en=>joinAlt(base,j,en)):null);
  const dep=cls.startsWith('D');
  if(dep&&e.im!=='act'&&(e.a||O.aor||O.subj)){
    const ab=aoristBlock(e);f.aor=ab.aor;f.subj=ab.subj;f.inf=ab.inf;f.iaor=ab.iaor;
  }else if(e.p||O.paor||O.psubj){
    /* se l'aoristo passivo è stato corretto (es. υποβλήθηκα), congiuntivo, futuro, perfetto e imperativo ne ricavano la radice */
    let pst=e.p;
    if(O.paor&&!O.psubj){const m=String(O.paor[0]).split(' / ')[0].match(/^(.+)ηκα$/);if(m)pst=strip(m[1]);}
    f.aor=O.paor||(e.p?pastForms(e.p,['ηκα','ηκες','ηκε','ηκαμε','ηκατε','ηκαν(ε)'],true):null);
    f.subj=O.psubj||(pst?['ώ','είς','εί','ούμε','είτε','ούν(ε)'].map(en=>joinAlt(pst,0,en)):null);
    /* più varianti dell'aoristo passivo (ζουλήχτηκα / ζουλήθηκα): congiuntivo e imperativo le seguono */
    let pvs=null;
    if(O.paor&&!O.psubj){
      const ps=String(O.paor[0]).split(' / ').map(x=>{const m=x.replace(/\([α-ω]\)$/,'').trim().match(/^(.+)ηκα$/);return m?strip(m[1]):null;});
      if(ps.length>1&&ps.every(Boolean))pvs=[...new Set(ps)];
    }
    if(pvs&&pvs.length>1)f.subj=mergeVariants(pvs.map(p=>['ώ','είς','εί','ούμε','είτε','ούν(ε)'].map(en=>joinAlt(p,0,en))));
    f.inf=O.pinf?O.pinf[0]:(f.subj?f.subj[2].split(' / ')[0]:null);
    f.iaor=O.piaor||(e.i&&pst?[fin(stressSyl(strip(e.i)+'ου',lastSyl(e.i))),fin(strip(pst)+'είτε')]:null);
    if(!O.piaor&&pvs&&pvs.length>1&&f.iaor)f.iaor=[f.iaor[0],pvs.map(p=>fin(strip(p)+'είτε')).join(' / ')];
  }
  f.m=e.m||null;
  f.ptc=dep&&O.ptc?O.ptc[0]:null;
  return f;
}

const AUXP=['έχω','έχεις','έχει','έχουμε','έχετε','έχουν'];
const AUXI=['είχα','είχες','είχε','είχαμε','είχατε','είχαν'];
const AUXF=['θα έχω','θα έχεις','θα έχει','θα έχουμε','θα έχετε','θα έχουν'];
const AUXS=['να έχω','να έχεις','να έχει','να έχουμε','να έχετε','να έχουν'];

function partForms(m){
  return m.split('/').map(w=>{
    w=w.trim();
    if(w.endsWith('ος'))return w+', -η, -ο';
    if(w.endsWith('ός'))return w+', -ή, -ό';
    return w;
  }).join(' / ');
}

function assemble(f,no,voice){
  const cards={ind:[],sub:[],imp:[],nom:[]};
  /* una persona che non esiste («—») non entra nei tempi derivati: «θα —» diventa «—» */
  const dash=x=>(typeof x==='string'&&x!=='—'&&/(^|\s)—($|\s)/.test(x))?'—':x;
  const add=(g,id,it,gr,forms)=>{if(forms&&!no.has(id))cards[g].push({id,it,gr,forms:Array.isArray(forms)?forms.map(dash):forms});};
  const inf=f.inf;
  add('ind','pres','Presente','Ενεστώτας',f.pres);
  add('ind','impf','Imperfetto','Παρατατικός',f.impf);
  add('ind','aor','Aoristo','Αόριστος',f.aor);
  add('ind','fut1','Futuro continuo','Εξακολουθητικός μέλλοντας',f.pres&&pre(f.pres,'θα '));
  add('ind','fut2','Futuro semplice','Στιγμιαίος μέλλοντας',f.subj&&pre(f.subj,'θα '));
  add('ind','perf','Perfetto','Παρακείμενος',inf&&AUXP.map(a=>a+' '+inf));
  add('ind','plup','Trapassato','Υπερσυντέλικος',inf&&AUXI.map(a=>a+' '+inf));
  add('ind','fperf','Futuro anteriore','Συντελεσμένος μέλλοντας',inf&&AUXF.map(a=>a+' '+inf));
  add('sub','spres','Presente','Ενεστώτας',f.pres&&pre(f.pres,'να '));
  add('sub','saor','Aoristo','Αόριστος',f.subj&&pre(f.subj,'να '));
  add('sub','sperf','Perfetto','Παρακείμενος',inf&&AUXS.map(a=>a+' '+inf));
  const imp=(id,it,gr,v)=>{if(v&&!no.has(id))cards.imp.push({id,it,gr,forms:v,imp:true});};
  imp('ipres','Presente','Ενεστώτας',f.ipres);
  imp('iaor','Aoristo','Αόριστος',f.iaor);
  const nom=(id,it,gr,v)=>{if(v&&!no.has(id))cards.nom.push({id,it,gr,value:v});};
  if(voice==='act'){
    nom('ptc','Gerundio','Μετοχή ενεστώτα',f.ptc);
    nom('inf','Forma per i tempi composti','Απαρέμφατο',f.inf);
  }else{
    nom('part','Participio passato','Μετοχή παθητικού παρακειμένου',f.m&&partForms(f.m));
    nom('ptc','Participio presente','Μετοχή ενεστώτα',f.ptc);
    nom('inf','Forma per i tempi composti','Απαρέμφατο',f.inf);
  }
  return cards;
}

function conjugate(e){
  const no=new Set((e.no||'').split(',').map(s=>s.trim()).filter(Boolean));
  const voices=[];
  const dep=e.cls.startsWith('D');
  if(!dep||(e.im==='act'&&e.O.pres)){
    const a=buildActive(e);
    const cards=assemble(a,no,'act');
    if(e.im==='act'){
      /* verbo impersonale: solo 3ª singolare e 3ª plurale, le altre celle sono «—»; niente imperativo né gerundio */
      /* persone ammesse = quelle compilate nel presente (solo 3ª sing., oppure 3ª sing. e plur.) */
      const ok=(e.O.pres||[]).map(x=>!!x&&x!=='—');
      for(const g of ['ind','sub'])cards[g].forEach(c=>{c.forms=c.forms.map((x,i)=>ok[i]?x:'—');});
      cards.imp=[];cards.nom=cards.nom.filter(c=>c.id==='inf');
    }
    voices.push({id:'act',label:e.im==='act'?'Voce attiva (impersonale)':'Voce attiva',gr:'Ενεργητική φωνή',cards,raw:a});
  }
  const hasPass=dep||(e.p&&e.cls!=='X')||e.O.ppres||e.O.paor||e.O.psubj;
  if(hasPass){
    const p=buildPassive(e);
    if(p){
      const pc=assemble(p,no,'pass');
      /* passivo con le sole 3e persone (εξυπακούομαι, solo 3ª sing./plur.): le altre celle anche nei tempi composti restano «—» */
      const okp=(e.O.ppres||[]).map(x=>!!x&&x!=='—');
      if(okp.length===6&&okp.filter(x=>!x).length>=3&&okp.some(x=>x)){
        for(const g of ['ind','sub'])pc[g].forEach(c=>{if(c.forms.length===6)c.forms=c.forms.map((x,i)=>okp[i]?x:'—');});
        pc.imp=[];if(pc.nom)pc.nom=pc.nom.filter(c=>c.id==='inf');
      }
      voices.push({id:'pass',label:dep?'Forma passiva (deponente)':'Voce passiva',gr:'Παθητική φωνή',cards:pc,raw:p});
    }
  }
  /* deponente con forme attive impersonali: la voce passiva (quella vera del verbo) viene per prima */
  if(dep&&voices.length>1)voices.sort((x,y)=>(x.id==='pass'?0:1)-(y.id==='pass'?0:1));
  return voices;
}

/* chiave dell'override O.* per un campo modificabile (pres, impf, aor, subj, ipres, iaor) */
function overrideKey(e,voiceId,field){
  if(voiceId==='act')return field;
  const dep=e.cls.startsWith('D');
  const activeAor=dep&&e.im!=='act'&&(e.a||e.O.aor||e.O.subj);
  if(field==='pres')return 'ppres';
  if(field==='impf')return 'pimpf';
  if(field==='ipres')return 'pipres';
  if(activeAor)return field;
  return {aor:'paor',subj:'psubj',iaor:'piaor'}[field];
}
/* ================= Lessico ================= */
/* completa un entry: forme alternative automatiche (ώ<->άω), chiavi di ricerca, titolo */
function finalizeEntry(e){
  e.O=e.O||{};
  e.forms=(e.forms&&e.forms.length?e.forms:[e.lemma]).slice();
  e.lemma=e.forms[0].replace(/\./g,'');
  const alt=[];
  if(e.cls==='B1'){
    if(/άω$/.test(e.lemma))alt.push(e.lemma.replace(/άω$/,'ώ'));
    else if(/ώ$/.test(e.lemma))alt.push(e.lemma.replace(/ώ$/,'άω'));
  }
  const all=[...e.forms.map(f=>f.replace(/\./g,'')),...alt];
  e.keys=[...new Set(all)];
  e.display=e.keys.join(' / ');
  e.gloss=e.gloss||'';
  return e;
}
function parseDslLine(line){
  const parts=line.split(' | ').map(s=>s.trim());
  const e={forms:parts[0].split('/').map(s=>s.trim()),cls:parts[1],gloss:parts[2]||'',O:{}};
  parts.slice(3).forEach(kv=>{
    const i=kv.indexOf('=');if(i<0)return;
    const k=kv.slice(0,i).trim(),v=kv.slice(i+1).trim();
    if(k.startsWith('O.'))e.O[k.slice(2)]=v.split(',').map(x=>x.trim().replace(/\s*\/\s*/g,' / '));
    else e[k]=v;
  });
  return finalizeEntry(e);
}
function loadLexicon(text){
  const list=[];
  text.split('\n').forEach(raw=>{
    const line=raw.trim();if(!line||line.startsWith('#'))return;
    const e=parseDslLine(line);e.source='base';list.push(e);
  });
  return list;
}
/* inverso: entry -> riga di testo nel formato del lessico */
function entryToDsl(e){
  const parts=[e.forms.join('/'),e.cls,(e.gloss||'').replace(/ \| /g,' ')];
  ['a','s','p','m','i','ps','pc','k','no','im'].forEach(k=>{if(e[k])parts.push(k+'='+e[k]);});
  Object.keys(e.O||{}).forEach(k=>{parts.push('O.'+k+'='+e.O[k].map(x=>x.replace(/ \/ /g,'/')).join(','));});
  return parts.join(' | ');
}
/* copia serializzabile (senza campi calcolati) */
function serializeEntry(e){
  const o={};
  ['forms','cls','gloss','a','s','p','m','i','ps','pc','k','no','im','source','gloss_en','gloss_p','updated','edited'].forEach(k=>{if(e[k]!==undefined&&e[k]!=='')o[k]=e[k];});
  o.O=JSON.parse(JSON.stringify(e.O||{}));
  return o;
}
function buildIndex(list){
  const idx=new Map();
  /* 1ª passata: i verbi di partenza hanno la precedenza */
  list.forEach(e=>{
    e.keys.forEach(f=>{const k=keyOf(f);if(!idx.has(k))idx.set(k,{e,voice:e.cls.startsWith('D')?'pass':'act'});});
  });
  /* 2ª passata: presente passivo dei verbi attivi, solo se la forma è libera */
  list.forEach(e=>{
    try{
      const vs=conjugate(e);
      e._voices=vs;
      const pv=vs.find(v=>v.id==='pass');
      if(pv&&!e.cls.startsWith('D')&&pv.raw.pres){
        pv.raw.pres[0].split(' / ').forEach(f=>{const k=keyOf(f);if(!idx.has(k))idx.set(k,{e,voice:'pass'});});
      }
    }catch(err){e._err=String(err);}
  });
  return idx;
}

/* ===== indice di TUTTE le forme coniugate: forma (senza accenti) -> verbi che la contengono ===== */
const FTENSE={pres:'presente',impf:'imperfetto',aor:'aoristo',subj:'congiuntivo',inf:'infinito',iaor:'imperativo aoristo',ipres:'imperativo presente',ptc:'gerundio',m:'participio perfetto',pinf:'infinito'};
const FPERS=['1ª sing.','2ª sing.','3ª sing.','1ª plur.','2ª plur.','3ª plur.'];
/* "έγραψαν(ε) / έγραψαν" -> ['έγραψαν','έγραψανε'] (la parte tra parentesi è facoltativa) */
export function formVariants(str){
  const out=[];
  for(const t of String(str||'').split('/')){
    const w=t.trim();if(!w)continue;
    const m=w.match(/^([^()\s]+)\(([^()\s]+)\)$/);
    if(m){out.push(m[1],m[1]+m[2]);}
    else{const x=w.replace(/[()]/g,'').trim();if(x&&!/\s/.test(x)&&/[α-ωά-ώ]/i.test(x))out.push(x);}
  }
  return out;
}
export function buildFormIndex(list){
  const idx=new Map();
  const add=(f,e,voice,tag)=>{
    const k=keyOf(f);if(!k)return;
    let arr=idx.get(k);if(!arr){arr=[];idx.set(k,arr);}
    let h=arr.find(x=>x.e===e);
    if(!h){h={e,voice,tags:[],w:f};arr.push(h);}
    if(!h.tags.includes(tag))h.tags.push(tag);
  };
  for(const e of list){
    let vs;try{vs=e._voices||conjugate(e);}catch(_){continue;}
    for(const v of vs){
      for(const [f,val] of Object.entries(v.raw)){
        const tense=FTENSE[f];if(!tense)continue;
        const pas=v.id==='pass'?' passivo':'';
        if(Array.isArray(val)){
          const pers=val.length===2?['2ª sing.','2ª plur.']:FPERS;
          val.forEach((x,i)=>formVariants(x).forEach(w=>add(w,e,v.id,`${tense}${pas}, ${pers[i]||''}`.replace(/, $/,''))));
        }else if(typeof val==='string'){
          formVariants(val).forEach(w=>add(w,e,v.id,`${tense}${pas}`));
        }
      }
    }
  }
  return idx;
}

/* ================= Verbi non in lessico: ipotesi a regole ================= */
function guessAorist(S,cls){
  if(cls==='B1'||cls==='B2')return S+'ησ';
  if(/ζ$/.test(S))return S.slice(0,-1)+'σ';
  if(/ευ$/.test(S))return S.slice(0,-2)+'εψ';
  if(/(πτ|φτ)$/.test(S))return S.slice(0,-2)+'ψ';
  if(/[φβπ]$/.test(S))return S.slice(0,-1)+'ψ';
  if(/(χν|σκ|ττ|σσ)$/.test(S))return S.slice(0,-2)+"ξ";
  if(/[γκχ]$/.test(S))return S.slice(0,-1)+'ξ';
  if(/αιν$/.test(S))return S.slice(0,-3);
  if(/ρν$/.test(S))return S.slice(0,-1);
  if(/ν$/.test(S))return S.slice(0,-1)+'σ';
  return S+'σ';
}
function guessPassive(a){
  if(/ψ$/.test(a)){return /ευ/.test(a.slice(-3))?a.slice(0,-2)+'υτ':a.slice(0,-1)+'φτ';}
  if(/ξ$/.test(a))return a.slice(0,-1)+'χτ';
  if(/(ωσ|υσ|ησ)$/.test(a))return a.slice(0,-1)+'θ';
  if(/σ$/.test(a))return a+'τ';
  return a+'θ';
}
function guessEntry(raw,forceCls){
  let t=raw.trim().toLowerCase();
  if(!t||/[^α-ωά-ώϊϋΐΰς]/.test(t))return null;
  let cls=null;
  if(/ιέμαι$/.test(t))cls='DB1';
  else if(/ούμαι$/.test(t))cls='DB2';
  else if(/άμαι$/.test(t))cls='DA';
  else if(/ομαι$/.test(t))cls='D';
  else if(/ποιώ$/.test(t))cls='B2';
  else if(/(άω|ώ)$/.test(t))cls='B1';
  else if(/ω$/.test(t))cls='A';
  if(!cls)return null;
  if(forceCls)cls=forceCls;
  if(!/[άέήίόύώΐΰ]/.test(t)){
    if(cls==='A')t=stressEnd(t,2);
    else if(cls==='D')t=stressEnd(t,3);
  }
  const e=finalizeEntry({forms:[t],cls,gloss:'',O:{},guessed:true});
  const b=strip(presentStem(e).base);
  if(cls==='A'||cls==='B1'||cls==='B2'){e.a=guessAorist(b,cls);e.p=guessPassive(e.a);}
  else if(cls==='D'){e.p=guessPassive(guessAorist(b,'A'));}
  else{e.p=guessPassive(guessAorist(b,'B1'));}
  if(cls==='A'&&/(σσ|ττ)$/.test(b)&&e.p&&/χτ$/.test(e.p)){const E=['ηκα','ηκες','ηκε','ηκαμε','ηκατε','ηκαν(ε)'];e.O.paor=mergeVariants([pastForms(e.p,E,true),pastForms(e.p.slice(0,-2)+'χθ',E,true)]);}
  if(cls==='B2'&&/ποι$/.test(b)&&!e.m)e.m=b+'ημένος';
  return e;
}


export{overrideKey,nuclei,stressSyl,stressEnd,fin,conjugate,loadLexicon,parseDslLine,finalizeEntry,entryToDsl,serializeEntry,buildIndex,guessEntry,keyOf,strip,CLASS_DESC,PERS_LABELS};

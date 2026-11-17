/* Importatore da en.wiktionary.org: legge la tabella di coniugazione del greco moderno.
   Funziona su HTML (API MediaWiki) o su testo incollato (celle separate da tab). */
const API='https://en.wiktionary.org/w/api.php';
const GREEK_FORM=/^[α-ωά-ώϊϋΐΰς]+(\(ε\)|\([α-ω]\))?$/i;
const P6=['1 sg','2 sg','3 sg','1 pl','2 pl','3 pl'];

const ENT={'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&apos;':"'"};
function decode(s){
  return s.replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16)))
    .replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(+d))
    .replace(/&(nbsp|amp|lt|gt|quot|apos);|&#39;/g,m=>ENT[m]||m);
}
export function htmlText(h){
  return decode(h.replace(/<br\s*\/?>/gi,', ').replace(/<sup[\s\S]*?<\/sup>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'')
    .replace(/<[^>]+>/g,'')).replace(/\s+/g,' ').trim();
}
/* sezione "Greek" (moderno) della pagina */
export function greekSection(html){
  const m=html.match(/<h2[^>]*id="Greek"/);
  if(!m)return '';
  const start=m.index;
  const next=html.indexOf('<h2',start+10);
  return html.slice(start,next<0?html.length:next);
}
export function htmlToRows(html){
  const rows=[];
  for(const t of html.matchAll(/<table[\s\S]*?<\/table>/gi)){
    for(const tr of t[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)){
      const cells=[...tr[0].matchAll(/<t[hd]\b[\s\S]*?<\/t[hd]>/gi)].map(c=>htmlText(c[0]));
      if(cells.length)rows.push(cells);
    }
  }
  return rows;
}
/* testo incollato: righe, celle separate da tab (o da | per tabelle markdown) */
export function textToRows(text){
  return text.split(/\r?\n/).map(l=>l.replace(/\s+$/,'')).filter(l=>l.trim()).map(l=>{
    if(l.includes('\t'))return l.split('\t').map(c=>c.trim());
    if(/^\s*\|.*\|$/.test(l))return l.trim().slice(1,-1).split('|').map(c=>c.trim());
    return [l];
  }).filter(r=>!r.every(c=>/^[-: ]*$/.test(c)));
}
/* una cella -> "forma / variante" (solo parole greche; scarta [..], (variante rara), —, "θα …") */
function splitForms(s){
  /* note di rimando tipo «(προλαμβάνω →)»: le parentesi con spazi o frecce non fanno parte della forma; «(ε)» invece sì */
  s=s.replace(/\s*\([^)]*[\s→➤][^)]*\)/g,'');
  s=s.replace(/➤/g,'').replace(/[—–]/g,'');
  s=s.replace(/\s+-\s*|\s*-\s+/g,', ');   // «forma - variante colloquiale»
  const toks=s.split(/\s*[,;\/]\s*/).map(t=>t.trim()).filter(Boolean)
    .filter(t=>GREEK_FORM.test(t));
  return [...new Set(toks)].join(' / ');
}
export function cleanCell(s){
  if(!s)return '';
  const main=splitForms(s.replace(/\[[^\]]*\]/g,''));
  if(main)return main;
  /* solo forme tra [parentesi quadre] (poco usate): meglio di una cella vuota */
  const br=[...s.matchAll(/\[([^\]]*)\]/g)].map(m=>m[1]).join(',');
  return splitForms(br);
}
const PRON={'εγώ':'1 sg','εσύ':'2 sg','εμείς':'1 pl','εσείς':'2 pl'};
/* normalizza l'etichetta di riga: "1st person singular" / "1st sg." / "εγώ" -> "1 sg" */
export function normLabel(x){
  let t=(x||'').replace(/\s+/g,' ').trim().toLowerCase();
  if(PRON[t])return PRON[t];
  if(/^αυτ(ός|ή|ό)(?![α-ωά-ώ])/.test(t))return '3 sg';
  if(/^αυτ(οί|ές|ά)(?![α-ωά-ώ])/.test(t))return '3 pl';
  t=t.replace(/(\d)\s*(st|nd|rd|th|ª|º|°)/,'$1').replace(/\bperson\b/g,'').replace(/\bsingular\b|\bsing\b\.?/g,'sg').replace(/\bplural\b/g,'pl').replace(/\./g,'').replace(/\s+/g,' ').trim();
  const m=t.match(/^([123]) ?(sg|pl|s|p)$/)||t.match(/^([123]) ?(sg|pl)\b/);
  return m?m[1]+' '+(m[2]==='s'?'sg':m[2]==='p'?'pl':m[2]):t;
}
const lab=r=>normLabel(r&&r[0]);
const DEFAULT_COLS=[{voice:'act',dep:false},{voice:'act',dep:true},{voice:'pass',dep:false},{voice:'pass',dep:true}];
const colMap=h=>h.slice(1).map(c=>({voice:/passive/i.test(c)?'pass':'act',dep:/dependent/i.test(c)}));
const isHeader=r=>r.slice(1).some(c=>/voice/i.test(c));

export function inferClass(title,O){
  if(!O.pres){
    if(/ιέμαι$/.test(title))return 'DB1';
    if(/ούμαι$/.test(title))return 'DB2';
    if(/άμαι$/.test(title))return 'DA';
    return 'D';
  }
  const two=(O.pres[1]||'').split(' / ')[0];
  if(/(ώ|άω)$/.test(title)){
    if(/άς$/.test(two))return 'B1';
    if(/είς$/.test(two))return 'B2';
  }
  return 'A';
}

const blank=r=>r.every(c=>!c);
/* 6 righe di persona (1 sg … 3 pl), ignorando le righe vuote tra i due gruppi da 3 */
function personBlock(rows,i){
  const blk=[];let j=i;
  while(blk.length<6&&j<rows.length){
    if(blank(rows[j])){j++;continue;}
    if(lab(rows[j])!==P6[blk.length])return null;
    blk.push(rows[j]);j++;
  }
  return blk.length===6?{blk,end:j}:null;
}
/* colonne: l'intestazione "Active voice | Passive voice" usa colspan, quindi conta le celle dei dati */
function columnsFor(header,ncol){
  if(header&&colMap(header).length===ncol)return colMap(header);
  return DEFAULT_COLS.slice(0,Math.min(ncol,4));
}

export function rowsToEntry(rows,title){
  const O={};const report={found:[],missing:[]};
  let header=null,bi=0,imp=0;
  for(let i=0;i<rows.length;i++){
    const r=rows[i];
    if(isHeader(r)){header=r;continue;}
    if(lab(r)==='1 sg'){
      const pb=personBlock(rows,i);
      if(pb){
        i=pb.end-1;
        const blk=pb.blk;
        if(blk.some(x=>x.slice(1).some(c=>/^θα\s/.test(c))))continue;
        const ncol=Math.max(...blk.map(x=>x.length-1));
        columnsFor(header,ncol).forEach((c,k)=>{
          const arr=blk.map(x=>cleanCell(x[k+1]));
          const filled=arr.filter(Boolean).length;
          if(filled===0)return;
          let key;
          if(bi===0)key=c.voice==='act'?(c.dep?'subj':'pres'):(c.dep?'psubj':'ppres');
          else if(bi===1)key=c.voice==='act'?(c.dep?'aor':'impf'):(c.dep?'paor':'pimpf');
          else return;
          if(filled<6){report.missing.push(key+' (incompleto)');return;}
          O[key]=arr;
        });
        bi++;continue;
      }
    }
    if(lab(r)==='2 sg'){
      let j=i+1;while(j<rows.length&&blank(rows[j]))j++;
      if(rows[j]&&lab(rows[j])==='2 pl'){
        const a=r,b=rows[j];i=j;
        if(imp===0){
          const ncol=Math.max(a.length,b.length)-1;
          columnsFor(header,ncol).forEach((c,k)=>{
            const x=[cleanCell(a[k+1]),cleanCell(b[k+1])];
            if(!x[0]||!x[1])return;
            const key=c.voice==='act'?(c.dep?'iaor':'ipres'):(c.dep?'piaor':'pipres');
            O[key]=x;
          });
        }
        imp++;continue;
      }
    }
    const l=lab(r);
    if(/gerund|active participle|present participle/.test(l)){
      const v=r.slice(1).map(cleanCell).find(Boolean);if(v&&!O.ptc)O.ptc=[v.split(' / ')[0]];
    }
    if(/(passive|perfect|past) participle/.test(l)){
      const v=r.slice(1).map(cleanCell).find(Boolean);if(v&&!O.__m)O.__m=v.split(' / ')[0];
    }
  }
  const m=O.__m;delete O.__m;
  delete O.pipres;
  const cls=inferClass(title,O);
  const entry={forms:[title],cls,gloss:'',O,source:'wiktionary',updated:new Date().toISOString().slice(0,10)};
  if(m)entry.m=m;
  const want=cls.startsWith('D')?['ppres','pimpf','paor','psubj']:['pres','impf','aor','subj'];
  want.forEach(k=>{if(O[k])report.found.push(k);else report.missing.push(k);});
  if(!cls.startsWith('D')&&(O.ppres||O.paor))report.found.push('passivo');
  ['ipres','iaor','ptc'].forEach(k=>{if(O[k])report.found.push(k);});
  return {entry,report};
}

/* prima definizione inglese */
export function firstGloss(sectionHtml){
  const ol=sectionHtml.match(/<ol[\s\S]*?<\/ol>/i);
  if(!ol)return '';
  const flat=ol[0].replace(/<(ul|dl)[\s\S]*?<\/\1>/gi,'');
  const m=flat.match(/<li[^>]*>([\s\S]*?)<\/li>/i);
  if(!m)return '';
  const t=htmlText(m[1]);
  return t.length>140?t.slice(0,137)+'…':t;
}
/* testo diagnostico da inviare allo sviluppatore quando la tabella non viene riconosciuta */
export function diagnose(html,title,isText){
  const out=['verbo: '+title];
  if(isText){const rows=textToRows(html);out.push('righe: '+rows.length);rows.slice(0,70).forEach(r=>out.push(r.join(' | ').slice(0,200)));return out.join('\n');}
  const sec=greekSection(html);
  out.push('lunghezza pagina: '+html.length+' · sezione Greek: '+(sec?sec.length:'NON TROVATA'));
  out.push('titoli h2: '+[...html.matchAll(/<h2[^>]*id="([^"]*)"/g)].map(m=>m[1]).join(', '));
  const base=sec||html;
  const tabs=[...base.matchAll(/<table[^>]*>/gi)].map(m=>(m[0].match(/class="([^"]*)"/)||[,''])[1]);
  out.push('tabelle ('+tabs.length+'): '+tabs.join(' ; '));
  const rows=htmlToRows(base);
  out.push('righe: '+rows.length);
  rows.slice(0,70).forEach(r=>out.push(r.join(' | ').slice(0,200)));
  return out.join('\n');
}
export function parseGreekVerbHtml(html,title){
  try{return parseGreekVerbHtml0(html,title);}
  catch(e){e.diag=diagnose(html,title);throw e;}
}
/* riga del lemma: "(simple past προσανατόλισα, passive …, ppp προσανατολισμένος)" */
export function headwordInfo(sec){
  const i=sec.indexOf('headword-line');
  if(i<0)return null;
  const t=htmlText(sec.slice(i,i+1500));
  const g=re=>{const m=t.match(re);return m?m[1]:'';};
  const past=g(/(?:simple past|past)\s+([α-ωά-ώ]+)/),ppp=g(/ppp\s+([α-ωά-ώ]+)/),passive=g(/passive\s+([α-ωά-ώ]+)/);
  return past||ppp?{past,ppp,passive}:null;
}
function parseGreekVerbHtml0(html,title){
  const sec=greekSection(html);
  if(!sec)throw new Error('Nessuna sezione «Greek» nella pagina di '+title);
  if(!/<table/i.test(sec)){
    const h=headwordInfo(sec);
    if(h){
      const entry={forms:[title],cls:null,gloss:'',O:{},source:'wiktionary',updated:new Date().toISOString().slice(0,10),fromHeadword:h};
      const g=firstGloss(sec);if(g){entry.gloss_en=g;entry.gloss=g;}
      return {entry,report:{found:[],missing:['tabella assente su Wiktionary'],noTable:true}};
    }
  }
  const {entry,report}=rowsToEntry(htmlToRows(sec),title);
  const g=firstGloss(sec);if(g){entry.gloss_en=g;entry.gloss=g;}
  if(!entry.O.pres&&!entry.O.ppres)throw new Error('Tabella di coniugazione non trovata per '+title+' (non è un verbo del greco moderno?)');
  return {entry,report};
}
export function parsePastedText(text,title){
  try{return parsePasted0(text,title);}
  catch(e){e.diag=diagnose(text,title,!/<table/i.test(text));throw e;}
}
function parsePasted0(text,title){
  const rows=/<table/i.test(text)?htmlToRows(text):textToRows(text);
  const {entry,report}=rowsToEntry(rows,title);
  if(!entry.O.pres&&!entry.O.ppres)throw new Error('Nel testo incollato non trovo la tabella di coniugazione.');
  return {entry,report};
}

async function api(params,f){
  const u=API+'?'+new URLSearchParams({format:'json',formatversion:'2',origin:'*',...params});
  const r=await f(u);
  if(!r.ok)throw new Error('Wiktionary ha risposto '+r.status);
  const j=await r.json();
  if(j.error)throw new Error(j.error.info||j.error.code);
  return j;
}
export async function fetchVerb(title,f=fetch){
  const j=await api({action:'parse',page:title,prop:'text',redirects:'1'},f);
  return parseGreekVerbHtml(j.parse.text,title);
}
/* elenco dei verbi greci (Category:Greek verbs), a pagine */
export async function listVerbs(cont,f=fetch,limit=200){
  const p={action:'query',list:'categorymembers',cmtitle:'Category:Greek_verbs',cmtype:'page',cmlimit:String(limit)};
  if(cont)p.cmcontinue=cont;
  const j=await api(p,f);
  const titles=j.query.categorymembers.map(x=>x.title).filter(t=>/^[α-ωά-ώϊϋΐΰς]+$/i.test(t)&&/(ω|ώ|ομαι|άμαι|ιέμαι|ούμαι)$/.test(t));
  return {titles,next:j.continue&&j.continue.cmcontinue||null};
}

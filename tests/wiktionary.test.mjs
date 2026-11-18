import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseGreekVerbHtml,cleanCell,parsePastedText,textToRows,fetchVerb,listVerbs} from '../src/js/wiktionary.js';
import {lookupForm,formOfLemmas} from '../src/js/wiktionary.js';
import {finalizeEntry,conjugate} from '../src/js/engine.js';
const html=readFileSync(new URL('./fixtures/grafo.html',import.meta.url),'utf8');
test('cleanCell',()=>{
  assert.equal(cleanCell('γράφουμε, [γράφομε]'),'γράφουμε');
  assert.equal(cleanCell('γραφόμασταν, (γραφόμαστε)'),'γραφόμασταν');
  assert.equal(cleanCell('γραφτώ, γραφώ'),'γραφτώ / γραφώ');
  assert.equal(cleanCell('—'),'');assert.equal(cleanCell('θα γράψω ➤'),'');
  assert.equal(cleanCell('γράφουν(ε)'),'γράφουν(ε)');});
test('parse γράφω da HTML',()=>{
  const {entry,report}=parseGreekVerbHtml(html,'γράφω');
  assert.equal(entry.cls,'A');
  assert.deepEqual(entry.O.pres,['γράφω','γράφεις','γράφει','γράφουμε','γράφετε','γράφουν(ε)']);
  assert.deepEqual(entry.O.aor,['έγραψα','έγραψες','έγραψε','γράψαμε','γράψατε','έγραψαν / γράψαν(ε)']);
  assert.equal(entry.O.subj[0],'γράψω');
  assert.equal(entry.O.ppres[3],'γραφόμαστε');
  assert.equal(entry.O.paor[0],'γράφτηκα / γράφηκα');
  assert.equal(entry.O.psubj[2],'γραφτεί / γραφεί');
  assert.deepEqual(entry.O.iaor,['γράψε','γράψτε']);
  assert.deepEqual(entry.O.piaor,['γράψου','γραφτείτε / γραφείτε']);
  assert.deepEqual(entry.O.ipres,['γράφε','γράφετε']);
  assert.equal(entry.O.ptc[0],'γράφοντας');assert.equal(entry.m,'γραμμένος');
  assert.equal(entry.gloss_en,'to write, pen');
  assert.ok(!entry.O.pipres);
  assert.deepEqual(report.missing,[]);});
test('entry importata coniugabile',()=>{
  const {entry}=parseGreekVerbHtml(html,'γράφω');finalizeEntry(entry);
  const v=conjugate(entry);assert.equal(v.length,2);
  const act=v[0].cards;
  assert.equal(act.ind.find(c=>c.id==='fut2').forms[0],'θα γράψω');
  assert.equal(act.ind.find(c=>c.id==='perf').forms[0],'έχω γράψει');
  const pas=v[1].cards;
  assert.equal(pas.ind.find(c=>c.id==='perf').forms[0],'έχω γραφτεί');});
test('incolla testo con tab',()=>{
  const txt=['\tActive voice ➤ / Imperfective aspect ➤ / Present ➤\tActive voice ➤ / Perfective aspect ➤ / Dependent ➤',
   '1 sg\tκάνω\tκάνω','2 sg\tκάνεις\tκάνεις','3 sg\tκάνει\tκάνει','1 pl\tκάνουμε\tκάνουμε','2 pl\tκάνετε\tκάνετε','3 pl\tκάνουν(ε)\tκάνουν(ε)',
   '1 sg\tέκανα\tέκανα','2 sg\tέκανες\tέκανες','3 sg\tέκανε\tέκανε','1 pl\tκάναμε\tκάναμε','2 pl\tκάνατε\tκάνατε','3 pl\tέκαναν(ε)\tέκαναν(ε)'].join('\n');
  const {entry}=parsePastedText(txt,'κάνω');
  assert.equal(entry.O.aor[0],'έκανα');assert.equal(entry.O.subj[3],'κάνουμε');});
test('pagina senza tabella → errore chiaro',()=>{
  assert.throws(()=>parseGreekVerbHtml('<h2 id="Greek">Greek</h2><p>niente</p>','χ'),/non trovata/);
  assert.throws(()=>parseGreekVerbHtml('<p>x</p>','χ'),/sezione/);});
test('fetchVerb e listVerbs con fetch simulato',async()=>{
  const fake=async u=>({ok:true,json:async()=>u.includes('action=parse')?{parse:{text:html}}
    :{query:{categorymembers:[{title:'γράφω'},{title:'make up'},{title:'βλέπω'},{title:'αγάπη'}]},continue:{cmcontinue:'abc'}}});
  const r=await fetchVerb('γράφω',fake);assert.equal(r.entry.O.pres[0],'γράφω');
  const l=await listVerbs(null,fake);assert.deepEqual(l.titles,['γράφω','βλέπω']);assert.equal(l.next,'abc');});

import {normLabel} from '../src/js/wiktionary.js';
test('etichette di riga in forme diverse',()=>{
  assert.equal(normLabel('1st person singular'),'1 sg');
  assert.equal(normLabel('3rd sg.'),'3 sg');
  assert.equal(normLabel('2nd person plural'),'2 pl');
  assert.equal(normLabel('εγώ'),'1 sg');
  assert.equal(normLabel('αυτός/αυτή/αυτό'),'3 sg');
  assert.equal(normLabel('1 sg'),'1 sg');
});

import {fromHeadword} from '../src/js/headword.js';
test('verbo senza tabella: usa la riga del lemma',()=>{
  const page='<h2 id="Greek">Greek</h2><h3 id="Verb">Verb</h3><p><span class="headword-line"><strong class="Grek headword">προσανατολίζω</strong> • (<i>prosanatolízo</i>) (<i>simple past</i> <b>προσανατόλισα</b>, <i>passive</i> <b>προσανατολίζομαι</b>, <i>ppp</i> <b>προσανατολισμένος</b>)</span></p><ol><li>to orient</li></ol><h4 id="Conjugation">Conjugation</h4><p>This verb needs an inflection-table template.</p>';
  const {entry}=parseGreekVerbHtml(page,'προσανατολίζω');
  assert.ok(entry.fromHeadword);
  const {entry:e}=fromHeadword(entry);
  const act=conjugate(e).find(v=>v.id==='act');
  assert.equal(act.raw.aor[0],'προσανατόλισα');
  assert.equal(e.m,'προσανατολισμένος');
  assert.ok(conjugate(e).some(v=>v.cards.nom.some(c=>c.id==='part')));
});
test('etichette 1s/2p',()=>{assert.equal(normLabel('1s'),'1 sg');assert.equal(normLabel('3p'),'3 pl');});

import {rowsToEntry} from '../src/js/wiktionary.js';
test('tabella reale di προσαρμόζω (righe diagnostiche)',()=>{
  const lines=readFileSync(new URL('./fixtures/prosarmozo.diag.txt',import.meta.url),'utf8').split('\n').slice(5);
  const rows=lines.map(l=>l.split(' | ').map(c=>c.trim()));
  const {entry,report}=rowsToEntry(rows,'προσαρμόζω');
  const O=entry.O;
  assert.equal(entry.cls,'A');
  assert.deepEqual(O.pres,['προσαρμόζω','προσαρμόζεις','προσαρμόζει','προσαρμόζουμε','προσαρμόζετε','προσαρμόζουν(ε)']);
  assert.equal(O.subj[0],'προσαρμόσω');
  assert.equal(O.impf[0],'προσάρμοζα');
  assert.equal(O.aor[5],'προσάρμοσαν / προσαρμόσαν(ε)');
  assert.equal(O.ppres[3],'προσαρμοζόμαστε');
  assert.equal(O.psubj[0],'προσαρμοστώ / προσαρμοσθώ');
  assert.equal(O.paor[0],'προσαρμόστηκα / προσαρμόσθηκα');
  assert.deepEqual(O.ipres,['προσάρμοζε','προσαρμόζετε']);
  assert.deepEqual(O.iaor,['προσάρμοσε','προσαρμόστε']);
  assert.deepEqual(O.piaor,['προσαρμόσου','προσαρμοστείτε / προσαρμοσθείτε']);
  assert.equal(O.ptc[0],'προσαρμόζοντας');
  assert.equal(entry.m,'προσαρμοσμένος');
  assert.deepEqual(report.missing,[]);
  const e=finalizeEntry({...entry,O:JSON.parse(JSON.stringify(O))});
  assert.ok(conjugate(e).find(v=>v.id==='pass'));
});

test('varianti separate da " - " (παρακολουθώ, classe B2 con forme colloquiali)',()=>{
  const lines=readFileSync(new URL('./fixtures/parakolutho.diag.txt',import.meta.url),'utf8').split('\n').slice(5);
  const rows=lines.map(l=>l.split(' | ').map(c=>c.trim()));
  const {entry,report}=rowsToEntry(rows,'παρακολουθώ');
  assert.equal(entry.cls,'B2');
  assert.deepEqual(report.missing,[]);
  assert.equal(entry.O.pres[0],'παρακολουθώ / παρακολουθάω');
  assert.equal(entry.O.ppres[0],'παρακολουθούμαι / παρακολουθιέμαι');
  assert.equal(entry.O.impf[0],'παρακολουθούσα / παρακολούθαγα');
  assert.equal(entry.m,'παρακολουθημένος');
});

test('cleanCell: forme solo tra parentesi quadre vengono tenute, altrimenti scartate',()=>{
  assert.equal(cleanCell('[καλούμουν]'),'καλούμουν');
  assert.equal(cleanCell('[προσκαλούμουν(α)]'),'προσκαλούμουν(α)');
  assert.equal(cleanCell('καλούνταν, {καλείτο}'),'καλούνταν');
  assert.equal(cleanCell('γράφουμε, [γράφομε]'),'γράφουμε');
});

test('nota di rimando «(προλαμβάνω →)» nella cella e tabella solo attiva (προλαβαίνω)',()=>{
  const lines=readFileSync(new URL('./fixtures/prolavaino.diag.txt',import.meta.url),'utf8').split('\n').slice(5);
  const rows=lines.map(l=>l.split(' | ').map(c=>c.trim()));
  const {entry,report}=rowsToEntry(rows,'προλαβαίνω');
  assert.equal(entry.cls,'A');
  assert.deepEqual(report.missing,[]);
  assert.equal(entry.O.pres[0],'προλαβαίνω');
  assert.equal(entry.O.pres[5],'προλαβαίνουν(ε)');
  assert.equal(entry.O.aor[0],'πρόλαβα');
  assert.deepEqual(entry.O.ipres,['προλάβαινε','προλαβαίνετε']);
  assert.equal(cleanCell('προλαβαίνω (προλαμβάνω →)'),'προλαβαίνω');
  assert.equal(cleanCell('προλαβαίνουν(ε)'),'προλαβαίνουν(ε)');
});

const FORMPAGE='<h2 id="Greek">Greek</h2><h3 id="Verb">Verb</h3><p class="headword-line"><strong>προλάβαμε</strong></p><ol><li><span class="form-of-definition"><a title="simple past">simple past</a> first-person plural of <span class="form-of-definition-link"><i><a href="/wiki/x" title="προλαβαίνω">προλαβαίνω</a></i></span></span></li></ol>';
test('pagina di una forma flessa: rimanda al verbo',async()=>{
  assert.deepEqual(formOfLemmas(FORMPAGE,'προλάβαμε').map(x=>x.title),['προλαβαίνω']);
  const fake=t=>async()=>({ok:true,json:async()=>({parse:{text:t}})});
  const r=await lookupForm('προλάβαμε',fake(FORMPAGE));
  assert.equal(r.kind,'forms');assert.equal(r.lemmas[0].title,'προλαβαίνω');
  const l=await lookupForm('γράφω',fake(html));
  assert.equal(l.kind,'lemma');assert.equal(l.entry.O.pres[0],'γράφω');
});

test('forma flessa: varie scritture del rimando al verbo',()=>{
  const G='<h2 id="Greek">Greek</h2><h3 id="Verb">Verb</h3><p class="headword-line"><strong>τιμώρησα</strong></p><ol>';
  // collegamento con title (come τίμησα)
  assert.deepEqual(formOfLemmas(G+'<li>first-person singular simple past of <i><a href="/wiki/x" title="τιμωρώ">τιμωρώ</a></i> (timoró)</li></ol>','τιμώρησα').map(x=>x.title),['τιμωρώ']);
  // collegamento senza title, solo testo
  assert.deepEqual(formOfLemmas(G+'<li>first-person singular simple past of τιμωρώ (timoró)</li></ol>','τιμώρησα').map(x=>x.title),['τιμωρώ']);
  // collegamenti grammaticali ignorati, resta il verbo
  assert.deepEqual(formOfLemmas(G+'<li><a title="Appendix:Glossary">simple past</a> <a title="first person">first-person</a> singular of <a href="/wiki/y" title="τιμωρώ">τιμωρώ</a></li></ol>','τιμώρησα').map(x=>x.title),['τιμωρώ']);
  // un lemma normale non è una forma
  assert.deepEqual(formOfLemmas(G+'<li>to punish</li></ol>','τιμωρώ'),[]);
});
test('lookupForm senza risultati: errore con diagnostica',async()=>{
  const fake=async()=>({ok:true,json:async()=>({parse:{text:'<h2 id="Greek">Greek</h2><p>niente</p>'}})});
  await assert.rejects(()=>lookupForm('χχχ',fake),e=>/diag|Nessuna voce/.test(e.message)&&typeof e.diag==='string');
});

/* ---- normalizzazione preventiva dei caratteri ---- */
import {normGreek} from '../src/js/wiktionary.js';
test('normGreek: oxia, accento separato, µ, ;, trattini',()=>{
  assert.equal(normGreek('γράφω'),'γράφω');
  assert.equal(normGreek('γρα´φω'),'γράφω');
  assert.equal(normGreek('µε'),'με');
  assert.equal(normGreek('a;b'),'a;b');
  assert.equal(normGreek('a − b'),'a - b');
});
test('cleanCell: forme con varianti Unicode e lettere latine in parole greche',()=>{
  assert.equal(cleanCell('γράφω; γράφεις'),'γράφω / γράφεις');
  assert.equal(cleanCell('γράφoυν(ε)'),'γράφουν(ε)');
  assert.equal(cleanCell('γράφω − γράφεις'),'γράφω / γράφεις');
});
test('cleanCell: traslitterazioni latine e parole con lettere ambigue restano scartate',()=>{
  assert.equal(cleanCell('grafo'),'');
  assert.equal(cleanCell('γράφn'),'');
  assert.equal(cleanCell('γράφω, grafo, γράφεις'),'γράφω / γράφεις');
});
test('rowsToEntry segnala le forme corrette per caratteri latini',()=>{
  const P=['εγώ','εσύ','αυτός','εμείς','εσείς','αυτοί'];
  const rows=[['Active','Active'],...P.map((p,i)=>[p,['γράφω','γράφεις','γράφει','γράφουμε','γράφετε','γράφουν(ε)'][i].replace('ω','ω').replace('ε','e')])];
  const {report}=rowsToEntry(rows,'γράφω');
  assert.ok(report.repairs&&report.repairs.length>0);
});

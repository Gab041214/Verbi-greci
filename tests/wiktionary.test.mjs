import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseGreekVerbHtml,cleanCell,parsePastedText,textToRows,fetchVerb,listVerbs} from '../src/js/wiktionary.js';
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

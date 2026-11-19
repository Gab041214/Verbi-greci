import test from 'node:test';import assert from 'node:assert/strict';
import {LEXICON} from '../src/js/lexicon.js';
import {loadLexicon,buildIndex,keyOf,guessEntry,conjugate,parseDslLine,entryToDsl,finalizeEntry} from '../src/js/engine.js';
const list=loadLexicon(LEXICON);const idx=buildIndex(list);
const forms=(k,voice,tense)=>{const e=idx.get(keyOf(k)).e;const v=e._voices.find(x=>x.id===voice);
  const c=['ind','sub','imp'].flatMap(g=>v.cards[g]).find(c=>c.id===tense);return c&&c.forms;};
test('nessun errore sul lessico',()=>{assert.deepEqual(list.filter(e=>e._err).map(e=>e.lemma),[]);assert.ok(list.length>=150);});
test('γράφω',()=>{
  assert.deepEqual(forms('γραφω','act','aor'),['έγραψα','έγραψες','έγραψε','γράψαμε','γράψατε','έγραψαν(ε)']);
  assert.deepEqual(forms('γράφω','pass','aor')[0],'γράφτηκα');
  assert.deepEqual(forms('γράφω','act','iaor'),['γράψε','γράψτε']);});
test('irregolari',()=>{
  assert.equal(forms('βλέπω','act','aor')[0],'είδα');
  assert.equal(forms('λέω','act','saor')[3],'να πούμε');
  assert.equal(forms('πάω','act','pres')[1],'πηγαίνεις / πας');
  assert.equal(forms('έρχομαι','pass','aor')[0],'ήρθα');});
test('B1 alternative ώ/άω',()=>{assert.ok(idx.has(keyOf('αγαπάω')));assert.ok(idx.has(keyOf('αγαπώ')));});
test('DSL round-trip',()=>{const e=list.find(x=>x.lemma==='λέω');const e2=parseDslLine(entryToDsl(e));
  assert.deepEqual(e2.O,e.O);assert.equal(e2.p,e.p);});
test('ipotesi per verbo sconosciuto',()=>{const g=guessEntry('κουράζω');const v=conjugate(g);assert.ok(v.length>=1);});
test('override passivo senza radice p',()=>{
  const e=parseDslLine('δοκιμάζω | A | x | O.ppres=α,β,γ,δ,ε,ζ | O.paor=δοκιμάστηκα,1,2,3,4,5');
  const v=conjugate(e);assert.equal(v.length,2);});

import {buildFormIndex,formVariants,keyOf as kOf,loadLexicon as llex} from '../src/js/engine.js';
import {LEXICON as LEX} from '../src/js/lexicon.js';
test('indice delle forme: qualsiasi forma porta al verbo',()=>{
  const idx=buildFormIndex(llex(LEX));
  const h=idx.get(kOf('έγραψα'));
  assert.equal(h.length,1);assert.equal(h[0].e.lemma,'γράφω');assert.ok(h[0].tags[0].startsWith('aoristo'));
  assert.equal(idx.get(kOf('εγραψες'))[0].e.lemma,'γράφω');          // senza accenti
  assert.ok(idx.get(kOf('έγραψαν'))&&idx.get(kOf('έγραψανε')));      // «(ε)» facoltativa
  assert.ok(idx.get(kOf('γεννιεσαι')).length>1);                    // forma comune a più verbi
  assert.deepEqual(formVariants('έγραψαν(ε) / έγραψαν'),['έγραψαν','έγραψανε','έγραψαν']);
});

import {toJson,fromJson,bulkFromJson} from '../src/js/store.js';
test('esportazione: lo stato delle lettere viaggia nello stesso file e non disturba i verbi',()=>{
  const j=toJson([],{bulk:{'α':{complete:true,saved:3,problems:[],date:'18/11/2026'}}});
  assert.equal(fromJson(j).length,0);
  assert.equal(bulkFromJson(j)['α'].saved,3);
  assert.equal(bulkFromJson(toJson([])),null);
  assert.equal(bulkFromJson('[]'),null);
});

test('traduzione della voce passiva: esportata e reimportata',()=>{
  const e=finalizeEntry({forms:['γράφω'],cls:'A',gloss:'scrivere',gloss_p:'essere scritto',O:{}});
  const back=fromJson(toJson([e]))[0];
  assert.equal(back.gloss_p,'essere scritto');
});

import test from 'node:test';import assert from 'node:assert/strict';
import {LEXICON} from '../src/js/lexicon.js';
import {loadLexicon,buildIndex,keyOf,guessEntry,conjugate,parseDslLine,entryToDsl} from '../src/js/engine.js';
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

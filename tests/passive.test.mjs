import test from 'node:test';
import assert from 'node:assert/strict';
import {isPassTitle,activeCandidates,passiveCandidates,lacksPassive,withPassive} from '../src/js/passive.js';
import {guessEntry,conjugate,finalizeEntry} from '../src/js/engine.js';

test('forme passive riconosciute', () => {
  assert.ok(isPassTitle('χορεύομαι'));assert.ok(isPassTitle('αγαπιέμαι'));assert.ok(!isPassTitle('χορεύω'));
});
test('dal passivo all\'attivo', () => {
  assert.deepEqual(activeCandidates('χορεύομαι'),['χορεύω']);
  assert.ok(activeCandidates('οδηγούμαι').includes('οδηγώ'));
  assert.ok(activeCandidates('αγαπιέμαι').includes('αγαπώ'));
  assert.deepEqual(activeCandidates('γράφω'),[]);
});
test('dall\'attivo al passivo', () => {
  assert.deepEqual(passiveCandidates('χορεύω'),['χορεύομαι']);
  assert.equal(passiveCandidates('οδηγώ','B2')[0],'οδηγούμαι');
  assert.equal(passiveCandidates('αγαπώ','B1')[0],'αγαπιέμαι');
  assert.equal(passiveCandidates('αγαπάω')[0],'αγαπιέμαι');
});
test('voce passiva aggiunta con le regole', () => {
  const e=finalizeEntry(guessEntry('χορεύω'));
  e.O={};
  const ne=withPassive(e,'χορεύομαι');
  assert.ok(ne);
  const v=conjugate(ne);
  assert.ok(v.some(x=>x.id==='pass'));
  assert.equal(v.find(x=>x.id==='pass').raw.pres[0],'χορεύομαι');
  assert.ok(!e.O.ppres);   // l'originale non cambia
});
test('lacksPassive', () => {
  const e=finalizeEntry({...guessEntry('χορεύω'),p:undefined});
  e.O={};delete e.p;
  const withp=withPassive(e,'χορεύομαι');
  if(lacksPassive(e))assert.ok(!lacksPassive(withp));
  assert.ok(!lacksPassive(finalizeEntry(guessEntry('έρχομαι'))));
});
import {withoutPassive,hasPassive} from '../src/js/passive.js';
test('senza voce passiva', () => {
  const e=finalizeEntry({...guessEntry('χρονίζω')});
  assert.ok(hasPassive(e));
  const n=withoutPassive(e);
  assert.ok(!hasPassive(n));
  assert.ok(hasPassive(e));   // l'originale non cambia
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {guessEntry,conjugate} from '../src/js/engine.js';
import {cascadeForms} from '../src/js/cascade.js';

const raw=(w,f,cls)=>conjugate(guessEntry(w,cls)).find(v=>v.id==='act').raw[f];

test('aoristo di υποβάλλω: corretta la 1ª persona, le altre seguono',()=>{
  assert.deepEqual(cascadeForms(raw('υποβάλλω','aor'),'υπέβαλα'),
    ['υπέβαλα','υπέβαλες','υπέβαλε','υπεβάλαμε','υπεβάλατε','υπέβαλαν(ε)']);
});
test('aoristo di υφαίνω',()=>{
  const r=cascadeForms(raw('υφαίνω','aor'),'ύφανα');
  assert.equal(r[0],'ύφανα');assert.equal(r[2],'ύφανε');assert.equal(r[3],'υφάναμε');
});
test('presente: correzione della radice, con (ε) e accento sulla desinenza',()=>{
  const r=cascadeForms(['τιμώ','τιμάς','τιμά','τιμούμε','τιμάτε','τιμούν(ε)'],'χτιμώ');
  assert.deepEqual(r,['χτιμώ','χτιμάς','χτιμά','χτιμούμε','χτιμάτε','χτιμούν(ε)']);
});
test('non riesco se la desinenza della 1ª persona non è quella attesa',()=>{
  assert.equal(cascadeForms(raw('υποβάλλω','aor'),'υπέβαλε'),null);
});

import {finalizeEntry} from '../src/js/engine.js';
test('aoristo passivo corretto: congiuntivo, infinito e imperativo ne ricavano la radice',()=>{
  const g=guessEntry('υποβάλλω');
  const e=finalizeEntry({...g,O:{...g.O,paor:['υποβλήθηκα','υποβλήθηκες','υποβλήθηκε','υποβληθήκαμε','υποβληθήκατε','υποβλήθηκαν(ε)']}});
  const p=conjugate(e).find(v=>v.id==='pass');
  assert.equal(p.raw.aor[0],'υποβλήθηκα');
  assert.equal(p.raw.subj[0],'υποβληθώ');
  assert.equal(p.raw.subj[5],'υποβληθούν(ε)');
  assert.equal(p.raw.inf,'υποβληθεί');
});
test('se il congiuntivo passivo è già scritto, resta com\'è',()=>{
  const g=guessEntry('υποβάλλω');
  const e=finalizeEntry({...g,O:{...g.O,paor:['υποβλήθηκα','υποβλήθηκες','υποβλήθηκε','υποβληθήκαμε','υποβληθήκατε','υποβλήθηκαν(ε)'],psubj:['Α','Β','Γ','Δ','Ε','Ζ']}});
  assert.equal(conjugate(e).find(v=>v.id==='pass').raw.subj[0],'Α');
});

test('più varianti nella 1ª persona: le altre persone le seguono', () => {
  const old=['ζούλησα','ζούλησες','ζούλησε','ζουλήσαμε','ζουλήσατε','ζούλησαν(ε)'];
  const r=cascadeForms(old,'ζούλησα / ζούληξα');
  assert.deepEqual(r,['ζούλησα / ζούληξα','ζούλησες / ζούληξες','ζούλησε / ζούληξε','ζουλήσαμε / ζουλήξαμε','ζουλήσατε / ζουλήξατε','ζούλησαν(ε) / ζούληξαν(ε)']);
  assert.equal(cascadeForms(old,'ζούλησα / foo'),null);
});

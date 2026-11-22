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

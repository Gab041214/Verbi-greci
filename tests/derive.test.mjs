import test from 'node:test';import assert from 'node:assert/strict';
import {loadLexicon,conjugate} from '../src/js/engine.js';
import {LEXICON} from '../src/js/lexicon.js';
import {deriveEntry,prefixForm,splitPrefix} from '../src/js/derive.js';
const LEX=loadLexicon(LEXICON);
const raw=e=>JSON.stringify(conjugate(e).map(v=>[v.id,v.raw]));

test('deriveEntry senza prefisso riproduce esattamente la coniugazione di tutti i verbi del lessico',()=>{
  for(const b of LEX){const d=deriveEntry(b,'');assert.ok(d,b.lemma);assert.equal(raw(d),raw(b),b.lemma);}
});
test('prefixForm: aumento dentro la parola, accento sulle forme di una sillaba, varianti e (ε)',()=>{
  const f=x=>prefixForm('ξανα',x);
  assert.equal(f('έβλεπα'),'ξαναέβλεπα');
  assert.equal(f('διάβασα'),'ξαναδιάβασα');
  assert.equal(f('δες'),'ξαναδές');
  assert.equal(f('δω'),'ξαναδώ');
  assert.equal(f('δουν(ε)'),'ξαναδούν(ε)');
  assert.equal(f('γράφεις / γραφόσαστε'),'ξαναγράφεις / ξαναγραφόσαστε');
});
test('ξαναδιαβάζω e ξαναβλέπω derivati da διαβάζω e βλέπω',()=>{
  const d=deriveEntry(LEX.find(e=>e.lemma==='διαβάζω'),'ξανα');
  const [act,pass]=conjugate(d);
  assert.equal(act.raw.aor[0],'ξαναδιάβασα');
  assert.equal(act.raw.iaor[0],'ξαναδιάβασε');
  assert.equal(pass.raw.aor[0],'ξαναδιαβάστηκα');
  const v=deriveEntry(LEX.find(e=>e.lemma==='βλέπω'),'ξανα');
  const a=conjugate(v)[0];
  assert.equal(a.raw.subj[0],'ξαναδώ');assert.equal(a.raw.iaor[0],'ξαναδές');
});
test('splitPrefix riconosce ξανα- solo con un verbo dopo',()=>{
  assert.deepEqual(splitPrefix('ξαναβλέπω'),{prefix:'ξανα',rest:'βλέπω'});
  assert.equal(splitPrefix('ξανα'),null);assert.equal(splitPrefix('γράφω'),null);
});

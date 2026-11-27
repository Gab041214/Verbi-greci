import test from 'node:test';
import assert from 'node:assert/strict';
import {fromHeadword} from '../src/js/headword.js';
import {conjugate} from '../src/js/engine.js';

const pass=e=>conjugate(e).find(v=>v.id==='pass');

test('υποθέτω: passivo υποτίθεμαι dalla riga del lemma (famiglia di τίθεμαι)',()=>{
  const {entry,notes}=fromHeadword({forms:['υποθέτω'],fromHeadword:{past:'υπέθεσα',passive:'υποτίθεμαι'}});
  const p=pass(entry);
  assert.equal(p.raw.pres[0],'υποτίθεμαι');
  assert.equal(p.raw.impf[0],'υποτιθόμουν(α)');
  assert.equal(p.raw.aor[0],'υποτέθηκα');
  assert.ok(notes.some(n=>/τίθεμαι/.test(n)));
});
test('passivo regolare indicato dalla riga del lemma: nessuna modifica',()=>{
  const {entry}=fromHeadword({forms:['ζουλάω'],fromHeadword:{past:'ζούληξα',passive:'ζουλιέμαι'}},'B1');
  assert.equal(pass(entry).raw.pres[0],'ζουλιέμαι');
});
test('passivo che le regole non producono: nessuna voce passiva inventata',()=>{
  const r=fromHeadword({forms:['πλέκω'],fromHeadword:{passive:'πλέγομαι'}});
  assert.equal(pass(r.entry),undefined);
  assert.ok(r.notes.some(n=>/Correggi forme/.test(n)));
});

test('προσθέτω: passivo προστίθεμαι/προσθέτομαι, entrambe le forme',()=>{
  const {entry}=fromHeadword({forms:['προσθέτω'],fromHeadword:{past:'πρόσθεσα',passive:'προστίθεμαι',passives:['προστίθεμαι','προσθέτομαι']}});
  const p=pass(entry);
  assert.equal(p.raw.pres[0],'προστίθεμαι / προσθέτομαι');
  assert.equal(p.raw.pres[1],'προστίθεσαι / προσθέτεσαι');
  assert.equal(p.raw.aor[0],'προστέθηκα');
});

test('deponente: aoristo dalla riga del lemma (καταριέμαι → καταράστηκα)', () => {
  const r=fromHeadword({forms:['καταριέμαι'],cls:null,gloss:'',O:{},fromHeadword:{past:'καταράστηκα',pasts:['καταράστηκα'],ppp:'καταραμένος'}});
  const v=conjugate(r.entry).find(x=>x.id==='pass');
  assert.equal(v.raw.aor[0],'καταράστηκα');
  assert.equal(v.raw.subj[0],'καταραστώ');
});

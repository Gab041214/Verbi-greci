import test from 'node:test';
import assert from 'node:assert/strict';
const store={};
globalThis.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}};
const m=await import('../src/js/marks.js');

test('segna, controlla e conta', ()=>{
  m.clearAll();
  assert.equal(m.count('υποβαλλω'),0);
  m.set('υποβαλλω',m.markKey('act','iaor',1),true);
  m.set('υποβαλλω',m.markKey('act','iaor',1),true);
  assert.equal(m.count('υποβαλλω'),1);
  assert.ok(m.has('υποβαλλω','act:iaor:1'));
  assert.ok(!m.has('υποβαλλω','act:iaor:0'));
  m.set('υποβαλλω','act:iaor:1',false);
  assert.equal(m.count('υποβαλλω'),0);
  assert.deepEqual(m.entries(),[]);
});

test('segni di molte forme insieme', ()=>{
  m.clearAll();
  m.setMany('α',['act:aor:0','act:aor:1','pass:aor:0'],true);
  assert.equal(m.count('α'),3);
  m.setMany('α',['act:aor:0'],false);
  assert.equal(m.count('α'),2);
  m.setMany('α',[],false);
  assert.equal(m.count('α'),0);
});

test('i segni si salvano e si ricaricano', ()=>{
  m.clearAll();
  m.set('β','act:pres:2',true);
  m._reload();
  assert.ok(m.has('β','act:pres:2'));
  assert.deepEqual(m.toObject(),{'β':['act:pres:2']});
});

test('importazione: unisce senza togliere', ()=>{
  m.clearAll();
  m.set('γ','act:aor:0',true);
  const n=m.merge({'γ':['act:aor:0','act:aor:1'],'δ':['pass:saor:3'],'ε':'non valido'});
  assert.equal(n,2);
  assert.equal(m.count('γ'),2);
  assert.equal(m.count('δ'),1);
  assert.equal(m.count('ε'),0);
  assert.equal(m.merge(null),0);
});

test('lettura dal file JSON', ()=>{
  assert.deepEqual(m.fromJson('{"entries":[],"chk":{"α":["act:aor:0"]}}'),{'α':['act:aor:0']});
  assert.equal(m.fromJson('{"entries":[]}'),null);
  assert.equal(m.fromJson('non json'),null);
  assert.equal(m.fromJson('[]'),null);
});

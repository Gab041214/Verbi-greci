import test from 'node:test';
import assert from 'node:assert/strict';
import {needsReview,buildRows,toCsv,toTsv,parseTable,planImport} from '../src/js/translations.js';

const U=(lemma,gloss,en)=>({lemma,gloss,gloss_en:en,_origin:'user'});

test('riconosce i verbi con la traduzione solo inglese', ()=>{
  assert.ok(needsReview(U('γράφω','to write','to write')));
  assert.ok(!needsReview(U('γράφω','scrivere','to write')));
  assert.ok(!needsReview({lemma:'α',gloss:'x',gloss_en:'x',_origin:'base'}));
  assert.ok(!needsReview(U('α','x',undefined)));
});

test('righe in ordine alfabetico, con la voce passiva dove c\'è', ()=>{
  const l=[U('ωρύομαι','howl','howl'),U('βλέπω','see','see'),U('άδω','x','y'),U('θέτω','put','put')];
  const rows=buildRows(l,e=>e.lemma==='βλέπω'?'βλέπομαι':'');
  assert.deepEqual(rows.map(r=>r[0]),['βλέπω','θέτω','ωρύομαι']);
  assert.deepEqual(rows[0],['βλέπω','see','','βλέπομαι','']);
});

test('CSV: punto e virgola, virgolette, intestazione', ()=>{
  const c=toCsv([['α','to say; to tell','','','']]);
  assert.equal(c,'verbo;inglese;italiano;voce passiva;italiano passivo\r\nα;"to say; to tell";;;\r\n');
  assert.equal(toTsv([['α','a\tb','','','']]).split('\n')[1],'α\ta b\t\t\t');
});

test('lettura: separatore riconosciuto da solo', ()=>{
  const A=parseTable('﻿verbo;inglese;italiano\r\nα;"say; tell";dire\r\n');
  assert.deepEqual(A,[['verbo','inglese','italiano'],['α','say; tell','dire']]);
  const B=parseTable('verbo\tinglese\titaliano\nα\tsay\tdire\n');
  assert.deepEqual(B[1],['α','say','dire']);
  const C=parseTable('verbo,inglese,italiano\nα,"to say, to tell",dire\n');
  assert.deepEqual(C[1],['α','to say, to tell','dire']);
  const D=parseTable('α;"ha ""virgolette""";dire\n\n');
  assert.deepEqual(D,[['α','ha "virgolette"','dire']]);
});

test('piano di importazione', ()=>{
  const A=U('α','say','say'),B=U('β','see','see'),C=U('γ','put','put');
  A.gloss_p=undefined;
  const find=l=>({α:A,β:B,γ:C})[l]||null;
  const hasPass=e=>e!==B;
  const rows=parseTable([
    'verbo;inglese;italiano;voce passiva;italiano passivo',
    'α;say;dire;αμ;essere detto',
    'β;see;vedere;;',
    'γ;put;;;',
    'δ;x;boh;;',
    'ε;x;;;'
  ].join('\n'));
  const p=planImport(rows,find,hasPass);
  assert.equal(p.nIt,2);
  assert.equal(p.nPass,1);
  assert.equal(p.empty,2);       // γ ed ε non hanno nessuna traduzione scritta
  assert.deepEqual(p.missing,['δ']);
  assert.equal(p.changes.length,2);
  assert.equal(p.changes[0].gloss,'dire');
  assert.equal(p.changes[0].gloss_p,'essere detto');
  assert.equal(p.changes[1].gloss_p,null);
});

test('piano: righe uguali, passivo su verbo senza passivo, formato errato', ()=>{
  const A=U('α','dire','say');
  const find=()=>A;
  const p=planImport(parseTable('α;say;dire;;\n'),find,()=>true);
  assert.equal(p.unchanged,1);assert.equal(p.changes.length,0);
  const q=planImport(parseTable('α;say;dire;;x\n'),()=>A,()=>false);
  assert.equal(q.passIgnored,1);assert.equal(q.nPass,0);
  const r=planImport(parseTable('α\nβ\n'),find,()=>true);
  assert.ok(r.badFormat);
});
import {needsReview as nr} from '../src/js/translations.js';
test('anche i verbi senza traduzione sono da rivedere', () => {
  assert.ok(nr({_origin:'user',gloss:'',gloss_en:undefined}));
  assert.ok(nr({_origin:'user',gloss:'to stink',gloss_en:'to stink'}));
  assert.ok(!nr({_origin:'user',gloss:'puzzare',gloss_en:'to stink'}));
  assert.ok(!nr({_origin:'base',gloss:''}));
});

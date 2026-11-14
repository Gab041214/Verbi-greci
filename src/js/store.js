/* Archivio dell'utente (verbi importati, inseriti a mano o corretti) in IndexedDB.
   Se IndexedDB non è disponibile i dati restano solo in memoria per la sessione. */
import {keyOf,serializeEntry} from './engine.js';
const DB='gv-user',ST='entries';
let db=null;const mem=new Map();
const req=r=>new Promise((ok,ko)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error);});
export async function init(){
  try{
    db=await new Promise(ok=>{
      const r=indexedDB.open(DB,1);
      r.onupgradeneeded=()=>r.result.createObjectStore(ST,{keyPath:'id'});
      r.onsuccess=()=>ok(r.result);r.onerror=()=>ok(null);r.onblocked=()=>ok(null);
    });
  }catch(_){db=null;}
  return !!db;
}
export const persistent=()=>!!db;
export async function getAll(){
  if(!db)return [...mem.values()];
  return req(db.transaction(ST).objectStore(ST).getAll());
}
export async function put(entry){
  const rec={id:keyOf(entry.forms[0]),...serializeEntry(entry)};
  if(!db){mem.set(rec.id,rec);return rec;}
  await req(db.transaction(ST,'readwrite').objectStore(ST).put(rec));
  return rec;
}
export async function del(id){
  if(!db){mem.delete(id);return;}
  await req(db.transaction(ST,'readwrite').objectStore(ST).delete(id));
}
export async function clearAll(){
  if(!db){mem.clear();return;}
  await req(db.transaction(ST,'readwrite').objectStore(ST).clear());
}
export function toJson(entries){
  return JSON.stringify({version:1,exported:new Date().toISOString().slice(0,10),entries:entries.map(serializeEntry)},null,1);
}
export function fromJson(text){
  const j=JSON.parse(text);
  const arr=Array.isArray(j)?j:j.entries;
  if(!Array.isArray(arr))throw new Error('Formato non riconosciuto');
  return arr.filter(e=>e&&Array.isArray(e.forms)&&e.forms[0]&&e.cls);
}

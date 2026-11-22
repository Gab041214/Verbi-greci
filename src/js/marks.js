/* Segni «da controllare» sulle singole forme. Sono tenuti a parte rispetto ai verbi (così valgono
   anche per i verbi del lessico), nel browser (localStorage) e nel file JSON di esportazione.
   Un segno è una stringa «voce:scheda:posizione», es. «act:iaor:1» = imperativo aoristo, εσείς. */
const K='vg-chk';
const mem={};
const ls=()=>{try{return globalThis.localStorage||null;}catch(_){return null;}};
function load(){
  try{
    const s=ls();const raw=s?s.getItem(K):null;
    const o=raw?JSON.parse(raw):{};
    return o&&typeof o==='object'&&!Array.isArray(o)?o:{};
  }catch(_){return {};}
}
let M=load();
function save(){
  for(const k of Object.keys(M))if(!M[k].length)delete M[k];
  try{const s=ls();if(s)s.setItem(K,JSON.stringify(M));}catch(_){Object.assign(mem,M);}
}
export const markKey=(voice,card,i)=>voice+':'+card+':'+(i||0);
export const has=(id,k)=>!!(M[id]&&M[id].includes(k));
export const count=id=>M[id]?M[id].length:0;
export const entries=()=>Object.keys(M).filter(k=>M[k].length);
export function set(id,k,on){
  const a=M[id]||(M[id]=[]);const i=a.indexOf(k);
  if(on&&i<0)a.push(k);if(!on&&i>=0)a.splice(i,1);
  save();
}
/* segna (on=true) o toglie i segni di molte forme insieme; con on=false e keys vuoto toglie tutto */
export function setMany(id,keys,on){
  if(on){const a=M[id]||(M[id]=[]);for(const k of keys)if(!a.includes(k))a.push(k);}
  else if(!keys||!keys.length)delete M[id];
  else if(M[id])M[id]=M[id].filter(k=>!keys.includes(k));
  save();
}
export function clearEntry(id){delete M[id];save();}
export function clearAll(){M={};save();}
/* per l'esportazione e l'importazione: l'importazione unisce i segni, non toglie niente */
export const toObject=()=>{const o={};for(const k of Object.keys(M))if(M[k].length)o[k]=[...M[k]];return o;};
export function merge(obj){
  let n=0;
  if(!obj||typeof obj!=='object'||Array.isArray(obj))return 0;
  for(const [id,arr] of Object.entries(obj)){
    if(!Array.isArray(arr))continue;
    const a=M[id]||(M[id]=[]);
    for(const k of arr)if(typeof k==='string'&&!a.includes(k)){a.push(k);n++;}
  }
  save();return n;
}
export function fromJson(text){
  try{const j=JSON.parse(text);return j&&!Array.isArray(j)&&j.chk&&typeof j.chk==='object'?j.chk:null;}catch(_){return null;}
}
/* solo per i test: ricarica dal localStorage */
export function _reload(){M=load();}

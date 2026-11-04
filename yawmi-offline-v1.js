/* YAWMI Offline V1. Per-account IndexedDB snapshot + 3-way conflict-aware merge.
   Never caches passwords, Supabase credentials, or other people's data. */
(()=>{'use strict';
const DB='yawmi_offline_v1',TABLE='account_docs';
let dbPromise;
function database(){
 if(!('indexedDB' in window))return Promise.reject(new Error('INDEXEDDB_UNAVAILABLE'));
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{
  const r=indexedDB.open(DB,1);
  r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(TABLE))db.createObjectStore(TABLE)};
  r.onsuccess=()=>resolve(r.result);
  r.onerror=()=>reject(r.error||new Error('INDEXEDDB_OPEN_FAILED'));
 });
 return dbPromise;
}
async function operation(uid,kind,method,value){
 if(!uid||!['confirmed','pending'].includes(kind))return null;
 const db=await database();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(TABLE,method==='get'?'readonly':'readwrite');
  const store=tx.objectStore(TABLE),key=uid+':'+kind;
  const r=method==='get'?store.get(key):method==='put'?store.put(value,key):store.delete(key);
  r.onsuccess=()=>resolve(r.result??null);
  r.onerror=()=>reject(r.error||new Error('INDEXEDDB_WRITE_FAILED'));
  tx.onerror=()=>reject(tx.error||new Error('INDEXEDDB_TRANSACTION_FAILED'));
 });
}
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const isPlain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function keyed(arr){
 if(!Array.isArray(arr)||!arr.every(x=>isPlain(x)&&typeof x.id==='string'&&x.id.length>0))return false;
 return new Set(arr.map(x=>x.id)).size===arr.length;
}
function threeWay(base,local,remote){
 const conflicts=[];
 function walk(a,b,c,path){
  if(same(b,a))return clone(c);
  if(same(c,a)||same(b,c))return clone(b);
  if(isPlain(a)&&isPlain(b)&&isPlain(c)){
   const out={};for(const key of new Set([...Object.keys(a),...Object.keys(b),...Object.keys(c)])){
    const val=walk(a[key],b[key],c[key],path+'.'+key);
    if(val!==undefined)out[key]=val;
   }return out;
  }
  if(Array.isArray(a)&&Array.isArray(b)&&Array.isArray(c)&&keyed(a)&&keyed(b)&&keyed(c)){
   const A=new Map(a.map(x=>[x.id,x])),B=new Map(b.map(x=>[x.id,x])),C=new Map(c.map(x=>[x.id,x]));
   const order=[...new Set([...c.map(x=>x.id),...b.map(x=>x.id)])],out=[];
   for(const key of order){
    const merged=walk(A.get(key),B.get(key),C.get(key),path+'['+key+']');
    if(merged!==undefined)out.push(merged);
   }return out;
  }
  conflicts.push(path);
  return clone(b);
 }
 const data=walk(base,local,remote,'root');
 return {data,conflicts};
}
window.YawmiOffline={
 putConfirmed:(uid,data,revision)=>operation(uid,'confirmed','put',{data:clone(data),revision:Number(revision)||0,updatedAt:Date.now()}),
 getConfirmed:uid=>operation(uid,'confirmed','get'),
 putPending:(uid,data,revision)=>operation(uid,'pending','put',{data:clone(data),base:Number(revision)||0,updatedAt:Date.now()}),
 getPending:uid=>operation(uid,'pending','get'),
 clearPending:uid=>operation(uid,'pending','delete'),
 clearUser:async uid=>{await operation(uid,'pending','delete');await operation(uid,'confirmed','delete')},
 threeWay
};
})();
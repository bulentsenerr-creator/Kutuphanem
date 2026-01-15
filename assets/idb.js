// IndexedDB (Kapaklar)
const IDB_NAME = 'kutuphanem_pro_max';
const IDB_VER = 1;
const STORE_COVERS = 'covers';
let idbPromise = null;
const coverUrlCache = new Map();

function openIDB(){
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve, reject)=>{
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = ()=>{
      const db = req.result;
      if(!db.objectStoreNames.contains(STORE_COVERS)) db.createObjectStore(STORE_COVERS);
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
  return idbPromise;
}

async function idbPutCover(key, blob){
  const dbi = await openIDB();
  return new Promise((resolve, reject)=>{
    const tx = dbi.transaction(STORE_COVERS, 'readwrite');
    tx.objectStore(STORE_COVERS).put(blob, key);
    tx.oncomplete = ()=> resolve(true);
    tx.onerror = ()=> reject(tx.error);
  });
}

async function idbGetCover(key){
  const dbi = await openIDB();
  return new Promise((resolve, reject)=>{
    const tx = dbi.transaction(STORE_COVERS, 'readonly');
    const req = tx.objectStore(STORE_COVERS).get(key);
    req.onsuccess = ()=> resolve(req.result || null);
    req.onerror = ()=> reject(req.error);
  });
}

async function idbDelCover(key){
  const dbi = await openIDB();
  return new Promise((resolve, reject)=>{
    const tx = dbi.transaction(STORE_COVERS, 'readwrite');
    tx.objectStore(STORE_COVERS).delete(key);
    tx.oncomplete = ()=> resolve(true);
    tx.onerror = ()=> reject(tx.error);
  });
}

function revokeCoverUrl(key){
  if(coverUrlCache.has(key)){
    try{ URL.revokeObjectURL(coverUrlCache.get(key)); }catch(e){}
    coverUrlCache.delete(key);
  }
}

function newCoverKey(){
  return 'c_'+Date.now()+'_'+Math.random().toString(16).slice(2);
}

async function dataUrlToBlob(dataUrl){
  const res = await fetch(dataUrl);
  return await res.blob();
}

async function blobToDataUrl(blob){
  return new Promise((resolve)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(r.result);
    r.readAsDataURL(blob);
  });
}

async function ensureCoverSrc(book){
  if(!book || !book.coverKey) return null;
  const key = book.coverKey;
  if(coverUrlCache.has(key)) return coverUrlCache.get(key);
  const blob = await idbGetCover(key);
  if(!blob) return null;
  const url = URL.createObjectURL(blob);
  coverUrlCache.set(key, url);
  return url;
}

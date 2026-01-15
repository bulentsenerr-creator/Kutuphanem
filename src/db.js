const DB_NAME = 'kitapKutuphaneDB';
const DB_VER = 1;
const STORE = 'items';

function openDb(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      const store = db.createObjectStore(STORE, { keyPath: 'edition.isbn13' });
      store.createIndex('byAddedAt', 'userCopy.addedAt');
      store.createIndex('byPublisher', 'edition.publisher');
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}

export async function putItem(item){
  const db = await openDb();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete=()=> resolve(true);
    tx.onerror=()=> reject(tx.error);
  });
}

export async function getItem(isbn13){
  const db = await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly');
    const req=tx.objectStore(STORE).get(isbn13);
    req.onsuccess=()=> resolve(req.result || null);
    req.onerror=()=> reject(req.error);
  });
}

export async function getAllItems(){
  const db = await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly');
    const req=tx.objectStore(STORE).getAll();
    req.onsuccess=()=> resolve(req.result || []);
    req.onerror=()=> reject(req.error);
  });
}

export async function deleteItem(isbn13){
  const db = await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).delete(isbn13);
    tx.oncomplete=()=> resolve(true);
    tx.onerror=()=> reject(tx.error);
  });
}

export async function clearAll(){
  const db = await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete=()=> resolve(true);
    tx.onerror=()=> reject(tx.error);
  });
}

export async function exportJson(){
  const items = await getAllItems();
  return JSON.stringify({ exportedAt: new Date().toISOString(), items }, null, 2);
}

export async function importJson(obj){
  if(!obj || !Array.isArray(obj.items)) throw new Error('Geçersiz JSON');
  for(const it of obj.items){
    if(it?.edition?.isbn13) await putItem(it);
  }
  return true;
}

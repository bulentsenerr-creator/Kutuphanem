// Statik SW kaydı (dosyalı PWA)
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{ navigator.serviceWorker.register('./sw.js').catch(()=>{}); });
}


)());
      });`;
      const blob = new Blob([swCode], { type: 'text/javascript' });
      navigator.serviceWorker.register(URL.createObjectURL(blob)).catch(()=>{});
    } catch(e) {}
  });
}
/*** Data / Keys ***/
const STORAGE_KEY = 'pro_lib_v12';
const OLD_KEY = 'pro_lib_v11';
const $ = id => document.getElementById(id);
const PLACEHOLDER = 'https://via.placeholder.com/150x200?text=Kapak+Yok';
let db = [];
let editingId = null;
let currentShelf = 'Tümü';
/*** IDB (Covers) ***/
const IDB_NAME = 'kutuphanem_pro_max';
const IDB_VER = 1;
const STORE_COVERS = 'covers';
let idbPromise = null;
const coverUrlCache = new Map();
function openIDB(){ if (idbPromise) return idbPromise; idbPromise = new Promise((resolve, reject)=>{ const req = indexedDB.open(IDB_NAME, IDB_VER); req.onupgradeneeded=()=>{ const db=req.result; if(!db.objectStoreNames.contains(STORE_COVERS)) db.createObjectStore(STORE_COVERS); }; req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); }); return idbPromise; }
async function idbPutCover(key, blob){ const dbi = await openIDB(); return new Promise((resolve, reject)=>{ const tx = dbi.transaction(STORE_COVERS,'readwrite'); tx.objectStore(STORE_COVERS).put(blob, key); tx.oncomplete=()=>resolve(true); tx.onerror=()=>reject(tx.error); }); }
async function idbGetCover(key){ const dbi = await openIDB(); return new Promise((resolve, reject)=>{ const tx = dbi.transaction(STORE_COVERS,'readonly'); const req = tx.objectStore(STORE_COVERS).get(key); req.onsuccess=()=>resolve(req.result || null); req.onerror=()=>reject(req.error); }); }
async function idbDelCover(key){ const dbi = await openIDB(); return new Promise((resolve, reject)=>{ const tx = dbi.transaction(STORE_COVERS,'readwrite'); tx.objectStore(STORE_COVERS).delete(key); tx.oncomplete=()=>resolve(true); tx.onerror=()=>reject(tx.error); }); }
function revokeCoverUrl(key){ if(coverUrlCache.has(key)){ try{ URL.revokeObjectURL(coverUrlCache.get(key)); }catch(e){} coverUrlCache.delete(key); } }
function newCoverKey(){ return 'c_'+Date.now()+'_'+Math.random().toString(16).slice(2); }
async function dataUrlToBlob(dataUrl){ const res = await fetch(dataUrl); return await res.blob(); }
async function blobToDataUrl(blob){ return new Promise((resolve)=>{ const r = new FileReader(); r.onload=()=>resolve(r.result); r.readAsDataURL(blob); }); }
async function ensureCoverSrc(book){ if(!book || !book.coverKey) return null; const key = book.coverKey; if(coverUrlCache.has(key)) return coverUrlCache.get(key); const blob = await idbGetCover(key); if(!blob) return null; const url = URL.createObjectURL(blob); coverUrlCache.set(key, url); return url; }
/*** Utils ***/
function escapeHTML(str){ return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function htmlToText(maybeHtml){ const s=(maybeHtml ?? '').toString(); if(!s) return ''; if(!(s.includes('<') && s.includes('>'))) return s; try{ const doc = new DOMParser().parseFromString(s,'text/html'); doc.querySelectorAll('br').forEach(br=>br.replaceWith('\n')); doc.querySelectorAll('p').forEach(p=>p.append('\n')); return (doc.body.textContent || '').replace(/\n{3,}/g,'\n\n').trim(); }catch(e){ return s; } }
function statusClass(st){ if(st==='Okundu') return 'st-okundu'; if(st==='Okunuyor') return 'st-okunuyor'; return 'st-okunacak'; }
function normalizeBook(b){ const nb = { id: b.id || Date.now(), title: b.title || '', author: b.author || '', isbn: b.isbn || '', publisher: b.publisher || '', pubYear: Number.isFinite(b.pubYear)? b.pubYear : (parseInt(b.pubYear)||0), pageCount: Number.isFinite(b.pageCount)? b.pageCount : (parseInt(b.pageCount)||0), shelf: (b.shelf||'Rafsız').toString().trim() || 'Rafsız', format: b.format || 'Ciltsiz', price: Number.isFinite(b.price)? b.price : (parseFloat(b.price)||0), pDate: b.pDate || '', purchasePlace: b.purchasePlace || '', desc: b.desc || '', img: b.img || '', coverKey: b.coverKey || null, language: b.language || '', categories: Array.isArray(b.categories)? b.categories : (typeof b.categories==='string'? b.categories.split(',').map(x=>x.trim()).filter(Boolean):[]), notes: b.notes || '', status: b.status || 'Okunacak', addedAt: b.addedAt || new Date().getTime() }; if(!nb.img && !nb.coverKey) nb.img = PLACEHOLDER; return nb; }
function loadDB(){ let raw = localStorage.getItem(STORAGE_KEY); if(!raw) raw = localStorage.getItem(OLD_KEY); try{ const parsed = raw ? JSON.parse(raw) : []; db = Array.isArray(parsed)? parsed.map(normalizeBook) : []; } catch(e){ db = []; } localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }
function saveDB(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }
/*** Nav / Form ***/
function goHome(){ currentShelf='Tümü'; $('liveSearch').value=''; render(); window.scrollTo({top:0, behavior:'smooth'}); }
function toggleForm(){ $('extraFields').classList.toggle('hidden'); $('addBtn').classList.toggle('hidden'); }
function cancelEdit(){ editingId = null; resetForm(); if(!$('extraFields').classList.contains('hidden')) toggleForm(); }
function setShelf(s){ currentShelf = s; render(); }
/*** ISBN Fetch ***/
async function fetchBook(){ const raw = $('isbnSearch').value; const isbn = raw.replace(/\D/g,''); if(!isbn){ alert('ISBN girilmedi.'); return; } const prev = $('isbnSearch').value; $('isbnSearch').value = 'Sorgulanıyor...'; try { const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`); const d = await r.json(); if(d.items && d.items.length){ const i = d.items[0].volumeInfo; if($('extraFields').classList.contains('hidden')) toggleForm(); $('title').value = i.title || ''; $('author').value = i.authors ? i.authors.join(', ') : ''; $('isbnFinal').value = isbn; $('publisher').value = i.publisher || ''; $('pubYear').value = i.publishedDate ? (i.publishedDate.split('-')[0] || '') : ''; $('pageCount').value = i.pageCount || ''; $('desc').value = i.description || ''; $('language').value = i.language ? i.language.toUpperCase() : ''; $('categories').value = Array.isArray(i.categories) ? i.categories.join(', ') : ''; $('notes').value = ''; $('status').value = 'Okunacak'; let thumb = i.imageLinks ? (i.imageLinks.thumbnail || i.imageLinks.smallThumbnail) : ''; if(!thumb){ // OpenLibrary fallback
   const ol = await tryOpenLibCover(isbn); thumb = ol || ''; }
 $('coverImg').value = thumb ? thumb.replace('http:','https:') : ''; $('isbnSearch').value = isbn; }
 else { alert('Bulunamadı.'); $('isbnSearch').value = prev.replace('Sorgulanıyor...','') || isbn; }
 } catch(e){ alert('Bağlantı Hatası!'); $('isbnSearch').value = prev.replace('Sorgulanıyor...','') || isbn; }
}
async function tryOpenLibCover(isbn){ try{ const u = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`; // basit kontrol - HEAD yerine fetch ve status kontrolü
 const res = await fetch(u, { method:'GET' }); if(res.ok){ return u; } return ''; } catch(e){ return ''; } }
/*** Manual Cover Resize ***/
$('manualCover').addEventListener('change', function(e){ const file = e.target.files && e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = function(event){ const img = new Image(); img.src = event.target.result; img.onload = function(){ const canvas = document.createElement('canvas'); const maxW = 400; const scale = Math.min(1, maxW/img.width); canvas.width = Math.round(img.width*scale); canvas.height = Math.round(img.height*scale); const ctx = canvas.getContext('2d'); ctx.drawImage(img,0,0,canvas.width,canvas.height); $('coverImg').value = canvas.toDataURL('image/jpeg', 0.82); }; }; reader.readAsDataURL(file); });
/*** Save / Edit / Delete ***/
async function saveBook(){ const title = $('title').value.trim(); if(!title) return alert('Kitap adı zorunlu.'); const existing = editingId ? db.find(x=>x.id===editingId) : null; const prev = existing ? normalizeBook(existing) : null; let coverVal = ($('coverImg').value || '').trim(); let imgUrl = ''; let coverKey = null; try { if(!coverVal){ if(prev){ coverKey = prev.coverKey || null; imgUrl = prev.img || ''; if(!coverKey && !imgUrl) imgUrl = PLACEHOLDER; } else { imgUrl = PLACEHOLDER; } } else if(/^data:image\//i.test(coverVal)){ const key = newCoverKey(); const blob = await dataUrlToBlob(coverVal); await idbPutCover(key, blob); coverKey = key; imgUrl = ''; } else { imgUrl = coverVal; coverKey = null; } } catch(e){ console.warn('Kapak kaydı hatası:', e); if(prev){ coverKey = prev.coverKey || null; imgUrl = prev.img || PLACEHOLDER; } else { imgUrl = PLACEHOLDER; } }
 const book = normalizeBook({ id: editingId || Date.now(), title, author: $('author').value || '', isbn: $('isbnFinal').value || '', publisher: $('publisher').value || '', pubYear: parseInt($('pubYear').value) || 0, pageCount: parseInt($('pageCount').value) || 0, shelf: ($('shelf').value || '').trim() || 'Rafsız', format: $('format').value, price: parseFloat($('price').value) || 0, pDate: $('pDate').value || '', purchasePlace: ($('purchasePlace')?.value || '').trim(), desc: $('desc').value || '', language: ($('language').value || '').trim(), categories: ($('categories').value || '').split(',').map(x=>x.trim()).filter(Boolean), notes: $('notes').value || '', status: $('status').value || 'Okunacak', img: imgUrl || '', coverKey, addedAt: editingId ? (prev?.addedAt || new Date().getTime()) : new Date().getTime() });
 if(editingId && prev && prev.coverKey && prev.coverKey !== book.coverKey){ await idbDelCover(prev.coverKey).catch(()=>{}); revokeCoverUrl(prev.coverKey); }
 if(editingId) db = db.map(b => (b.id===editingId ? book : b)); else db.push(book);
 saveDB(); editingId = null; if(!$('extraFields').classList.contains('hidden')) toggleForm(); resetForm(); render(); }
function editBook(id){ const b0 = db.find(x=>x.id===id); if(!b0) return; const b = normalizeBook(b0); editingId = id; if($('extraFields').classList.contains('hidden')) toggleForm(); $('title').value = b.title || ''; $('author').value = b.author || ''; $('isbnFinal').value = b.isbn || ''; $('publisher').value = b.publisher || ''; $('pubYear').value = b.pubYear || 0; $('pageCount').value = b.pageCount || 0; $('shelf').value = b.shelf || 'Rafsız'; $('format').value = b.format || 'Ciltsiz'; $('price').value = (b.price || 0); $('pDate').value = b.pDate || ''; if($('purchasePlace')) $('purchasePlace').value = b.purchasePlace || '';  $('desc').value = b.desc || ''; $('language').value = b.language || ''; $('categories').value = (b.categories && b.categories.length) ? b.categories.join(', ') : ''; $('notes').value = b.notes || ''; $('status').value = b.status || 'Okunacak'; $('coverImg').value = (b.img && b.img !== PLACEHOLDER) ? b.img : ''; window.scrollTo({top:0, behavior:'smooth'}); }
async function delBook(id){ if(!confirm('Silinsin mi?')) return; const b0 = db.find(x=>x.id===id); const b = b0 ? normalizeBook(b0) : null; db = db.filter(x=>x.id!==id); saveDB(); if(b && b.coverKey){ await idbDelCover(b.coverKey).catch(()=>{}); revokeCoverUrl(b.coverKey); } render(); }
function resetForm(){ document.querySelectorAll('#extraFields input, #extraFields textarea, #extraFields select').forEach(el=>{ if(el.type==='file') el.value=''; else el.value=''; }); $('format').value='Ciltsiz'; $('status').value='Okunacak'; $('coverImg').value=''; $('isbnSearch').value=''; }
function showLb(src){ $('lbImg').src = src; $('lightbox').style.display='flex'; }
function toggleDesc(id){ const el = document.getElementById('desc-'+id); if(!el) return; el.style.display = (el.style.display==='block') ? 'none' : 'block'; }
/*** Export / Import ***/
async function exportData(){ const uniqueKeys=[...new Set(db.map(b=>b.coverKey).filter(Boolean))]; const covers={}; for(const key of uniqueKeys){ try{ const blob = await idbGetCover(key); if(blob) covers[key] = await blobToDataUrl(blob); } catch(e){ console.warn('Kapak export edilemedi:', key, e); } } const payload = { meta:{ app:'Kütüphanem Pro Max', version:'v2026.3.1', exportedAt:new Date().toISOString() }, books: db, covers }; const blob = new Blob([JSON.stringify(payload)], { type:'application/json' }); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='yedek.json'; a.click(); }
async function importData(e){ const f = e.target.files && e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = async (re)=>{ try{ const parsed = JSON.parse(re.target.result); let incomingBooks=[]; let incomingCovers={}; if(Array.isArray(parsed)){ incomingBooks = parsed.map(normalizeBook); } else { incomingBooks = Array.isArray(parsed.books)? parsed.books.map(normalizeBook):[]; incomingCovers = (parsed.covers && typeof parsed.covers==='object') ? parsed.covers : {}; } const coverKeys = Object.keys(incomingCovers||{}); for(const key of coverKeys){ try{ const dataUrl = incomingCovers[key]; if(typeof dataUrl==='string' && /^data:image\//i.test(dataUrl)){ const blob = await dataUrlToBlob(dataUrl); await idbPutCover(key, blob); revokeCoverUrl(key); } } catch(err){ console.warn('Kapak import edilemedi:', key, err); } } db = incomingBooks; saveDB(); render(); alert('Yedek yüklendi ✅'); } catch(err){ alert('Geçersiz yedek dosyası!'); console.error(err); } }; r.readAsText(f); }
/*** Render ***/
async function render(){ const term = ($('liveSearch').value || '').toLowerCase(); const sort = $('sort').value; const shelves = ['Tümü', ...new Set(db.map(b => (b.shelf || 'Rafsız')) )]; $('shelfTabs').innerHTML = shelves.map(s => { const active = (currentShelf===s)? 'active' : ''; return `<div class="tab ${active}" onclick='setShelf(${JSON.stringify(s)})'>${escapeHTML(s)}</div>`; }).join(''); let filtered = db.map(normalizeBook).filter(b => { const mShelf = (currentShelf === 'Tümü' || b.shelf === currentShelf); if(!mShelf) return false; if(!term) return true; const hay = [ (b.title||''), (b.author||''), (b.isbn||''), (b.language||''), (b.categories||[]).join(' '), (b.notes||''), (b.status||''), (b.purchasePlace||'') ].join(' ').toLowerCase(); return hay.includes(term); }); filtered.sort((a,b)=>{ if (sort==='title_asc') return (a.title||'').localeCompare(b.title||''); if (sort==='price_desc') return (b.price||0) - (a.price||0); if (sort==='year_desc') return (b.pubYear||0) - (a.pubYear||0); if (sort==='page_desc') return (b.pageCount||0) - (a.pageCount||0); return (b.addedAt||0) - (a.addedAt||0); }); $('list').innerHTML = filtered.map(b => { const safeTitle = escapeHTML(b.title); const safeAuthor = escapeHTML(b.author || '-'); const safePublisher = escapeHTML(b.publisher || '-'); const safeShelf = escapeHTML(b.shelf || 'Rafsız'); const safeLang = escapeHTML(b.language || '-'); const safeCats = escapeHTML((b.categories && b.categories.length) ? b.categories.join(' • ') : '-'); const safeIsbn = escapeHTML(b.isbn || '-'); const safeStatus = escapeHTML(b.status || 'Okunacak'); const price = (Number(b.price)||0).toFixed(2); const page = Number(b.pageCount)||0; const imgSrc = escapeHTML(b.img || PLACEHOLDER); const descText = (b.desc || '').trim(); const notesText = (b.notes || '').trim(); const overlay = `
 <h4>📌 Açıklama / Notlar</h4>
 <div class="muted">Raf: ${safeShelf} • Dil: ${safeLang} • Durum: <b>${safeStatus}</b></div>
 <div><b>Açıklama:</b>\n${escapeHTML(htmlToText(descText) || 'Açıklama yok.')}</div>
 <div style="margin-top:10px;"><b>Notlar:</b>\n${escapeHTML(notesText || 'Not yok.')}</div>`; return `
 <div class="book-card" ondblclick="toggleDesc(${b.id})">
 <div class="desc-overlay" id="desc-${b.id}" onclick="toggleDesc(${b.id})">${overlay}</div>
 <img id="img-${b.id}" src="${imgSrc}" onclick="showLb(document.getElementById('img-${b.id}').src)" alt="Kapak" />
 <div class="book-details">
 <h3>${safeTitle}</h3>
 <p>👤 ${safeAuthor}</p>
 <p>🏢 ${safePublisher} • 📄 ${page}</p>
 <p>🆔 ISBN: ${safeIsbn}</p>
 <p>🌍 ${safeLang} • 🏷️ ${safeCats}</p>
 <div>
 <span class="format-badge">${escapeHTML(b.format || 'Ciltsiz')}</span>
 <span class="status-badge ${statusClass(b.status)}">${safeStatus}</span>
 </div>
 <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
 <span style="color:var(--success); font-weight:800">${price} TL</span>
 <div class="mini-actions">
 <span title="Bilgi/Not" onclick="toggleDesc(${b.id})">ℹ️</span>
 <span title="Düzenle" onclick="editBook(${b.id})">✏️</span>
 <span title="Sil" onclick="delBook(${b.id})">🗑️</span>
 </div>
 </div>
 </div>
 </div>`; }).join(''); $('statCount').innerText = `${db.length} Kitap`; $('statValue').innerText = `${db.reduce((s,b)=> s + (parseFloat(b.price)||0), 0).toFixed(2)} TL`; for (const b of filtered){ if(!b.coverKey) continue; try{ const src = await ensureCoverSrc(b); if(src){ const imgEl = document.getElementById('img-'+b.id); if(imgEl) imgEl.src = src; } } catch(e){} }
}
/*** Migrate big dataURL covers to IDB ***/
async function migrateLargeDataUrlCovers(){ const THRESH=120000; let changed=false; for(let i=0;i<db.length;i++){ const b = normalizeBook(db[i]); if(b.coverKey) continue; if(b.img && /^data:image\//i.test(b.img) && b.img.length>THRESH){ try{ const key=newCoverKey(); const blob=await dataUrlToBlob(b.img); await idbPutCover(key, blob); b.coverKey=key; b.img=''; db[i]=b; changed=true; } catch(e){ console.warn('Migrasyon başarısız:', e); } } } if(changed) saveDB(); }
/*** Init ***/
(async function init(){ loadDB(); await migrateLargeDataUrlCovers(); render(); })();


// Barkod fonksiyonları assets/scanner.js içinde

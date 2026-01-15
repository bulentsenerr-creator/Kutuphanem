import { parseIsbn } from './isbn.js';
import { fetchGoogleBooksByIsbn } from './providers/googleBooks.js';
import { fetchOpenLibraryByIsbn, openLibraryCoverUrl } from './providers/openLibrary.js';
import { mergeProviders } from './merge.js';
import { putItem, getItem, getAllItems, deleteItem, clearAll, exportJson, importJson } from './db.js';
import { initPwa, promptInstall } from './pwa.js';
import { startScanner } from './scanner.js';

const $ = (id)=>document.getElementById(id);

const state = {
  currentIsbn13: null,
  currentItem: null,
  googleKey: '',
  scanner: null
};

initPwa();
init();

async function init(){
  // settings
  state.googleKey = localStorage.getItem('googleApiKey') || '';
  $('googleApiKey').value = state.googleKey;
  $('googleApiKey').addEventListener('change', ()=>{
    state.googleKey = $('googleApiKey').value.trim();
    localStorage.setItem('googleApiKey', state.googleKey);
  });

  $('btnFetch').addEventListener('click', onFetch);
  $('btnSave').addEventListener('click', onSave);
  $('btnReset').addEventListener('click', resetForm);
  $('btnScan').addEventListener('click', openScan);
  $('btnCloseScan').addEventListener('click', closeScan);

  $('btnInstall').addEventListener('click', async ()=>{
    const ok = await promptInstall();
    toast(ok ? 'Yükleme başlatıldı' : 'Yükleme iptal', ok ? 'ok' : '');
  });

  $('btnClear').addEventListener('click', async ()=>{
    if(!confirm('Tüm kayıtları silmek istiyor musun?')) return;
    await clearAll();
    await renderLibrary();
    toast('Tüm kayıtlar silindi', 'ok');
  });

  $('btnExport').addEventListener('click', async ()=>{
    const text = await exportJson();
    downloadText('kitap_kutuphane_export.json', text);
  });

  $('fileImport').addEventListener('change', async (e)=>{
    const file=e.target.files?.[0];
    if(!file) return;
    const txt = await file.text();
    const obj = JSON.parse(txt);
    await importJson(obj);
    await renderLibrary();
    toast('İçe aktarma tamam', 'ok');
    e.target.value='';
  });

  await renderLibrary();
  setStatus('Hazır. ISBN gir veya Barkod Oku.', '');
}

async function openScan(){
  const modal=$('scanModal');
  modal.hidden = false;
  $('scanResult').textContent='';
  $('scanHint').textContent='Kamerayı barkoda yaklaştır.';

  const video=$('scanVideo');
  const resultEl=$('scanResult');
  const hintEl=$('scanHint');
  const torchBtn=$('btnTorch');

  try{
    state.scanner = await startScanner({
      videoEl: video,
      resultEl,
      hintEl,
      torchBtn,
      onDetected: (code)=>{
        $('isbnInput').value = code;
        closeScan();
        toast('Barkod okundu ✅', 'ok');
      }
    });
  }catch(err){
    console.warn(err);
    $('scanHint').textContent = err.message;
    $('scanResult').textContent = 'Manuel ISBN girebilirsin.';
    torchBtn.hidden = true;
  }
}

function closeScan(){
  if(state.scanner){
    try{ state.scanner.stop(); }catch{}
    state.scanner = null;
  }
  $('scanModal').hidden = true;
}

async function onFetch(){
  const input = $('isbnInput').value;
  const parsed = parseIsbn(input);
  if(!parsed.valid || !parsed.isbn13){
    setStatus('Geçersiz ISBN. 10 ya da 13 haneli doğru ISBN gir.', 'err');
    return;
  }

  const isbn13 = parsed.isbn13;
  state.currentIsbn13 = isbn13;

  const refresh = $('refreshMode').value === 'refresh';
  if(!refresh){
    const cached = await getItem(isbn13);
    if(cached){
      state.currentItem = cached;
      fillFormFromItem(cached);
      await renderCover(cached.edition.coverRemoteUrl, cached.edition.coverSource, isbn13);
      setStatus('Cache’den yüklendi ✅', 'ok');
      return;
    }
  }

  setStatus('Kaynaklardan çekiliyor…', '');

  try{
    const [google, ol] = await Promise.allSettled([
      fetchGoogleBooksByIsbn(isbn13, state.googleKey),
      fetchOpenLibraryByIsbn(isbn13)
    ]);

    const g = google.status==='fulfilled' ? google.value : { matched:false, error:String(google.reason) };
    const o = ol.status==='fulfilled' ? ol.value : { matched:false, error:String(ol.reason) };

    if(!g.matched && !o.matched){
      setStatus('Hiçbir kaynak eşleştirme bulamadı. ISBN’i kontrol et.', 'err');
      return;
    }

    const merged = mergeProviders(isbn13, g, o);

    const now = new Date().toISOString();
    const item = {
      edition: merged.edition,
      userCopy: {
        purchaseDate: '',
        purchasePlace: '',
        tags: [],
        notes: '',
        addedAt: now
      },
      snapshots: { google: g.raw || null, openlibrary: o.raw || null }
    };

    const existing = await getItem(isbn13);
    if(existing?.userCopy){
      item.userCopy = existing.userCopy;
      item.edition.createdAt = existing.edition.createdAt || item.edition.createdAt;
    }

    state.currentItem = item;
    fillFormFromItem(item);
    await renderCover(item.edition.coverRemoteUrl, item.edition.coverSource, isbn13);
    setStatus('Çekildi ve birleştirildi ✅', 'ok');
  }catch(err){
    console.error(err);
    setStatus('Hata: ' + err.message, 'err');
  }
}

async function onSave(){
  const item = state.currentItem;
  if(!item?.edition?.isbn13){
    setStatus('Önce ISBN ile bilgileri getir.', 'err');
    return;
  }

  item.edition.language = $('ed_language').value.trim();
  item.edition.publisher = $('ed_publisher').value.trim();
  item.edition.editionStatement = $('ed_editionStatement').value.trim();
  item.edition.publishedDate = $('ed_publishedDate').value.trim();
  item.edition.pageCount = toIntOrNull($('ed_pageCount').value);
  item.edition.format = $('ed_format').value;
  item.edition.categories = splitCsv($('ed_categories').value);
  item.edition.description = $('ed_description').value.trim();
  item.edition.updatedAt = new Date().toISOString();

  item.userCopy.purchaseDate = $('uc_purchaseDate').value;
  item.userCopy.purchasePlace = $('uc_purchasePlace').value.trim();
  item.userCopy.tags = splitCsv($('uc_tags').value);
  item.userCopy.notes = $('uc_notes').value.trim();
  if(!item.userCopy.addedAt) item.userCopy.addedAt = new Date().toISOString();

  await putItem(item);
  await renderLibrary();
  setStatus('Kaydedildi ✅', 'ok');
}

function fillFormFromItem(item){
  const ed=item.edition;
  $('ed_isbn13').value = ed.isbn13 || '';
  $('ed_isbn10').value = ed.isbn10 || '';
  $('ed_language').value = ed.language || '';
  $('ed_publisher').value = ed.publisher || '';
  $('ed_editionStatement').value = ed.editionStatement || '';
  $('ed_publishedDate').value = ed.publishedDate || '';
  $('ed_pageCount').value = ed.pageCount ?? '';
  $('ed_format').value = ed.format || '';
  $('ed_categories').value = (ed.categories||[]).join(', ');
  $('ed_description').value = ed.description || '';
  $('ed_confidence').textContent = String(ed.confidence ?? '-');
  $('ed_sources').textContent = sourceText(ed.sources);

  const uc=item.userCopy;
  $('uc_purchaseDate').value = uc.purchaseDate || '';
  $('uc_purchasePlace').value = uc.purchasePlace || '';
  $('uc_tags').value = (uc.tags||[]).join(', ');
  $('uc_notes').value = uc.notes || '';
  $('uc_addedAt').textContent = uc.addedAt ? new Date(uc.addedAt).toLocaleString() : '-';
}

function resetForm(){
  state.currentIsbn13 = null;
  state.currentItem = null;
  $('isbnInput').value='';
  $('coverImg').src='';
  $('coverInfo').textContent='';
  $('uc_addedAt').textContent='-';
  $('ed_confidence').textContent='-';
  $('ed_sources').textContent='-';

  for(const id of ['ed_isbn13','ed_isbn10','ed_language','ed_publisher','ed_editionStatement','ed_publishedDate','ed_pageCount','ed_categories','ed_description','uc_purchaseDate','uc_purchasePlace','uc_tags','uc_notes']){
    const el=$(id);
    if(el) el.value='';
  }
  $('ed_format').value='';
  setStatus('Form sıfırlandı.', '');
}

async function renderLibrary(){
  const list = await getAllItems();
  list.sort((a,b)=> (b.userCopy?.addedAt||'').localeCompare(a.userCopy?.addedAt||''));
  const box=$('library');
  box.innerHTML='';
  if(!list.length){
    box.innerHTML = '<div class="small">Henüz kayıt yok.</div>';
    return;
  }

  for(const item of list){
    const ed=item.edition;
    const uc=item.userCopy;
    const div=document.createElement('div');
    div.className='item';

    const img=document.createElement('img');
    img.alt='Kapak';
    img.src = ed.coverRemoteUrl || '';
    img.onerror = ()=>{ img.src=''; img.style.display='none'; };

    const meta=document.createElement('div');
    meta.className='meta';
    const name=document.createElement('div');
    name.className='name';
    name.textContent = ed.title || '(Başlık yok)';
    const sub=document.createElement('div');
    sub.className='sub';
    sub.textContent = `${ed.isbn13} • ${ed.publisher||'-'} • ${uc?.addedAt ? new Date(uc.addedAt).toLocaleDateString() : ''}`;
    meta.appendChild(name); meta.appendChild(sub);

    const btns=document.createElement('div');
    btns.className='btns';

    const bEdit=document.createElement('button');
    bEdit.className='btn ghost';
    bEdit.textContent='Düzenle';
    bEdit.onclick=async()=>{
      const fresh = await getItem(ed.isbn13);
      state.currentItem = fresh;
      state.currentIsbn13 = ed.isbn13;
      fillFormFromItem(fresh);
      await renderCover(fresh.edition.coverRemoteUrl, fresh.edition.coverSource, ed.isbn13);
      window.scrollTo({ top:0, behavior:'smooth' });
      setStatus('Kayıt yüklendi (düzenleme).', 'ok');
    };

    const bDel=document.createElement('button');
    bDel.className='btn danger';
    bDel.textContent='Sil';
    bDel.onclick=async()=>{
      if(!confirm('Silmek istiyor musun?')) return;
      await deleteItem(ed.isbn13);
      await renderLibrary();
      toast('Silindi', 'ok');
    };

    btns.appendChild(bEdit);
    btns.appendChild(bDel);

    div.appendChild(img);
    div.appendChild(meta);
    div.appendChild(btns);
    box.appendChild(div);
  }
}

async function renderCover(url, source, isbn13){
  const img=$('coverImg');
  const info=$('coverInfo');
  if(!url){ img.src=''; info.textContent='Kapak yok.'; return; }

  img.style.display='block';
  img.src = url;
  info.textContent = source ? `Kaynak: ${source}` : '';

  const ok = await new Promise((resolve)=>{
    img.onload=()=>resolve(true);
    img.onerror=()=>resolve(false);
  });

  if(!ok){
    if(source==='openlibrary'){
      img.src = openLibraryCoverUrl(isbn13, 'M');
      info.textContent = 'Kaynak: openlibrary (M fallback)';
    }else{
      img.src='';
      img.style.display='none';
      info.textContent='Kapak yüklenemedi.';
    }
  }
}

function setStatus(msg, kind){
  const el=$('fetchStatus');
  el.textContent = msg;
  el.className = 'status' + (kind ? ' ' + kind : '');
}

function toast(msg, kind){
  setStatus(msg, kind || '');
  setTimeout(()=> setStatus('Hazır.', ''), 2500);
}

function splitCsv(s){
  if(!s) return [];
  return s.split(',').map(x=>x.trim()).filter(Boolean);
}

function toIntOrNull(v){
  const n = parseInt(String(v||'').trim(),10);
  return Number.isFinite(n) ? n : null;
}

function downloadText(filename, text){
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function sourceText(sources){
  const parts=[];
  if(sources?.google?.matched) parts.push('Google');
  if(sources?.openlibrary?.matched) parts.push('OpenLibrary');
  return parts.length ? parts.join(' + ') : '-';
}

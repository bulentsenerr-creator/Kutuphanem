// Barkod Tarama (ZXing) - FIX1: ZXing.Map yerine standart Map

(function(){ if(!window.$) window.$ = (id)=>document.getElementById(id); })();

let codeReader = null;
let currentDeviceId = null;
let streamRef = null;
let trackRef = null;
let torchOn = false;
let _scanStopRequested = false;
let _scanLocked = false;

function cameraErrorMessage(err){
  const name = err?.name || '';
  const msg = (err?.message || '').toString();
  if (!window.isSecureContext) return 'Kamera için HTTPS gereklidir (güvenli bağlantı).';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Kamera izni reddedildi. Tarayıcı ayarlarından izin verin.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'Kamera bulunamadı.';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'Kamera başka bir uygulama tarafından kullanılıyor olabilir.';
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') return 'Seçilen kamera/ayarlar desteklenmiyor. Farklı kamera deneyin.';
  if(/Content Security Policy|CSP|Refused to load the script|violates the following Content Security Policy/i.test(msg)){
    return 'ZXing yüklenemedi: CSP/CDN engeli olabilir.';
  }
  return 'Kamera başlatılamadı. İzinleri ve bağlantıyı kontrol edin.';
}

async function openScanner(){
  $('scanModal').style.display='flex';
  $('scanLast').textContent='';
  $('scanInfo').textContent='Kamera hazırlanıyor...';
  _scanLocked = false;

  try{
    await loadZXing();
    // warm-up
    try{
      const warm = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal:'environment' } }, audio:false });
      warm.getTracks().forEach(t=>t.stop());
    }catch(e){}

    await listCameras();
    await startScan();
  }catch(e){
    $('scanInfo').textContent = cameraErrorMessage(e) + ` (${e?.name||'Error'}: ${(e?.message||'').toString().slice(0,120)})`;
    console.error(e);
  }
}

function hideScanner(){ stopScan(); $('scanModal').style.display='none'; }
function closeScanner(e){ if(e && e.target && e.target.id==='scanModal') hideScanner(); }

async function loadZXing(){
  if(window.ZXing && (ZXing.BrowserMultiFormatReader || ZXing.BrowserBarcodeReader)) return;

  const sources = [
    'https://unpkg.com/@zxing/library@0.20.0/umd/index.min.js',
    'https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js',
    'https://cdn.jsdelivr.net/npm/zxing-js-library@0.20.1/umd/index.min.js',
    'https://unpkg.com/@zxing/library@latest/umd/index.min.js',
    'https://cdn.jsdelivr.net/npm/@zxing/library@latest/umd/index.min.js'
  ];

  const loadScript = (src, timeoutMs=15000)=> new Promise((resolve, reject)=>{
    const s=document.createElement('script');
    let done=false;
    const timer=setTimeout(()=>{ if(done) return; done=true; try{s.remove();}catch(e){} reject(new Error('Timeout: '+src)); }, timeoutMs);
    s.src=src; s.async=true; s.defer=true; s.crossOrigin='anonymous'; s.referrerPolicy='no-referrer';
    s.onload=()=>{ setTimeout(()=>{ clearTimeout(timer);
      if(window.ZXing && (ZXing.BrowserMultiFormatReader || ZXing.BrowserBarcodeReader)) resolve(true);
      else { try{s.remove();}catch(e){} reject(new Error('Yüklendi ama ZXing global oluşmadı: '+src)); }
    },0); };
    s.onerror=()=>{ clearTimeout(timer); if(done) return; done=true; try{s.remove();}catch(e){} reject(new Error('Script load failed: '+src)); };
    document.head.appendChild(s);
  });

  for(let i=0;i<sources.length;i++){
    $('scanInfo').textContent = `ZXing yükleniyor... (${i+1}/${sources.length})`;
    try{ await loadScript(sources[i]); return; }
    catch(e){ console.warn('ZXing load fail:', sources[i], e); }
  }
  throw new Error('ZXing yüklenemedi');
}

async function listCameras(){
  try{
    if(!navigator.mediaDevices?.enumerateDevices) throw new Error('enumerateDevices yok');
    const devices = await navigator.mediaDevices.enumerateDevices();
    const vids = devices.filter(d=>d.kind==='videoinput');
    const camSel = $('camList');
    camSel.innerHTML = vids.map((d,i)=>`<option value="${d.deviceId}">${d.label || ('Kamera '+(i+1))}</option>`).join('');
    if(vids.length){
      currentDeviceId = vids[vids.length-1].deviceId;
      camSel.value = currentDeviceId;
      camSel.onchange = ()=>{ currentDeviceId = camSel.value; startScan(); };
    } else {
      $('scanInfo').textContent = 'Kamera bulunamadı';
    }
  }catch(e){ console.warn(e); }
}

async function startScan(){
  try{
    stopScan();
    _scanStopRequested=false;
    _scanLocked=false;

    $('scanInfo').textContent='Taranıyor...';

    const video=$('preview');
    video.setAttribute('playsinline','');
    video.setAttribute('muted','');
    video.setAttribute('autoplay','');
    video.muted=true;

    let constraints = {
      audio:false,
      video:{
        deviceId: currentDeviceId ? { exact: currentDeviceId } : undefined,
        facingMode: currentDeviceId ? undefined : { ideal:'environment' },
        width:{ ideal:1280 },
        height:{ ideal:720 }
      }
    };

    let stream;
    try{ stream = await navigator.mediaDevices.getUserMedia(constraints); }
    catch(err1){
      const n = err1?.name||'';
      if(n==='OverconstrainedError' || n==='ConstraintNotSatisfiedError'){
        try{ stream = await navigator.mediaDevices.getUserMedia({ audio:false, video:{ facingMode:{ ideal:'environment' } } }); }
        catch{ stream = await navigator.mediaDevices.getUserMedia({ audio:false, video:true }); }
      } else throw err1;
    }

    streamRef=stream;
    video.srcObject=streamRef;
    try{ await video.play(); }catch(e){}

    const tracks = streamRef.getVideoTracks();
    trackRef = tracks && tracks[0];

    try{
      const caps = trackRef?.getCapabilities?.();
      if(caps && caps.torch){
        $('torchBtn').style.display='inline-block';
        $('torchBtn').textContent = torchOn ? '🔦 Işık (Açık)' : '🔦 Işık';
      } else {
        $('torchBtn').style.display='none';
      }
    }catch(e){ $('torchBtn').style.display='none'; }

    await loadZXing();
    const Reader = ZXing.BrowserMultiFormatReader || ZXing.BrowserBarcodeReader;

    const formats = [
      ZXing.BarcodeFormat.EAN_13,
      ZXing.BarcodeFormat.EAN_8,
      ZXing.BarcodeFormat.UPC_A,
      ZXing.BarcodeFormat.UPC_E,
      ZXing.BarcodeFormat.QR_CODE,
      ZXing.BarcodeFormat.CODE_128
    ];

    // FIX: ZXing.Map yok -> standart Map kullan
    let hints = null;
    try{
      hints = new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
    }catch(e){ hints=null; }

    try{ codeReader = hints ? new Reader(hints) : new Reader(); }
    catch(e){ codeReader = new Reader(); }

    codeReader.decodeFromVideoElementContinuously(video, (result, err)=>{
      if(_scanStopRequested || _scanLocked) return;
      if(result && result.getText){
        _scanLocked=true;
        onScanResult(result.getText());
      }
    });

  }catch(e){
    $('scanInfo').textContent = cameraErrorMessage(e) + ` (${e?.name||'Error'}: ${(e?.message||'').toString().slice(0,120)})`;
    console.error(e);
  }
}

function stopScan(){
  try{ _scanStopRequested=true; }catch(e){}
  try{ _scanLocked=false; }catch(e){}
  try{ if(codeReader?.reset) codeReader.reset(); }catch(e){}
  try{ if(streamRef) streamRef.getTracks().forEach(t=>t.stop()); }catch(e){}
  try{ const v=$('preview'); if(v){ v.pause?.(); v.srcObject=null; } }catch(e){}
  trackRef=null; streamRef=null;
}

async function toggleTorch(){
  try{
    if(!trackRef) return;
    const caps = trackRef.getCapabilities?.();
    if(!(caps && caps.torch)) return;
    torchOn=!torchOn;
    await trackRef.applyConstraints({ advanced:[{ torch: torchOn }] });
    $('torchBtn').textContent = torchOn ? '🔦 Işık (Açık)' : '🔦 Işık';
  }catch(e){ console.warn('Torch desteklenmiyor', e); }
}

function extractIsbn(txt){
  const s=(txt||'').toString().trim();
  const num=s.replace(/\D/g,'');
  if(num.length===13 && (num.startsWith('978')||num.startsWith('979'))) return num;
  if(num.length===10) return isbn10to13(num);
  try{ const u=new URL(s); const q=u.searchParams.get('isbn')||u.searchParams.get('ISBN'); if(q) return q.replace(/\D/g,''); }catch(e){}
  return null;
}

function isbn10to13(isbn10){
  try{
    const core='978'+isbn10.slice(0,9);
    let sum=0;
    for(let i=0;i<12;i++) sum += parseInt(core[i],10) * (i%2===0?1:3);
    const check=(10-(sum%10))%10;
    return core+String(check);
  }catch(e){ return null; }
}

function onScanResult(text){
  $('scanLast').textContent='Son: '+text;
  const isbn = extractIsbn(text);
  if(isbn){
    $('isbnSearch').value=isbn;
    $('scanInfo').textContent='ISBN bulundu: '+isbn;
    hideScanner();
    if(typeof fetchBook==='function') fetchBook();
    beep();
  }else{
    $('scanInfo').textContent='Kod okundu fakat ISBN bulunamadı';
    beep(440,120);
  }
}

function beep(freq=880, dur=80){
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator();
    const g=ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value=freq; o.type='triangle';
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur/1000);
    setTimeout(()=>{ o.stop(); ctx.close(); }, dur+20);
  }catch(e){}
}

async function scanFromImage(e){
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  $('scanInfo').textContent='Resim analiz ediliyor...';
  const img = new Image();
  img.onload = async ()=>{
    try{
      const canvas=document.createElement('canvas');
      canvas.width=img.width; canvas.height=img.height;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0);
      const dataUrl=canvas.toDataURL('image/png');
      await loadZXing();
      const Reader = ZXing.BrowserMultiFormatReader || ZXing.BrowserBarcodeReader;
      const reader = new Reader();
      const res = await reader.decodeFromImageUrl(dataUrl);
      if(res && res.getText) onScanResult(res.getText());
      else { $('scanInfo').textContent='Barkod bulunamadı'; beep(440,120); }
    }catch(err){ $('scanInfo').textContent='Çözümlenemedi'; console.error(err); }
  };
  const fr=new FileReader();
  fr.onload=(ev)=>{ img.src=ev.target.result; };
  fr.readAsDataURL(file);
}

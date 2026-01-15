export async function startScanner({ videoEl, resultEl, hintEl, onDetected, torchBtn }){
  if(!navigator.mediaDevices?.getUserMedia){
    throw new Error('Kamera erişimi desteklenmiyor.');
  }

  if(!('BarcodeDetector' in globalThis)){
    throw new Error('Bu tarayıcı BarcodeDetector desteklemiyor. (Manuel ISBN gir)');
  }

  // getSupportedFormats bazı tarayıcılarda olmayabilir
  if(typeof BarcodeDetector.getSupportedFormats === 'function'){
    const supported = await BarcodeDetector.getSupportedFormats();
    if(Array.isArray(supported) && !supported.includes('ean_13')){
      throw new Error('EAN-13 bu tarayıcıda desteklenmiyor.');
    }
  }

  const detector = new BarcodeDetector({ formats: ['ean_13'] });

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false
  });

  videoEl.srcObject = stream;
  await videoEl.play();

  const track = stream.getVideoTracks()[0];
  const capabilities = track.getCapabilities ? track.getCapabilities() : {};
  if(capabilities.torch && torchBtn){
    torchBtn.hidden = false;
    let torchOn=false;
    torchBtn.onclick = async ()=>{
      torchOn=!torchOn;
      try{ await track.applyConstraints({ advanced: [{ torch: torchOn }] }); }
      catch(e){ console.warn('Torch desteklenmedi', e); }
    };
  }else if(torchBtn){
    torchBtn.hidden = true;
  }

  let stopped=false;
  let lastValue=null;

  async function tick(){
    if(stopped) return;

    // video hazır değilse bekle
    if(videoEl.readyState < 2){
      requestAnimationFrame(tick);
      return;
    }

    try{
      const barcodes = await detector.detect(videoEl);
      if(barcodes?.length){
        const code = barcodes[0].rawValue;
        if(code && code !== lastValue){
          lastValue = code;
          if(resultEl) resultEl.textContent = `Bulundu: ${code}`;
          if(hintEl) hintEl.textContent = 'Barkod algılandı ✅';
          stop();
          onDetected?.(code);
          return;
        }
      }
    }catch(e){
      // devam
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  function stop(){
    stopped=true;
    try{ videoEl.pause(); }catch{}
    const s = videoEl.srcObject;
    if(s){ s.getTracks().forEach(t=>t.stop()); }
    videoEl.srcObject=null;
  }

  return { stop };
}

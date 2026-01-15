// Kamera barkod okuyucu (BarcodeDetector + getUserMedia)

export async function startScanner({ videoEl, resultEl, hintEl, onDetected, torchBtn }){
  if(!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia){
    throw new Error('Kamera API desteklenmiyor.');
  }

  // BarcodeDetector desteği
  if(!('BarcodeDetector' in globalThis)){
    throw new Error('Bu tarayıcı BarcodeDetector desteklemiyor.');
  }

  // EAN-13 destek kontrolü
  const supported = await BarcodeDetector.getSupportedFormats();
  if(!supported.includes('ean_13')){
    throw new Error('EAN-13 barkodu bu tarayıcıda desteklenmiyor.');
  }

  const detector = new BarcodeDetector({ formats: ['ean_13'] });

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false
  });

  videoEl.srcObject = stream;
  await videoEl.play();

  // Torch (flash) best-effort
  const track = stream.getVideoTracks()[0];
  const capabilities = track.getCapabilities ? track.getCapabilities() : {};
  if(capabilities.torch && torchBtn){
    torchBtn.hidden = false;
    let torchOn = false;
    torchBtn.onclick = async ()=>{
      torchOn = !torchOn;
      try{
        await track.applyConstraints({ advanced: [{ torch: torchOn }] });
      }catch(e){
        console.warn('Torch desteklenmedi', e);
      }
    };
  } else if(torchBtn){
    torchBtn.hidden = true;
  }

  let stopped = false;

  async function tick(){
    if(stopped) return;
    try{
      const barcodes = await detector.detect(videoEl);
      if(barcodes && barcodes.length){
        const code = barcodes[0].rawValue;
        if(resultEl) resultEl.textContent = `Bulundu: ${code}`;
        if(hintEl) hintEl.textContent = 'Barkod algılandı ✅';
        stop();
        onDetected?.(code);
        return;
      }
    }catch(e){
      // detect bazen hataya düşebilir; devam
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  function stop(){
    stopped = true;
    try{ videoEl.pause(); }catch{}
    const s = videoEl.srcObject;
    if(s){
      s.getTracks().forEach(t=>t.stop());
    }
    videoEl.srcObject = null;
  }

  return { stop };
}

let deferredPrompt = null;

export function initPwa(){
  if('serviceWorker' in navigator){
    window.addEventListener('load', async ()=>{
      try{ await navigator.serviceWorker.register('./service-worker.js'); }
      catch(e){ console.warn('SW kayıt başarısız', e); }
    });
  }

  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('btnInstall');
    if(btn) btn.hidden = false;
  });
}

export async function promptInstall(){
  if(!deferredPrompt) return false;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  const btn = document.getElementById('btnInstall');
  if(btn) btn.hidden = true;
  return choice?.outcome === 'accepted';
}

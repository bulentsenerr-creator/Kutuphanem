# Kitap Kütüphanem (HTML/JS) — PWA + Kamera Barkod Okuma

Bu paket, telefonda **uygulama gibi (PWA)** kurulabilen ve **kamera ile barkod/ISBN okuyabilen** saf HTML/CSS/JS uygulamasıdır.

## Özellikler
- ISBN (EAN-13/ISBN-13) gir veya **kamera ile barkod okut**
- **Google Books + Open Library** kaynaklarından kitap bilgilerini çeker
- Alanları **Edition + UserCopy** olarak ayırır
- Kapak görseli (Google imageLinks > Open Library cover L fallback)
- Kayıtlar cihazda saklanır (**IndexedDB**) → offline görüntüleme
- PWA (manifest + service worker) → ana ekrana ekle, offline açılış
- Dışa aktar / içe aktar (JSON)

## Çalıştırma (Önemli)
Kamera (getUserMedia), BarcodeDetector ve Service Worker gibi özellikler **secure context** ister.
- Yerel geliştirme için `http://localhost` / `127.0.0.1` güvenli kabul edilir.
- Gerçek cihazda dağıtım için **HTTPS** gerekir.

### Yerel çalıştırma
```bash
python -m http.server 8080
```
Ardından telefonda aynı ağdaysan bilgisayar IP'si ile açabilirsin (HTTPS olmadan kameraya izin vermeyebilir). En garantisi:
- Android Chrome: localhost üzerinden test
- Canlı: HTTPS barındırma (GitHub Pages/Netlify/Vercel)

## Kurulum (PWA)
- Android Chrome: menü → **Uygulamayı yükle / Ana ekrana ekle**
- Uygulama içinden “Yükle” butonu görünürse onu da kullanabilirsin.

## Barkod Okuma
- Önce **native BarcodeDetector** denenir.
- Destek yoksa “Tarayıcı desteklemiyor” uyarısı verir (manual ISBN girişi devam eder).

Oluşturulma: 2026-01-15 12:02 UTC

# Kitap Kütüphanem (HTML/JS) — PWA + Kamera Barkod Okuma (v2.1 FIX)

Bu sürüm, senin bildirdiğin hataları düzeltir:
- Modal (Barkod Oku penceresi) **kendiliğinden açılmıyor**
- Modal **kapatılabiliyor** (Kapat düğmesi, arka plana tıkla, Esc)
- Barkod tarayıcı hatalarında kullanıcıya anlaşılır mesaj veriyor

## Önemli teknik not
Kamera (getUserMedia), BarcodeDetector ve Service Worker gibi özellikler **secure context** ister.
- Local test: `http://localhost` güvenli kabul edilir.
- Telefonda gerçek kurulum: **HTTPS** gerekir.

Çalıştırma:
```bash
python -m http.server 8080
```

Oluşturulma: 2026-01-15 12:10 UTC

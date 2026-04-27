import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, ZoomIn, ZoomOut, SwitchCamera } from 'lucide-react';

// Desteklenen tüm barkod formatları
const ALL_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
];

// Kısa bip sesi çalar
function playBeep(success = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(success ? 1200 : 400, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (_) {}
}

/**
 * Evrensel Barkod Tarayıcı Bileşeni
 * Props:
 *   onScan(decodedText) — Barkod okunduğunda çağrılır
 *   onClose()           — Kapat butonuna basıldığında çağrılır
 *   scanDelay           — Aynı barkodun tekrar okunmaması için ms (varsayılan: 1500)
 *   title               — Başlık metni
 */
export default function BarcodeScanner({ onScan, onClose, scanDelay = 1500, title = 'Barkod Tara' }) {
  const scannerId = useRef(`scanner-${Math.random().toString(36).slice(2)}`);
  const scannerRef = useRef(null);
  const lastCodeRef = useRef('');
  const lastTimeRef = useRef(0);

  const [cameras, setCameras] = useState([]);
  const [activeCamIdx, setActiveCamIdx] = useState(0);
  const [status, setStatus] = useState('Kamera başlatılıyor...');
  const [lastScan, setLastScan] = useState('');
  const [flashCount, setFlashCount] = useState(0);

  // Arka kamera indeksini bul
  const findBackCamIdx = (cams) => {
    const idx = cams.findIndex(c =>
      /back|rear|environment|arka/i.test(c.label)
    );
    // Bulamazsa en son kamera (mobile'da genellikle arka)
    return idx >= 0 ? idx : Math.max(cams.length - 1, 0);
  };

  // Tarayıcıyı başlat
  const startScanner = async (cams, camIdx) => {
    const elementId = scannerId.current;
    const el = document.getElementById(elementId);
    if (el) el.innerHTML = '';

    const scanner = new Html5Qrcode(elementId, { formatsToSupport: ALL_FORMATS, verbose: false });
    scannerRef.current = scanner;

    try {
      await scanner.start(
        cams[camIdx].id,
        {
          fps: 25,
          qrbox: (vw, vh) => ({
            width: Math.min(Math.round(vw * 0.82), 380),
            height: Math.min(Math.round(vh * 0.45), 180),
          }),
          aspectRatio: 1.7778,
          videoConstraints: {
            deviceId: { exact: cams[camIdx].id },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        (decodedText) => {
          const now = Date.now();
          // Aynı barkodun çok hızlı tekrar okunmasını önle
          if (decodedText === lastCodeRef.current && now - lastTimeRef.current < scanDelay) return;
          lastCodeRef.current = decodedText;
          lastTimeRef.current = now;

          playBeep(true);
          setLastScan(decodedText);
          setFlashCount(n => n + 1); // flash animasyonu tetikle
          setStatus(`✅ Okundu: ${decodedText}`);
          onScan(decodedText);

          // 2 saniye sonra durumu sıfırla
          setTimeout(() => setStatus('🔍 Barkod Aranıyor...'), 2000);
        },
        () => setStatus('🔍 Barkod Aranıyor...')
      );
      setStatus('🔍 Barkod Aranıyor...');
    } catch (err) {
      playBeep(false);
      setStatus(`❌ Kamera Hatası: ${err.message || err}`);
    }
  };

  // Tarayıcıyı durdur
  const stopScanner = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop().catch(() => {});
    }
    scannerRef.current = null;
  };

  // Kamera listesi yükle ve başlat
  useEffect(() => {
    let mounted = true;
    Html5Qrcode.getCameras()
      .then(async (cams) => {
        if (!mounted || !cams?.length) {
          setStatus('❌ Kamera bulunamadı');
          return;
        }
        const backIdx = findBackCamIdx(cams);
        setCameras(cams);
        setActiveCamIdx(backIdx);
        await startScanner(cams, backIdx);
      })
      .catch(() => setStatus('❌ Kamera izni reddedildi'));

    return () => {
      mounted = false;
      stopScanner();
    };
  }, []);

  // Kamera değiştir
  const switchCamera = async () => {
    if (cameras.length < 2) return;
    await stopScanner();
    const nextIdx = (activeCamIdx + 1) % cameras.length;
    setActiveCamIdx(nextIdx);
    setStatus('Kamera değiştiriliyor...');
    setTimeout(() => startScanner(cameras, nextIdx), 300);
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.92)',
      zIndex: 2000,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      {/* Başlık */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', maxWidth: '480px', marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Camera size={20} color="var(--primary-color)" />
          <span style={{ color: 'white', fontWeight: '600', fontSize: '1rem' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {cameras.length > 1 && (
            <button
              onClick={switchCamera}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '0.4rem 0.7rem', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
            >
              <SwitchCamera size={15} /> Kamera Değiştir
            </button>
          )}
          <button
            onClick={handleClose}
            style={{ background: 'rgba(224,62,62,0.2)', border: '1px solid rgba(224,62,62,0.4)', borderRadius: '8px', padding: '0.4rem 0.7rem', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
          >
            <X size={15} /> Kapat
          </button>
        </div>
      </div>

      {/* Kamera Görüntüsü */}
      <div style={{
        width: '100%', maxWidth: '480px',
        borderRadius: '16px',
        overflow: 'hidden',
        border: `2px solid ${flashCount > 0 ? 'var(--success-color)' : 'rgba(27,99,216,0.5)'}`,
        boxShadow: flashCount > 0 ? '0 0 24px var(--success-color)' : '0 0 24px rgba(27,99,216,0.3)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        position: 'relative',
      }}>
        <div id={scannerId.current} style={{ width: '100%' }} />

        {/* Köşe işaretçileri */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {[{ top: 12, left: 12 }, { top: 12, right: 12 }, { bottom: 12, left: 12 }, { bottom: 12, right: 12 }].map((pos, i) => (
            <div key={i} style={{
              position: 'absolute', ...pos,
              width: '20px', height: '20px',
              borderTop: i < 2 ? '3px solid var(--primary-color)' : 'none',
              borderBottom: i >= 2 ? '3px solid var(--primary-color)' : 'none',
              borderLeft: i % 2 === 0 ? '3px solid var(--primary-color)' : 'none',
              borderRight: i % 2 === 1 ? '3px solid var(--primary-color)' : 'none',
              borderRadius: i === 0 ? '4px 0 0 0' : i === 1 ? '0 4px 0 0' : i === 2 ? '0 0 0 4px' : '0 0 4px 0',
            }} />
          ))}
        </div>
      </div>

      {/* Durum Çubuğu */}
      <div style={{
        marginTop: '1rem',
        width: '100%', maxWidth: '480px',
        padding: '0.75rem 1rem',
        borderRadius: '10px',
        background: status.startsWith('✅') ? 'rgba(14,164,114,0.2)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${status.startsWith('✅') ? 'var(--success-color)' : 'rgba(255,255,255,0.1)'}`,
        color: status.startsWith('✅') ? 'var(--success-color)' : 'rgba(255,255,255,0.7)',
        fontSize: '0.88rem',
        fontWeight: '500',
        textAlign: 'center',
        transition: 'all 0.3s',
      }}>
        {status}
      </div>

      {/* Son Okunan */}
      {lastScan && (
        <div style={{ marginTop: '0.5rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>
          Son okunan: <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{lastScan}</strong>
        </div>
      )}

      {/* İpucu */}
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', marginTop: '1rem', textAlign: 'center' }}>
        USB/Bluetooth barkod okuyucu da otomatik olarak çalışır
      </p>
    </div>
  );
}

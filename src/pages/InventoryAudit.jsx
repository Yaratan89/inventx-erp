import { useState, useEffect, useRef } from 'react';
import { Search, Camera, CheckCircle2, AlertCircle, Plus, X, History, Warehouse, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function InventoryAudit() {
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCount, setActiveCount] = useState(null);
  const [countItems, setCountItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null); // { text, type: 'success'|'error' }

  const [selectedLoc, setSelectedLoc] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Yerel miktar state'i — çok haneli giriş sorununun çözümü
  const [localQtys, setLocalQtys] = useState({});

  const scannerRef = useRef(null);

  useEffect(() => {
    fetchInitialData();
    checkActiveSession();
  }, []);

  // Fiziksel barkod okuyucu (USB/Bluetooth) — klavye buffer sistemi
  useEffect(() => {
    if (!activeCount) return;
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKey = (e) => {
      // Input/select alanlarındaysa müdahale etme
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const now = Date.now();
      if (now - lastKeyTime > 150) buffer = ''; // 150ms'den uzun arayla yeni barkod başlıyor
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.length > 2) handleBarcodeScanned(buffer);
        buffer = '';
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeCount, countItems, products]);

  // Kamera tarayıcı başlat/durdur
  useEffect(() => {
    if (showScanner) {
      const initScanner = async () => {
        try {
          // Tüm barkod formatlarını destekle (CODE-128, EAN-13, UPC-A, QR vb.)
          const formatsToSupport = [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
          ];

          const html5QrCode = new Html5Qrcode('audit-reader', {
            formatsToSupport,
            verbose: false,
          });
          scannerRef.current = html5QrCode;

          const config = {
            fps: 20, // Daha hızlı tarama
            qrbox: { width: 380, height: 150 }, // Barkodlar için yatay dikdörtgen
            videoConstraints: {
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          };

          await html5QrCode.start(
            { facingMode: { exact: 'environment' } },
            config,
            (decodedText) => handleBarcodeScanned(decodedText),
            () => {} // Başarısız okuma sessiz geç
          );
        } catch (err) {
          console.error('Kamera başlatma hatası:', err);
          setScanFeedback({ text: 'Kamera açılamadı. Elle giriş kullanın.', type: 'error' });
        }
      };
      initScanner();
    }
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [showScanner]);

  const fetchInitialData = async () => {
    const { data: locs } = await supabase.from('locations').select('*').order('name');
    const { data: prds } = await supabase.from('products').select('*');
    const { data: hist } = await supabase.from('inventory_counts')
      .select('*, locations(name)')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(10);

    if (locs) setLocations(locs);
    if (prds) setProducts(prds);
    if (hist) setHistory(hist);
  };

  const checkActiveSession = async () => {
    const { data } = await supabase.from('inventory_counts')
      .select('*, locations(name)')
      .eq('status', 'draft')
      .maybeSingle();

    if (data) {
      setActiveCount(data);
      fetchSessionItems(data.id);
    }
  };

  const fetchSessionItems = async (countId) => {
    const { data } = await supabase.from('inventory_count_items')
      .select('*, products(name, sku, barcode)')
      .eq('count_id', countId);
    if (data) {
      setCountItems(data);
      // Yerel miktar state'ini senkronize et
      const qtys = {};
      data.forEach(item => { qtys[item.id] = item.counted_qty; });
      setLocalQtys(qtys);
    }
  };

  const handleStartSession = async () => {
    if (!selectedLoc) return alert('Lütfen depo seçiniz.');
    setLoading(true);

    const { data: session, error } = await supabase.from('inventory_counts').insert([{
      location_id: selectedLoc,
      status: 'draft',
      created_by: 'Admin'
    }]).select().single();

    if (error) {
      alert('❌ Sayım başlatılamadı: ' + error.message);
      setLoading(false);
      return;
    }

    const { data: currentInv } = await supabase.from('inventory')
      .select('product_id, quantity')
      .eq('location_id', selectedLoc);

    const itemsToInsert = (currentInv || []).map(inv => ({
      count_id: session.id,
      product_id: inv.product_id,
      system_qty: inv.quantity,
      counted_qty: 0
    }));

    if (itemsToInsert.length > 0) {
      await supabase.from('inventory_count_items').insert(itemsToInsert);
    }

    setActiveCount(session);
    await fetchSessionItems(session.id);
    setLoading(false);
  };

  // Barkod okunduğunda ilgili ürünü bul ve miktarı 1 artır
  const handleBarcodeScanned = async (code) => {
    // Kamera modalını kapat
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop().catch(() => {});
    }
    setShowScanner(false);

    const trimmed = code.trim();
    const product = products.find(p =>
      p.barcode === trimmed ||
      p.sku === trimmed ||
      p.barcode?.trim() === trimmed
    );

    if (!product) {
      setScanFeedback({ text: `❌ Kayıtlı değil: ${trimmed}`, type: 'error' });
      setTimeout(() => setScanFeedback(null), 3000);
      return;
    }

    const item = countItems.find(i => i.product_id === product.id);
    if (!item) {
      setScanFeedback({ text: `⚠️ "${product.name}" bu sayımın listesinde yok.`, type: 'error' });
      setTimeout(() => setScanFeedback(null), 3000);
      return;
    }

    const newQty = (item.counted_qty || 0) + 1;
    await saveQty(item.id, newQty);
    setScanFeedback({ text: `✅ ${product.name} → ${newQty} adet`, type: 'success' });
    setTimeout(() => setScanFeedback(null), 3000);
  };

  // Manuel barkod girişi
  const handleManualBarcode = async (code) => {
    if (!code) return;
    await handleBarcodeScanned(code);
  };

  // Veritabanına miktarı kaydet (sadece blur'da çağrılır)
  const saveQty = async (itemId, newQty) => {
    const qty = parseInt(newQty) || 0;
    const { error } = await supabase.from('inventory_count_items')
      .update({ counted_qty: qty })
      .eq('id', itemId);

    if (!error) {
      setCountItems(prev =>
        prev.map(item => item.id === itemId ? { ...item, counted_qty: qty } : item)
      );
      setLocalQtys(prev => ({ ...prev, [itemId]: qty }));
    }
  };

  const handleFinishCount = async () => {
    if (!confirm('Sayımı bitirmek ve sistem stoklarını güncellemek istediğinize emin misiniz?')) return;
    setLoading(true);

    try {
      for (const item of countItems) {
        await supabase.from('inventory').upsert({
          product_id: item.product_id,
          location_id: activeCount.location_id,
          quantity: item.counted_qty
        }, { onConflict: 'product_id,location_id' });

        if (item.counted_qty !== item.system_qty) {
          await supabase.from('audit_logs').insert([{
            action: 'UPDATE',
            feature: 'Stok Sayım',
            detail: `${item.products?.name} sayıldı. Fark: ${item.counted_qty - item.system_qty}. Stok eşitlendi.`,
            user_name: 'Admin'
          }]);
        }
      }

      await supabase.from('inventory_counts').update({
        status: 'completed',
        completed_at: new Date().toISOString()
      }).eq('id', activeCount.id);

      alert('✅ Sayım başarıyla tamamlandı ve stoklar güncellendi.');
      setActiveCount(null);
      setCountItems([]);
      setLocalQtys({});
      fetchInitialData();
    } catch (err) {
      alert('Hata oluştu: ' + err.message);
    }
    setLoading(false);
  };

  const filteredItems = countItems.filter(i =>
    (i.products?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.products?.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.products?.barcode || '').includes(searchTerm)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Başlık + Kontroller */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Stok Sayım & Envanter Denetimi</h2>
          <p style={{ color: 'var(--text-muted)' }}>Fiziksel stoklarınızı barkodla tarayarak sistemle eşitleyin. <span style={{ color: 'var(--primary-color)', fontSize: '0.8rem' }}><Zap size={12} style={{ display: 'inline' }} /> USB okuyucu da desteklenir</span></p>
        </div>
        {!activeCount && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <select
              className="input-field high-visibility-select"
              style={{ width: '200px' }}
              value={selectedLoc}
              onChange={e => setSelectedLoc(e.target.value)}
            >
              <option value="">Depo Seçin...</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <button
              className="btn btn-primary"
              onClick={handleStartSession}
              disabled={loading || !selectedLoc}
              style={{ minWidth: '180px' }}
            >
              {loading ? 'Hazırlanıyor...' : <><Plus size={18} /> Yeni Sayım Başlat</>}
            </button>
          </div>
        )}
        {activeCount && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={() => setActiveCount(null)}><X size={18} /> Askıya Al</button>
            <button
              className="btn btn-primary"
              style={{ background: 'var(--success-color)' }}
              onClick={handleFinishCount}
              disabled={loading}
            >
              <CheckCircle2 size={18} /> Sayımı Bitir (Eşitle)
            </button>
          </div>
        )}
      </div>

      {/* Ana İçerik */}
      {!activeCount ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
          <div className="card glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
            <Warehouse size={48} color="var(--primary-color)" style={{ marginBottom: '1.5rem', opacity: 0.5 }} />
            <h3>Aktif Sayım Yok</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sağ üstten bir depo seçerek sayım sürecini başlatın.</p>
          </div>

          <div className="card">
            <h4 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} color="var(--text-muted)" /> Son Sayım Geçmişi
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {history.map(h => (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--surface-hover)', borderRadius: '12px' }}>
                  <div>
                    <span style={{ fontWeight: '700' }}>{h.locations?.name}</span>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {h.completed_at ? format(new Date(h.completed_at), 'dd MMMM yyyy HH:mm', { locale: tr }) : '—'}
                    </p>
                  </div>
                  <div className="badge badge-primary">Tamamlandı</div>
                </div>
              ))}
              {history.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>Kayıtlı geçmiş yok.</p>}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Sayım Bilgi Paneli */}
          <div className="card glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid var(--primary-color)' }}>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sayılan Depo</p>
                <h4 style={{ margin: 0 }}>{activeCount.locations?.name}</h4>
              </div>
              <div style={{ height: '30px', width: '1px', background: 'var(--border-color)' }}></div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Toplam Ürün</p>
                <h4 style={{ margin: 0 }}>{countItems.length} Kalem</h4>
              </div>
              <div style={{ height: '30px', width: '1px', background: 'var(--border-color)' }}></div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Farklı</p>
                <h4 style={{ margin: 0, color: 'var(--danger-color)' }}>
                  {countItems.filter(i => i.counted_qty !== i.system_qty).length} Hatalı
                </h4>
              </div>
            </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexDirection: 'column', alignItems: 'flex-end' }}>
                 {/* Tarama Geri Bildirimi */}
                 {scanFeedback && (
                   <div style={{
                     padding: '0.6rem 1.2rem',
                     borderRadius: '10px',
                     fontWeight: '700',
                     fontSize: '0.9rem',
                     background: scanFeedback.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                     color: scanFeedback.type === 'success' ? 'var(--success-color)' : 'var(--danger-color)',
                     border: `1px solid ${scanFeedback.type === 'success' ? 'var(--success-color)' : 'var(--danger-color)'}`,
                     animation: 'fadeIn 0.2s ease',
                   }}>
                     {scanFeedback.text}
                   </div>
                 )}
                 <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                   <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--surface-hover)', padding: '0.5rem 1rem', borderRadius: '12px' }}>
                     <Search size={18} color="var(--text-muted)" />
                     <input
                       type="text"
                       style={{ border: 'none', background: 'transparent', width: '220px', color: 'var(--text-main)', outline: 'none' }}
                       placeholder="Ürün veya Barkod ara..."
                       value={searchTerm}
                       onChange={e => setSearchTerm(e.target.value)}
                     />
                   </div>
                   <button className="btn btn-primary" onClick={() => setShowScanner(true)}>
                     <Camera size={18} /> Kamera ile Tara
                   </button>
                 </div>
              </div>
          </div>

          {/* Sayım Tablosu */}
          <div className="card" style={{ padding: '0' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <th style={{ padding: '1.25rem' }}>Ürün / Barkod</th>
                    <th style={{ padding: '1.25rem', textAlign: 'center' }}>Sistem Stok</th>
                    <th style={{ padding: '1.25rem', textAlign: 'center' }}>Sayılan Miktar</th>
                    <th style={{ padding: '1.25rem', textAlign: 'center' }}>Fark</th>
                    <th style={{ padding: '1.25rem', textAlign: 'center' }}>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const diff = item.counted_qty - item.system_qty;
                    const localVal = localQtys[item.id] ?? item.counted_qty;
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '1.25rem' }}>
                          <div style={{ fontWeight: '700' }}>{item.products?.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {item.products?.sku} | {item.products?.barcode || 'Barkodsuz'}
                          </div>
                        </td>
                        <td style={{ padding: '1.25rem', textAlign: 'center', fontWeight: '600' }}>{item.system_qty} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.products?.unit || 'Adet'}</span></td>
                        <td style={{ padding: '1.25rem', textAlign: 'center' }}>
                          {/* FIX: value yerine localQtys kullan, onBlur'da kaydet */}
                          <input
                            type="number"
                            className="input-field"
                            style={{ width: '90px', textAlign: 'center', fontSize: '1rem', fontWeight: '700' }}
                            value={localVal}
                            min="0"
                            onChange={e => setLocalQtys(prev => ({ ...prev, [item.id]: e.target.value }))}
                            onBlur={e => saveQty(item.id, e.target.value)}
                          />
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{item.products?.unit || 'Adet'}</div>
                        </td>
                        <td style={{ padding: '1.25rem', textAlign: 'center', fontWeight: '800', color: diff === 0 ? 'inherit' : diff > 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                          {diff > 0 ? `+${diff}` : diff}
                        </td>
                        <td style={{ padding: '1.25rem', textAlign: 'center' }}>
                          {diff === 0
                            ? <CheckCircle2 size={20} color="var(--success-color)" style={{ margin: 'auto' }} />
                            : <AlertCircle size={20} color="var(--warning-color)" style={{ margin: 'auto' }} />
                          }
                        </td>
                      </tr>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Bu depoda sayılacak ürün bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Barkod Tarayıcı Modal */}
      {showScanner && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.95)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card glass-panel animate-fade-in" style={{ width: '480px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ color: 'white', margin: 0 }}>Barkod Tara</h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Barkodu kırmızı çizgiye hizalayın</p>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowScanner(false)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
              <div id="audit-reader" style={{ width: '100%' }}></div>
              <div style={{ position: 'absolute', top: '50%', left: '10%', width: '80%', height: '2px', background: 'rgba(255,0,0,0.7)', boxShadow: '0 0 10px red', zIndex: 10, pointerEvents: 'none' }}></div>
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>
                Kamera okumuyorsa elle girin:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  id="audit-manual-input"
                  type="text"
                  className="input-field"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', flex: 1 }}
                  placeholder="Barkod veya SKU..."
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.target.value) {
                      handleManualBarcode(e.target.value);
                    }
                  }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const val = document.getElementById('audit-manual-input').value;
                    if (val) handleManualBarcode(val);
                  }}
                >
                  Ara
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

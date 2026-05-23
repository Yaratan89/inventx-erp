import { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Search, User, Calendar, DollarSign, ArrowDownLeft, FileText, Trash2, X, Plus, Package, MapPin, CreditCard, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import BarcodeScanner from '../components/BarcodeScanner';

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Veri çekme ve form state'leri
  const [products, setProducts] = useState([]);
  const [parties, setParties] = useState([]);
  const [locations, setLocations] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [settings, setSettings] = useState({ name: 'InventX İşletmesi', address: '', phone: '', tax_id: '', tax_office: '' });
  
  const [saleData, setSaleData] = useState({
    product_id: '',
    party_id: '',
    location_id: '',
    qty: 1,
    price: 0,
    method: 'Cash',
    irsaliye_no: '',
    fatura_no: ''
  });

  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Ayarları çek
      const { data: stgs } = await supabase.from('app_settings').select('*');
      if (stgs) {
         const mapped = {};
         stgs.forEach(s => mapped[s.key] = s.value);
         setSettings(prev => ({ ...prev, ...mapped }));
      }

      // Satışları çek
      const { data: txs } = await supabase
        .from('financial_transactions')
        .select('*, parties(name)')
        .or('type.eq.Sale_Credit,type.eq.Collection')
        .order('created_at', { ascending: false });

      // Sadece açıklamada "Satış" geçenleri al
      const filteredSales = (txs || []).filter(t => t.description?.includes('Satış'));
      setSales(filteredSales);

      // Diğer veriler
      const { data: prds } = await supabase.from('products').select('*').order('name');
      const { data: pts } = await supabase.from('parties').select('*').eq('type', 'Customer').order('name');
      const { data: locs } = await supabase.from('locations').select('*').order('name');
      const { data: inv } = await supabase.from('inventory').select('*');

      setProducts(prds || []);
      setParties(pts || []);
      setLocations(locs || []);
      setInventory(inv || []);
    } catch (err) {
      console.error("Hata:", err);
    }
    setLoading(false);
  };

  const getProductLocationStock = (prdId, locId) => 
    (inventory || []).find(i => i.product_id === prdId && i.location_id === locId)?.quantity || 0;

  const handleNewSale = async (e) => {
    e.preventDefault();
    if (!saleData.product_id || !saleData.party_id || !saleData.location_id) {
       alert("Lütfen tüm alanları doldurun.");
       return;
    }

    const selectedProduct = products.find(p => p.id === saleData.product_id);
    const currentStock = getProductLocationStock(saleData.product_id, saleData.location_id);

    if (currentStock < saleData.qty) {
       alert(`Yetersiz Stok! Seçili depoda sadece ${currentStock} adet ürün var.`);
       return;
    }

    setLoading(true);

    try {
      // 1. Stok Düşümü - Daha Güvenli Sorgu
      const { data: invItems, error: invFetchErr } = await supabase.from('inventory')
        .select('id')
        .eq('product_id', saleData.product_id)
        .eq('location_id', saleData.location_id);
      
      if (invFetchErr) throw new Error("Stok bilgisi sorgulanamadı: " + invFetchErr.message);
      
      const invItem = invItems?.[0];
      if (!invItem) {
        throw new Error("Seçilen depoda bu ürünün stok kaydı bulunamadı. Lütfen önce stok girişi yapın.");
      }

      const { error: invUpdErr } = await supabase.from('inventory')
        .update({ quantity: currentStock - saleData.qty })
        .eq('id', invItem.id);
      
      if (invUpdErr) throw new Error("Stok düşülemedi: " + invUpdErr.message);

      // 2. Finansal Kayıt
      const totalAmount = saleData.price * saleData.qty;
      const { data: txData, error: txErr } = await supabase.from('financial_transactions').insert([{
        party_id: saleData.party_id,
        amount: totalAmount,
        type: saleData.method === 'Credit' ? 'Sale_Credit' : 'Collection',
        method: saleData.method === 'Credit' ? 'Cash' : saleData.method,
        description: `${selectedProduct.name} - ${saleData.qty} Adet Satış${saleData.irsaliye_no ? ' | İrs:'+saleData.irsaliye_no : ''}${saleData.fatura_no ? ' | Fat:'+saleData.fatura_no : ''}`
      }]).select().single();

      if (txErr) throw new Error("Finansal kayıt oluşturulamadı: " + txErr.message);

      // 3. Log
      await supabase.from('audit_logs').insert([{
        action: 'UPDATE',
        feature: 'Satış Yönetimi',
        detail: `${selectedProduct.name} ürününden ${saleData.qty} adet satış yapıldı. Tutar: ₺${totalAmount}${saleData.irsaliye_no ? ' İrsaliye:'+saleData.irsaliye_no : ''}${saleData.fatura_no ? ' Fatura:'+saleData.fatura_no : ''}`,
        user_name: 'Admin'
      }]);

      alert("Satış başarıyla gerçekleştirildi. Fatura/Fiş oluşturuluyor...");
      if (scannerRef.current) scannerRef.current.stop().catch(console.error);
      setIsAddModalOpen(false);
      setShowScanner(false);
      
      // Yazdırma İşlemini Otomatik Başlat
      const party = parties.find(p => p.id === saleData.party_id);
      if (txData) {
        handlePrint({ ...txData, parties: party });
      }

      await fetchInitialData();
    } catch (err) {
      console.error(err);
      alert("Hata Oluştu: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const startScanner = () => {
    setShowScanner(true);
  };

  const handleBarcodeScan = (decodedText) => {
    const product = products.find(p => p.barcode === decodedText || p.sku === decodedText);
    if (product) {
      setSaleData(prev => ({ ...prev, product_id: product.id, price: product.price }));
      setShowScanner(false);
    }
    // Ürün bulunamazsa taramaya devam et (kapat butonu ile çıkılır)
  };

  const handlePrint = (sale) => {
    const printWindow = window.open('', '_blank');
    const qrData = encodeURIComponent(`Fatura No: ${sale.id} | Tutar: ${sale.amount} TL | Tarih: ${format(new Date(sale.created_at || new Date()), 'dd.MM.yyyy')}`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Fatura/Belge - ${sale.id?.slice(0,8) || 'YENİ'}</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            @media print {
              @page { margin: 0; size: A4 portrait; }
              body { -webkit-print-color-adjust: exact; margin: 0; padding: 2cm !important; }
              .no-print { display: none !important; }
            }
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; max-width: 21cm; margin: auto; background: #fff; box-sizing: border-box; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 30px; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; }
            .company-info h1 { margin: 0; color: #0f172a; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
            .company-details { font-size: 12px; color: #64748b; margin-top: 8px; line-height: 1.6; }
            .document-meta { text-align: right; }
            .document-meta h2 { margin: 0; color: #3b82f6; font-size: 32px; font-weight: 800; letter-spacing: -1px; text-transform: uppercase; }
            .meta-grid { display: grid; grid-template-columns: auto auto; gap: 8px 24px; margin-top: 16px; text-align: right; font-size: 12px; }
            .meta-label { color: #94a3b8; font-weight: 500; text-transform: uppercase; }
            .meta-value { color: #0f172a; font-weight: 600; }
            
            .info-section { display: flex; justify-content: space-between; margin-bottom: 40px; background: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; }
            .info-box h4 { margin: 0 0 12px 0; color: #64748b; text-transform: uppercase; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
            .info-box p { margin: 4px 0; font-weight: 600; font-size: 14px; color: #0f172a; }
            .info-box .sub-text { font-weight: 400; color: #64748b; font-size: 12px; }
            
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 40px; }
            th { text-align: left; padding: 16px; background: #f1f5f9; font-size: 11px; text-transform: uppercase; color: #475569; font-weight: 700; letter-spacing: 0.5px; }
            th:first-child { border-top-left-radius: 8px; border-bottom-left-radius: 8px; }
            th:last-child { border-top-right-radius: 8px; border-bottom-right-radius: 8px; }
            td { padding: 20px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; }
            
            .totals-container { display: flex; justify-content: space-between; align-items: flex-start; }
            .qr-code { padding: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; display: inline-block; }
            .totals-box { width: 320px; }
            .total-row { display: flex; justify-content: space-between; padding: 12px 0; font-size: 14px; color: #475569; border-bottom: 1px solid #f1f5f9; }
            .grand-total { border-top: 2px solid #3b82f6; border-bottom: none; padding-top: 16px; margin-top: 4px; }
            .grand-total span { font-weight: 800; font-size: 20px; color: #3b82f6; }
            
            .footer { margin-top: 60px; padding-top: 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
            .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
            .status-paid { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
            .status-debt { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              <img src="${window.location.origin}/lundberg-logo.png" alt="${settings.name || 'LUNDBERG FARM GIDA'}" style="height: 80px; max-width: 250px; object-fit: contain; margin-bottom: 8px;" />
              <div class="company-details">
                ${settings.address ? `<p style="margin:0">${settings.address}</p>` : ''}
                <p style="margin:4px 0 0 0">
                  ${settings.phone ? `Tel: ${settings.phone} | ` : ''}
                  ${settings.tax_office ? `VD: ${settings.tax_office} | ` : ''}
                  ${settings.tax_id ? `V.No: ${settings.tax_id}` : ''}
                </p>
              </div>
            </div>
            <div class="document-meta">
              <h2>SATIŞ BELGESİ</h2>
              <div class="meta-grid">
                <span class="meta-label">Belge No</span>
                <span class="meta-value">#${sale.id?.slice(0,8).toUpperCase() || 'YENİ'}</span>
                <span class="meta-label">Tarih</span>
                <span class="meta-value">${format(new Date(sale.created_at || new Date()), 'dd.MM.yyyy HH:mm')}</span>
              </div>
            </div>
          </div>

          <div class="info-section">
            <div class="info-box">
              <h4>MÜŞTERİ (CARİ) BİLGİLERİ</h4>
              <p>${sale.parties?.name || 'Bilinmeyen Müşteri'}</p>
              <span class="sub-text">Cari ID: ${sale.party_id?.slice(0,8) || '-'}</span>
            </div>
            <div class="info-box" style="text-align: right;">
              <h4>ÖDEME VE DURUM</h4>
              <div style="margin-bottom: 8px;">
                <span class="status-badge ${sale.type === 'Sale_Credit' ? 'status-debt' : 'status-paid'}">
                  ${sale.type === 'Sale_Credit' ? 'AÇIK HESAP (KREDİLİ)' : 'ÖDENDİ / TAHSİL EDİLDİ'}
                </span>
              </div>
              <span class="sub-text">Yöntem: ${sale.method === 'Cash' ? 'Nakit' : sale.method === 'Bank' ? 'Havale/EFT' : 'Veresiye'}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Ürün / İşlem Açıklaması</th>
                <th style="text-align: center">Miktar</th>
                <th style="text-align: right">Birim Fiyat</th>
                <th style="text-align: right">Satır Toplamı</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong style="color: #0f172a;">${sale.description || 'Satış İşlemi'}</strong>
                </td>
                <td style="text-align: center; font-weight: 500;">
                  ${sale.description?.match(/(\d+)\s+Adet/)?.[1] || 1} Birim
                </td>
                <td style="text-align: right">
                  ₺${(sale.amount / (parseInt(sale.description?.match(/(\d+)\s+Adet/)?.[1]) || 1)).toLocaleString(undefined, {minimumFractionDigits:2})}
                </td>
                <td style="text-align: right; font-weight: 600; color: #0f172a;">
                  ₺${Number(sale.amount).toLocaleString(undefined, {minimumFractionDigits:2})}
                </td>
              </tr>
            </tbody>
          </table>

          <div class="totals-container">
            <div>
              <div class="qr-code">
                <img src="${qrUrl}" alt="QR Kod" style="display: block;" />
              </div>
              <p style="font-size: 10px; color: #94a3b8; margin-top: 8px; text-align: center;">Belge Doğrulama Kodu</p>
            </div>
            <div class="totals-box">
              <div class="total-row">
                <span>Ara Toplam</span>
                <span style="font-weight: 600;">₺${Number(sale.amount).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
              </div>
              <div class="total-row">
                <span>KDV (%0 - Muaf)</span>
                <span style="font-weight: 600;">₺0.00</span>
              </div>
              <div class="total-row grand-total">
                <span style="color: #0f172a;">GENEL TOPLAM</span>
                <span>₺${Number(sale.amount).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <div>
              <strong>InventX Pro ERP</strong> tarafından dijital olarak oluşturulmuştur.
            </div>
            <div>
              İmza / Kaşe
            </div>
          </div>

          <script>
            // Resimlerin yüklenmesini bekle ve yazdır
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.onafterprint = () => window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredSalesList = (sales || []).filter(s => 
    (s.parties?.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) || 
    (s.description?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Stok Çıkışı / Satışlar</h2>
          <p style={{ color: 'var(--text-muted)' }}>Yapılan tüm satışları ve stok çıkış hareketlerini buradan yönetin.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-primary" onClick={() => startScanner()}>
            <Camera size={18} /> Tarat
          </button>
          <button className="btn btn-primary" style={{ background: '#10b981', borderColor: '#10b981' }} onClick={() => setIsAddModalOpen(true)}>
            <ShoppingCart size={18} /> Yeni Satış Yap
          </button>
        </div>
      </div>

      <div className="card glass-panel" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <Search size={20} color="var(--text-muted)" />
        <input 
          type="text" 
          className="input-field" 
          style={{ border: 'none', background: 'transparent', flex: 1 }} 
          placeholder="Müşteri veya açıklama ara..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
        />
      </div>

      <div className="card" style={{ padding: '0' }}>
         <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  <th style={{ padding: '1.25rem' }}>İşlem Tarihi</th>
                  <th style={{ padding: '1.25rem' }}>Müşteri (Cari)</th>
                  <th style={{ padding: '1.25rem' }}>İrsaliye No</th>
                  <th style={{ padding: '1.25rem' }}>Fatura No</th>
                  <th style={{ padding: '1.25rem' }}>Detay / Açıklama</th>
                  <th style={{ padding: '1.25rem' }}>Ödeme Yöntemi</th>
                  <th style={{ padding: '1.25rem', textAlign: 'right' }}>Toplam Tutar</th>
                  <th style={{ padding: '1.25rem', textAlign: 'center' }}>İşlemler</th>
                </tr>
              </thead>
               <tbody>
                 {filteredSalesList.length > 0 ? filteredSalesList.map(sale => (
                   <tr key={sale.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                     <td style={{ padding: '1.25rem', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                           <Calendar size={14} color="var(--text-muted)" />
                           {format(new Date(sale.created_at), 'dd MMM yyyy HH:mm')}
                        </div>
                     </td>
                     <td style={{ padding: '1.25rem', fontWeight: '600' }}>{sale.parties?.name}</td>
                     <td style={{ padding: '1.25rem', color: 'var(--text-muted)' }}>
                        {(() => {
                           const m = sale.description?.match(/İrs(?:aliye)?:?\s*([^\s|]+)/i);
                           return m ? m[1] : '-';
                        })()}
                     </td>
                     <td style={{ padding: '1.25rem', color: 'var(--text-muted)' }}>
                        {(() => {
                           const m = sale.description?.match(/Fat(?:ura)?:?\s*([^\s|]+)/i);
                           return m ? m[1] : '-';
                        })()}
                     </td>
                     <td style={{ padding: '1.25rem' }}>
                        <div style={{ fontSize: '0.9rem' }}>
                           {(sale.description || 'Satış İşlemi').replace(/\|\s*İrs(?:aliye)?:?\s*[^\s|]+/i, '').replace(/\|\s*Fat(?:ura)?:?\s*[^\s|]+/i, '').trim()}
                        </div>
                     </td>
                     <td style={{ padding: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                           {sale.method === 'Cash' ? <DollarSign size={14} /> : <CreditCard size={14} />}
                           {sale.method === 'Cash' ? 'Nakit' : sale.method === 'Bank' ? 'Havale/EFT' : 'Kredi Kartı'}
                        </div>
                     </td>
                     <td style={{ padding: '1.25rem', textAlign: 'right', fontWeight: '800', fontSize: '1.1rem' }}>
                        ${sale.amount.toLocaleString()}
                     </td>
                     <td style={{ padding: '1.25rem', textAlign: 'center' }}>
                        <button className="btn btn-secondary" style={{ padding: '0.5rem', fontSize: '0.75rem' }} onClick={() => handlePrint(sale)}>
                           <FileText size={16} style={{ marginRight: '0.4rem' }} /> Fatura
                        </button>
                     </td>
                   </tr>
                 )) : (
                   <tr>
                     <td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <ShoppingCart size={48} opacity={0.2} style={{ marginBottom: '1rem' }} />
                        <p>Henüz bir satış kaydı bulunamadı.</p>
                     </td>
                   </tr>
                 )}
               </tbody>
            </table>
         </div>
      </div>

      {/* NEW SALE MODAL */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade-in" style={{ width: '500px', padding: '2.5rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                   <h3 style={{ fontWeight: '800', margin: 0, color: 'var(--primary-color)' }}>Yeni Stok Çıkışı / Satış</h3>
                   <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ürün seçin ve satışı gerçekleştirin.</p>
                </div>
                <button className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}><X size={20}/></button>
             </div>
             
             <form onSubmit={handleNewSale} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                 <div className="input-group">
                    <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                       Ürün Seçimi
                       <button type="button" onClick={startScanner} style={{ color: 'var(--primary-color)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Camera size={14} /> Kamera ile Tara
                       </button>
                    </label>
                    
                    {showScanner && (
                      <div id="sale-scanner" style={{ width: '100%', height: '200px', background: '#000', borderRadius: '8px', marginBottom: '1rem', overflow: 'hidden' }}></div>
                    )}

                    <select 
                       className="input-field high-visibility-select" 
                       value={saleData.product_id} 
                       onChange={e => {
                          const prd = products.find(p => p.id === e.target.value);
                          setSaleData({...saleData, product_id: e.target.value, price: prd?.price || 0});
                       }}
                       required
                    >
                       <option value="">Ürün Seçiniz...</option>
                       {products.map(p => <option key={p.id} value={p.id}>{p.name} (Ref: {p.sku})</option>)}
                    </select>
                 </div>

                <div className="input-group">
                   <label>Müşteri (Cari)</label>
                   <select className="input-field high-visibility-select" value={saleData.party_id} onChange={e => setSaleData({...saleData, party_id: e.target.value})} required>
                      <option value="">Müşteri Seçiniz...</option>
                      {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                   </select>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                   <div style={{ flex: 1 }} className="input-group">
                      <label>Çıkış Deposu</label>
                      <select className="input-field high-visibility-select" value={saleData.location_id} onChange={e => setSaleData({...saleData, location_id: e.target.value})} required>
                         <option value="">Depo Seçin...</option>
                         {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                   </div>
                   <div style={{ flex: 1 }} className="input-group">
                      <label>Miktar</label>
                      <input type="number" step="any" className="input-field" value={saleData.qty} onChange={e => setSaleData({...saleData, qty: parseFloat(e.target.value) || 1})} min="0.01" required />
                   </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                   <div style={{ flex: 1 }} className="input-group">
                      <label>Birim Satış Fiyatı (₺)</label>
                      <input type="number" step="0.01" className="input-field" value={saleData.price} onChange={e => setSaleData({...saleData, price: parseFloat(e.target.value) || 0})} required />
                   </div>
                   <div style={{ flex: 1 }} className="input-group">
                      <label>Ödeme Yöntemi</label>
                      <select className="input-field" value={saleData.method} onChange={e => setSaleData({...saleData, method: e.target.value})}>
                         <option value="Cash">Nakit</option>
                         <option value="Bank">Banka / EFT</option>
                         <option value="Credit">Veresiye (Açık Hesap)</option>
                      </select>
                   </div>
                </div>

                {/* İrsaliye & Fatura */}
                <div style={{ display: 'flex', gap: '1rem' }}>
                   <div className="input-group" style={{ flex: 1 }}>
                     <label>İrsaliye No</label>
                     <input className="input-field" placeholder="Opsiyonel" value={saleData.irsaliye_no} onChange={e => setSaleData({...saleData, irsaliye_no: e.target.value})} />
                   </div>
                   <div className="input-group" style={{ flex: 1 }}>
                     <label>Fatura No</label>
                     <input className="input-field" placeholder="Opsiyonel" value={saleData.fatura_no} onChange={e => setSaleData({...saleData, fatura_no: e.target.value})} />
                   </div>
                </div>

                <div style={{ marginTop: '0.5rem', padding: '1.25rem', background: 'var(--primary-light)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--primary-color)' }}>
                   <span style={{ fontWeight: '700', color: 'var(--primary-color)' }}>Toplam Tahsilat:</span>
                   <span style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary-color)' }}>₺{(saleData.price * saleData.qty).toLocaleString()}</span>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                   <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsAddModalOpen(false)}>İptal</button>
                   <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                      {loading ? 'İşleniyor...' : 'Satışı Onayla'}
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}

    </div>
  );
}


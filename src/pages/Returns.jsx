import { useState, useEffect } from 'react';
import { RefreshCcw, Search, User, Package, MapPin, DollarSign, Save, X, ArrowLeftRight, Trash2, Calendar, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function Returns() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State'leri
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [returnType, setReturnType] = useState('Sale_Return'); // Sale_Return veya Purchase_Return
  const [formData, setFormData] = useState({
    party_id: '',
    product_id: '',
    location_id: '',
    qty: 1,
    unit: 'Adet',
    price: 0,
    description: ''
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: retData } = await supabase.from('returns').select('*, parties(name), products(name)').order('created_at', { ascending: false });
    const { data: pts } = await supabase.from('parties').select('*').order('name');
    const { data: prds } = await supabase.from('products').select('*').order('name');
    const { data: locs } = await supabase.from('locations').select('*').order('name');

    if (retData) setReturns(retData);
    if (pts) setParties(pts);
    if (prds) setProducts(prds);
    if (locs) setLocations(locs);
    setLoading(false);
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!formData.party_id || !formData.product_id || !formData.location_id) return alert("Lütfen tüm alanları doldurun.");
    
    setLoading(true);
    try {
      // 1. İade Kaydı Oluştur
      const returnRecord = {
        ...formData,
        type: returnType,
        amount: formData.qty * formData.price
      };
      
      const { data: retRecord, error: retError } = await supabase.from('returns').insert([returnRecord]).select().single();

      if (retError) {
        console.error("İade Kaydı Hatası:", retError);
        throw new Error(`İade kaydı oluşturulamadı: ${retError.message}`);
      }

      // 2. Stok Güncelleme
      const qtyChange = returnType === 'Sale_Return' ? formData.qty : -formData.qty;
      
      const { data: invItems, error: invFetchError } = await supabase.from('inventory')
        .select('*')
        .eq('product_id', formData.product_id)
        .eq('location_id', formData.location_id)
        .maybeSingle();

      if (invFetchError) throw new Error(`Stok bilgisi sorgulanamadı: ${invFetchError.message}`);

      const currentQty = invItems?.quantity || 0;

      const { error: invUpsertError } = await supabase.from('inventory').upsert({
        ...(invItems ? { id: invItems.id } : {}),
        product_id: formData.product_id,
        location_id: formData.location_id,
        quantity: currentQty + qtyChange
      });

      if (invUpsertError) throw new Error(`Stok güncellenemedi: ${invUpsertError.message}`);

      // 3. Finansal Entegrasyon
      const txType = returnType === 'Sale_Return' ? 'Payment' : 'Collection';
      const prd = products.find(p => p.id === formData.product_id);
      const productName = prd?.name || 'Ürün';
      const unit = formData.unit || prd?.unit || 'Adet';
      const txDesc = `${productName} - ${formData.qty} ${unit} İade İşlemi`;

      const { error: txError } = await supabase.from('financial_transactions').insert([{
        party_id: formData.party_id,
        amount: formData.qty * formData.price,
        type: txType,
        method: 'Cash',
        description: txDesc
      }]);

      if (txError) throw new Error(`Finansal işlem kaydedilemedi: ${txError.message}`);

      // 4. Log
      await supabase.from('audit_logs').insert([{
        action: 'UPDATE',
        feature: 'İade Yönetimi',
        detail: txDesc,
        user_name: 'Admin'
      }]);

      alert(`✅ Başarılı: ${txDesc} tamamlandı ve cari hesap güncellendi.`);
      setIsModalOpen(false);
      setFormData({ party_id: '', product_id: '', location_id: '', qty: 1, price: 0, description: '' });
      fetchInitialData();
    } catch (err) {
      console.error("İade İşlemi Kritik Hata:", err);
      let msg = err.message;
      if (msg.includes('returns')) {
        msg = "Veritabanında 'returns' tablosu bulunamadı. Lütfen size iletilen SQL komutunu Supabase üzerinde çalıştırın.";
      }
      alert("❌ İşlem Başarısız: " + msg);
    }
    setLoading(false);
  };

  const filteredReturns = returns.filter(r => 
    r.parties?.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.products?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>İade Yönetimi (Müşteri & Tedarikçi)</h2>
          <p style={{ color: 'var(--text-muted)' }}>Hatalı veya eksik ürünlerin iade süreçlerini ve finansal mahsuplarını yönetin.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
           <button className="btn btn-secondary" style={{ background: 'var(--primary-light)', color: 'var(--primary-color)', border: 'none' }} onClick={() => { setReturnType('Purchase_Return'); setIsModalOpen(true); }}>
              <ArrowLeftRight size={18} /> Alım İadesi Yap (Tedarikçiye)
           </button>
           <button className="btn btn-primary" onClick={() => { setReturnType('Sale_Return'); setIsModalOpen(true); }}>
              <RefreshCcw size={18} /> Satış İadesi Al (Müşteriden)
           </button>
        </div>
      </div>

      <div className="card glass-panel" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <Search size={20} color="var(--text-muted)" />
        <input 
          type="text" 
          className="input-field" 
          style={{ border: 'none', background: 'transparent', flex: 1 }} 
          placeholder="İade kaydı veya cari ara..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
        />
      </div>

      <div className="card" style={{ padding: '0' }}>
         <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  <th style={{ padding: '1.25rem' }}>İade Tarihi</th>
                  <th style={{ padding: '1.25rem' }}>İade Tipi</th>
                  <th style={{ padding: '1.25rem' }}>Cari Hesap</th>
                  <th style={{ padding: '1.25rem' }}>Ürün / Detay</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Miktar / Birim</th>
                  <th style={{ padding: '1.25rem', textAlign: 'right' }}>İade Tutarı</th>
                </tr>
              </thead>
              <tbody>
                {filteredReturns.map(ret => (
                  <tr key={ret.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1.25rem', fontSize: '0.85rem' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Calendar size={14} color="var(--text-muted)" />
                          {format(new Date(ret.created_at), 'dd MMM yyyy HH:mm', { locale: tr })}
                       </div>
                    </td>
                    <td style={{ padding: '1.25rem' }}>
                       <span style={{ 
                          padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700',
                          background: ret.type === 'Sale_Return' ? 'var(--success-light)' : 'var(--danger-light)',
                          color: ret.type === 'Sale_Return' ? 'var(--success-color)' : 'var(--danger-color)'
                       }}>
                          {ret.type === 'Sale_Return' ? 'MÜŞTERİ İADESİ' : 'TEDARİKÇİ İADESİ'}
                       </span>
                    </td>
                    <td style={{ padding: '1.25rem', fontWeight: '600' }}>{ret.parties?.name}</td>
                    <td style={{ padding: '1.25rem' }}>
                       <div style={{ fontSize: '0.9rem' }}>{ret.products?.name}</div>
                       <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ret.description || 'Açıklama yok'}</div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>{ret.qty} {ret.unit || ret.products?.unit || 'Adet'}</td>
                    <td style={{ padding: '1.25rem', textAlign: 'right', fontWeight: '800', fontSize: '1.1rem' }}>
                       ${ret.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {filteredReturns.length === 0 && (
                   <tr><td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Kayıtlı iade işlemi bulunmuyor.</td></tr>
                )}
              </tbody>
            </table>
         </div>
      </div>

      {/* NEW RETURN MODAL */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade-in" style={{ width: '500px', padding: '2.5rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                   <h3 style={{ fontWeight: '800', margin: 0, color: returnType === 'Sale_Return' ? 'var(--success-color)' : 'var(--danger-color)' }}>
                      {returnType === 'Sale_Return' ? 'Müşteriden İade Al' : 'Tedarikçiye İade Yap'}
                   </h3>
                   <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>İade detaylarını girerek stok ve cari kartı güncelleyin.</p>
                </div>
                <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}><X size={20}/></button>
             </div>
             
             <form onSubmit={handleReturnSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="input-group">
                   <label>{returnType === 'Sale_Return' ? 'Müşteri Seçimi' : 'Tedarikçi Seçimi'}</label>
                   <select 
                      className="input-field high-visibility-select" 
                      value={formData.party_id} 
                      onChange={e => setFormData({...formData, party_id: e.target.value})}
                      required
                   >
                      <option value="">Seçiniz...</option>
                      {parties.filter(p => returnType === 'Sale_Return' ? p.type === 'Customer' : p.type === 'Supplier').map(p => (
                         <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                   </select>
                </div>

                <div className="input-group">
                   <label>Ürün Seçimi</label>
                   <select 
                      className="input-field high-visibility-select" 
                      value={formData.product_id} 
                      onChange={e => {
                         const prd = products.find(p => p.id === e.target.value);
                         setFormData({...formData, product_id: e.target.value, price: prd?.price || 0, unit: prd?.unit || 'Adet'});
                      }}
                      required
                   >
                      <option value="">Seçiniz...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} (Ref: {p.sku})</option>)}
                   </select>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                   <div style={{ flex: 1 }} className="input-group">
                      <label>İade Edilen Depo</label>
                      <select className="input-field high-visibility-select" value={formData.location_id} onChange={e => setFormData({...formData, location_id: e.target.value})} required>
                         <option value="">Depo Seçin...</option>
                         {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                      </select>
                   </div>
                   <div className="input-group" style={{flex: 1}}><label>Miktar</label>
                  <input type="number" className="input-field" value={formData.qty} onChange={e => setFormData({...formData, qty: Number(e.target.value)})} min="1" />
                </div>
                <div className="input-group" style={{flex: 1}}><label>Birim</label>
                  <select className="input-field" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}>
                    {['Adet', 'KG', 'Çuval', 'Paket', 'Koli', 'Litre', 'Metre', 'Gram', 'Ton', 'Palet', 'Bağ', 'Demet', 'Kutu', 'Teneke'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                </div>

                <div className="input-group">
                   <label>Birim İade Bedeli (₺)</label>
                   <input type="number" step="0.01" className="input-field" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})} required />
                </div>

                <div className="input-group">
                   <label>İade Nedeni / Açıklama</label>
                   <input type="text" className="input-field" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Örn: Hatalı ürün / Vazgeçme" />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                   <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>İptal</button>
                   <button type="submit" className="btn btn-primary" style={{ flex: 2, background: returnType === 'Sale_Return' ? 'var(--success-color)' : 'var(--danger-color)', border: 'none' }} disabled={loading}>
                      {loading ? 'İşleniyor...' : 'İadeyi Onayla'}
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}

    </div>
  );
}

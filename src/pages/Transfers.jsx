import { useState, useEffect } from 'react';
import { ArrowRightLeft, Clock, Package, MapPin, Truck, ExternalLink, Plus, X, Search, Trash2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

export default function Transfers() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Form State
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [inventory, setInventory] = useState([]);
  
  const [fromLoc, setFromLoc] = useState('');
  const [toLoc, setToLoc] = useState('');
  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');
  
  const [cart, setCart] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qty, setQty] = useState(1);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Daha basit ve güvenli bir sorgu
      const { data: trfData, error: trfErr } = await supabase
        .from('transfers')
        .select(`
          *,
          products(name, sku),
          from_loc:locations!from_location_id(name),
          to_loc:locations!to_location_id(name)
        `)
        .order('created_at', { ascending: false });
      
      if (trfErr) {
        console.error("Transfer verisi çekilemedi:", trfErr);
        // Eğer join hatası varsa düz veri çekmeyi dene
        const { data: fallbackData } = await supabase.from('transfers').select('*').order('created_at', { ascending: false });
        if (fallbackData) setTransfers(fallbackData);
      } else if (trfData) {
        setTransfers(trfData);
      }

      const { data: prds } = await supabase.from('products').select('*').order('name');
      const { data: locs } = await supabase.from('locations').select('*').order('name');
      const { data: crs } = await supabase.from('couriers').select('*').order('name');
      const { data: inv } = await supabase.from('inventory').select('*');

      setProducts(prds || []);
      setLocations(locs || []);
      setCouriers(crs || []);
      setInventory(inv || []);
      
      if (locs?.length >= 2) {
        setFromLoc(locs[0].id);
        setToLoc(locs[1].id);
      }
    } catch (err) {
      console.error("Yükleme hatası:", err);
    }
    setLoading(false);
  };

  const addToCart = () => {
    if (!selectedProductId) return;
    const prd = products.find(p => p.id === selectedProductId);
    if (!prd) return;

    // Stok kontrolü
    const sourceInv = inventory.find(i => i.product_id === prd.id && i.location_id === fromLoc);
    const available = sourceInv?.quantity || 0;
    
    // Sepetteki mevcut miktar
    const existing = cart.find(c => c.product_id === prd.id);
    const totalNeeded = (existing?.qty || 0) + Number(qty);

    if (available < totalNeeded) {
      alert(`Yetersiz stok! ${prd.name} için kaynak depoda sadece ${available} ${prd.unit} var.`);
      return;
    }

    if (existing) {
      setCart(cart.map(c => c.product_id === prd.id ? { ...c, qty: c.qty + Number(qty) } : c));
    } else {
      setCart([...cart, { product_id: prd.id, name: prd.name, sku: prd.sku, unit: prd.unit, qty: Number(qty) }]);
    }
    
    setSelectedProductId('');
    setProductSearch('');
    setQty(1);
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(c => c.product_id !== id));
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (cart.length === 0) { alert("Sepet boş!"); return; }
    if (!fromLoc || !toLoc) { alert("Lütfen depoları seçin."); return; }
    if (fromLoc === toLoc) { alert("Kaynak ve hedef depo aynı olamaz!"); return; }

    setLoading(true);
    try {
      // Toplu işlemler için döngü
      for (const item of cart) {
        const sourceInv = inventory.find(i => i.product_id === item.product_id && i.location_id === fromLoc);
        const targetInv = inventory.find(i => i.product_id === item.product_id && i.location_id === toLoc);

        if (!sourceInv) throw new Error(`${item.name} için kaynak depoda stok kaydı bulunamadı.`);

        // 1. Kaynaktan düş
        const { error: err1 } = await supabase.from('inventory').update({
          quantity: sourceInv.quantity - item.qty
        }).eq('id', sourceInv.id);
        if (err1) throw new Error("Kaynak stok düşülürken hata: " + err1.message);

        // 2. Hedefe ekle
        const { error: err2 } = await supabase.from('inventory').upsert({
          ...(targetInv ? { id: targetInv.id } : {}),
          product_id: item.product_id,
          location_id: toLoc,
          quantity: (targetInv?.quantity || 0) + item.qty
        });
        if (err2) throw new Error("Hedef stok eklenirken hata: " + err2.message);

        // 3. Transfer Kaydı
        const { error: err3 } = await supabase.from('transfers').insert([{
          product_id: item.product_id,
          from_location_id: fromLoc,
          to_location_id: toLoc,
          quantity: item.qty,
          user_name: 'Admin',
          courier_name: courier,
          tracking_number: tracking
        }]);
        if (err3) throw new Error("Transfer kaydı oluşturulurken hata: " + err3.message);

        // 4. Log
        await supabase.from('audit_logs').insert([{
          action: 'TRANSFER',
          feature: 'Toplu Transfer',
          detail: `${item.name} (${item.qty} ${item.unit}) ${locations.find(l=>l.id===fromLoc)?.name} -> ${locations.find(l=>l.id===toLoc)?.name}`,
          user_name: 'Admin'
        }]);
      }

      setCart([]);
      setShowModal(false);
      await fetchInitialData(); // Tabloyu yenile
      alert("Toplu transfer başarıyla tamamlandı ve tabloya işlendi.");
    } catch (err) {
      console.error(err);
      alert("Hata: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
    p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.barcode?.includes(productSearch)
  ).slice(0, 10); // Çok fazla ürün varsa listeyi kısıtla

  const getTrackingLink = (courier, tracking) => {
    if (!tracking) return null;
    const c = courier?.toLowerCase();
    if (c?.includes('aras')) return `https://www.araskargo.com.tr/kargo-takip/${tracking}`;
    if (c?.includes('yurtici')) return `https://www.yurticikargo.com/tr/online-servisler/kargo-takip?code=${tracking}`;
    if (c?.includes('mng')) return `https://www.mngkargo.com.tr/gonderitakibi?gonderino=${tracking}`;
    if (c?.includes('ptt')) return `https://gonderitakip.ptt.gov.tr/Track/PttTrackResult?barcode=${tracking}`;
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Stok Transferleri</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Depolar arası toplu ürün sevkiyatları.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Yeni Toplu Transfer
        </button>
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--surface-hover)', fontSize: '0.8rem' }}>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Tarih</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Ürün</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Miktar</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Güzergah / Kargo</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>İşlem Yapan</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {loading && transfers.length === 0 ? (
                 <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center' }}>Yükleniyor...</td></tr>
              ) : transfers.length === 0 ? (
                 <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Henüz hiçbir stok transferi yapılmadı.</td></tr>
              ) : (
                transfers.map(trf => (
                  <tr key={trf.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1.25rem 1rem', fontSize: '0.85rem' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
                         <Clock size={14} />
                         {format(new Date(trf.created_at), 'dd.MM.yyyy HH:mm')}
                       </div>
                    </td>
                    <td style={{ padding: '1.25rem 1rem' }}>
                       <div style={{ fontWeight: '600' }}>{trf.products?.name}</div>
                       <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{trf.products?.sku}</div>
                    </td>
                    <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                       <span className="badge badge-warning" style={{ fontWeight: '700' }}>{trf.quantity} Birim</span>
                    </td>
                    <td style={{ padding: '1.25rem 1rem' }}>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                             <span style={{ fontSize: '0.85rem' }}>{trf.from_loc?.name || 'Bilinmeyen'}</span>
                             <ArrowRightLeft size={14} color="var(--primary-color)" />
                             <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{trf.to_loc?.name || 'Bilinmeyen'}</span>
                          </div>
                          {trf.courier_name && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: 'var(--primary-color)', background: 'var(--primary-light)', padding: '0.1rem 0.5rem', borderRadius: '4px', width: 'fit-content' }}>
                               <Truck size={12} />
                               <span>{trf.courier_name}: {trf.tracking_number}</span>
                            </div>
                          )}
                       </div>
                    </td>
                    <td style={{ padding: '1.25rem 1rem', fontSize: '0.9rem' }}>{trf.user_name}</td>
                    <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                       <button 
                          className="btn btn-secondary p-1" 
                          style={{ color: 'var(--danger-color)' }}
                          onClick={async () => {
                             if(confirm('Bu transfer kaydını silmek ve stokları geri almak istediğinize emin misiniz?')) {
                                // 1. Hedef depodan çıkar, Kaynak depoya geri ekle
                                const { data: invFrom } = await supabase.from('inventory').select('*').eq('product_id', trf.product_id).eq('location_id', trf.from_location_id).maybeSingle();
                                const { data: invTo } = await supabase.from('inventory').select('*').eq('product_id', trf.product_id).eq('location_id', trf.to_location_id).maybeSingle();
                                
                                if (invTo) {
                                   await supabase.from('inventory').update({ quantity: (invTo.quantity || 0) - trf.quantity }).eq('id', invTo.id);
                                }
                                if (invFrom) {
                                   await supabase.from('inventory').update({ quantity: (invFrom.quantity || 0) + trf.quantity }).eq('id', invFrom.id);
                                } else {
                                   await supabase.from('inventory').insert({ product_id: trf.product_id, location_id: trf.from_location_id, quantity: trf.quantity });
                                }

                                // 2. Kaydı sil
                                const { error } = await supabase.from('transfers').delete().eq('id', trf.id);
                                if (error) alert("Hata: " + error.message);
                                else fetchInitialData();
                             }
                          }}
                       >
                          <Trash2 size={14} />
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
           <div className="card animate-fade-in" style={{ width: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <h3 style={{ margin: 0 }}>📦 Yeni Toplu Transfer Fişi</h3>
                 <button className="btn btn-secondary" onClick={() => setShowModal(false)}><X size={20}/></button>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', padding: '1.5rem', background: 'var(--bg-color)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                 <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Kaynak Depo (Nereden)</label>
                    <select className="input-field high-visibility-select" value={fromLoc} onChange={e => { setFromLoc(e.target.value); setCart([]); }} disabled={cart.length > 0}>
                       {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                    {cart.length > 0 && <small style={{ color: 'var(--warning-color)' }}>Depo değiştirmek için sepeti boşaltın.</small>}
                 </div>
                 <div style={{ alignSelf: 'center', paddingTop: '1.2rem' }}><ArrowRightLeft size={20} color="var(--primary-color)" /></div>
                 <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Hedef Depo (Nereye)</label>
                    <select className="input-field high-visibility-select" value={toLoc} onChange={e => setToLoc(e.target.value)}>
                       {locations.map(l => <option key={l.id} value={l.id} disabled={l.id === fromLoc}>{l.name}</option>)}
                    </select>
                 </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', background: 'var(--surface-color)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                 <div className="input-group" style={{ flex: 2, position: 'relative', marginBottom: 0 }}>
                    <label>Ürün Ara / Seç</label>
                    <div style={{ position: 'relative' }}>
                      <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input 
                        type="text" 
                        className="input-field" 
                        style={{ paddingLeft: '2.5rem' }} 
                        placeholder="İsim, SKU veya Barkod..." 
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                      />
                    </div>
                    {productSearch && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface-hover)', zIndex: 10, borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '4px', boxShadow: 'var(--shadow-lg)' }}>
                        {filteredProducts.map(p => {
                          const invItem = inventory.find(i => i.product_id === p.id && i.location_id === fromLoc);
                          const qty = invItem?.quantity || 0;
                          return (
                            <div 
                              key={p.id} 
                              onClick={() => { setSelectedProductId(p.id); setProductSearch(p.name); }}
                              style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                              className="hover-bg"
                            >
                              <div>
                                <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{p.name}</div>
                                <small style={{ color: 'var(--text-muted)' }}>{p.sku}</small>
                              </div>
                              <span className={`badge ${qty > 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>{qty} {p.unit} Mevcut</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                 </div>
                 <div className="input-group" style={{ width: '100px', marginBottom: 0 }}>
                    <label>Miktar</label>
                    <input type="number" className="input-field" value={qty} onChange={e => setQty(e.target.value)} min="1" />
                 </div>
                 <button className="btn btn-primary" type="button" style={{ height: '42px' }} onClick={addToCart} disabled={!selectedProductId}>Ekle</button>
              </div>

              <div style={{ flex: 1, minHeight: '200px', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                 <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--surface-color)', fontSize: '0.8rem' }}>
                       <tr>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>Ürün Bilgisi</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center' }}>Miktar</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center' }}>İşlem</th>
                       </tr>
                    </thead>
                    <tbody>
                       {cart.map(item => (
                         <tr key={item.product_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem' }}>
                               <div style={{ fontWeight: '600' }}>{item.name}</div>
                               <small style={{ color: 'var(--text-muted)' }}>{item.sku}</small>
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>{item.qty} {item.unit}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                               <button className="btn btn-secondary" style={{ color: 'var(--danger-color)', border: 'none' }} onClick={() => removeFromCart(item.product_id)}><Trash2 size={16} /></button>
                            </td>
                         </tr>
                       ))}
                       {cart.length === 0 && (
                         <tr><td colSpan="3" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sepet henüz boş. Ürün ekleyerek başlayın.</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                 <div style={{ display: 'flex', gap: '1rem', flex: 1 }}>
                    <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                       <label>Kargo Firması</label>
                       <select className="input-field" value={courier} onChange={e => setCourier(e.target.value)}>
                          <option value="">Seçiniz</option>
                          {couriers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                       </select>
                    </div>
                    <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                       <label>Takip No</label>
                       <input type="text" className="input-field" value={tracking} onChange={e => setTracking(e.target.value)} />
                    </div>
                 </div>
                 <div style={{ display: 'flex', gap: '1rem', marginLeft: '2rem' }}>
                    <button className="btn btn-secondary" onClick={() => setShowModal(false)}>İptal</button>
                    <button className="btn btn-primary" style={{ background: 'var(--success-color)' }} onClick={handleTransfer} disabled={loading || cart.length === 0}>
                       {loading ? 'İşleniyor...' : `✓ ${cart.length} Ürünü Transfer Et`}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

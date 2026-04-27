import { useState, useEffect, useRef } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Camera, Download, Upload, X, FileSpreadsheet, ArrowRightLeft, Warehouse, MapPin, Printer, Truck, Users, TrendingUp, Clock, ShoppingCart, CreditCard, DollarSign, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Html5Qrcode } from 'html5-qrcode';
import { differenceInDays } from 'date-fns';
import JsBarcode from 'jsbarcode';

const UNITS = ['Adet', 'KG', 'Çuval', 'Paket', 'Koli', 'Litre', 'Metre', 'Gram', 'Ton', 'Palet', 'Bağ', 'Demet', 'Kutu', 'Teneke'];
const UNIQUE_UNITS = [...new Set(UNITS)];

const INITIAL_FORM_STATE = { 
  name: '', sku: '', barcode: '', category: '', price: 0, cost_price: 0, 
  stock: 0, location_id: '', party_id: '', koli_adet: 1, koli_ici: 1, 
  irsaliye_no: '', fatura_no: '', unit: 'Adet', tax_rate: 20 
};

export default function Products() {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [parties, setParties] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showScanner, setShowScanner] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [targetProduct, setTargetProduct] = useState(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [printData, setPrintData] = useState({ product: null, size: '50x30', count: 1 });
  const [latestDocs, setLatestDocs] = useState({});
  const [transferData, setTransferData] = useState({ product: null, from_loc: '', to_loc: '', qty: 1, courier: '', tracking: '' });

  const barcodeRef = useRef(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: locs } = await supabase.from('locations').select('*').order('name');
      const { data: prds } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      const { data: inv } = await supabase.from('inventory').select('*');
      const { data: pts } = await supabase.from('parties').select('*').eq('type', 'Supplier').order('name');
      const { data: crs } = await supabase.from('couriers').select('*').order('name');
      
      setLocations(locs || []);
      setProducts(prds || []);
      setInventory(inv || []);
      setParties(pts || []);
      setCouriers(crs || []);
      
      // Varsayılan depoyu ayarla
      if (locs && locs.length > 0) {
        setFormData(p => ({...p, location_id: locs[0].id}));
      }

      const { data: logs } = await supabase.from('audit_logs').select('detail').ilike('detail', '%stok girişi%').order('created_at', { ascending: false });
      if (logs) {
         const docs = {};
         logs.forEach(log => {
            const irsMatch = log.detail.match(/İrs(?:aliye)?:?\s*([^\s]+)/i);
            const fatMatch = log.detail.match(/Fat(?:ura)?:?\s*([^\s]+)/i);
            const nameMatch = log.detail.match(/^(.*?)\s*—/);
            if (nameMatch) {
               const pName = nameMatch[1].trim();
               if (!docs[pName]) {
                  docs[pName] = { irsaliye: irsMatch ? irsMatch[1] : '-', fatura: fatMatch ? fatMatch[1] : '-' };
               }
            }
         });
         setLatestDocs(docs);
      }
    } catch (err) {
      console.error("Yükleme hatası:", err);
    }
    setLoading(false);
  };

  const processBarcode = async (code) => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop().catch(e => console.error(e));
    }
    setShowScanner(false);
    const { data: existingProduct } = await supabase.from('products').select('*').eq('barcode', code).maybeSingle();
    if (existingProduct) {
      setTargetProduct(existingProduct);
      setFormData({ ...INITIAL_FORM_STATE, location_id: locations[0]?.id || '', stock: 0 });
      setIsStockModalOpen(true);
    } else {
      setFormData({ ...INITIAL_FORM_STATE, barcode: code, sku: code, location_id: locations[0]?.id || '' });
      setIsAddModalOpen(true);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!formData.location_id) return alert("Lütfen depo seçiniz.");
    setLoading(true);
    
    // Şema hatasını önlemek için güvenli obje oluştur
    const prdObj = {
      name: formData.name, sku: formData.sku, barcode: formData.barcode, 
      category: formData.category, price: formData.price, cost_price: formData.cost_price
    };
    
    const { data: prdData, error: prdError } = await supabase.from('products').insert([prdObj]).select();

    if (prdError) {
      alert("Hata: " + prdError.message);
      setLoading(false);
      return;
    }

    if (prdData && formData.location_id) {
       await supabase.from('inventory').insert([{
         product_id: prdData[0].id,
         location_id: formData.location_id,
         quantity: formData.stock
       }]);
    }

    if (formData.party_id && formData.stock > 0) {
       const debtAmount = formData.cost_price * formData.stock;
       await supabase.from('financial_transactions').insert([{
          party_id: formData.party_id,
          amount: debtAmount,
          type: 'Purchase_Debt',
          method: 'Cash',
          description: `${formData.name} - ${formData.stock} Adet Alım (Yeni Ürün)${formData.irsaliye_no ? ' | İrs:'+formData.irsaliye_no : ''}${formData.fatura_no ? ' | Fat:'+formData.fatura_no : ''}`
       }]);
    }

    if (formData.stock > 0) {
       await supabase.from('audit_logs').insert([{
          action: 'CREATE',
          feature: 'Stok Yönetimi',
          detail: `${formData.name} — ${formData.stock} adet stok girişi yapıldı (${locations.find(l=>l.id===formData.location_id)?.name}).${formData.irsaliye_no ? ' İrsaliye: '+formData.irsaliye_no : ''}${formData.fatura_no ? ' Fatura: '+formData.fatura_no : ''}`,
          user_name: 'Admin'
       }]);
    }

    await fetchInitialData();
    setIsAddModalOpen(false);
    setFormData({ ...INITIAL_FORM_STATE, location_id: locations[0]?.id || '' });
    setLoading(false);
  };

  const handleQuickStockIn = async (e) => {
    e.preventDefault();
    if (!targetProduct || !formData.location_id) return alert("Hata: Ürün veya depo seçilmedi.");
    setLoading(true);

    const totalQty = (parseInt(formData.koli_adet) || 1) * (parseInt(formData.koli_ici) || 1);
    
    // Mevcut stok kontrolü
    const { data: currentItems } = await supabase.from('inventory')
      .select('*')
      .eq('product_id', targetProduct.id)
      .eq('location_id', formData.location_id)
      .maybeSingle();

    const currentQty = currentItems?.quantity || 0;
    
    const { error: invError } = await supabase.from('inventory').upsert({
       ...(currentItems ? { id: currentItems.id } : {}),
       product_id: targetProduct.id,
       location_id: formData.location_id,
       quantity: currentQty + totalQty
    });

    if (invError) { alert("Hata: " + invError.message); setLoading(false); return; }

    if (formData.party_id && totalQty > 0) {
       const debtAmount = (targetProduct.cost_price || 0) * totalQty;
       await supabase.from('financial_transactions').insert([{
          party_id: formData.party_id,
          amount: debtAmount,
          type: 'Purchase_Debt',
          method: 'Cash',
          description: `${targetProduct.name} - ${totalQty} Adet Giriş (${locations.find(l=>l.id===formData.location_id)?.name})${formData.irsaliye_no ? ' | İrs:'+formData.irsaliye_no : ''}${formData.fatura_no ? ' | Fat:'+formData.fatura_no : ''}`
       }]);
    }

    await supabase.from('audit_logs').insert([{
        action: 'UPDATE',
        feature: 'Stok Yönetimi',
        detail: `${targetProduct.name} — ${totalQty} adet stok girişi yapıldı (${locations.find(l=>l.id===formData.location_id)?.name}).${formData.irsaliye_no ? ' İrsaliye: '+formData.irsaliye_no : ''}${formData.fatura_no ? ' Fatura: '+formData.fatura_no : ''}`,
        user_name: 'Admin'
    }]);

    await fetchInitialData();
    setIsStockModalOpen(false);
    setTargetProduct(null);
    setFormData({ ...INITIAL_FORM_STATE, location_id: locations[0]?.id || '' });
    setLoading(false);
  };

  const updateProductPrice = async (id, field, value) => {
    const numValue = parseFloat(value) || 0;
    const { error } = await supabase.from('products').update({ [field]: numValue }).eq('id', id);
    if (error) { alert('Hata: ' + error.message); return; }
    const { data: prds } = await supabase.from('products').select('*').order('name');
    if (prds) setProducts(prds);
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (transferData.from_loc === transferData.to_loc) { alert("Aynı lokasyon!"); return; }
    const sourceInv = inventory.find(i => i.product_id === transferData.product.id && i.location_id === transferData.from_loc);
    if (!sourceInv || sourceInv.quantity < transferData.qty) { alert("Stok yetersiz!"); return; }
    setLoading(true);
    
    await supabase.from('inventory').upsert({ product_id: transferData.product.id, location_id: transferData.from_loc, quantity: sourceInv.quantity - transferData.qty });
    const targetInv = inventory.find(i => i.product_id === transferData.product.id && i.location_id === transferData.to_loc);
    await supabase.from('inventory').upsert({ product_id: transferData.product.id, location_id: transferData.to_loc, quantity: (targetInv?.quantity || 0) + transferData.qty });
    
    await supabase.from('transfers').insert([{ 
      product_id: transferData.product.id, 
      from_location_id: transferData.from_loc, 
      to_location_id: transferData.to_loc, 
      quantity: transferData.qty, 
      user_name: 'Admin', 
      courier_name: transferData.courier, 
      tracking_number: transferData.tracking 
    }]);

    await fetchInitialData();
    setIsTransferModalOpen(false);
    setLoading(false);
  };

  const filteredProducts = (products || []).filter(p => (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.barcode || '').includes(searchTerm));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Yazdırma Alanı */}
      <div id="print-area" style={{ display: 'none' }}>
        {Array.from({ length: printData.count }).map((_, i) => (
          <div key={i} className={`label-container ${printData.size === '100x50' ? 'label-large' : ''}`}>
             <div style={{ fontSize: '10px', fontWeight: 'bold' }}>{printData.product?.name}</div>
             <svg ref={i === 0 ? barcodeRef : null}></svg>
             <div style={{ fontSize: '8px' }}>SKU: {printData.product?.sku}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Envanter & Maliyet Analizi</h2>
          <p style={{ color: 'var(--text-muted)' }}>Depo bazlı stok takibi ve maliyet kontrol paneli.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-primary" onClick={() => setShowScanner(true)}><Camera size={18} /> Tarat</button>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => { 
                setFormData({ ...INITIAL_FORM_STATE, location_id: locations[0]?.id || '' }); 
                setIsAddModalOpen(true); 
            }}>
                <Plus size={18} /> Yeni Ürün
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <Search size={20} color="var(--text-muted)" />
        <input type="text" className="input-field" style={{ border: 'none', background: 'transparent', flex: 1 }} placeholder="Ürün adı veya barkod ile ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <div className="card" style={{ padding: '0' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <th style={{ padding: '1rem' }}>Ürün Bilgisi</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Birim</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Toplam Stok</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Depo Dağılımı</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Fiyatlandırma</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Toplam Maliyet</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(prd => {
                const totalStock = (inventory || []).filter(i => i.product_id === prd.id).reduce((s,i)=>s+i.quantity,0);
                const totalCost = totalStock * (prd.cost_price || 0);
                
                return (
                  <tr key={prd.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '700' }}>{prd.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{prd.sku}</div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                       <span className="badge badge-secondary">{prd.unit || 'Adet'}</span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                       <span className={`badge ${totalStock < 10 ? 'badge-danger' : 'badge-primary'}`} style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                          {totalStock} {prd.unit || 'Adet'}
                       </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'center' }}>
                          {inventory.filter(i => i.product_id === prd.id && i.quantity > 0).length > 0 ? (
                            inventory.filter(i => i.product_id === prd.id && i.quantity > 0).map(invItem => {
                               const loc = locations.find(l => l.id === invItem.location_id);
                               return (
                                  <div key={invItem.id} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                                     <span style={{ fontWeight: '600' }}>{loc?.name}:</span>
                                     <span>{invItem.quantity} {prd.unit || 'Adet'}</span>
                                  </div>
                               );
                            })
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Stok Yok</span>
                          )}
                       </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100px' }}>
                            <span style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>Maliyet:</span>
                            <div style={{display:'flex', alignItems:'center'}}>
                              <span style={{color:'var(--text-muted)', marginRight:'2px'}}>₺</span>
                              <input type="number" step="0.01" style={{width: '60px', border:'1px solid var(--border-color)', borderRadius:'4px', padding:'2px', textAlign:'right', fontSize:'0.8rem', background:'transparent', color:'var(--text-main)'}} 
                                defaultValue={prd.cost_price || 0}
                                onBlur={(e) => updateProductPrice(prd.id, 'cost_price', e.target.value)}
                              />
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100px' }}>
                            <span style={{fontSize: '0.7rem', color: 'var(--primary-color)'}}>Satış:</span>
                            <div style={{display:'flex', alignItems:'center'}}>
                              <span style={{color:'var(--text-muted)', marginRight:'2px'}}>₺</span>
                              <input type="number" step="0.01" style={{width: '60px', border:'1px solid var(--primary-light)', borderRadius:'4px', padding:'2px', textAlign:'right', fontSize:'0.8rem', background:'transparent', color:'var(--primary-color)', fontWeight:'600'}} 
                                defaultValue={prd.price || 0}
                                onBlur={(e) => updateProductPrice(prd.id, 'price', e.target.value)}
                              />
                            </div>
                          </div>
                       </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>₺{totalCost.toLocaleString()}</td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                       <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary p-1" title="Etiket Bas" onClick={() => { setPrintData({ product: prd, size: '50x30', count: 1 }); setIsPrintModalOpen(true); }}><Printer size={16} /></button>
                            <button className="btn btn-secondary p-1" title="Transfer" onClick={() => { setTransferData({ product: prd, from_loc: locations[0]?.id, to_loc: locations[1]?.id, qty: 1, courier: '', tracking: '' }); setIsTransferModalOpen(true); }}><ArrowRightLeft size={16} /></button>
                            <button className="btn btn-primary p-1" title="Hızlı Stok Girişi" onClick={() => { 
                                setTargetProduct(prd); 
                                setFormData({ ...INITIAL_FORM_STATE, location_id: locations[0]?.id || '' }); 
                                setIsStockModalOpen(true); 
                            }}><Plus size={16} /></button>
                            {isAdmin && (
                              <button className="btn btn-secondary p-1" style={{ color: 'var(--danger-color)' }} title="Ürünü Sil" onClick={async () => { if(confirm(`${prd.name} ürününü silmek istediğinize emin misiniz?`)) { await supabase.from('products').delete().eq('id', prd.id); await fetchInitialData(); } }}>
                                 <Trash2 size={16} />
                              </button>
                            )}
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Yeni Ürün Modalı */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade-in" style={{ width: '450px', padding: '2rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontWeight: '600', margin: 0 }}>Yeni Ürün & Stok Girişi</h3>
                <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setIsAddModalOpen(false)}><X size={20}/></button>
             </div>
             <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="input-group"><label>Ürün Adı</label><input type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                   <div style={{ flex:1 }} className="input-group"><label>SKU</label><input type="text" className="input-field" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} required /></div>
                   <div style={{ flex:1 }} className="input-group">
                      <label>Barkod</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                         <input type="text" className="input-field" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} />
                         <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={() => setShowScanner(true)}><Camera size={18} /></button>
                      </div>
                   </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex:1 }} className="input-group"><label>Alış Fiyatı (₺)</label><input type="number" step="0.01" className="input-field" value={formData.cost_price} onChange={e => setFormData({...formData, cost_price: parseFloat(e.target.value) || 0})} /></div>
                    <div style={{ flex:1 }} className="input-group"><label>Satış Fiyatı (₺)</label><input type="number" step="0.01" className="input-field" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})} /></div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                   <div className="input-group" style={{ flex: 1 }}><label>Birim</label>
                    <select className="input-field" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                      {UNIQUE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="input-group" style={{ flex: 1 }}><label>Kategori</label><input type="text" className="input-field" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} /></div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                   <div style={{ flex:1 }} className="input-group"><label>Giriş Miktarı</label><input type="number" className="input-field" value={formData.stock} onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})} /></div>
                   <div style={{ flex:1 }} className="input-group"><label>Tedarikçi</label>
                      <select className="input-field high-visibility-select" value={formData.party_id} onChange={e => setFormData({...formData, party_id: e.target.value})}>
                         <option value="">Seçiniz</option>
                         {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                   </div>
                </div>
                <div className="input-group"><label>Giriş Deposu</label>
                   <select className="input-field high-visibility-select" required value={formData.location_id} onChange={e => setFormData({...formData, location_id: e.target.value})}>
                      <option value="">Depo Seçiniz...</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                   </select>
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Ürünü ve Stoku Kaydet</button>
             </form>
          </div>
        </div>
      )}

      {/* Hızlı Stok Girişi Modalı */}
      {isStockModalOpen && targetProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade-in" style={{ width: '400px', padding: '2rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                   <h3 style={{ fontWeight: '600', margin: 0 }}>Hızlı Stok Girişi</h3>
                   <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{targetProduct.name}</p>
                </div>
                <button className="btn btn-secondary" onClick={() => setIsStockModalOpen(false)}><X size={20}/></button>
             </div>
             <form onSubmit={handleQuickStockIn} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                  <div style={{ background: 'rgba(27,99,216,0.08)', border: '1px solid rgba(27,99,216,0.2)', borderRadius: '12px', padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                      <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label>Koli Adedi</label>
                        <input type="number" className="input-field" min="1" autoFocus value={formData.koli_adet} onChange={e => setFormData({...formData, koli_adet: parseInt(e.target.value) || 1})} />
                      </div>
                      <div style={{ paddingBottom: '0.75rem', color: 'var(--text-muted)', fontWeight: '700', fontSize: '1.3rem' }}>×</div>
                      <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label>Koli İçi</label>
                        <input type="number" className="input-field" min="1" value={formData.koli_ici} onChange={e => setFormData({...formData, koli_ici: parseInt(e.target.value) || 1})} />
                      </div>
                    </div>
                    <div style={{ marginTop: '0.75rem', padding: '0.6rem 1rem', background: 'rgba(27,99,216,0.14)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem' }}>Toplam:</span>
                      <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--primary-color)' }}>
                        {(formData.koli_adet * formData.koli_ici).toLocaleString()} {targetProduct.unit || 'Adet'}
                      </span>
                    </div>
                  </div>
                  <div className="input-group">
                     <label>Giriş Yapılacak Depo</label>
                     <select className="input-field high-visibility-select" required value={formData.location_id} onChange={e => setFormData({...formData, location_id: e.target.value})}>
                        <option value="">Depo Seçiniz...</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                     </select>
                  </div>
                  <div className="input-group">
                     <label>Tedarikçi (Opsiyonel)</label>
                     <select className="input-field high-visibility-select" value={formData.party_id} onChange={e => setFormData({...formData, party_id: e.target.value})}>
                        <option value="">Cari Borçlandırma</option>
                        {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                     </select>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                     <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsStockModalOpen(false)}>İptal</button>
                     <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>✓ Stoku Onayla</button>
                  </div>
             </form>
          </div>
        </div>
      )}

      {/* Transfer Modalı */}
      {isTransferModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade-in" style={{ width: '450px', padding: '2.5rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>Stok Transferi</h3>
                <button className="btn btn-secondary" onClick={() => setIsTransferModalOpen(false)}><X size={20}/></button>
             </div>
             <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                   <div style={{flex: 1}} className="input-group"><label>Nereden</label><select className="input-field" value={transferData.from_loc} onChange={e => setTransferData({...transferData, from_loc: e.target.value})}>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
                   <div style={{flex: 1}} className="input-group"><label>Nereye</label><select className="input-field" value={transferData.to_loc} onChange={e => setTransferData({...transferData, to_loc: e.target.value})}>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
                </div>
                <div className="input-group"><label>Miktar</label><input type="number" className="input-field" value={transferData.qty} onChange={e => setTransferData({...transferData, qty: parseInt(e.target.value) || 1})} min="1" /></div>
                <div style={{ display: 'flex', gap: '1rem' }}><button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsTransferModalOpen(false)}>İptal</button><button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Transferi Başlat</button></div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}

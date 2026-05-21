import { useState, useEffect, useRef } from 'react';
import { Plus, Warehouse, Store, MapPin, Trash2, X, Phone, Globe, Package, Clock, Search, ExternalLink, Edit3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { differenceInDays, format } from 'date-fns';
import * as XLSX from 'xlsx';
export default function Locations() {
  const { isAdmin } = useAuth();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedLoc, setSelectedLoc] = useState(null);
  const [locInventory, setLocInventory] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSearch, setDetailSearch] = useState('');
  const [formData, setFormData] = useState({ id: null, name: '', type: 'Warehouse', address: '', district: '', city: '', phone: '' });

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('locations').select('*').order('name');
    if (!error && data) setLocations(data);
    setLoading(false);
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();
    const formId = formData.id;
    const payload = {
      name: formData.name,
      type: formData.type,
      address: formData.address || '',
      district: formData.district || '',
      city: formData.city || '',
      phone: formData.phone || ''
    };

    const { data, error } = formId 
      ? await supabase.from('locations').update(payload).eq('id', formId).select()
      : await supabase.from('locations').insert([payload]).select();

    if (!error && data) {
      if (formId) {
        setLocations(locations.map(l => l.id === formId ? data[0] : l));
      } else {
        setLocations([...locations, data[0]]);
      }
      setIsAddModalOpen(false);
      setFormData({ id: null, name: '', type: 'Warehouse', address: '', district: '', city: '', phone: '' });
      
      await supabase.from('audit_logs').insert([{
        action: formId ? 'UPDATE' : 'CREATE',
        feature: 'Lokasyon Yönetimi',
        detail: `${payload.name} (${payload.city}/${payload.district}) ${formId ? 'güncellendi' : 'sisteme eklendi'}.`,
        user_name: 'Admin'
      }]);
    } else {
      console.error("Supabase Hatası:", error);
      alert("Hata: " + error.message);
    }
  };

  const handleOpenDetail = async (loc) => {
    setSelectedLoc(loc);
    setIsDetailModalOpen(true);
    setDetailLoading(true);
    
    // Lokasyona özel envanteri ürün detaylarıyla birlikte çek
    const { data, error } = await supabase
      .from('inventory')
      .select('*, products(*)')
      .eq('location_id', loc.id)
      .gt('quantity', 0);
      
    if (!error && data) {
      setLocInventory(data);
    }
    setDetailLoading(false);
  };

  const handleExportExcel = () => {
    if (!locInventory || locInventory.length === 0) return;
    
    const dataToExport = locInventory.map(item => ({
      'Ürün Adı': item.products?.name || '',
      'Barkod/SKU': item.products?.sku || item.products?.barcode || '',
      'Kategori': item.products?.category || '',
      'Miktar': item.quantity,
      'Birim Maliyet': item.products?.cost_price || 0,
      'Satış Fiyatı': item.products?.price || 0,
      'Toplam Maliyet Değeri': item.quantity * (item.products?.cost_price || 0),
      'Depoda Bekleme (Gün)': item.products?.created_at ? differenceInDays(new Date(), new Date(item.products.created_at)) : 0
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Envanter');
    
    worksheet['!cols'] = [
      {wch: 40}, {wch: 20}, {wch: 20}, {wch: 10}, {wch: 15}, {wch: 15}, {wch: 20}, {wch: 20}
    ];

    XLSX.writeFile(workbook, `${selectedLoc?.name || 'Depo'}_Envanteri.xlsx`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Lokasyon & Depo Yönetimi</h2>
          <p style={{ color: 'var(--text-muted)' }}>Depo ve mağaza noktalarınızın detaylı iletişim/adres bilgileri.</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={18} /> Yeni Lokasyon
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {loading ? (
           [1,2].map(i => <div key={i} className="card skeleton" style={{ height: '180px' }}></div>)
        ) : (
          locations.map(loc => (
            <div key={loc.id} className="card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                 <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ padding: '0.6rem', background: 'var(--primary-light)', borderRadius: '10px', color: 'var(--primary-color)' }}>
                       {loc.type === 'Warehouse' ? <Warehouse size={20} /> : <Store size={20} />}
                    </div>
                    <div>
                       <h3 style={{ fontSize: '1.05rem', fontWeight: '700' }}>{loc.name}</h3>
                       <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>{loc.type === 'Warehouse' ? 'DEPO' : 'MAĞAZA'}</span>
                    </div>
                 </div>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.4rem' }}
                          onClick={() => {
                             setFormData({ ...loc });
                             setIsAddModalOpen(true);
                          }}
                        >
                           <Edit3 size={16} />
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ color: 'var(--danger-color)', padding: '0.4rem' }}
                          onClick={async () => {
                            if(confirm(`${loc.name} lokasyonunu silmek istediğinize emin misiniz?`)) {
                              const { error } = await supabase.from('locations').delete().eq('id', loc.id);
                              if(!error) fetchLocations();
                              else alert("Hata: " + error.message);
                            }
                          }}
                        >
                           <Trash2 size={16} />
                        </button>
                    </div>
                  )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                 <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: 'var(--text-main)' }}>
                    <MapPin size={16} color="var(--primary-color)" style={{ marginTop: '2px' }} />
                    <div>
                       <div style={{ fontWeight: '500' }}>{loc.district} / {loc.city}</div>
                       <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{loc.address}</div>
                    </div>
                 </div>
                 {loc.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                       <Phone size={14} color="var(--primary-color)" />
                       <span>{loc.phone}</span>
                    </div>
                 )}
              </div>
               <div style={{ display: 'flex', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <button 
                     className="btn btn-secondary" 
                     style={{ width: '100%', fontSize: '0.8rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}
                     onClick={() => handleOpenDetail(loc)}
                  >
                     <Package size={14} /> Stokları İncele
                  </button>
               </div>
            </div>
          ))
        )}
      </div>

      {/* DETAY ENVANTER MODALI */}
      {isDetailModalOpen && selectedLoc && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card glass-panel animate-fade-in" style={{ width: '900px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '2rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                   <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <Warehouse size={20} color="var(--primary-color)" />
                      <h3 style={{ margin: 0 }}>{selectedLoc.name} Envanteri</h3>
                   </div>
                   <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{selectedLoc.district} / {selectedLoc.city} şubesindeki güncel ürün dökümü.</p>
                </div>
                <button className="btn btn-secondary" onClick={() => setIsDetailModalOpen(false)}><X size={20}/></button>
             </div>

             <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.05)' }}>
                <Search size={18} color="var(--text-muted)" />
                <input 
                   type="text" 
                   className="input-field" 
                   style={{ border: 'none', background: 'transparent', flex: 1, color: 'white' }} 
                   placeholder="Depo içinde ürün ara..." 
                   value={detailSearch}
                   onChange={e => setDetailSearch(e.target.value)}
                />
                <button className="btn btn-primary" onClick={handleExportExcel} disabled={detailLoading || locInventory.length === 0} style={{ padding: '0.6rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <ExternalLink size={16} /> Excel İndir
                </button>
             </div>

             <div style={{ overflowY: 'auto', flex: 1, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                {detailLoading ? (
                   <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Ürünler yükleniyor...</div>
                ) : (
                   <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-color)', zIndex: 10 }}>
                         <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '1rem' }}>Ürün</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>Miktar</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>Birim Maliyet</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>Satış Fiyatı</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>Toplam Değer</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>Stok Gün</th>
                         </tr>
                      </thead>
                      <tbody>
                         {locInventory
                           .filter(item => item.products.name.toLowerCase().includes(detailSearch.toLowerCase()))
                           .map(item => {
                              const totalValue = item.quantity * (item.products.cost_price || 0);
                              const daysIn = differenceInDays(new Date(), new Date(item.products.created_at));
                              return (
                                 <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                                    <td style={{ padding: '1rem' }}>
                                       <div style={{ fontWeight: '600' }}>{item.products.name}</div>
                                       <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.products.sku}</div>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                       <span className="badge badge-primary">{item.quantity} Adet</span>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>₺${item.products.cost_price || 0}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>₺${item.products.price || 0}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>₺${totalValue.toLocaleString()}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                       <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: daysIn > 30 ? 'var(--warning-color)' : 'inherit' }}>
                                          <Clock size={12} /> {daysIn} G
                                       </div>
                                    </td>
                                 </tr>
                              );
                           })}
                         {locInventory.length === 0 && (
                            <tr><td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Bu depoda şu an ürün bulunmuyor.</td></tr>
                         )}
                      </tbody>
                   </table>
                )}
             </div>

             <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--primary-light)', padding: '1rem', borderRadius: '12px' }}>
                <span style={{ fontWeight: '600', color: 'var(--primary-color)' }}>Depo Toplam Değeri:</span>
                <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary-color)' }}>
                   ${locInventory.reduce((sum, item) => sum + (item.quantity * (item.products.cost_price || 0)), 0).toLocaleString()}
                </span>
             </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade-in" style={{ width: '450px', padding: '2rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontWeight: '600' }}>{formData.id ? 'Lokasyonu Düzenle' : 'Yeni Lokasyon Ekle'}</h3>
                <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setIsAddModalOpen(false)}><X size={20}/></button>
             </div>
             <form onSubmit={handleAddLocation} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="input-group">
                   <label>Lokasyon Adı</label>
                   <input type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div className="input-group">
                   <label>Lokasyon Türü</label>
                   <select className="input-field" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                      <option value="Warehouse">Depo</option>
                      <option value="Store">Mağaza</option>
                   </select>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                   <div style={{ flex: 1 }} className="input-group"><label>Şehir</label><input type="text" className="input-field" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} required /></div>
                   <div style={{ flex: 1 }} className="input-group"><label>İlçe</label><input type="text" className="input-field" value={formData.district} onChange={e => setFormData({...formData, district: e.target.value})} required /></div>
                </div>
                <div className="input-group"><label>İrtibat Numarası</label><input type="text" className="input-field" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                <div className="input-group"><label>Detaylı Adres</label><textarea className="input-field" style={{ minHeight: '80px', resize: 'vertical' }} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>{formData.id ? 'Güncelle' : 'Lokasyonu Oluştur'}</button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}

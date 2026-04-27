import { useState, useEffect } from 'react';
import { Globe, DollarSign, Bell, Shield, Save, Truck, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { isAdmin } = useAuth();
  const [settings, setSettings] = useState({ language: 'tr', currency: 'TRY', notifications: true, darkMode: true });
  const [companyInfo, setCompanyInfo] = useState({ name: '', tax_id: '', tax_office: '', address: '', phone: '', email: '', logo_url: '' });
  const [couriers, setCouriers] = useState([]);
  const [newCourier, setNewCourier] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: crs } = await supabase.from('couriers').select('*').order('name');
    if (crs) setCouriers(crs);

    const { data: info } = await supabase.from('app_settings').select('*');
    if (info) {
       const mapped = {};
       info.forEach(i => mapped[i.key] = i.value);
       setCompanyInfo(prev => ({ ...prev, ...mapped }));
    }
    setLoading(false);
  };

  const handleSaveCompany = async () => {
    setLoading(true);
    const updates = Object.entries(companyInfo).map(([key, value]) => ({ key, value }));
    const { error } = await supabase.from('app_settings').upsert(updates);
    if (!error) alert("Şirket bilgileri kaydedildi!");
    else alert("Hata: " + error.message);
    setLoading(false);
  };

  const handleAddCourier = async (e) => {
    e.preventDefault();
    if (!newCourier.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('couriers').insert([{ name: newCourier.trim() }]);
    if (!error) {
      setNewCourier('');
      const { data } = await supabase.from('couriers').select('*').order('name');
      if (data) setCouriers(data);
    } else {
      alert("Hata: " + error.message);
    }
    setLoading(false);
  };

  const handleDeleteCourier = async (id) => {
    const { error } = await supabase.from('couriers').delete().eq('id', id);
    if (!error) {
       const { data } = await supabase.from('couriers').select('*').order('name');
       if (data) setCouriers(data);
    } else {
      alert("Silme hatası: " + error.message);
    }
  };

  const handleSave = () => {
    alert("Genel ayarlar kaydedildi!");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Sistem Ayarları</h2>
          <p style={{ color: 'var(--text-muted)' }}>Uygulama tercihlerini ve kurumsal bilgilerinizi yönetin.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
           <button className="btn btn-secondary" onClick={fetchInitialData} disabled={loading}>Yenile</button>
           {isAdmin && <button className="btn btn-primary" onClick={() => { handleSave(); handleSaveCompany(); }} disabled={loading}><Save size={18} /> Tümünü Kaydet</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* ŞİRKET BİLGİLERİ (FATURA İÇİN) */}
          <div className="card glass-panel" style={{ borderLeft: '4px solid var(--primary-color)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={18} color="var(--primary-color)" /> Kurumsal Profil (Fatura Başlığı)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                 <div className="input-group"><label>Resmî Şirket Ünvanı</label><input type="text" className="input-field" value={companyInfo.name} onChange={e => setCompanyInfo({...companyInfo, name: e.target.value})} placeholder="Faturada görünecek tam isim" /></div>
                 <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }} className="input-group"><label>Vergi Dairesi</label><input type="text" className="input-field" value={companyInfo.tax_office} onChange={e => setCompanyInfo({...companyInfo, tax_office: e.target.value})} /></div>
                    <div style={{ flex: 1 }} className="input-group"><label>Vergi No / TCKN</label><input type="text" className="input-field" value={companyInfo.tax_id} onChange={e => setCompanyInfo({...companyInfo, tax_id: e.target.value})} /></div>
                 </div>
                 <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }} className="input-group"><label>Telefon</label><input type="text" className="input-field" value={companyInfo.phone} onChange={e => setCompanyInfo({...companyInfo, phone: e.target.value})} /></div>
                    <div style={{ flex: 1 }} className="input-group"><label>E-Posta</label><input type="text" className="input-field" value={companyInfo.email} onChange={e => setCompanyInfo({...companyInfo, email: e.target.value})} /></div>
                 </div>
                 <div className="input-group"><label>Resmî Adres</label><textarea className="input-field" style={{ minHeight: '80px', resize: 'vertical' }} value={companyInfo.address} onChange={e => setCompanyInfo({...companyInfo, address: e.target.value})} /></div>
              </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <section>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Globe size={18} color="var(--primary-color)" /> Genel Ayarlar
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="input-group"><label>Dil</label><select className="input-field" value={settings.language} onChange={e => setSettings({...settings, language: e.target.value})}><option value="tr">Türkçe</option><option value="en">English</option></select></div>
                <div className="input-group"><label>Para Birimi</label><select className="input-field" value={settings.currency} onChange={e => setSettings({...settings, currency: e.target.value})}><option value="TRY">₺ TRY</option><option value="TRY">₺ TRY</option></select></div>
              </div>
            </section>

            <hr style={{ border: '0', borderTop: '1px solid var(--border-color)' }} />

            <section>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bell size={18} color="var(--primary-color)" /> Bildirimler
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)' }}>
                 <div><p style={{ fontWeight: '500' }}>Stok Uyarıları</p><p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Kritik stok seviyesinde e-posta gönder.</p></div>
                 <input type="checkbox" checked={settings.notifications} onChange={e => setSettings({...settings, notifications: e.target.checked})} />
              </div>
            </section>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-primary" onClick={handleSave}><Save size={18} /> Kaydet</button></div>
          </div>
        </div>

        {/* KARGO FİRMALARI YÖNETİMİ */}
        <div className="card">
           <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <Truck size={18} color="var(--primary-color)" /> Kargo Firmaları
           </h3>
           {isAdmin && (
             <form onSubmit={handleAddCourier} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <input type="text" className="input-field" placeholder="Firma adı..." value={newCourier} onChange={e => setNewCourier(e.target.value)} />
                <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem' }} disabled={loading}><Plus size={20} /></button>
             </form>
           )}

           <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {couriers.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)' }}>
                   <span style={{ fontWeight: '500' }}>{c.name}</span>
                   {isAdmin && <button className="btn btn-secondary" style={{ padding: '0.3rem', color: 'var(--danger-color)', border: 'none' }} onClick={() => handleDeleteCourier(c.id)}><Trash2 size={16} /></button>}
                </div>
              ))}
              {couriers.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>Firma bulunmamaktadır.</p>}
           </div>
        </div>

      </div>
    </div>
  );
}

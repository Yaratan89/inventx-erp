import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, UserPlus, Shield, Edit3, Trash2, X, CheckCircle, Wallet, History, Key } from 'lucide-react';
import { format } from 'date-fns';

export default function Personnel() {
  const [staff, setStaff] = useState([]);
  const [parties, setParties] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [incomeExpenses, setIncomeExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [form, setForm] = useState({ id: null, full_name: '', phone: '', role: 'Staff', is_active: true, party_id: null });
  const [payForm, setPayForm] = useState({ amount: 0, description: '', method: 'Cash', date: format(new Date(), 'yyyy-MM-dd') });
  const [userForm, setUserForm] = useState({ email: '', password: '', full_name: '', role: 'Staff' });
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');
  const [userLoading, setUserLoading] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: stf } = await supabase.from('personnel').select('*').order('full_name');
    const { data: pty } = await supabase.from('parties').select('*');
    const { data: txs } = await supabase.from('financial_transactions').select('*');
    const { data: ie } = await supabase.from('income_expenses').select('*');
    
    if (stf) setStaff(stf);
    if (pty) setParties(pty);
    if (txs) setTransactions(txs);
    if (ie) setIncomeExpenses(ie);
    setLoading(false);
  };

  // Admin tarafından yeni kullanıcı oluşturma
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserError('');
    setUserSuccess('');
    setUserLoading(true);

    try {
      // 1. Supabase Auth'da kullanıcı oluştur (signUp ile)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userForm.email,
        password: userForm.password,
        options: {
          data: { full_name: userForm.full_name }
        }
      });

      if (authError) throw new Error('Kullanıcı oluşturulamadı: ' + authError.message);

      const newUserId = authData?.user?.id;
      if (!newUserId) throw new Error('Kullanıcı ID alınamadı.');

      // 2. Profiles tablosuna rol kaydı ekle
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert([{ id: newUserId, email: userForm.email, role: userForm.role.toLowerCase() }]);

      if (profileError) throw new Error('Profil oluşturulamadı: ' + profileError.message);

      // 3. Personnel tablosuna da ekle
      const partyPayload = { name: userForm.full_name, type: 'Employee' };
      const { data: newParty } = await supabase.from('parties').insert([partyPayload]).select().single();
      await supabase.from('personnel').insert([{
        full_name: userForm.full_name,
        role: userForm.role,
        is_active: true,
        party_id: newParty?.id || null
      }]);

      setUserSuccess(`✅ Kullanıcı başarıyla oluşturuldu! ${userForm.email} artık sisteme giriş yapabilir.`);
      setUserForm({ email: '', password: '', full_name: '', role: 'Staff' });
      fetchInitialData();
    } catch (err) {
      setUserError(err.message);
    } finally {
      setUserLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let p_id = form.party_id;

    try {
        const partyPayload = { name: form.full_name, type: 'Employee', phone: form.phone };
        if (p_id) {
           const { error: pErr } = await supabase.from('parties').update(partyPayload).eq('id', p_id);
           if (pErr) throw new Error("Cari güncelleme hatası: " + pErr.message);
        } else {
           const { data: newParty, error: pErr } = await supabase.from('parties').insert([partyPayload]).select().single();
           if (pErr) throw new Error("Cari oluşturma hatası: " + pErr.message);
           if (newParty) p_id = newParty.id;
        }

        const staffPayload = { full_name: form.full_name, phone: form.phone, role: form.role, is_active: form.is_active, party_id: p_id };
        const { error: sErr } = form.id 
          ? await supabase.from('personnel').update(staffPayload).eq('id', form.id)
          : await supabase.from('personnel').insert([staffPayload]);

        if (sErr) throw new Error("Personel kaydetme hatası: " + sErr.message);

        setShowModal(false);
        fetchInitialData();
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!selectedStaff?.party_id) return;

    const { error } = await supabase.from('income_expenses').insert([{
        type: 'expense',
        category: 'Personel Maaş/Ödeme',
        description: payForm.description || `${selectedStaff.full_name} Ödemesi`,
        amount: payForm.amount,
        payment_method: payForm.method,
        party_id: selectedStaff.party_id,
        transaction_date: payForm.date
    }]);

    if (!error) {
       setShowPaymentModal(false);
       setPayForm({ amount: 0, description: '', method: 'Cash', date: format(new Date(), 'yyyy-MM-dd') });
       fetchInitialData();
    } else {
       alert("Hata: " + error.message);
    }
  };

  const getStaffBalance = (partyId) => {
    if (!partyId) return 0;
    const ptIE = incomeExpenses.filter(r => r.party_id === partyId);
    const ptTX = transactions.filter(t => t.party_id === partyId);
    const totalPaid = ptIE.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
    const totalTxs = ptTX.filter(t => t.type === 'Payment').reduce((s, t) => s + Number(t.amount), 0);
    return totalPaid + totalTxs;
  };

  const deleteStaff = async (id) => {
    if (confirm('Bu personeli silmek istediğinize emin misiniz?')) {
      await supabase.from('personnel').delete().eq('id', id);
      fetchInitialData();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Personel & Yetkilendirme</h2>
          <p style={{ color: 'var(--text-muted)' }}>Ekibinizi yönetin ve sisteme erişim yetkilerini belirleyin.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => { setUserError(''); setUserSuccess(''); setShowUserModal(true); }}>
            <Key size={18} /> Sisteme Kullanıcı Ekle
          </button>
          <button className="btn btn-primary" onClick={() => { setForm({ id: null, full_name: '', phone: '', role: 'Staff', is_active: true }); setShowModal(true); }}>
            <UserPlus size={18} /> Personel Kartı Ekle
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Ad Soyad</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Telefon</th>
              <th style={{ padding: '1rem', textAlign: 'center' }}>Rol</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>Toplam Ödeme</th>
              <th style={{ padding: '1rem', textAlign: 'center' }}>Durum</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {staff.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => setSelectedStaff(p)}>
                <td style={{ padding: '1rem', fontWeight: '600' }}>{p.full_name}</td>
                <td style={{ padding: '1rem' }}>{p.phone || '-'}</td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  <span className={`badge ${p.role === 'Admin' ? 'badge-primary' : p.role === 'Manager' ? 'badge-gold' : 'badge-secondary'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Shield size={12} /> {p.role}
                  </span>
                </td>
                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--success-color)' }}>
                  ₺{getStaffBalance(p.party_id).toLocaleString()}
                </td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  {p.is_active ? <CheckCircle size={18} color="var(--success-color)" /> : <X size={18} color="var(--danger-color)" />}
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary p-1" title="Ödeme Yap" onClick={(e) => { e.stopPropagation(); setSelectedStaff(p); setShowPaymentModal(true); }}><Wallet size={16} color="var(--primary-color)" /></button>
                    <button className="btn btn-secondary p-1" onClick={(e) => { e.stopPropagation(); setForm(p); setShowModal(true); }}><Edit3 size={16} /></button>
                    <button className="btn btn-secondary p-1" style={{ color: 'var(--danger-color)' }} onClick={(e) => { e.stopPropagation(); deleteStaff(p.id); }}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {staff.length === 0 && !loading && (
              <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Henüz personel eklenmemiş.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedStaff && (
        <div className="card animate-fade-in" style={{ padding: '1.5rem' }}>
           <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} color="var(--primary-color)" /> {selectedStaff.full_name} - Ödeme Geçmişi
           </h3>
           <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                 <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                       <th style={{ padding: '0.75rem' }}>Tarih</th>
                       <th style={{ padding: '0.75rem' }}>Açıklama</th>
                       <th style={{ padding: '0.75rem' }}>Yöntem</th>
                       <th style={{ padding: '0.75rem', textAlign: 'right' }}>Tutar</th>
                    </tr>
                 </thead>
                 <tbody>
                    {incomeExpenses.filter(ie => ie.party_id === selectedStaff.party_id).map(move => (
                       <tr key={move.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem' }}>{format(new Date(move.transaction_date), 'dd.MM.yyyy')}</td>
                          <td style={{ padding: '0.75rem' }}>{move.description}</td>
                          <td style={{ padding: '0.75rem' }}>{move.payment_method}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>₺{Number(move.amount).toLocaleString()}</td>
                       </tr>
                    ))}
                    {incomeExpenses.filter(ie => ie.party_id === selectedStaff.party_id).length === 0 && (
                       <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Henüz ödeme kaydı bulunmuyor.</td></tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {/* Sisteme Kullanıcı Ekle Modalı */}
      {showUserModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '460px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontWeight: '700', fontSize: '1.1rem' }}>🔐 Sisteme Yeni Kullanıcı Ekle</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>Bu kullanıcı belirlediğiniz e-posta ve şifreyle giriş yapabilecek.</p>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowUserModal(false)}><X size={20}/></button>
            </div>

            {userError && (
              <div style={{ background: 'var(--danger-light)', color: 'var(--danger-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '1rem', border: '1px solid var(--danger-color)' }}>
                {userError}
              </div>
            )}
            {userSuccess && (
              <div style={{ background: 'var(--success-light)', color: 'var(--success-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '1rem', border: '1px solid var(--success-color)' }}>
                {userSuccess}
              </div>
            )}

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label>Ad Soyad</label>
                <input className="input-field" value={userForm.full_name} onChange={e => setUserForm({...userForm, full_name: e.target.value})} placeholder="Örn: Ahmet Yılmaz" required />
              </div>
              <div className="input-group">
                <label>E-posta Adresi (Giriş için kullanılacak)</label>
                <input type="email" className="input-field" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} placeholder="ahmet@sirket.com" required />
              </div>
              <div className="input-group">
                <label>Şifre (En az 6 karakter)</label>
                <input type="password" className="input-field" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} placeholder="••••••••" minLength={6} required />
              </div>
              <div className="input-group">
                <label>Yetki Seviyesi</label>
                <select className="input-field" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                  <option value="Staff">Personel — Sadece işlem yapabilir</option>
                  <option value="Manager">Yönetici — Raporları görebilir</option>
                  <option value="Admin">Admin — Tam yetki (Kullanıcı ekleyebilir)</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', padding: '0.875rem' }} disabled={userLoading}>
                {userLoading ? 'Kullanıcı oluşturuluyor...' : '✅ Kullanıcı Oluştur ve Erişim Ver'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Personel Düzenle Modalı */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3>{form.id ? 'Personel Düzenle' : 'Yeni Personel'}</h3>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group"><label>Ad Soyad</label><input className="input-field" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required /></div>
              <div className="input-group"><label>Telefon</label><input className="input-field" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              <div className="input-group"><label>Yetki Rolü</label>
                <select className="input-field" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="Staff">Personel</option>
                  <option value="Manager">Yönetici</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} />
                <label>Aktif Kullanıcı</label>
              </div>
              <button className="btn btn-primary" style={{ marginTop: '1rem' }}>Kaydet</button>
            </form>
          </div>
        </div>
      )}

      {/* Ödeme Modalı */}
      {showPaymentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3>💰 Ödeme Yap: {selectedStaff?.full_name}</h3>
              <button className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}><X size={20}/></button>
            </div>
            <form onSubmit={handlePayment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <div className="input-group"><label>Tutar (₺)</label><input type="number" className="input-field" value={payForm.amount} onChange={e => setPayForm({...payForm, amount: e.target.value})} required /></div>
               <div className="input-group"><label>Tarih</label><input type="date" className="input-field" value={payForm.date} onChange={e => setPayForm({...payForm, date: e.target.value})} required /></div>
               <div className="input-group"><label>Ödeme Yöntemi</label>
                 <select className="input-field" value={payForm.method} onChange={e => setPayForm({...payForm, method: e.target.value})}>
                    <option value="Cash">Nakit</option>
                    <option value="Bank">Banka / Havale</option>
                 </select>
               </div>
               <div className="input-group"><label>Açıklama</label><input className="input-field" placeholder="Maaş, Avans vb." value={payForm.description} onChange={e => setPayForm({...payForm, description: e.target.value})} /></div>
               <button className="btn btn-primary" style={{ marginTop: '1rem' }}>Ödemeyi Kaydet</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

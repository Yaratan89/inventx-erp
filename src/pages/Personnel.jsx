import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, UserPlus, Shield, Edit3, Trash2, X, CheckCircle, Wallet, History, ArrowDownRight } from 'lucide-react';
import { format } from 'date-fns';

export default function Personnel() {
  const [staff, setStaff] = useState([]);
  const [parties, setParties] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [incomeExpenses, setIncomeExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [form, setForm] = useState({ id: null, full_name: '', phone: '', role: 'Staff', is_active: true, party_id: null });
  const [payForm, setPayForm] = useState({ amount: 0, description: '', method: 'Cash', date: format(new Date(), 'yyyy-MM-dd') });

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    let p_id = form.party_id;

    try {
        // 1. Önce Cari Kartını Oluştur/Güncelle (Finansal entegrasyon için)
        const partyPayload = { name: form.full_name, type: 'Employee', phone: form.phone };
        if (p_id) {
           const { error: pErr } = await supabase.from('parties').update(partyPayload).eq('id', p_id);
           if (pErr) throw new Error("Cari güncelleme hatası: " + pErr.message);
        } else {
           const { data: newParty, error: pErr } = await supabase.from('parties').insert([partyPayload]).select().single();
           if (pErr) throw new Error("Cari oluşturma hatası: " + pErr.message);
           if (newParty) p_id = newParty.id;
        }

        // 2. Personel Kartını Kaydet
        const staffPayload = { full_name: form.full_name, phone: form.phone, role: form.role, is_active: form.is_active, party_id: p_id };
        const { error: sErr } = form.id 
          ? await supabase.from('personnel').update(staffPayload).eq('id', form.id)
          : await supabase.from('personnel').insert([staffPayload]);

        if (sErr) throw new Error("Personel kaydetme hatası: " + sErr.message);

        setShowModal(false);
        fetchInitialData();
    } catch (err) {
        console.error(err);
        alert(err.message + "\n\nNot: Eğer 'column party_id does not exist' hatası alıyorsanız, lütfen size verdiğim SQL kodunu Supabase'de çalıştırın.");
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!selectedStaff?.party_id) return;

    // Finansal kaydı ekle (Gider olarak)
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
    
    return totalPaid + totalTxs; // Basitçe personele giden toplam para
  };

  const deleteStaff = async (id) => {
    if (confirm('Bu personeli silmek istediğinize emin misiniz?')) {
      await supabase.from('personnel').delete().eq('id', id);
      fetchStaff();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Personel & Yetkilendirme</h2>
          <p style={{ color: 'var(--text-muted)' }}>Ekibinizi yönetin ve erişim yetkilerini belirleyin.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ id: null, full_name: '', phone: '', role: 'Staff', is_active: true }); setShowModal(true); }}>
          <UserPlus size={18} /> Yeni Personel Ekle
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
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
                  <span className={`badge ${p.role === 'Admin' ? 'badge-primary' : 'badge-secondary'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
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

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3>{form.id ? 'Personel Düzenle' : 'Yeni Personel'}</h3>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group"><label>Ad Soyad</label><input className="input-field" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required /></div>
              <div className="input-group"><label>Telefon</label><input className="input-field" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              <div className="input-group"><label>Yetki Rolü</label>
                <select className="input-field" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="Staff">Personel (Sadece İşlem)</option>
                  <option value="Manager">Yönetici (Rapor + Stok)</option>
                  <option value="Admin">Admin (Tam Yetki)</option>
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
      {showPaymentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '400px' }}>
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

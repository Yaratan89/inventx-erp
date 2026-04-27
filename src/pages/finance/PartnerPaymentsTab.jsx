import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Plus, DollarSign, Trash2, ArrowDownLeft, ArrowUpRight, X, UserPlus, History, Wallet } from 'lucide-react';
import { format } from 'date-fns';

export default function PartnerPaymentsTab({ parties, transactions, incomeExpenses, onRefresh }) {
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState(null);

  const [partnerForm, setPartnerForm] = useState({ name: '', phone: '', email: '', type: 'Partner' });
  const [paymentForm, setPaymentForm] = useState({ 
    party_id: '', 
    amount: '', 
    type: 'Partner_Payment', 
    method: 'Cash', 
    description: '' 
  });

  const partners = parties.filter(p => p.type === 'Partner' || (p.name && p.name.toLowerCase().includes('ortak')));
  
  // Ortak hareketlerini birleştir
  const getPartnerHistory = (partnerId) => {
    const txs = transactions.filter(t => t.party_id === partnerId).map(t => ({
        ...t,
        source: 'tx',
        date: t.created_at
    }));
    const ies = incomeExpenses.filter(r => r.party_id === partnerId).map(r => ({
        ...r,
        source: 'ie',
        date: r.transaction_date || r.created_at
    }));
    return [...txs, ...ies].sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const getPartnerStats = (partnerId) => {
    const history = getPartnerHistory(partnerId);
    let totalIn = 0; // Şirketin ortağa borçlandığı durumlar (Partner ödeme yaptı veya alacaklı oldu)
    let totalOut = 0; // Şirketin ortağa ödeme yaptığı durumlar (Kar payı çekimi vs)

    history.forEach(item => {
        if (item.source === 'tx') {
            if (item.type === 'Partner_Payment' || item.type === 'Payment') totalOut += Number(item.amount);
            if (item.type === 'Collection') totalIn += Number(item.amount);
        } else {
            // Gelir ortağın alacağını artırır mı? Genelde ortak cari ise Evet.
            if (item.type === 'income') totalIn += Number(item.amount);
            // Gider ortağın alacağını artırır mı? SADECE Ortak Cebinden ödediyse.
            if (item.type === 'expense' && item.payment_method === 'Partner_Paid') totalIn += Number(item.amount);
            // Normal gider ise şirketin kasasından çıkmıştır, ortağı bağlamaz.
        }
    });

    return { totalIn, totalOut, balance: totalIn - totalOut };
  };

  const globalStats = partners.reduce((acc, p) => {
    const stats = getPartnerStats(p.id);
    return {
        totalIn: acc.totalIn + stats.totalIn,
        totalOut: acc.totalOut + stats.totalOut,
        balance: acc.balance + stats.balance
    };
  }, { totalIn: 0, totalOut: 0, balance: 0 });

  const handleAddPartner = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('parties').insert([partnerForm]);
    if (error) alert("Hata: " + error.message);
    else {
      setShowAddPartnerModal(false);
      setPartnerForm({ name: '', phone: '', email: '', type: 'Partner' });
      if (onRefresh) onRefresh();
    }
    setLoading(false);
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.party_id) return alert("Lütfen bir ortak seçin.");
    setLoading(true);
    const { error } = await supabase.from('financial_transactions').insert([paymentForm]);
    if (error) alert("Hata: " + error.message);
    else {
      setShowPaymentModal(false);
      setPaymentForm({ party_id: '', amount: '', type: 'Partner_Payment', method: 'Cash', description: '' });
      if (onRefresh) onRefresh();
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Üst Kartlar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ortak Sayısı</p>
            <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.5rem' }}>{partners.length}</h3>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--success-color)' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Toplam Ortak Alacağı</p>
            <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.5rem', color: 'var(--success-color)' }}>₺{globalStats.totalIn.toLocaleString()}</h3>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--danger-color)' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Toplam Ödeme/Çekim</p>
            <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.5rem', color: 'var(--danger-color)' }}>₺{globalStats.totalOut.toLocaleString()}</h3>
        </div>
        <div className="card" style={{ borderLeft: `4px solid ${globalStats.balance >= 0 ? 'var(--primary-color)' : 'var(--warning-color)'}` }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Net Borç / Alacak Durumu</p>
            <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.5rem' }}>₺{globalStats.balance.toLocaleString()}</h3>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={() => setShowAddPartnerModal(true)}>
            <UserPlus size={18} /> Yeni Ortak Ekle
          </button>
          <button className="btn btn-gold" onClick={() => setShowPaymentModal(true)}>
            <Plus size={18} /> Kar Payı / Ödeme Yap
          </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
        {/* Ortak Listesi ve Bakiyeleri */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
            <h4 style={{ margin: 0 }}>Ortak Bakiyeleri</h4>
          </div>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--surface-color)', textTransform: 'uppercase' }}>
                  <th style={{ padding: '1rem' }}>Ortak</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Alacak</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Ödeme</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Bakiye</th>
                </tr>
              </thead>
              <tbody>
                {partners.map(p => {
                  const stats = getPartnerStats(p.id);
                  const isSelected = selectedPartnerId === p.id;
                  return (
                    <tr key={p.id} 
                        onClick={() => setSelectedPartnerId(isSelected ? null : p.id)}
                        style={{ 
                            borderBottom: '1px solid var(--border-color)', 
                            cursor: 'pointer',
                            background: isSelected ? 'var(--primary-light)' : 'transparent',
                            transition: 'all 0.2s ease'
                        }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: '600', color: isSelected ? 'var(--primary-color)' : 'inherit' }}>{p.name}</div>
                        <small style={{ color: 'var(--text-muted)' }}>{p.phone || '-'}</small>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--success-color)', fontSize: '0.85rem' }}>₺{stats.totalIn.toLocaleString()}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--danger-color)', fontSize: '0.85rem' }}>₺{stats.totalOut.toLocaleString()}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', color: stats.balance >= 0 ? 'var(--primary-color)' : 'var(--warning-color)' }}>
                        ₺{stats.balance.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Birleştirilmiş Hareket Geçmişi */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0 }}>
                {selectedPartnerId ? `${parties.find(p => p.id === selectedPartnerId)?.name} Hareketleri` : 'Tüm Ortak Hareketleri'}
            </h4>
            {selectedPartnerId && (
                <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem' }} onClick={(e) => { e.stopPropagation(); setSelectedPartnerId(null); }}>
                    Filtreyi Kaldır
                </button>
            )}
            {!selectedPartnerId && <History size={18} color="var(--text-muted)" />}
          </div>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--surface-color)', textTransform: 'uppercase' }}>
                  <th style={{ padding: '1rem' }}>Tarih</th>
                  <th style={{ padding: '1rem' }}>Ortak</th>
                  <th style={{ padding: '1rem' }}>İşlem / Açıklama</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Tutar</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {partners
                  .filter(p => !selectedPartnerId || p.id === selectedPartnerId)
                  .flatMap(p => getPartnerHistory(p.id))
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .slice(0, 50) // Son 50 hareket
                  .map((item, idx) => {
                    const partnerName = parties.find(p => p.id === item.party_id)?.name;
                    const isOut = item.source === 'tx' && (item.type === 'Partner_Payment' || item.type === 'Payment');
                    const isPartnerPaid = item.source === 'ie' && item.payment_method === 'Partner_Paid';
                    
                    let label = item.type;
                    if (item.type === 'Partner_Payment') label = 'Kâr Payı/Ödeme';
                    if (item.type === 'expense') label = isPartnerPaid ? 'Ortak Cebinden Gider' : 'İşletme Gideri';
                    if (item.type === 'income') label = 'Gelir Kaydı';

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '1rem', fontSize: '0.8rem' }}>{format(new Date(item.date), 'dd.MM.yyyy')}</td>
                        <td style={{ padding: '1rem', fontWeight: '500' }}>{partnerName}</td>
                        <td style={{ padding: '1rem' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                              {isOut ? <ArrowUpRight size={14} color="var(--danger-color)" /> : <ArrowDownLeft size={14} color="var(--success-color)" />}
                              {label}
                           </div>
                           <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.description || item.category || '-'}</div>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', color: isOut ? 'var(--danger-color)' : 'var(--success-color)' }}>
                          {isOut ? '-' : '+'}₺{Number(item.amount).toLocaleString()}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                            <button 
                                className="btn btn-secondary p-1" 
                                style={{ color: 'var(--danger-color)' }}
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    if(confirm('Bu hareketi silmek istediğinize emin misiniz? (Finansal kayıt kalıcı olarak silinecektir)')) {
                                        const table = item.source === 'tx' ? 'financial_transactions' : 'income_expenses';
                                        const { error } = await supabase.from(table).delete().eq('id', item.id);
                                        if(error) alert('Hata: '+error.message);
                                        else onRefresh();
                                    }
                                }}
                            >
                                <Trash2 size={14} />
                            </button>
                        </td>
                      </tr>
                    );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modallar (Önceki kodla aynı mantık) */}
      {showAddPartnerModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade-in" style={{ width: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3>Yeni Ortak Tanımla</h3>
              <button className="btn btn-secondary" onClick={() => setShowAddPartnerModal(false)}><X size={20}/></button>
            </div>
            <form onSubmit={handleAddPartner} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group"><label>Ad Soyad / Ünvan</label><input className="input-field" required value={partnerForm.name} onChange={e => setPartnerForm({...partnerForm, name: e.target.value})} /></div>
              <div className="input-group"><label>Telefon</label><input className="input-field" value={partnerForm.phone} onChange={e => setPartnerForm({...partnerForm, phone: e.target.value})} /></div>
              <div className="input-group"><label>E-posta</label><input type="email" className="input-field" value={partnerForm.email} onChange={e => setPartnerForm({...partnerForm, email: e.target.value})} /></div>
              <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</button>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade-in" style={{ width: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3>Kâr Payı / Ödeme Yap</h3>
              <button className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}><X size={20}/></button>
            </div>
            <form onSubmit={handleAddPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label>Ortak Seçin</label>
                <select className="input-field" required value={paymentForm.party_id} onChange={e => setPaymentForm({...paymentForm, party_id: e.target.value})}>
                  <option value="">Seçiniz...</option>
                  {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="input-group"><label>Ödeme Tutarı</label><input type="number" className="input-field" required value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} /></div>
              <div className="input-group">
                <label>Ödeme Yöntemi</label>
                <select className="input-field" value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method: e.target.value})}>
                  <option value="Cash">Nakit</option>
                  <option value="Bank">Banka Havalesi</option>
                </select>
              </div>
              <div className="input-group"><label>Açıklama</label><input className="input-field" value={paymentForm.description} onChange={e => setPaymentForm({...paymentForm, description: e.target.value})} /></div>
              <button className="btn btn-gold" type="submit" disabled={loading}>{loading ? 'İşleniyor...' : '✓ Ödemeyi Onayla'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

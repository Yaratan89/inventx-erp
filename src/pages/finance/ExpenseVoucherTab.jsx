import { createPortal } from 'react-dom';
import { useState } from 'react';
import { Plus, Check, X, FileText, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

export default function ExpenseVoucherTab({ vouchers, taxRates, parties, onRefresh }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    voucher_no: '', supplier_name: '', party_id: '', notes: '',
    voucher_date: format(new Date(), 'yyyy-MM-dd'),
    items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 20 }]
  });

  const calcItem = (item) => {
    const sub = item.quantity * item.unit_price;
    const tax = sub * (item.tax_rate / 100);
    return { subtotal: sub, tax, total: sub + tax };
  };

  const totals = form.items.reduce((acc, item) => {
    const c = calcItem(item);
    return { sub: acc.sub + c.subtotal, tax: acc.tax + c.tax, grand: acc.grand + c.total };
  }, { sub: 0, tax: 0, grand: 0 });

  const addItem = () => setForm({ ...form, items: [...form.items, { description: '', quantity: 1, unit_price: 0, tax_rate: 20 }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (i, field, val) => {
    const newItems = [...form.items];
    newItems[i] = { ...newItems[i], [field]: val };
    setForm({ ...form, items: newItems });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const itemsWithCalc = form.items.map(item => {
      const c = calcItem(item);
      return { ...item, tax_amount: Math.round(c.tax * 100) / 100, total: Math.round(c.total * 100) / 100 };
    });
    const { error } = await supabase.from('expense_vouchers').insert([{
      voucher_no: form.voucher_no || `GF-${Date.now()}`,
      supplier_name: form.supplier_name,
      party_id: form.party_id || null,
      notes: form.notes,
      voucher_date: form.voucher_date,
      items: itemsWithCalc,
      subtotal: Math.round(totals.sub * 100) / 100,
      total_tax: Math.round(totals.tax * 100) / 100,
      grand_total: Math.round(totals.grand * 100) / 100,
      status: 'draft'
    }]);
    if (error) { alert('Hata: ' + error.message); return; }
    setShowModal(false);
    setForm({ voucher_no: '', supplier_name: '', party_id: '', notes: '', voucher_date: format(new Date(), 'yyyy-MM-dd'), items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 20 }] });
    onRefresh();
  };

  const handleApprove = async (voucher) => {
    if (voucher.status !== 'draft') return;
    const { error: upErr } = await supabase.from('expense_vouchers').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', voucher.id);
    if (upErr) { alert('Hata: ' + upErr.message); return; }
    // Onaylanan fiş → income_expenses tablosuna gider kaydı olarak yaz
    await supabase.from('income_expenses').insert([{
      type: 'expense', category: 'Gider Fişi', description: `${voucher.voucher_no} - ${voucher.supplier_name || 'Tedarikçi'}`,
      amount: voucher.grand_total, tax_rate: 0, tax_amount: voucher.total_tax, net_amount: voucher.subtotal,
      payment_method: 'Cash', reference_no: voucher.voucher_no, party_id: voucher.party_id, voucher_id: voucher.id,
      transaction_date: voucher.voucher_date
    }]);
    onRefresh();
  };

  const statusBadge = (s) => {
    if (s === 'approved') return <span className="badge badge-success">ONAYLI</span>;
    if (s === 'cancelled') return <span className="badge badge-danger">İPTAL</span>;
    return <span className="badge badge-warning">TASLAK</span>;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ fontWeight: '700', fontSize: '1.1rem' }}>Gider Fişleri</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{vouchers.length} fiş kayıtlı</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={18} /> Yeni Fiş</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '2px solid var(--border-color)' }}>
            {['Fiş No', 'Tarih', 'Tedarikçi', 'Kalem', 'Ara Toplam', 'KDV', 'Genel Toplam', 'Durum', 'İşlem'].map(h => (
              <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {vouchers.map(v => (
              <tr key={v.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.7rem 1rem', fontWeight: '600', color: 'var(--primary-color)' }}>{v.voucher_no}</td>
                <td style={{ padding: '0.7rem 1rem', fontSize: '0.85rem' }}>{format(new Date(v.voucher_date), 'dd.MM.yyyy')}</td>
                <td style={{ padding: '0.7rem 1rem', fontSize: '0.85rem' }}>{v.supplier_name || '-'}</td>
                <td style={{ padding: '0.7rem 1rem', fontSize: '0.85rem' }}>{Array.isArray(v.items) ? v.items.length : 0} kalem</td>
                <td style={{ padding: '0.7rem 1rem' }}>₺{Number(v.subtotal).toLocaleString()}</td>
                <td style={{ padding: '0.7rem 1rem', color: 'var(--warning-color)' }}>₺{Number(v.total_tax).toLocaleString()}</td>
                <td style={{ padding: '0.7rem 1rem', fontWeight: '700' }}>₺{Number(v.grand_total).toLocaleString()}</td>
                <td style={{ padding: '0.7rem 1rem' }}>{statusBadge(v.status)}</td>
                <td style={{ padding: '0.7rem 1rem', display:'flex', gap:'0.5rem', alignItems:'center' }}>
                  {v.status === 'draft' && (
                    <button className="btn btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem' }} onClick={() => handleApprove(v)}>
                      <Check size={14} /> Onayla
                    </button>
                  )}
                  <button 
                    className="btn btn-secondary p-1" 
                    style={{ color: 'var(--danger-color)' }}
                    onClick={async () => {
                        if(confirm('Bu gider fişini silmek istediğinize emin misiniz?')) {
                            const { error } = await supabase.from('expense_vouchers').delete().eq('id', v.id);
                            if(error) alert('Hata: '+error.message);
                            else onRefresh();
                        }
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {vouchers.length === 0 && <tr><td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Henüz gider fişi yok</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Fiş Oluşturma Modalı */}
      {showModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '4rem 1rem' }}>
          <div className="card animate-fade-in" style={{ width: '600px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: '700' }}><FileText size={20} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />Yeni Gider Fişi</h3>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="input-group" style={{ flex: 1 }}><label>Fiş No</label>
                  <input className="input-field" placeholder="Otomatik" value={form.voucher_no} onChange={e => setForm({ ...form, voucher_no: e.target.value })} />
                </div>
                <div className="input-group" style={{ flex: 1 }}><label>Tarih</label>
                  <input type="date" className="input-field" value={form.voucher_date} onChange={e => setForm({ ...form, voucher_date: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="input-group" style={{ flex: 1 }}><label>Tedarikçi Adı</label>
                  <input className="input-field" value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} />
                </div>
                <div className="input-group" style={{ flex: 1 }}><label>Cari Hesap</label>
                  <select className="input-field" value={form.party_id} onChange={e => setForm({ ...form, party_id: e.target.value })}>
                    <option value="">Seçilmedi</option>{parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Kalemler */}
              <div style={{ background: 'rgba(27,99,216,0.06)', border: '1px solid rgba(27,99,216,0.15)', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <p style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Kalemler</p>
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={addItem}><Plus size={14} /> Kalem Ekle</button>
                </div>
                {form.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-end' }}>
                    <div style={{ flex: 3 }}><input className="input-field" placeholder="Açıklama" style={{ fontSize: '0.85rem', padding: '0.5rem' }} value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} /></div>
                    <div style={{ flex: 1 }}><input type="number" className="input-field" placeholder="Adet" style={{ fontSize: '0.85rem', padding: '0.5rem' }} value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} /></div>
                    <div style={{ flex: 1.5 }}><input type="number" step="0.01" className="input-field" placeholder="Birim ₺" style={{ fontSize: '0.85rem', padding: '0.5rem' }} value={item.unit_price} onChange={e => updateItem(i, 'unit_price', Number(e.target.value))} /></div>
                    <div style={{ flex: 1 }}>
                      <select className="input-field" style={{ fontSize: '0.85rem', padding: '0.5rem' }} value={item.tax_rate} onChange={e => updateItem(i, 'tax_rate', Number(e.target.value))}>
                        {taxRates.map(t => <option key={t.id} value={t.rate}>{t.rate}%</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1, textAlign: 'right', fontSize: '0.85rem', fontWeight: '600', paddingBottom: '0.5rem' }}>₺{(calcItem(item).total).toFixed(2)}</div>
                    {form.items.length > 1 && <button type="button" onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', paddingBottom: '0.5rem' }}><Trash2 size={16} /></button>}
                  </div>
                ))}
              </div>

              {/* Toplamlar */}
              <div style={{ padding: '1rem', background: 'rgba(27,99,216,0.1)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.85rem' }}><span>Ara Toplam:</span><span>₺{totals.sub.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--warning-color)' }}><span>Toplam KDV:</span><span>₺{totals.tax.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: '800', color: 'var(--primary-color)', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.3rem' }}><span>Genel Toplam:</span><span>₺{totals.grand.toFixed(2)}</span></div>
              </div>

              <div className="input-group"><label>Notlar</label><input className="input-field" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>İptal</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Taslak Olarak Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </div>
  );
}

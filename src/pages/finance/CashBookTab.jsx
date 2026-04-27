import { Wallet, TrendingUp, TrendingDown, Users, ArrowUpRight, ArrowDownLeft, Package, ShoppingCart } from 'lucide-react';

export default function CashBookTab({ incomeExpenses, transactions, parties, stockDocuments = [] }) {
  // Standart Gelir/Gider tablosundan (Stok belgeleri hariç)
  const ieIncome = incomeExpenses.filter(r => r.type === 'income' && !r.is_stock_doc && r.payment_method !== 'Partner_Paid').reduce((s, r) => s + Number(r.amount), 0);
  const ieExpense = incomeExpenses.filter(r => r.type === 'expense' && !r.is_stock_doc && r.payment_method !== 'Partner_Paid').reduce((s, r) => s + Number(r.amount), 0);

  // Perakende Stok Gelir/Giderleri (Cari hesaba yansımayan nakit işlemler)
  const retailIncome = incomeExpenses.filter(r => r.type === 'income' && r.is_stock_doc && !r.party_id && r.payment_method !== 'Partner_Paid').reduce((s, r) => s + Number(r.amount), 0);
  const retailExpense = incomeExpenses.filter(r => r.type === 'expense' && r.is_stock_doc && !r.party_id && r.payment_method !== 'Partner_Paid').reduce((s, r) => s + Number(r.amount), 0);

  // Cari hareketlerden
  const ftCollections = transactions.filter(t => t.type === 'Collection').reduce((s, t) => s + Number(t.amount), 0);
  const ftPayments = transactions.filter(t => t.type === 'Payment').reduce((s, t) => s + Number(t.amount), 0);
  const ftPartnerPayments = transactions.filter(t => t.type === 'Partner_Payment').reduce((s, t) => s + Number(t.amount), 0);

  // Satış gelirleri (Sale_Credit = satış alacağı = gelir)
  const ftSaleCredits = transactions.filter(t => t.type === 'Sale_Credit').reduce((s, t) => s + Number(t.amount), 0);
  // Alım borçları (Purchase_Debt = alım borcu = gider)
  const ftPurchaseDebts = transactions.filter(t => t.type === 'Purchase_Debt').reduce((s, t) => s + Number(t.amount), 0);

  const totalIn = ieIncome + ftCollections + ftSaleCredits + retailIncome;
  const totalOut = ieExpense + ftPayments + ftPurchaseDebts + retailExpense + ftPartnerPayments;
  const netCash = totalIn - totalOut;

  // Gerçek Stok Belgelerinden hareket sayıları
  const stockInCount = stockDocuments.filter(d => d.document_type === 'IN').length;
  const stockOutCount = stockDocuments.filter(d => d.document_type === 'OUT').length;

  // Müşteri bazlı bakiye
  const partyBalances = parties.map(p => {
    const ptTx = transactions.filter(t => t.party_id === p.id);
    let borc = 0, alacak = 0;
    ptTx.forEach(t => {
      if (t.type === 'Payment' || t.type === 'Purchase_Debt') borc += Number(t.amount);
      if (t.type === 'Collection' || t.type === 'Sale_Credit') alacak += Number(t.amount);
    });
    const ptIE = incomeExpenses.filter(r => r.party_id === p.id);
    ptIE.forEach(r => {
      if (r.type === 'income') alacak += Number(r.amount);
      if (r.type === 'expense') borc += Number(r.amount);
    });
    // Ortak ödemelerini borç/alacak olarak değil, direkt kasa çıkışı olarak gördüğümüz için 
    // Cari bakiyede ortakları özel listelemek istiyorsak buraya Partner_Payment ekleyebiliriz.
    // Ancak ortak ödemeleri genellikle "borç kapama" değil "kar payı/çekim" olduğu için bakiye mantığı farklıdır.
    // Yine de ortak carisini görmek için ekleyelim:
    ptTx.forEach(t => {
       if (t.type === 'Partner_Payment') borc += Number(t.amount);
    });
    return { ...p, borc, alacak, net: alacak - borc };
  }).filter(p => p.borc > 0 || p.alacak > 0);

  const totalBorc = partyBalances.reduce((s, p) => s + p.borc, 0);
  const totalAlacak = partyBalances.reduce((s, p) => s + p.alacak, 0);

  return (
    <div>
      {/* Kasa Kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ borderTop: '3px solid var(--success-color)', textAlign: 'center', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <div style={{ padding: '0.6rem', background: 'var(--success-light)', borderRadius: '10px', color: 'var(--success-color)' }}><TrendingUp size={24} /></div>
          </div>
          <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Toplam Nakit Giriş</p>
          <p style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--success-color)' }}>₺{totalIn.toLocaleString()}</p>
          <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span>Gelirler: ₺{ieIncome.toLocaleString()} · Perakende: ₺{retailIncome.toLocaleString()}</span>
            <span>Tahsilatlar: ₺{ftCollections.toLocaleString()} · Satışlar: ₺{ftSaleCredits.toLocaleString()}</span>
          </div>
        </div>

        <div className="card" style={{ borderTop: '3px solid var(--danger-color)', textAlign: 'center', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <div style={{ padding: '0.6rem', background: 'var(--danger-light)', borderRadius: '10px', color: 'var(--danger-color)' }}><TrendingDown size={24} /></div>
          </div>
          <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Toplam Nakit Çıkış</p>
          <p style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--danger-color)' }}>₺{totalOut.toLocaleString()}</p>
          <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span>Giderler: ₺{ieExpense.toLocaleString()} · Perakende Alım: ₺{retailExpense.toLocaleString()}</span>
            <span>Ödemeler: ₺{ftPayments.toLocaleString()} · Alımlar: ₺{ftPurchaseDebts.toLocaleString()}</span>
            {ftPartnerPayments > 0 && <span>Ortak Ödemeleri: ₺{ftPartnerPayments.toLocaleString()}</span>}
          </div>
        </div>

        <div className="card" style={{ borderTop: `3px solid ${netCash >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}`, textAlign: 'center', padding: '1.5rem', background: netCash >= 0 ? 'rgba(14,164,114,0.05)' : 'rgba(224,62,62,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <div style={{ padding: '0.6rem', background: netCash >= 0 ? 'var(--success-light)' : 'var(--danger-light)', borderRadius: '10px', color: netCash >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}><Wallet size={24} /></div>
          </div>
          <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Aktif Kasa Durumu</p>
          <p style={{ fontSize: '2rem', fontWeight: '800', color: netCash >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>₺{netCash.toLocaleString()}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{netCash >= 0 ? '✓ Kasa Pozitif' : '⚠ Kasa Negatif'}</p>
        </div>
      </div>

      {/* Stok Hareket Özeti */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.5rem' }}>
          <div style={{ padding: '0.6rem', background: 'var(--primary-light)', borderRadius: '10px', color: 'var(--primary-color)' }}><Package size={22} /></div>
          <div><p style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Stok Giriş İşlemi</p>
          <p style={{ fontSize: '1.3rem', fontWeight: '700' }}>{stockInCount} Hareket</p></div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.5rem' }}>
          <div style={{ padding: '0.6rem', background: 'var(--warning-light)', borderRadius: '10px', color: 'var(--warning-color)' }}><ShoppingCart size={22} /></div>
          <div><p style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Stok Çıkış İşlemi</p>
          <p style={{ fontSize: '1.3rem', fontWeight: '700' }}>{stockOutCount} Hareket</p></div>
        </div>
      </div>

      {/* Müşteri Bakiye */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <Users size={22} style={{ color: 'var(--primary-color)' }} />
        <h3 style={{ fontWeight: '700', fontSize: '1.1rem' }}>Müşteri / Tedarikçi Net Bakiye</h3>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
          <span style={{ color: 'var(--danger-color)', fontWeight: '600' }}>Toplam Borç: ₺{totalBorc.toLocaleString()}</span>
          <span style={{ color: 'var(--success-color)', fontWeight: '600' }}>Toplam Alacak: ₺{totalAlacak.toLocaleString()}</span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '2px solid var(--border-color)' }}>
            {['Cari Hesap', 'Tip', 'Toplam Borç', 'Toplam Alacak', 'Net Bakiye', 'Durum'].map(h => (
              <th key={h} style={{ padding: '0.8rem 1rem', textAlign: 'left', fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {partyBalances.sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ fontWeight: '600' }}>{p.name}</div>
                  {p.phone && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.phone}</div>}
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <span className={p.type === 'Customer' ? 'badge badge-primary' : 'badge badge-gold'}>{p.type === 'Customer' ? 'MÜŞTERİ' : 'TEDARİKÇİ'}</span>
                </td>
                <td style={{ padding: '0.75rem 1rem', color: 'var(--danger-color)', fontWeight: '600' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><ArrowDownLeft size={14} /> ₺{p.borc.toLocaleString()}</span>
                </td>
                <td style={{ padding: '0.75rem 1rem', color: 'var(--success-color)', fontWeight: '600' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><ArrowUpRight size={14} /> ₺{p.alacak.toLocaleString()}</span>
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: '800', color: p.net >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                    {p.net >= 0 ? '+' : ''}₺{p.net.toLocaleString()}
                  </span>
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  {p.net > 0 && <span className="badge badge-success">ALACAKLI</span>}
                  {p.net < 0 && <span className="badge badge-danger">BORÇLU</span>}
                  {p.net === 0 && <span className="badge badge-primary">SIFIR</span>}
                </td>
              </tr>
            ))}
            {partyBalances.length === 0 && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Henüz cari hareket bulunamadı</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

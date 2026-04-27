import { useState, useEffect } from 'react';
import { Plus, Search, User, Briefcase, Phone, Mail, MapPin, Calculator, CreditCard, ArrowUpRight, ArrowDownLeft, FileText, Trash2, X, Save, Download, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import Papa from 'papaparse';

export default function Accounts({ isEmbedded = false }) {
  const { isAdmin } = useAuth();
  const [parties, setParties] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [incomeExpenses, setIncomeExpenses] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [stockDocs, setStockDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [settings, setSettings] = useState({ name: 'InventX İşletmesi' });
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState(null);
  
  const [formData, setFormData] = useState({ name: '', type: 'Supplier', tax_id: '', tax_office: '', address: '', phone: '', email: '' });
  const [txData, setTxData] = useState({ party_id: '', amount: 0, type: 'Payment', method: 'Cash', description: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Şirket ayarlarını çek
    const { data: stgs } = await supabase.from('app_settings').select('*');
    if (stgs) {
       const mapped = {};
       stgs.forEach(s => mapped[s.key] = s.value);
       setSettings(prev => ({ ...prev, ...mapped }));
    }

    const { data: p } = await supabase.from('parties').select('*').order('name');
    const { data: t } = await supabase.from('financial_transactions').select('*, parties(name)').order('created_at', { ascending: false });
    const { data: ie } = await supabase.from('income_expenses').select('*');
    const { data: v } = await supabase.from('expense_vouchers').select('*').eq('status', 'approved');
    const { data: sd } = await supabase.from('stock_documents').select('*');
    if (p) setParties(p);
    if (t) setTransactions(t);
    if (ie) setIncomeExpenses(ie);
    if (v) setVouchers(v);
    if (sd) setStockDocs(sd);
    setLoading(false);
  };

  const handleAddParty = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('parties').insert([formData]);
    if (error) alert("Hata: " + error.message);
    else {
      setIsAddModalOpen(false);
      setFormData({ name: '', type: 'Supplier', tax_id: '', tax_office: '', address: '', phone: '', email: '' });
      await fetchData();
    }
    setLoading(false);
  };

  const handleAddTx = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('financial_transactions').insert([txData]);
    if (error) alert("Hata: " + error.message);
    else {
      setIsTxModalOpen(false);
      await fetchData();
    }
    setLoading(false);
  };

  const getPartyBalance = (partyId) => {
    const ptTxs = transactions.filter(t => t.party_id === partyId);
    const ptIE = incomeExpenses.filter(r => r.party_id === partyId);
    const ptV = vouchers.filter(v => v.party_id === partyId);
    let balance = 0;
    ptTxs.forEach(t => {
      // Ödeme (Bizim ödememiz) ve Satış (Alacağımız) bakiyeyi artıya çeker (alacağımız artar veya borcumuz azalır)
      if (t.type === 'Payment' || t.type === 'Sale_Credit') balance += Number(t.amount);
      // Tahsilat (Onların ödemesi), Alım Borcu ve Ortak Ödemesi bakiyeyi eksiye çeker (alacağımız azalır veya borcumuz artar)
      if (t.type === 'Collection' || t.type === 'Purchase_Debt' || t.type === 'Partner_Payment') balance -= Number(t.amount);
    });
    ptIE.forEach(r => {
      // Gelir Carinin bize borcunu artırır (+) [Satış gibi], Gider bizim cariye borcumuzu artırır (-) [Alım gibi]
      // Not: Eğer ödeme yöntemi 'Ortak Cebinden' (Partner_Paid) ise bakiye etkilenir. 
      // Eğer normal Nakit ise, hem gelir hem ödeme aynı anda olduğu için net etki 0 olmalı.
      // Ancak kullanıcı 'Cariye işlensin' istiyorsa bunu Borç/Alacak hareketi olarak görmeliyiz.
      if (r.type === 'income') balance += Number(r.amount);
      if (r.type === 'expense') balance -= Number(r.amount);
    });
    ptV.forEach(v => {
      balance -= Number(v.grand_total);
    });
    return balance;
  };

  const handleExportExcel = (party) => {
    const ptTxs = transactions.filter(t => t.party_id === party.id).map(t => ({ ...t, source: 'tx' }));
    const ptIE  = incomeExpenses.filter(r => r.party_id === party.id).map(r => ({ ...r, source: 'ie' }));
    const ptV   = vouchers.filter(v => v.party_id === party.id).map(v => ({ ...v, source: 'v' }));

    const merged = [...ptTxs, ...ptIE, ...ptV].sort((a, b) => {
        const dateA = new Date(a.created_at || a.transaction_date || a.voucher_date);
        const dateB = new Date(b.created_at || b.transaction_date || b.voucher_date);
        return dateA - dateB;
    });

    let runningBalance = 0;
    const exportData = merged.map(t => {
      const isIE = t.source === 'ie';
      const isV  = t.source === 'v';
      
      const isDebt   = isIE ? t.type === 'expense' : (isV ? true : (t.type === 'Purchase_Debt' || t.type === 'Sale_Credit' || t.type === 'Partner_Payment'));
      const isCredit = isIE ? t.type === 'income'  : (isV ? false : (t.type === 'Payment' || t.type === 'Collection'));
      
      const amount = isV ? t.grand_total : t.amount;
      const borc   = isDebt   ? amount : 0;
      const alacak = isCredit ? amount : 0;
      
      // Bakiye mantığı: Alacaklar bakiyeyi artırır, Borçlar (ödemelerimiz/alımlarımız) bakiyeyi azaltır (Cari perspektifinden)
      // Aslında sistemde bakiye = Alacak - Borç (Veya tam tersi)
      // getPartyBalance daki mantığa sadık kalalım:
      // Payment/Sale_Credit (+) , Collection/Purchase_Debt/Partner_Payment/Expense/Voucher (-)
      runningBalance += alacak - borc;

      const typeLabel = isIE ? (t.type === 'income' ? 'Gelir Kaydı' : 'Gider Kaydı') : (isV ? `Gider Fişi (${t.voucher_no})` : (t.type === 'Payment' ? 'Ödeme' : t.type === 'Collection' ? 'Tahsilat' : t.type === 'Purchase_Debt' ? 'Alım Borcu' : t.type === 'Partner_Payment' ? 'Ortak Ödemesi' : 'Satış Alacağı'));
      const methodLabel = t.payment_method || t.method || 'Nakit';
      const date = isIE ? t.transaction_date : (isV ? t.voucher_date : t.created_at);

      // İrsaliye ve Fatura No bulma
      let irsaliyeNo = '-';
      let faturaNo = '-';

      if (isIE) {
        faturaNo = t.reference_no || '-';
      } else if (isV) {
        faturaNo = t.voucher_no || '-';
      } else if (t.source === 'tx') {
        // Açıklamadan belge no ayıklamaya çalış (Örn: "... No: AL-123")
        const docMatch = t.description?.match(/No:\s*([^\s,]+)/);
        if (docMatch) {
            const docNo = docMatch[1];
            const sd = stockDocs.find(d => d.document_no === docNo);
            if (sd) {
                irsaliyeNo = sd.document_no || '-';
                faturaNo = sd.invoice_no || '-';
            } else {
                irsaliyeNo = docNo;
            }
        }
      }

      return {
        'Tarih':        format(new Date(date), 'dd.MM.yyyy HH:mm'),
        'İşlem Tipi':   typeLabel,
        'İrsaliye No':  irsaliyeNo,
        'Fatura No':    faturaNo,
        'Ödeme Yöntemi':methodLabel,
        'Açıklama':     t.description || t.notes || '-',
        'Borç (₺)':     borc > 0 ? borc.toFixed(2) : '',
        'Alacak (₺)':   alacak > 0 ? alacak.toFixed(2) : '',
        'Bakiye (₺)':   runningBalance.toFixed(2),
      };
    });

    const BOM = '\uFEFF';
    const csv = BOM + Papa.unparse(exportData, { delimiter: ';' });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${party.name}_Cari_Ekstre_${format(new Date(), 'dd-MM-yyyy')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintStatement = (party) => {
    const ptTxs = transactions.filter(t => t.party_id === party.id);
    const balance = getPartyBalance(party.id);
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Hesap Ekstresi - ${party.name}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; max-width: 900px; margin: auto; }
            .header { display: flex; justify-content: space-between; border-bottom: 3px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; }
            .company-info h1 { margin: 0; color: #6366f1; font-size: 28px; }
            .company-details { font-size: 12px; color: #64748b; margin-top: 5px; }
            .statement-info { text-align: right; }
            .party-card { background: #f8fafc; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 30px; display: flex; justify-content: space-between; }
            .party-details p { margin: 4px 0; font-size: 14px; }
            .balance-box { text-align: right; }
            .balance-box h2 { margin: 0; color: ${balance < 0 ? '#ef4444' : '#10b981'}; font-size: 32px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { text-align: left; padding: 12px; background: #f1f5f9; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; color: #64748b; }
            td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
            .footer { margin-top: 60px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px dashed #e2e8f0; padding-top: 20px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body onload="window.print(); window.onafterprint = function(){ window.close(); }">
          <div class="header">
            <div class="company-info">
              <h1>${settings.name}</h1>
              <div class="company-details">
                <p>${settings.address || 'Profesyonel Envanter Yönetimi'}</p>
                <p>Tel: ${settings.phone || '-'} | VD: ${settings.tax_office || '-'} | No: ${settings.tax_id || '-'}</p>
              </div>
            </div>
            <div class="statement-info">
              <h2 style="margin:0; color: #cbd5e1;">HESAP EKSTRESİ</h2>
              <p style="margin:5px 0; font-size: 12px;"><b>Düzenleme:</b> ${format(new Date(), 'dd.MM.yyyy HH:mm')}</p>
            </div>
          </div>
          
          <div class="party-card">
            <div class="party-details">
              <h3 style="margin:0 0 10px 0;">${party.name}</h3>
              <p><b>Vergi No:</b> ${party.tax_id || '-'}</p>
              <p><b>Adres:</b> ${party.address || '-'}</p>
              <p><b>Telefon:</b> ${party.phone || '-'}</p>
            </div>
            <div class="balance-box">
              <p style="margin:0; font-size: 12px; color: #64748b;">GÜNCEL BAKİYE</p>
              <h2>₺${balance.toLocaleString()}</h2>
              <p style="font-size: 11px; margin-top: 5px;">${balance < 0 ? 'BORÇLU DURUMDA' : balance > 0 ? 'ALACAKLI DURUMDA' : 'BAKİYE SIFIR'}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>İşlem Detayı</th>
                <th>Açıklama</th>
                <th>Yöntem</th>
                <th style="text-align: right">Tutar (₺)</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                const merged = [
                  ...transactions.filter(t => t.party_id === party.id).map(t => ({ ...t, source: 'tx' })),
                  ...incomeExpenses.filter(r => r.party_id === party.id).map(r => ({ ...r, source: 'ie' })),
                  ...vouchers.filter(v => v.party_id === party.id).map(v => ({ ...v, source: 'v' }))
                ].sort((a, b) => new Date(a.created_at || a.transaction_date || a.voucher_date) - new Date(b.created_at || b.transaction_date || b.voucher_date));

                return merged.map(t => {
                  const isIE = t.source === 'ie';
                  const isV = t.source === 'v';
                  const date = isIE ? t.transaction_date : (isV ? t.voucher_date : t.created_at);
                  const typeLabel = isIE ? (t.type === 'income' ? 'Gelir (Finans)' : 'Gider (Finans)') : (isV ? `Gider Fişi (${t.voucher_no})` : (t.type === 'Payment' ? 'Ödeme' : t.type === 'Collection' ? 'Tahsilat' : t.type === 'Purchase_Debt' ? 'Alım Borcu' : t.type === 'Partner_Payment' ? 'Ortak Ödemesi' : 'Satış Alacağı'));
                  const amount = isV ? t.grand_total : t.amount;
                  return `
                    <tr>
                      <td>${format(new Date(date), 'dd.MM.yyyy')}</td>
                      <td>${typeLabel}</td>
                      <td>${t.description || t.notes || '-'}</td>
                      <td>${t.payment_method || t.method || 'Nakit'}</td>
                      <td style="text-align: right; font-weight: bold;">₺${Number(amount).toLocaleString()}</td>
                    </tr>
                  `;
                }).join('');
              })()}
            </tbody>
          </table>

          <div class="footer">
            <p>Bu ekstre InventX Pro ERP tarafından oluşturulmuştur. Bilgilerin doğruluğunu kontrol ediniz.</p>
            <p>© 2026 ${settings.name} - Tüm Hakları Saklıdır.</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredParties = parties.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Cari Takip & Finans</h2>
          <p style={{ color: 'var(--text-muted)' }}>Müşteri ve tedarikçi bakiyelerini, mali hareketlerini yönetin.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary border-none" onClick={() => setIsTxModalOpen(true)}><Calculator size={18} /> Yeni İşlem Kaydı</button>
          <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}><Plus size={18} /> Yeni Cari Kart</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) 2fr', gap: '2rem' }}>
        
        {/* CARİ LİSTESİ */}
        <div className="card" style={{ padding: '0' }}>
           <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', background: 'var(--surface-hover)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)' }}>
                 <Search size={18} color="var(--text-muted)" />
                 <input type="text" style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none' }} placeholder="Cari ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
           </div>
           <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {filteredParties.map(p => {
                const bal = getPartyBalance(p.id);
                return (
                  <div key={p.id} onClick={() => setSelectedParty(p)} style={{ 
                    padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', 
                    cursor: 'pointer', transition: 'all 0.2s',
                    background: selectedParty?.id === p.id ? 'var(--primary-light)' : 'transparent',
                    borderLeft: selectedParty?.id === p.id ? '4px solid var(--primary-color)' : '4px solid transparent'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                       <span style={{ fontWeight: '700', fontSize: '1rem' }}>{p.name}</span>
                       <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'var(--surface-hover)', fontWeight: '600' }}>{p.type === 'Supplier' ? 'Tedarikçi' : 'Müşteri'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.tax_id || 'Vergi No Yok'}</span>
                       <span style={{ fontWeight: '800', color: bal < 0 ? 'var(--danger-color)' : bal > 0 ? 'var(--success-color)' : 'inherit' }}>
                          {bal.toLocaleString()} $
                       </span>
                    </div>
                  </div>
                );
              })}
           </div>
        </div>

        {/* CARİ DETAY & EKSTRE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
           {selectedParty ? (
             <>
               <div className="card glass-panel animate-fade-in" style={{ padding: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                     <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                        <div>
                           <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.25rem' }}>{selectedParty.name}</h3>
                           <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{selectedParty.type === 'Supplier' ? 'Tedarikçi Kartı' : 'Müşteri Kartı'}</p>
                        </div>
                        {isAdmin && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ color: 'var(--danger-color)', padding: '0.5rem', borderRadius: '8px' }}
                            title="Cariyi Sil"
                            onClick={async () => {
                               if(confirm('Bu cari hesabı silmek istediğinize emin misiniz?')) {
                                  const { error } = await supabase.from('parties').delete().eq('id', selectedParty.id);
                                  if(!error) { setSelectedParty(null); fetchData(); }
                                  else alert("Hata: " + error.message);
                               }
                            }}
                          >
                             <Trash2 size={18} />
                          </button>
                        )}
                     </div>
                      <div style={{ textAlign: 'right' }}>
                         <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Güncel Bakiye</p>
                         <h3 style={{ fontSize: '2rem', fontWeight: '900', color: getPartyBalance(selectedParty.id) < 0 ? 'var(--danger-color)' : 'var(--success-color)' }}>
                            {getPartyBalance(selectedParty.id).toLocaleString()} $
                         </h3>
                         <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }} onClick={() => handleExportExcel(selectedParty)}>
                               <Download size={14} /> Excel
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }} onClick={() => handlePrintStatement(selectedParty)}>
                               <Printer size={14} /> PDF Ekstre
                            </button>
                         </div>
                      </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginTop: '2rem' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)' }}><Phone size={16} /></div>
                        <div><p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Telefon</p><p style={{ fontWeight: '600', fontSize: '0.85rem' }}>{selectedParty.phone || '-'}</p></div>
                     </div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)' }}><Mail size={16} /></div>
                        <div><p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>E-Posta</p><p style={{ fontWeight: '600', fontSize: '0.85rem' }}>{selectedParty.email || '-'}</p></div>
                     </div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)' }}><MapPin size={16} /></div>
                        <div><p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Vergi Dairesi</p><p style={{ fontWeight: '600', fontSize: '0.85rem' }}>{selectedParty.tax_office || '-'}</p></div>
                     </div>
                  </div>
               </div>

               <div className="card animate-fade-in" style={{ flex: 1 }}>
                  <h4 style={{ marginBottom: '1.5rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     <FileText size={18} color="var(--primary-color)" /> Cari Ekstre / Hareketler
                  </h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                       <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          <th style={{ padding: '0.75rem' }}>Tarih</th>
                          <th style={{ padding: '0.75rem' }}>İşlem</th>
                          <th style={{ padding: '0.75rem' }}>Yöntem</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right' }}>Tutar</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center' }}>İşlem</th>
                       </tr>
                    </thead>
                    <tbody>
                        {(() => {
                          const merged = [
                            ...transactions.filter(t => t.party_id === selectedParty.id).map(t => ({ ...t, source: 'tx' })),
                            ...incomeExpenses.filter(r => r.party_id === selectedParty.id).map(r => ({ ...r, source: 'ie' })),
                            ...vouchers.filter(v => v.party_id === selectedParty.id).map(v => ({ ...v, source: 'v' }))
                          ].sort((a, b) => new Date(a.created_at || a.transaction_date || a.voucher_date) - new Date(b.created_at || b.transaction_date || b.voucher_date));

                          return merged.map(tx => {
                            const isIE = tx.source === 'ie';
                            const isV = tx.source === 'v';
                            const date = isIE ? tx.transaction_date : (isV ? tx.voucher_date : tx.created_at);
                            const isOut = isIE ? tx.type === 'expense' : (isV ? true : (tx.type === 'Payment' || tx.type === 'Purchase_Debt' || tx.type === 'Partner_Payment'));
                            const typeLabel = isIE ? (tx.type === 'income' ? 'Finans Gelir' : 'Finans Gider') : (isV ? `Gider Fişi (${tx.voucher_no})` : (tx.type === 'Payment' ? 'Ödeme' : tx.type === 'Collection' ? 'Tahsilat' : tx.type === 'Purchase_Debt' ? 'Alım Borcu' : tx.type === 'Partner_Payment' ? 'Ortak Ödemesi' : 'Satış Alacağı'));
                            const amount = isV ? tx.grand_total : tx.amount;
                            
                            return (
                              <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                                 <td style={{ padding: '1rem 0.75rem' }}>{format(new Date(date), 'dd.MM.yyyy HH:mm')}</td>
                                 <td style={{ padding: '1rem 0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                       {isOut ? <ArrowUpRight size={14} color="var(--danger-color)" /> : <ArrowDownLeft size={14} color="var(--success-color)" />}
                                       {typeLabel}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tx.description || tx.notes}</div>
                                 </td>
                                 <td style={{ padding: '1rem 0.75rem' }}>{tx.payment_method || tx.method || 'Nakit'}</td>
                                 <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>
                                    ₺{Number(amount).toLocaleString()}
                                 </td>
                                 <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                                    <button 
                                        className="btn btn-secondary p-1" 
                                        style={{ color: 'var(--danger-color)' }}
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if(confirm('Bu hareketi silmek istediğinize emin misiniz?')) {
                                                const tableMap = { tx: 'financial_transactions', ie: 'income_expenses', v: 'expense_vouchers' };
                                                const { error } = await supabase.from(tableMap[tx.source]).delete().eq('id', tx.id);
                                                if(error) alert('Hata: '+error.message);
                                                else fetchData();
                                            }
                                        }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                 </td>
                              </tr>
                            );
                          });
                        })()}
                     </tbody>
                  </table>
               </div>
             </>
           ) : (
             <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '1rem' }}>
                <div style={{ padding: '2rem', background: 'var(--surface-hover)', borderRadius: '50%' }}>
                   <Briefcase size={48} opacity={0.3} />
                </div>
                <p>Detayları görmek için soldan bir cari seçin.</p>
             </div>
           )}
        </div>

      </div>

      {/* NEW PARTY MODAL */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade-in" style={{ width: '500px', padding: '2.5rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ fontWeight: '700' }}>Yeni Cari Kart Oluştur</h3>
                <button className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}><X size={20}/></button>
             </div>
             <form onSubmit={handleAddParty} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="input-group"><label>Ünvan / İsim</label><input type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="Örn: ABC Teknoloji Ltd. Şti." /></div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                   <div style={{ flex: 1 }} className="input-group"><label>Cari Tipi</label><select className="input-field" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}><option value="Supplier">Tedarikçi</option><option value="Customer">Müşteri</option></select></div>
                   <div style={{ flex: 1 }} className="input-group"><label>Vergi No</label><input type="text" className="input-field" value={formData.tax_id} onChange={e => setFormData({...formData, tax_id: e.target.value})} /></div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                   <div style={{ flex: 1 }} className="input-group"><label>Vergi Dairesi</label><input type="text" className="input-field" value={formData.tax_office} onChange={e => setFormData({...formData, tax_office: e.target.value})} /></div>
                   <div style={{ flex: 1 }} className="input-group"><label>Telefon</label><input type="text" className="input-field" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                </div>
                <div className="input-group"><label>Adres</label><textarea className="input-field" style={{ minHeight: '80px', resize: 'vertical' }} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={loading}><Save size={18} /> Cari Kartı Kaydet</button>
             </form>
          </div>
        </div>
      )}

      {/* NEW TRANSACTION MODAL */}
      {isTxModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade-in" style={{ width: '450px', padding: '2.5rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ fontWeight: '700' }}>Yeni Finansal İşlem</h3>
                <button className="btn btn-secondary" onClick={() => setIsTxModalOpen(false)}><X size={20}/></button>
             </div>
             <form onSubmit={handleAddTx} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="input-group">
                   <label>Cari Kart Seçin</label>
                   <select className="input-field" value={txData.party_id} onChange={e => setTxData({...txData, party_id: e.target.value})} required>
                      <option value="">Seçiniz...</option>
                      {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                   </select>
                </div>
                <div className="input-group"><label>Tutar (₺)</label><input type="number" step="0.01" className="input-field" value={txData.amount} onChange={e => setTxData({...txData, amount: parseFloat(e.target.value) || 0})} required /></div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                   <div style={{ flex: 1 }} className="input-group"><label>İşlem Tipi</label><select className="input-field" value={txData.type} onChange={e => setTxData({...txData, type: e.target.value})}><option value="Payment">Ödeme</option><option value="Collection">Tahsilat</option></select></div>
                   <div style={{ flex: 1 }} className="input-group"><label>Yöntem</label><select className="input-field" value={txData.method} onChange={e => setTxData({...txData, method: e.target.value})}><option value="Cash">Nakit</option><option value="Bank">Havale</option><option value="Credit_Card">Kredi Kartı</option></select></div>
                </div>
                <div className="input-group"><label>Açıklama</label><input type="text" className="input-field" value={txData.description} onChange={e => setTxData({...txData, description: e.target.value})} /></div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={loading}><Save size={18} /> İşlemi Onayla</button>
             </form>
          </div>
        </div>
      )}

    </div>
  );
}

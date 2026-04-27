import { useState, useEffect } from 'react';
import { DollarSign, Receipt, Wallet, Loader, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import IncomeExpenseTab from './finance/IncomeExpenseTab';
import ExpenseVoucherTab from './finance/ExpenseVoucherTab';
import CashBookTab from './finance/CashBookTab';
import PartnerPaymentsTab from './finance/PartnerPaymentsTab';
import Accounts from './Accounts';

const DEFAULT_TAX_RATES = [
  { id: 'def-0', name: 'KDV %0 (Muaf)', rate: 0 },
  { id: 'def-1', name: 'KDV %1', rate: 1 },
  { id: 'def-10', name: 'KDV %10', rate: 10 },
  { id: 'def-20', name: 'KDV %20', rate: 20 },
];

const TABS = [
  { id: 'income-expense', label: 'Gelir / Gider', icon: <DollarSign size={18} /> },
  { id: 'vouchers', label: 'Gider Fişleri', icon: <Receipt size={18} /> },
  { id: 'cashbook', label: 'Aktif Kasa & Bakiye', icon: <Wallet size={18} /> },
  { id: 'partners', label: 'Ortak Ödemeleri', icon: <Users size={18} /> },
  { id: 'accounts', label: 'Cari Hesaplar', icon: <Users size={18} /> },
];

// Tabloyu güvenli şekilde sorgula — yoksa boş dizi döndür
async function safeSelect(table, orderCol, asc = false) {
  try {
    const { data, error } = await supabase.from(table).select('*').order(orderCol, { ascending: asc });
    if (error) { 
      console.warn(`[${table}]:`, error.message); 
      return []; // Hata durumunda boş dizi dön, sistem çökmesin
    }
    return data || [];
  } catch (err) { 
    console.error(`[${table}] critical select error:`, err);
    return []; 
  }
}

export default function Finance() {
  const [activeTab, setActiveTab] = useState('income-expense');
  const [loading, setLoading] = useState(true);
  const [tablesReady, setTablesReady] = useState(true);
  const [records, setRecords] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [taxRates, setTaxRates] = useState(DEFAULT_TAX_RATES);
  const [parties, setParties] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [stockEntries, setStockEntries] = useState([]);
  const [stockDocuments, setStockDocuments] = useState([]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [ie, ev, pt, ft, logs, sd] = await Promise.all([
      safeSelect('income_expenses', 'transaction_date'),
      safeSelect('expense_vouchers', 'voucher_date'),
      safeSelect('parties', 'name', true),
      safeSelect('financial_transactions', 'created_at'),
      safeSelect('audit_logs', 'created_at'),
      safeSelect('stock_documents', 'created_at', false)
    ]);

    // Tablo var mı kontrol
    if (ie === null && ev === null) {
      setTablesReady(false);
    } else {
      setTablesReady(true);
      setRecords(ie || []);
      setVouchers(ev || []);
    }

    setParties(pt || []);
    setTransactions(ft || []);
    setStockEntries((logs || []).filter(l => l.feature === 'Stok Yönetimi'));
    setStockDocuments((sd || []).filter(doc => doc.status === 'COMPLETED'));
    setLoading(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem', color: 'var(--text-muted)' }}>
        <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Finansal veriler yükleniyor...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!tablesReady) {
    const sql = `-- Supabase SQL Editor'de çalıştırın:
CREATE TABLE IF NOT EXISTS income_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  category TEXT NOT NULL, description TEXT,
  amount NUMERIC NOT NULL, tax_rate NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0, net_amount NUMERIC DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash', reference_no TEXT,
  party_id UUID, voucher_id UUID,
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE income_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON income_expenses FOR ALL USING (auth.role()='authenticated');

CREATE TABLE IF NOT EXISTS expense_vouchers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_no TEXT NOT NULL, supplier_name TEXT, party_id UUID,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','approved','cancelled')),
  items JSONB DEFAULT '[]', subtotal NUMERIC DEFAULT 0,
  total_tax NUMERIC DEFAULT 0, grand_total NUMERIC DEFAULT 0,
  notes TEXT, voucher_date DATE DEFAULT CURRENT_DATE,
  approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE expense_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON expense_vouchers FOR ALL USING (auth.role()='authenticated');`;

    return (
      <div style={{ maxWidth: '700px', margin: '2rem auto' }}>
        <div className="card" style={{ border: '2px solid var(--warning-color)', background: 'rgba(217,119,6,0.06)' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '2rem' }}>⚠️</div>
            <div>
              <h3 style={{ fontWeight: '700', color: 'var(--warning-color)', marginBottom: '0.5rem' }}>Veritabanı Tabloları Eksik</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Finans modülü için gerekli tablolar henüz oluşturulmamış. Aşağıdaki SQL'i
                <strong style={{ color: 'var(--text-main)' }}> Supabase Dashboard → SQL Editor</strong>'e kopyalayıp çalıştırın, ardından sayfayı yenileyin.
              </p>
            </div>
          </div>
          <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: '8px', fontSize: '0.75rem', overflowX: 'auto', color: '#a5f3fc', lineHeight: '1.6', whiteSpace: 'pre-wrap', border: '1px solid var(--border-color)' }}>{sql}</pre>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button className="btn btn-primary" onClick={() => { navigator.clipboard.writeText(sql); alert('SQL kopyalandı!'); }}>
              📋 SQL'i Kopyala
            </button>
            <button className="btn btn-secondary" onClick={fetchAll}>🔄 Tekrar Dene</button>
            <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              🔗 Supabase'e Git
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontWeight: '800', fontSize: '1.6rem', letterSpacing: '-0.5px' }}>💼 Finans Yönetimi</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Gelir, gider, vergi ve kasa takibinizi tek ekrandan yönetin</p>
      </div>

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '2rem', background: 'var(--surface-color)', padding: '0.35rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.88rem',
            fontWeight: activeTab === tab.id ? '700' : '500',
            background: activeTab === tab.id ? 'linear-gradient(135deg, var(--primary-color) 0%, #1045A8 100%)' : 'transparent',
            color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
            boxShadow: activeTab === tab.id ? 'var(--shadow-glow)' : 'none',
            transition: 'all 0.2s ease'
          }}>{tab.icon} {tab.label}</button>
        ))}
      </div>

      <div className="animate-fade-in" key={activeTab}>
        {(() => {
          const mappedStocks = stockDocuments.map(doc => {
            const isIncome = doc.document_type === 'OUT';
            const items = Array.isArray(doc.items) ? doc.items : [];
            const netAmount = items.reduce((sum, item) => sum + (Number(item.unit_price) * Number(item.quantity)), 0);
            const taxAmount = items.reduce((sum, item) => sum + (Number(item.unit_price) * Number(item.quantity) * (Number(item.tax_rate) || 0) / 100), 0);
            return {
              id: doc.id,
              type: isIncome ? 'income' : 'expense',
              category: isIncome ? 'Stok Satış' : 'Stok Alım',
              description: `Belge No: ${doc.document_no || '-'} - Cari: ${doc.parties?.name || 'Perakende'}`,
              amount: doc.total_amount,
              tax_rate: null,
              tax_amount: taxAmount,
              net_amount: netAmount,
              payment_method: 'Nakit (Stok Modülü)',
              transaction_date: doc.document_date || doc.created_at,
              party_id: doc.party_id,
              is_stock_doc: true
            };
          });

          const mappedPartnerPayments = transactions.filter(t => t.type === 'Partner_Payment').map(t => ({
            id: t.id,
            type: 'expense',
            category: 'Ortak Ödemesi',
            description: `${parties.find(p => p.id === t.party_id)?.name || 'Ortak'} - Kar Payı / Çekim`,
            amount: t.amount,
            tax_rate: 0,
            tax_amount: 0,
            net_amount: t.amount,
            payment_method: t.method === 'Cash' ? 'Nakit' : 'Banka',
            transaction_date: t.created_at,
            party_id: t.party_id,
            is_readonly: true
          }));

          const mappedVouchers = vouchers.filter(v => v.status === 'approved').map(v => ({
            id: v.id,
            type: 'expense',
            category: 'Gider Fişi',
            description: `Fiş No: ${v.voucher_no} - ${v.supplier_name || (parties.find(p=>p.id===v.party_id)?.name) || 'Gider'}`,
            amount: v.grand_total,
            tax_rate: null,
            tax_amount: v.total_tax,
            net_amount: v.subtotal,
            payment_method: 'Nakit (Fatura/Fiş)',
            transaction_date: v.voucher_date || v.created_at,
            party_id: v.party_id,
            is_readonly: true
          }));

          const unifiedRecords = [...records, ...mappedStocks, ...mappedPartnerPayments, ...mappedVouchers].sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));

          return (
            <>
              {activeTab === 'income-expense' && (
                <IncomeExpenseTab 
                  records={unifiedRecords} 
                  taxRates={taxRates} 
                  parties={parties} 
                  onRefresh={fetchAll} 
                />
              )}
              {activeTab === 'vouchers' && <ExpenseVoucherTab vouchers={vouchers} taxRates={taxRates} parties={parties} onRefresh={fetchAll} />}
              {activeTab === 'cashbook' && <CashBookTab incomeExpenses={unifiedRecords} transactions={transactions} parties={parties} stockDocuments={stockDocuments} />}
              {activeTab === 'partners' && <PartnerPaymentsTab parties={parties} transactions={transactions} incomeExpenses={records} onRefresh={fetchAll} />}
              {activeTab === 'accounts' && <div style={{marginTop: '-0.5rem'}}><Accounts isEmbedded={true} /></div>}
            </>
          );
        })()}
      </div>
    </div>
  );
}

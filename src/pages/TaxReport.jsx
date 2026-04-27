import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Download, Filter, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export default function TaxReport() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('stock_documents')
      .select('*')
      .gte('document_date', dateRange.start)
      .lte('document_date', dateRange.end)
      .eq('status', 'COMPLETED');
    
    if (data) setDocuments(data);
    setLoading(false);
  };

  const calculateTaxTotals = () => {
    let inputTax = 0; // Purchase KDV
    let outputTax = 0; // Sale KDV
    
    documents.forEach(doc => {
      let docTax = 0;
      doc.items?.forEach(item => {
        const itemTax = (Number(item.total_price) * (Number(item.tax_rate) || 20)) / 100;
        docTax += itemTax;
      });

      if (doc.document_type === 'IN') inputTax += docTax;
      else outputTax += docTax;
    });

    return { inputTax, outputTax, balance: outputTax - inputTax };
  };

  const totals = calculateTaxTotals();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>KDV Raporu</h2>
          <p style={{ color: 'var(--text-muted)' }}>Alım ve satımlardaki vergi yükünü takip edin.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
           <input type="date" className="input-field" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
           <input type="date" className="input-field" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--warning-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>İndirilecek KDV (Alımlar)</p>
              <h3 style={{ fontSize: '1.5rem', margin: '0.5rem 0' }}>₺{totals.inputTax.toLocaleString()}</h3>
            </div>
            <TrendingDown color="var(--warning-color)" />
          </div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--success-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Hesaplanan KDV (Satışlar)</p>
              <h3 style={{ fontSize: '1.5rem', margin: '0.5rem 0' }}>₺{totals.outputTax.toLocaleString()}</h3>
            </div>
            <TrendingUp color="var(--success-color)" />
          </div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Ödenecek / Devreden KDV</p>
              <h3 style={{ fontSize: '1.5rem', margin: '0.5rem 0' }}>₺{Math.abs(totals.balance).toLocaleString()}</h3>
              <span style={{ fontSize: '0.75rem', color: totals.balance >= 0 ? 'var(--danger-color)' : 'var(--success-color)' }}>
                {totals.balance >= 0 ? 'Ödenecek Vergi ↗' : 'Devreden KDV ↙'}
              </span>
            </div>
            <Scale color="var(--primary-color)" />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Tarih</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Belge No</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Tür</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>Matrah (Net)</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>KDV Tutarı</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>Genel Toplam</th>
            </tr>
          </thead>
          <tbody>
            {documents.map(doc => {
              const netTotal = doc.items?.reduce((sum, i) => sum + Number(i.total_price), 0) || 0;
              const taxTotal = doc.items?.reduce((sum, i) => sum + (Number(i.total_price) * (Number(i.tax_rate) || 20) / 100), 0) || 0;
              return (
                <tr key={doc.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem' }}>{format(new Date(doc.document_date), 'dd.MM.yyyy')}</td>
                  <td style={{ padding: '1rem', fontWeight: '600' }}>{doc.document_no}</td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`badge ${doc.document_type === 'IN' ? 'badge-warning' : 'badge-success'}`}>
                      {doc.document_type === 'IN' ? 'Alım' : 'Satış'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>₺{netTotal.toLocaleString()}</td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700' }}>₺{taxTotal.toLocaleString()}</td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>₺{(netTotal + taxTotal).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Search, FileText, ArrowRightLeft, Package, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

export default function DocumentReport() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    
    setLoading(true);
    setSearched(true);
    
    try {
      // Sadece stok giriş ve çıkışlarının finansal hareketlerini çek
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*, parties(name)')
        .ilike('description', `%${searchTerm.trim()}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Verileri parse et
      const parsedData = (data || []).map(tx => {
        const desc = tx.description || '';
        // Format: "Ürün Adı - 5 Adet Satış | İrs:123 | Fat:456"
        // Veya "Ürün Adı - 1 Koli x 5 Adet = 5 Adet Giriş | İrs:123 | Fat:456"
        
        let productName = 'Bilinmeyen Ürün';
        let qty = 1;
        let isEntry = desc.includes('Giriş');
        let isExit = desc.includes('Satış') || desc.includes('Çıkış');

        const match = desc.match(/^(.*?)\s*-\s*.*?(\d+)\s*Adet\s*(Satış|Giriş|Çıkış)/i);
        if (match) {
          productName = match[1].trim();
          qty = parseInt(match[2], 10) || 1;
        } else {
          // Fallback parsing if structure is different
          const parts = desc.split('-');
          if (parts.length > 0) productName = parts[0].trim();
        }

        const unitPrice = tx.amount / qty;

        // İrsaliye ve Fatura numaralarını yakala
        const irsMatch = desc.match(/İrs(?:aliye)?:?\s*([^\s|]+)/i);
        const fatMatch = desc.match(/Fat(?:ura)?:?\s*([^\s|]+)/i);

        return {
          ...tx,
          productName,
          qty,
          unitPrice,
          isEntry,
          isExit,
          irsaliye: irsMatch ? irsMatch[1] : '-',
          fatura: fatMatch ? fatMatch[1] : '-'
        };
      });

      setResults(parsedData);
    } catch (err) {
      alert("Arama hatası: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalQtyIn = results.filter(r => r.isEntry).reduce((s, r) => s + r.qty, 0);
  const totalAmountIn = results.filter(r => r.isEntry).reduce((s, r) => s + Number(r.amount), 0);
  
  const totalQtyOut = results.filter(r => r.isExit).reduce((s, r) => s + r.qty, 0);
  const totalAmountOut = results.filter(r => r.isExit).reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Belge Raporu (İrsaliye & Fatura)</h2>
          <p style={{ color: 'var(--text-muted)' }}>Belge numarasına göre stok hareketlerini ve finansal detayları arayın.</p>
        </div>
      </div>

      <div className="card glass-panel">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <FileText size={20} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              className="input-field" 
              style={{ paddingLeft: '3rem', fontSize: '1.1rem' }} 
              placeholder="İrsaliye No veya Fatura No girin..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.8rem 2rem' }} disabled={loading || !searchTerm.trim()}>
            {loading ? 'Aranıyor...' : <><Search size={18} /> Sorgula</>}
          </button>
        </form>
      </div>

      {searched && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
            <div className="card" style={{ borderTop: '3px solid var(--warning-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.8rem', background: 'var(--warning-light)', color: 'var(--warning-color)', borderRadius: '12px' }}><Package size={24} /></div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Giriş Yapılan Ürünler (Alım)</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Bu belge ile stoka girenler</p>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1rem' }}>
                <div><p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Toplam Miktar</p><p style={{ fontSize: '1.4rem', fontWeight: '800' }}>{totalQtyIn} Adet</p></div>
                <div style={{ textAlign: 'right' }}><p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Toplam Alış Tutarı</p><p style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--warning-color)' }}>₺{totalAmountIn.toLocaleString()}</p></div>
              </div>
            </div>

            <div className="card" style={{ borderTop: '3px solid var(--success-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.8rem', background: 'var(--success-light)', color: 'var(--success-color)', borderRadius: '12px' }}><ArrowRightLeft size={24} /></div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Çıkış Yapılan Ürünler (Satış)</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Bu belge ile stoktan çıkanlar</p>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1rem' }}>
                <div><p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Toplam Miktar</p><p style={{ fontSize: '1.4rem', fontWeight: '800' }}>{totalQtyOut} Adet</p></div>
                <div style={{ textAlign: 'right' }}><p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Toplam Satış Tutarı</p><p style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--success-color)' }}>₺{totalAmountOut.toLocaleString()}</p></div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  <th style={{ padding: '1.2rem 1rem' }}>Tarih</th>
                  <th style={{ padding: '1.2rem 1rem' }}>İşlem / Cari</th>
                  <th style={{ padding: '1.2rem 1rem' }}>Ürün Adı</th>
                  <th style={{ padding: '1.2rem 1rem', textAlign: 'center' }}>Miktar</th>
                  <th style={{ padding: '1.2rem 1rem', textAlign: 'right' }}>Birim Fiyat</th>
                  <th style={{ padding: '1.2rem 1rem', textAlign: 'right' }}>Toplam Tutar</th>
                  <th style={{ padding: '1.2rem 1rem', textAlign: 'center' }}>Belge No</th>
                </tr>
              </thead>
              <tbody>
                {results.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{format(new Date(row.created_at), 'dd.MM.yyyy HH:mm')}</td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`badge ${row.isEntry ? 'badge-warning' : 'badge-success'}`} style={{ marginBottom: '0.3rem', display: 'inline-block' }}>
                        {row.isEntry ? 'GİRİŞ (ALIM)' : 'ÇIKIŞ (SATIŞ)'}
                      </span>
                      <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{row.parties?.name || 'Bilinmiyor'}</div>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: '600', color: 'var(--text-main)' }}>{row.productName}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', fontSize: '1.1rem', fontWeight: '800' }}>{row.qty}</td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>₺{row.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', color: row.isEntry ? 'var(--warning-color)' : 'var(--success-color)' }}>₺{Number(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>İrs: <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>{row.irsaliye}</span></div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fat: <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>{row.fatura}</span></div>
                    </td>
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <FileText size={48} opacity={0.2} style={{ marginBottom: '1rem' }} />
                      <p>Bu belge numarasına ait herhangi bir stok hareketi bulunamadı.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

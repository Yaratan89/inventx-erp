import { useState, useEffect } from 'react';
import { FileText, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setLogs(data);
    }
    setLoading(false);
  };

  const getBadgeStyle = (action) => {
    switch (action) {
      case 'CREATE': return 'badge-success';
      case 'UPDATE': return 'badge-primary';
      case 'DELETE': return 'badge-danger';
      case 'TRANSFER': return 'badge-warning';
      default: return 'badge-primary';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Denetim İzi (Audit Logs)</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Sistemdeki tüm kritik operasyonların canlı tarihçesi.</p>
        </div>
      </div>

      <div className="card">
         <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--surface-hover)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Tarih / Saat</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Aksiyon</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Modül</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>İrsaliye No</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Fatura No</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Detay</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Kullanıcı</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center' }}>Loglar çekiliyor...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Henüz hiçbir işlem kaydı yok.</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1.25rem 1rem', fontSize: '0.9rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                        <Clock size={16} />
                        {log.created_at ? format(new Date(log.created_at), 'dd MMM yyyy, HH:mm', { locale: tr }) : ''}
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1rem' }}>
                      <span className={`badge ${getBadgeStyle(log.action)}`}>{log.action}</span>
                    </td>
                    <td style={{ padding: '1.25rem 1rem', fontWeight: '500' }}>{log.feature}</td>
                    <td style={{ padding: '1.25rem 1rem', color: 'var(--text-muted)' }}>
                       {(() => {
                          const m = log.detail?.match(/İrs(?:aliye)?:?\s*([^\s|]+)/i);
                          return m ? m[1] : '-';
                       })()}
                    </td>
                    <td style={{ padding: '1.25rem 1rem', color: 'var(--text-muted)' }}>
                       {(() => {
                          const m = log.detail?.match(/Fat(?:ura)?:?\s*([^\s|]+)/i);
                          return m ? m[1] : '-';
                       })()}
                    </td>
                    <td style={{ padding: '1.25rem 1rem', fontSize: '0.9rem' }}>
                       {(log.detail || '').replace(/İrs(?:aliye)?:?\s*[^\s|]+/i, '').replace(/Fat(?:ura)?:?\s*[^\s|]+/i, '').trim()}
                    </td>
                    <td style={{ padding: '1.25rem 1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: '600' }}>{log.user_name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Role: {log.role}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

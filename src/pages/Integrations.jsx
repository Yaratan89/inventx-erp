import { useState } from 'react';
import { ShoppingBag, CreditCard, Link, CheckCircle2, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';

export default function Integrations() {
  const [integrations, setIntegrations] = useState([
    { id: 'shopify', name: 'Shopify', type: 'E-Ticaret', status: 'connected', desc: 'Siparişler ve stok seviyeleri anlık olarak senkronize edilir.', icon: <ShoppingBag /> },
    { id: 'woo', name: 'WooCommerce', type: 'E-Ticaret', status: 'disconnected', desc: 'WordPress mağazanızdaki stokları otomatik güncelleyin.', icon: <ShoppingBag /> },
    { id: 'sap', name: 'SAP S/4HANA', type: 'ERP / Muhasebe', status: 'disconnected', desc: 'Kurumsal kaynak planlama sistemi ile finansal entegrasyon.', icon: <Link /> },
    { id: 'qb', name: 'QuickBooks', type: 'Muhasebe', status: 'connected', desc: 'Faturalar ve ödemeler otomatik olarak muhasebeleştirilir.', icon: <CreditCard /> }
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}> Harici Entegrasyonlar</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>E-ticaret ve muhasebe sistemlerinizi tek bir noktadan yönetin.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {integrations.map((item) => (
          <div key={item.id} className="card glass-panel animate-fade-in" style={{ padding: '1.75rem', border: item.status === 'connected' ? '1px solid var(--success-light)' : '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
               <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ padding: '0.75rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)', color: 'var(--primary-color)' }}>
                     {item.icon}
                  </div>
                  <div>
                     <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{item.name}</h3>
                     <span style={{ fontSize: '0.75rem', background: 'var(--surface-hover)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--text-muted)' }}>{item.type}</span>
                  </div>
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: item.status === 'connected' ? 'var(--success-color)' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '600' }}>
                  {item.status === 'connected' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {item.status === 'connected' ? 'BAĞLI' : 'BAĞLI DEĞİL'}
               </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: '1.5' }}>
               {item.desc}
            </p>

            <div style={{ display: 'flex', gap: '1rem' }}>
               {item.status === 'connected' ? (
                 <>
                   <button className="btn btn-secondary" style={{ flex: 1, border: 'none', background: 'var(--surface-hover)', fontSize: '0.85rem' }}>
                      <RefreshCw size={14} /> Senkronize Et
                   </button>
                   <button className="btn btn-secondary" style={{ border: 'none', background: 'var(--danger-light)', color: 'var(--danger-color)', padding: '0.5rem' }}>
                      Bağlantıyı Kes
                   </button>
                 </>
               ) : (
                 <button className="btn btn-primary" style={{ width: '100%' }}>
                    <ExternalLink size={16} /> Hemen Bağla
                 </button>
               )}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ background: 'var(--surface-hover)', border: '1px dashed var(--border-color)', textAlign: 'center', padding: '3rem' }}>
         <h3 style={{ marginBottom: '0.5rem' }}>Özel Bir Sistem mi Kullanıyorsunuz?</h3>
         <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>API dokümantasyonumuzu kullanarak kendi ERP veya mağaza yazılımınızı InventX'e bağlayabilirsiniz.</p>
         <button className="btn btn-secondary">API Dokümanlarını Görüntüle</button>
      </div>
    </div>
  );
}

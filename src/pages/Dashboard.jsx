import { useState, useEffect } from 'react';
import { Package, AlertTriangle, TrendingUp, DollarSign, Brain, Clock, ArrowRight, Activity, Truck } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function Dashboard() {
  const [metrics, setMetrics] = useState({ totalProducts: 0, criticalOOS: 0, totalValue: 0, pendingShipments: 0 });
  const [criticalItems, setCriticalItems] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getAISummary = () => {
    if (loading) return "Veriler analiz ediliyor...";
    let text = `Şu an sistemde ${metrics.totalProducts} farklı ürün takip ediliyor. `;
    if (metrics.criticalOOS > 0) {
      text += `${metrics.criticalOOS} ürün kritik seviyenin altında, acil sipariş gerekebilir. `;
    } else {
      text += "Tüm stok seviyeleri güvenli aralıkta. ";
    }
    text += `Toplam envanter değeriniz ₺${metrics.totalValue.toLocaleString()}.`;
    return text;
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    const { data: products } = await supabase.from('products').select('*');
    const { data: inventory } = await supabase.from('inventory').select('*');
    const { data: logs } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(5);
    const { data: trfs } = await supabase.from('transfers').select('*, products(name)').not('tracking_number', 'is', null).order('created_at', { ascending: false }).limit(3);
    
    if (products && inventory) {
      const productStocks = products.map(p => {
        const totalStock = inventory.filter(inv => inv.product_id === p.id).reduce((sum, inv) => sum + inv.quantity, 0);
        return { ...p, totalStock };
      });

      setMetrics({
        totalProducts: products.length,
        criticalOOS: productStocks.filter(p => p.totalStock < 10).length,
        totalValue: productStocks.reduce((sum, p) => sum + (p.price * p.totalStock), 0),
        pendingShipments: trfs ? trfs.length : 0
      });
      setCriticalItems(productStocks.filter(p => p.totalStock < 10).slice(0, 4));
    }
    if (logs) setRecentLogs(logs);
    if (trfs) setPendingTransfers(trfs);
    setLoading(false);
  };

  const aiForecastData = [
    { name: 'Oca', t: 4000, p: 4100 }, { name: 'Şub', t: 3000, p: 3200 },
    { name: 'Mar', t: 4500, p: 4800 }, { name: 'Nis', t: 2780, p: 2900 },
    { name: 'May', t: 3200, p: 3500 }, { name: 'Haz', t: 3800, p: 4200 }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem', height: '100%' }}>
      
      {/* SOL TARAF: ANA PANEL */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* İstatistik Kartları */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {[
            { label: 'Toplam Ürün', val: metrics.totalProducts, icon: <Package />, color: 'var(--primary-color)', bg: 'var(--primary-light)' },
            { label: 'Kritik Stok', val: metrics.criticalOOS, icon: <AlertTriangle />, color: 'var(--danger-color)', bg: 'var(--danger-light)' },
            { label: 'Stok Değeri', val: `₺${metrics.totalValue.toLocaleString()}`, icon: <DollarSign />, color: 'var(--success-color)', bg: 'var(--success-light)' },
            { label: 'Yoldaki Sevkiyat', val: metrics.pendingShipments, icon: <Truck />, color: 'var(--warning-color)', bg: 'var(--warning-light)' }
          ].map((item, idx) => (
            <div key={idx} className="card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', transitionDelay: `${idx * 0.1}s` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.label}</p>
                 <div style={{ padding: '0.4rem', background: item.bg, color: item.color, borderRadius: 'var(--radius-sm)' }}>
                   {item.icon}
                 </div>
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '800' }}>{loading ? '...' : item.val}</h3>
            </div>
          ))}
        </div>

        {/* ... (AI Chart Omitted) ... */}

        {/* YOLDTAKİ SEVKİYATLAR LİSTESİ */}
        <div className="card animate-fade-in">
           <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Truck size={18} color="var(--warning-color)" /> Güncel Sevkiyatlar
           </h3>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pendingTransfers.length > 0 ? pendingTransfers.map(trf => (
                <div key={trf.id} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{trf.products?.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{trf.courier_name} / {trf.tracking_number}</div>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                      <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Yolda</span>
                   </div>
                </div>
              )) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Aktif sevkiyat bulunmuyor.</p>
              )}
           </div>
        </div>

        {/* AI Chart */}
        <div className="card glass-panel animate-fade-in" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}>
                <Brain size={22} color="var(--primary-color)" /> Yapay Zeka Özeti ve Tahminleme
              </h3>
              <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', marginTop: '0.5rem', fontWeight: '500', background: 'var(--primary-light)', padding: '0.75rem', borderRadius: '8px' }}>
                {getAISummary()}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
               <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-color)' }}></div> Gerçek</span>
               <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success-color)' }}></div> AI Tahmini</span>
            </div>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={aiForecastData}>
                <defs>
                  <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.3}/><stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 12}} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="p" stroke="var(--success-color)" fill="transparent" strokeWidth={3} strokeDasharray="5 5" />
                <Area type="monotone" dataKey="t" stroke="var(--primary-color)" fill="url(#colorPrimary)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Kritik Ürünler */}
        <div className="card animate-fade-in">
           <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: '600' }}>Hızlı Müdahale Gerektirenler</h3>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {criticalItems.length > 0 ? criticalItems.map(item => (
                <div key={item.id} style={{ padding: '1rem', background: 'rgba(255, 71, 87, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 71, 87, 0.1)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                   <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{item.name}</span>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>{item.totalStock} Adet</span>
                      <ArrowRight size={14} color="var(--danger-color)" />
                   </div>
                </div>
              )) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem' }}>Şu an kritik stok bulunmuyor.</p>
              )}
           </div>
        </div>

      </div>

      {/* SAĞ TARAF: AKTİVİTE AKIŞI */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
         <div className="card glass-panel" style={{ flex: 1, padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Activity size={18} color="var(--primary-color)" /> Son Aktiviteler
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
               {recentLogs.map(log => (
                 <div key={log.id} style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ minWidth: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                       <Clock size={18} />
                    </div>
                    <div>
                       <p style={{ fontSize: '0.85rem', fontWeight: '500', lineHeight: '1.4' }}>{log.detail}</p>
                       <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                          {format(new Date(log.created_at), 'HH:mm', { locale: tr })} • {log.user_name}
                       </span>
                    </div>
                 </div>
               ))}
               {recentLogs.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}> Henüz hareket yok.</p>}
            </div>
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: '2rem', fontSize: '0.8rem', border: 'none' }}>Tüm Geçmişi Gör</button>
         </div>

         <div className="card" style={{ background: 'var(--primary-color)', color: 'white' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Pro İpucu</h3>
            <p style={{ fontSize: '0.85rem', opacity: 0.9, lineHeight: '1.5' }}>
               Barkod okuma özelliğini mobil cihazınızdan kullanarak depoda ürün sayımını %80 daha hızlı yapabilirsiniz.
            </p>
         </div>
      </div>

    </div>
  );
}

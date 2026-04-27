import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Package, ShoppingCart, ArrowUpRight, ArrowDownLeft, Calendar, Shield, PieChart as PieIcon, BarChart3, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';

export default function Reports() {
  const [data, setData] = useState({
    dailySales: [],
    topProducts: [],
    warehouseValue: [],
    kpis: { totalRevenue: 0, totalProfit: 0, stockValue: 0, avgSale: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30); // son 30 gün

  useEffect(() => {
    fetchReportData();
  }, [timeRange]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const { data: txs } = await supabase.from('financial_transactions').select('*').order('created_at', { ascending: true });
      const { data: prds } = await supabase.from('products').select('*');
      const { data: inv } = await supabase.from('inventory').select('*');
      const { data: locs } = await supabase.from('locations').select('*');

      if (!txs || !prds || !inv || !locs) return;

      // 1. KPI & Satış Grafiği İşleme
      const startDate = startOfDay(subDays(new Date(), timeRange));
      const sales = txs.filter(t => (t.type === 'Collection' || t.type === 'Sale_Credit') && t.description?.includes('Satış'));
      
      let totalRev = 0;
      let totalCostsForSold = 0;
      const dailyMap = {};

      // Son X günü initialize et
      for (let i = 0; i < timeRange; i++) {
        const d = format(subDays(new Date(), i), 'dd MMM');
        dailyMap[d] = 0;
      }

      sales.forEach(s => {
        const date = new Date(s.created_at);
        totalRev += s.amount;
        
        if (date >= startDate) {
          const dayKey = format(date, 'dd MMM');
          if (dailyMap[dayKey] !== undefined) {
             dailyMap[dayKey] += s.amount;
          }
        }

        // Kâr hesaplama için maliyet çıkarma (Açıklamadan ürün ismini bulmaya çalışalım - basitleştirilmiş)
        // Not: Gerçek sistemde sales_items tablosu olmalı, burada maliyeti tahmini alıyoruz.
        const prdMatch = prds.find(p => s.description?.includes(p.name));
        if (prdMatch) {
           // Miktarı açıklamadan çekmeye çalışalım (Örn: "Ürün Adı - 5 Adet Satış")
           const qtyMatch = s.description.match(/(\d+)\s+Adet/);
           const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
           totalCostsForSold += (prdMatch.cost_price || 0) * qty;
        }
      });

      const dailySales = Object.entries(dailyMap).map(([name, amount]) => ({ name, amount })).reverse();

      // 2. Stok Değeri
      let totalStockValue = 0;
      const warehouseMap = {};
      locs.forEach(l => { warehouseMap[l.id] = { name: l.name, value: 0 }; });

      inv.forEach(item => {
        const prd = prds.find(p => p.id === item.product_id);
        const val = (prd?.cost_price || 0) * item.quantity;
        totalStockValue += val;
        if (warehouseMap[item.location_id]) {
          warehouseMap[item.location_id].value += val;
        }
      });

      // 3. Top Ürünler (Satış adedine göre)
      const prdSalesMap = {};
      sales.forEach(s => {
         const prdMatch = prds.find(p => s.description?.includes(p.name));
         if (prdMatch) {
            const qtyMatch = s.description.match(/(\d+)\s+Adet/);
            const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
            prdSalesMap[prdMatch.name] = (prdSalesMap[prdMatch.name] || 0) + qty;
         }
      });
      const topProducts = Object.entries(prdSalesMap)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      setData({
        dailySales,
        topProducts,
        warehouseValue: Object.values(warehouseMap).filter(v => v.value > 0),
        kpis: {
          totalRevenue: totalRev,
          totalProfit: totalRev - totalCostsForSold,
          stockValue: totalStockValue,
          avgSale: sales.length > 0 ? totalRev / sales.length : 0
        }
      });

    } catch (err) {
      console.error("Rapor hatası:", err);
    }
    setLoading(false);
  };

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading) return (
     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        Raporlar hazırlanıyor...
     </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <TrendingUp size={28} color="var(--primary-color)" /> Raporlar & Analiz
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>İşletmenizin finansal durumunu ve büyüme verilerini takip edin.</p>
        </div>
        <div className="card" style={{ padding: '0.5rem', display: 'flex', gap: '0.25rem', background: 'var(--surface-hover)' }}>
           <button onClick={() => setTimeRange(7)} className={`btn ${timeRange === 7 ? 'btn-primary' : ''}`} style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}>7 Gün</button>
           <button onClick={() => setTimeRange(30)} className={`btn ${timeRange === 30 ? 'btn-primary' : ''}`} style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}>30 Gün</button>
           <button onClick={() => setTimeRange(90)} className={`btn ${timeRange === 90 ? 'btn-primary' : ''}`} style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}>90 Gün</button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
         <div className="card glass-panel animate-fade-in" style={{ padding: '1.5rem', borderLeft: '4px solid #6366f1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Toplam Ciro</p>
               <ShoppingCart size={18} color="#6366f1" />
            </div>
            <h3 style={{ fontSize: '1.75rem', fontWeight: '800', margin: '0.5rem 0' }}>₺${data.kpis.totalRevenue.toLocaleString()}</h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
               <ArrowUpRight size={14} /> %12 (Tahmini)
            </div>
         </div>
         <div className="card glass-panel animate-fade-in" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981', animationDelay: '0.1s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Net Kâr (Tahmini)</p>
               <DollarSign size={18} color="#10b981" />
            </div>
            <h3 style={{ fontSize: '1.75rem', fontWeight: '800', margin: '0.5rem 0', color: '#10b981' }}>₺${data.kpis.totalProfit.toLocaleString()}</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Maliyet düşüldükten sonra</p>
         </div>
         <div className="card glass-panel animate-fade-in" style={{ padding: '1.5rem', borderLeft: '4px solid #f59e0b', animationDelay: '0.2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Stok Değeri</p>
               <Package size={18} color="#f59e0b" />
            </div>
            <h3 style={{ fontSize: '1.75rem', fontWeight: '800', margin: '0.5rem 0' }}>₺${data.kpis.stockValue.toLocaleString()}</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Maliyet bazlı toplam değer</p>
         </div>
         <div className="card glass-panel animate-fade-in" style={{ padding: '1.5rem', borderLeft: '4px solid #ef4444', animationDelay: '0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Ort. Satış Tutarı</p>
               <Activity size={18} color="#ef4444" />
            </div>
            <h3 style={{ fontSize: '1.75rem', fontWeight: '800', margin: '0.5rem 0' }}>₺${data.kpis.avgSale.toFixed(2)}</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>İşlem başına düşen tutar</p>
         </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '2rem' }}>
         {/* SALES CHART */}
         <div className="card" style={{ padding: '2rem' }}>
            <h4 style={{ fontWeight: '700', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <BarChart3 size={20} color="var(--primary-color)" /> Satış Trendi
            </h4>
            <div style={{ width: '100%', height: '350px' }}>
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.dailySales}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" fontSize={12} stroke="var(--text-muted)" />
                    <YAxis fontSize={12} stroke="var(--text-muted)" />
                    <Tooltip 
                       contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', padding: '10px' }}
                       itemStyle={{ color: 'white' }}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#6366f1" fillOpacity={1} fill="url(#colorAmount)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* STOCK VALUE PIE */}
         <div className="card" style={{ padding: '2rem' }}>
            <h4 style={{ fontWeight: '700', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <PieIcon size={20} color="var(--primary-color)" /> Depo Bazlı Değerleme
            </h4>
            <div style={{ width: '100%', height: '350px' }}>
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.warehouseValue}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {data.warehouseValue.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
               </ResponsiveContainer>
            </div>
         </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem' }}>
         {/* TOP PRODUCTS */}
         <div className="card" style={{ padding: '2rem' }}>
            <h4 style={{ fontWeight: '700', marginBottom: '2rem' }}>En Çok Satan 5 Ürün</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
               {data.topProducts.map((p, i) => (
                 <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: COLORS[i], color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                       {i+1}
                    </div>
                    <div style={{ flex: 1 }}>
                       <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>{p.name}</div>
                       <div style={{ height: '6px', background: 'var(--surface-hover)', borderRadius: '3px', marginTop: '0.4rem', overflow: 'hidden' }}>
                          <div style={{ width: `${(p.qty / data.topProducts[0].qty) * 100}%`, height: '100%', background: COLORS[i] }}></div>
                       </div>
                    </div>
                    <div style={{ fontWeight: '700' }}>{p.qty} Adet</div>
                 </div>
               ))}
               {data.topProducts.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Veri bulunamadı.</p>}
            </div>
         </div>

         {/* FINANCE QUICK SUMMARY */}
         <div className="card glass-panel" style={{ padding: '2rem' }}>
            <h4 style={{ fontWeight: '700', marginBottom: '1.5rem' }}>Varlık ve Borç Özeti</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <div style={{ padding: '1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Nakit & Banka Varlığı</span>
                  <span style={{ fontWeight: '700', color: 'var(--success-color)' }}>₺0.00 (Ekran Bekleniyor)</span>
               </div>
               <div style={{ padding: '1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tedarikçi Borçları</span>
                  <span style={{ fontWeight: '700', color: 'var(--danger-color)' }}>₺-{data.kpis.stockValue.toLocaleString()} (Hipotetik)</span>
               </div>
               <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5', marginTop: '1rem' }}>
                  * Bu rakamlar envanter girişlerindeki birim maliyetler üzerinden otomatik hesaplanmaktadır. Gerçek ödemeler Finans sayfasından takip edilebilir.
               </p>
            </div>
         </div>
      </div>

    </div>
  );
}

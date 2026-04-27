import { useState, useEffect, useRef } from 'react';
import { Printer, Settings, Layout, Type, Tag, DollarSign, Search, RefreshCw, Save, X, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import JsBarcode from 'jsbarcode';

export default function LabelDesigner() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Tasarım Ayarları
  const [config, setConfig] = useState({
    width: 50, // mm
    height: 30, // mm
    showName: true,
    showSku: true,
    showPrice: true,
    showBarcode: true,
    fontSize: 10,
    priceFontSize: 12,
    alignment: 'center'
  });

  const barcodeRef = useRef(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct && config.showBarcode && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, selectedProduct.barcode || selectedProduct.sku, {
          format: "CODE128",
          width: 2,
          height: 40,
          displayValue: false,
          margin: 0
        });
      } catch (e) {
        console.error("Barkod oluşturulamadı", e);
      }
    }
  }, [selectedProduct, config]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('name').limit(20);
    if (data) setProducts(data);
    setLoading(false);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const content = document.getElementById('label-preview').innerHTML;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Etiket Basımı - ${selectedProduct?.name}</title>
          <style>
            @page { size: ${config.width}mm ${config.height}mm; margin: 0; }
            body { margin: 0; display: flex; align-items: center; justify-content: center; font-family: sans-serif; }
            #label { 
              width: ${config.width}mm; 
              height: ${config.height}mm; 
              display: flex; 
              flex-direction: column; 
              align-items: ${config.alignment === 'center' ? 'center' : config.alignment === 'right' ? 'flex-end' : 'flex-start'}; 
              justify-content: center;
              padding: 2mm;
              box-sizing: border-box;
              text-align: ${config.alignment};
            }
            .name { font-weight: bold; font-size: ${config.fontSize}pt; margin-bottom: 1mm; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
            .sku { font-size: 7pt; color: #555; }
            .price { font-weight: 900; font-size: ${config.priceFontSize}pt; margin-top: 1mm; }
            svg { max-width: 100%; height: auto; margin-top: 1mm; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div id="label">${content}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Barkod & Etiket Tasarımcısı</h2>
          <p style={{ color: 'var(--text-muted)' }}>Ürünleriniz için şık ve bilgi dolu etiketler tasarlayıp doğrudan basın.</p>
        </div>
        <button className="btn btn-primary" onClick={handlePrint} disabled={!selectedProduct}>
           <Printer size={18} /> Etiketi Bas
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '2rem' }}>
         
         {/* ÜRÜN SEÇİMİ VEYA AYARLAR */}
         <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div className="card">
               <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Search size={18} color="var(--primary-color)" /> Ürün Seç
               </h3>
               <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  <input type="text" className="input-field" placeholder="Ürün ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                  {products.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => setSelectedProduct(p)}
                      style={{ 
                        padding: '0.75rem 1rem', borderRadius: '10px', cursor: 'pointer', border: '1px solid var(--border-color)',
                        background: selectedProduct?.id === p.id ? 'var(--primary-light)' : 'transparent',
                        borderColor: selectedProduct?.id === p.id ? 'var(--primary-color)' : 'var(--border-color)'
                      }}
                    >
                       <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{p.name}</div>
                       <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.sku} | ${p.price}</div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="card">
               <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Settings size={18} color="var(--primary-color)" /> Görünüm Ayarları
               </h3>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'var(--surface-hover)', borderRadius: '8px' }}>
                     <input type="checkbox" checked={config.showName} onChange={e => setConfig({...config, showName: e.target.checked})} />
                     <span style={{ fontSize: '0.9rem' }}>Ürün Adını Göster</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'var(--surface-hover)', borderRadius: '8px' }}>
                     <input type="checkbox" checked={config.showSku} onChange={e => setConfig({...config, showSku: e.target.checked})} />
                     <span style={{ fontSize: '0.9rem' }}>SKU Kodunu Göster</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'var(--surface-hover)', borderRadius: '8px' }}>
                     <input type="checkbox" checked={config.showPrice} onChange={e => setConfig({...config, showPrice: e.target.checked})} />
                     <span style={{ fontSize: '0.9rem' }}>Satış Fiyatını Göster</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'var(--surface-hover)', borderRadius: '8px' }}>
                     <input type="checkbox" checked={config.showBarcode} onChange={e => setConfig({...config, showBarcode: e.target.checked})} />
                     <span style={{ fontSize: '0.9rem' }}>Barkodu Göster</span>
                  </label>
                  
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <div style={{ flex: 1 }} className="input-group">
                       <label>Hiza</label>
                       <select className="input-field" value={config.alignment} onChange={e => setConfig({...config, alignment: e.target.value})}>
                          <option value="left">Sol</option>
                          <option value="center">Orta</option>
                          <option value="right">Sağ</option>
                       </select>
                    </div>
                    <div style={{ flex: 1 }} className="input-group">
                       <label>Yazı Boyutu</label>
                       <input type="number" className="input-field" value={config.fontSize} onChange={e => setConfig({...config, fontSize: parseInt(e.target.value) || 8})} />
                    </div>
                  </div>
               </div>
            </div>

         </div>

         {/* CANLI ÖNİZLEME */}
         <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
               <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                  <Eye size={18} /> Etiket Önizlemesi (Gerçek Boyut)
               </div>
               
               {selectedProduct ? (
                 <div 
                   id="label-preview"
                   style={{ 
                     width: `${config.width * 4}px`, 
                     height: `${config.height * 4}px`, 
                     background: 'white', 
                     color: 'black', 
                     padding: '10px', 
                     boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                     display: 'flex',
                     flexDirection: 'column',
                     alignItems: config.alignment === 'center' ? 'center' : config.alignment === 'right' ? 'flex-end' : 'flex-start',
                     justifyContent: 'center',
                     textAlign: config.alignment,
                     overflow: 'hidden'
                   }}
                 >
                    {config.showName && <div className="name" style={{ fontWeight: 'bold', fontSize: `${config.fontSize * 1.2}px`, lineHeight: '1.2' }}>{selectedProduct.name}</div>}
                    {config.showSku && <div className="sku" style={{ fontSize: '10px', color: '#666' }}>{selectedProduct.sku}</div>}
                    {config.showBarcode && <svg ref={barcodeRef}></svg>}
                    {config.showPrice && <div className="price" style={{ fontWeight: '900', fontSize: `${config.priceFontSize * 1.5}px`, marginTop: '5px' }}>₺${selectedProduct.price}</div>}
                 </div>
               ) : (
                 <div style={{ textAlign: 'center', opacity: 0.3 }}>
                    <Layout size={64} style={{ marginBottom: '1rem' }} />
                    <p>Lütfen önizleme için bir ürün seçin.</p>
                 </div>
               )}

               <div style={{ marginTop: '3rem', fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--surface-hover)', padding: '0.75rem 1.5rem', borderRadius: '20px' }}>
                  Kâğıt Boyutu: {config.width}mm x {config.height}mm
               </div>
            </div>
         </div>

      </div>

    </div>
  );
}

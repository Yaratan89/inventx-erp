import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Search, Plus, FileText, Check, Trash2, ArrowRightLeft, DollarSign, Edit3, X, Camera, Zap, Printer } from 'lucide-react';
import { format } from 'date-fns';
import BarcodeScanner from '../components/BarcodeScanner';

const UNITS = ['Adet', 'KG', 'Çuval', 'Paket', 'Koli', 'Litre', 'Metre', 'Gram', 'Ton', 'Palet', 'Bağ', 'Demet', 'Kutu', 'Teneke', 'Çuval'];
const UNIQUE_UNITS = [...new Set(UNITS)];

export default function StockDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tablesReady, setTablesReady] = useState(true);
  const [activeTab, setActiveTab] = useState('IN');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [scannerStatus, setScannerStatus] = useState('Kapalı');

  const [form, setForm] = useState({
    id: null,
    document_no: '',
    invoice_no: '',
    party_id: '',
    location_id: '',
    document_date: format(new Date(), 'yyyy-MM-dd'),
    items: [],
    status: 'DRAFT',
    notes: '',
    assigned_personnel_id: ''
  });
  const [personnel, setPersonnel] = useState([]);

  const [selectedProduct, setSelectedProduct] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemUnit, setItemUnit] = useState('Adet');
  const [itemPrice, setItemPrice] = useState(0);
  const [showScanner, setShowScanner] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState(null);
  const [manualBarcodeInput, setManualBarcodeInput] = useState('');
  const scannerRef = useRef(null);
  const lastScanTime = useRef(0);
  const lastScanCode = useRef('');

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({ name: '', barcode: '', sku: '', category: '', cost_price: 0, price: 0, quantity: 1, unit: 'Adet', tax_rate: 20 });

  useEffect(() => {
    checkTablesAndFetch();
  }, []);

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {}
  };



  useEffect(() => {
    if (!showModal) return;
    let buf = '';
    let lastTime = Date.now();
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      const now = Date.now();
      if (now - lastTime > 120) buf = '';
      if (e.key === 'Enter') {
        if (buf.length > 2) processBarcodeInCart(buf.trim());
        buf = '';
      } else if (e.key.length === 1) {
        buf += e.key;
      }
      lastTime = now;
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showModal]);

  const checkTablesAndFetch = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('stock_documents').select('id').limit(1);
      if (error && error.code === '42P01') {
        setTablesReady(false);
        setLoading(false);
        return;
      }
      setTablesReady(true);
      await fetchAll();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchAll = async () => {
    const { data: docs } = await supabase.from('stock_documents').select('*, parties(name)').order('created_at', { ascending: false });
    const { data: pts } = await supabase.from('parties').select('*').order('name');
    const { data: prds } = await supabase.from('products').select('*').order('name');
    const { data: locs } = await supabase.from('locations').select('*').order('name');
    const { data: pers } = await supabase.from('personnel').select('*').order('full_name');

    if (docs) setDocuments(docs);
    if (pts) setParties(pts);
    if (prds) setProducts(prds);
    if (pers) setPersonnel(pers);
    if (locs) {
       setLocations(locs);
       if (!form.location_id && locs.length > 0) setForm(f => ({ ...f, location_id: locs[0].id }));
    }
  };

  const openNewDocument = () => {
    setForm({
      id: null,
      document_no: `DOC-${Date.now().toString().slice(-6)}`,
      invoice_no: '',
      party_id: '',
      location_id: locations[0]?.id || '',
      document_date: format(new Date(), 'yyyy-MM-dd'),
      items: [],
      status: 'DRAFT',
      notes: '',
      assigned_personnel_id: ''
    });
    setShowModal(true);
  };

  const openEditDocument = (doc) => {
    setForm({
      id: doc.id,
      document_no: doc.document_no || '',
      invoice_no: doc.invoice_no || '',
      party_id: doc.party_id || '',
      location_id: doc.location_id || locations[0]?.id || '',
      document_date: doc.document_date ? format(new Date(doc.document_date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      items: doc.items || [],
      status: doc.status || 'DRAFT',
      notes: doc.notes || '',
      assigned_personnel_id: doc.assigned_personnel_id || ''
    });
    setShowModal(true);
  };

  const processBarcodeInCart = async (code) => {
    const normalized = (code || '').trim();
    if (!normalized) return;

    setLastScannedCode(normalized);
    setTimeout(() => setLastScannedCode(null), 2500);

    let { data: prd } = await supabase.from('products').select('*').eq('barcode', normalized).maybeSingle();
    if (!prd) {
      const { data: bySku } = await supabase.from('products').select('*').eq('sku', normalized).maybeSingle();
      prd = bySku;
    }

    if (!prd) {
      setQuickAddForm({ name: '', barcode: normalized, sku: normalized, category: '', cost_price: 0, price: 0, quantity: 1 });
      setShowQuickAdd(true);
      return;
    }

    const price = activeTab === 'IN' ? (prd.cost_price || 0) : (prd.price || 0);
    setForm(prev => {
      const existingIndex = prev.items.findIndex(i => i.product_id === prd.id);
      const newItems = [...prev.items];
      if (existingIndex >= 0) {
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newItems[existingIndex].quantity + 1,
          tax_amount: (newItems[existingIndex].quantity + 1) * newItems[existingIndex].unit_price * (newItems[existingIndex].tax_rate || 20) / 100,
          total_price: (newItems[existingIndex].quantity + 1) * newItems[existingIndex].unit_price * (1 + (newItems[existingIndex].tax_rate || 20) / 100)
        };
      } else {
        newItems.push({
          product_id: prd.id,
          product_name: prd.name,
          barcode: prd.barcode || prd.sku,
          quantity: 1,
          unit_price: price,
          tax_rate: prd.tax_rate || 20,
          unit: prd.unit || 'Adet',
          tax_amount: price * (prd.tax_rate || 20) / 100,
          total_price: price * (1 + (prd.tax_rate || 20) / 100)
        });
      }
      return { ...prev, items: newItems };
    });
  };

  const handleQuickAddProduct = async () => {
    if (!quickAddForm.name) { alert('Lütfen ürün adı girin.'); return; }
    try {
      const { data: newPrd, error } = await supabase.from('products').insert([{
        name: quickAddForm.name,
        barcode: quickAddForm.barcode,
        sku: quickAddForm.sku || quickAddForm.barcode,
        category: quickAddForm.category || 'Genel',
        cost_price: Number(quickAddForm.cost_price),
        price: Number(quickAddForm.price),
        unit: quickAddForm.unit,
        tax_rate: Number(quickAddForm.tax_rate)
      }]).select().single();

      if (error) { alert('Hata: ' + error.message); return; }

      setProducts(prev => [...prev, newPrd]);
      const unitPrice = activeTab === 'IN' ? Number(quickAddForm.cost_price) : Number(quickAddForm.price);
      setForm(prev => ({
        ...prev,
        items: [...prev.items, {
          product_id: newPrd.id,
          product_name: newPrd.name,
          barcode: newPrd.barcode || newPrd.sku,
          quantity: Number(quickAddForm.quantity),
          unit_price: unitPrice,
          tax_rate: Number(quickAddForm.tax_rate) || 20,
          unit: newPrd.unit,
          tax_amount: Number(quickAddForm.quantity) * unitPrice * (Number(quickAddForm.tax_rate) || 20) / 100,
          total_price: Number(quickAddForm.quantity) * unitPrice * (1 + (Number(quickAddForm.tax_rate) || 20) / 100)
        }]
      }));

      setShowQuickAdd(false);
    } catch (err) {
      alert('Hata: ' + err.message);
    }
  };

  const handleProductSelect = (pid) => {
    setSelectedProduct(pid);
    const prd = products.find(p => p.id === pid);
    if (prd) {
      setItemPrice(activeTab === 'IN' ? (prd.cost_price || 0) : (prd.price || 0));
      setItemQty(1);
      setItemUnit(prd.unit || 'Adet');
    }
  };

  const addItemToCart = () => {
    if (!selectedProduct || itemQty <= 0) return;
    const prd = products.find(p => p.id === selectedProduct);
    const existingIndex = form.items.findIndex(i => i.product_id === selectedProduct);
    let newItems = [...form.items];
    
    if (existingIndex >= 0) {
      newItems[existingIndex].quantity += Number(itemQty);
      const newQty = newItems[existingIndex].quantity;
      const uPrice = newItems[existingIndex].unit_price;
      const tRate = newItems[existingIndex].tax_rate || 0;
      newItems[existingIndex].tax_amount = newQty * uPrice * tRate / 100;
      newItems[existingIndex].total_price = newQty * uPrice * (1 + tRate / 100);
    } else {
      newItems.push({
        product_id: prd.id,
        product_name: prd.name,
        barcode: prd.barcode || prd.sku,
        quantity: Number(itemQty),
        unit_price: Number(itemPrice),
        tax_rate: prd.tax_rate || 20,
        unit: itemUnit || prd.unit || 'Adet',
        tax_amount: Number(itemQty) * Number(itemPrice) * (prd.tax_rate || 20) / 100,
        total_price: Number(itemQty) * Number(itemPrice) * (1 + (prd.tax_rate || 20) / 100)
      });
    }
    
    setForm({ ...form, items: newItems });
    setSelectedProduct('');
    setItemQty(1);
    setItemUnit('Adet');
    setItemPrice(0);
  };

  const removeItemFromCart = (index) => {
    const newItems = [...form.items];
    newItems.splice(index, 1);
    setForm({ ...form, items: newItems });
  };

  const calculateNetTotal = () => form.items.reduce((sum, item) => sum + (Number(item.unit_price) * Number(item.quantity)), 0);
  const calculateTaxTotal = () => form.items.reduce((sum, item) => sum + (Number(item.unit_price) * Number(item.quantity) * (Number(item.tax_rate) || 0) / 100), 0);
  const calculateTotal = () => calculateNetTotal() + calculateTaxTotal();

  const saveDraft = async () => {
    try {
      const payload = {
        document_type: activeTab,
        document_no: form.document_no,
        invoice_no: form.invoice_no,
        party_id: form.party_id || null,
        location_id: form.location_id || null,
        document_date: form.document_date,
        items: form.items,
        total_amount: calculateTotal(),
        status: 'DRAFT',
        notes: form.notes,
        assigned_personnel_id: form.assigned_personnel_id || null
      };

      if (form.id) {
        const { error } = await supabase.from('stock_documents').update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('stock_documents').insert([payload]);
        if (error) throw error;
      }
      
      setShowModal(false);
      fetchAll();
    } catch (err) {
      alert("Hata: " + err.message);
    }
  };

  const completeDocument = async () => {
    if (!form.location_id) { alert("Lütfen bir depo/lokasyon seçin."); return; }
    if (form.items.length === 0) { alert("Belgede hiç ürün yok!"); return; }

    try {
      let oldDocData = null;
      let oldItems = [];
      if (form.id && form.status === 'COMPLETED') {
         const { data: od } = await supabase.from('stock_documents').select('*').eq('id', form.id).single();
         oldDocData = od;
         if (od && od.items) oldItems = od.items;
      }

      const totalAmt = calculateTotal();
      
      // DEPO DEĞİŞİKLİĞİ KONTROLÜ
      const locationChanged = oldDocData && oldDocData.location_id !== form.location_id;

      if (locationChanged) {
          // 1. ESKİ DEPODAN STOKLARI ÇIKAR (Geri Al)
          for (const it of oldItems) {
              const { data: oldInv } = await supabase.from('inventory')
                  .select('*').eq('product_id', it.product_id).eq('location_id', oldDocData.location_id).maybeSingle();
              
              if (oldInv) {
                  const reverseQty = activeTab === 'IN' ? oldInv.quantity - it.quantity : oldInv.quantity + it.quantity;
                  await supabase.from('inventory').upsert({ id: oldInv.id, product_id: it.product_id, location_id: oldDocData.location_id, quantity: reverseQty });
              }
          }
          // 2. YENİ DEPOYA STOKLARI EKLE (Tamamını)
          for (const it of form.items) {
              const { data: newInv } = await supabase.from('inventory')
                  .select('*').eq('product_id', it.product_id).eq('location_id', form.location_id).maybeSingle();
              
              const currentQty = newInv?.quantity || 0;
              const finalQty = activeTab === 'IN' ? currentQty + it.quantity : currentQty - it.quantity;
              
              await supabase.from('inventory').upsert({
                  ...(newInv ? { id: newInv.id } : {}),
                  product_id: it.product_id,
                  location_id: form.location_id,
                  quantity: finalQty
              });
          }
      } else {
          // Standart Fark Güncellemesi (Aynı Depo)
          const oldQtyMap = {};
          oldItems.forEach(i => oldQtyMap[i.product_id] = (oldQtyMap[i.product_id] || 0) + Number(i.quantity));

          const newQtyMap = {};
          form.items.forEach(i => newQtyMap[i.product_id] = (newQtyMap[i.product_id] || 0) + Number(i.quantity));

          const allProductIds = new Set([...Object.keys(oldQtyMap), ...Object.keys(newQtyMap)]);

          for (const pid of allProductIds) {
            const oldQ = oldQtyMap[pid] || 0;
            const newQ = newQtyMap[pid] || 0;
            const diff = newQ - oldQ;
            
            if (diff !== 0) {
              const { data: currentInv } = await supabase.from('inventory')
                .select('*').eq('product_id', pid).eq('location_id', form.location_id).maybeSingle();
                
              const currentQty = currentInv?.quantity || 0;
              const finalQty = activeTab === 'IN' ? currentQty + diff : currentQty - diff;
              
              await supabase.from('inventory').upsert({
                ...(currentInv ? { id: currentInv.id } : {}),
                product_id: pid,
                location_id: form.location_id,
                quantity: finalQty
              });
            }
          }
      }

      // Master Ürün Fiyatlarını Güncelleme (Sistem Entegrasyonu)
      if (form.status === 'DRAFT') {
        for (const it of form.items) {
          const updatePayload = {};
          if (activeTab === 'IN') {
            updatePayload.cost_price = Number(it.unit_price);
            updatePayload.tax_rate = Number(it.tax_rate);
          } else {
            updatePayload.price = Number(it.unit_price);
            updatePayload.tax_rate = Number(it.tax_rate);
          }
          const { error: prdErr } = await supabase.from('products').update(updatePayload).eq('id', it.product_id);
          if (prdErr) console.error("Product update error:", prdErr);
        }
      }

      if (form.party_id && totalAmt > 0 && form.status === 'DRAFT') {
        const type = activeTab === 'IN' ? 'Purchase_Debt' : 'Sale_Credit';
        const desc = `Toplu ${activeTab === 'IN' ? 'Alım' : 'Satış'} - ${form.items.length} kalem. No: ${form.document_no}`;
        
        await supabase.from('financial_transactions').insert([{
          party_id: form.party_id,
          amount: totalAmt,
          type: type,
          method: 'Cash',
          description: desc
        }]);
      }

      const payload = {
        document_type: activeTab,
        document_no: form.document_no,
        invoice_no: form.invoice_no,
        party_id: form.party_id || null,
        location_id: form.location_id || null,
        document_date: form.document_date,
        items: form.items,
        total_amount: totalAmt,
        status: 'COMPLETED',
        notes: form.notes,
        assigned_personnel_id: form.assigned_personnel_id || null
      };

      let savedDoc = null;
      if (form.id) {
        const { data, error } = await supabase.from('stock_documents').update(payload).eq('id', form.id).select('*, parties(name)').single();
        if (error) throw error;
        savedDoc = data;
      } else {
        const { data, error } = await supabase.from('stock_documents').insert([payload]).select('*, parties(name)').single();
        if (error) throw error;
        savedDoc = data;
      }

      setShowModal(false);
      fetchAll();
      alert("Belge başarıyla onaylandı ve stoklar güncellendi!");
      
      // Çıkış (Satış) işlemiyse otomatik yazdır
      if (activeTab === 'OUT' && savedDoc) {
         handlePrint(savedDoc);
      }

    } catch (err) {
      alert("Hata: " + err.message);
    }
  };

  const handlePrint = (doc) => {
    const printWindow = window.open('', '_blank');
    const qrData = encodeURIComponent(`Belge No: ${doc.document_no} | Tutar: ${doc.total_amount} TL | Tarih: ${format(new Date(doc.document_date || new Date()), 'dd.MM.yyyy')}`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;
    
    // items array parsing if needed (sometimes it comes as stringified JSON from supabase)
    const itemsList = typeof doc.items === 'string' ? JSON.parse(doc.items) : (doc.items || []);

    const typeLabel = doc.document_type === 'OUT' ? 'SATIŞ BELGESİ' : 'ALIM BELGESİ';
    
    printWindow.document.write(`
      <html>
        <head>
          <title>${typeLabel} - ${doc.document_no}</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            @media print {
              @page { margin: 0; size: A4 portrait; }
              body { -webkit-print-color-adjust: exact; margin: 0; padding: 2cm !important; }
              .no-print { display: none !important; }
            }
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; max-width: 21cm; margin: auto; background: #fff; box-sizing: border-box; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 30px; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; }
            .company-info h1 { margin: 0; color: #0f172a; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
            .company-details { font-size: 12px; color: #64748b; margin-top: 8px; line-height: 1.6; }
            .document-meta { text-align: right; }
            .document-meta h2 { margin: 0; color: #3b82f6; font-size: 32px; font-weight: 800; letter-spacing: -1px; text-transform: uppercase; }
            .meta-grid { display: grid; grid-template-columns: auto auto; gap: 8px 24px; margin-top: 16px; text-align: right; font-size: 12px; }
            .meta-label { color: #94a3b8; font-weight: 500; text-transform: uppercase; }
            .meta-value { color: #0f172a; font-weight: 600; }
            
            .info-section { display: flex; justify-content: space-between; margin-bottom: 40px; background: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; }
            .info-box h4 { margin: 0 0 12px 0; color: #64748b; text-transform: uppercase; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
            .info-box p { margin: 4px 0; font-weight: 600; font-size: 14px; color: #0f172a; }
            .info-box .sub-text { font-weight: 400; color: #64748b; font-size: 12px; }
            
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 40px; }
            th { text-align: left; padding: 16px; background: #f1f5f9; font-size: 11px; text-transform: uppercase; color: #475569; font-weight: 700; letter-spacing: 0.5px; }
            th:first-child { border-top-left-radius: 8px; border-bottom-left-radius: 8px; }
            th:last-child { border-top-right-radius: 8px; border-bottom-right-radius: 8px; }
            td { padding: 16px; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #334155; }
            
            .totals-container { display: flex; justify-content: space-between; align-items: flex-start; }
            .qr-code { padding: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; display: inline-block; }
            .totals-box { width: 320px; }
            .total-row { display: flex; justify-content: space-between; padding: 12px 0; font-size: 14px; color: #475569; border-bottom: 1px solid #f1f5f9; }
            .grand-total { border-top: 2px solid #3b82f6; border-bottom: none; padding-top: 16px; margin-top: 4px; }
            .grand-total span { font-weight: 800; font-size: 20px; color: #3b82f6; }
            
            .footer { margin-top: 60px; padding-top: 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              <h1>INVENTX ERP</h1>
              <div class="company-details">
                <p style="margin:0">Dijital İşletme Yönetimi</p>
              </div>
            </div>
            <div class="document-meta">
              <h2>${typeLabel}</h2>
              <div class="meta-grid">
                <span class="meta-label">Belge No</span>
                <span class="meta-value">${doc.document_no || '-'}</span>
                <span class="meta-label">Fatura No</span>
                <span class="meta-value">${doc.invoice_no || '-'}</span>
                <span class="meta-label">Tarih</span>
                <span class="meta-value">${format(new Date(doc.document_date || new Date()), 'dd.MM.yyyy')}</span>
              </div>
            </div>
          </div>

          <div class="info-section">
            <div class="info-box">
              <h4>MÜŞTERİ (CARİ) BİLGİLERİ</h4>
              <p>${doc.parties?.name || 'Bilinmeyen / Perakende'}</p>
              <span class="sub-text">Sistem Cari ID: ${doc.party_id?.slice(0,8) || '-'}</span>
            </div>
            <div class="info-box" style="text-align: right;">
              <h4>BELGE DURUMU</h4>
              <p style="color: #166534;">ONAYLANDI (STOKLARA İŞLENDİ)</p>
              <span class="sub-text">Sorumlu: Personel ID ${doc.assigned_personnel_id?.slice(0,5) || 'Admin'}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Ürün Bilgisi</th>
                <th style="text-align: center">Miktar</th>
                <th style="text-align: right">Birim Fiyat</th>
                <th style="text-align: right">KDV Toplamı</th>
                <th style="text-align: right">Satır Toplamı (KDV Dahil)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList.map(item => `
                <tr>
                  <td>
                    <strong style="color: #0f172a; display: block; margin-bottom: 4px;">${item.product_name}</strong>
                    <span style="color: #94a3b8; font-size: 11px;">Barkod: ${item.barcode || '-'} | KDV: %${item.tax_rate || 0}</span>
                  </td>
                  <td style="text-align: center; font-weight: 600;">${item.quantity} ${item.unit || 'Adet'}</td>
                  <td style="text-align: right">₺${Number(item.unit_price).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                  <td style="text-align: right; color: #64748b;">₺${Number(item.tax_amount || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                  <td style="text-align: right; font-weight: 700; color: #0f172a;">₺${Number(item.total_price || (item.quantity * item.unit_price)).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals-container">
            <div>
              <div class="qr-code">
                <img src="${qrUrl}" alt="QR Kod" style="display: block;" />
              </div>
              <p style="font-size: 10px; color: #94a3b8; margin-top: 8px; text-align: center;">Belge Doğrulama Kodu</p>
            </div>
            <div class="totals-box">
              <div class="total-row">
                <span>Ara Toplam (KDV Hariç)</span>
                <span style="font-weight: 600;">₺${itemsList.reduce((sum, it) => sum + (Number(it.unit_price) * Number(it.quantity)), 0).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
              </div>
              <div class="total-row">
                <span>Toplam KDV</span>
                <span style="font-weight: 600;">₺${itemsList.reduce((sum, it) => sum + Number(it.tax_amount || 0), 0).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
              </div>
              <div class="total-row grand-total">
                <span style="color: #0f172a;">GENEL TOPLAM</span>
                <span>₺${Number(doc.total_amount).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <div><strong>InventX Pro ERP</strong> tarafından dijital olarak oluşturulmuştur.</div>
            <div>Teslim Eden / İmza / Kaşe</div>
          </div>

          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.onafterprint = () => window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!tablesReady) {
    return (
      <div style={{ padding: '2rem' }}>
        <div className="card"><h3>⚠️ stock_documents Tablosu Eksik</h3></div>
      </div>
    );
  }


  const filteredDocuments = documents.filter(doc => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (doc.document_no || '').toLowerCase().includes(q) ||
      (doc.parties?.name || '').toLowerCase().includes(q) ||
      format(new Date(doc.document_date), 'dd.MM.yyyy').includes(q) ||
      doc.total_amount.toString().includes(q) ||
      (doc.status === 'COMPLETED' ? 'onaylı' : 'taslak').includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Stok Giriş&Çıkış</h2>
          <p style={{ color: 'var(--text-muted)' }}>Toplu stok giriş ve çıkış belgelerini yönetin.</p>
        </div>
        <button className="btn btn-primary" onClick={openNewDocument}><Plus size={18} /> Yeni {activeTab === 'IN' ? 'Alım' : 'Satış'} Belgesi</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--surface-color)', padding: '0.35rem', borderRadius: '12px', border: '1px solid var(--border-color)', width: 'fit-content' }}>
           <button onClick={() => setActiveTab('IN')} style={{
            padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.9rem',
            background: activeTab === 'IN' ? 'var(--warning-color)' : 'transparent',
            color: activeTab === 'IN' ? '#fff' : 'var(--text-muted)'
         }}>📥 Giriş (Alım)</button>
         <button onClick={() => setActiveTab('OUT')} style={{
            padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.9rem',
            background: activeTab === 'OUT' ? 'var(--success-color)' : 'transparent',
            color: activeTab === 'OUT' ? '#fff' : 'var(--text-muted)'
         }}>📤 Çıkış (Satış)</button>
        </div>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
             type="text" 
             className="input-field" 
             placeholder="Belge no, cari, tutar ara..." 
             style={{ paddingLeft: '2.5rem', width: '100%' }}
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="card table-responsive" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
          <thead>
             <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
               <th style={{ padding: '1rem', textAlign: 'left' }}>Tarih</th>
               <th style={{ padding: '1rem', textAlign: 'left' }}>Tip</th>
               <th style={{ padding: '1rem', textAlign: 'left' }}>Belge No</th>
               <th style={{ padding: '1rem', textAlign: 'left' }}>Fatura No</th>
               <th style={{ padding: '1rem', textAlign: 'left' }}>Cari</th>
               <th style={{ padding: '1rem', textAlign: 'left' }}>Ürün İçeriği (Girilen Veriler)</th>
               <th style={{ padding: '1rem', textAlign: 'right' }}>Toplam</th>
               <th style={{ padding: '1rem', textAlign: 'center' }}>Durum</th>
               <th style={{ padding: '1rem', textAlign: 'center' }}>İşlem</th>
             </tr>
          </thead>
          <tbody>
             {filteredDocuments.map(doc => {
                const itemsArr = Array.isArray(doc.items) ? doc.items : [];
                return (
                <React.Fragment key={doc.id}>
                  <tr 
                     onClick={() => setExpandedRowId(expandedRowId === doc.id ? null : doc.id)}
                     style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', background: expandedRowId === doc.id ? 'var(--surface-color)' : 'transparent', transition: 'background 0.2s' }}
                     className="hover-row"
                  >
                     <td style={{ padding: '1rem' }}>{format(new Date(doc.document_date), 'dd.MM.yyyy')}</td>
                     <td style={{ padding: '1rem' }}>
                        <span className={`badge ${doc.document_type === 'IN' ? 'badge-warning' : 'badge-success'}`}>
                          {doc.document_type === 'IN' ? '📥 Alım' : '📤 Satış'}
                        </span>
                     </td>
                     <td style={{ padding: '1rem', fontWeight: '600' }}>{doc.document_no || '-'}</td>
                     <td style={{ padding: '1rem' }}>{doc.invoice_no || '-'}</td>
                     <td style={{ padding: '1rem' }}>{doc.parties?.name || '-'}</td>
                     <td style={{ padding: '1rem' }}>
                        <div style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                           {itemsArr.map(it => `${it.product_name} (${it.quantity} ${it.unit || 'Adet'})`).join(', ') || '-'}
                        </div>
                     </td>
                     <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700' }}>₺{Number(doc.total_amount).toLocaleString()}</td>
                     <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span className={`badge ${doc.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                          {doc.status === 'COMPLETED' ? '✅ Onaylı' : '📝 Taslak'}
                        </span>
                     </td>
                     <td style={{ padding: '1rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                           {doc.status === 'COMPLETED' && (
                              <button className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem', background: '#e0e7ff', color: '#4f46e5', border: 'none' }} onClick={() => handlePrint(doc)}>
                                 <Printer size={16} />
                              </button>
                           )}
                           <button className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem' }} onClick={() => openEditDocument(doc)}><Edit3 size={14} /></button>
                        </div>
                     </td>
                  </tr>
                  {expandedRowId === doc.id && (
                     <tr style={{ background: 'var(--bg-color)' }}>
                        <td colSpan={9} style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                           <div style={{ background: 'var(--surface-color)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                                 <div>
                                    <h4 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '1.1rem' }}>Belge Detayları</h4>
                                    <div style={{ display: 'flex', gap: '2rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                       <div><strong>Belge No:</strong> {doc.document_no || '-'}</div>
                                       <div><strong>Fatura No:</strong> {doc.invoice_no || '-'}</div>
                                       <div><strong>Cari:</strong> {doc.parties?.name || '-'}</div>
                                       <div><strong>Durum:</strong> {doc.status === 'COMPLETED' ? 'Onaylı' : 'Taslak'}</div>
                                    </div>
                                 </div>
                                 <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>₺{Number(doc.total_amount).toLocaleString()}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Toplam Tutar</div>
                                 </div>
                              </div>
                              
                              <h5 style={{ margin: 0, marginBottom: '0.75rem', fontSize: '0.95rem', color: 'var(--text-muted)' }}>Ürün İçeriği ({itemsArr.length} Kalem)</h5>
                              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                 <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead style={{ background: 'var(--bg-color)' }}>
                                       <tr>
                                          <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Ürün</th>
                                          <th style={{ padding: '0.75rem 1rem', textAlign: 'center', borderBottom: '1px solid var(--border-color)' }}>Miktar</th>
                                          <th style={{ padding: '0.75rem 1rem', textAlign: 'right', borderBottom: '1px solid var(--border-color)' }}>Birim Fiyat</th>
                                          <th style={{ padding: '0.75rem 1rem', textAlign: 'center', borderBottom: '1px solid var(--border-color)' }}>KDV %</th>
                                          <th style={{ padding: '0.75rem 1rem', textAlign: 'right', borderBottom: '1px solid var(--border-color)' }}>Toplam</th>
                                       </tr>
                                    </thead>
                                    <tbody>
                                       {itemsArr.length > 0 ? itemsArr.map((it, idx) => (
                                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                             <td style={{ padding: '0.75rem 1rem' }}>
                                                <div style={{ fontWeight: '600' }}>{it.product_name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{it.barcode || '-'}</div>
                                             </td>
                                             <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '500' }}>{it.quantity} {it.unit}</td>
                                             <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>₺{Number(it.unit_price).toLocaleString()}</td>
                                             <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>%{it.tax_rate || 0}</td>
                                             <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600' }}>₺{Number(it.total_price || (it.quantity * it.unit_price * (1 + (it.tax_rate||0)/100))).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                          </tr>
                                       )) : (
                                          <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>İçerik bulunmuyor</td></tr>
                                       )}
                                    </tbody>
                                 </table>
                              </div>
                           </div>
                        </td>
                     </tr>
                  )}
                </React.Fragment>
                );
             })}
          </tbody>
        </table>
      </div>

      {showModal && (
         <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div className="card glass-panel" style={{ width: 'min(900px, 95vw)', maxHeight: '95vh', overflowY: 'auto', padding: 'clamp(1rem, 3vw, 2rem)' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                  <h3 style={{ fontSize: 'clamp(1.1rem, 4vw, 1.5rem)' }}>{activeTab === 'IN' ? 'Alım' : 'Satış'} Belgesi {form.status === 'COMPLETED' && '(Onaylı)'}</h3>
                  <button className="btn btn-secondary" style={{ padding: '0.5rem' }} onClick={() => setShowModal(false)}><X size={20}/></button>
               </div>

               <div className="mobile-stack" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="input-group" style={{ flex: 1 }}><label>Belge No</label><input className="input-field" value={form.document_no} onChange={e => setForm({...form, document_no: e.target.value})} /></div>
                  <div className="input-group" style={{ flex: 1 }}><label>Fatura No</label><input className="input-field" value={form.invoice_no} onChange={e => setForm({...form, invoice_no: e.target.value})} /></div>
                  <div className="input-group" style={{ flex: 1 }}><label>Sorumlu Personel</label>
                     <select className="input-field" value={form.assigned_personnel_id} onChange={e => setForm({...form, assigned_personnel_id: e.target.value})}>
                        <option value="">Seçiniz...</option>
                        {personnel.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                     </select>
                  </div>
                  <div className="input-group" style={{ flex: 1 }}><label>Cari</label>
                     <select className="input-field" value={form.party_id} onChange={e => setForm({...form, party_id: e.target.value})}>
                        <option value="">Seçiniz...</option>
                        {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                     </select>
                  </div>
               </div>

               <div style={{ background: 'var(--surface-color)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                     <h4 style={{ margin: 0 }}>Ürün Ekleme</h4>
                     <button className="btn btn-secondary" onClick={() => setShowScanner(!showScanner)}><Camera size={16} /> {showScanner ? 'Kamerayı Kapat' : 'Kamerayla Tara'}</button>
                  </div>

                  {showScanner && (
                     <BarcodeScanner
                       title="Ürün Barkodu Tara"
                       onScan={(code) => processBarcodeInCart(code)}
                       onClose={() => setShowScanner(false)}
                     />
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                     <input
                        className="input-field"
                        style={{ flex: 1, fontFamily: 'monospace' }}
                        placeholder="🔍 Barkod okutun veya elle yazıp Enter'a basın..."
                        value={manualBarcodeInput}
                        onChange={e => setManualBarcodeInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { processBarcodeInCart(manualBarcodeInput); setManualBarcodeInput(''); } }}
                        autoFocus
                     />
                     <button className="btn btn-primary" onClick={() => { processBarcodeInCart(manualBarcodeInput); setManualBarcodeInput(''); }}>Ekle</button>
                  </div>

                  <div className="mobile-stack" style={{ display: 'flex', gap: '1rem' }}>
                     <div className="input-group" style={{ flex: 2 }}><label>Manuel Ürün Seçimi</label>
                        <select className="input-field" value={selectedProduct} onChange={e => handleProductSelect(e.target.value)}>
                           <option value="">Listeden seçin...</option>
                           {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.barcode || p.sku})</option>)}
                        </select>
                     </div>
                     <div style={{ display: 'flex', gap: '0.5rem', flex: 3 }} className="mobile-stack">
                        <div className="input-group" style={{ flex: 1 }}><label>Miktar</label><input type="number" className="input-field" value={itemQty} onChange={e => setItemQty(e.target.value)} /></div>
                        <div className="input-group" style={{ flex: 1.2 }}>
                           <label>Birim</label>
                           <select className="input-field" value={itemUnit} onChange={e => setItemUnit(e.target.value)}>
                              {UNIQUE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                           </select>
                        </div>
                        <div className="input-group" style={{ flex: 1 }}><label>Fiyat</label><input type="number" className="input-field" value={itemPrice} onChange={e => setItemPrice(e.target.value)} /></div>
                        <button className="btn btn-primary mobile-full-width" style={{ height: '42px', alignSelf: 'flex-end' }} onClick={addItemToCart}>Ekle</button>
                     </div>
                  </div>
               </div>

               {/* Ürün Listesi - Masaüstü Tablo */}
               <div className="mobile-hide" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                     <thead style={{ background: 'var(--surface-color)', fontSize: '0.8rem' }}>
                        <tr>
                           <th style={{ padding: '0.8rem', textAlign: 'left' }}>Ürün</th>
                           <th style={{ padding: '0.8rem', textAlign: 'center' }}>Miktar / Birim</th>
                           <th style={{ padding: '0.8rem', textAlign: 'right' }}>{activeTab === 'IN' ? 'Alış Fiyatı (Hariç)' : 'Satış Fiyatı (Hariç)'}</th>
                           <th style={{ padding: '0.8rem', textAlign: 'center' }}>KDV %</th>
                           <th style={{ padding: '0.8rem', textAlign: 'right' }}>KDV Tutarı</th>
                           <th style={{ padding: '0.8rem', textAlign: 'right' }}>Toplam (Dahil)</th>
                           <th style={{ padding: '0.8rem', textAlign: 'center' }}>Sil</th>
                        </tr>
                     </thead>
                     <tbody>
                        {form.items.map((it, idx) => {
                           const netLine = Number(it.unit_price) * Number(it.quantity);
                           const taxLine = netLine * (Number(it.tax_rate) || 0) / 100;
                           const totalLine = netLine + taxLine;
                           return (
                           <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '0.8rem' }}>
                                 <div style={{ fontWeight: '600' }}>{it.product_name}</div>
                                 <small style={{ color: 'var(--text-muted)' }}>{it.barcode}</small>
                              </td>
                              <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                                 <input type="number" className="input-field" style={{ width: '55px', padding: '2px', textAlign: 'center' }} value={it.quantity} onChange={e => {
                                    const val = Number(e.target.value);
                                    const newItems = [...form.items];
                                    newItems[idx].quantity = val;
                                    newItems[idx].tax_amount = val * newItems[idx].unit_price * (newItems[idx].tax_rate || 0) / 100;
                                    newItems[idx].total_price = val * newItems[idx].unit_price * (1 + (newItems[idx].tax_rate || 0) / 100);
                                    setForm({...form, items: newItems});
                                 }} disabled={form.status === 'COMPLETED'} />
                                 <select 
                                    className="input-field" 
                                    style={{ width: '65px', padding: '2px', fontSize: '0.7rem', marginLeft: '4px' }}
                                    value={it.unit}
                                    onChange={e => {
                                       const newItems = [...form.items];
                                       newItems[idx].unit = e.target.value;
                                       setForm({...form, items: newItems});
                                    }}
                                    disabled={form.status === 'COMPLETED'}
                                 >
                                    {UNIQUE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                 </select>
                              </td>
                              <td style={{ padding: '0.8rem', textAlign: 'right' }}>
                                 <input type="number" step="0.01" className="input-field" style={{ width: '80px', padding: '2px', textAlign: 'right', display: 'inline-block' }} value={it.unit_price} onChange={e => {
                                    const val = Number(e.target.value);
                                    const newItems = [...form.items];
                                    newItems[idx].unit_price = val;
                                    newItems[idx].tax_amount = newItems[idx].quantity * val * (newItems[idx].tax_rate || 0) / 100;
                                    newItems[idx].total_price = newItems[idx].quantity * val * (1 + (newItems[idx].tax_rate || 0) / 100);
                                    setForm({...form, items: newItems});
                                 }} disabled={form.status === 'COMPLETED'} />
                                 <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '2px' }}>vergiler hariç</div>
                              </td>
                              <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                                 <input type="number" className="input-field" style={{ width: '50px', padding: '2px', textAlign: 'center' }} value={it.tax_rate} onChange={e => {
                                    const val = Number(e.target.value);
                                    const newItems = [...form.items];
                                    newItems[idx].tax_rate = val;
                                    newItems[idx].tax_amount = newItems[idx].quantity * newItems[idx].unit_price * val / 100;
                                    newItems[idx].total_price = newItems[idx].quantity * newItems[idx].unit_price * (1 + val / 100);
                                    setForm({...form, items: newItems});
                                 }} disabled={form.status === 'COMPLETED'} />
                              </td>
                              <td style={{ padding: '0.8rem', textAlign: 'right', color: 'var(--warning-color)', fontWeight: '600' }}>
                                 ₺{taxLine.toLocaleString('tr-TR', {minimumFractionDigits: 2})}
                              </td>
                              <td style={{ padding: '0.8rem', textAlign: 'right', fontWeight: '700' }}>
                                 <div>₺{totalLine.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</div>
                                 <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>vergiler dahil</small>
                              </td>
                              <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                                 <button style={{ color: 'var(--danger-color)', border: 'none', background: 'none', cursor: 'pointer', opacity: form.status === 'COMPLETED' ? 0.5 : 1 }} onClick={() => removeItemFromCart(idx)} disabled={form.status === 'COMPLETED'}><Trash2 size={16} /></button>
                              </td>
                           </tr>
                        )})}
                     </tbody>
                  </table>
               </div>
 
               {/* Ürün Listesi - Mobil Kartlar */}
               <div className="mobile-only" style={{ display: 'none', marginBottom: '1.5rem' }}>
                  <style>{`
                     @media (max-width: 768px) {
                        .mobile-only { display: block !important; }
                        .mobile-hide { display: none !important; }
                     }
                  `}</style>
                  {form.items.length === 0 ? (
                     <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', background: 'var(--bg-color)', borderRadius: '12px' }}>
                        Henüz ürün eklenmedi.
                     </div>
                  ) : (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {form.items.map((it, idx) => (
                           <div key={idx} style={{ background: 'var(--surface-color)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', position: 'relative' }}>
                              <button 
                                 style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', color: 'var(--danger-color)', border: 'none', background: 'none', cursor: 'pointer' }}
                                 onClick={() => removeItemFromCart(idx)}
                                 disabled={form.status === 'COMPLETED'}
                              >
                                 <Trash2 size={18} />
                              </button>
                              <div style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '0.25rem', paddingRight: '2rem' }}>{it.product_name}</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{it.barcode}</div>
                              
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                                 <div className="input-group">
                                    <label>Miktar</label>
                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                       <input type="number" className="input-field" value={it.quantity} onChange={e => {
                                          const val = Number(e.target.value);
                                          const newItems = [...form.items];
                                          newItems[idx].quantity = val;
                                          newItems[idx].tax_amount = val * newItems[idx].unit_price * (newItems[idx].tax_rate || 0) / 100;
                                          newItems[idx].total_price = val * newItems[idx].unit_price * (1 + (newItems[idx].tax_rate || 0) / 100);
                                          setForm({...form, items: newItems});
                                       }} disabled={form.status === 'COMPLETED'} />
                                       <select className="input-field" style={{ width: '80px' }} value={it.unit} onChange={e => {
                                          const newItems = [...form.items];
                                          newItems[idx].unit = e.target.value;
                                          setForm({...form, items: newItems});
                                       }} disabled={form.status === 'COMPLETED'}>
                                          {UNIQUE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                       </select>
                                    </div>
                                 </div>
                                 <div className="input-group">
                                    <label>Birim Fiyat</label>
                                    <input type="number" step="0.01" className="input-field" value={it.unit_price} onChange={e => {
                                       const val = Number(e.target.value);
                                       const newItems = [...form.items];
                                       newItems[idx].unit_price = val;
                                       newItems[idx].tax_amount = newItems[idx].quantity * val * (newItems[idx].tax_rate || 0) / 100;
                                       newItems[idx].total_price = newItems[idx].quantity * val * (1 + (newItems[idx].tax_rate || 0) / 100);
                                       setForm({...form, items: newItems});
                                    }} disabled={form.status === 'COMPLETED'} />
                                 </div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-color)', padding: '0.75rem', borderRadius: '8px' }}>
                                 <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>KDV (%{it.tax_rate}): ₺{ (Number(it.unit_price) * Number(it.quantity) * (Number(it.tax_rate) || 0) / 100).toLocaleString('tr-TR', {minimumFractionDigits: 2}) }</div>
                                 <div style={{ fontWeight: '700', color: 'var(--primary-color)' }}>₺{ (Number(it.unit_price) * Number(it.quantity) * (1 + (Number(it.tax_rate) || 0) / 100)).toLocaleString('tr-TR', {minimumFractionDigits: 2}) }</div>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>

               <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1.5rem' }}>
                  <div className="input-group mobile-full-width" style={{ flex: 1 }}>
                      <label>Depo Seçimi {form.status === 'COMPLETED' && <span style={{color:'var(--warning-color)', fontSize:'0.7rem'}}>(Onaylı Belge - Depo Değişirse Stok Aktarılır)</span>}</label>
                      <select className="input-field" value={form.location_id} onChange={e => setForm({...form, location_id: e.target.value})}>
                         {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                   </div>
                  <div className="mobile-full-width" style={{ textAlign: 'right', minWidth: '240px' }}>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem', background: 'var(--surface-color)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                           <span style={{ color: 'var(--text-muted)' }}>Vergiler Hariç:</span>
                           <span>₺{calculateNetTotal().toLocaleString('tr-TR', {minimumFractionDigits: 2})}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                           <span style={{ color: 'var(--warning-color)' }}>KDV Tutarı:</span>
                           <span style={{ color: 'var(--warning-color)', fontWeight: '600' }}>₺{calculateTaxTotal().toLocaleString('tr-TR', {minimumFractionDigits: 2})}</span>
                        </div>
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
                           <span style={{ fontWeight: '700' }}>Vergiler Dahil:</span>
                           <span style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--primary-color)' }}>₺{calculateTotal().toLocaleString('tr-TR', {minimumFractionDigits: 2})}</span>
                        </div>
                     </div>
                     <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }} className="mobile-stack">
                        {form.status !== 'COMPLETED' && <button className="btn btn-secondary mobile-full-width" onClick={saveDraft}>Taslak Kaydet</button>}
                        <button className="btn btn-primary mobile-full-width" style={{ background: 'var(--success-color)' }} onClick={completeDocument}>✔ İşlemi Onayla</button>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      )}

      {showQuickAdd && (
         <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card" style={{ width: '400px' }}>
               <h3 style={{ color: 'var(--warning-color)' }}>⚠️ Tanımsız Barkod: {quickAddForm.barcode}</h3>
               <div className="input-group"><label>Ürün Adı</label><input className="input-field" autoFocus value={quickAddForm.name} onChange={e => setQuickAddForm({...quickAddForm, name: e.target.value})} /></div>
               <div className="input-group"><label>Alış Fiyatı</label><input type="number" className="input-field" value={quickAddForm.cost_price} onChange={e => setQuickAddForm({...quickAddForm, cost_price: e.target.value})} /></div>
               <div className="input-group"><label>Satış Fiyatı</label><input type="number" className="input-field" value={quickAddForm.price} onChange={e => setQuickAddForm({...quickAddForm, price: e.target.value})} /></div>
               <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div className="input-group" style={{ flex: 1 }}><label>Birim</label>
                     <select className="input-field" value={quickAddForm.unit} onChange={e => setQuickAddForm({...quickAddForm, unit: e.target.value})}>
                        {UNIQUE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                     </select>
                  </div>
                  <div className="input-group" style={{ flex: 1 }}><label>KDV %</label><input type="number" className="input-field" value={quickAddForm.tax_rate} onChange={e => setQuickAddForm({...quickAddForm, tax_rate: e.target.value})} /></div>
               </div>
               <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button className="btn btn-secondary" onClick={() => setShowQuickAdd(false)}>İptal</button>
                  <button className="btn btn-primary" onClick={handleQuickAddProduct}>Kaydet ve Ekle</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}

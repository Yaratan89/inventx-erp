import { createPortal } from 'react-dom';
import { useState } from 'react';
import { Plus, TrendingUp, TrendingDown, X, Filter, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

const CATEGORIES_IN = ['Satış Geliri','Hizmet Geliri','Faiz Geliri','Kira Geliri','Diğer Gelir'];
const CATEGORIES_EX = ['Kira Gideri','Elektrik/Su','Personel','Ulaşım','Ofis Malzemesi','Reklam','Bakım/Onarım','Vergi/Harç','Diğer Gider'];

export default function IncomeExpenseTab({ records, taxRates, parties, onRefresh }) {
  const [showModal, setShowModal] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    type:'expense', category:'', description:'', amount:0,
    tax_rate:20, payment_method:'Cash', party_id:'', transaction_date: format(new Date(),'yyyy-MM-dd')
  });

  const totalIncome = records.filter(r=>r.type==='income').reduce((s,r)=>s+Number(r.amount),0);
  const totalExpense = records.filter(r=>r.type==='expense').reduce((s,r)=>s+Number(r.amount),0);
  const totalTax = records.reduce((s,r)=>s+Number(r.tax_amount||0),0);
  
  const filtered = records.filter(r => {
    const matchesType = filterType === 'all' || r.type === filterType;
    const partyName = parties.find(p => p.id === r.party_id)?.name || '';
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      r.category.toLowerCase().includes(searchLower) ||
      (r.description || '').toLowerCase().includes(searchLower) ||
      partyName.toLowerCase().includes(searchLower);
    return matchesType && matchesSearch;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = Number(form.amount);
    const rate = Number(form.tax_rate);
    const taxAmt = amt * (rate / (100 + rate));
    const netAmt = amt - taxAmt;
    
    // UUID alanı boş string kabul etmez, null gönderilmeli
    const insertData = {
      ...form,
      amount: amt,
      tax_rate: rate,
      tax_amount: Math.round(taxAmt*100)/100,
      net_amount: Math.round(netAmt*100)/100,
      party_id: form.party_id || null
    };

    const { error } = await supabase.from('income_expenses').insert([insertData]);
    if(error) { alert('Hata: '+error.message); return; }
    setShowModal(false);
    setForm({type:'expense',category:'',description:'',amount:0,tax_rate:20,payment_method:'Cash',party_id:'',transaction_date:format(new Date(),'yyyy-MM-dd')});
    onRefresh();
  };

  const cats = form.type==='income' ? CATEGORIES_IN : CATEGORIES_EX;

  return (
    <div>
      {/* Özet Kartları */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'1rem',marginBottom:'1.5rem'}}>
        {[
          {label:'Toplam Gelir',val:`₺${totalIncome.toLocaleString()}`,color:'var(--success-color)',bg:'var(--success-light)',icon:<TrendingUp size={20}/>},
          {label:'Toplam Gider',val:`₺${totalExpense.toLocaleString()}`,color:'var(--danger-color)',bg:'var(--danger-light)',icon:<TrendingDown size={20}/>},
          {label:'Net Kâr/Zarar',val:`₺${(totalIncome-totalExpense).toLocaleString()}`,color:totalIncome>=totalExpense?'var(--success-color)':'var(--danger-color)',bg:totalIncome>=totalExpense?'var(--success-light)':'var(--danger-light)',icon:<TrendingUp size={20}/>},
          {label:'Toplam KDV',val:`₺${totalTax.toLocaleString()}`,color:'var(--warning-color)',bg:'var(--warning-light)',icon:<Filter size={20}/>}
        ].map((c,i)=>(
          <div key={i} className="card" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><p style={{fontSize:'0.78rem',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.05em'}}>{c.label}</p>
            <p style={{fontSize:'1.4rem',fontWeight:'800',color:c.color,marginTop:'0.25rem'}}>{c.val}</p></div>
            <div style={{padding:'0.6rem',background:c.bg,borderRadius:'10px',color:c.color}}>{c.icon}</div>
          </div>
        ))}
      </div>

      {/* Filtre + Ekle */}
        <div style={{display:'flex',gap:'1rem',alignItems:'center'}}>
          <div style={{display:'flex',gap:'0.5rem',background:'var(--surface-hover)',padding:'0.4rem 1rem',borderRadius:'var(--radius-md)',border:'1px solid var(--border-color)'}}>
            <Filter size={16} color="var(--text-muted)" />
            <input 
              type="text" 
              placeholder="Kategori, Açıklama veya Cari ara..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{background:'transparent',border:'none',outline:'none',color:'inherit',fontSize:'0.85rem',width:'250px'}}
            />
          </div>
          <button className="btn btn-primary" onClick={()=>setShowModal(true)}><Plus size={18}/> Yeni Kayıt</button>
        </div>

      {/* Tablo */}
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr style={{borderBottom:'2px solid var(--border-color)'}}>
            {['Tarih','Tip','Cari','Kategori','Açıklama','Brüt Tutar','KDV','Net Tutar','Yöntem','İşlem'].map(h=>(
              <th key={h} style={{padding:'0.75rem 1rem',textAlign:'left',fontSize:'0.72rem',textTransform:'uppercase',color:'var(--text-muted)',letterSpacing:'0.06em'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map(r=>(
              <tr key={r.id} style={{borderBottom:'1px solid var(--border-color)'}}>
                <td style={{padding:'0.7rem 1rem',fontSize:'0.85rem'}}>{format(new Date(r.transaction_date),'dd.MM.yyyy')}</td>
                <td><span className={r.type==='income'?'badge badge-success':'badge badge-danger'}>{r.type==='income'?'GELİR':'GİDER'}</span></td>
                <td style={{padding:'0.7rem 1rem',fontSize:'0.85rem',fontWeight:'500'}}>
                    {parties.find(p => p.id === r.party_id)?.name || <span style={{color:'var(--text-muted)',fontSize:'0.75rem'}}>Genel</span>}
                </td>
                <td style={{padding:'0.7rem 1rem',fontSize:'0.85rem'}}>{r.category}</td>
                <td style={{padding:'0.7rem 1rem',fontSize:'0.85rem',color:'var(--text-muted)'}}>{r.description||'-'}</td>
                <td style={{padding:'0.7rem 1rem',fontWeight:'700'}}>₺{Number(r.amount).toLocaleString()}</td>
                <td style={{padding:'0.7rem 1rem',fontSize:'0.8rem',color:'var(--warning-color)'}}>₺{Number(r.tax_amount||0).toLocaleString()} (%{r.tax_rate})</td>
                <td style={{padding:'0.7rem 1rem',fontWeight:'600'}}>₺{Number(r.net_amount||0).toLocaleString()}</td>
                <td style={{padding:'0.7rem 1rem',fontSize:'0.8rem'}}>{r.payment_method==='Cash'?'Nakit':r.payment_method==='Bank'?'Havale':r.payment_method==='CreditCard'?'Kredi Kartı':'Çek'}</td>
                <td style={{padding:'0.7rem 1rem',textAlign:'center'}}>
                    <button 
                        className="btn btn-secondary p-1" 
                        style={{color:'var(--danger-color)'}} 
                        onClick={async () => {
                            if(confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
                                const { error } = await supabase.from('income_expenses').delete().eq('id', r.id);
                                if(error) alert('Hata: '+error.message);
                                else onRefresh();
                            }
                        }}
                    >
                        <Trash2 size={14} />
                    </button>
                </td>
              </tr>
            ))}
            {filtered.length===0 && <tr><td colSpan={10} style={{padding:'2rem',textAlign:'center',color:'var(--text-muted)'}}>Kayıt bulunamadı</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && createPortal(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:1100,display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'4rem 1rem'}}>
          <div className="card animate-fade-in" style={{width:'480px',padding:'2rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem'}}>
              <h3 style={{fontWeight:'700'}}>Yeni Gelir/Gider Kaydı</h3>
              <button className="btn btn-secondary" onClick={()=>setShowModal(false)}><X size={18}/></button>
            </div>
            <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
              <div style={{display:'flex',gap:'0.5rem'}}>
                <button type="button" className={`btn ${form.type==='income'?'btn-primary':' btn-secondary'}`} style={{flex:1}} onClick={()=>setForm({...form,type:'income',category:''})}>Gelir</button>
                <button type="button" className={`btn ${form.type==='expense'?'btn-primary':'btn-secondary'}`} style={{flex:1}} onClick={()=>setForm({...form,type:'expense',category:''})}>Gider</button>
              </div>
              <div className="input-group"><label>Kategori</label>
                <select className="input-field high-visibility-select" value={form.category} onChange={e=>setForm({...form,category:e.target.value})} required>
                  <option value="">Seçiniz...</option>{cats.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{display:'flex',gap:'1rem'}}>
                <div className="input-group" style={{flex:1}}><label>Brüt Tutar (₺)</label>
                  <input type="number" step="0.01" className="input-field" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} required/>
                </div>
                <div className="input-group" style={{flex:1}}><label>KDV Oranı</label>
                  <select className="input-field" value={form.tax_rate} onChange={e=>setForm({...form,tax_rate:e.target.value})}>
                    {taxRates.map(t=><option key={t.id} value={t.rate}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              {Number(form.amount)>0 && (
                <div style={{padding:'0.6rem 1rem',background:'rgba(27,99,216,0.1)',borderRadius:'8px',display:'flex',justifyContent:'space-between',fontSize:'0.85rem'}}>
                  <span style={{color:'var(--text-muted)'}}>KDV: ₺{(Number(form.amount)*Number(form.tax_rate)/(100+Number(form.tax_rate))).toFixed(2)}</span>
                  <span style={{fontWeight:'700',color:'var(--primary-color)'}}>Net: ₺{(Number(form.amount)-Number(form.amount)*Number(form.tax_rate)/(100+Number(form.tax_rate))).toFixed(2)}</span>
                </div>
              )}
              <div className="input-group"><label>Açıklama</label><input className="input-field" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
              <div style={{display:'flex',gap:'1rem'}}>
                <div className="input-group" style={{flex:1}}><label>Ödeme Yöntemi</label>
                  <select className="input-field" value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value})}>
                    <option value="Cash">Nakit</option>
                    <option value="Bank">Havale/EFT</option>
                    <option value="CreditCard">Kredi Kartı</option>
                    <option value="Partner_Paid">Ortak Cebinden (Cariye Alacak)</option>
                    <option value="Check">Çek</option>
                  </select>
                </div>
                <div className="input-group" style={{flex:1}}><label>Tarih</label>
                  <input type="date" className="input-field" value={form.transaction_date} onChange={e=>setForm({...form,transaction_date:e.target.value})}/>
                </div>
              </div>
              <div className="input-group"><label>İlişkili Cari (Opsiyonel)</label>
                <select className="input-field" value={form.party_id} onChange={e=>setForm({...form,party_id:e.target.value})}>
                  <option value="">Seçilmedi</option>{parties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{display:'flex',gap:'1rem',marginTop:'0.5rem'}}>
                <button type="button" className="btn btn-secondary" style={{flex:1}} onClick={()=>setShowModal(false)}>İptal</button>
                <button type="submit" className="btn btn-primary" style={{flex:2}}>✓ Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </div>
  );
}

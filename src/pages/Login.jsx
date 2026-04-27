import { useState } from 'react';
import { Package, Lock, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const { error } = await signIn({ email, password });
    
    if (error) {
      if (error.message.includes('Email not confirmed')) {
        setError("Giriş yapılamadı: Lütfen e-postanıza gönderilen onay bağlantısına tıklayın.");
      } else if (error.message.includes('Invalid login credentials')) {
        setError("E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.");
      } else {
        setError("Giriş sırasında bir hata oluştu: " + error.message);
      }
    } else {
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, var(--surface-color) 0%, var(--bg-color) 100%)' }}>
      <div className="card animate-fade-in glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '56px', height: '56px', background: 'var(--primary-color)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', boxShadow: 'var(--shadow-glow)' }}>
            <Package size={28} color="white" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Sisteme Giriş</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.5rem' }}>E-posta ve şifrenizi giriniz</p>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-light)', color: 'var(--danger-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '1.5rem', border: '1px solid var(--danger-color)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="input-group">
            <label>E-posta Adresi</label>
            <div style={{ position: 'relative' }}>
              <Mail style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
              <input type="email" className="input-field" style={{ paddingLeft: '2.75rem' }} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@inventx.com" required />
            </div>
          </div>
          <div className="input-group">
            <label>Şifre</label>
             <div style={{ position: 'relative' }}>
              <Lock style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
              <input type="password" className="input-field" style={{ paddingLeft: '2.75rem' }} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '0.875rem', fontSize: '1rem' }}>
                Giriş Yap
              </button>
              <button type="button" onClick={async () => {
                setLoading(true);
                setError('');
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) {
                  setError("Kayıt hatası: " + error.message);
                } else {
                  setError("Kayıt başarılı! E-posta doğrulaması kapalıysa doğrudan giriş yapabilirsiniz.");
                }
                setLoading(false);
              }} className="btn btn-secondary" style={{ flex: 1, padding: '0.875rem', fontSize: '1rem' }}>
                Kayıt Ol
              </button>
            </div>
            
            <button 
              type="button" 
              onClick={() => {
                // AuthContext içindeki özel bypass mekanizmasını tetikle
                window.dispatchEvent(new CustomEvent('bypass-login', { detail: { email: 'admin@inventx.com', role: 'admin' } }));
                navigate('/');
              }} 
              className="btn btn-secondary" 
              style={{ width: '100%', padding: '0.875rem', fontSize: '0.9rem', border: '1px dashed var(--primary-color)', color: 'var(--primary-color)', background: 'var(--primary-light)' }}
            >
              🚀 Hızlı Giriş (Süper Admin)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

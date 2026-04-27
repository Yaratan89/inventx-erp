import { useState } from 'react';
import { Package, Lock, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
        setError("Giriş yapılamadı: E-posta onayı gerekiyor. Lütfen yöneticinizle iletişime geçin.");
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
      <div className="card animate-fade-in glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem', margin: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '56px', height: '56px', background: 'var(--primary-color)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', boxShadow: 'var(--shadow-glow)' }}>
            <Package size={28} color="white" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', letterSpacing: '-0.5px' }}>INVENTX</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.5rem', textAlign: 'center' }}>
            Kullanıcı bilgilerinizi giriniz
          </p>
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
              <input
                type="email"
                className="input-field"
                style={{ paddingLeft: '2.75rem' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kullanici@sirket.com"
                required
              />
            </div>
          </div>
          <div className="input-group">
            <label>Şifre</label>
            <div style={{ position: 'relative' }}>
              <Lock style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
              <input
                type="password"
                className="input-field"
                style={{ paddingLeft: '2.75rem' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: '0.875rem', fontSize: '1rem', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '1.5rem' }}>
          Hesabınız yoksa sisteme erişim için yöneticinize başvurunuz.
        </p>
      </div>
    </div>
  );
}

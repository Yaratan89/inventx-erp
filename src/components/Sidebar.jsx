import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, FileText, Settings, Settings2, LogOut, MapPin, ArrowRightLeft, Users, ShoppingCart, TrendingUp, RefreshCw, Tag, RotateCcw, Wallet, ChevronDown, ChevronRight, Box, Scale, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

export default function Sidebar({ onClose }) {
  const { signOut, isAdmin } = useAuth();
  const [stokOpen, setStokOpen] = useState(true);
  const [finansOpen, setFinansOpen] = useState(true);

  const navStyle = ({ isActive }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1.5rem',
    color: isActive ? 'var(--primary-color)' : 'var(--text-muted)',
    textDecoration: 'none',
    borderLeft: isActive ? '3px solid var(--primary-color)' : '3px solid transparent',
    backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
    fontWeight: isActive ? '600' : '400',
    transition: 'all var(--transition-fast)'
  });

  const subNavStyle = ({ isActive }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.55rem 1.5rem 0.55rem 2.75rem',
    color: isActive ? 'var(--primary-color)' : 'var(--text-muted)',
    textDecoration: 'none',
    borderLeft: isActive ? '3px solid var(--primary-color)' : '3px solid transparent',
    backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
    fontWeight: isActive ? '600' : '400',
    fontSize: '0.88rem',
    transition: 'all var(--transition-fast)'
  });

  return (
    <aside className="sidebar">
      <div style={{ padding: '0 1.5rem 2rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ width: '32px', height: '32px', background: 'var(--primary-color)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Package size={18} color="white" />
        </div>
        <h2 style={{ fontSize: '1.25rem', color: 'white', fontWeight: '700', letterSpacing: '1px' }}>INVENTX</h2>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1, overflowY: 'auto' }}>
        <NavLink onClick={onClose} to="/" style={navStyle}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink onClick={onClose} to="/reports" style={navStyle}>
          <TrendingUp size={20} />
          <span>Raporlar</span>
        </NavLink>
        <NavLink onClick={onClose} to="/products" style={navStyle}>
          <Box size={20} />
          <span>Ürün Yönetimi</span>
        </NavLink>
        <NavLink onClick={onClose} to="/accounts" style={navStyle}>
          <Users size={20} />
          <span>Cari Takip</span>
        </NavLink>

        {/* Stok İşlemleri Alt Menüsü */}
        <button
          onClick={() => setStokOpen(!stokOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1.5rem', width: '100%', border: 'none',
            background: stokOpen ? 'rgba(27,99,216,0.06)' : 'transparent',
            color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: '0.95rem', fontWeight: '500', textAlign: 'left',
            borderLeft: '3px solid transparent',
            transition: 'all var(--transition-fast)'
          }}
        >
          <Box size={20} />
          <span style={{ flex: 1 }}>Stok İşlemleri</span>
          {stokOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {stokOpen && (
          <div style={{ background: 'rgba(0,0,0,0.15)' }}>
            <NavLink onClick={onClose} to="/stock-documents" style={subNavStyle}>
              <FileText size={17} />
              <span>Stok Giriş&Çıkış</span>
            </NavLink>
            <NavLink onClick={onClose} to="/audit" style={subNavStyle}>
              <RefreshCw size={17} />
              <span>Stok Sayım</span>
            </NavLink>
            <NavLink onClick={onClose} to="/returns" style={subNavStyle}>
              <RotateCcw size={17} />
              <span>İade İşlemleri</span>
            </NavLink>
            <NavLink onClick={onClose} to="/document-report" style={subNavStyle}>
              <FileText size={17} />
              <span>Belge Raporu</span>
            </NavLink>
            <NavLink onClick={onClose} to="/transfers" style={subNavStyle}>
              <ArrowRightLeft size={17} />
              <span>Transferler</span>
            </NavLink>
          </div>
        )}

        <NavLink onClick={onClose} to="/labels" style={navStyle}>
          <Tag size={20} />
          <span>Etiket Tasarımı</span>
        </NavLink>
        {/* Finans Alt Menüsü */}
        <button
          onClick={() => setFinansOpen(!finansOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1.5rem', width: '100%', border: 'none',
            background: finansOpen ? 'rgba(27,99,216,0.06)' : 'transparent',
            color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: '0.95rem', fontWeight: '500', textAlign: 'left',
            borderLeft: '3px solid transparent',
            transition: 'all var(--transition-fast)'
          }}
        >
          <Wallet size={20} />
          <span style={{ flex: 1 }}>Finans Yönetimi</span>
          {finansOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {finansOpen && (
          <div style={{ background: 'rgba(0,0,0,0.15)' }}>
            <NavLink onClick={onClose} to="/finance" style={subNavStyle}>
              <Wallet size={17} />
              <span>Finans İşlemleri</span>
            </NavLink>
            <NavLink onClick={onClose} to="/tax-report" style={subNavStyle}>
              <Scale size={17} />
              <span>KDV Raporu</span>
            </NavLink>
          </div>
        )}
        <NavLink onClick={onClose} to="/locations" style={navStyle}>
          <MapPin size={20} />
          <span>Lokasyonlar</span>
        </NavLink>
        <NavLink onClick={onClose} to="/audit-logs" style={navStyle}>
          <FileText size={20} />
          <span>Denetim İzi</span>
        </NavLink>
        {isAdmin && (
          <>
            <NavLink onClick={onClose} to="/integrations" style={navStyle}>
              <Settings2 size={20} />
              <span>Entegrasyonlar</span>
            </NavLink>
            <NavLink onClick={onClose} to="/personnel" style={navStyle}>
              <UserCheck size={20} />
              <span>Personel Yönetimi</span>
            </NavLink>
            <NavLink onClick={onClose} to="/settings" style={navStyle}>
              <Settings size={20} />
              <span>Ayarlar</span>
            </NavLink>
          </>
        )}
      </nav>

      <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
        <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }} onClick={() => signOut()}>
           <LogOut size={18} />
           Çıkış Yap
        </button>
      </div>
    </aside>
  );
}

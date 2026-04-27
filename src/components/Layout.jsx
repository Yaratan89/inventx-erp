import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useState } from 'react';
import { Menu } from 'lucide-react';

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="layout-container bg-opacity-90">
      <div className={`sidebar-wrapper ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)}></div>
        <Sidebar onClose={() => setMobileMenuOpen(false)} />
      </div>
      <main className="main-content">
        <header style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(true)}>
              <Menu size={22} color="var(--text-main)" />
            </button>
            <h1 style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '1.1rem' }}>Acme Co. Envanter</h1>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
             <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem', color: 'white' }}>
               A
             </div>
          </div>
        </header>

        {/* Child routes render here */}
        <div className="animate-fade-in" style={{ height: 'calc(100% - 60px)' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="layout-container bg-opacity-90">
      <Sidebar />
      <main className="main-content">
        <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontWeight: '500', color: 'var(--text-main)', fontSize: '1.2rem' }}>Acme Co. Envanter</h1>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
             <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
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

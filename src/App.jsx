import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import AuditLogs from './pages/AuditLogs';
import Integrations from './pages/Integrations';
import Locations from './pages/Locations';
import Transfers from './pages/Transfers';
import Settings from './pages/Settings';
import Accounts from './pages/Accounts';
import Sales from './pages/Sales';
import InventoryAudit from './pages/InventoryAudit';
import Returns from './pages/Returns';
import LabelDesigner from './pages/LabelDesigner';
import Reports from './pages/Reports';
import DocumentReport from './pages/DocumentReport';
import StockDocuments from './pages/StockDocuments';
import Finance from './pages/Finance';
import TaxReport from './pages/TaxReport';
import Personnel from './pages/Personnel';
import { AuthProvider, useAuth } from './context/AuthContext';

// Basit bir protected route bileşeni
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="reports" element={<Reports />} />
             <Route path="stock-documents" element={<StockDocuments />} />
             <Route path="audit" element={<InventoryAudit />} />
             <Route path="returns" element={<Returns />} />
             <Route path="document-report" element={<DocumentReport />} />
             <Route path="labels" element={<LabelDesigner />} />
             <Route path="accounts" element={<Accounts />} />
             <Route path="finance" element={<Finance />} />
             <Route path="tax-report" element={<TaxReport />} />
             <Route path="personnel" element={<Personnel />} />
            <Route path="locations" element={<Locations />} />
            <Route path="transfers" element={<Transfers />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

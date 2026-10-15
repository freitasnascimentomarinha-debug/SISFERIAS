
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { MemoryRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { VacationProvider } from './contexts/VacationContext';
import Header from './components/Header';
import Login from './pages/Login';
import ChangePasswordModal from './components/ChangePasswordModal';

// As demais telas são carregadas só quando abertas: a primeira abertura do
// sistema fica mais leve, principalmente em redes lentas.
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Register = lazy(() => import('./pages/Register'));
const VacationForm = lazy(() => import('./pages/VacationForm'));
const CalendarView = lazy(() => import('./pages/CalendarView'));
const Security = lazy(() => import('./pages/Security'));
const PrintVacation = lazy(() => import('./pages/PrintVacation'));
const Justifications = lazy(() => import('./pages/Justifications'));
const Tramite = lazy(() => import('./pages/Tramite'));
const Suggestions = lazy(() => import('./pages/Suggestions'));

const PageLoading: React.FC = () => (
  <div className="flex items-center justify-center py-32 text-slate-400 text-sm font-bold">Carregando...</div>
);

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role !== 'admin') return <Navigate to="/home" />;
  return <>{children}</>;
};

/** Área de Segurança: só o administrador com Visão Global (Departamento de Pessoal). */
const GlobalAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role !== 'admin' || !user.viewAllSectors) return <Navigate to="/home" />;
  return <>{children}</>;
};

/**
 * Faixa exibida em todas as telas do ambiente de homologação (DCTIMARINST
 * 30-17, item 4.3: ambiente separado, somente com dados fictícios).
 */
const EnvironmentBanner: React.FC = () => {
  const [environment, setEnvironment] = useState('producao');
  useEffect(() => {
    fetch('/api/ambiente').then(r => r.json()).then(d => setEnvironment(d.environment || 'producao')).catch(() => {});
  }, []);
  if (environment === 'producao') return null;
  return (
    <div className="bg-amber-400 text-amber-950 text-center text-[11px] font-black uppercase tracking-widest py-1.5 no-print" role="status">
      Ambiente de {environment === 'homologacao' ? 'homologação' : environment} — use somente dados fictícios
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user } = useAuth();
  return (
    <div className="min-h-screen">
      <EnvironmentBanner />
      {user?.mustChangePassword && <ChangePasswordModal forced />}
      <Header />
      <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="/" element={<AdminRoute><Dashboard /></AdminRoute>} />
        <Route path="/justifications" element={<AdminRoute><Justifications /></AdminRoute>} />
        <Route path="/tramite" element={<AdminRoute><Tramite /></AdminRoute>} />
        <Route path="/vacation-form" element={<PrivateRoute><VacationForm /></PrivateRoute>} />
        <Route path="/vacation-form/:id" element={<PrivateRoute><VacationForm /></PrivateRoute>} />
        <Route path="/vacation-form/user/:userId" element={<PrivateRoute><VacationForm /></PrivateRoute>} />
        <Route path="/calendar" element={<AdminRoute><CalendarView /></AdminRoute>} />
        <Route path="/print" element={<PrivateRoute><PrintVacation /></PrivateRoute>} />
        <Route path="/print/:id" element={<PrivateRoute><PrintVacation /></PrivateRoute>} />
        <Route path="/suggestions" element={<PrivateRoute><Suggestions /></PrivateRoute>} />
        <Route path="/security" element={<GlobalAdminRoute><Security /></GlobalAdminRoute>} />
        <Route path="*" element={<Navigate to="/home" />} />
      </Routes>
      </Suspense>
    </div>
  );
};


class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Algo deu errado.</h1>
          <p className="text-slate-600 mb-4">Ocorreu um erro inesperado na aplicação.</p>
          <pre className="bg-slate-100 p-4 rounded text-left text-xs overflow-auto max-w-2xl mx-auto border border-red-200">
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-black transition-colors"
          >
            Recarregar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <VacationProvider>
            <AppContent />
          </VacationProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
};

export default App;


import React from 'react';
import { MemoryRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { VacationProvider } from './contexts/VacationContext';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import VacationForm from './pages/VacationForm';
import CalendarView from './pages/CalendarView';
import Security from './pages/Security';
import PrintVacation from './pages/PrintVacation';

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

const AppContent: React.FC = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="/" element={<AdminRoute><Dashboard /></AdminRoute>} />
        <Route path="/vacation-form" element={<PrivateRoute><VacationForm /></PrivateRoute>} />
        <Route path="/vacation-form/:id" element={<PrivateRoute><VacationForm /></PrivateRoute>} />
        <Route path="/vacation-form/user/:userId" element={<PrivateRoute><VacationForm /></PrivateRoute>} />
        <Route path="/calendar" element={<AdminRoute><CalendarView /></AdminRoute>} />
        <Route path="/print" element={<PrivateRoute><PrintVacation /></PrivateRoute>} />
        <Route path="/print/:id" element={<PrivateRoute><PrintVacation /></PrivateRoute>} />
        <Route path="/security" element={<PrivateRoute><Security /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/home" />} />
      </Routes>
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

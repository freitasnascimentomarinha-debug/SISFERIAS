
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Sun, LayoutDashboard, Calendar, FileText, ShieldAlert, PlusCircle, Home, Menu, X, MessageSquare } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (!user) return null;

  const allNavItems = [
    { label: 'Início', path: '/home', icon: <Home size={18} /> },
    { label: 'Painel', path: '/', icon: <LayoutDashboard size={18} />, adminOnly: true },
    { label: 'Justificativas', path: '/justifications', icon: <MessageSquare size={18} />, adminOnly: true },
    { label: 'Trâmite', path: '/tramite', icon: <FileText size={18} />, adminOnly: true },
    { label: 'Lançar Férias', path: '/vacation-form', icon: <PlusCircle size={18} /> },
    { label: 'Calendário', path: '/calendar', icon: <Calendar size={18} />, adminOnly: true },
    { label: 'Impressão', path: '/print', icon: <FileText size={18} /> },
    { label: 'Segurança', path: '/security', icon: <ShieldAlert size={18} /> },
  ];

  const navItems = allNavItems.filter(item => !item.adminOnly || user.role === 'admin');

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button - Visible only on mobile */}
            <button
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>

            <div className="p-2 bg-orange-100 rounded-lg text-orange-500">
              <Sun size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-900 leading-tight">SISFÉRIAS</h1>
              <p className="text-[10px] font-bold text-orange-600 tracking-widest">MARINHA DO BRASIL</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${location.pathname === item.path
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                  }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-900">Olá, {user.name.split(' ')[0]}</p>
              <p className="text-xs text-slate-500 font-bold">{user.role === 'admin' ? 'Administrador' : 'Usuário'}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar (Drawer) */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />

          {/* Sidebar Panel */}
          <nav className="absolute top-0 bottom-0 left-0 w-64 bg-orange-500 p-4 shadow-xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="flex items-center justify-between mb-8 border-b border-orange-400 pb-4">
              <div className="flex items-center gap-2 text-white">
                <Sun size={24} className="text-white" />
                <div>
                  <h2 className="font-bold text-lg leading-tight">SISFÉRIAS</h2>
                  <p className="text-[10px] font-bold opacity-75 tracking-widest">MARINHA DO BRASIL</p>
                </div>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 text-white hover:bg-orange-600 rounded-lg"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex flex-col gap-2 flex-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${location.pathname === item.path
                      ? 'bg-white text-orange-600 shadow-sm'
                      : 'text-white hover:bg-orange-600'
                    }`}
                >
                  {React.cloneElement(item.icon as React.ReactElement, { size: 20 })}
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="mt-auto border-t border-orange-400 pt-4">
              <div className="flex items-center gap-3 px-2 mb-4">
                <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                  {user.name.charAt(0)}
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{user.name.split(' ')[0]}</p>
                  <p className="text-orange-200 text-xs">{user.role === 'admin' ? 'Administrador' : 'Usuário'}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-4 py-3 text-white hover:bg-orange-600 rounded-lg transition-colors"
              >
                <LogOut size={20} />
                Sair
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
};

export default Header;
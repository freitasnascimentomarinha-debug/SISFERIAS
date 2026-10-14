
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sun, Mail, Lock, Eye, EyeOff, Info, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const [emailOrNip, setEmailOrNip] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(emailOrNip, password);
      navigate('/home');
    } catch (err) {
      setError(err instanceof Error && err.message
        ? err.message
        : 'Credenciais inválidas. Verifique seu e-mail/NIP e senha.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 relative">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-orange-400 mx-auto mb-4">
          <Sun size={32} />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">SISFERIAS</h1>
        <p className="text-slate-500">Gerencie suas férias de forma simples</p>
      </div>

      <div className="w-full max-w-md bg-white rounded-[32px] shadow-2xl border border-slate-100 p-10 relative z-50">
        <div className="mb-8">
          <h2 className="text-2xl font-black text-slate-900">Entrar</h2>
          <p className="text-sm text-slate-500 font-medium">Acesse sua conta para gerenciar suas férias</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold mb-6 flex items-center gap-2 border border-red-100 animate-in fade-in slide-in-from-top-2">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">E-mail ou NIP</label>
            <div className="relative group">
              <input
                type="text"
                required
                value={emailOrNip}
                onChange={(e) => setEmailOrNip(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none text-sm font-medium cursor-text"
                placeholder="seu@email.com ou seu NIP"
              />
              <User 
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors pointer-events-none" 
                size={18} 
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Senha</label>
            <div className="relative group">
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none text-sm font-medium cursor-text"
                placeholder="********"
              />
              <Lock 
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors pointer-events-none" 
                size={18} 
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors p-1"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl transition-all shadow-xl shadow-orange-500/20 active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest text-sm"
            >
              {loading ? 'Processando...' : 'Entrar'}
            </button>
            <p className="text-center text-[10px] font-bold text-slate-400 flex items-center justify-center gap-1.5">
              <Info size={12} /> Esqueceu a senha? Contate o Admin
            </p>
          </div>
        </form>

        <div className="mt-10 text-center text-xs font-bold">
          <span className="text-slate-400">Não tem conta? </span>
          <Link to="/register" className="text-orange-500 hover:text-orange-600 transition-colors">Cadastre-se</Link>
        </div>
      </div>

      <div className="mt-12 text-slate-400 text-center">
        <div className="text-[10px] font-black uppercase tracking-[0.2em]">Idealização e Desenvolvimento</div>
        <div className="mt-1 text-[9px] font-bold">Centro de Operações do Abastecimento</div>
        <div className="mt-4 text-[8px] italic opacity-60 tracking-widest">Versão 001.2026</div>
      </div>
    </div>
  );
};

export default Login;

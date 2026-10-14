
import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sun, Mail, Lock, User, Eye, EyeOff, AlertTriangle, CheckCircle2, Shield } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { SECTORS, PRACA_RANKS, OFICIAL_RANKS, CIVIL_RANKS } from '../types';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [warName, setWarName] = useState('');
  const [nip, setNip] = useState('');
  const [category, setCategory] = useState('praca');
  const [sector, setSector] = useState('01');
  const [isCustomSector, setIsCustomSector] = useState(false);
  const [rank, setRank] = useState(PRACA_RANKS[0]);
  const [specialization, setSpecialization] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const ranks = useMemo(() => {
    return category === 'praca' ? PRACA_RANKS : category === 'oficial' ? OFICIAL_RANKS : CIVIL_RANKS;
  }, [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (password !== confirmPass) {
      setError('As senhas não coincidem!');
      return;
    }
    
    setLoading(true);
    const result = await register(name, email, password, 'user', {
      warName, nip, category, sector, rank, specialization: specialization.trim()
    });
    
    if (result.success) {
      if (result.userId) {
        const storageKey = `vacation_print_u_${result.userId}_v15`;
        const savedRaw = localStorage.getItem(storageKey);
        let savedData: Record<string, any> = {};
        if (savedRaw) {
          try {
            const parsed = JSON.parse(savedRaw);
            savedData = parsed && typeof parsed === 'object' ? parsed : {};
          } catch {
            savedData = {};
          }
        }
        localStorage.setItem(storageKey, JSON.stringify({
          ...savedData,
          specialization: specialization.trim()
        }));
      }
      setSuccess('Cadastro realizado com sucesso! Redirecionando para o login...');
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } else {
      const normalizedMessage = (result.errorMessage || '').toLowerCase();
      const isDuplicatedEmail =
        normalizedMessage.includes('already registered') ||
        normalizedMessage.includes('already exists') ||
        normalizedMessage.includes('duplicate key') ||
        normalizedMessage.includes('duplicate') ||
        normalizedMessage.includes('já está cadastrado') ||
        normalizedMessage.includes('ja esta cadastrado') ||
        result.errorCode === '23505' ||
        result.errorCode === 'user_already_exists';

      if (isDuplicatedEmail) {
        setError('Este e-mail ja esta cadastrado no sistema.');
      } else {
        setError(result.errorMessage || 'Nao foi possivel concluir o cadastro. Tente novamente.');
      }
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
        <p className="text-slate-500">Crie sua conta para começar</p>
      </div>

      <div className="w-full max-w-md bg-white rounded-[32px] shadow-2xl border border-slate-100 p-10 relative z-50">
        <h2 className="text-2xl font-black text-slate-900 mb-2">Cadastrar</h2>
        <p className="text-sm text-slate-500 font-medium mb-8">Preencha os dados para criar sua conta</p>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold mb-6 flex items-center gap-2 border border-red-100 animate-in fade-in slide-in-from-top-2">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-600 p-4 rounded-xl text-xs font-bold mb-6 flex items-center gap-2 border border-green-100 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Nome completo</label>
            <div className="relative group">
              <input 
                required 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none text-sm font-medium cursor-text" 
                placeholder="Seu nome completo" 
                disabled={loading || !!success}
              />
              <User 
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors pointer-events-none" 
                size={18} 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Nome de Guerra</label>
            <div className="relative group">
              <input 
                required 
                value={warName} 
                onChange={e => setWarName(e.target.value)} 
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none text-sm font-medium cursor-text" 
                placeholder="Nome de guerra" 
                disabled={loading || !!success}
              />
              <Shield 
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors pointer-events-none" 
                size={18} 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">NIP</label>
            <div className="relative group">
              <input 
                required 
                value={nip} 
                onChange={e => setNip(e.target.value)} 
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none text-sm font-medium cursor-text" 
                placeholder="Número de Identificação Pessoal" 
                disabled={loading || !!success}
              />
              <User 
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors pointer-events-none" 
                size={18} 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Categoria</label>
              <select 
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none text-sm font-medium"
                value={category}
                onChange={e => {
                  const newCat = e.target.value;
                  setCategory(newCat);
                  const newRanks = newCat === 'praca' ? PRACA_RANKS : newCat === 'oficial' ? OFICIAL_RANKS : CIVIL_RANKS;
                  setRank(newRanks[0]);
                }}
                disabled={loading || !!success}
              >
                <option value="praca">Praça</option>
                <option value="oficial">Oficial</option>
                <option value="civil">Servidor Civil</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Posto/Graduação</label>
              <select 
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none text-sm font-medium"
                value={rank}
                onChange={e => setRank(e.target.value)}
                disabled={loading || !!success}
              >
                {ranks.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Quadro / Esp.</label>
            <input
              value={specialization}
              onChange={e => setSpecialization(e.target.value.toUpperCase())}
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none text-sm font-medium"
              placeholder="Opcional"
              maxLength={6}
              disabled={loading || !!success}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Setor</label>
            {isCustomSector ? (
              <div className="flex gap-2">
                <input 
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none text-sm font-medium flex-1"
                  value={sector}
                  onChange={e => setSector(e.target.value)}
                  placeholder="Nome do novo setor"
                  disabled={loading || !!success}
                  autoFocus
                />
                <button type="button" onClick={() => { setIsCustomSector(false); setSector(SECTORS[0]); }} className="px-3 py-1 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
              </div>
            ) : (
              <select 
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none text-sm font-medium"
                value={sector}
                onChange={e => { if (e.target.value === '__new__') { setIsCustomSector(true); setSector(''); } else { setSector(e.target.value); } }}
                disabled={loading || !!success}
              >
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="__new__">+ Cadastrar novo setor...</option>
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">E-mail</label>
            <div className="relative group">
              <input 
                required 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none text-sm font-medium cursor-text" 
                placeholder="seu@email.com" 
                disabled={loading || !!success}
              />
              <Mail 
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors pointer-events-none" 
                size={18} 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Senha</label>
            <div className="relative group">
              <input 
                required 
                type={showPass ? 'text' : 'password'} 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none text-sm font-medium cursor-text" 
                placeholder="********" 
                disabled={loading || !!success}
              />
              <Lock 
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors pointer-events-none" 
                size={18} 
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors p-1"
                disabled={loading || !!success}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Confirmar senha</label>
            <div className="relative group">
              <input 
                required 
                type={showPass ? 'text' : 'password'} 
                value={confirmPass} 
                onChange={e => setConfirmPass(e.target.value)} 
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none text-sm font-medium cursor-text" 
                placeholder="********" 
                disabled={loading || !!success}
              />
              <Lock 
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors pointer-events-none" 
                size={18} 
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading || !!success} 
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl transition-all shadow-xl shadow-orange-500/20 active:scale-[0.98] uppercase tracking-widest text-sm disabled:opacity-50"
          >
            {loading ? 'Cadastrando...' : success ? 'Sucesso!' : 'Cadastrar'}
          </button>
        </form>

        <p className="mt-10 text-center text-xs font-bold">
          <span className="text-slate-400">Já tem conta? </span>
          <Link to="/login" className="text-orange-500 hover:text-orange-600 transition-colors">Fazer login</Link>
        </p>
      </div>

      <div className="mt-12 text-slate-400 text-center">
        <div className="text-[10px] font-black uppercase tracking-[0.2em]">Idealização e Desenvolvimento</div>
        <div className="mt-1 text-[9px] font-bold">Centro de Operações do Abastecimento</div>
      </div>
    </div>
  );
};

export default Register;
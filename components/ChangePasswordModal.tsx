import React, { useState } from 'react';
import { Key, X, CheckCircle2, LogOut, ShieldAlert } from 'lucide-react';
import { api } from '../lib/api';
import { passwordRuleMessage } from '../lib/password';
import { useAuth } from '../contexts/AuthContext';
import PasswordRules from './PasswordRules';

/**
 * Janela para o usuário logado trocar a própria senha (exige a senha atual).
 * Com `forced`, é a troca obrigatória da senha provisória (DCTIMBOTEC 31/002,
 * item 3.2.d): não pode ser fechada, só concluída ou abandonada saindo do sistema.
 */
const ChangePasswordModal: React.FC<{ onClose?: () => void; forced?: boolean }> = ({ onClose, forced = false }) => {
  const { setCurrentUser, logout, fetchAllUsers } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const ruleError = passwordRuleMessage(next);
    if (ruleError) return setError(ruleError);
    if (next !== confirm) return setError('As senhas não coincidem.');
    if (next === current) return setError('A nova senha deve ser diferente da atual.');
    setSaving(true);
    try {
      const result = await api.post<{ user: any }>('/auth/password', { current_password: current, password: next });
      setDone(true);
      setTimeout(() => {
        if (result?.user) setCurrentUser(result.user);
        if (forced) void fetchAllUsers();
        onClose?.();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível alterar a senha.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 no-print">
      <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden" role="dialog" aria-label={forced ? 'Troca obrigatória de senha' : 'Alterar minha senha'}>
        <div className="bg-orange-500 p-6 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            {forced ? <ShieldAlert size={24} /> : <Key size={24} />}
            <h3 className="font-bold text-lg">{forced ? 'Defina uma Nova Senha' : 'Alterar Minha Senha'}</h3>
          </div>
          {!forced && <button onClick={onClose} className="hover:bg-white/20 p-1.5 rounded-full transition-colors" aria-label="Fechar"><X size={20} /></button>}
        </div>
        {done ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <CheckCircle2 size={56} className="text-green-500" />
            <p className="font-bold text-slate-900">Senha alterada com sucesso!</p>
          </div>
        ) : (
          <form onSubmit={submit} className="p-8 space-y-4" autoComplete="off">
            {forced && (
              <p className="text-xs font-bold text-slate-600 bg-orange-50 border border-orange-100 rounded-xl p-3">
                Sua senha atual é provisória (definida pelo administrador ou fora da regra de segurança).
                Para continuar, cadastre uma senha pessoal.
              </p>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{forced ? 'Senha atual (provisória)' : 'Senha atual'}</label>
              <input type="password" autoComplete="off" required className={inputClass} value={current} onChange={e => setCurrent(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nova senha</label>
              <input type="password" autoComplete="off" required className={inputClass} value={next} onChange={e => setNext(e.target.value)} />
            </div>
            <PasswordRules password={next} />
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confirmar nova senha</label>
              <input type="password" autoComplete="off" required className={inputClass} value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
            <div className="flex gap-3 pt-2">
              {forced ? (
                <button type="button" onClick={logout} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all flex items-center justify-center gap-2"><LogOut size={16} /> Sair</button>
              ) : (
                <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
              )}
              <button type="submit" disabled={saving} className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-xl shadow-lg hover:bg-orange-600 disabled:opacity-60 transition-all">
                {saving ? 'Salvando...' : 'Salvar Senha'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChangePasswordModal;

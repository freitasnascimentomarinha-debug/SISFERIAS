import React, { useState } from 'react';
import { Key, X, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { MIN_PASSWORD_LENGTH } from '../types';

/** Janela para o usuário logado trocar a própria senha (exige a senha atual). */
const ChangePasswordModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (next.length < MIN_PASSWORD_LENGTH) return setError(`A nova senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    if (next !== confirm) return setError('As senhas não coincidem.');
    if (next === current) return setError('A nova senha deve ser diferente da atual.');
    setSaving(true);
    try {
      await api.post('/auth/password', { current_password: current, password: next });
      setDone(true);
      setTimeout(onClose, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível alterar a senha.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 no-print">
      <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden">
        <div className="bg-orange-500 p-6 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Key size={24} />
            <h3 className="font-bold text-lg">Alterar Minha Senha</h3>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1.5 rounded-full transition-colors" aria-label="Fechar"><X size={20} /></button>
        </div>
        {done ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <CheckCircle2 size={56} className="text-green-500" />
            <p className="font-bold text-slate-900">Senha alterada com sucesso!</p>
          </div>
        ) : (
          <form onSubmit={submit} className="p-8 space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Senha atual</label>
              <input type="password" autoComplete="current-password" required className={inputClass} value={current} onChange={e => setCurrent(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nova senha</label>
              <input type="password" autoComplete="new-password" required className={inputClass} placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`} value={next} onChange={e => setNext(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confirmar nova senha</label>
              <input type="password" autoComplete="new-password" required className={inputClass} value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
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

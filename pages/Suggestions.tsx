import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Lightbulb, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useVacation } from '../contexts/VacationContext';
import { useAuth } from '../contexts/AuthContext';

const Suggestions: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addSuggestion } = useVacation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim() || !description.trim() || !user) {
      setError('Preencha o título e a descrição da sugestão.');
      return;
    }

    setLoading(true);
    try {
      await addSuggestion({
        title: title.trim(),
        description: description.trim(),
        userId: user.id,
        userName: user.name,
        warName: user.warName || '',
      });
      setSuccess(true);
      setTimeout(() => navigate('/home'), 1500);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível enviar a sugestão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Lightbulb className="text-orange-500" size={30} /> Sugestões
          </h2>
          <p className="text-slate-500 mt-1">Envie ideias de melhoria para a administração do sistema.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
      </div>

      <div className="bg-white rounded-[36px] shadow-xl border border-slate-100 overflow-hidden">
        <div className="bg-orange-500 px-8 py-6 text-white">
          <h3 className="text-xl font-black uppercase tracking-wide">Nova Sugestão</h3>
          <p className="text-orange-100 text-sm mt-1">Descreva com clareza a melhoria que você gostaria de ver no sistema.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm font-bold">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 rounded-2xl bg-green-50 border border-green-200 text-green-700 text-sm font-bold flex items-center gap-2">
              <CheckCircle2 size={18} /> Sugestão enviada com sucesso.
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Título</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 text-sm font-medium"
              placeholder="Resumo da sua sugestão"
              disabled={loading || success}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Descrição</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full min-h-[220px] px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 text-sm font-medium leading-relaxed"
              placeholder="Explique a melhoria desejada, o motivo e, se quiser, um exemplo de como isso poderia funcionar."
              disabled={loading || success}
            />
          </div>

          <div className="flex justify-center pt-2">
            <button
              type="submit"
              disabled={loading || success}
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-black rounded-2xl shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
            >
              <Send size={16} /> Enviar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Suggestions;
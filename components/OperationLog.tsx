import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Search, Download, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { normalizeText } from '../lib/textUtils';

interface Operation {
  id: number;
  at: string;
  user: string;
  ip: string;
  method: string;
  route: string;
  status: number;
  operation: string;
  detail: string;
}

const PAGE = 300;

const statusLabel = (status: number) => {
  if (status < 400) return { text: 'Concluída', cls: 'bg-green-50 text-green-700' };
  if (status === 401 || status === 403) return { text: 'Recusada', cls: 'bg-red-50 text-red-700' };
  return { text: `Erro ${status}`, cls: 'bg-amber-50 text-amber-700' };
};

/**
 * Registro de todas as operações feitas por meio do sistema (DCTIMARINST
 * 30-17, item 4.4): quem, quando, de qual computador, o quê e o resultado.
 * Os registros não podem ser alterados nem apagados pelo sistema.
 */
const OperationLog: React.FC = () => {
  const [rows, setRows] = useState<Operation[]>([]);
  const [search, setSearch] = useState('');
  const [onlyRefused, setOnlyRefused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');

  const load = async (before?: number) => {
    setLoading(true);
    setError('');
    try {
      const page = await api.get<Operation[]>(`/admin/operations?limit=${PAGE}${before ? `&before=${before}` : ''}`);
      setRows(prev => (before ? [...prev, ...page] : page));
      setHasMore(page.length === PAGE);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar o registro.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const term = normalizeText(search);
    return rows.filter(r => {
      if (onlyRefused && r.status < 400) return false;
      if (!term) return true;
      return normalizeText(`${r.user} ${r.operation} ${r.detail} ${r.ip} ${r.route}`).includes(term);
    });
  }, [rows, search, onlyRefused]);

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['Data/hora', 'Usuário', 'IP', 'Operação', 'Resultado', 'Método', 'Rota', 'Detalhe'].map(esc).join(';'),
      ...filtered.map(r => [new Date(r.at).toLocaleString('pt-BR'), r.user, r.ip, r.operation, r.status, r.method, r.route, r.detail].map(esc).join(';')),
    ];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `registro_operacoes_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="p-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><FileText className="text-orange-500" size={24} /> Registro de Operações</h3>
          <p className="text-xs text-slate-500 mt-1">
            Toda operação feita no sistema (inclusive logins e tentativas recusadas). Consultas repetidas aparecem no máximo uma vez por hora.
            Os registros não podem ser alterados nem apagados.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              autoComplete="off"
              type="text"
              placeholder="Pesquisar usuário, operação, IP..."
              className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500 w-72"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 px-2">
            <input type="checkbox" checked={onlyRefused} onChange={e => setOnlyRefused(e.target.checked)} /> Só recusadas/erros
          </label>
          <button onClick={() => void load()} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white rounded-xl text-xs font-bold">
            <RefreshCw size={14} /> Atualizar
          </button>
          <button onClick={exportCsv} disabled={!filtered.length} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white hover:bg-black rounded-xl text-xs font-bold disabled:opacity-50">
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      {error && <p className="text-red-500 text-xs font-bold mb-4">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left" data-testid="registro-operacoes">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="pb-3 px-3 font-black uppercase text-[10px] tracking-widest">Data/hora</th>
              <th className="pb-3 px-3 font-black uppercase text-[10px] tracking-widest">Usuário</th>
              <th className="pb-3 px-3 font-black uppercase text-[10px] tracking-widest">Operação</th>
              <th className="pb-3 px-3 font-black uppercase text-[10px] tracking-widest">Resultado</th>
              <th className="pb-3 px-3 font-black uppercase text-[10px] tracking-widest">IP</th>
              <th className="pb-3 px-3 font-black uppercase text-[10px] tracking-widest">Detalhe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(r => {
              const st = statusLabel(r.status);
              return (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 text-xs">{new Date(r.at).toLocaleString('pt-BR')}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-800 text-xs">{r.user || <span className="text-slate-400 font-medium">(sem login)</span>}</td>
                  <td className="py-2.5 px-3 text-xs">{r.operation}</td>
                  <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${st.cls}`}>{st.text}</span></td>
                  <td className="py-2.5 px-3 text-xs text-slate-500">{r.ip}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-500 max-w-xs truncate" title={r.detail}>{r.detail}</td>
                </tr>
              );
            })}
            {!filtered.length && !loading && (
              <tr><td colSpan={6} className="py-10 text-center text-slate-400 text-sm">Nenhum registro encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && rows.length > 0 && (
        <div className="text-center mt-6">
          <button onClick={() => void load(rows[rows.length - 1].id)} disabled={loading} className="px-6 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold disabled:opacity-50">
            {loading ? 'Carregando...' : 'Carregar registros mais antigos'}
          </button>
        </div>
      )}
    </div>
  );
};

export default OperationLog;

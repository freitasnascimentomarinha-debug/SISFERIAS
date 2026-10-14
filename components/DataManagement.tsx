import React, { useEffect, useState } from 'react';
import { Database, Download, Upload, HardDrive, AlertCircle, CheckCircle2, RefreshCw, FileText, Save, Search } from 'lucide-react';
import { api, downloadFromApi } from '../lib/api';

// Rótulos das tabelas exibidos na tela.
const TABLE_LABELS: Record<string, string> = {
  auth_users: 'Usuários e senhas',
  profiles: 'Perfis de usuário',
  employees: 'Lançamentos de férias',
  system_settings: 'Configurações do sistema',
  notices: 'Avisos',
  audit_logs: 'Auditoria',
  suggestions: 'Sugestões',
  print_preferences: 'Preferências de impressão',
};
const IMPORTABLE_TABLES = Object.keys(TABLE_LABELS);

interface TableReport {
  table: string;
  label: string;
  total: number;
  insert: number;
  update: number;
  errors: { file: string; line: number; error: string }[];
  unmappedColumns: string[];
}

interface ImportReport {
  files: { file: string; table: string | null; rows: number }[];
  tables: Record<string, TableReport>;
  problems: { file: string; error: string }[];
  warnings: string[];
}

interface ImportResult {
  report: ImportReport;
  backupFile: string;
  before: Record<string, number>;
  after: Record<string, number>;
}

interface Stats {
  counts: Record<string, number>;
  dbFile: string;
  backups: { file: string; size: number; createdAt: string }[];
}

const tableList = (report: ImportReport) => Object.values(report.tables) as TableReport[];

const formatSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const formatDate = (iso: string) => new Date(iso).toLocaleString('pt-BR');

const DataManagement: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [files, setFiles] = useState<{ name: string; content: string }[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [preview, setPreview] = useState<ImportReport | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadStats = async () => {
    try {
      setStats(await api.get<Stats>('/admin/stats'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar a situação do banco.');
    }
  };

  useEffect(() => { void loadStats(); }, []);

  const handleFiles = async (list: FileList | null) => {
    setPreview(null);
    setResult(null);
    setError('');
    setOverrides({});
    if (!list || !list.length) { setFiles([]); return; }
    const loaded = await Promise.all(Array.from(list).map(async f => ({ name: f.name, content: await f.text() })));
    setFiles(loaded);
  };

  const runPreview = async (nextOverrides = overrides) => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setPreview(await api.post<ImportReport>('/admin/import/preview', { files, overrides: nextOverrides }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao analisar os arquivos.');
    } finally {
      setBusy(false);
    }
  };

  const changeOverride = (file: string, table: string) => {
    const next = { ...overrides, [file]: table };
    setOverrides(next);
    void runPreview(next);
  };

  const runImport = async () => {
    if (!preview) return;
    const totalErrors = tableList(preview).reduce((acc, t) => acc + t.errors.length, 0);
    const confirmText = [
      mode === 'replace'
        ? 'ATENÇÃO: as tabelas presentes nos arquivos serão APAGADAS e substituídas pelo conteúdo importado.'
        : 'Os registros serão inseridos ou atualizados (nada será apagado).',
      totalErrors ? `${totalErrors} linha(s) com erro serão ignoradas.` : '',
      'Um backup automático será criado antes. Deseja continuar?',
    ].filter(Boolean).join('\n\n');
    if (!window.confirm(confirmText)) return;

    setBusy(true);
    setError('');
    try {
      const res = await api.post<ImportResult>('/admin/import/apply', { files, overrides, mode });
      setResult(res);
      setPreview(null);
      void loadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na importação. Nenhum dado foi alterado.');
    } finally {
      setBusy(false);
    }
  };

  const createBackup = async () => {
    setBusy(true);
    setMessage('');
    try {
      const { file } = await api.post<{ file: string }>('/admin/backups');
      setMessage(`Backup criado: ${file}`);
      void loadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar backup.');
    } finally {
      setBusy(false);
    }
  };

  const hasProblems = !!preview && preview.problems.length > 0;

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-300">
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm font-bold flex items-start gap-2 border border-red-100">
          <AlertCircle size={18} className="shrink-0 mt-0.5" /> <span className="whitespace-pre-line">{error}</span>
        </div>
      )}
      {message && (
        <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm font-bold flex items-center gap-2 border border-green-100">
          <CheckCircle2 size={18} /> {message}
        </div>
      )}

      {/* Situação do banco */}
      <section>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Database className="text-orange-500" size={24} /> Banco de Dados
          </h3>
          <button
            onClick={() => void loadStats()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
        {stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {IMPORTABLE_TABLES.map(t => (
                <div key={t} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{TABLE_LABELS[t]}</p>
                  <p className="text-2xl font-black text-slate-800">{stats.counts[t] ?? 0}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Arquivo do banco no servidor: <code className="bg-slate-100 px-1.5 py-0.5 rounded">{stats.dbFile}</code>
            </p>
          </>
        )}
      </section>

      {/* Backups */}
      <section>
        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-2">
          <HardDrive className="text-orange-500" size={24} /> Backups
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          O servidor faz um backup automático por dia e antes de cada importação ou exclusão de usuário.
          Guarde cópias periódicas fora deste computador (pen drive, pasta de rede).
        </p>
        <div className="flex flex-wrap gap-3 mb-4">
          <button
            disabled={busy}
            onClick={() => void createBackup()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Save size={16} /> Criar backup agora
          </button>
        </div>
        {stats && stats.backups.length > 0 && (
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
            {stats.backups.map(b => (
              <div key={b.file} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-bold text-slate-700 truncate">{b.file}</p>
                  <p className="text-xs text-slate-400">{formatDate(b.createdAt)} · {formatSize(b.size)}</p>
                </div>
                <button
                  onClick={() => downloadFromApi(`/admin/backups/${encodeURIComponent(b.file)}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-orange-600 hover:bg-orange-50 shrink-0"
                >
                  <Download size={14} /> Baixar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Exportação */}
      <section>
        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-2">
          <Download className="text-orange-500" size={24} /> Exportar Dados
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          O backup completo (.json) inclui as senhas criptografadas e pode ser importado em outro servidor do SISFERIAS.
          Os CSVs servem para abrir no Excel.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => downloadFromApi('/admin/export')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-orange-500 text-white hover:bg-orange-600"
          >
            <Database size={16} /> Backup completo (.json)
          </button>
          {IMPORTABLE_TABLES.filter(t => t !== 'auth_users').map(t => (
            <button
              key={t}
              onClick={() => downloadFromApi(`/admin/export/${t}.csv`)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              <FileText size={14} /> {TABLE_LABELS[t]}
            </button>
          ))}
        </div>
      </section>

      {/* Importação */}
      <section>
        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-2">
          <Upload className="text-orange-500" size={24} /> Importar Dados
        </h3>
        <div className="text-sm text-slate-500 mb-4 space-y-1">
          <p>Aceita o backup completo do SISFERIAS (.json) ou CSVs, um por tabela (mesmas colunas dos CSVs exportados acima).</p>
          <p>
            Para manter as senhas, inclua também um CSV de usuários com as colunas{' '}
            <code className="bg-slate-100 px-1 rounded">id, email, password_hash</code> (senha em bcrypt).
          </p>
          <p>Nada é gravado na análise. Importar o mesmo arquivo duas vezes não duplica registros.</p>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <input
            type="file"
            multiple
            accept=".csv,.json,.txt"
            onChange={e => void handleFiles(e.target.files)}
            className="text-sm file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-slate-900 file:text-white file:font-bold file:cursor-pointer"
          />
          <button
            disabled={busy || !files.length}
            onClick={() => void runPreview()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
          >
            <Search size={16} /> Analisar arquivos
          </button>
        </div>

        {preview && (
          <div className="space-y-6 border border-slate-200 rounded-3xl p-6">
            <div>
              <h4 className="font-bold text-slate-800 mb-3">Arquivos</h4>
              <div className="space-y-2">
                {preview.files.map(f => (
                  <div key={f.file + f.table} className="flex flex-col md:flex-row md:items-center gap-2 text-sm">
                    <span className="font-bold text-slate-700 md:w-72 truncate">{f.file}</span>
                    <span className="text-slate-400">{f.rows} linha(s) →</span>
                    {f.file.toLowerCase().endsWith('.json') && f.table && preview.files.filter(x => x.file === f.file).length > 1 ? (
                      <span className="text-slate-700 font-bold">{TABLE_LABELS[f.table]}</span>
                    ) : (
                      <select
                        value={overrides[f.file] || f.table || ''}
                        onChange={e => changeOverride(f.file, e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                      >
                        <option value="">— escolha a tabela —</option>
                        {IMPORTABLE_TABLES.map(t => <option key={t} value={t}>{TABLE_LABELS[t]}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {preview.problems.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-700 space-y-1">
                {preview.problems.map((p, i) => <p key={i}><b>{p.file}:</b> {p.error}</p>)}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="pb-3 px-3 font-black uppercase text-[10px] tracking-widest">Tabela</th>
                    <th className="pb-3 px-3 font-black uppercase text-[10px] tracking-widest text-right">Linhas</th>
                    <th className="pb-3 px-3 font-black uppercase text-[10px] tracking-widest text-right">Novos</th>
                    <th className="pb-3 px-3 font-black uppercase text-[10px] tracking-widest text-right">Atualizados</th>
                    <th className="pb-3 px-3 font-black uppercase text-[10px] tracking-widest text-right">Com erro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tableList(preview).map(t => (
                    <tr key={t.table}>
                      <td className="py-3 px-3 font-bold text-slate-700">{TABLE_LABELS[t.table] || t.label}</td>
                      <td className="py-3 px-3 text-right">{t.total}</td>
                      <td className="py-3 px-3 text-right text-green-600 font-bold">{t.insert}</td>
                      <td className="py-3 px-3 text-right text-blue-600 font-bold">{t.update}</td>
                      <td className={`py-3 px-3 text-right font-bold ${t.errors.length ? 'text-red-600' : 'text-slate-300'}`}>{t.errors.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {tableList(preview).some(t => t.errors.length) && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-xs text-red-700 max-h-60 overflow-y-auto custom-scrollbar">
                <p className="font-black uppercase tracking-widest mb-2">Linhas que serão ignoradas</p>
                {tableList(preview).flatMap(t => t.errors.map((e, i) => (
                  <p key={`${t.table}-${i}`}><b>{e.file}</b>, linha {e.line}: {e.error}</p>
                )))}
              </div>
            )}

            {preview.warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-800 space-y-1">
                {preview.warnings.map((w, i) => <p key={i}>• {w}</p>)}
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center gap-4 pt-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modo</span>
                <select
                  value={mode}
                  onChange={e => setMode(e.target.value as 'merge' | 'replace')}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                >
                  <option value="merge">Mesclar — inserir novos e atualizar existentes (recomendado)</option>
                  <option value="replace">Substituir — apagar as tabelas importadas e recarregar</option>
                </select>
              </label>
              <button
                disabled={busy || hasProblems}
                onClick={() => void runImport()}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-black bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 md:mt-5"
              >
                <Upload size={16} /> Importar
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="border border-green-200 bg-green-50/50 rounded-3xl p-6 space-y-4">
            <p className="font-bold text-green-700 flex items-center gap-2">
              <CheckCircle2 size={18} /> Importação concluída. Backup anterior salvo como {result.backupFile}.
            </p>
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-slate-400 border-b border-green-100">
                  <th className="pb-2 px-3 font-black uppercase text-[10px] tracking-widest">Tabela</th>
                  <th className="pb-2 px-3 font-black uppercase text-[10px] tracking-widest text-right">Antes</th>
                  <th className="pb-2 px-3 font-black uppercase text-[10px] tracking-widest text-right">Depois</th>
                </tr>
              </thead>
              <tbody>
                {IMPORTABLE_TABLES.map(t => (
                  <tr key={t}>
                    <td className="py-1.5 px-3 font-bold text-slate-700">{TABLE_LABELS[t]}</td>
                    <td className="py-1.5 px-3 text-right">{result.before[t] ?? 0}</td>
                    <td className="py-1.5 px-3 text-right font-bold">{result.after[t] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800"
            >
              <RefreshCw size={16} /> Recarregar o sistema com os novos dados
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default DataManagement;

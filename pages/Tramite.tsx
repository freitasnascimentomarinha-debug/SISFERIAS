import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Filter, Pencil, Save, Search, ShieldCheck, X } from 'lucide-react';
import { format, startOfDay, subDays } from 'date-fns';
import { useVacation } from '../contexts/VacationContext';

const Tramite: React.FC = () => {
  const { employees, updateParcelNup } = useVacation();
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [editingNup, setEditingNup] = useState('');
  const [savingRowKey, setSavingRowKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const trackingRows = useMemo(() => {
    const today = startOfDay(new Date());

    const getPriority = (row: {
      shouldHighlight: boolean;
      isCompleted: boolean;
    }) => {
      if (row.shouldHighlight) return 0;
      if (!row.isCompleted) return 1;
      return 2;
    };

    return employees.flatMap(employee => {
      return employee.vacationParcels.map((parcel, index) => {
        const start = parcel.startDate ? startOfDay(new Date(parcel.startDate + 'T00:00:00')) : null;
        const end = parcel.endDate ? startOfDay(new Date(parcel.endDate + 'T00:00:00')) : null;
        const missingNup = !parcel.nup || parcel.nup.trim().length === 0;
        const shouldHighlight = !!start && today.getTime() >= start.getTime() && missingNup;
        const shouldInsertInSigad = !!start && missingNup && today.getTime() < start.getTime() && today.getTime() >= subDays(start, 15).getTime();
        const isPlanned = missingNup && !shouldHighlight && !shouldInsertInSigad;
        const isCompleted = !!end && today.getTime() > end.getTime();

        return {
          key: `${employee.id}-${parcel.id}`,
          employeeId: employee.id,
          parcelId: parcel.id,
          employeeName: employee.name,
          warName: employee.warName,
          rank: employee.rank,
          sector: employee.sector,
          planningYear: employee.planningYear,
          parcelLabel: `Parcela ${index + 1}`,
          startDate: parcel.startDate,
          endDate: parcel.endDate,
          days: parcel.days,
          nup: parcel.nup || '',
          shouldHighlight,
          shouldInsertInSigad,
          isPlanned,
          isCompleted,
        };
      });
    }).sort((a, b) => {
      const priorityDiff = getPriority(a) - getPriority(b);
      if (priorityDiff !== 0) return priorityDiff;

      const aStart = a.startDate ? new Date(a.startDate + 'T00:00:00').getTime() : Number.MAX_SAFE_INTEGER;
      const bStart = b.startDate ? new Date(b.startDate + 'T00:00:00').getTime() : Number.MAX_SAFE_INTEGER;
      if (aStart !== bStart) return aStart - bStart;

      const aEnd = a.endDate ? new Date(a.endDate + 'T00:00:00').getTime() : Number.MAX_SAFE_INTEGER;
      const bEnd = b.endDate ? new Date(b.endDate + 'T00:00:00').getTime() : Number.MAX_SAFE_INTEGER;
      if (aEnd !== bEnd) return aEnd - bEnd;

      if (a.employeeName !== b.employeeName) return a.employeeName.localeCompare(b.employeeName);
      if (a.planningYear !== b.planningYear) return a.planningYear - b.planningYear;
      return a.parcelLabel.localeCompare(b.parcelLabel);
    });
  }, [employees]);

  const years = useMemo(() => {
    return Array.from(new Set(trackingRows.map(r => r.planningYear))).sort((a, b) => b - a);
  }, [trackingRows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return trackingRows.filter(row => {
      const matchYear = yearFilter === 'all' || row.planningYear.toString() === yearFilter;
      if (!matchYear) return false;

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'regular' && !row.shouldHighlight) ||
        (statusFilter === 'pending' && row.shouldHighlight) ||
        (statusFilter === 'completed' && row.isCompleted);
      if (!matchStatus) return false;

      if (!term) return true;

      return (
        row.employeeName.toLowerCase().includes(term) ||
        row.warName.toLowerCase().includes(term) ||
        row.rank.toLowerCase().includes(term) ||
        row.sector.toLowerCase().includes(term) ||
        row.nup.toLowerCase().includes(term)
      );
    });
  }, [trackingRows, search, yearFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = filteredRows.length;
    const withNup = filteredRows.filter(row => row.nup.trim().length > 0).length;
    const pending = filteredRows.filter(row => row.shouldHighlight).length;
    return { total, withNup, pending };
  }, [filteredRows]);

  const startEditingNup = (rowKey: string, currentNup: string) => {
    setEditingRowKey(rowKey);
    setEditingNup(currentNup);
    setActionError(null);
  };

  const cancelEditingNup = () => {
    setEditingRowKey(null);
    setEditingNup('');
    setSavingRowKey(null);
    setActionError(null);
  };

  const handleSaveNup = async (employeeId: string, parcelId: string, rowKey: string) => {
    setSavingRowKey(rowKey);
    setActionError(null);
    try {
      await updateParcelNup(employeeId, parcelId, editingNup.trim());
      setEditingRowKey(null);
      setEditingNup('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Nao foi possivel salvar o NUP.');
    } finally {
      setSavingRowKey(null);
    }
  };

  const getStatusPresentation = (row: {
    shouldHighlight: boolean;
    isCompleted: boolean;
  }) => {
    if (row.shouldHighlight) {
      return {
        rowClass: 'bg-red-50/70 hover:bg-red-50',
        badgeClass: 'text-red-600',
        icon: <AlertCircle size={13} />,
        label: 'Discrepante',
      };
    }

    if (row.isCompleted) {
      return {
        rowClass: 'bg-sky-50/80 hover:bg-sky-50',
        badgeClass: 'text-sky-600',
        icon: <CheckCircle2 size={13} />,
        label: 'Concluido',
      };
    }

    return {
      rowClass: 'hover:bg-slate-50/50',
      badgeClass: 'text-green-600',
      icon: <CheckCircle2 size={13} />,
      label: 'Regular',
    };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <FileText className="text-orange-500" size={32} /> Trâmite
          </h2>
          <p className="text-slate-500">Acompanhamento do NUP por parcela de férias.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Parcelas Visiveis"
          value={stats.total}
          subtitle="dentro da sua permissao"
          icon={<ShieldCheck size={22} />}
          color="bg-orange-50 text-orange-600"
        />
        <StatCard
          title="Com NUP"
          value={stats.withNup}
          subtitle="parcelas com trâmite"
          icon={<CheckCircle2 size={22} />}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          title="Pendentes"
          value={stats.pending}
          subtitle="iniciadas sem NUP"
          icon={<AlertCircle size={22} />}
          color="bg-red-50 text-red-600"
        />
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><FileText className="text-orange-500" size={24} /> Controle de Trâmite</h3>
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por nome, setor ou NUP..."
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500 w-full md:w-72"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
            >
              <option value="all">Todas as Janelas</option>
              {years.map(y => <option key={y} value={y.toString()}>{y}</option>)}
            </select>
            <select
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos os Status</option>
              <option value="regular">Regular</option>
              <option value="pending">Discrepante</option>
              <option value="completed">Concluído</option>
            </select>
          </div>
        </div>

        <div className="mb-5 p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-sm font-semibold flex items-center gap-2">
          <Filter size={16} /> Linhas destacadas indicam parcelas de férias desatualizadas ou documentos não inseridos no SIGAD (Sem NUP). Contatar o colaborador para que ele efetue a atualização de sua parcela de férias ou insira a papeleta no SIGAD para correr o trâmite de assinaturas.
        </div>

        {actionError && (
          <div className="mb-5 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold flex items-center gap-2">
            <AlertCircle size={16} /> {actionError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest">Status</th>
                <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest">Militar</th>
                <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest">Setor</th>
                <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest">Janela</th>
                <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest">Parcela</th>
                <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest">Periodo</th>
                <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest">NUP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400 font-medium">Nenhuma parcela encontrada para os filtros aplicados.</td>
                </tr>
              ) : (
                filteredRows.map(row => {
                  const status = getStatusPresentation(row);
                  const isEditing = editingRowKey === row.key;
                  const isSaving = savingRowKey === row.key;

                  return (
                  <tr key={row.key} className={status.rowClass}>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1.5 font-black text-[10px] uppercase tracking-wider ${status.badgeClass}`}>
                        {status.icon} {status.label}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-bold text-slate-800">{row.rank} {row.warName || row.employeeName}</p>
                      <p className="text-[10px] text-slate-500 font-semibold uppercase">{row.employeeName}</p>
                    </td>
                    <td className="py-4 px-4 font-semibold text-slate-700">{row.sector || 'Nao definido'}</td>
                    <td className="py-4 px-4 font-bold text-slate-700">{row.planningYear}</td>
                    <td className="py-4 px-4 font-semibold text-slate-700">{row.parcelLabel} ({row.days} dias)</td>
                    <td className="py-4 px-4 text-slate-600 text-[12px]">
                      {row.startDate ? format(new Date(row.startDate + 'T00:00:00'), 'dd/MM/yyyy') : '--'}
                      {' '}a{' '}
                      {row.endDate ? format(new Date(row.endDate + 'T00:00:00'), 'dd/MM/yyyy') : '--'}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 min-w-[280px]">
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <input
                              value={editingNup}
                              onChange={e => setEditingNup(e.target.value)}
                              placeholder="Ex: 62012.000123/2026-91"
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-orange-500"
                            />
                          ) : row.nup ? (
                            <span className="font-bold text-slate-900 break-all">{row.nup}</span>
                          ) : row.shouldInsertInSigad ? (
                            <span className="font-black text-blue-600 text-[11px] uppercase">Inserir no SIGAD</span>
                          ) : row.isPlanned ? (
                            <span className="font-black text-purple-600 text-[11px] uppercase">Planejado</span>
                          ) : (
                            <span className="text-red-600 font-black text-[11px] uppercase">Sem Papeleta</span>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleSaveNup(row.employeeId, row.parcelId, row.key)}
                              disabled={isSaving}
                              className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50"
                              title="Salvar NUP"
                            >
                              <Save size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingNup}
                              disabled={isSaving}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50"
                              title="Cancelar"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditingNup(row.key, row.nup)}
                            className="p-1.5 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors shrink-0"
                            title="Inserir ou corrigir NUP"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );})
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
}) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
    <div className={`p-4 rounded-xl ${color}`}>{icon}</div>
    <div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400 font-medium mt-1">{subtitle}</p>
    </div>
  </div>
);

export default Tramite;

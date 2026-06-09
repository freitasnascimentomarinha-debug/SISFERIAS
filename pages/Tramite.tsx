import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Filter, Search, ShieldCheck } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { useVacation } from '../contexts/VacationContext';

const Tramite: React.FC = () => {
  const { employees } = useVacation();
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');

  const trackingRows = useMemo(() => {
    const today = startOfDay(new Date());

    return employees.flatMap(employee => {
      return employee.vacationParcels.map((parcel, index) => {
        const start = parcel.startDate ? startOfDay(new Date(parcel.startDate + 'T00:00:00')) : null;
        const missingNup = !parcel.nup || parcel.nup.trim().length === 0;
        const shouldHighlight = !!start && today.getTime() >= start.getTime() && missingNup;

        return {
          key: `${employee.id}-${parcel.id}`,
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
        };
      });
    }).sort((a, b) => {
      if (a.shouldHighlight !== b.shouldHighlight) return a.shouldHighlight ? -1 : 1;
      if (a.employeeName !== b.employeeName) return a.employeeName.localeCompare(b.employeeName);
      if (a.planningYear !== b.planningYear) return b.planningYear - a.planningYear;
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
      if (!term) return true;

      return (
        row.employeeName.toLowerCase().includes(term) ||
        row.warName.toLowerCase().includes(term) ||
        row.rank.toLowerCase().includes(term) ||
        row.sector.toLowerCase().includes(term) ||
        row.nup.toLowerCase().includes(term)
      );
    });
  }, [trackingRows, search, yearFilter]);

  const stats = useMemo(() => {
    const total = filteredRows.length;
    const withNup = filteredRows.filter(row => row.nup.trim().length > 0).length;
    const pending = filteredRows.filter(row => row.shouldHighlight).length;
    return { total, withNup, pending };
  }, [filteredRows]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <FileText className="text-orange-500" size={32} /> Tramite
          </h2>
          <p className="text-slate-500">Acompanhamento do NUP por parcela de ferias, respeitando a visibilidade da sua conta.</p>
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
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><FileText className="text-orange-500" size={24} /> Controle de Tramite</h3>
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
          </div>
        </div>

        <div className="mb-5 p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-sm font-semibold flex items-center gap-2">
          <Filter size={16} /> Linhas destacadas indicam parcela iniciada (ou passada) sem NUP informado.
        </div>

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
                filteredRows.map(row => (
                  <tr key={row.key} className={row.shouldHighlight ? 'bg-red-50/70 hover:bg-red-50' : 'hover:bg-slate-50/50'}>
                    <td className="py-4 px-4">
                      {row.shouldHighlight ? (
                        <span className="inline-flex items-center gap-1.5 text-red-600 font-black text-[10px] uppercase tracking-wider">
                          <AlertCircle size={13} /> Sem NUP (atrasado)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-green-600 font-black text-[10px] uppercase tracking-wider">
                          <CheckCircle2 size={13} /> Regular
                        </span>
                      )}
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
                      {row.nup ? (
                        <span className="font-bold text-slate-900">{row.nup}</span>
                      ) : (
                        <span className="text-red-600 font-black text-[11px] uppercase">Nao informado</span>
                      )}
                    </td>
                  </tr>
                ))
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

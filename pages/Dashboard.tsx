
import React, { useState, useMemo } from 'react';
import { useVacation } from '../contexts/VacationContext';
import { useAuth } from '../contexts/AuthContext';
import { Users, CalendarCheck, CalendarDays, TrendingUp, Search, Filter, User as UserIcon, Shield, ChevronRight, ChevronDown, Calendar, AlertTriangle, ClipboardList, X, TriangleAlert, CircleDashed, CalendarClock } from 'lucide-react';
import VacationChart from '../components/VacationChart';
import EmployeeList from '../components/EmployeeList';
import ExportButtons from '../components/ExportButtons';
import { format, differenceInDays, startOfDay, isBefore, isAfter, isValid, endOfDay } from 'date-fns';
import { normalizeText } from '../lib/textUtils';

const Dashboard: React.FC = () => {
  const { users, user } = useAuth();
  const { employees } = useVacation();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  const allSectors = useMemo(() => {
    const fromEmployees = employees.map(e => e.sector).filter(Boolean);
    return [...new Set([...fromEmployees])].sort();
  }, [employees]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [onVacationFilter, setOnVacationFilter] = useState('all');
  const [remainingFilter, setRemainingFilter] = useState('all');
  const [planningFilter, setPlanningFilter] = useState('all');

  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const [planningYear, setPlanningYear] = useState(currentYear);

  const now = startOfDay(new Date());

  const safeParseDate = (dateStr: string) => {
    if (!dateStr) return new Date(NaN);
    const d = new Date(dateStr + 'T00:00:00');
    return isValid(d) ? d : new Date(NaN);
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      // Ano exibido no Painel representa o ano de gozo (janela).
      // O direito cadastrado pertence ao ano anterior.
      const matchYear = ((emp.planningYear || currentYear) + 1) === planningYear;
      if (!matchYear) return false;

      const matchSearch = normalizeText(emp.warName).includes(normalizeText(search)) || emp.nip.includes(search);
      const matchCat = catFilter === 'all' || emp.category === catFilter;
      const matchSector = sectorFilter === 'all' || emp.sector === sectorFilter;

      let matchPeriod = true;
      if (startDate || endDate) {
        matchPeriod = emp.vacationParcels.some(p => {
          if (!p.startDate || !p.endDate) return false;
          const pStart = safeParseDate(p.startDate);
          const pEnd = safeParseDate(p.endDate);
          if (!isValid(pStart) || !isValid(pEnd)) return false;

          const filterStart = startDate ? safeParseDate(startDate) : new Date(0);
          const filterEnd = endDate ? safeParseDate(endDate) : new Date(9999, 11, 31);

          return (pStart <= filterEnd && pEnd >= filterStart);
        });
      }

      const isCurrentlyOnVacation = emp.vacationParcels.some(p => {
        const s = safeParseDate(p.startDate);
        const e = safeParseDate(p.endDate);
        if (!isValid(s) || !isValid(e)) return false;
        return !isBefore(now, s) && !isAfter(now, e);
      });

      let empGozados = 0;
      emp.vacationParcels.forEach(p => {
        const pStart = safeParseDate(p.startDate);
        const pEnd = safeParseDate(p.endDate);
        if (!isValid(pStart) || !isValid(pEnd)) return;

        if (isAfter(now, pEnd)) {
          empGozados += p.days;
        } else if (!isBefore(now, pStart) && !isAfter(now, pEnd)) {
          const diff = differenceInDays(now, pStart) + 1;
          empGozados += Math.max(0, diff);
        }
      });
      const restantesTotal = Math.max(0, emp.totalVacationDays - empGozados);

      const plannedTotal = emp.vacationParcels.reduce((acc, p) => acc + p.days, 0);
      const isPlanningPending = plannedTotal < emp.totalVacationDays;

      const matchOnVacation = onVacationFilter === 'all' ||
        (onVacationFilter === 'yes' && isCurrentlyOnVacation) ||
        (onVacationFilter === 'no' && !isCurrentlyOnVacation);

      const matchRemaining = remainingFilter === 'all' ||
        (remainingFilter === 'none' && restantesTotal === 0) ||
        (remainingFilter === 'more10' && restantesTotal > 10) ||
        (remainingFilter === 'less10' && restantesTotal > 0 && restantesTotal <= 10);

      const matchPlanning = planningFilter === 'all' ||
        (planningFilter === 'pending' && isPlanningPending) ||
        (planningFilter === 'complete' && !isPlanningPending);

      return matchSearch && matchCat && matchSector && matchPeriod && matchOnVacation && matchRemaining && matchPlanning;
    });
  }, [employees, search, catFilter, sectorFilter, startDate, endDate, onVacationFilter, remainingFilter, planningFilter, planningYear, now, currentYear]);

  const stats = useMemo(() => {
    let totalGozados = 0;
    let totalRestantes = 0;

    filteredEmployees.forEach(emp => {
      let empGozados = 0;
      emp.vacationParcels.forEach(p => {
        const pStart = safeParseDate(p.startDate);
        const pEnd = safeParseDate(p.endDate);
        if (!isValid(pStart) || !isValid(pEnd)) return;

        if (isAfter(now, pEnd)) {
          empGozados += p.days;
        } else if (!isBefore(now, pStart) && !isAfter(now, pEnd)) {
          const diff = differenceInDays(now, pStart) + 1;
          empGozados += Math.max(0, diff);
        }
      });
      totalGozados += empGozados;
      totalRestantes += Math.max(0, emp.totalVacationDays - empGozados);
    });

    const completion = totalGozados + totalRestantes > 0
      ? Math.round((totalGozados / (totalGozados + totalRestantes)) * 100)
      : 0;

    return { total: filteredEmployees.length, gozados: totalGozados, restantes: totalRestantes, completion };
  }, [filteredEmployees, now]);

  const clearFilters = () => {
    setSearch('');
    setCatFilter('all');
    setSectorFilter('all');
    setStartDate('');
    setEndDate('');
    setOnVacationFilter('all');
    setRemainingFilter('all');
    setPlanningFilter('all');
  };

  const reportFilters = {
    janela: planningYear.toString(),
    busca: search || 'Todos',
    categoria: catFilter === 'all' ? 'Todas' : catFilter,
    setor: sectorFilter === 'all' ? 'Todos' : sectorFilter,
    periodo: startDate || endDate ? `${startDate || '--'} a ${endDate || '--'}` : 'Todos',
    statusHoje: onVacationFilter === 'all' ? 'Todos' : onVacationFilter === 'yes' ? 'Em férias hoje' : 'Não está em férias',
    saldo: remainingFilter === 'all' ? 'Todos' : remainingFilter === 'none' ? 'Nenhum dia restante' : remainingFilter === 'more10' ? 'Mais de 10 dias' : 'Até 10 dias',
    planejamento: planningFilter === 'all' ? 'Todos' : planningFilter === 'pending' ? 'Tem dias a planejar' : 'Tudo planejado'
  };

  const diagnostics = useMemo(() => {
    const rightYear = planningYear - 1;
    const windowStart = new Date(planningYear - 1, 11, 1);
    const windowEnd = endOfDay(new Date(planningYear, 10, 30));

    const normalizedSearch = normalizeText(search);

    const visibleUsers = users
      .filter(u => u.role === 'user')
      .filter(u => {
        if (user?.role === 'admin' && !user.viewAllSectors) {
          return (u.sector || '') === (user.sector || '');
        }
        return true;
      })
      .filter(u => {
        const matchSearch = !normalizedSearch ||
          normalizeText(u.warName || '').includes(normalizedSearch) ||
          normalizeText(u.name || '').includes(normalizedSearch) ||
          (u.nip || '').includes(search);

        const matchCat = catFilter === 'all' || (u.category || '') === catFilter;
        const matchSector = sectorFilter === 'all' || (u.sector || '') === sectorFilter;

        return matchSearch && matchCat && matchSector;
      });

    const toDisplayName = (u: typeof visibleUsers[number]) => {
      const base = (u.warName || u.name || 'Sem nome').trim();
      const rank = (u.rank || '').trim();
      return rank ? `${rank} ${base}` : base;
    };

    const rows = visibleUsers.map(u => {
      const emp = employees.find(e => e.userId === u.id && (e.planningYear || rightYear) === rightYear);
      if (!emp) {
        return {
          id: u.id,
          displayName: toDisplayName(u),
          nip: u.nip || '---',
          sector: u.sector || '---',
          status: 'sem-lancamento' as const,
          details: 'Sem registro de férias no ano de direito selecionado.'
        };
      }

      const plannedTotal = emp.vacationParcels.reduce((acc, p) => acc + (p.days || 0), 0);
      const hasAnyParcel = emp.vacationParcels.length > 0;
      const outOfWindowParcels = emp.vacationParcels.filter(p => {
        if (!p.startDate || !p.endDate) return false;
        const pStart = safeParseDate(p.startDate);
        const pEnd = safeParseDate(p.endDate);
        if (!isValid(pStart) || !isValid(pEnd)) return false;
        return isBefore(pStart, windowStart) || isAfter(pEnd, windowEnd);
      });

      if (outOfWindowParcels.length > 0) {
        return {
          id: u.id,
          displayName: toDisplayName(u),
          nip: emp.nip || u.nip || '---',
          sector: emp.sector || u.sector || '---',
          status: 'fora-periodo' as const,
          details: `${outOfWindowParcels.length} parcela(s) fora da janela ${format(windowStart, 'dd/MM/yy')} a ${format(windowEnd, 'dd/MM/yy')}.`
        };
      }

      if (!hasAnyParcel) {
        return {
          id: u.id,
          displayName: toDisplayName(u),
          nip: emp.nip || u.nip || '---',
          sector: emp.sector || u.sector || '---',
          status: 'falta-planejar' as const,
          details: `Nenhuma parcela lançada. Direito: ${emp.totalVacationDays}d.`
        };
      }

      if (plannedTotal < emp.totalVacationDays) {
        return {
          id: u.id,
          displayName: toDisplayName(u),
          nip: emp.nip || u.nip || '---',
          sector: emp.sector || u.sector || '---',
          status: 'falta-planejar' as const,
          details: `Planejado: ${plannedTotal}d de ${emp.totalVacationDays}d.`
        };
      }

      return null;
    }).filter((row): row is NonNullable<typeof row> => row !== null);

    return {
      baseCount: visibleUsers.length,
      semLancamento: rows.filter(r => r.status === 'sem-lancamento'),
      faltaPlanejar: rows.filter(r => r.status === 'falta-planejar'),
      foraPeriodo: rows.filter(r => r.status === 'fora-periodo')
    };
  }, [users, user, employees, planningYear, search, catFilter, sectorFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print mb-10">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Painel</h2>
          <p className="text-slate-500">Visão geral das Férias da Tripulação</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsDiagnosticsOpen(true)}
            className="px-3 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-100 transition-all"
          >
            <ClipboardList size={16} /> Diagnóstico
          </button>
          <ExportButtons employees={filteredEmployees} filters={reportFilters} planningYear={planningYear} />
        </div>
      </div>

      {isDiagnosticsOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-900/55 backdrop-blur-sm p-4 md:p-8 overflow-y-auto no-print">
          <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 px-6 py-5 text-white flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-orange-100">Diagnóstico de Lançamentos</p>
                <h3 className="text-2xl font-black leading-tight">Situação dos usuários na janela {planningYear}</h3>
                <p className="text-sm text-orange-100 mt-1">Base visível: {diagnostics.baseCount} usuário(s) • Ano de direito: {planningYear - 1}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsDiagnosticsOpen(false)}
                className="p-2 rounded-xl bg-white/15 hover:bg-white/25 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
              <DiagnosticColumn
                title="Sem Lançamento"
                subtitle="Nenhum registro de férias"
                icon={<CircleDashed size={16} />}
                accent="orange"
                rows={diagnostics.semLancamento}
              />
              <DiagnosticColumn
                title="Falta Planejar"
                subtitle="Dias pendentes de planejamento"
                icon={<CalendarClock size={16} />}
                accent="blue"
                rows={diagnostics.faltaPlanejar}
              />
              <DiagnosticColumn
                title="Fora do Período"
                subtitle="Parcela fora da janela do ano"
                icon={<TriangleAlert size={16} />}
                accent="red"
                rows={diagnostics.foraPeriodo}
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-8 no-print">
        <button
          type="button"
          onClick={() => setIsFilterOpen(prev => !prev)}
          className="w-full flex items-center justify-between gap-2 text-slate-800 font-bold select-none"
        >
          <span className="flex items-center gap-2">
            <Filter size={18} className="text-orange-500" /> Filtros Avançados
          </span>
          {isFilterOpen ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
        </button>

        {isFilterOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Buscar por nome</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              <input
                type="text"
                placeholder="NIP ou Nome..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Status Férias (Hoje)</label>
            <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500" value={onVacationFilter} onChange={e => setOnVacationFilter(e.target.value)}>
              <option value="all">Todos os Status</option>
              <option value="yes">Em férias hoje</option>
              <option value="no">Não está em férias</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Saldo a Gozar</label>
            <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500" value={remainingFilter} onChange={e => setRemainingFilter(e.target.value)}>
              <option value="all">Todos os saldos</option>
              <option value="none">Nenhum dia restante</option>
              <option value="more10">Mais de 10 dias</option>
              <option value="less10">Menos de 10 dias (Saldo {'>'} 0)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Planejamento</label>
            <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500" value={planningFilter} onChange={e => setPlanningFilter(e.target.value)}>
              <option value="all">Todos os planejamentos</option>
              <option value="pending">Tem dias a planejar</option>
              <option value="complete">Tudo planejado</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Categoria</label>
            <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="all">Todas</option>
              <option value="oficial">Oficial</option>
              <option value="praca">Praça</option>
              <option value="civil">Servidor Civil</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Setor</label>
            <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500" value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}>
              <option value="all">Todos</option>
              {allSectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Início (Filtro Período)</label>
            <input type="date" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Fim (Filtro Período)</label>
            <input type="date" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          <div className="flex items-end lg:col-span-2 xl:col-span-4">
            <button onClick={clearFilters} className="px-6 py-2 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-700 rounded-lg text-sm font-bold transition-all border border-slate-200">
              Limpar Todos os Filtros
            </button>
          </div>
        </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 no-print">
        <StatCard title="Pessoal (Filtrados)" value={stats.total} icon={<Users size={24} />} color="bg-orange-50 text-orange-600" />
        <StatCard title="Dias Cumpridos" value={`${stats.gozados} dias`} icon={<CalendarCheck size={24} />} color="bg-green-50 text-green-600" />
        <StatCard title="Dias Restantes" value={`${stats.restantes} dias`} icon={<CalendarDays size={24} />} color="bg-amber-50 text-amber-600" />
        <StatCard title="Taxa de Conclusão" value={`${stats.completion}%`} icon={<TrendingUp size={24} />} color="bg-blue-50 text-blue-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 no-print items-start">
        {/* Card do Gráfico - Altura fixa para manter proporção */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[500px] flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 flex-shrink-0">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp size={20} className="text-orange-500" /> Distribuição de Férias
            </h3>

            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Janela:</span>
              <div className="flex bg-slate-100 p-0.5 rounded-lg overflow-x-auto max-w-[200px] no-scrollbar">
                {availableYears.map(year => (
                  <button
                    key={year}
                    onClick={() => setPlanningYear(year)}
                    className={`px-3 py-1 text-[10px] font-black rounded-md transition-all whitespace-nowrap ${planningYear === year ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 w-full min-h-0">
            <VacationChart employees={filteredEmployees} planningYear={planningYear} />
          </div>
        </div>

        {/* Card da Lista - Altura igual ao gráfico com barra de rolagem interna fixa */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[500px] flex flex-col">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2 flex-shrink-0">
            <Users size={20} className="text-orange-500" /> Lista de Militares
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <EmployeeList employees={filteredEmployees} planningYear={planningYear} />
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color }: { title: string; value: string | number; icon: React.ReactNode; color: string }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
    <div className={`p-4 rounded-xl ${color}`}>{icon}</div>
    <div><p className="text-sm font-medium text-slate-500">{title}</p><p className="text-2xl font-bold text-slate-900">{value}</p></div>
  </div>
);

type DiagnosticRow = {
  id: string;
  displayName: string;
  nip: string;
  sector: string;
  details: string;
};

const DiagnosticColumn = ({ title, subtitle, icon, rows, accent }: { title: string; subtitle: string; icon: React.ReactNode; rows: DiagnosticRow[]; accent: 'orange' | 'blue' | 'red' }) => {
  const accentMap = {
    orange: {
      chip: 'bg-orange-100 text-orange-700 border-orange-200',
      card: 'border-orange-200 bg-orange-50/40',
      icon: 'text-orange-600 bg-orange-100'
    },
    blue: {
      chip: 'bg-blue-100 text-blue-700 border-blue-200',
      card: 'border-blue-200 bg-blue-50/40',
      icon: 'text-blue-600 bg-blue-100'
    },
    red: {
      chip: 'bg-red-100 text-red-700 border-red-200',
      card: 'border-red-200 bg-red-50/40',
      icon: 'text-red-600 bg-red-100'
    }
  }[accent];

  return (
    <section className={`rounded-2xl border p-4 ${accentMap.card}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentMap.icon}`}>{icon}</div>
          <div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">{title}</h4>
            <p className="text-[11px] text-slate-500 font-semibold">{subtitle}</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full border text-xs font-black ${accentMap.chip}`}>{rows.length}</span>
      </div>

      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-4 text-xs text-slate-500 font-semibold text-center">
            Nenhum usuário neste grupo.
          </div>
        ) : (
          rows.map(row => (
            <article key={row.id} className="rounded-xl bg-white border border-slate-200 p-3 shadow-sm">
              <p className="text-sm font-bold text-slate-900 leading-tight">{row.displayName}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">NIP: {row.nip} • Setor: {row.sector}</p>
              <p className="text-[11px] text-slate-700 mt-2 font-semibold">{row.details}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
};

export default Dashboard;

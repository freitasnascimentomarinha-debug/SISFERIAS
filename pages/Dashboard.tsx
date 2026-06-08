
import React, { useState, useMemo } from 'react';
import { useVacation } from '../contexts/VacationContext';
import { Users, CalendarCheck, CalendarDays, TrendingUp, Search, Filter, User as UserIcon, Shield, ChevronRight, Calendar, AlertTriangle } from 'lucide-react';
import VacationChart from '../components/VacationChart';
import EmployeeList from '../components/EmployeeList';
import ExportButtons from '../components/ExportButtons';
import { format, differenceInDays, startOfDay, isBefore, isAfter, isValid, endOfDay } from 'date-fns';

const Dashboard: React.FC = () => {
  const { employees } = useVacation();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');

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
      const matchYear = (emp.planningYear || currentYear) === planningYear;
      if (!matchYear) return false;

      const matchSearch = emp.warName.toLowerCase().includes(search.toLowerCase()) || emp.nip.includes(search);
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print mb-10">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Painel</h2>
          <p className="text-slate-500">Visão geral das Férias da Tripulação</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExportButtons employees={filteredEmployees} filters={reportFilters} />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-8 no-print">
        <div className="flex items-center gap-2 text-slate-800 font-bold mb-6">
          <Filter size={18} className="text-orange-500" /> Filtros Avançados
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 no-print">
        <StatCard title="Militares (Filtrados)" value={stats.total} icon={<Users size={24} />} color="bg-orange-50 text-orange-600" />
        <StatCard title="Dias Gozados" value={`${stats.gozados} dias`} icon={<CalendarCheck size={24} />} color="bg-green-50 text-green-600" />
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

export default Dashboard;

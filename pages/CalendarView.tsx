
import React, { useState, useMemo } from 'react';
import { useVacation } from '../contexts/VacationContext';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth,
  addMonths, 
  subMonths, 
  startOfWeek, 
  endOfWeek,
  isWithinInterval,
  startOfDay,
  startOfYear
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter, LayoutGrid, CalendarDays } from 'lucide-react';

type ViewMode = 'month' | 'year';

const CalendarView: React.FC = () => {
  const { employees } = useVacation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterUserId, setFilterUserId] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('year');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Lista de militares para o filtro
  const employeeOptions = useMemo(() => {
    return employees.map(e => ({ id: e.userId, name: `${e.rank} ${e.warName}` }));
  }, [employees]);

  // Lista de setores para o filtro
  const sectorOptions = useMemo(() => {
    const fromEmployees = employees.map(e => e.sector).filter(Boolean);
    return [...new Set(fromEmployees)].sort();
  }, [employees]);

  // Militares considerando os filtros ativos (usuário + setor)
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (filterUserId !== 'all' && emp.userId !== filterUserId) return false;
      if (sectorFilter !== 'all' && emp.sector !== sectorFilter) return false;
      return true;
    });
  }, [employees, filterUserId, sectorFilter]);

  // Função para pegar férias de um dia específico
  const getDayVacations = (day: Date) => {
    const dayStart = startOfDay(day);
    const list: { name: string; rank: string; color: string; userId: string }[] = [];
    
    filteredEmployees.forEach(emp => {
      emp.vacationParcels.forEach(p => {
        if (!p.startDate || !p.endDate) return;
        // Forçar interpretação local para evitar erro de fuso horário
        const pStart = startOfDay(new Date(p.startDate + 'T00:00:00'));
        const pEnd = startOfDay(new Date(p.endDate + 'T00:00:00'));
        
        if (isWithinInterval(dayStart, { start: pStart, end: pEnd })) {
          list.push({ 
            name: emp.warName, 
            rank: emp.rank, 
            color: 'bg-[#b44116]', // Cor ferrugem/laranja escuro da imagem
            userId: emp.userId 
          });
        }
      });
    });
    return list;
  };

  // Legenda dinâmica: Quem aparece neste mês?
  const activeVacationers = useMemo(() => {
    const people = new Map<string, string>();
    filteredEmployees.forEach(emp => {
      const hasVacationThisMonth = emp.vacationParcels.some(p => {
        if (!p.startDate || !p.endDate) return false;
        const pStart = new Date(p.startDate + 'T00:00:00');
        const pEnd = new Date(p.endDate + 'T00:00:00');
        return (pStart <= monthEnd && pEnd >= monthStart);
      });

      if (hasVacationThisMonth) {
        people.set(emp.userId, `${emp.rank} ${emp.warName}`);
      }
    });
    return Array.from(people.entries());
  }, [filteredEmployees, monthStart, monthEnd]);

  // Verifica se existe alguma parcela de férias em um dia, usado na visão anual
  const hasVacationOnDay = (day: Date) => {
    const dayStart = startOfDay(day);
    return filteredEmployees.some(emp => emp.vacationParcels.some(p => {
      if (!p.startDate || !p.endDate) return false;
      const pStart = startOfDay(new Date(p.startDate + 'T00:00:00'));
      const pEnd = startOfDay(new Date(p.endDate + 'T00:00:00'));
      return isWithinInterval(dayStart, { start: pStart, end: pEnd });
    }));
  };

  // Quantidade de militares únicos (do grupo filtrado) de férias em um dia específico
  const getDayVacationCount = (day: Date) => {
    const dayStart = startOfDay(day);
    const userIds = new Set<string>();
    filteredEmployees.forEach(emp => {
      const onVacation = emp.vacationParcels.some(p => {
        if (!p.startDate || !p.endDate) return false;
        const pStart = startOfDay(new Date(p.startDate + 'T00:00:00'));
        const pEnd = startOfDay(new Date(p.endDate + 'T00:00:00'));
        return isWithinInterval(dayStart, { start: pStart, end: pEnd });
      });
      if (onVacation) userIds.add(emp.userId);
    });
    return userIds.size;
  };

  // Estatísticas de um mês: total de pessoas de férias, % do grupo, e picos semanais (semana com mais e com menos gente junto)
  const getMonthStats = (monthDate: Date) => {
    const mStart = startOfMonth(monthDate);
    const mEnd = endOfMonth(monthDate);
    const monthDays = eachDayOfInterval({ start: mStart, end: mEnd });
    // Conta pessoas únicas (por userId), pois um mesmo militar pode ter múltiplos registros por ano de planejamento
    const totalGroup = new Set(filteredEmployees.map(emp => emp.userId)).size;

    const peopleSet = new Set<string>();
    filteredEmployees.forEach(emp => {
      const hasVacationThisMonth = emp.vacationParcels.some(p => {
        if (!p.startDate || !p.endDate) return false;
        const pStart = new Date(p.startDate + 'T00:00:00');
        const pEnd = new Date(p.endDate + 'T00:00:00');
        return pStart <= mEnd && pEnd >= mStart;
      });
      if (hasVacationThisMonth) peopleSet.add(emp.userId);
    });

    const weeksMap = new Map<string, Date[]>();
    monthDays.forEach(day => {
      const weekKey = startOfWeek(day, { weekStartsOn: 0 }).toISOString();
      if (!weeksMap.has(weekKey)) weeksMap.set(weekKey, []);
      weeksMap.get(weekKey)!.push(day);
    });

    let maxWeek = { count: -1, weekStart: null as Date | null };
    let minWeek = { count: Infinity, weekStart: null as Date | null };

    weeksMap.forEach((daysInWeek, key) => {
      const weekPeak = Math.max(...daysInWeek.map(d => getDayVacationCount(d)));
      if (weekPeak > maxWeek.count) maxWeek = { count: weekPeak, weekStart: new Date(key) };
      if (weekPeak < minWeek.count) minWeek = { count: weekPeak, weekStart: new Date(key) };
    });

    const toPercent = (count: number) => totalGroup > 0 ? Math.round((count / totalGroup) * 100) : 0;

    return {
      totalGroup,
      peopleCount: peopleSet.size,
      peoplePercent: toPercent(peopleSet.size),
      maxWeek: { count: Math.max(0, maxWeek.count), percent: toPercent(Math.max(0, maxWeek.count)), weekStart: maxWeek.weekStart },
      minWeek: { count: minWeek.count === Infinity ? 0 : minWeek.count, percent: toPercent(minWeek.count === Infinity ? 0 : minWeek.count), weekStart: minWeek.weekStart }
    };
  };

  const handleSelectMonth = (monthDate: Date) => {
    setCurrentDate(monthDate);
    setViewMode('month');
  };

  const yearMonths = useMemo(() => {
    const yearStart = startOfYear(currentDate);
    return Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));
  }, [currentDate]);

  // Estatísticas pré-calculadas de cada mês do ano, usadas no tooltip da visão anual
  const yearMonthStats = useMemo(() => {
    return yearMonths.map(monthDate => ({ monthDate, stats: getMonthStats(monthDate) }));
  }, [yearMonths, filteredEmployees]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className={`bg-white rounded-3xl shadow-xl border border-slate-100 ${viewMode === 'year' ? 'overflow-visible' : 'overflow-hidden'}`}>
        {/* HEADER DO CALENDÁRIO */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                <CalendarIcon size={28} className="text-orange-500" /> Calendário de Férias
              </h2>
              <p className="text-sm text-slate-500">Visualize os períodos de férias no calendário anual</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* FILTRO POR NOME */}
              <div className="relative group">
                <select 
                  className="appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 pr-10 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-orange-500 transition-all cursor-pointer min-w-[200px]"
                  value={filterUserId}
                  onChange={(e) => setFilterUserId(e.target.value)}
                >
                  <option value="all">Todos</option>
                  {employeeOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronRight size={16} className="rotate-90" />
                </div>
              </div>

              {/* FILTRO POR SETOR */}
              <div className="relative group">
                <select 
                  className="appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 pr-10 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-orange-500 transition-all cursor-pointer min-w-[160px]"
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                >
                  <option value="all">Todos os Setores</option>
                  {sectorOptions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <Filter size={14} />
                </div>
              </div>

              {/* TOGGLE MÊS / ANO */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setViewMode('month')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'month' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <CalendarDays size={14} /> Mês
                </button>
                <button
                  onClick={() => setViewMode('year')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'year' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <LayoutGrid size={14} /> Ano
                </button>
              </div>

              {/* NAVEGAÇÃO */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentDate(viewMode === 'year' ? subMonths(currentDate, 12) : subMonths(currentDate, 1))} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="font-bold text-slate-800 text-lg capitalize min-w-[160px] text-center">
                  {viewMode === 'year' ? format(currentDate, 'yyyy') : format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <button 
                  onClick={() => setCurrentDate(viewMode === 'year' ? addMonths(currentDate, 12) : addMonths(currentDate, 1))} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {viewMode === 'year' ? (
          <>
            {/* VISÃO ANUAL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6 bg-slate-50/30">
              {yearMonthStats.map(({ monthDate, stats }) => (
                <MiniMonth
                  key={monthDate.toISOString()}
                  monthDate={monthDate}
                  hasVacationOnDay={hasVacationOnDay}
                  onSelect={handleSelectMonth}
                  stats={stats}
                />
              ))}
            </div>

            {/* LEGENDA */}
            <div className="p-6 bg-slate-50/50 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Legenda</p>
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm w-fit">
                <div className="w-3 h-3 bg-[#b44116] rounded-sm"></div>
                <span className="text-xs font-bold text-slate-700">Dia com férias planejadas • Clique em um mês para detalhar</span>
              </div>
            </div>
          </>
        ) : (
        <>
        {/* GRID DO CALENDÁRIO */}
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/30">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} className="py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 bg-slate-100 gap-[1px]">
          {days.map(day => {
            const vacations = getDayVacations(day);
            const isCurrentMonth = isSameDay(startOfMonth(day), monthStart);
            
            return (
              <div 
                key={day.toISOString()} 
                className={`min-h-[140px] bg-white p-2 transition-all ${!isCurrentMonth ? 'bg-slate-50/50 grayscale opacity-40' : 'hover:bg-slate-50/30'}`}
              >
                <div className="flex justify-start mb-2">
                  <span className={`text-xs font-bold ${isCurrentMonth ? 'text-slate-400' : 'text-slate-300'}`}>
                    {format(day, 'd')}
                  </span>
                </div>
                
                <div className="space-y-1">
                  {vacations.map((v, i) => (
                    <div 
                      key={`${v.userId}-${i}`} 
                      className={`h-4 ${v.color} text-white text-[8px] font-black px-1.5 flex items-center rounded-sm truncate uppercase tracking-tighter shadow-sm`}
                      title={`${v.rank} ${v.name}`}
                    >
                      {v.rank} {v.name}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* LEGENDA */}
        <div className="p-6 bg-slate-50/50 border-t border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Legenda</p>
          <div className="flex flex-wrap gap-3">
            {activeVacationers.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Nenhuma reserva para este período.</p>
            ) : (
              activeVacationers.map(([id, name]) => (
                <div key={id} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                  <div className="w-3 h-3 bg-[#b44116] rounded-sm"></div>
                  <span className="text-xs font-bold text-slate-700">{name}</span>
                </div>
              ))
            )}
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
};

interface MonthStats {
  totalGroup: number;
  peopleCount: number;
  peoplePercent: number;
  maxWeek: { count: number; percent: number; weekStart: Date | null };
  minWeek: { count: number; percent: number; weekStart: Date | null };
}

interface MiniMonthProps {
  monthDate: Date;
  hasVacationOnDay: (day: Date) => boolean;
  onSelect: (monthDate: Date) => void;
  stats: MonthStats;
}

const MiniMonth: React.FC<MiniMonthProps> = ({ monthDate, hasVacationOnDay, onSelect, stats }) => {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={() => onSelect(monthDate)}
        className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:border-orange-300 hover:shadow-md transition-all"
      >
        <p className="text-sm font-bold text-slate-800 capitalize mb-3">{format(monthDate, 'MMMM', { locale: ptBR })}</p>
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const isCurrentMonth = isSameMonth(day, monthStart);
            const hasVacation = isCurrentMonth && hasVacationOnDay(day);
            return (
              <div
                key={day.toISOString()}
                className={`aspect-square rounded-[3px] flex items-center justify-center text-[8px] font-bold ${
                  !isCurrentMonth ? 'text-slate-200' :
                  hasVacation ? 'bg-[#b44116] text-white' : 'text-slate-400'
                }`}
              >
                {format(day, 'd')}
              </div>
            );
          })}
        </div>
      </button>

      {/* TOOLTIP COM ESTATÍSTICAS DO MÊS */}
      <div className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-2 w-64 -translate-x-1/2 opacity-0 scale-95 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100">
        <div className="bg-slate-900 text-white text-xs rounded-xl shadow-xl p-4 space-y-2">
          <p className="font-black uppercase tracking-widest text-[10px] text-orange-400 capitalize">{format(monthDate, 'MMMM yyyy', { locale: ptBR })}</p>
          <div className="flex items-center justify-between">
            <span className="text-slate-300">De férias no mês</span>
            <span className="font-bold">{stats.peopleCount} ({stats.peoplePercent}%)</span>
          </div>
          <div className="h-px bg-slate-700 my-1" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Semana c/ mais gente</span>
              <span className="font-bold text-red-300">{stats.maxWeek.count} ({stats.maxWeek.percent}%)</span>
            </div>
            {stats.maxWeek.weekStart && (
              <p className="text-[9px] text-slate-400 mt-0.5">
                {format(stats.maxWeek.weekStart, 'dd/MM')} a {format(endOfWeek(stats.maxWeek.weekStart, { weekStartsOn: 0 }), 'dd/MM')}
              </p>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Semana c/ menos gente</span>
              <span className="font-bold text-emerald-300">{stats.minWeek.count} ({stats.minWeek.percent}%)</span>
            </div>
            {stats.minWeek.weekStart && (
              <p className="text-[9px] text-slate-400 mt-0.5">
                {format(stats.minWeek.weekStart, 'dd/MM')} a {format(endOfWeek(stats.minWeek.weekStart, { weekStartsOn: 0 }), 'dd/MM')}
              </p>
            )}
          </div>
          <p className="text-[9px] text-slate-400 pt-1">Base: {stats.totalGroup} militar(es) no filtro atual</p>
        </div>
        <div className="w-3 h-3 bg-slate-900 rotate-45 mx-auto -mt-1.5"></div>
      </div>
    </div>
  );
};

export default CalendarView;


import React, { useState, useMemo } from 'react';
import { useVacation } from '../contexts/VacationContext';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths, 
  startOfWeek, 
  endOfWeek,
  isWithinInterval,
  startOfDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter } from 'lucide-react';

const CalendarView: React.FC = () => {
  const { employees } = useVacation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterUserId, setFilterUserId] = useState('all');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Lista de militares para o filtro
  const employeeOptions = useMemo(() => {
    return employees.map(e => ({ id: e.userId, name: `${e.rank} ${e.warName}` }));
  }, [employees]);

  // Função para pegar férias de um dia específico
  const getDayVacations = (day: Date) => {
    const dayStart = startOfDay(day);
    const list: { name: string; rank: string; color: string; userId: string }[] = [];
    
    employees.forEach(emp => {
      // Aplicar filtro de usuário
      if (filterUserId !== 'all' && emp.userId !== filterUserId) return;

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
    employees.forEach(emp => {
      if (filterUserId !== 'all' && emp.userId !== filterUserId) return;

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
  }, [employees, filterUserId, monthStart, monthEnd]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        {/* HEADER DO CALENDÁRIO */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                <CalendarIcon size={28} className="text-orange-500" /> Calendário de Férias
              </h2>
              <p className="text-sm text-slate-500">Visualize os períodos de férias no calendário anual</p>
            </div>

            <div className="flex items-center gap-4">
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

              {/* NAVEGAÇÃO */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="font-bold text-slate-800 text-lg capitalize min-w-[160px] text-center">
                  {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <button 
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

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
      </div>
    </div>
  );
};

export default CalendarView;

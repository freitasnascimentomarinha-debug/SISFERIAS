
import React from 'react';
import { Employee } from '../types';
import { BadgeCheck, Calendar, Clock, CalendarX, CalendarCheck, User as UserIcon, Shield, AlertTriangle } from 'lucide-react';
import { format, startOfDay, isBefore, isAfter, differenceInDays, isValid, endOfDay } from 'date-fns';

interface EmployeeListProps {
  employees: Employee[];
  planningYear?: number;
}

const EmployeeList: React.FC<EmployeeListProps> = ({ employees, planningYear }) => {
  const now = startOfDay(new Date());

  // Janela de planejamento: 01/12/(Ano-1) até 30/11/(Ano)
  const windowStart = planningYear ? new Date(planningYear - 1, 11, 1) : null;
  const windowEnd = planningYear ? endOfDay(new Date(planningYear, 10, 30)) : null;

  const safeParseDate = (dateStr: string) => {
    if (!dateStr) return new Date(NaN);
    const d = new Date(dateStr + 'T00:00:00');
    return isValid(d) ? d : new Date(NaN);
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'oficial': return 'Oficial';
      case 'civil': return 'Civil';
      default: return 'Praça';
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'oficial': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'civil': return 'bg-blue-50 text-blue-600 border-blue-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      {employees.length === 0 && (
        <div className="text-center py-10 text-slate-400 font-medium">Nenhum militar encontrado para os filtros selecionados.</div>
      )}
      {employees.map((emp) => {
        let gozadosTotal = 0;
        emp.vacationParcels.forEach(p => {
          const pStart = safeParseDate(p.startDate);
          const pEnd = safeParseDate(p.endDate);
          if (!isValid(pStart) || !isValid(pEnd)) return;
          
          if (isAfter(now, pEnd)) {
            gozadosTotal += p.days;
          } else if (!isBefore(now, pStart) && !isAfter(now, pEnd)) {
            const diff = differenceInDays(now, pStart) + 1;
            gozadosTotal += Math.max(0, diff);
          }
        });

        const planned = emp.vacationParcels.reduce((acc, p) => acc + p.days, 0);
        const toSchedule = Math.max(0, emp.totalVacationDays - planned);
        const restantesTotal = Math.max(0, emp.totalVacationDays - gozadosTotal);

        const isCurrentlyOnVacation = emp.vacationParcels.some(p => {
          const s = safeParseDate(p.startDate);
          const e = safeParseDate(p.endDate);
          if (!isValid(s) || !isValid(e)) return false;
          return !isBefore(now, s) && !isAfter(now, e);
        });

        return (
          <div key={emp.id} className={`p-4 rounded-xl border transition-all ${isCurrentlyOnVacation ? 'border-red-500 bg-red-50/20 ring-1 ring-red-100' : 'border-slate-100 bg-white hover:border-orange-200 shadow-sm'}`}>
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold overflow-hidden shadow-sm ${emp.photoUrl ? 'bg-white' : emp.category === 'oficial' ? 'bg-orange-500' : emp.category === 'civil' ? 'bg-blue-500' : 'bg-slate-700'}`}>
                  {emp.photoUrl ? (
                    <img src={emp.photoUrl} alt={emp.warName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg">{emp.warName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900">{emp.rank} {emp.warName}</h4>
                    {isCurrentlyOnVacation && (
                      <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse uppercase">Em Férias</span>
                    )}
                    <span className="bg-slate-100 text-slate-600 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1 border border-slate-200 shadow-sm">
                      <Shield size={10} /> {emp.totalVacationDays} dias
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 uppercase">NIP: {emp.nip} • Setor: {emp.sector}</p>
                </div>
              </div>
              
              <div className="text-right">
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase border shadow-sm ${getCategoryColor(emp.category)}`}>
                  {getCategoryLabel(emp.category)}
                </span>
              </div>
            </div>

            <div className="flex flex-nowrap gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-hide">
              <Badge icon={<BadgeCheck size={12}/>} label={`${gozadosTotal}d gozados`} color="text-green-600 bg-green-50 border-green-100" />
              <Badge icon={<Clock size={12}/>} label={`${restantesTotal}d restantes`} color="text-amber-600 bg-amber-50 border-amber-100" />
              <Badge icon={<CalendarCheck size={12}/>} label={`${planned}d planejados`} color="text-blue-600 bg-blue-50 border-blue-100" />
              <Badge icon={<CalendarX size={12}/>} label={`${toSchedule}d a planejar`} color="text-purple-600 bg-purple-50 border-purple-100" />
            </div>

            <div className="space-y-1.5 border-t border-slate-50 pt-3">
              {emp.vacationParcels.map((p, idx) => {
                const pStart = safeParseDate(p.startDate);
                const pEnd = safeParseDate(p.endDate);
                if (!isValid(pStart) || !isValid(pEnd)) return null;

                const isOutOfWindow = windowStart && windowEnd ? (isBefore(pStart, windowStart) || isAfter(pEnd, windowEnd)) : false;

                let status = 'Pendente';
                let statusColor = 'text-amber-500';
                if (isAfter(now, pEnd)) { status = 'Gozado'; statusColor = 'text-green-500'; }
                else if (!isBefore(now, pStart) && !isAfter(now, pEnd)) { status = 'Em andamento'; statusColor = 'text-red-600'; }

                return (
                  <div key={p.id} className={`flex items-center justify-between text-[11px] group p-1 rounded-lg transition-all ${isOutOfWindow ? 'bg-red-50/50' : ''}`}>
                    <div className="flex items-center gap-2 text-slate-500">
                      <Calendar size={12} className={isOutOfWindow ? "text-red-500" : "group-hover:text-orange-400"} />
                      <span>Parcela {idx + 1}: {format(pStart, 'dd/MM/yy')} - {format(pEnd, 'dd/MM/yy')}</span>
                      <span className="font-bold">({p.days} dias)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`font-bold ${statusColor}`}>{status}</span>
                      {isOutOfWindow && (
                        <span className="text-[9px] font-black text-slate-900 flex items-center gap-0.5">
                          <AlertTriangle size={10} className="text-red-600" /> (Fora da Janela)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Badge = ({ icon, label, color }: { icon: any, label: string, color: string }) => (
  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold whitespace-nowrap min-w-fit flex-shrink-0 ${color}`}>
    {icon} {label}
  </div>
);

export default EmployeeList;


import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Employee } from '../types';
import { isValid } from 'date-fns';

interface VacationChartProps {
  employees: Employee[];
  planningYear?: number;
}

const VacationChart: React.FC<VacationChartProps> = ({ employees, planningYear = 2026 }) => {
  // Janela de planejamento padrão sugerida: Dez (Ano Anterior) até Nov (Ano Atual)
  const months = ['Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov'];
  
  const safeParseDate = (dateStr: string) => {
    if (!dateStr) return new Date(NaN);
    const d = new Date(dateStr + 'T00:00:00');
    return isValid(d) ? d : new Date(NaN);
  };

  const data = months.map((m, idx) => {
    // Cálculo do mês e ano alvo para o índice
    const targetMonth = idx === 0 ? 11 : idx - 1;
    const targetYear = idx === 0 ? planningYear - 1 : planningYear;
    
    let totalPossible = 0;
    let cumulativeReal = 0;
    
    for (let i = 0; i <= idx; i++) {
      const loopMonth = i === 0 ? 11 : i - 1;
      const loopYear = i === 0 ? planningYear - 1 : planningYear;
      
      employees.forEach(emp => {
        if (i === 0) totalPossible += emp.totalVacationDays;
        
        emp.vacationParcels.forEach(p => {
          const start = safeParseDate(p.startDate);
          if (isValid(start) && start.getMonth() === loopMonth && start.getFullYear() === loopYear) {
            cumulativeReal += p.days;
          }
        });
      });
    }

    const idealPerMonth = totalPossible / 12;
    const cumulativeIdeal = Math.round(idealPerMonth * (idx + 1));

    return {
      month: m,
      'Média Real': cumulativeReal,
      'Distribuição Ideal': cumulativeIdeal,
      fullLabel: `${m}/${targetYear}`
    };
  });

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: -20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="month" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} 
          />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
          <Tooltip 
            labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
            labelFormatter={(value, items) => {
               const item = items[0]?.payload;
               return item?.fullLabel || value;
            }}
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
          />
          <Legend 
            verticalAlign="bottom"
            iconType="circle" 
            wrapperStyle={{ paddingTop: '10px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }} 
          />
          <Line 
            type="monotone" 
            dataKey="Média Real" 
            stroke="#f97316" 
            strokeWidth={3} 
            dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
          <Line 
            type="monotone" 
            dataKey="Distribuição Ideal" 
            stroke="#cbd5e1" 
            strokeDasharray="5 5" 
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default VacationChart;

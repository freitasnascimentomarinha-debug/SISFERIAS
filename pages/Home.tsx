
import React, { useMemo } from 'react';
import { useVacation } from '../contexts/VacationContext';
import { Megaphone, Users, UserCheck, Info, Clock, BarChart as ChartIcon, Pin } from 'lucide-react';
import { startOfDay, isBefore, isAfter, isValid, format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Home: React.FC = () => {
  const { employees, settings } = useVacation();
  const now = startOfDay(new Date());

  // Lógica para verificar se um registro de férias específico está ativo hoje
  const isRecordOnVacation = (emp: any) => {
    return emp.vacationParcels.some((p: any) => {
      const s = p.startDate ? new Date(p.startDate + 'T00:00:00') : null;
      const e = p.endDate ? new Date(p.endDate + 'T00:00:00') : null;
      if (!s || !e || !isValid(s) || !isValid(e)) return false;
      return !isBefore(now, s) && !isAfter(now, e);
    });
  };

  // NEW: Agrupamento de militares para evitar duplicidade por múltiplos anos de planejamento
  const uniquePersonnel = useMemo(() => {
    const personMap = new Map<string, { category: string; isOnVacation: boolean }>();

    employees.forEach(emp => {
      const existing = personMap.get(emp.userId);
      const currentRecordIsOnVacation = isRecordOnVacation(emp);

      if (!existing) {
        personMap.set(emp.userId, {
          category: emp.category,
          isOnVacation: currentRecordIsOnVacation
        });
      } else {
        // Se já existe, apenas atualiza se este registro específico mostrar que ele está de férias
        if (currentRecordIsOnVacation) {
          existing.isOnVacation = true;
        }
      }
    });

    return Array.from(personMap.values());
  }, [employees, now]);

  const onVacationCount = useMemo(() => {
    return uniquePersonnel.filter(p => p.isOnVacation).length;
  }, [uniquePersonnel]);

  const totalRegisteredCount = uniquePersonnel.length;

  const workforcePercentage = settings.totalManpower > 0
    ? Math.round((onVacationCount / settings.totalManpower) * 100)
    : 0;

  // Dados para o Gráfico de Colunas Empilhadas por Categoria (Deduplicados)
  const chartData = useMemo(() => {
    const categories = [
      { id: 'praca', label: 'Praça' },
      { id: 'oficial', label: 'Oficial' },
      { id: 'civil', label: 'Civil' }
    ];

    return categories.map(cat => {
      const catPersonnel = uniquePersonnel.filter(p => p.category === cat.id);
      const onVacation = catPersonnel.filter(p => p.isOnVacation).length;
      const active = catPersonnel.length - onVacation;

      return {
        name: cat.label,
        'Em Férias': onVacation,
        'Ativos': active,
        total: catPersonnel.length
      };
    });
  }, [uniquePersonnel]);

  const sortedNotices = useMemo(() => {
    return [...settings.notices].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (!isValid(dateA) || !isValid(dateB)) return 0;
      return dateB.getTime() - dateA.getTime();
    });
  }, [settings.notices]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Cabeçalho Institucional */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16 items-center animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="lg:col-span-1 flex justify-center">
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt="Logo Instituição"
              className="h-52 md:h-64 object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-40 h-40 md:w-52 md:h-52 bg-slate-900 rounded-[52px] shadow-xl flex items-center justify-center text-white font-black text-6xl">
              MB
            </div>
          )}
        </div>

        <div className="lg:col-span-2 text-center">
          <div className="inline-block space-y-6">
            <h2 className="text-xs md:text-sm font-bold text-slate-500 tracking-[0.4em] uppercase">
              MARINHA DO BRASIL
            </h2>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase leading-tight">
              {settings.institutionName}
            </h1>
            <div className="h-1.5 w-20 md:w-24 bg-orange-500 mx-auto rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        <div className="flex flex-col gap-6 lg:col-span-1 h-full">
          {/* Lotação Total do Sistema */}
          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-6 hover:translate-y-[-4px] transition-transform flex-shrink-0">
            <div className="p-4 bg-orange-50 text-orange-600 rounded-3xl">
              <span className="flex items-center justify-center"><Users size={24} /></span>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Efetivo Cadastrado</p>
              <p className="text-2xl font-black text-slate-900">{totalRegisteredCount}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Colaboradores</p>
            </div>
          </div>

          {/* % em Férias Real */}
          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-6 hover:translate-y-[-4px] transition-transform flex-shrink-0">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-3xl">
              <span className="flex items-center justify-center"><UserCheck size={24} /></span>
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">% de Ausência Hoje</p>
              <div className="flex items-center gap-3">
                <p className="text-2xl font-black text-slate-900">{workforcePercentage}%</p>
                <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-1000"
                    style={{ width: `${workforcePercentage}%` }}
                  />
                </div>
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">{onVacationCount} colabores de férias</p>
            </div>
          </div>

          {/* Gráfico Deduplicado */}
          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex-1 flex flex-col min-h-[300px]">
            <div className="flex items-center gap-2 mb-4">
              <ChartIcon size={16} className="text-orange-500" />
              <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Efetivo por Categoria (Real)</h3>
            </div>

            <div className="flex-1 w-full overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                  barSize={40}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingBottom: '10px', textTransform: 'uppercase' }}
                  />
                  <Bar dataKey="Ativos" stackId="a" fill="#e2e8f0" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Em Férias" stackId="a" fill="#f97316" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[9px] text-slate-400 text-center mt-2 font-medium uppercase tracking-tighter">Dados deduplicados por NIP/CPF</p>
          </div>
        </div>

        {/* Quadro de Avisos */}
        <div className="lg:col-span-2 bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden flex flex-col h-[600px]">
          <div className="bg-orange-500 p-7 text-white flex items-center gap-4 flex-shrink-0">
            <div className="p-3 bg-white/20 rounded-2xl">
              <Megaphone size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight uppercase">Quadro de Avisos</h2>
              <p className="text-orange-50 text-[11px] font-medium opacity-80 uppercase tracking-wide">Comunicados Internos da Organização</p>
            </div>
          </div>

          <div className="p-8 space-y-5 overflow-y-auto custom-scrollbar flex-1 bg-white">
            {sortedNotices.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
                <Info size={48} className="mb-4 opacity-10" />
                <p className="font-medium text-sm">Nenhum aviso disponível no momento.</p>
              </div>
            ) : (
              sortedNotices.map((notice) => (
                <div
                  key={notice.id}
                  className={`group p-6 rounded-3xl bg-slate-50 hover:bg-white border transition-all hover:border-orange-200 hover:shadow-lg ${notice.isPinned ? 'border-orange-200 bg-orange-50/10' : 'border-slate-100'}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      {notice.isPinned && <Pin size={16} className="text-orange-500 fill-orange-500" />}
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                        {notice.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-full text-[9px] font-black text-slate-400 uppercase border border-slate-100 shadow-sm">
                      <Clock size={10} />
                      {(() => {
                        const d = new Date(notice.date);
                        return isValid(d) ? format(d, 'dd/MM/yyyy') : '-';
                      })()}
                    </div>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-wrap">
                    {notice.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
//jjj

import React, { useMemo, useState } from 'react';
import { useVacation } from '../contexts/VacationContext';
import { useAuth } from '../contexts/AuthContext';
import { Megaphone, Users, UserCheck, Info, Clock, BarChart as ChartIcon, Pin, HelpCircle, X } from 'lucide-react';
import { startOfDay, isBefore, isAfter, isValid, format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import mascote from '../assets/marca/mascote-redondo.webp';
import logoSisferias from '../assets/marca/logo-sisferias.webp';

const Home: React.FC = () => {
  const { employees, settings } = useVacation();
  const { users, user } = useAuth();
  const now = startOfDay(new Date());
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const [showLearningModal, setShowLearningModal] = useState(false);
  const navigate = useNavigate();

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

  // Conta todos os usuários cadastrados no sistema (não só os que já lançaram férias)
  const totalRegisteredCount = users.length;

  // Percentual calculado sobre o efetivo realmente cadastrado, não sobre o "Efetivo Total" configurado em Segurança
  const workforcePercentage = totalRegisteredCount > 0
    ? Math.round((onVacationCount / totalRegisteredCount) * 100)
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
    <div className="max-w-7xl mx-auto px-4 py-8 relative">
      {/* Cabeçalho Institucional */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10 items-center animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="lg:col-span-1 flex justify-center">
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt="Logo Instituição"
              className="h-52 md:h-64 object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <img src={logoSisferias} alt="SISFÉRIAS" className="h-44 md:h-56 object-contain drop-shadow-sm" />
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
      {/* Boas-vindas com o mascote do SISFERIAS */}
      <div className="mb-10 flex flex-col sm:flex-row items-center gap-5 bg-gradient-to-r from-orange-50 via-white to-white border border-orange-100 rounded-[32px] p-5 shadow-sm">
        <img src={mascote} alt="Mascote do SISFERIAS" className="w-20 h-20 shrink-0 drop-shadow-md" />
        <div className="flex-1 text-center sm:text-left">
          <p className="text-lg font-black text-slate-900">Olá, {user?.warName || user?.name?.split(' ')[0] || 'militar'}!</p>
          <p className="text-sm text-slate-600 font-medium">Suas férias bem organizadas: lance os períodos, acompanhe a contagem e imprima a papeleta por aqui.</p>
        </div>
        <button type="button" onClick={() => navigate('/vacation-form')}
          className="px-5 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-black shadow-md shrink-0">
          Minhas Férias
        </button>
      </div>

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
              <p className="text-[10px] font-bold text-slate-500 uppercase">{onVacationCount} Em férias</p>
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
              <p className="text-orange-50 text-[11px] font-medium uppercase tracking-wide">Comunicados Internos da Organização</p>
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

      {showLearningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-[32px] bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-5 bg-orange-500 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black uppercase tracking-widest">Aprendendo a usar</h3>
                <p className="text-[11px] text-orange-100 font-semibold uppercase tracking-wide">Resumo rápido do sistema</p>
              </div>
              <button type="button" onClick={() => setShowLearningModal(false)} className="p-2 rounded-full hover:bg-white/15 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm text-slate-600 leading-relaxed">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="font-black text-slate-900 mb-1">1. Lançar Férias</p>
                <p>Preencha ou revise as parcelas do militar na tela de lançamento, ajustando datas, setor, foto e demais dados cadastrais.</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="font-black text-slate-900 mb-1">2. Emitir Papeleta</p>
                <p>Na página de impressão, informe o NUP, revise os dados da papeleta e gere o documento final para tramitação.</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="font-black text-slate-900 mb-1">3. Acompanhar Trâmite</p>
                <p>Administradores podem acompanhar pendências, parcelas regulares e concluídas na página Trâmite.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed right-5 bottom-6 z-40 flex flex-col items-end gap-3">
        {showHelpMenu && (
          <div className="w-[280px] rounded-[28px] border border-orange-100 bg-white shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between px-5 py-4 bg-orange-500 text-white">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest">Ajuda Rápida</h3>
                <p className="text-[10px] text-orange-100 font-semibold uppercase tracking-wide">Escolha uma opção</p>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpMenu(false)}
                className="p-1.5 rounded-full hover:bg-white/15 transition-colors"
                aria-label="Fechar ajuda"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3 bg-gradient-to-b from-orange-50/40 to-white">
              <button
                type="button"
                onClick={() => {
                  setShowHelpMenu(false);
                  setShowLearningModal(true);
                }}
                className="w-full text-left p-4 rounded-2xl border border-slate-100 bg-white hover:border-orange-200 hover:bg-orange-50/40 transition-all shadow-sm"
              >
                <p className="text-sm font-black text-slate-900">Aprendendo a usar</p>
                <p className="text-[11px] font-medium text-slate-500 mt-1">Veja orientações rápidas para navegar e usar o sistema.</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowHelpMenu(false);
                  navigate('/suggestions');
                }}
                className="w-full text-left p-4 rounded-2xl border border-slate-100 bg-white hover:border-orange-200 hover:bg-orange-50/40 transition-all shadow-sm"
              >
                <p className="text-sm font-black text-slate-900">Sugestões</p>
                <p className="text-[11px] font-medium text-slate-500 mt-1">Acesse um espaço para ideias e melhorias do sistema.</p>
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowHelpMenu(prev => !prev)}
          className="w-12 h-12 rounded-full bg-orange-500 text-white shadow-xl shadow-orange-500/25 hover:bg-orange-600 transition-all flex items-center justify-center"
          aria-label="Abrir ajuda"
        >
          <HelpCircle size={20} />
        </button>
      </div>
    </div>
  );
};

export default Home;
//jjj
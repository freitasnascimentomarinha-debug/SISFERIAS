import React, { useMemo, useState } from 'react';
import { Building2, Filter, MessageSquare, Search, ShieldCheck, Users } from 'lucide-react';
import { useVacation } from '../contexts/VacationContext';
import { SECTORS } from '../types';

const Justifications: React.FC = () => {
  const { employees } = useVacation();
  const [justifSearch, setJustifSearch] = useState('');
  const [justifSector, setJustifSector] = useState('all');
  const [justifYear, setJustifYear] = useState('all');

  const allSectors = useMemo(() => {
    const fromEmployees = employees.map(e => e.sector).filter(Boolean);
    return [...new Set([...SECTORS, ...fromEmployees])].sort();
  }, [employees]);

  const allYears = useMemo(() => {
    const years = employees
      .map(e => e.planningYear)
      .filter((year): year is number => !!year)
      .sort((a, b) => b - a);
    return [...new Set(years)];
  }, [employees]);

  const filteredJustifications = useMemo(() => {
    return employees.filter(e => {
      const hasJustif = e.justification && e.justification.trim().length > 0;
      const matchText = e.warName.toLowerCase().includes(justifSearch.toLowerCase()) ||
        e.name.toLowerCase().includes(justifSearch.toLowerCase());
      const matchSector = justifSector === 'all' || e.sector === justifSector;
      const matchYear = justifYear === 'all' || (e.planningYear || 0).toString() === justifYear;
      return hasJustif && matchText && matchSector && matchYear;
    });
  }, [employees, justifSearch, justifSector, justifYear]);

  const visibleJustifications = useMemo(() => {
    return employees.filter(e => e.justification && e.justification.trim().length > 0);
  }, [employees]);

  const sectorSummary = useMemo(() => {
    const counts = filteredJustifications.reduce<Record<string, number>>((acc, employee) => {
      const sector = employee.sector || 'Não definido';
      acc[sector] = (acc[sector] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredJustifications]);

  const topSector = sectorSummary[0];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <MessageSquare className="text-orange-500" size={32} /> Justificativas
          </h2>
          <p className="text-slate-500">Consulta de justificativas da tripulação conforme a visibilidade do administrador.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Justificativas Visíveis"
          value={visibleJustifications.length}
          subtitle="dentro da sua permissão"
          icon={<ShieldCheck size={22} />}
          color="bg-orange-50 text-orange-600"
        />
        <StatCard
          title="Resultado Filtrado"
          value={filteredJustifications.length}
          subtitle="após busca e setor"
          icon={<Filter size={22} />}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Setores no Resultado"
          value={sectorSummary.length}
          subtitle="com justificativas exibidas"
          icon={<Building2 size={22} />}
          color="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title="Setor em Destaque"
          value={topSector?.[0] || '--'}
          subtitle={topSector ? `${topSector[1]} justificativa(s)` : 'sem dados'}
          icon={<Users size={22} />}
          color="bg-amber-50 text-amber-600"
        />
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><MessageSquare className="text-orange-500" size={24} /> Justificativas da Tripulação</h3>
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Filtrar por nome..."
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500 w-full md:w-64"
                value={justifSearch}
                onChange={e => setJustifSearch(e.target.value)}
              />
            </div>
            <select
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
              value={justifSector}
              onChange={e => setJustifSector(e.target.value)}
            >
              <option value="all">Todos os Setores</option>
              {allSectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
              value={justifYear}
              onChange={e => setJustifYear(e.target.value)}
            >
              <option value="all">Todas as Janelas</option>
              {allYears.map(y => <option key={y} value={y.toString()}>{y}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-8 p-4 rounded-2xl border border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2 mb-3 text-slate-700 font-bold text-sm">
            <Building2 size={16} className="text-orange-500" /> Contagem por Setor
          </div>
          <div className="flex flex-wrap gap-2">
            {sectorSummary.length === 0 ? (
              <span className="text-sm text-slate-400">Nenhum setor com justificativas nos filtros atuais.</span>
            ) : (
              sectorSummary.map(([sector, count]) => (
                <span
                  key={sector}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-sm"
                >
                  <span className="text-orange-600">{sector}</span>
                  <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100">{count}</span>
                </span>
              ))
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredJustifications.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-400 font-medium border-4 border-dashed border-slate-50 rounded-[40px]">
              <MessageSquare size={48} className="mx-auto mb-4 opacity-10" />
              Nenhuma justificativa encontrada para os filtros aplicados.
            </div>
          ) : (
            filteredJustifications.map(emp => (
              <div key={emp.id} className="p-6 rounded-3xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">{emp.rank} {emp.warName}</h4>
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-0.5">
                      NIP: {emp.nip} • SETOR: {emp.sector} • <span className="text-orange-600">JANELA: {emp.planningYear || 'Não especificada'}</span>
                    </p>
                  </div>
                  <span className="text-[9px] bg-orange-50 text-orange-600 border border-orange-100 px-3 py-1 rounded-full font-black tracking-tighter uppercase">Privado</span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 text-sm text-slate-600 italic leading-relaxed relative">
                  <div className="absolute -top-3 left-4 text-orange-200 opacity-50"><MessageSquare size={24} fill="currentColor" /></div>
                  "{emp.justification}"
                </div>
              </div>
            ))
          )}
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

export default Justifications;
// Relatório de férias em Excel (.xlsx), gerado no navegador a partir da
// lista exibida no Painel (respeita os filtros aplicados na tela).
// A biblioteca só é carregada quando alguém clica em "Exportar Excel".
import { Employee } from '../types';

type Cell = { value: any; type?: any; format?: string; fontWeight?: 'bold'; backgroundColor?: string; align?: 'left' | 'center' | 'right'; color?: string; wrap?: boolean } | null;
type Row = Cell[];

const HEADER_BG = '#FED7AA'; // laranja claro, como o sistema
const TOTAL_BG = '#E2E8F0';
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const parseDate = (value?: string) => {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const dayMs = 86_400_000;
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / dayMs);

const header = (labels: string[]): Row => labels.map(value => ({ value, fontWeight: 'bold', backgroundColor: HEADER_BG, align: 'center', wrap: true }));
const text = (value: unknown): Cell => ({ value: value === undefined || value === null ? '' : String(value), type: String });
const num = (value: number, format?: string): Cell => ({ value, type: Number, ...(format ? { format } : {}) });
const date = (value: Date | null): Cell => (value ? { value, type: Date, format: 'dd/mm/yyyy' } : text(''));

/** Situação da parcela e dias cumpridos até hoje (mesmos critérios do Painel). */
function parcelInfo(start: Date | null, end: Date | null, days: number, today: Date) {
  if (!start || !end) return { status: 'Sem datas', done: 0 };
  if (today > end) return { status: 'Cumprido', done: days };
  if (today >= start && today <= end) return { status: 'Em andamento', done: Math.max(0, daysBetween(start, today) + 1) };
  return { status: 'Planejado', done: 0 };
}

export interface ExcelReportOptions {
  /** Janela do Painel (o ano de direito é a janela - 1). */
  planningYear: number;
  filters?: Record<string, string>;
  totalManpower?: number;
  institutionName?: string;
  generatedBy?: string;
}

export async function exportVacationExcel(employees: Employee[], opts: ExcelReportOptions) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const today = startOfToday();
  const rightYear = opts.planningYear - 1;

  // ---- Militares e parcelas ----
  const militaryRows: Row[] = [];
  const parcelRows: Row[] = [];
  type SectorAgg = { militares: number; direito: number; programados: number; cumpridos: number; restantes: number; aPlanejar: number };
  const bySector = new Map<string, SectorAgg>();
  // Dezembro (ano de direito) a novembro (janela): dias e militares de férias em cada mês.
  const monthKeys = Array.from({ length: 12 }, (_, i) => new Date(rightYear, 11 + i, 1));
  const monthDays = monthKeys.map(() => 0);
  const monthPeople = monthKeys.map(() => new Set<string>());

  const sorted = [...employees].sort((a, b) => (a.sector || '').localeCompare(b.sector || '') || (a.warName || a.name).localeCompare(b.warName || b.name));
  for (const emp of sorted) {
    let programados = 0;
    let cumpridos = 0;
    emp.vacationParcels.forEach((p, idx) => {
      const start = parseDate(p.startDate);
      const end = parseDate(p.endDate);
      const days = Number(p.days) || 0;
      programados += days;
      const info = parcelInfo(start, end, days, today);
      cumpridos += info.done;
      parcelRows.push([
        text(emp.rank), text(emp.warName), text(emp.name), text(emp.nip), text(emp.sector || 'Não definido'),
        num(idx + 1), date(start), date(end), num(days), text(info.status), text(p.nup || ''),
        text(start ? `${MONTHS[start.getMonth()]}/${start.getFullYear()}` : ''),
      ]);
      if (start && end) {
        for (let d = new Date(start); d <= end; d = new Date(d.getTime() + dayMs)) {
          const m = monthKeys.findIndex(k => k.getFullYear() === d.getFullYear() && k.getMonth() === d.getMonth());
          if (m >= 0) { monthDays[m] += 1; monthPeople[m].add(emp.id); }
        }
      }
    });
    const direito = Number(emp.totalVacationDays) || 0;
    const restantes = Math.max(0, direito - cumpridos);
    const aPlanejar = Math.max(0, direito - programados);
    militaryRows.push([
      text(emp.rank), text(emp.warName), text(emp.name), text(emp.nip), text(emp.sector || 'Não definido'),
      text(emp.category === 'oficial' ? 'Oficial' : emp.category === 'civil' ? 'Servidor Civil' : 'Praça'),
      num(emp.planningYear), num(direito), num(programados), num(cumpridos), num(restantes), num(aPlanejar),
      num(emp.vacationParcels.length), text(emp.justification || ''),
    ]);
    const key = emp.sector || 'Não definido';
    const agg = bySector.get(key) || { militares: 0, direito: 0, programados: 0, cumpridos: 0, restantes: 0, aPlanejar: 0 };
    agg.militares += 1; agg.direito += direito; agg.programados += programados;
    agg.cumpridos += cumpridos; agg.restantes += restantes; agg.aPlanejar += aPlanejar;
    bySector.set(key, agg);
  }

  // ---- Resumo por setor ----
  const pct = (a: number, b: number) => (b > 0 ? a / b : 0);
  const sectorRows: Row[] = [...bySector.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { numeric: true }))
    .map(([sector, a]) => [
      text(sector), num(a.militares), num(a.direito), num(a.programados), num(a.cumpridos), num(a.restantes), num(a.aPlanejar),
      num(pct(a.cumpridos, a.direito), '0%'),
    ]);
  const total = [...bySector.values()].reduce((t, a) => ({
    militares: t.militares + a.militares, direito: t.direito + a.direito, programados: t.programados + a.programados,
    cumpridos: t.cumpridos + a.cumpridos, restantes: t.restantes + a.restantes, aPlanejar: t.aPlanejar + a.aPlanejar,
  }), { militares: 0, direito: 0, programados: 0, cumpridos: 0, restantes: 0, aPlanejar: 0 });
  const totalCell = (c: Cell): Cell => (c ? { ...c, fontWeight: 'bold', backgroundColor: TOTAL_BG } : c);
  sectorRows.push([
    text('TOTAL'), num(total.militares), num(total.direito), num(total.programados), num(total.cumpridos), num(total.restantes), num(total.aPlanejar),
    num(pct(total.cumpridos, total.direito), '0%'),
  ].map(totalCell));

  // ---- Por mês ----
  const manpower = opts.totalManpower || 0;
  const monthRows: Row[] = monthKeys.map((k, i) => [
    text(`${MONTHS[k.getMonth()]}/${k.getFullYear()}`), num(monthPeople[i].size), num(monthDays[i]),
    manpower ? num(monthPeople[i].size / manpower, '0.0%') : text('—'),
  ]);

  // ---- Informações ----
  const filters = Object.entries(opts.filters || {}).filter(([, v]) => v && v !== 'Todos' && v !== 'Todas');
  const infoRows: Row[] = [
    [{ value: `Relatório de Férias — ${opts.institutionName || 'SISFERIAS'}`, fontWeight: 'bold' }],
    [],
    [text('Janela'), text(String(opts.planningYear))],
    [text('Ano de direito'), text(String(rightYear))],
    [text('Militares no relatório'), num(employees.length)],
    [text('Gerado em'), text(new Date().toLocaleString('pt-BR'))],
    [text('Gerado por'), text(opts.generatedBy || '')],
    [text('Filtros do Painel'), text(filters.length ? filters.map(([k, v]) => `${k}: ${v}`).join(' | ') : 'Nenhum (todos os militares visíveis)')],
    [],
    [text('Critérios: "Cumpridos" conta as parcelas já encerradas e os dias já passados das parcelas em andamento (como no Painel). "A planejar" = direito − dias programados.')],
  ];

  const file = writeExcelFile([
    { sheet: 'Informações', data: infoRows, columns: [{ width: 24 }, { width: 80 }] },
    {
      sheet: 'Resumo por setor',
      data: [header(['Setor', 'Militares', 'Dias de direito', 'Dias programados', 'Dias cumpridos', 'Dias restantes', 'A planejar', '% cumprido']), ...sectorRows],
      columns: [{ width: 16 }, { width: 11 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 12 }],
    },
    {
      sheet: 'Militares',
      data: [header(['Posto/Grad.', 'Nome de guerra', 'Nome completo', 'NIP', 'Setor', 'Categoria', 'Ano de direito', 'Direito', 'Programados', 'Cumpridos', 'Restantes', 'A planejar', 'Parcelas', 'Justificativa']), ...militaryRows],
      columns: [{ width: 11 }, { width: 16 }, { width: 30 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 9 }, { width: 12 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 9 }, { width: 40 }],
    },
    {
      sheet: 'Parcelas',
      data: [header(['Posto/Grad.', 'Nome de guerra', 'Nome completo', 'NIP', 'Setor', 'Parcela', 'Início', 'Término', 'Dias', 'Situação', 'NUP', 'Mês de início']), ...parcelRows],
      columns: [{ width: 11 }, { width: 16 }, { width: 30 }, { width: 12 }, { width: 12 }, { width: 8 }, { width: 12 }, { width: 12 }, { width: 7 }, { width: 14 }, { width: 24 }, { width: 13 }],
    },
    {
      sheet: 'Por mês',
      data: [header(['Mês', 'Militares de férias', 'Dias de férias', '% do efetivo']), ...monthRows],
      columns: [{ width: 12 }, { width: 18 }, { width: 15 }, { width: 13 }],
    },
  ] as any);

  const blob: Blob = await file.toBlob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `SISFERIAS_ferias_janela_${opts.planningYear}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

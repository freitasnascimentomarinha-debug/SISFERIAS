
import React, { useState } from 'react';
import { Download, FileDown, FileSpreadsheet } from 'lucide-react';
import { useVacation } from '../contexts/VacationContext';
import { useAuth } from '../contexts/AuthContext';
import { format, startOfDay, isBefore, isAfter, isValid, differenceInDays } from 'date-fns';
import { Employee } from '../types';

interface ExportButtonsProps {
  employees: Employee[];
  filters?: Record<string, string>;
  planningYear?: number;
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ employees, filters, planningYear = new Date().getFullYear() }) => {
  const { settings } = useVacation();
  const { user } = useAuth();
  const [excelBusy, setExcelBusy] = useState(false);

  const exportExcel = async () => {
    setExcelBusy(true);
    try {
      const { exportVacationExcel } = await import('../lib/excelReport');
      await exportVacationExcel(employees, {
        planningYear,
        filters,
        totalManpower: settings.totalManpower,
        institutionName: settings.institutionName,
        generatedBy: user?.name,
      });
    } catch (error) {
      console.error('Erro ao gerar Excel:', error);
      alert('Não foi possível gerar o Excel: ' + (error instanceof Error ? error.message : ''));
    } finally {
      setExcelBusy(false);
    }
  };

  const now = startOfDay(new Date());

  const escapeHtml = (value: string) => {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const safeParseDate = (dateStr: string) => {
    if (!dateStr) return new Date(NaN);
    const d = new Date(dateStr + 'T00:00:00');
    return isValid(d) ? d : new Date(NaN);
  };

  const toPercent = (value: number, total: number) => {
    if (total <= 0) return 0;
    return Math.round((value / total) * 100);
  };

  const exportCSV = () => {
    if (employees.length === 0) {
      alert('Não há dados para exportar.');
      return;
    }
    const headers = ['NIP', 'Militar', 'Posto/Grad', 'Setor', 'Janela', 'Parcela', 'Início', 'Término', 'Dias', 'Status'];
    const rows: string[][] = [];
    employees.forEach(emp => {
      emp.vacationParcels.forEach((p, idx) => {
        const pStart = safeParseDate(p.startDate);
        const pEnd = safeParseDate(p.endDate);
        let status = 'Pendente';
        if (isValid(pEnd) && isAfter(now, pEnd)) status = 'Cumprido';
        else if (isValid(pStart) && isValid(pEnd) && !isBefore(now, pStart) && !isAfter(now, pEnd)) status = 'Em andamento';
        rows.push([
          emp.nip, emp.warName, emp.rank, emp.sector, (emp.planningYear || '---').toString(), (idx + 1).toString(),
          isValid(pStart) ? format(pStart, 'dd/MM/yyyy') : '---',
          isValid(pEnd) ? format(pEnd, 'dd/MM/yyyy') : '---',
          p.days.toString(), status
        ]);
      });
    });
    const csvContent = headers.join(';') + '\n' + rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_ferias_${format(new Date(), 'dd-MM-yyyy')}.csv`;
    link.click();
  };

  const generatePDFReport = () => {
    if (employees.length === 0) {
      alert('Não há dados para gerar o relatório.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita pop-ups para gerar o documento.');
      return;
    }

    const months = ['Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov'];
    const chartData = months.map((month, idx) => {
      let totalPossible = 0;
      let cumulativeReal = 0;

      for (let i = 0; i <= idx; i++) {
        const loopMonth = i === 0 ? 11 : i - 1;
        const loopYear = i === 0 ? planningYear - 1 : planningYear;

        employees.forEach(emp => {
          if (i === 0) totalPossible += emp.totalVacationDays;

          emp.vacationParcels.forEach(parcel => {
            const start = safeParseDate(parcel.startDate);
            if (isValid(start) && start.getMonth() === loopMonth && start.getFullYear() === loopYear) {
              cumulativeReal += parcel.days;
            }
          });
        });
      }

      const idealPerMonth = totalPossible / 12;
      const cumulativeIdeal = Math.round(idealPerMonth * (idx + 1));

      return {
        month,
        real: toPercent(cumulativeReal, totalPossible),
        ideal: toPercent(cumulativeIdeal, totalPossible),
        label: `${month}/${idx === 0 ? planningYear - 1 : planningYear}`
      };
    });

    const chartWidth = 720;
    const chartHeight = 280;
    const leftPad = 54;
    const rightPad = 24;
    const topPad = 24;
    const bottomPad = 42;
    const innerWidth = chartWidth - leftPad - rightPad;
    const innerHeight = chartHeight - topPad - bottomPad;
    const stepX = chartData.length > 1 ? innerWidth / (chartData.length - 1) : innerWidth;
    const yFor = (value: number) => topPad + innerHeight - (value / 100) * innerHeight;
    const xFor = (index: number) => leftPad + index * stepX;

    const realPath = chartData.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(point.real)}`).join(' ');
    const idealPath = chartData.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(point.ideal)}`).join(' ');

    const gridLines = [0, 25, 50, 75, 100].map(value => `
      <g>
        <line x1="${leftPad}" y1="${yFor(value)}" x2="${chartWidth - rightPad}" y2="${yFor(value)}" stroke="#e2e8f0" stroke-dasharray="4 4" />
        <text x="${leftPad - 12}" y="${yFor(value) + 4}" text-anchor="end" font-size="10" fill="#64748b">${value}%</text>
      </g>
    `).join('');

    const xLabels = chartData.map((point, index) => `
      <g>
        <text x="${xFor(index)}" y="${chartHeight - 18}" text-anchor="middle" font-size="10" fill="#64748b" font-weight="700">${point.month}</text>
      </g>
    `).join('');

    const realDots = chartData.map((point, index) => `
      <circle cx="${xFor(index)}" cy="${yFor(point.real)}" r="4" fill="#f97316" />
    `).join('');

    let totalGozadosGlobal = 0;
    let totalDireitoGlobal = 0;
    let totalParcelas = 0;
    let emAndamentoCount = 0;

    const filtersContent = Object.entries(filters || {}).map(([key, value]) => {
      const normalizedKey = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, c => c.toUpperCase())
        .trim();
      return `<span class="chip"><b>${escapeHtml(normalizedKey)}:</b> ${escapeHtml(value || 'Todos')}</span>`;
    }).join('');

    const tableContent = employees.map(emp => {
      let totalGozadoMilitar = 0;
      totalDireitoGlobal += emp.totalVacationDays;
      
      const parcelRows = emp.vacationParcels.map((p, idx) => {
        const pStart = safeParseDate(p.startDate);
        const pEnd = safeParseDate(p.endDate);
        
        let status = 'Pendente';
        let diasGozadosNestaParcela = 0;

        if (isValid(pEnd) && isAfter(now, pEnd)) {
          status = 'Cumprido';
          diasGozadosNestaParcela = p.days;
        } else if (isValid(pStart) && isValid(pEnd) && !isBefore(now, pStart) && !isAfter(now, pEnd)) {
          status = 'Em andamento';
          diasGozadosNestaParcela = Math.max(0, differenceInDays(now, pStart) + 1);
          emAndamentoCount += 1;
        }

        totalParcelas += 1;
        totalGozadoMilitar += diasGozadosNestaParcela;

        return `
          <tr>
            <td>${idx === 0 ? `<b>${emp.warName}</b>` : ''}</td>
            <td>${idx === 0 ? emp.nip : ''}</td>
            <td align="center">${emp.planningYear || '---'}</td>
            <td align="center">${idx + 1}</td>
            <td>${isValid(pStart) ? format(pStart, 'dd/MM/yy') : '--'} a ${isValid(pEnd) ? format(pEnd, 'dd/MM/yy') : '--'}</td>
            <td align="center">${p.days}</td>
            <td align="center">${diasGozadosNestaParcela}</td>
            <td align="center"><b>${status.toUpperCase()}</b></td>
          </tr>
        `;
      }).join('');

      const saldoRestante = Math.max(0, emp.totalVacationDays - totalGozadoMilitar);
      totalGozadosGlobal += totalGozadoMilitar;

      // Linha de Soma Total para o Militar
      const summaryRow = `
        <tr class="summary-row">
          <td colspan="5" align="right"><b>TOTAL: ${emp.rank} ${emp.warName}</b></td>
          <td align="center"><b>Direito: ${emp.totalVacationDays}d</b></td>
          <td align="center"><b>Cumprido: ${totalGozadoMilitar}d</b></td>
          <td align="center"><b>Restante: ${saldoRestante}d</b></td>
        </tr>
      `;

      return parcelRows + summaryRow;
    }).join('');

    const totalRestanteGlobal = Math.max(0, totalDireitoGlobal - totalGozadosGlobal);
    const taxaConclusao = totalDireitoGlobal > 0 ? Math.round((totalGozadosGlobal / totalDireitoGlobal) * 100) : 0;

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório de Férias - MB</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 18px; color: #0f172a; background: #f8fafc; }
            .header {
              background: linear-gradient(120deg, #ea580c, #f97316 55%, #fb923c);
              color: white;
              border-radius: 16px;
              padding: 18px 20px;
              margin-bottom: 14px;
              box-shadow: 0 10px 22px rgba(234, 88, 12, 0.22);
            }
            .header h1 { margin: 0 0 4px 0; font-size: 20px; text-transform: uppercase; letter-spacing: 0.7px; }
            .meta { margin: 0; font-size: 12px; opacity: 0.95; }
            .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0 10px 0; }
            .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; }
            .card .label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; }
            .card .value { margin-top: 3px; font-size: 18px; font-weight: 800; color: #0f172a; }
            .card .sub { margin-top: 2px; font-size: 10px; color: #64748b; }
            .section {
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 12px;
              margin: 10px 0;
            }
            .section-title { margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.4px; color: #334155; }
            .chips { display: flex; flex-wrap: wrap; gap: 6px; }
            .chip {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              font-size: 10px;
              color: #334155;
              background: #fff7ed;
              border: 1px solid #fed7aa;
              border-radius: 999px;
              padding: 4px 8px;
            }
            .chart-wrap { padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; background: white; }
            th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; }
            th { background-color: #f1f5f9; text-transform: uppercase; font-weight: 800; color: #334155; }
            tr:nth-child(even) td { background: #fcfdff; }
            .summary-row td { background-color: #eef2ff !important; font-size: 10px; }
            .footer { margin-top: 16px; text-align: right; font-size: 9px; font-style: italic; color: #64748b; }
            @page { size: A4; margin: 1cm; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Relatório Consolidado de Férias</h1>
            <p class="meta">Marinha do Brasil • Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} • Base filtrada do Painel</p>
          </div>

          <div class="cards">
            <div class="card">
              <div class="label">Militares Filtrados</div>
              <div class="value">${employees.length}</div>
              <div class="sub">registros</div>
            </div>
            <div class="card">
              <div class="label">Dias Cumpridos</div>
              <div class="value">${totalGozadosGlobal}</div>
              <div class="sub">dias computados</div>
            </div>
            <div class="card">
              <div class="label">Dias Restantes</div>
              <div class="value">${totalRestanteGlobal}</div>
              <div class="sub">saldo atual</div>
            </div>
            <div class="card">
              <div class="label">Taxa de Conclusão</div>
              <div class="value">${taxaConclusao}%</div>
              <div class="sub">sobre o total de direito</div>
            </div>
          </div>

          <div class="section">
            <h3 class="section-title">Filtros Aplicados</h3>
            <div class="chips">${filtersContent || '<span class="chip">Sem filtros específicos</span>'}</div>
          </div>

          <div class="section">
            <h3 class="section-title">Gráfico • Distribuição de Férias</h3>
            <div class="chart-wrap">
              <svg width="100%" viewBox="0 0 ${chartWidth} ${chartHeight}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Distribuição de férias">
                <defs>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#f97316" />
                    <stop offset="100%" stop-color="#ea580c" />
                  </linearGradient>
                </defs>
                ${gridLines}
                <path d="${idealPath}" fill="none" stroke="#cbd5e1" stroke-width="3" stroke-dasharray="8 6" stroke-linecap="round" stroke-linejoin="round" />
                <path d="${realPath}" fill="none" stroke="url(#lineGradient)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
                ${realDots}
                ${xLabels}
                <g transform="translate(${chartWidth - 230}, 8)">
                  <circle cx="8" cy="8" r="5" fill="#f97316" />
                  <text x="22" y="12" font-size="11" fill="#334155" font-weight="700">Média Real (%)</text>
                  <line x1="130" y1="8" x2="154" y2="8" stroke="#cbd5e1" stroke-width="3" stroke-dasharray="7 5" stroke-linecap="round" />
                  <text x="162" y="12" font-size="11" fill="#334155" font-weight="700">Distribuição Ideal (%)</text>
                </g>
              </svg>
            </div>
          </div>

          <div class="section">
            <h3 class="section-title">Detalhamento de Parcelas (${totalParcelas} parcelas, ${emAndamentoCount} em andamento)</h3>
          <table>
            <thead>
              <tr>
                <th width="15%">Militar</th>
                <th width="10%">NIP</th>
                <th width="8%">Janela</th>
                <th width="5%">Parc.</th>
                <th width="20%">Período</th>
                <th width="8%">Duração</th>
                <th width="8%">Cumpridos</th>
                <th width="15%">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableContent}
            </tbody>
          </table>
          </div>
          <div class="footer">
            Sistema de Controle de Férias MB - Baseado no saldo de direito individual.
          </div>
          <script>
            window.onload = function() { 
              window.print(); 
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="flex gap-2 no-print">
      <button 
        type="button"
        onClick={generatePDFReport}
        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all hover:bg-black shadow-lg shadow-slate-200"
      >
        <FileDown size={18} /> Gerar Relatório (PDF)
      </button>
      <button
        type="button"
        onClick={() => void exportExcel()}
        disabled={excelBusy}
        className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all hover:bg-green-700 disabled:opacity-60"
      >
        <FileSpreadsheet size={18} /> {excelBusy ? 'Gerando...' : 'Exportar Excel'}
      </button>
      <button 
        type="button"
        onClick={exportCSV}
        className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm font-bold flex items-center gap-2 transition-all hover:bg-slate-50"
      >
        <Download size={18} /> Exportar CSV
      </button>
    </div>
  );
};

export default ExportButtons;

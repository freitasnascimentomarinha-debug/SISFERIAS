
import React from 'react';
import { useVacation } from '../contexts/VacationContext';
import { Download, FileDown } from 'lucide-react';
import { format, startOfDay, isBefore, isAfter, isValid, differenceInDays } from 'date-fns';

const ExportButtons: React.FC = () => {
  const { employees } = useVacation();
  const now = startOfDay(new Date());

  const safeParseDate = (dateStr: string) => {
    if (!dateStr) return new Date(NaN);
    const d = new Date(dateStr + 'T00:00:00');
    return isValid(d) ? d : new Date(NaN);
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
        if (isValid(pEnd) && isAfter(now, pEnd)) status = 'Gozado';
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

    const tableContent = employees.map(emp => {
      let totalGozadoMilitar = 0;
      
      const parcelRows = emp.vacationParcels.map((p, idx) => {
        const pStart = safeParseDate(p.startDate);
        const pEnd = safeParseDate(p.endDate);
        
        let status = 'Pendente';
        let diasGozadosNestaParcela = 0;

        if (isValid(pEnd) && isAfter(now, pEnd)) {
          status = 'Gozado';
          diasGozadosNestaParcela = p.days;
        } else if (isValid(pStart) && isValid(pEnd) && !isBefore(now, pStart) && !isAfter(now, pEnd)) {
          status = 'Em andamento';
          diasGozadosNestaParcela = Math.max(0, differenceInDays(now, pStart) + 1);
        }

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

      // Linha de Soma Total para o Militar
      const summaryRow = `
        <tr class="summary-row">
          <td colspan="5" align="right"><b>TOTAL: ${emp.rank} ${emp.warName}</b></td>
          <td align="center"><b>Direito: ${emp.totalVacationDays}d</b></td>
          <td align="center"><b>Gozado: ${totalGozadoMilitar}d</b></td>
          <td align="center"><b>Restante: ${saldoRestante}d</b></td>
        </tr>
      `;

      return parcelRows + summaryRow;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório de Férias - MB</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #1e293b; }
            h1 { text-align: center; text-transform: uppercase; font-size: 18px; margin-bottom: 5px; }
            p.meta { text-align: center; font-size: 12px; margin-bottom: 30px; color: #64748b; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #000; padding: 6px; text-align: left; }
            th { background-color: #f1f5f9; text-transform: uppercase; font-weight: bold; }
            .summary-row { background-color: #f8fafc; font-size: 11px; }
            @page { size: A4; margin: 1cm; }
          </style>
        </head>
        <body>
          <h1>Relatório Consolidado de Férias</h1>
          <p class="meta">Marinha do Brasil - Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
          <table>
            <thead>
              <tr>
                <th width="15%">Militar</th>
                <th width="10%">NIP</th>
                <th width="8%">Janela</th>
                <th width="5%">Parc.</th>
                <th width="20%">Período</th>
                <th width="8%">Duração</th>
                <th width="8%">Gozados</th>
                <th width="15%">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableContent}
            </tbody>
          </table>
          <div style="margin-top: 40px; text-align: right; font-size: 9px; font-style: italic; color: #94a3b8;">
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
        onClick={exportCSV}
        className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm font-bold flex items-center gap-2 transition-all hover:bg-slate-50"
      >
        <Download size={18} /> Exportar CSV
      </button>
    </div>
  );
};

export default ExportButtons;

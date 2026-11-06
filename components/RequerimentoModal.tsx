import React, { useMemo, useState } from 'react';
import { FileSignature, X, Download, AlertTriangle } from 'lucide-react';
import { Employee } from '../types';
import { DadosRequerimento, SimNao, gerarRequerimento, nomeArquivoRequerimento, formatarNip, formatarPosto } from '../lib/requerimento';

const inputClass = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500';
const LOCAL_KEY = 'sisferias_requerimento_local';

const lerLocal = () => { try { return localStorage.getItem(LOCAL_KEY) || ''; } catch { return ''; } };
const gravarLocal = (v: string) => { try { localStorage.setItem(LOCAL_KEY, v); } catch { /* sem armazenamento local */ } };
const dataBR = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '--');

interface Props {
  employee: Employee;
  om: string;
  especialidade: string;
  ano: number;
  parcelaInicial: number;
  onClose: () => void;
  onGerado: (d: DadosRequerimento, parcela: number) => void;
}

const SimNaoField: React.FC<{ id: string; label: string; ajuda: string; value: SimNao; onChange: (v: SimNao) => void; extra?: React.ReactNode }> =
  ({ id, label, ajuda, value, onChange, extra }) => (
    <fieldset className="p-3 rounded-2xl border border-slate-200 bg-white">
      <legend className="sr-only">{label}</legend>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800">{label}</p>
          <p className="text-[11px] text-slate-500">{ajuda}</p>
        </div>
        <div className="flex gap-1 shrink-0" role="radiogroup" aria-label={label}>
          {(['S', 'N'] as SimNao[]).map(v => (
            <label key={v} className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-black border transition-colors ${value === v ? 'bg-orange-600 text-white border-orange-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
              <input type="radio" name={id} value={v} checked={value === v} onChange={() => onChange(v)} className="sr-only" />
              {v === 'S' ? 'Sim' : 'Não'}
            </label>
          ))}
        </div>
      </div>
      {extra}
    </fieldset>
  );

const RequerimentoModal: React.FC<Props> = ({ employee, om, especialidade, ano, parcelaInicial, onClose, onGerado }) => {
  const parcelas = employee.vacationParcels.filter(p => p.startDate && p.endDate);
  const [parcelaIdx, setParcelaIdx] = useState(Math.min(parcelaInicial, Math.max(0, parcelas.length - 1)));
  const parcela = parcelas[parcelaIdx];
  const anoInicio = parcela ? Number(parcela.startDate.slice(0, 4)) : ano;

  const [nup, setNup] = useState('');
  const [destinatario, setDestinatario] = useState('Encarregado de Pessoal');
  const [nome, setNome] = useState(employee.name || '');
  const [posto, setPosto] = useState(employee.rank || '');
  const [esp, setEsp] = useState(especialidade || '');
  const [nip, setNip] = useState(employee.nip || '');
  const [anoFerias, setAnoFerias] = useState(ano);
  const [natalino, setNatalino] = useState<SimNao>('N');
  const [anoNatalino, setAnoNatalino] = useState(anoInicio);
  const [adicional, setAdicional] = useState<SimNao>('S');
  const [remuneracao, setRemuneracao] = useState<SimNao>('N');
  const [local, setLocal] = useState(lerLocal() || 'Rio de Janeiro, RJ');
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  const previa = useMemo(() => {
    const ident = `${formatarPosto(posto)}${esp.trim() ? `-${esp.trim().toUpperCase()}` : ''}`;
    return `${nome.toUpperCase()}, ${ident}, ${formatarNip(nip)}, servindo presentemente nesta Organização Militar, requer que se digne conceder as parcelas assinaladas abaixo, em virtude de suas férias, relativas ao ano de ${anoFerias}, estarem programadas para o período de ${dataBR(parcela?.startDate || '')} a ${dataBR(parcela?.endDate || '')}.`;
  }, [nome, posto, esp, nip, anoFerias, parcela]);

  const confirmar = async () => {
    if (!parcela) { setErro('Não há parcela com datas lançadas.'); return; }
    if (!nome.trim() || !posto.trim() || !nip.trim()) { setErro('Preencha nome, posto/graduação e NIP.'); return; }
    setErro(''); setGerando(true);
    const dados: DadosRequerimento = {
      om, nup: nup.trim(), destinatario: destinatario.trim() || 'Encarregado de Pessoal',
      nome: nome.trim(), posto: posto.trim(), especialidade: esp.trim(), nip: nip.trim(),
      anoFerias, inicio: parcela.startDate, fim: parcela.endDate,
      adiantamentoNatalino: natalino, anoNatalino, adicionalFerias: adicional, remuneracaoFerias: remuneracao,
      local: local.trim() || 'Rio de Janeiro, RJ',
    };
    try {
      const blob = await gerarRequerimento(dados);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nomeArquivoRequerimento(dados);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      gravarLocal(dados.local);
      onGerado(dados, employee.vacationParcels.indexOf(parcela) + 1);
      onClose();
    } catch (e) {
      setErro('Não foi possível gerar o arquivo. ' + (e instanceof Error ? e.message : ''));
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 no-print">
      <div className="bg-white w-full max-w-2xl max-h-[92vh] rounded-[28px] shadow-2xl overflow-hidden flex flex-col" role="dialog" aria-modal="true" aria-labelledby="req-titulo">
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <FileSignature size={22} />
            <div>
              <h3 id="req-titulo" className="font-bold text-lg leading-tight">Requerimento de Férias</h3>
              <p className="text-[11px] text-orange-100">Confira os dados e escolha as parcelas. O arquivo Word será baixado.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="hover:bg-white/20 p-1.5 rounded-full" aria-label="Fechar"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto" tabIndex={0}>
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="req-nup" className="text-[10px] font-bold text-slate-500 uppercase">NUP do requerimento (SIGAD)</label>
              <input id="req-nup" autoComplete="off" className={inputClass} placeholder="Ex: 63341.000563/2026-02" value={nup} onChange={e => setNup(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor="req-ao" className="text-[10px] font-bold text-slate-500 uppercase">Ao</label>
              <input id="req-ao" autoComplete="off" className={inputClass} value={destinatario} onChange={e => setDestinatario(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="req-nome" className="text-[10px] font-bold text-slate-500 uppercase">Nome completo</label>
              <input id="req-nome" autoComplete="off" className={inputClass} value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3 sm:col-span-2">
              <div className="space-y-1">
                <label htmlFor="req-posto" className="text-[10px] font-bold text-slate-500 uppercase">Posto/Grad.</label>
                <input id="req-posto" autoComplete="off" className={inputClass} value={posto} onChange={e => setPosto(e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-1">
                <label htmlFor="req-esp" className="text-[10px] font-bold text-slate-500 uppercase">Quadro/Esp.</label>
                <input id="req-esp" autoComplete="off" className={inputClass} value={esp} onChange={e => setEsp(e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-1">
                <label htmlFor="req-nip" className="text-[10px] font-bold text-slate-500 uppercase">NIP</label>
                <input id="req-nip" autoComplete="off" className={inputClass} value={nip} onChange={e => setNip(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="req-parcela" className="text-[10px] font-bold text-slate-500 uppercase">Período (parcela)</label>
              <select id="req-parcela" className={inputClass} value={parcelaIdx} onChange={e => { const i = Number(e.target.value); setParcelaIdx(i); setAnoNatalino(Number(parcelas[i].startDate.slice(0, 4))); }}>
                {parcelas.length === 0 && <option value={0}>Nenhuma parcela com datas</option>}
                {parcelas.map((p, i) => <option key={p.id} value={i}>Parcela {employee.vacationParcels.indexOf(p) + 1}: {dataBR(p.startDate)} a {dataBR(p.endDate)} ({p.days}d)</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="req-ano" className="text-[10px] font-bold text-slate-500 uppercase">Férias relativas ao ano</label>
              <input id="req-ano" type="number" autoComplete="off" className={inputClass} value={anoFerias} onChange={e => setAnoFerias(Number(e.target.value) || ano)} />
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Parcelas solicitadas</h4>
            <SimNaoField id="req-natalino" label="Adiantamento do Adicional Natalino (50%)" ajuda="Art. 24.3 da SGM-302, Vol. II" value={natalino} onChange={setNatalino}
              extra={natalino === 'S' && (
                <div className="mt-2 flex items-center gap-2">
                  <label htmlFor="req-ano-natalino" className="text-[11px] font-bold text-slate-500">Do ano de</label>
                  <input id="req-ano-natalino" type="number" autoComplete="off" className={`${inputClass} w-28`} value={anoNatalino} onChange={e => setAnoNatalino(Number(e.target.value) || anoInicio)} />
                </div>
              )} />
            <SimNaoField id="req-adicional" label="Adicional de Férias (1/3)" ajuda="Art. 24.4: não depende de solicitação, é pago ao sair de férias" value={adicional} onChange={setAdicional} />
            <SimNaoField id="req-remuneracao" label="Remuneração de Férias (70%)" ajuda="Art. 24.7 da SGM-302, Vol. II" value={remuneracao} onChange={setRemuneracao} />
          </section>

          <div className="space-y-1">
            <label htmlFor="req-local" className="text-[10px] font-bold text-slate-500 uppercase">Local</label>
            <input id="req-local" autoComplete="off" className={inputClass} value={local} onChange={e => setLocal(e.target.value)} />
          </div>

          <section className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Prévia do texto</p>
            <p className="text-xs text-slate-700 text-justify leading-relaxed">{previa}</p>
          </section>

          {erro && (
            <p role="alert" className="flex items-center gap-2 text-sm font-bold text-red-700"><AlertTriangle size={16} /> {erro}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm">Cancelar</button>
          <button type="button" onClick={() => { void confirmar(); }} disabled={gerando || !parcela}
            className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50">
            <Download size={16} /> {gerando ? 'Gerando…' : 'OK, baixar requerimento'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequerimentoModal;

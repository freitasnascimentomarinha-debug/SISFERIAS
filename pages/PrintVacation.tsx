
import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useVacation } from '../contexts/VacationContext';
import { Printer, ArrowLeft, Save, MapPin, Shield, CheckCircle2, FileText, Clock, User, Camera } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, isValid, addDays, startOfDay, isAfter } from 'date-fns';
import { MilitaryCategory, PRACA_RANKS, OFICIAL_RANKS, CIVIL_RANKS } from '../types';

interface StaffMember {
  name: string;
  nip: string;
  rank: string;
  category: MilitaryCategory;
  function: string;
}

const inputClass = "w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500 transition-all";

const StaffInputGroup = ({ label, member, onChange }: { label: string, member: StaffMember, onChange: (m: StaffMember) => void }) => {
  const ranks = member.category === 'oficial' ? OFICIAL_RANKS : member.category === 'praca' ? PRACA_RANKS : CIVIL_RANKS;
  return (
    <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Shield size={14} className="text-orange-500" />
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</h4>
      </div>
      <div className="space-y-2">
        <input className={inputClass} placeholder="Nome Completo" value={member.name} onChange={e => onChange({ ...member, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <input className={inputClass} placeholder="NIP" value={member.nip} onChange={e => onChange({ ...member, nip: e.target.value })} />
          <select className={inputClass} value={member.category} onChange={e => onChange({ ...member, category: e.target.value as MilitaryCategory, rank: '' })}>
            <option value="oficial">Oficial</option>
            <option value="praca">Praça</option>
            <option value="civil">Civil</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select className={inputClass} value={member.rank} onChange={e => onChange({ ...member, rank: e.target.value })}>
            <option value="">Patente</option>
            {ranks.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input className={inputClass} placeholder="Função" value={member.function} onChange={e => onChange({ ...member, function: e.target.value })} />
        </div>
      </div>
    </div>
  );
};

const PrintVacation: React.FC = () => {
  const { user } = useAuth();
  const { employees, addAuditLog, updateParcelNup } = useVacation();
  const { id } = useParams();
  const navigate = useNavigate();

  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedParcelIdx, setSelectedParcelIdx] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [nup, setNup] = useState('');
  const [printError, setPrintError] = useState<string | null>(null);
  const [isNupSaved, setIsNupSaved] = useState(false);

  // Estados dos campos de preenchimento
  const [ship, setShip] = useState('CENTRO DE OPERAÇÕES DO ABASTECIMENTO');
  const [specialization, setSpecialization] = useState('PL');
  const [docDate, setDocDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [licTime, setLicTime] = useState('16:10');
  const [aprTime, setAprTime] = useState('07:30');
  const [isDesmuniciado, setIsDesmuniciado] = useState('sim');
  const [phone, setPhone] = useState('');
  const [observations, setObservations] = useState('');
  const [address, setAddress] = useState({ street: '', number: '', complement: '', zip: '', city: '', state: '' });

  const [encarregado, setEncarregado] = useState<StaffMember>({ name: '', nip: '', rank: '', category: 'praca', function: 'Encarregado' });
  const [encarregadoDep, setEncarregadoDep] = useState<StaffMember>({ name: '', nip: '', rank: '', category: 'praca', function: 'Encarregado do Dep. Pessoal' });
  const [viceDiretor, setViceDiretor] = useState<StaffMember>({ name: '', nip: '', rank: '', category: 'oficial', function: 'Vice-Diretor' });
  const [diretor, setDiretor] = useState<StaffMember>({ name: '', nip: '', rank: '', category: 'oficial', function: 'Diretor' });

  // Identifica o ID do militar para criar uma chave única no LocalStorage
  const targetId = id || user?.id;
  const storageKey = useMemo(() => {
    if (!targetId) return null;
    const emp = employees.find(e => e.id === targetId || e.userId === targetId);
    const uid = emp?.userId || targetId;
    return `vacation_print_u_${uid}_v15`;
  }, [targetId, employees]);

  // Carrega os dados específicos deste militar quando a chave de armazenamento muda
  useEffect(() => {
    if (!storageKey) return;

    // Reset para valores padrão antes de carregar o novo (evita que dados de um usuário apareçam em outro)
    setPhone('');
    setAddress({ street: '', number: '', complement: '', zip: '', city: '', state: '' });
    setObservations('');
    setShip('CENTRO DE OPERAÇÕES DO ABASTECIMENTO');
    setSpecialization('PL');
    setIsDesmuniciado('sim');

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const data = JSON.parse(saved);
      if (data.phone) setPhone(data.phone);
      if (data.address) setAddress(data.address);
      if (data.encarregado) setEncarregado(data.encarregado);
      if (data.encarregadoDep) setEncarregadoDep(data.encarregadoDep);
      if (data.viceDiretor) setViceDiretor(data.viceDiretor);
      if (data.diretor) setDiretor(data.diretor);
      if (data.observations) setObservations(data.observations);
      if (data.ship) setShip(data.ship);
      if (data.specialization) setSpecialization(data.specialization);
      if (data.licTime) setLicTime(data.licTime);
      if (data.aprTime) setAprTime(data.aprTime);
      if (data.isDesmuniciado) setIsDesmuniciado(data.isDesmuniciado);
    }
  }, [storageKey]);

  const employee = useMemo(() => {
    return employees.find(e => (e.id === targetId || e.userId === targetId) && (e.planningYear === selectedYear));
  }, [targetId, employees, selectedYear]);

  const parcel = employee?.vacationParcels[selectedParcelIdx];

  useEffect(() => {
    setNup(parcel?.nup || '');
    setPrintError(null);
    setIsNupSaved(false);
  }, [employee?.id]);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setSelectedParcelIdx(0);
    setNup('');
    setPrintError(null);
    setIsNupSaved(false);
  };

  const handleParcelChange = (index: number) => {
    setSelectedParcelIdx(index);
    setNup('');
    setPrintError(null);
    setIsNupSaved(false);
  };

  const handleSave = async (): Promise<boolean> => {
    if (!storageKey) return false;

    const oldDataRaw = localStorage.getItem(storageKey);
    const newData = { phone, address, encarregado, encarregadoDep, viceDiretor, diretor, observations, ship, specialization, licTime, aprTime, isDesmuniciado };
    
    if (oldDataRaw) {
      const oldData = JSON.parse(oldDataRaw);
      const actor = user?.name || 'Sistema';

      if (JSON.stringify(oldData.address) !== JSON.stringify(address)) {
        addAuditLog({
          userName: actor,
          action: 'Alteração',
          field: 'Endereço de Permanência (Config)',
          oldValue: `${oldData.address.street}, ${oldData.address.number}`,
          newValue: `${address.street}, ${address.number}`
        });
      }

      if (oldData.observations !== observations) {
        addAuditLog({
          userName: actor,
          action: 'Alteração',
          field: 'Observações do Anexo (Config)',
          oldValue: oldData.observations || 'Vazio',
          newValue: observations || 'Vazio'
        });
      }
    }

    localStorage.setItem(storageKey, JSON.stringify(newData));

    if (employee && parcel) {
      try {
        await updateParcelNup(employee.id, parcel.id, nup.trim());
        setIsNupSaved(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao salvar NUP da parcela.';
        setPrintError(message);
        setIsNupSaved(false);
        return false;
      }
    }

    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
    return true;
  };

  const handlePrint = async () => {
    if (!employee || !parcel) {
      alert("Selecione um militar com planejamento válido antes de imprimir.");
      return;
    }

    if (!nup.trim()) {
      setPrintError('Preencha o NUP da parcela para imprimir/gerar PDF.');
      return;
    }

    const saved = await handleSave();
    if (!saved) {
      return;
    }
    setPrintError(null);

    addAuditLog({
      userName: user?.name || 'Sistema',
      action: 'Impressão',
      field: `Papeleta: ${employee.rank} ${employee.warName}`,
      oldValue: '-',
      newValue: `Janela: ${selectedYear} | Parcela: ${selectedParcelIdx + 1} (${parcel.days}d) | NUP: ${nup.trim()}`
    });

    const safeParse = (d: string) => d ? format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy') : '---';
    
    const currentParcelStart = parcel.startDate || '9999-12-31';
    let totalDaysConsumedAtThisPoint = 0;
    
    employee.vacationParcels.forEach((p) => {
      if (!p.startDate) return;
      if (p.startDate <= currentParcelStart) {
        totalDaysConsumedAtThisPoint += p.days;
      }
    });
    
    const remainingDays = Math.max(0, employee.totalVacationDays - totalDaysConsumedAtThisPoint);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert("Por favor, habilite pop-ups.");

    printWindow.document.write(`
      <html>
        <head>
          <title>Papeleta MB - ${employee.warName}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .page-landscape { 
                width: 297mm; 
                height: 209mm; 
                padding: 10mm; 
                box-sizing: border-box; 
                page-break-after: always; 
                display: flex; 
                gap: 8mm; 
                font-family: 'Times New Roman', serif; 
              }
              @page { size: landscape; margin: 0; }
            }
            body { font-family: 'Times New Roman', serif; line-height: 1.1; margin: 0; }
            .page-landscape { width: 297mm; height: 210mm; margin: 0 auto; display: flex; gap: 8mm; padding: 10mm; }
            .column { flex: 1; border: 1px solid #000; padding: 6mm; position: relative; display: flex; flex-direction: column; }
            .text-red-navy { color: #b91c1c !important; }
            .border-dotted-custom { border-bottom: 1px dotted #444; }
          </style>
        </head>
        <body onload="window.print()">
          <div class="page-landscape">
            <div class="column">
              <div class="flex justify-between items-start mb-2">
                <div class="text-left">
                   <p class="text-[12px] font-bold text-red-navy italic uppercase">Faltam ${remainingDays} dias</p>
                </div>
                <div class="text-center flex-1">
                  <p class="text-[10px] font-bold uppercase tracking-widest">Marinha do Brasil</p>
                </div>
                <div class="w-20"></div>
              </div>

              <div class="flex justify-between items-end mt-2 px-4">
                <span class="uppercase text-[8px] font-bold">Autorização de Férias do Ano</span>
                <div className="flex flex-col items-center">
                  <span class="text-[14px] font-bold text-red-navy border-b-2 border-red-navy px-4">${selectedYear}</span>
                  <span class="text-[7px] text-red-navy uppercase font-bold">Janela</span>
                </div>
                <div class="flex flex-col items-center">
                  <span class="text-[14px] font-bold text-red-navy px-2">${parcel.days} dias</span>
                  <span class="text-[7px] text-red-navy uppercase font-bold">Duração</span>
                </div>
              </div>

              <div class="text-center mt-2 mb-3">
                <span class="text-[9px] font-bold uppercase">NUP do Processo: </span>
                <span class="text-[12px] font-bold text-red-navy border-b border-black px-2">${nup.trim()}</span>
              </div>

              <div class="text-center my-4">
                <h2 class="text-[14px] font-bold border-b border-black inline-block px-8 py-0.5 uppercase">${ship}</h2>
                <p class="text-[8px] text-red-navy uppercase mt-0.5 font-bold">Órgão</p>
              </div>

              <div class="text-right mb-4">
                <span class="border-b border-black min-w-[120px] inline-block text-center font-bold text-[11px]">${safeParse(docDate)}</span>
                <p class="text-[8px] text-red-navy uppercase mr-10 mt-0.5 font-bold">Data</p>
              </div>

              <div class="border-b border-black mb-0.5">
                <span class="text-red-navy font-bold uppercase text-[12px]">${employee.name}</span>
              </div>
              <p class="text-[8px] text-red-navy uppercase mt-0.5 mb-4 font-bold">Nome Completo</p>

              <div class="grid grid-cols-3 border-y border-black py-1.5 mb-6 text-center">
                <div class="border-r border-black">
                  <span class="text-[13px] font-bold">${employee.rank}</span>
                  <p class="text-[9px] text-red-navy uppercase mt-0.5 font-bold">Grad.</p>
                </div>
                <div class="border-r border-black">
                  <span class="text-[13px] font-bold">${specialization}</span>
                  <p class="text-[9px] text-red-navy uppercase mt-0.5 font-bold">Esp.</p>
                </div>
                <div>
                  <span class="text-[13px] font-bold">${employee.nip}</span>
                  <p class="text-[9px] text-red-navy uppercase mt-0.5 font-bold">Nip</p>
                </div>
              </div>

              <div class="space-y-3 mb-6 text-[11px]">
                <div class="flex items-center">
                  <span class="w-28 font-bold uppercase">Licenciamento</span>
                  <span class="flex-1 text-center font-bold text-red-navy border-b-dotted-custom">${safeParse(parcel.startDate)}</span>
                  <span class="w-20 text-right font-bold uppercase">às ${licTime} hs</span>
                </div>
                <div class="flex items-center">
                  <span class="w-28 font-bold uppercase">Início</span>
                  <span class="flex-1 text-center font-bold text-red-navy border-b-dotted-custom">${safeParse(parcel.startDate)}</span>
                  <span class="w-20"></span>
                </div>
                <div class="flex items-center">
                  <span class="w-28 font-bold uppercase">Fim</span>
                  <span class="flex-1 text-center font-bold text-red-navy border-b-dotted-custom">${safeParse(parcel.endDate)}</span>
                  <span class="w-20"></span>
                </div>
                <div class="flex items-center">
                  <span class="w-28 font-bold uppercase">Apresentação</span>
                  <span class="flex-1 text-center font-bold text-red-navy border-b-dotted-custom">${safeParse(addDays(new Date(parcel.endDate + 'T00:00:00'), 1).toISOString().split('T')[0])}</span>
                  <span class="w-20 text-right font-bold uppercase">às ${aprTime} hs</span>
                </div>
              </div>

              <div class="mb-3">
                <span class="border-b border-black w-full inline-block font-bold uppercase text-[11px] py-0.5">${address.street}${address.number ? ', ' + address.number : ''}</span>
                <p class="text-[8px] text-red-navy uppercase mt-0.5 font-bold text-center">Permanência</p>
              </div>

              <div class="grid grid-cols-2 gap-6 mb-4 text-center">
                <div>
                  <span class="border-b border-black w-full inline-block font-bold uppercase py-0.5 text-[11px]">${address.city}</span>
                  <p class="text-[8px] text-red-navy uppercase mt-0.5 font-bold">Cidade</p>
                </div>
                <div>
                  <span class="border-b border-black w-full inline-block font-bold uppercase py-0.5 text-[11px]">${address.state}</span>
                  <p class="text-[8px] text-red-navy uppercase mt-0.5 font-bold">Estado</p>
                </div>
              </div>

              <div class="flex items-center gap-2 mb-4">
                 <span class="text-[10px] font-bold text-red-navy uppercase">Contato:</span>
                 <span class="border-b border-black flex-1 font-bold text-[11px]">${phone}</span>
              </div>

              <div class="flex items-center gap-4 mt-auto">
                <div class="flex-1">
                   <div class="flex items-center gap-2">
                    <span class="font-bold uppercase text-[10px]">Desmuniciado:</span>
                    <span class="border-b border-black flex-1 text-center font-bold text-red-navy uppercase py-0.5 text-[12px]">${isDesmuniciado}</span>
                  </div>
                </div>
                <div class="flex-1 text-center">
                  <div class="border-t border-black pt-1">
                    <p class="text-[9px] font-bold text-red-navy uppercase">${viceDiretor.rank} ${viceDiretor.name}</p>
                    <p class="text-[7px] uppercase">${viceDiretor.function}</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="column">
              <div class="text-center mb-4">
                <h2 class="text-[12px] font-bold uppercase border-b border-black inline-block px-4 py-0.5">Instruções para Licenciamento</h2>
              </div>

              <ol class="list-decimal space-y-3 pl-6 text-[10px] leading-tight text-justify">
                <li>Mantenha seu endereço de férias atualizado na Unidade para possíveis contatos.</li>
                <li>Porte esta papeleta em todos os deslocamentos durante o período de licença.</li>
                <li>Em caso de perturbação da ordem pública grave, apresente-se à autoridade militar mais próxima imediatamente.</li>
                <li>Garanta os meios financeiros e logísticos necessários para seu regresso no prazo estipulado.</li>
                <li>Providencie seu retorno com antecedência. Exceder o prazo de licença é falta grave passível de punição disciplinar.</li>
                <li>Mantenha conduta exemplar, condizente com a hierarquia e as tradições da Marinha do Brasil.</li>
                <li>Tomei conhecimento formal destas instruções em _____/_____/_____.</li>
              </ol>

              <div class="mt-auto pt-6 text-center">
                <div class="mb-10 text-[10px] font-bold uppercase tracking-tight">
                  Grad: ${employee.rank} &nbsp;&nbsp;&nbsp;&nbsp; Esp: ${specialization} &nbsp;&nbsp;&nbsp;&nbsp; NIP: ${employee.nip}
                </div>
                <div class="border-t border-black w-[75%] mx-auto pt-1">
                   <p class="text-[9px] font-bold uppercase leading-none">Assinatura do Militar</p>
                   <p class="text-[8px] text-slate-400">(${employee.warName})</p>
                </div>
              </div>

              <div class="mt-4 text-[7px] italic text-slate-300 flex justify-between">
                <span>Controle MB - Papeleta Eletrônica</span>
                <span>Pág 1/2</span>
              </div>
            </div>
          </div>

          <div class="page-landscape">
            <div class="column">
              <div class="flex justify-between items-center mb-4 border-b border-slate-900 pb-2">
                <div class="flex gap-4 items-center">
                  ${employee.photoUrl ? `
                    <div class="w-20 h-24 border border-black overflow-hidden shadow-sm flex-shrink-0">
                      <img src="${employee.photoUrl}" class="w-full h-full object-cover">
                    </div>
                  ` : `
                    <div class="w-20 h-24 border border-dashed border-slate-300 flex items-center justify-center text-slate-300 font-bold uppercase text-[7px] flex-shrink-0">Sem Foto</div>
                  `}
                  <div>
                    <h2 class="text-[18px] font-bold uppercase text-slate-900 leading-tight">${employee.rank} ${employee.name}</h2>
                    <p class="text-[11px] font-bold text-red-navy uppercase tracking-widest">NIP: ${employee.nip} | ESP: ${specialization}</p>
                    <p class="text-[10px] text-slate-500 uppercase mt-0.5">SETOR: ${employee.sector} | JANELA: ${selectedYear} | ${parcel.days} DIAS | NUP: ${nup.trim()}</p>
                  </div>
                </div>
                <div class="text-right">
                  <h2 class="text-[14px] font-black uppercase text-slate-800 tracking-tighter">ANEXO ADMINISTRATIVO</h2>
                  <p class="text-[8px] italic text-slate-400">Registro Oficial do Período</p>
                </div>
              </div>

              <div class="space-y-4 flex-1 flex flex-col">
                <section class="flex-1 flex flex-col">
                  <h3 class="text-[11px] font-bold uppercase bg-slate-100 p-1.5 border-l-4 border-slate-900 mb-2 tracking-widest">Detalhamento e Observações</h3>
                  <div class="border border-black p-6 flex-1 text-[13px] italic leading-relaxed bg-slate-50/20 text-justify">
                    ${observations || "Nenhum registro administrativo adicional para este período de licenciamento."}
                  </div>
                </section>

                <section class="mt-4">
                  <h3 class="text-[10px] font-bold uppercase border-b border-black mb-10 pb-1">Autenticação e Responsáveis</h3>
                  <div class="grid grid-cols-4 gap-6 text-center">
                    <div class="flex flex-col items-center">
                      <div class="w-full border-t border-black mb-1"></div>
                      <p class="text-[9px] font-bold uppercase leading-tight">${encarregado.rank} ${encarregado.name}</p>
                      <p class="text-[7px] uppercase text-slate-500">${encarregado.function}</p>
                    </div>
                    <div class="flex flex-col items-center">
                      <div class="w-full border-t border-black mb-1"></div>
                      <p class="text-[9px] font-bold uppercase leading-tight">${encarregadoDep.rank} ${encarregadoDep.name}</p>
                      <p class="text-[7px] uppercase text-slate-500">${encarregadoDep.function}</p>
                    </div>
                    <div class="flex flex-col items-center">
                      <div class="w-full border-t border-black mb-1"></div>
                      <p class="text-[9px] font-bold uppercase leading-tight">${viceDiretor.rank} ${viceDiretor.name}</p>
                      <p class="text-[7px] uppercase text-slate-500">${viceDiretor.function}</p>
                    </div>
                    <div class="flex flex-col items-center">
                      <div class="w-full border-t border-black mb-1"></div>
                      <p class="text-[9px] font-bold uppercase leading-tight">${diretor.rank} ${diretor.name}</p>
                      <p class="text-[7px] uppercase text-slate-500">${diretor.function}</p>
                    </div>
                  </div>
                </section>
              </div>

              <div class="mt-4 flex justify-between text-[8px] text-slate-400 italic border-t border-slate-100 pt-2">
                 <span>Página Oficial de Registro Administrativo - MB</span>
                 <span>Pág 2/2 - Emitido em ${format(new Date(), 'dd/MM/yyyy HH:mm')}</span>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 relative">
      {showToast && (
        <div className="fixed top-24 right-8 z-[100] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-right-4 border-l-4 border-green-500">
          <CheckCircle2 className="text-green-400" size={24} />
          <div>
            <p className="font-bold text-sm">Configuração Salva!</p>
            <p className="text-[10px] text-slate-400">Dados persistidos com sucesso.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-8 text-white flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/15 rounded-2xl"><Printer size={32} /></div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Emissão de Documento</h2>
              <p className="text-orange-100 text-sm">Pág 1 (Papeleta) | Pág 2 (Anexo) - Ambas em Paisagem</p>
            </div>
          </div>
          <button onClick={() => navigate(-1)} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"><ArrowLeft size={24}/></button>
        </div>

        <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            <section className="p-5 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock size={14}/> Janela de Referência</h3>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">Ano</label>
                   <select className={inputClass} value={selectedYear} onChange={e => handleYearChange(parseInt(e.target.value))}>
                     {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                   </select>
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">Parcela</label>
                   <select className={inputClass} value={selectedParcelIdx} onChange={e => handleParcelChange(parseInt(e.target.value))} disabled={!employee}>
                     {employee ? employee.vacationParcels.map((p, i) => (
                       <option key={i} value={i}>P{i + 1} ({p.days} dias)</option>
                     )) : <option>Nenhum dado</option>}
                   </select>
                 </div>
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">NUP (Obrigatório para Impressão/PDF)</label>
                 <input
                   className={`${inputClass} ${printError ? 'border-red-400 bg-red-50 focus:ring-red-300' : ''}`}
                   placeholder="Ex: 62012.000123/2026-91"
                   value={nup}
                   onChange={e => {
                     setNup(e.target.value);
                     setIsNupSaved(false);
                     if (printError) setPrintError(null);
                   }}
                 />
                 <div className="flex items-center justify-between gap-3">
                   <p className="text-[10px] text-slate-500">Ao trocar de parcela, o campo NUP é limpo automaticamente.</p>
                   {nup.trim() && (
                     <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${isNupSaved ? 'text-green-700 bg-green-50 border-green-200' : 'text-amber-700 bg-amber-50 border-amber-200'}`}>
                       {isNupSaved ? 'NUP salvo' : 'NUP pendente'}
                     </span>
                   )}
                 </div>
               </div>
               {printError && (
                 <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-bold">
                   {printError}
                 </div>
               )}
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">Emissão do Doc</label>
                 <input type="date" className={inputClass} value={docDate} onChange={e => setDocDate(e.target.value)} />
               </div>
            </section>

            <section className="space-y-4">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MapPin size={14}/> Local de Permanência</h3>
               <div className="grid grid-cols-4 gap-3">
                 <div className="col-span-3">
                   <input className={inputClass} placeholder="Logradouro" value={address.street} onChange={e => setAddress({...address, street: e.target.value})} />
                 </div>
                 <input className={inputClass} placeholder="Nº" value={address.number} onChange={e => setAddress({...address, number: e.target.value})} />
                 <div className="col-span-2">
                   <input className={inputClass} placeholder="Cidade" value={address.city} onChange={e => setAddress({...address, city: e.target.value})} />
                 </div>
                 <input className={inputClass} placeholder="Estado" value={address.state} onChange={e => setAddress({...address, state: e.target.value})} />
                 <input className={inputClass} placeholder="Telefone" value={phone} onChange={e => setPhone(e.target.value)} />
               </div>
            </section>

            <section className="space-y-4">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileText size={14}/> Texto do Anexo (Pág 2)</h3>
               <textarea 
                 className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl min-h-[160px] outline-none focus:ring-2 focus:ring-orange-500 text-sm leading-relaxed"
                 placeholder="Digite aqui as operacoes administrativas..."
                 value={observations}
                 onChange={e => setObservations(e.target.value)}
               />
            </section>
          </div>

          <div className="space-y-6">
            <section className="p-5 bg-orange-50/50 rounded-3xl border border-orange-100 space-y-4">
                <h3 className="text-xs font-black text-orange-600 uppercase tracking-widest flex items-center gap-2"><Shield size={14}/> Detalhes da Papeleta</h3>
                <div className="space-y-3">
                  <input className={inputClass} placeholder="Navio ou Órgão" value={ship} onChange={e => setShip(e.target.value)} />
                  <div className="grid grid-cols-2 gap-4">
                    <input className={inputClass} placeholder="Especialidade" value={specialization} onChange={e => setSpecialization(e.target.value)} />
                    <select className={inputClass} value={isDesmuniciado} onChange={e => setIsDesmuniciado(e.target.value)}>
                      <option value="sim">Desmuniciado: Sim</option>
                      <option value="não">Desmuniciado: Não</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-orange-600 uppercase">H. Licenc.</label>
                      <input type="time" className={inputClass} value={licTime} onChange={e => setLicTime(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-orange-600 uppercase">H. Apres.</label>
                      <input type="time" className={inputClass} value={aprTime} onChange={e => setAprTime(e.target.value)} />
                    </div>
                  </div>
                </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><User size={14}/> Autoridades Assinantes</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                <StaffInputGroup label="Encarregado" member={encarregado} onChange={setEncarregado} />
                <StaffInputGroup label="Enc. Dep. Pessoal" member={encarregadoDep} onChange={setEncarregadoDep} />
                <StaffInputGroup label="Vice-Diretor" member={viceDiretor} onChange={setViceDiretor} />
                <StaffInputGroup label="Diretor" member={diretor} onChange={setDiretor} />
              </div>
            </section>
          </div>
        </div>

        <div className="p-8 border-t border-slate-100 flex gap-4">
          <button onClick={() => { void handleSave(); }} className="px-10 py-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-3xl flex items-center justify-center gap-3 transition-all flex-1">
            <Save size={20} /> Salvar Dados
          </button>
          <button 
            onClick={handlePrint} 
            disabled={!employee} 
            className="px-10 py-5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-3xl shadow-xl shadow-orange-100 flex items-center justify-center gap-3 transition-all flex-1 disabled:opacity-50"
          >
            <Printer size={20} /> Imprimir Documento (2 Págs)
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintVacation;

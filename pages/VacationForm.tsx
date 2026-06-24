
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useVacation } from '../contexts/VacationContext';
import { SECTORS, PRACA_RANKS, OFICIAL_RANKS, CIVIL_RANKS, Employee, VacationParcel } from '../types';
import { User, Shield, Calendar, ArrowLeft, Save, Info, Ban, AlertTriangle, MessageSquare, Clock, Camera, Trash2, ChevronRight } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { differenceInDays, format, isValid, isAfter } from 'date-fns';

const VacationForm: React.FC = () => {
  const { user, isAuthenticated, refreshUser, users, fetchAllUsers, fetchProfile } = useAuth();
  const { saveVacation, employees, addAuditLog } = useVacation();
  const { id, userId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allSectors = useMemo(() => {
    const fromEmployees = employees.map(e => e.sector).filter(Boolean);
    return [...new Set([...SECTORS, ...fromEmployees])].sort();
  }, [employees]);

  const currentYear = new Date().getFullYear();
  const defaultRightYear = currentYear - 1;
  const availableYears = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const targetUserId = userId || user?.id || '';

  const [planningYear, setPlanningYear] = useState(defaultRightYear);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [footerErrorMsg, setFooterErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [parcelToDelete, setParcelToDelete] = useState<string | null>(null);
  const [showNext, setShowNext] = useState(false);

  const existing = useMemo(() => {
    if (id) return employees.find(e => e.id === id);
    return employees.find(e => e.userId === targetUserId && (e.planningYear || currentYear) === planningYear);
  }, [id, targetUserId, planningYear, employees, currentYear]);

  const [name, setName] = useState('');
  const [warName, setWarName] = useState('');
  const [nip, setNip] = useState('');
  const [sector, setSector] = useState('01');
  const [isCustomSector, setIsCustomSector] = useState(false);
  const [category, setCategory] = useState<any>('praca');
  const [rank, setRank] = useState('');
  const [specialization, setSpecialization] = useState('PL');
  const [totalVacationDays, setTotalVacationDays] = useState(30);
  const [parcelCount, setParcelCount] = useState('1');
  const [parcels, setParcels] = useState<VacationParcel[]>([]);
  const [justification, setJustification] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);


  // Bloqueio efetivo para todos (incluindo admins conforme requisitos)
  const targetUserObj = users.find(u => u.id === targetUserId);
  const isBlocked = targetUserObj ? targetUserObj.isBlocked === true : (user?.id === targetUserId ? user?.isBlocked === true : false);

  // Flag para avisar admin, mas o bloqueio acima agora é soberano
  const adminOverride = user?.role === 'admin' && isBlocked;
  const ranks = useMemo(() => {
    return category === 'praca' ? PRACA_RANKS : category === 'oficial' ? OFICIAL_RANKS : CIVIL_RANKS;
  }, [category]);

  useEffect(() => {
    refreshUser();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    if (existing) {
      setName(existing.name);
      setWarName(existing.warName);
      setNip(existing.nip);
      setSector(existing.sector);
      setCategory(existing.category);
      setRank(existing.rank);
      setTotalVacationDays(existing.totalVacationDays);
      setJustification(existing.justification || '');
      setPhotoUrl(existing.photoUrl);

      const savedParcels = existing.vacationParcels.map(p => ({ ...p }));
      setParcels(savedParcels);
      setParcelCount(savedParcels.length.toString());
    } else {
      const baseEmployee = employees.find(e => e.userId === targetUserId);
      if (baseEmployee) {
        setName(baseEmployee.name);
        setWarName(baseEmployee.warName);
        setNip(baseEmployee.nip);
        setSector(baseEmployee.sector);
        setCategory(baseEmployee.category);
        setRank(baseEmployee.rank);
        setPhotoUrl(baseEmployee.photoUrl);
      } else {
        // If we have a targetUserId that is DIFFERENT from current user, 
        // DO NOT fill with current user data. It's confusing.
        // Only default to current user if we are indeed editing current user.
        if (targetUserId === user?.id) {
          setName(user?.name || '');
          setWarName(user?.warName || '');
          setNip(user?.nip || '');
          setSector(user?.sector || '01');
          setCategory(user?.category || 'praca');
          setRank(user?.rank || PRACA_RANKS[0]);
        } else {
          // Try to fill from users list (admin editing another user)
          const targetProfile = users.find(u => u.id === targetUserId);
          if (targetProfile) {
            setName(targetProfile.name || '');
            setWarName(targetProfile.warName || '');
            setNip(targetProfile.nip || '');
            setSector(targetProfile.sector || '01');
            setCategory(targetProfile.category || 'praca');
            setRank(targetProfile.rank || PRACA_RANKS[0]);
          } else {
            setName('');
            setCategory('praca');
          }
        }
      }
      setParcels([{ id: Math.random().toString(36).substr(2, 9), startDate: '', endDate: '', days: 0 }]);
      setParcelCount('1');
      setJustification('');
      setTotalVacationDays(30);
    }
    setErrorMsg(null);
    setErrorDetails([]);
    setFooterErrorMsg(null);
    setFieldErrors({});
  }, [existing, isAuthenticated, targetUserId, user?.name]);

  const handleParcelCountChange = (newCountStr: string) => {
    const count = parseInt(newCountStr);
    setParcelCount(newCountStr);

    setParcels(prev => {
      if (count === prev.length) return prev;
      if (count > prev.length) {
        const newOnes = [];
        for (let i = prev.length; i < count; i++) {
          newOnes.push({ id: Math.random().toString(36).substr(2, 9), startDate: '', endDate: '', days: 0 });
        }
        return [...prev, ...newOnes];
      }
      return prev.slice(0, count);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("A foto deve ter no máximo 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setPhotoUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoUrl(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleParcelChange = (parcelId: string, field: keyof VacationParcel, value: string) => {
    if (isBlocked) return;
    setErrorMsg(null);
    setErrorDetails([]);
    const parcelFieldKey = `parcel-${parcelId}-${field}`;
    setFieldErrors(prev => {
      if (!prev[parcelFieldKey]) return prev;
      const next = { ...prev };
      delete next[parcelFieldKey];
      return next;
    });
    setParcels(prev => prev.map(p => {
      if (p.id === parcelId) {
        const updated = { ...p, [field]: value };
        if ((field === 'startDate' || field === 'endDate') && updated.startDate && updated.endDate) {
          const s = new Date(updated.startDate + 'T00:00:00');
          const e = new Date(updated.endDate + 'T00:00:00');
          if (isValid(s) && isValid(e)) {
            const days = differenceInDays(e, s) + 1;
            updated.days = Math.max(0, days);
          }
        }
        return updated;
      }
      return p;
    }));
  };

  const handleDeleteParcel = (parcelId: string) => {
    setParcels(prev => {
      const next = prev.filter(p => p.id !== parcelId);
      setParcelCount(next.length.toString());
      return next;
    });
    setParcelToDelete(null);
  };

  const scheduledTotal = parcels.reduce((acc, p) => acc + p.days, 0);
  const remainingDays = totalVacationDays - scheduledTotal;

  useEffect(() => {
    if (!targetUserId) return;
    const storageKey = `vacation_print_u_${targetUserId}_v15`;
    const savedRaw = localStorage.getItem(storageKey);
    if (!savedRaw) {
      setSpecialization('PL');
      return;
    }

    try {
      const savedData = JSON.parse(savedRaw);
      setSpecialization((savedData?.specialization || 'PL').toString());
    } catch {
      setSpecialization('PL');
    }
  }, [targetUserId]);

  const handleSpecializationChange = (value: string) => {
    const normalized = value.toUpperCase();
    setSpecialization(normalized);

    if (!targetUserId) return;
    const storageKey = `vacation_print_u_${targetUserId}_v15`;
    const savedRaw = localStorage.getItem(storageKey);
    let savedData: Record<string, any> = {};
    if (savedRaw) {
      try {
        const parsed = JSON.parse(savedRaw);
        savedData = parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        savedData = {};
      }
    }
    localStorage.setItem(storageKey, JSON.stringify({
      ...savedData,
      specialization: normalized
    }));
  };

  const clearFieldError = (field: string) => {
    setFieldErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const getInputClass = (hasError: boolean, baseClass = 'input-field') => {
    if (!hasError) return baseClass;
    return `${baseClass} border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-200`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlocked) return;

    setErrorMsg(null);
    setErrorDetails([]);
    setFooterErrorMsg(null);
    const nextFieldErrors: Record<string, boolean> = {};

    const missingFields: string[] = [];

    if (!targetUserId) {
      missingFields.push('Militar/usuário de destino.');
      nextFieldErrors.targetUserId = true;
    }
    if (!name.trim()) {
      missingFields.push('Nome completo.');
      nextFieldErrors.name = true;
    }
    if (!warName.trim()) {
      missingFields.push('Nome de guerra.');
      nextFieldErrors.warName = true;
    }
    if (!nip.trim()) {
      missingFields.push('NIP.');
      nextFieldErrors.nip = true;
    }
    if (!sector.trim()) {
      missingFields.push('Setor.');
      nextFieldErrors.sector = true;
    }
    if (!rank.trim()) {
      missingFields.push('Posto/graduação.');
      nextFieldErrors.rank = true;
    }
    if (totalVacationDays <= 0) {
      missingFields.push('Quantidade de dias de direito deve ser maior que 0.');
      nextFieldErrors.totalVacationDays = true;
    }

    parcels.forEach((parcel, idx) => {
      if (!parcel.startDate) {
        missingFields.push(`Data de início da Parcela ${idx + 1}.`);
        nextFieldErrors[`parcel-${parcel.id}-startDate`] = true;
      }
      if (!parcel.endDate) {
        missingFields.push(`Data de término da Parcela ${idx + 1}.`);
        nextFieldErrors[`parcel-${parcel.id}-endDate`] = true;
      }
    });

    if (missingFields.length > 0) {
      setErrorMsg('Não foi possível salvar. Preencha os campos obrigatórios abaixo:');
      setErrorDetails(missingFields);
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});

    if (scheduledTotal > totalVacationDays) {
      setFooterErrorMsg(`Erro: Você utilizou ${scheduledTotal} dias, ultrapassando o limite de ${totalVacationDays} dias.`);
      return;
    }

    const invalidParcel = parcels.find(p => {
      if (!p.startDate || !p.endDate) return false;
      const s = new Date(p.startDate + 'T00:00:00');
      const e = new Date(p.endDate + 'T00:00:00');
      return isAfter(s, e);
    });

    if (invalidParcel) {
      setErrorMsg('Erro: Há parcelas com data de início posterior à data de término.');
      setErrorDetails([]);
      return;
    }

    const employeeData: Employee = {
      id: existing?.id || '', // Empty string for new, handled in context
      userId: targetUserId,
      name, warName, nip, sector, category, rank, totalVacationDays,
      planningYear,
      vacationParcels: parcels,
      justification,
      photoUrl
    };

    const actor = user?.name || 'Sistema';

    if (existing) {
      // Comparação Campo a Campo para Auditoria Detalhada
      const compareFields = [
        { label: 'Nome', old: existing.name, new: name },
        { label: 'Nome de Guerra', old: existing.warName, new: warName },
        { label: 'NIP', old: existing.nip, new: nip },
        { label: 'Setor', old: existing.sector, new: sector },
        { label: 'Categoria', old: existing.category, new: category },
        { label: 'Posto/Graduação', old: existing.rank, new: rank },
        { label: 'Direito (Dias)', old: existing.totalVacationDays.toString(), new: totalVacationDays.toString() },
        { label: 'Janela (Ano)', old: (existing.planningYear || '---').toString(), new: planningYear.toString() },
        { label: 'Justificativa', old: existing.justification || 'Vazio', new: justification || 'Vazio' },
        { label: 'Foto', old: existing.photoUrl ? 'Com Foto' : 'Sem Foto', new: photoUrl ? 'Com Foto' : 'Sem Foto' },
      ];

      compareFields.forEach(f => {
        if (f.old !== f.new) {
          addAuditLog({
            userName: actor,
            action: 'Alteração',
            field: `${f.label} (${warName})`,
            oldValue: f.old,
            newValue: f.new
          });
        }
      });

      // Auditoria de Parcelas
      const oldParcelsText = existing.vacationParcels.map((p, i) => `P${i + 1}: ${p.startDate || '--'} a ${p.endDate || '--'} (${p.days}d)`).join('\n');
      const newParcelsText = parcels.map((p, i) => `P${i + 1}: ${p.startDate || '--'} a ${p.endDate || '--'} (${p.days}d)`).join('\n');

      if (oldParcelsText !== newParcelsText) {
        addAuditLog({
          userName: actor,
          action: 'Alteração',
          field: `Períodos de Férias (${warName})`,
          oldValue: oldParcelsText,
          newValue: newParcelsText
        });
      }
    } else {
      addAuditLog({
        userName: actor,
        action: 'Criação',
        field: `Férias ${planningYear} (${warName})`,
        oldValue: '-',
        newValue: `Direito: ${totalVacationDays} dias\n${parcels.map((p, i) => `P${i + 1}: ${p.startDate || '--'} a ${p.endDate || '--'}`).join('\n')}`
      });
    }

    try {
      await saveVacation(employeeData);
      await fetchProfile(targetUserId);
      await fetchAllUsers();
      navigate('/');
    } catch (error) {
      const saveError = error instanceof Error ? error.message : 'Falha desconhecida.';
      setErrorMsg(`Erro ao salvar férias: ${saveError}`);
      setErrorDetails(['Verifique os dados informados e tente novamente.']);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8">
      {isBlocked && (
        <div className="mb-6 p-6 bg-red-100 border border-red-200 rounded-3xl flex items-center gap-4 text-red-700 animate-pulse">
          <div className="bg-red-500 text-white p-3 rounded-2xl"><Ban size={24} /></div>
          <div>
            <h3 className="font-bold text-lg">Acesso Bloqueado para Lançamento</h3>
            <p className="text-sm">Você está fora do período de alteração. Entre em contato com o administrador.</p>
          </div>
        </div>
      )}



      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">{errorMsg}</p>
            {errorDetails.length > 0 && (
              <ul className="list-disc pl-5 mt-1 text-sm font-medium space-y-0.5">
                {errorDetails.map((detail, index) => (
                  <li key={`${detail}-${index}`}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        {(() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const parcelCountdowns = parcels
            .map((p, idx) => {
              if (!p.startDate) return null;
              const start = new Date(p.startDate + 'T00:00:00');
              if (!isValid(start)) return null;
              const daysUntil = differenceInDays(start, today);
              let status: 'upcoming' | 'today' | 'ongoing' | 'done' =
                daysUntil > 0 ? 'upcoming' : daysUntil === 0 ? 'today' : 'ongoing';
              let displayValue = daysUntil > 0 ? `${daysUntil}d` : daysUntil === 0 ? 'Hoje' : 'Em andamento';
              if (p.endDate) {
                const end = new Date(p.endDate + 'T00:00:00');
                if (isValid(end) && today > end) {
                  status = 'done';
                  displayValue = `Concluído ${p.days}d`;
                }
              }
              return { idx: idx + 1, daysUntil, status, displayValue };
            })
            .filter((x): x is { idx: number; daysUntil: number; status: 'upcoming' | 'today' | 'ongoing' | 'done'; displayValue: string } => x !== null);
          const alertParcels = parcelCountdowns.filter(c => c.status !== 'done' && c.daysUntil >= 0 && c.daysUntil <= 15);
          return (
            <>
              <div className="bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 px-6 py-4 text-white relative flex items-center gap-3 flex-wrap">
                <button type="button" onClick={() => navigate(-1)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors shrink-0">
                  <ArrowLeft size={16} />
                </button>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center shrink-0"><Calendar size={18} /></div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-black tracking-tight leading-none">{existing ? 'Editar Férias' : 'Lançar Férias'}</h2>
                    <p className="text-[11px] text-orange-100 mt-0.5 leading-none">Janela de Planejamento: {planningYear}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: 'Direito', value: `${totalVacationDays}d` },
                    { label: 'Programados', value: `${scheduledTotal}d` },
                    { label: 'Parcelas', value: parcelCount },
                  ].map(item => (
                    <div key={item.label} className="bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-center">
                      <p className="text-[9px] uppercase tracking-widest text-orange-100 font-bold leading-none">{item.label}</p>
                      <p className="text-sm font-black leading-none mt-0.5">{item.value}</p>
                    </div>
                  ))}
                  {parcelCountdowns.map(({ idx, status, displayValue }) => (
                    <div key={`countdown-${idx}`} className="bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-center">
                      <p className="text-[9px] uppercase tracking-widest text-orange-100 font-bold leading-none">
                        {status === 'done' ? `P${idx} concluída` : `P${idx} inicia em`}
                      </p>
                      <p className={`text-sm font-black leading-none mt-0.5 ${
                        status === 'ongoing' ? 'text-yellow-300' :
                        status === 'done'    ? 'text-sky-300'    : 'text-white'
                      }`}>
                        {displayValue}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {alertParcels.length > 0 && (
                <div className="flex justify-center bg-white px-4 py-2 border-b border-green-100">
                  <div className="animate-pulse flex items-center gap-2 bg-green-500 text-white font-bold text-sm px-5 py-2 rounded-2xl shadow-md">
                    <AlertTriangle size={15} className="shrink-0" />
                    <span>
                      {alertParcels.map((c, i) => (
                        <span key={c.idx}>
                          {i > 0 && ' · '}Insira papeleta {c.idx} no SIGAD para assinatura
                        </span>
                      ))}
                    </span>
                  </div>
                </div>
              )}
            </>
          );
        })()}

        <form onSubmit={handleSubmit} className="p-5 lg:p-8 space-y-6">
          <fieldset disabled={isBlocked}>
            {!showNext ? (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <section className="xl:col-span-7 bg-slate-50/70 rounded-3xl border border-slate-200 p-5 lg:p-6">
                  <div className="flex items-center gap-2 mb-5 text-slate-900 font-bold border-b border-slate-200 pb-2">
                    <User size={18} className="text-orange-500" /> Dados do Militar e Janela
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[160px,1fr] gap-5 items-start">
                    <div className="relative group w-fit mx-auto lg:mx-0">
                      <div className="w-36 h-36 rounded-3xl bg-slate-100 border-2 border-dashed border-slate-300 overflow-hidden flex items-center justify-center relative shadow-inner">
                        {photoUrl ? (
                          <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-slate-400 text-center flex flex-col items-center">
                            <Camera size={24} className="mb-1" />
                            <span className="text-[10px] font-bold uppercase">Foto</span>
                          </div>
                        )}
                        {!isBlocked && (
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 bg-white text-orange-500 rounded-lg shadow-lg hover:scale-110 transition-transform"><Camera size={18} /></button>
                            {photoUrl && <button type="button" onClick={removePhoto} className="p-2 bg-white text-red-500 rounded-lg shadow-lg hover:scale-110 transition-transform"><Trash2 size={18} /></button>}
                          </div>
                        )}
                      </div>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 w-full">
                      <div className="space-y-1.5 bg-orange-50 p-3 rounded-2xl border border-orange-100">
                        <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest block mb-1">Férias referente ao ano</label>
                        <select
                          className="w-full bg-white border border-orange-200 rounded-xl px-4 py-2 text-sm font-bold text-orange-700 outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                          value={planningYear}
                          onChange={e => setPlanningYear(parseInt(e.target.value))}
                        >
                          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase">Quantidade de dias de direito</label>
                        <input
                          type="number"
                          className={`w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 font-bold ${fieldErrors.totalVacationDays ? 'bg-red-50 border-red-400 focus:ring-red-200' : 'bg-slate-50 border-slate-200 focus:ring-orange-500'}`}
                          value={totalVacationDays}
                          onChange={e => { setTotalVacationDays(parseInt(e.target.value) || 0); clearFieldError('totalVacationDays'); }}
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2 xl:col-span-3">
                        <label className="text-xs font-bold text-slate-500 uppercase">Nome Completo</label>
                        <input required className={getInputClass(!!fieldErrors.name)} value={name} onChange={e => { setName(e.target.value); clearFieldError('name'); }} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase">Nome de Guerra</label>
                        <input required className={getInputClass(!!fieldErrors.warName)} value={warName} onChange={e => { setWarName(e.target.value); clearFieldError('warName'); }} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase">NIP</label>
                        <input required className={getInputClass(!!fieldErrors.nip)} value={nip} onChange={e => { setNip(e.target.value); clearFieldError('nip'); }} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase">Setor</label>
                        {isCustomSector ? (
                          <div className="flex gap-2">
                            <input className={getInputClass(!!fieldErrors.sector, 'input-field flex-1')} value={sector} onChange={e => { setSector(e.target.value); clearFieldError('sector'); }} placeholder="Nome do novo setor" autoFocus />
                            <button type="button" onClick={() => { setIsCustomSector(false); setSector(allSectors[0] || ''); }} className="px-3 py-1 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
                          </div>
                        ) : (
                          <select className={getInputClass(!!fieldErrors.sector)} value={sector} onChange={e => { if (e.target.value === '__new__') { setIsCustomSector(true); setSector(''); } else { setSector(e.target.value); clearFieldError('sector'); } }}>
                            {allSectors.map(s => <option key={s} value={s}>{s}</option>)}
                            <option value="__new__">+ Cadastrar novo setor...</option>
                          </select>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase">Categoria</label>
                        <select
                          className="input-field"
                          value={category}
                          onChange={e => {
                            const newCat = e.target.value;
                            setCategory(newCat);
                            const newRanks = newCat === 'praca' ? PRACA_RANKS : newCat === 'oficial' ? OFICIAL_RANKS : CIVIL_RANKS;
                            setRank(newRanks[0]);
                          }}
                        >
                          <option value="praca">Praça</option>
                          <option value="oficial">Oficial</option>
                          <option value="civil">Servidor Civil</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase">Posto/Graduação</label>
                        <select className={getInputClass(!!fieldErrors.rank)} value={rank} onChange={e => { setRank(e.target.value); clearFieldError('rank'); }}>
                          {ranks.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase">Esp.</label>
                        <input
                          className="input-field"
                          value={specialization}
                          onChange={e => handleSpecializationChange(e.target.value)}
                          placeholder="PL"
                          maxLength={6}
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="xl:col-span-5 bg-slate-50/70 rounded-3xl border border-slate-200 p-5 lg:p-6 flex flex-col">
                  <div className="flex items-center justify-between mb-5 border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2 text-slate-900 font-bold">
                      <Calendar size={18} className="text-orange-500" /> Períodos de Férias ({planningYear})
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">Saldo Restante</span>
                      <span className={`text-sm font-black ${remainingDays < 0 ? 'text-red-500' : 'text-green-600'}`}>{remainingDays} dias</span>
                    </div>
                  </div>

                  <div className="mb-5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Dividir em quantas parcelas?</label>
                    <select className={getInputClass(!!fieldErrors.parcelCount, 'input-field mt-1.5')} value={parcelCount} onChange={e => { handleParcelCountChange(e.target.value); clearFieldError('parcelCount'); }}>
                      <option value="1">1 parcela</option>
                      <option value="2">2 parcelas</option>
                      <option value="3">3 parcelas</option>
                      <option value="4">4 parcelas</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {parcels.map((p, idx) => (
                      <div key={p.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="flex flex-col gap-3 mb-3 sm:flex-row sm:items-center sm:justify-between">
                          <h5 className="font-bold text-slate-700">Parcela {idx + 1}</h5>
                          <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-100"><Clock size={12} /> {p.days} dias</div>
                            {parcelToDelete === p.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-bold text-red-600 mr-1">Tem certeza?</span>
                                <button type="button" onClick={() => handleDeleteParcel(p.id)} className="px-2 py-1 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">Sim</button>
                                <button type="button" onClick={() => setParcelToDelete(null)} className="px-2 py-1 text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors">Não</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => setParcelToDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Apagar parcela"><Trash2 size={14} /></button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                          <div className="space-y-1 min-w-0"><label className="text-[10px] font-bold text-slate-400 uppercase">Início</label><input type="date" className={getInputClass(!!fieldErrors[`parcel-${p.id}-startDate`], 'input-field py-2 min-w-0')} value={p.startDate} onChange={e => handleParcelChange(p.id, 'startDate', e.target.value)} /></div>
                          <div className="space-y-1 min-w-0"><label className="text-[10px] font-bold text-slate-400 uppercase">Término</label><input type="date" className={getInputClass(!!fieldErrors[`parcel-${p.id}-endDate`], 'input-field py-2 min-w-0')} value={p.endDate} onChange={e => handleParcelChange(p.id, 'endDate', e.target.value)} /></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              <section className="bg-slate-50/70 rounded-3xl border border-slate-200 p-5 lg:p-6">
                <div className="flex items-center gap-2 mb-4 text-slate-900 font-bold border-b border-slate-200 pb-2">
                  <MessageSquare size={18} className="text-orange-500" /> Justificativa
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 block">Motivo da solicitação para a janela {planningYear}</label>
                  <textarea className="w-full p-4 bg-white border border-slate-200 rounded-2xl min-h-[140px] outline-none focus:ring-2 focus:ring-orange-500 text-slate-600 text-sm leading-relaxed" placeholder="Descreva detalhadamente o motivo..." value={justification} onChange={e => setJustification(e.target.value)} />
                  <p className="text-[11px] text-slate-400 font-medium">Esta justificativa é referente exclusivamente ao planejamento de {planningYear}.</p>
                </div>
              </section>
            )}
          </fieldset>

          {/* Botões de navegação — fora do fieldset para nunca serem desabilitados por ele */}
          <div className="flex justify-end pt-2">
            {!showNext ? (
              <button
                type="button"
                onClick={() => setShowNext(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl shadow-md transition-all"
              >
                Próximo <ChevronRight size={16} />
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setShowNext(false)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-all"><ArrowLeft size={16} /> Etapa Anterior</button>
                {!isBlocked ? (
                  <button type="submit" className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl shadow-md transition-all"><Save size={16} /> Salvar Férias de {planningYear}</button>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600 font-bold bg-amber-50 px-4 py-2.5 rounded-xl border border-amber-100 text-sm"><AlertTriangle size={16} /> Somente Leitura</div>
                )}
              </div>
            )}
          </div>

          {footerErrorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex gap-3 text-red-600 animate-in fade-in slide-in-from-bottom-2">
              <AlertTriangle size={20} className="mt-0.5 shrink-0" />
              <p className="font-bold">{footerErrorMsg}</p>
            </div>
          )}
        </form>
      </div>
      <style>{`
        .input-field { width: 100%; padding: 10px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; outline: none; transition: all 0.2s; }
        .input-field:focus { border-color: #f97316; box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.1); }
      `}</style>
    </div>
  );
};

export default VacationForm;

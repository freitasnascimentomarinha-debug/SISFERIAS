
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useVacation } from '../contexts/VacationContext';
import { Shield, Key, Users, History, FileText, Search, Trash2, Lock, Ban, Unlock, Edit, Calendar, Filter, AlertCircle, Printer, MessageSquare, Save, Clock, UserCog, X, Settings, Megaphone, Plus, Camera, Building, Pin, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { format, startOfDay, endOfDay, isAfter, isValid } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { SECTORS, User, Notice } from '../types';
import { supabase } from '../lib/supabase';

const Security: React.FC = () => {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [authError, setAuthError] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'justifications' | 'accounts' | 'logs' | 'settings'>('users');

  const [userSearch, setUserSearch] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logStart, setLogStart] = useState('');
  const [logEnd, setLogEnd] = useState('');

  // Filtros para Justificativas
  const [justifSearch, setJustifSearch] = useState('');
  const [justifSector, setJustifSector] = useState('all');

  // Filtro para Gestão de Contas
  const [accountSearch, setAccountSearch] = useState('');

  // Estados para Modais Customizados
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [isAdminPassModalOpen, setIsAdminPassModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleteNoticeModalOpen, setIsDeleteNoticeModalOpen] = useState(false);
  const [noticeIdToDelete, setNoticeIdToDelete] = useState<string | null>(null);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [modalError, setModalError] = useState('');
  const [adminPassSuccess, setAdminPassSuccess] = useState(false);

  // Estados para Gestão de Avisos
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');

  // Segurança da Aba Gestão de Contas
  const [isAccountTabAuthenticated, setIsAccountTabAuthenticated] = useState(false);
  const [showAccountPassModal, setShowAccountPassModal] = useState(false);
  const [accountPassInput, setAccountPassInput] = useState('');
  const [accountPassError, setAccountPassError] = useState(false);

  const navigate = useNavigate();
  const { users, changeUserPassword, deleteUser, toggleBlockUser, batchUpdateBlockStatus, toggleUserRole } = useAuth();
  const { employees, auditLogs, addAuditLog, settings, updateSettings, addNotice, deleteNotice, togglePinNotice } = useVacation();

  const allSectors = useMemo(() => {
    const fromEmployees = employees.map(e => e.sector).filter(Boolean);
    return [...new Set([...SECTORS, ...fromEmployees])].sort();
  }, [employees]);

  // Bloqueio Automático por Prazo
  const [deadline, setDeadline] = useState(() => localStorage.getItem('vacation_deadline') || '');
  const lastProcessedDeadline = useRef<string | null>(null);

  useEffect(() => {
    if (deadline && deadline !== lastProcessedDeadline.current) {
      localStorage.setItem('vacation_deadline', deadline);
      const deadlineDate = endOfDay(new Date(deadline + 'T00:00:00'));

      if (isAfter(new Date(), deadlineDate)) {
        if (isAfter(new Date(), deadlineDate)) {
          supabase.rpc('admin_update_block_status', { target_status: true }).then(() => {
            // Update local state visuals efficiently
            batchUpdateBlockStatus(true);
          });
          lastProcessedDeadline.current = deadline;
        }
      }
    } else if (!deadline) {
      localStorage.removeItem('vacation_deadline');
      lastProcessedDeadline.current = null;
    }
  }, [deadline, users, toggleBlockUser]);

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const storedAdminPass = localStorage.getItem('vacation_admin_pass') || 'admin1234';
    if (adminPass === storedAdminPass) {
      setIsAdminAuthenticated(true);
      setAuthError(false);
    } else {
      setAuthError(true);
      setAdminPass('');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateSettings({ ...settings, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddNotice = async () => {
    if (!noticeTitle || !noticeContent) return;
    await addNotice({
      title: noticeTitle,
      content: noticeContent,
      isPinned: false
    });
    setNoticeTitle('');
    setNoticeContent('');
    addAuditLog({ userName: 'Admin', action: 'Criação', field: 'Quadro de Avisos', oldValue: '-', newValue: noticeTitle });
  };

  const confirmRemoveNotice = (id: string) => {
    setNoticeIdToDelete(id);
    setIsDeleteNoticeModalOpen(true);
  };

  const handleExecuteDeleteNotice = async () => {
    if (!noticeIdToDelete) return;
    const target = settings.notices.find(n => n.id === noticeIdToDelete);
    await deleteNotice(noticeIdToDelete);
    addAuditLog({ userName: 'Admin', action: 'Exclusão', field: 'Quadro de Avisos', oldValue: target?.title || noticeIdToDelete, newValue: '-' });
    setIsDeleteNoticeModalOpen(false);
    setNoticeIdToDelete(null);
  };

  const handleTogglePinNotice = async (id: string) => {
    const target = settings.notices.find(n => n.id === id);
    if (!target) return;
    await togglePinNotice(id, !!target.isPinned);
    addAuditLog({
      userName: 'Admin',
      action: 'Alteração',
      field: 'Fixação de Aviso',
      oldValue: target.isPinned ? 'Fixado' : 'Normal',
      newValue: !target.isPinned ? 'Fixado' : 'Normal'
    });
  };

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

  const filteredUsers = useMemo(() => {
    return users.filter(u =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
    );
  }, [userSearch, users]);

  const filteredAccountUsers = useMemo(() => {
    return users.filter(u =>
      u.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(accountSearch.toLowerCase())
    );
  }, [accountSearch, users]);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchText = log.userName.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.field.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.action.toLowerCase().includes(logSearch.toLowerCase());

      let matchDate = true;
      if (logStart || logEnd) {
        const d = new Date(log.timestamp);
        const start = logStart ? startOfDay(new Date(logStart + 'T00:00:00')) : new Date(0);
        const end = logEnd ? endOfDay(new Date(logEnd + 'T00:00:00')) : new Date(9999, 11, 31);
        matchDate = d >= start && d <= end;
      }
      return matchText && matchDate;
    });
  }, [logSearch, auditLogs, logStart, logEnd]);

  const filteredJustifications = useMemo(() => {
    return employees.filter(e => {
      const hasJustif = e.justification && e.justification.trim().length > 0;
      const matchText = e.warName.toLowerCase().includes(justifSearch.toLowerCase()) ||
        e.name.toLowerCase().includes(justifSearch.toLowerCase());
      const matchSector = justifSector === 'all' || e.sector === justifSector;
      return hasJustif && matchText && matchSector;
    });
  }, [employees, justifSearch, justifSector]);

  const handleToggleBlock = (userId: string, name: string) => {
    const u = users.find(u => u.id === userId);
    if (!u) return;

    // Determinamos os valores ANTES da execução para evitar atraso de estado
    const currentlyBlocked = u.isBlocked;
    const actionLabel = currentlyBlocked ? 'Desbloqueio Manual' : 'Bloqueio Manual';
    const oldValue = currentlyBlocked ? 'Bloqueado' : 'Liberado';
    const newValue = currentlyBlocked ? 'Liberado' : 'Bloqueado';

    toggleBlockUser(userId);

    addAuditLog({
      userName: 'Admin',
      action: 'Bloqueio',
      field: `Status de Acesso (${name})`,
      oldValue: oldValue,
      newValue: newValue
    });
  };

  const openPassModal = (user: User) => {
    setTargetUser(user);
    setNewPass('');
    setConfirmPass('');
    setModalError('');
    setIsPassModalOpen(true);
  };

  const openAdminPassModal = () => {
    setNewPass('');
    setConfirmPass('');
    setModalError('');
    setAdminPassSuccess(false);
    setIsAdminPassModalOpen(true);
  };

  const openDeleteModal = (user: User) => {
    setTargetUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleExecutePassChange = async () => {
    if (!newPass || newPass.length < 4) {
      setModalError('A senha deve ter pelo menos 4 caracteres.');
      return;
    }
    if (newPass !== confirmPass) {
      setModalError('As senhas não coincidem.');
      return;
    }

    if (targetUser) {
      const success = await changeUserPassword(targetUser.email, newPass);
      if (success) {
        addAuditLog({ userName: 'Admin', action: 'Senha', field: 'Senha do Usuário', oldValue: '********', newValue: 'Alterada via Gestão' });
        setIsPassModalOpen(false);
        setTargetUser(null);
      } else {
        setModalError('Erro ao alterar senha. Verifique as permissões.');
      }
    }
  };

  const handleExecuteAdminPassChange = () => {
    if (!newPass || newPass.length < 4) {
      setModalError('A senha deve ter pelo menos 4 caracteres.');
      return;
    }
    if (newPass !== confirmPass) {
      setModalError('As senhas não coincidem.');
      return;
    }

    localStorage.setItem('vacation_admin_pass', newPass);
    addAuditLog({ userName: 'Admin', action: 'Senha', field: 'Senha Admin', oldValue: '********', newValue: 'Alterada' });
    setAdminPassSuccess(true);
    setTimeout(() => {
      setIsAdminPassModalOpen(false);
      setAdminPassSuccess(false);
    }, 2000);
  };

  const handleExecuteDelete = () => {
    if (targetUser) {
      deleteUser(targetUser.id);
      addAuditLog({ userName: 'Admin', action: 'Exclusão', field: 'Usuário', oldValue: targetUser.name, newValue: '-' });
      setIsDeleteModalOpen(false);
      setTargetUser(null);
    }
  };

  const handleAccountTabAccess = (e: React.FormEvent) => {
    e.preventDefault();
    if (accountPassInput === 'dp159') {
      setIsAccountTabAuthenticated(true);
      setShowAccountPassModal(false);
      setActiveTab('accounts');
      setAccountPassInput('');
      setAccountPassError(false);
    } else {
      setAccountPassError(true);
      setAccountPassInput('');
    }
  };

  const formatAuditValue = (val: string) => {
    if (!val || val === '-') return val;
    const dateRegex = /(\d{4})-(\d{2})-(\d{2})/g;
    return val.replace(dateRegex, (match, y, m, d) => `${d}/${m}/${y}`);
  };

  if (!isAdminAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-32 p-10 bg-white rounded-3xl shadow-xl border border-slate-100 text-center">
        <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <div className="p-2">
            <Lock size={32} />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Área Restrita</h2>
        <p className="text-slate-500 mb-8">Digite a senha de administrador para acessar as configurações críticas.</p>
        <form onSubmit={handleAdminAuth} className="space-y-4">
          <input
            type="password"
            placeholder="Senha de Admin"
            className={`w-full px-4 py-3 bg-slate-50 border ${authError ? 'border-red-500' : 'border-slate-200'} rounded-xl outline-none focus:ring-2 focus:ring-orange-500`}
            value={adminPass}
            onChange={e => { setAdminPass(e.target.value); setAuthError(false); }}
            autoFocus
          />
          {authError && <p className="text-red-500 text-sm font-bold flex items-center justify-center gap-2"><AlertCircle size={14} /> Senha incorreta!</p>}
          <button type="submit" className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg transition-all">Acessar Sistema</button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {/* MODAL REDEFINIR SENHA USUARIO */}
      {isPassModalOpen && targetUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-orange-500 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Key size={24} />
                <h3 className="font-bold text-lg">Redefinir Senha</h3>
              </div>
              <button onClick={() => setIsPassModalOpen(false)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6">
              <p className="text-sm text-slate-500">Defina uma nova senha para o usuário <span className="font-bold text-slate-900">{targetUser.name}</span>.</p>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nova Senha</label>
                  <input
                    type="password"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Mínimo 4 caracteres"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Repita a senha"
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                  />
                </div>
                {modalError && <p className="text-red-500 text-xs font-bold">{modalError}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setIsPassModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
                <button onClick={handleExecutePassChange} className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all">Salvar Senha</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REDEFINIR SENHA ADMIN */}
      {isAdminPassModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <ShieldCheck size={24} />
                <h3 className="font-bold text-lg">Alterar Senha de Admin</h3>
              </div>
              <button onClick={() => setIsAdminPassModalOpen(false)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6">
              {adminPassSuccess ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-4 animate-in fade-in zoom-in">
                  <div className="p-4 bg-green-50 text-green-500 rounded-full">
                    <CheckCircle2 size={64} />
                  </div>
                  <h4 className="text-xl font-bold text-slate-900">Sucesso!</h4>
                  <p className="text-sm text-slate-500">A senha de administrador foi alterada com sucesso.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-500">Defina uma nova senha mestra de administrador para o sistema.</p>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nova Senha Admin</label>
                      <input
                        type="password"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="Mínimo 4 caracteres"
                        value={newPass}
                        onChange={e => setNewPass(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confirmar Senha</label>
                      <input
                        type="password"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="Repita a senha"
                        value={confirmPass}
                        onChange={e => setConfirmPass(e.target.value)}
                      />
                    </div>
                    {modalError && <p className="text-red-500 text-xs font-bold">{modalError}</p>}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setIsAdminPassModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
                    <button onClick={handleExecuteAdminPassChange} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-black transition-all">Alterar Senha</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR CONTA */}
      {isDeleteModalOpen && targetUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-red-500 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <AlertCircle size={24} />
                <h3 className="font-bold text-lg">Confirmar Exclusão</h3>
              </div>
              <button onClick={() => setIsDeleteModalOpen(false)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto">
                <Trash2 size={40} />
              </div>
              <div className="text-center">
                <p className="text-slate-900 font-bold text-lg">Deseja excluir {targetUser.name}?</p>
                <p className="text-sm text-slate-500 mt-2">Esta ação é irreversível e todos os dados associados a este usuário serão permanentemente removidos.</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
                <button onClick={handleExecuteDelete} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-100 hover:bg-red-600 transition-all">Sim, Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR AVISO */}
      {isDeleteNoticeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-red-500 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <AlertCircle size={24} />
                <h3 className="font-bold text-lg">Confirmar Exclusão</h3>
              </div>
              <button onClick={() => setIsDeleteNoticeModalOpen(false)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto">
                <Trash2 size={40} />
              </div>
              <div className="text-center">
                <p className="text-slate-900 font-bold text-lg">Tem certeza da exclusão do aviso?</p>
                <p className="text-sm text-slate-500 mt-2">Este aviso será permanentemente removido do quadro principal.</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsDeleteNoticeModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
                <button onClick={handleExecuteDeleteNotice} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-100 hover:bg-red-600 transition-all">Sim, Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Shield className="text-orange-500" size={32} /> Segurança e Controle
          </h2>
          <p className="text-slate-500">Gestão administrativa e monitoramento de atividades</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8 bg-slate-200/50 p-1.5 rounded-2xl w-fit">
        <TabButton icon={<Users size={18} />} label="Usuários" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
        <TabButton icon={<FileText size={18} />} label="Justificativas" active={activeTab === 'justifications'} onClick={() => setActiveTab('justifications')} />
        <TabButton
          icon={<UserCog size={18} />}
          label="Gestão de Contas"
          active={activeTab === 'accounts'}
          onClick={() => setActiveTab('accounts')}
        />
        <TabButton icon={<History size={18} />} label="Auditoria Detalhada" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
        <TabButton icon={<Settings size={18} />} label="Sistema" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {activeTab === 'settings' && (
          <div className="p-8 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Ajustes Visuais e Identidade */}
              <div className="space-y-8">
                <section>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-6">
                    <Building className="text-orange-500" size={24} /> Identidade Institucional
                  </h3>
                  <div className="space-y-6">
                    <div className="flex flex-col gap-6 p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                      <div className="flex items-center gap-6">
                        <div className="w-24 h-24 bg-white rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center relative group overflow-hidden shadow-inner">
                          {settings.logoUrl ? (
                            <img src={settings.logoUrl} className="w-full h-full object-contain p-2" />
                          ) : (
                            <Camera className="text-slate-300" size={32} />
                          )}
                          <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <Plus className="text-white" size={24} />
                            <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                          </label>
                        </div>
                        <div className="flex-1 space-y-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome Institucional</label>
                            <input
                              type="text"
                              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-500"
                              value={settings.institutionName}
                              onChange={e => updateSettings({ ...settings, institutionName: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lotação Total (Efetivo)</label>
                            <input
                              type="number"
                              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-500"
                              value={settings.totalManpower}
                              onChange={e => updateSettings({ ...settings, totalManpower: parseInt(e.target.value) || 0 })}
                            />
                            <p className="text-[10px] text-slate-400 font-medium">Usado para cálculo de % da força de trabalho.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-6">
                    <Lock className="text-orange-500" size={24} /> Configurações de Segurança
                  </h3>
                  <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                    <button
                      onClick={openAdminPassModal}
                      className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-black transition-all"
                    >
                      <Key size={18} /> Alterar Senha de Administrador
                    </button>
                    <p className="text-[10px] text-slate-400 font-medium text-center mt-2">Esta senha é usada para acessar esta área restrita do sistema.</p>
                  </div>
                </section>
              </div>

              {/* Gestão de Avisos */}
              <div className="space-y-8">
                <section>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-6">
                    <Megaphone className="text-orange-500" size={24} /> Quadro de Avisos
                  </h3>
                  <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 space-y-4 mb-8">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Título do Aviso</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="Ex: Novo prazo de entrega"
                        value={noticeTitle}
                        onChange={e => setNoticeTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conteúdo</label>
                      <textarea
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500 min-h-[100px]"
                        placeholder="Escreva o comunicado aqui..."
                        value={noticeContent}
                        onChange={e => setNoticeContent(e.target.value)}
                      />
                    </div>
                    <button
                      onClick={handleAddNotice}
                      className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-black transition-all"
                    >
                      <Plus size={18} /> Adicionar Aviso ao Quadro
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {sortedNotices.length === 0 ? (
                      <p className="text-center text-slate-400 text-sm py-4">Nenhum aviso publicado.</p>
                    ) : (
                      sortedNotices.map(notice => (
                        <div key={notice.id} className={`p-4 bg-white border ${notice.isPinned ? 'border-orange-200 bg-orange-50/20 shadow-sm' : 'border-slate-200'} rounded-2xl flex justify-between items-start`}>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-800 text-sm">{notice.title}</h4>
                              {notice.isPinned && <Pin size={12} className="text-orange-500 fill-orange-500" />}
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold">
                              {(() => {
                                const d = new Date(notice.date);
                                return isValid(d) ? format(d, 'dd/MM/yyyy HH:mm') : '-';
                              })()}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleTogglePinNotice(notice.id)}
                              className={`p-2 rounded-lg transition-colors ${notice.isPinned ? 'text-orange-500 bg-orange-100' : 'text-slate-400 hover:bg-slate-100'}`}
                              title={notice.isPinned ? "Desafixar do topo" : "Fixar no topo"}
                            >
                              <Pin size={16} className={notice.isPinned ? 'fill-orange-500' : ''} />
                            </button>
                            <button
                              onClick={() => confirmRemoveNotice(notice.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="p-8">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-6 mb-8">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Filtrar usuários por nome ou e-mail..."
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-4 w-full lg:w-auto">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prazo Final de Lançamento</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                      value={deadline}
                      onChange={e => setDeadline(e.target.value)}
                    />
                    {deadline && (
                      <button
                        onClick={async () => {
                          setDeadline('');
                          lastProcessedDeadline.current = null;
                          await supabase.rpc('admin_update_block_status', { target_status: false });
                          // Update local state efficiently
                          batchUpdateBlockStatus(false);
                          addAuditLog({ userName: 'Admin', action: 'Bloqueio', field: 'Prazo Limpo', oldValue: 'Com Prazo', newValue: 'Liberado para Todos' });
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        title="Limpar prazo e liberar todos"
                      >
                        <Ban size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest">Status Lançamento</th>
                    <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest">Nome</th>
                    <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest">E-mail</th>
                    <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest text-center">Gestão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredUsers.map(u => {
                    const emp = employees.find(e => e.userId === u.id);
                    return (
                      <tr key={u.id} className={`hover:bg-slate-50/50 transition-colors ${u.isBlocked ? 'bg-red-50/5' : ''}`}>
                        <td className="py-5 px-4">
                          {u.isBlocked ?
                            <span className="flex items-center gap-1.5 text-red-500 font-black text-[10px] uppercase tracking-wider"><Ban size={14} /> Bloqueado</span> :
                            <span className="flex items-center gap-1.5 text-green-500 font-black text-[10px] uppercase tracking-wider"><Unlock size={14} /> Liberado</span>
                          }
                        </td>
                        <td className="py-5 px-4 font-bold text-slate-800">{u.name}</td>
                        <td className="py-5 px-4 text-slate-500">{u.email}</td>
                        <td className="py-5 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <ActionButton
                              icon={u.isBlocked ? <Unlock size={16} /> : <Lock size={16} />}
                              label={u.isBlocked ? "Liberar Manualmente" : "Bloquear Manualmente"}
                              color={u.isBlocked ? "text-green-600 bg-green-50 hover:bg-green-100" : "text-slate-400 bg-slate-50 hover:bg-slate-100"}
                              onClick={() => handleToggleBlock(u.id, u.name)}
                            />
                            <ActionButton
                              icon={<Edit size={16} />}
                              label="Editar Férias"
                              color="text-blue-600 bg-blue-50 hover:bg-blue-100"
                              onClick={() => {
                                // Direct navigation to the specific user route
                                navigate(`/vacation-form/user/${u.id}`);
                              }}
                            />
                            <ActionButton icon={<Printer size={16} />} label="Imprimir Papeleta" color="text-orange-600 bg-orange-50 hover:bg-orange-100" onClick={() => emp ? navigate(`/print/${emp.id}`) : alert('Usuário não possui férias lançadas.')} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'justifications' && (
          <div className="p-8">
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
        )}

        {activeTab === 'accounts' && (
          <div className="p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><UserCog className="text-orange-500" size={24} /> Gestão de Contas</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Pesquisar por nome ou e-mail..."
                  className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500 w-full md:w-80"
                  value={accountSearch}
                  onChange={e => setAccountSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest">Nome</th>
                    <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest">E-mail</th>
                    <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest text-center">Ações de Conta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredAccountUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-5 px-4 font-bold text-slate-800">{u.name}</td>
                      <td className="py-5 px-4 text-slate-500">
                        <div className="flex flex-col">
                          <span>{u.email}</span>
                          <span className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${u.role === 'admin' ? 'text-orange-500' : 'text-slate-400'}`}>
                            {u.role === 'admin' ? 'Acesso Administrativo' : 'Acesso Padrão'}
                          </span>
                        </div>
                      </td>
                      <td className="py-5 px-4 text-slate-500">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={async () => {
                              await toggleUserRole(u.id);
                              addAuditLog({
                                userName: 'Admin',
                                action: 'Alteração',
                                field: `Nível de Acesso (${u.name})`,
                                oldValue: u.role === 'admin' ? 'Admin' : 'Usuário',
                                newValue: u.role === 'admin' ? 'Usuário' : 'Admin'
                              });
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${u.role === 'admin'
                              ? 'bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white'
                              }`}
                          >
                            <Shield size={14} /> {u.role === 'admin' ? 'Remover Admin' : 'Tornar Admin'}
                          </button>
                          <button
                            onClick={() => openPassModal(u)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                          >
                            <Key size={14} /> Redefinir Senha
                          </button>
                          <button
                            onClick={() => openDeleteModal(u)}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                          >
                            <Trash2 size={14} /> Excluir Conta
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Pesquisar logs..." className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={logSearch} onChange={e => setLogSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="date" className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" value={logStart} onChange={e => setLogStart(e.target.value)} />
                </div>
                <div className="relative flex-1">
                  <input type="date" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" value={logEnd} onChange={e => setLogEnd(e.target.value)} />
                </div>
                <button onClick={() => { setLogStart(''); setLogEnd(''); setLogSearch(''); }} className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-all"><Filter size={18} /></button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest">Data e Hora</th>
                    <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest">Usuário</th>
                    <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest">Ação</th>
                    <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest">Campo</th>
                    <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest min-w-[300px]">Anterior (Estado Antigo)</th>
                    <th className="pb-4 px-4 font-black uppercase text-[10px] tracking-widest min-w-[300px]">Novo (Estado Atualizado)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center text-slate-400 font-medium">Nenhum registro de auditoria encontrado.</td>
                    </tr>
                  ) : (
                    filteredLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-5 px-4 text-slate-500 text-[11px] font-bold tabular-nums align-top whitespace-nowrap">{format(new Date(log.timestamp), 'dd/MM/yy HH:mm')}</td>
                        <td className="py-5 px-4 font-bold text-slate-800 align-top">{log.userName}</td>
                        <td className="py-5 px-4 align-top">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${log.action === 'Criação' ? 'bg-green-100 text-green-700' :
                            log.action === 'Alteração' ? 'bg-blue-100 text-blue-700' :
                              log.action === 'Bloqueio' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                            }`}>{log.action}</span>
                        </td>
                        <td className="py-5 px-4 font-bold text-slate-600 text-[11px] uppercase align-top">{log.field}</td>
                        <td className="py-5 px-4 text-slate-400 text-[11px] align-top whitespace-pre-wrap leading-relaxed italic">{formatAuditValue(log.oldValue || '-')}</td>
                        <td className="py-5 px-4 text-slate-900 font-bold text-[11px] align-top whitespace-pre-wrap leading-relaxed">{formatAuditValue(log.newValue || '-')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TabButton = ({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button onClick={onClick} className={`flex items-center gap-2.5 px-8 py-3 rounded-xl text-sm font-black transition-all ${active ? 'bg-white text-orange-500 shadow-md ring-1 ring-slate-100' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
    {icon} {label}
  </button>
);

const ActionButton = ({ icon, label, color, onClick }: { icon: any, label: string, color: string, onClick: () => void }) => (
  <button onClick={onClick} title={label} className={`p-2.5 rounded-xl transition-all shadow-sm active:scale-90 ${color}`}>
    {icon}
  </button>
);

export default Security;
// jj
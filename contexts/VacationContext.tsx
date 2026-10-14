
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Employee, AuditLog, VacationParcel, SystemSettings, Notice, StaffMember, Suggestion } from '../types';
import { useAuth } from './AuthContext';
import { api } from '../lib/api';

interface VacationContextType {
  employees: Employee[];
  auditLogs: AuditLog[];
  settings: SystemSettings;
  suggestions: Suggestion[];
  saveVacation: (data: Employee) => Promise<void>;
  updateParcelNup: (employeeId: string, parcelId: string, nup: string) => Promise<void>;
  deleteVacation: (id: string) => Promise<void>;
  getEmployeeByUserId: (userId: string) => Employee | undefined;
  addAuditLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => Promise<void>;
  updateSettings: (newSettings: SystemSettings) => Promise<void>;
  addNotice: (notice: Omit<Notice, 'id' | 'date'>) => Promise<void>;
  deleteNotice: (id: string) => Promise<void>;
  togglePinNotice: (id: string, currentPinStatus: boolean) => Promise<void>;
  addSuggestion: (suggestion: { title: string; description: string; userId: string; userName: string; warName: string }) => Promise<void>;
  deleteSuggestion: (id: string) => Promise<void>;
}

const defaultStaffMember = (fn: string): StaffMember => ({ name: '', nip: '', rank: '', category: 'oficial', function: fn });

const defaultSettings: SystemSettings = {
  institutionName: 'MARINHA DO BRASIL',
  totalManpower: 100,
  notices: [
    { id: '1', title: 'Bem-vindo ao Novo Sistema', content: 'Utilize o menu superior para navegar pelas funcionalidades de lançamento e consulta.', date: new Date().toISOString() }
  ],
  diretor: defaultStaffMember('Diretor'),
  viceDiretor: defaultStaffMember('Vice-Diretor'),
  encPessoal: defaultStaffMember('Encarregado do Dep. Pessoal'),
};

const VacationContext = createContext<VacationContextType | undefined>(undefined);

export const VacationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    // Cada consulta é independente: a falha de uma (ex.: auditoria, restrita
    // a administradores) não impede o carregamento das demais.
    const safeGet = async <T,>(path: string): Promise<T | null> => {
      try {
        return await api.get<T>(path);
      } catch (error) {
        console.warn(`Falha ao carregar ${path}:`, error);
        return null;
      }
    };

    // Lançamentos — o servidor aplica a regra de setor (admin vê apenas seu
    // setor, exceto se viewAllSectors estiver ativado).
    const empData = await safeGet<any[]>('/employees');
    if (empData) {
      const mappedEmployees: Employee[] = empData.map(e => {
        let parcels = e.vacation_parcels;
        if (typeof parcels === 'string') {
          try { parcels = JSON.parse(parcels); } catch { parcels = []; }
        }
        if (!Array.isArray(parcels)) parcels = [];

        return {
          id: e.id,
          userId: e.user_id,
          name: e.name || '',
          warName: e.war_name || '',
          nip: e.nip || '',
          sector: e.sector || '',
          category: e.category || 'praca',
          rank: e.rank || '',
          // Registros legados sem planning_year devem cair na janela corrente (direito do ano anterior)
          planningYear: e.planning_year || (new Date().getFullYear() - 1),
          totalVacationDays: e.total_vacation_days || 30,
          vacationParcels: parcels,
          photoUrl: e.photo_url,
          justification: e.justification
        };
      });
      setEmployees(mappedEmployees);
    }

    // Fetch Settings
    const setData = await safeGet<any>('/settings');
    if (setData) {
      const staff = setData.staff_json || {};
      setSettings(prev => ({
        ...prev,
        institutionName: setData.institution_name,
        totalManpower: setData.total_manpower,
        logoUrl: setData.logo_url,
        diretor: staff.diretor || defaultStaffMember('Diretor'),
        viceDiretor: staff.viceDiretor || defaultStaffMember('Vice-Diretor'),
        encPessoal: staff.encPessoal || defaultStaffMember('Encarregado do Dep. Pessoal'),
        notices: [] // need to fetch notices separately
      }));
    }

    // Fetch Notices
    const noticeData = await safeGet<any[]>('/notices');
    if (noticeData) {
      setSettings(prev => ({
        ...prev,
        notices: noticeData.map(n => ({
          id: n.id,
          title: n.title,
          content: n.content,
          date: n.created_at || new Date().toISOString(),
          isPinned: n.is_pinned
        }))
      }));
    }

    // Fetch Audit Logs
    const logData = user.role === 'admin' ? await safeGet<any[]>('/audit-logs') : null;
    if (logData) {
      setAuditLogs(logData.map(l => ({
        id: l.id,
        timestamp: l.timestamp,
        userName: l.user_name,
        action: l.action,
        field: l.field,
        oldValue: l.old_value,
        newValue: l.new_value
      })));
    }

    const suggestionsData = await safeGet<any[]>('/suggestions');

    if (suggestionsData) {
      setSuggestions(suggestionsData.map(s => ({
        id: s.id,
        userId: s.user_id || '',
        userName: s.user_name || '',
        warName: s.war_name || '',
        title: s.title || '',
        description: s.description || '',
        createdAt: s.created_at || new Date().toISOString()
      })));
    }
  };

  const saveVacation = async (data: Employee) => {
    // Map to DB structure
    const dbEmployee: any = {
      id: data.id || undefined,
      user_id: data.userId,
      name: data.name,
      war_name: data.warName,
      nip: data.nip,
      sector: data.sector,
      category: data.category,
      rank: data.rank,
      planning_year: data.planningYear,
      total_vacation_days: data.totalVacationDays,
      vacation_parcels: data.vacationParcels,
      photo_url: data.photoUrl,
      justification: data.justification
    };

    // Com id: edita o registro existente. Sem id: o servidor garante
    // 1 registro por militar por ano de direito.
    try {
      await api.post('/employees', dbEmployee);
    } catch (error) {
      console.error('Error saving vacation:', error);
      throw new Error((error instanceof Error && error.message) || 'Não foi possível salvar o lançamento.');
    }

    await fetchData();
  };

  const updateParcelNup = async (employeeId: string, parcelId: string, nup: string) => {
    const targetEmployee = employees.find(e => e.id === employeeId);
    if (!targetEmployee) {
      throw new Error('Registro de férias não encontrado para salvar o NUP.');
    }

    const normalizedNup = nup.trim();
    const updatedParcels = targetEmployee.vacationParcels.map(parcel => {
      if (parcel.id !== parcelId) return parcel;
      return { ...parcel, nup: normalizedNup };
    });

    try {
      await api.patch(`/employees/${employeeId}`, { vacation_parcels: updatedParcels });
    } catch (error) {
      console.error('Error updating parcel NUP:', error);
      throw new Error((error instanceof Error && error.message) || 'Não foi possível salvar o NUP da parcela.');
    }

    setEmployees(prev => prev.map(emp => {
      if (emp.id !== employeeId) return emp;
      return { ...emp, vacationParcels: updatedParcels };
    }));
  };

  const deleteVacation = async (id: string) => {
    try {
      await api.delete(`/employees/${id}`);
      setEmployees(prev => prev.filter(e => e.id !== id));
    } catch (error) {
      console.error('Error deleting vacation:', error);
      alert('Erro ao excluir lançamento: ' + (error instanceof Error ? error.message : ''));
    }
  };

  const updateSettings = async (newSettings: SystemSettings) => {
    try {
      await api.put('/settings', {
        institution_name: newSettings.institutionName,
        total_manpower: newSettings.totalManpower,
        logo_url: newSettings.logoUrl,
        staff_json: {
          diretor: newSettings.diretor,
          viceDiretor: newSettings.viceDiretor,
          encPessoal: newSettings.encPessoal,
        }
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Erro ao salvar configurações: ' + (error instanceof Error ? error.message : ''));
      return;
    }

    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const addNotice = async (notice: Omit<Notice, 'id' | 'date'>) => {
    try {
      await api.post('/notices', {
        title: notice.title,
        content: notice.content,
        is_pinned: notice.isPinned || false
      });
      await fetchData();
    } catch (error) {
      console.error("Error adding notice:", error);
      alert("Erro ao adicionar aviso: " + (error instanceof Error ? error.message : ''));
    }
  };

  const deleteNotice = async (id: string) => {
    try {
      await api.delete(`/notices/${id}`);
      await fetchData();
    } catch (error) {
      console.error("Error deleting notice:", error);
      alert("Erro ao excluir aviso: " + (error instanceof Error ? error.message : ''));
    }
  };

  const togglePinNotice = async (id: string, currentPinStatus: boolean) => {
    try {
      await api.patch(`/notices/${id}`, { is_pinned: !currentPinStatus });
      await fetchData();
    } catch (error) {
      console.error("Error toggling pin status:", error);
      alert("Erro ao fixar aviso: " + (error instanceof Error ? error.message : ''));
    }
  };

  const addSuggestion = async (suggestion: { title: string; description: string; userId: string; userName: string; warName: string }) => {
    const payload = {
      user_id: suggestion.userId,
      user_name: suggestion.userName,
      war_name: suggestion.warName,
      title: suggestion.title,
      description: suggestion.description
    };

    let data: any;
    try {
      data = await api.post('/suggestions', payload);
    } catch (error) {
      console.error('Error adding suggestion:', error);
      throw new Error((error instanceof Error && error.message) || 'Nao foi possivel enviar a sugestao.');
    }

    if (data) {
      const newSuggestion: Suggestion = {
        id: data.id,
        userId: data.user_id || '',
        userName: data.user_name || '',
        warName: data.war_name || '',
        title: data.title || '',
        description: data.description || '',
        createdAt: data.created_at || new Date().toISOString()
      };
      setSuggestions(prev => [newSuggestion, ...prev]);
    }
  };

  const deleteSuggestion = async (id: string) => {
    try {
      await api.delete(`/suggestions/${id}`);
    } catch (error) {
      console.error('Error deleting suggestion:', error);
      throw new Error((error instanceof Error && error.message) || 'Nao foi possivel excluir a sugestao.');
    }

    setSuggestions(prev => prev.filter(item => item.id !== id));
  };

  const getEmployeeByUserId = (userId: string) => {
    return employees.find(e => e.userId === userId);
  };

  const addAuditLog = async (logData: Omit<AuditLog, 'id' | 'timestamp'>) => {
    let data: any = null;
    let error: unknown = null;
    try {
      data = await api.post('/audit-logs', {
        user_name: logData.userName,
        action: logData.action,
        field: logData.field,
        old_value: logData.oldValue,
        new_value: logData.newValue,
      });
    } catch (e) {
      error = e;
    }

    if (!error && data) {
      const newLog: AuditLog = {
        id: data.id,
        timestamp: data.timestamp,
        userName: data.user_name,
        action: data.action,
        field: data.field,
        oldValue: data.old_value,
        newValue: data.new_value
      };
      setAuditLogs(prev => [newLog, ...prev]);
    } else {
      console.error("Error adding log:", error);
    }
  };

  return (
    <VacationContext.Provider value={{
      employees, auditLogs, settings, suggestions,
      saveVacation, updateParcelNup, deleteVacation,
      getEmployeeByUserId, addAuditLog, updateSettings,
      addNotice, deleteNotice, togglePinNotice, addSuggestion, deleteSuggestion
    }}>
      {children}
    </VacationContext.Provider>
  );
};

export const useVacation = () => {
  const context = useContext(VacationContext);
  if (!context) throw new Error('useVacation must be used within VacationProvider');
  return context;
};

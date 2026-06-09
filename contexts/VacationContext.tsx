
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Employee, AuditLog, VacationParcel, SystemSettings, Notice } from '../types';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

interface VacationContextType {
  employees: Employee[];
  auditLogs: AuditLog[];
  settings: SystemSettings;
  saveVacation: (data: Employee) => Promise<void>;
  updateParcelNup: (employeeId: string, parcelId: string, nup: string) => Promise<void>;
  deleteVacation: (id: string) => Promise<void>;
  getEmployeeByUserId: (userId: string) => Employee | undefined;
  addAuditLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => Promise<void>;
  updateSettings: (newSettings: SystemSettings) => Promise<void>;
  addNotice: (notice: Omit<Notice, 'id' | 'date'>) => Promise<void>;
  deleteNotice: (id: string) => Promise<void>;
  togglePinNotice: (id: string, currentPinStatus: boolean) => Promise<void>;
}

const defaultSettings: SystemSettings = {
  institutionName: 'MARINHA DO BRASIL',
  totalManpower: 100,
  notices: [
    { id: '1', title: 'Bem-vindo ao Novo Sistema', content: 'Utilize o menu superior para navegar pelas funcionalidades de lançamento e consulta.', date: new Date().toISOString() }
  ]
};

const VacationContext = createContext<VacationContextType | undefined>(undefined);

export const VacationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    // Fetch Employees — admin vê apenas seu setor (exceto se viewAllSectors estiver ativado)
    let empQuery = supabase.from('employees').select('*');
    if (user.role === 'admin' && !user.viewAllSectors) {
      if (user.sector) {
        empQuery = empQuery.eq('sector', user.sector);
      } else {
        // Se o setor não está definido, nunca conceder visão global por padrão.
        empQuery = empQuery.eq('id', '__no_results__');
      }
    }
    const { data: empData } = await empQuery;
    if (empData) {
      // Map Supabase data to local types if needed (snake_case to camelCase)
      // Assumption: Database defines exact column names matching types or we map them here
      // Current DB schema uses snake_case, so mapping is likely needed unless we aliased in select or types match
      // Let's assume some mapping is needed based on common patterns, but I'll optimize for direct usage if keys match
      // Or I map them manually
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
          planningYear: e.planning_year || new Date().getFullYear(),
          totalVacationDays: e.total_vacation_days || 30,
          vacationParcels: parcels,
          photoUrl: e.photo_url,
          justification: e.justification
        };
      });
      setEmployees(mappedEmployees);
    }

    // Fetch Settings
    const { data: setData } = await supabase.from('system_settings').select('*').single();
    if (setData) {
      setSettings({
        institutionName: setData.institution_name,
        totalManpower: setData.total_manpower,
        logoUrl: setData.logo_url,
        notices: [] // need to fetch notices separately
      });
    }

    // Fetch Notices
    const { data: noticeData } = await supabase.from('notices').select('*');
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
    const { data: logData } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(100);
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
  };

  const saveVacation = async (data: Employee) => {
    // Map to DB structure
    const dbEmployee: any = {
      user_id: data.userId,
      name: data.name,
      war_name: data.warName,
      nip: data.nip,
      sector: data.sector,
      category: data.category,
      rank: data.rank,
      planning_year: data.planningYear,
      total_vacation_days: data.totalVacationDays,
      vacation_parcels: JSON.stringify(data.vacationParcels), // Ensure serialized
      photo_url: data.photoUrl,
      justification: data.justification
    };

    // Only add ID if it exists and is not empty
    if (data.id) {
      dbEmployee.id = data.id;
    }

    const { error: upsertError } = await supabase.from('employees').upsert(dbEmployee);
    if (upsertError) {
      console.error('Error saving vacation:', upsertError);
      throw new Error(upsertError.message || 'Não foi possível salvar o lançamento.');
    }

    // Sincronizar nome no Perfil (tabela profiles)
    const { error: profileError } = await supabase.from('profiles').update({
      name: data.name,
      war_name: data.warName,
      sector: data.sector,
    }).eq('id', data.userId);

    if (profileError) {
      console.error('Error syncing profile after vacation save:', profileError);
      throw new Error(profileError.message || 'Lançamento salvo, mas houve falha ao sincronizar perfil.');
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

    const { error } = await supabase
      .from('employees')
      .update({ vacation_parcels: JSON.stringify(updatedParcels) })
      .eq('id', employeeId);

    if (error) {
      console.error('Error updating parcel NUP:', error);
      throw new Error(error.message || 'Não foi possível salvar o NUP da parcela.');
    }

    setEmployees(prev => prev.map(emp => {
      if (emp.id !== employeeId) return emp;
      return { ...emp, vacationParcels: updatedParcels };
    }));
  };

  const deleteVacation = async (id: string) => {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (!error) {
      setEmployees(prev => prev.filter(e => e.id !== id));
    }
  };

  const updateSettings = async (newSettings: SystemSettings) => {
    // Upsert settings (assuming ID 1)
    await supabase.from('system_settings').upsert({
      id: 1,
      institution_name: newSettings.institutionName,
      total_manpower: newSettings.totalManpower,
      logo_url: newSettings.logoUrl
    });

    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const addNotice = async (notice: Omit<Notice, 'id' | 'date'>) => {
    const { error } = await supabase.from('notices').insert([{
      title: notice.title,
      content: notice.content,
      is_pinned: notice.isPinned || false
    }]);

    if (!error) {
      await fetchData();
    } else {
      console.error("Error adding notice:", error);
      alert("Erro ao adicionar aviso: " + error.message);
    }
  };

  const deleteNotice = async (id: string) => {
    const { error } = await supabase.from('notices').delete().eq('id', id);

    if (!error) {
      await fetchData();
    } else {
      console.error("Error deleting notice:", error);
      alert("Erro ao excluir aviso: " + error.message);
    }
  };

  const togglePinNotice = async (id: string, currentPinStatus: boolean) => {
    const { error } = await supabase.from('notices').update({ is_pinned: !currentPinStatus }).eq('id', id);

    if (!error) {
      await fetchData();
    } else {
      console.error("Error toggling pin status:", error);
      alert("Erro ao fixar aviso: " + error.message);
    }
  };

  const getEmployeeByUserId = (userId: string) => {
    return employees.find(e => e.userId === userId);
  };

  const addAuditLog = async (logData: Omit<AuditLog, 'id' | 'timestamp'>) => {
    // Insert into DB
    const { data, error } = await supabase.from('audit_logs').insert([{
      user_name: logData.userName,
      action: logData.action,
      field: logData.field,
      old_value: logData.oldValue,
      new_value: logData.newValue,
    }]).select().single();

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
      employees, auditLogs, settings,
      saveVacation, updateParcelNup, deleteVacation,
      getEmployeeByUserId, addAuditLog, updateSettings,
      addNotice, deleteNotice, togglePinNotice
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


import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { api, ApiError, PASSWORD_CHANGE_EVENT } from '../lib/api';

interface AuthContextType {
  user: User | null;
  users: User[]; // Kept for interface compatibility, but might be empty or restricted
  login: (email: string, pass: string) => Promise<boolean>;
  register: (name: string, email: string, pass: string, role?: 'admin' | 'user', extra?: { warName?: string; nip?: string; category?: string; sector?: string; rank?: string; specialization?: string }) => Promise<{ success: boolean; userId?: string; errorCode?: string; errorMessage?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  getRegisteredUsers: () => User[]; // Might need to be async or removed/deprecated
  changeUserPassword: (email: string, newPass: string) => Promise<boolean>; // Changed to Promise
  deleteUser: (userId: string) => void;
  toggleBlockUser: (userId: string, forceStatus?: boolean) => void;
  batchUpdateBlockStatus: (status: boolean) => void;
  refreshUser: () => Promise<void>;
  fetchAllUsers: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  toggleUserRole: (userId: string) => Promise<void>;
  setUserSectorVisibility: (userId: string, viewAllSectors: boolean) => Promise<{ success: boolean; errorMessage?: string }>;
  unlockUser: (userId: string) => Promise<void>;
  setCurrentUser: (profile: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Converte o perfil devolvido pela API para o tipo usado nas telas.
// O setor prioriza o lançamento de férias mais recente, que reflete
// atualizações feitas depois do cadastro.
const mapProfile = (p: any): User => ({
  id: p.id,
  name: p.name || '',
  warName: p.war_name || '',
  nip: p.nip || '',
  category: p.category || '',
  sector: p.latest_sector || p.sector || '',
  rank: p.rank || '',
  email: p.email || '',
  role: p.role as 'admin' | 'user',
  isBlocked: !!p.is_blocked,
  viewAllSectors: !!p.view_all_sectors,
  hasPassword: p.has_password !== false,
  mustChangePassword: !!p.must_change_password,
  accountLocked: !!p.account_locked,
  password: ''
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restaura a sessão (cookie) ao abrir o sistema.
    api.get<{ user: any }>('/auth/me')
      .then(({ user: me }) => {
        if (me) {
          setUser(mapProfile(me));
          if (!me.must_change_password) void fetchAllUsers();
        }
      })
      .catch(error => console.error('Error restoring session:', error))
      .finally(() => setLoading(false));
  }, []);

  // O servidor exigiu a troca da senha provisória: recarrega o usuário para
  // a tela de troca obrigatória aparecer.
  useEffect(() => {
    const onRequired = () => {
      api.get<{ user: any }>('/auth/me').then(({ user: me }) => { if (me) setUser(mapProfile(me)); }).catch(() => {});
    };
    window.addEventListener(PASSWORD_CHANGE_EVENT, onRequired);
    return () => window.removeEventListener(PASSWORD_CHANGE_EVENT, onRequired);
  }, []);

  const fetchAllUsers = async () => {
    try {
      const profiles = await api.get<any[]>('/profiles');
      const next = profiles.map(mapProfile);
      // Mantém os objetos que não mudaram (a atualização automática não
      // deve reiniciar telas abertas).
      setUsers(prev => {
        const byId = new Map(prev.map(u => [u.id, u]));
        const merged = next.map(u => {
          const old = byId.get(u.id);
          return old && JSON.stringify(old) === JSON.stringify(u) ? old : u;
        });
        return merged.length === prev.length && merged.every((u, i) => u === prev[i]) ? prev : merged;
      });
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) {
        console.error('Error fetching users:', error);
      }
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      const profile = await api.get(`/profiles/${userId}`);
      const profileData = mapProfile(profile);
      // Só atualiza o usuário logado se o perfil buscado for o dele.
      if (user === null || user.id === userId) {
        setUser(profileData);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (emailOrNip: string, pass: string): Promise<boolean> => {
    try {
      const { user: me } = await api.post<{ user: any }>('/auth/login', {
        login: emailOrNip.trim(),
        password: pass
      });
      setUser(mapProfile(me));
      if (!me.must_change_password) void fetchAllUsers();
      return true;
    } catch (e) {
      console.error('[Login] Falha:', e);
      throw e;
    }
  };

  const register = async (name: string, email: string, pass: string, _role: 'admin' | 'user' = 'user', extra?: { warName?: string; nip?: string; category?: string; sector?: string; rank?: string; specialization?: string }): Promise<{ success: boolean; userId?: string; errorCode?: string; errorMessage?: string }> => {
    try {
      // O servidor sempre cria contas novas como 'user'; a promoção a admin
      // é feita por um administrador em Segurança.
      const { id } = await api.post<{ id: string }>('/auth/register', {
        name,
        email,
        password: pass,
        war_name: extra?.warName || '',
        nip: extra?.nip || '',
        category: extra?.category || '',
        sector: extra?.sector || '',
        rank: extra?.rank || '',
        specialization: extra?.specialization || ''
      });
      return { success: true, userId: id };
    } catch (e) {
      console.error("Registration failed:", e);
      const errorMessage = e instanceof Error ? e.message : 'Erro inesperado ao cadastrar usuário.';
      const errorCode = e instanceof ApiError && e.status === 409 ? 'user_already_exists' : undefined;
      return { success: false, errorCode, errorMessage };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout failed:', error);
    }
    setUser(null);
    setUsers([]);
  };

  // Deprecated/Admin features that are tricky with client-side only auth
  // For now, implementing strictly necessary ones or mocks

  const getRegisteredUsers = () => {
    return users;
  };

  const changeUserPassword = async (email: string, newPass: string): Promise<boolean> => {
    try {
      // Alterando a própria senha.
      if (user && user.email.toLowerCase() === email.toLowerCase()) {
        await api.post('/auth/password', { password: newPass });
        return true;
      }

      // Alterando a senha de OUTRO usuário: somente administradores.
      if (user?.role !== 'admin') return false;
      await api.post('/admin/reset-password', { email, password: newPass });
      void fetchAllUsers();
      return true;
    } catch (e) {
      console.error("Password change error:", e);
      return false;
    }
  };

  const deleteUser = async (userId: string) => {
    // Optimistic update
    setUsers(prev => prev.filter(u => u.id !== userId));

    try {
      await api.delete(`/profiles/${userId}`);
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Erro ao excluir usuário: " + (error instanceof Error ? error.message : ''));
      fetchAllUsers();
    }
  };

  const toggleBlockUser = async (userId: string, forceStatus?: boolean) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    const oldStatus = targetUser.isBlocked;
    const newStatus = forceStatus !== undefined ? forceStatus : !oldStatus;

    // Optimistic update
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        return { ...u, isBlocked: newStatus };
      }
      return u;
    }));

    try {
      await api.patch(`/profiles/${userId}`, { is_blocked: newStatus });
    } catch (error) {
      console.error("Error toggling block:", error);
      // Revert if error
      setUsers(prev => prev.map(u => {
        if (u.id === userId) return { ...u, isBlocked: oldStatus };
        return u;
      }));
    }
  };

  const batchUpdateBlockStatus = (status: boolean) => {
    setUsers(prev => prev.map(u => ({ ...u, isBlocked: status })));
    if (user) {
      setUser({ ...user, isBlocked: status });
    }
  };

  const toggleUserRole = async (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';

    // Optimistic update
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    if (user?.id === userId) setUser(prev => prev ? { ...prev, role: newRole } : null);

    try {
      await api.patch(`/profiles/${userId}`, { role: newRole });
    } catch (error) {
      console.error("Error toggling role:", error);
      alert("Erro ao alterar perfil: " + (error instanceof Error ? error.message : ''));
      fetchAllUsers();
      if (user?.id === userId) void fetchProfile(userId);
    }
  };

  const setUserSectorVisibility = async (userId: string, viewAllSectors: boolean): Promise<{ success: boolean; errorMessage?: string }> => {
    const updateLocalStates = () => {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, viewAllSectors } : u));
      if (user?.id === userId) {
        setUser(prev => prev ? { ...prev, viewAllSectors } : prev);
      }
    };

    try {
      await api.patch(`/profiles/${userId}`, { view_all_sectors: viewAllSectors });
      updateLocalStates();
      return { success: true };
    } catch (error) {
      return { success: false, errorMessage: error instanceof Error ? error.message : 'Erro ao salvar.' };
    }
  };

  // Libera a conta bloqueada por tentativas inválidas de senha.
  const unlockUser = async (userId: string) => {
    const profile = await api.patch(`/profiles/${userId}`, { unlock: true });
    setUsers(prev => prev.map(u => (u.id === userId ? mapProfile(profile) : u)));
  };

  // Atualiza o usuário logado com o perfil devolvido pelo servidor (ex.: após trocar a senha).
  const setCurrentUser = (profile: any) => setUser(mapProfile(profile));

  const refreshUser = async () => {
    if (user) await fetchProfile(user.id);
    await fetchAllUsers();
  };

  return (
    <AuthContext.Provider value={{
      user,
      users,
      login,
      register,
      logout,
      isAuthenticated: !!user,
      getRegisteredUsers,
      changeUserPassword: changeUserPassword as any, // Type assertion for now if signature mismatch
      deleteUser,
      toggleBlockUser,
      batchUpdateBlockStatus,
      refreshUser,
      fetchAllUsers,
      fetchProfile,
      toggleUserRole,
      setUserSectorVisibility,
      unlockUser,
      setCurrentUser
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

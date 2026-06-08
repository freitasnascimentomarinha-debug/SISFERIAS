
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  users: User[]; // Kept for interface compatibility, but might be empty or restricted
  login: (email: string, pass: string) => Promise<boolean>;
  register: (name: string, email: string, pass: string, role?: 'admin' | 'user', extra?: { warName?: string; nip?: string; category?: string; sector?: string; rank?: string }) => Promise<boolean>;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Fetch all users for admin/listing purposes
    fetchAllUsers();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchAllUsers = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) {
      const allUsers = data.map(p => ({
        id: p.id,
        name: p.name || '',
        warName: p.war_name || '',
        nip: p.nip || '',
        category: p.category || '',
        sector: p.sector || '',
        rank: p.rank || '',
        email: p.email || '',
        role: p.role as 'admin' | 'user',
        isBlocked: p.is_blocked || false,
        viewAllSectors: !!p.view_all_sectors,
        password: ''
      }));
      setUsers(allUsers);
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data && !error) {
        let resolvedSector = data.sector || '';
        if (!resolvedSector) {
          const { data: employeeData } = await supabase
            .from('employees')
            .select('sector')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle();
          resolvedSector = employeeData?.sector || '';
        }

        const profileData: User = {
          id: data.id,
          name: data.name,
          warName: data.war_name || '',
          nip: data.nip || '',
          category: data.category || '',
          sector: resolvedSector,
          rank: data.rank || '',
          email: data.email,
          role: data.role as 'admin' | 'user',
          isBlocked: !!data.is_blocked,
          viewAllSectors: !!data.view_all_sectors,
          password: '' // Don't store password in state
        };

        // Only update the 'user' state if the fetched profile matches the current user's ID
        // This prevents accidentally overwriting the logged-in user with another user's profile
        // if fetchProfile is called for a different user ID (e.g., for display purposes).
        if (user === null || user.id === userId) {
          setUser(profileData);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, pass: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass
      });
      if (error || !data.user) throw error;

      // Essencial: Aguardar o carregamento do perfil antes de retornar sucesso
      // Isso evita o redirecionamento precoce que causa o "double login"
      await fetchProfile(data.user.id);

      return true;
    } catch (e) {
      console.error("Login failed:", e);
      return false;
    }
  };

  const register = async (name: string, email: string, pass: string, role: 'admin' | 'user' = 'user', extra?: { warName?: string; nip?: string; category?: string; sector?: string; rank?: string }): Promise<boolean> => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: pass,
      });

      if (authError || !authData.user) throw authError;

      // Create profile
      const { error: profileError } = await supabase.from('profiles').insert([{
        id: authData.user.id,
        name,
        email,
        role,
        is_blocked: false,
        war_name: extra?.warName || '',
        nip: extra?.nip || '',
        category: extra?.category || '',
        sector: extra?.sector || '',
        rank: extra?.rank || ''
      }]);

      if (profileError) {
        console.error("Profile creation failed:", profileError);
        // Optional: Delete auth user if profile creation fails?
        return false;
      }

      return true;
    } catch (e) {
      console.error("Registration failed:", e);
      return false;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Deprecated/Admin features that are tricky with client-side only auth
  // For now, implementing strictly necessary ones or mocks

  const getRegisteredUsers = () => {
    // This should ideally be an async call to supabase.from('profiles').select('*')
    // But keeping synchronous signature breaks things. 
    // For now returning empty array strictly, or we need to refactor the consumer.
    return [];
  };

  const changeUserPassword = async (email: string, newPass: string): Promise<boolean> => {
    try {
      // First try normal update (works if self-update)
      const { error } = await supabase.auth.updateUser({ password: newPass });

      if (!error) return true;

      // If failed (likely because trying to update another user), try Admin RPC
      if (user?.role === 'admin') {
        const { data, error: rpcError } = await supabase.rpc('admin_reset_password', {
          target_email: email,
          new_password: newPass
        });

        if (!rpcError && data) return true;
        console.error("Admin reset failed:", rpcError);
      }

      return false;
    } catch (e) {
      console.error("Password change error:", e);
      return false;
    }
  };

  const deleteUser = async (userId: string) => {
    // if (!user || user.role !== 'admin') return;

    // Optimistic update
    setUsers(prev => prev.filter(u => u.id !== userId));

    const { error } = await supabase.rpc('admin_delete_user', { target_user_id: userId });

    if (error) {
      console.error("Error deleting user:", error);
      alert("Erro ao excluir usuário: " + error.message);
      // Revert/Refetch would be better, but fetching all is easy
      fetchAllUsers();
    }
  };

  const toggleBlockUser = async (userId: string, forceStatus?: boolean) => {
    // Update profile is_blocked
    // Allow any authenticated user who passed the UI check to attempt this
    // if (!user || user.role !== 'admin') return; 

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

    const { error } = await supabase.from('profiles').update({ is_blocked: newStatus }).eq('id', userId);

    if (error) {
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

    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);

    if (error) {
      console.error("Error toggling role:", error);
      fetchAllUsers();
    }
  };

  const setUserSectorVisibility = async (userId: string, viewAllSectors: boolean): Promise<{ success: boolean; errorMessage?: string }> => {
    const updateLocalStates = () => {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, viewAllSectors } : u));
      if (user?.id === userId) {
        setUser(prev => prev ? { ...prev, viewAllSectors } : prev);
      }
    };

    const { error } = await supabase
      .from('profiles')
      .update({ view_all_sectors: viewAllSectors })
      .eq('id', userId);

    if (!error) {
      updateLocalStates();
      return { success: true };
    }

    return { success: false, errorMessage: error.message };
  };

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
      setUserSectorVisibility
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

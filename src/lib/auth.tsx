import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export interface UserPermissions {
  can_check_in: boolean;
  can_check_out: boolean;
  can_submit_forms: boolean;
  can_create_booking: boolean;
  can_change_rooms: boolean;
  can_block_dates: boolean;
  can_export_calendar: boolean;
  can_access_pms: boolean;
  can_access_front_desk: boolean;
  can_override_rates: boolean;
  can_access_guest_inbox: boolean;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  can_check_in: false,
  can_check_out: false,
  can_submit_forms: false,
  can_create_booking: false,
  can_change_rooms: false,
  can_block_dates: false,
  can_export_calendar: false,
  can_access_pms: false,
  can_access_front_desk: false,
  can_override_rates: false,
  can_access_guest_inbox: false,
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  isSystemAdmin: boolean;
  permissions: UserPermissions;
  hasPermission: (permission: keyof UserPermissions) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch user role and permissions when session changes
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
            fetchUserPermissions(session.user.id);
            fetchSystemAdmin(session.user.id);
          }, 0);
        } else {
          setUserRole(null);
          setPermissions(DEFAULT_PERMISSIONS);
          setIsSystemAdmin(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await Promise.all([
          fetchUserRole(session.user.id),
          fetchUserPermissions(session.user.id),
          fetchSystemAdmin(session.user.id),
        ]);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchSystemAdmin = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('is_system_admin')
      .eq('id', userId)
      .single();
    setIsSystemAdmin(data?.is_system_admin ?? false);
  };

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();
    
    if (!error && data) {
      setUserRole(data.role);
    }
  };

  const fetchUserPermissions = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (!error && data) {
      setPermissions({
        can_check_in: data.can_check_in ?? false,
        can_check_out: data.can_check_out ?? false,
        can_submit_forms: data.can_submit_forms ?? false,
        can_create_booking: data.can_create_booking ?? false,
        can_change_rooms: data.can_change_rooms ?? false,
        can_block_dates: data.can_block_dates ?? false,
        can_export_calendar: data.can_export_calendar ?? false,
        can_access_pms: data.can_access_pms ?? false,
        can_access_front_desk: data.can_access_front_desk ?? false,
        can_override_rates: data.can_override_rates ?? false,
      });
    } else {
      setPermissions(DEFAULT_PERMISSIONS);
    }
  };

  const refreshPermissions = async () => {
    if (user) {
      await fetchUserPermissions(user.id);
    }
  };

  // Admins always have all permissions
  const hasPermission = (permission: keyof UserPermissions): boolean => {
    if (userRole === 'admin') return true;
    return permissions[permission];
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserRole(null);
    setPermissions(DEFAULT_PERMISSIONS);
    setIsSystemAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      userRole, 
      isSystemAdmin,
      permissions,
      hasPermission,
      signIn, 
      signUp, 
      signOut, 
      loading,
      refreshPermissions
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
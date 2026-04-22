import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export type PropertyRole = 'admin' | 'manager' | 'staff' | 'viewer';

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
  can_delete_reservation: boolean;
  can_view_revenue: boolean;
  can_manage_rooms: boolean;
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
  can_delete_reservation: false,
  can_view_revenue: false,
  can_manage_rooms: false,
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  systemRole: string | null;
  propertyRole: PropertyRole | null;
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
  const [systemRole, setSystemRole] = useState<string | null>(null);
  const [propertyRole, setPropertyRole] = useState<PropertyRole | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hydrateUser = async (userId: string) => {
      await Promise.all([
        fetchUserRole(userId),
        fetchUserPermissions(userId),
        fetchSystemAdmin(userId),
        fetchPropertyRole(userId),
      ]);
      setLoading(false);
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Defer to avoid blocking auth callback; awaited inside helper
          setTimeout(() => {
            hydrateUser(session.user.id);
          }, 0);
        } else {
          setUserRole(null);
          setSystemRole(null);
          setPropertyRole(null);
          setPermissions(DEFAULT_PERMISSIONS);
          setIsSystemAdmin(false);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        hydrateUser(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Re-fetch property role when active property changes
    const handlePropertyChange = () => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          fetchPropertyRole(session.user.id);
        }
      });
    };
    window.addEventListener('activePropertyChanged', handlePropertyChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('activePropertyChanged', handlePropertyChange);
    };
  }, []);

  const fetchPropertyRole = async (userId: string) => {
    const savedId = localStorage.getItem('activePropertyId');
    if (savedId) {
      const { data } = await supabase
        .from('user_property_access')
        .select('role')
        .eq('user_id', userId)
        .eq('property_id', savedId)
        .maybeSingle();
      if (data?.role) {
        setPropertyRole(data.role as PropertyRole);
        return;
      }
    }
    // Fallback: first available access row
    const { data: anyAccess } = await supabase
      .from('user_property_access')
      .select('role')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    setPropertyRole((anyAccess?.role as PropertyRole) ?? null);
  };

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
      setSystemRole(data.role);
      setUserRole(data.role === 'super_admin' ? 'admin' : data.role);
    }
  };

  const fetchUserPermissions = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
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
        can_access_guest_inbox: data.can_access_guest_inbox ?? false,
        can_delete_reservation: data.can_delete_reservation ?? false,
        can_view_revenue: data.can_view_revenue ?? false,
        can_manage_rooms: data.can_manage_rooms ?? false,
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

  // System admins and Hostbase super admins always have all permissions
  const hasPermission = (permission: keyof UserPermissions): boolean => {
    if (systemRole === 'super_admin' || systemRole === 'admin') return true;
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
    setSystemRole(null);
    setPropertyRole(null);
    setPermissions(DEFAULT_PERMISSIONS);
    setIsSystemAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      userRole, 
      systemRole,
      propertyRole,
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
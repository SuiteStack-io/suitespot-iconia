import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  default_currency: string;
  default_timezone: string;
  vat_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  name: string;
  legal_name: string | null;
  description: string | null;
  property_type: string;
  email: string;
  phone: string | null;
  website: string | null;
  address: string;
  address_line_2: string | null;
  city: string;
  state: string | null;
  zip_code: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  currency: string;
  default_checkin_time: string | null;
  default_checkout_time: string | null;
  channex_property_id: string | null;
  channex_synced: boolean;
  channex_last_sync: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  company_id: string | null;
}

export type PropertyRole = 'owner' | 'admin' | 'manager' | 'staff' | 'viewer';

interface PropertyContextType {
  properties: Property[];
  activeProperty: Property | null;
  setActiveProperty: (property: Property) => void;
  propertyRole: PropertyRole | null;
  isSystemAdmin: boolean;
  isLoading: boolean;
  canEditProperty: boolean;
  canDeleteProperty: boolean;
  canManageUsers: boolean;
  refreshProperties: () => Promise<void>;
  company: Company | null;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

const ACTIVE_PROPERTY_KEY = 'activePropertyId';

export const PropertyProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [activeProperty, setActivePropertyState] = useState<Property | null>(null);
  const [propertyRole, setPropertyRole] = useState<PropertyRole | null>(null);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);

  const fetchProperties = useCallback(async () => {
    if (!user) {
      setProperties([]);
      setActivePropertyState(null);
      setPropertyRole(null);
      setIsLoading(false);
      return;
    }

    try {
      // Check system admin status
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_system_admin')
        .eq('id', user.id)
        .single();
      
      setIsSystemAdmin(profile?.is_system_admin ?? false);

      // Fetch properties (RLS handles filtering)
      const { data: props, error } = await supabase
        .from('properties')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;

      setProperties((props as Property[]) || []);

      // Restore active property from localStorage
      const savedId = localStorage.getItem(ACTIVE_PROPERTY_KEY);
      const saved = props?.find((p: any) => p.id === savedId);
      const defaultProp = props?.find((p: any) => p.is_default) || props?.[0];
      const active = saved || defaultProp || null;

      if (active) {
        setActivePropertyState(active as Property);
        // Fetch user's role on this property
        const { data: access } = await supabase
          .from('user_property_access')
          .select('role')
          .eq('user_id', user.id)
          .eq('property_id', active.id)
          .single();
        setPropertyRole((access?.role as PropertyRole) ?? null);

        // Fetch company info if property has company_id
        const companyId = (active as any).company_id;
        if (companyId) {
          const { data: companyData } = await supabase
            .from('companies')
            .select('*')
            .eq('id', companyId)
            .single();
          setCompany(companyData as Company | null);
        }
      }
    } catch (err) {
      console.error('Error fetching properties:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchProperties();
    }
  }, [authLoading, fetchProperties]);

  const setActiveProperty = useCallback(async (property: Property) => {
    setActivePropertyState(property);
    localStorage.setItem(ACTIVE_PROPERTY_KEY, property.id);
    
    if (user) {
      const { data: access } = await supabase
        .from('user_property_access')
        .select('role')
        .eq('user_id', user.id)
        .eq('property_id', property.id)
        .single();
      setPropertyRole((access?.role as PropertyRole) ?? null);
    }
  }, [user]);

  const canEditProperty = isSystemAdmin || propertyRole === 'owner' || propertyRole === 'admin';
  const canDeleteProperty = isSystemAdmin || propertyRole === 'owner';
  const canManageUsers = isSystemAdmin || propertyRole === 'owner' || propertyRole === 'admin';

  return (
    <PropertyContext.Provider value={{
      properties,
      activeProperty,
      setActiveProperty,
      propertyRole,
      isSystemAdmin,
      isLoading,
      canEditProperty,
      canDeleteProperty,
      canManageUsers,
      refreshProperties: fetchProperties,
      company,
    }}>
      {children}
    </PropertyContext.Provider>
  );
};

export const useProperty = () => {
  const context = useContext(PropertyContext);
  if (context === undefined) {
    throw new Error('useProperty must be used within a PropertyProvider');
  }
  return context;
};

export const usePropertySafe = () => {
  return useContext(PropertyContext);
};

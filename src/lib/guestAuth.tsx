import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GuestAccount {
  id: string;
  username: string;
  reservation_id: string;
  is_active: boolean;
  first_login_at: string | null;
  last_login_at: string | null;
}

interface GuestAuthContextType {
  guestAccount: GuestAccount | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ error: Error | null }>;
  logout: () => void;
}

const GuestAuthContext = createContext<GuestAuthContextType | undefined>(undefined);

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const [saltHex, hashHex] = hash.split(':');
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      data,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    
    const hashArray = new Uint8Array(derivedBits);
    const computedHashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    
    return computedHashHex === hashHex;
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

export const GuestAuthProvider = ({ children }: { children: ReactNode }) => {
  const [guestAccount, setGuestAccount] = useState<GuestAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if guest is already logged in (stored in localStorage)
    const storedGuest = localStorage.getItem('guestAccount');
    if (storedGuest) {
      const account = JSON.parse(storedGuest);
      // Verify session is still valid
      verifySession(account.id).then((isValid) => {
        if (isValid) {
          setGuestAccount(account);
        } else {
          localStorage.removeItem('guestAccount');
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const verifySession = async (accountId: string): Promise<boolean> => {
    try {
      const { data: account } = await supabase
        .from('guest_accounts')
        .select(`
          *,
          reservations!inner (
            check_out_date
          )
        `)
        .eq('id', accountId)
        .single();

      if (!account) return false;

      // Check if session is valid (1 day after checkout)
      const checkoutDate = new Date(account.reservations.check_out_date);
      const expiryDate = new Date(checkoutDate);
      expiryDate.setDate(expiryDate.getDate() + 1);
      
      return new Date() <= expiryDate && account.is_active;
    } catch (error) {
      console.error('Error verifying session:', error);
      return false;
    }
  };

  const login = async (username: string, password: string): Promise<{ error: Error | null }> => {
    try {
      // Fetch guest account
      const { data: account, error: fetchError } = await supabase
        .from('guest_accounts')
        .select(`
          *,
          reservations!inner (
            id,
            check_out_date
          )
        `)
        .eq('username', username)
        .single();

      if (fetchError || !account) {
        return { error: new Error('Invalid username or password') };
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, account.password_hash);
      if (!isValidPassword) {
        return { error: new Error('Invalid username or password') };
      }

      // Check if session is valid
      const isValid = await verifySession(account.id);
      if (!isValid) {
        return { error: new Error('Your session has expired. Please contact the property for assistance.') };
      }

      // Update last login
      const now = new Date().toISOString();
      const updateData: any = { last_login_at: now };
      if (!account.first_login_at) {
        updateData.first_login_at = now;
      }

      await supabase
        .from('guest_accounts')
        .update(updateData)
        .eq('id', account.id);

      const guestData: GuestAccount = {
        id: account.id,
        username: account.username,
        reservation_id: account.reservation_id,
        is_active: account.is_active,
        first_login_at: account.first_login_at,
        last_login_at: now,
      };

      setGuestAccount(guestData);
      localStorage.setItem('guestAccount', JSON.stringify(guestData));

      return { error: null };
    } catch (error) {
      console.error('Login error:', error);
      return { error: error as Error };
    }
  };

  const logout = () => {
    setGuestAccount(null);
    localStorage.removeItem('guestAccount');
  };

  return (
    <GuestAuthContext.Provider value={{ guestAccount, loading, login, logout }}>
      {children}
    </GuestAuthContext.Provider>
  );
};

export const useGuestAuth = () => {
  const context = useContext(GuestAuthContext);
  if (context === undefined) {
    throw new Error('useGuestAuth must be used within a GuestAuthProvider');
  }
  return context;
};

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SelectionAccount {
  id: string;
  username: string;
  landing_page_token: string;
  first_access_at: string | null;
  session_expires_at: string | null;
  is_active: boolean;
}

interface SelectionAuthContextType {
  account: SelectionAccount | null;
  loading: boolean;
  sessionExpired: boolean;
  login: (username: string, password: string, token: string) => Promise<{ error: string | null }>;
  logout: () => void;
  checkSessionExpiry: () => boolean;
}

const SelectionAuthContext = createContext<SelectionAuthContextType | undefined>(undefined);

export const useSelectionAuth = () => {
  const context = useContext(SelectionAuthContext);
  if (!context) {
    throw new Error("useSelectionAuth must be used within SelectionAuthProvider");
  }
  return context;
};

export const SelectionAuthProvider = ({ children }: { children: ReactNode }) => {
  const [account, setAccount] = useState<SelectionAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const checkSessionExpiry = (): boolean => {
    if (!account?.session_expires_at) return false;
    
    const expiryTime = new Date(account.session_expires_at).getTime();
    const now = new Date().getTime();
    
    if (now >= expiryTime) {
      setSessionExpired(true);
      logout();
      return true;
    }
    
    return false;
  };

  useEffect(() => {
    const stored = localStorage.getItem("selection_account");
    if (stored) {
      const parsed = JSON.parse(stored);
      setAccount(parsed);
      
      // Check expiry on mount
      if (parsed.session_expires_at) {
        const expiryTime = new Date(parsed.session_expires_at).getTime();
        const now = new Date().getTime();
        
        if (now >= expiryTime) {
          setSessionExpired(true);
          logout();
        }
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!account) return;

    // Check expiry every minute
    const interval = setInterval(() => {
      checkSessionExpiry();
    }, 60000);

    return () => clearInterval(interval);
  }, [account]);

  const login = async (username: string, password: string, token: string) => {
    try {
      const { data: accountData, error: fetchError } = await supabase
        .from("selection_accounts")
        .select("*")
        .eq("landing_page_token", token)
        .eq("username", username)
        .eq("is_active", true)
        .maybeSingle();

      if (fetchError || !accountData) {
        return { error: "Invalid credentials" };
      }

      // Verify password via edge function
      const { data: verifyResult, error: verifyError } = await supabase.functions.invoke(
        "verify-selection-password",
        {
          body: { password, passwordHash: accountData.password_hash }
        }
      );

      if (verifyError || !verifyResult?.valid) {
        return { error: "Invalid credentials" };
      }

      // Set first access time and expiry (15 minutes)
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

      const { error: updateError } = await supabase
        .from("selection_accounts")
        .update({
          first_access_at: accountData.first_access_at || now.toISOString(),
          session_expires_at: expiresAt.toISOString()
        })
        .eq("id", accountData.id);

      if (updateError) {
        console.error("Failed to update session times:", updateError);
      }

      const updatedAccount = {
        ...accountData,
        first_access_at: accountData.first_access_at || now.toISOString(),
        session_expires_at: expiresAt.toISOString()
      };

      setAccount(updatedAccount);
      localStorage.setItem("selection_account", JSON.stringify(updatedAccount));

      return { error: null };
    } catch (error) {
      console.error("Login error:", error);
      return { error: "An error occurred during login" };
    }
  };

  const logout = () => {
    setAccount(null);
    localStorage.removeItem("selection_account");
  };

  return (
    <SelectionAuthContext.Provider
      value={{ account, loading, sessionExpired, login, logout, checkSessionExpiry }}
    >
      {children}
    </SelectionAuthContext.Provider>
  );
};

"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

// Tipos para el cliente del portal
export interface CustomerPortalUser {
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  typical_recurrence_days: number | null;
  last_purchase_date: string | null;
}

interface CustomerPortalContextType {
  customer: CustomerPortalUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (sessionToken: string, customerData: CustomerPortalUser) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const CustomerPortalContext = createContext<CustomerPortalContextType | undefined>(undefined);

const SESSION_TOKEN_KEY = "cafe_portal_session";

export function CustomerPortalProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerPortalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Validar sesión al cargar
  useEffect(() => {
    const validateSession = async () => {
      const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);

      if (!sessionToken) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("validate_customer_session", {
          p_session_token: sessionToken,
        });

        if (error) {
          console.error("Error validating session:", error);
          localStorage.removeItem(SESSION_TOKEN_KEY);
          setIsLoading(false);
          return;
        }

        if (data && data.valid) {
          setCustomer({
            customer_id: data.customer_id,
            customer_name: data.customer_name,
            customer_phone: data.customer_phone,
            customer_email: data.customer_email,
            typical_recurrence_days: data.typical_recurrence_days,
            last_purchase_date: data.last_purchase_date,
          });
        } else {
          // Sesión expirada o inválida
          localStorage.removeItem(SESSION_TOKEN_KEY);
        }
      } catch (err) {
        console.error("Session validation error:", err);
        localStorage.removeItem(SESSION_TOKEN_KEY);
      }

      setIsLoading(false);
    };

    validateSession();
  }, []);

  const login = (sessionToken: string, customerData: CustomerPortalUser) => {
    localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
    setCustomer(customerData);
  };

  const logout = async () => {
    const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);

    if (sessionToken) {
      try {
        await supabase.rpc("logout_customer_session", {
          p_session_token: sessionToken,
        });
      } catch (err) {
        console.error("Logout error:", err);
      }
    }

    localStorage.removeItem(SESSION_TOKEN_KEY);
    setCustomer(null);
  };

  const refreshSession = async (): Promise<boolean> => {
    const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);

    if (!sessionToken) {
      return false;
    }

    try {
      const { data, error } = await supabase.rpc("validate_customer_session", {
        p_session_token: sessionToken,
      });

      if (error || !data || !data.valid) {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        setCustomer(null);
        return false;
      }

      setCustomer({
        customer_id: data.customer_id,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_email: data.customer_email,
        typical_recurrence_days: data.typical_recurrence_days,
        last_purchase_date: data.last_purchase_date,
      });

      return true;
    } catch (err) {
      console.error("Session refresh error:", err);
      return false;
    }
  };

  return (
    <CustomerPortalContext.Provider
      value={{
        customer,
        isLoading,
        isAuthenticated: customer !== null,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </CustomerPortalContext.Provider>
  );
}

export function useCustomerPortal() {
  const context = useContext(CustomerPortalContext);
  if (context === undefined) {
    throw new Error("useCustomerPortal must be used within a CustomerPortalProvider");
  }
  return context;
}

// Helper para obtener el session token (para RPCs que lo necesiten)
export function getCustomerSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

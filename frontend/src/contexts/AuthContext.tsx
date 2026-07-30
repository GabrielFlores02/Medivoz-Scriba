import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { logger } from "@/utils/logger";
import api from "@/lib/api";

export type AuthSpecialty = {
  id: number;
  nombre: string;
  esPrincipal: boolean;
};

export type AuthUser = {
  id: string;
  email: string;
  rol: string;
  nombreCompleto?: string;
  especialidades?: AuthSpecialty[];
  especialidadPrincipal?: AuthSpecialty | null;
};

type User = AuthUser | null;

type AuthContextType = {
  user: User;
  signOut: () => Promise<void>;
  loading: boolean;
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');

      if (!accessToken || !refreshToken) {
        setLoading(false);
        return;
      }

      try {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }

        const response = await api.get('/auth/me');
        setUser(response.data);
        localStorage.setItem('user', JSON.stringify(response.data));
      } catch (error) {
        logger.error("Auth check failed:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const signOut = async () => {
    try {
      setUser(null);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      toast.success("Sesión cerrada exitosamente");
    } catch (error: unknown) {
      logger.error("Error during sign out:", error);
      toast.error("Error al cerrar sesión");
    }
  };

  const value = {
    user,
    signOut,
    loading,
    setUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

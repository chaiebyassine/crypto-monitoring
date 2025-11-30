import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { login as apiLogin, register as apiRegister, fetchMe, logout as apiLogout, getToken, getStoredUser, type User } from "../lib/api";

// DEBUG: Nettoyer le localStorage au démarrage (à retirer en prod)
// localStorage.removeItem("token");
// localStorage.removeItem("user");

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Charger l'user stocké immédiatement
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [loading, setLoading] = useState(() => !!getToken());

  useEffect(() => {
    const token = getToken();
    if (token) {
      fetchMe()
        .then((u) => setUser(u))
        .catch(() => {
          // Token invalide, on le supprime
          apiLogout();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    setUser(res.user);
  };

  const register = async (email: string, password: string, name?: string) => {
    const res = await apiRegister(email, password, name);
    setUser(res.user);
  };

  const logout = () => {
    apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

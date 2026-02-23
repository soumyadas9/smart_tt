import React, { createContext, useContext, useEffect, useState } from "react";
import { checkAuth, login, logout, register } from "./api";

type AuthType = {
  loading: boolean;
  authenticated: boolean;
  username: string | null;
  loginUser: (u: string, p: string) => Promise<void>;
  registerUser: (u: string, p: string) => Promise<void>;
  logoutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    checkAuth()
      .then((res: any) => {
        setAuthenticated(res.authenticated);
        setUsername(res.username || null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function loginUser(u: string, p: string) {
    await login(u, p);
    setAuthenticated(true);
    setUsername(u);
  }

  async function registerUser(u: string, p: string) {
    await register(u, p);
  }

  async function logoutUser() {
    await logout();
    setAuthenticated(false);
    setUsername(null);
  }

  return (
    <AuthContext.Provider
      value={{ loading, authenticated, username, loginUser, registerUser, logoutUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthContext missing");
  return ctx;
}
import { createContext, useContext, useMemo, useState } from 'react';
import { api } from '../api';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('devsync_token'));
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('devsync_user')); } catch { return null; } });
  const authenticate = (data) => { localStorage.setItem('devsync_token', data.token); localStorage.setItem('devsync_user', JSON.stringify(data.user)); setToken(data.token); setUser(data.user); };
  const login = async (credentials) => authenticate((await api.post('/auth/login', credentials)).data);
  const register = async (details) => authenticate((await api.post('/auth/register', details)).data);
  const logout = () => { localStorage.removeItem('devsync_token'); localStorage.removeItem('devsync_user'); setToken(null); setUser(null); };
  const value = useMemo(() => ({ token, user, login, register, logout }), [token, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }

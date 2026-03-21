import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await api.get('/api/auth/me');
      setUser(response.data);
    } catch (error) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  // Refresh user data to get latest permissions
  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const response = await api.get('/api/auth/me');
      setUser(response.data);
    } catch (error) {
      // Silently fail - user may have been deactivated
    }
  }, [token]);

  const login = async (username, password) => {
    const response = await api.post('/api/auth/login', { username, password });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const hasPermission = (module, action) => {
    if (!user) return false;
    if (user.is_admin) return true;
    return user.permissions?.[module]?.[action] === true;
  };

  const canUnlockClosed = () => {
    if (!user) return false;
    if (user.is_admin) return true;
    return user.permissions?.unlock_closed_account === true;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      hasPermission,
      canUnlockClosed,
      refreshUser,
      isAdmin: user?.is_admin 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { getApiErrorMessage, requestWithRetry } from '../utils/api';

const AuthContext = createContext();
const TOKEN_STORAGE_KEY = 'token';

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
  const [token, setToken] = useState(localStorage.getItem(TOKEN_STORAGE_KEY));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== TOKEN_STORAGE_KEY) {
        return;
      }

      const nextToken = event.newValue;

      if (!nextToken) {
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
        setLoading(false);
        return;
      }

      if (nextToken !== token) {
        setLoading(true);
        setToken(nextToken);
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await requestWithRetry(() => axios.get('/api/auth/me'));
      if (response.data.data.role !== 'owner') {
        logout();
        throw new Error('Access denied. Owner account required.');
      }
      setUser(response.data.data);
    } catch (error) {
      console.error('Failed to fetch owner user:', getApiErrorMessage(error, 'Unable to load session'));
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = (userData, authToken) => {
    setToken(authToken);
    setUser(userData);
    localStorage.setItem(TOKEN_STORAGE_KEY, authToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

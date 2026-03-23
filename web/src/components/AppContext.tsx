import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../utils/api';
import { AppSchema } from '../types/app-schema';

interface AppContextType {
  apps: AppSchema[];
  loading: boolean;
  error: string | null;
  refreshApps: () => Promise<void>;
}

const AppContext = createContext<AppContextType>({
  apps: [],
  loading: false,
  error: null,
  refreshApps: async () => {},
});

export const useAppContext = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apps, setApps] = useState<AppSchema[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshApps = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/ocr/apps');

      const raw = (response as any)?.data ?? response;
      let data = raw;

      if (typeof raw?.body === 'string') {
        try {
          data = JSON.parse(raw.body);
        } catch {
          data = raw;
        }
      } else if (raw?.body && typeof raw.body === 'object') {
        data = raw.body;
      }

      const appsArray =
        Array.isArray(data) ? data :
        Array.isArray(data?.apps) ? data.apps :
        [];

      console.log('[AppContext] response=', response);
      console.log('[AppContext] raw=', raw);
      console.log('[AppContext] data=', data);
      console.log('[AppContext] appsArray=', appsArray);

      setApps(appsArray);
    } catch (e: any) {
      console.error('アプリ一覧取得エラー:', e);
      setError(e?.response?.data?.error || e?.message || 'アプリ一覧の取得に失敗しました');
      setApps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshApps();
  }, []);

  return (
    <AppContext.Provider value={{ apps, loading, error, refreshApps }}>
      {children}
    </AppContext.Provider>
  );
};

export default AppContext;

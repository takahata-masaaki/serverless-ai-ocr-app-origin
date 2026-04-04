import React from 'react';
import { AppSchema } from '../types/app-schema';
interface AppContextType {
    apps: AppSchema[];
    loading: boolean;
    error: string | null;
    refreshApps: () => Promise<void>;
}
declare const AppContext: React.Context<AppContextType>;
export declare const useAppContext: () => AppContextType;
export declare const AppProvider: React.FC<{
    children: React.ReactNode;
}>;
export default AppContext;

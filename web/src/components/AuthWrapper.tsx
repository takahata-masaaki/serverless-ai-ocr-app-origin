import React from 'react';
import { signOut } from 'aws-amplify/auth';

const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const handleLogout = async () => {
    try {
      await signOut();
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/'; 
    } catch (error) {
      console.error('Logout failed:', error);
      localStorage.clear();
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-600 p-4 flex justify-between items-center text-white shadow-md">
        <span className="font-bold text-lg cursor-pointer" onClick={() => window.location.href="/"}>OCR App</span>
        <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 px-6 py-2 rounded font-medium text-white transition-colors">
          ログアウト
        </button>
      </nav>
      {children}
    </div>
  );
};
export default AuthWrapper;

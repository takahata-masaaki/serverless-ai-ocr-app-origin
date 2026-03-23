import { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuthenticator, withAuthenticator } from '@aws-amplify/ui-react';
import { useAppContext } from './components/AppContext';
import "@aws-amplify/ui-react/styles.css";

interface AppProps {
  children: ReactNode;
}

function App({ children }: AppProps) {
  const { signOut } = useAuthenticator();
  const params = useParams();
  const { apps: availableApps } = useAppContext();

  const currentAppName = params.appName || '';
  const currentAppDisplayName = availableApps?.find(a => a.name === currentAppName)?.display_name || currentAppName;

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    signOut();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col w-full">
      <header className="bg-blue-600 text-white text-center py-4 flex justify-between items-center px-4" style={{ position: 'sticky', top: 0, zIndex: 1000 }}>
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center hover:text-gray-200">
            <span className="ml-2 font-semibold">ホーム</span>
          </Link>
          {currentAppName && (
            <div className="flex items-center">
              <span className="mx-2 text-gray-300">/</span>
              <span className="font-medium">{currentAppDisplayName}</span>
            </div>
          )}
        </div>
        <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-bold shadow-md">ログアウト</button>
      </header>
      <main className="flex-grow flex w-full">{children}</main>
    </div>
  );
}

// ここが最も重要です。アプリ全体を認証で強制ガードします。
export default withAuthenticator(App);

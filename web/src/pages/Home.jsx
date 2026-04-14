import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const sportsIcons = [
  'directions_run',     // 走る
  'pedal_bike',         // 自転車
  'pool',               // 水泳
  'rowing',             // ボート
  'kayaking',           // カヤック
  'downhill_skiing',    // スキー
  'surfing',            // サーフィン
  'fitness_center',     // 重量挙げ（ダンベル）
  'accessibility_new',  // 手を広げている人
];

const loadingTexts = [
  '読み込み中',
  '読み込み中·',
  '読み込み中··',
  '読み込み中···',
  '読み込み中····',
  '読み込み中·····',
  '読み込み中······'
];

const Home = () => {
    const navigate = useNavigate();
    const [apps, setApps] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [tick, setTick] = useState(0);

    // アイコンとテキストをパラパラ切り替えるタイマー（250ms）
    useEffect(() => {
        let timer;
        if (loading) {
            timer = setInterval(() => {
                setTick((prev) => prev + 1);
            }, 250); 
        }
        return () => clearInterval(timer);
    }, [loading]);

    const refreshApps = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/ocr/apps');
            const raw = response?.data ?? response;
            const list = Array.isArray(raw?.apps) ? raw.apps : Array.isArray(raw) ? raw : [];
            console.log('[HOME api] raw=', raw);
            console.log('[HOME api] list=', list);
            setApps(list);
        }
        catch (e) {
            console.error('アプリ一覧取得エラー:', e);
            setError(e?.response?.data?.error || e?.message || 'アプリ一覧の取得に失敗しました');
            setApps([]);
        }
        finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshApps();
    }, []);

    const handleAppSelect = (appName) => {
        navigate(`/app/${appName}`);
    };

    const handleAddApp = () => {
        navigate('/schema');
    };

    const currentIcon = sportsIcons[tick % sportsIcons.length];
    const currentText = loadingTexts[tick % loadingTexts.length];

    return (
        <div className="home-container bg-white rounded-lg shadow-md p-6 w-full">
            <h1 className="text-3xl font-bold mb-6 border-b pb-3 text-center text-gray-800">
                アプリ一覧
            </h1>

            <div className="flex justify-between items-center mb-6 px-6">
                <p className="text-xl text-gray-700">アプリケーションを選択してください</p>
                <button onClick={handleAddApp} className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg transition-colors">
                    新規スキーマ
                </button>
            </div>

            {loading && (
              <div className="flex items-center gap-3 px-6 mb-4 text-gray-500">
                <span className="material-symbols-outlined text-xl">
                  {currentIcon}
                </span>
                {/* 文字幅でガタつかないように font-mono を追加 */ }
                <span className="text-sm font-mono">{currentText}</span>
              </div>
            )}
            {error && <div className="text-red-500 mb-4 px-6">{error}</div>}

            {!loading && !error && apps.length === 0 && (<div className="px-6 text-gray-500">アプリが見つかりません</div>)}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-6 pb-6">
                {apps.map((app) => (
                    <div key={app.name} className="app-card bg-gray-50 border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer hover:border-blue-300" onClick={() => handleAppSelect(app.name)}>
                        <div className="app-icon mb-4 bg-blue-100 text-blue-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                        </div>

                        <h2 className="text-xl font-semibold mb-2 text-center text-gray-800">
                            {app.display_name || app.name}
                        </h2>

                        <div className="text-sm text-gray-500 text-center">
                            schema項目数: {Array.isArray(app.fields) ? app.fields.length : 0}
                        </div>

                        <div className="mt-4 text-center">
                            <button className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors">
                                選択する
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
export default Home;

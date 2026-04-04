import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import FileList from '../components/FileList';
import OcrActionBar from '../components/OcrActionBar';
import S3SyncModal from '../components/S3SyncModal';
import CustomPromptModal from '../components/CustomPromptModal';
import LoadingToast from '../components/LoadingToast';
import { useAppContext } from '../components/AppContext';

const STARTER_API = 'https://aj45ozgo95.execute-api.us-east-1.amazonaws.com/prod';

const Upload = () => {
    const { appName } = useParams();
    const { apps } = useAppContext();
    const selectedApp = apps.find((a) => a.name === appName);
    const appDisplayName = selectedApp?.display_name || appName || '';
    const fileInputRef = useRef(null);
    const [files, setFiles] = useState([]);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [pageProcessingMode, setPageProcessingMode] = useState('combined');
    const [selectedEngine, setSelectedEngine] = useState('azure');
    const [showS3Sync, setShowS3Sync] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);

    const refreshFiles = async () => {
        try {
            const res = await fetch(`${STARTER_API}/images?app_name=${encodeURIComponent(appName || '')}`, { method: 'GET' });
            const data = await res.json();
            setUploadedFiles(Array.isArray(data?.images) ? data.images : []);
        } catch (e) {
            console.error('ファイル一覧取得失敗:', e);
        }
    };

    useEffect(() => {
        refreshFiles();
        const timer = setInterval(refreshFiles, 2000);
        return () => clearInterval(timer);
    }, [appName]);

    const handleSelectFiles = (list) => {
        console.log('🔥 handleSelectFiles', list);
        if (!list || list.length === 0) return;
        const arr = Array.from(list).filter((f) => f.type === 'application/pdf' || f.type.startsWith('image/'));
        if (arr.length === 0) {
            setError('PDF・画像ファイルを選択してください');
            return;
        }
        setError(null);
        setFiles(arr);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        handleSelectFiles(e.dataTransfer.files);
    };

    const removeSelectedFile = (index) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (!appName) {
            setError('appName がありません');
            return;
        }
        if (files.length === 0) {
            setError('アップロードするファイルを選択してください');
            return;
        }
        setUploading(true);
        setError(null);
        try {
            for (const f of files) {
                const presignedRes = await fetch(`${STARTER_API}/generate-presigned-url`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: f.name,
                        content_type: f.type,
                        app_name: appName,
                        page_processing_mode: pageProcessingMode,
                    }),
                });
                const presigned = await presignedRes.json();
                const { presigned_url, s3_key, image_id } = presigned;
                await fetch(presigned_url, {
                    method: 'PUT',
                    body: f,
                    headers: { 'Content-Type': f.type },
                });
                await fetch(`${STARTER_API}/upload-complete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image_id,
                        filename: f.name,
                        s3_key,
                        app_name: appName,
                        page_processing_mode: pageProcessingMode,
                    }),
                });
            }
            setFiles([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
            await refreshFiles();
        } catch (e) {
            console.error('アップロード失敗:', e);
            setError(e?.message || 'アップロードに失敗しました');
        } finally {
            setUploading(false);
        }
    };

    const handleStartOcr = async () => {
        if (!appName) return;
        setIsProcessing(true);
        setError(null);
        try {
            const payload = {
                app_name: appName,
                ocr_engine: selectedEngine,
            };
            const res = await fetch(`/ocr/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const raw = await res.text();
            let data = null;
            try {
                data = raw ? JSON.parse(raw) : null;
            } catch (_) {
                data = raw;
            }
            if (!res.ok) {
                const msg = typeof data === 'object' && data !== null
                    ? (data.detail || data.message || JSON.stringify(data))
                    : (raw || `HTTP ${res.status}`);
                throw new Error(msg);
            }
            await refreshFiles();
        } catch (e) {
            console.error('OCR開始失敗:', e);
            setError(e?.message || 'OCR開始に失敗しました');
        } finally {
            setIsProcessing(false);
        }
    };

    // 💡【追加】アプリ丸ごと削除処理
    const handleDeleteApp = async () => {
        if (!window.confirm(`「${appDisplayName || appName}」を削除します。この操作は取り消せません。`)) return;
        setIsProcessing(true);
        try {
            // 💡【修正】CDKで定義されている正規ルート (/ocr/apps/{appName}) を叩くように変更
            const res = await fetch(`${STARTER_API}/ocr/apps/${appName}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('アプリの削除に失敗しました');
            window.location.href = '/'; // ホーム画面へ戻る
        } catch (e) {
            alert(e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const hasPending = uploadedFiles.some((f) => f.status === 'pending');
    const hasFiles = uploadedFiles.length > 0;

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-bold">{appDisplayName || appName}</h1>
                        <div className="flex space-x-2">
                            <Link to={`/schema-generator/${appName}`} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center">
                                スキーマ確認・編集
                            </Link>
                            <button onClick={() => setShowPrompt(true)} className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg">
                                カスタムプロンプト
                            </button>
                            {/* 💡【追加】削除ボタン */}
                            <button onClick={handleDeleteApp} disabled={isProcessing} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                削除
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 rounded bg-red-100 text-red-700 border border-red-300">
                            {error}
                        </div>
                    )}

                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center mb-6" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
                        <div className="mb-4 text-gray-500">
                            クリックしてファイルを選択 または ファイルをドラッグ＆ドロップ
                        </div>
                        <div className="text-sm text-gray-400 mb-4">
                            PDF・画像ファイル（JPG, PNG）のみ（最大10MB）
                        </div>

                        <input ref={fileInputRef} type="file" multiple accept=".pdf,image/*" className="hidden" onChange={(e) => handleSelectFiles(e.target.files)} />

                        <button type="button" onClick={() => {
                            fileInputRef.current?.click();
                        }} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded">
                            ファイルを選択
                        </button>
                    </div>

                    {files.length > 0 && (
                        <div className="mb-6 border rounded-lg p-4">
                            <div className="font-semibold mb-3">選択中ファイル</div>
                            <div className="space-y-2">
                                {files.map((f, i) => (
                                    <div key={`${f.name}-${i}`} className="flex justify-between items-center border-b pb-2">
                                        <div>
                                            <div className="font-medium">{f.name}</div>
                                            <div className="text-sm text-gray-500">
                                                {(f.size / 1024 / 1024).toFixed(2)} MB
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => removeSelectedFile(i)} className="text-red-500 hover:text-red-700">
                                            削除
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="border rounded-lg p-4 mb-6">
                        <div className="font-semibold mb-3">複数ページPDFの処理方法</div>

                        <label className="block mb-2">
                            <input type="radio" checked={pageProcessingMode === 'combined'} onChange={() => setPageProcessingMode('combined')} className="mr-2" />
                            全ページ統合処理
                        </label>

                        <label className="block">
                            <input type="radio" checked={pageProcessingMode === 'individual'} onChange={() => setPageProcessingMode('individual')} className="mr-2" />
                            ページ別個別処理
                        </label>
                    </div>

                    <div className="flex justify-end mb-6">
                        <button type="button" onClick={handleUpload} disabled={uploading || files.length === 0} className={`px-6 py-3 rounded-lg text-white font-semibold ${uploading || files.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}>
                            {uploading ? 'アップロード中...' : 'アップロード'}
                        </button>
                    </div>
                </div>

                <OcrActionBar isProcessing={isProcessing} hasPending={hasPending} hasFiles={hasFiles} selectedEngine={selectedEngine} onEngineChange={setSelectedEngine} onStartOcr={handleStartOcr} />

                <div className="p-4">
                    <FileList files={uploadedFiles} onRefresh={refreshFiles} />
                </div>
            </div>

            <S3SyncModal isOpen={showS3Sync} onClose={() => setShowS3Sync(false)} appName={appName || ''} onImportComplete={refreshFiles} />

            <CustomPromptModal isOpen={showPrompt} onClose={() => setShowPrompt(false)} appName={appName || ''} />

            <LoadingToast show={uploading || isProcessing} message={uploading ? 'アップロード中...' : '処理中...'} />
        </div>
    );
};

export default Upload;

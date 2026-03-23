import React, { useEffect, useState } from 'react';
import api from '../utils/api';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  appName: string;
};

const CustomPromptModal: React.FC<Props> = ({ isOpen, onClose, appName }) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !appName) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get(`/ocr/apps/${appName}/custom-prompt`);
        setPrompt(response.data?.prompt || '');
      } catch {
        setPrompt('');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, appName]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post(`/ocr/apps/${appName}/custom-prompt`, {
        prompt,
      });
      setSuccess('カスタムプロンプトを保存しました');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(`カスタムプロンプトの保存に失敗しました: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center border-b p-4">
          <h2 className="text-xl font-semibold">カスタムプロンプト設定</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          {loading ? (
            <div className="flex justify-center items-center h-32">読み込み中...</div>
          ) : (
            <>
              <p className="text-gray-700 mb-4">
                OCR処理後の情報抽出時に使用するカスタムプロンプトを設定できます。
              </p>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={12}
                placeholder="例: 請求書番号は「No.」や「請求書番号:」の後に続く数字を抽出してください。"
              />
              {error && <div className="mt-4 text-red-600">{error}</div>}
              {success && <div className="mt-4 text-green-600">{success}</div>}
            </>
          )}
        </div>

        <div className="border-t p-4 flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
            キャンセル
          </button>
          <button
            onClick={save}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300"
            disabled={saving}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomPromptModal;

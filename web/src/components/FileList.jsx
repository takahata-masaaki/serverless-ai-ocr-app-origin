import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { formatDateTimeJST } from '../utils/dateUtils';
import { deleteImage } from '../utils/api';
import Toast from './Toast';
const FileList = ({ files, onRefresh }) => {
    const navigate = useNavigate();
    const [expandedParents, setExpandedParents] = useState(new Set());
    const [deleteConfirm, setDeleteConfirm] = useState({
        show: false,
        imageId: '',
        imageName: ''
    });
    const [toast, setToast] = useState({
        show: false,
        message: '',
        type: 'success'
    });
    const [deleting, setDeleting] = useState(false);
    const sortField = 'uploadTime';
    // 親ドキュメントをデフォルトで開く
    React.useEffect(() => {
        const grouped = groupFiles(files);
        const parentIds = grouped.parentDocuments.map(p => p.image_id);
        setExpandedParents(new Set(parentIds));
    }, [files]);
    const sortFiles = (fileList) => {
        return [...fileList].sort((a, b) => {
            let aValue = a[sortField];
            let bValue = b[sortField];
            // 値が存在しない場合の処理
            if (!aValue)
                aValue = '';
            if (!bValue)
                bValue = '';
            // 文字列比較（降順）
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return -aValue.localeCompare(bValue);
            }
            // 数値比較（降順）
            if (aValue < bValue)
                return 1;
            if (aValue > bValue)
                return -1;
            return 0;
        });
    };
    // 結果表示ボタンのクリックハンドラ
    const handleViewResult = (id) => {
        const targetFile = files.find(file => file.image_id === id);
        const appName = targetFile?.app_name || targetFile?.appName || '';
        if (!appName) {
            alert('app_name が取得できません');
            return;
        }
        navigate(`/ocr/result/${id}?app_name=${encodeURIComponent(appName)}`);
    };
    // 削除確認ダイアログを表示
    const handleDeleteClick = (imageId, imageName) => {
        if (!imageId) {
            setToast({ show: true, message: '削除対象IDが取得できません', type: 'error' });
            return;
        }
        setDeleteConfirm({ show: true, imageId, imageName });
    };
    // 削除実行
    const handleDeleteConfirm = async () => {
        setDeleting(true);
        try {
            const targetFile = files.find(file => file.image_id === deleteConfirm.imageId);
            const appName = targetFile?.app_name || targetFile?.appName || 'default';
            await deleteImage(deleteConfirm.imageId, appName);
            setToast({ show: true, message: '画像を削除しました', type: 'success' });
            setDeleteConfirm({ show: false, imageId: '', imageName: '' });
            onRefresh();
        }
        catch (error) {
            setToast({ show: true, message: '削除に失敗しました', type: 'error' });
        }
        finally {
            setDeleting(false);
        }
    };
    // 親ドキュメントの展開/折りたたみ
    const toggleParentExpansion = (parentId) => {
        const newExpanded = new Set(expandedParents);
        if (newExpanded.has(parentId)) {
            newExpanded.delete(parentId);
        }
        else {
            newExpanded.add(parentId);
        }
        setExpandedParents(newExpanded);
    };
    // ファイルをグループ化
    const groupFiles = (files) => {
        // ソート適用
        const sortedFiles = sortFiles(files);
        const parentDocuments = [];
        const childPages = {};
        const standaloneFiles = [];
        sortedFiles.forEach(file => {
            if (file.pageProcessingMode === 'individual' && !file.parentDocumentId && (file.totalPages || 0) > 1) {
                // 親ドキュメント（2ページ以上の個別処理のみ）
                parentDocuments.push(file);
            }
            else if (file.parentDocumentId) {
                // 子ページ
                if (!childPages[file.parentDocumentId]) {
                    childPages[file.parentDocumentId] = [];
                }
                childPages[file.parentDocumentId].push(file);
            }
            else {
                // 通常ファイル（統合処理、既存データ、1ページの個別処理）
                standaloneFiles.push(file);
            }
        });
        // 子ページをページ番号順にソート
        Object.keys(childPages).forEach(parentId => {
            childPages[parentId].sort((a, b) => (a.pageNumber || 0) - (b.pageNumber || 0));
        });
        return { parentDocuments, childPages, standaloneFiles };
    };
    // 表示用に全ファイルを統合（親ファイルと通常ファイルを混在させる）
    const getMergedFilesForDisplay = () => {
        const grouped = groupFiles(files);
        const merged = [];
        // 親ファイルと通常ファイルを統合
        [...grouped.parentDocuments, ...grouped.standaloneFiles].forEach(file => {
            if (file.pageProcessingMode === 'individual' && !file.parentDocumentId && (file.totalPages || 0) > 1) {
                merged.push({ type: 'parent', file });
            }
            else {
                merged.push({ type: 'standalone', file });
            }
        });
        // ユーザー選択のソートフィールドでソート
        merged.sort((a, b) => {
            let aValue = a.file[sortField];
            let bValue = b.file[sortField];
            // 値が存在しない場合の処理
            if (!aValue)
                aValue = '';
            if (!bValue)
                bValue = '';
            // 文字列比較（降順）
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return -aValue.localeCompare(bValue);
            }
            // 数値比較（降順）
            if (aValue < bValue)
                return 1;
            if (aValue > bValue)
                return -1;
            return 0;
        });
        return { merged, childPages: grouped.childPages };
    };
    const { merged: mergedFiles, childPages } = getMergedFilesForDisplay();
    const totalFiles = files.length;
    // 親ドキュメントの進捗状況を計算
    const getParentProgress = (parentId) => {
        const children = childPages[parentId] || [];
        const completed = children.filter(child => child.status === 'completed').length;
        const total = children.length;
        return { completed, total };
    };
    // 親ドキュメントの全体ステータスを取得
    const getParentOverallStatus = (parentId) => {
        const children = childPages[parentId] || [];
        if (children.length === 0)
            return 'pending';
        const statuses = children.map(child => child.status);
        if (statuses.every(status => status === 'completed'))
            return 'completed';
        if (statuses.some(status => status === 'failed'))
            return 'failed';
        if (statuses.some(status => status === 'processing'))
            return 'processing';
        return 'pending';
    };
    return (<div className="p-4">
      {totalFiles > 0 ? (<>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-500">全{totalFiles}件</span>
            <div className="flex items-center">
              <button onClick={onRefresh} className="text-blue-500 hover:text-blue-700 mr-2 flex items-center text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                更新
              </button>
            </div>
          </div>
          
          <div className="space-y-2">
            {/* 親ドキュメントと通常ファイルを統合して表示 */}
            {mergedFiles.map(({ type, file }) => {
                if (type === 'parent') {
                    // 親ドキュメント（個別処理）
                    const isExpanded = expandedParents.has(file.image_id);
                    const children = childPages[file.image_id] || [];
                    const progress = getParentProgress(file.image_id);
                    const overallStatus = getParentOverallStatus(file.image_id);
                    return (<div key={file.image_id} className="border border-gray-200 rounded-lg">
                    {/* 親ドキュメント行 */}
                    <div className="flex items-center p-4 cursor-pointer hover:bg-gray-50" onClick={() => toggleParentExpansion(file.image_id)}>
                      {/* アイコンエリア: 固定幅 */}
                      <div className="w-12 flex-shrink-0 flex items-center">
                        {/* 展開/折りたたみアイコン */}
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-1 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                        </svg>
                        
                        {/* ファイルアイコン */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>
                        </svg>
                      </div>
                      
                      {/* ファイル名と情報 */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">{file.name}</div>
                        <div className="text-sm text-gray-500">
                          個別処理 - {file.totalPages}ページ ({progress.completed}/{progress.total} 完了)
                        </div>
                      </div>
                    
                    {/* アップロード日時 */}
                    <div className="w-40 flex-shrink-0 text-sm text-gray-500">
                      {formatDateTimeJST(file.uploadTime)}
                    </div>
                    
                    {/* 全体ステータス */}
                    <div className="w-24 flex-shrink-0">
                      <StatusBadge status={overallStatus}/>
                    </div>
                    
                    {/* 確認済み（親は表示しない） */}
                    <div className="w-16 flex-shrink-0 flex justify-center">
                      <span className="text-gray-300">-</span>
                    </div>
                    
                    {/* 操作ボタン（空白でスペース確保） */}
                    <div className="text-sm w-20 flex-shrink-0">
                      <span className="text-gray-400">-</span>
                    </div>
                    
                    {/* 削除ボタン */}
                    <div className="w-8 flex-shrink-0 flex justify-center">
                      <button onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(file.image_id, file.name);
                        }} className="text-gray-400 hover:text-gray-600" title="削除（全ページ削除）">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* 子ページ一覧 */}
                  {isExpanded && children.length > 0 && (<div className="border-t border-gray-100">
                      {children.map((childFile) => (<div key={childFile.image_id} className="flex items-center p-4 pl-12 hover:bg-gray-50">
                          {/* ページアイコン */}
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/>
                          </svg>
                          
                          {/* ページ情報 */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-700">
                              {childFile.name} (ページ {childFile.pageNumber}/{childFile.totalPages})
                            </div>
                          </div>
                          
                          {/* アップロード日時 */}
                          <div className="w-40 flex-shrink-0 text-sm text-gray-500">
                            {formatDateTimeJST(childFile.uploadTime)}
                          </div>
                          
                          {/* ステータス */}
                          <div className="w-24 flex-shrink-0">
                            <StatusBadge status={childFile.status}/>
                          </div>
                          
                          {/* 確認済み */}
                          <div className="w-16 flex-shrink-0 flex justify-center">
                            {childFile.verificationCompleted ? (<svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                              </svg>) : (<span className="text-gray-300">-</span>)}
                          </div>
                          
                          {/* 操作ボタン */}
                          <div className="text-sm w-20 flex-shrink-0">
                            {childFile.status === 'completed' ? (<button onClick={() => handleViewResult(childFile.image_id)} className="text-blue-600 hover:text-blue-900">
                                結果表示
                              </button>) : (<span className="text-gray-400">処理待ち</span>)}
                          </div>
                          
                          {/* 削除ボタン（子ページは削除不可） */}
                          <div className="w-8 flex-shrink-0"></div>
                        </div>))}
                    </div>)}
                </div>);
                }
                else {
                    // 通常ファイル（統合処理・既存データ）
                    return (<div key={file.image_id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center">
                      {/* アイコンエリア: 固定幅 */}
                      <div className="w-12 flex-shrink-0 flex items-center justify-center">
                        {/* ファイルアイコン */}
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${file.name.toLowerCase().endsWith('.pdf') ? 'text-red-500' : 'text-blue-500'}`} viewBox="0 0 20 20" fill="currentColor">
                          {file.name.toLowerCase().endsWith('.pdf') ? (<path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>) : (<path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/>)}
                        </svg>
                      </div>
                      
                      {/* ファイル名と処理情報 */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">{file.name}</div>
                        <div className="text-sm text-gray-500">
                          {file.pageProcessingMode === 'combined' ? (<span>
                              統合処理
                              {file.totalPages && file.totalPages > 1 && ` - ${file.totalPages}ページ`}
                            </span>) : file.pageProcessingMode === 'individual' && file.totalPages === 1 ? (<span>1ページ</span>) : (<span>-</span>)}
                        </div>
                      </div>
                      
                      {/* アップロード日時 */}
                      <div className="w-40 flex-shrink-0 text-sm text-gray-500">
                        {formatDateTimeJST(file.uploadTime)}
                      </div>
                      
                      {/* ステータス */}
                      <div className="w-24 flex-shrink-0">
                        <StatusBadge status={file.status}/>
                      </div>
                      
                      {/* 確認済み */}
                      <div className="w-16 flex-shrink-0 flex justify-center">
                        {file.verificationCompleted ? (<svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                          </svg>) : (<span className="text-gray-300">-</span>)}
                      </div>
                      
                      {/* 操作ボタン */}
                      <div className="text-sm w-20 flex-shrink-0">
                        {file.status === 'completed' ? (<button onClick={() => handleViewResult(file.image_id)} className="text-blue-600 hover:text-blue-900">
                            結果表示
                          </button>) : (<span className="text-gray-400">処理待ち</span>)}
                      </div>
                      
                      {/* 削除ボタン */}
                      <div className="w-8 flex-shrink-0 flex justify-center">
                        <button onClick={() => handleDeleteClick(file.image_id, file.name)} className="text-gray-400 hover:text-gray-600" title="削除">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>);
                }
            })}
          </div>
        </>) : (<div className="bg-white rounded-lg p-6 border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p className="text-center">
            ファイルがありません。PDFをアップロードしてください。
          </p>
        </div>)}

      {/* 削除確認モーダル */}
      {deleteConfirm.show && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">画像の削除</h3>
            <p className="text-gray-600 mb-6">
              「{deleteConfirm.imageName}」を削除します。この操作は取り消せません。
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm({ show: false, imageId: '', imageName: '' })} className="px-4 py-2 rounded bg-gray-500 hover:bg-gray-600 text-white" disabled={deleting}>
                キャンセル
              </button>
              <button onClick={handleDeleteConfirm} className="px-4 py-2 rounded bg-red-500 hover:bg-red-600 text-white" disabled={deleting}>
                {deleting ? '削除中...' : '削除'}
              </button>
            </div>
          </div>
        </div>)}

      {/* Toast通知 */}
      <Toast show={toast.show} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })}/>
    </div>);
};
export default FileList;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRmlsZUxpc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJGaWxlTGlzdC50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxLQUFLLEVBQUUsRUFBRSxRQUFRLEVBQUUsTUFBTSxPQUFPLENBQUM7QUFDeEMsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBRS9DLE9BQU8sV0FBVyxNQUFNLGVBQWUsQ0FBQztBQUN4QyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQzNDLE9BQU8sS0FBSyxNQUFNLFNBQVMsQ0FBQztBQWU1QixNQUFNLFFBQVEsR0FBNEIsQ0FBQyxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFO0lBQ2pFLE1BQU0sUUFBUSxHQUFHLFdBQVcsRUFBRSxDQUFDO0lBQy9CLE1BQU0sQ0FBQyxlQUFlLEVBQUUsa0JBQWtCLENBQUMsR0FBRyxRQUFRLENBQWMsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQy9FLE1BQU0sQ0FBQyxhQUFhLEVBQUUsZ0JBQWdCLENBQUMsR0FBRyxRQUFRLENBQXdEO1FBQ3hHLElBQUksRUFBRSxLQUFLO1FBQ1gsT0FBTyxFQUFFLEVBQUU7UUFDWCxTQUFTLEVBQUUsRUFBRTtLQUNkLENBQUMsQ0FBQztJQUNILE1BQU0sQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLEdBQUcsUUFBUSxDQUFnRTtRQUNoRyxJQUFJLEVBQUUsS0FBSztRQUNYLE9BQU8sRUFBRSxFQUFFO1FBQ1gsSUFBSSxFQUFFLFNBQVM7S0FDaEIsQ0FBQyxDQUFDO0lBQ0gsTUFBTSxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDaEQsTUFBTSxTQUFTLEdBQWMsWUFBWSxDQUFDO0lBRTFDLG1CQUFtQjtJQUNuQixLQUFLLENBQUMs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QUFPLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUM3RSxTQUFTLENBQUMsNERBQTRELENBQ3RFLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUVuQjs7Y0FDRixFQUFFLE1BQU0sQ0FDUjtjQUFBLENBQUMsTUFBTSxDQUNMLE9BQU8sQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQzdCLFNBQVMsQ0FBQywwREFBMEQsQ0FDcEUsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBRW5CO2dCQUFBLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FDN0I7Y0FBQSxFQUFFLE1BQU0sQ0FDVjtZQUFBLEVBQUUsR0FBRyxDQUNQO1VBQUEsRUFBRSxHQUFHLENBQ1A7UUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUNQLENBRUQ7O01BQUEsQ0FBQyxhQUFhLENBQ2Q7TUFBQSxDQUFDLEtBQUssQ0FDSixJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQ2pCLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FDdkIsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUNqQixPQUFPLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRSxHQUFHLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxFQUV2RDtJQUFBLEVBQUUsR0FBRyxDQUFDLENBQ1AsQ0FBQztBQUNKLENBQUMsQ0FBQztBQUVGLGVBQWUsUUFBUSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFJlYWN0LCB7IHVzZVN0YXRlIH0gZnJvbSAncmVhY3QnO1xuaW1wb3J0IHsgdXNlTmF2aWdhdGUgfSBmcm9tICdyZWFjdC1yb3V0ZXItZG9tJztcbmltcG9ydCB7IEltYWdlRmlsZSB9IGZyb20gJy4uL3R5cGVzL29jcic7XG5pbXBvcnQgU3RhdHVzQmFkZ2UgZnJvbSAnLi9TdGF0dXNCYWRnZSc7XG5pbXBvcnQgeyBmb3JtYXREYXRlVGltZUpTVCB9IGZyb20gJy4uL3V0aWxzL2RhdGVVdGlscyc7XG5pbXBvcnQgeyBkZWxldGVJbWFnZSB9IGZyb20gJy4uL3V0aWxzL2FwaSc7XG5pbXBvcnQgVG9hc3QgZnJvbSAnLi9Ub2FzdCc7XG5cbmludGVyZmFjZSBGaWxlTGlzdFByb3BzIHtcbiAgZmlsZXM6IEltYWdlRmlsZVtdO1xuICBvblJlZnJlc2g6ICgpID0+IHZvaWQ7XG59XG5cbmludGVyZmFjZSBHcm91cGVkRmlsZXMge1xuICBwYXJlbnREb2N1bWVudHM6IEltYWdlRmlsZVtdO1xuICBjaGlsZFBhZ2VzOiB7IFtwYXJlbnRJZDogc3RyaW5nXTogSW1hZ2VGaWxlW10gfTtcbiAgc3RhbmRhbG9uZUZpbGVzOiBJbWFnZUZpbGVbXTtcbn1cblxudHlwZSBTb3J0RmllbGQgPSAndXBsb2FkVGltZScgfCAnc3RhdHVzJyB8ICduYW1lJztcblxuY29uc3QgRmlsZUxpc3Q6IFJlYWN0LkZDPEZpbGVMaXN0UHJvcHM+ID0gKHsgZmlsZXMsIG9uUmVmcmVzaCB9KSA9PiB7XG4gIGNvbnN0IG5hdmlnYXRlID0gdXNlTmF2aWdhdGUoKTtcbiAgY29uc3QgW2V4cGFuZGVkUGFyZW50cywgc2V0RXhwYW5kZWRQYXJlbnRzXSA9IHVzZVN0YXRlPFNldDxzdHJpbmc+PihuZXcgU2V0KCkpO1xuICBjb25zdCBbZGVsZXRlQ29uZmlybSwgc2V0RGVsZXRlQ29uZmlybV0gPSB1c2VTdGF0ZTx7IHNob3c6IGJvb2xlYW47IGltYWdlSWQ6IHN0cmluZzsgaW1hZ2VOYW1lOiBzdHJpbmcgfT4oeyBcbiAgICBzaG93OiBmYWxzZSwgXG4gICAgaW1hZ2VJZDogJycsIFxuICAgIGltYWdlTmFtZTogJycgXG4gIH0pO1xuICBjb25zdCBbdG9hc3QsIHNldFRvYXN0XSA9IHVzZVN0YXRlPHsgc2hvdzogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nOyB0eXBlOiAnc3VjY2VzcycgfCAnZXJyb3InIH0+KHsgXG4gICAgc2hvdzogZmFsc2UsIFxuICAgIG1lc3NhZ2U6ICcnLCBcbiAgICB0eXBlOiAnc3VjY2VzcycgXG4gIH0pO1xuICBjb25zdCBbZGVsZXRpbmcsIHNldERlbGV0aW5nXSA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgY29uc3Qgc29ydEZpZWxkOiBTb3J0RmllbGQgPSAndXBsb2FkVGltZSc7XG5cbiAgLy8g6Kaq44OJ44Kt44Ol44Oh44Oz44OI44KS44OH44OV44Kp44Or44OI44Gn6ZaL44GPXG4gIFJlYWN0LnVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgZ3JvdXBlZCA9IGdyb3VwRmlsZXMoZmlsZXMpO1xuICAgIGNvbnN0IHBhcmVudElkcyA9IGdyb3VwZWQucGFyZW50RG9jdW1lbnRzLm1hcChwID0+IHAuaW1hZ2VfaWQpO1xuICAgIHNldEV4cGFuZGVkUGFyZW50cyhuZXcgU2V0KHBhcmVudElkcykpO1xuICB9LCBbZmlsZXNdKTtcblxuICBjb25zdCBzb3J0RmlsZXMgPSAoZmlsZUxpc3Q6IEltYWdlRmlsZVtdKSA9PiB7XG4gICAgcmV0dXJuIFsuLi5maWxlTGlzdF0uc29ydCgoYSwgYikgPT4ge1xuICAgICAgbGV0IGFWYWx1ZTogYW55ID0gYVtzb3J0RmllbGRdO1xuICAgICAgbGV0IGJWYWx1ZTogYW55ID0gYltzb3J0RmllbGRdO1xuXG4gICAgICAvLyDlgKTjgYzlrZjlnKjjgZfjgarjgYTloLTlkIjjga7lh6bnkIZcbiAgICAgIGlmICghYVZhbHVlKSBhVmFsdWUgPSAnJztcbiAgICAgIGlmICghYlZhbHVlKSBiVmFsdWUgPSAnJztcblxuICAgICAgLy8g5paH5a2X5YiX5q+U6LyD77yI6ZmN6aCG77yJXG4gICAgICBpZiAodHlwZW9mIGFWYWx1ZSA9PT0gJ3N0cmluZycgJiYgdHlwZW9mIGJWYWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIC1hVmFsdWUubG9jYWxlQ29tcGFyZShiVmFsdWUpO1xuICAgICAgfVxuXG4gICAgICAvLyDmlbDlgKTmr5TovIPvvIjpmY3poIbvvIlcbiAgICAgIGlmIChhVmFsdWUgPCBiVmFsdWUpIHJldHVybiAxO1xuICAgICAgaWYgKGFWYWx1ZSA+IGJWYWx1ZSkgcmV0dXJuIC0xO1xuICAgICAgcmV0dXJuIDA7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8g57WQ5p6c6KGo56S644Oc44K/44Oz44Gu44Kv44Oq44OD44Kv44OP44Oz44OJ44OpXG4gIGNvbnN0IGhhbmRsZVZpZXdSZXN1bHQgPSAoaWQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHRhcmdldEZpbGUgPSBmaWxlcy5maW5kKGZpbGUgPT4gZmlsZS5pbWFnZV9pZCA9PT0gaWQpO1xuICAgIGNvbnN0IGFwcE5hbWUgPSB0YXJnZXRGaWxlPy5hcHBfbmFtZSB8fCB0YXJnZXRGaWxlPy5hcHBOYW1lIHx8ICcnO1xuICAgIGlmICghYXBwTmFtZSkge1xuICAgICAgYWxlcnQoJ2FwcF9uYW1lIOOBjOWPluW+l+OBp+OBjeOBvuOBm+OCkycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBuYXZpZ2F0ZShgL29jci9yZXN1bHQvJHtpZH0/YXBwX25hbWU9JHtlbmNvZGVVUklDb21wb25lbnQoYXBwTmFtZSl9YCk7XG4gIH07XG5cbiAgLy8g5YmK6Zmk56K66KqN44OA44Kk44Ki44Ot44Kw44KS6KGo56S6XG4gIGNvbnN0IGhhbmRsZURlbGV0ZUNsaWNrID0gKGltYWdlSWQ6IHN0cmluZywgaW1hZ2VOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoIWltYWdlSWQpIHtcbiAgICAgIHNldFRvYXN0KHsgc2hvdzogdHJ1ZSwgbWVzc2FnZTogJ+WJiumZpOWvvuixoUlE44GM5Y+W5b6X44Gn44GN44G+44Gb44KTJywgdHlwZTogJ2Vycm9yJyB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgc2V0RGVsZXRlQ29uZmlybSh7IHNob3c6IHRydWUsIGltYWdlSWQsIGltYWdlTmFtZSB9KTtcbiAgfTtcblxuICAvLyDliYrpmaTlrp/ooYxcbiAgY29uc3QgaGFuZGxlRGVsZXRlQ29uZmlybSA9IGFzeW5jICgpID0+IHtcbiAgICBzZXREZWxldGluZyh0cnVlKTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdGFyZ2V0RmlsZSA9IGZpbGVzLmZpbmQoZmlsZSA9PiBmaWxlLmltYWdlX2lkID09PSBkZWxldGVDb25maXJtLmltYWdlSWQpO1xuICAgICAgY29uc3QgYXBwTmFtZSA9IHRhcmdldEZpbGU/LmFwcF9uYW1lIHx8IHRhcmdldEZpbGU/LmFwcE5hbWUgfHwgJ2RlZmF1bHQnO1xuXG4gICAgICBhd2FpdCBkZWxldGVJbWFnZShkZWxldGVDb25maXJtLmltYWdlSWQsIGFwcE5hbWUpO1xuICAgICAgc2V0VG9hc3QoeyBzaG93OiB0cnVlLCBtZXNzYWdlOiAn55S75YOP44KS5YmK6Zmk44GX44G+44GX44GfJywgdHlwZTogJ3N1Y2Nlc3MnIH0pO1xuICAgICAgc2V0RGVsZXRlQ29uZmlybSh7IHNob3c6IGZhbHNlLCBpbWFnZUlkOiAnJywgaW1hZ2VOYW1lOiAnJyB9KTtcbiAgICAgIG9uUmVmcmVzaCgpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBzZXRUb2FzdCh7IHNob3c6IHRydWUsIG1lc3NhZ2U6ICfliYrpmaTjgavlpLHmlZfjgZfjgb7jgZfjgZ8nLCB0eXBlOiAnZXJyb3InIH0pO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBzZXREZWxldGluZyhmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIC8vIOimquODieOCreODpeODoeODs+ODiOOBruWxlemWiy/mipjjgorjgZ/jgZ/jgb9cbiAgY29uc3QgdG9nZ2xlUGFyZW50RXhwYW5zaW9uID0gKHBhcmVudElkOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBuZXdFeHBhbmRlZCA9IG5ldyBTZXQoZXhwYW5kZWRQYXJlbnRzKTtcbiAgICBpZiAobmV3RXhwYW5kZWQuaGFzKHBhcmVudElkKSkge1xuICAgICAgbmV3RXhwYW5kZWQuZGVsZXRlKHBhcmVudElkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV3RXhwYW5kZWQuYWRkKHBhcmVudElkKTtcbiAgICB9XG4gICAgc2V0RXhwYW5kZWRQYXJlbnRzKG5ld0V4cGFuZGVkKTtcbiAgfTtcblxuICAvLyDjg5XjgqHjgqTjg6vjgpLjgrDjg6vjg7zjg5fljJZcbiAgY29uc3QgZ3JvdXBGaWxlcyA9IChmaWxlczogSW1hZ2VGaWxlW10pOiBHcm91cGVkRmlsZXMgPT4ge1xuICAgIC8vIOOCveODvOODiOmBqeeUqFxuICAgIGNvbnN0IHNvcnRlZEZpbGVzID0gc29ydEZpbGVzKGZpbGVzKTtcblxuICAgIGNvbnN0IHBhcmVudERvY3VtZW50czogSW1hZ2VGaWxlW10gPSBbXTtcbiAgICBjb25zdCBjaGlsZFBhZ2VzOiB7IFtwYXJlbnRJZDogc3RyaW5nXTogSW1hZ2VGaWxlW10gfSA9IHt9O1xuICAgIGNvbnN0IHN0YW5kYWxvbmVGaWxlczogSW1hZ2VGaWxlW10gPSBbXTtcblxuICAgIHNvcnRlZEZpbGVzLmZvckVhY2goZmlsZSA9PiB7XG4gICAgICBpZiAoZmlsZS5wYWdlUHJvY2Vzc2luZ01vZGUgPT09ICdpbmRpdmlkdWFsJyAmJiAhZmlsZS5wYXJlbnREb2N1bWVudElkICYmIChmaWxlLnRvdGFsUGFnZXMgfHwgMCkgPiAxKSB7XG4gICAgICAgIC8vIOimquODieOCreODpeODoeODs+ODiO+8iDLjg5rjg7zjgrjku6XkuIrjga7lgIvliKXlh6bnkIbjga7jgb/vvIlcbiAgICAgICAgcGFyZW50RG9jdW1lbnRzLnB1c2goZmlsZSk7XG4gICAgICB9IGVsc2UgaWYgKGZpbGUucGFyZW50RG9jdW1lbnRJZCkge1xuICAgICAgICAvLyDlrZDjg5rjg7zjgrhcbiAgICAgICAgaWYgKCFjaGlsZFBhZ2VzW2ZpbGUucGFyZW50RG9jdW1lbnRJZF0pIHtcbiAgICAgICAgICBjaGlsZFBhZ2VzW2ZpbGUucGFyZW50RG9jdW1lbnRJZF0gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBjaGlsZFBhZ2VzW2ZpbGUucGFyZW50RG9jdW1lbnRJZF0ucHVzaChmaWxlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIOmAmuW4uOODleOCoeOCpOODq++8iOe1seWQiOWHpueQhuOAgeaXouWtmOODh+ODvOOCv+OAgTHjg5rjg7zjgrjjga7lgIvliKXlh6bnkIbvvIlcbiAgICAgICAgc3RhbmRhbG9uZUZpbGVzLnB1c2goZmlsZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyDlrZDjg5rjg7zjgrjjgpLjg5rjg7zjgrjnlarlj7fpoIbjgavjgr3jg7zjg4hcbiAgICBPYmplY3Qua2V5cyhjaGlsZFBhZ2VzKS5mb3JFYWNoKHBhcmVudElkID0+IHtcbiAgICAgIGNoaWxkUGFnZXNbcGFyZW50SWRdLnNvcnQoKGEsIGIpID0+IChhLnBhZ2VOdW1iZXIgfHwgMCkgLSAoYi5wYWdlTnVtYmVyIHx8IDApKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB7IHBhcmVudERvY3VtZW50cywgY2hpbGRQYWdlcywgc3RhbmRhbG9uZUZpbGVzIH07XG4gIH07XG5cbiAgLy8g6KGo56S655So44Gr5YWo44OV44Kh44Kk44Or44KS57Wx5ZCI77yI6Kaq44OV44Kh44Kk44Or44Go6YCa5bi444OV44Kh44Kk44Or44KS5re35Zyo44GV44Gb44KL77yJXG4gIGNvbnN0IGdldE1lcmdlZEZpbGVzRm9yRGlzcGxheSA9ICgpID0+IHtcbiAgICBjb25zdCBncm91cGVkID0gZ3JvdXBGaWxlcyhmaWxlcyk7XG4gICAgY29uc3QgbWVyZ2VkOiBBcnJheTx7IHR5cGU6ICdwYXJlbnQnIHwgJ3N0YW5kYWxvbmUnLCBmaWxlOiBJbWFnZUZpbGUgfT4gPSBbXTtcbiAgICBcbiAgICAvLyDopqrjg5XjgqHjgqTjg6vjgajpgJrluLjjg5XjgqHjgqTjg6vjgpLntbHlkIhcbiAgICBbLi4uZ3JvdXBlZC5wYXJlbnREb2N1bWVudHMsIC4uLmdyb3VwZWQuc3RhbmRhbG9uZUZpbGVzXS5mb3JFYWNoKGZpbGUgPT4ge1xuICAgICAgaWYgKGZpbGUucGFnZVByb2Nlc3NpbmdNb2RlID09PSAnaW5kaXZpZHVhbCcgJiYgIWZpbGUucGFyZW50RG9jdW1lbnRJZCAmJiAoZmlsZS50b3RhbFBhZ2VzIHx8IDApID4gMSkge1xuICAgICAgICBtZXJnZWQucHVzaCh7IHR5cGU6ICdwYXJlbnQnLCBmaWxlIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWVyZ2VkLnB1c2goeyB0eXBlOiAnc3RhbmRhbG9uZScsIGZpbGUgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgLy8g44Om44O844K244O86YG45oqe44Gu44K944O844OI44OV44Kj44O844Or44OJ44Gn44K944O844OIXG4gICAgbWVyZ2VkLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIGxldCBhVmFsdWU6IGFueSA9IGEuZmlsZVtzb3J0RmllbGRdO1xuICAgICAgbGV0IGJWYWx1ZTogYW55ID0gYi5maWxlW3NvcnRGaWVsZF07XG5cbiAgICAgIC8vIOWApOOBjOWtmOWcqOOBl+OBquOBhOWgtOWQiOOBruWHpueQhlxuICAgICAgaWYgKCFhVmFsdWUpIGFWYWx1ZSA9ICcnO1xuICAgICAgaWYgKCFiVmFsdWUpIGJWYWx1ZSA9ICcnO1xuXG4gICAgICAvLyDmloflrZfliJfmr5TovIPvvIjpmY3poIbvvIlcbiAgICAgIGlmICh0eXBlb2YgYVZhbHVlID09PSAnc3RyaW5nJyAmJiB0eXBlb2YgYlZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gLWFWYWx1ZS5sb2NhbGVDb21wYXJlKGJWYWx1ZSk7XG4gICAgICB9XG5cbiAgICAgIC8vIOaVsOWApOavlOi8g++8iOmZjemghu+8iVxuICAgICAgaWYgKGFWYWx1ZSA8IGJWYWx1ZSkgcmV0dXJuIDE7XG4gICAgICBpZiAoYVZhbHVlID4gYlZhbHVlKSByZXR1cm4gLTE7XG4gICAgICByZXR1cm4gMDtcbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4geyBtZXJnZWQsIGNoaWxkUGFnZXM6IGdyb3VwZWQuY2hpbGRQYWdlcyB9O1xuICB9O1xuXG4gIGNvbnN0IHsgbWVyZ2VkOiBtZXJnZWRGaWxlcywgY2hpbGRQYWdlcyB9ID0gZ2V0TWVyZ2VkRmlsZXNGb3JEaXNwbGF5KCk7XG4gIGNvbnN0IHRvdGFsRmlsZXMgPSBmaWxlcy5sZW5ndGg7XG5cbiAgLy8g6Kaq44OJ44Kt44Ol44Oh44Oz44OI44Gu6YCy5o2X54q25rOB44KS6KiI566XXG4gIGNvbnN0IGdldFBhcmVudFByb2dyZXNzID0gKHBhcmVudElkOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjaGlsZHJlbiA9IGNoaWxkUGFnZXNbcGFyZW50SWRdIHx8IFtdO1xuICAgIGNvbnN0IGNvbXBsZXRlZCA9IGNoaWxkcmVuLmZpbHRlcihjaGlsZCA9PiBjaGlsZC5zdGF0dXMgPT09ICdjb21wbGV0ZWQnKS5sZW5ndGg7XG4gICAgY29uc3QgdG90YWwgPSBjaGlsZHJlbi5sZW5ndGg7XG4gICAgcmV0dXJuIHsgY29tcGxldGVkLCB0b3RhbCB9O1xuICB9O1xuXG4gIC8vIOimquODieOCreODpeODoeODs+ODiOOBruWFqOS9k+OCueODhuODvOOCv+OCueOCkuWPluW+l1xuICBjb25zdCBnZXRQYXJlbnRPdmVyYWxsU3RhdHVzID0gKHBhcmVudElkOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjaGlsZHJlbiA9IGNoaWxkUGFnZXNbcGFyZW50SWRdIHx8IFtdO1xuICAgIGlmIChjaGlsZHJlbi5sZW5ndGggPT09IDApIHJldHVybiAncGVuZGluZyc7XG4gICAgXG4gICAgY29uc3Qgc3RhdHVzZXMgPSBjaGlsZHJlbi5tYXAoY2hpbGQgPT4gY2hpbGQuc3RhdHVzKTtcbiAgICBpZiAoc3RhdHVzZXMuZXZlcnkoc3RhdHVzID0+IHN0YXR1cyA9PT0gJ2NvbXBsZXRlZCcpKSByZXR1cm4gJ2NvbXBsZXRlZCc7XG4gICAgaWYgKHN0YXR1c2VzLnNvbWUoc3RhdHVzID0+IHN0YXR1cyA9PT0gJ2ZhaWxlZCcpKSByZXR1cm4gJ2ZhaWxlZCc7XG4gICAgaWYgKHN0YXR1c2VzLnNvbWUoc3RhdHVzID0+IHN0YXR1cyA9PT0gJ3Byb2Nlc3NpbmcnKSkgcmV0dXJuICdwcm9jZXNzaW5nJztcbiAgICByZXR1cm4gJ3BlbmRpbmcnO1xuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzc05hbWU9XCJwLTRcIj5cbiAgICAgIHt0b3RhbEZpbGVzID4gMCA/IChcbiAgICAgICAgPD5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1iZXR3ZWVuIGl0ZW1zLWNlbnRlciBtYi0yXCI+XG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtZ3JheS01MDBcIj7lhah7dG90YWxGaWxlc33ku7Y8L3NwYW4+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyXCI+XG4gICAgICAgICAgICAgIDxidXR0b24gb25DbGljaz17b25SZWZyZXNofSBjbGFzc05hbWU9XCJ0ZXh0LWJsdWUtNTAwIGhvdmVyOnRleHQtYmx1ZS03MDAgbXItMiBmbGV4IGl0ZW1zLWNlbnRlciB0ZXh0LXNtXCI+XG4gICAgICAgICAgICAgICAgPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgY2xhc3NOYW1lPVwiaC00IHctNCBtci0xXCIgZmlsbD1cIm5vbmVcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCI+XG4gICAgICAgICAgICAgICAgICA8cGF0aCBzdHJva2VMaW5lY2FwPVwicm91bmRcIiBzdHJva2VMaW5lam9pbj1cInJvdW5kXCIgc3Ryb2tlV2lkdGg9ezJ9IGQ9XCJNNCA0djVoLjU4Mm0xNS4zNTYgMkE4LjAwMSA4LjAwMSAwIDAwNC41ODIgOW0wIDBIOW0xMSAxMXYtNWgtLjU4MW0wIDBhOC4wMDMgOC4wMDMgMCAwMS0xNS4zNTctMm0xNS4zNTcgMkgxNVwiIC8+XG4gICAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICAgICAg5pu05pawXG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTJcIj5cbiAgICAgICAgICAgIHsvKiDopqrjg4njgq3jg6Xjg6Hjg7Pjg4jjgajpgJrluLjjg5XjgqHjgqTjg6vjgpLntbHlkIjjgZfjgabooajnpLogKi99XG4gICAgICAgICAgICB7bWVyZ2VkRmlsZXMubWFwKCh7IHR5cGUsIGZpbGUgfSkgPT4ge1xuICAgICAgICAgICAgICBpZiAodHlwZSA9PT0gJ3BhcmVudCcpIHtcbiAgICAgICAgICAgICAgICAvLyDopqrjg4njgq3jg6Xjg6Hjg7Pjg4jvvIjlgIvliKXlh6bnkIbvvIlcbiAgICAgICAgICAgICAgICBjb25zdCBpc0V4cGFuZGVkID0gZXhwYW5kZWRQYXJlbnRzLmhhcyhmaWxlLmltYWdlX2lkKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZHJlbiA9IGNoaWxkUGFnZXNbZmlsZS5pbWFnZV9pZF0gfHwgW107XG4gICAgICAgICAgICAgICAgY29uc3QgcHJvZ3Jlc3MgPSBnZXRQYXJlbnRQcm9ncmVzcyhmaWxlLmltYWdlX2lkKTtcbiAgICAgICAgICAgICAgICBjb25zdCBvdmVyYWxsU3RhdHVzID0gZ2V0UGFyZW50T3ZlcmFsbFN0YXR1cyhmaWxlLmltYWdlX2lkKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgPGRpdiBrZXk9e2ZpbGUuaW1hZ2VfaWR9IGNsYXNzTmFtZT1cImJvcmRlciBib3JkZXItZ3JheS0yMDAgcm91bmRlZC1sZ1wiPlxuICAgICAgICAgICAgICAgICAgICB7Lyog6Kaq44OJ44Kt44Ol44Oh44Oz44OI6KGMICovfVxuICAgICAgICAgICAgICAgICAgICA8ZGl2IFxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIHAtNCBjdXJzb3ItcG9pbnRlciBob3ZlcjpiZy1ncmF5LTUwXCJcbiAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB0b2dnbGVQYXJlbnRFeHBhbnNpb24oZmlsZS5pbWFnZV9pZCl9XG4gICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICB7Lyog44Ki44Kk44Kz44Oz44Ko44Oq44KiOiDlm7rlrprluYUgKi99XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LTEyIGZsZXgtc2hyaW5rLTAgZmxleCBpdGVtcy1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIHsvKiDlsZXplosv5oqY44KK44Gf44Gf44G/44Ki44Kk44Kz44OzICovfVxuICAgICAgICAgICAgICAgICAgICAgICAgPHN2ZyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIFxuICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2BoLTQgdy00IG1yLTEgdHJhbnNmb3JtIHRyYW5zaXRpb24tdHJhbnNmb3JtICR7aXNFeHBhbmRlZCA/ICdyb3RhdGUtOTAnIDogJyd9YH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsbD1cIm5vbmVcIiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdmlld0JveD1cIjAgMCAyNCAyNFwiIFxuICAgICAgICAgICAgICAgICAgICAgICAgICBzdHJva2U9XCJjdXJyZW50Q29sb3JcIlxuICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8cGF0aCBzdHJva2VMaW5lY2FwPVwicm91bmRcIiBzdHJva2VMaW5lam9pbj1cInJvdW5kXCIgc3Ryb2tlV2lkdGg9ezJ9IGQ9XCJNOSA1bDcgNy03IDdcIiAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIHsvKiDjg5XjgqHjgqTjg6vjgqLjgqTjgrPjg7MgKi99XG4gICAgICAgICAgICAgICAgICAgICAgICA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBjbGFzc05hbWU9XCJoLTUgdy01IHRleHQtcmVkLTUwMFwiIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBmaWxsPVwiY3VycmVudENvbG9yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxwYXRoIGZpbGxSdWxlPVwiZXZlbm9kZFwiIGQ9XCJNNCA0YTIgMiAwIDAxMi0yaDQuNTg2QTIgMiAwIDAxMTIgMi41ODZMMTUuNDE0IDZBMiAyIDAgMDExNiA3LjQxNFYxNmEyIDIgMCAwMS0yIDJINmEyIDIgMCAwMS0yLTJWNHpcIiBjbGlwUnVsZT1cImV2ZW5vZGRcIiAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgey8qIOODleOCoeOCpOODq+WQjeOBqOaDheWgsSAqL31cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgtMSBtaW4tdy0wXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZvbnQtbWVkaXVtIHRleHQtZ3JheS05MDBcIj57ZmlsZS5uYW1lfTwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtZ3JheS01MDBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAg5YCL5Yil5Yem55CGIC0ge2ZpbGUudG90YWxQYWdlc33jg5rjg7zjgrggKHtwcm9ncmVzcy5jb21wbGV0ZWR9L3twcm9ncmVzcy50b3RhbH0g5a6M5LqGKVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB7Lyog44Ki44OD44OX44Ot44O844OJ5pel5pmCICovfVxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctNDAgZmxleC1zaHJpbmstMCB0ZXh0LXNtIHRleHQtZ3JheS01MDBcIj5cbiAgICAgICAgICAgICAgICAgICAgICB7Zm9ybWF0RGF0ZVRpbWVKU1QoZmlsZS51cGxvYWRUaW1lKX1cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB7Lyog5YWo5L2T44K544OG44O844K/44K5ICovfVxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctMjQgZmxleC1zaHJpbmstMFwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxTdGF0dXNCYWRnZSBzdGF0dXM9e292ZXJhbGxTdGF0dXN9IC8+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgey8qIOeiuuiqjea4iOOBv++8iOimquOBr+ihqOekuuOBl+OBquOBhO+8iSAqL31cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LTE2IGZsZXgtc2hyaW5rLTAgZmxleCBqdXN0aWZ5LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtZ3JheS0zMDBcIj4tPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHsvKiDmk43kvZzjg5zjgr/jg7PvvIjnqbrnmb3jgafjgrnjg5rjg7zjgrnnorrkv53vvIkgKi99XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1zbSB3LTIwIGZsZXgtc2hyaW5rLTBcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNDAwXCI+LTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB7Lyog5YmK6Zmk44Oc44K/44OzICovfVxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctOCBmbGV4LXNocmluay0wIGZsZXgganVzdGlmeS1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBoYW5kbGVEZWxldGVDbGljayhmaWxlLmltYWdlX2lkLCBmaWxlLm5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQtZ3JheS00MDAgaG92ZXI6dGV4dC1ncmF5LTYwMFwiXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT1cIuWJiumZpO+8iOWFqOODmuODvOOCuOWJiumZpO+8iVwiXG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgY2xhc3NOYW1lPVwiaC01IHctNVwiIGZpbGw9XCJub25lXCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8cGF0aCBzdHJva2VMaW5lY2FwPVwicm91bmRcIiBzdHJva2VMaW5lam9pbj1cInJvdW5kXCIgc3Ryb2tlV2lkdGg9ezJ9IGQ9XCJNMTkgN2wtLjg2NyAxMi4xNDJBMiAyIDAgMDExNi4xMzggMjFINy44NjJhMiAyIDAgMDEtMS45OTUtMS44NThMNSA3bTUgNHY2bTQtNnY2bTEtMTBWNGExIDEgMCAwMC0xLTFoLTRhMSAxIDAgMDAtMSAxdjNNNCA3aDE2XCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICB7Lyog5a2Q44Oa44O844K45LiA6KanICovfVxuICAgICAgICAgICAgICAgICAge2lzRXhwYW5kZWQgJiYgY2hpbGRyZW4ubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYm9yZGVyLXQgYm9yZGVyLWdyYXktMTAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAge2NoaWxkcmVuLm1hcCgoY2hpbGRGaWxlKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGtleT17Y2hpbGRGaWxlLmltYWdlX2lkfSBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBwLTQgcGwtMTIgaG92ZXI6YmctZ3JheS01MFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICB7Lyog44Oa44O844K444Ki44Kk44Kz44OzICovfVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBjbGFzc05hbWU9XCJoLTQgdy00IG1yLTIgdGV4dC1ibHVlLTUwMFwiIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBmaWxsPVwiY3VycmVudENvbG9yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHBhdGggZmlsbFJ1bGU9XCJldmVub2RkXCIgZD1cIk00IDNhMiAyIDAgMDAtMiAydjEwYTIgMiAwIDAwMiAyaDEyYTIgMiAwIDAwMi0yVjVhMiAyIDAgMDAtMi0ySDR6bTEyIDEySDRsNC04IDMgNiAyLTQgMyA2elwiIGNsaXBSdWxlPVwiZXZlbm9kZFwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgey8qIOODmuODvOOCuOaDheWgsSAqL31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTEgbWluLXctMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LW1lZGl1bSB0ZXh0LWdyYXktNzAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7Y2hpbGRGaWxlLm5hbWV9ICjjg5rjg7zjgrgge2NoaWxkRmlsZS5wYWdlTnVtYmVyfS97Y2hpbGRGaWxlLnRvdGFsUGFnZXN9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHsvKiDjgqLjg4Pjg5fjg63jg7zjg4nml6XmmYIgKi99XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidy00MCBmbGV4LXNocmluay0wIHRleHQtc20gdGV4dC1ncmF5LTUwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtmb3JtYXREYXRlVGltZUpTVChjaGlsZEZpbGUudXBsb2FkVGltZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgey8qIOOCueODhuODvOOCv+OCuSAqL31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LTI0IGZsZXgtc2hyaW5rLTBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8U3RhdHVzQmFkZ2Ugc3RhdHVzPXtjaGlsZEZpbGUuc3RhdHVzfSAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHsvKiDnorroqo3muIjjgb8gKi99XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidy0xNiBmbGV4LXNocmluay0wIGZsZXgganVzdGlmeS1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7Y2hpbGRGaWxlLnZlcmlmaWNhdGlvbkNvbXBsZXRlZCA/IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzdmcgY2xhc3NOYW1lPVwidy01IGgtNSB0ZXh0LWdyZWVuLTUwMFwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIiB2aWV3Qm94PVwiMCAwIDIwIDIwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxwYXRoIGZpbGxSdWxlPVwiZXZlbm9kZFwiIGQ9XCJNMTAgMThhOCA4IDAgMTAwLTE2IDggOCAwIDAwMCAxNnptMy43MDctOS4yOTNhMSAxIDAgMDAtMS40MTQtMS40MTRMOSAxMC41ODYgNy43MDcgOS4yOTNhMSAxIDAgMDAtMS40MTQgMS40MTRsMiAyYTEgMSAwIDAwMS40MTQgMGw0LTR6XCIgY2xpcFJ1bGU9XCJldmVub2RkXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMzAwXCI+LTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHsvKiDmk43kvZzjg5zjgr/jg7MgKi99XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1zbSB3LTIwIGZsZXgtc2hyaW5rLTBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7Y2hpbGRGaWxlLnN0YXR1cyA9PT0gJ2NvbXBsZXRlZCcgPyAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBoYW5kbGVWaWV3UmVzdWx0KGNoaWxkRmlsZS5pbWFnZV9pZCl9IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ0ZXh0LWJsdWUtNjAwIGhvdmVyOnRleHQtYmx1ZS05MDBcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICDntZDmnpzooajnpLpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNDAwXCI+5Yem55CG5b6F44GhPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgey8qIOWJiumZpOODnOOCv+ODs++8iOWtkOODmuODvOOCuOOBr+WJiumZpOS4jeWPr++8iSAqL31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LTggZmxleC1zaHJpbmstMFwiPjwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyDpgJrluLjjg5XjgqHjgqTjg6vvvIjntbHlkIjlh6bnkIbjg7vml6LlrZjjg4fjg7zjgr/vvIlcbiAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgPGRpdiBrZXk9e2ZpbGUuaW1hZ2VfaWR9IGNsYXNzTmFtZT1cImJvcmRlciBib3JkZXItZ3JheS0yMDAgcm91bmRlZC1sZyBwLTRcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgIHsvKiDjgqLjgqTjgrPjg7Pjgqjjg6rjgqI6IOWbuuWumuW5hSAqL31cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctMTIgZmxleC1zaHJpbmstMCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgey8qIOODleOCoeOCpOODq+OCouOCpOOCs+ODsyAqL31cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIGNsYXNzTmFtZT17YGgtNSB3LTUgJHtmaWxlLm5hbWUudG9Mb3dlckNhc2UoKS5lbmRzV2l0aCgnLnBkZicpID8gJ3RleHQtcmVkLTUwMCcgOiAndGV4dC1ibHVlLTUwMCd9YH0gdmlld0JveD1cIjAgMCAyMCAyMFwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAge2ZpbGUubmFtZS50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKCcucGRmJykgPyAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHBhdGggZmlsbFJ1bGU9XCJldmVub2RkXCIgZD1cIk00IDRhMiAyIDAgMDEyLTJoNC41ODZBMiAyIDAgMDExMiAyLjU4NkwxNS40MTQgNkEyIDIgMCAwMTE2IDcuNDE0VjE2YTIgMiAwIDAxLTIgMkg2YTIgMiAwIDAxLTItMlY0elwiIGNsaXBSdWxlPVwiZXZlbm9kZFwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHBhdGggZmlsbFJ1bGU9XCJldmVub2RkXCIgZD1cIk00IDNhMiAyIDAgMDAtMiAydjEwYTIgMiAwIDAwMiAyaDEyYTIgMiAwIDAwMi0yVjVhMiAyIDAgMDAtMi0ySDR6bTEyIDEySDRsNC04IDMgNiAyLTQgMyA2elwiIGNsaXBSdWxlPVwiZXZlbm9kZFwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICB7Lyog44OV44Kh44Kk44Or5ZCN44Go5Yem55CG5oOF5aCxICovfVxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleC0xIG1pbi13LTBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZm9udC1tZWRpdW0gdGV4dC1ncmF5LTkwMFwiPntmaWxlLm5hbWV9PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC1ncmF5LTUwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICB7ZmlsZS5wYWdlUHJvY2Vzc2luZ01vZGUgPT09ICdjb21iaW5lZCcgPyAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICDntbHlkIjlh6bnkIZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtmaWxlLnRvdGFsUGFnZXMgJiYgZmlsZS50b3RhbFBhZ2VzID4gMSAmJiBgIC0gJHtmaWxlLnRvdGFsUGFnZXN944Oa44O844K4YH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICkgOiBmaWxlLnBhZ2VQcm9jZXNzaW5nTW9kZSA9PT0gJ2luZGl2aWR1YWwnICYmIGZpbGUudG90YWxQYWdlcyA9PT0gMSA/IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3Bhbj4x44Oa44O844K4PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuPi08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICB7Lyog44Ki44OD44OX44Ot44O844OJ5pel5pmCICovfVxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidy00MCBmbGV4LXNocmluay0wIHRleHQtc20gdGV4dC1ncmF5LTUwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAge2Zvcm1hdERhdGVUaW1lSlNUKGZpbGUudXBsb2FkVGltZSl9XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgey8qIOOCueODhuODvOOCv+OCuSAqL31cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctMjQgZmxleC1zaHJpbmstMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPFN0YXR1c0JhZGdlIHN0YXR1cz17ZmlsZS5zdGF0dXN9IC8+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgey8qIOeiuuiqjea4iOOBvyAqL31cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctMTYgZmxleC1zaHJpbmstMCBmbGV4IGp1c3RpZnktY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICB7ZmlsZS52ZXJpZmljYXRpb25Db21wbGV0ZWQgPyAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxzdmcgY2xhc3NOYW1lPVwidy01IGgtNSB0ZXh0LWdyZWVuLTUwMFwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIiB2aWV3Qm94PVwiMCAwIDIwIDIwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHBhdGggZmlsbFJ1bGU9XCJldmVub2RkXCIgZD1cIk0xMCAxOGE4IDggMCAxMDAtMTYgOCA4IDAgMDAwIDE2em0zLjcwNy05LjI5M2ExIDEgMCAwMC0xLjQxNC0xLjQxNEw5IDEwLjU4NiA3LjcwNyA5LjI5M2ExIDEgMCAwMC0xLjQxNCAxLjQxNGwyIDJhMSAxIDAgMDAxLjQxNCAwbDQtNHpcIiBjbGlwUnVsZT1cImV2ZW5vZGRcIiAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtZ3JheS0zMDBcIj4tPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICB7Lyog5pON5L2c44Oc44K/44OzICovfVxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1zbSB3LTIwIGZsZXgtc2hyaW5rLTBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIHtmaWxlLnN0YXR1cyA9PT0gJ2NvbXBsZXRlZCcgPyAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gaGFuZGxlVmlld1Jlc3VsdChmaWxlLmltYWdlX2lkKX0gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidGV4dC1ibHVlLTYwMCBob3Zlcjp0ZXh0LWJsdWUtOTAwXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIOe1kOaenOihqOekulxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtZ3JheS00MDBcIj7lh6bnkIblvoXjgaE8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgIHsvKiDliYrpmaTjg5zjgr/jg7MgKi99XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LTggZmxleC1zaHJpbmstMCBmbGV4IGp1c3RpZnktY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IGhhbmRsZURlbGV0ZUNsaWNrKGZpbGUuaW1hZ2VfaWQsIGZpbGUubmFtZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQtZ3JheS00MDAgaG92ZXI6dGV4dC1ncmF5LTYwMFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwi5YmK6ZmkXCJcbiAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgY2xhc3NOYW1lPVwiaC01IHctNVwiIGZpbGw9XCJub25lXCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxwYXRoIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZUxpbmVqb2luPVwicm91bmRcIiBzdHJva2VXaWR0aD17Mn0gZD1cIk0xOSA3bC0uODY3IDEyLjE0MkEyIDIgMCAwMTE2LjEzOCAyMUg3Ljg2MmEyIDIgMCAwMS0xLjk5NS0xLjg1OEw1IDdtNSA0djZtNC02djZtMS0xMFY0YTEgMSAwIDAwLTEtMWgtNGExIDEgMCAwMC0xIDF2M000IDdoMTZcIiAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8Lz5cbiAgICAgICkgOiAoXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctd2hpdGUgcm91bmRlZC1sZyBwLTYgYm9yZGVyIGJvcmRlci1kYXNoZWQgYm9yZGVyLWdyYXktMzAwIGZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHRleHQtZ3JheS00MDBcIj5cbiAgICAgICAgICA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBjbGFzc05hbWU9XCJoLTEyIHctMTIgbWItMlwiIGZpbGw9XCJub25lXCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiPlxuICAgICAgICAgICAgPHBhdGggc3Ryb2tlTGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlTGluZWpvaW49XCJyb3VuZFwiIHN0cm9rZVdpZHRoPXsyfSBkPVwiTTkgMTJoNm0tNiA0aDZtMiA1SDdhMiAyIDAgMDEtMi0yVjVhMiAyIDAgMDEyLTJoNS41ODZhMSAxIDAgMDEuNzA3LjI5M2w1LjQxNCA1LjQxNGExIDEgMCAwMS4yOTMuNzA3VjE5YTIgMiAwIDAxLTIgMnpcIiAvPlxuICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtY2VudGVyXCI+XG4gICAgICAgICAgICDjg5XjgqHjgqTjg6vjgYzjgYLjgorjgb7jgZvjgpPjgIJQREbjgpLjgqLjg4Pjg5fjg63jg7zjg4njgZfjgabjgY/jgaDjgZXjgYTjgIJcbiAgICAgICAgICA8L3A+XG4gICAgICAgIDwvZGl2PlxuICAgICAgKX1cblxuICAgICAgey8qIOWJiumZpOeiuuiqjeODouODvOODgOODqyAqL31cbiAgICAgIHtkZWxldGVDb25maXJtLnNob3cgJiYgKFxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZpeGVkIGluc2V0LTAgYmctYmxhY2sgYmctb3BhY2l0eS01MCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB6LTUwXCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy13aGl0ZSByb3VuZGVkLWxnIHAtNiBtYXgtdy1tZCB3LWZ1bGwgbXgtNFwiPlxuICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQtbGcgZm9udC1zZW1pYm9sZCBtYi00XCI+55S75YOP44Gu5YmK6ZmkPC9oMz5cbiAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtZ3JheS02MDAgbWItNlwiPlxuICAgICAgICAgICAgICDjgIx7ZGVsZXRlQ29uZmlybS5pbWFnZU5hbWV944CN44KS5YmK6Zmk44GX44G+44GZ44CC44GT44Gu5pON5L2c44Gv5Y+W44KK5raI44Gb44G+44Gb44KT44CCXG4gICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1lbmQgZ2FwLTNcIj5cbiAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldERlbGV0ZUNvbmZpcm0oeyBzaG93OiBmYWxzZSwgaW1hZ2VJZDogJycsIGltYWdlTmFtZTogJycgfSl9XG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicHgtNCBweS0yIHJvdW5kZWQgYmctZ3JheS01MDAgaG92ZXI6YmctZ3JheS02MDAgdGV4dC13aGl0ZVwiXG4gICAgICAgICAgICAgICAgZGlzYWJsZWQ9e2RlbGV0aW5nfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAg44Kt44Oj44Oz44K744OrXG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgb25DbGljaz17aGFuZGxlRGVsZXRlQ29uZmlybX1cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJweC00IHB5LTIgcm91bmRlZCBiZy1yZWQtNTAwIGhvdmVyOmJnLXJlZC02MDAgdGV4dC13aGl0ZVwiXG4gICAgICAgICAgICAgICAgZGlzYWJsZWQ9e2RlbGV0aW5nfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAge2RlbGV0aW5nID8gJ+WJiumZpOS4rS4uLicgOiAn5YmK6ZmkJ31cbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICApfVxuXG4gICAgICB7LyogVG9hc3TpgJrnn6UgKi99XG4gICAgICA8VG9hc3RcbiAgICAgICAgc2hvdz17dG9hc3Quc2hvd31cbiAgICAgICAgbWVzc2FnZT17dG9hc3QubWVzc2FnZX1cbiAgICAgICAgdHlwZT17dG9hc3QudHlwZX1cbiAgICAgICAgb25DbG9zZT17KCkgPT4gc2V0VG9hc3QoeyAuLi50b2FzdCwgc2hvdzogZmFsc2UgfSl9XG4gICAgICAvPlxuICAgIDwvZGl2PlxuICApO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgRmlsZUxpc3Q7XG4iXX0=
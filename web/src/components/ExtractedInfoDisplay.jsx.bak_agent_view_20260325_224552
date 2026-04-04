import React, { useState, useEffect } from 'react';
import { isAgentEnabled } from '../config';
const ExtractedInfoDisplay = ({ extractedInfo, fields, onSave, onHighlightField, onHighlightCell, onUpdateExtractedInfo, onRunAgent, agentStatus = 'idle', onGetTools, activeView = 'extraction', onBackToExtraction, onViewOcr, isOcrEnabled = false, verificationCompleted = false, onVerificationChange, }) => {
    const [editMode, setEditMode] = useState(false);
    const [editedInfo, setEditedInfo] = useState(extractedInfo);
    const [originalInfo, setOriginalInfo] = useState(extractedInfo);
    const [agentSuggestions, setAgentSuggestions] = useState([]);
    const [showToolsModal, setShowToolsModal] = useState(false);
    const [tools, setTools] = useState([]);
    // 外部からのextractedInfoの変更を監視して、編集中でなければ更新
    useEffect(() => {
        if (!editMode) {
            setEditedInfo({ ...extractedInfo });
            setOriginalInfo({ ...extractedInfo });
        }
    }, [extractedInfo, editMode]);
    // ページ読み込み時にツール一覧を取得
    useEffect(() => {
        if (onGetTools) {
            handleShowToolsLoad();
        }
    }, [onGetTools]);
    const handleShowToolsLoad = async () => {
        if (!onGetTools)
            return;
        try {
            const toolsList = await onGetTools();
            setTools(toolsList);
        }
        catch (error) {
            console.error('ツール取得エラー:', error);
        }
    };
    // 編集モードの切り替え
    const toggleEditMode = () => {
        if (editMode) {
            // 編集モードを終了して変更を保存
            // 親コンポーネントに編集後のデータを渡す
            console.log("編集後のデータ:", editedInfo);
            onUpdateExtractedInfo(editedInfo);
            onSave(editedInfo);
        }
        setEditMode(!editMode);
    };
    // エージェント実行
    const handleRunAgent = async () => {
        if (!onRunAgent)
            return;
        try {
            const suggestions = await onRunAgent();
            setAgentSuggestions(suggestions);
        }
        catch (error) {
            console.error('エージェント実行エラー:', error);
        }
    };
    // ツール一覧を表示
    const handleShowTools = () => {
        setShowToolsModal(true);
    };
    // 提案を採用
    const handleAcceptSuggestion = (suggestion) => {
        // 編集モードでない場合は確認ダイアログを表示
        if (!editMode) {
            const confirmed = window.confirm('編集画面に移動して修正を適用しますか？');
            if (!confirmed)
                return;
            setEditMode(true);
        }
        let newInfo = { ...editedInfo };
        // フィールドパスを解析（例: "client_info.address" -> ["client_info", "address"]）
        const fieldPath = suggestion.field.split('.');
        if (fieldPath.length === 1) {
            // トップレベルフィールド
            newInfo[fieldPath[0]] = suggestion.suggested_value;
        }
        else if (fieldPath.length === 2) {
            // ネストされたフィールド（例: client_info.address）
            const [parentField, childField] = fieldPath;
            newInfo[parentField] = {
                ...(newInfo[parentField] || {}),
                [childField]: suggestion.suggested_value
            };
        }
        setEditedInfo(newInfo);
        onUpdateExtractedInfo(newInfo);
        // 採用した提案を削除
        setAgentSuggestions(prev => prev.filter(s => s.field !== suggestion.field));
    };
    // 提案を却下
    const handleRejectSuggestion = (suggestion) => {
        setAgentSuggestions(prev => prev.filter(s => s.field !== suggestion.field));
    };
    // 編集をキャンセルして元に戻す
    const cancelEdit = () => {
        setEditedInfo({ ...originalInfo });
        setEditMode(false);
    };
    // フィールド値の更新
    const updateFieldValue = (fieldName, value) => {
        const newEditedInfo = {
            ...editedInfo,
            [fieldName]: value
        };
        setEditedInfo(newEditedInfo);
        // 即時に親コンポーネントにも通知
        // これにより、編集中のデータがリアルタイムで親コンポーネントに反映される
        onUpdateExtractedInfo(newEditedInfo);
    };
    // マップフィールドの値を更新
    const updateMapFieldValue = (fieldName, subFieldName, value) => {
        const currentMap = editedInfo[fieldName] || {};
        const updatedMap = {
            ...currentMap,
            [subFieldName]: value
        };
        setEditedInfo(prev => ({
            ...prev,
            [fieldName]: updatedMap
        }));
    };
    // リストフィールドのアイテムを更新
    const updateListItem = (fieldName, itemIndex, itemValue) => {
        const currentList = [...(editedInfo[fieldName] || [])];
        currentList[itemIndex] = itemValue;
        setEditedInfo(prev => ({
            ...prev,
            [fieldName]: currentList
        }));
    };
    // リストフィールドのアイテムのプロパティを更新
    const updateListItemProperty = (fieldName, itemIndex, propertyName, value) => {
        const currentList = [...(editedInfo[fieldName] || [])];
        if (!currentList[itemIndex]) {
            currentList[itemIndex] = {};
        }
        currentList[itemIndex] = {
            ...currentList[itemIndex],
            [propertyName]: value
        };
        setEditedInfo(prev => ({
            ...prev,
            [fieldName]: currentList
        }));
    };
    // フィールドの表示
    const renderField = (field) => {
        if (field.type === 'string') {
            return renderStringField(field);
        }
        else if (field.type === 'map' && field.fields) {
            return renderMapField(field);
        }
        else if (field.type === 'list' && field.items) {
            return renderListField(field);
        }
        // デフォルトはシンプルなテキストフィールドとして表示
        else {
            return renderStringField(field);
        }
    };
    // フィールドに対応する修正提案を取得
    const getSuggestionForField = (fieldName) => {
        return agentSuggestions.find(s => s.field === fieldName);
    };
    // 修正提案の表示
    const renderSuggestion = (suggestion) => {
        return (<div className="mt-2 p-3 bg-yellow-50 border border-yellow-300 rounded">
        <div className="text-sm mb-2">
          <div className="font-semibold text-yellow-800 mb-1">
            {suggestion.tool_used && `${suggestion.tool_used}経由で確認済み`}
          </div>
          <div className="mb-1">
            「{suggestion.original_value}」→「{suggestion.suggested_value}」の表記ゆれを検出
          </div>
          <div className="text-gray-700">
            提案値: {suggestion.suggested_value}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleAcceptSuggestion(suggestion)} className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600">
            採用する
          </button>
          <button onClick={() => handleRejectSuggestion(suggestion)} className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400">
            却下
          </button>
        </div>
      </div>);
    };
    // 文字列フィールドの表示
    const renderStringField = (field) => {
        const value = editMode ? editedInfo[field.name] : extractedInfo[field.name];
        const suggestion = getSuggestionForField(field.name);
        return (<div key={field.name} className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-gray-700">
            {field.display_name} {suggestion && <span className="text-yellow-600">⚠</span>}
          </label>
        </div>
        
        {editMode ? (<div className="relative">
            <input type="text" value={value || ''} onChange={(e) => updateFieldValue(field.name, e.target.value)} className="w-full p-2 border border-gray-300 rounded" onFocus={() => onHighlightField(field.name, true)}/>
            <button type="button" onClick={() => onHighlightField(field.name, true)} className="absolute right-2 top-2 text-blue-500 hover:text-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
            </button>
          </div>) : (<div className="p-2 bg-gray-50 border border-gray-200 rounded cursor-pointer hover:bg-gray-100" onClick={() => onHighlightField(field.name, true)}>
            {value || '(抽出されませんでした)'}
          </div>)}
        {suggestion && renderSuggestion(suggestion)}
      </div>);
    };
    // マップフィールドの表示
    const renderMapField = (field) => {
        if (!field.fields)
            return null;
        const mapValue = editMode ? editedInfo[field.name] || {} : extractedInfo[field.name] || {};
        return (<div key={field.name} className="mb-6">
        <h3 className="text-lg font-medium mb-2">{field.display_name}</h3>
        <div className="pl-4 border-l-2 border-gray-200 space-y-3">
          {field.fields.map(subField => {
                const fieldPath = `${field.name}.${subField.name}`;
                const suggestion = getSuggestionForField(fieldPath);
                return (<div key={subField.name} className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    {subField.display_name} {suggestion && <span className="text-yellow-600">⚠</span>}
                  </label>
                </div>
                
                {editMode ? (<div className="relative">
                    <input type="text" value={mapValue[subField.name] || ''} onChange={(e) => updateMapFieldValue(field.name, subField.name, e.target.value)} className="w-full p-2 border border-gray-300 rounded" onFocus={() => onHighlightField(fieldPath, true)}/>
                    <button type="button" onClick={() => onHighlightField(fieldPath, true)} className="absolute right-2 top-2 text-blue-500 hover:text-blue-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                    </button>
                  </div>) : (<div className="p-2 bg-gray-50 border border-gray-200 rounded cursor-pointer hover:bg-gray-100" onClick={() => onHighlightField(fieldPath, true)}>
                    {mapValue[subField.name] || '(抽出されませんでした)'}
                  </div>)}
                {suggestion && renderSuggestion(suggestion)}
              </div>);
            })}
        </div>
      </div>);
    };
    // リストフィールドの表示
    const renderListField = (field) => {
        if (!field.items)
            return null;
        const listData = editMode ? editedInfo[field.name] || [] : extractedInfo[field.name] || [];
        // マップ型のリストの場合
        if (field.items.type === 'map' && field.items.fields) {
            return (<div key={field.name} className="mb-6">
          <h3 className="text-lg font-medium mb-2">{field.display_name}</h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {field.items.fields.map((itemField) => (<th key={itemField.name} scope="col" className={`text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${editMode ? 'px-3 py-2' : 'px-6 py-3'}`}>
                      {itemField.display_name}
                    </th>))}
                  {editMode && (<th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>)}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {listData.map((item, itemIndex) => (<tr key={itemIndex}>
                    {field.items.fields.map(itemField => (<td key={itemField.name} className={editMode ? "px-3 py-2" : "px-6 py-4 whitespace-nowrap"}>
                        {editMode ? (<input type="text" value={item[itemField.name] || ''} onChange={(e) => updateListItemProperty(field.name, itemIndex, itemField.name, e.target.value)} className="w-full p-1 border border-gray-300 rounded" onFocus={() => onHighlightCell(field.name, itemIndex, itemField.name)}/>) : (<div className="text-sm text-gray-900 cursor-pointer hover:bg-blue-50 p-1 rounded" onClick={() => onHighlightCell(field.name, itemIndex, itemField.name)}>
                            {item[itemField.name] || ''}
                          </div>)}
                      </td>))}
                    {editMode && (<td className="px-3 py-2 whitespace-nowrap">
                        <button type="button" onClick={() => {
                            const updatedList = [...listData];
                            updatedList.splice(itemIndex, 1);
                            updateFieldValue(field.name, updatedList);
                        }} className="text-red-600 hover:text-red-900">
                          削除
                        </button>
                      </td>)}
                  </tr>))}
              </tbody>
            </table>
          </div>
          
          {editMode && (<button type="button" onClick={() => {
                        const newItem = {};
                        field.items.fields.forEach(itemField => {
                            newItem[itemField.name] = '';
                        });
                        updateFieldValue(field.name, [...listData, newItem]);
                    }} className="mt-2 text-blue-600 hover:text-blue-800">
              + 行を追加
            </button>)}
        </div>);
        }
        // 単純なリストの場合
        return (<div key={field.name} className="mb-6">
        <h3 className="text-lg font-medium mb-2">{field.display_name}</h3>
        <ul className="list-disc pl-5">
          {listData.map((item, itemIndex) => (<li key={itemIndex} className="mb-2">
              {editMode ? (<input type="text" value={item || ''} onChange={(e) => updateListItem(field.name, itemIndex, e.target.value)} className="w-full p-1 border border-gray-300 rounded"/>) : (<div className="p-1">{item || ''}</div>)}
            </li>))}
        </ul>
        
        {editMode && (<button type="button" onClick={() => {
                    updateFieldValue(field.name, [...listData, '']);
                }} className="mt-2 text-blue-600 hover:text-blue-800">
            + 項目を追加
          </button>)}
      </div>);
    };
    return (<div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="mb-4">
        {activeView === 'ocr' ? (
        /* OCRビュー時: 戻るボタンのみ */
        onBackToExtraction && (<button onClick={onBackToExtraction} className="px-4 py-2 rounded bg-gray-500 hover:bg-gray-600 text-white">
              抽出画面へ戻る
            </button>)) : editMode ? (
        /* 編集モード時 */
        <div className="flex gap-2">
            <button onClick={cancelEdit} className="px-4 py-2 rounded bg-gray-500 hover:bg-gray-600 text-white">
              キャンセル
            </button>
            <button onClick={toggleEditMode} className="px-4 py-2 rounded bg-green-500 hover:bg-green-600 text-white">
              保存
            </button>
          </div>) : (
        /* 抽出ビュー時: 通常のボタン */
        <div className="flex items-center justify-between flex-wrap gap-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={toggleEditMode} className="px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white">
                編集
              </button>
              {isOcrEnabled && onViewOcr && (<button onClick={onViewOcr} className="px-4 py-2 rounded bg-indigo-500 hover:bg-indigo-600 text-white">
                  OCR結果を確認
                </button>)}
              
              {/* 区切り線 */}
              {onRunAgent && isAgentEnabled() && (<>
                  <div className="h-8 w-px bg-gray-300"></div>
                  
                  {/* 高度な機能 */}
                  <button onClick={handleShowTools} className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm">
                    登録ツール一覧
                  </button>
                  <button onClick={handleRunAgent} disabled={agentStatus === 'running'} className={`px-3 py-2 rounded border text-sm ${agentStatus === 'running'
                    ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'border-purple-300 hover:bg-purple-50 text-purple-700'}`}>
                    {agentStatus === 'running' ? '検証中...' : 'エージェントで検証'}
                  </button>
                </>)}
            </div>
            
            {/* 確認完了チェックボックス */}
            <div className="flex items-center gap-2 whitespace-nowrap">
              <input type="checkbox" id="verification-complete" checked={verificationCompleted} onChange={(e) => onVerificationChange?.(e.target.checked)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"/>
              <label htmlFor="verification-complete" className="text-sm text-gray-700 cursor-pointer">
                確認完了
              </label>
            </div>
          </div>)}
      </div>
      
      <div className="space-y-4">
        {fields.map(field => renderField(field))}
      </div>

      {showToolsModal && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">登録ツール一覧</h2>
              <button onClick={() => setShowToolsModal(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {tools.map((tool, index) => (<div key={index} className="p-3 border border-gray-200 rounded">
                  <div className="font-semibold text-gray-800">{tool.name}</div>
                  <div className="text-sm text-gray-600 mt-1">{tool.description}</div>
                </div>))}
            </div>
          </div>
        </div>)}
    </div>);
};
export default ExtractedInfoDisplay;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRXh0cmFjdGVkSW5mb0Rpc3BsYXkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJFeHRyYWN0ZWRJbmZvRGlzcGxheS50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxLQUFLLEVBQUUsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBR25ELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFvQjNDLE1BQU0sb0JBQW9CLEdBQXdDLENBQUMsRUFDakUsYUFBYSxFQUNiLE1BQU0sRUFDTixNQUFNLEVBQ04sZ0JBQWdCLEVBQ2hCLGVBQWUsRUFDZixxQkFBcUIsRUFDckIsVUFBVSxFQUNWLFdBQVcsR0FBRyxNQUFNLEVBQ3BCLFVBQVUsRUFDVixVQUFVLEdBQUcsWUFBWSxFQUN6QixrQkFBa0IsRUFDbEIsU0FBUyxFQUNULFlBQVksR0FBRyxLQUFLLEVBQ3BCLHFCQUFxQixHQUFHLEtBQUssRUFDN0Isb0JBQW9CLEdBQ3JCLEVBQUUsRUFBRTtJQUNILE1BQU0sQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2hELE1BQU0sQ0FBQyxVQUFVLEVBQUUsYUFBYSxDQUFDLEdBQUcsUUFBUSxDQUFzQixhQUFhLENBQUMsQ0FBQztJQUNqRixNQUFNLENBQUMsWUFBWSxFQUFFLGVBQWUsQ0FBQyxHQUFHLFFBQVEsQ0FBc0IsYUFBYSxDQUFDLENBQUM7SUFDckYsTUFBTSxDQUFDLGdCQUFnQixFQUFFLG1CQUFtQixDQUFDLEdBQUcsUUFBUSxDQUFlLEVBQUUsQ0FBQyxDQUFDO0lBQzNFLE1BQU0sQ0FBQyxjQUFjLEVBQUUsaUJBQWlCLENBQUMsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDNUQsTUFBTSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsR0FBRyxRQUFRLENBQVMsRUFBRSxDQUFDLENBQUM7SUFFL0Msd0NBQXdDO0lBQ3hD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RyxDQUFDLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FDMUIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsU0FBUyxDQUFDLG9DQUFvQyxDQUM3RDtrQkFBQSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxDQUM3RDtrQkFBQSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsNEJBQTRCLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsR0FBRyxDQUNyRTtnQkFBQSxFQUFFLEdBQUcsQ0FBQyxDQUNQLENBQUMsQ0FDSjtZQUFBLEVBQUUsR0FBRyxDQUNQO1VBQUEsRUFBRSxHQUFHLENBQ1A7UUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUNQLENBQ0g7SUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUNQLENBQUM7QUFDSixDQUFDLENBQUM7QUFFRixlQUFlLG9CQUFvQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFJlYWN0LCB7IHVzZVN0YXRlLCB1c2VFZmZlY3QgfSBmcm9tICdyZWFjdCc7XG5pbXBvcnQgeyBGaWVsZCB9IGZyb20gJy4uL3R5cGVzL2FwcC1zY2hlbWEnO1xuaW1wb3J0IHsgU3VnZ2VzdGlvbiwgVG9vbCB9IGZyb20gJy4uL3R5cGVzL2FnZW50JztcbmltcG9ydCB7IGlzQWdlbnRFbmFibGVkIH0gZnJvbSAnLi4vY29uZmlnJztcblxuaW50ZXJmYWNlIEV4dHJhY3RlZEluZm9EaXNwbGF5UHJvcHMge1xuICBleHRyYWN0ZWRJbmZvOiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xuICBmaWVsZHM6IEZpZWxkW107XG4gIG9uU2F2ZTogKGRhdGE/OiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiB2b2lkO1xuICBvbkhpZ2hsaWdodEZpZWxkOiAoZmllbGQ6IHN0cmluZywgc3RheU9uRXh0cmFjdGlvblZpZXc/OiBib29sZWFuKSA9PiB2b2lkO1xuICBvbkhpZ2hsaWdodENlbGw6IChmaWVsZE5hbWU6IHN0cmluZywgcm93SW5kZXg6IG51bWJlciwgY29sdW1uTmFtZTogc3RyaW5nKSA9PiB2b2lkO1xuICBvblVwZGF0ZUV4dHJhY3RlZEluZm86IChpbmZvOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiB2b2lkO1xuICBvblJ1bkFnZW50PzogKCkgPT4gUHJvbWlzZTxTdWdnZXN0aW9uW10+O1xuICBhZ2VudFN0YXR1cz86ICdpZGxlJyB8ICdydW5uaW5nJyB8ICdjb21wbGV0ZWQnO1xuICBvbkdldFRvb2xzPzogKCkgPT4gUHJvbWlzZTxUb29sW10+O1xuICBhY3RpdmVWaWV3PzogJ29jcicgfCAnZXh0cmFjdGlvbic7XG4gIG9uQmFja1RvRXh0cmFjdGlvbj86ICgpID0+IHZvaWQ7XG4gIG9uVmlld09jcj86ICgpID0+IHZvaWQ7XG4gIGlzT2NyRW5hYmxlZD86IGJvb2xlYW47XG4gIHZlcmlmaWNhdGlvbkNvbXBsZXRlZD86IGJvb2xlYW47XG4gIG9uVmVyaWZpY2F0aW9uQ2hhbmdlPzogKGNvbXBsZXRlZDogYm9vbGVhbikgPT4gdm9pZDtcbn1cblxuY29uc3QgRXh0cmFjdGVkSW5mb0Rpc3BsYXk6IFJlYWN0LkZDPEV4dHJhY3RlZEluZm9EaXNwbGF5UHJvcHM+ID0gKHtcbiAgZXh0cmFjdGVkSW5mbyxcbiAgZmllbGRzLFxuICBvblNhdmUsXG4gIG9uSGlnaGxpZ2h0RmllbGQsXG4gIG9uSGlnaGxpZ2h0Q2VsbCxcbiAgb25VcGRhdGVFeHRyYWN0ZWRJbmZvLFxuICBvblJ1bkFnZW50LFxuICBhZ2VudFN0YXR1cyA9ICdpZGxlJyxcbiAgb25HZXRUb29scyxcbiAgYWN0aXZlVmlldyA9ICdleHRyYWN0aW9uJyxcbiAgb25CYWNrVG9FeHRyYWN0aW9uLFxuICBvblZpZXdPY3IsXG4gIGlzT2NyRW5hYmxlZCA9IGZhbHNlLFxuICB2ZXJpZmljYXRpb25Db21wbGV0ZWQgPSBmYWxzZSxcbiAgb25WZXJpZmljYXRpb25DaGFuZ2UsXG59KSA9PiB7XG4gIGNvbnN0IFtlZGl0TW9kZSwgc2V0RWRpdE1vZGVdID0gdXNlU3RhdGUoZmFsc2UpO1xuICBjb25zdCBbZWRpdGVkSW5mbywgc2V0RWRpdGVkSW5mb10gPSB1c2VTdGF0ZTxSZWNvcmQ8c3RyaW5nLCBhbnk+PihleHRyYWN0ZWRJbmZvKTtcbiAgY29uc3QgW29yaWdpbmFsSW5mbywgc2V0T3JpZ2luYWxJbmZvXSA9IHVzZVN0YXRlPFJlY29yZDxzdHJpbmcsIGFueT4+KGV4dHJhY3RlZEluZm8pO1xuICBjb25zdCBbYWdlbnRTdWdnZXN0aW9ucywgc2V0QWdlbnRTdWdnZXN0aW9uc10gPSB1c2VTdGF0ZTxTdWdnZXN0aW9uW10+KFtdKTtcbiAgY29uc3QgW3Nob3dUb29sc01vZGFsLCBzZXRTaG93VG9vbHNNb2RhbF0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFt0b29scywgc2V0VG9vbHNdID0gdXNlU3RhdGU8VG9vbFtdPihbXSk7XG5cbiAgLy8g5aSW6YOo44GL44KJ44GuZXh0cmFjdGVkSW5mb+OBruWkieabtOOCkuebo+imluOBl+OBpuOAgee3qOmbhuS4reOBp+OBquOBkeOCjOOBsOabtOaWsFxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghZWRpdE1vZGUpIHtcbiAgICAgIHNldEVkaXRlZEluZm8oey4uLmV4dHJhY3RlZEluZm99KTtcbiAgICAgIHNldE9yaWdpbmFsSW5mbyh7Li4uZXh0cmFjdGVkSW5mb30pO1xuICAgIH1cbiAgfSwgW2V4dHJhY3RlZEluZm8sIGVkaXRNb2RlXSk7XG5cbiAgLy8g44Oa44O844K46Kqt44G/6L6844G/5pmC44Gr44OE44O844Or5LiA6Kan44KS5Y+W5b6XXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKG9uR2V0VG9vbHMpIHtcbiAgICAgIGhhbmRsZVNob3dUb29sc0xvYWQoKTtcbiAgICB9XG4gIH0sIFtvbkdldFRvb2xzXSk7XG5cbiAgY29uc3QgaGFuZGxlU2hvd1Rvb2xzTG9hZCA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAoIW9uR2V0VG9vbHMpIHJldHVybjtcbiAgICBcbiAgICB0cnkge1xuICAgICAgY29uc3QgdG9vbHNMaXN0ID0gYXdhaXQgb25HZXRUb29scygpO1xuICAgICAgc2V0VG9vbHModG9vbHNMaXN0KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcign44OE44O844Or5Y+W5b6X44Ko44Op44O8OicsIGVycm9yKTtcbiAgICB9XG4gIH07XG5cbiAgLy8g57eo6ZuG44Oi44O844OJ44Gu5YiH44KK5pu/44GIXG4gIGNvbnN0IHRvZ2dsZUVkaXRNb2RlID0gKCkgPT4ge1xuICAgIGlmIChlZGl0TW9kZSkge1xuICAgICAgLy8g57eo6ZuG44Oi44O844OJ44KS57WC5LqG44GX44Gm5aSJ5pu044KS5L+d5a2YXG4gICAgICAvLyDopqrjgrPjg7Pjg53jg7zjg43jg7Pjg4jjgavnt6jpm4blvozjga7jg4fjg7zjgr/jgpLmuKHjgZlcbiAgICAgIGNvbnNvbGUubG9nKFwi57eo6ZuG5b6M44Gu44OH44O844K/OlwiLCBlZGl0ZWRJbmZvKTtcbiAgICAgIG9uVXBkYXRlRXh0cmFjdGVkSW5mbyhlZGl0ZWRJbmZvKTtcbiAgICAgIG9uU2F2ZShlZGl0ZWRJbmZvKTtcbiAgICB9XG4gICAgc2V0RWRpdE1vZGUoIWVkaXRNb2RlKTtcbiAgfTtcblxuICAvLyDjgqjjg7zjgrjjgqfjg7Pjg4jlrp/ooYxcbiAgY29uc3QgaGFuZGxlUnVuQWdlbnQgPSBhc3luYyAoKSA9PiB7XG4gICAgaWYgKCFvblJ1bkFnZW50KSByZXR1cm47XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN1Z2dlc3Rpb25zID0gYXdhaXQgb25SdW5BZ2VudCgpO1xuICAgICAgc2V0QWdlbnRTdWdnZXN0aW9ucyhzdWdnZXN0aW9ucyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ+OCqOODvOOCuOOCp+ODs+ODiOWun+ihjOOCqOODqeODvDonLCBlcnJvcik7XG4gICAgfVxuICB9O1xuXG4gIC8vIOODhOODvOODq+S4gOimp+OCkuihqOekulxuICBjb25zdCBoYW5kbGVTaG93VG9vbHMgPSAoKSA9PiB7XG4gICAgc2V0U2hvd1Rvb2xzTW9kYWwodHJ1ZSk7XG4gIH07XG5cbiAgLy8g5o+Q5qGI44KS5o6h55SoXG4gIGNvbnN0IGhhbmRsZUFjY2VwdFN1Z2dlc3Rpb24gPSAoc3VnZ2VzdGlvbjogU3VnZ2VzdGlvbikgPT4ge1xuICAgIC8vIOe3qOmbhuODouODvOODieOBp+OBquOBhOWgtOWQiOOBr+eiuuiqjeODgOOCpOOCouODreOCsOOCkuihqOekulxuICAgIGlmICghZWRpdE1vZGUpIHtcbiAgICAgIGNvbnN0IGNvbmZpcm1lZCA9IHdpbmRvdy5jb25maXJtKCfnt6jpm4bnlLvpnaLjgavnp7vli5XjgZfjgabkv67mraPjgpLpgannlKjjgZfjgb7jgZnjgYvvvJ8nKTtcbiAgICAgIGlmICghY29uZmlybWVkKSByZXR1cm47XG4gICAgICBzZXRFZGl0TW9kZSh0cnVlKTtcbiAgICB9XG4gICAgXG4gICAgbGV0IG5ld0luZm8gPSB7IC4uLmVkaXRlZEluZm8gfTtcbiAgICBcbiAgICAvLyDjg5XjgqPjg7zjg6vjg4njg5HjgrnjgpLop6PmnpDvvIjkvos6IFwiY2xpZW50X2luZm8uYWRkcmVzc1wiIC0+IFtcImNsaWVudF9pbmZvXCIsIFwiYWRkcmVzc1wiXe+8iVxuICAgIGNvbnN0IGZpZWxkUGF0aCA9IHN1Z2dlc3Rpb24uZmllbGQuc3BsaXQoJy4nKTtcbiAgICBcbiAgICBpZiAoZmllbGRQYXRoLmxlbmd0aCA9PT0gMSkge1xuICAgICAgLy8g44OI44OD44OX44Os44OZ44Or44OV44Kj44O844Or44OJXG4gICAgICBuZXdJbmZvW2ZpZWxkUGF0aFswXV0gPSBzdWdnZXN0aW9uLnN1Z2dlc3RlZF92YWx1ZTtcbiAgICB9IGVsc2UgaWYgKGZpZWxkUGF0aC5sZW5ndGggPT09IDIpIHtcbiAgICAgIC8vIOODjeOCueODiOOBleOCjOOBn+ODleOCo+ODvOODq+ODie+8iOS+izogY2xpZW50X2luZm8uYWRkcmVzc++8iVxuICAgICAgY29uc3QgW3BhcmVudEZpZWxkLCBjaGlsZEZpZWxkXSA9IGZpZWxkUGF0aDtcbiAgICAgIG5ld0luZm9bcGFyZW50RmllbGRdID0ge1xuICAgICAgICAuLi4obmV3SW5mb1twYXJlbnRGaWVsZF0gfHwge30pLFxuICAgICAgICBbY2hpbGRGaWVsZF06IHN1Z2dlc3Rpb24uc3VnZ2VzdGVkX3ZhbHVlXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICBzZXRFZGl0ZWRJbmZvKG5ld0luZm8pO1xuICAgIG9uVXBkYXRlRXh0cmFjdGVkSW5mbyhuZXdJbmZvKTtcbiAgICBcbiAgICAvLyDmjqHnlKjjgZfjgZ/mj5DmoYjjgpLliYrpmaRcbiAgICBzZXRBZ2VudFN1Z2dlc3Rpb25zKHByZXYgPT4gXG4gICAgICBwcmV2LmZpbHRlcihzID0+IHMuZmllbGQgIT09IHN1Z2dlc3Rpb24uZmllbGQpXG4gICAgKTtcbiAgfTtcblxuICAvLyDmj5DmoYjjgpLljbTkuItcbiAgY29uc3QgaGFuZGxlUmVqZWN0U3VnZ2VzdGlvbiA9IChzdWdnZXN0aW9uOiBTdWdnZXN0aW9uKSA9PiB7XG4gICAgc2V0QWdlbnRTdWdnZXN0aW9ucyhwcmV2ID0+IFxuICAgICAgcHJldi5maWx0ZXIocyA9PiBzLmZpZWxkICE9PSBzdWdnZXN0aW9uLmZpZWxkKVxuICAgICk7XG4gIH07XG5cbiAgLy8g57eo6ZuG44KS44Kt44Oj44Oz44K744Or44GX44Gm5YWD44Gr5oi744GZXG4gIGNvbnN0IGNhbmNlbEVkaXQgPSAoKSA9PiB7XG4gICAgc2V0RWRpdGVkSW5mbyh7Li4ub3JpZ2luYWxJbmZvfSk7XG4gICAgc2V0RWRpdE1vZGUoZmFsc2UpO1xuICB9O1xuXG4gIC8vIOODleOCo+ODvOODq+ODieWApOOBruabtOaWsFxuICBjb25zdCB1cGRhdGVGaWVsZFZhbHVlID0gKGZpZWxkTmFtZTogc3RyaW5nLCB2YWx1ZTogYW55KSA9PiB7XG4gICAgY29uc3QgbmV3RWRpdGVkSW5mbyA9IHtcbiAgICAgIC4uLmVkaXRlZEluZm8sXG4gICAgICBbZmllbGROYW1lXTogdmFsdWVcbiAgICB9O1xuICAgIHNldEVkaXRlZEluZm8obmV3RWRpdGVkSW5mbyk7XG4gICAgXG4gICAgLy8g5Y2z5pmC44Gr6Kaq44Kz44Oz44Od44O844ON44Oz44OI44Gr44KC6YCa55+lXG4gICAgLy8g44GT44KM44Gr44KI44KK44CB57eo6ZuG5Lit44Gu44OH44O844K/44GM44Oq44Ki44Or44K/44Kk44Og44Gn6Kaq44Kz44Oz44Od44O844ON44Oz44OI44Gr5Y+N5pig44GV44KM44KLXG4gICAgb25VcGRhdGVFeHRyYWN0ZWRJbmZvKG5ld0VkaXRlZEluZm8pO1xuICB9O1xuXG4gIC8vIOODnuODg+ODl+ODleOCo+ODvOODq+ODieOBruWApOOCkuabtOaWsFxuICBjb25zdCB1cGRhdGVNYXBGaWVsZFZhbHVlID0gKGZpZWxkTmFtZTogc3RyaW5nLCBzdWJGaWVsZE5hbWU6IHN0cmluZywgdmFsdWU6IGFueSkgPT4ge1xuICAgIGNvbnN0IGN1cnJlbnRNYXAgPSBlZGl0ZWRJbmZvW2ZpZWxkTmFtZV0gfHwge307XG4gICAgY29uc3QgdXBkYXRlZE1hcCA9IHtcbiAgICAgIC4uLmN1cnJlbnRNYXAsXG4gICAgICBbc3ViRmllbGROYW1lXTogdmFsdWVcbiAgICB9O1xuICAgIFxuICAgIHNldEVkaXRlZEluZm8ocHJldiA9PiAoe1xuICAgICAgLi4ucHJldixcbiAgICAgIFtmaWVsZE5hbWVdOiB1cGRhdGVkTWFwXG4gICAgfSkpO1xuICB9O1xuXG4gIC8vIOODquOCueODiOODleOCo+ODvOODq+ODieOBruOCouOCpOODhuODoOOCkuabtOaWsFxuICBjb25zdCB1cGRhdGVMaXN0SXRlbSA9IChmaWVsZE5hbWU6IHN0cmluZywgaXRlbUluZGV4OiBudW1iZXIsIGl0ZW1WYWx1ZTogYW55KSA9PiB7XG4gICAgY29uc3QgY3VycmVudExpc3QgPSBbLi4uKGVkaXRlZEluZm9bZmllbGROYW1lXSB8fCBbXSldO1xuICAgIGN1cnJlbnRMaXN0W2l0ZW1JbmRleF0gPSBpdGVtVmFsdWU7XG4gICAgXG4gICAgc2V0RWRpdGVkSW5mbyhwcmV2ID0+ICh7XG4gICAgICAuLi5wcmV2LFxuICAgICAgW2ZpZWxkTmFtZV06IGN1cnJlbnRMaXN0XG4gICAgfSkpO1xuICB9O1xuXG4gIC8vIOODquOCueODiOODleOCo+ODvOODq+ODieOBruOCouOCpOODhuODoOOBruODl+ODreODkeODhuOCo+OCkuabtOaWsFxuICBjb25zdCB1cGRhdGVMaXN0SXRlbVByb3BlcnR5ID0gKGZpZWxkTmFtZTogc3RyaW5nLCBpdGVtSW5kZXg6IG51bWJlciwgcHJvcGVydHlOYW1lOiBzdHJpbmcsIHZhbHVlOiBhbnkpID0+IHtcbiAgICBjb25zdCBjdXJyZW50TGlzdCA9IFsuLi4oZWRpdGVkSW5mb1tmaWVsZE5hbWVdIHx8IFtdKV07XG4gICAgaWYgKCFjdXJyZW50TGlzdFtpdGVtSW5kZXhdKSB7XG4gICAgICBjdXJyZW50TGlzdFtpdGVtSW5kZXhdID0ge307XG4gICAgfVxuICAgIFxuICAgIGN1cnJlbnRMaXN0W2l0ZW1JbmRleF0gPSB7XG4gICAgICAuLi5jdXJyZW50TGlzdFtpdGVtSW5kZXhdLFxuICAgICAgW3Byb3BlcnR5TmFtZV06IHZhbHVlXG4gICAgfTtcbiAgICBcbiAgICBzZXRFZGl0ZWRJbmZvKHByZXYgPT4gKHtcbiAgICAgIC4uLnByZXYsXG4gICAgICBbZmllbGROYW1lXTogY3VycmVudExpc3RcbiAgICB9KSk7XG4gIH07XG5cbiAgLy8g44OV44Kj44O844Or44OJ44Gu6KGo56S6XG4gIGNvbnN0IHJlbmRlckZpZWxkID0gKGZpZWxkOiBGaWVsZCkgPT4ge1xuICAgIGlmIChmaWVsZC50eXBlID09PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIHJlbmRlclN0cmluZ0ZpZWxkKGZpZWxkKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoZmllbGQudHlwZSA9PT0gJ21hcCcgJiYgZmllbGQuZmllbGRzKSB7XG4gICAgICByZXR1cm4gcmVuZGVyTWFwRmllbGQoZmllbGQpO1xuICAgIH1cbiAgICBlbHNlIGlmIChmaWVsZC50eXBlID09PSAnbGlzdCcgJiYgZmllbGQuaXRlbXMpIHtcbiAgICAgIHJldHVybiByZW5kZXJMaXN0RmllbGQoZmllbGQpO1xuICAgIH1cbiAgICAvLyDjg4fjg5Xjgqnjg6vjg4jjga/jgrfjg7Pjg5fjg6vjgarjg4bjgq3jgrnjg4jjg5XjgqPjg7zjg6vjg4njgajjgZfjgabooajnpLpcbiAgICBlbHNlIHtcbiAgICAgIHJldHVybiByZW5kZXJTdHJpbmdGaWVsZChmaWVsZCk7XG4gICAgfVxuICB9O1xuXG4gIC8vIOODleOCo+ODvOODq+ODieOBq+WvvuW/nOOBmeOCi+S/ruato+aPkOahiOOCkuWPluW+l1xuICBjb25zdCBnZXRTdWdnZXN0aW9uRm9yRmllbGQgPSAoZmllbGROYW1lOiBzdHJpbmcpID0+IHtcbiAgICByZXR1cm4gYWdlbnRTdWdnZXN0aW9ucy5maW5kKHMgPT4gcy5maWVsZCA9PT0gZmllbGROYW1lKTtcbiAgfTtcblxuICAvLyDkv67mraPmj5DmoYjjga7ooajnpLpcbiAgY29uc3QgcmVuZGVyU3VnZ2VzdGlvbiA9IChzdWdnZXN0aW9uOiBTdWdnZXN0aW9uKSA9PiB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwibXQtMiBwLTMgYmcteWVsbG93LTUwIGJvcmRlciBib3JkZXIteWVsbG93LTMwMCByb3VuZGVkXCI+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1zbSBtYi0yXCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmb250LXNlbWlib2xkIHRleHQteWVsbG93LTgwMCBtYi0xXCI+XG4gICAgICAgICAgICB7c3VnZ2VzdGlvbi50b29sX3VzZWQgJiYgYCR7c3VnZ2VzdGlvbi50b29sX3VzZWR957WM55Sx44Gn56K66KqN5riI44G/YH1cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1iLTFcIj5cbiAgICAgICAgICAgIOOAjHtzdWdnZXN0aW9uLm9yaWdpbmFsX3ZhbHVlfeOAjeKGkuOAjHtzdWdnZXN0aW9uLnN1Z2dlc3RlZF92YWx1ZX3jgI3jga7ooajoqJjjgobjgozjgpLmpJzlh7pcbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtZ3JheS03MDBcIj5cbiAgICAgICAgICAgIOaPkOahiOWApDoge3N1Z2dlc3Rpb24uc3VnZ2VzdGVkX3ZhbHVlfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGdhcC0yXCI+XG4gICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgb25DbGljaz17KCkgPT4gaGFuZGxlQWNjZXB0U3VnZ2VzdGlvbihzdWdnZXN0aW9uKX1cbiAgICAgICAgICAgIGNsYXNzTmFtZT1cInB4LTMgcHktMSBiZy1ibHVlLTUwMCB0ZXh0LXdoaXRlIHRleHQtc20gcm91bmRlZCBob3ZlcjpiZy1ibHVlLTYwMFwiXG4gICAgICAgICAgPlxuICAgICAgICAgICAg5o6h55So44GZ44KLXG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgb25DbGljaz17KCkgPT4gaGFuZGxlUmVqZWN0U3VnZ2VzdGlvbihzdWdnZXN0aW9uKX1cbiAgICAgICAgICAgIGNsYXNzTmFtZT1cInB4LTMgcHktMSBiZy1ncmF5LTMwMCB0ZXh0LWdyYXktNzAwIHRleHQtc20gcm91bmRlZCBob3ZlcjpiZy1ncmF5LTQwMFwiXG4gICAgICAgICAgPlxuICAgICAgICAgICAg5Y205LiLXG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfTtcblxuICAvLyDmloflrZfliJfjg5XjgqPjg7zjg6vjg4njga7ooajnpLpcbiAgY29uc3QgcmVuZGVyU3RyaW5nRmllbGQgPSAoZmllbGQ6IEZpZWxkKSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBlZGl0TW9kZSA/IGVkaXRlZEluZm9bZmllbGQubmFtZV0gOiBleHRyYWN0ZWRJbmZvW2ZpZWxkLm5hbWVdO1xuICAgIGNvbnN0IHN1Z2dlc3Rpb24gPSBnZXRTdWdnZXN0aW9uRm9yRmllbGQoZmllbGQubmFtZSk7XG4gICAgXG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYga2V5PXtmaWVsZC5uYW1lfSBjbGFzc05hbWU9XCJtYi00XCI+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBqdXN0aWZ5LWJldHdlZW4gaXRlbXMtY2VudGVyIG1iLTFcIj5cbiAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwiYmxvY2sgdGV4dC1zbSBmb250LW1lZGl1bSB0ZXh0LWdyYXktNzAwXCI+XG4gICAgICAgICAgICB7ZmllbGQuZGlzcGxheV9uYW1lfSB7c3VnZ2VzdGlvbiAmJiA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXllbGxvdy02MDBcIj7imqA8L3NwYW4+fVxuICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICBcbiAgICAgICAge2VkaXRNb2RlID8gKFxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicmVsYXRpdmVcIj5cbiAgICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgICB0eXBlPVwidGV4dFwiXG4gICAgICAgICAgICAgIHZhbHVlPXt2YWx1ZSB8fCAnJ31cbiAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiB1cGRhdGVGaWVsZFZhbHVlKGZpZWxkLm5hbWUsIGUudGFyZ2V0LnZhbHVlKX1cbiAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIHAtMiBib3JkZXIgYm9yZGVyLWdyYXktMzAwIHJvdW5kZWRcIlxuICAgICAgICAgICAgICBvbkZvY3VzPXsoKSA9PiBvbkhpZ2hsaWdodEZpZWxkKGZpZWxkLm5hbWUsIHRydWUpfVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IG9uSGlnaGxpZ2h0RmllbGQoZmllbGQubmFtZSwgdHJ1ZSl9XG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cImFic29sdXRlIHJpZ2h0LTIgdG9wLTIgdGV4dC1ibHVlLTUwMCBob3Zlcjp0ZXh0LWJsdWUtNzAwXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgY2xhc3NOYW1lPVwiaC00IHctNFwiIGZpbGw9XCJub25lXCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiPlxuICAgICAgICAgICAgICAgIDxwYXRoIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZUxpbmVqb2luPVwicm91bmRcIiBzdHJva2VXaWR0aD17Mn0gZD1cIk0xNSAxMmEzIDMgMCAxMS02IDAgMyAzIDAgMDE2IDB6XCIgLz5cbiAgICAgICAgICAgICAgICA8cGF0aCBzdHJva2VMaW5lY2FwPVwicm91bmRcIiBzdHJva2VMaW5lam9pbj1cInJvdW5kXCIgc3Ryb2tlV2lkdGg9ezJ9IGQ9XCJNMi40NTggMTJDMy43MzIgNy45NDMgNy41MjMgNSAxMiA1YzQuNDc4IDAgOC4yNjggMi45NDMgOS41NDIgNy0xLjI3NCA0LjA1Ny01LjA2NCA3LTkuNTQyIDctNC40NzcgMC04LjI2OC0yLjk0My05LjU0Mi03elwiIC8+XG4gICAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICkgOiAoXG4gICAgICAgICAgPGRpdiBcbiAgICAgICAgICAgIGNsYXNzTmFtZT1cInAtMiBiZy1ncmF5LTUwIGJvcmRlciBib3JkZXItZ3JheS0yMDAgcm91bmRlZCBjdXJzb3ItcG9pbnRlciBob3ZlcjpiZy1ncmF5LTEwMFwiXG4gICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBvbkhpZ2hsaWdodEZpZWxkKGZpZWxkLm5hbWUsIHRydWUpfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIHt2YWx1ZSB8fCAnKOaKveWHuuOBleOCjOOBvuOBm+OCk+OBp+OBl+OBnyknfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICApfVxuICAgICAgICB7c3VnZ2VzdGlvbiAmJiByZW5kZXJTdWdnZXN0aW9uKHN1Z2dlc3Rpb24pfVxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfTtcblxuICAvLyDjg57jg4Pjg5fjg5XjgqPjg7zjg6vjg4njga7ooajnpLpcbiAgY29uc3QgcmVuZGVyTWFwRmllbGQgPSAoZmllbGQ6IEZpZWxkKSA9PiB7XG4gICAgaWYgKCFmaWVsZC5maWVsZHMpIHJldHVybiBudWxsO1xuICAgIFxuICAgIGNvbnN0IG1hcFZhbHVlID0gZWRpdE1vZGUgPyBlZGl0ZWRJbmZvW2ZpZWxkLm5hbWVdIHx8IHt9IDogZXh0cmFjdGVkSW5mb1tmaWVsZC5uYW1lXSB8fCB7fTtcbiAgICBcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBrZXk9e2ZpZWxkLm5hbWV9IGNsYXNzTmFtZT1cIm1iLTZcIj5cbiAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQtbGcgZm9udC1tZWRpdW0gbWItMlwiPntmaWVsZC5kaXNwbGF5X25hbWV9PC9oMz5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwbC00IGJvcmRlci1sLTIgYm9yZGVyLWdyYXktMjAwIHNwYWNlLXktM1wiPlxuICAgICAgICAgIHtmaWVsZC5maWVsZHMubWFwKHN1YkZpZWxkID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGZpZWxkUGF0aCA9IGAke2ZpZWxkLm5hbWV9LiR7c3ViRmllbGQubmFtZX1gO1xuICAgICAgICAgICAgY29uc3Qgc3VnZ2VzdGlvbiA9IGdldFN1Z2dlc3Rpb25Gb3JGaWVsZChmaWVsZFBhdGgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICA8ZGl2IGtleT17c3ViRmllbGQubmFtZX0gY2xhc3NOYW1lPVwibWItM1wiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBqdXN0aWZ5LWJldHdlZW4gaXRlbXMtY2VudGVyIG1iLTFcIj5cbiAgICAgICAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJibG9jayB0ZXh0LXNtIGZvbnQtbWVkaXVtIHRleHQtZ3JheS03MDBcIj5cbiAgICAgICAgICAgICAgICAgICAge3N1YkZpZWxkLmRpc3BsYXlfbmFtZX0ge3N1Z2dlc3Rpb24gJiYgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC15ZWxsb3ctNjAwXCI+4pqgPC9zcGFuPn1cbiAgICAgICAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAge2VkaXRNb2RlID8gKFxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyZWxhdGl2ZVwiPlxuICAgICAgICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwidGV4dFwiXG4gICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e21hcFZhbHVlW3N1YkZpZWxkLm5hbWVdIHx8ICcnfVxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gdXBkYXRlTWFwRmllbGRWYWx1ZShmaWVsZC5uYW1lLCBzdWJGaWVsZC5uYW1lLCBlLnRhcmdldC52YWx1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIHAtMiBib3JkZXIgYm9yZGVyLWdyYXktMzAwIHJvdW5kZWRcIlxuICAgICAgICAgICAgICAgICAgICAgIG9uRm9jdXM9eygpID0+IG9uSGlnaGxpZ2h0RmllbGQoZmllbGRQYXRoLCB0cnVlKX1cbiAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IG9uSGlnaGxpZ2h0RmllbGQoZmllbGRQYXRoLCB0cnVlKX1cbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJhYnNvbHV0ZSByaWdodC0yIHRvcC0yIHRleHQtYmx1ZS01MDAgaG92ZXI6dGV4dC1ibHVlLTcwMFwiXG4gICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBjbGFzc05hbWU9XCJoLTQgdy00XCIgZmlsbD1cIm5vbmVcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8cGF0aCBzdHJva2VMaW5lY2FwPVwicm91bmRcIiBzdHJva2VMaW5lam9pbj1cInJvdW5kXCIgc3Ryb2tlV2lkdGg9ezJ9IGQ9XCJNMTUgMTJhMyAzIDAgMTEtNiAwIDMgMyAwIDAxNiAwelwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICA8cGF0aCBzdHJva2VMaW5lY2FwPVwicm91bmRcIiBzdHJva2VMaW5lam9pbj1cInJvdW5kXCIgc3Ryb2tlV2lkdGg9ezJ9IGQ9XCJNMi40NTggMTJDMy43MzIgNy45NDMgNy41MjMgNSAxMiA1YzQuNDc4IDAgOC4yNjggMi45NDMgOS41NDIgNy0xLjI3NCA0LjA1Ny01LjA2NCA3LTkuNTQyIDctNC40NzcgMC04LjI2OC0yLjk0My05LjU0Mi03elwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgIDxkaXYgXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInAtMiBiZy1ncmF5LTUwIGJvcmRlciBib3JkZXItZ3JheS0yMDAgcm91bmRlZCBjdXJzb3ItcG9pbnRlciBob3ZlcjpiZy1ncmF5LTEwMFwiXG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IG9uSGlnaGxpZ2h0RmllbGQoZmllbGRQYXRoLCB0cnVlKX1cbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAge21hcFZhbHVlW3N1YkZpZWxkLm5hbWVdIHx8ICco5oq95Ye644GV44KM44G+44Gb44KT44Gn44GX44GfKSd9XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIHtzdWdnZXN0aW9uICYmIHJlbmRlclN1Z2dlc3Rpb24oc3VnZ2VzdGlvbil9XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KX1cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9O1xuXG4gIC8vIOODquOCueODiOODleOCo+ODvOODq+ODieOBruihqOekulxuICBjb25zdCByZW5kZXJMaXN0RmllbGQgPSAoZmllbGQ6IEZpZWxkKSA9PiB7XG4gICAgaWYgKCFmaWVsZC5pdGVtcykgcmV0dXJuIG51bGw7XG4gICAgXG4gICAgY29uc3QgbGlzdERhdGEgPSBlZGl0TW9kZSA/IGVkaXRlZEluZm9bZmllbGQubmFtZV0gfHwgW10gOiBleHRyYWN0ZWRJbmZvW2ZpZWxkLm5hbWVdIHx8IFtdO1xuICAgIFxuICAgIC8vIOODnuODg+ODl+Wei+OBruODquOCueODiOOBruWgtOWQiFxuICAgIGlmIChmaWVsZC5pdGVtcy50eXBlID09PSAnbWFwJyAmJiBmaWVsZC5pdGVtcy5maWVsZHMpIHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxkaXYga2V5PXtmaWVsZC5uYW1lfSBjbGFzc05hbWU9XCJtYi02XCI+XG4gICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQtbGcgZm9udC1tZWRpdW0gbWItMlwiPntmaWVsZC5kaXNwbGF5X25hbWV9PC9oMz5cbiAgICAgICAgICBcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm92ZXJmbG93LXgtYXV0b1wiPlxuICAgICAgICAgICAgPHRhYmxlIGNsYXNzTmFtZT1cIm1pbi13LWZ1bGwgZGl2aWRlLXkgZGl2aWRlLWdyYXktMjAwXCI+XG4gICAgICAgICAgICAgIDx0aGVhZCBjbGFzc05hbWU9XCJiZy1ncmF5LTUwXCI+XG4gICAgICAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgICAge2ZpZWxkLml0ZW1zLmZpZWxkcy5tYXAoKGl0ZW1GaWVsZCkgPT4gKFxuICAgICAgICAgICAgICAgICAgICA8dGhcbiAgICAgICAgICAgICAgICAgICAgICBrZXk9e2l0ZW1GaWVsZC5uYW1lfVxuICAgICAgICAgICAgICAgICAgICAgIHNjb3BlPVwiY29sXCJcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2B0ZXh0LWxlZnQgdGV4dC14cyBmb250LW1lZGl1bSB0ZXh0LWdyYXktNTAwIHVwcGVyY2FzZSB0cmFja2luZy13aWRlciAke2VkaXRNb2RlID8gJ3B4LTMgcHktMicgOiAncHgtNiBweS0zJ31gfVxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAge2l0ZW1GaWVsZC5kaXNwbGF5X25hbWV9XG4gICAgICAgICAgICAgICAgICAgIDwvdGg+XG4gICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICAgIHtlZGl0TW9kZSAmJiAoXG4gICAgICAgICAgICAgICAgICAgIDx0aCBzY29wZT1cImNvbFwiIGNsYXNzTmFtZT1cInB4LTMgcHktMiB0ZXh0LWxlZnQgdGV4dC14cyBmb250LW1lZGl1bSB0ZXh0LWdyYXktNTAwIHVwcGVyY2FzZSB0cmFja2luZy13aWRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgIOaTjeS9nFxuICAgICAgICAgICAgICAgICAgICA8L3RoPlxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICA8L3RoZWFkPlxuICAgICAgICAgICAgICA8dGJvZHkgY2xhc3NOYW1lPVwiYmctd2hpdGUgZGl2aWRlLXkgZGl2aWRlLWdyYXktMjAwXCI+XG4gICAgICAgICAgICAgICAge2xpc3REYXRhLm1hcCgoaXRlbTogYW55LCBpdGVtSW5kZXg6IG51bWJlcikgPT4gKFxuICAgICAgICAgICAgICAgICAgPHRyIGtleT17aXRlbUluZGV4fT5cbiAgICAgICAgICAgICAgICAgICAge2ZpZWxkLml0ZW1zIS5maWVsZHMhLm1hcChpdGVtRmllbGQgPT4gKFxuICAgICAgICAgICAgICAgICAgICAgIDx0ZCBrZXk9e2l0ZW1GaWVsZC5uYW1lfSBjbGFzc05hbWU9e2VkaXRNb2RlID8gXCJweC0zIHB5LTJcIiA6IFwicHgtNiBweS00IHdoaXRlc3BhY2Utbm93cmFwXCJ9PlxuICAgICAgICAgICAgICAgICAgICAgICAge2VkaXRNb2RlID8gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwidGV4dFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e2l0ZW1baXRlbUZpZWxkLm5hbWVdIHx8ICcnfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gdXBkYXRlTGlzdEl0ZW1Qcm9wZXJ0eShmaWVsZC5uYW1lLCBpdGVtSW5kZXgsIGl0ZW1GaWVsZC5uYW1lLCBlLnRhcmdldC52YWx1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIHAtMSBib3JkZXIgYm9yZGVyLWdyYXktMzAwIHJvdW5kZWRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uRm9jdXM9eygpID0+IG9uSGlnaGxpZ2h0Q2VsbChmaWVsZC5uYW1lLCBpdGVtSW5kZXgsIGl0ZW1GaWVsZC5uYW1lKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LWdyYXktOTAwIGN1cnNvci1wb2ludGVyIGhvdmVyOmJnLWJsdWUtNTAgcC0xIHJvdW5kZWRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IG9uSGlnaGxpZ2h0Q2VsbChmaWVsZC5uYW1lLCBpdGVtSW5kZXgsIGl0ZW1GaWVsZC5uYW1lKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtpdGVtW2l0ZW1GaWVsZC5uYW1lXSB8fCAnJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgICAgICB7ZWRpdE1vZGUgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgIDx0ZCBjbGFzc05hbWU9XCJweC0zIHB5LTIgd2hpdGVzcGFjZS1ub3dyYXBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVkTGlzdCA9IFsuLi5saXN0RGF0YV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlZExpc3Quc3BsaWNlKGl0ZW1JbmRleCwgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlRmllbGRWYWx1ZShmaWVsZC5uYW1lLCB1cGRhdGVkTGlzdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQtcmVkLTYwMCBob3Zlcjp0ZXh0LXJlZC05MDBcIlxuICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICDliYrpmaRcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICA8L3Rib2R5PlxuICAgICAgICAgICAgPC90YWJsZT5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICBcbiAgICAgICAgICB7ZWRpdE1vZGUgJiYgKFxuICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5ld0l0ZW06IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgICAgICAgICAgICAgICBmaWVsZC5pdGVtcyEuZmllbGRzIS5mb3JFYWNoKGl0ZW1GaWVsZCA9PiB7XG4gICAgICAgICAgICAgICAgICBuZXdJdGVtW2l0ZW1GaWVsZC5uYW1lXSA9ICcnO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHVwZGF0ZUZpZWxkVmFsdWUoZmllbGQubmFtZSwgWy4uLmxpc3REYXRhLCBuZXdJdGVtXSk7XG4gICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cIm10LTIgdGV4dC1ibHVlLTYwMCBob3Zlcjp0ZXh0LWJsdWUtODAwXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgKyDooYzjgpLov73liqBcbiAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICl9XG4gICAgICAgIDwvZGl2PlxuICAgICAgKTtcbiAgICB9XG4gICAgXG4gICAgLy8g5Y2Y57SU44Gq44Oq44K544OI44Gu5aC05ZCIXG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYga2V5PXtmaWVsZC5uYW1lfSBjbGFzc05hbWU9XCJtYi02XCI+XG4gICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LWxnIGZvbnQtbWVkaXVtIG1iLTJcIj57ZmllbGQuZGlzcGxheV9uYW1lfTwvaDM+XG4gICAgICAgIDx1bCBjbGFzc05hbWU9XCJsaXN0LWRpc2MgcGwtNVwiPlxuICAgICAgICAgIHtsaXN0RGF0YS5tYXAoKGl0ZW06IGFueSwgaXRlbUluZGV4OiBudW1iZXIpID0+IChcbiAgICAgICAgICAgIDxsaSBrZXk9e2l0ZW1JbmRleH0gY2xhc3NOYW1lPVwibWItMlwiPlxuICAgICAgICAgICAgICB7ZWRpdE1vZGUgPyAoXG4gICAgICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgICAgICB0eXBlPVwidGV4dFwiXG4gICAgICAgICAgICAgICAgICB2YWx1ZT17aXRlbSB8fCAnJ31cbiAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gdXBkYXRlTGlzdEl0ZW0oZmllbGQubmFtZSwgaXRlbUluZGV4LCBlLnRhcmdldC52YWx1ZSl9XG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgcC0xIGJvcmRlciBib3JkZXItZ3JheS0zMDAgcm91bmRlZFwiXG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInAtMVwiPntpdGVtIHx8ICcnfTwvZGl2PlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgPC9saT5cbiAgICAgICAgICApKX1cbiAgICAgICAgPC91bD5cbiAgICAgICAgXG4gICAgICAgIHtlZGl0TW9kZSAmJiAoXG4gICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XG4gICAgICAgICAgICAgIHVwZGF0ZUZpZWxkVmFsdWUoZmllbGQubmFtZSwgWy4uLmxpc3REYXRhLCAnJ10pO1xuICAgICAgICAgICAgfX1cbiAgICAgICAgICAgIGNsYXNzTmFtZT1cIm10LTIgdGV4dC1ibHVlLTYwMCBob3Zlcjp0ZXh0LWJsdWUtODAwXCJcbiAgICAgICAgICA+XG4gICAgICAgICAgICArIOmgheebruOCkui/veWKoFxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICApfVxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctd2hpdGUgcm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLWdyYXktMjAwIHAtNFwiPlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJtYi00XCI+XG4gICAgICAgIHthY3RpdmVWaWV3ID09PSAnb2NyJyA/IChcbiAgICAgICAgICAvKiBPQ1Ljg5Pjg6Xjg7zmmYI6IOaIu+OCi+ODnOOCv+ODs+OBruOBvyAqL1xuICAgICAgICAgIG9uQmFja1RvRXh0cmFjdGlvbiAmJiAoXG4gICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgIG9uQ2xpY2s9e29uQmFja1RvRXh0cmFjdGlvbn1cbiAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicHgtNCBweS0yIHJvdW5kZWQgYmctZ3JheS01MDAgaG92ZXI6YmctZ3JheS02MDAgdGV4dC13aGl0ZVwiXG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIOaKveWHuueUu+mdouOBuOaIu+OCi1xuICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgKVxuICAgICAgICApIDogZWRpdE1vZGUgPyAoXG4gICAgICAgICAgLyog57eo6ZuG44Oi44O844OJ5pmCICovXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGdhcC0yXCI+XG4gICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgIG9uQ2xpY2s9e2NhbmNlbEVkaXR9XG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cInB4LTQgcHktMiByb3VuZGVkIGJnLWdyYXktNTAwIGhvdmVyOmJnLWdyYXktNjAwIHRleHQtd2hpdGVcIlxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICDjgq3jg6Pjg7Pjgrvjg6tcbiAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICBvbkNsaWNrPXt0b2dnbGVFZGl0TW9kZX1cbiAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicHgtNCBweS0yIHJvdW5kZWQgYmctZ3JlZW4tNTAwIGhvdmVyOmJnLWdyZWVuLTYwMCB0ZXh0LXdoaXRlXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAg5L+d5a2YXG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKSA6IChcbiAgICAgICAgICAvKiDmir3lh7rjg5Pjg6Xjg7zmmYI6IOmAmuW4uOOBruODnOOCv+ODsyAqL1xuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGZsZXgtd3JhcCBnYXAteS0yXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIGZsZXgtd3JhcFwiPlxuICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgb25DbGljaz17dG9nZ2xlRWRpdE1vZGV9XG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicHgtNCBweS0yIHJvdW5kZWQgYmctYmx1ZS01MDAgaG92ZXI6YmctYmx1ZS02MDAgdGV4dC13aGl0ZVwiXG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICDnt6jpm4ZcbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgIHtpc09jckVuYWJsZWQgJiYgb25WaWV3T2NyICYmIChcbiAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtvblZpZXdPY3J9XG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJweC00IHB5LTIgcm91bmRlZCBiZy1pbmRpZ28tNTAwIGhvdmVyOmJnLWluZGlnby02MDAgdGV4dC13aGl0ZVwiXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgT0NS57WQ5p6c44KS56K66KqNXG4gICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICB7Lyog5Yy65YiH44KK57eaICovfVxuICAgICAgICAgICAgICB7b25SdW5BZ2VudCAmJiBpc0FnZW50RW5hYmxlZCgpICYmIChcbiAgICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJoLTggdy1weCBiZy1ncmF5LTMwMFwiPjwvZGl2PlxuICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICB7Lyog6auY5bqm44Gq5qmf6IO9ICovfVxuICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVTaG93VG9vbHN9XG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInB4LTMgcHktMiByb3VuZGVkIGJvcmRlciBib3JkZXItZ3JheS0zMDAgaG92ZXI6YmctZ3JheS01MCB0ZXh0LWdyYXktNzAwIHRleHQtc21cIlxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICDnmbvpjLLjg4Tjg7zjg6vkuIDopqdcbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVSdW5BZ2VudH1cbiAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e2FnZW50U3RhdHVzID09PSAncnVubmluZyd9XG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17YHB4LTMgcHktMiByb3VuZGVkIGJvcmRlciB0ZXh0LXNtICR7XG4gICAgICAgICAgICAgICAgICAgICAgYWdlbnRTdGF0dXMgPT09ICdydW5uaW5nJ1xuICAgICAgICAgICAgICAgICAgICAgICAgPyAnYm9yZGVyLWdyYXktMzAwIGJnLWdyYXktMTAwIHRleHQtZ3JheS00MDAgY3Vyc29yLW5vdC1hbGxvd2VkJ1xuICAgICAgICAgICAgICAgICAgICAgICAgOiAnYm9yZGVyLXB1cnBsZS0zMDAgaG92ZXI6YmctcHVycGxlLTUwIHRleHQtcHVycGxlLTcwMCdcbiAgICAgICAgICAgICAgICAgICAgfWB9XG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIHthZ2VudFN0YXR1cyA9PT0gJ3J1bm5pbmcnID8gJ+aknOiovOS4rS4uLicgOiAn44Ko44O844K444Kn44Oz44OI44Gn5qSc6Ki8J31cbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvPlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHsvKiDnorroqo3lrozkuobjg4Hjgqfjg4Pjgq/jg5zjg4Pjgq/jgrkgKi99XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHdoaXRlc3BhY2Utbm93cmFwXCI+XG4gICAgICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgICAgIHR5cGU9XCJjaGVja2JveFwiXG4gICAgICAgICAgICAgICAgaWQ9XCJ2ZXJpZmljYXRpb24tY29tcGxldGVcIlxuICAgICAgICAgICAgICAgIGNoZWNrZWQ9e3ZlcmlmaWNhdGlvbkNvbXBsZXRlZH1cbiAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IG9uVmVyaWZpY2F0aW9uQ2hhbmdlPy4oZS50YXJnZXQuY2hlY2tlZCl9XG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy00IGgtNCB0ZXh0LWJsdWUtNjAwIHJvdW5kZWQgZm9jdXM6cmluZy1ibHVlLTUwMFwiXG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgIDxsYWJlbCBodG1sRm9yPVwidmVyaWZpY2F0aW9uLWNvbXBsZXRlXCIgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LWdyYXktNzAwIGN1cnNvci1wb2ludGVyXCI+XG4gICAgICAgICAgICAgICAg56K66KqN5a6M5LqGXG4gICAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKX1cbiAgICAgIDwvZGl2PlxuICAgICAgXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktNFwiPlxuICAgICAgICB7ZmllbGRzLm1hcChmaWVsZCA9PiByZW5kZXJGaWVsZChmaWVsZCkpfVxuICAgICAgPC9kaXY+XG5cbiAgICAgIHtzaG93VG9vbHNNb2RhbCAmJiAoXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZml4ZWQgaW5zZXQtMCBiZy1ibGFjayBiZy1vcGFjaXR5LTUwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHotNTBcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXdoaXRlIHJvdW5kZWQtbGcgcC02IG1heC13LTJ4bCB3LWZ1bGwgbWF4LWgtWzgwdmhdIG92ZXJmbG93LXktYXV0b1wiPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGp1c3RpZnktYmV0d2VlbiBpdGVtcy1jZW50ZXIgbWItNFwiPlxuICAgICAgICAgICAgICA8aDIgY2xhc3NOYW1lPVwidGV4dC14bCBmb250LWJvbGRcIj7nmbvpjLLjg4Tjg7zjg6vkuIDopqc8L2gyPlxuICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2hvd1Rvb2xzTW9kYWwoZmFsc2UpfVxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQtZ3JheS01MDAgaG92ZXI6dGV4dC1ncmF5LTcwMFwiXG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICDinJVcbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0zXCI+XG4gICAgICAgICAgICAgIHt0b29scy5tYXAoKHRvb2wsIGluZGV4KSA9PiAoXG4gICAgICAgICAgICAgICAgPGRpdiBrZXk9e2luZGV4fSBjbGFzc05hbWU9XCJwLTMgYm9yZGVyIGJvcmRlci1ncmF5LTIwMCByb3VuZGVkXCI+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZvbnQtc2VtaWJvbGQgdGV4dC1ncmF5LTgwMFwiPnt0b29sLm5hbWV9PC9kaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC1ncmF5LTYwMCBtdC0xXCI+e3Rvb2wuZGVzY3JpcHRpb259PC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgKX1cbiAgICA8L2Rpdj5cbiAgKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IEV4dHJhY3RlZEluZm9EaXNwbGF5O1xuIl19
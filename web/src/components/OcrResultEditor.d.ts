import React from 'react';
import { OcrResultData } from '../types/ocr';
interface OcrResultEditorProps {
    ocrResults: OcrResultData[];
    selectedIndex: number | null;
    onUpdateOcrResults: (results: OcrResultData[]) => void;
    onStartExtraction: () => void;
    onSelectIndex?: (index: number) => void;
}
declare const OcrResultEditor: React.FC<OcrResultEditorProps>;
export default OcrResultEditor;

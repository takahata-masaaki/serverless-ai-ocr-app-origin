import React from 'react';
import { Field } from '../types/app-schema';
import { Suggestion, Tool } from '../types/agent';
interface ExtractedInfoDisplayProps {
    extractedInfo: Record<string, any>;
    fields: Field[];
    onSave: (data?: Record<string, any>) => void;
    onHighlightField: (field: string, stayOnExtractionView?: boolean) => void;
    onHighlightCell: (fieldName: string, rowIndex: number, columnName: string) => void;
    onUpdateExtractedInfo: (info: Record<string, any>) => void;
    onRunAgent?: () => Promise<Suggestion[]>;
    agentStatus?: 'idle' | 'running' | 'completed';
    onGetTools?: () => Promise<Tool[]>;
    activeView?: 'ocr' | 'extraction';
    onBackToExtraction?: () => void;
    onViewOcr?: () => void;
    isOcrEnabled?: boolean;
    verificationCompleted?: boolean;
    onVerificationChange?: (completed: boolean) => void;
}
declare const ExtractedInfoDisplay: React.FC<ExtractedInfoDisplayProps>;
export default ExtractedInfoDisplay;

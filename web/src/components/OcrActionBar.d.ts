import React from 'react';
interface OcrActionBarProps {
    isProcessing: boolean;
    hasPending: boolean;
    hasFiles: boolean;
    selectedEngine: 'yomitoku_ec2' | 'azure';
    onEngineChange: (engine: 'yomitoku_ec2' | 'azure') => void;
    onStartOcr: () => void;
}
declare const OcrActionBar: React.FC<OcrActionBarProps>;
export default OcrActionBar;

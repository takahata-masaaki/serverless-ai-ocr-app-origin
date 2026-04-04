import React from 'react';
interface ExtractionStatusDisplayProps {
    status: string;
    pollingAttemptCount: number;
    onRetry: () => void;
    onStartExtraction: () => void;
}
declare const ExtractionStatusDisplay: React.FC<ExtractionStatusDisplayProps>;
export default ExtractionStatusDisplay;

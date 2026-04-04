import React from 'react';
import { Suggestion } from '../types/agent';
interface AgentValidationPanelProps {
    suggestions: Suggestion[];
    onAccept: (suggestion: Suggestion) => void;
    onReject: (suggestion: Suggestion) => void;
}
declare const AgentValidationPanel: React.FC<AgentValidationPanelProps>;
export default AgentValidationPanel;

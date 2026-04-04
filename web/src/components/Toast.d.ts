import React from 'react';
interface ToastProps {
    message: string;
    type: 'success' | 'error' | 'info';
    show: boolean;
    onClose: () => void;
    duration?: number;
}
declare const Toast: React.FC<ToastProps>;
export default Toast;

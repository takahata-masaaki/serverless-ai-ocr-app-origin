import React from "react";
interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
}
declare const ConfirmModal: React.FC<ConfirmModalProps>;
export default ConfirmModal;

interface S3SyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    appName: string;
    onImportComplete: () => void;
}
declare const S3SyncModal: React.FC<S3SyncModalProps>;
export default S3SyncModal;

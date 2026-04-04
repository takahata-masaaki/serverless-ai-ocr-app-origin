import React from 'react';
import { ImageFile } from '../types/ocr';
interface FileListProps {
    files: ImageFile[];
    onRefresh: () => void;
}
declare const FileList: React.FC<FileListProps>;
export default FileList;

import React from 'react';
import { OcrBoundingBox } from '../types/ocr';
interface ImagePreviewProps {
    imageSrc: string;
    boundingBoxes: OcrBoundingBox[];
    selectedIndex: number | null;
    onSelectBox: (index: number) => void;
    onImageLoad: () => void;
    onImageError: (error: any) => void;
}
declare const ImagePreview: React.FC<ImagePreviewProps>;
export default ImagePreview;

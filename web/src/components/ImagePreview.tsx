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

const ImagePreview: React.FC<ImagePreviewProps> = ({
  imageSrc,
  boundingBoxes,
  selectedIndex,
  onSelectBox,
  onImageLoad,
  onImageError,
}) => {
  const isPdf =
    !!imageSrc &&
    (imageSrc.toLowerCase().includes('.pdf') ||
      imageSrc.toLowerCase().includes('application/pdf'));

  const getBoxStyle = (
    box: OcrBoundingBox,
    index: number
  ): React.CSSProperties => ({
    position: 'absolute',
    top: `${box.top}px`,
    left: `${box.left}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    border: index === selectedIndex ? '2px solid #ef4444' : '1px solid #3b82f6',
    backgroundColor:
      index === selectedIndex
        ? 'rgba(239, 68, 68, 0.15)'
        : 'rgba(59, 130, 246, 0.10)',
    boxSizing: 'border-box',
    cursor: 'pointer',
    pointerEvents: 'auto',
  });

  return (
    <div className="w-full h-full relative overflow-auto bg-gray-50 rounded">
      {!imageSrc ? (
        <div className="flex items-center justify-center h-full min-h-[240px] text-gray-500">
          画像が読み込めませんでした
        </div>
      ) : isPdf ? (
        <div className="w-full h-full min-h-[70vh]">
          <iframe
            title="PDF Preview"
            src={imageSrc}
            className="w-full h-full min-h-[70vh] border-0 bg-white"
          />
        </div>
      ) : (
        <div className="relative inline-block w-full">
          <img
            src={imageSrc}
            alt="preview"
            className="max-w-full h-auto block"
            onLoad={onImageLoad}
            onError={onImageError}
          />

          {boundingBoxes.map((box, index) => (
            <div
              key={`${index}-${box.text}`}
              style={getBoxStyle(box, index)}
              onClick={() => onSelectBox(index)}
              title={`テキスト: ${box.text}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ImagePreview;

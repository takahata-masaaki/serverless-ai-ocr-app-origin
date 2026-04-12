import { useEffect, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

function ImagePreview({
  imageSrc,
  pageNumber = 1,
  boundingBoxes = [],
  selectedIndex = null,
  onSelectBox,
  onImageLoad,
  onImageError,
}) {
  const wrapperRef = useRef(null);
  const [pdfImageSrc, setPdfImageSrc] = useState("");
  const [pdfMetrics, setPdfMetrics] = useState({
    width: 0,
    height: 0,
    unitScale: 0,
  });

  const isPdf =
    !!imageSrc &&
    (imageSrc.toLowerCase().includes(".pdf") ||
      imageSrc.toLowerCase().includes("application/pdf"));

  useEffect(() => {
    if (!isPdf || !imageSrc) {
      setPdfImageSrc("");
      setPdfMetrics({ width: 0, height: 0, unitScale: 0 });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const loadingTask = getDocument({
          url: imageSrc,
          cMapUrl: "/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/standard_fonts/",
        });

        const pdf = await loadingTask.promise;
        const safePage = Math.max(1, Math.min(pageNumber || 1, pdf.numPages));
        const page = await pdf.getPage(safePage);

        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(
          (wrapperRef.current?.clientWidth || baseViewport.width) - 24,
          320
        );
        const fitScale = availableWidth / baseViewport.width;
        const viewport = page.getViewport({ scale: fitScale });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: ctx,
          viewport,
        }).promise;

        if (cancelled) return;

        setPdfImageSrc(canvas.toDataURL("image/png"));
        setPdfMetrics({
          width: viewport.width,
          height: viewport.height,
          unitScale: 72 * fitScale,
        });

        onImageLoad && onImageLoad();
      } catch (e) {
        console.error("PDFレンダリングに失敗しました:", e);
        setPdfImageSrc("");
        onImageError && onImageError(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isPdf, imageSrc, pageNumber, onImageLoad, onImageError]);

  const boxStyleForImage = (box, index) => ({
    position: "absolute",
    top: `${box.top}px`,
    left: `${box.left}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    border: index === selectedIndex ? "2px solid #ef4444" : "1px solid #3b82f6",
    backgroundColor:
      index === selectedIndex
        ? "rgba(239, 68, 68, 0.15)"
        : "rgba(59, 130, 246, 0.10)",
    boxSizing: "border-box",
    cursor: "pointer",
    pointerEvents: "auto",
  });

  const boxStyleForPdf = (box, index) => ({
    position: "absolute",
    top: `${box.top * pdfMetrics.unitScale}px`,
    left: `${box.left * pdfMetrics.unitScale}px`,
    width: `${box.width * pdfMetrics.unitScale}px`,
    height: `${box.height * pdfMetrics.unitScale}px`,
    border: index === selectedIndex ? "2px solid #ef4444" : "1px solid #3b82f6",
    backgroundColor:
      index === selectedIndex
        ? "rgba(239, 68, 68, 0.15)"
        : "rgba(59, 130, 246, 0.10)",
    boxSizing: "border-box",
    cursor: "pointer",
    pointerEvents: "auto",
  });

  return (
    <div className="w-full h-full overflow-auto bg-gray-50 rounded">
      {!imageSrc ? (
        <div className="flex items-center justify-center h-full min-h-[240px] text-gray-500">
          画像が読み込めませんでした
        </div>
      ) : isPdf ? (
        <div ref={wrapperRef} className="w-full min-h-[70vh] p-3">
          {pdfImageSrc ? (
            <div
              className="relative mx-auto bg-white shadow-sm"
              style={{ width: pdfMetrics.width, height: pdfMetrics.height }}
            >
              <img
                src={pdfImageSrc}
                alt={`PDF page ${pageNumber}`}
                className="block"
                style={{ width: pdfMetrics.width, height: pdfMetrics.height }}
              />
              <div
                className="absolute inset-0"
                style={{ width: pdfMetrics.width, height: pdfMetrics.height }}
              >
                {boundingBoxes.map((box, index) => (
                  <div
                    key={`${index}-${box.text || ""}`}
                    style={boxStyleForPdf(box, index)}
                    onClick={() => onSelectBox && onSelectBox(index)}
                    title={`テキスト: ${box.text || ""}`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center min-h-[70vh] text-gray-500">
              PDFを描画中...
            </div>
          )}
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
              key={`${index}-${box.text || ""}`}
              style={boxStyleForImage(box, index)}
              onClick={() => onSelectBox && onSelectBox(index)}
              title={`テキスト: ${box.text || ""}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ImagePreview;

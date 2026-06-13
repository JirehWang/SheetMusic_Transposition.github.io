import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Upload, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileText, Loader2 } from 'lucide-react';
import styles from './PdfViewer.module.css';
import { assessExtractedPdfText } from '../utils/pdfTextQuality';

// Configure pdfjs worker using Vite's URL asset import
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfViewerProps {
  onTextExtracted: (text: string) => void;
  onFileLoaded: (fileName: string) => void;
}

export default function PdfViewer({ onTextExtracted, onFileLoaded }: PdfViewerProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1.2);
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [extracting, setExtracting] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renderTaskRef = useRef<any>(null);

  // Load PDF document from file
  const loadPdf = async (file: File) => {
    setLoading(true);
    setFileName(file.name);
    onFileLoaded(file.name);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setPageNum(1);
    } catch (error) {
      console.error('Error loading PDF:', error);
      alert('載入 PDF 失敗，請確認檔案格式是否正確。');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      loadPdf(e.target.files[0]);
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  // Render a specific page to canvas
  const renderPage = async (pageNo: number, scale: number) => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      // Cancel previous render task if active
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await pdfDoc.getPage(pageNo);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext as any);
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      renderTaskRef.current = null;
    } catch (error: any) {
      if (error.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', error);
      }
    }
  };

  useEffect(() => {
    if (pdfDoc) {
      renderPage(pageNum, zoom);
    }
  }, [pdfDoc, pageNum, zoom]);

  // Extract layout-preserved text from the current page
  const handleExtractText = async () => {
    if (!pdfDoc) return;
    setExtracting(true);

    try {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items as any[];

      if (items.length === 0) {
        alert('此頁面似乎沒有可擷取的文字。可能是掃描影像，請使用對照輸入。');
        setExtracting(false);
        return;
      }

      // Group items by line (translateY)
      // Note: transform[5] represents translateY (Y is bottom-up in PDF)
      const linesMap: { [y: number]: any[] } = {};

      items.forEach(item => {
        const x = item.transform[4];
        const y = Math.round(item.transform[5] * 2) / 2; // Round to group close elements

        // Find line with matching Y coordinate within a tolerance of 4 units
        const foundYKey = Object.keys(linesMap).find(
          key => Math.abs(parseFloat(key) - y) < 4
        );

        if (foundYKey) {
          linesMap[parseFloat(foundYKey)].push({ x, text: item.str });
        } else {
          linesMap[y] = [{ x, text: item.str }];
        }
      });

      // Sort lines by Y descending (top of page first)
      const sortedY = Object.keys(linesMap)
        .map(Number)
        .sort((a, b) => b - a);

      const resultLines: string[] = [];

      for (const y of sortedY) {
        const lineItems = linesMap[y];
        // Sort items in line from left to right (x ascending)
        lineItems.sort((a, b) => a.x - b.x);

        let lineText = '';
        let lastX = -1;

        for (const item of lineItems) {
          if (lastX !== -1) {
            const gap = item.x - lastX;
            // Approximate space width as 6 units
            const spacesCount = Math.max(1, Math.round(gap / 6));
            if (gap > 4) {
              lineText += ' '.repeat(spacesCount);
            }
          }
          lineText += item.text;
          // Estimate right border of the string
          lastX = item.x + item.text.length * 6;
        }
        resultLines.push(lineText);
      }

      const extractedText = resultLines.join('\n');
      const assessment = assessExtractedPdfText(extractedText);
      if (!assessment.ok) {
        console.warn('PDF text extraction rejected:', assessment);
        alert(assessment.message || 'PDF 文字擷取結果不足，已停止轉換。');
        return;
      }
      onTextExtracted(extractedText);
    } catch (error) {
      console.error('Error extracting text:', error);
      alert('擷取文字時發生錯誤。');
    } finally {
      setExtracting(false);
    }
  };

  const handlePrevPage = () => {
    setPageNum(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setPageNum(prev => Math.min(numPages, prev + 1));
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(3, prev + 0.1));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(0.5, prev - 0.1));
  };

  return (
    <div className={styles.container}>
      {/* Upload area or toolbar */}
      {!pdfDoc ? (
        <div className={styles.uploadBox} onClick={triggerUpload}>
          <Upload size={48} className={styles.uploadIcon} />
          <h3>選擇或拖曳 PDF 樂譜至此</h3>
          <p>支援文字型與影像型 PDF，最大支援 20MB</p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf"
            className={styles.hiddenInput}
          />
        </div>
      ) : (
        <div className={styles.viewer}>
          {/* PDF Toolbar */}
          <div className={styles.toolbar}>
            <div className={styles.fileInfo}>
              <span className={styles.fileName} title={fileName}>{fileName}</span>
            </div>
            
            <div className={styles.controls}>
              <button onClick={handlePrevPage} disabled={pageNum <= 1} className={styles.btn}>
                <ChevronLeft size={18} />
              </button>
              <span className={styles.pageLabel}>
                {pageNum} / {numPages}
              </span>
              <button onClick={handleNextPage} disabled={pageNum >= numPages} className={styles.btn}>
                <ChevronRight size={18} />
              </button>
            </div>

            <div className={styles.zoomControls}>
              <button onClick={handleZoomOut} className={styles.btn}>
                <ZoomOut size={18} />
              </button>
              <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
              <button onClick={handleZoomIn} className={styles.btn}>
                <ZoomIn size={18} />
              </button>
            </div>

            <button 
              onClick={handleExtractText} 
              disabled={extracting} 
              className={styles.extractBtn}
              title="將 PDF 的文字轉成和弦簡譜編輯器內容"
            >
              {extracting ? (
                <Loader2 size={16} className={styles.spin} />
              ) : (
                <FileText size={16} />
              )}
              <span>擷取文字</span>
            </button>
            
            <button onClick={triggerUpload} className={styles.reuploadBtn}>
              重新上傳
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf"
              className={styles.hiddenInput}
            />
          </div>

          {/* PDF Page Container */}
          <div className={styles.canvasContainer}>
            {loading && (
              <div className={styles.loader}>
                <Loader2 size={48} className={styles.spin} />
                <p>正在加載樂譜...</p>
              </div>
            )}
            <canvas ref={canvasRef} className={styles.canvas} />
          </div>
        </div>
      )}
    </div>
  );
}

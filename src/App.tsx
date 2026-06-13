import { useState } from 'react';
import PdfViewer from './components/PdfViewer';
import ChordEditor from './components/ChordEditor';
import AbcEditor from './components/AbcEditor';
import { DEFAULT_ABC_TEMPLATE, DEFAULT_CHORD_TEMPLATE } from './utils/abcTransposer';
import { transcribePdfWithGas } from './utils/gasOmrClient';
import { Music, FileText, Database, Eye, EyeOff } from 'lucide-react';
import './App.css';

const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxStUV4yxvREiBeCijRDAV7SDP2pACk2TmSIyXP8Hohk7MSDFIbtmcY5quyUbOozkpN9Q/exec';

function App() {
  const [sheetType, setSheetType] = useState<'chord' | 'abc'>('chord');
  const [semitones, setSemitones] = useState<number>(0);
  const [title, setTitle] = useState<string>('小星星 (Twinkle Twinkle Little Star)');
  const [inputText, setInputText] = useState<string>(DEFAULT_CHORD_TEMPLATE);
  
  // PDF Viewer states
  const [showPdf, setShowPdf] = useState<boolean>(true);
  const [pdfFileName, setPdfFileName] = useState<string>('');

  // GAS states
  const [gasUrl, setGasUrl] = useState<string>(() => localStorage.getItem('gas_api_url') || DEFAULT_GAS_URL);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOmrRunning, setIsOmrRunning] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Load templates when toggling sheet types
  const handleTypeChange = (type: 'chord' | 'abc') => {
    setSheetType(type);
    if (type === 'abc') {
      setTitle('小星星五線譜');
      setInputText(DEFAULT_ABC_TEMPLATE);
    } else {
      setTitle('小星星和弦歌譜');
      setInputText(DEFAULT_CHORD_TEMPLATE);
    }
    setSemitones(0);
  };

  // Text extraction callback from PDF Viewer
  const handleTextExtracted = (extractedText: string) => {
    setInputText(extractedText);
    setTitle(pdfFileName.replace(/\.[^/.]+$/, "") + " (已擷取)");
    setSemitones(0);
    alert('已成功擷取 PDF 文字並填入編輯器！');
  };

  const handlePdfLoaded = (fileName: string) => {
    setPdfFileName(fileName);
  };

  const handleGasOmr = async (file: File) => {
    if (!gasUrl.trim()) {
      alert('請先貼上 GAS Web App URL，再使用 GAS 讀譜。');
      return;
    }

    setIsOmrRunning(true);
    setSyncMessage({ text: 'GAS 讀譜中，請稍候...', isError: false });

    try {
      const result = await transcribePdfWithGas(gasUrl.trim(), file);
      setSheetType(result.type);
      setInputText(result.text);
      setTitle(result.title || `${file.name.replace(/\.[^/.]+$/, '')} (GAS 讀譜)`);
      setSemitones(0);
      setSyncMessage({ text: 'GAS 讀譜完成，已載入編輯器。', isError: false });
    } catch (error: unknown) {
      console.error('GAS OMR Error:', error);
      const message = error instanceof Error
        ? error.message
        : 'GAS 讀譜失敗，請檢查 Apps Script 後端設定。';
      setSyncMessage({
        text: message,
        isError: true,
      });
      alert(message);
    } finally {
      setIsOmrRunning(false);
    }
  };

  // Save GAS API URL to local storage
  const handleGasUrlChange = (url: string) => {
    setGasUrl(url);
    localStorage.setItem('gas_api_url', url);
  };

  // Post sheet data to user's Google Apps Script
  const handleSyncToGas = async () => {
    if (!gasUrl) {
      alert('請先輸入您的 Google Apps Script (GAS) API URL。');
      return;
    }

    setIsSyncing(true);
    setSyncMessage(null);

    try {
      const payload = {
        action: 'save',
        title,
        type: sheetType,
        content: inputText,
        semitones,
        timestamp: new Date().toISOString(),
      };

      // Since GAS Web Apps require redirect follow-through, using no-cors or standard fetch
      // We will perform a standard POST request.
      const response = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok || response.type === 'opaque') {
        setSyncMessage({ text: '🎉 成功同步至 Google Apps Script 資料庫！', isError: false });
      } else {
        setSyncMessage({ text: `同步失敗 (HTTP ${response.status})，請檢查 GAS 部署權限。`, isError: true });
      }
    } catch (error: any) {
      console.error('GAS Sync Error:', error);
      // Because CORS can block the response from GAS but still perform the action,
      // we check if it is a network error or a successful silent post.
      setSyncMessage({ 
        text: '同步已發送！請確認您的 GAS 執行 Log（若遇到 CORS 阻擋，資料通常仍有成功寫入）。', 
        isError: false 
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetSemitones = () => {
    setSemitones(0);
  };

  return (
    <div className="app-container">
      {/* 🚀 Main Header (Toolbar) */}
      <header className="app-header no-print">
        <div className="brand">
          <div className="logo-icon">
            <Music size={20} />
          </div>
          <h1>樂譜移調工作台</h1>
        </div>

        {/* Global Settings & GAS Integration */}
        <div className="header-actions">
          {/* Sheet Title Input */}
          <div className="input-group">
            <label htmlFor="sheet-title">樂譜名稱</label>
            <input
              id="sheet-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="輸入樂譜標題..."
              className="title-input"
            />
          </div>

          {/* Key selector / Semitones shift */}
          <div className="transposer-group">
            <span className="control-label">移調控制</span>
            <div className="key-controls">
              <button 
                onClick={() => setSemitones(prev => Math.max(-12, prev - 1))}
                className="step-btn"
                title="降半音"
              >
                -1
              </button>
              <div className="semitones-display" onClick={handleResetSemitones} title="雙擊或點擊重設為原調">
                {semitones > 0 ? `+${semitones}` : semitones} 半音
              </div>
              <button 
                onClick={() => setSemitones(prev => Math.min(12, prev + 1))}
                className="step-btn"
                title="升半音"
              >
                +1
              </button>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="mode-switcher">
            <button
              onClick={() => handleTypeChange('chord')}
              className={`mode-btn ${sheetType === 'chord' ? 'active-mode' : ''}`}
            >
              <FileText size={16} />
              <span>吉他和弦譜</span>
            </button>
            <button
              onClick={() => handleTypeChange('abc')}
              className={`mode-btn ${sheetType === 'abc' ? 'active-mode' : ''}`}
            >
              <Music size={16} />
              <span>五線譜 (ABC)</span>
            </button>
          </div>

          {/* PDF View toggle */}
          <button 
            onClick={() => setShowPdf(!showPdf)} 
            className={`toggle-pdf-btn ${showPdf ? 'active-pdf' : ''}`}
            title={showPdf ? "隱藏 PDF 視窗" : "顯示 PDF 視窗"}
          >
            {showPdf ? <EyeOff size={16} /> : <Eye size={16} />}
            <span>{showPdf ? "隱藏 PDF" : "對照 PDF"}</span>
          </button>
        </div>
      </header>

      {/* 💾 Google Apps Script (GAS) Sync panel (No Print) */}
      <section className="gas-bar no-print">
        <div className="gas-wrapper">
          <div className="gas-label">
            <Database size={16} className="gas-icon" />
            <span>GAS 後端同步</span>
          </div>
          <input
            type="text"
            value={gasUrl}
            onChange={(e) => handleGasUrlChange(e.target.value)}
            placeholder="請貼上您的 Google Apps Script 網頁應用程式 URL..."
            className="gas-input"
          />
          <button 
            onClick={handleSyncToGas} 
            disabled={isSyncing || !inputText.trim()} 
            className="gas-sync-btn"
          >
            {isSyncing ? '同步中...' : '儲存至 GAS'}
          </button>
          {syncMessage && (
            <span className={`sync-msg ${syncMessage.isError ? 'err' : 'ok'}`}>
              {syncMessage.text}
            </span>
          )}
        </div>
      </section>

      {/* 💻 Main Workspace Panel */}
      <main className="workspace-container">
        {/* Left column: PDF Viewer (Conditional rendering with animation layout) */}
        {showPdf && (
          <section className="pdf-sidebar no-print">
            <PdfViewer 
              onTextExtracted={handleTextExtracted} 
              onFileLoaded={handlePdfLoaded} 
              onOmrRequested={handleGasOmr}
              omrRunning={isOmrRunning}
              gasAvailable={Boolean(gasUrl.trim())}
            />
          </section>
        )}

        {/* Right column: Editor and sheet renderer */}
        <section className="editor-main">
          {sheetType === 'chord' ? (
            <ChordEditor
              initialText={inputText}
              semitones={semitones}
              onSemitonesChange={setSemitones}
              title={title}
            />
          ) : (
            <AbcEditor
              initialText={inputText}
              semitones={semitones}
              onSemitonesChange={setSemitones}
              title={title}
            />
          )}
        </section>
      </main>
    </div>
  );
}

export default App;

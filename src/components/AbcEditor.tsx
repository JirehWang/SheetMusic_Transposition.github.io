import { useState, useEffect, useRef } from 'react';
import abcjs from 'abcjs';
import { getAbcKey, transposeKeySignature, normalizeAbcString } from '../utils/abcTransposer';
import { Printer, ZoomIn, ZoomOut, Volume2 } from 'lucide-react';
import styles from './AbcEditor.module.css';

// Import abcjs default MIDI styles so the control element behaves correctly
import 'abcjs/abcjs-audio.css';

interface AbcEditorProps {
  initialText: string;
  semitones: number;
  onSemitonesChange: (val: number) => void;
  title: string;
}

export default function AbcEditor({ initialText, semitones, title }: AbcEditorProps) {
  const [editorText, setEditorText] = useState<string>(initialText);
  const [zoom, setZoom] = useState<number>(1.0);
  const [synthSupport, setSynthSupport] = useState<boolean>(false);
  const [midiLoading, setMidiLoading] = useState<boolean>(false);

  const paperRef = useRef<HTMLDivElement>(null);
  const midiRef = useRef<HTMLDivElement>(null);
  const synthControllerRef = useRef<any | null>(null);

  useEffect(() => {
    if (initialText) {
      setEditorText(initialText);
    }
  }, [initialText]);

  // Check audio compatibility on mount
  useEffect(() => {
    if (abcjs.synth.supportsAudio()) {
      setSynthSupport(true);
    }
  }, []);

  // Main rendering loop for Sheet Music & Midi Player
  useEffect(() => {
    if (!paperRef.current) return;

    // 1. Normalize and clean the ABC notation
    const normalizedAbc = normalizeAbcString(editorText, title);
    
    if (!normalizedAbc) {
      paperRef.current.innerHTML = '<div style="color: var(--text-muted); padding: 20px;">請輸入有效或格式正確的 ABC 樂譜。</div>';
      return;
    }

    try {
      // 2. Render sheet music SVG (with visual transpose)
      const visualObjs = abcjs.renderAbc(paperRef.current, normalizedAbc, {
        responsive: 'resize',
        scale: zoom,
        visualTranspose: semitones,
        add_classes: true, // Allows styling notes
      });

      const visualObj = visualObjs[0];

      // 3. Setup MIDI playback (with midi transpose)
      if (synthSupport && midiRef.current && visualObj) {
        setMidiLoading(true);
        
        // Initialize or retrieve controller
        let controller = synthControllerRef.current;
        if (!controller) {
          controller = new abcjs.synth.SynthController();
          synthControllerRef.current = controller;
        }

        // Configure controller parameters
        controller.load(midiRef.current, null, {
          displayLoop: true,
          displayRestart: true,
          displayPlay: true,
          displayProgress: true,
          displayWarp: false,
          midiTranspose: semitones,
        });

        // Set the tune for audio synthesis
        controller.setTune(visualObj, false, {
          midiTranspose: semitones,
        }).then(() => {
          setMidiLoading(false);
        }).catch((err: any) => {
          console.error('Synth initialization error:', err);
          setMidiLoading(false);
        });
      }
    } catch (e) {
      console.error('Error rendering ABC:', e);
    }

    // Cleanup when component unmounts or re-renders
    return () => {
      // We don't destroy the controller immediately to allow smooth transitions,
      // but if the component unmounts, we should stop audio.
    };
  }, [editorText, semitones, zoom, synthSupport, title]);

  // Handle cleanup on unmount
  useEffect(() => {
    return () => {
      if (synthControllerRef.current) {
        try {
          synthControllerRef.current.destroy();
        } catch (e) {
          // Ignore
        }
        synthControllerRef.current = null;
      }
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleZoomIn = () => {
    setZoom((z) => Math.min(1.5, z + 0.1));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.6, z - 0.1));
  };

  // Get original and transposed key names
  const originalKey = getAbcKey(editorText);
  const transposedKey = transposeKeySignature(originalKey, semitones);

  return (
    <div className={styles.workspace}>
      {/* ABC Editor Panel (Left) */}
      <div className={`${styles.editorPanel} no-print`}>
        <div className={styles.panelHeader}>
          <h3>編輯 ABC 記譜法</h3>
          <div className={styles.keyInfo}>
            原調：<span className={styles.keyTag}>{originalKey}</span> | 
            移調後：<span className={styles.keyTagHighlight}>{transposedKey}</span>
          </div>
        </div>
        <textarea
          value={editorText}
          onChange={(e) => setEditorText(e.target.value)}
          placeholder={`在此輸入 ABC 記譜法樂譜，例如：\n\nX: 1\nT: 樂譜標題\nM: 4/4\nL: 1/4\nK: C\nC D E F | G A B c |`}
          className={styles.textarea}
        />
        <div className={styles.editorFooter}>
          <a href="https://abcnotation.com/examples" target="_blank" rel="noreferrer" className={styles.docLink}>
            學習 ABC 記譜法語法 ↗
          </a>
        </div>
      </div>

      {/* Sheet Music Preview & Synth Panel (Right) */}
      <div className={styles.previewPanel}>
        <div className={`${styles.panelHeader} no-print`}>
          <h3>移調五線譜預覽</h3>
          
          <div className={styles.toolbar}>
            {/* Zoom controls */}
            <div className={styles.toolGroup}>
              <button onClick={handleZoomOut} className={styles.toolBtn} title="縮小比例">
                <ZoomOut size={14} />
              </button>
              <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
              <button onClick={handleZoomIn} className={styles.toolBtn} title="放大比例">
                <ZoomIn size={14} />
              </button>
            </div>

            {/* Print control */}
            <button onClick={handlePrint} className={styles.printBtn}>
              <Printer size={16} />
              <span>列印五線譜</span>
            </button>
          </div>
        </div>

        {/* Audio Synth Widget (No Print) */}
        <div className={`${styles.audioBar} no-print`}>
          <div className={styles.audioIconWrapper}>
            <Volume2 size={18} className={styles.volumeIcon} />
            <span>MIDI 試聽播放器</span>
          </div>
          <div className={styles.synthContainer}>
            {midiLoading && <div className={styles.midiLoader}>正在合成音訊...</div>}
            <div ref={midiRef} className={styles.midiWidget} />
          </div>
        </div>

        {/* Sheet Music Container (Print Target) */}
        <div className={`${styles.paperContainer} print-area`}>
          <div className={`${styles.paper} paper-sheet`}>
            {/* Render Target for abcjs SVG */}
            <div ref={paperRef} className={styles.abcTarget} />
          </div>
        </div>
      </div>
    </div>
  );
}

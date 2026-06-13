import { useState, useEffect } from 'react';
import { transposeChordSheet, isChord } from '../utils/chordTransposer';
import { Plus, Minus, Printer } from 'lucide-react';
import styles from './ChordEditor.module.css';

interface ChordWord {
  chord?: string;
  lyric: string;
}

interface ChordLine {
  isChordLine: boolean;
  content: string;
  words?: ChordWord[];
}

interface ChordEditorProps {
  initialText: string;
  semitones: number;
  onSemitonesChange: (val: number) => void;
  title: string;
}

// Merge a line of chords and a line of lyrics into a ChordPro-like bracketed string
function mergeChordsAndLyrics(chordLine: string, lyricLine: string): string {
  const regex = /\S+/g;
  let match;
  const chords: { chord: string; index: number }[] = [];
  
  while ((match = regex.exec(chordLine)) !== null) {
    chords.push({
      chord: match[0],
      index: match.index
    });
  }

  chords.sort((a, b) => a.index - b.index);

  let result = '';
  let lastIndex = 0;

  for (const c of chords) {
    if (c.index > lyricLine.length) {
      result += lyricLine.substring(lastIndex);
      const padding = c.index - (result.length - (result.match(/\[[^\]]+\]/g)?.join('').length || 0));
      if (padding > 0) {
        result += ' '.repeat(padding);
      }
      result += `[${c.chord}]`;
      lastIndex = lyricLine.length;
    } else {
      result += lyricLine.substring(lastIndex, c.index);
      result += `[${c.chord}]`;
      lastIndex = c.index;
    }
  }
  
  result += lyricLine.substring(lastIndex);
  return result;
}

// Parse bracketed ChordPro line into structured array of words
function parseChordProLine(line: string): ChordWord[] {
  const regex = /(?:\[([^\]]+)\])?([^\[]*)/g;
  const words: ChordWord[] = [];
  let match;
  
  while ((match = regex.exec(line)) !== null) {
    if (match[0] === '') break;
    const chord = match[1] || undefined;
    const lyric = match[2] || '';
    if (chord || lyric) {
      words.push({ chord, lyric });
    }
  }
  return words;
}

// Parse full sheet text to structured lines
export function parseChordSheetToStructuredData(text: string): ChordLine[] {
  const lines = text.split('\n');
  const structured: ChordLine[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      structured.push({ isChordLine: false, content: '' });
      continue;
    }

    // If it's already ChordPro format
    if (line.includes('[') && line.includes(']')) {
      structured.push({
        isChordLine: true,
        content: line,
        words: parseChordProLine(line)
      });
      continue;
    }

    // Check if line contains only chords and whitespace
    const tokens = line.split(/(\s+)/);
    let isChords = true;
    let hasChords = false;
    for (const t of tokens) {
      const tr = t.trim();
      if (tr !== '') {
        if (isChord(tr)) {
          hasChords = true;
        } else {
          isChords = false;
          break;
        }
      }
    }

    if (isChords && hasChords) {
      const nextLine = lines[i + 1];
      // If next line exists and is not empty and is not a chord line itself, merge
      if (nextLine !== undefined && nextLine.trim() !== '') {
        const nextTokens = nextLine.split(/(\s+)/);
        let nextIsChords = true;
        let nextHasChords = false;
        for (const t of nextTokens) {
          const tr = t.trim();
          if (tr !== '') {
            if (isChord(tr)) {
              nextHasChords = true;
            } else {
              nextIsChords = false;
              break;
            }
          }
        }
        const nextIsChordLine = nextIsChords && nextHasChords;
        if (!nextIsChordLine) {
          const merged = mergeChordsAndLyrics(line, nextLine);
          structured.push({
            isChordLine: true,
            content: merged,
            words: parseChordProLine(merged)
          });
          i++; // Skip next line
          continue;
        }
      }
      
      // Render chord-only line by wrapping chords
      const chordPro = tokens.map(t => {
        if (t.trim() === '') return t;
        return `[${t}]`;
      }).join('');
      
      structured.push({
        isChordLine: true,
        content: chordPro,
        words: parseChordProLine(chordPro)
      });
    } else {
      structured.push({
        isChordLine: false,
        content: line
      });
    }
  }
  
  return structured;
}

export default function ChordEditor({ initialText, semitones, title }: ChordEditorProps) {
  const [editorText, setEditorText] = useState<string>(initialText);
  const [fontSize, setFontSize] = useState<number>(16);
  const [preferSharps, setPreferSharps] = useState<boolean>(true);

  useEffect(() => {
    if (initialText) {
      setEditorText(initialText);
    }
  }, [initialText]);

  // Transpose the text based on current semitones
  const transposedText = transposeChordSheet(editorText, semitones, preferSharps);
  const structuredData = parseChordSheetToStructuredData(transposedText);

  const handlePrint = () => {
    window.print();
  };

  const handleClear = () => {
    if (window.confirm('確定要清空編輯器嗎？')) {
      setEditorText('');
    }
  };

  return (
    <div className={styles.workspace}>
      {/* Editor Panel (Left) */}
      <div className={`${styles.editorPanel} no-print`}>
        <div className={styles.panelHeader}>
          <h3>編輯和弦譜</h3>
          <button onClick={handleClear} className={styles.clearBtn}>
            清空
          </button>
        </div>
        <textarea
          value={editorText}
          onChange={(e) => setEditorText(e.target.value)}
          placeholder={`在此輸入和弦與歌詞。\n支援兩種格式：\n\n1. 括號格式 (ChordPro):\n[C]閃閃 [C]亮亮 [F]小星[C]星\n\n2. 獨立和弦行格式 (對齊行):\nC      G      Am     F\nHello world how are you`}
          className={styles.textarea}
        />
      </div>

      {/* Rendered Preview Panel (Right) */}
      <div className={styles.previewPanel}>
        <div className={`${styles.panelHeader} no-print`}>
          <h3>移調樂譜預覽</h3>
          
          <div className={styles.toolbar}>
            {/* Font Size controls */}
            <div className={styles.toolGroup}>
              <button onClick={() => setFontSize(f => Math.max(12, f - 1))} className={styles.toolBtn} title="縮小字型">
                <Minus size={14} />
              </button>
              <span className={styles.fontSizeLabel}>{fontSize}px</span>
              <button onClick={() => setFontSize(f => Math.min(24, f + 1))} className={styles.toolBtn} title="放大字型">
                <Plus size={14} />
              </button>
            </div>

            {/* Flat/Sharp preference toggle */}
            <div className={styles.toolGroup}>
              <button 
                onClick={() => setPreferSharps(true)} 
                className={`${styles.toggleBtn} ${preferSharps ? styles.activeToggle : ''}`}
              >
                # 升號
              </button>
              <button 
                onClick={() => setPreferSharps(false)} 
                className={`${styles.toggleBtn} ${!preferSharps ? styles.activeToggle : ''}`}
              >
                b 降號
              </button>
            </div>

            {/* Print action */}
            <button onClick={handlePrint} className={styles.printBtn}>
              <Printer size={16} />
              <span>列印 / 輸出 PDF</span>
            </button>
          </div>
        </div>

        {/* Paper rendering area */}
        <div className={`${styles.paperContainer} print-area`}>
          <div className={`${styles.paper} paper-sheet`} style={{ fontSize: `${fontSize}px` }}>
            <h1 className={styles.sheetTitle}>{title || '我的樂譜'}</h1>
            <div className={styles.keyBadge}>
              移調：{semitones > 0 ? `+${semitones}` : semitones} 半音 | 
              偏好：{preferSharps ? '升號 (#)' : '降號 (b)'}
            </div>
            
            <div className={styles.sheetBody}>
              {structuredData.map((line, lineIdx) => {
                if (!line.content && lineIdx !== 0 && lineIdx !== structuredData.length - 1) {
                  return <div key={lineIdx} className={styles.emptyLine} />;
                }

                if (line.isChordLine && line.words) {
                  return (
                    <div key={lineIdx} className={styles.chordLine}>
                      {line.words.map((w, wIdx) => (
                        <span key={wIdx} className={styles.wordGroup}>
                          {w.chord && <span className={styles.chord}>{w.chord}</span>}
                          <span className={styles.lyric}>{w.lyric || '\u00A0'}</span>
                        </span>
                      ))}
                    </div>
                  );
                }

                return (
                  <div key={lineIdx} className={styles.commentLine}>
                    {line.content}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export type Accidental = 'sharp' | 'flat' | 'natural';
export type AccidentalTarget = 'root' | 'bass';

export interface VisualAccidentalDetection {
  target: AccidentalTarget;
  accidental: Accidental;
  /**
   * True when OCR emitted a placeholder or wrong glyph in the accidental slot
   * (for example B6 for Bb, or F?m7 for F#m7).
   */
  replacesOcrText?: boolean;
  confidence?: number;
}

export interface ParsedChord {
  original: string;
  normalized: string;
  root: string;
  suffix: string;
  bass?: string;
}

const ACCIDENTAL_SYMBOLS: Record<string, string> = {
  '♯': '#',
  '＃': '#',
  '﹟': '#',
  '𝄪': '##',
  '♭': 'b',
  '♮': '',
  '𝄫': 'bb',
};

const OCR_ACCIDENTAL_PLACEHOLDERS = new Set(['?', '6', '#', 'b']);
const CHORD_SUFFIX_PATTERN = /^(?:maj|min|sus|add|dim|aug|alt|ma|mi|m|M|[0-9]|#|b|\+|-|\(|\)|o|\*)*$/;

export function normalizeAccidentalSymbols(text: string): string {
  let normalized = text;
  for (const [symbol, replacement] of Object.entries(ACCIDENTAL_SYMBOLS)) {
    normalized = normalized.split(symbol).join(replacement);
  }
  return normalized;
}

export function parseChordName(chord: string): ParsedChord | null {
  const normalized = normalizeAccidentalSymbols(chord.trim());
  const match = normalized.match(/^([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?$/);
  if (!match) return null;

  const suffix = match[2] || '';
  if (!CHORD_SUFFIX_PATTERN.test(suffix)) return null;

  return {
    original: chord,
    normalized,
    root: match[1],
    suffix,
    bass: match[3],
  };
}

function accidentalToParserSymbol(accidental: Accidental): string {
  if (accidental === 'sharp') return '#';
  if (accidental === 'flat') return 'b';
  return '';
}

function applyDetectionToNotePart(part: string, detection: VisualAccidentalDetection): string {
  const normalized = normalizeAccidentalSymbols(part.trim());
  const match = normalized.match(/^([A-G])([#b]?)(.*)$/);
  if (!match) return normalized;

  const [, letter, existingAccidental, rest] = match;
  const visualSymbol = accidentalToParserSymbol(detection.accidental);
  let suffix = rest;

  if (detection.replacesOcrText && suffix.length > 0 && OCR_ACCIDENTAL_PLACEHOLDERS.has(suffix[0])) {
    suffix = suffix.slice(1);
  }

  if (detection.accidental === 'natural') {
    return `${letter}${suffix}`;
  }

  const accidental = visualSymbol || existingAccidental;
  return `${letter}${accidental}${suffix}`;
}

export function applyVisualAccidentalsToChord(
  ocrChord: string,
  detections: VisualAccidentalDetection[]
): ParsedChord {
  const normalized = normalizeAccidentalSymbols(ocrChord.trim());
  const [rawRootPart, rawBassPart] = normalized.split('/');

  let rootPart = rawRootPart;
  let bassPart = rawBassPart;

  for (const detection of detections) {
    if (detection.target === 'root') {
      rootPart = applyDetectionToNotePart(rootPart, detection);
    } else if (bassPart) {
      bassPart = applyDetectionToNotePart(bassPart, detection);
    }
  }

  const repaired = bassPart ? `${rootPart}/${bassPart}` : rootPart;
  const parsed = parseChordName(repaired);

  if (parsed) return parsed;

  return {
    original: ocrChord,
    normalized: repaired,
    root: rootPart,
    suffix: '',
    bass: bassPart,
  };
}

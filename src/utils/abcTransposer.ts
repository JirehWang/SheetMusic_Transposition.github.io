import { noteToSemitone, semitoneToNote, getPreferSharpsForKey } from './chordTransposer';

// Extract the Key (K:) from ABC notation string
export function getAbcKey(abcString: string): string {
  // Matches line starting with K: and extracts the key, e.g. K:C, K: G, K:Am, K:F#m
  const match = abcString.match(/(?:^|\n)K:\s*([A-G][#b]?[a-zA-Z0-9#]*)/);
  if (match) {
    return match[1].trim();
  }
  return 'C'; // Default to C major
}

// Calculate the transposed key signature name (e.g., C + 2 semitones = D)
export function transposeKeySignature(keySig: string, semitones: number): string {
  if (!keySig) return 'C';
  
  // Extract key root and key mode (e.g. C#m -> C# and m)
  const match = keySig.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return keySig;

  const root = match[1];
  const mode = match[2] || ''; // m, min, maj, etc.

  const currentSemitone = noteToSemitone(root);
  if (currentSemitone === -1) return keySig;

  // Compute target semitone
  const targetSemitone = ((currentSemitone + semitones) % 12 + 12) % 12;

  // Decide if the target key prefers sharps or flats
  const preferSharps = getPreferSharpsForKey(semitoneToNote(targetSemitone, true) + mode);
  const targetRoot = semitoneToNote(targetSemitone, preferSharps);

  return `${targetRoot}${mode}`;
}

// Validate or normalize an ABC string
// Ensure it contains X: (Index) and T: (Title) headers, which are required for abcjs
export function normalizeAbcString(abc: string, defaultTitle = '未命名樂譜'): string {
  let normalized = abc.trim();
  if (!normalized) return '';

  const hasX = /(?:^|\n)X:\s*\d+/.test(normalized);
  const hasT = /(?:^|\n)T:\s*/.test(normalized);
  const hasK = /(?:^|\n)K:\s*/.test(normalized);

  const headers = [];
  if (!hasX) headers.push('X: 1');
  if (!hasT) headers.push(`T: ${defaultTitle}`);
  
  // If we have some headers to prepend
  if (headers.length > 0) {
    normalized = headers.join('\n') + '\n' + normalized;
  }

  // Ensure K: is present at the end of headers if missing
  if (!hasK) {
    // Add K: C at the end of headers (before the notes start)
    // We split by lines, find the last header (line starting with letter and colon like M:, L:, etc.)
    const lines = normalized.split('\n');
    let lastHeaderIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^[A-Z]:/.test(lines[i])) {
        lastHeaderIndex = i;
      }
    }
    if (lastHeaderIndex !== -1) {
      lines.splice(lastHeaderIndex + 1, 0, 'K: C');
    } else {
      lines.unshift('K: C');
    }
    normalized = lines.join('\n');
  }

  return normalized;
}

// Default template for ABC notation
export const DEFAULT_ABC_TEMPLATE = `X: 1
T: 小星星 (Twinkle Twinkle Little Star)
C: 民謠
M: 4/4
L: 1/4
K: C
C C G G | A A G2 | F F E E | D D C2 |
G G F F | E E D2 | G G F F | E E D2 |
C C G G | A A G2 | F F E E | D D C2 |]`;

// Default template for Chord Sheet
export const DEFAULT_CHORD_TEMPLATE = `[C]閃閃 [C]亮亮 [F]小星[C]星
[F]我想 [C]知道 [G]你是[C]誰
[C]掛在 [C]天空 [F]放光[C]芒
[F]好像 [C]許多 [G]小精[C]靈
[C]閃閃 [C]亮亮 [F]小星[C]星
[F]我想 [C]知道 [G]你是[C]誰`;

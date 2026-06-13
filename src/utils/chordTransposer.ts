// Semitone index mappings
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Map note name to semitone index (0-11)
export function noteToSemitone(note: string): number {
  const n = note.trim();
  switch (n) {
    case 'C': return 0;
    case 'C#': return 1;
    case 'Db': return 1;
    case 'D': return 2;
    case 'D#': return 3;
    case 'Eb': return 3;
    case 'E': return 4;
    case 'F': return 5;
    case 'F#': return 6;
    case 'Gb': return 6;
    case 'G': return 7;
    case 'G#': return 8;
    case 'Ab': return 8;
    case 'A': return 9;
    case 'A#': return 10;
    case 'Bb': return 10;
    case 'B': return 11;
    // Edge cases
    case 'E#': return 5;
    case 'Fb': return 4;
    case 'B#': return 0;
    case 'Cb': return 11;
    default: return -1;
  }
}

// Convert semitone back to note name, with preference for sharps/flats
export function semitoneToNote(semitone: number, preferSharps = true): string {
  const index = ((semitone % 12) + 12) % 12;
  return preferSharps ? SHARPS[index] : FLATS[index];
}

// Check if a word is a chord
export function isChord(word: string): boolean {
  // Regex to match root note [A-G][#b]?
  // Suffix must be composed entirely of valid chord parts (numbers, symbols, or specific abbreviations)
  // Optional bass note /[A-G][#b]?
  const regex = /^[A-G](?:#|b)?(?:maj|min|sus|add|dim|aug|alt|ma|mi|m|M|[0-9]|#|b|\+|\-|\(|\)|ø|Δ|o|\*)*(?:\/[A-G](?:#|b)?)?$/;
  return regex.test(word.trim());
}

// Transpose a single chord string (e.g., C#m7/E) by semitones
export function transposeChord(chord: string, semitones: number, preferSharps = true): string {
  if (!chord) return '';
  
  // Extract parts: Root + Suffix + Bass
  // Example: C#m7/E -> root: C#, suffix: m7, bass: E
  const match = chord.match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/);
  if (!match) return chord; // Return original if it doesn't match standard chord structure

  const root = match[1];
  const suffix = match[2] || '';
  const bass = match[3];

  const rootSemitone = noteToSemitone(root);
  if (rootSemitone === -1) return chord;

  const newRoot = semitoneToNote(rootSemitone + semitones, preferSharps);

  if (bass) {
    const bassSemitone = noteToSemitone(bass);
    if (bassSemitone !== -1) {
      const newBass = semitoneToNote(bassSemitone + semitones, preferSharps);
      return `${newRoot}${suffix}/${newBass}`;
    }
  }

  return `${newRoot}${suffix}`;
}

// Detect if target key signature prefers sharps or flats
// Common keys:
// Sharps: G, D, A, E, B, F#, C#, Em, Bm, F#m, C#m, G#m, D#m
// Flats: F, Bb, Eb, Ab, Db, Gb, Dm, Gm, Cm, Fm, Bbm, Ebm
export function getPreferSharpsForKey(key: string): boolean {
  if (!key) return true;
  const k = key.trim().replace('maj', '').replace('min', 'm');
  const flatKeys = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm'];
  return !flatKeys.includes(k);
}

// Process a line of text
// If it's a chord line, transpose all chords and preserve spacing
export function transposeLine(line: string, semitones: number, preferSharps = true): string {
  // Check if it's ChordPro format: contains [C]
  if (line.includes('[') && line.includes(']')) {
    return line.replace(/\[([^\]]+)\]/g, (match, chordName) => {
      // If the content inside bracket is a chord, transpose it
      if (isChord(chordName)) {
        return `[${transposeChord(chordName, semitones, preferSharps)}]`;
      }
      return match;
    });
  }

  // Check if the line is a separate chord line (e.g. C    G    Am   F)
  // We split by spaces but keep track of indices to preserve formatting
  const tokens = line.split(/(\s+)/);
  let isChordLine = true;
  let hasChords = false;

  for (const token of tokens) {
    const trimmed = token.trim();
    if (trimmed !== '') {
      if (isChord(trimmed)) {
        hasChords = true;
      } else {
        // Contains a non-chord token, so it's a lyric line (or mixed)
        isChordLine = false;
        break;
      }
    }
  }

  if (isChordLine && hasChords) {
    return tokens.map(token => {
      if (token.trim() === '') return token;
      return transposeChord(token, semitones, preferSharps);
    }).join('');
  }

  return line;
}

// Transpose an entire chord sheet text
export function transposeChordSheet(text: string, semitones: number, targetKeyPreference?: boolean): string {
  const lines = text.split('\n');
  
  // Decide flat/sharp naming preference
  let preferSharps = true;
  if (targetKeyPreference !== undefined) {
    preferSharps = targetKeyPreference;
  }

  return lines.map(line => transposeLine(line, semitones, preferSharps)).join('\n');
}

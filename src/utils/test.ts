import { transposeChord, isChord, transposeChordSheet } from './chordTransposer';
import { transposeKeySignature, getAbcKey } from './abcTransposer';
import {
  applyVisualAccidentalsToChord,
  normalizeAccidentalSymbols,
  parseChordName,
} from './chordRecognition';
import { detectAccidentalTemplates, type ImageDataLike } from './accidentalTemplateMatcher';

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual === expected) {
    console.log(`✅ PASS: ${message}`);
  } else {
    throw new Error(`❌ FAIL: ${message} | Expected "${expected}", but got "${actual}"`);
  }
}

console.log("Running Transposer Tests...\n");

// 1. Test isChord
assertEqual(isChord("C"), true, "C is a chord");
assertEqual(isChord("Am"), true, "Am is a chord");
assertEqual(isChord("F#m7b5"), true, "F#m7b5 is a chord");
assertEqual(isChord("F♯m7b5"), true, "F♯m7b5 is a chord after accidental normalization");
assertEqual(isChord("B♭/D"), true, "B♭/D is a slash chord after accidental normalization");
assertEqual(isChord("C/E"), true, "C/E is a slash chord");
assertEqual(isChord("G7sus4"), true, "G7sus4 is a chord");
assertEqual(isChord("hello"), false, "hello is not a chord");
assertEqual(isChord("Cmajor"), false, "Cmajor is not a chord in standard abbreviation");

// 2. Test transposeChord
assertEqual(transposeChord("C", 2, true), "D", "C + 2 = D");
assertEqual(transposeChord("C", -1, true), "B", "C - 1 = B");
assertEqual(transposeChord("Bb", 2, false), "C", "Bb + 2 = C");
assertEqual(transposeChord("G/B", 3, true), "A#/D", "G/B + 3 = A#/D (prefer sharps)");
assertEqual(transposeChord("G/B", 3, false), "Bb/D", "G/B + 3 = Bb/D (prefer flats)");
assertEqual(transposeChord("F#m7b5", 5, true), "Bm7b5", "F#m7b5 + 5 = Bm7b5");
assertEqual(transposeChord("F♯m7b5", 5, true), "Bm7b5", "F♯m7b5 + 5 = Bm7b5");
assertEqual(transposeChord("B♭/D", 2, false), "C/E", "B♭/D + 2 = C/E");

// 3. Test transposeKeySignature
assertEqual(transposeKeySignature("C", 2), "D", "Key C + 2 = D");
assertEqual(transposeKeySignature("Am", 5), "Dm", "Key Am + 5 = Dm");
assertEqual(transposeKeySignature("F#", 1), "G", "Key F# + 1 = G");

// 4. Test getAbcKey
assertEqual(getAbcKey("X:1\nT:Test\nK:G\nDEFG"), "G", "Extracts K:G");
assertEqual(getAbcKey("X:1\nT:Test\nK: F#m\nDEFG"), "F#m", "Extracts K: F#m with spaces");

// 5. Test transposeChordSheet (ChordPro)
const chordProInput = "[C]Hello [G]world\n[Am]This is [F]music";
const chordProExpected = "[D]Hello [A]world\n[Bm]This is [G]music";
assertEqual(transposeChordSheet(chordProInput, 2, true), chordProExpected, "Transposes ChordPro by 2 semitones");

// 6. Test transposeChordSheet (Line aligned)
const lineInput = "C      G      Am     F\nHello world this is music";
const lineExpected = "D      A      Bm     G\nHello world this is music";
assertEqual(transposeChordSheet(lineInput, 2, true), lineExpected, "Transposes line-aligned chords preserving spacing");

// 7. Test accidental recognition/repair layer
assertEqual(normalizeAccidentalSymbols("F♯m7 B♭ C♮"), "F#m7 Bb C", "Normalizes music accidentals to parser format");
assertEqual(parseChordName("B♭maj7")?.normalized, "Bbmaj7", "Parses normalized flat chord");
assertEqual(parseChordName("F♯m7/C♯")?.normalized, "F#m7/C#", "Parses normalized sharp slash chord");
assertEqual(
  applyVisualAccidentalsToChord("B6", [{ target: 'root', accidental: 'flat', replacesOcrText: true }]).normalized,
  "Bb",
  "Visual flat detector can correct OCR B6 into Bb"
);
assertEqual(
  applyVisualAccidentalsToChord("F?m7", [{ target: 'root', accidental: 'sharp', replacesOcrText: true }]).normalized,
  "F#m7",
  "Visual sharp detector can correct unknown OCR glyph into F#m7"
);
assertEqual(
  applyVisualAccidentalsToChord("C#/E6", [{ target: 'bass', accidental: 'flat', replacesOcrText: true }]).normalized,
  "C#/Eb",
  "Visual detector can correct slash bass accidental independently"
);

// 8. Test OpenCV-style accidental template matcher
function imageFromRows(rows: string[]): ImageDataLike {
  const width = rows[0].length;
  const height = rows.length;
  const data = new Uint8ClampedArray(width * height * 4);
  rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      const value = cell === '1' ? 0 : 255;
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    });
  });
  return { width, height, data };
}

const sharpTemplate = imageFromRows([
  "101",
  "111",
  "101",
]);
const sourceWithSharp = imageFromRows([
  "00000",
  "01010",
  "01110",
  "01010",
  "00000",
]);
const matches = detectAccidentalTemplates(
  sourceWithSharp,
  [{ accidental: 'sharp', image: sharpTemplate }],
  { threshold: 1 }
);
assertEqual(matches.length, 1, "Detects one sharp template match");
assertEqual(matches[0].accidental, "sharp", "Classifies the sharp template match");
assertEqual(`${matches[0].x},${matches[0].y}`, "1,1", "Locates the sharp template match");

console.log("\n🎉 All tests passed successfully!");

import { transposeChord, isChord, transposeChordSheet } from './chordTransposer';
import { transposeKeySignature, getAbcKey } from './abcTransposer';

function assertEqual(actual: any, expected: any, message: string) {
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

console.log("\n🎉 All tests passed successfully!");

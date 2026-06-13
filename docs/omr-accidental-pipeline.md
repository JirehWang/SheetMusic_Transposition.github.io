# OMR Accidental Pipeline

This project treats full-score OMR and accidental recognition as separate stages.

## Target Flow

```text
PDF or score image
  -> Audiveris batch transcription
  -> MusicXML / MXL output
  -> chord text extraction
  -> sharp / flat / natural visual detector
  -> chordRecognition parser and repair layer
  -> transposition
  -> render / export
```

## Audiveris Stage

Audiveris should run outside the static GitHub Pages app, either locally or in a small server-side worker.

```powershell
audiveris -batch -transcribe -export -output .\omr-output .\input.pdf
```

Expected output is compressed MusicXML (`.mxl`) or MusicXML (`.musicxml`) depending on export settings.

## Accidental Detection Stage

Do not rely on text OCR alone for chord accidentals. OCR often confuses small glyphs:

- `B♭` -> `B6`, `Bb`, or `B`
- `F♯m7` -> `F?m7`, `F#m7`, or `Fm7`
- bass notes such as `C/E♭` can fail independently from the root

The detector should output this project-level shape:

```ts
{
  target: 'root' | 'bass',
  accidental: 'sharp' | 'flat' | 'natural',
  replacesOcrText: true,
  confidence: 0.94
}
```

Current implementation:

- `src/utils/accidentalTemplateMatcher.ts`: dependency-free OpenCV-style template matcher for `ImageData`.
- `src/utils/chordRecognition.ts`: merges detector output with OCR chord text and validates the repaired chord.

Future YOLO implementation can replace the matcher as long as it emits the same detection shape.

## Parser Contract

All chord logic should use normalized parser symbols internally:

- `♯`, `＃`, `﹟` -> `#`
- `♭` -> `b`
- `♮` -> no accidental

Examples:

```ts
normalizeAccidentalSymbols('F♯m7 B♭ C♮') // 'F#m7 Bb C'
applyVisualAccidentalsToChord('B6', [
  { target: 'root', accidental: 'flat', replacesOcrText: true }
]).normalized // 'Bb'
```

The transposer now accepts both Unicode accidental signs and parser-style ASCII signs.

# GAS OMR Backend Contract

The web app now sends the original PDF to the configured Google Apps Script URL with:

```json
{
  "action": "omr_transcribe",
  "fileName": "song.pdf",
  "mimeType": "application/pdf",
  "fileBase64": "...",
  "output": "chordText"
}
```

GAS should return one of these JSON shapes:

```json
{ "ok": true, "title": "Song", "chordText": "C    G\nLyrics..." }
```

```json
{ "ok": true, "title": "Song", "type": "abc", "abc": "X:1\nK:C\nCDEF" }
```

```json
{ "ok": true, "title": "Song", "musicXml": "<?xml version=\"1.0\"?><score-partwise>...</score-partwise>" }
```

Use `gas/Code.gs` as the Apps Script web app. Set these Script Properties:

- `SPREADSHEET_ID`: optional for the existing save action.
- `OMR_SERVICE_URL`: required for real staff-notation reading.

GAS cannot execute Audiveris, OpenCV, or YOLO directly. It acts as the stable web endpoint and forwards the PDF to an HTTP OMR service that runs:

1. Audiveris for full staff recognition.
2. OpenCV or YOLO for accidental verification.
3. Chord parser validation.
4. A final output as `chordText`, `abc`, or `musicXml`.

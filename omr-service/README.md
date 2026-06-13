# SheetMusic Audiveris OMR Service

This is the real staff-notation backend for the GitHub Pages app.

Flow:

```text
Browser -> GAS Web App -> /transcribe here -> Audiveris -> MusicXML -> Browser ABC mode
```

## Local Docker Test

```bash
docker build -t sheetmusic-omr ./omr-service
docker run --rm -p 8080:8080 sheetmusic-omr
```

Health check:

```bash
curl http://localhost:8080/health
```

## Deploy

Deploy this container to Cloud Run, Render, Fly.io, Railway, or any host that supports Docker and long-running HTTP requests.

The public URL must expose:

```text
POST /transcribe
```

Request JSON:

```json
{
  "fileName": "song.pdf",
  "mimeType": "application/pdf",
  "fileBase64": "...",
  "output": "musicXml"
}
```

Response JSON:

```json
{
  "ok": true,
  "title": "song",
  "musicXml": "<?xml version=\"1.0\"?><score-partwise>...</score-partwise>"
}
```

After deployment, set the Apps Script property:

```text
OMR_SERVICE_URL=https://your-service.example.com/transcribe
```

GAS cannot run Audiveris itself; it forwards PDF files to this service.

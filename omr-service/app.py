import base64
import os
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


class OmrRequest(BaseModel):
    fileName: str = "sheet-music.pdf"
    mimeType: str = "application/pdf"
    fileBase64: str
    output: str = "musicXml"


app = FastAPI(title="SheetMusic Audiveris OMR Service")


def find_audiveris() -> str:
    configured = os.environ.get("AUDIVERIS_BIN")
    candidates = [
        configured,
        shutil.which("audiveris"),
        shutil.which("Audiveris"),
        "/opt/audiveris/bin/Audiveris",
        "/opt/Audiveris/bin/Audiveris",
        "/usr/bin/audiveris",
    ]

    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate

    raise RuntimeError("Audiveris executable not found. Set AUDIVERIS_BIN.")


def extract_musicxml(path: Path) -> str:
    if path.suffix.lower() == ".mxl":
        with zipfile.ZipFile(path) as archive:
            xml_names = [
                name for name in archive.namelist()
                if name.lower().endswith((".musicxml", ".xml")) and not name.startswith("META-INF/")
            ]
            if not xml_names:
                raise RuntimeError("Audiveris produced MXL without a MusicXML file.")
            return archive.read(xml_names[0]).decode("utf-8", errors="replace")

    return path.read_text(encoding="utf-8", errors="replace")


def newest_musicxml(output_dir: Path) -> Optional[Path]:
    candidates = list(output_dir.rglob("*.mxl"))
    candidates += list(output_dir.rglob("*.musicxml"))
    candidates += [
        path for path in output_dir.rglob("*.xml")
        if "META-INF" not in path.parts
    ]

    if not candidates:
        return None

    return max(candidates, key=lambda path: path.stat().st_mtime)


@app.get("/health")
def health():
    try:
        audiveris = find_audiveris()
        return {"ok": True, "audiveris": audiveris}
    except Exception as error:
        return {"ok": False, "error": str(error)}


@app.post("/transcribe")
def transcribe(request: OmrRequest):
    if request.mimeType != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF input is supported for this endpoint.")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        input_path = tmp_dir / request.fileName
        output_dir = tmp_dir / "out"
        output_dir.mkdir()

        try:
            input_path.write_bytes(base64.b64decode(request.fileBase64))
        except Exception as error:
            raise HTTPException(status_code=400, detail=f"Invalid fileBase64: {error}") from error

        command = [
            find_audiveris(),
            "-batch",
            "-transcribe",
            "-export",
            "-output",
            str(output_dir),
            str(input_path),
        ]
        result = subprocess.run(
            command,
            cwd=tmp_dir,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=int(os.environ.get("AUDIVERIS_TIMEOUT_SECONDS", "180")),
            check=False,
        )

        if result.returncode != 0:
            raise HTTPException(
                status_code=502,
                detail={
                    "message": "Audiveris failed.",
                    "log": result.stdout[-4000:],
                },
            )

        musicxml_path = newest_musicxml(output_dir)
        if not musicxml_path:
            raise HTTPException(
                status_code=502,
                detail={
                    "message": "Audiveris completed but did not export MusicXML/MXL.",
                    "log": result.stdout[-4000:],
                },
            )

        return {
            "ok": True,
            "title": Path(request.fileName).stem,
            "musicXml": extract_musicxml(musicxml_path),
            "audiverisLog": result.stdout[-4000:],
        }

import { musicXmlToAbc, musicXmlToChordSheet } from './musicXmlToChordSheet';

export interface GasOmrResponse {
  ok: boolean;
  title?: string;
  type?: 'chord' | 'abc';
  text?: string;
  content?: string;
  chordText?: string;
  abc?: string;
  musicXml?: string;
  error?: string;
  message?: string;
  data?: GasOmrResponse;
}

export interface NormalizedOmrResult {
  title?: string;
  type: 'chord' | 'abc';
  text: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function normalizeGasOmrResponse(response: GasOmrResponse): NormalizedOmrResult {
  const payload = response.data || response;

  if (!payload.ok && (payload.error || payload.message)) {
    throw new Error(payload.error || payload.message);
  }

  const abc = payload.abc || (payload.type === 'abc' ? payload.content || payload.text : '');
  if (abc) {
    return {
      title: payload.title,
      type: 'abc',
      text: abc,
    };
  }

  const chordText = payload.chordText || payload.text || payload.content;
  if (chordText) {
    return {
      title: payload.title,
      type: payload.type === 'abc' ? 'abc' : 'chord',
      text: chordText,
    };
  }

  if (payload.musicXml) {
    const chordText = musicXmlToChordSheet(payload.musicXml);
    if (chordText) {
      return {
        title: payload.title,
        type: 'chord',
        text: chordText,
      };
    }

    return {
      title: payload.title,
      type: 'abc',
      text: musicXmlToAbc(payload.musicXml, payload.title),
    };
  }

  throw new Error('GAS 讀譜完成，但沒有回傳可轉調的 chordText、ABC 或 MusicXML。');
}

export async function transcribePdfWithGas(gasUrl: string, file: File): Promise<NormalizedOmrResult> {
  const maxBytes = 18 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('PDF 檔案太大。GAS 讀譜建議先控制在 18MB 以內。');
  }

  const fileBase64 = arrayBufferToBase64(await file.arrayBuffer());
  const response = await fetch(gasUrl, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'omr_transcribe',
      fileName: file.name,
      mimeType: file.type || 'application/pdf',
      fileBase64,
      output: 'chordText',
    }),
  });

  const rawText = await response.text();
  let json: GasOmrResponse;

  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(`GAS 回傳不是 JSON：${rawText.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(json.error || json.message || `GAS HTTP ${response.status}`);
  }

  return normalizeGasOmrResponse(json);
}

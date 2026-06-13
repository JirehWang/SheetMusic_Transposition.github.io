import { isChord } from './chordTransposer';

export type PdfTextQualityReason =
  | 'empty'
  | 'too_short'
  | 'mostly_page_noise'
  | 'not_enough_music_text';

export interface PdfTextQualityAssessment {
  ok: boolean;
  reason?: PdfTextQualityReason;
  message?: string;
  stats: {
    totalLines: number;
    meaningfulLines: number;
    tokens: number;
    chordTokens: number;
    lyricLikeTokens: number;
    noiseLines: number;
  };
}

const PAGE_NOISE_PATTERNS = [
  /^https?:\/\//i,
  /^\d+$/,
  /^\d+\s*\/\s*\d+$/,
  /^\d{4}\/\d{1,2}\/\d{1,2}/,
  /SheetMusic\s+Transpose/i,
  /github\.io/i,
];

function isPageNoiseLine(line: string): boolean {
  const value = line.trim();
  return value === '' || PAGE_NOISE_PATTERNS.some(pattern => pattern.test(value));
}

function fail(
  reason: PdfTextQualityReason,
  stats: PdfTextQualityAssessment['stats'],
): PdfTextQualityAssessment {
  const messages: Record<PdfTextQualityReason, string> = {
    empty: '這份 PDF 沒有可直接擷取的文字層。五線譜或掃描譜需要先用 Audiveris 這類 OMR 讀成 MusicXML，再做轉調。',
    too_short: '目前只擷取到很少文字，內容不足以判斷為和弦譜；已停止轉換，避免產生錯誤譜。',
    mostly_page_noise: '目前擷取到的多半是頁碼、網址或列印頁眉，不是真正的和弦/歌詞內容；已停止轉換。',
    not_enough_music_text: '目前擷取結果不像可直接轉調的和弦譜。若這是五線譜，請先用 Audiveris/OCR 讀譜流程轉成 MusicXML 或文字和弦譜。',
  };

  return {
    ok: false,
    reason,
    message: messages[reason],
    stats,
  };
}

export function assessExtractedPdfText(text: string): PdfTextQualityAssessment {
  const allLines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const meaningfulLines = allLines.filter(line => !isPageNoiseLine(line));
  const tokens = meaningfulLines.flatMap(line => line.split(/\s+/).filter(Boolean));
  const chordTokens = tokens.filter(token => isChord(token));
  const lyricLikeTokens = tokens.filter(token => /[A-Za-z\u4e00-\u9fff]/.test(token));
  const stats = {
    totalLines: allLines.length,
    meaningfulLines: meaningfulLines.length,
    tokens: tokens.length,
    chordTokens: chordTokens.length,
    lyricLikeTokens: lyricLikeTokens.length,
    noiseLines: allLines.length - meaningfulLines.length,
  };

  if (text.trim().length === 0 || allLines.length === 0) {
    return fail('empty', stats);
  }

  if (meaningfulLines.length < 2 || meaningfulLines.join('').length < 20) {
    return fail('too_short', stats);
  }

  if (stats.noiseLines > stats.meaningfulLines * 2) {
    return fail('mostly_page_noise', stats);
  }

  if (stats.chordTokens === 0 && stats.lyricLikeTokens < 8) {
    return fail('not_enough_music_text', stats);
  }

  return { ok: true, stats };
}

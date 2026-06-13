import type { Accidental } from './chordRecognition';

export interface ImageDataLike {
  width: number;
  height: number;
  data: Uint8ClampedArray | number[];
}

export interface AccidentalTemplate {
  accidental: Accidental;
  image: ImageDataLike;
}

export interface TemplateMatch {
  accidental: Accidental;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface TemplateMatchOptions {
  threshold?: number;
  stride?: number;
  maxMatches?: number;
}

function pixelDarkness(image: ImageDataLike, x: number, y: number): number {
  const offset = (y * image.width + x) * 4;
  const r = image.data[offset] ?? 255;
  const g = image.data[offset + 1] ?? r;
  const b = image.data[offset + 2] ?? r;
  return 1 - (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function matchTemplateAt(source: ImageDataLike, template: ImageDataLike, startX: number, startY: number): number {
  let same = 0;
  let total = 0;

  for (let y = 0; y < template.height; y++) {
    for (let x = 0; x < template.width; x++) {
      const sourceDark = pixelDarkness(source, startX + x, startY + y) > 0.5;
      const templateDark = pixelDarkness(template, x, y) > 0.5;
      if (sourceDark === templateDark) same++;
      total++;
    }
  }

  return total === 0 ? 0 : same / total;
}

function overlaps(a: TemplateMatch, b: TemplateMatch): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

export function detectAccidentalTemplates(
  source: ImageDataLike,
  templates: AccidentalTemplate[],
  options: TemplateMatchOptions = {}
): TemplateMatch[] {
  const threshold = options.threshold ?? 0.86;
  const stride = options.stride ?? 1;
  const maxMatches = options.maxMatches ?? 20;
  const candidates: TemplateMatch[] = [];

  for (const template of templates) {
    const maxY = source.height - template.image.height;
    const maxX = source.width - template.image.width;
    if (maxX < 0 || maxY < 0) continue;

    for (let y = 0; y <= maxY; y += stride) {
      for (let x = 0; x <= maxX; x += stride) {
        const confidence = matchTemplateAt(source, template.image, x, y);
        if (confidence >= threshold) {
          candidates.push({
            accidental: template.accidental,
            x,
            y,
            width: template.image.width,
            height: template.image.height,
            confidence,
          });
        }
      }
    }
  }

  return candidates
    .sort((a, b) => b.confidence - a.confidence)
    .reduce<TemplateMatch[]>((matches, candidate) => {
      if (matches.length >= maxMatches) return matches;
      if (!matches.some(match => overlaps(match, candidate))) {
        matches.push(candidate);
      }
      return matches;
    }, []);
}

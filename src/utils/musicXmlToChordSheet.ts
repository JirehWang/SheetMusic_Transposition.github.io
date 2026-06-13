const ALTER_TO_ACCIDENTAL: Record<string, string> = {
  '-2': 'bb',
  '-1': 'b',
  '0': '',
  '1': '#',
  '2': '##',
};

const KIND_TO_SUFFIX: Record<string, string> = {
  major: '',
  minor: 'm',
  augmented: 'aug',
  diminished: 'dim',
  dominant: '7',
  'major-seventh': 'maj7',
  'minor-seventh': 'm7',
  'diminished-seventh': 'dim7',
  'half-diminished': 'm7b5',
  suspended: 'sus',
};

function childText(parent: Element, tagName: string): string {
  return parent.getElementsByTagName(tagName)[0]?.textContent?.trim() || '';
}

function harmonyToChord(harmony: Element): string {
  const root = harmony.getElementsByTagName('root')[0];
  if (!root) return '';

  const rootStep = childText(root, 'root-step');
  const rootAlter = childText(root, 'root-alter');
  const kindNode = harmony.getElementsByTagName('kind')[0];
  const kindValue = kindNode?.getAttribute('text') || kindNode?.textContent?.trim() || '';
  const bass = harmony.getElementsByTagName('bass')[0];

  let chord = `${rootStep}${ALTER_TO_ACCIDENTAL[rootAlter] ?? ''}`;
  chord += KIND_TO_SUFFIX[kindValue] ?? kindValue.replace(/\s+/g, '');

  if (bass) {
    const bassStep = childText(bass, 'bass-step');
    const bassAlter = childText(bass, 'bass-alter');
    if (bassStep) {
      chord += `/${bassStep}${ALTER_TO_ACCIDENTAL[bassAlter] ?? ''}`;
    }
  }

  return chord;
}

export function musicXmlToChordSheet(musicXml: string): string {
  if (typeof DOMParser === 'undefined') {
    throw new Error('MusicXML parsing requires a browser DOMParser.');
  }

  const doc = new DOMParser().parseFromString(musicXml, 'application/xml');
  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('GAS returned invalid MusicXML.');
  }

  const measures = Array.from(doc.getElementsByTagName('measure'));
  const lines: string[] = [];

  for (const measure of measures) {
    const chords = Array.from(measure.getElementsByTagName('harmony'))
      .map(harmonyToChord)
      .filter(Boolean);
    const lyrics = Array.from(measure.getElementsByTagName('lyric'))
      .map(lyric => childText(lyric, 'text'))
      .filter(Boolean);

    if (chords.length > 0) {
      lines.push(chords.join('    '));
    }
    if (lyrics.length > 0) {
      lines.push(lyrics.join(' '));
    }
  }

  return lines.join('\n').trim();
}

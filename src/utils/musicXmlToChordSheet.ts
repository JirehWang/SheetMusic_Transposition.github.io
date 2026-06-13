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

function parseMusicXml(musicXml: string): Document {
  if (typeof DOMParser === 'undefined') {
    throw new Error('MusicXML parsing requires a browser DOMParser.');
  }

  const doc = new DOMParser().parseFromString(musicXml, 'application/xml');
  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('GAS returned invalid MusicXML.');
  }

  return doc;
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
  const doc = parseMusicXml(musicXml);
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

function keyFifthsToAbc(fifths: string): string {
  const value = Number.parseInt(fifths, 10);
  const keys = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
  return keys[value + 7] || 'C';
}

function pitchToAbc(note: Element): string {
  const pitch = note.getElementsByTagName('pitch')[0];
  if (!pitch) return 'z';

  const step = childText(pitch, 'step');
  const alter = childText(pitch, 'alter');
  const octave = Number.parseInt(childText(pitch, 'octave') || '4', 10);
  const accidental = alter === '1' ? '^' : alter === '-1' ? '_' : alter === '2' ? '^^' : alter === '-2' ? '__' : '';
  const base = octave >= 5 ? step.toLowerCase() : step;
  const octaveMarks = octave > 5
    ? "'".repeat(octave - 5)
    : octave < 4
      ? ','.repeat(4 - octave)
      : '';

  return `${accidental}${base}${octaveMarks}`;
}

function durationToAbc(duration: number, divisions: number): string {
  if (!duration || !divisions) return '';

  const eighths = duration / divisions * 2;
  if (Math.abs(eighths - 1) < 0.01) return '';
  if (Number.isInteger(eighths)) return String(eighths);

  const denominator = Math.round(1 / eighths);
  return denominator > 1 ? `/${denominator}` : '';
}

export function musicXmlToAbc(musicXml: string, title = 'Audiveris OMR'): string {
  const doc = parseMusicXml(musicXml);
  const scoreTitle = childText(doc.documentElement, 'movement-title') || title;
  const measures = Array.from(doc.getElementsByTagName('measure'));
  let divisions = 1;
  let key = 'C';
  let meter = '4/4';

  const lines = [
    'X:1',
    `T:${scoreTitle}`,
  ];
  const body: string[] = [];

  for (const measure of measures) {
    const attributes = measure.getElementsByTagName('attributes')[0];
    if (attributes) {
      const nextDivisions = childText(attributes, 'divisions');
      if (nextDivisions) divisions = Number.parseFloat(nextDivisions) || divisions;

      const fifths = childText(attributes, 'fifths');
      if (fifths) key = keyFifthsToAbc(fifths);

      const beats = childText(attributes, 'beats');
      const beatType = childText(attributes, 'beat-type');
      if (beats && beatType) meter = `${beats}/${beatType}`;
    }

    const notes = Array.from(measure.children).filter(child => child.tagName === 'note');
    const measureNotes = notes.map(note => {
      const isRest = note.getElementsByTagName('rest').length > 0;
      const duration = Number.parseFloat(childText(note, 'duration')) || divisions;
      const symbol = isRest ? 'z' : pitchToAbc(note);
      return `${symbol}${durationToAbc(duration, divisions)}`;
    });

    if (measureNotes.length > 0) {
      body.push(`${measureNotes.join(' ')} |`);
    }
  }

  lines.push(`M:${meter}`);
  lines.push('L:1/8');
  lines.push(`K:${key}`);
  lines.push(body.join('\n'));

  return lines.join('\n').trim();
}

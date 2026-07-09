export interface DecodedTextFile {
  text: string;
  encoding: string;
  hadReplacementCharacters: boolean;
}

function hasReplacementCharacters(text: string) {
  return text.includes('\uFFFD');
}

function decodeBuffer(buffer: ArrayBuffer, encoding: string, fatal = false) {
  return new TextDecoder(encoding, { fatal }).decode(buffer);
}

export function decodeTextBuffer(buffer: ArrayBuffer): DecodedTextFile {
  const attempts = [
    { encoding: 'utf-8', fatal: true },
    { encoding: 'windows-1252', fatal: false },
    { encoding: 'iso-8859-1', fatal: false },
    { encoding: 'utf-8', fatal: false },
  ];

  for (const attempt of attempts) {
    try {
      const text = decodeBuffer(buffer, attempt.encoding, attempt.fatal);
      const hadReplacementCharacters = hasReplacementCharacters(text);
      if (!hadReplacementCharacters || attempt.encoding === 'utf-8') return { text, encoding: attempt.encoding, hadReplacementCharacters };
    } catch {
      // Try the next supported browser decoder.
    }
  }

  const text = decodeBuffer(buffer, 'utf-8', false);
  return { text, encoding: 'utf-8-fallback', hadReplacementCharacters: hasReplacementCharacters(text) };
}

export async function decodeTextFile(file: File): Promise<DecodedTextFile> {
  return decodeTextBuffer(await file.arrayBuffer());
}

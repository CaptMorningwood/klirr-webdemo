export function normalizeText(desc: string) {
  return (desc || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9åäö ]/gi, ' ')
    .replace(/\b\d{4,}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function merchantKey(desc: string) {
  let n = normalizeText(desc);
  n = n
    .replace(/\bab\b/g, '')
    .replace(/\baktiebolag\b/g, '')
    .replace(/\bsverige\b/g, '')
    .replace(/\bse\b/g, '')
    .replace(/\bkortköp\b/g, '')
    .replace(/\bautogiro\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return n;
}

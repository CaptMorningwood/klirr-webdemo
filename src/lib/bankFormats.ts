import { normalizeText } from './normalize';

export type BankKey = 'auto' | 'generic' | 'swedbank' | 'seb' | 'handelsbanken' | 'nordea';
export type SupportedBankKey = Exclude<BankKey, 'auto'>;

export interface BankFormatDefinition {
  key: SupportedBankKey;
  label: string;
  headerMatchers: string[];
  columnAliases: {
    date: string[];
    description: string[];
    amount: string[];
    balance?: string[];
    counterparty?: string[];
    reference?: string[];
  };
  metadataRows?: string[];
  amountSignRules?: 'signedAmount' | 'debitCreditColumns';
}

export const BANK_FORMAT_DEFINITIONS: BankFormatDefinition[] = [
  {
    key: 'generic',
    label: 'Generiskt CSV',
    headerMatchers: ['datum', 'date', 'belopp', 'amount', 'beskrivning', 'description'],
    columnAliases: {
      date: ['datum', 'date', 'transaktionsdatum', 'transaction date', 'bokföringsdatum', 'bokföringsdag', 'booking date', 'valutadag'],
      description: ['beskrivning', 'description', 'text', 'transaktion', 'mottagare', 'avsändare', 'namn', 'referens', 'meddelande'],
      amount: ['belopp', 'amount', 'summa', 'uttag', 'insättning'],
      balance: ['saldo', 'balance', 'bokfört saldo'],
      counterparty: ['motpart', 'mottagare', 'avsändare', 'counterparty', 'namn'],
      reference: ['referens', 'reference', 'meddelande', 'verifikationsnummer'],
    },
    amountSignRules: 'signedAmount',
  },
  {
    key: 'swedbank',
    label: 'Swedbank',
    headerMatchers: ['clearingnummer', 'kontonummer', 'bokfört saldo', 'transaktionsdag', 'radnummer'],
    columnAliases: {
      date: ['bokföringsdag', 'bokfört datum', 'transaktionsdag', 'valutadag', 'datum'],
      description: ['beskrivning', 'namn', 'mottagare', 'avsändare', 'text'],
      amount: ['belopp', 'summa'],
      balance: ['bokfört saldo', 'saldo'],
      counterparty: ['namn', 'mottagare', 'avsändare'],
      reference: ['referens', 'meddelande'],
    },
    metadataRows: ['clearingnummer', 'kontonummer'],
    amountSignRules: 'signedAmount',
  },
  {
    key: 'seb',
    label: 'SEB',
    headerMatchers: ['verifikationsnummer', 'bokföringsdatum', 'valutadatum', 'saldo'],
    columnAliases: {
      date: ['bokföringsdatum', 'valutadatum', 'datum'],
      description: ['text', 'beskrivning', 'mottagare', 'avsändare'],
      amount: ['belopp', 'summa'],
      balance: ['saldo'],
      reference: ['verifikationsnummer', 'referens'],
    },
    amountSignRules: 'signedAmount',
  },
  {
    key: 'handelsbanken',
    label: 'Handelsbanken',
    headerMatchers: ['bokföringsdag', 'text', 'saldo', 'handelsbanken'],
    columnAliases: {
      date: ['bokföringsdag', 'transaktionsdag', 'datum'],
      description: ['text', 'beskrivning', 'mottagare'],
      amount: ['belopp', 'summa'],
      balance: ['saldo'],
      reference: ['referens'],
    },
    amountSignRules: 'signedAmount',
  },
  {
    key: 'nordea',
    label: 'Nordea',
    headerMatchers: ['booking date', 'value date', 'transaction text', 'bokföringsdag'],
    columnAliases: {
      date: ['booking date', 'bokföringsdag', 'datum', 'value date'],
      description: ['transaction text', 'text', 'beskrivning', 'message'],
      amount: ['amount', 'belopp', 'summa'],
      balance: ['balance', 'saldo'],
      reference: ['reference', 'referens', 'archive code'],
    },
    amountSignRules: 'signedAmount',
  },
];

export const BANK_FORMATS: { key: BankKey; label: string }[] = [
  { key: 'auto', label: 'Auto-detektera' },
  ...BANK_FORMAT_DEFINITIONS.map(({ key, label }) => ({ key, label })),
];

export function bankFormatByKey(key: BankKey): BankFormatDefinition {
  if (key === 'auto') return BANK_FORMAT_DEFINITIONS[0];
  return BANK_FORMAT_DEFINITIONS.find(format => format.key === key) || BANK_FORMAT_DEFINITIONS[0];
}

export function canonicalHeader(header: string) {
  return normalizeText(header).replace(/�/g, '').trim();
}

export function findColumnIndex(headers: string[], aliases: string[] = []) {
  const normalizedHeaders = headers.map(canonicalHeader);
  const normalizedAliases = aliases.map(canonicalHeader);
  return normalizedHeaders.findIndex(header => normalizedAliases.some(alias => header === alias || header.includes(alias) || alias.includes(header)));
}

export function supportedBankFormats() {
  return BANK_FORMAT_DEFINITIONS.map(({ key, label }) => ({ key, label }));
}

// TODO: Add adapters for Danske Bank, ICA Banken, Länsförsäkringar Bank, Skandiabanken, Revolut and Lunar.

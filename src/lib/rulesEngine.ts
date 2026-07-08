import type { CostType, Rule } from '../types';
import { normalizeText } from './normalize';

const DEFAULT_RULES: Array<{ kw: string; category: string; costType: CostType }> = [
  { kw: 'hyra', category: 'Hyra', costType: 'fixed' },
  { kw: 'bostad', category: 'Hyra', costType: 'fixed' },
  { kw: 'hemlyftet', category: 'Hyra', costType: 'fixed' },
  { kw: 'elbolaget', category: 'El', costType: 'fixed' },
  { kw: 'vattenfall', category: 'El', costType: 'fixed' },
  { kw: 'fortum', category: 'El', costType: 'fixed' },
  { kw: 'bredband', category: 'Internet', costType: 'fixed' },
  { kw: 'fiber', category: 'Internet', costType: 'fixed' },
  { kw: 'telia', category: 'Telefoni/streaming', costType: 'fixed' },
  { kw: 'försäkring', category: 'Försäkring', costType: 'fixed' },
  { kw: 'trygghem', category: 'Försäkring', costType: 'fixed' },
  { kw: 'lån', category: 'Lån/skuld', costType: 'fixed' },
  { kw: 'finans', category: 'Lån/skuld', costType: 'fixed' },
  { kw: 'inkasso', category: 'Skuld/inkasso', costType: 'variable' },
  { kw: 'kronofogden', category: 'Skuld/inkasso', costType: 'variable' },
  { kw: 'garage', category: 'Bil/transport', costType: 'fixed' },
  { kw: 'parkering', category: 'Bil/transport', costType: 'variable' },
  { kw: 'parkera', category: 'Bil/transport', costType: 'variable' },
  { kw: 'bränsle', category: 'Bil/transport', costType: 'variable' },
  { kw: 'gym', category: 'Träning', costType: 'fixed' },
  { kw: 'tränings', category: 'Träning', costType: 'fixed' },
  { kw: 'mat', category: 'Mat och hushåll', costType: 'variable' },
  { kw: 'ica', category: 'Mat och hushåll', costType: 'variable' },
  { kw: 'willys', category: 'Mat och hushåll', costType: 'variable' },
  { kw: 'coop', category: 'Mat och hushåll', costType: 'variable' },
  { kw: 'matboden', category: 'Mat och hushåll', costType: 'variable' },
  { kw: 'kvartersbutiken', category: 'Mat och hushåll', costType: 'variable' },
  { kw: 'storköp', category: 'Mat och hushåll', costType: 'variable' },
  { kw: 'restaurang', category: 'Restaurang/nöje', costType: 'variable' },
  { kw: 'kafé', category: 'Fika/nöje', costType: 'variable' },
  { kw: 'top up', category: 'Intern överföring', costType: 'transfer' },
  { kw: 'top-up', category: 'Intern överföring', costType: 'transfer' },
  { kw: 'överföring', category: 'Intern överföring', costType: 'transfer' },
  { kw: 'insättning från', category: 'Intern överföring', costType: 'transfer' },
  { kw: 'avanza', category: 'Sparande', costType: 'transfer' },
  { kw: 'lön', category: 'Lön', costType: 'income' },
  { kw: 'lon', category: 'Lön', costType: 'income' },
  { kw: 'salary', category: 'Lön', costType: 'income' },
  { kw: 'arbetsgivare', category: 'Lön', costType: 'income' },
  { kw: 'barnbidrag', category: 'Barnbidrag', costType: 'income' },
  { kw: 'försäkringskassan', category: 'Försäkringskassan', costType: 'income' },
  { kw: 'forsakringskassan', category: 'Försäkringskassan', costType: 'income' },
  { kw: 'csn', category: 'CSN', costType: 'income' },
  { kw: 'pension', category: 'Pension', costType: 'income' },
  { kw: 'skatteverket', category: 'Skatteverket', costType: 'income' },
  { kw: 'återbetalning skatt', category: 'Skatteverket', costType: 'income' },
  { kw: 'sjukpenning', category: 'Försäkringskassan', costType: 'income' },
  { kw: 'föräldrapenning', category: 'Försäkringskassan', costType: 'income' },
];

export function categorize(descriptionOrNorm: string, rules: Rule[]) {
  const norm = normalizeText(descriptionOrNorm);
  for (const rule of rules) {
    if (!rule.matchText.trim()) continue;
    const match = normalizeText(rule.matchText);
    if (norm.includes(match)) {
      return { category: rule.category, costType: rule.costType, source: 'user-rule' as const };
    }
  }
  for (const rule of DEFAULT_RULES) {
    if (norm.includes(rule.kw)) {
      return { category: rule.category, costType: rule.costType, source: 'default' as const };
    }
  }
  return { category: 'Okategoriserad', costType: 'variable' as CostType, source: 'none' as const };
}

export function isLikelyTransferText(description: string) {
  const n = normalizeText(description);
  return ['top up', 'topup', 'överföring', 'insättning från', 'till eget konto', 'avanza'].some(k => n.includes(k));
}

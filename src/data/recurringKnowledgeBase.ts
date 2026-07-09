import type { CostType, Frequency } from '../types';

export type RecurringLikelihood = 'high' | 'medium' | 'low' | 'irregular';
export type ConfirmBehavior = 'pending' | 'suggest_confirm' | 'ignore_as_income';

export interface RecurringKnowledgeEntry {
  id: string;
  category: string;
  costType: CostType;
  recurringLikelihood: RecurringLikelihood;
  keywords: string[];
  excludeKeywords?: string[];
  typicalFrequency: Frequency[];
  confirmBehavior: ConfirmBehavior;
  minActionableAmount?: number;
  explanation: string;
}

export const recurringKnowledgeBase: RecurringKnowledgeEntry[] = [
  { id: 'income_salary', category: 'Lön', costType: 'income', recurringLikelihood: 'high', keywords: ['lön', 'lon', 'salary', 'arbetsgivare', 'utbetalning lön'], excludeKeywords: ['återbetalning', 'refund', 'retur', 'kreditering'], typicalFrequency: ['monthly'], confirmBehavior: 'pending', minActionableAmount: 1000, explanation: 'Vanlig månadsinkomst.' },
  { id: 'income_child_benefit', category: 'Barnbidrag', costType: 'income', recurringLikelihood: 'high', keywords: ['barnbidrag'], typicalFrequency: ['monthly'], confirmBehavior: 'pending', minActionableAmount: 1000, explanation: 'Vanlig återkommande familjeinkomst.' },
  { id: 'income_csn', category: 'CSN', costType: 'income', recurringLikelihood: 'high', keywords: ['csn', 'studiemedel', 'studiebidrag'], typicalFrequency: ['monthly'], confirmBehavior: 'pending', minActionableAmount: 1000, explanation: 'Vanlig studierelaterad inkomst.' },
  { id: 'income_pension', category: 'Pension', costType: 'income', recurringLikelihood: 'high', keywords: ['pension', 'pensionsmyndigheten'], typicalFrequency: ['monthly'], confirmBehavior: 'pending', minActionableAmount: 1000, explanation: 'Vanlig återkommande pension.' },
  { id: 'income_social_insurance', category: 'Försäkringskassan', costType: 'income', recurringLikelihood: 'high', keywords: ['försäkringskassan', 'forsakringskassan', 'sjukpenning', 'föräldrapenning', 'foraldrapenning', 'aktivitetsstöd', 'aktivitetsstod', 'bostadsbidrag'], typicalFrequency: ['monthly'], confirmBehavior: 'pending', minActionableAmount: 1000, explanation: 'Vanlig ersättning/bidrag som kan vara återkommande.' },
  { id: 'income_tax_refund', category: 'Skatteverket', costType: 'income', recurringLikelihood: 'irregular', keywords: ['skatteverket', 'skatteåterbäring', 'skatteaterbaring', 'återbetalning skatt'], typicalFrequency: ['yearly', 'irregular'], confirmBehavior: 'pending', minActionableAmount: 1000, explanation: 'Ofta engångs-/årsvis pluspost, inte normal månadsinkomst utan bekräftelse.' },
  { id: 'income_insurance_compensation', category: 'Försäkringsersättning', costType: 'income', recurringLikelihood: 'irregular', keywords: ['försäkringsersättning', 'forsakringsersattning', 'ersättning försäkring'], typicalFrequency: ['irregular'], confirmBehavior: 'pending', minActionableAmount: 3000, explanation: 'Ofta oregelbunden ersättning.' },

  { id: 'housing_rent', category: 'Hyra', costType: 'fixed', recurringLikelihood: 'high', keywords: ['hyra', 'bostadshyra', 'bostadsrättsavgift', 'brf avgift', 'månadsavgift', 'hemlyftet'], typicalFrequency: ['monthly'], confirmBehavior: 'pending', minActionableAmount: 100, explanation: 'Vanlig fast boendekostnad.' },
  { id: 'housing_mortgage', category: 'Bolån/skuld', costType: 'fixed', recurringLikelihood: 'high', keywords: ['bolån', 'bolan', 'ränta', 'ranta', 'amortering', 'hypotek'], typicalFrequency: ['monthly', 'quarterly'], confirmBehavior: 'pending', minActionableAmount: 100, explanation: 'Vanlig återkommande lånekostnad.' },
  { id: 'housing_storage_parking', category: 'Boende/parkering', costType: 'fixed', recurringLikelihood: 'medium', keywords: ['garage', 'parkeringsplats', 'p-plats', 'förråd', 'forrad'], typicalFrequency: ['monthly'], confirmBehavior: 'pending', minActionableAmount: 100, explanation: 'Kan vara återkommande boenderelaterad kostnad.' },

  { id: 'utilities_power', category: 'El', costType: 'fixed', recurringLikelihood: 'high', keywords: ['elbolaget', 'elhandel', 'elnät', 'elnat', 'vattenfall', 'fortum', 'eon', 'göta energi', 'gota energi'], typicalFrequency: ['monthly', 'quarterly'], confirmBehavior: 'pending', minActionableAmount: 100, explanation: 'Vanlig återkommande el-/elnätskostnad.' },
  { id: 'utilities_water_heat', category: 'Värme/vatten', costType: 'fixed', recurringLikelihood: 'medium', keywords: ['vatten', 'fjärrvärme', 'fjarrvarme', 'värme', 'varme', 'gas'], typicalFrequency: ['monthly', 'quarterly'], confirmBehavior: 'pending', minActionableAmount: 100, explanation: 'Kan vara återkommande driftkostnad.' },

  { id: 'insurance', category: 'Försäkring', costType: 'fixed', recurringLikelihood: 'high', keywords: ['försäkring', 'forsakring', 'hemförsäkring', 'bilförsäkring', 'barnförsäkring', 'livförsäkring', 'olycksfallsförsäkring', 'djurförsäkring', 'trygghem'], typicalFrequency: ['monthly', 'quarterly', 'yearly'], confirmBehavior: 'pending', minActionableAmount: 100, explanation: 'Vanlig fast försäkringskostnad.' },

  { id: 'communication_internet', category: 'Internet', costType: 'fixed', recurringLikelihood: 'high', keywords: ['bredband', 'fiber', 'internet', 'internetleverantör', 'internetleverantor', 'bahnhof'], typicalFrequency: ['monthly'], confirmBehavior: 'pending', minActionableAmount: 100, explanation: 'Vanlig återkommande internetkostnad.' },
  { id: 'communication_mobile_tv', category: 'Telefoni/streaming', costType: 'fixed', recurringLikelihood: 'high', keywords: ['mobil', 'telefoni', 'telia', 'tele2', 'telenor', 'tre', 'comhem', 'tv abonnemang', 'streaming'], typicalFrequency: ['monthly'], confirmBehavior: 'pending', minActionableAmount: 100, explanation: 'Vanlig återkommande telekom-/abonnemangskostnad.' },

  { id: 'debt_loans', category: 'Lån/skuld', costType: 'fixed', recurringLikelihood: 'high', keywords: ['privatlån', 'privatlan', 'billån', 'billan', 'kreditkortsfaktura', 'finans', 'avbetalning', 'leasing', 'företagslån', 'foretagslan'], typicalFrequency: ['monthly'], confirmBehavior: 'pending', minActionableAmount: 100, explanation: 'Vanlig återkommande skuld-/lånekostnad.' },
  { id: 'debt_collection', category: 'Skuld/inkasso', costType: 'fixed', recurringLikelihood: 'medium', keywords: ['inkasso', 'kronofogden'], typicalFrequency: ['monthly', 'irregular'], confirmBehavior: 'pending', minActionableAmount: 100, explanation: 'Viktig skuldpost att granska.' },

  { id: 'membership_union', category: 'Fack/a-kassa', costType: 'fixed', recurringLikelihood: 'high', keywords: ['fack', 'a-kassa', 'akassa', 'arbetslöshetskassa', 'medlemsavgift'], typicalFrequency: ['monthly'], confirmBehavior: 'pending', minActionableAmount: 100, explanation: 'Vanlig medlemskostnad.' },
  { id: 'membership_gym', category: 'Träning', costType: 'fixed', recurringLikelihood: 'high', keywords: ['gym', 'tränings', 'tranings', 'fitness', 'medlemskap'], typicalFrequency: ['monthly'], confirmBehavior: 'pending', minActionableAmount: 100, explanation: 'Vanlig återkommande medlemskostnad.' },

  { id: 'transport_commute', category: 'Kollektivtrafik', costType: 'fixed', recurringLikelihood: 'medium', keywords: ['sl period', 'västtrafik period', 'vasttrafik period', 'skånetrafiken period', 'kollektivtrafik'], typicalFrequency: ['monthly'], confirmBehavior: 'pending', minActionableAmount: 100, explanation: 'Kan vara återkommande transportmåste.' },
  { id: 'transport_variable', category: 'Bil/transport', costType: 'variable', recurringLikelihood: 'low', keywords: ['parkering', 'parkera', 'bränsle', 'drivmedel', 'bensin', 'diesel', 'trängselskatt', 'trangselskatt', 'infrastrukturavgift', 'fordonsskatt', 'bilskatt'], typicalFrequency: ['irregular', 'yearly'], confirmBehavior: 'pending', explanation: 'Ofta rörlig eller oregelbunden transportkostnad.' },

  { id: 'subscriptions', category: 'Abonnemang', costType: 'fixed', recurringLikelihood: 'medium', keywords: ['abonnemang', 'subscription', 'molnlagring', 'icloud', 'tidning', 'programvara', 'säkerhetstjänst', 'sakerhetstjanst', 'netflix', 'spotify', 'hbo', 'disney'], excludeKeywords: ['refund', 'retur', 'återbetalning', 'aterbetalning'], typicalFrequency: ['monthly', 'yearly'], confirmBehavior: 'pending', minActionableAmount: 100, explanation: 'Kan vara återkommande abonnemang.' },

  { id: 'family_childcare', category: 'Barn/familj', costType: 'fixed', recurringLikelihood: 'high', keywords: ['förskola', 'forskola', 'fritids', 'skola', 'barnaktivitet', 'underhåll', 'underhall'], typicalFrequency: ['monthly'], confirmBehavior: 'pending', minActionableAmount: 100, explanation: 'Vanlig återkommande familjekostnad.' },

  { id: 'health_variable', category: 'Hälsa', costType: 'variable', recurringLikelihood: 'low', keywords: ['apotek', 'vård', 'vard', 'tandvård', 'tandvard', 'läkare', 'lakare'], typicalFrequency: ['irregular'], confirmBehavior: 'pending', explanation: 'Ofta rörlig/oregelbunden hälsokostnad.' },

  { id: 'saving_transfer', category: 'Sparande/överföring', costType: 'transfer', recurringLikelihood: 'medium', keywords: ['avanza', 'nordnet', 'lunar top-up', 'top up', 'top-up', 'överföring', 'overforing', 'sparkonto', 'isk', 'kortpåfyllning', 'kortpafyllning', 'insättning från', 'insattning fran'], typicalFrequency: ['monthly', 'irregular'], confirmBehavior: 'ignore_as_income', explanation: 'Ska normalt neutraliseras som sparande eller intern överföring.' },

  { id: 'refunds', category: 'Återbetalning/retur', costType: 'excluded', recurringLikelihood: 'irregular', keywords: ['återbetalning', 'aterbetalning', 'refund', 'retur', 'kreditering', 'chargeback', 'swish åter', 'swish ater'], typicalFrequency: ['irregular'], confirmBehavior: 'ignore_as_income', explanation: 'Refunds/returer ska normalt inte räknas som inkomst.' },

  { id: 'groceries', category: 'Mat och hushåll', costType: 'variable', recurringLikelihood: 'low', keywords: ['mat', 'ica', 'willys', 'coop', 'hemköp', 'hemkop', 'matboden', 'storköp', 'storkop', 'livs'], typicalFrequency: ['irregular'], confirmBehavior: 'pending', explanation: 'Matköp är normalt rörliga köp, inte återkommande måsten enskilt.' },
  { id: 'restaurants_coffee', category: 'Restaurang/fika', costType: 'variable', recurringLikelihood: 'low', keywords: ['restaurang', 'kafé', 'kafe', 'cafe', 'espresso', 'pressbyrån', 'pressbyran', 'fika'], typicalFrequency: ['irregular'], confirmBehavior: 'pending', explanation: 'Restaurang/fika är normalt rörliga köp.' },
];

export function knowledgeBaseCategories() {
  return [...new Set(recurringKnowledgeBase.map(entry => entry.category))].sort();
}

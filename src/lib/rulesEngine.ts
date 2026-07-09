import type { CostType, Rule } from '../types';
import { recurringKnowledgeBase } from '../data/recurringKnowledgeBase';
import { normalizeText } from './normalize';

export interface CategorizationResult {
  category: string;
  costType: CostType;
  source: 'user-rule' | 'knowledge-base' | 'pattern' | 'none';
  confidence: number;
  reasonCodes: string[];
  knowledgeBaseId?: string;
  explanation?: string;
}

function includesAny(norm: string, keywords: string[] = []) {
  return keywords.some(keyword => norm.includes(normalizeText(keyword)));
}

export function categorize(descriptionOrNorm: string, rules: Rule[]): CategorizationResult {
  const norm = normalizeText(descriptionOrNorm);
  for (const rule of rules) {
    if (!rule.matchText.trim()) continue;
    const match = normalizeText(rule.matchText);
    if (norm.includes(match)) {
      return { category: rule.category, costType: rule.costType, source: 'user-rule', confidence: 98, reasonCodes: ['user_rule'], explanation: rule.note };
    }
  }

  const refund = recurringKnowledgeBase.find(entry => entry.id === 'refunds');
  if (refund && includesAny(norm, refund.keywords)) {
    return { category: refund.category, costType: refund.costType, source: 'knowledge-base', confidence: 95, reasonCodes: ['knowledge_base', 'refund'], knowledgeBaseId: refund.id, explanation: refund.explanation };
  }

  for (const entry of recurringKnowledgeBase) {
    if (entry.id === 'refunds') continue;
    if (entry.excludeKeywords && includesAny(norm, entry.excludeKeywords)) continue;
    if (includesAny(norm, entry.keywords)) {
      return { category: entry.category, costType: entry.costType, source: 'knowledge-base', confidence: entry.recurringLikelihood === 'high' ? 90 : entry.recurringLikelihood === 'medium' ? 78 : 60, reasonCodes: ['knowledge_base', entry.id], knowledgeBaseId: entry.id, explanation: entry.explanation };
    }
  }

  return { category: 'Okategoriserad', costType: 'variable', source: 'none', confidence: 20, reasonCodes: ['no_rule_match'] };
}

export function isLikelyTransferText(description: string) {
  const cat = categorize(description, []);
  if (cat.costType === 'transfer') return true;
  const n = normalizeText(description);
  return ['top up', 'topup', 'överföring', 'overforing', 'insättning från', 'insattning fran', 'till eget konto', 'avanza', 'nordnet', 'isk', 'sparkonto', 'kortpåfyllning', 'kortpafyllning'].some(k => n.includes(k));
}

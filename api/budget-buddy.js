import { runBudgetBuddyConversation } from './_lib/budgetBuddyConversation.js';
import { fallbackReply } from './_lib/budgetBuddyFallback.js';

function validate(body) {
  if (!body || typeof body.message !== 'string' || !body.message.trim()) return { error: 'Missing message' };
  const conversation = body.conversation || { recentMessages: body.recentMessages || [], summary: body.conversationSummary };
  const safeContext = body.safeContext || body.context || {};
  return { message: body.message.trim(), conversation, safeContext, requestMetadata: body.requestMetadata || { currentDate: body.currentDate, locale: 'sv-SE', workspaceId: body.workspaceId } };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const parsed = validate(req.body || {});
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  if (!process.env.OPENAI_API_KEY || parsed.requestMetadata?.userRequestedLocalOnly) return res.status(200).json(fallbackReply(parsed.message, false));
  try {
    const result = await runBudgetBuddyConversation(parsed);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(200).json({ ...fallbackReply(parsed.message, true), error: error instanceof Error ? error.message : 'unknown' });
  }
};

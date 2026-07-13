import { budgetBuddySystemPrompt } from './budgetBuddyPrompt.js';
import { toolSchemas, executeTool, toolCategories } from './budgetBuddyTools.js';

function normalizeMessages(messages = [], current) {
  const out = [];
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!m || !['user','assistant'].includes(m.role) || !m.content) continue;
    out.push({ role: m.role, content: String(m.content).slice(0, 1500) });
  }
  if (out.length && out[out.length - 1].role === 'user' && out[out.length - 1].content.trim() === String(current || '').trim()) out.pop();
  return out.slice(-18);
}
function outputText(response) {
  return response.output_text || (response.output || []).flatMap(o => o.content || []).map(c => c.text).filter(Boolean).join('\n').trim();
}
function functionCalls(response) { return (response.output || []).filter(o => o.type === 'function_call'); }
async function defaultOpenAiCreate(payload) {
  const r = await fetch('https://api.openai.com/v1/responses', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error(`OpenAI svarade ${r.status}`);
  return r.json();
}
async function runBudgetBuddyConversation({ message, conversation = {}, safeContext = {}, requestMetadata = {}, openAiCreate = defaultOpenAiCreate }) {
  const usedTools = [];
  const dataCategories = new Set();
  const proposedActions = [];
  safeContext.userMessage = message;
  safeContext.conversationSummary = conversation.summary || null;
  const input = [
    { role:'system', content: budgetBuddySystemPrompt },
    { role:'developer', content: `Aktuellt datum: ${requestMetadata.currentDate || new Date().toISOString()}. Locale: sv-SE. Budgetdata ska hämtas via verktyg, inte antas.` },
    ...(conversation.summary ? [{ role:'developer', content: `Samtalssammanfattning (ingen dold reasoning): ${JSON.stringify(conversation.summary).slice(0, 2000)}` }] : []),
    ...normalizeMessages(conversation.recentMessages, message),
    { role:'user', content: String(message).slice(0, 2000) },
  ];
  let response = await openAiCreate({ model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', input, tools: toolSchemas, tool_choice: 'auto', store: false, max_output_tokens: 900 });
  for (let round = 0; round < 4; round++) {
    const calls = functionCalls(response);
    if (!calls.length) break;
    const toolInput = [...input, ...response.output];
    for (const call of calls) {
      let result;
      try {
        const args = call.arguments ? JSON.parse(call.arguments) : {};
        result = executeTool(call.name, args, safeContext);
        usedTools.push(call.name);
        (toolCategories[call.name] || []).forEach(c => dataCategories.add(c));
        if (result?.proposedAction) proposedActions.push(result.proposedAction);
      } catch (err) {
        result = { error: err instanceof Error ? err.message : 'tool_failed' };
      }
      toolInput.push({ type:'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
    }
    response = await openAiCreate({ model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', input: toolInput, tools: toolSchemas, tool_choice: 'auto', store: false, max_output_tokens: 900 });
  }
  const text = outputText(response) || 'Jag fick inget tydligt svar från AI just nu. Inga ändringar gjordes.';
  return { source:'openai', message: text, actions: [], proposedAction: proposedActions[0], toolUsage: { usedTools: [...new Set(usedTools)], dataCategories: [...dataCategories], outcome: 'answered' }, model: response.model };
}
export { runBudgetBuddyConversation, normalizeMessages };

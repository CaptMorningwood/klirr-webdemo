function fallbackReply(message, hasKey) {
  return {
    source: 'local-fallback',
    message: hasKey
      ? 'Jag kunde inte få fram ett AI-svar just nu. Inga ändringar gjordes. I lokalt läge kan jag fortfarande hjälpa med Budgetöversikt, marginal, Budgethälsa och att förbereda vissa säkra förslag.'
      : 'Lokalt läge: jag kan hjälpa med vissa Budgetberäkningar och guidning, men friare samtal kräver att AI är aktiverat och konfigurerat.',
    actions: [],
    toolUsage: { usedTools: [], dataCategories: [], outcome: hasKey ? 'failed' : 'local_fallback' },
  };
}
export { fallbackReply };

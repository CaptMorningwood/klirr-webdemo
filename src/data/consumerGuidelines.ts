export const consumerGuidelines = {
  source: 'Konsumentverket',
  year: 2026,
  sourceUrl: 'https://www.konsumentverket.se/',
  sourceNote: 'Interimvärden i Klirr tills full uppdaterad tabell läggs in manuellt. Inga API-anrop görs mot Konsumentverket.',
  notes: 'Riktvärden ska användas som ungefärlig jämförelse, inte absolut gräns.',
  food: {
    referenceHouseholds: [
      { adults: 1, teens: 0, children: 0, monthlyAmount: 3600, label: '1 vuxen, interim 2026 riktvärde' },
      { adults: 2, teens: 0, children: 0, monthlyAmount: 6400, label: '2 vuxna, interim 2026 riktvärde' },
      { adults: 2, teens: 0, children: 2, monthlyAmount: 8440, label: '2 vuxna + 2 barn, 2026 riktvärde enligt Konsumentverkets beräkning' },
      { adults: 2, teens: 1, children: 1, monthlyAmount: 9300, label: '2 vuxna + 1 tonåring + 1 barn, interim 2026 riktvärde' },
    ],
    unitModel: {
      adult: 3600,
      secondAdult: 2800,
      teen: 3100,
      child: 1800,
      pet: 250,
    },
  },
} as const;

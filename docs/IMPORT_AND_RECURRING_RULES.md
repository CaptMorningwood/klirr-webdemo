# Import och återkommande-regler

Klirr ska vara bank-oberoende. Produktlogik får inte bygga på en privat persons kontoutdrag eller ett enskilt Swedbank-format. Enskilda kontoutdrag kan användas som regressionstester, men generella bankformat, kolumnalias och hushållsekonomi-regler ska driva appens beteende.

## Importpipeline

Importflödet är uppdelat i tydliga steg:

1. **decodeFile** – `decodeTextFile` läser filer via `ArrayBuffer` och provar UTF-8 strict, Windows-1252, ISO-8859-1 och UTF-8 fallback.
2. **detectBankFormat** – `detectBank` matchar bankformat via generella header-/metadata-signaler.
3. **parseRows** – CSV radas upp med detekterad delimiter och header även om banken lägger metadata före headern.
4. **normalizeRows** – bankens kolumner mappas via alias till datum, beskrivning, belopp, saldo, motpart och referens.
5. **validateRows** – rader utan giltigt datum, text eller belopp filtreras bort och importvarningar kan följa med.
6. **rowsToTransactions** – rader normaliseras till appens `Transaction`-format med metadata som `sourceBank`, `originalDescription`, `counterparty`, `bankReference`, `balanceAfter`, `raw` och `importWarnings`.
7. **analyzeTransactions** – återkommande-, transfer- och review-detektering körs på samma interna format oavsett bank.

## Stödda bankformat

Stödda format i denna version:

- Generic CSV
- Swedbank
- SEB
- Handelsbanken
- Nordea

Arkitekturen ligger i `src/lib/bankFormats.ts`. Nya banker läggs till genom en ny `BankFormatDefinition` med:

- `key`
- `label`
- `headerMatchers`
- `columnAliases` för datum, beskrivning, belopp och valfri metadata
- eventuella metadata-/beloppsregler

Planerade framtida format: Danske Bank, ICA Banken, Länsförsäkringar Bank, Skandiabanken, Revolut och Lunar.

## Generic CSV

Generic CSV fungerar med vanliga kolumnnamn som `Datum`, `Date`, `Beskrivning`, `Description`, `Text`, `Belopp`, `Amount` och `Summa`. Semikolon, tabb och komma kan detekteras som delimiter.

Manuell kolumnmappning finns kvar i importvyn om auto-detekteringen väljer fel kolumner.

## Encoding

Filimport ska inte använda enkel `readAsText(file)`. Klirr använder `decodeTextFile(file)` och rapporterar encoding i importfeedback.

Målet är att svenska tecken ska bevaras:

- `LÖN` ska inte bli `L�N`
- `Allmän` ska inte bli `Allm�n`
- `Försäkring` ska inte bli `F�rs�kring`
- `Bokföringsdag` ska läsas korrekt

Om replacement characters finns kvar markeras en möjlig encoding-varning i feedback/context.

## Kunskapsbas för återkommande ekonomi

Generella regler finns i `src/data/recurringKnowledgeBase.ts`. Kunskapsbasen täcker svenska hushållskategorier, inte privata merchants.

Exempel på kategorier:

- Inkomster: lön, barnbidrag, CSN, pension, Försäkringskassan, skatteåterbäring och försäkringsersättning.
- Boende: hyra, bostadsrättsavgift, bolån, ränta, amortering, garage och förråd.
- Drift: el, elnät, vatten, fjärrvärme och gas.
- Försäkring: hem-, bil-, barn-, liv-, olycksfalls- och djurförsäkring.
- Kommunikation: mobil, bredband, fiber, tv och telekom/streaming.
- Skuld: privatlån, billån, kreditkortsfaktura, inkasso, Kronofogden och avbetalning.
- Medlemskap: fack, a-kassa, gym och medlemsavgifter.
- Transport: kollektivtrafik, leasing, trängselskatt, parkering och drivmedel.
- Abonnemang: streaming, molnlagring, appar, tidningar och programvaror.
- Barn/familj: förskola, fritids, skola, barnaktivitet och underhåll.
- Hälsa: vård, apotek och tandvård.
- Sparande/transfer: Avanza, Nordnet, ISK, sparkonto, top-up och överföringar.
- Refunds/returer: återbetalning, refund, retur, kreditering och chargeback.

## Klassificeringspolicy

### Inkomst

Kan bli möjlig inkomst om beloppet är positivt och texten matchar inkomstkategori, återkommer över månader eller användarregel säger inkomst.

Ska normalt inte bli inkomst om den är refund/retur, intern överföring, sparflytt eller top-up.

### Fast utgift / måste

Kan bli möjlig fast utgift om den matchar boende, el, försäkring, lån/skuld, telekom, fack/a-kassa, gym, barn/familj eller abonnemang. Den kan också bli fast om den återkommer över månader med stabilt belopp.

### Rörlig utgift

Matbutik, restaurang, fika, shopping, apotek, drivmedel, parkering och nöje är normalt rörliga köp. De ska inte bli återkommande måsten bara för att de finns en gång i importen.

### Transfer / sparande

Överföringar mellan egna konton, top-up, Avanza, Nordnet, ISK, sparkonto och kortpåfyllning neutraliseras normalt innan inkomst/utgift-detektion.

### Refund

Refunds och returer ska inte bli normal inkomst. Stora oklara plusposter kan visas för granskning.

## Recurring candidates vs actionable candidates

- **Recurring candidates** bygger på frekvens/signatur: samma text, flera månader, liknande belopp och rimlig frekvens.
- **Actionable candidates** visas för användaren trots få förekomster om de verkar viktiga, exempelvis lön, hyra, el, bredband eller försäkring.

Budgeten är framåtblickande: importerade kandidater räknas inte in i månadsbudgeten förrän användaren bekräftar dem.

## Lägga till nya kunskapsregler

Lägg till en ny post i `recurringKnowledgeBase` med:

- stabilt `id`
- generell `category`
- `costType`
- `recurringLikelihood`
- generella `keywords`
- eventuella `excludeKeywords`
- `typicalFrequency`
- `confirmBehavior`
- `explanation`

Undvik privata namn eller specialfall från en enskild CSV. Om ett merchant-namn används ska det representera en generell, allmänt relevant kategori.

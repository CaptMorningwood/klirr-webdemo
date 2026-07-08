import type { Account, Income, ManualExpense, Rule, Transaction, VariablePlanItem } from '../types';
import { uid } from '../lib/format';

export function buildDemoData() {
  const main: Account = { id: 'acc_demo_main', name: 'Demo Huvudkonto', bankLabel: 'DemoBanken', isOwn: true };
  const card: Account = { id: 'acc_demo_card', name: 'Demo Kortkonto', bankLabel: 'DemoKort', isOwn: true };

  const tx: Transaction[] = [];
  const push = (accountId: string, date: string, description: string, amount: number) => {
    tx.push({ id: uid('tx'), accountId, date, description, amount });
  };

  const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
  months.forEach((m, idx) => {
    const salary = idx === 2 ? 29500 : 32500;
    push(main.id, `${m}-25`, 'Lön Exempelbolaget', salary);
    push(main.id, `${m}-20`, 'Barnbidrag Demo', 2650);
    push(main.id, `${m}-01`, 'Hemlyftet Bostadshyra', -12450);
    push(main.id, `${m}-03`, 'Elbolaget Norr', -(820 + (idx % 3) * 190));
    push(main.id, `${m}-05`, 'Streamio Familjepaket', -449);
    push(main.id, `${m}-06`, 'Fiberfart Bredband', -549);
    push(main.id, `${m}-07`, 'Trygghem Försäkring', -389);
    push(main.id, `${m}-08`, 'LånaLagom Företagslån', -3200);
    push(main.id, `${m}-09`, 'Bilfinans Demo', -1800);
    push(main.id, `${m}-10`, 'Garagebolaget Plats 42', -950);
    push(main.id, `${m}-12`, 'Klirr Kortkonto Top-up', -4500);
    push(card.id, `${m}-12`, 'Insättning från Demo Huvudkonto', 4500);
    push(main.id, `${m}-15`, 'Träningsklubben Medlemskap', -299);
    push(card.id, `${m}-04`, 'Matboden City', -(680 + idx * 25));
    push(card.id, `${m}-11`, 'Kvartersbutiken Nära', -(420 + idx * 15));
    push(card.id, `${m}-18`, 'Storköp Grossist', -(760 + (idx % 2) * 120));
    push(card.id, `${m}-24`, 'Matboden City', -(720 + idx * 20));
    push(card.id, `${m}-14`, 'Kafé Lagom', -(95 + (idx % 3) * 40));
    push(card.id, `${m}-22`, 'Restaurang Demo', -(240 + idx * 25));
    push(card.id, `${m}-27`, 'Bränslebolaget Runt Hörnet', -(650 + idx * 30));
    push(card.id, `${m}-28`, 'Parkera Smart', -220);
  });

  // Intentionally messy demo cases: duplicate, outlier, quarterly, and one-off.
  push('acc_demo_main', '2026-03-15', 'Träningsklubben Medlemskap', -299); // duplicate-looking
  push('acc_demo_main', '2026-04-17', 'Tandklinik Exempel', -5400); // one-off/outlier
  push('acc_demo_main', '2026-01-16', 'Försäkring Extra kvartal', -1200);
  push('acc_demo_main', '2026-04-16', 'Försäkring Extra kvartal', -1200);
  push('acc_demo_card', '2026-02-19', 'Spelportalen Plus', -89);
  push('acc_demo_card', '2026-03-19', 'Spelportalen Plus', -89);
  push('acc_demo_card', '2026-04-19', 'Spelportalen Plus', -89);
  push('acc_demo_card', '2026-05-19', 'Spelportalen Plus', -89);
  push('acc_demo_card', '2026-06-19', 'Spelportalen Plus', -89);
  push('acc_demo_card', '2026-05-08', 'Mikroapp Prenumeration', -49);
  push('acc_demo_card', '2026-06-08', 'Mikroapp Prenumeration', -49);

  const incomes: Income[] = [
    { id: 'inc_salary', label: 'Lön', amount: 32500, frequency: 'monthly' },
    { id: 'inc_child', label: 'Barnbidrag', amount: 2650, frequency: 'monthly' },
  ];

  const manualExpenses: ManualExpense[] = [
    { id: 'mx_mobile', label: 'Mobilabonnemang', amount: 799, category: 'Telefoni', costType: 'fixed', active: true },
  ];

  const variablePlan: VariablePlanItem[] = [
    { id: 'vp_food', label: 'Mat och hushåll', amount: 6500, category: 'Vardag', include: true },
    { id: 'vp_transport', label: 'Bil/transport rörligt', amount: 2300, category: 'Transport', include: true },
    { id: 'vp_fun', label: 'Nöje', amount: 1500, category: 'Valfritt', include: true },
    { id: 'vp_household', label: 'Övrigt hushåll', amount: 1800, category: 'Vardag', include: true },
    { id: 'vp_savings', label: 'Sparande', amount: 1200, category: 'Sparande', include: true },
  ];

  const rules: Rule[] = [
    { id: 'rule_topup', matchText: 'top up', category: 'Intern överföring', costType: 'transfer', note: 'Demo: överföring mellan egna konton' },
    { id: 'rule_insattning', matchText: 'insättning från demo huvudkonto', category: 'Intern överföring', costType: 'transfer' },
    { id: 'rule_hemlyftet', matchText: 'hemlyftet', category: 'Hyra', costType: 'fixed' },
    { id: 'rule_matboden', matchText: 'matboden', category: 'Mat och hushåll', costType: 'variable' },
    { id: 'rule_lanalagom', matchText: 'lånalagom', category: 'Företagslån', costType: 'fixed' },
    { id: 'rule_bilfinans', matchText: 'bilfinans', category: 'Billån', costType: 'fixed' },
  ];

  return { accounts: [main, card], transactions: tx, incomes, manualExpenses, variablePlan, rules };
}

import { describe, expect, it } from 'vitest';
import type { Income } from '../../types';
import { selectIncomeTargetForSalaryUpdate } from '../incomeTargeting';

const income = (id: string, label: string, amount = 1000): Income => ({ id, label, amount, frequency: 'monthly' });

describe('incomeTargeting salary updates', () => {
  it('must not update Barnbidrag for a salary intent', () => {
    const result = selectIncomeTargetForSalaryUpdate([income('child', 'Barnbidrag', 2650)], 'min nya lön är 60000');
    expect(result.strategy).toBe('add_new');
    expect(result.incomeId).toBeUndefined();
  });

  it('chooses a clear salary income instead of Barnbidrag', () => {
    const result = selectIncomeTargetForSalaryUpdate([income('child', 'Barnbidrag', 2650), income('salary', 'Lön Exempelbolaget', 32000)], 'min nya lön är 60000');
    expect(result.strategy).toBe('suggest_existing');
    expect(result.incomeId).toBe('salary');
  });

  it('asks the user when multiple non-support incomes could be salary', () => {
    const result = selectIncomeTargetForSalaryUpdate([income('a', 'Alex lön', 30000), income('r', 'Rebeca lön', 31000), income('child', 'Barnbidrag', 2650)], 'min nya lön är 60000');
    expect(result.strategy).toBe('needs_user_choice');
    expect(result.candidateIncomes?.map(i => i.id)).toEqual(['a', 'r']);
  });

  it('suggests adding a new income when there is no salary income and only support exists', () => {
    const result = selectIncomeTargetForSalaryUpdate([income('csn', 'CSN', 12000), income('fk', 'Försäkringskassan', 3000)], 'min nya lön är 60000');
    expect(result.strategy).toBe('add_new');
    expect(result.incomeId).toBeUndefined();
  });
});

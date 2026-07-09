export interface SwedishNetSalaryEstimateInput {
  grossMonthly: number;
  municipalTaxRate?: number;
  age?: number;
  churchMember?: boolean;
}

export interface SwedishNetSalaryEstimate {
  grossMonthly: number;
  netMonthly: number;
  taxRate: number;
  assumptions: string[];
}

export function estimateSwedishNetSalary(input: SwedishNetSalaryEstimateInput): SwedishNetSalaryEstimate {
  const grossMonthly = Number(input.grossMonthly);
  if (!Number.isFinite(grossMonthly) || grossMonthly <= 0) {
    throw new Error('grossMonthly must be a positive number');
  }
  const taxRate = Number.isFinite(input.municipalTaxRate) && input.municipalTaxRate! > 0 && input.municipalTaxRate! < 1
    ? input.municipalTaxRate!
    : 0.32;
  const netMonthly = Math.round((grossMonthly * (1 - taxRate)) / 100) * 100;
  return {
    grossMonthly: Math.round(grossMonthly),
    netMonthly,
    taxRate,
    assumptions: [
      `Grovt uppskattat med ${(taxRate * 100).toLocaleString('sv-SE', { maximumFractionDigits: 1 })}% skatt.`,
      'Exakt nettolön beror på kommun, skattetabell, ålder, avdrag och eventuell kyrkoavgift.',
    ],
  };
}

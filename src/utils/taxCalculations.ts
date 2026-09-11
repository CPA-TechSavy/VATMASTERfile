import {
  Data1701Q,
  Data1702Q,
  Data2550Q,
  Data2551Q,
  Data1601C,
  Data1601EQ,
  PenaltiesData,
  Quarter,
} from '../types/tax';
import {
  ClientBranchSchedule,
  PurchasesReportingMode,
  BirUploadedFileRecord,
} from '../types/branchVat';

/**
 * Computes Individual Graduated Income Tax under Tax Code as amended by EOPT Law (RA 11976)
 */
export function computeGraduatedTax(taxableIncome: number): number {
  if (taxableIncome <= 250000) {
    return 0;
  }
  if (taxableIncome <= 400000) {
    return (taxableIncome - 250000) * 0.15;
  }
  if (taxableIncome <= 800000) {
    return 22500 + (taxableIncome - 400000) * 0.2;
  }
  if (taxableIncome <= 2000000) {
    return 102500 + (taxableIncome - 800000) * 0.25;
  }
  if (taxableIncome <= 8000000) {
    return 402500 + (taxableIncome - 2000000) * 0.3;
  }
  return 2202500 + (taxableIncome - 8000000) * 0.35;
}

/**
 * Approximate monthly withholding tax on compensation (Revised Withholding Tax Table)
 */
export function computeCompensationWithholding(taxableCompensation: number): number {
  if (taxableCompensation <= 20833) {
    return 0;
  }
  if (taxableCompensation <= 33333) {
    return (taxableCompensation - 20833) * 0.15;
  }
  if (taxableCompensation <= 66667) {
    return 1875 + (taxableCompensation - 33333) * 0.2;
  }
  if (taxableCompensation <= 166667) {
    return 8541.8 + (taxableCompensation - 66667) * 0.25;
  }
  if (taxableCompensation <= 666667) {
    return 33541.8 + (taxableCompensation - 166667) * 0.3;
  }
  return 183541.8 + (taxableCompensation - 666667) * 0.35;
}

export interface Result1701Q {
  totalGrossRevenues: number;
  allowableDeductions: number;
  deductionType: 'OSD (40%)' | 'Itemized' | '8% Fixed Reduction (₱250k)' | 'None (Mixed Income)';
  netTaxableIncome: number;
  taxDue: number;
  totalTaxCredits: number;
  netTaxPayable: number;
  isOverpayment: boolean;
  boxBreakdown: {
    lineGrossSales: number;
    lineNonOperating: number;
    lineTotalGross: number;
    lineDeductions: number;
    lineTaxableIncome: number;
    lineTaxDue: number;
    lineTotalCredits: number;
    lineNetTaxPayable: number;
  };
}

export function calculate1701Q(data: Data1701Q): Result1701Q {
  const lineGrossSales = data.grossSalesCurrentQuarter + data.grossSalesPriorQuarters;
  const lineNonOperating = data.nonOperatingIncome;
  const lineTotalGross = lineGrossSales + lineNonOperating;

  let allowableDeductions = 0;
  let deductionType: Result1701Q['deductionType'] = 'None (Mixed Income)';
  let netTaxableIncome = 0;
  let taxDue = 0;

  if (data.taxRegime === '8_percent') {
    if (data.taxpayerType === 'pure_business') {
      allowableDeductions = 250000; // P250,000 threshold
      deductionType = '8% Fixed Reduction (₱250k)';
      netTaxableIncome = Math.max(0, lineTotalGross - allowableDeductions);
    } else {
      allowableDeductions = 0;
      deductionType = 'None (Mixed Income)';
      netTaxableIncome = lineTotalGross;
    }
    taxDue = netTaxableIncome * 0.08;
  } else {
    // Graduated Rates
    if (data.deductionMethod === 'osd') {
      allowableDeductions = lineGrossSales * 0.4; // 40% of Gross Sales
      deductionType = 'OSD (40%)';
      netTaxableIncome = Math.max(0, lineTotalGross - allowableDeductions);
    } else {
      allowableDeductions = data.costOfSales + data.operatingExpenses;
      deductionType = 'Itemized';
      netTaxableIncome = Math.max(0, lineTotalGross - allowableDeductions);
    }
    taxDue = computeGraduatedTax(netTaxableIncome);
  }

  const totalTaxCredits =
    data.priorYearExcessCredits +
    data.quarterlyTaxPaidPriorQuarters +
    data.cwt2307Credits +
    data.otherTaxCredits;

  const netTaxPayable = taxDue - totalTaxCredits;
  const isOverpayment = netTaxPayable < 0;

  return {
    totalGrossRevenues: lineTotalGross,
    allowableDeductions,
    deductionType,
    netTaxableIncome,
    taxDue,
    totalTaxCredits,
    netTaxPayable,
    isOverpayment,
    boxBreakdown: {
      lineGrossSales,
      lineNonOperating,
      lineTotalGross,
      lineDeductions: allowableDeductions,
      lineTaxableIncome: netTaxableIncome,
      lineTaxDue: taxDue,
      lineTotalCredits: totalTaxCredits,
      lineNetTaxPayable: netTaxPayable,
    },
  };
}

export interface Result1702Q {
  grossSales: number;
  costOfSales: number;
  grossIncomeFromOperations: number;
  totalGrossIncome: number;
  operatingExpenses: number;
  netTaxableIncome: number;
  ncitTaxDue: number;
  mcitTaxDue: number;
  appliedTaxType: 'Regular (25%)' | 'MSME (20%)' | 'MCIT (2%)';
  taxDue: number;
  totalTaxCredits: number;
  netTaxPayable: number;
  isOverpayment: boolean;
}

export function calculate1702Q(data: Data1702Q): Result1702Q {
  const grossSales = data.grossSales;
  const costOfSales = data.costOfSales;
  const grossIncomeFromOperations = Math.max(0, grossSales - costOfSales);
  const totalGrossIncome = grossIncomeFromOperations + data.nonOperatingIncome;
  const operatingExpenses = data.operatingExpenses;
  const netTaxableIncome = Math.max(0, totalGrossIncome - operatingExpenses);

  const ratePercent = data.rateOption === 'msme_20' ? 0.2 : 0.25;
  const ncitTaxDue = netTaxableIncome * ratePercent;
  const mcitTaxDue = data.isMCOptional ? grossIncomeFromOperations * 0.02 : 0;

  let taxDue = ncitTaxDue;
  let appliedTaxType: Result1702Q['appliedTaxType'] =
    data.rateOption === 'msme_20' ? 'MSME (20%)' : 'Regular (25%)';

  if (data.isMCOptional && mcitTaxDue > ncitTaxDue) {
    taxDue = mcitTaxDue;
    appliedTaxType = 'MCIT (2%)';
  }

  const totalTaxCredits =
    data.priorYearExcessCredits +
    data.priorQuarterTaxPaid +
    data.cwt2307Credits +
    data.otherTaxCredits;

  const netTaxPayable = taxDue - totalTaxCredits;

  return {
    grossSales,
    costOfSales,
    grossIncomeFromOperations,
    totalGrossIncome,
    operatingExpenses,
    netTaxableIncome,
    ncitTaxDue,
    mcitTaxDue,
    appliedTaxType,
    taxDue,
    totalTaxCredits,
    netTaxPayable,
    isOverpayment: netTaxPayable < 0,
  };
}

export interface Result2550Q {
  vatableSales: number;
  outputTax: number;
  totalSales: number;
  inputTaxPurchases: number;
  totalAvailableInputTax: number;
  netVatBeforeCredits: number;
  excessInputTax: number;
  totalTaxCredits: number;
  netVatPayable: number;
  isExcessInputVat: boolean;
}

export function calculate2550Q(data: Data2550Q): Result2550Q {
  const totalSales =
    data.vatableSales + data.salesToGovernment + data.zeroRatedSales + data.vatExemptSales;
  const outputTax = (data.vatableSales + data.salesToGovernment) * 0.12;

  const inputTaxPurchases =
    (data.inputPurchasesGoods +
      data.inputPurchasesServices +
      data.inputCapitalGoods +
      data.inputImportations) *
    0.12;

  const totalAvailableInputTax = inputTaxPurchases + data.priorQuarterExcessInputVat;

  const netVatBeforeCredits = Math.max(0, outputTax - totalAvailableInputTax);
  const excessInputTax = Math.max(0, totalAvailableInputTax - outputTax);

  const totalTaxCredits =
    data.withheldVat2307Govt + data.withheldVat2307Private + data.priorPaymentsThisQuarter;

  const netVatPayable = netVatBeforeCredits - totalTaxCredits;

  return {
    vatableSales: data.vatableSales,
    outputTax,
    totalSales,
    inputTaxPurchases,
    totalAvailableInputTax,
    netVatBeforeCredits,
    excessInputTax,
    totalTaxCredits,
    netVatPayable,
    isExcessInputVat: excessInputTax > 0 || netVatPayable < 0,
  };
}

/**
 * Returns the previous quarter and corresponding year.
 */
export function getPreviousQuarterInfo(
  quarter: Quarter,
  year: number
): { quarter: Quarter; year: number } {
  switch (quarter) {
    case 'Q1':
      return { quarter: 'Q4', year: year - 1 };
    case 'Q2':
      return { quarter: 'Q1', year };
    case 'Q3':
      return { quarter: 'Q2', year };
    case 'Q4':
      return { quarter: 'Q3', year };
  }
}

export interface PriorQuarterExcessInputVatResult {
  excessInputVat: number;
  prevVatDue: number | null;
  prevQuarter: Quarter;
  prevYear: number;
  source: 'branch_schedule' | '2550q_map' | 'initial_data' | 'none';
  explanation: string;
}

/**
 * Computes Schedule 2 Prior Quarter's Excess Input Tax based on previous Quarter's VAT Due.
 * Rule: It must be based on previous Quarter VAT Due ONLY IF the VAT Due from previous Quarter is Negative.
 * Otherwise, if it is not negative (i.e. zero or positive payable), put zero.
 */
export function getPriorQuarterExcessInputVat(
  clientId: string,
  currentQuarter: Quarter,
  currentYear: number
): PriorQuarterExcessInputVatResult {
  const { quarter: prevQuarter, year: prevYear } = getPreviousQuarterInfo(
    currentQuarter,
    currentYear
  );

  // 1. Try checking saved multi-branch schedule for the previous quarter
  try {
    const branchStorageKey = `bir_branch_schedule_${clientId}_${prevYear}_${prevQuarter}`;
    const branchDataRaw =
      typeof window !== 'undefined' ? localStorage.getItem(branchStorageKey) : null;
    if (branchDataRaw) {
      const parsed = JSON.parse(branchDataRaw);
      if (parsed && Array.isArray(parsed.branches) && parsed.branches.length > 0) {
        let totalOutputTax = 0;
        let totalInputTax = 0;

        // Sum sales files output tax across all branches and months
        for (const branch of parsed.branches) {
          if (branch.salesFiles) {
            for (const m of [1, 2, 3] as const) {
              const sf = branch.salesFiles[`month${m}`];
              if (sf?.totals) {
                totalOutputTax += Number(sf.totals.taxAmount) || 0;
              }
            }
          }
        }

        // Subtract any deferred VAT Due if defined
        if (parsed.deferralState?.deferredVatDue) {
          totalOutputTax = Math.max(0, totalOutputTax - (Number(parsed.deferralState.deferredVatDue) || 0));
        }

        // Sum purchases files input tax
        if (parsed.purchasesMode === 'consolidated') {
          if (parsed.consolidatedPurchasesFile?.totals) {
            totalInputTax += Number(parsed.consolidatedPurchasesFile.totals.taxAmount) || 0;
          }
        } else {
          for (const branch of parsed.branches) {
            if (branch.purchasesFiles) {
              for (const m of [1, 2, 3] as const) {
                const pf = branch.purchasesFiles[`month${m}`];
                if (pf?.totals) {
                  totalInputTax += Number(pf.totals.taxAmount) || 0;
                }
              }
            }
          }
        }

        if (totalOutputTax > 0 || totalInputTax > 0) {
          const prevVatDue = totalOutputTax - totalInputTax;
          if (prevVatDue < 0) {
            const excess = Math.abs(prevVatDue);
            return {
              excessInputVat: excess,
              prevVatDue,
              prevQuarter,
              prevYear,
              source: 'branch_schedule',
              explanation: `Previous Quarter (${prevQuarter} ${prevYear}) Multi-Branch VAT Due was negative (-₱${excess.toLocaleString('en-PH', { minimumFractionDigits: 2 })}). Transferred as excess input tax.`,
            };
          } else {
            return {
              excessInputVat: 0,
              prevVatDue,
              prevQuarter,
              prevYear,
              source: 'branch_schedule',
              explanation: `Previous Quarter (${prevQuarter} ${prevYear}) Multi-Branch VAT Due was positive/zero (₱${prevVatDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}). Excess set to ₱0.00.`,
            };
          }
        }
      }
    }
  } catch (e) {
    console.error('Error reading previous quarter branch schedule', e);
  }

  // 2. Try checking saved BIR Form 2550Q data map in localStorage
  try {
    const raw2550Q =
      typeof window !== 'undefined' ? localStorage.getItem('bir_calc_data_2550Q') : null;
    if (raw2550Q) {
      const map = JSON.parse(raw2550Q);
      const prevKey = `${clientId}_${prevYear}_${prevQuarter}`;
      const prevData = map[prevKey];
      if (prevData) {
        const outputTax =
          ((Number(prevData.vatableSales) || 0) + (Number(prevData.salesToGovernment) || 0)) * 0.12;
        const inputPurchases =
          (((Number(prevData.inputPurchasesGoods) || 0) +
            (Number(prevData.inputPurchasesServices) || 0) +
            (Number(prevData.inputCapitalGoods) || 0) +
            (Number(prevData.inputImportations) || 0)) *
            0.12) +
          (Number(prevData.priorQuarterExcessInputVat) || 0);
        const prevVatDue = outputTax - inputPurchases;

        if (outputTax > 0 || inputPurchases > 0) {
          if (prevVatDue < 0) {
            const excess = Math.abs(prevVatDue);
            return {
              excessInputVat: excess,
              prevVatDue,
              prevQuarter,
              prevYear,
              source: '2550q_map',
              explanation: `Previous Quarter (${prevQuarter} ${prevYear}) Form 2550Q VAT Due was negative (-₱${excess.toLocaleString('en-PH', { minimumFractionDigits: 2 })}). Transferred as excess input tax.`,
            };
          } else {
            return {
              excessInputVat: 0,
              prevVatDue,
              prevQuarter,
              prevYear,
              source: '2550q_map',
              explanation: `Previous Quarter (${prevQuarter} ${prevYear}) Form 2550Q VAT Due was positive/zero (₱${prevVatDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}). Excess set to ₱0.00.`,
            };
          }
        }
      }
    }
  } catch (e) {
    console.error('Error reading previous quarter 2550Q data', e);
  }

  // 3. Fallback: No negative VAT due found from previous quarter
  return {
    excessInputVat: 0,
    prevVatDue: null,
    prevQuarter,
    prevYear,
    source: 'none',
    explanation: `No negative VAT Due from previous quarter (${prevQuarter} ${prevYear}). Excess set to ₱0.00.`,
  };
}

export interface Result2551Q {
  grossSales: number;
  exemptSales: number;
  taxableSales: number;
  taxRatePercent: number;
  taxDue: number;
  totalTaxCredits: number;
  netPercentageTaxPayable: number;
  isOverpayment: boolean;
  vatableSales: number;
  salesToGovernment: number;
  zeroRatedSales: number;
  vatExemptSales: number;
}

export function calculate2551Q(data: Data2551Q): Result2551Q {
  const hasBreakdown =
    data.vatableSales !== undefined ||
    data.salesToGovernment !== undefined ||
    data.zeroRatedSales !== undefined ||
    data.vatExemptSales !== undefined;

  const vatableSales = data.vatableSales || 0;
  const salesToGovernment = data.salesToGovernment || 0;
  const zeroRatedSales = data.zeroRatedSales || 0;
  const vatExemptSales =
    data.vatExemptSales !== undefined ? data.vatExemptSales : (data.exemptSales || 0);

  const grossSales = hasBreakdown
    ? vatableSales + salesToGovernment + zeroRatedSales + vatExemptSales
    : (data.grossSalesCurrentQuarter || 0);

  const exemptSales = hasBreakdown
    ? vatExemptSales + zeroRatedSales
    : (data.exemptSales || 0);

  const taxableSales = hasBreakdown
    ? Math.max(0, vatableSales + salesToGovernment)
    : Math.max(0, grossSales - exemptSales);

  const taxRate = data.taxRatePercent / 100;
  const taxDue = taxableSales * taxRate;
  const totalTaxCredits = data.cwt2307Credits + data.priorQuarterTaxPaid;
  const netPercentageTaxPayable = taxDue - totalTaxCredits;

  return {
    grossSales,
    exemptSales,
    taxableSales,
    taxRatePercent: data.taxRatePercent,
    taxDue,
    totalTaxCredits,
    netPercentageTaxPayable,
    isOverpayment: netPercentageTaxPayable < 0,
    vatableSales,
    salesToGovernment,
    zeroRatedSales,
    vatExemptSales,
  };
}

export interface Result1601C {
  totalGrossCompensation: number;
  totalNonTaxableCompensation: number;
  taxableCompensation: number;
  taxRequiredWithheld: number;
  adjustments: number;
  priorRemittance: number;
  netTaxRemitted: number;
}

export function calculate1601C(data: Data1601C): Result1601C {
  const totalNonTaxableCompensation =
    data.minimumWageEarners +
    data.statutoryContributions +
    data.thirteenthMonthAndDeMinimis +
    data.otherNonTaxableCompensation;

  const taxableCompensation = Math.max(0, data.totalGrossCompensation - totalNonTaxableCompensation);
  const taxRequiredWithheld = computeCompensationWithholding(taxableCompensation);
  const netTaxRemitted =
    taxRequiredWithheld + data.taxWithheldAdjustments - data.taxRemittedPreviously;

  return {
    totalGrossCompensation: data.totalGrossCompensation,
    totalNonTaxableCompensation,
    taxableCompensation,
    taxRequiredWithheld,
    adjustments: data.taxWithheldAdjustments,
    priorRemittance: data.taxRemittedPreviously,
    netTaxRemitted,
  };
}

export interface Result1601EQ {
  totalTaxBase: number;
  totalTaxWithheld: number;
  priorMonthTaxRemitted: number;
  overpaymentPreviousPeriod: number;
  netAmountPayable: number;
  lineBreakdowns: {
    id: string;
    atc: string;
    description: string;
    ratePercent: number;
    taxBase: number;
    taxWithheld: number;
  }[];
}

export function calculate1601EQ(data: Data1601EQ): Result1601EQ {
  let totalTaxBase = 0;
  let totalTaxWithheld = 0;

  const items = Array.isArray(data.lineItems) ? data.lineItems : [];
  const lineBreakdowns = items.map((item) => {
    const itemWithheld = item.taxBase * (item.ratePercent / 100);
    totalTaxBase += item.taxBase;
    totalTaxWithheld += itemWithheld;
    return {
      ...item,
      taxWithheld: itemWithheld,
    };
  });

  const netAmountPayable =
    totalTaxWithheld - (data.priorMonthTaxRemitted + data.overpaymentPreviousPeriod);

  return {
    totalTaxBase,
    totalTaxWithheld,
    priorMonthTaxRemitted: data.priorMonthTaxRemitted,
    overpaymentPreviousPeriod: data.overpaymentPreviousPeriod,
    netAmountPayable,
    lineBreakdowns,
  };
}

/**
 * BIR Surcharge, Interest (12% per annum under NIRC as amended by EOPT Act), Compromise Penalty table
 */
export function calculatePenalties(basicTaxDue: number, penalties: PenaltiesData): {
  basicTaxDue: number;
  surcharge: number;
  interest: number;
  compromise: number;
  totalPenalties: number;
  totalAmountPayable: number;
} {
  if (basicTaxDue <= 0) {
    return {
      basicTaxDue: 0,
      surcharge: 0,
      interest: 0,
      compromise: 0,
      totalPenalties: 0,
      totalAmountPayable: 0,
    };
  }

  // Surcharge: 25% for simple late filing (Note: EOPT Act removes wrong venue surcharge)
  const surcharge = penalties.includeSurcharge ? basicTaxDue * 0.25 : 0;

  // Interest: 12% per annum under NIRC Sec 249 as amended by EOPT Act (RA 11976)
  const days = Math.max(0, penalties.daysLate);
  const interest = penalties.includeInterest ? basicTaxDue * 0.12 * (days / 365) : 0;

  // BIR Compromise Penalty schedule (RMO 7-2015)
  let compromise = 0;
  if (penalties.includeCompromise) {
    if (basicTaxDue <= 5000) compromise = 1000;
    else if (basicTaxDue <= 10000) compromise = 2000;
    else if (basicTaxDue <= 20000) compromise = 3000;
    else if (basicTaxDue <= 50000) compromise = 5000;
    else if (basicTaxDue <= 100000) compromise = 10000;
    else if (basicTaxDue <= 500000) compromise = 15000;
    else if (basicTaxDue <= 1000000) compromise = 20000;
    else if (basicTaxDue <= 5000000) compromise = 30000;
    else if (basicTaxDue <= 10000000) compromise = 40000;
    else compromise = 50000;
  }

  const totalPenalties = surcharge + interest + compromise;
  const totalAmountPayable = basicTaxDue + totalPenalties;

  return {
    basicTaxDue,
    surcharge,
    interest,
    compromise,
    totalPenalties,
    totalAmountPayable,
  };
}

export interface MonthlyQuarterConsolidationRow {
  monthIndex: 1 | 2 | 3;
  monthName: string;
  monthLabel: string;
  // Sales
  taxableSales: number;
  exemptSales: number;
  zeroRatedSales: number;
  totalSales: number;
  outputTax: number;
  // Purchases
  taxablePurchases: number;
  exemptPurchases: number;
  zeroRatedPurchases: number;
  totalPurchases: number;
  inputTax: number;
  // Net VAT
  netVat: number;
  // Backward compatibility / convenience aliases
  salesTaxable: number;
  salesExempt: number;
  salesZeroRated: number;
  salesOutputTax: number;
  purchasesTaxable: number;
  purchasesExempt: number;
  purchasesZeroRated: number;
  purchasesInputTax: number;
}

export interface QuarterlyConsolidationTotals {
  taxableSales: number;
  exemptSales: number;
  zeroRatedSales: number;
  totalSales: number;
  outputTax: number;
  taxablePurchases: number;
  exemptPurchases: number;
  zeroRatedPurchases: number;
  totalPurchases: number;
  inputTax: number;
  netVat: number;
  // Backward compatibility / convenience aliases
  salesTaxable: number;
  salesExempt: number;
  salesZeroRated: number;
  salesOutputTax: number;
  purchasesTaxable: number;
  purchasesExempt: number;
  purchasesZeroRated: number;
  purchasesInputTax: number;
}

export function getQuarterMonthInfo(quarter: Quarter, monthIndex: 1 | 2 | 3): { name: string; label: string } {
  const map: Record<Quarter, { names: string[]; labels: string[] }> = {
    Q1: { names: ['January', 'February', 'March'], labels: ['1st Month', '2nd Month', '3rd Month'] },
    Q2: { names: ['April', 'May', 'June'], labels: ['1st Month', '2nd Month', '3rd Month'] },
    Q3: { names: ['July', 'August', 'September'], labels: ['1st Month', '2nd Month', '3rd Month'] },
    Q4: { names: ['October', 'November', 'December'], labels: ['1st Month', '2nd Month', '3rd Month'] },
  };
  const qInfo = map[quarter] || map.Q3;
  return {
    name: qInfo.names[monthIndex - 1],
    label: qInfo.labels[monthIndex - 1],
  };
}

/**
 * Consolidates sales and purchases per month of the quarter across all branches.
 * Displays Total Taxable, Exempt, Zero-Rated Sales and Purchases, Output and Input Tax.
 */
export function computeMonthlyQuarterBreakdown({
  quarter,
  branches,
  purchasesMode,
  consolidatedPurchasesFile,
}: {
  quarter: Quarter;
  branches: ClientBranchSchedule[];
  purchasesMode: PurchasesReportingMode;
  consolidatedPurchasesFile?: BirUploadedFileRecord | null;
}): {
  months: MonthlyQuarterConsolidationRow[];
  monthlyBreakdown: MonthlyQuarterConsolidationRow[];
  quarterTotals: QuarterlyConsolidationTotals;
} {
  // Calendar month numbers for each quarter (1 to 12)
  const quarterMonthNumbers: Record<Quarter, [number, number, number]> = {
    Q1: [1, 2, 3],
    Q2: [4, 5, 6],
    Q3: [7, 8, 9],
    Q4: [10, 11, 12],
  };
  const monthNums = quarterMonthNumbers[quarter] || [7, 8, 9];

  const monthlyBreakdown: MonthlyQuarterConsolidationRow[] = ([1, 2, 3] as const).map((mIndex) => {
    const mKey = `month${mIndex}` as 'month1' | 'month2' | 'month3';
    const monthInfo = getQuarterMonthInfo(quarter, mIndex);
    const targetMonthNum = monthNums[mIndex - 1];

    let taxableSales = 0;
    let exemptSales = 0;
    let zeroRatedSales = 0;
    let outputTax = 0;

    let taxablePurchases = 0;
    let exemptPurchases = 0;
    let zeroRatedPurchases = 0;
    let inputTax = 0;

    // Consolidate Sales from each different branch for this month
    (branches || []).forEach((b) => {
      const sf = b?.salesFiles?.[mKey];
      if (sf && sf.totals) {
        taxableSales += sf.totals.taxableAmount || 0;
        exemptSales += sf.totals.exemptAmount || 0;
        zeroRatedSales += sf.totals.zeroRatedAmount || 0;
        outputTax += sf.totals.taxAmount || 0;
      }

      if (purchasesMode === 'per-branch') {
        const pf = b?.purchasesFiles?.[mKey];
        if (pf && pf.totals) {
          taxablePurchases += pf.totals.taxableAmount || 0;
          exemptPurchases += pf.totals.exemptAmount || 0;
          zeroRatedPurchases += pf.totals.zeroRatedAmount || 0;
          inputTax += pf.totals.taxAmount || 0;
        }
      }
    });

    if (purchasesMode === 'consolidated' && consolidatedPurchasesFile) {
      const txs = consolidatedPurchasesFile.transactions || [];
      const matchingTxs = txs.filter((t) => {
        if (!t.taxableMonth) return false;
        const str = t.taxableMonth.toLowerCase();
        const numPattern = new RegExp(`(^|[^0-9])0?${targetMonthNum}([^0-9]|$)`);
        const namePattern = monthInfo.name.toLowerCase().slice(0, 3);
        return numPattern.test(str) || str.includes(namePattern);
      });

      if (matchingTxs.length > 0) {
        matchingTxs.forEach((t) => {
          taxablePurchases += t.taxableAmount || 0;
          exemptPurchases += t.exemptAmount || 0;
          zeroRatedPurchases += t.zeroRatedAmount || 0;
          inputTax += t.taxAmount || 0;
        });
      } else if (txs.length === 0 && consolidatedPurchasesFile.totals) {
        taxablePurchases += (consolidatedPurchasesFile.totals.taxableAmount || 0) / 3;
        exemptPurchases += (consolidatedPurchasesFile.totals.exemptAmount || 0) / 3;
        zeroRatedPurchases += (consolidatedPurchasesFile.totals.zeroRatedAmount || 0) / 3;
        inputTax += (consolidatedPurchasesFile.totals.taxAmount || 0) / 3;
      }
    }

    const totalSales = taxableSales + exemptSales + zeroRatedSales;
    const totalPurchases = taxablePurchases + exemptPurchases + zeroRatedPurchases;
    const netVat = outputTax - inputTax;

    return {
      monthIndex: mIndex,
      monthName: monthInfo.name,
      monthLabel: monthInfo.label,
      taxableSales,
      exemptSales,
      zeroRatedSales,
      totalSales,
      outputTax,
      taxablePurchases,
      exemptPurchases,
      zeroRatedPurchases,
      totalPurchases,
      inputTax,
      netVat,
      salesTaxable: taxableSales,
      salesExempt: exemptSales,
      salesZeroRated: zeroRatedSales,
      salesOutputTax: outputTax,
      purchasesTaxable: taxablePurchases,
      purchasesExempt: exemptPurchases,
      purchasesZeroRated: zeroRatedPurchases,
      purchasesInputTax: inputTax,
    };
  });

  const rawTotals = monthlyBreakdown.reduce(
    (acc, m) => {
      acc.taxableSales += m.taxableSales;
      acc.exemptSales += m.exemptSales;
      acc.zeroRatedSales += m.zeroRatedSales;
      acc.totalSales += m.totalSales;
      acc.outputTax += m.outputTax;

      acc.taxablePurchases += m.taxablePurchases;
      acc.exemptPurchases += m.exemptPurchases;
      acc.zeroRatedPurchases += m.zeroRatedPurchases;
      acc.totalPurchases += m.totalPurchases;
      acc.inputTax += m.inputTax;

      acc.netVat += m.netVat;
      return acc;
    },
    {
      taxableSales: 0,
      exemptSales: 0,
      zeroRatedSales: 0,
      totalSales: 0,
      outputTax: 0,
      taxablePurchases: 0,
      exemptPurchases: 0,
      zeroRatedPurchases: 0,
      totalPurchases: 0,
      inputTax: 0,
      netVat: 0,
    }
  );

  const quarterTotals: QuarterlyConsolidationTotals = {
    ...rawTotals,
    salesTaxable: rawTotals.taxableSales,
    salesExempt: rawTotals.exemptSales,
    salesZeroRated: rawTotals.zeroRatedSales,
    salesOutputTax: rawTotals.outputTax,
    purchasesTaxable: rawTotals.taxablePurchases,
    purchasesExempt: rawTotals.exemptPurchases,
    purchasesZeroRated: rawTotals.zeroRatedPurchases,
    purchasesInputTax: rawTotals.inputTax,
  };

  return {
    months: monthlyBreakdown,
    monthlyBreakdown,
    quarterTotals,
  };
}

/**
 * Calculates current real-time Taxable Year, Quarter, and Month based on local system date.
 * - Q1: January - March (Months 1, 2, 3)
 * - Q2: April - June (Months 4, 5, 6)
 * - Q3: July - September (Months 7, 8, 9)
 * - Q4: October - December (Months 10, 11, 12)
 */
export function getRealTimeTaxPeriod(): {
  year: number;
  quarter: Quarter;
  month: number;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1 to 12
  let quarter: Quarter = 'Q1';
  if (month >= 1 && month <= 3) {
    quarter = 'Q1';
  } else if (month >= 4 && month <= 6) {
    quarter = 'Q2';
  } else if (month >= 7 && month <= 9) {
    quarter = 'Q3';
  } else {
    quarter = 'Q4';
  }
  return { year, quarter, month };
}


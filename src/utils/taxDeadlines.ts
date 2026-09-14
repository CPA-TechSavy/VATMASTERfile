import { TaxDeadlineItem, TaxCategory } from '../types/deadline';
import { ClientProfile } from '../types/tax';

/**
 * Checks if a given date is a weekend or Philippine legal holiday,
 * and rolls forward to the next business day per Section 294 of the Tax Code / EOPT.
 */
export function getAdjustedDeadline(year: number, month: number, day: number): {
  statutoryDate: string;
  actualDate: string;
  isShifted: boolean;
  reason?: string;
} {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const statutoryDateStr = `${year}-${pad(month)}-${pad(day)}`;

  // Create date in local representation
  const d = new Date(year, month - 1, day);
  let isShifted = false;
  let reason = '';

  const dayOfWeek = d.getDay(); // 0 = Sunday, 6 = Saturday

  // Philippine Regular Holidays check (simplified key fixed dates)
  const isHoliday = (checkDate: Date): { holiday: boolean; name?: string } => {
    const m = checkDate.getMonth() + 1;
    const dt = checkDate.getDate();

    if (m === 1 && dt === 1) return { holiday: true, name: "New Year's Day" };
    if (m === 4 && dt === 9) return { holiday: true, name: 'Araw ng Kagitingan' };
    if (m === 5 && dt === 1) return { holiday: true, name: 'Labor Day' };
    if (m === 6 && dt === 12) return { holiday: true, name: 'Independence Day' };
    if (m === 11 && dt === 1) return { holiday: true, name: "All Saints' Day" };
    if (m === 11 && dt === 30) return { holiday: true, name: 'Bonifacio Day' };
    if (m === 12 && dt === 25) return { holiday: true, name: 'Christmas Day' };
    if (m === 12 && dt === 30) return { holiday: true, name: 'Rizal Day' };
    return { holiday: false };
  };

  const initialHoliday = isHoliday(d);
  if (dayOfWeek === 6) {
    // Saturday -> shift to Monday
    d.setDate(d.getDate() + 2);
    isShifted = true;
    reason = 'Statutory deadline fell on Saturday; moved to Monday';
  } else if (dayOfWeek === 0) {
    // Sunday -> shift to Monday
    d.setDate(d.getDate() + 1);
    isShifted = true;
    reason = 'Statutory deadline fell on Sunday; moved to Monday';
  } else if (initialHoliday.holiday) {
    d.setDate(d.getDate() + 1);
    isShifted = true;
    reason = `Statutory deadline fell on ${initialHoliday.name}; moved to next business day`;
  }

  // Double check if the shifted date lands on another weekend or holiday
  while (d.getDay() === 0 || d.getDay() === 6 || isHoliday(d).holiday) {
    isShifted = true;
    d.setDate(d.getDate() + 1);
  }

  const actualDateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  return {
    statutoryDate: statutoryDateStr,
    actualDate: actualDateStr,
    isShifted,
    reason: isShifted ? reason : undefined,
  };
}

export const MONTH_NAMES_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MONTH_END_DAYS = [
  31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
];

/**
 * Calculates the exact date 60 days following the end of a given month.
 */
export function calculate60DaysAfterMonthEnd(refYear: number, monthEnd: number): {
  dueYear: number;
  dueMonth: number;
  dueDay: number;
} {
  const lastDay = new Date(refYear, monthEnd, 0).getDate();
  const d = new Date(refYear, monthEnd - 1, lastDay);
  d.setDate(d.getDate() + 60);
  return {
    dueYear: d.getFullYear(),
    dueMonth: d.getMonth() + 1,
    dueDay: d.getDate(),
  };
}

export interface ClientTaxableYearInfo {
  isFiscal: boolean;
  taxableYearType: 'calendar' | 'fiscal';
  endMonth: number; // 1-12
  endMonthName: string; // e.g. "June"
  endDay: number; // e.g. 30
  startMonthName: string; // e.g. "July"
  periodLabel: string; // e.g. "Fiscal Year (Ending June 30)" or "Calendar Year (Ending December 31)"
  annualAitrDeadline: string; // e.g. "October 15"
  eAfsDeadline: string; // e.g. "October 31"
  q1IncomeTaxDeadline: string; // e.g. "November 29"
  q2IncomeTaxDeadline: string; // e.g. "March 1"
  q3IncomeTaxDeadline: string; // e.g. "May 30"
  vatDeadlines: {
    q1: string;
    q2: string;
    q3: string;
    q4: string;
  };
  ewtDeadlines: {
    q1: string;
    q2: string;
    q3: string;
    q4: string;
  };
}

/**
 * Generates human-readable statutory deadline information for a given client profile.
 */
export function getClientTaxableYearInfo(client?: ClientProfile | null): ClientTaxableYearInfo {
  const isFiscal = client?.taxableYearType === 'fiscal' && Boolean(client?.fiscalYearEndMonth && client.fiscalYearEndMonth !== 12);
  const endMonth = isFiscal ? client!.fiscalYearEndMonth! : 12;
  const endMonthName = MONTH_NAMES_FULL[endMonth - 1];
  const endDay = MONTH_END_DAYS[endMonth - 1];
  const startMonthName = MONTH_NAMES_FULL[endMonth % 12];

  const periodLabel = isFiscal
    ? `Fiscal Year (Ending ${endMonthName} ${endDay})`
    : 'Calendar Year (Ending December 31)';

  // 1702 Annual: 15th of 4th month after fiscal year end
  const aitrDueMonth = ((endMonth - 1 + 4) % 12) + 1;
  const annualAitrDeadline = `${MONTH_NAMES_FULL[aitrDueMonth - 1]} 15`;

  // eAFS: Last day of 4th month after fiscal year end
  const eAfsLastDay = MONTH_END_DAYS[aitrDueMonth - 1];
  const eAfsDeadline = `${MONTH_NAMES_FULL[aitrDueMonth - 1]} ${eAfsLastDay}`;

  // 1702Q: 60 days after end of each of first 3 quarters
  const q1EndMonth = ((endMonth - 1 + 3) % 12) + 1;
  const q2EndMonth = ((endMonth - 1 + 6) % 12) + 1;
  const q3EndMonth = ((endMonth - 1 + 9) % 12) + 1;

  const q1Date = calculate60DaysAfterMonthEnd(2026, q1EndMonth);
  const q2Date = calculate60DaysAfterMonthEnd(2026, q2EndMonth);
  const q3Date = calculate60DaysAfterMonthEnd(2026, q3EndMonth);

  const q1IncomeTaxDeadline = `${MONTH_NAMES_FULL[q1Date.dueMonth - 1]} ${q1Date.dueDay}`;
  const q2IncomeTaxDeadline = `${MONTH_NAMES_FULL[q2Date.dueMonth - 1]} ${q2Date.dueDay}`;
  const q3IncomeTaxDeadline = `${MONTH_NAMES_FULL[q3Date.dueMonth - 1]} ${q3Date.dueDay}`;

  // VAT & EWT deadlines
  const vatQ1Month = (q1EndMonth % 12) + 1;
  const vatQ2Month = (q2EndMonth % 12) + 1;
  const vatQ3Month = (q3EndMonth % 12) + 1;
  const vatQ4Month = (endMonth % 12) + 1;

  const vatDeadlines = {
    q1: `${MONTH_NAMES_FULL[vatQ1Month - 1]} 25`,
    q2: `${MONTH_NAMES_FULL[vatQ2Month - 1]} 25`,
    q3: `${MONTH_NAMES_FULL[vatQ3Month - 1]} 25`,
    q4: `${MONTH_NAMES_FULL[vatQ4Month - 1]} 25`,
  };

  const ewtDeadlines = {
    q1: `${MONTH_NAMES_FULL[vatQ1Month - 1]} ${MONTH_END_DAYS[vatQ1Month - 1]}`,
    q2: `${MONTH_NAMES_FULL[vatQ2Month - 1]} ${MONTH_END_DAYS[vatQ2Month - 1]}`,
    q3: `${MONTH_NAMES_FULL[vatQ3Month - 1]} ${MONTH_END_DAYS[vatQ3Month - 1]}`,
    q4: `${MONTH_NAMES_FULL[vatQ4Month - 1]} ${MONTH_END_DAYS[vatQ4Month - 1]}`,
  };

  return {
    isFiscal,
    taxableYearType: isFiscal ? 'fiscal' : 'calendar',
    endMonth,
    endMonthName,
    endDay,
    startMonthName,
    periodLabel,
    annualAitrDeadline,
    eAfsDeadline,
    q1IncomeTaxDeadline,
    q2IncomeTaxDeadline,
    q3IncomeTaxDeadline,
    vatDeadlines,
    ewtDeadlines,
  };
}

/**
 * Returns all BIR statutory deadlines for the specified month and year.
 * Optionally adjusted for a specific client profile (e.g. fiscal vs calendar year).
 * month: 1 (Jan) to 12 (Dec)
 */
export function getBirDeadlinesForMonth(
  year: number,
  month: number,
  client?: ClientProfile | null
): TaxDeadlineItem[] {
  const deadlines: TaxDeadlineItem[] = [];

  const addDeadline = (
    statutoryDay: number,
    formCode: string,
    title: string,
    category: TaxCategory,
    periodCovered: string,
    applicableTo: TaxDeadlineItem['applicableTo'],
    attachments: string[],
    submissionChannel: string,
    legalBasis: string,
    description: string,
    targetAppTab?: TaxDeadlineItem['targetAppTab']
  ) => {
    const adjusted = getAdjustedDeadline(year, month, statutoryDay);
    deadlines.push({
      id: `${formCode}-${year}-${month}-${statutoryDay}`,
      formCode,
      title,
      category,
      statutoryDay,
      statutoryDate: adjusted.statutoryDate,
      actualDeadlineDate: adjusted.actualDate,
      isWeekendShifted: adjusted.isShifted,
      shiftedReason: adjusted.reason,
      periodCovered,
      applicableTo,
      attachments,
      submissionChannel,
      legalBasis,
      description,
      targetAppTab,
    });
  };

  // Fiscal or Calendar year configuration
  const isFiscal = client?.taxableYearType === 'fiscal' && Boolean(client?.fiscalYearEndMonth && client.fiscalYearEndMonth !== 12);
  const fiscalEndMonth = isFiscal ? client!.fiscalYearEndMonth! : 12;

  // Helper for month names
  const prevMonthName = new Date(year, month - 2, 1).toLocaleString('default', { month: 'long' });
  const prevMonthYear = month === 1 ? year - 1 : year;

  // -------------------------------------------------------------
  // 1. DAY 10 DEADLINES:
  // -------------------------------------------------------------
  // Month following the close of the taxable year (for year-end 1601-C adjustment on Day 15)
  const fiscalYearEndAdjMonth = (fiscalEndMonth % 12) + 1;

  // 1601-C: For all months except the month following the close of the taxable year
  if (month !== fiscalYearEndAdjMonth) {
    addDeadline(
      10,
      'BIR Form 1601-C',
      'Monthly Remittance Return of Income Taxes Withheld on Compensation',
      'withholding_tax',
      `Payroll & Compensation for ${prevMonthName} ${prevMonthYear}`,
      { withholdingAgent: true },
      ['Monthly Alphalist of Payees (MAP) if applicable'],
      'eBIRForms Offline Package v7.9+ / eFPS',
      'NIRC Sec. 58 & 81; RR No. 2-98 as amended',
      'Remittance of taxes withheld from employee salaries, wages, and compensation for the prior month.',
      '1601C'
    );
  }

  // 0619-E: Monthly Remittance Form for Expanded Withholding Tax (Creditable)
  // Required for the 1st and 2nd months of each quarter
  const q1Start = (fiscalEndMonth % 12) + 1;
  const q1End = ((fiscalEndMonth - 1 + 3) % 12) + 1;
  const q2End = ((fiscalEndMonth - 1 + 6) % 12) + 1;
  const q3End = ((fiscalEndMonth - 1 + 9) % 12) + 1;

  const q1RemitM1 = (q1Start % 12) + 1;
  const q1RemitM2 = ((q1Start + 1 - 1) % 12) + 1;
  const q2Start = (q1End % 12) + 1;
  const q2RemitM1 = (q2Start % 12) + 1;
  const q2RemitM2 = ((q2Start + 1 - 1) % 12) + 1;
  const q3Start = (q2End % 12) + 1;
  const q3RemitM1 = (q3Start % 12) + 1;
  const q3RemitM2 = ((q3Start + 1 - 1) % 12) + 1;
  const q4Start = (q3End % 12) + 1;
  const q4RemitM1 = (q4Start % 12) + 1;
  const q4RemitM2 = ((q4Start + 1 - 1) % 12) + 1;

  const valid0619EMonths = new Set([
    q1RemitM1, q1RemitM2,
    q2RemitM1, q2RemitM2,
    q3RemitM1, q3RemitM2,
    q4RemitM1, q4RemitM2,
  ]);

  if (valid0619EMonths.has(month)) {
    addDeadline(
      10,
      'BIR Form 0619-E',
      'Monthly Remittance Form for Creditable Income Taxes Withheld (Expanded)',
      'withholding_tax',
      `EWT for ${prevMonthName} ${prevMonthYear}`,
      { withholdingAgent: true },
      ['Copy of Form 2307 issued to payees'],
      'eBIRForms Offline Package / eFPS / Authorized Agent Banks (AABs)',
      'RR No. 11-2018; RR No. 2-98',
      'Remittance form used for the first two months of each quarter for creditable withholding taxes.',
      '1601EQ'
    );

    addDeadline(
      10,
      'BIR Form 0619-F',
      'Monthly Remittance Form of Final Income Taxes Withheld',
      'withholding_tax',
      `Final WTax for ${prevMonthName} ${prevMonthYear}`,
      { withholdingAgent: true },
      ['Schedule of Final Taxes Withheld'],
      'eBIRForms / eFPS',
      'RR No. 11-2018',
      'Remittance of final withholding taxes on interest, royalties, and dividends withheld in the prior month.'
    );
  }

  // -------------------------------------------------------------
  // 2. DAY 15 DEADLINES:
  // -------------------------------------------------------------
  // 1601-C for the final month of the taxable year (with year-end annualized adjustments)
  if (month === fiscalYearEndAdjMonth) {
    const endMonthName = MONTH_NAMES_FULL[fiscalEndMonth - 1];
    addDeadline(
      15,
      'BIR Form 1601-C',
      `Monthly Remittance of Taxes Withheld on Compensation (${endMonthName} Payroll & Year-End Adjustment)`,
      'withholding_tax',
      `${endMonthName} Compensation & Annual Year-End Adjustment`,
      { withholdingAgent: true },
      ['Year-end Annualized Withholding Tax Adjustment Schedule'],
      'eBIRForms / eFPS',
      'NIRC Sec. 81; RR No. 2-98',
      'Final monthly compensation withholding tax return of the prior taxable year reflecting year-end annualized adjustments.',
      '1601C'
    );
  }

  // Annual Income Tax Return (AITR): 15th day of the 4th month following close of taxable year
  const aitrDueMonth = ((fiscalEndMonth - 1 + 4) % 12) + 1;

  if (month === aitrDueMonth) {
    const endMonthName = MONTH_NAMES_FULL[fiscalEndMonth - 1];
    const endDay = MONTH_END_DAYS[fiscalEndMonth - 1];
    const periodDesc = isFiscal
      ? `Taxable Year ending ${endMonthName} ${endDay} (Fiscal Year)`
      : `Taxable Year ${year - 1} (Calendar Year ending Dec 31)`;

    // 1702 Annual (Corporations)
    addDeadline(
      15,
      'BIR Form 1702-RT / EX / MX',
      `Annual Income Tax Return for Corporations and Partnerships (${isFiscal ? `FY Ending ${endMonthName}` : `CY ${year - 1}`})`,
      'annual_compliance',
      periodDesc,
      { corporate: true },
      [
        'Audited Financial Statements (AFS)',
        'Statement Management Responsibility (SMR)',
        'SAWT for CWT 2307 credits',
      ],
      'eBIRForms / eFPS / eAFS portal',
      'NIRC Sec. 52 & 77; EOPT Act (RA 11976)',
      'Annual Corporate Income Tax Return for corporations, partnerships, and other juridical entities.',
      '1702Annual'
    );

    // 1701 Annual (Individuals)
    addDeadline(
      15,
      'BIR Form 1701 / 1701A',
      `Annual Income Tax Return for Individuals (${isFiscal ? `FY Ending ${endMonthName}` : `CY ${year - 1}`})`,
      'annual_compliance',
      periodDesc,
      { individual: true },
      [
        'Audited Financial Statements (if gross sales > ₱3M)',
        'BIR Form 2307 certificates',
        'SAWT (Summary Alphalist of Withholding Taxes)',
      ],
      'eBIRForms / eFPS / eAFS for attachments',
      'NIRC Sec. 51; EOPT Act (RA 11976)',
      'Annual final reconciliation of individual business/professional income tax for the prior taxable year.',
      '1701Annual'
    );
  }

  // Quarterly Individual Income Tax (1701Q): For calendar year taxpayers: Months 5 (Q1), 8 (Q2), 11 (Q3)
  if (!isFiscal) {
    if (month === 5) {
      addDeadline(
        15,
        'BIR Form 1701Q (Q1)',
        'Quarterly Income Tax Return for Individuals - 1st Quarter',
        'income_tax',
        `1st Quarter ${year} (January 1 to March 31)`,
        { individual: true },
        ['BIR Form 2307 (Certificates of Creditable Tax Withheld)', 'SAWT via eSubmission'],
        'eBIRForms Offline Package v7.9+ / eFPS',
        'NIRC Sec. 74 as amended by EOPT Act (RA 11976)',
        'First quarter income tax declaration for sole proprietors, professionals, and mixed income earners under graduated or 8% flat tax.',
        '1701Q'
      );
    }

    if (month === 8) {
      addDeadline(
        15,
        'BIR Form 1701Q (Q2)',
        'Quarterly Income Tax Return for Individuals - 2nd Quarter',
        'income_tax',
        `2nd Quarter ${year} (Cumulative Jan 1 to June 30)`,
        { individual: true },
        ['BIR Form 2307 for Q2', 'SAWT for Q2'],
        'eBIRForms Offline Package / eFPS',
        'NIRC Sec. 74; EOPT Act (RA 11976)',
        'Cumulative first-half income tax computation and declaration for individual taxpayers.',
        '1701Q'
      );
    }

    if (month === 11) {
      addDeadline(
        15,
        'BIR Form 1701Q (Q3)',
        'Quarterly Income Tax Return for Individuals - 3rd Quarter',
        'income_tax',
        `3rd Quarter ${year} (Cumulative Jan 1 to Sept 30)`,
        { individual: true },
        ['BIR Form 2307 for Q3', 'SAWT for Q3'],
        'eBIRForms Offline Package / eFPS',
        'NIRC Sec. 74; EOPT Act (RA 11976)',
        'Cumulative nine-month income tax calculation for individual taxpayers prior to annual consolidation.',
        '1701Q'
      );
    }
  }

  // -------------------------------------------------------------
  // 3. DAY 25 DEADLINES: QUARTERLY VAT (2550Q) & PERCENTAGE TAX (2551Q)
  // -------------------------------------------------------------
  // Due on the 25th day of the month following the close of each taxable quarter:
  const vatDueMonthQ1 = (q1End % 12) + 1;
  const vatDueMonthQ2 = (q2End % 12) + 1;
  const vatDueMonthQ3 = (q3End % 12) + 1;
  const vatDueMonthQ4 = (fiscalEndMonth % 12) + 1;

  if ([vatDueMonthQ1, vatDueMonthQ2, vatDueMonthQ3, vatDueMonthQ4].includes(month)) {
    let qLabel = '';
    let qPeriod = '';

    if (month === vatDueMonthQ1) {
      qLabel = `1st Quarter (Q1) ${isFiscal ? '(Fiscal)' : year}`;
      qPeriod = `1st Fiscal/Calendar Quarter ending ${MONTH_NAMES_FULL[q1End - 1]}`;
    } else if (month === vatDueMonthQ2) {
      qLabel = `2nd Quarter (Q2) ${isFiscal ? '(Fiscal)' : year}`;
      qPeriod = `2nd Fiscal/Calendar Quarter ending ${MONTH_NAMES_FULL[q2End - 1]}`;
    } else if (month === vatDueMonthQ3) {
      qLabel = `3rd Quarter (Q3) ${isFiscal ? '(Fiscal)' : year}`;
      qPeriod = `3rd Fiscal/Calendar Quarter ending ${MONTH_NAMES_FULL[q3End - 1]}`;
    } else {
      qLabel = `4th Quarter (Q4) ${isFiscal ? '(Fiscal)' : year - 1}`;
      qPeriod = `4th Fiscal/Calendar Quarter ending ${MONTH_NAMES_FULL[fiscalEndMonth - 1]}`;
    }

    // 2550Q (VAT)
    addDeadline(
      25,
      'BIR Form 2550Q',
      `Quarterly Value-Added Tax Return (${qLabel})`,
      'vat',
      qPeriod,
      { vatRegistered: true },
      [
        'Summary List of Sales (SLS) via eSubmission',
        'Summary List of Purchases (SLP)',
        'BIR Form 2307 (Withholding VAT certificates)',
      ],
      'eBIRForms / eFPS',
      'NIRC Sec. 114; EOPT Act (RA 11976 - Mandatory Quarterly Filing)',
      'Declaration of 12% output VAT, domestic & capital input tax credits, and creditable VAT withheld for the quarter.',
      '2550Q'
    );

    // 2551Q (Percentage Tax)
    addDeadline(
      25,
      'BIR Form 2551Q',
      `Quarterly Percentage Tax Return (${qLabel})`,
      'percentage_tax',
      qPeriod,
      { nonVat: true },
      ['BIR Form 2307 creditable percentage tax certificates'],
      'eBIRForms / eFPS',
      'NIRC Sec. 116 / 128 as amended by EOPT Act (RA 11976)',
      'Quarterly 3% business tax declaration for non-VAT individuals, partnerships, and corporations.',
      '2551Q'
    );
  }

  // -------------------------------------------------------------
  // 4. CORPORATE QUARTERLY INCOME TAX (1702Q)
  // Under Sec. 75, due within 60 days following the close of each of the first three quarters.
  // -------------------------------------------------------------
  const q1DueDate = calculate60DaysAfterMonthEnd(year, q1End);
  const q2DueDate = calculate60DaysAfterMonthEnd(year, q2End);
  const q3DueDate = calculate60DaysAfterMonthEnd(year, q3End);

  if (month === q1DueDate.dueMonth) {
    addDeadline(
      q1DueDate.dueDay,
      'BIR Form 1702Q (Q1)',
      `Quarterly Income Tax Return for Corporations - 1st Quarter ${isFiscal ? '(Fiscal)' : ''}`,
      'income_tax',
      `1st Quarter (ended ${MONTH_NAMES_FULL[q1End - 1]})`,
      { corporate: true },
      ['BIR Form 2307 CWT certificates', 'SAWT electronic submission'],
      'eBIRForms / eFPS',
      'NIRC Sec. 75; CREATE Act (20% MSME or 25% Regular)',
      'First quarter corporate income tax return with 2% MCIT computation comparison within 60 days of quarter end.',
      '1702Q'
    );
  }

  if (month === q2DueDate.dueMonth) {
    addDeadline(
      q2DueDate.dueDay,
      'BIR Form 1702Q (Q2)',
      `Quarterly Income Tax Return for Corporations - 2nd Quarter ${isFiscal ? '(Fiscal)' : ''}`,
      'income_tax',
      `2nd Quarter (Cumulative ending ${MONTH_NAMES_FULL[q2End - 1]})`,
      { corporate: true },
      ['BIR Form 2307 CWT certificates', 'SAWT electronic submission'],
      'eBIRForms / eFPS',
      'NIRC Sec. 75; CREATE Act',
      'Cumulative first-half corporate income tax return comparing RCIT against MCIT within 60 days of quarter end.',
      '1702Q'
    );
  }

  if (month === q3DueDate.dueMonth) {
    addDeadline(
      q3DueDate.dueDay,
      'BIR Form 1702Q (Q3)',
      `Quarterly Income Tax Return for Corporations - 3rd Quarter ${isFiscal ? '(Fiscal)' : ''}`,
      'income_tax',
      `3rd Quarter (Cumulative ending ${MONTH_NAMES_FULL[q3End - 1]})`,
      { corporate: true },
      ['BIR Form 2307 CWT certificates', 'SAWT electronic submission'],
      'eBIRForms / eFPS',
      'NIRC Sec. 75; CREATE Act',
      'Cumulative nine-month corporate income tax declaration before annual filing within 60 days of quarter end.',
      '1702Q'
    );
  }

  // -------------------------------------------------------------
  // 5. LAST DAY OF MONTH: QUARTERLY EXPANDED WITHHOLDING (1601-EQ & 1601-FQ)
  // Months: Month following the close of each quarter (same months as VAT)
  // -------------------------------------------------------------
  if ([vatDueMonthQ1, vatDueMonthQ2, vatDueMonthQ3, vatDueMonthQ4].includes(month)) {
    const lastDay = new Date(year, month, 0).getDate(); // 30 or 31
    let qLabel = '';
    let qPeriod = '';

    if (month === vatDueMonthQ1) {
      qLabel = `1st Quarter ${isFiscal ? '(Fiscal)' : year}`;
      qPeriod = `Quarter ending ${MONTH_NAMES_FULL[q1End - 1]}`;
    } else if (month === vatDueMonthQ2) {
      qLabel = `2nd Quarter ${isFiscal ? '(Fiscal)' : year}`;
      qPeriod = `Quarter ending ${MONTH_NAMES_FULL[q2End - 1]}`;
    } else if (month === vatDueMonthQ3) {
      qLabel = `3rd Quarter ${isFiscal ? '(Fiscal)' : year}`;
      qPeriod = `Quarter ending ${MONTH_NAMES_FULL[q3End - 1]}`;
    } else {
      qLabel = `4th Quarter ${isFiscal ? '(Fiscal)' : year - 1}`;
      qPeriod = `Quarter ending ${MONTH_NAMES_FULL[fiscalEndMonth - 1]}`;
    }

    addDeadline(
      lastDay,
      'BIR Form 1601-EQ',
      `Quarterly Remittance Return of Creditable Income Taxes Withheld (Expanded) - ${qLabel}`,
      'withholding_tax',
      qPeriod,
      { withholdingAgent: true },
      ['Quarterly Alphabetical List of Payees (QAP) via eSubmission'],
      'eBIRForms Offline Package / eFPS',
      'RR No. 11-2018',
      'Quarterly consolidation of Expanded Withholding Taxes and mandatory QAP file submission.',
      '1601EQ'
    );

    addDeadline(
      lastDay,
      'BIR Form 1601-FQ',
      `Quarterly Remittance Return of Final Income Taxes Withheld - ${qLabel}`,
      'withholding_tax',
      qPeriod,
      { withholdingAgent: true },
      ['Quarterly Alphabetical List of Payees (QAP) for Final Taxes'],
      'eBIRForms Offline Package / eFPS',
      'RR No. 11-2018',
      'Consolidation of final withholding taxes deducted at source for the entire quarter.'
    );
  }

  // -------------------------------------------------------------
  // 6. SPECIAL ANNUAL INFORMATION RETURNS & ATTACHMENTS
  // -------------------------------------------------------------
  // January 31: 1604-C, 1604-F, Form 2316 issuance
  if (month === 1) {
    addDeadline(
      31,
      'BIR Form 1604-C & Alphalist',
      'Annual Information Return of Income Taxes Withheld on Compensation',
      'annual_compliance',
      `Calendar Year ${year - 1} (Full Year)`,
      { withholdingAgent: true },
      ['Annual Alphabetical List of Employees (Alphalist) via eSubmission'],
      'eBIRForms / eSubmission',
      'RR No. 2-98 as amended by RR 11-2018',
      'Mandatory annual submission summarizing all employee compensation, tax-exempt minimum wage, and taxes withheld.'
    );

    addDeadline(
      31,
      'BIR Form 2316 (Employee Copy)',
      'Issuance of Certificate of Compensation Payment / Tax Withheld to Employees',
      'annual_compliance',
      `Calendar Year ${year - 1}`,
      { withholdingAgent: true },
      ['BIR Form 2316 duplicate copies signed by employer and employee'],
      'Physical or secure electronic distribution to employees',
      'NIRC Sec. 83; RR No. 2-98',
      'Statutory deadline for employers to furnish all employees with their certified BIR Form 2316 certificates.'
    );
  }

  // February 28: 1604-E, 2316 Substituted Filing
  if (month === 2) {
    const febLastDay = new Date(year, 2, 0).getDate(); // 28 or 29
    addDeadline(
      febLastDay,
      'BIR Form 1604-E & Alphalist',
      'Annual Information Return of Creditable Income Taxes Withheld (Expanded)',
      'annual_compliance',
      `Calendar Year ${year - 1}`,
      { withholdingAgent: true },
      ['Annual Alphabetical List of Payees (Alphalist of EWT) via eSubmission'],
      'eBIRForms / eSubmission',
      'RR No. 11-2018',
      'Annual consolidation of all payees subjected to expanded withholding tax throughout the preceding year.'
    );

    addDeadline(
      febLastDay,
      'BIR Form 2316 (BIR Submission)',
      'Submission of Signed BIR Form 2316 Copies for Substituted Filing',
      'annual_compliance',
      `Calendar Year ${year - 1}`,
      { withholdingAgent: true },
      ['Certified list of qualified substituted filing employees', 'Scanned / PDF Form 2316 in DVD/USB or eAFS'],
      'RDO Submission / eAFS Portal',
      'RMO No. 24-2019; RR No. 2-98',
      'Mandatory submission to the BIR RDO of duplicate copies of Form 2316 for employees qualified for substituted filing.'
    );
  }

  // eAFS submission for Audited Financial Statements: Last day of 4th month following fiscal year end
  if (month === aitrDueMonth) {
    const aitrLastDay = new Date(year, month, 0).getDate();
    const endMonthName = MONTH_NAMES_FULL[fiscalEndMonth - 1];
    addDeadline(
      aitrLastDay,
      'eAFS Submission',
      `Online Submission of Audited Financial Statements (AFS) & Attachments via eAFS (${isFiscal ? `FY Ending ${endMonthName}` : `CY ${year - 1}`})`,
      'annual_compliance',
      isFiscal ? `Fiscal Year ending ${endMonthName}` : `Calendar Year ${year - 1}`,
      { corporate: true, individual: true },
      [
        'Audited Financial Statements with BIR Stamp Receipt',
        'Statement of Management Responsibility (SMR)',
        'Auditor Notes to Financial Statements',
      ],
      'BIR eAFS Online Web Portal (eafs.bir.gov.ph)',
      'RMC No. 49-2020; RMC No. 43-2021',
      'Filing of scanned copies of the annual ITR, AFS, and supporting schedules within 15 days from AITR filing deadline.'
    );
  }

  // Sort deadlines by actual deadline date ascending, then statutory day
  return deadlines.sort((a, b) => {
    if (a.actualDeadlineDate !== b.actualDeadlineDate) {
      return a.actualDeadlineDate.localeCompare(b.actualDeadlineDate);
    }
    return a.statutoryDay - b.statutoryDay;
  });
}

/**
 * Determines if a specific tax deadline is applicable to a given client profile.
 */
export function isDeadlineApplicableToClient(deadline: TaxDeadlineItem, client: ClientProfile): boolean {
  const isCorpOrPartnership =
    client.classification === 'Corporation' ||
    client.classification === 'Non-Stock' ||
    client.classification === 'Partnership';
  const isIndividual = client.classification === 'Single';
  const isVat = client.vatStatus === 'vat-registered';

  const { applicableTo } = deadline;

  // Universal filings
  if (applicableTo.all) return true;

  // Withholding tax check
  if (applicableTo.withholdingAgent) {
    return client.isWithholdingAgent;
  }

  // Corporate income tax (1702Q, 1702 Annual)
  if (applicableTo.corporate && !isCorpOrPartnership) {
    return false;
  }

  // Individual income tax (1701Q, 1701 Annual)
  if (applicableTo.individual && !isIndividual) {
    return false;
  }

  // VAT (2550Q)
  if (applicableTo.vatRegistered && !isVat) {
    return false;
  }

  // Non-VAT Percentage Tax (2551Q)
  if (applicableTo.nonVat) {
    if (isVat) return false;
    return true;
  }

  return true;
}

/**
 * Calculates urgency of a deadline relative to a target date (e.g. current date).
 */
export function calculateDeadlineStatus(
  deadlineDateStr: string,
  referenceDateStr?: string
): {
  daysDiff: number;
  label: string;
  badgeColor: string;
} {
  const ref = referenceDateStr ? new Date(referenceDateStr) : new Date();
  ref.setHours(0, 0, 0, 0);

  const [y, m, d] = deadlineDateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - ref.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const daysAgo = Math.abs(diffDays);
    return {
      daysDiff: diffDays,
      label: daysAgo === 1 ? '1 day past deadline' : `${daysAgo} days past deadline`,
      badgeColor: 'bg-slate-100 text-slate-600 border-slate-300',
    };
  } else if (diffDays === 0) {
    return {
      daysDiff: 0,
      label: 'Due Today!',
      badgeColor: 'bg-rose-500 text-white animate-pulse',
    };
  } else if (diffDays <= 3) {
    return {
      daysDiff: diffDays,
      label: diffDays === 1 ? 'Due tomorrow' : `Due in ${diffDays} days`,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    };
  } else if (diffDays <= 7) {
    return {
      daysDiff: diffDays,
      label: `Due in ${diffDays} days`,
      badgeColor: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    };
  } else {
    return {
      daysDiff: diffDays,
      label: `In ${diffDays} days`,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }
}

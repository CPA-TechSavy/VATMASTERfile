export type TaxClassification =
  | 'Corporation'
  | 'Non-Stock'
  | 'Partnership'
  | 'Single';

export type VatStatus = 'vat-registered' | 'non-vat';

export interface ClientProfile {
  id: string;
  tradeName: string;
  registeredName: string;
  tin: string; // e.g. 123-456-789-000
  rdo: string; // e.g. RDO 044 - Taguig / Pateros
  classification: TaxClassification;
  vatStatus: VatStatus;
  isWithholdingAgent: boolean;
  hasBranches?: boolean; // Client has branches or is a single unit / no branch
  notes?: string;
}

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface PeriodSelector {
  year: number;
  quarter: Quarter;
  month: number; // 1-12 for monthly returns like 1601-C, 0619-E
}

// BIR Form 1701Q: Quarterly Income Tax Return for Individuals
export interface Data1701Q {
  taxRegime: '8_percent' | 'graduated';
  taxpayerType: 'pure_business' | 'mixed_income';
  deductionMethod: 'osd' | 'itemized'; // 40% OSD or Itemized
  grossSalesCurrentQuarter: number;
  nonOperatingIncome: number;
  grossSalesPriorQuarters: number;
  // Deductions (if graduated + itemized)
  costOfSales: number;
  operatingExpenses: number;
  // Credits
  priorYearExcessCredits: number;
  quarterlyTaxPaidPriorQuarters: number;
  cwt2307Credits: number;
  otherTaxCredits: number;
}

// BIR Form 1702Q: Quarterly Income Tax Return for Corporations
export interface Data1702Q {
  rateOption: 'regular_25' | 'msme_20';
  isMCOptional: boolean; // MCIT applicable (after 4th year)
  grossSales: number;
  costOfSales: number;
  operatingExpenses: number;
  nonOperatingIncome: number;
  // Credits
  priorYearExcessCredits: number;
  priorQuarterTaxPaid: number;
  cwt2307Credits: number;
  otherTaxCredits: number;
}

// BIR Form 2550Q: Quarterly Value-Added Tax Return
export interface Data2550Q {
  vatableSales: number;
  salesToGovernment: number;
  zeroRatedSales: number;
  vatExemptSales: number;
  // Input tax breakdown
  inputPurchasesGoods: number; // Domestic purchases of goods
  inputPurchasesServices: number; // Domestic purchases of services
  inputCapitalGoods: number; // Capital goods purchase
  inputImportations: number;
  priorQuarterExcessInputVat: number;
  // Credits
  withheldVat2307Govt: number; // 5% standard VAT withholding
  withheldVat2307Private: number;
  priorPaymentsThisQuarter: number;
}

// BIR Form 2551Q: Quarterly Percentage Tax Return
export interface Data2551Q {
  atcCode: 'PT010' | 'PT040' | 'PT060' | 'OTHER';
  taxRatePercent: number; // Default 3% under Tax Code
  grossSalesCurrentQuarter: number;
  exemptSales: number;
  cwt2307Credits: number; // Form 2307 Percentage Tax withheld
  priorQuarterTaxPaid: number;
}

// BIR Form 1601-C: Monthly Remittance Return of Income Taxes Withheld on Compensation
export interface Data1601C {
  totalGrossCompensation: number;
  // Statutory Non-Taxable Compensation
  minimumWageEarners: number;
  statutoryContributions: number; // SSS, PhilHealth, Pag-IBIG, Union dues
  thirteenthMonthAndDeMinimis: number; // Non-taxable portion
  otherNonTaxableCompensation: number;
  // Adjustments & Credits
  taxWithheldAdjustments: number;
  taxRemittedPreviously: number;
}

// BIR Form 0619-E / 1601-EQ: Expanded Withholding Tax (Creditable)
export interface EwtLineItem {
  id: string;
  atc: string; // e.g. WI100, WI157, WB080
  description: string;
  ratePercent: number;
  taxBase: number;
}

export interface Data1601EQ {
  isMonthly: boolean; // true = 0619-E (Monthly), false = 1601-EQ (Quarterly)
  lineItems: EwtLineItem[];
  priorMonthTaxRemitted: number;
  overpaymentPreviousPeriod: number;
}

// Penalties structure
export interface PenaltiesData {
  daysLate: number;
  includeSurcharge: boolean; // 25% standard
  includeInterest: boolean; // 12% per annum
  includeCompromise: boolean; // BIR compromise schedule
}

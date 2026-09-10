import {
  ClientProfile,
  Data1701Q,
  Data1702Q,
  Data2550Q,
  Data2551Q,
  Data1601C,
  Data1601EQ,
} from '../types/tax';

export const DEFAULT_CLIENTS: ClientProfile[] = [
  {
    id: 'client-1',
    tradeName: 'Dr. Elena Santos Medical Clinic',
    registeredName: 'Elena Velasquez Santos, MD',
    tin: '241-893-412-000',
    rdo: 'RDO 044 - Taguig / Pateros',
    classification: 'Single',
    vatStatus: 'non-vat',
    isWithholdingAgent: false,
    notes: 'Medical practitioner on 8% Gross Income Tax regime. Files quarterly BIR Form 1701Q under EOPT Law.',
  },
  {
    id: 'client-2',
    tradeName: 'Apex Pacific Logistics',
    registeredName: 'Apex Pacific Logistics Corporation',
    tin: '009-451-820-000',
    rdo: 'RDO 047 - East Makati',
    classification: 'Corporation',
    vatStatus: 'vat-registered',
    isWithholdingAgent: true,
    notes: 'Freight forwarder & warehousing corporation. Files 1702Q, 2550Q, 1601-C, 0619-E under EOPT Law.',
  },
  {
    id: 'client-3',
    tradeName: 'Kape & Salo-Salo Cafe',
    registeredName: 'Roberto Alcantara Mendoza',
    tin: '185-320-741-000',
    rdo: 'RDO 039 - South Quezon City',
    classification: 'Single',
    vatStatus: 'non-vat',
    isWithholdingAgent: true,
    notes: 'Specialty cafe sole proprietorship. Files 1701Q (Graduated with 40% OSD) and 2551Q (3% Percentage Tax) under EOPT Law.',
  },
  {
    id: 'client-4',
    tradeName: 'Bayanihan Community Foundation',
    registeredName: 'Bayanihan Community Foundation, Inc.',
    tin: '312-704-589-000',
    rdo: 'RDO 080 - Mandaue City, Cebu',
    classification: 'Non-Stock',
    vatStatus: 'non-vat',
    isWithholdingAgent: true,
    notes: 'Non-stock non-profit institution. Withholding agent filing 1702Q/1702-EX, 1601-C, and 0619-E/1601-EQ under EOPT Law.',
  },
  {
    id: 'client-5',
    tradeName: 'Reyes & Associates Law',
    registeredName: 'Reyes, Gomez & Associates General Professional Partnership',
    tin: '458-912-330-000',
    rdo: 'RDO 048 - West Makati',
    classification: 'Partnership',
    vatStatus: 'vat-registered',
    isWithholdingAgent: true,
    notes: 'General Professional Partnership (GPP). VAT-registered and withholding agent. Files 1702Q, 2550Q, 1601-C, 1601-EQ.',
  },
];

export const INITIAL_DATA_1701Q: Record<string, Data1701Q> = {
  'client-1': {
    taxRegime: '8_percent',
    taxpayerType: 'pure_business',
    deductionMethod: 'osd',
    grossSalesCurrentQuarter: 850000,
    nonOperatingIncome: 25000,
    grossSalesPriorQuarters: 920000,
    costOfSales: 0,
    operatingExpenses: 0,
    priorYearExcessCredits: 0,
    quarterlyTaxPaidPriorQuarters: 53600,
    cwt2307Credits: 42500, // 5% professional fee withholding from HMOs
    otherTaxCredits: 0,
  },
  'client-3': {
    taxRegime: 'graduated',
    taxpayerType: 'pure_business',
    deductionMethod: 'osd',
    grossSalesCurrentQuarter: 620000,
    nonOperatingIncome: 0,
    grossSalesPriorQuarters: 580000,
    costOfSales: 0,
    operatingExpenses: 0,
    priorYearExcessCredits: 0,
    quarterlyTaxPaidPriorQuarters: 28500,
    cwt2307Credits: 6200,
    otherTaxCredits: 0,
  },
  'client-4': {
    taxRegime: 'graduated',
    taxpayerType: 'pure_business',
    deductionMethod: 'itemized',
    grossSalesCurrentQuarter: 1450000,
    nonOperatingIncome: 45000,
    grossSalesPriorQuarters: 1200000,
    costOfSales: 480000,
    operatingExpenses: 360000,
    priorYearExcessCredits: 15000,
    quarterlyTaxPaidPriorQuarters: 75000,
    cwt2307Credits: 72500, // 5% withholding by developer clients
    otherTaxCredits: 0,
  },
};

export const INITIAL_DATA_1702Q: Record<string, Data1702Q> = {
  'client-2': {
    rateOption: 'msme_20',
    isMCOptional: true,
    grossSales: 4850000,
    costOfSales: 2950000,
    operatingExpenses: 1120000,
    nonOperatingIncome: 65000,
    priorYearExcessCredits: 42000,
    priorQuarterTaxPaid: 68000,
    cwt2307Credits: 97000, // 2% contractor / broker CWT
    otherTaxCredits: 0,
  },
  'client-4': {
    rateOption: 'regular_25',
    isMCOptional: false,
    grossSales: 1200000,
    costOfSales: 0,
    operatingExpenses: 950000,
    nonOperatingIncome: 0,
    priorYearExcessCredits: 0,
    priorQuarterTaxPaid: 0,
    cwt2307Credits: 12000,
    otherTaxCredits: 0,
  },
  'client-5': {
    rateOption: 'regular_25',
    isMCOptional: false,
    grossSales: 3400000,
    costOfSales: 450000,
    operatingExpenses: 1680000,
    nonOperatingIncome: 0,
    priorYearExcessCredits: 18000,
    priorQuarterTaxPaid: 45000,
    cwt2307Credits: 85000,
    otherTaxCredits: 0,
  },
};

export const INITIAL_DATA_2550Q: Record<string, Data2550Q> = {
  'client-2': {
    vatableSales: 4850000,
    salesToGovernment: 350000,
    zeroRatedSales: 0,
    vatExemptSales: 0,
    inputPurchasesGoods: 1200000,
    inputPurchasesServices: 850000,
    inputCapitalGoods: 250000,
    inputImportations: 0,
    priorQuarterExcessInputVat: 48000,
    withheldVat2307Govt: 17500, // 5% withholding on govt sales
    withheldVat2307Private: 0,
    priorPaymentsThisQuarter: 0,
  },
  'client-5': {
    vatableSales: 3400000,
    salesToGovernment: 0,
    zeroRatedSales: 0,
    vatExemptSales: 0,
    inputPurchasesGoods: 180000,
    inputPurchasesServices: 420000,
    inputCapitalGoods: 0,
    inputImportations: 0,
    priorQuarterExcessInputVat: 15000,
    withheldVat2307Govt: 0,
    withheldVat2307Private: 0,
    priorPaymentsThisQuarter: 0,
  },
};

export const INITIAL_DATA_2551Q: Record<string, Data2551Q> = {
  'client-3': {
    atcCode: 'PT010',
    taxRatePercent: 3,
    grossSalesCurrentQuarter: 620000,
    exemptSales: 0,
    cwt2307Credits: 6200, // 1% from delivery platforms / card merchants
    priorQuarterTaxPaid: 0,
  },
};

export const INITIAL_DATA_1601C: Record<string, Data1601C> = {
  'client-2': {
    totalGrossCompensation: 420000,
    minimumWageEarners: 65000,
    statutoryContributions: 31500, // SSS, PhilHealth, Pag-IBIG
    thirteenthMonthAndDeMinimis: 18000,
    otherNonTaxableCompensation: 0,
    taxWithheldAdjustments: 0,
    taxRemittedPreviously: 0,
  },
  'client-3': {
    totalGrossCompensation: 125000,
    minimumWageEarners: 72000,
    statutoryContributions: 9800,
    thirteenthMonthAndDeMinimis: 4500,
    otherNonTaxableCompensation: 0,
    taxWithheldAdjustments: 0,
    taxRemittedPreviously: 0,
  },
};

export const INITIAL_DATA_1601EQ: Record<string, Data1601EQ> = {
  'client-2': {
    isMonthly: true, // Form 0619-E
    priorMonthTaxRemitted: 0,
    overpaymentPreviousPeriod: 0,
    lineItems: [
      {
        id: 'ewt-1',
        atc: 'WC100',
        description: 'Professional Fees - Corporate/Legal/Consultancy (10%)',
        ratePercent: 10,
        taxBase: 150000,
      },
      {
        id: 'ewt-2',
        atc: 'WC157',
        description: 'Rent on Real Property - Commercial Warehouse (5%)',
        ratePercent: 5,
        taxBase: 280000,
      },
      {
        id: 'ewt-3',
        atc: 'WC005',
        description: 'Sub-contractors / Trucking & Hauling Services (2%)',
        ratePercent: 2,
        taxBase: 420000,
      },
    ],
  },
};

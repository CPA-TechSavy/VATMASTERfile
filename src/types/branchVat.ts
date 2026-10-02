import { Quarter } from './tax';

export type MonthIndex = 1 | 2 | 3;
export type PurchasesReportingMode = 'consolidated' | 'per-branch';

export interface BirTransactionRow {
  rowNum: number;
  taxableMonth: string;
  tin: string;
  registeredName: string;
  address: string;
  grossAmount: number;
  exemptAmount: number;
  zeroRatedAmount: number;
  taxableAmount: number;
  servicesAmount: number;
  capitalGoodsAmount: number;
  goodsOtherThanCapitalAmount: number;
  taxAmount: number; // Input Tax (Purchases) or Output Tax (Sales)
  grossTaxableAmount: number;
}

export interface BirUploadedFileRecord {
  id: string;
  fileType: 'sales' | 'purchases';
  quarter: Quarter;
  month: MonthIndex | 'consolidated';
  branchId?: string;
  branchName?: string;
  fileName: string;
  uploadedAt: string;
  tinHeader?: string;
  ownerNameHeader?: string;
  tradeNameHeader?: string;
  rowCount: number;
  totals: {
    grossAmount: number;
    exemptAmount: number;
    zeroRatedAmount: number;
    taxableAmount: number;
    servicesAmount: number;
    capitalGoodsAmount: number;
    goodsOtherThanCapitalAmount: number;
    taxAmount: number;
    grossTaxableAmount: number;
  };
  transactions: BirTransactionRow[];
}

export interface ClientBranchSchedule {
  id: string;
  name: string; // e.g. "Main Branch / Head Office", "Branch 2 - Cebu"
  salesFiles: {
    month1?: BirUploadedFileRecord;
    month2?: BirUploadedFileRecord;
    month3?: BirUploadedFileRecord;
  };
  purchasesFiles?: {
    month1?: BirUploadedFileRecord;
    month2?: BirUploadedFileRecord;
    month3?: BirUploadedFileRecord;
  };
}

export interface MultiBranchReportingState {
  branches: ClientBranchSchedule[];
  purchasesMode: PurchasesReportingMode; // 'consolidated' | 'per-branch'
  consolidatedPurchasesFile?: BirUploadedFileRecord;
  deferralState?: SalesDeferralState;
  salesPurchasesAdjustmentState?: SalesAndPurchasesAdjustmentState;
}

export interface SalesDeferralState {
  deferredCustomerKeys: string[]; // unique IDs of transactions from Combined Sales Data
  manualTaxableSales: number; // manual taxable sales deferred
  manualVatDue: number; // manual VAT Due / Output Tax deferred
  previousQuarterHideAmount?: number; // Previous quarter hide amount (Taxable Sales)
  previousQuarterHideOutputTax?: number; // Previous quarter hide amount (Output VAT)
}

export interface SalesAndPurchasesAdjustmentState {
  increaseTaxableSales: number; // Additional taxable sales (₱)
  increaseOutputTax: number; // Additional output tax (₱, 12%)
  decreaseTaxablePurchases: number; // Manual reduction in taxable purchases (₱)
  decreaseInputTax: number; // Manual reduction in input tax (₱, 12%)
  reducedPurchaseKeys?: string[]; // Specific purchase transaction keys excluded/reduced
  specificPurchasesTaxable?: number; // Total taxable amount from selected specific purchase transactions
  specificPurchasesInputTax?: number; // Total input tax amount from selected specific purchase transactions
  notes?: string;
}

export interface SalesPurchasesAdjustmentSummary {
  hasActiveAdjustment: boolean;
  increaseTaxableSales: number;
  increaseOutputTax: number;
  manualDecreasePurchasesTaxable: number;
  manualDecreasePurchasesInputTax: number;
  specificDecreasePurchasesTaxable: number;
  specificDecreasePurchasesInputTax: number;
  totalDecreasePurchasesTaxable: number;
  totalDecreasePurchasesInputTax: number;
  specificPurchasesCount: number;
  netVatAdjustmentImpact: number; // additional net tax payable from adjustments
}

export interface CombinedPurchasesItem extends BirTransactionRow {
  monthIndex: MonthIndex | 0;
  monthLabel: string;
  monthName: string;
  branchName: string;
  branchId: string;
}

export interface SalesDeferralSummary {
  hasActiveDeferral: boolean;
  totalSpecificDeferredTaxable: number;
  totalSpecificDeferredOutputTax: number;
  manualDeferredTaxable: number;
  manualDeferredOutputTax: number;
  totalDeferredTaxable: number;
  totalDeferredOutputTax: number;
  specificCount: number;
  previousQuarterHideAmount?: number;
  previousQuarterHideOutputTax?: number;
}

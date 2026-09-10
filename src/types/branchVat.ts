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
}

export interface SalesDeferralState {
  deferredCustomerKeys: string[]; // unique IDs of transactions from Combined Sales Data
  manualTaxableSales: number; // manual taxable sales deferred
  manualVatDue: number; // manual VAT Due / Output Tax deferred
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
}

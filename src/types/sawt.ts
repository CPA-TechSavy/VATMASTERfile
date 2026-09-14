export interface SawtRecord {
  id: string;
  seqNo: number;
  taxablePeriod?: string; // e.g. "Q1", "Q2", "Q3", "Q4", or taxable month
  payorTin: string;
  payorName: string;
  atcCode: string;
  description: string;
  grossAmount: number; // Amount of Income Payment (Tax Base)
  taxRate: number; // e.g. 1, 2, 5, 10, 15 (%)
  cwtAmount: number; // Amount of Tax Withheld (Form 2307 Creditable Withholding Tax)
  transactionCount?: number; // Number of consolidated line items/certificates
  rawTransactions?: SawtRecord[]; // Underlying individual transactions
}

export interface SawtSummary {
  fileName: string;
  uploadDate: string;
  totalCwtAmount: number;
  totalGrossAmount: number;
  totalRecords: number;
  uniquePayorsCount: number;
  records: SawtRecord[]; // Summarized into one entry per Customer TIN
  rawRecords?: SawtRecord[]; // Original line-item records prior to TIN consolidation
  quarterlyBreakdown: {
    Q1: { gross: number; cwt: number; count: number };
    Q2: { gross: number; cwt: number; count: number };
    Q3: { gross: number; cwt: number; count: number };
    Q4: { gross: number; cwt: number; count: number };
    unspecified: { gross: number; cwt: number; count: number };
  };
  atcBreakdown: Record<string, { description: string; gross: number; cwt: number; count: number }>;
  extractionMethod?: 'grand_total_row' | 'fallback_summary_total' | 'sum_of_transactions';
  extractionDetails?: string;
  grandTotalRowIndex?: number;
  dataStartRow?: number;
}

export interface SawtHistoryItem {
  id: string;
  uploadedAt: string; // ISO or formatted date
  fileName: string;
  totalCwtAmount: number;
  totalGrossAmount: number;
  totalRecords: number; // raw line count
  uniquePayorsCount: number; // unique customer count
  summary: SawtSummary;
  isActive?: boolean;
}

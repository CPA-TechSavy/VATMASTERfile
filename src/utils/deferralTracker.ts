import { Quarter } from '../types/tax';
import { ClientBranchSchedule, MonthIndex, SalesDeferralState, BirTransactionRow } from '../types/branchVat';

export interface DeferredClientRecord {
  quarter: Quarter;
  year: number;
  branchId: string;
  branchName: string;
  monthIndex?: MonthIndex;
  monthName?: string;
  registeredName: string;
  tin: string;
  taxableAmount: number;
  taxAmount: number;
  exemptAmount?: number;
  zeroRatedAmount?: number;
  rowNum?: number;
}

export interface QuarterlyDeferralDetail {
  quarter: Quarter;
  year: number;
  specificTaxable: number;
  specificVatDue: number;
  manualTaxable: number;
  manualVatDue: number;
  totalTaxable: number;
  totalVatDue: number;
  clientCount: number;
}

export interface YearToDateDeferralResult {
  accumulatedPriorTaxable: number;
  accumulatedPriorVatDue: number;
  currentQuarterTaxable: number;
  currentQuarterVatDue: number;
  totalTaxableYTD: number;
  totalVatDueYTD: number;
  deferredClientsYTD: DeferredClientRecord[];
  quarterlyBreakdown: QuarterlyDeferralDetail[];
}

const ALL_QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

const getTxKey = (branchId: string, monthIndex: number | string, tin: string, rowNum: number | string) => {
  return `${branchId}_${monthIndex}_${tin || 'NOTIN'}_${rowNum}`;
};

export const getTaxableYearDeferralSummary = (
  clientId: string,
  year: number,
  currentQuarter: Quarter,
  currentBranches?: ClientBranchSchedule[],
  currentDeferralState?: SalesDeferralState
): YearToDateDeferralResult => {
  const currentQIndex = ALL_QUARTERS.indexOf(currentQuarter);
  const priorQuarters = ALL_QUARTERS.slice(0, currentQIndex);
  const quartersYTD = ALL_QUARTERS.slice(0, currentQIndex + 1);

  let accumulatedPriorTaxable = 0;
  let accumulatedPriorVatDue = 0;
  let currentQuarterTaxable = 0;
  let currentQuarterVatDue = 0;

  const deferredClientsYTD: DeferredClientRecord[] = [];
  const quarterlyBreakdown: QuarterlyDeferralDetail[] = [];

  quartersYTD.forEach((q) => {
    let branches: ClientBranchSchedule[] = [];
    let defState: SalesDeferralState = {
      deferredCustomerKeys: [],
      manualTaxableSales: 0,
      manualVatDue: 0,
    };

    if (q === currentQuarter) {
      branches = currentBranches || [];
      defState = currentDeferralState || defState;
    } else {
      try {
        const raw = localStorage.getItem(`bir_branch_schedule_${clientId}_${year}_${q}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.branches) branches = parsed.branches;
          if (parsed.deferralState) defState = parsed.deferralState;
        }
      } catch (e) {
        console.error(`Error loading schedule for ${q} ${year}`, e);
      }
    }

    const keySet = new Set(defState.deferredCustomerKeys || []);
    let qSpecificTaxable = 0;
    let qSpecificVatDue = 0;
    let qClientCount = 0;

    branches.forEach((b) => {
      [
        { file: b.salesFiles.month1, monthIndex: 1 as MonthIndex, mName: 'Month 1' },
        { file: b.salesFiles.month2, monthIndex: 2 as MonthIndex, mName: 'Month 2' },
        { file: b.salesFiles.month3, monthIndex: 3 as MonthIndex, mName: 'Month 3' },
      ].forEach(({ file, monthIndex, mName }) => {
        if (!file?.transactions) return;
        file.transactions.forEach((row: BirTransactionRow, idx: number) => {
          const rNum = row.rowNum || idx + 1;
          const k = getTxKey(b.id, monthIndex, row.tin || '', rNum);
          if (keySet.has(k)) {
            const tAmt = row.taxableAmount || 0;
            const vAmt = row.taxAmount || 0;
            qSpecificTaxable += tAmt;
            qSpecificVatDue += vAmt;
            qClientCount += 1;

            deferredClientsYTD.push({
              quarter: q,
              year,
              branchId: b.id,
              branchName: b.name || 'Main Branch',
              monthIndex,
              monthName: mName,
              registeredName: row.registeredName || 'Unknown Customer',
              tin: row.tin || '000-000-000-000',
              taxableAmount: tAmt,
              taxAmount: vAmt,
              exemptAmount: row.exemptAmount || 0,
              zeroRatedAmount: row.zeroRatedAmount || 0,
              rowNum: rNum,
            });
          }
        });
      });
    });

    const qManualTaxable = Number(defState.manualTaxableSales) || 0;
    const qManualVatDue = Number(defState.manualVatDue) || 0;
    const qTotalTaxable = qSpecificTaxable + qManualTaxable;
    const qTotalVatDue = qSpecificVatDue + qManualVatDue;

    quarterlyBreakdown.push({
      quarter: q,
      year,
      specificTaxable: qSpecificTaxable,
      specificVatDue: qSpecificVatDue,
      manualTaxable: qManualTaxable,
      manualVatDue: qManualVatDue,
      totalTaxable: qTotalTaxable,
      totalVatDue: qTotalVatDue,
      clientCount: qClientCount,
    });

    if (priorQuarters.includes(q)) {
      accumulatedPriorTaxable += qTotalTaxable;
      accumulatedPriorVatDue += qTotalVatDue;
    } else if (q === currentQuarter) {
      currentQuarterTaxable = qTotalTaxable;
      currentQuarterVatDue = qTotalVatDue;
    }
  });

  return {
    accumulatedPriorTaxable,
    accumulatedPriorVatDue,
    currentQuarterTaxable,
    currentQuarterVatDue,
    totalTaxableYTD: accumulatedPriorTaxable + currentQuarterTaxable,
    totalVatDueYTD: accumulatedPriorVatDue + currentQuarterVatDue,
    deferredClientsYTD,
    quarterlyBreakdown,
  };
};

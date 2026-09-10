import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ClientProfile, Quarter, Data2550Q } from '../types/tax';
import { ClientBranchSchedule, PurchasesReportingMode, BirUploadedFileRecord, BirTransactionRow } from '../types/branchVat';
import { calculate2550Q, Result2550Q, computeMonthlyQuarterBreakdown } from './taxCalculations';

interface PdfExportOptions {
  client: ClientProfile;
  quarter: Quarter;
  year: number;
  branches?: ClientBranchSchedule[];
  purchasesMode?: PurchasesReportingMode;
  consolidatedPurchasesFile?: BirUploadedFileRecord | null;
  aggregatedTotals?: {
    salesColF: number;
    salesColG: number;
    salesColH: number;
    salesColL: number;
    purchasesColF: number;
    purchasesColG: number;
    purchasesColH: number;
    purchasesColL: number;
  };
  branchRows?: Array<{
    name: string;
    salesColF: number;
    salesColG: number;
    salesColH: number;
    salesColL: number;
    purchasesColF: number;
    purchasesColG: number;
    purchasesColH: number;
    purchasesColL: number;
    netVat: number;
  }>;
  data2550Q?: Data2550Q;
  result2550Q?: Result2550Q;
  isAdjustedMode?: boolean;
}

// Format numbers with strict ₱ symbol, tabular formatting and 2 decimal places
function formatPdfCurrency(amount: number | undefined | null, showZeroDash = false): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return showZeroDash ? '—' : '₱ 0.00';
  }
  if (showZeroDash && Math.abs(amount) < 0.001) {
    return '—';
  }
  const formatted = Math.abs(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (amount < 0) {
    return `(₱ ${formatted})`;
  }
  return `₱ ${formatted}`;
}

export async function exportMultiBranchAnd2550QPdf({
  client,
  quarter,
  year,
  branches: incomingBranches,
  purchasesMode: incomingPurchasesMode,
  consolidatedPurchasesFile: incomingConsolidatedPurchasesFile,
  aggregatedTotals: incomingAggregatedTotals,
  branchRows: incomingBranchRows,
  data2550Q,
  result2550Q,
  isAdjustedMode,
}: PdfExportOptions): Promise<void> {
  // Load saved branch schedule from localStorage if not directly passed
  let branches = incomingBranches;
  let purchasesMode = incomingPurchasesMode || 'consolidated';
  let consolidatedPurchasesFile = incomingConsolidatedPurchasesFile;
  if (!branches || branches.length === 0) {
    try {
      const storageKey = `bir_branch_schedule_${client.id}_${year}_${quarter}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.branches && parsed.branches.length > 0) {
          branches = parsed.branches;
        }
        if (parsed.purchasesMode) {
          purchasesMode = parsed.purchasesMode;
        }
        if (!consolidatedPurchasesFile && parsed.consolidatedPurchasesFile) {
          consolidatedPurchasesFile = parsed.consolidatedPurchasesFile;
        }
      }
    } catch {
      // ignore
    }
  }

  if (!branches || branches.length === 0) {
    branches = [
      {
        id: 'branch-main',
        name: `${client.tradeName} (Main Branch)`,
        salesFiles: {},
        purchasesFiles: {},
      },
    ];
  }

  // Fallback / default 2550Q data if not directly provided
  let effective2550QData = data2550Q;
  if (!effective2550QData) {
    try {
      const savedMap = localStorage.getItem('bir_calc_data_2550Q');
      if (savedMap) {
        const parsed = JSON.parse(savedMap);
        if (parsed[client.id]) {
          effective2550QData = parsed[client.id];
        }
      }
    } catch {
      // ignore
    }
  }

  // Calculate or fallback aggregated totals
  let aggregatedTotals = incomingAggregatedTotals;
  if (!aggregatedTotals) {
    let salesColF = 0;
    let salesColG = 0;
    let salesColH = 0;
    let salesColL = 0;
    let purchasesColF = 0;
    let purchasesColG = 0;
    let purchasesColH = 0;
    let purchasesColL = 0;

    branches.forEach((b) => {
      [b.salesFiles.month1, b.salesFiles.month2, b.salesFiles.month3].forEach((f) => {
        if (f) {
          salesColF += f.totals.exemptAmount || 0;
          salesColG += f.totals.zeroRatedAmount || 0;
          salesColH += f.totals.taxableAmount || 0;
          salesColL += f.totals.taxAmount || 0;
        }
      });
      if (purchasesMode === 'per-branch' && b.purchasesFiles) {
        [b.purchasesFiles.month1, b.purchasesFiles.month2, b.purchasesFiles.month3].forEach((f) => {
          if (f) {
            purchasesColF += f.totals.exemptAmount || 0;
            purchasesColG += f.totals.zeroRatedAmount || 0;
            purchasesColH += f.totals.taxableAmount || 0;
            purchasesColL += f.totals.taxAmount || 0;
          }
        });
      }
    });

    if (purchasesMode === 'consolidated' && consolidatedPurchasesFile?.totals) {
      purchasesColF = consolidatedPurchasesFile.totals.exemptAmount || 0;
      purchasesColG = consolidatedPurchasesFile.totals.zeroRatedAmount || 0;
      purchasesColH = consolidatedPurchasesFile.totals.taxableAmount || 0;
      purchasesColL = consolidatedPurchasesFile.totals.taxAmount || 0;
    }

    // If branches didn't have totals but 2550Q data is present, align them
    if (salesColH === 0 && effective2550QData) {
      salesColF = effective2550QData.vatExemptSales || 0;
      salesColG = effective2550QData.zeroRatedSales || 0;
      salesColH = effective2550QData.vatableSales || 0;
      salesColL = salesColH * 0.12;
      purchasesColH = effective2550QData.inputPurchasesGoods || 0;
      purchasesColL = purchasesColH * 0.12;
    }

    aggregatedTotals = {
      salesColF,
      salesColG,
      salesColH,
      salesColL,
      purchasesColF,
      purchasesColG,
      purchasesColH,
      purchasesColL,
    };
  }

  // If still not available, populate from aggregatedTotals
  if (!effective2550QData) {
    effective2550QData = {
      vatableSales: aggregatedTotals.salesColH,
      salesToGovernment: 0,
      zeroRatedSales: aggregatedTotals.salesColG,
      vatExemptSales: aggregatedTotals.salesColF,
      inputPurchasesGoods: aggregatedTotals.purchasesColH,
      inputPurchasesServices: 0,
      inputCapitalGoods: 0,
      inputImportations: 0,
      priorQuarterExcessInputVat: 0,
      withheldVat2307Govt: 0,
      withheldVat2307Private: 0,
      priorPaymentsThisQuarter: 0,
    };
  }

  const effectiveResult = result2550Q || calculate2550Q(effective2550QData);

  // Statutory deadline
  const quarterDueDates: Record<Quarter, string> = {
    Q1: `April 25, ${year}`,
    Q2: `July 25, ${year}`,
    Q3: `October 25, ${year}`,
    Q4: `January 25, ${year + 1}`,
  };
  const statutoryDueDate = quarterDueDates[quarter];
  const generatedTimestamp = new Date().toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Create an off-screen container for crisp rendering
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '1120px';
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '-9999';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  container.style.color = '#0f172a';
  container.style.boxSizing = 'border-box';

  // Branch rows (either passed as adjusted rows or computed directly from branches)
  const branchRows = incomingBranchRows && incomingBranchRows.length > 0
    ? incomingBranchRows
    : branches.map((b) => {
        let salesColF = 0;
        let salesColG = 0;
        let salesColH = 0;
        let salesColL = 0;
        [b.salesFiles?.month1, b.salesFiles?.month2, b.salesFiles?.month3].forEach((f) => {
          if (f) {
            salesColF += f.totals?.exemptAmount || 0;
            salesColG += f.totals?.zeroRatedAmount || 0;
            salesColH += f.totals?.taxableAmount || 0;
            salesColL += f.totals?.taxAmount || 0;
          }
        });

        let purchasesColF = 0;
        let purchasesColG = 0;
        let purchasesColH = 0;
        let purchasesColL = 0;
        if (purchasesMode === 'per-branch' && b.purchasesFiles) {
          [b.purchasesFiles?.month1, b.purchasesFiles?.month2, b.purchasesFiles?.month3].forEach((f) => {
            if (f) {
              purchasesColF += f.totals?.exemptAmount || 0;
              purchasesColG += f.totals?.zeroRatedAmount || 0;
              purchasesColH += f.totals?.taxableAmount || 0;
              purchasesColL += f.totals?.taxAmount || 0;
            }
          });
        }

        const netVat = purchasesMode === 'per-branch' ? salesColL - purchasesColL : salesColL;
        return {
          name: b.name,
          salesColF,
          salesColG,
          salesColH,
          salesColL,
          purchasesColF,
          purchasesColG,
          purchasesColH,
          purchasesColL,
          netVat,
        };
      });

  // Calculate monthly breakdown across all branches (consolidating Taxable, Exempt, Zero-Rated Sales & Purchases, Output and Input Tax)
  const { monthlyBreakdown, quarterTotals } = computeMonthlyQuarterBreakdown({
    quarter,
    branches,
    purchasesMode,
    consolidatedPurchasesFile,
  });

  // Build HTML for Page 1 and Page 2
  container.innerHTML = `
    <!-- PAGE 1: Multi-Branch Aggregation Summary -->
    <div id="pdf-page-1" style="width: 1120px; min-height: 792px; padding: 28px 36px; background-color: #ffffff; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <!-- Official BIR Header -->
        <div style="border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #475569;">
              Republic of the Philippines • Department of Finance • Bureau of Internal Revenue
            </div>
            <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px; letter-spacing: -0.01em;">
              ${client.registeredName || client.tradeName || 'Taxpayer'}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 1px;">
              Quarterly VAT Multi-Branch Aggregation Schedule • Pursuant to RR No. 16-2005 as amended & RA 11976 (eOPT Act)
            </div>
          </div>
          <div style="text-align: right; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 14px;">
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.05em;">Tax Period</div>
            <div style="font-size: 15px; font-weight: 800; color: #1e1b4b; margin-top: 1px;">${quarter} ${year}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 1px;">Due: ${statutoryDueDate}</div>
          </div>
        </div>

        <!-- Taxpayer Profile Grid (Only TIN, Purchases Mode, and Form Type) -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: grid; grid-template-columns: 1.4fr 1.3fr 1.3fr; gap: 16px; font-size: 11px;">
          <div>
            <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Taxpayer Identification No. (TIN)</div>
            <div style="font-weight: 700; font-family: monospace; color: #0f172a; font-size: 12.5px; margin-top: 1px;">${client.tin}</div>
            <div style="font-size: 10px; color: #475569; margin-top: 1px;">RDO: ${client.rdo} • Classification: ${client.classification}</div>
          </div>
          <div>
            <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Purchases Mode</div>
            <div style="font-weight: 700; color: #0f172a; font-size: 11.5px; margin-top: 1px;">
              ${purchasesMode === 'per-branch' ? 'Per-Branch Input Tax' : 'Consolidated Purchases'}
            </div>
            <div style="font-size: 10px; color: #64748b; margin-top: 1px;">Branches: ${branches.length} Active</div>
          </div>
          <div>
            <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Form Type</div>
            <div style="font-weight: 700; color: #4338ca; font-size: 11.5px; margin-top: 1px;">BIR Form 2550Q (VAT)</div>
            <div style="font-size: 10px; color: #059669; margin-top: 1px;">Status: Validated (${client.vatStatus === 'vat-registered' ? 'VAT Registered' : 'Non-VAT'})</div>
          </div>
        </div>

        <!-- Section 1 Title -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #1e293b;">
            1. Multi-Branch Aggregation Summary Table (${quarter} ${year} Consolidated)
          </div>
          <div style="font-size: 10px; color: #64748b; font-style: italic;">
            Amounts in Philippine Peso (PHP) • Strictly orthogonal alignment
          </div>
        </div>

        <!-- Multi-Branch Table -->
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px;">
          <thead>
            <tr style="border-top: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8;">
              <th rowspan="2" style="padding: 7px 8px; text-align: left; background-color: #f1f5f9; color: #1e293b; font-weight: 700; border-right: 1px solid #cbd5e1; width: 18%;">
                Branch / Line of Business
              </th>
              <th colspan="4" style="padding: 5px 8px; text-align: center; background-color: #ede9fe; color: #3b0764; font-weight: 700; border-right: 1px solid #cbd5e1;">
                SALES & RECEIPTS (OUTPUT TAX)
              </th>
              <th colspan="4" style="padding: 5px 8px; text-align: center; background-color: #fef3c7; color: #78350f; font-weight: 700; border-right: 1px solid #cbd5e1;">
                PURCHASES & INPUT TAX
              </th>
              <th rowspan="2" style="padding: 7px 8px; text-align: right; background-color: #f1f5f9; color: #1e293b; font-weight: 700; width: 12%;">
                Net VAT Due / (Credit)
              </th>
            </tr>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #94a3b8; font-size: 9px;">
              <th style="padding: 4px 6px; text-align: right; font-weight: 600; color: #475569; border-right: 1px solid #e2e8f0; width: 8.5%;">Exempt</th>
              <th style="padding: 4px 6px; text-align: right; font-weight: 600; color: #475569; border-right: 1px solid #e2e8f0; width: 8.5%;">Zero-Rated</th>
              <th style="padding: 4px 6px; text-align: right; font-weight: 600; color: #1e293b; border-right: 1px solid #e2e8f0; width: 9%;">Taxable (12%)</th>
              <th style="padding: 4px 6px; text-align: right; font-weight: 700; color: #5b21b6; background-color: #f3e8ff; border-right: 1px solid #cbd5e1; width: 9%;">Output VAT</th>
              <th style="padding: 4px 6px; text-align: right; font-weight: 600; color: #475569; border-right: 1px solid #e2e8f0; width: 8.5%;">Exempt</th>
              <th style="padding: 4px 6px; text-align: right; font-weight: 600; color: #475569; border-right: 1px solid #e2e8f0; width: 8.5%;">Zero-Rated</th>
              <th style="padding: 4px 6px; text-align: right; font-weight: 600; color: #1e293b; border-right: 1px solid #e2e8f0; width: 9%;">Taxable (12%)</th>
              <th style="padding: 4px 6px; text-align: right; font-weight: 700; color: #92400e; background-color: #fef9c3; border-right: 1px solid #cbd5e1; width: 9%;">Input VAT</th>
            </tr>
          </thead>
          <tbody>
            ${(branchRows && branchRows.length > 0
              ? branchRows.map((b, idx) => {
                  const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                  return `
                    <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 5px 8px; font-weight: 600; color: #0f172a; border-right: 1px solid #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${b.name}
                      </td>
                      <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                        ${formatPdfCurrency(b.salesColF, true)}
                      </td>
                      <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                        ${formatPdfCurrency(b.salesColG, true)}
                      </td>
                      <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 600; color: #0f172a; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                        ${formatPdfCurrency(b.salesColH)}
                      </td>
                      <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 700; color: #5b21b6; background-color: #faf5ff; border-right: 1px solid #cbd5e1; white-space: nowrap;">
                        ${formatPdfCurrency(b.salesColL)}
                      </td>
                      <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                        ${purchasesMode === 'per-branch' ? formatPdfCurrency(b.purchasesColF, true) : '—'}
                      </td>
                      <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                        ${purchasesMode === 'per-branch' ? formatPdfCurrency(b.purchasesColG, true) : '—'}
                      </td>
                      <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 600; color: #0f172a; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                        ${purchasesMode === 'per-branch' ? formatPdfCurrency(b.purchasesColH) : '—'}
                      </td>
                      <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 700; color: #92400e; background-color: #fffbeb; border-right: 1px solid #cbd5e1; white-space: nowrap;">
                        ${purchasesMode === 'per-branch' ? formatPdfCurrency(b.purchasesColL) : '—'}
                      </td>
                      <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 700; color: ${b.netVat >= 0 ? '#0f172a' : '#0369a1'}; white-space: nowrap;">
                        ${formatPdfCurrency(b.netVat)}
                      </td>
                    </tr>
                  `;
                })
              : branches
                  .map((b, idx) => {
                    const sFiles = [b.salesFiles.month1, b.salesFiles.month2, b.salesFiles.month3].filter(Boolean);
                    const bSalesF = sFiles.reduce((acc, f) => acc + (f?.totals.exemptAmount || 0), 0);
                    const bSalesG = sFiles.reduce((acc, f) => acc + (f?.totals.zeroRatedAmount || 0), 0);
                    const bSalesH = sFiles.reduce((acc, f) => acc + (f?.totals.taxableAmount || 0), 0);
                    const bSalesL = sFiles.reduce((acc, f) => acc + (f?.totals.taxAmount || 0), 0);

                    const pFiles =
                      purchasesMode === 'per-branch'
                        ? [b.purchasesFiles?.month1, b.purchasesFiles?.month2, b.purchasesFiles?.month3].filter(Boolean)
                        : [];
                    const bPurchF = pFiles.reduce((acc, f) => acc + (f?.totals.exemptAmount || 0), 0);
                    const bPurchG = pFiles.reduce((acc, f) => acc + (f?.totals.zeroRatedAmount || 0), 0);
                    const bPurchH = pFiles.reduce((acc, f) => acc + (f?.totals.taxableAmount || 0), 0);
                    const bPurchL = pFiles.reduce((acc, f) => acc + (f?.totals.taxAmount || 0), 0);

                    const bNetVat = bSalesL - bPurchL;
                    const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

                    return `
                      <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 5px 8px; font-weight: 600; color: #0f172a; border-right: 1px solid #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                          ${b.name}
                        </td>
                        <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                          ${formatPdfCurrency(bSalesF, true)}
                        </td>
                        <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                          ${formatPdfCurrency(bSalesG, true)}
                        </td>
                        <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 600; color: #0f172a; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                          ${formatPdfCurrency(bSalesH)}
                        </td>
                        <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 700; color: #5b21b6; background-color: #faf5ff; border-right: 1px solid #cbd5e1; white-space: nowrap;">
                          ${formatPdfCurrency(bSalesL)}
                        </td>
                        <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                          ${purchasesMode === 'per-branch' ? formatPdfCurrency(bPurchF, true) : '—'}
                        </td>
                        <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                          ${purchasesMode === 'per-branch' ? formatPdfCurrency(bPurchG, true) : '—'}
                        </td>
                        <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 600; color: #0f172a; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                          ${purchasesMode === 'per-branch' ? formatPdfCurrency(bPurchH) : '—'}
                        </td>
                        <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 700; color: #92400e; background-color: #fffbeb; border-right: 1px solid #cbd5e1; white-space: nowrap;">
                          ${purchasesMode === 'per-branch' ? formatPdfCurrency(bPurchL) : '—'}
                        </td>
                        <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 700; color: ${bNetVat >= 0 ? '#0f172a' : '#0369a1'}; white-space: nowrap;">
                          ${purchasesMode === 'per-branch' ? formatPdfCurrency(bNetVat) : formatPdfCurrency(bSalesL)}
                        </td>
                      </tr>
                    `;
                  })
            ).join('')}

            ${
              purchasesMode === 'consolidated'
                ? `
              <tr style="background-color: #fffbeb; border-bottom: 1px solid #fde68a;">
                <td style="padding: 5px 8px; font-weight: 600; color: #78350f; font-style: italic; border-right: 1px solid #cbd5e1;">
                  Consolidated Purchases
                </td>
                <td style="padding: 5px 6px; text-align: right; color: #94a3b8; border-right: 1px solid #e2e8f0;">—</td>
                <td style="padding: 5px 6px; text-align: right; color: #94a3b8; border-right: 1px solid #e2e8f0;">—</td>
                <td style="padding: 5px 6px; text-align: right; color: #94a3b8; border-right: 1px solid #e2e8f0;">—</td>
                <td style="padding: 5px 6px; text-align: right; color: #94a3b8; border-right: 1px solid #cbd5e1;">—</td>
                <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                  ${formatPdfCurrency(aggregatedTotals.purchasesColF, true)}
                </td>
                <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                  ${formatPdfCurrency(aggregatedTotals.purchasesColG, true)}
                </td>
                <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 600; color: #0f172a; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                  ${formatPdfCurrency(aggregatedTotals.purchasesColH)}
                </td>
                <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 700; color: #92400e; background-color: #fef08a; border-right: 1px solid #cbd5e1; white-space: nowrap;">
                  ${formatPdfCurrency(aggregatedTotals.purchasesColL)}
                </td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 700; color: #b45309; white-space: nowrap;">
                  (${formatPdfCurrency(aggregatedTotals.purchasesColL)})
                </td>
              </tr>
            `
                : ''
            }

            <!-- Grand Totals Row -->
            <tr style="background-color: #0f172a; color: #ffffff; font-weight: 700; border-top: 2px solid #0f172a; font-size: 10px;">
              <td style="padding: 7px 8px; text-transform: uppercase; letter-spacing: 0.05em; border-right: 1px solid #334155; white-space: nowrap;">
                Grand Total (${quarter} ${year})
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; color: #cbd5e1; border-right: 1px solid #334155; white-space: nowrap;">
                ${formatPdfCurrency(aggregatedTotals.salesColF)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; color: #cbd5e1; border-right: 1px solid #334155; white-space: nowrap;">
                ${formatPdfCurrency(aggregatedTotals.salesColG)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-weight: 800; color: #ffffff; border-right: 1px solid #334155; white-space: nowrap;">
                ${formatPdfCurrency(aggregatedTotals.salesColH)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-weight: 800; color: #c4b5fd; background-color: #2e1065; border-right: 1px solid #4c1d95; white-space: nowrap;">
                ${formatPdfCurrency(aggregatedTotals.salesColL)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; color: #cbd5e1; border-right: 1px solid #334155; white-space: nowrap;">
                ${formatPdfCurrency(aggregatedTotals.purchasesColF)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; color: #cbd5e1; border-right: 1px solid #334155; white-space: nowrap;">
                ${formatPdfCurrency(aggregatedTotals.purchasesColG)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-weight: 800; color: #ffffff; border-right: 1px solid #334155; white-space: nowrap;">
                ${formatPdfCurrency(aggregatedTotals.purchasesColH)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-weight: 800; color: #fde047; background-color: #451a03; border-right: 1px solid #78350f; white-space: nowrap;">
                ${formatPdfCurrency(aggregatedTotals.purchasesColL)}
              </td>
              <td style="padding: 7px 8px; text-align: right; font-family: monospace; font-weight: 800; color: #38bdf8; white-space: nowrap;">
                ${formatPdfCurrency(aggregatedTotals.salesColL - aggregatedTotals.purchasesColL)}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Consolidated Sales, Purchases & VAT Due Table (Single-Row Combined Summary across all Branches and Months) -->
        <div style="margin-top: 10px; background-color: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; letter-spacing: 0.04em;">
              Consolidated Sales & Purchases Summary (${quarter}) • Combined Basis
            </div>
            <div style="font-size: 9px; color: #475569; font-style: italic;">
              Combined Sales from all Branches less ${purchasesMode === 'per-branch' ? 'Combined Per-Branch Purchases' : 'Consolidated Purchases'} = VAT Due
            </div>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
            <thead>
              <tr style="background-color: #0f172a; color: #ffffff;">
                <th rowspan="2" style="padding: 6px 8px; text-align: left; border-right: 1px solid #334155; width: 15%;">Consolidation Basis</th>
                <th colspan="4" style="padding: 4px 6px; text-align: center; border-right: 1px solid #334155; background-color: #1e1b4b; color: #e0e7ff;">
                  COMBINED SALES (ALL BRANCHES & MONTHS)
                </th>
                <th colspan="4" style="padding: 4px 6px; text-align: center; border-right: 1px solid #334155; background-color: #451a03; color: #fef08a;">
                  LESS: ${purchasesMode === 'per-branch' ? 'COMBINED PURCHASES (PER-BRANCH)' : 'CONSOLIDATED PURCHASES'}
                </th>
                <th rowspan="2" style="padding: 6px 8px; text-align: right; background-color: #0369a1; color: #ffffff; width: 12%;">
                  VAT DUE
                </th>
              </tr>
              <tr style="background-color: #e2e8f0; color: #1e293b; font-weight: 700; border-bottom: 1px solid #cbd5e1;">
                <th style="padding: 3px 5px; text-align: right; border-right: 1px solid #cbd5e1;">Taxable (12%)</th>
                <th style="padding: 3px 5px; text-align: right; border-right: 1px solid #cbd5e1;">Zero-Rated</th>
                <th style="padding: 3px 5px; text-align: right; border-right: 1px solid #cbd5e1;">Exempt</th>
                <th style="padding: 3px 5px; text-align: right; border-right: 1px solid #94a3b8; background-color: #ede9fe; color: #4338ca;">Output Tax</th>
                <th style="padding: 3px 5px; text-align: right; border-right: 1px solid #cbd5e1;">Taxable (12%)</th>
                <th style="padding: 3px 5px; text-align: right; border-right: 1px solid #cbd5e1;">Zero-Rated</th>
                <th style="padding: 3px 5px; text-align: right; border-right: 1px solid #cbd5e1;">Exempt</th>
                <th style="padding: 3px 5px; text-align: right; border-right: 1px solid #94a3b8; background-color: #fef3c7; color: #b45309;">Input Tax</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background-color: #ffffff; border-bottom: 2px solid #0f172a; font-weight: 700;">
                <td style="padding: 8px 8px; font-weight: 800; color: #0f172a; border-right: 1px solid #cbd5e1;">
                  Combined All Branches (${quarter}) • ${purchasesMode === 'per-branch' ? 'Combined Purchases' : 'Consolidated Purchases'}
                </td>
                <td style="padding: 8px 5px; text-align: right; font-family: monospace; font-weight: 800; color: #0f172a; border-right: 1px solid #e2e8f0;">
                  ${formatPdfCurrency(aggregatedTotals.salesColH)}
                </td>
                <td style="padding: 8px 5px; text-align: right; font-family: monospace; color: #64748b; border-right: 1px solid #e2e8f0;">
                  ${formatPdfCurrency(aggregatedTotals.salesColG)}
                </td>
                <td style="padding: 8px 5px; text-align: right; font-family: monospace; color: #64748b; border-right: 1px solid #cbd5e1;">
                  ${formatPdfCurrency(aggregatedTotals.salesColF)}
                </td>
                <td style="padding: 8px 5px; text-align: right; font-family: monospace; font-weight: 900; color: #4338ca; background-color: #f5f3ff; border-right: 1px solid #94a3b8;">
                  ${formatPdfCurrency(aggregatedTotals.salesColL)}
                </td>
                <td style="padding: 8px 5px; text-align: right; font-family: monospace; font-weight: 800; color: #0f172a; border-right: 1px solid #e2e8f0;">
                  ${formatPdfCurrency(aggregatedTotals.purchasesColH)}
                </td>
                <td style="padding: 8px 5px; text-align: right; font-family: monospace; color: #64748b; border-right: 1px solid #e2e8f0;">
                  ${formatPdfCurrency(aggregatedTotals.purchasesColG)}
                </td>
                <td style="padding: 8px 5px; text-align: right; font-family: monospace; color: #64748b; border-right: 1px solid #cbd5e1;">
                  ${formatPdfCurrency(aggregatedTotals.purchasesColF)}
                </td>
                <td style="padding: 8px 5px; text-align: right; font-family: monospace; font-weight: 900; color: #b45309; background-color: #fffbeb; border-right: 1px solid #94a3b8;">
                  ${formatPdfCurrency(aggregatedTotals.purchasesColL)}
                </td>
                <td style="padding: 8px 8px; text-align: right; font-family: monospace; font-weight: 900; font-size: 11px; color: ${aggregatedTotals.salesColL - aggregatedTotals.purchasesColL >= 0 ? '#047857' : '#0369a1'}; background-color: ${aggregatedTotals.salesColL - aggregatedTotals.purchasesColL >= 0 ? '#ecfdf5' : '#f0f9ff'};">
                  ${formatPdfCurrency(aggregatedTotals.salesColL - aggregatedTotals.purchasesColL)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Page 1 Footer -->
      <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b;">
        <div>
          <strong>Philippine Tax Compliance Automation</strong> • Republic Act No. 11976 (eOPT Act) • RR 16-2005 / SLSP Specification
        </div>
        <div>
          Generated: ${generatedTimestamp} • <strong>Page 1 of 2 (Multi-Branch Aggregation)</strong>
        </div>
      </div>
    </div>

    <!-- PAGE 2: Schedule 1 to 3 and 2550Q VAT Summary -->
    <div id="pdf-page-2" style="width: 1120px; min-height: 792px; padding: 28px 36px; background-color: #ffffff; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <!-- Official BIR Form 2550Q Return Header -->
        <div style="border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #475569;">
              Bureau of Internal Revenue • Quarterly Value-Added Tax Return
            </div>
            <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px; letter-spacing: -0.01em;">
              ${client.registeredName || client.tradeName || 'Taxpayer'}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 1px;">
              BIR Form 2550Q: Schedules 1 to 3 & VAT Summary • TIN: ${client.tin} • RDO: ${client.rdo}
            </div>
          </div>
          <div style="text-align: right; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 14px;">
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.05em;">Tax Period</div>
            <div style="font-size: 15px; font-weight: 800; color: #1e1b4b; margin-top: 1px;">${quarter} ${year}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 1px;">Due Date: ${statutoryDueDate}</div>
          </div>
        </div>

        <!-- Two-Column Landscape Grid for Schedules & 2550Q VAT Summary -->
        <div style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 16px; align-items: start;">
          <!-- Left Column: Schedule 1 & Schedule 2 -->
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <!-- Schedule 1: Sales / Receipts (Output Tax) -->
            <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #ede9fe; padding: 6px 10px; border-bottom: 1px solid #ddd6fe; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #3b0764; letter-spacing: 0.04em;">
                  Schedule 1: Sales / Receipts (Output Tax)
                </span>
                <span style="font-size: 10px; font-weight: 600; color: #5b21b6;">Part IV - Line 15 to 19</span>
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                <tbody>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">15A. Vatable Sales / Receipts (12%)</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; font-weight: 600; color: #0f172a; width: 35%;">
                      ${formatPdfCurrency(effective2550QData.vatableSales)}
                    </td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; font-weight: 700; color: #5b21b6; width: 28%; background-color: #faf5ff;">
                      ${formatPdfCurrency(effective2550QData.vatableSales * 0.12)}
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">15B. Sales to Government (12%)</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #475569;">
                      ${formatPdfCurrency(effective2550QData.salesToGovernment)}
                    </td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; font-weight: 700; color: #5b21b6; background-color: #faf5ff;">
                      ${formatPdfCurrency(effective2550QData.salesToGovernment * 0.12)}
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">15C. Zero-Rated Sales (0%)</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #475569;">
                      ${formatPdfCurrency(effective2550QData.zeroRatedSales)}
                    </td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #94a3b8; background-color: #faf5ff;">
                      ₱ 0.00
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">15D. VAT-Exempt Sales</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #475569;">
                      ${formatPdfCurrency(effective2550QData.vatExemptSales)}
                    </td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #94a3b8; background-color: #faf5ff;">
                      ₱ 0.00
                    </td>
                  </tr>
                  <tr style="background-color: #f5f3ff; font-weight: 700; border-top: 1px solid #ddd6fe;">
                    <td style="padding: 6px 10px; color: #3b0764;">Total Sales / Output Tax (Line 16 / 19B)</td>
                    <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #1e1b4b;">
                      ${formatPdfCurrency(effectiveResult.totalSales)}
                    </td>
                    <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #4c1d95; background-color: #ede9fe;">
                      ${formatPdfCurrency(effectiveResult.outputTax)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Schedule 2: Allowable Input Tax on Purchases (12%) -->
            <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #fef3c7; padding: 6px 10px; border-bottom: 1px solid #fde68a; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #78350f; letter-spacing: 0.04em;">
                  Schedule 2: Allowable Input Tax on Purchases (12%)
                </span>
                <span style="font-size: 10px; font-weight: 600; color: #92400e;">Part IV - Line 20</span>
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                <tbody>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">20A. Domestic Purchases of Goods</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #475569; width: 35%;">
                      ${formatPdfCurrency(effective2550QData.inputPurchasesGoods)}
                    </td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; font-weight: 600; color: #78350f; width: 28%; background-color: #fffbeb;">
                      ${formatPdfCurrency(effective2550QData.inputPurchasesGoods * 0.12)}
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">20B. Domestic Purchases of Services</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #475569;">
                      ${formatPdfCurrency(effective2550QData.inputPurchasesServices)}
                    </td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; font-weight: 600; color: #78350f; background-color: #fffbeb;">
                      ${formatPdfCurrency(effective2550QData.inputPurchasesServices * 0.12)}
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">20C. Capital Goods Purchases</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #475569;">
                      ${formatPdfCurrency(effective2550QData.inputCapitalGoods)}
                    </td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; font-weight: 600; color: #78350f; background-color: #fffbeb;">
                      ${formatPdfCurrency(effective2550QData.inputCapitalGoods * 0.12)}
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">20D. Prior Quarter's Excess Input Tax</td>
                    <td style="padding: 5px 10px; text-align: right; color: #94a3b8;">—</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; font-weight: 700; color: #0284c7; background-color: #f0f9ff;">
                      ${formatPdfCurrency(effective2550QData.priorQuarterExcessInputVat)}
                    </td>
                  </tr>
                  <tr style="background-color: #fefce8; font-weight: 700; border-top: 1px solid #fde68a;">
                    <td style="padding: 6px 10px; color: #713f12;" colspan="2">Total Available Input Tax (Line 20)</td>
                    <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #854d0e; background-color: #fef08a;">
                      ${formatPdfCurrency(effectiveResult.totalAvailableInputTax)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Right Column: Schedule 3 & 2550Q VAT Summary -->
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <!-- Schedule 3: Tax Credits & Withholding VAT -->
            <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #f1f5f9; padding: 6px 10px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #1e293b; letter-spacing: 0.04em;">
                  Schedule 3: Tax Credits & Withholding VAT
                </span>
                <span style="font-size: 10px; font-weight: 600; color: #475569;">Part IV - Line 22</span>
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                <tbody>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">22A. VAT Withheld on Sales to Govt (BIR Form 2307, 5%)</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #047857;">
                      ${formatPdfCurrency(effective2550QData.withheldVat2307Govt)}
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">22B. Other Creditable VAT Withheld (Form 2307 Private)</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #047857;">
                      ${formatPdfCurrency(effective2550QData.withheldVat2307Private)}
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">22C. Prior Payments Made (Monthly 2550M Returns)</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #047857;">
                      ${formatPdfCurrency(effective2550QData.priorPaymentsThisQuarter)}
                    </td>
                  </tr>
                  <tr style="background-color: #ecfdf5; font-weight: 700; border-top: 1px solid #a7f3d0;">
                    <td style="padding: 6px 10px; color: #065f46;">Total Tax Credits & Payments (Line 22)</td>
                    <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #047857;">
                      ${formatPdfCurrency(effectiveResult.totalTaxCredits)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 2550Q VAT Summary Box (Featured Computation Box) -->
            <div style="background-color: #0f172a; color: #ffffff; border-radius: 8px; padding: 12px 16px; border: 1px solid #1e293b; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              <div style="border-bottom: 1px solid #334155; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 13px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: #f8fafc;">
                  2550Q VAT SUMMARY COMPUTATION
                </div>
                <div style="font-size: 10px; color: #94a3b8; font-family: monospace;">BIR FORM 2550Q</div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 6px; font-size: 11px;">
                <div style="display: flex; justify-content: space-between; color: #cbd5e1;">
                  <span>Line 19B. Total Output Tax Due (12%)</span>
                  <span style="font-family: monospace; font-weight: 600; color: #ffffff;">${formatPdfCurrency(effectiveResult.outputTax)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; color: #cbd5e1;">
                  <span>Line 20. Less: Total Available Input Tax</span>
                  <span style="font-family: monospace; font-weight: 600; color: #fde047;">(${formatPdfCurrency(effectiveResult.totalAvailableInputTax)})</span>
                </div>
                <div style="display: flex; justify-content: space-between; color: #e2e8f0; font-weight: 600; padding-top: 4px; border-top: 1px dashed #334155;">
                  <span>Line 21. Net VAT Payable (Excess Input Tax)</span>
                  <span style="font-family: monospace; color: #ffffff;">${formatPdfCurrency(effectiveResult.outputTax - effectiveResult.totalAvailableInputTax)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; color: #cbd5e1;">
                  <span>Line 22. Less: Total Tax Credits / Payments</span>
                  <span style="font-family: monospace; font-weight: 600; color: #6ee7b7;">(${formatPdfCurrency(effectiveResult.totalTaxCredits)})</span>
                </div>

                <!-- Final Net Tax Result Banner -->
                <div style="margin-top: 6px; padding: 10px 12px; background-color: ${effectiveResult.isExcessInputVat ? '#0c4a6e' : '#064e3b'}; border: 1px solid ${effectiveResult.isExcessInputVat ? '#0284c7' : '#059669'}; border-radius: 6px;">
                  <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: ${effectiveResult.isExcessInputVat ? '#bae6fd' : '#a7f3d0'};">
                    ${effectiveResult.isExcessInputVat ? 'Line 23. EXCESS INPUT VAT (CREDIT TO SUCCEEDING QUARTER)' : 'Line 23. NET VAT STILL PAYABLE (TO BIR)'}
                  </div>
                  <div style="font-size: 20px; font-weight: 800; font-family: monospace; color: #ffffff; margin-top: 2px;">
                    ${effectiveResult.isExcessInputVat ? formatPdfCurrency(effectiveResult.excessInputTax) : formatPdfCurrency(Math.max(0, effectiveResult.netVatPayable))}
                  </div>
                  <div style="font-size: 9px; color: ${effectiveResult.isExcessInputVat ? '#e0f2fe' : '#d1fae5'}; margin-top: 2px;">
                    ${effectiveResult.isExcessInputVat ? 'Automatically carried over as prior quarter excess credit' : `Remit on or before statutory quarterly deadline (${statutoryDueDate})`}
                  </div>
                </div>
              </div>
            </div>

            <!-- Taxpayer Certification & Signature Box -->
            <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; background-color: #f8fafc; font-size: 9px; color: #475569;">
              <div style="font-weight: 700; text-transform: uppercase; color: #1e293b; margin-bottom: 2px;">
                Taxpayer / Authorized Representative Certification
              </div>
              <p style="margin: 0 0 6px 0; line-height: 1.35;">
                I declare under the penalties of perjury that this schedule and return summary have been examined by me and to the best of my knowledge and belief, are true, correct, and complete pursuant to the provisions of the National Internal Revenue Code (NIRC) and regulations.
              </p>
              <div style="display: flex; justify-content: space-between; border-top: 1px dotted #94a3b8; padding-top: 6px; margin-top: 4px;">
                <span>Taxpayer / Representative Signature</span>
                <span>Date: ________________________</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Page 2 Footer -->
      <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b;">
        <div>
          <strong>BIR Form 2550Q (Quarterly VAT)</strong> • Electronic Filing & Payment System (eFPS) / eOPT Integration
        </div>
        <div>
          Generated: ${generatedTimestamp} • <strong>Page 2 of 2 (Schedules 1-3 & 2550Q VAT Summary)</strong>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const page1El = container.querySelector('#pdf-page-1') as HTMLElement;
    const page2El = container.querySelector('#pdf-page-2') as HTMLElement;

    if (!page1El || !page2El) {
      throw new Error('Failed to find generated PDF page elements');
    }

    // Capture Page 1 at high scale (scale: 2 for 192 DPI crisp resolution)
    const canvas1 = await html2canvas(page1El, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    // Capture Page 2 at high scale
    const canvas2 = await html2canvas(page2El, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    // Initialize Landscape A4 PDF (297mm x 210mm)
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = 297;
    const pdfHeight = 210;

    // Add Page 1
    const imgData1 = canvas1.toDataURL('image/png');
    pdf.addImage(imgData1, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

    // Add Page 2
    pdf.addPage('a4', 'landscape');
    const imgData2 = canvas2.toDataURL('image/png');
    pdf.addImage(imgData2, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

    // File name
    const companyName = (client.registeredName || client.tradeName || 'Taxpayer')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    const fileName = `BIR_2550Q_MultiBranch_Summary_${companyName}_${quarter}_${year}.pdf`;

    pdf.save(fileName);
  } finally {
    // Always clean up the temporary off-screen container
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

export interface VatComparisonPdfOptions {
  client: ClientProfile;
  quarter: Quarter;
  year: number;
  branches: ClientBranchSchedule[];
  purchasesMode: PurchasesReportingMode;
  consolidatedPurchasesFile?: BirUploadedFileRecord | null;
  branchCalculations: Array<{
    branch: ClientBranchSchedule;
    actualSalesF: number;
    actualSalesG: number;
    actualSalesH: number;
    actualSalesL: number;
    bPurchF: number;
    bPurchG: number;
    bPurchH: number;
    bPurchL: number;
    actualNetVat: number;
    adjustedSalesF: number;
    adjustedSalesG: number;
    adjustedSalesH: number;
    adjustedSalesL: number;
    adjustedNetVat: number;
    totalBranchDefTaxable: number;
    totalBranchDefOutputTax: number;
    proRatedManualTaxable: number;
    proRatedManualOutputTax: number;
  }>;
  actualTotals: {
    salesColF: number;
    salesColG: number;
    salesColH: number;
    salesColL: number;
    purchasesColF: number;
    purchasesColG: number;
    purchasesColH: number;
    purchasesColL: number;
    netVatPayable: number;
  };
  adjustedTotals: {
    salesColF: number;
    salesColG: number;
    salesColH: number;
    salesColL: number;
    purchasesColF: number;
    purchasesColG: number;
    purchasesColH: number;
    purchasesColL: number;
    netVatPayable: number;
  };
  deferredCustomersList?: Array<
    BirTransactionRow & {
      monthIndex: number;
      monthLabel: string;
      monthName: string;
      branchName: string;
      branchId: string;
    }
  >;
  manualDefTaxable?: number;
  manualDefOutputTax?: number;
  totalDeferredTaxable?: number;
  totalDeferredOutputTax?: number;
  previousQuarterHideAmount?: number;
  previousQuarterHideOutputTax?: number;
}

export async function exportVatComparisonPdf({
  client,
  quarter,
  year,
  branches,
  purchasesMode,
  branchCalculations,
  actualTotals,
  adjustedTotals,
  deferredCustomersList = [],
  manualDefTaxable = 0,
  manualDefOutputTax = 0,
  totalDeferredTaxable = 0,
  totalDeferredOutputTax = 0,
  previousQuarterHideAmount = 0,
  previousQuarterHideOutputTax = 0,
}: VatComparisonPdfOptions): Promise<void> {
  const quarterDueDates: Record<Quarter, string> = {
    Q1: `April 25, ${year}`,
    Q2: `July 25, ${year}`,
    Q3: `October 25, ${year}`,
    Q4: `January 25, ${year + 1}`,
  };
  const statutoryDueDate = quarterDueDates[quarter];
  const generatedTimestamp = new Date().toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const hasActiveDeferral =
    totalDeferredTaxable > 0 ||
    totalDeferredOutputTax > 0 ||
    deferredCustomersList.length > 0 ||
    manualDefTaxable > 0 ||
    manualDefOutputTax > 0;

  const effectiveTotalDefTaxable = totalDeferredTaxable || 0;
  const effectiveTotalDefOutputTax = totalDeferredOutputTax || 0;
  const effectiveManualTaxable = manualDefTaxable || 0;
  const effectiveManualOutputTax = manualDefOutputTax || 0;
  const effectivePrevQuarterHideAmount = previousQuarterHideAmount || 0;
  const effectivePrevQuarterHideOutputTax =
    previousQuarterHideOutputTax || (effectivePrevQuarterHideAmount > 0 ? effectivePrevQuarterHideAmount * 0.12 : 0);

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '1120px';
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '-9999';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  container.style.color = '#0f172a';
  container.style.boxSizing = 'border-box';

  // Deferrals detailed rows (up to 4 on page 1, or full list)
  const isMultiPageDeferrals = deferredCustomersList.length > 4;
  const page1DeferralItems = isMultiPageDeferrals ? deferredCustomersList.slice(0, 3) : deferredCustomersList;

  const renderDeferredRows = (list: typeof deferredCustomersList) =>
    list
      .map(
        (tx, i) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 8px; background-color: ${i % 2 === 0 ? '#ffffff' : '#faf5ff'};">
        <td style="padding: 3px 6px; font-weight: 600; color: #334155;">${tx.branchName || 'Main'}</td>
        <td style="padding: 3px 6px; color: #0f172a; font-weight: 600; max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${tx.registeredName || 'Unnamed Customer'}
        </td>
        <td style="padding: 3px 6px; font-family: monospace; color: #475569;">${tx.tin || 'N/A'}</td>
        <td style="padding: 3px 6px; color: #64748b;">${tx.monthLabel || `${tx.monthIndex} Month`}</td>
        <td style="padding: 3px 6px; text-align: right; font-weight: 600; color: #6b21a8;">${formatPdfCurrency(tx.taxableAmount || 0)}</td>
        <td style="padding: 3px 6px; text-align: right; font-weight: 700; color: #7c3aed;">${formatPdfCurrency(tx.taxAmount || 0)}</td>
        <td style="padding: 3px 6px; text-align: center; color: #9333ea; font-size: 7.5px; font-weight: 700;">DEFERRED</td>
      </tr>
    `
      )
      .join('');

  // Page 1 HTML
  const page1Html = `
    <div class="pdf-comparison-page" id="pdf-comp-page-1" style="width: 1120px; min-height: 792px; padding: 20px 28px; background-color: #ffffff; box-sizing: border-box;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 38px; height: 38px; border-radius: 8px; background: linear-gradient(135deg, #1e1b4b, #312e81); color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 15px; border: 1px solid #4338ca;">
            BIR
          </div>
          <div>
            <div style="font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.08em;">
              Republic of the Philippines • Bureau of Internal Revenue
            </div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a; letter-spacing: -0.01em; margin-top: 1px;">
              ${client.registeredName || client.tradeName || 'Taxpayer'}
            </div>
            <div style="font-size: 9.5px; color: #64748b; font-weight: 500;">
              Quarterly VAT Multi-Branch Comparison Schedule • Actual Basis vs. Adjusted Basis (Deferred Sales & VAT Due Reconciliation)
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 12px; text-align: right;">
            <div style="font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase;">Tax Period</div>
            <div style="font-size: 13px; font-weight: 800; color: #1e1b4b;">${quarter} ${year}</div>
            <div style="font-size: 8.5px; color: #64748b;">Due: ${statutoryDueDate}</div>
          </div>
        </div>
      </div>

      <!-- Taxpayer Profile Grid (Only TIN, Purchases Mode, and Form Type) -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 10px; display: grid; grid-template-columns: 1.4fr 1.3fr 1.3fr; gap: 12px; font-size: 9px;">
        <div>
          <div style="font-size: 8px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Taxpayer Identification No. (TIN)</div>
          <div style="font-weight: 700; font-family: monospace; color: #0f172a; font-size: 11px; margin-top: 1px;">${client.tin}</div>
          <div style="font-size: 8.5px; color: #475569; margin-top: 1px;">RDO: ${client.rdo} • Classification: ${client.classification}</div>
        </div>
        <div>
          <div style="font-size: 8px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Purchases Mode</div>
          <div style="font-weight: 700; color: #0f172a; font-size: 10px; margin-top: 1px;">
            ${purchasesMode === 'per-branch' ? 'Per-Branch Input Tax' : 'Consolidated Purchases'}
          </div>
          <div style="font-size: 8.5px; color: #475569; margin-top: 1px;">${branches.length} Active Branch(es)</div>
        </div>
        <div>
          <div style="font-size: 8px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Form Type</div>
          <div style="font-weight: 700; color: #4338ca; font-size: 10px; margin-top: 1px;">BIR Form 2550Q (Quarterly VAT)</div>
          <div style="font-size: 8.5px; color: #059669; margin-top: 1px;">Status: Validated (${client.vatStatus === 'vat-registered' ? 'VAT Registered' : 'Non-VAT'})</div>
        </div>
      </div>

      <!-- TABLE 1: ACTUAL COMPUTATION -->
      <div style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 7px; height: 7px; border-radius: 2px; background-color: #2563eb;"></div>
            <div style="font-size: 10px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.04em;">
              1. ACTUAL COMPUTATION
            </div>
          </div>
          <div style="font-size: 8px; color: #64748b; font-style: italic;">
            Direct unadjusted rollup from uploaded monthly 2550Q / SLSP files
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; table-layout: fixed;">
          <thead>
            <tr style="background-color: #0f172a; color: #ffffff;">
              <th rowspan="2" style="padding: 6px 8px; text-align: left; border-right: 1px solid #334155; width: 10.5%; font-size: 9.5px; font-weight: 800; text-transform: uppercase; vertical-align: middle; white-space: nowrap;">Consolidation Basis</th>
              <th colspan="4" style="padding: 5px 6px; text-align: center; border-right: 1px solid #334155; background-color: #1e1b4b; color: #e0e7ff; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em;">
                ACTUAL SALES
              </th>
              <th colspan="4" style="padding: 5px 6px; text-align: center; border-right: 1px solid #334155; background-color: #451a03; color: #fef08a; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em;">
                ACTUAL PURCHASES
              </th>
              <th rowspan="2" style="padding: 6px 8px; text-align: right; background-color: #0369a1; color: #ffffff; width: 12.5%; font-size: 9.5px; font-weight: 800; text-transform: uppercase; vertical-align: middle; white-space: nowrap;">
                ACTUAL VAT DUE
              </th>
            </tr>
            <tr style="background-color: #e2e8f0; color: #1e293b; font-weight: 700; font-size: 9px; border-bottom: 1px solid #cbd5e1;">
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">Taxable (12%)</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">Zero-Rated</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">Exempt</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #94a3b8; background-color: #ede9fe; color: #4338ca; vertical-align: middle; white-space: nowrap;">Output Tax</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">Taxable (12%)</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">Zero-Rated</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">Exempt</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #94a3b8; background-color: #fef3c7; color: #b45309; vertical-align: middle; white-space: nowrap;">Input Tax</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background-color: #ffffff; border-bottom: 2px solid #0f172a; font-weight: 700;">
              <td style="padding: 7px 8px; font-weight: 800; font-size: 11px; color: #0f172a; border-right: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">
                Actual
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #0f172a; border-right: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(actualTotals.salesColH)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #64748b; border-right: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(actualTotals.salesColG)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #64748b; border-right: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(actualTotals.salesColF)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 800; color: #4338ca; background-color: #f5f3ff; border-right: 1px solid #94a3b8; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(actualTotals.salesColL)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #0f172a; border-right: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(actualTotals.purchasesColH)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #64748b; border-right: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(actualTotals.purchasesColG)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #64748b; border-right: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(actualTotals.purchasesColF)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 800; color: #b45309; background-color: #fffbeb; border-right: 1px solid #94a3b8; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(actualTotals.purchasesColL)}
              </td>
              <td style="padding: 7px 8px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 800; color: ${actualTotals.netVatPayable >= 0 ? '#047857' : '#0369a1'}; background-color: ${actualTotals.netVatPayable >= 0 ? '#ecfdf5' : '#f0f9ff'}; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(actualTotals.netVatPayable)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- TABLE 2: ADJUSTED COMPUTATION -->
      <div style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 7px; height: 7px; border-radius: 2px; background-color: #7c3aed;"></div>
            <div style="font-size: 10px; font-weight: 800; color: #581c87; text-transform: uppercase; letter-spacing: 0.04em;">
              2. ADJUSTED COMPUTATION
            </div>
          </div>
          <div style="font-size: 8px; color: #6b21a8; font-weight: 600;">
            Adjusted for deferred uncollected sales / VAT pursuant to RR 16-2005
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; border: 1px solid #d8b4fe; border-radius: 4px; overflow: hidden; table-layout: fixed;">
          <thead>
            <tr style="background-color: #3b0764; color: #ffffff;">
              <th rowspan="2" style="padding: 6px 8px; text-align: left; border-right: 1px solid #581c87; width: 10.5%; font-size: 9.5px; font-weight: 800; text-transform: uppercase; vertical-align: middle; white-space: nowrap;">Consolidation Basis</th>
              <th colspan="4" style="padding: 5px 6px; text-align: center; border-right: 1px solid #581c87; background-color: #4c1d95; color: #f5d0fe; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em;">
                ADJUSTED SALES
              </th>
              <th colspan="4" style="padding: 5px 6px; text-align: center; border-right: 1px solid #581c87; background-color: #451a03; color: #fef08a; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em;">
                ADJUSTED PURCHASES
              </th>
              <th rowspan="2" style="padding: 6px 8px; text-align: right; background-color: #581c87; color: #ffffff; width: 12.5%; font-size: 9.5px; font-weight: 800; text-transform: uppercase; vertical-align: middle; white-space: nowrap;">
                ADJUSTED VAT DUE
              </th>
            </tr>
            <tr style="background-color: #f3e8ff; color: #581c87; font-weight: 700; font-size: 9px; border-bottom: 1px solid #d8b4fe;">
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #e9d5ff; vertical-align: middle; white-space: nowrap;">Taxable (12%)</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #e9d5ff; vertical-align: middle; white-space: nowrap;">Zero-Rated</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #e9d5ff; vertical-align: middle; white-space: nowrap;">Exempt</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #c084fc; background-color: #f3e8ff; color: #6b21a8; vertical-align: middle; white-space: nowrap;">Output Tax</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #e9d5ff; vertical-align: middle; white-space: nowrap;">Taxable (12%)</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #e9d5ff; vertical-align: middle; white-space: nowrap;">Zero-Rated</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #e9d5ff; vertical-align: middle; white-space: nowrap;">Exempt</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #c084fc; background-color: #fef3c7; color: #b45309; vertical-align: middle; white-space: nowrap;">Input Tax</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background-color: #ffffff; border-bottom: 2px solid #3b0764; font-weight: 700;">
              <td style="padding: 7px 8px; font-weight: 800; font-size: 11px; color: #3b0764; border-right: 1px solid #d8b4fe; vertical-align: middle; white-space: nowrap;">
                Adjusted
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #0f172a; border-right: 1px solid #f3e8ff; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(adjustedTotals.salesColH)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #64748b; border-right: 1px solid #f3e8ff; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(adjustedTotals.salesColG)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #64748b; border-right: 1px solid #d8b4fe; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(adjustedTotals.salesColF)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 800; color: #6b21a8; background-color: #faf5ff; border-right: 1px solid #c084fc; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(adjustedTotals.salesColL)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #0f172a; border-right: 1px solid #f3e8ff; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(adjustedTotals.purchasesColH)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #64748b; border-right: 1px solid #f3e8ff; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(adjustedTotals.purchasesColG)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #64748b; border-right: 1px solid #d8b4fe; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(adjustedTotals.purchasesColF)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 800; color: #b45309; background-color: #fffbeb; border-right: 1px solid #c084fc; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(adjustedTotals.purchasesColL)}
              </td>
              <td style="padding: 7px 8px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 800; color: ${adjustedTotals.netVatPayable >= 0 ? '#4338ca' : '#dc2626'}; background-color: ${adjustedTotals.netVatPayable >= 0 ? '#f5f3ff' : '#fef2f2'}; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(adjustedTotals.netVatPayable)}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Comparison Variance Strip -->
        <div style="background: linear-gradient(90deg, #f5f3ff, #faf5ff); border: 1px dashed #c084fc; border-radius: 4px; padding: 5px 10px; margin-top: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 8.5px;">
          <span style="font-weight: 800; color: #6b21a8; text-transform: uppercase; letter-spacing: 0.04em;">
            Variance Summary (Actual vs. Adjusted):
          </span>
          <div style="display: flex; gap: 14px; font-weight: 700;">
            <span style="color: #475569;">
              Taxable Sales Diff: <strong style="color: #7c3aed; font-family: monospace; font-size: 9.5px;">-${formatPdfCurrency(actualTotals.salesColH - adjustedTotals.salesColH)}</strong>
            </span>
            <span style="color: #475569;">
              Output VAT Diff: <strong style="color: #7c3aed; font-family: monospace; font-size: 9.5px;">-${formatPdfCurrency(actualTotals.salesColL - adjustedTotals.salesColL)}</strong>
            </span>
            <span style="color: #475569;">
              Net VAT Payable Impact: <strong style="color: #4338ca; font-family: monospace; font-size: 9.5px;">-${formatPdfCurrency(actualTotals.netVatPayable - adjustedTotals.netVatPayable)}</strong>
            </span>
          </div>
        </div>
      </div>

      <!-- BOTTOM SECTION: SUMMARY OF THE DEFERRALS -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 7px; height: 7px; border-radius: 2px; background-color: #059669;"></div>
            <div style="font-size: 10px; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: 0.04em;">
              3. Summary of Deferrals & Variance Reconciliation
            </div>
          </div>
          <div style="font-size: 8px; color: #047857; font-weight: 600;">
            ${hasActiveDeferral || effectivePrevQuarterHideAmount > 0 ? `${deferredCustomersList.length} transaction(s) + adjustments active` : 'No active deferrals (Identical)'}
          </div>
        </div>

        <!-- Deferral Metric Cards (4 cards: Total Deferred Taxable, Output VAT, Prev Qtr Hide, Specific Customer Txns) -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 6px;">
          <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 4px; padding: 5px 8px;">
            <div style="font-size: 7px; font-weight: 700; color: #7c3aed; text-transform: uppercase;">Total Deferred Taxable</div>
            <div style="font-size: 10.5px; font-weight: 800; color: #581c87; margin-top: 1px;">${formatPdfCurrency(effectiveTotalDefTaxable)}</div>
          </div>
          <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 4px; padding: 5px 8px;">
            <div style="font-size: 7px; font-weight: 700; color: #7c3aed; text-transform: uppercase;">Total Deferred Output VAT</div>
            <div style="font-size: 10.5px; font-weight: 800; color: #6b21a8; margin-top: 1px;">${formatPdfCurrency(effectiveTotalDefOutputTax)}</div>
          </div>
          <div style="background-color: #eef2ff; border: 1px solid #c7d2fe; border-radius: 4px; padding: 5px 8px;">
            <div style="font-size: 7px; font-weight: 700; color: #4338ca; text-transform: uppercase;">Prev Qtr Hide Amount</div>
            <div style="font-size: 10.5px; font-weight: 800; color: #312e81; margin-top: 1px;">${formatPdfCurrency(effectivePrevQuarterHideAmount)}</div>
            <div style="font-size: 6.5px; color: #4338ca; font-weight: 600;">VAT: ${formatPdfCurrency(effectivePrevQuarterHideOutputTax)}</div>
          </div>
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 5px 8px;">
            <div style="font-size: 7px; font-weight: 700; color: #475569; text-transform: uppercase;">Specific Customer Txns</div>
            <div style="font-size: 10.5px; font-weight: 800; color: #0f172a; margin-top: 1px;">${deferredCustomersList.length} item(s)</div>
          </div>
        </div>

        <!-- Previous Quarter Hide Amount Banner if present -->
        ${
          effectivePrevQuarterHideAmount > 0
            ? `
          <div style="background-color: #eef2ff; border: 1px solid #c7d2fe; border-radius: 4px; padding: 5px 9px; margin-bottom: 5px; font-size: 8px; color: #312e81; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong style="color: #1e1b4b;">Previous Quarter Hide Amount (Prior Period Carried Over):</strong>
              <span style="font-family: monospace; font-weight: 700; color: #4338ca; margin-left: 4px;">
                ₱ ${formatPdfCurrency(effectivePrevQuarterHideAmount)}
              </span>
              <span style="color: #4338ca; margin-left: 4px; font-weight: 600;">
                (Corresponding Output Tax: ₱ ${formatPdfCurrency(effectivePrevQuarterHideOutputTax)})
              </span>
            </div>
            <div style="font-size: 7.5px; color: #4338ca; font-style: italic;">
              Tracked for variance reconciliation across quarterly filings
            </div>
          </div>
        `
            : ''
        }

        ${
          page1DeferralItems.length > 0
            ? `
          <!-- Itemized Customer Deferrals Table -->
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e9d5ff; border-radius: 4px; overflow: hidden; margin-top: 4px;">
            <thead>
              <tr style="background-color: #6b21a8; color: #ffffff; font-size: 7.5px; text-transform: uppercase;">
                <th style="padding: 3px 6px; text-align: left; width: 18%;">Branch</th>
                <th style="padding: 3px 6px; text-align: left; width: 28%;">Customer Name</th>
                <th style="padding: 3px 6px; text-align: left; width: 16%;">Customer TIN</th>
                <th style="padding: 3px 6px; text-align: left; width: 12%;">Month</th>
                <th style="padding: 3px 6px; text-align: right; width: 13%;">Taxable Excluded</th>
                <th style="padding: 3px 6px; text-align: right; width: 13%;">Output VAT Deferred</th>
              </tr>
            </thead>
            <tbody>
              ${renderDeferredRows(page1DeferralItems)}
            </tbody>
          </table>
          ${
            isMultiPageDeferrals
              ? `<div style="font-size: 7.5px; color: #7c3aed; font-style: italic; margin-top: 2px;">* Showing 3 of ${deferredCustomersList.length} deferred customer transactions. Full schedule continues on Page 2.</div>`
              : ''
          }
        `
            : hasActiveDeferral
            ? `
          <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 4px; padding: 6px 10px; font-size: 8px; color: #6b21a8;">
            <strong>Manual Pro-Rated Deferral Active:</strong> Taxable Sales of ₱ ${formatPdfCurrency(effectiveManualTaxable)} and Output VAT of ₱ ${formatPdfCurrency(effectiveManualOutputTax)} have been pro-rated across branches based on taxable sales ratio.
          </div>
        `
            : `
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 10px; font-size: 8px; color: #475569; text-align: center;">
            No sales or output tax deferrals were applied for this quarter. The Actual and Adjusted VAT schedules reflect identical figures.
          </div>
        `
        }
      </div>

      <!-- Footer -->
      <div style="margin-top: 10px; padding-top: 6px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 7.5px; color: #94a3b8;">
        <div>BIR Multi-Branch Reconciliation Report • RR 16-2005 & RA 11976 eOPT Compliant</div>
        <div>Generated: ${generatedTimestamp} • Page 1 of ${isMultiPageDeferrals ? '2' : '1'}</div>
      </div>
    </div>
  `;

  // Page 2 (if multi-page deferrals exist)
  let page2Html = '';
  if (isMultiPageDeferrals) {
    page2Html = `
      <div class="pdf-comparison-page" id="pdf-comp-page-2" style="width: 1120px; min-height: 792px; padding: 20px 28px; background-color: #ffffff; box-sizing: border-box;">
        <!-- Compact Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #0f172a; padding-bottom: 6px; margin-bottom: 10px;">
          <div>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a;">SCHEDULE OF DEFERRED SALES & OUTPUT TAX (FULL ITEMIZED BREAKDOWN)</div>
            <div style="font-size: 8.5px; color: #64748b;">${client.registeredName || client.tradeName} • TIN: ${client.tin} • ${quarter} ${year}</div>
          </div>
          <div style="font-size: 8.5px; color: #475569; font-weight: 600;">Total Deferred: ${formatPdfCurrency(effectiveTotalDefTaxable)} (${deferredCustomersList.length} transactions)</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; margin-bottom: 12px;">
          <thead>
            <tr style="background-color: #3b0764; color: #ffffff; font-size: 8px; text-transform: uppercase;">
              <th style="padding: 4px 6px; text-align: left; width: 16%;">Branch</th>
              <th style="padding: 4px 6px; text-align: left; width: 30%;">Customer / Buyer Name</th>
              <th style="padding: 4px 6px; text-align: left; width: 16%;">Customer TIN</th>
              <th style="padding: 4px 6px; text-align: left; width: 12%;">Month</th>
              <th style="padding: 4px 6px; text-align: right; width: 13%;">Taxable Amount</th>
              <th style="padding: 4px 6px; text-align: right; width: 13%;">Output VAT Deferred</th>
            </tr>
          </thead>
          <tbody>
            ${renderDeferredRows(deferredCustomersList)}
          </tbody>
        </table>

        <!-- Pro-rating summary -->
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; font-size: 8.5px;">
          <div style="font-weight: 800; color: #1e1b4b; text-transform: uppercase; margin-bottom: 4px;">Branch Pro-Rating Allocation Notes:</div>
          <div style="color: #475569; line-height: 1.5;">
            Customer-specific deferrals are matched directly with their designated branch source filings. Any general manual deferral amount is proportionally allocated based on each branch's base taxable sales ratio.
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 16px; padding-top: 6px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 7.5px; color: #94a3b8;">
          <div>BIR Multi-Branch Reconciliation Report • Page 2 of 2</div>
          <div>Generated: ${generatedTimestamp}</div>
        </div>
      </div>
    `;
  }

  container.innerHTML = page1Html + page2Html;
  document.body.appendChild(container);

  try {
    const pageEls = container.querySelectorAll('.pdf-comparison-page');
    if (pageEls.length === 0) {
      throw new Error('Failed to create PDF comparison pages');
    }

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = 297;
    const pdfHeight = 210;

    for (let i = 0; i < pageEls.length; i++) {
      if (i > 0) {
        pdf.addPage('a4', 'landscape');
      }

      const canvas = await html2canvas(pageEls[i] as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    }

    const companyName = (client.registeredName || client.tradeName || 'Taxpayer')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    const fileName = `BIR_VAT_Comparison_Actual_vs_Adjusted_${companyName}_${quarter}_${year}.pdf`;

    pdf.save(fileName);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

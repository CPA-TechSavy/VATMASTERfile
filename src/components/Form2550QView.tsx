import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Data2550Q, ClientProfile, Quarter } from '../types/tax';
import { calculate2550Q, computeMonthlyQuarterBreakdown } from '../utils/taxCalculations';
import { formatPHP, parseNumber } from '../utils/formatters';
import {
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  Table as TableIcon,
  Save,
  CheckCircle2,
  Check,
} from 'lucide-react';
import { PenaltiesModal } from './PenaltiesModal';
import { downloadBirSlspExcelTemplate } from '../utils/excelVatTemplate';
import { BranchVatSchedule } from './BranchVatSchedule';
import { exportMultiBranchAnd2550QPdf } from '../utils/pdfExport';
import {
  ClientBranchSchedule,
  PurchasesReportingMode,
  BirUploadedFileRecord,
} from '../types/branchVat';

interface Form2550QViewProps {
  client: ClientProfile;
  quarter: Quarter;
  year: number;
  data: Data2550Q;
  onChange: (updated: Data2550Q) => void;
}

export const Form2550QView: React.FC<Form2550QViewProps> = ({
  client,
  quarter,
  year,
  data,
  onChange,
}) => {
  const [showPenalties, setShowPenalties] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(false);

  // Dedicated explicit quarterly persistence key
  const explicitQuarterKey = `bir_saved_2550q_${client.id}_${year}_${quarter}`;
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(explicitQuarterKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return (
          parsed.timeFormatted ||
          (parsed.savedAt
            ? new Date(parsed.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Previously saved')
        );
      }
    } catch (e) {}
    return null;
  });

  // Track branch schedule for the monthly breakdown table
  const branchScheduleStorageKey = `bir_branch_schedule_${client.id}_${year}_${quarter}`;
  const [branchScheduleState, setBranchScheduleState] = useState<{
    branches: ClientBranchSchedule[];
    purchasesMode: PurchasesReportingMode;
    consolidatedPurchasesFile?: BirUploadedFileRecord;
  }>(() => {
    try {
      const saved = localStorage.getItem(branchScheduleStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          branches: parsed.branches || [],
          purchasesMode: parsed.purchasesMode || 'consolidated',
          consolidatedPurchasesFile: parsed.consolidatedPurchasesFile,
        };
      }
    } catch (e) {
      console.error('Failed to parse branch schedule', e);
    }
    return {
      branches: [],
      purchasesMode: 'consolidated',
    };
  });

  // Stable refs to prevent effect loops
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Load saved quarter data if available when client/year/quarter changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(explicitQuarterKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setLastSavedTime(
          parsed.timeFormatted ||
            (parsed.savedAt
              ? new Date(parsed.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Previously saved')
        );
        if (parsed.data && JSON.stringify(parsed.data) !== JSON.stringify(dataRef.current)) {
          onChangeRef.current(parsed.data);
        }
      } else {
        setLastSavedTime(null);
      }
    } catch (e) {}
  }, [explicitQuarterKey]);

  // Reload branch schedule when quarter/year/client changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(branchScheduleStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setBranchScheduleState({
          branches: parsed.branches || [],
          purchasesMode: parsed.purchasesMode || 'consolidated',
          consolidatedPurchasesFile: parsed.consolidatedPurchasesFile,
        });
      } else {
        setBranchScheduleState({
          branches: [],
          purchasesMode: 'consolidated',
        });
      }
    } catch (e) {}
  }, [branchScheduleStorageKey]);

  const handleBranchScheduleChange = useCallback(
    (updated: {
      branches: ClientBranchSchedule[];
      purchasesMode: PurchasesReportingMode;
      consolidatedPurchasesFile?: BirUploadedFileRecord;
      deferralState?: any;
    }) => {
      setBranchScheduleState((prev) => {
        if (
          prev.branches === updated.branches &&
          prev.purchasesMode === updated.purchasesMode &&
          prev.consolidatedPurchasesFile === updated.consolidatedPurchasesFile
        ) {
          return prev;
        }
        return {
          branches: updated.branches,
          purchasesMode: updated.purchasesMode,
          consolidatedPurchasesFile: updated.consolidatedPurchasesFile,
        };
      });
    },
    []
  );

  const monthlyBreakdown = useMemo(() => {
    return computeMonthlyQuarterBreakdown({
      quarter,
      branches: branchScheduleState.branches,
      purchasesMode: branchScheduleState.purchasesMode,
      consolidatedPurchasesFile: branchScheduleState.consolidatedPurchasesFile,
    });
  }, [quarter, branchScheduleState]);

  const result = calculate2550Q(data);

  const handleSaveQuarterData = () => {
    // 1. Commit data via onChange to update active state in App.tsx
    onChange(data);

    // 2. Persist to dedicated quarter key in localStorage
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    try {
      localStorage.setItem(
        explicitQuarterKey,
        JSON.stringify({
          data,
          savedAt: new Date().toISOString(),
          timeFormatted: timestamp,
          clientId: client.id,
          quarter,
          year,
        })
      );
    } catch (e) {
      console.error('Failed to save quarter data to localStorage', e);
    }

    setLastSavedTime(timestamp);
    setSaveSuccessMessage(true);
    setTimeout(() => {
      setSaveSuccessMessage(false);
    }, 4000);
  };

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      await exportMultiBranchAnd2550QPdf({
        client,
        quarter,
        year,
        data2550Q: data,
        result2550Q: result,
      });
    } catch (err) {
      console.error('Failed to export PDF', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const updateField = (field: keyof Data2550Q, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const handleSyncFromBranchSchedule = (totals: {
    vatableSales: number;
    zeroRatedSales: number;
    vatExemptSales: number;
    inputPurchasesGoods: number;
    inputPurchasesServices: number;
    inputCapitalGoods: number;
  }) => {
    onChange({
      ...data,
      vatableSales: totals.vatableSales,
      zeroRatedSales: totals.zeroRatedSales,
      vatExemptSales: totals.vatExemptSales,
      inputPurchasesGoods: totals.inputPurchasesGoods,
      inputPurchasesServices: totals.inputPurchasesServices,
      inputCapitalGoods: totals.inputCapitalGoods,
    });
  };

  const handleDownloadTemplate = () => {
    downloadBirSlspExcelTemplate({
      type: 'Sales',
      quarter,
      monthLabel: '1st Month',
      client,
      includeSampleRow: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Main Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold bg-violet-600 text-white rounded">
              BIR Form 2550Q
            </span>
            <span className="text-xs text-slate-300 font-mono">
              {quarter} {year} • Quarterly Value-Added Tax Return
            </span>
          </div>
          <h2 className="text-base font-semibold mt-1">{client.tradeName}</h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Download Landscape PDF Form Button */}
          <button
            id="download-pdf-summary-2550q-header-btn"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-violet-700 hover:bg-violet-800 text-white rounded-lg transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
            title="Download Landscape PDF of Multi-Branch Aggregation Summary, Schedules 1 to 3, and Form 2550Q VAT Summary"
          >
            {isExportingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting PDF...</span>
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5" />
                <span>Download PDF Summary (Landscape)</span>
              </>
            )}
          </button>

          {/* Download Template Button */}
          <button
            id="download-vat-template-btn"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors shadow-xs"
            title="Download formatted BIR SLSP Excel template (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-violet-400" />
            <span>Download Template</span>
          </button>

          <button
            id="open-penalties-2550q-btn"
            onClick={() => setShowPenalties(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Late Penalties</span>
          </button>
        </div>
      </div>

      {/* Multi-Branch & Line of Business Schedule Component */}
      <BranchVatSchedule
        client={client}
        quarter={quarter}
        year={year}
        formType="2550Q"
        data2550Q={data}
        onSync2550Q={handleSyncFromBranchSchedule}
        onBranchScheduleChange={handleBranchScheduleChange}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          {/* Monthly Consolidated Sales & Purchases Breakdown Table (Above Schedule 1) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700">
                  <TableIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Monthly Consolidated Sales & Purchases ({quarter} {year})
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Consolidates all branches for each month of the quarter: Taxable, Exempt, Zero-Rated Sales/Purchases & VAT
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200 rounded-full">
                Monthly Aggregation
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <th rowSpan={2} className="py-2.5 px-3 border-r border-slate-200 align-middle">
                      Quarter Month
                    </th>
                    <th colSpan={4} className="py-2 px-3 text-center bg-violet-50 text-violet-900 border-r border-violet-200">
                      SALES (OUTPUT TAX)
                    </th>
                    <th colSpan={4} className="py-2 px-3 text-center bg-amber-50 text-amber-900 border-r border-amber-200">
                      PURCHASES (INPUT TAX)
                    </th>
                    <th rowSpan={2} className="py-2.5 px-3 text-right bg-slate-50 text-slate-900 align-middle">
                      NET VAT
                    </th>
                  </tr>
                  <tr className="bg-slate-50 text-[11px] font-medium text-slate-600 border-b border-slate-200">
                    {/* Sales Subheaders */}
                    <th className="py-1.5 px-2 text-right bg-violet-50/50">Taxable (12%)</th>
                    <th className="py-1.5 px-2 text-right bg-violet-50/50">Exempt</th>
                    <th className="py-1.5 px-2 text-right bg-violet-50/50">Zero-Rated</th>
                    <th className="py-1.5 px-2 text-right bg-violet-100/70 text-violet-800 font-bold border-r border-violet-200">
                      Output VAT
                    </th>

                    {/* Purchases Subheaders */}
                    <th className="py-1.5 px-2 text-right bg-amber-50/50">Taxable (12%)</th>
                    <th className="py-1.5 px-2 text-right bg-amber-50/50">Exempt</th>
                    <th className="py-1.5 px-2 text-right bg-amber-50/50">Zero-Rated</th>
                    <th className="py-1.5 px-2 text-right bg-amber-100/70 text-amber-800 font-bold border-r border-amber-200">
                      Input VAT
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {(monthlyBreakdown?.months || monthlyBreakdown?.monthlyBreakdown || []).map((m) => (
                    <tr key={m.monthIndex} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 font-sans font-medium text-slate-900 border-r border-slate-200">
                        <span className="font-bold">{m.monthLabel}</span>
                        <span className="text-slate-500 font-normal ml-1">({m.monthName})</span>
                      </td>

                      {/* Sales */}
                      <td className="py-2 px-2 text-right text-slate-800">
                        {formatPHP(m.salesTaxable ?? m.taxableSales ?? 0)}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-600">
                        {(m.salesExempt ?? m.exemptSales ?? 0) ? formatPHP(m.salesExempt ?? m.exemptSales ?? 0) : '—'}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-600">
                        {(m.salesZeroRated ?? m.zeroRatedSales ?? 0)
                          ? formatPHP(m.salesZeroRated ?? m.zeroRatedSales ?? 0)
                          : '—'}
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-violet-700 bg-violet-50/20 border-r border-violet-200">
                        {formatPHP(m.salesOutputTax ?? m.outputTax ?? 0)}
                      </td>

                      {/* Purchases */}
                      <td className="py-2 px-2 text-right text-slate-800">
                        {formatPHP(m.purchasesTaxable ?? m.taxablePurchases ?? 0)}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-600">
                        {(m.purchasesExempt ?? m.exemptPurchases ?? 0)
                          ? formatPHP(m.purchasesExempt ?? m.exemptPurchases ?? 0)
                          : '—'}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-600">
                        {(m.purchasesZeroRated ?? m.zeroRatedPurchases ?? 0)
                          ? formatPHP(m.purchasesZeroRated ?? m.zeroRatedPurchases ?? 0)
                          : '—'}
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-amber-700 bg-amber-50/20 border-r border-amber-200">
                        {formatPHP(m.purchasesInputTax ?? m.inputTax ?? 0)}
                      </td>

                      {/* Net */}
                      <td className="py-2 px-3 text-right font-bold text-slate-900 bg-slate-50/50">
                        {formatPHP(m.netVat ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-mono text-xs font-bold border-t-2 border-slate-300">
                  <tr>
                    <td className="py-2.5 px-3 font-sans uppercase text-slate-800 border-r border-slate-200">
                      Quarter Total
                    </td>
                    {/* Sales Totals */}
                    <td className="py-2.5 px-2 text-right text-slate-900">
                      {formatPHP(
                        monthlyBreakdown?.quarterTotals?.salesTaxable ??
                          monthlyBreakdown?.quarterTotals?.taxableSales ??
                          0
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-700">
                      {formatPHP(
                        monthlyBreakdown?.quarterTotals?.salesExempt ??
                          monthlyBreakdown?.quarterTotals?.exemptSales ??
                          0
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-700">
                      {formatPHP(
                        monthlyBreakdown?.quarterTotals?.salesZeroRated ??
                          monthlyBreakdown?.quarterTotals?.zeroRatedSales ??
                          0
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right text-violet-800 bg-violet-100/50 border-r border-violet-200">
                      {formatPHP(
                        monthlyBreakdown?.quarterTotals?.salesOutputTax ??
                          monthlyBreakdown?.quarterTotals?.outputTax ??
                          0
                      )}
                    </td>

                    {/* Purchases Totals */}
                    <td className="py-2.5 px-2 text-right text-slate-900">
                      {formatPHP(
                        monthlyBreakdown?.quarterTotals?.purchasesTaxable ??
                          monthlyBreakdown?.quarterTotals?.taxablePurchases ??
                          0
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-700">
                      {formatPHP(
                        monthlyBreakdown?.quarterTotals?.purchasesExempt ??
                          monthlyBreakdown?.quarterTotals?.exemptPurchases ??
                          0
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-700">
                      {formatPHP(
                        monthlyBreakdown?.quarterTotals?.purchasesZeroRated ??
                          monthlyBreakdown?.quarterTotals?.zeroRatedPurchases ??
                          0
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right text-amber-800 bg-amber-100/50 border-r border-amber-200">
                      {formatPHP(
                        monthlyBreakdown?.quarterTotals?.purchasesInputTax ??
                          monthlyBreakdown?.quarterTotals?.inputTax ??
                          0
                      )}
                    </td>

                    {/* Net Total */}
                    <td className="py-2.5 px-3 text-right text-slate-950 bg-slate-200/50">
                      {formatPHP(monthlyBreakdown?.quarterTotals?.netVat ?? 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Output Taxable Sales */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Schedule 1: Sales / Receipts (Output Tax)
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-slate-700 font-medium">Vatable Sales / Receipts (12%)</div>
                  <div className="text-xs text-slate-400">Regular domestic sales subject to 12% VAT</div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="vatable-sales-2550q"
                    type="number"
                    value={data.vatableSales || ''}
                    onChange={(e) => updateField('vatableSales', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-slate-700">Sales to Government (12%)</div>
                  <div className="text-xs text-slate-400">Subject to standard 5% VAT withholding</div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="govt-sales-2550q"
                    type="number"
                    value={data.salesToGovernment || ''}
                    onChange={(e) => updateField('salesToGovernment', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Zero-Rated Sales (0%)</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="zero-rated-2550q"
                    type="number"
                    value={data.zeroRatedSales || ''}
                    onChange={(e) => updateField('zeroRatedSales', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">VAT-Exempt Sales</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="exempt-sales-2550q"
                    type="number"
                    value={data.vatExemptSales || ''}
                    onChange={(e) => updateField('vatExemptSales', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Input Tax on Purchases */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Schedule 2: Allowable Input Tax on Purchases (12%)
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Domestic Purchases of Goods</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="input-goods-2550q"
                    type="number"
                    value={data.inputPurchasesGoods || ''}
                    onChange={(e) => updateField('inputPurchasesGoods', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Domestic Purchases of Services</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="input-services-2550q"
                    type="number"
                    value={data.inputPurchasesServices || ''}
                    onChange={(e) => updateField('inputPurchasesServices', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Capital Goods Purchases</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="input-capital-2550q"
                    type="number"
                    value={data.inputCapitalGoods || ''}
                    onChange={(e) => updateField('inputCapitalGoods', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Prior Quarter's Excess Input Tax</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="prior-excess-input-2550q"
                    type="number"
                    value={data.priorQuarterExcessInputVat || ''}
                    onChange={(e) => updateField('priorQuarterExcessInputVat', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tax Credits / Withheld VAT */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Schedule 3: Tax Credits & Withholding VAT
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-slate-700">VAT Withheld on Sales to Govt (Form 2307)</div>
                  <div className="text-xs text-slate-400">5% standard final withholding VAT</div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="vat-govt-withheld-2550q"
                    type="number"
                    value={data.withheldVat2307Govt || ''}
                    onChange={(e) => updateField('withheldVat2307Govt', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Other Creditable VAT Withheld</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="vat-other-withheld-2550q"
                    type="number"
                    value={data.withheldVat2307Private || ''}
                    onChange={(e) => updateField('withheldVat2307Private', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Prior Payments Made (Monthly 2550M)</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="prior-payments-2550q"
                    type="number"
                    value={data.priorPaymentsThisQuarter || ''}
                    onChange={(e) => updateField('priorPaymentsThisQuarter', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right VAT Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 sticky top-4 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                2550Q VAT Summary
              </div>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Total Vatable Sales</span>
                <span className="font-mono font-medium">{formatPHP(result.vatableSales)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-semibold">
                <span>Output Tax Due (12%)</span>
                <span className="font-mono">{formatPHP(result.outputTax)}</span>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <div className="flex justify-between text-slate-600">
                  <span>Input Tax from Purchases</span>
                  <span className="font-mono font-medium">{formatPHP(result.inputTaxPurchases)}</span>
                </div>
                <div className="flex justify-between text-slate-600 mt-1">
                  <span>Prior Quarter Excess Input</span>
                  <span className="font-mono font-medium">{formatPHP(data.priorQuarterExcessInputVat)}</span>
                </div>
                <div className="flex justify-between text-slate-800 font-medium mt-1">
                  <span>Total Available Input Tax</span>
                  <span className="font-mono">{formatPHP(result.totalAvailableInputTax)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <div className="flex justify-between text-slate-600">
                  <span>Less: Creditable VAT Withheld</span>
                  <span className="font-mono font-medium text-emerald-700">
                    -{formatPHP(result.totalTaxCredits, false)}
                  </span>
                </div>
              </div>

              {/* Net VAT Banner */}
              <div
                className={`p-4 rounded-xl mt-4 border ${
                  result.isExcessInputVat
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                }`}
              >
                <div className="text-xs uppercase tracking-wider font-semibold opacity-80">
                  {result.isExcessInputVat ? 'Excess Input VAT to Next Quarter' : 'Net VAT Payable (To BIR)'}
                </div>
                <div className="text-2xl font-bold font-mono mt-1">
                  {result.isExcessInputVat
                    ? formatPHP(result.excessInputTax)
                    : formatPHP(Math.max(0, result.netVatPayable))}
                </div>
                <div className="text-xs mt-1 text-slate-500">
                  {result.isExcessInputVat
                    ? 'Available as input credit for succeeding quarters'
                    : 'Remit to BIR within statutory quarterly deadline'}
                </div>
              </div>

              {/* Save Button under NET VAT PAYABLE (TO BIR) */}
              <div className="pt-2">
                <button
                  type="button"
                  id="save-quarter-data-btn"
                  onClick={handleSaveQuarterData}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer"
                >
                  {saveSuccessMessage ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-200 animate-in zoom-in-50" />
                      <span>Data Saved for {quarter} {year}!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save {quarter} {year} Data</span>
                    </>
                  )}
                </button>
                <p className="text-[11px] text-slate-500 text-center mt-1.5 leading-tight">
                  Saves all encoded data and schedules for <strong>{quarter} {year}</strong> so amounts remain unchanged when navigating back to this quarter.
                </p>
                {lastSavedTime && (
                  <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2 mt-2 text-center flex items-center justify-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Quarter data saved at {lastSavedTime}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <PenaltiesModal
        isOpen={showPenalties}
        onClose={() => setShowPenalties(false)}
        basicTaxDue={result.netVatPayable}
        formName={`BIR Form 2550Q (${quarter} ${year})`}
      />
    </div>
  );
};

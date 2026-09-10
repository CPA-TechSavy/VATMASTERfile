import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Data2550Q, ClientProfile, Quarter } from '../types/tax';
import { calculate2550Q } from '../utils/taxCalculations';
import { formatPHP, parseNumber } from '../utils/formatters';
import {
  AlertTriangle,
  Save,
  CheckCircle2,
  Check,
} from 'lucide-react';
import { PenaltiesModal } from './PenaltiesModal';
import { BranchVatSchedule } from './BranchVatSchedule';
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

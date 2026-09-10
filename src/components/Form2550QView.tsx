import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Data2550Q, ClientProfile, Quarter } from '../types/tax';
import { calculate2550Q, getPriorQuarterExcessInputVat } from '../utils/taxCalculations';
import { formatPHP, parseNumber } from '../utils/formatters';
import {
  AlertTriangle,
  Save,
  CheckCircle2,
  Check,
  ArrowRightLeft,
  Lock,
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

const AccountingInputField: React.FC<{
  id: string;
  value: number;
  onChange?: (val: number) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
}> = ({ id, value, onChange, readOnly = false, placeholder = '0.00', className = '' }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [localText, setLocalText] = useState('');

  const displayValue = isFocused
    ? localText
    : (value !== undefined && value !== null ? formatPHP(value, false) : '0.00');

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (readOnly) return;
    setIsFocused(true);
    setLocalText(value ? value.toString() : '');
    e.target.select();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalText(raw);
    if (onChange) {
      onChange(parseNumber(raw));
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      readOnly={readOnly}
      tabIndex={readOnly ? -1 : undefined}
      value={displayValue}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  );
};

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

  const [computedSchedule1, setComputedSchedule1] = useState<{
    vatableSales: number;
    salesToGovernment: number;
    zeroRatedSales: number;
    vatExemptSales: number;
    inputPurchasesGoods: number;
    priorQuarterExcessInputVat?: number;
  } | null>(null);

  // Computed Prior Quarter's Excess Input Tax (only if previous quarter VAT Due was negative)
  const priorQuarterExcessInfo = React.useMemo(
    () => getPriorQuarterExcessInputVat(client.id, quarter, year),
    [client.id, quarter, year]
  );

  // Keep priorQuarterExcessInputVat aligned automatically if previous quarter VAT due is negative
  useEffect(() => {
    if (data.priorQuarterExcessInputVat !== priorQuarterExcessInfo.excessInputVat) {
      onChange({
        ...data,
        priorQuarterExcessInputVat: priorQuarterExcessInfo.excessInputVat,
      });
    }
  }, [client.id, quarter, year, priorQuarterExcessInfo.excessInputVat]);

  const handleBranchScheduleChange = useCallback(
    (updated: {
      branches: ClientBranchSchedule[];
      purchasesMode: PurchasesReportingMode;
      consolidatedPurchasesFile?: BirUploadedFileRecord;
      deferralState?: any;
      schedule1Computed?: {
        vatableSales: number;
        salesToGovernment: number;
        zeroRatedSales: number;
        vatExemptSales: number;
        inputPurchasesGoods: number;
        priorQuarterExcessInputVat?: number;
      };
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

      if (updated.schedule1Computed) {
        setComputedSchedule1(updated.schedule1Computed);
      }
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
    salesToGovernment?: number;
    zeroRatedSales: number;
    vatExemptSales: number;
    inputPurchasesGoods: number;
    inputPurchasesServices?: number;
    inputCapitalGoods?: number;
    priorQuarterExcessInputVat?: number;
  }) => {
    const priorExcess =
      totals.priorQuarterExcessInputVat !== undefined
        ? totals.priorQuarterExcessInputVat
        : priorQuarterExcessInfo.excessInputVat;

    onChange({
      ...data,
      vatableSales: totals.vatableSales,
      salesToGovernment:
        totals.salesToGovernment !== undefined ? totals.salesToGovernment : data.salesToGovernment || 0,
      zeroRatedSales: totals.zeroRatedSales,
      vatExemptSales: totals.vatExemptSales,
      inputPurchasesGoods: totals.inputPurchasesGoods,
      inputPurchasesServices: totals.inputPurchasesServices ?? data.inputPurchasesServices ?? 0,
      inputCapitalGoods: totals.inputCapitalGoods ?? data.inputCapitalGoods ?? 0,
      priorQuarterExcessInputVat: priorExcess,
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-100">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <span>Schedule 1: Sales / Receipts (Output Tax)</span>
                <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Locked</span>
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Synced from Multi-Branch Filings &amp; Deferrals
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-slate-700 font-medium">Vatable Sales / Receipts (12%)</div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <AccountingInputField
                    id="vatable-sales-2550q"
                    value={data.vatableSales || 0}
                    readOnly
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right bg-slate-100 text-slate-800 font-semibold border border-slate-200 rounded-lg cursor-not-allowed select-all focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-slate-700 font-medium">Sales to Government (12%)</div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <AccountingInputField
                    id="govt-sales-2550q"
                    value={data.salesToGovernment || 0}
                    readOnly
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right bg-slate-100 text-slate-800 font-semibold border border-slate-200 rounded-lg cursor-not-allowed select-all focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-sm text-slate-700 font-medium">Zero-Rated Sales (0%)</label>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <AccountingInputField
                    id="zero-rated-2550q"
                    value={data.zeroRatedSales || 0}
                    readOnly
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right bg-slate-100 text-slate-800 font-semibold border border-slate-200 rounded-lg cursor-not-allowed select-all focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-sm text-slate-700 font-medium">VAT-Exempt Sales</label>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <AccountingInputField
                    id="exempt-sales-2550q"
                    value={data.vatExemptSales || 0}
                    readOnly
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right bg-slate-100 text-slate-800 font-semibold border border-slate-200 rounded-lg cursor-not-allowed select-all focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Input Tax on Purchases */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-100">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <span>Schedule 2: Allowable Input Tax on Purchases (12%)</span>
                <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Locked</span>
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Synced from Purchases Filings &amp; Prior Quarter
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-sm text-slate-700 font-medium">Domestic Purchases of Goods</label>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <AccountingInputField
                    id="input-goods-2550q"
                    value={data.inputPurchasesGoods || 0}
                    readOnly
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right bg-slate-100 text-slate-800 font-semibold border border-slate-200 rounded-lg cursor-not-allowed select-all focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-sm text-slate-700 font-medium">Domestic Purchases of Services</label>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <AccountingInputField
                    id="input-services-2550q"
                    value={data.inputPurchasesServices || 0}
                    readOnly
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right bg-slate-100 text-slate-800 font-semibold border border-slate-200 rounded-lg cursor-not-allowed select-all focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-sm text-slate-700 font-medium">Capital Goods Purchases</label>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <AccountingInputField
                    id="input-capital-2550q"
                    value={data.inputCapitalGoods || 0}
                    readOnly
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right bg-slate-100 text-slate-800 font-semibold border border-slate-200 rounded-lg cursor-not-allowed select-all focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-slate-700 font-medium flex items-center gap-2">
                    <span>Prior Quarter's Excess Input Tax</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        priorQuarterExcessInfo.excessInputVat > 0
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {priorQuarterExcessInfo.excessInputVat > 0 ? 'Negative Prev VAT Due' : '₱0.00 (Not Negative)'}
                    </span>
                  </div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <AccountingInputField
                    id="prior-excess-input-2550q"
                    value={data.priorQuarterExcessInputVat || 0}
                    readOnly
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right bg-slate-100 text-slate-800 font-semibold border border-slate-200 rounded-lg cursor-not-allowed select-all focus:outline-none"
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
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <AccountingInputField
                    id="vat-govt-withheld-2550q"
                    value={data.withheldVat2307Govt || 0}
                    onChange={(val) => updateField('withheldVat2307Govt', val)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 font-medium"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Other Creditable VAT Withheld</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <AccountingInputField
                    id="vat-other-withheld-2550q"
                    value={data.withheldVat2307Private || 0}
                    onChange={(val) => updateField('withheldVat2307Private', val)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 font-medium"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Prior Payments Made (Monthly 2550M)</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <AccountingInputField
                    id="prior-payments-2550q"
                    value={data.priorPaymentsThisQuarter || 0}
                    onChange={(val) => updateField('priorPaymentsThisQuarter', val)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 font-medium"
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

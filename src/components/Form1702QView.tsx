import React, { useState, useEffect } from 'react';
import { Data1702Q, ClientProfile, Quarter } from '../types/tax';
import { calculate1702Q } from '../utils/taxCalculations';
import { formatPHP, parseNumber } from '../utils/formatters';
import { AlertTriangle, Building2, Save, CheckCircle2, Sparkles, RefreshCw } from 'lucide-react';
import { PenaltiesModal } from './PenaltiesModal';
import { AccountingInput } from './AccountingInput';

interface Form1702QViewProps {
  client: ClientProfile;
  quarter: Quarter;
  year: number;
  data: Data1702Q;
  onChange: (updated: Data1702Q) => void;
  salesSourceInfo?: {
    formName: '2550Q' | '2551Q';
    combinedSales: number;
    isVat: boolean;
  };
}

export const Form1702QView: React.FC<Form1702QViewProps> = ({
  client,
  quarter,
  year,
  data,
  onChange,
  salesSourceInfo,
}) => {
  const [showPenalties, setShowPenalties] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  const explicitQuarterKey = `bir_saved_1702q_${client.id}_${year}_${quarter}`;

  // Load saved timestamp for this quarter
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
      } else {
        setLastSavedTime(null);
      }
    } catch (e) {
      setLastSavedTime(null);
    }
  }, [explicitQuarterKey]);

  const handleSaveQuarterData = () => {
    onChange(data);

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
      console.error('Failed to save 1702Q quarter data', e);
    }

    setLastSavedTime(timestamp);
    setSaveSuccessMessage(true);
    setTimeout(() => setSaveSuccessMessage(false), 4000);
  };

  const result = calculate1702Q(data);

  const updateField = (field: keyof Data1702Q, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold bg-blue-600 text-white rounded">
              BIR Form 1702Q
            </span>
            <span className="text-xs text-slate-300 font-mono">
              {quarter} {year} • Corporate Income Tax Return
            </span>
          </div>
          <h2 className="text-base font-semibold mt-1 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            {client.registeredName}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="open-penalties-1702q-btn"
            onClick={() => setShowPenalties(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Late Penalties</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Inputs (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Settings & Rate Scheme */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Corporate Tax Regime & Rates (CREATE Act)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Applicable Corporate Rate
                </label>
                <select
                  id="rate-option-1702q"
                  value={data.rateOption}
                  onChange={(e) => updateField('rateOption', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="msme_20">MSME Corporate Rate (20%)</option>
                  <option value="regular_25">Regular Corporate Rate (25%)</option>
                </select>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  MSME: Net taxable income ≤ ₱5M and Assets ≤ ₱100M
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Minimum Corporate Income Tax (MCIT)
                </label>
                <label className="flex items-center gap-2 mt-2 cursor-pointer text-sm text-slate-700">
                  <input
                    id="mcit-checkbox-1702q"
                    type="checkbox"
                    checked={data.isMCOptional}
                    onChange={(e) => updateField('isMCOptional', e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Subject to MCIT (2% of Gross Income)</span>
                </label>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Applicable starting on 4th taxable year of operations
                </span>
              </div>
            </div>
          </div>

          {/* Operations & Expenses */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Income & Expense Statement
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-sm text-slate-700 font-medium flex items-center gap-2 flex-wrap">
                    <span>Gross Sales / Receipts / Revenues</span>
                    {salesSourceInfo && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                        <Sparkles className="w-3 h-3 text-blue-600" />
                        <span>Auto-reflects Form {salesSourceInfo.formName}</span>
                      </span>
                    )}
                  </label>
                  {salesSourceInfo && (
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Combined Sales in Form {salesSourceInfo.formName} ({salesSourceInfo.isVat ? '12% VAT' : 'Percentage Tax'}): {formatPHP(salesSourceInfo.combinedSales)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-60">
                    <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                    <AccountingInput
                      id="gross-sales-1702q"
                      value={data.grossSales}
                      onChange={(val) => updateField('grossSales', val)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-blue-50/30"
                    />
                  </div>
                  {salesSourceInfo && data.grossSales !== salesSourceInfo.combinedSales && (
                    <button
                      type="button"
                      onClick={() => updateField('grossSales', salesSourceInfo.combinedSales)}
                      title={`Sync with Form ${salesSourceInfo.formName} Combined Sales (${formatPHP(salesSourceInfo.combinedSales)})`}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-lg transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Sync</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Cost of Sales / Direct Services</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <AccountingInput
                    id="cost-sales-1702q"
                    value={data.costOfSales}
                    onChange={(val) => updateField('costOfSales', val)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Allowable Operating Expenses</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <AccountingInput
                    id="operating-expenses-1702q"
                    value={data.operatingExpenses}
                    onChange={(val) => updateField('operatingExpenses', val)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Non-Operating / Other Taxable Income</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <AccountingInput
                    id="non-op-1702q"
                    value={data.nonOperatingIncome}
                    onChange={(val) => updateField('nonOperatingIncome', val)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tax Credits */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Tax Credits & Payments
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-slate-700">Form 2307 Creditable Withholding Tax</div>
                  <div className="text-xs text-slate-400">Quarterly SAWT attachments</div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <AccountingInput
                    id="cwt2307-1702q"
                    value={data.cwt2307Credits}
                    onChange={(val) => updateField('cwt2307Credits', val)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Prior Quarter Tax Paid (Same Year)</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <AccountingInput
                    id="pq-tax-1702q"
                    value={data.priorQuarterTaxPaid}
                    onChange={(val) => updateField('priorQuarterTaxPaid', val)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Prior Year's Excess Credits</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <AccountingInput
                    id="py-excess-1702q"
                    value={data.priorYearExcessCredits}
                    onChange={(val) => updateField('priorYearExcessCredits', val)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Other Tax Credits / Incentives</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <AccountingInput
                    id="other-credits-1702q"
                    value={data.otherTaxCredits}
                    onChange={(val) => updateField('otherTaxCredits', val)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Calculation Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 sticky top-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                1702Q Corporate Computation
              </div>
              <span className="text-xs font-mono text-slate-500">Auto-Computed</span>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Gross Revenues</span>
                <span className="font-mono font-medium">{formatPHP(result.grossSales)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Less: Cost of Sales</span>
                <span className="font-mono font-medium text-amber-700">
                  -{formatPHP(result.costOfSales, false)}
                </span>
              </div>
              <div className="flex justify-between text-slate-700 font-medium">
                <span>Gross Income from Operations</span>
                <span className="font-mono">{formatPHP(result.grossIncomeFromOperations)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Less: Operating Expenses</span>
                <span className="font-mono font-medium text-amber-700">
                  -{formatPHP(result.operatingExpenses, false)}
                </span>
              </div>

              <div className="flex justify-between text-slate-900 font-semibold pt-2 border-t border-slate-200">
                <span>Net Taxable Income</span>
                <span className="font-mono">{formatPHP(result.netTaxableIncome)}</span>
              </div>

              {/* Rate Comparison Details */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>NCIT ({data.rateOption === 'msme_20' ? '20%' : '25%'})</span>
                  <span className="font-mono font-medium">{formatPHP(result.ncitTaxDue)}</span>
                </div>
                {data.isMCOptional && (
                  <div className="flex justify-between">
                    <span>MCIT (2% of Gross Income)</span>
                    <span className="font-mono font-medium">{formatPHP(result.mcitTaxDue)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-blue-700 pt-1 border-t border-slate-100">
                  <span>Applied Scheme</span>
                  <span>{result.appliedTaxType}</span>
                </div>
              </div>

              <div className="flex justify-between text-slate-700 pt-1">
                <span>Total Tax Due</span>
                <span className="font-mono font-semibold">{formatPHP(result.taxDue)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Less: Total Tax Credits</span>
                <span className="font-mono font-medium text-emerald-700">
                  -{formatPHP(result.totalTaxCredits, false)}
                </span>
              </div>

              {/* Net Payable Banner */}
              <div
                className={`p-4 rounded-xl mt-4 border ${
                  result.isOverpayment
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                }`}
              >
                <div className="text-xs uppercase tracking-wider font-semibold opacity-80">
                  {result.isOverpayment ? 'Excess Corporate Credit' : 'Net Tax Payable (To BIR)'}
                </div>
                <div className="text-2xl font-bold font-mono mt-1">
                  {formatPHP(Math.abs(result.netTaxPayable))}
                </div>
                <div className="text-xs mt-1 text-slate-500">
                  {result.isOverpayment ? 'Carry-over / Refundable' : 'Payable via eFPS or Authorized Agent Bank'}
                </div>
              </div>

              {/* Save Button under Net Tax Payable */}
              <div className="pt-2">
                <button
                  type="button"
                  id="save-quarter-data-1702q-btn"
                  onClick={handleSaveQuarterData}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer"
                >
                  {saveSuccessMessage ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-blue-200 animate-in zoom-in-50" />
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
                  <div className="text-[11px] text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-2 mt-2 text-center flex items-center justify-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
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
        basicTaxDue={result.netTaxPayable}
        formName={`BIR Form 1702Q (${quarter} ${year})`}
      />
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Data2551Q, ClientProfile, Quarter } from '../types/tax';
import { calculate2551Q } from '../utils/taxCalculations';
import { formatPHP, parseNumber } from '../utils/formatters';
import { AlertTriangle, Download, BookOpen, TrendingUp, Save, CheckCircle2 } from 'lucide-react';
import { PenaltiesModal } from './PenaltiesModal';
import { BranchVatSchedule } from './BranchVatSchedule';
import { EoptSalesGuideModal } from './EoptSalesGuideModal';
import { IncomeForecasting2551Q } from './IncomeForecasting2551Q';
import { downloadBirSlspExcelTemplate } from '../utils/excelVatTemplate';

interface Form2551QViewProps {
  client: ClientProfile;
  quarter: Quarter;
  year: number;
  data: Data2551Q;
  onChange: (updated: Data2551Q) => void;
}

export const Form2551QView: React.FC<Form2551QViewProps> = ({
  client,
  quarter,
  year,
  data,
  onChange,
}) => {
  const [showPenalties, setShowPenalties] = useState(false);
  const [showEoptModal, setShowEoptModal] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  const explicitQuarterKey = `bir_saved_2551q_${client.id}_${year}_${quarter}`;

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
      console.error('Failed to save 2551Q quarter data', e);
    }

    setLastSavedTime(timestamp);
    setSaveSuccessMessage(true);
    setTimeout(() => setSaveSuccessMessage(false), 4000);
  };

  const result = calculate2551Q(data);

  const updateField = (field: keyof Data2551Q, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const handleSyncFromBranchSchedule = (totals: {
    grossSales: number;
    exemptSales: number;
    vatableSales?: number;
    salesToGovernment?: number;
    zeroRatedSales?: number;
    vatExemptSales?: number;
  }) => {
    onChange({
      ...data,
      grossSalesCurrentQuarter: totals.grossSales,
      exemptSales: totals.exemptSales,
      vatableSales: totals.vatableSales !== undefined ? totals.vatableSales : Math.max(0, totals.grossSales - totals.exemptSales),
      salesToGovernment: totals.salesToGovernment || 0,
      zeroRatedSales: totals.zeroRatedSales || 0,
      vatExemptSales: totals.vatExemptSales !== undefined ? totals.vatExemptSales : totals.exemptSales,
    });
  };

  const updateSalesComponent = (field: 'vatableSales' | 'salesToGovernment' | 'zeroRatedSales' | 'vatExemptSales', val: number) => {
    const curVatable = field === 'vatableSales' ? val : (data.vatableSales ?? Math.max(0, (data.grossSalesCurrentQuarter || 0) - (data.exemptSales || 0)));
    const curGov = field === 'salesToGovernment' ? val : (data.salesToGovernment || 0);
    const curZero = field === 'zeroRatedSales' ? val : (data.zeroRatedSales || 0);
    const curExempt = field === 'vatExemptSales' ? val : (data.vatExemptSales ?? data.exemptSales ?? 0);
    const newCombined = curVatable + curGov + curZero + curExempt;

    onChange({
      ...data,
      [field]: val,
      grossSalesCurrentQuarter: newCombined,
      exemptSales: curExempt + curZero,
    });
  };

  const handleDownloadTemplate = () => {
    downloadBirSlspExcelTemplate({
      type: 'Sales',
      quarter,
      monthLabel: '1st Month',
      client,
      includeSampleRow: false,
      formType: '2551Q',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold bg-amber-600 text-white rounded">
              BIR Form 2551Q
            </span>
            <span className="text-xs text-slate-300 font-mono">
              {quarter} {year} • Quarterly Percentage Tax Return (Non-VAT)
            </span>
          </div>
          <h2 className="text-base font-semibold mt-1">{client.tradeName}</h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="download-2551q-template-btn"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors shadow-xs"
            title="Download formatted BIR SLSP Excel template (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Download Template</span>
          </button>

          <button
            id="open-penalties-2551q-btn"
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
        formType="2551Q"
        onSync2551Q={handleSyncFromBranchSchedule}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-5">
            {/* Taxable Sales Header with eOPT Law button right beside the text */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Taxable Sales & Applicable Percentage Tax Code
              </div>
              <button
                type="button"
                id="eopt-guidelines-btn"
                onClick={() => setShowEoptModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 border border-amber-300 rounded-lg transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                title="Open instructions based on eOPT law on what includes as Gross Sales and what Sales are exempt, and other key details"
              >
                <BookOpen className="w-4 h-4 text-amber-800" />
                <span>eOPT Law Instructions & Exemptions (RA 11976)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  ATC Code
                </label>
                <select
                  id="atc-code-2551q"
                  value={data.atcCode}
                  onChange={(e) => updateField('atcCode', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value="PT010">PT010 - Persons Exempt from VAT (Sec. 116)</option>
                  <option value="PT040">PT040 - Domestic Carriers & Keepers of Garages</option>
                  <option value="PT060">PT060 - Franchise Holders</option>
                  <option value="OTHER">OTHER - Other Percentage Tax</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Tax Rate (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="rate-percent-2551q"
                    type="number"
                    step="0.1"
                    value={data.taxRatePercent}
                    onChange={(e) => updateField('taxRatePercent', parseNumber(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-slate-600">%</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Standard Tax Code Sec. 116 rate is 3%
                </span>
              </div>
            </div>

            {/* Income Forecasting Graph / Table directly above Sales in the Quarter */}
            <div className="pt-2">
              <IncomeForecasting2551Q
                client={client}
                currentQuarter={quarter}
                year={year}
                currentQuarterData={data}
                onApplyQuarterGrossSales={(q, gross, exempt) => {
                  onChange({
                    ...data,
                    grossSalesCurrentQuarter: gross,
                    ...(typeof exempt === 'number' ? { exemptSales: exempt } : {}),
                  });
                }}
              />
            </div>

            {/* Sales in the Quarter */}
            <div className="pt-4 space-y-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Sales in the Quarter (Schedule 1 Breakdown)
                </div>
                <span className="text-[11px] text-slate-400">
                  Current Quarter ({quarter} {year}) Return Entry
                </span>
              </div>

              {/* Combined Gross Sales Highlight */}
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                    Combined Gross Sales / Receipts
                  </div>
                  <div className="text-[11px] text-amber-700">
                    Sum of Taxable, Govt, Zero-Rated, and Exempt Sales
                  </div>
                </div>
                <div className="text-base font-mono font-bold text-amber-950 text-right">
                  {formatPHP(result.grossSales)}
                </div>
              </div>

              {/* 1. Vatable / Taxable Sales */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-sm text-slate-700 font-medium">
                    Vatable Sales / Subject to PT ({data.taxRatePercent}%)
                  </label>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="vatable-sales-2551q"
                    type="number"
                    value={data.vatableSales !== undefined ? (data.vatableSales || '') : (result.taxableSales || '')}
                    onChange={(e) => updateSalesComponent('vatableSales', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* 2. Sales to Government */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-sm text-slate-700 font-medium">Sales to Government</label>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="govt-sales-2551q"
                    type="number"
                    value={data.salesToGovernment !== undefined ? (data.salesToGovernment || '') : ''}
                    onChange={(e) => updateSalesComponent('salesToGovernment', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* 3. Zero-Rated Sales */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-sm text-slate-700 font-medium">Zero-Rated Sales (0%)</label>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="zero-rated-2551q"
                    type="number"
                    value={data.zeroRatedSales !== undefined ? (data.zeroRatedSales || '') : ''}
                    onChange={(e) => updateSalesComponent('zeroRatedSales', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* 4. VAT-Exempt Sales */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-sm text-slate-700 font-medium">VAT-Exempt Sales / Receipts</label>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="exempt-sales-2551q"
                    type="number"
                    value={data.vatExemptSales !== undefined ? (data.vatExemptSales || '') : (data.exemptSales || '')}
                    onChange={(e) => updateSalesComponent('vatExemptSales', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
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
                  <div className="text-sm text-slate-700">Form 2307 Creditable Percentage Tax Withheld</div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="cwt2307-2551q"
                    type="number"
                    value={data.cwt2307Credits || ''}
                    onChange={(e) => updateField('cwt2307Credits', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Prior Payments Made for This Quarter</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="prior-payments-2551q"
                    type="number"
                    value={data.priorQuarterTaxPaid || ''}
                    onChange={(e) => updateField('priorQuarterTaxPaid', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Computation Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 sticky top-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                2551Q Percentage Tax Breakdown
              </div>
              <span className="text-xs font-mono text-slate-500">Auto-Computed</span>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Gross Sales / Receipts</span>
                <span className="font-mono font-medium">{formatPHP(result.grossSales)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Less: Exempt Sales</span>
                <span className="font-mono font-medium text-amber-700">
                  -{formatPHP(result.exemptSales, false)}
                </span>
              </div>
              <div className="flex justify-between text-slate-900 font-semibold pt-1 border-t border-slate-200">
                <span>Taxable Base Sales</span>
                <span className="font-mono">{formatPHP(result.taxableSales)}</span>
              </div>

              <div className="flex justify-between text-slate-700">
                <span>Percentage Tax Due ({result.taxRatePercent}%)</span>
                <span className="font-mono font-semibold">{formatPHP(result.taxDue)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Less: Form 2307 Tax Credits</span>
                <span className="font-mono font-medium text-emerald-700">
                  -{formatPHP(result.totalTaxCredits, false)}
                </span>
              </div>

              {/* Net Payable Banner */}
              <div
                className={`p-4 rounded-xl mt-4 border ${
                  result.isOverpayment
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                }`}
              >
                <div className="text-xs uppercase tracking-wider font-semibold opacity-80">
                  {result.isOverpayment ? 'Excess Tax Credit' : 'Net Tax Payable (To BIR)'}
                </div>
                <div className="text-2xl font-bold font-mono mt-1">
                  {formatPHP(Math.abs(result.netPercentageTaxPayable))}
                </div>
                <div className="text-xs mt-1 text-slate-500">
                  {result.isOverpayment
                    ? 'Excess creditable withholding percentage tax'
                    : 'Payable on or before the 25th day following close of quarter'}
                </div>
              </div>

              {/* Save Button under Net Tax Payable */}
              <div className="pt-2">
                <button
                  type="button"
                  id="save-quarter-data-2551q-btn"
                  onClick={handleSaveQuarterData}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-sm rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer"
                >
                  {saveSuccessMessage ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-amber-200 animate-in zoom-in-50" />
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
                  <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2 text-center flex items-center justify-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
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
        basicTaxDue={result.netPercentageTaxPayable}
        formName={`BIR Form 2551Q (${quarter} ${year})`}
      />

      <EoptSalesGuideModal
        isOpen={showEoptModal}
        onClose={() => setShowEoptModal(false)}
      />
    </div>
  );
};

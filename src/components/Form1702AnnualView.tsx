import React, { useState, useEffect } from 'react';
import { Data1702Annual, ClientProfile, ExpenseAccountItem } from '../types/tax';
import { SawtSummary } from '../types/sawt';
import { calculate1702Annual } from '../utils/taxCalculations';
import { formatPHP, parseNumber } from '../utils/formatters';
import {
  Building2,
  AlertTriangle,
  Sparkles,
  Save,
  CheckCircle2,
  Layers,
  HelpCircle,
  ListPlus,
  ShoppingBag,
  FileSpreadsheet,
  RotateCcw,
} from 'lucide-react';
import { PenaltiesModal } from './PenaltiesModal';
import { ExpenseBreakdownModal } from './ExpenseBreakdownModal';
import { ComparativeFinancialStatements } from './ComparativeFinancialStatements';
import { ConsolidatedAnnualPurchasesModal } from './ConsolidatedAnnualPurchasesModal';
import { SawtUploadModal } from './SawtUploadModal';
import { AccountingInput } from './AccountingInput';

interface Form1702AnnualViewProps {
  client: ClientProfile;
  year: number;
  data: Data1702Annual;
  onChange: (updated: Data1702Annual) => void;
  onAutoPullQuarters?: () => void;
  quartersDataSummary?: {
    q1Sales: number;
    q2Sales: number;
    q3Sales: number;
    q4Sales: number;
    q1TaxPaid: number;
    q2TaxPaid: number;
    q3TaxPaid: number;
    totalCwt: number;
    sourceForm?: string;
    totalSales?: number;
  };
  allYearsData?: Record<number, Data1702Annual>;
  onUpdateHistoricalYear?: (year: number, data: Data1702Annual) => void;
}

export const Form1702AnnualView: React.FC<Form1702AnnualViewProps> = ({
  client,
  year,
  data,
  onChange,
  onAutoPullQuarters,
  quartersDataSummary,
  allYearsData,
  onUpdateHistoricalYear,
}) => {
  const [showPenalties, setShowPenalties] = useState(false);
  const [showPurchasesModal, setShowPurchasesModal] = useState(false);
  const [showSawtModal, setShowSawtModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [pullStatus, setPullStatus] = useState<string | null>(null);
  const [breakdownTarget, setBreakdownTarget] = useState<'cogs' | 'itemized' | null>(null);

  // SAWT state persisted per client & tax year
  const [sawtSummary, setSawtSummary] = useState<SawtSummary | null>(() => {
    try {
      const saved = localStorage.getItem(`bir_sawt_${client.id}_${year}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Re-read SAWT when client or year changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`bir_sawt_${client.id}_${year}`);
      setSawtSummary(saved ? JSON.parse(saved) : null);
    } catch {
      setSawtSummary(null);
    }
  }, [client.id, year]);

  // Automatically reflect 1702Q quarterly payments if client has paid in 1702Q, otherwise reflect 0
  useEffect(() => {
    if (!quartersDataSummary) return;
    const q1 = quartersDataSummary.q1TaxPaid ?? 0;
    const q2 = quartersDataSummary.q2TaxPaid ?? 0;
    const q3 = quartersDataSummary.q3TaxPaid ?? 0;

    if (
      (data.quarterlyTaxPaidQ1 ?? 0) !== q1 ||
      (data.quarterlyTaxPaidQ2 ?? 0) !== q2 ||
      (data.quarterlyTaxPaidQ3 ?? 0) !== q3
    ) {
      onChange({
        ...data,
        quarterlyTaxPaidQ1: q1,
        quarterlyTaxPaidQ2: q2,
        quarterlyTaxPaidQ3: q3,
      });
    }
  }, [
    quartersDataSummary?.q1TaxPaid,
    quartersDataSummary?.q2TaxPaid,
    quartersDataSummary?.q3TaxPaid,
  ]);

  const handleSync1702QPayments = () => {
    if (!quartersDataSummary) return;
    const q1 = quartersDataSummary.q1TaxPaid ?? 0;
    const q2 = quartersDataSummary.q2TaxPaid ?? 0;
    const q3 = quartersDataSummary.q3TaxPaid ?? 0;
    onChange({
      ...data,
      quarterlyTaxPaidQ1: q1,
      quarterlyTaxPaidQ2: q2,
      quarterlyTaxPaidQ3: q3,
    });
    setPullStatus('Quarterly payments re-synced from Form 1702Q!');
    setTimeout(() => setPullStatus(null), 3000);
  };

  const handleApplySawtCwt = (totalCwt: number, summary: SawtSummary) => {
    setSawtSummary(summary);
    try {
      localStorage.setItem(`bir_sawt_${client.id}_${year}`, JSON.stringify(summary));
    } catch (e) {
      console.error('Failed to cache SAWT data', e);
    }
    updateField('cwt2307Credits', totalCwt);
    setPullStatus(`Form 2307 CWT updated to ₱${formatPHP(totalCwt, false)} from SAWT Excel!`);
    setTimeout(() => setPullStatus(null), 3500);
  };

  const handleClearSawt = () => {
    setSawtSummary(null);
    try {
      localStorage.removeItem(`bir_sawt_${client.id}_${year}`);
    } catch {}
  };

  const result = calculate1702Annual(data);

  const updateField = (field: keyof Data1702Annual, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const handleSave = () => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSaveStatus(`Saved at ${timestamp}`);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleConsolidateClick = () => {
    if (onAutoPullQuarters) {
      onAutoPullQuarters();
      const formSrc =
        quartersDataSummary?.sourceForm ||
        (client.vatStatus === 'vat-registered' ? '2550Q' : '2551Q');
      setPullStatus(`Consolidated from ${formSrc}!`);
      setTimeout(() => setPullStatus(null), 3500);
    }
  };

  const hasQuarterData =
    quartersDataSummary &&
    (quartersDataSummary.q1Sales > 0 ||
      quartersDataSummary.q2Sales > 0 ||
      quartersDataSummary.q3Sales > 0 ||
      quartersDataSummary.q4Sales > 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 text-xs font-bold bg-blue-600 text-white rounded">
              BIR Form 1702-RT
            </span>
            <span className="text-xs text-slate-300 font-mono">
              Taxable Year {year} • Annual Income Tax Return for Corporation / Partnership
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded">
              Due on or before April 15, {year + 1}
            </span>
          </div>
          <h2 className="text-base font-semibold mt-1 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            {client.registeredName} ({client.tin})
          </h2>
        </div>

        {/* Action Buttons Layout: Top Row (Consolidate Q1-Q4, Late Penalties) & Bottom Row (Save TY Data, Consolidated Purchases right beside it and under Late Penalties) */}
        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {onAutoPullQuarters && (
              <button
                id="auto-pull-quarters-1702-btn"
                type="button"
                onClick={handleConsolidateClick}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
                title={`Consolidate Q1-Q4 Combined Sales from ${
                  quartersDataSummary?.sourceForm || (client.vatStatus === 'vat-registered' ? '2550Q' : '2551Q')
                } into Gross Sales`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{pullStatus || 'Consolidate Q1-Q4'}</span>
              </button>
            )}

            <button
              id="open-penalties-1702-btn"
              type="button"
              onClick={() => setShowPenalties(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Late Penalties</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              id="save-1702-annual-btn"
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              {saveStatus ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saveStatus || `Save TY ${year} Data`}</span>
            </button>

            {/* Only show Consolidated Purchases for VAT-registered taxpayers. Non-VAT taxpayers do not submit list of purchases */}
            {client.vatStatus === 'vat-registered' && (
              <button
                id="open-consolidated-purchases-1702-btn"
                type="button"
                onClick={() => setShowPurchasesModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-xs border border-indigo-400/30 cursor-pointer"
                title="Consolidated list of Purchases from different Quarters (combined by Registered Name)"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-indigo-200" />
                <span>Consolidated Purchases</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quarters auto-sync indicator */}
      {hasQuarterData && quartersDataSummary && (
        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-blue-950">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <strong className="font-semibold">
                Quarterly Sales from {quartersDataSummary.sourceForm || (client.vatStatus === 'vat-registered' ? '2550Q' : '2551Q')}:{' '}
              </strong>
              <span>
                Q1: {formatPHP(quartersDataSummary.q1Sales, false)} • Q2: {formatPHP(quartersDataSummary.q2Sales, false)} • Q3: {formatPHP(quartersDataSummary.q3Sales, false)} • Q4: {formatPHP(quartersDataSummary.q4Sales, false)}
                {' '}(Total: {formatPHP(quartersDataSummary.q1Sales + quartersDataSummary.q2Sales + quartersDataSummary.q3Sales + quartersDataSummary.q4Sales, false)})
              </span>
            </div>
          </div>
          {onAutoPullQuarters && (
            <button
              type="button"
              onClick={handleConsolidateClick}
              className="text-blue-700 hover:text-blue-950 font-semibold underline underline-offset-2 shrink-0 cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Consolidate into 1702 Gross Sales</span>
            </button>
          )}
        </div>
      )}

      {/* Comparative Financial Statements & Trends (Multi-Year Statement Navigator & Analytics Chart) */}
      <ComparativeFinancialStatements
        currentYear={year}
        currentData={data}
        allYearsData={allYearsData}
        onUpdateHistoricalYear={onUpdateHistoricalYear}
        client={client}
      />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {/* Part I: Corporate Tax Rates & Method */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Part I: Corporate Tax Options & Method
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tax Rate (CREATE Act)
                </label>
                <select
                  id="corp-tax-rate-annual"
                  value={data.rateOption}
                  onChange={(e) => updateField('rateOption', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="regular_25">Regular Corporate (25%)</option>
                  <option value="msme_20">Domestic MSME (20%)</option>
                </select>
                <div className="text-[10px] text-slate-400 mt-1">
                  20% if net income &le; ₱5M & assets &le; ₱100M
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Allowable Deduction Method
                </label>
                <select
                  id="corp-deduction-method-annual"
                  value={data.deductionMethod}
                  onChange={(e) => updateField('deductionMethod', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="itemized">Itemized Deductions</option>
                  <option value="osd">Optional Standard Deduction (40% Gross Income)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  MCIT (2%) Applicability
                </label>
                <div className="flex items-center gap-2 pt-2">
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      id="corp-mcit-toggle-annual"
                      type="checkbox"
                      checked={data.isMCOptional}
                      onChange={(e) => updateField('isMCOptional', e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>Subject to 2% MCIT (after 4th year)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Part II: Computation of Gross Income */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Part II: Sales, Cost of Sales & Total Gross Income
              </div>
              <span className="text-xs font-mono text-slate-400">Full Year (TY {year})</span>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-800">
                    Gross Sales / Revenues / Receipts / Fees
                  </label>
                  <div className="text-[11px] text-slate-500">
                    Annual total from operational activities across 4 quarters
                  </div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <AccountingInput
                    id="gross-sales-1702-annual"
                    value={data.grossSales}
                    onChange={(val) => updateField('grossSales', val)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-700">
                    Less: Sales Returns, Allowances & Discounts
                  </label>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <AccountingInput
                    id="sales-returns-1702-annual"
                    value={data.salesReturnsDiscounts}
                    onChange={(val) => updateField('salesReturnsDiscounts', val)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs font-medium text-slate-700">
                      Cost of Goods Sold / Cost of Services
                    </label>
                    <button
                      id="btn-breakdown-cogs-1702"
                      type="button"
                      onClick={() => setBreakdownTarget('cogs')}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer"
                      title="Itemize and enter different expense accounts that compose Cost of Goods Sold"
                    >
                      <ListPlus className="w-3 h-3" />
                      <span>Itemize Accounts</span>
                      {data.costOfSalesBreakdown && data.costOfSalesBreakdown.length > 0 && (
                        <span className="ml-0.5 px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[9px] font-mono">
                          {data.costOfSalesBreakdown.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <AccountingInput
                    id="cost-sales-1702-annual"
                    value={data.costOfSales}
                    onChange={(val) => updateField('costOfSales', val)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-700">
                    Non-Operating & Other Taxable Income
                  </label>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <AccountingInput
                    id="non-op-1702-annual"
                    value={data.nonOperatingIncome}
                    onChange={(val) => updateField('nonOperatingIncome', val)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              {/* Deductions: OSD or Itemized */}
              {data.deductionMethod === 'itemized' ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="text-xs font-medium text-slate-700">
                        Ordinary Allowable Itemized Deductions
                      </label>
                      <button
                        id="btn-breakdown-deductions-1702"
                        type="button"
                        onClick={() => setBreakdownTarget('itemized')}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer"
                        title="Itemize and enter different expense accounts that compose Ordinary Allowable Itemized Deductions"
                      >
                        <ListPlus className="w-3 h-3" />
                        <span>Itemize Accounts</span>
                        {data.itemizedDeductionsBreakdown && data.itemizedDeductionsBreakdown.length > 0 && (
                          <span className="ml-0.5 px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[9px] font-mono">
                            {data.itemizedDeductionsBreakdown.length}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="relative w-full sm:w-60">
                    <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                    <AccountingInput
                      id="operating-expenses-1702-annual"
                      value={data.operatingExpenses}
                      onChange={(val) => updateField('operatingExpenses', val)}
                      placeholder="0.00"
                      className="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex justify-between items-center text-slate-700">
                  <div>
                    <span className="font-semibold">Corporate OSD (40%):</span>
                    <span className="text-slate-500 ml-1.5">
                      40% of Total Gross Income ₱{formatPHP(result.totalGrossIncome, false)} (Sec. 34(L))
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-900">
                    {formatPHP(result.allowableDeductions)}
                  </span>
                </div>
              )}

              {/* Part II Accounting Subtotals */}
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-slate-50/70 p-3 rounded-lg font-mono">
                <div className="flex items-center gap-2">
                  <span className="font-sans font-semibold text-slate-700">Part II Net Sales:</span>
                  <span className="font-bold text-slate-900">
                    ₱{formatPHP(result.netSales || 0, false)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-sans font-semibold text-slate-700">Part II Total Gross Income:</span>
                  <span className="font-bold text-blue-700">
                    ₱{formatPHP(result.totalGrossIncome || 0, false)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Part III: Tax Relief / Credits & Prior Quarterly Payments */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2 gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Part III: Tax Credits, Quarterly Payments (Form 1702Q) & 2307
                </span>
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-blue-600" />
                  1702Q Auto-Reflected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="open-sawt-upload-modal-btn"
                  onClick={() => setShowSawtModal(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
                  title="Upload SAWT Excel file to automatically calculate Form 2307 CWT (Full Year)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{sawtSummary ? 'SAWT Excel (Linked)' : 'Upload SAWT Excel'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSync1702QPayments}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  title="Force re-sync quarterly payments directly from Form 1702Q"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Re-sync 1702Q</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Q1 Tax Paid (Form 1702Q)
                  </label>
                  {quartersDataSummary && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                        quartersDataSummary.q1TaxPaid > 0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                      title={
                        quartersDataSummary.q1TaxPaid > 0
                          ? 'Reflected automatically from client Form 1702Q Q1 return'
                          : 'No tax payment in Form 1702Q Q1 (defaulted to 0)'
                      }
                    >
                      {quartersDataSummary.q1TaxPaid > 0
                        ? `Paid: ₱${formatPHP(quartersDataSummary.q1TaxPaid, false)}`
                        : '1702Q: ₱0.00'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <AccountingInput
                    id="corp-q1-paid"
                    value={data.quarterlyTaxPaidQ1 ?? 0}
                    onChange={(val) => updateField('quarterlyTaxPaidQ1', val)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Q2 Tax Paid (Form 1702Q)
                  </label>
                  {quartersDataSummary && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                        quartersDataSummary.q2TaxPaid > 0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                      title={
                        quartersDataSummary.q2TaxPaid > 0
                          ? 'Reflected automatically from client Form 1702Q Q2 return'
                          : 'No tax payment in Form 1702Q Q2 (defaulted to 0)'
                      }
                    >
                      {quartersDataSummary.q2TaxPaid > 0
                        ? `Paid: ₱${formatPHP(quartersDataSummary.q2TaxPaid, false)}`
                        : '1702Q: ₱0.00'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <AccountingInput
                    id="corp-q2-paid"
                    value={data.quarterlyTaxPaidQ2 ?? 0}
                    onChange={(val) => updateField('quarterlyTaxPaidQ2', val)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Q3 Tax Paid (Form 1702Q)
                  </label>
                  {quartersDataSummary && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                        quartersDataSummary.q3TaxPaid > 0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                      title={
                        quartersDataSummary.q3TaxPaid > 0
                          ? 'Reflected automatically from client Form 1702Q Q3 return'
                          : 'No tax payment in Form 1702Q Q3 (defaulted to 0)'
                      }
                    >
                      {quartersDataSummary.q3TaxPaid > 0
                        ? `Paid: ₱${formatPHP(quartersDataSummary.q3TaxPaid, false)}`
                        : '1702Q: ₱0.00'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <AccountingInput
                    id="corp-q3-paid"
                    value={data.quarterlyTaxPaidQ3 ?? 0}
                    onChange={(val) => updateField('quarterlyTaxPaidQ3', val)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Prior Year's Excess Credits
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <AccountingInput
                    id="corp-prior-excess"
                    value={data.priorYearExcessCredits}
                    onChange={(val) => updateField('priorYearExcessCredits', val)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Form 2307 CWT (Full Year)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <AccountingInput
                    id="corp-cwt-credits"
                    value={data.cwt2307Credits}
                    onChange={(val) => updateField('cwt2307Credits', val)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                {sawtSummary ? (
                  <div className="flex items-center justify-between text-[10px] text-emerald-700 mt-1">
                    <span className="flex items-center gap-1 font-medium truncate max-w-[140px]" title={sawtSummary.fileName}>
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      {sawtSummary.records.length} payor(s)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSawtModal(true)}
                      className="underline hover:text-emerald-900 cursor-pointer shrink-0 font-medium"
                    >
                      View SAWT
                    </button>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400 mt-1">
                    Direct entry
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Prior Excess MCIT Carried Over
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <AccountingInput
                    id="corp-mcit-credits"
                    value={data.excessMCITPriorYears}
                    onChange={(val) => updateField('excessMCITPriorYears', val)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Other Tax Credits
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <AccountingInput
                    id="corp-other-credits"
                    value={data.otherTaxCredits}
                    onChange={(val) => updateField('otherTaxCredits', val)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Part III Total Credits Accounting Summary */}
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-blue-50/60 p-3 rounded-lg border border-blue-100 font-mono">
              <span className="font-sans font-bold uppercase tracking-wider text-blue-900 text-[11px]">
                Total Part III Tax Credits & Payments:
              </span>
              <span className="font-bold text-sm text-blue-700">
                ₱{formatPHP(result.totalTaxCredits || 0, false)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Summary Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 sticky top-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Corporate Tax Due & Summary
              </div>
              <span className="text-xs font-mono text-blue-700 font-semibold">TY {year}</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Net Sales:</span>
                <span className="font-mono font-medium">{formatPHP(result.netSales)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Gross Income from Operations:</span>
                <span className="font-mono font-medium">{formatPHP(result.grossIncomeFromOperations)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Allowable Deductions:</span>
                <span className="font-mono text-emerald-700">-{formatPHP(result.allowableDeductions, false)}</span>
              </div>

              <div className="flex justify-between font-semibold text-slate-800 border-t border-slate-200 pt-1.5">
                <span>Net Taxable Income:</span>
                <span className="font-mono">{formatPHP(result.netTaxableIncome)}</span>
              </div>

              {/* Tax rate calculation breakdown */}
              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>RCIT ({data.rateOption === 'msme_20' ? '20%' : '25%'}):</span>
                  <span className="font-mono">{formatPHP(result.ncitTaxDue)}</span>
                </div>
                {data.isMCOptional && (
                  <div className="flex justify-between">
                    <span>MCIT (2% Gross Income):</span>
                    <span className="font-mono">{formatPHP(result.mcitTaxDue)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 font-bold border-t border-slate-100 pt-1">
                  <span>Applied Tax ({result.appliedTaxType}):</span>
                  <span className="font-mono text-blue-700">{formatPHP(result.taxDue)}</span>
                </div>
              </div>

              {/* Credits */}
              <div className="pt-2 border-t border-slate-200 space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Quarterly Paid (Q1-Q3 1702Q):</span>
                  <span className="font-mono text-emerald-700">
                    -{formatPHP(result.quarterlyTaxPayments, false)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Withholding 2307 & Others:</span>
                  <span className="font-mono text-emerald-700">
                    -{formatPHP(result.totalTaxCredits - result.quarterlyTaxPayments, false)}
                  </span>
                </div>
              </div>

              {/* Net Payable / Overpayment Box */}
              <div
                className={`p-4 rounded-xl mt-3 border ${
                  result.isOverpayment
                    ? 'bg-amber-50 border-amber-200 text-amber-950'
                    : 'bg-blue-50 border-blue-200 text-blue-950'
                }`}
              >
                <div className="text-xs uppercase tracking-wider font-semibold opacity-80">
                  {result.isOverpayment ? 'Excess Corporate Tax Credit' : 'Net Annual Corporate Tax Payable'}
                </div>
                <div className="text-2xl font-bold font-mono mt-1">
                  {formatPHP(Math.abs(result.netTaxPayable))}
                </div>
                <div className="text-[11px] mt-1 text-slate-500">
                  {result.isOverpayment
                    ? 'Eligible to carry over as tax credit for next taxable year'
                    : `Filing deadline: On or before April 15, ${year + 1}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PenaltiesModal
        isOpen={showPenalties}
        onClose={() => setShowPenalties(false)}
        basicTaxDue={result.netTaxPayable}
        formName={`BIR Form 1702-RT Annual (${year})`}
      />

      {/* Expense Accounts Itemization Modal for COGS and Itemized Deductions */}
      <ExpenseBreakdownModal
        isOpen={breakdownTarget !== null}
        onClose={() => setBreakdownTarget(null)}
        title={
          breakdownTarget === 'cogs'
            ? 'Cost of Goods Sold / Cost of Services Itemization'
            : 'Ordinary Allowable Itemized Deductions (Schedule 6)'
        }
        type={breakdownTarget || 'cogs'}
        currentAmount={
          breakdownTarget === 'cogs'
            ? data.costOfSales || 0
            : data.operatingExpenses || 0
        }
        initialItems={
          breakdownTarget === 'cogs'
            ? data.costOfSalesBreakdown || []
            : data.itemizedDeductionsBreakdown || []
        }
        onApply={(items, total) => {
          if (breakdownTarget === 'cogs') {
            onChange({
              ...data,
              costOfSales: total,
              costOfSalesBreakdown: items,
            });
          } else if (breakdownTarget === 'itemized') {
            onChange({
              ...data,
              operatingExpenses: total,
              itemizedDeductionsBreakdown: items,
            });
          }
        }}
      />

      {/* Consolidated Annual Purchases Modal (Quarterly Purchases combined by Registered Name) - Only for VAT-registered taxpayers */}
      {client.vatStatus === 'vat-registered' && (
        <ConsolidatedAnnualPurchasesModal
          isOpen={showPurchasesModal}
          onClose={() => setShowPurchasesModal(false)}
          client={client}
          year={year}
          onApplyToDeductions={(cogsTotal, opexTotal, cogsBreakdown, opexBreakdown) => {
            onChange({
              ...data,
              costOfSales: cogsTotal,
              operatingExpenses: opexTotal,
              costOfSalesBreakdown: cogsBreakdown,
              itemizedDeductionsBreakdown: opexBreakdown,
            });
          }}
        />
      )}

      {/* SAWT Form 2307 CWT Upload & Calculation Modal */}
      <SawtUploadModal
        isOpen={showSawtModal}
        onClose={() => setShowSawtModal(false)}
        client={client}
        year={year}
        currentCwtValue={data.cwt2307Credits || 0}
        existingSummary={sawtSummary}
        onApplyCwt={handleApplySawtCwt}
        onClearSummary={handleClearSawt}
      />
    </div>
  );
};

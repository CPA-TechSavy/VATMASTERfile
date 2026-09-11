import React, { useState } from 'react';
import { Data1701Annual, ClientProfile } from '../types/tax';
import { calculate1701Annual } from '../utils/taxCalculations';
import { formatPHP, parseNumber } from '../utils/formatters';
import {
  FileText,
  AlertTriangle,
  Sparkles,
  Save,
  CheckCircle2,
  Calendar,
  Layers,
  HelpCircle,
  ListPlus,
  ShoppingBag,
} from 'lucide-react';
import { PenaltiesModal } from './PenaltiesModal';
import { ExpenseBreakdownModal } from './ExpenseBreakdownModal';
import { ComparativeFinancialStatements } from './ComparativeFinancialStatements';
import { ConsolidatedAnnualPurchasesModal } from './ConsolidatedAnnualPurchasesModal';

interface Form1701AnnualViewProps {
  client: ClientProfile;
  year: number;
  data: Data1701Annual;
  onChange: (updated: Data1701Annual) => void;
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
  allYearsData?: Record<number, Data1701Annual>;
  onUpdateHistoricalYear?: (year: number, data: Data1701Annual) => void;
}

export const Form1701AnnualView: React.FC<Form1701AnnualViewProps> = ({
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
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [pullStatus, setPullStatus] = useState<string | null>(null);
  const [breakdownTarget, setBreakdownTarget] = useState<'cogs' | 'itemized' | null>(null);

  const result = calculate1701Annual(data);

  const updateField = (field: keyof Data1701Annual, value: any) => {
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
            <span className="px-2 py-0.5 text-xs font-bold bg-indigo-600 text-white rounded">
              BIR Form 1701 / 1701A
            </span>
            <span className="text-xs text-slate-300 font-mono">
              Taxable Year {year} • Annual Income Tax Return (Individuals / Single Proprietorship)
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded">
              Due on or before April 15, {year + 1}
            </span>
          </div>
          <h2 className="text-base font-semibold mt-1 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            {client.registeredName} ({client.tin})
          </h2>
        </div>

        {/* Action Buttons Layout: Top Row (Consolidate Q1-Q4, Late Penalties) & Bottom Row (Save TY Data, Consolidated Purchases right beside it and under Late Penalties) */}
        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {onAutoPullQuarters && (
              <button
                id="auto-pull-quarters-1701-btn"
                type="button"
                onClick={handleConsolidateClick}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
                title={`Consolidate Q1-Q4 Combined Sales from ${
                  quartersDataSummary?.sourceForm || (client.vatStatus === 'vat-registered' ? '2550Q' : '2551Q')
                } into Gross Sales`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{pullStatus || 'Consolidate Q1-Q4'}</span>
              </button>
            )}

            <button
              id="open-penalties-1701-btn"
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
              id="save-1701-annual-btn"
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              {saveStatus ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saveStatus || `Save TY ${year} Data`}</span>
            </button>

            <button
              id="open-consolidated-purchases-1701-btn"
              type="button"
              onClick={() => setShowPurchasesModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-xs border border-indigo-400/30 cursor-pointer"
              title="Consolidated list of Purchases from different Quarters (combined by Registered Name)"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-indigo-200" />
              <span>Consolidated Purchases</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quarters auto-sync indicator card if data exists */}
      {hasQuarterData && quartersDataSummary && (
        <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-indigo-900">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
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
              className="text-indigo-700 hover:text-indigo-900 font-semibold underline underline-offset-2 shrink-0 cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Consolidate into 1701 Gross Sales</span>
            </button>
          )}
        </div>
      )}

      {/* Comparative Financial Statements & Trends (Multi-Year Statement Navigator & Analytics Chart) */}
      <ComparativeFinancialStatements
        formType="1701"
        currentYear={year}
        currentData={data}
        allYearsData={allYearsData}
        onUpdateHistoricalYear={onUpdateHistoricalYear}
        client={client}
      />

      {/* Main Form Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {/* Part I: Taxpayer Regime & Deductions Method */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Part I: Tax Regime & Deduction Method
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Income Tax Regime
                </label>
                <select
                  id="regime-select-1701"
                  value={data.taxRegime}
                  onChange={(e) => updateField('taxRegime', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="graduated">Graduated Tax Rates (0% - 35% TRAIN / EOPT)</option>
                  <option value="8_percent">8% Flat Income Tax Rate (Gross Sales &le; ₱3M)</option>
                </select>
              </div>

              {data.taxRegime === '8_percent' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Taxpayer Classification
                  </label>
                  <select
                    id="taxpayer-type-1701"
                    value={data.taxpayerType}
                    onChange={(e) => updateField('taxpayerType', e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="pure_business">Purely in Business/Profession (₱250k deduction)</option>
                    <option value="mixed_income">Mixed Income Earner (No ₱250k deduction)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Allowable Deduction Method
                  </label>
                  <select
                    id="deduction-method-1701"
                    value={data.deductionMethod}
                    onChange={(e) => updateField('deductionMethod', e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="osd">Optional Standard Deduction (40% of Gross Sales)</option>
                    <option value="itemized">Itemized Deductions (Actual Business Expenses)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Part II: Annual Gross Sales & Revenues */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Part II: Annual Sales & Operating Revenues (Jan - Dec)
              </div>
              <span className="text-xs font-mono text-slate-400">Taxable Year {year}</span>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-800">
                    Annual Gross Sales / Receipts / Revenues
                  </label>
                  <div className="text-[11px] text-slate-500">
                    Total sales from business or professional fees for all 4 quarters
                  </div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <input
                    id="gross-sales-1701-annual"
                    type="number"
                    value={data.grossSales || ''}
                    onChange={(e) => updateField('grossSales', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-700">
                    Less: Sales Returns, Allowances & Discounts
                  </label>
                  <div className="text-[11px] text-slate-400">
                    Returns, price concessions, trade discounts granted
                  </div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <input
                    id="sales-returns-1701-annual"
                    type="number"
                    value={data.salesReturnsDiscounts || ''}
                    onChange={(e) => updateField('salesReturnsDiscounts', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-700">
                    Non-Operating / Other Taxable Income
                  </label>
                  <div className="text-[11px] text-slate-400">
                    Interest, royalties, gain on assets (excluding final taxed income)
                  </div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <input
                    id="non-op-1701-annual"
                    type="number"
                    value={data.nonOperatingIncome || ''}
                    onChange={(e) => updateField('nonOperatingIncome', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {data.taxRegime === 'graduated' && data.deductionMethod === 'itemized' && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-xs font-medium text-slate-700">
                          Cost of Sales / Direct Cost of Services
                        </label>
                        <button
                          id="btn-breakdown-cogs-1701"
                          type="button"
                          onClick={() => setBreakdownTarget('cogs')}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors cursor-pointer"
                          title="Itemize and enter different expense accounts for Cost of Sales"
                        >
                          <ListPlus className="w-3 h-3" />
                          <span>Itemize Accounts</span>
                          {data.costOfSalesBreakdown && data.costOfSalesBreakdown.length > 0 && (
                            <span className="ml-0.5 px-1.5 py-0.2 bg-indigo-600 text-white rounded-full text-[9px] font-mono">
                              {data.costOfSalesBreakdown.length}
                            </span>
                          )}
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Direct materials, labor, and direct costs
                      </div>
                    </div>
                    <div className="relative w-full sm:w-60">
                      <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                      <input
                        id="cost-sales-1701-annual"
                        type="number"
                        value={data.costOfSales || ''}
                        onChange={(e) => updateField('costOfSales', parseNumber(e.target.value))}
                        placeholder="0.00"
                        className="w-full pl-6 pr-3 py-1.5 text-xs font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-xs font-medium text-slate-700">
                          Allowable Operating Expenses (Itemized)
                        </label>
                        <button
                          id="btn-breakdown-deductions-1701"
                          type="button"
                          onClick={() => setBreakdownTarget('itemized')}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors cursor-pointer"
                          title="Itemize and enter different expense accounts for Operating Expenses"
                        >
                          <ListPlus className="w-3 h-3" />
                          <span>Itemize Accounts</span>
                          {data.itemizedDeductionsBreakdown && data.itemizedDeductionsBreakdown.length > 0 && (
                            <span className="ml-0.5 px-1.5 py-0.2 bg-indigo-600 text-white rounded-full text-[9px] font-mono">
                              {data.itemizedDeductionsBreakdown.length}
                            </span>
                          )}
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Rent, utilities, depreciation, representation, supplies
                      </div>
                    </div>
                    <div className="relative w-full sm:w-60">
                      <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                      <input
                        id="operating-exp-1701-annual"
                        type="number"
                        value={data.operatingExpenses || ''}
                        onChange={(e) => updateField('operatingExpenses', parseNumber(e.target.value))}
                        placeholder="0.00"
                        className="w-full pl-6 pr-3 py-1.5 text-xs font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {data.taxRegime === 'graduated' && data.deductionMethod === 'osd' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex justify-between items-center text-slate-700">
                  <div>
                    <span className="font-semibold">Optional Standard Deduction (40%):</span>
                    <span className="text-slate-500 ml-1.5">
                      40% of ₱{formatPHP(data.grossSales, false)} (Sec. 34(L))
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-900">
                    {formatPHP(result.allowableDeductions)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Part III: Tax Credits and Prior Quarterly Payments */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Part III: Tax Credits, Withholding & Quarterly Payments
              </div>
              <span className="text-xs font-mono text-slate-400">Form 1701 Schedule</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Q1 Tax Paid (Form 1701Q)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <input
                    id="quarterly-paid-q1"
                    type="number"
                    value={data.quarterlyTaxPaidQ1 || ''}
                    onChange={(e) => updateField('quarterlyTaxPaidQ1', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Q2 Tax Paid (Form 1701Q)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <input
                    id="quarterly-paid-q2"
                    type="number"
                    value={data.quarterlyTaxPaidQ2 || ''}
                    onChange={(e) => updateField('quarterlyTaxPaidQ2', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Q3 Tax Paid (Form 1701Q)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <input
                    id="quarterly-paid-q3"
                    type="number"
                    value={data.quarterlyTaxPaidQ3 || ''}
                    onChange={(e) => updateField('quarterlyTaxPaidQ3', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Prior Year's Excess Credits
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <input
                    id="prior-excess-1701"
                    type="number"
                    value={data.priorYearExcessCredits || ''}
                    onChange={(e) => updateField('priorYearExcessCredits', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Total 2307 Withholding Credits
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <input
                    id="cwt-credits-1701"
                    type="number"
                    value={data.cwt2307Credits || ''}
                    onChange={(e) => updateField('cwt2307Credits', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Other Credits / Foreign Taxes
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <input
                    id="other-credits-1701"
                    type="number"
                    value={data.otherTaxCredits || ''}
                    onChange={(e) => updateField('otherTaxCredits', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Installment Payment Option (Section 56A(2) of Tax Code) */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  id="installment-toggle-1701"
                  type="checkbox"
                  checked={!!data.optForInstallment}
                  onChange={(e) => updateField('optForInstallment', e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="font-semibold">
                  Pay in Two (2) Equal Installments (Sec. 56(A)(2))
                </span>
              </label>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Available if tax due exceeds ₱2,000 (1st: April 15, 2nd: October 15)
              </span>
            </div>
          </div>
        </div>

        {/* Right Summary Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 sticky top-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Annual Tax Due & Payable
              </div>
              <span className="text-xs font-mono text-indigo-700 font-semibold">TY {year}</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Total Gross Revenues:</span>
                <span className="font-mono font-medium">{formatPHP(result.totalGrossRevenues)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Allowable Deductions:</span>
                <span className="font-mono text-emerald-700">-{formatPHP(result.allowableDeductions, false)}</span>
              </div>

              <div className="flex justify-between font-semibold text-slate-800 border-t border-slate-200 pt-1.5">
                <span>Net Taxable Income:</span>
                <span className="font-mono">{formatPHP(result.netTaxableIncome)}</span>
              </div>

              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1.5">
                <span>Annual Income Tax Due:</span>
                <span className="font-mono text-indigo-700">{formatPHP(result.taxDue)}</span>
              </div>

              {/* Credits */}
              <div className="pt-2 border-t border-slate-200 space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Quarterly Paid (Q1-Q3):</span>
                  <span className="font-mono text-emerald-700">
                    -{formatPHP(result.quarterlyTaxPayments, false)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>CWT 2307 & Other Credits:</span>
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
                    : 'bg-indigo-50 border-indigo-200 text-indigo-950'
                }`}
              >
                <div className="text-xs uppercase tracking-wider font-semibold opacity-80">
                  {result.isOverpayment ? 'Excess Annual Tax Credit' : 'Net Annual Tax Payable'}
                </div>
                <div className="text-2xl font-bold font-mono mt-1">
                  {formatPHP(Math.abs(result.netTaxPayable))}
                </div>
                <div className="text-[11px] mt-1 text-slate-500">
                  {result.isOverpayment
                    ? 'Eligible to carry over as tax credit for next taxable year'
                    : `Filing deadline: On or before April 15, ${year + 1}`}
                </div>

                {/* If Installment Opted */}
                {data.optForInstallment && result.netTaxPayable > 2000 && (
                  <div className="mt-3 pt-3 border-t border-indigo-200/80 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-indigo-700">
                        1st Installment (Apr 15)
                      </div>
                      <div className="font-mono font-bold text-slate-900">
                        {formatPHP(result.installment1stDue)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-indigo-700">
                        2nd Installment (Oct 15)
                      </div>
                      <div className="font-mono font-bold text-slate-900">
                        {formatPHP(result.installment2ndDue)}
                      </div>
                    </div>
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
        formName={`BIR Form 1701 Annual (${year})`}
      />

      {/* Expense Accounts Itemization Modal for Cost of Sales & Allowable Operating Expenses */}
      <ExpenseBreakdownModal
        isOpen={breakdownTarget !== null}
        onClose={() => setBreakdownTarget(null)}
        title={
          breakdownTarget === 'cogs'
            ? 'Cost of Sales / Direct Cost of Services Itemization'
            : 'Allowable Operating Expenses Itemization (Schedule 3)'
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

      {/* Consolidated Annual Purchases Modal (Quarterly Purchases combined by Registered Name) */}
      <ConsolidatedAnnualPurchasesModal
        isOpen={showPurchasesModal}
        onClose={() => setShowPurchasesModal(false)}
        client={client}
        year={year}
      />
    </div>
  );
};

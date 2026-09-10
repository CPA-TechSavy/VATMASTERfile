import React, { useState } from 'react';
import { Data2551Q, ClientProfile, Quarter } from '../types/tax';
import { calculate2551Q } from '../utils/taxCalculations';
import { formatPHP, parseNumber } from '../utils/formatters';
import { AlertTriangle, Download } from 'lucide-react';
import { PenaltiesModal } from './PenaltiesModal';
import { BranchVatSchedule } from './BranchVatSchedule';
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

  const result = calculate2551Q(data);

  const updateField = (field: keyof Data2551Q, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const handleSyncFromBranchSchedule = (totals: { grossSales: number; exemptSales: number }) => {
    onChange({
      ...data,
      grossSalesCurrentQuarter: totals.grossSales,
      exemptSales: totals.exemptSales,
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
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Taxable Sales & Applicable Percentage Tax Code
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

            <div className="pt-2 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700 font-medium">
                  Gross Sales / Receipts (This Quarter)
                </label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="gross-sales-2551q"
                    type="number"
                    value={data.grossSalesCurrentQuarter || ''}
                    onChange={(e) => updateField('grossSalesCurrentQuarter', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Exempt Sales / Receipts</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="exempt-sales-2551q"
                    type="number"
                    value={data.exemptSales || ''}
                    onChange={(e) => updateField('exemptSales', parseNumber(e.target.value))}
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
                  <div className="text-xs text-slate-400">Withheld by top withholding agents / govt</div>
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
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import {
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileSpreadsheet,
  Edit3,
  Check,
  Building2,
  Calendar,
  Percent,
  FileDown,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Data1702Annual, Data1701Annual, ClientProfile } from '../types/tax';
import { formatPHP } from '../utils/formatters';
import { exportComparativeVariancePdf } from '../utils/pdfExport';

interface ComparativeFinancialStatementsProps {
  formType?: '1701' | '1702';
  currentYear: number;
  currentData: Data1702Annual | Data1701Annual;
  allYearsData?: Record<number, any>;
  onUpdateHistoricalYear?: (year: number, data: any) => void;
  client?: ClientProfile;
}

interface YearStatementMetrics {
  year: number;
  grossSales: number;
  salesReturns: number;
  netSales: number;
  costOfSales: number;
  grossProfit: number;
  deductions: number;
  netTaxableIncome: number;
  taxDue: number;
  netIncomeAfterTax: number;
  grossMarginPct: number;
  effectiveTaxRatePct: number;
}

function calculateGraduatedTax(nti: number): number {
  if (nti <= 250000) return 0;
  if (nti <= 400000) return (nti - 250000) * 0.15;
  if (nti <= 800000) return 22500 + (nti - 400000) * 0.20;
  if (nti <= 2000000) return 102500 + (nti - 800000) * 0.25;
  if (nti <= 8000000) return 402500 + (nti - 2000000) * 0.30;
  return 2202500 + (nti - 8000000) * 0.35;
}

function computeMetrics(year: number, data?: any, formType: '1701' | '1702' = '1702'): YearStatementMetrics {
  const grossSales = Number(data?.grossSales) || 0;
  const salesReturns = Number(data?.salesReturnsDiscounts) || 0;
  const netSales = Math.max(0, grossSales - salesReturns);
  const costOfSales = Number(data?.costOfSales) || 0;
  const grossProfit = Math.max(0, netSales - costOfSales);
  const nonOp = Number(data?.nonOperatingIncome) || 0;
  
  let deductions = 0;
  let netTaxableIncome = 0;
  let taxDue = 0;

  if (formType === '1701') {
    const is8Percent = data?.taxRegime === 'eight_percent';
    if (is8Percent) {
      deductions = 0;
      const taxableGross = Math.max(0, netSales + nonOp - 250000);
      taxDue = taxableGross * 0.08;
      netTaxableIncome = taxableGross;
    } else {
      if (data?.deductionMethod === 'osd') {
        deductions = netSales * 0.40;
      } else {
        deductions = Number(data?.operatingExpenses || data?.itemizedDeductions) || 0;
      }
      netTaxableIncome = Math.max(0, (data?.deductionMethod === 'osd' ? netSales : grossProfit) + nonOp - deductions);
      taxDue = calculateGraduatedTax(netTaxableIncome);
    }
  } else {
    // Form 1702 (Corporate)
    if (data?.deductionMethod === 'osd') {
      const totalGross = grossProfit + nonOp;
      deductions = totalGross * 0.40;
    } else {
      deductions = Number(data?.operatingExpenses) || 0;
    }
    netTaxableIncome = Math.max(0, grossProfit + nonOp - deductions);
    
    // Tax rate (regular 25% or msme 20%)
    const rate = data?.rateOption === 'msme_20' ? 0.20 : 0.25;
    const ncit = netTaxableIncome * rate;
    const mcit = (grossProfit + nonOp) * (data?.isMCOptional ? 0.02 : 0);
    taxDue = Math.max(ncit, mcit);
  }

  const netIncomeAfterTax = Math.max(0, netTaxableIncome - taxDue);
  const grossMarginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
  const effectiveTaxRatePct = netTaxableIncome > 0 ? (taxDue / netTaxableIncome) * 100 : 0;

  return {
    year,
    grossSales,
    salesReturns,
    netSales,
    costOfSales,
    grossProfit,
    deductions,
    netTaxableIncome,
    taxDue,
    netIncomeAfterTax,
    grossMarginPct,
    effectiveTaxRatePct,
  };
}

export const ComparativeFinancialStatements: React.FC<ComparativeFinancialStatementsProps> = ({
  formType = '1702' as '1701' | '1702',
  currentYear,
  currentData,
  allYearsData = {},
  onUpdateHistoricalYear,
  client,
}) => {
  // Hide / Unhide state: user can collapse or expand whenever needed
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedPriorYear, setSelectedPriorYear] = useState<number>(currentYear - 1);
  const [chartMetricMode, setChartMetricMode] = useState<'sales_profit' | 'tax_due' | 'margins'>('sales_profit');
  const [isEditingPrior, setIsEditingPrior] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfSuccessToast, setPdfSuccessToast] = useState(false);

  // Expander states for Cost of Goods Sold and Ordinary Allowable Deductions
  const [isCogsExpanded, setIsCogsExpanded] = useState(false);
  const [isDeductionsExpanded, setIsDeductionsExpanded] = useState(false);

  // Resolve itemized COGS accounts for current and prior year
  const cogsBreakdownList = useMemo(() => {
    let list: Array<{ id?: string; accountName: string; amount: number }> = currentData?.costOfSalesBreakdown || [];
    if ((!list || list.length === 0) && client?.id) {
      try {
        const saved = localStorage.getItem(`bir_cogs_breakdown_${client.id}_${currentYear}`);
        if (saved) list = JSON.parse(saved);
      } catch (e) {}
    }
    return list;
  }, [currentData?.costOfSalesBreakdown, client?.id, currentYear]);

  const priorCogsBreakdownList = useMemo(() => {
    const priorData = allYearsData?.[selectedPriorYear];
    let list: Array<{ id?: string; accountName: string; amount: number }> = priorData?.costOfSalesBreakdown || [];
    if ((!list || list.length === 0) && client?.id) {
      try {
        const saved = localStorage.getItem(`bir_cogs_breakdown_${client.id}_${selectedPriorYear}`);
        if (saved) list = JSON.parse(saved);
      } catch (e) {}
    }
    return list;
  }, [allYearsData, selectedPriorYear, client?.id]);

  // Resolve itemized Deductions accounts for current and prior year
  const deductionsBreakdownList = useMemo(() => {
    let list: Array<{ id?: string; accountName: string; amount: number }> = currentData?.itemizedDeductionsBreakdown || [];
    if ((!list || list.length === 0) && client?.id) {
      try {
        const saved = localStorage.getItem(`bir_opex_breakdown_${client.id}_${currentYear}`);
        if (saved) list = JSON.parse(saved);
      } catch (e) {}
    }
    return list;
  }, [currentData?.itemizedDeductionsBreakdown, client?.id, currentYear]);

  const priorDeductionsBreakdownList = useMemo(() => {
    const priorData = allYearsData?.[selectedPriorYear];
    let list: Array<{ id?: string; accountName: string; amount: number }> = priorData?.itemizedDeductionsBreakdown || [];
    if ((!list || list.length === 0) && client?.id) {
      try {
        const saved = localStorage.getItem(`bir_opex_breakdown_${client.id}_${selectedPriorYear}`);
        if (saved) list = JSON.parse(saved);
      } catch (e) {}
    }
    return list;
  }, [allYearsData, selectedPriorYear, client?.id]);

  const handleDownloadVariancePdf = async () => {
    try {
      setIsExportingPdf(true);
      await exportComparativeVariancePdf({
        client,
        currentYear,
        selectedPriorYear,
        currentData: currentData as any,
        allYearsData: allYearsData as any,
        formType,
      });
      setPdfSuccessToast(true);
      setTimeout(() => setPdfSuccessToast(false), 3500);
    } catch (err) {
      console.error('Failed to export comparative variance PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Collect historical year statements (spanning prior 3 years up to current year)
  const historicalYears = useMemo(() => {
    return [currentYear - 3, currentYear - 2, currentYear - 1];
  }, [currentYear]);

  // Current year metrics
  const currentMetrics = useMemo(() => {
    return computeMetrics(currentYear, currentData, formType);
  }, [currentYear, currentData, formType]);

  // Selected prior year metrics
  const priorData = allYearsData[selectedPriorYear];
  const priorMetrics = useMemo(() => {
    return computeMetrics(selectedPriorYear, priorData, formType);
  }, [selectedPriorYear, priorData, formType]);

  // Editable fields for prior year if editing
  const [priorSalesInput, setPriorSalesInput] = useState<string>('');
  const [priorCostInput, setPriorCostInput] = useState<string>('');
  const [priorExpInput, setPriorExpInput] = useState<string>('');

  const handleStartEditPrior = () => {
    setPriorSalesInput(priorData?.grossSales ? String(priorData.grossSales) : '');
    setPriorCostInput(priorData?.costOfSales ? String(priorData.costOfSales) : '');
    setPriorExpInput(priorData?.operatingExpenses ? String(priorData.operatingExpenses) : '');
    setIsEditingPrior(true);
  };

  const handleSavePriorEdit = () => {
    if (onUpdateHistoricalYear) {
      const existing = priorData || {
        rateOption: 'regular_25',
        isMCOptional: false,
        grossSales: 0,
        salesReturnsDiscounts: 0,
        costOfSales: 0,
        nonOperatingIncome: 0,
        deductionMethod: 'itemized',
        operatingExpenses: 0,
        priorYearExcessCredits: 0,
        quarterlyTaxPaidQ1: 0,
        quarterlyTaxPaidQ2: 0,
        quarterlyTaxPaidQ3: 0,
        cwt2307Credits: 0,
        excessMCITPriorYears: 0,
        otherTaxCredits: 0,
      };

      const updated: Data1702Annual = {
        ...existing,
        grossSales: parseFloat(priorSalesInput) || 0,
        costOfSales: parseFloat(priorCostInput) || 0,
        operatingExpenses: parseFloat(priorExpInput) || 0,
      };
      onUpdateHistoricalYear(selectedPriorYear, updated);
    }
    setIsEditingPrior(false);
  };

  // Build multi-year dataset for Recharts
  const chartData = useMemo(() => {
    const yearsList = [...historicalYears, currentYear];
    return yearsList.map((y) => {
      const yData = y === currentYear ? currentData : allYearsData[y];
      const m = computeMetrics(y, yData);
      return {
        year: `TY ${y}`,
        rawYear: y,
        'Gross Sales': m.grossSales,
        'Cost of Sales': m.costOfSales,
        'Gross Profit': m.grossProfit,
        'Net Taxable Income': m.netTaxableIncome,
        'Corporate Tax Due': m.taxDue,
        'Gross Margin %': parseFloat(m.grossMarginPct.toFixed(1)),
        'Effective Tax Rate %': parseFloat(m.effectiveTaxRatePct.toFixed(1)),
      };
    });
  }, [historicalYears, currentYear, currentData, allYearsData]);

  // YoY variances between Current and Selected Prior Year
  const salesDiff = currentMetrics.grossSales - priorMetrics.grossSales;
  const salesGrowthPct = priorMetrics.grossSales > 0 ? (salesDiff / priorMetrics.grossSales) * 100 : 0;

  const costDiff = currentMetrics.costOfSales - priorMetrics.costOfSales;
  const costGrowthPct = priorMetrics.costOfSales > 0 ? (costDiff / priorMetrics.costOfSales) * 100 : 0;

  const grossProfitDiff = currentMetrics.grossProfit - priorMetrics.grossProfit;
  const grossProfitGrowthPct = priorMetrics.grossProfit > 0 ? (grossProfitDiff / priorMetrics.grossProfit) * 100 : 0;

  const taxDueDiff = currentMetrics.taxDue - priorMetrics.taxDue;
  const taxDueGrowthPct = priorMetrics.taxDue > 0 ? (taxDueDiff / priorMetrics.taxDue) * 100 : 0;

  const netIncomeDiff = currentMetrics.netIncomeAfterTax - priorMetrics.netIncomeAfterTax;
  const netIncomeGrowthPct = priorMetrics.netIncomeAfterTax > 0 ? (netIncomeDiff / priorMetrics.netIncomeAfterTax) * 100 : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all">
      {/* Header bar with toggle switch */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                Comparative Financial Statements & Performance Trends
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 rounded-full">
                Multi-Year Analysis
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            id="toggle-comparative-fs-btn"
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/25 text-white border border-white/20 transition-all cursor-pointer"
            title={isExpanded ? 'Hide comparative financial statements & trends' : 'Unhide comparative financial statements & trends'}
          >
            {isExpanded ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-slate-300" />
                <span>Hide Statements & Trends</span>
                <ChevronUp className="w-3.5 h-3.5 text-slate-300" />
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-blue-300" />
                <span>Unhide Statements & Trends</span>
                <ChevronDown className="w-3.5 h-3.5 text-blue-300" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Collapsed State Summary Strip */}
      {!isExpanded && (
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">TY {currentYear} Gross Sales:</span>
              <span className="font-bold font-mono text-slate-800">{formatPHP(currentMetrics.grossSales)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">TY {currentYear} Tax Due:</span>
              <span className="font-bold font-mono text-slate-800">{formatPHP(currentMetrics.taxDue)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">YoY Sales Growth:</span>
              <span
                className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full ${
                  salesGrowthPct >= 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {salesGrowthPct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {salesGrowthPct >= 0 ? `+${salesGrowthPct.toFixed(1)}%` : `${salesGrowthPct.toFixed(1)}%`}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer flex items-center gap-1"
          >
            <span>Expand Multi-Year Financial Statements & Analytics Chart</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Expanded Body */}
      {isExpanded && (
        <div className="p-5 space-y-6">
          {/* Top Control Bar: Year Navigator + Chart Metric Toggle */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            {/* Year Selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Compare TY {currentYear} Against:</span>
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {historicalYears.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setSelectedPriorYear(y);
                      setIsEditingPrior(false);
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      selectedPriorYear === y
                        ? 'bg-white text-blue-700 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    TY {y}
                  </button>
                ))}
              </div>

              {onUpdateHistoricalYear && (
                <button
                  type="button"
                  onClick={isEditingPrior ? handleSavePriorEdit : handleStartEditPrior}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    isEditingPrior
                      ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  title={isEditingPrior ? 'Save TY ' + selectedPriorYear + ' inputs' : 'Edit prior year figures manually'}
                >
                  {isEditingPrior ? <Check className="w-3 h-3" /> : <Edit3 className="w-3 h-3 text-slate-500" />}
                  <span>{isEditingPrior ? 'Save TY ' + selectedPriorYear : 'Edit TY ' + selectedPriorYear}</span>
                </button>
              )}
            </div>

            {/* Chart View Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start md:self-auto">
              <span className="text-[11px] text-slate-500 font-medium px-2 hidden lg:inline">Chart View:</span>
              <button
                type="button"
                onClick={() => setChartMetricMode('sales_profit')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  chartMetricMode === 'sales_profit'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Revenue & Profit
              </button>
              <button
                type="button"
                onClick={() => setChartMetricMode('tax_due')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  chartMetricMode === 'tax_due'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tax Due
              </button>
              <button
                type="button"
                onClick={() => setChartMetricMode('margins')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  chartMetricMode === 'margins'
                    ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Margin & Effective Rate %
              </button>
            </div>
          </div>

          {/* Side-by-Side: Comparative FS Table on Left & Chart on Right */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Left: Financial Statement Table */}
            <div className="xl:col-span-7 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    <span>Statement of Comprehensive Income</span>
                  </div>

                  {/* PDF Button right beside STATEMENT OF COMPREHENSIVE INCOME */}
                  <div className="flex items-center gap-1.5">
                    <button
                      id="btn-download-variance-pdf"
                      type="button"
                      onClick={handleDownloadVariancePdf}
                      disabled={isExportingPdf}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-60"
                      title={`Download PDF: Variance Table of Different Taxable Years vs Current Taxable Year (TY ${currentYear})`}
                    >
                      {isExportingPdf ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                          <span>Generating PDF...</span>
                        </>
                      ) : (
                        <>
                          <FileDown className="w-3.5 h-3.5 text-rose-600" />
                          <span>PDF Variance</span>
                        </>
                      )}
                    </button>

                    {pdfSuccessToast && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 animate-fade-in">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Downloaded!</span>
                      </span>
                    )}
                  </div>
                </div>

                <span className="text-[11px] text-slate-400 font-mono">
                  Comparative: TY {selectedPriorYear} vs. TY {currentYear}
                </span>
              </div>

              {isEditingPrior && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                    <span>Editing Audited Figures for Prior Year (TY {selectedPriorYear}):</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-0.5">Gross Sales</label>
                      <input
                        type="number"
                        value={priorSalesInput}
                        onChange={(e) => setPriorSalesInput(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-2 py-1 text-xs font-mono border border-slate-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-0.5">Cost of Sales</label>
                      <input
                        type="number"
                        value={priorCostInput}
                        onChange={(e) => setPriorCostInput(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-2 py-1 text-xs font-mono border border-slate-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-0.5">Operating Deductions</label>
                      <input
                        type="number"
                        value={priorExpInput}
                        onChange={(e) => setPriorExpInput(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-2 py-1 text-xs font-mono border border-slate-300 rounded bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleSavePriorEdit}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded"
                    >
                      Save Prior Year Data
                    </button>
                  </div>
                </div>
              )}

              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Financial Account</th>
                      <th className="py-2.5 px-2 text-right font-mono">TY {selectedPriorYear}</th>
                      <th className="py-2.5 px-2 text-right font-mono bg-blue-50/40 text-blue-900">
                        TY {currentYear} (Current)
                      </th>
                      <th className="py-2.5 px-2 text-right font-mono">Variance (₱)</th>
                      <th className="py-2.5 px-3 text-right font-mono">YoY Growth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {/* Gross Sales */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-slate-800 font-semibold">Gross Sales / Revenues</td>
                      <td className="py-2 px-2 text-right font-mono text-slate-600">{formatPHP(priorMetrics.grossSales)}</td>
                      <td className="py-2 px-2 text-right font-mono text-slate-900 font-bold bg-blue-50/30">
                        {formatPHP(currentMetrics.grossSales)}
                      </td>
                      <td className={`py-2 px-2 text-right font-mono ${salesDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {salesDiff >= 0 ? `+${formatPHP(salesDiff)}` : `-${formatPHP(Math.abs(salesDiff))}`}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            salesGrowthPct >= 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {salesGrowthPct >= 0 ? `+${salesGrowthPct.toFixed(1)}%` : `${salesGrowthPct.toFixed(1)}%`}
                        </span>
                      </td>
                    </tr>

                    {/* Sales Returns */}
                    <tr className="hover:bg-slate-50/50 text-slate-600">
                      <td className="py-1.5 px-3 pl-6">Less: Sales Returns & Discounts</td>
                      <td className="py-1.5 px-2 text-right font-mono">({formatPHP(priorMetrics.salesReturns, false)})</td>
                      <td className="py-1.5 px-2 text-right font-mono bg-blue-50/30">
                        ({formatPHP(currentMetrics.salesReturns, false)})
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-400">—</td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-400">—</td>
                    </tr>

                    {/* Net Sales */}
                    <tr className="bg-slate-50/30 font-semibold">
                      <td className="py-2 px-3 text-slate-900">Net Sales</td>
                      <td className="py-2 px-2 text-right font-mono text-slate-700">{formatPHP(priorMetrics.netSales)}</td>
                      <td className="py-2 px-2 text-right font-mono text-slate-900 font-bold bg-blue-50/50">
                        {formatPHP(currentMetrics.netSales)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-700">
                        {formatPHP(currentMetrics.netSales - priorMetrics.netSales)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700">
                        {priorMetrics.netSales > 0
                          ? `${(((currentMetrics.netSales - priorMetrics.netSales) / priorMetrics.netSales) * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>

                    {/* Cost of Goods Sold */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-slate-700">
                        <div className="flex items-center gap-1.5 pl-1.5">
                          <button
                            type="button"
                            id="btn-toggle-cogs-breakdown"
                            onClick={() => setIsCogsExpanded(!isCogsExpanded)}
                            className="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-700 rounded transition-all cursor-pointer flex items-center justify-center shrink-0"
                            title={isCogsExpanded ? "Collapse Cost of Goods Sold accounts" : "Click triangle to show individual expense accounts composing Cost of Goods Sold"}
                            aria-expanded={isCogsExpanded}
                          >
                            <span
                              className={`inline-block text-[10px] transform transition-transform duration-200 ${
                                isCogsExpanded ? 'rotate-90 text-blue-600 font-bold' : 'text-slate-400'
                              }`}
                            >
                              ▶
                            </span>
                          </button>
                          <span className="font-medium">Less: Cost of Goods Sold / Services</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-600">({formatPHP(priorMetrics.costOfSales, false)})</td>
                      <td className="py-2 px-2 text-right font-mono text-slate-900 font-semibold bg-blue-50/30">
                        ({formatPHP(currentMetrics.costOfSales, false)})
                      </td>
                      <td className={`py-2 px-2 text-right font-mono ${costDiff <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {costDiff >= 0 ? `+${formatPHP(costDiff)}` : `-${formatPHP(Math.abs(costDiff))}`}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                            costGrowthPct <= 0
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {costGrowthPct >= 0 ? `+${costGrowthPct.toFixed(1)}%` : `${costGrowthPct.toFixed(1)}%`}
                        </span>
                      </td>
                    </tr>

                    {/* Expanded individual COGS accounts */}
                    {isCogsExpanded && (
                      <>
                        {cogsBreakdownList.length === 0 ? (
                          <tr className="bg-slate-50/70 border-l-2 border-blue-400 text-xs">
                            <td colSpan={5} className="py-2 px-3 pl-9 text-slate-500 italic">
                              No individual expense accounts entered yet. Click "Itemized Accounts" in Part II or "Sync to Deductions" in Consolidated Purchases to populate.
                            </td>
                          </tr>
                        ) : (
                          cogsBreakdownList.map((item, idx) => {
                            const priorMatch = priorCogsBreakdownList.find(
                              (p) => p.accountName?.toLowerCase().trim() === item.accountName?.toLowerCase().trim()
                            );
                            const priorAmt = priorMatch ? priorMatch.amount : 0;
                            const currAmt = item.amount || 0;
                            const diff = currAmt - priorAmt;
                            const pct = priorAmt > 0 ? ((currAmt - priorAmt) / priorAmt) * 100 : 0;

                            return (
                              <tr
                                key={item.id || `cogs_item_${idx}`}
                                className="bg-blue-50/20 hover:bg-blue-50/40 border-l-2 border-blue-400 text-xs transition-colors"
                              >
                                <td className="py-1.5 px-3 pl-8 text-slate-600 font-normal">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-400 text-[11px]">↳</span>
                                    <span className="truncate">{item.accountName}</span>
                                  </div>
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono text-slate-500">
                                  {priorAmt > 0 ? `(${formatPHP(priorAmt, false)})` : '—'}
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono text-slate-800 font-semibold bg-blue-50/40">
                                  ({formatPHP(currAmt, false)})
                                </td>
                                <td className={`py-1.5 px-2 text-right font-mono ${diff <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                  {priorAmt > 0 ? (diff >= 0 ? `+${formatPHP(diff)}` : `-${formatPHP(Math.abs(diff))}`) : '—'}
                                </td>
                                <td className="py-1.5 px-3 text-right">
                                  {priorAmt > 0 ? (
                                    <span
                                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                                        pct <= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                                      }`}
                                    >
                                      {pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-mono text-[10px]">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </>
                    )}

                    {/* Gross Profit */}
                    <tr className="bg-slate-50/60 font-semibold border-t border-b border-slate-200">
                      <td className="py-2 px-3 text-blue-950 font-bold">Gross Profit (Gross Operating Income)</td>
                      <td className="py-2 px-2 text-right font-mono text-blue-950">{formatPHP(priorMetrics.grossProfit)}</td>
                      <td className="py-2 px-2 text-right font-mono text-blue-950 font-bold bg-blue-100/40">
                        {formatPHP(currentMetrics.grossProfit)}
                      </td>
                      <td className={`py-2 px-2 text-right font-mono ${grossProfitDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {grossProfitDiff >= 0 ? `+${formatPHP(grossProfitDiff)}` : `-${formatPHP(Math.abs(grossProfitDiff))}`}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            grossProfitGrowthPct >= 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {grossProfitGrowthPct >= 0 ? `+${grossProfitGrowthPct.toFixed(1)}%` : `${grossProfitGrowthPct.toFixed(1)}%`}
                        </span>
                      </td>
                    </tr>

                    {/* Operating Expenses */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-slate-700">
                        <div className="flex items-center gap-1.5 pl-1.5">
                          <button
                            type="button"
                            id="btn-toggle-deductions-breakdown"
                            onClick={() => setIsDeductionsExpanded(!isDeductionsExpanded)}
                            className="p-1 hover:bg-indigo-50 text-slate-400 hover:text-indigo-700 rounded transition-all cursor-pointer flex items-center justify-center shrink-0"
                            title={isDeductionsExpanded ? "Collapse Ordinary Allowable Deductions accounts" : "Click triangle to show individual expense accounts composing Ordinary Allowable Deductions"}
                            aria-expanded={isDeductionsExpanded}
                          >
                            <span
                              className={`inline-block text-[10px] transform transition-transform duration-200 ${
                                isDeductionsExpanded ? 'rotate-90 text-indigo-600 font-bold' : 'text-slate-400'
                              }`}
                            >
                              ▶
                            </span>
                          </button>
                          <span className="font-medium">Less: Ordinary Allowable Deductions</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-600">({formatPHP(priorMetrics.deductions, false)})</td>
                      <td className="py-2 px-2 text-right font-mono text-slate-900 font-semibold bg-blue-50/30">
                        ({formatPHP(currentMetrics.deductions, false)})
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-600">
                        {formatPHP(currentMetrics.deductions - priorMetrics.deductions)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">
                        {priorMetrics.deductions > 0
                          ? `${(((currentMetrics.deductions - priorMetrics.deductions) / priorMetrics.deductions) * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>

                    {/* Expanded individual OPEX accounts */}
                    {isDeductionsExpanded && (
                      <>
                        {deductionsBreakdownList.length === 0 ? (
                          <tr className="bg-slate-50/70 border-l-2 border-indigo-400 text-xs">
                            <td colSpan={5} className="py-2 px-3 pl-9 text-slate-500 italic">
                              No individual expense accounts entered yet. Click "Itemized Accounts" in Part II or "Sync to Deductions" in Consolidated Purchases to populate.
                            </td>
                          </tr>
                        ) : (
                          deductionsBreakdownList.map((item, idx) => {
                            const priorMatch = priorDeductionsBreakdownList.find(
                              (p) => p.accountName?.toLowerCase().trim() === item.accountName?.toLowerCase().trim()
                            );
                            const priorAmt = priorMatch ? priorMatch.amount : 0;
                            const currAmt = item.amount || 0;
                            const diff = currAmt - priorAmt;
                            const pct = priorAmt > 0 ? ((currAmt - priorAmt) / priorAmt) * 100 : 0;

                            return (
                              <tr
                                key={item.id || `ded_item_${idx}`}
                                className="bg-indigo-50/20 hover:bg-indigo-50/40 border-l-2 border-indigo-400 text-xs transition-colors"
                              >
                                <td className="py-1.5 px-3 pl-8 text-slate-600 font-normal">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-400 text-[11px]">↳</span>
                                    <span className="truncate">{item.accountName}</span>
                                  </div>
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono text-slate-500">
                                  {priorAmt > 0 ? `(${formatPHP(priorAmt, false)})` : '—'}
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono text-slate-800 font-semibold bg-indigo-50/40">
                                  ({formatPHP(currAmt, false)})
                                </td>
                                <td className={`py-1.5 px-2 text-right font-mono ${diff <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                  {priorAmt > 0 ? (diff >= 0 ? `+${formatPHP(diff)}` : `-${formatPHP(Math.abs(diff))}`) : '—'}
                                </td>
                                <td className="py-1.5 px-3 text-right">
                                  {priorAmt > 0 ? (
                                    <span
                                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                                        pct <= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                                      }`}
                                    >
                                      {pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-mono text-[10px]">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </>
                    )}

                    {/* Net Taxable Income */}
                    <tr className="hover:bg-slate-50/50 font-semibold">
                      <td className="py-2 px-3 text-slate-900">Net Taxable Income</td>
                      <td className="py-2 px-2 text-right font-mono text-slate-800">{formatPHP(priorMetrics.netTaxableIncome)}</td>
                      <td className="py-2 px-2 text-right font-mono text-slate-900 font-bold bg-blue-50/40">
                        {formatPHP(currentMetrics.netTaxableIncome)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-800">
                        {formatPHP(currentMetrics.netTaxableIncome - priorMetrics.netTaxableIncome)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-800">
                        {priorMetrics.netTaxableIncome > 0
                          ? `${(((currentMetrics.netTaxableIncome - priorMetrics.netTaxableIncome) / priorMetrics.netTaxableIncome) * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>

                    {/* Tax Due */}
                    <tr className="bg-indigo-50/40 font-bold border-t border-indigo-100">
                      <td className="py-2 px-3 text-indigo-950 flex items-center gap-1.5">
                        <span>{formType === '1701' ? 'Provision for Income Tax Due' : 'Provision for Corporate Tax Due'}</span>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-indigo-950">{formatPHP(priorMetrics.taxDue)}</td>
                      <td className="py-2 px-2 text-right font-mono text-indigo-950 bg-indigo-100/50">
                        {formatPHP(currentMetrics.taxDue)}
                      </td>
                      <td className={`py-2 px-2 text-right font-mono ${taxDueDiff >= 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                        {taxDueDiff >= 0 ? `+${formatPHP(taxDueDiff)}` : `-${formatPHP(Math.abs(taxDueDiff))}`}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            taxDueGrowthPct >= 0
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {taxDueGrowthPct >= 0 ? `+${taxDueGrowthPct.toFixed(1)}%` : `${taxDueGrowthPct.toFixed(1)}%`}
                        </span>
                      </td>
                    </tr>

                    {/* Net Income After Tax */}
                    <tr className="bg-slate-100 font-bold text-slate-900">
                      <td className="py-2 px-3">Net Income After Tax</td>
                      <td className="py-2 px-2 text-right font-mono">{formatPHP(priorMetrics.netIncomeAfterTax)}</td>
                      <td className="py-2 px-2 text-right font-mono bg-blue-100/60">
                        {formatPHP(currentMetrics.netIncomeAfterTax)}
                      </td>
                      <td className={`py-2 px-2 text-right font-mono ${netIncomeDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {netIncomeDiff >= 0 ? `+${formatPHP(netIncomeDiff)}` : `-${formatPHP(Math.abs(netIncomeDiff))}`}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            netIncomeGrowthPct >= 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {netIncomeGrowthPct >= 0 ? `+${netIncomeGrowthPct.toFixed(1)}%` : `${netIncomeGrowthPct.toFixed(1)}%`}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Ratios quick strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10px] text-slate-500 font-medium">Gross Margin</div>
                  <div className="text-xs font-bold font-mono text-slate-800 mt-0.5">
                    {currentMetrics.grossMarginPct.toFixed(1)}%
                    <span className="text-[10px] font-normal text-slate-400 ml-1">
                      (PY: {priorMetrics.grossMarginPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10px] text-slate-500 font-medium">Effective Tax Rate</div>
                  <div className="text-xs font-bold font-mono text-indigo-700 mt-0.5">
                    {currentMetrics.effectiveTaxRatePct.toFixed(1)}%
                    <span className="text-[10px] font-normal text-slate-400 ml-1">
                      (PY: {priorMetrics.effectiveTaxRatePct.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10px] text-slate-500 font-medium">Cost-to-Sales Ratio</div>
                  <div className="text-xs font-bold font-mono text-slate-800 mt-0.5">
                    {currentMetrics.netSales > 0 ? ((currentMetrics.costOfSales / currentMetrics.netSales) * 100).toFixed(1) : 0}%
                  </div>
                </div>

                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10px] text-slate-500 font-medium">Net Profit Margin</div>
                  <div className="text-xs font-bold font-mono text-emerald-700 mt-0.5">
                    {currentMetrics.netSales > 0 ? ((currentMetrics.netIncomeAfterTax / currentMetrics.netSales) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Visual Performance Trends Chart */}
            <div className="xl:col-span-5 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  <span>
                    {chartMetricMode === 'sales_profit' && 'Sales, Cost & Gross Profit Trends'}
                    {chartMetricMode === 'tax_due' && 'Annual Corporate Tax Due Trends'}
                    {chartMetricMode === 'margins' && 'Gross Margin & Tax Rate Progression'}
                  </span>
                </div>
              </div>

              {/* Chart container */}
              <div className="h-64 sm:h-72 w-full bg-slate-50/50 p-3 rounded-xl border border-slate-200">
                <ResponsiveContainer width="100%" height="100%">
                  {chartMetricMode === 'sales_profit' ? (
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(val: any) => [formatPHP(Number(val)), '']}
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Bar dataKey="Gross Sales" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Cost of Sales" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Gross Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : chartMetricMode === 'tax_due' ? (
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(val: any) => [formatPHP(Number(val)), '']}
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Bar dataKey="Corporate Tax Due" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Net Taxable Income" fill="#0284c7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={(val) => `${val}%`}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        formatter={(val: any) => [`${Number(val).toFixed(1)}%`, '']}
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Line
                        type="monotone"
                        dataKey="Gross Margin %"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Effective Tax Rate %"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* KPI highlight cards */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">YoY Sales Delta</div>
                    <div className={`text-sm font-bold font-mono mt-0.5 ${salesDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {salesDiff >= 0 ? `+${formatPHP(salesDiff)}` : `-${formatPHP(Math.abs(salesDiff))}`}
                    </div>
                  </div>
                  <div className={`p-2 rounded-lg ${salesDiff >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {salesDiff >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">YoY Tax Due Variance</div>
                    <div className={`text-sm font-bold font-mono mt-0.5 ${taxDueDiff >= 0 ? 'text-indigo-900' : 'text-emerald-700'}`}>
                      {taxDueDiff >= 0 ? `+${formatPHP(taxDueDiff)}` : `-${formatPHP(Math.abs(taxDueDiff))}`}
                    </div>
                  </div>
                  <div className={`p-2 rounded-lg ${taxDueGrowthPct >= 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

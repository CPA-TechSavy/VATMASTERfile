import React, { useState, useEffect, useMemo } from 'react';
import { ClientProfile, Quarter, Data2551Q } from '../types/tax';
import { formatPHP, parseNumber } from '../utils/formatters';
import {
  TrendingUp,
  BarChart3,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  ShieldAlert,
  Info,
  Calendar,
  Percent,
  Lightbulb,
  Wallet,
  Scale,
  FileText,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Area,
} from 'recharts';

export interface IncomeForecasting2551QProps {
  client: ClientProfile;
  currentQuarter: Quarter;
  year: number;
  currentQuarterData: Data2551Q;
  allQuarterDataMap?: Record<string, Data2551Q>;
  onApplyQuarterGrossSales?: (quarter: Quarter, grossSales: number, exemptSales: number) => void;
  defaultViewMode?: 'graph' | 'table' | 'insights';
}

const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
const VAT_ANNUAL_THRESHOLD = 3000000; // ₱3,000,000 statutory VAT threshold under Tax Code Sec. 236(G)
const QUARTER_VAT_BENCHMARK = VAT_ANNUAL_THRESHOLD / 4; // ₱750,000/quarter average

interface QuarterForecastItem {
  quarter: Quarter;
  label: string;
  months: string;
  isPast: boolean;
  isCurrent: boolean;
  isForecasted: boolean;
  grossSales: number;
  exemptSales: number;
  taxableSales: number;
  taxRatePercent: number;
  taxDue: number;
  estimatedCwt: number;
  netTaxPayable: number;
  qoqGrowthPercent: number | null;
  source: 'actual' | 'current_form' | 'forecast_rule' | 'manual_override';
}

type ForecastMethod = 'growth_rate';

interface StoredForecastSettings {
  method: ForecastMethod;
  annualGrowthPercent: number;
  manualGrossSales: Partial<Record<Quarter, number>>;
  manualExemptSales: Partial<Record<Quarter, number>>;
  manualCwtRates: Partial<Record<Quarter, number>>;
}

export const IncomeForecasting2551Q: React.FC<IncomeForecasting2551QProps> = ({
  client,
  currentQuarter,
  year,
  currentQuarterData,
  allQuarterDataMap = {},
  onApplyQuarterGrossSales,
  defaultViewMode = 'table',
}) => {
  const storageKey = `bir_2551q_forecast_${client.id}_${year}`;

  // State: Settings
  const method: ForecastMethod = 'growth_rate';
  const [growthPercent, setGrowthPercent] = useState<number>(5); // default 5% QoQ growth
  const [manualGrossSales, setManualGrossSales] = useState<Partial<Record<Quarter, number>>>({});
  const [manualExemptSales, setManualExemptSales] = useState<Partial<Record<Quarter, number>>>({});
  const [activeChartTab, setActiveChartTab] = useState<'quarterly' | 'cumulative'>('quarterly');
  const [viewMode, setViewMode] = useState<'graph' | 'table' | 'insights'>(
    defaultViewMode === ('both' as any) ? 'table' : defaultViewMode
  );
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Load stored forecast preferences
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: StoredForecastSettings = JSON.parse(saved);
        if (typeof parsed.annualGrowthPercent === 'number') setGrowthPercent(parsed.annualGrowthPercent);
        if (parsed.manualGrossSales) setManualGrossSales(parsed.manualGrossSales);
        if (parsed.manualExemptSales) setManualExemptSales(parsed.manualExemptSales);
      }
    } catch (e) {
      console.error('Failed to load 2551Q forecast settings', e);
    }
  }, [storageKey]);

  // Persist forecast preferences
  const savePreferences = (
    newMethod: ForecastMethod = method,
    newGrowth = growthPercent,
    newGross = manualGrossSales,
    newExempt = manualExemptSales
  ) => {
    try {
      const payload: StoredForecastSettings = {
        method: newMethod,
        annualGrowthPercent: newGrowth,
        manualGrossSales: newGross,
        manualExemptSales: newExempt,
        manualCwtRates: {},
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to save 2551Q forecast settings', e);
    }
  };

  // Helper to extract existing quarterly data from map or localStorage
  const getRecordedQuarterData = (q: Quarter): { gross: number; exempt: number; cwt: number; rate: number } => {
    if (q === currentQuarter) {
      return {
        gross: currentQuarterData.grossSalesCurrentQuarter || 0,
        exempt: currentQuarterData.exemptSales || 0,
        cwt: currentQuarterData.cwt2307Credits || 0,
        rate: currentQuarterData.taxRatePercent || 3,
      };
    }

    const quarterKey = `${client.id}_${year}_${q}`;
    const inMap = allQuarterDataMap[quarterKey];
    if (inMap && (inMap.grossSalesCurrentQuarter > 0 || inMap.exemptSales > 0)) {
      return {
        gross: inMap.grossSalesCurrentQuarter || 0,
        exempt: inMap.exemptSales || 0,
        cwt: inMap.cwt2307Credits || 0,
        rate: inMap.taxRatePercent || 3,
      };
    }

    // Try reading directly from localStorage for that quarter
    try {
      const savedMap = localStorage.getItem('bir_app_data_v1_2551Q') || localStorage.getItem('bir_tax_data_2551Q');
      if (savedMap) {
        const parsed = JSON.parse(savedMap);
        const data = parsed[quarterKey];
        if (data && (data.grossSalesCurrentQuarter > 0 || data.exemptSales > 0)) {
          return {
            gross: data.grossSalesCurrentQuarter || 0,
            exempt: data.exemptSales || 0,
            cwt: data.cwt2307Credits || 0,
            rate: data.taxRatePercent || 3,
          };
        }
      }
    } catch {
      // Ignore
    }

    // Also check if branch schedule exists for that quarter
    try {
      const bKey = `bir_branch_schedule_${client.id}_${year}_${q}`;
      const bSaved = localStorage.getItem(bKey);
      if (bSaved) {
        const parsed = JSON.parse(bSaved);
        if (parsed.branches && Array.isArray(parsed.branches)) {
          let bGross = 0;
          let bExempt = 0;
          parsed.branches.forEach((br: any) => {
            if (br.salesFiles) {
              Object.values(br.salesFiles).forEach((f: any) => {
                if (f && typeof f.taxableSales === 'number') {
                  bGross += f.taxableSales + (f.exemptSales || 0) + (f.zeroRatedSales || 0);
                  bExempt += f.exemptSales || 0;
                }
              });
            }
          });
          if (bGross > 0) {
            return {
              gross: bGross,
              exempt: bExempt,
              cwt: 0,
              rate: currentQuarterData.taxRatePercent || 3,
            };
          }
        }
      }
    } catch {
      // Ignore
    }

    return {
      gross: 0,
      exempt: 0,
      cwt: 0,
      rate: currentQuarterData.taxRatePercent || 3,
    };
  };

  // Quarter ordering
  const currentQuarterIndex = QUARTERS.indexOf(currentQuarter);

  // Compute forecasts for all 4 quarters
  const forecastItems: QuarterForecastItem[] = useMemo(() => {
    const quartersInfo: { name: Quarter; months: string }[] = [
      { name: 'Q1', months: 'Jan - Mar' },
      { name: 'Q2', months: 'Apr - Jun' },
      { name: 'Q3', months: 'Jul - Sep' },
      { name: 'Q4', months: 'Oct - Dec' },
    ];

    const result: QuarterForecastItem[] = [];

    // First pass: gather baseline actuals for past and current quarters
    const baselines: { gross: number; exempt: number; cwt: number; rate: number }[] = [];
    let sumKnownGross = 0;
    let countKnown = 0;

    for (let i = 0; i < 4; i++) {
      const q = quartersInfo[i].name;
      const isPast = i < currentQuarterIndex;
      const isCurrent = i === currentQuarterIndex;
      const recorded = getRecordedQuarterData(q);

      if (isPast || isCurrent) {
        baselines.push(recorded);
        if (recorded.gross > 0) {
          sumKnownGross += recorded.gross;
          countKnown++;
        }
      } else {
        baselines.push({ gross: 0, exempt: 0, cwt: 0, rate: currentQuarterData.taxRatePercent || 3 });
      }
    }

    // Historical average run-rate per quarter
    const avgHistoricalGross = countKnown > 0 ? sumKnownGross / countKnown : (currentQuarterData.grossSalesCurrentQuarter || 500000);

    // Compute quarter by quarter
    let runningGross = 0;
    for (let i = 0; i < 4; i++) {
      const q = quartersInfo[i].name;
      const isPast = i < currentQuarterIndex;
      const isCurrent = i === currentQuarterIndex;
      const isForecasted = i > currentQuarterIndex;

      let gross = 0;
      let exempt = 0;
      let cwt = 0;
      const rate = currentQuarterData.taxRatePercent || 3;
      let source: QuarterForecastItem['source'] = 'actual';

      if (isPast) {
        const rec = baselines[i];
        gross = rec.gross;
        exempt = rec.exempt;
        cwt = rec.cwt;
        source = 'actual';
      } else if (isCurrent) {
        gross = currentQuarterData.grossSalesCurrentQuarter || 0;
        exempt = currentQuarterData.exemptSales || 0;
        cwt = currentQuarterData.cwt2307Credits || 0;
        source = 'current_form';
      } else {
        // Future quarter: apply forecasting logic or manual override
        if (manualGrossSales[q] !== undefined) {
          gross = manualGrossSales[q] || 0;
          exempt = manualExemptSales[q] !== undefined ? manualExemptSales[q] || 0 : 0;
          source = 'manual_override';
        } else {
          // Compound from previous quarter using QoQ Growth Rate
          const prevGross = i > 0 ? result[i - 1].grossSales : avgHistoricalGross;
          const factor = 1 + (growthPercent / 100);
          gross = Math.max(0, Math.round(prevGross * factor));
          // Exempt sales estimated at same proportion as current quarter or 0
          const exemptRatio = currentQuarterData.grossSalesCurrentQuarter > 0
            ? (currentQuarterData.exemptSales || 0) / currentQuarterData.grossSalesCurrentQuarter
            : 0;
          exempt = Math.round(gross * exemptRatio);
          source = 'forecast_rule';
        }

        // Estimate 2307 withholding (usually ~1% or 2% if withholding agent clients)
        const cwtRatio = currentQuarterData.grossSalesCurrentQuarter > 0
          ? (currentQuarterData.cwt2307Credits || 0) / currentQuarterData.grossSalesCurrentQuarter
          : 0;
        cwt = Math.round(gross * cwtRatio);
      }

      const taxableSales = Math.max(0, gross - exempt);
      const taxDue = Math.round(taxableSales * (rate / 100) * 100) / 100;
      const netTaxPayable = Math.max(0, taxDue - cwt);

      let qoqGrowthPercent: number | null = null;
      if (i > 0 && result[i - 1].grossSales > 0) {
        qoqGrowthPercent = Math.round(((gross - result[i - 1].grossSales) / result[i - 1].grossSales) * 1000) / 10;
      }

      result.push({
        quarter: q,
        label: `${q} ${year}`,
        months: quartersInfo[i].months,
        isPast,
        isCurrent,
        isForecasted,
        grossSales: gross,
        exemptSales: exempt,
        taxableSales,
        taxRatePercent: rate,
        taxDue,
        estimatedCwt: cwt,
        netTaxPayable,
        qoqGrowthPercent,
        source,
      });

      runningGross += gross;
    }

    return result;
  }, [
    currentQuarter,
    currentQuarterIndex,
    currentQuarterData,
    allQuarterDataMap,
    year,
    method,
    growthPercent,
    manualGrossSales,
    manualExemptSales,
  ]);

  // Annual Totals & Summary Metrics
  const annualTotals = useMemo(() => {
    let totalGross = 0;
    let totalExempt = 0;
    let totalTaxable = 0;
    let totalTaxDue = 0;
    let totalCwt = 0;
    let totalNetPayable = 0;

    forecastItems.forEach((item) => {
      totalGross += item.grossSales;
      totalExempt += item.exemptSales;
      totalTaxable += item.taxableSales;
      totalTaxDue += item.taxDue;
      totalCwt += item.estimatedCwt;
      totalNetPayable += item.netTaxPayable;
    });

    const thresholdPercent = Math.min(100, Math.round((totalGross / VAT_ANNUAL_THRESHOLD) * 100));
    const remainingToThreshold = VAT_ANNUAL_THRESHOLD - totalGross;
    const isExceeded = totalGross > VAT_ANNUAL_THRESHOLD;
    const isClose = !isExceeded && totalGross >= VAT_ANNUAL_THRESHOLD * 0.8; // within 80%

    return {
      totalGross,
      totalExempt,
      totalTaxable,
      totalTaxDue,
      totalCwt,
      totalNetPayable,
      avgQuarterGross: Math.round(totalGross / 4),
      thresholdPercent,
      remainingToThreshold,
      isExceeded,
      isClose,
    };
  }, [forecastItems]);

  const activeItem = useMemo(
    () => forecastItems.find((item) => item.quarter === currentQuarter),
    [forecastItems, currentQuarter]
  );
  const nextQuarterItem = useMemo(
    () => forecastItems.find((item) => item.isForecasted),
    [forecastItems]
  );

  // Chart Data Preparation
  const chartData = useMemo(() => {
    let cumGross = 0;
    let cumTax = 0;

    return forecastItems.map((item) => {
      cumGross += item.grossSales;
      cumTax += item.taxDue;

      return {
        quarter: item.quarter,
        displayName: `${item.quarter} (${item.isForecasted ? 'Fcst' : item.isCurrent ? 'Current' : 'Actual'})`,
        status: item.isForecasted ? 'Forecast' : item.isCurrent ? 'Current' : 'Actual',
        grossSales: item.grossSales,
        actualOrCurrentGross: !item.isForecasted ? item.grossSales : 0,
        forecastedGross: item.isForecasted ? item.grossSales : 0,
        taxableSales: item.taxableSales,
        taxDue: item.taxDue,
        cumGross,
        cumTax,
        quarterBenchmark: QUARTER_VAT_BENCHMARK,
        annualThreshold: VAT_ANNUAL_THRESHOLD,
      };
    });
  }, [forecastItems]);

  // Handle Manual Override Change
  const handleManualGrossChange = (q: Quarter, val: number) => {
    const updated = { ...manualGrossSales, [q]: val };
    setManualGrossSales(updated);
    savePreferences(method, growthPercent, updated, manualExemptSales);
  };

  const handleManualExemptChange = (q: Quarter, val: number) => {
    const updated = { ...manualExemptSales, [q]: val };
    setManualExemptSales(updated);
    savePreferences(method, growthPercent, manualGrossSales, updated);
  };

  const handleResetForecasts = () => {
    setManualGrossSales({});
    setManualExemptSales({});
    setGrowthPercent(5);
    savePreferences('growth_rate', 5, {}, {});
    setNotificationMsg('Forecast reset to automated projection model.');
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  const handleApplyToQuarter = (targetQuarter: Quarter) => {
    const targetItem = forecastItems.find((i) => i.quarter === targetQuarter);
    if (!targetItem) return;

    if (onApplyQuarterGrossSales) {
      onApplyQuarterGrossSales(targetQuarter, targetItem.grossSales, targetItem.exemptSales);
      setNotificationMsg(
        `Applied forecasted income of ${formatPHP(targetItem.grossSales)} to ${targetQuarter} return!`
      );
    } else {
      setNotificationMsg(
        `Forecasted income for ${targetQuarter}: ${formatPHP(targetItem.grossSales)}`
      );
    }
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden space-y-0">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-500 text-slate-950 rounded-md uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Income & Tax Forecasting
            </span>
            <span className="text-xs text-amber-200/90 font-mono">
              Taxable Year {year} • Non-VAT Quarterly Projections
            </span>
          </div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            Quarterly Income Run-Rate & Annual 2551Q Projection
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/10 cursor-pointer"
            title="How forecasting works"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-300" />
            <span>{showGuide ? 'Hide Guide' : 'Forecasting Guide'}</span>
          </button>

          <button
            type="button"
            onClick={handleResetForecasts}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg transition-colors cursor-pointer"
            title="Reset forecast overrides to baseline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Quick Guide Drawer */}
      {showGuide && (
        <div className="p-4 bg-amber-50/70 border-b border-amber-200/80 text-xs text-slate-700 space-y-2">
          <div className="font-bold text-amber-900 flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600" />
            <span>How BIR Form 2551Q Forecasting Operates</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="p-2.5 bg-white/80 rounded-lg border border-amber-200">
              <span className="font-semibold text-slate-900 block mb-1">1. Actual vs Forecast</span>
              Quarters preceding {currentQuarter} display recorded actuals. {currentQuarter} reflects your active return inputs, and upcoming quarters project your income using the chosen forecast model.
            </div>
            <div className="p-2.5 bg-white/80 rounded-lg border border-amber-200">
              <span className="font-semibold text-slate-900 block mb-1">2. Custom Overrides</span>
              You can directly edit the Gross Sales in future quarters in the table below, or select a growth percentage rate (e.g. +5% QoQ). Overrides are automatically saved.
            </div>
            <div className="p-2.5 bg-white/80 rounded-lg border border-amber-200">
              <span className="font-semibold text-slate-900 block mb-1">3. ₱3M Non-VAT Ceiling</span>
              Under Tax Code Sec. 236(G), taxpayers exceeding ₱3,000,000 gross annual sales must transition from 3% percentage tax to 12% Value-Added Tax (Form 2550Q).
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notificationMsg && (
        <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {notificationMsg}
          </span>
          <button
            type="button"
            onClick={() => setNotificationMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold px-2 py-0.5"
          >
            ×
          </button>
        </div>
      )}

      {/* Statutory ₱3,000,000 VAT Threshold Monitor Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {annualTotals.isExceeded ? (
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            ) : annualTotals.isClose ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Annual VAT Registration Threshold Watchdog (Sec. 236-G)
              </span>
              <div className="text-xs text-slate-500">
                Statutory Non-VAT Ceiling: <strong className="text-slate-800 font-mono">₱3,000,000.00 / year</strong>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-semibold text-slate-600">
              Projected Annual Gross:{' '}
              <span className="text-sm font-bold font-mono text-slate-900">
                {formatPHP(annualTotals.totalGross)}
              </span>
            </div>
            <div className="text-[11px] font-medium">
              {annualTotals.isExceeded ? (
                <span className="text-rose-700 font-bold">
                  ⚠️ Exceeds ₱3M ceiling by {formatPHP(Math.abs(annualTotals.remainingToThreshold))}
                </span>
              ) : (
                <span className="text-emerald-700">
                  {formatPHP(annualTotals.remainingToThreshold)} remaining headroom
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden relative shadow-inner">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                annualTotals.isExceeded
                  ? 'bg-rose-500'
                  : annualTotals.isClose
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, (annualTotals.totalGross / VAT_ANNUAL_THRESHOLD) * 100)}%` }}
            />
            {/* Marker for 80% warning */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-slate-400/80 z-10"
              style={{ left: '80%' }}
              title="80% threshold caution marker"
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>₱0</span>
            <span>Q1 Benchmark: ₱750K</span>
            <span>Mid-Year: ₱1.50M</span>
            <span>Q3: ₱2.25M</span>
            <span className="font-bold text-slate-700">Limit: ₱3.00M (100%)</span>
          </div>
        </div>

        {annualTotals.isExceeded && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong>Action Required by BIR Regulations:</strong> {client.tradeName}&apos;s projected annual gross income exceeds ₱3,000,000.00. Under BIR regulations, the taxpayer must update their registration (BIR Form 1905) to <strong>VAT-Registered</strong> and begin filing <strong>BIR Form 2550Q (12% VAT)</strong> starting the month following the breach.
            </div>
          </div>
        )}
      </div>

      {/* Control Bar: Forecast Model (QoQ Growth Rate) & Parameter Adjustment */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-amber-600" />
            Forecast Model:
          </span>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs font-semibold shadow-2xs">
            <span>📈 QoQ Growth Rate</span>
          </div>
        </div>

        {/* Growth Rate Stepper / Preset */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-slate-600 font-medium">Assumed QoQ Growth:</span>
          <div className="flex items-center gap-1.5">
            {[-5, 0, 5, 10, 15, 20].map((preset) => (
              <button
                key={preset}
                type="button"
                id={`preset-${preset}-btn`}
                onClick={() => {
                  setGrowthPercent(preset);
                  savePreferences(method, preset, manualGrossSales, manualExemptSales);
                }}
                className={`px-2 py-1 text-xs font-mono rounded cursor-pointer transition-colors ${
                  growthPercent === preset
                    ? 'bg-amber-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                {preset > 0 ? `+${preset}%` : `${preset}%`}
              </button>
            ))}

            <div className="flex items-center pl-2">
              <input
                type="number"
                value={growthPercent}
                onChange={(e) => {
                  const num = parseNumber(e.target.value);
                  setGrowthPercent(num);
                  savePreferences(method, num, manualGrossSales, manualExemptSales);
                }}
                className="w-16 px-2 py-1 text-xs font-mono text-center border border-slate-300 rounded focus:ring-1 focus:ring-amber-500"
              />
              <span className="text-xs text-slate-500 ml-1">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* View Switcher: Table / Graph / Decision Insights */}
      <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-600 mr-1">Forecast View:</span>
          <button
            type="button"
            id="view-mode-table-btn"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>📋 Forecast Table</span>
          </button>
          <button
            type="button"
            id="view-mode-graph-btn"
            onClick={() => setViewMode('graph')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              viewMode === 'graph'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>📊 Forecast Graph</span>
          </button>
          <button
            type="button"
            id="view-mode-insights-btn"
            onClick={() => setViewMode('insights')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              viewMode === 'insights'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>💡 Decision Insights</span>
          </button>
        </div>

        {/* Quick Apply Button for Active Quarter */}
        {activeItem && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleApplyToQuarter(currentQuarter)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-950 bg-amber-200 hover:bg-amber-300 border border-amber-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
              title={`Load forecasted gross sales of ${formatPHP(activeItem.grossSales)} into active ${currentQuarter} return`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-800" />
              <span>Apply {currentQuarter} Forecast ({formatPHP(activeItem.grossSales)})</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Forecasting Table + Visual Chart */}
      <div className="p-4 sm:p-5 space-y-6">
        {/* Section 1: Forecasting Table */}
        {viewMode === 'table' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Quarterly Income & Percentage Tax Schedule ({year})
              </h4>
            </div>
            <div className="text-[11px] text-slate-500">
              Taxable at standard <strong className="text-slate-800 font-mono">{currentQuarterData.taxRatePercent || 3}%</strong> Percentage Tax rate
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
            <table className="w-full text-left text-xs border-collapse min-w-[780px]">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-3 px-3 w-28">Quarter</th>
                  <th className="py-3 px-3 w-32">Status</th>
                  <th className="py-3 px-3 text-right">Gross Sales / Receipts</th>
                  <th className="py-3 px-3 text-right">Exempt Sales</th>
                  <th className="py-3 px-3 text-right">Taxable Base (3%)</th>
                  <th className="py-3 px-3 text-right">Tax Due (3%)</th>
                  <th className="py-3 px-3 text-right">Est. 2307 CWT</th>
                  <th className="py-3 px-3 text-right">Net Tax Payable</th>
                  <th className="py-3 px-3 text-center w-24">QoQ Growth</th>
                  <th className="py-3 px-3 text-center w-28">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {forecastItems.map((item) => {
                  const isCurrent = item.isCurrent;
                  const isForecasted = item.isForecasted;

                  return (
                    <tr
                      key={item.quarter}
                      className={`transition-colors ${
                        isCurrent
                          ? 'bg-amber-50/60 font-medium'
                          : isForecasted
                          ? 'bg-white hover:bg-slate-50/60'
                          : 'bg-slate-50/40 text-slate-700'
                      }`}
                    >
                      {/* Quarter Label */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 font-mono text-sm">
                            {item.quarter}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({item.months})
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {item.isPast ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-700">
                            Recorded
                          </span>
                        ) : isCurrent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-200 text-amber-900 border border-amber-300">
                            Active Return
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-800 border border-violet-200">
                            <Sparkles className="w-2.5 h-2.5 text-violet-600" />
                            {item.source === 'manual_override' ? 'Custom' : 'Forecast'}
                          </span>
                        )}
                      </td>

                      {/* Gross Sales (Editable for Forecasted) */}
                      <td className="py-3 px-3 text-right font-mono">
                        {isForecasted ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-slate-400 text-xs">₱</span>
                            <input
                              type="number"
                              id={`forecast-gross-${item.quarter}`}
                              value={item.grossSales || ''}
                              onChange={(e) =>
                                handleManualGrossChange(item.quarter, parseNumber(e.target.value))
                              }
                              placeholder="0.00"
                              className="w-32 px-2 py-1 text-right font-mono text-xs border border-violet-300 rounded bg-violet-50/40 focus:ring-2 focus:ring-violet-400 font-semibold text-slate-900"
                            />
                          </div>
                        ) : (
                          <span className={`font-bold ${isCurrent ? 'text-amber-950 text-sm' : 'text-slate-800'}`}>
                            {formatPHP(item.grossSales)}
                          </span>
                        )}
                      </td>

                      {/* Exempt Sales */}
                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        {isForecasted ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-slate-400 text-xs">₱</span>
                            <input
                              type="number"
                              id={`forecast-exempt-${item.quarter}`}
                              value={item.exemptSales || ''}
                              onChange={(e) =>
                                handleManualExemptChange(item.quarter, parseNumber(e.target.value))
                              }
                              placeholder="0.00"
                              className="w-24 px-2 py-1 text-right font-mono text-xs border border-slate-300 rounded bg-white focus:ring-1 focus:ring-amber-500 text-slate-700"
                            />
                          </div>
                        ) : (
                          formatPHP(item.exemptSales)
                        )}
                      </td>

                      {/* Taxable Base */}
                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">
                        {formatPHP(item.taxableSales)}
                      </td>

                      {/* Tax Due */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-800">
                        {formatPHP(item.taxDue)}
                      </td>

                      {/* Est. 2307 CWT */}
                      <td className="py-3 px-3 text-right font-mono text-emerald-700">
                        -{formatPHP(item.estimatedCwt, false)}
                      </td>

                      {/* Net Tax Payable */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {formatPHP(item.netTaxPayable)}
                      </td>

                      {/* QoQ Growth % */}
                      <td className="py-3 px-3 text-center font-mono text-[11px]">
                        {item.qoqGrowthPercent !== null ? (
                          <span
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                              item.qoqGrowthPercent > 0
                                ? 'text-emerald-700 bg-emerald-50'
                                : item.qoqGrowthPercent < 0
                                ? 'text-rose-700 bg-rose-50'
                                : 'text-slate-600 bg-slate-100'
                            }`}
                          >
                            {item.qoqGrowthPercent > 0 ? (
                              <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                            ) : item.qoqGrowthPercent < 0 ? (
                              <ArrowDownRight className="w-3 h-3 text-rose-600" />
                            ) : null}
                            {item.qoqGrowthPercent > 0 ? `+${item.qoqGrowthPercent}%` : `${item.qoqGrowthPercent}%`}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-center">
                        {isForecasted && (
                          <button
                            type="button"
                            onClick={() => handleApplyToQuarter(item.quarter)}
                            className="px-2 py-1 text-[10px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded transition-colors cursor-pointer whitespace-nowrap"
                            title={`Load forecasted sales of ${formatPHP(item.grossSales)} into ${item.quarter}`}
                          >
                            Sync {item.quarter}
                          </button>
                        )}
                        {isCurrent && (
                          <span className="text-[10px] text-amber-700 font-semibold">Active In Form</span>
                        )}
                        {item.isPast && (
                          <span className="text-[10px] text-slate-400">Locked</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Annual Totals Summary Row */}
                <tr className="bg-slate-900 text-white font-semibold">
                  <td className="py-3 px-3">
                    <div className="font-bold uppercase tracking-wider text-amber-400 text-xs">
                      Full Year {year}
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal">Annual Total</div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-slate-950">
                      Projected Year
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-amber-300 text-sm">
                    {formatPHP(annualTotals.totalGross)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">
                    {formatPHP(annualTotals.totalExempt)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-white">
                    {formatPHP(annualTotals.totalTaxable)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">
                    {formatPHP(annualTotals.totalTaxDue)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-400">
                    -{formatPHP(annualTotals.totalCwt, false)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-white text-sm">
                    {formatPHP(annualTotals.totalNetPayable)}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-slate-400 text-[11px]">
                    Avg: {formatPHP(annualTotals.avgQuarterGross)}/Q
                  </td>
                  <td className="py-3 px-3 text-center text-[10px] text-amber-300">
                    {annualTotals.thresholdPercent}% of ₱3M
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* Section 2: Visual Forecast Graph */}
        {viewMode === 'graph' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Income Run-Rate & Tax Liability Visualization
              </h4>
            </div>

            <div className="inline-flex bg-slate-100 p-0.5 rounded-lg text-xs font-medium border border-slate-200">
              <button
                type="button"
                id="chart-tab-quarterly-btn"
                onClick={() => setActiveChartTab('quarterly')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  activeChartTab === 'quarterly'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📊 Quarterly Breakdown
              </button>
              <button
                type="button"
                id="chart-tab-cumulative-btn"
                onClick={() => setActiveChartTab('cumulative')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  activeChartTab === 'cumulative'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📈 Cumulative vs ₱3M Threshold
              </button>
            </div>
          </div>

          {/* Graph Container */}
          <div className="p-4 bg-slate-50/50 border border-slate-200 rounded-xl">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {activeChartTab === 'quarterly' ? (
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 15, right: 25, bottom: 20, left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="displayName"
                      tick={{ fontSize: 11, fill: '#475569' }}
                      tickLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis
                      yAxisId="left"
                      tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: '#475569' }}
                      tickLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: '#d97706' }}
                      tickLine={{ stroke: '#fde68a' }}
                    />
                    <Tooltip
                      formatter={(value: any, name: string) => {
                        const num = typeof value === 'number' ? value : Number(value || 0);
                        if (name === 'Tax Due (3%)') return [formatPHP(num), name];
                        if (name === 'Quarter Benchmark') return [formatPHP(num), '₱750k Quarterly VAT Run-Rate'];
                        return [formatPHP(num), name];
                      }}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        color: '#f8fafc',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    />
                    <ReferenceLine
                      yAxisId="left"
                      y={QUARTER_VAT_BENCHMARK}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{
                        value: '₱750k/Q Benchmark (₱3M VAT Cap)',
                        fill: '#b45309',
                        fontSize: 10,
                        position: 'top',
                      }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="actualOrCurrentGross"
                      name="Actual / Current Gross Sales"
                      fill="#d97706"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={45}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="forecastedGross"
                      name="Forecasted Gross Sales"
                      fill="#8b5cf6"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={45}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="taxDue"
                      name="Percentage Tax Due (3%)"
                      stroke="#ea580c"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#ea580c' }}
                    />
                  </ComposedChart>
                ) : (
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 15, right: 25, bottom: 20, left: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="displayName"
                      tick={{ fontSize: 11, fill: '#475569' }}
                    />
                    <YAxis
                      tickFormatter={(val) => `₱${(val / 1000000).toFixed(1)}M`}
                      domain={[0, (dataMax: number) => Math.max(3500000, Math.ceil(dataMax * 1.15))]}
                      tick={{ fontSize: 11, fill: '#475569' }}
                    />
                    <Tooltip
                      formatter={(value: any, name: string) => [
                        formatPHP(typeof value === 'number' ? value : Number(value || 0)),
                        name,
                      ]}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        color: '#f8fafc',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    />
                    <ReferenceLine
                      y={VAT_ANNUAL_THRESHOLD}
                      stroke="#ef4444"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={{
                        value: '₱3,000,000 Statutory VAT Ceiling',
                        fill: '#dc2626',
                        fontSize: 11,
                        fontWeight: 700,
                        position: 'insideTopRight',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumGross"
                      name="Cumulative Gross Sales (Trajectory)"
                      stroke="#d97706"
                      fill="#fef3c7"
                      strokeWidth={2.5}
                      dot={{ r: 5, fill: '#d97706' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumTax"
                      name="Cumulative 3% Tax Paid"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#7c3aed' }}
                    />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        )}

        {/* Section 3: Decision Intelligence & Tax Strategy Cards */}
        {viewMode === 'insights' && (
          <div className="pt-2 border-t border-slate-200 space-y-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Strategic Tax Decision Insights & Regulatory Action Items
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Insight Card 1: VAT Threshold Watchdog */}
              <div className={`p-4 rounded-xl border ${
                annualTotals.isExceeded
                  ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                  : annualTotals.isClose
                  ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                  : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    annualTotals.isExceeded
                      ? 'bg-rose-100 text-rose-700'
                      : annualTotals.isClose
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {annualTotals.isExceeded ? (
                      <ShieldAlert className="w-5 h-5" />
                    ) : (
                      <ShieldCheck className="w-5 h-5" />
                    )}
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-bold">
                        ₱3M VAT Threshold Watchdog (Sec. 236-G)
                      </h5>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-white/70">
                        {annualTotals.thresholdPercent}% of ₱3M
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed opacity-90">
                      {annualTotals.isExceeded ? (
                        <>
                          <strong>CRITICAL BREACH:</strong> Forecasted gross sales of{' '}
                          <span className="font-mono font-bold">{formatPHP(annualTotals.totalGross)}</span> exceed
                          the statutory ₱3,000,000 non-VAT ceiling. Taxpayer must file{' '}
                          <strong>BIR Form 1905</strong> with their RDO within 30 days of the month following the breach to
                          convert to 12% Value-Added Tax (Form 2550Q), and claim Transitional Input Tax (Sec. 111).
                        </>
                      ) : annualTotals.isClose ? (
                        <>
                          <strong>ELEVATED MONITORING:</strong> Taxpayer is within 20% of the VAT ceiling with only{' '}
                          <span className="font-mono font-bold">{formatPHP(annualTotals.remainingToThreshold)}</span>{' '}
                          cushion remaining. If revenue spikes in later quarters, prepare accounting systems for VAT invoice transitions.
                        </>
                      ) : (
                        <>
                          <strong>SAFE NON-VAT STATUS:</strong> Projected sales remain comfortably within the Non-VAT threshold with{' '}
                          <span className="font-mono font-bold">{formatPHP(annualTotals.remainingToThreshold)}</span>{' '}
                          headroom. The taxpayer is fully eligible to continue filing quarterly Percentage Tax Form 2551Q at 3%.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Insight Card 2: 3% Tax Cash Reserve Planner */}
              <div className="p-4 rounded-xl border bg-blue-50/80 border-blue-200 text-blue-950">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <h5 className="text-sm font-bold">
                      Recommended 3% Percentage Tax Cash Reserve
                    </h5>
                    <p className="text-xs leading-relaxed opacity-90">
                      Based on forecasted annual taxable sales of{' '}
                      <span className="font-mono font-bold">{formatPHP(annualTotals.totalTaxable)}</span>, the total projected
                      percentage tax liability is{' '}
                      <span className="font-mono font-bold text-blue-800">{formatPHP(annualTotals.totalTaxDue)}</span>.
                    </p>
                    <div className="pt-1 flex items-center gap-3 text-xs font-mono">
                      <div className="bg-white/80 px-2.5 py-1 rounded border border-blue-200">
                        <span className="text-[10px] text-slate-500 block uppercase">Per Quarter Buffer</span>
                        <strong className="text-blue-900">{formatPHP(annualTotals.totalTaxDue / 4)}</strong>
                      </div>
                      <div className="bg-white/80 px-2.5 py-1 rounded border border-blue-200">
                        <span className="text-[10px] text-slate-500 block uppercase">Monthly Allocation</span>
                        <strong className="text-blue-900">{formatPHP(annualTotals.totalTaxDue / 12)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Insight Card 3: 8% Flat Tax Option vs 2551Q */}
              <div className="p-4 rounded-xl border bg-purple-50/80 border-purple-200 text-purple-950">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <h5 className="text-sm font-bold">
                      8% Gross Income Tax Alternative (Form 1701Q)
                    </h5>
                    <p className="text-xs leading-relaxed opacity-90">
                      Under the TRAIN Law (RA 10963) & eOPT, self-employed individuals & professionals whose gross sales do not
                      exceed ₱3M can elect the <strong>8% income tax rate</strong> on gross receipts in excess of ₱250,000.
                    </p>
                    <p className="text-[11px] font-medium text-purple-900 bg-white/70 p-2 rounded border border-purple-200">
                      💡 <em>Advantage:</em> Electing the 8% option <strong>completely exempts</strong> the taxpayer from filing Form 2551Q
                      and paying the 3% percentage tax, saving both compliance overhead and cash flow for high-margin service providers.
                    </p>
                  </div>
                </div>
              </div>

              {/* Insight Card 4: Form 2307 Creditable Withholding Tax Strategy */}
              <div className="p-4 rounded-xl border bg-amber-50/80 border-amber-200 text-amber-950">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <h5 className="text-sm font-bold">
                      Form 2307 CWT Credit Collection Strategy
                    </h5>
                    <p className="text-xs leading-relaxed opacity-90">
                      Estimated withholding tax credits of{' '}
                      <span className="font-mono font-bold text-amber-900">-{formatPHP(annualTotals.totalCwt, false)}</span>{' '}
                      are factored into this forecast. Top withholding agents withhold 1% on goods and 2% on services.
                    </p>
                    <p className="text-[11px] opacity-90">
                      Ensure actual signed BIR Form 2307 certificates are requested from corporate clients each quarter before filing
                      to legally offset against Line 17 Net Tax Payable.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Annual Highlights & Decision Summary Bar (Always Visible) */}
        <div className="pt-2 border-t border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Projected Annual Sales ({year})
              </span>
              <span className="text-base font-bold font-mono text-slate-900 mt-0.5 block">
                {formatPHP(annualTotals.totalGross)}
              </span>
              <span className="text-[11px] text-slate-500">
                Taxable: {formatPHP(annualTotals.totalTaxable)}
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Average Run-Rate
              </span>
              <span className="text-base font-bold font-mono text-amber-700 mt-0.5 block">
                {formatPHP(annualTotals.avgQuarterGross)}
              </span>
              <span className="text-[11px] text-slate-500">
                per quarter run-rate
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Annual 3% Tax Due
              </span>
              <span className="text-base font-bold font-mono text-slate-900 mt-0.5 block">
                {formatPHP(annualTotals.totalTaxDue)}
              </span>
              <span className="text-[11px] text-emerald-600 font-mono">
                Net Pay: {formatPHP(annualTotals.totalNetPayable)}
              </span>
            </div>

            <div
              className={`p-3 rounded-xl border shadow-2xs ${
                annualTotals.isExceeded
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider block opacity-80">
                {annualTotals.isExceeded ? 'Threshold Status' : 'Non-VAT Headroom'}
              </span>
              <span className="text-base font-bold font-mono mt-0.5 block">
                {annualTotals.isExceeded
                  ? 'Breached (Mandatory VAT)'
                  : formatPHP(annualTotals.remainingToThreshold)}
              </span>
              <span className="text-[11px] opacity-80">
                {annualTotals.thresholdPercent}% of ₱3M ceiling
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

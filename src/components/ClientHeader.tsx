import React, { useMemo } from 'react';
import {
  ClientProfile,
  Quarter,
  TaxClassification,
} from '../types/tax';
import { getRealTimeTaxPeriod } from '../utils/taxCalculations';
import {
  Building2,
  User,
  Plus,
  Edit2,
  Calendar,
  Download,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { InstallButton } from './InstallButton';

interface ClientHeaderProps {
  clients: ClientProfile[];
  activeClient: ClientProfile | null;
  activeTab?: string;
  onSelectClient: (client: ClientProfile) => void;
  onOpenAddClient: () => void;
  onOpenEditClient: () => void;
  onDeleteClient?: () => void;
  quarter: Quarter;
  onSelectQuarter: (q: Quarter) => void;
  month: number;
  onSelectMonth: (m: number) => void;
  year: number;
  onSelectYear: (y: number) => void;
  onExportData?: () => void;
  onImportData?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenCalendar?: () => void;
}

const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
const MONTHS = [
  { val: 1, label: 'Jan' },
  { val: 2, label: 'Feb' },
  { val: 3, label: 'Mar' },
  { val: 4, label: 'Apr' },
  { val: 5, label: 'May' },
  { val: 6, label: 'Jun' },
  { val: 7, label: 'Jul' },
  { val: 8, label: 'Aug' },
  { val: 9, label: 'Sep' },
  { val: 10, label: 'Oct' },
  { val: 11, label: 'Nov' },
  { val: 12, label: 'Dec' },
];

function getClassificationBadge(c: TaxClassification) {
  switch (c) {
    case 'Corporation':
      return { text: 'Corporation', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'Non-Stock':
      return { text: 'Non-Stock Corporation', color: 'bg-teal-50 text-teal-700 border-teal-200' };
    case 'Partnership':
      return { text: 'Partnership / GPP', color: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'Single':
      return { text: 'Single Proprietorship', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
}

function getMonthsForQuarter(q: Quarter): [number, number, number] {
  switch (q) {
    case 'Q1':
      return [1, 2, 3];
    case 'Q2':
      return [4, 5, 6];
    case 'Q3':
      return [7, 8, 9];
    case 'Q4':
      return [10, 11, 12];
  }
}

export const ClientHeader: React.FC<ClientHeaderProps> = ({
  clients,
  activeClient,
  activeTab,
  onSelectClient,
  onOpenAddClient,
  onOpenEditClient,
  onDeleteClient,
  quarter,
  onSelectQuarter,
  month,
  onSelectMonth,
  year,
  onSelectYear,
  onExportData,
  onImportData,
  onOpenCalendar,
}) => {
  const badge = activeClient ? getClassificationBadge(activeClient.classification) : null;
  const isCorp = activeClient
    ? activeClient.classification === 'Corporation' ||
      activeClient.classification === 'Non-Stock' ||
      activeClient.classification === 'Partnership'
    : false;

  // Real-time tax period calculation (follows system device date)
  const realTimePeriod = useMemo(() => getRealTimeTaxPeriod(), []);
  const isRealTime = year === realTimePeriod.year && quarter === realTimePeriod.quarter;

  // Dynamic available years based on real-time current year
  const availableYears = useMemo(() => {
    const cur = realTimePeriod.year;
    const start = Math.min(2023, cur - 2);
    const end = Math.max(cur + 2, 2027);
    const list: number[] = [];
    for (let y = start; y <= end; y++) {
      list.push(y);
    }
    return list;
  }, [realTimePeriod.year]);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 space-y-3">
        {/* Top row: Brand & Global Tools */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              BIR
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                Accounting Firm Tax Returns Calculator
              </h1>
              <p className="text-xs text-slate-500">
                Philippine BIR Computation Engine • Republic Act No. 11976 (EOPT Act) Compliant
              </p>
            </div>
          </div>

          {/* Quick period picker & JSON export/import */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Real-time sync badge or Reset button */}
            {isRealTime ? (
              <div
                className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold shadow-2xs"
                title={`Following real-time date: Taxable Year ${realTimePeriod.year}, ${realTimePeriod.quarter}`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Real-time ({realTimePeriod.quarter} {realTimePeriod.year})</span>
              </div>
            ) : (
              <button
                id="header-sync-realtime-btn"
                onClick={() => {
                  onSelectYear(realTimePeriod.year);
                  onSelectQuarter(realTimePeriod.quarter);
                  onSelectMonth(realTimePeriod.month);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                title={`Reset period to follow real-time date: ${realTimePeriod.quarter} ${realTimePeriod.year}`}
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                <span>Today ({realTimePeriod.quarter} {realTimePeriod.year})</span>
              </button>
            )}

            {/* Year Selector */}
            <select
              id="tax-year-select"
              value={year}
              onChange={(e) => onSelectYear(parseInt(e.target.value))}
              className="px-2.5 py-1.5 text-xs font-mono font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              title="Select Taxable Year"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  TY {y} {y === realTimePeriod.year ? '• Today' : ''}
                </option>
              ))}
            </select>

            {/* Context-aware Period Selector based on Active Form Tab */}
            {activeTab === 'annual' ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Annual Taxable Year (Jan 1 - Dec 31)</span>
              </div>
            ) : activeTab === '1601C' ? (
              /* For 1601C: strictly monthly return, reflecting all 12 Months */
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium overflow-x-auto max-w-full">
                <span className="text-[10px] uppercase font-bold text-slate-400 px-1.5 hidden md:inline">
                  Month:
                </span>
                {MONTHS.map((m) => {
                  const isCurrentRealM = m.val === realTimePeriod.month && year === realTimePeriod.year;
                  return (
                    <button
                      key={m.val}
                      id={`header-1601c-month-${m.val}`}
                      onClick={() => onSelectMonth(m.val)}
                      className={`relative px-2 py-1 rounded-md transition-colors whitespace-nowrap ${
                        month === m.val
                          ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title={`${m.label} (Month ${m.val})`}
                    >
                      {m.label}
                      {isCurrentRealM && (
                        <span
                          className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                            month === m.val ? 'bg-emerald-300 ring-1 ring-slate-900' : 'bg-emerald-500'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : activeTab === '1601EQ' ? (
              /* For 1601EQ / 0619E: Monthly & Quarterly Combine */
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Quarter Switcher */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
                  {QUARTERS.map((q) => {
                    const isCurrentRealQ = q === realTimePeriod.quarter && year === realTimePeriod.year;
                    return (
                      <button
                        key={q}
                        id={`quarter-btn-${q}`}
                        onClick={() => onSelectQuarter(q)}
                        className={`relative px-2 py-1 rounded-md transition-colors ${
                          quarter === q
                            ? 'bg-slate-900 text-white shadow-xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title={q}
                      >
                        {q}
                        {isCurrentRealQ && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Months of active quarter */}
                <div className="flex items-center gap-1 bg-teal-50/80 p-0.5 rounded-lg border border-teal-200 text-xs">
                  {getMonthsForQuarter(quarter).map((mNum, idx) => {
                    const isQEnd = idx === 2;
                    const mObj = MONTHS[mNum - 1];
                    const isSelectedMonth = month === mNum;
                    return (
                      <button
                        key={mNum}
                        id={`header-ewt-month-${mNum}`}
                        onClick={() => onSelectMonth(mNum)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          isSelectedMonth
                            ? 'bg-teal-700 text-white font-semibold shadow-xs'
                            : 'text-teal-800 hover:bg-teal-100'
                        }`}
                        title={
                          isQEnd
                            ? `${mObj.label}: Month 3 (Quarterly Close 1601-EQ)`
                            : `${mObj.label}: Month ${idx + 1} (Form 0619-E Monthly Remittance)`
                        }
                      >
                        {mObj.label} {isQEnd ? '(1601-EQ)' : '(0619-E)'}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Standard Quarterly Returns (1701Q, 1702Q, 2550Q, 2551Q, summary) */
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
                  {QUARTERS.map((q) => {
                    const isCurrentRealQ = q === realTimePeriod.quarter && year === realTimePeriod.year;
                    return (
                      <button
                        key={q}
                        id={`quarter-btn-${q}`}
                        onClick={() => onSelectQuarter(q)}
                        className={`relative px-2 py-1 rounded-md transition-colors ${
                          quarter === q
                            ? 'bg-slate-900 text-white shadow-xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title={isCurrentRealQ ? `${q} (Real-time current quarter)` : q}
                      >
                        {q}
                        {isCurrentRealQ && (
                          <span
                            className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                              quarter === q ? 'bg-emerald-400 ring-1 ring-slate-900' : 'bg-emerald-500'
                            }`}
                            title="Real-time quarter"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {onOpenCalendar && (
              <button
                id="header-deadlines-calendar-btn"
                onClick={onOpenCalendar}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg shadow-2xs transition-colors"
                title="View BIR Tax Deadline Calendar"
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Deadlines</span>
              </button>
            )}

            {/* PC Download / Install PWA Button */}
            <InstallButton />
          </div>
        </div>

        {/* Bottom row: Active Client Selector & Details Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Client:
            </span>

            {activeClient ? (
              <>
                <select
                  id="active-client-select"
                  value={activeClient.id}
                  onChange={(e) => {
                    const found = clients.find((c) => c.id === e.target.value);
                    if (found) onSelectClient(found);
                  }}
                  className="px-3 py-1.5 text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 max-w-xs truncate"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.tradeName} ({c.tin})
                    </option>
                  ))}
                </select>

                <button
                  id="edit-active-client-btn"
                  onClick={onOpenEditClient}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Edit active client details"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                {onDeleteClient && (
                  <button
                    id="delete-active-client-btn"
                    onClick={onDeleteClient}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title={`Delete ${activeClient.tradeName}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            ) : (
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-500 rounded-md border border-slate-200">
                No Client Registered (Clean Slate)
              </span>
            )}

            <button
              id="add-new-client-btn"
              onClick={onOpenAddClient}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Client</span>
            </button>
          </div>

          {/* Client Details Badges */}
          {activeClient && badge && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span
                className={`px-2.5 py-1 rounded-md border font-medium ${badge.color}`}
              >
                {badge.text}
              </span>

              <span
                className={`px-2.5 py-1 rounded-md border font-medium ${
                  activeClient.vatStatus === 'vat-registered'
                    ? 'bg-violet-50 text-violet-700 border-violet-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {activeClient.vatStatus === 'vat-registered' ? 'VAT Registered (12%)' : 'Non-VAT (3%)'}
              </span>

              {activeClient.isWithholdingAgent && (
                <span className="px-2.5 py-1 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
                  Withholding Agent
                </span>
              )}

              <span className="text-slate-500 font-mono hidden sm:inline">
                {activeClient.rdo}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

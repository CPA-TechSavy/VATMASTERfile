import React from 'react';
import {
  ClientProfile,
  Quarter,
  TaxClassification,
} from '../types/tax';
import {
  Building2,
  User,
  Plus,
  Edit2,
  Calendar,
  Download,
  Upload,
  Trash2,
} from 'lucide-react';

interface ClientHeaderProps {
  clients: ClientProfile[];
  activeClient: ClientProfile;
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
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
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

export const ClientHeader: React.FC<ClientHeaderProps> = ({
  clients,
  activeClient,
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
  const badge = getClassificationBadge(activeClient.classification);
  const isCorp = activeClient.classification === 'Corporation' || activeClient.classification === 'Non-Stock' || activeClient.classification === 'Partnership';

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
            {/* Year Selector */}
            <select
              id="tax-year-select"
              value={year}
              onChange={(e) => onSelectYear(parseInt(e.target.value))}
              className="px-2.5 py-1.5 text-xs font-mono font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  TY {y}
                </option>
              ))}
            </select>

            {/* Quarter Selector */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
              {QUARTERS.map((q) => (
                <button
                  key={q}
                  id={`quarter-btn-${q}`}
                  onClick={() => onSelectQuarter(q)}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    quarter === q
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Month Selector for 1601C / 0619E */}
            <select
              id="tax-month-select"
              value={month}
              onChange={(e) => onSelectMonth(parseInt(e.target.value))}
              className="px-2 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              {MONTHS.map((m) => (
                <option key={m.val} value={m.val}>
                  {m.label} (Mo. {m.val})
                </option>
              ))}
            </select>

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

            {/* Backup / Export */}
            <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
              <button
                id="export-tax-backup-btn"
                onClick={onExportData}
                title="Export Clients & Calculations to JSON"
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
              <label
                id="import-tax-backup-label"
                title="Import JSON Backup"
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <input
                  type="file"
                  accept=".json"
                  onChange={onImportData}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Bottom row: Active Client Selector & Details Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Client:
            </span>

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
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Edit active client details"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>

            {onDeleteClient && (
              <button
                id="delete-active-client-btn"
                onClick={onDeleteClient}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title={`Delete ${activeClient.tradeName}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              id="add-new-client-btn"
              onClick={onOpenAddClient}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Client</span>
            </button>
          </div>

          {/* Client Details Badges */}
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
        </div>
      </div>
    </header>
  );
};

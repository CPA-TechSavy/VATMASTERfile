import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Building,
  Calendar,
  Layers,
  Download,
  Filter,
  ArrowUpDown,
  ShoppingBag,
  CreditCard,
  Building2,
} from 'lucide-react';
import { Quarter, ClientProfile } from '../types/tax';
import { MonthIndex, BirTransactionRow, ClientBranchSchedule } from '../types/branchVat';

const formatPHP = (num: number) => {
  return (num || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export interface CombinedPurchasesRow extends BirTransactionRow {
  monthIndex: MonthIndex;
  monthLabel: string;
  monthName: string;
  branchName: string;
  branchId: string;
}

interface CombinedPurchasesModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientProfile;
  quarter: Quarter;
  year: number;
  branches: ClientBranchSchedule[];
  allTransactions: CombinedPurchasesRow[];
}

export const CombinedPurchasesModal: React.FC<CombinedPurchasesModalProps> = ({
  isOpen,
  onClose,
  client,
  quarter,
  year,
  branches,
  allTransactions,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'rowNum' | 'registeredName' | 'taxableAmount' | 'taxAmount'>('rowNum');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Unique list of suppliers for filter dropdown
  const uniqueSuppliers = useMemo(() => {
    const map = new Map<string, { name: string; tin: string; count: number; totalTaxable: number }>();
    allTransactions.forEach((tx) => {
      const name = (tx.registeredName || 'UNNAMED SUPPLIER').trim().toUpperCase();
      const existing = map.get(name);
      if (existing) {
        existing.count += 1;
        existing.totalTaxable += tx.taxableAmount || 0;
      } else {
        map.set(name, {
          name: tx.registeredName || 'UNNAMED SUPPLIER',
          tin: tx.tin || '',
          count: 1,
          totalTaxable: tx.taxableAmount || 0,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.totalTaxable - a.totalTaxable);
  }, [allTransactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return allTransactions
      .filter((tx) => {
        if (branchFilter !== 'all' && tx.branchId !== branchFilter) {
          return false;
        }
        if (monthFilter !== 'all' && String(tx.monthIndex) !== monthFilter) {
          return false;
        }
        if (
          supplierFilter !== 'all' &&
          (tx.registeredName || '').trim().toUpperCase() !== supplierFilter.trim().toUpperCase()
        ) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = (tx.registeredName || '').toLowerCase().includes(q);
          const matchTin = (tx.tin || '').toLowerCase().includes(q);
          const matchBranch = (tx.branchName || '').toLowerCase().includes(q);
          const matchAddress = (tx.address || '').toLowerCase().includes(q);
          if (!matchName && !matchTin && !matchBranch && !matchAddress) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === 'string') {
          valA = (valA as string).toLowerCase();
          valB = ((valB as string) || '').toLowerCase();
        }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [allTransactions, branchFilter, monthFilter, supplierFilter, searchQuery, sortField, sortOrder]);

  // Filtered totals
  const filteredTotals = useMemo(() => {
    let gross = 0;
    let exempt = 0;
    let zeroRated = 0;
    let taxable = 0;
    let inputTax = 0;
    let goods = 0;
    let services = 0;
    let capital = 0;

    filteredTransactions.forEach((tx) => {
      gross += tx.grossAmount || 0;
      exempt += tx.exemptAmount || 0;
      zeroRated += tx.zeroRatedAmount || 0;
      taxable += tx.taxableAmount || 0;
      inputTax += tx.taxAmount || 0;
      goods += tx.goodsOtherThanCapitalAmount || 0;
      services += tx.servicesAmount || 0;
      capital += tx.capitalGoodsAmount || 0;
    });

    return {
      gross,
      exempt,
      zeroRated,
      taxable,
      inputTax,
      goods,
      services,
      capital,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  // Overall totals across all quarter purchases
  const overallTotals = useMemo(() => {
    let gross = 0;
    let taxable = 0;
    let inputTax = 0;
    allTransactions.forEach((tx) => {
      gross += tx.grossAmount || 0;
      taxable += tx.taxableAmount || 0;
      inputTax += tx.taxAmount || 0;
    });
    return { gross, taxable, inputTax, count: allTransactions.length };
  }, [allTransactions]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Branch',
      'Month',
      'Row #',
      'TIN',
      'Supplier Registered Name',
      'Address',
      'Gross Purchases',
      'Exempt Purchases',
      'Zero-Rated Purchases',
      'Taxable Purchases (Goods/Services/Capital)',
      'Input Tax (12%)',
    ];

    const rows = filteredTransactions.map((tx) => [
      `"${(tx.branchName || '').replace(/"/g, '""')}"`,
      `"${tx.monthLabel} (${tx.monthName})"`,
      tx.rowNum,
      `"${tx.tin || ''}"`,
      `"${(tx.registeredName || '').replace(/"/g, '""')}"`,
      `"${(tx.address || '').replace(/"/g, '""')}"`,
      tx.grossAmount || 0,
      tx.exemptAmount || 0,
      tx.zeroRatedAmount || 0,
      tx.taxableAmount || 0,
      tx.taxAmount || 0,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Combined_Purchases_${client.tradeName.replace(/\s+/g, '_')}_${quarter}_${year}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div
      id="combined-purchases-modal-backdrop"
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-6"
    >
      <div
        id="combined-purchases-modal"
        className="bg-white rounded-2xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-600 text-white tracking-wider">
                COMBINED PURCHASES REPORT
              </span>
              <span className="text-xs text-amber-200 font-medium">
                {quarter} {year} • {client.registeredName || client.tradeName}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold mt-1 text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-400" />
              <span>Combined Purchases across Branches</span>
              <span className="text-xs font-normal text-amber-300 font-mono">
                ({allTransactions.length} total recorded line items)
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              disabled={filteredTransactions.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-colors disabled:opacity-50 cursor-pointer"
              title="Export filtered purchases to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary Metrics Cards */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span>Transactions</span>
              <Layers className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="mt-1 text-base sm:text-lg font-bold text-slate-900 font-mono">
              {filteredTotals.count}
              <span className="text-xs text-slate-400 font-normal ml-1">of {overallTotals.count}</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              Across {branches.length} branch{branches.length === 1 ? '' : 'es'}
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span>Gross Purchases</span>
              <CreditCard className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="mt-1 text-base sm:text-lg font-bold text-slate-900 font-mono">
              ₱{formatPHP(filteredTotals.gross)}
            </div>
            <div className="text-[10px] text-slate-400">Total invoice amounts</div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs bg-amber-50/20">
            <div className="flex items-center justify-between text-[11px] text-amber-900 font-medium">
              <span>Taxable Purchases</span>
              <Building2 className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="mt-1 text-base sm:text-lg font-bold text-amber-900 font-mono">
              ₱{formatPHP(filteredTotals.taxable)}
            </div>
            <div className="text-[10px] text-amber-700">Goods, services, & capital</div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-amber-300 shadow-2xs bg-amber-50/40">
            <div className="flex items-center justify-between text-[11px] text-amber-950 font-bold">
              <span>Input Tax (12%)</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-amber-600 text-white rounded font-mono font-bold">
                Schedule 2
              </span>
            </div>
            <div className="mt-1 text-base sm:text-lg font-bold text-amber-800 font-mono">
              ₱{formatPHP(filteredTotals.inputTax)}
            </div>
            <div className="text-[10px] text-amber-700">Allowable input tax credits</div>
          </div>
        </div>

        {/* Filter Controls Toolbar */}
        <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                id="combined-purchases-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search supplier, TIN, branch, address..."
                className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Branch Filter */}
            <div className="flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                id="combined-purchases-branch-filter"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-amber-500"
              >
                <option value="all">All Branches ({branches.length})</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Filter */}
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                id="combined-purchases-month-filter"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-amber-500"
              >
                <option value="all">All Months</option>
                <option value="1">1st Month</option>
                <option value="2">2nd Month</option>
                <option value="3">3rd Month</option>
              </select>
            </div>

            {/* Supplier Dropdown Filter */}
            <div className="flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                id="combined-purchases-supplier-filter"
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-slate-700 max-w-[220px] truncate focus:ring-2 focus:ring-amber-500"
              >
                <option value="all">All Suppliers ({uniqueSuppliers.length})</option>
                {uniqueSuppliers.map((s, idx) => (
                  <option key={idx} value={s.name}>
                    {s.name} ({s.count} txn{s.count === 1 ? '' : 's'})
                  </option>
                ))}
              </select>
            </div>

            {(branchFilter !== 'all' || monthFilter !== 'all' || supplierFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setBranchFilter('all');
                  setMonthFilter('all');
                  setSupplierFilter('all');
                  setSearchQuery('');
                }}
                className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline px-1.5 py-1"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Purchases Data Table */}
        <div className="overflow-auto flex-1 bg-white">
          {filteredTransactions.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <ShoppingBag className="w-8 h-8 text-slate-300 stroke-[1.5]" />
              <div className="font-semibold text-slate-600">No purchase transactions found</div>
              <p className="text-slate-400 max-w-sm">
                {allTransactions.length === 0
                  ? 'No purchases Excel files have been uploaded for branches in this quarter yet.'
                  : 'No records match your active search and filter criteria. Try clearing the filters.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 z-10 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 border-r border-slate-200 w-12 text-center">#</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Branch</th>
                  <th className="py-2.5 px-2.5 border-r border-slate-200">Month</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Supplier TIN</th>
                  <th
                    className="py-2.5 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60"
                    onClick={() => handleSort('registeredName')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Registered Supplier Name</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Address</th>
                  <th className="py-2.5 px-2.5 text-right border-r border-slate-200">Gross Purchases</th>
                  <th className="py-2.5 px-2.5 text-right border-r border-slate-200">Exempt</th>
                  <th className="py-2.5 px-2.5 text-right border-r border-slate-200">Zero-Rated</th>
                  <th
                    className="py-2.5 px-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60"
                    onClick={() => handleSort('taxableAmount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Taxable Purchases</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="py-2.5 px-2.5 text-right bg-amber-100/70 text-amber-950 font-bold cursor-pointer hover:bg-amber-200/70"
                    onClick={() => handleSort('taxAmount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Input Tax (12%)</span>
                      <ArrowUpDown className="w-3 h-3 text-amber-800" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-amber-50/20 transition-colors">
                    <td className="py-2 px-3 text-center text-slate-400 font-mono border-r border-slate-100">
                      {tx.rowNum || idx + 1}
                    </td>
                    <td className="py-2 px-3 text-slate-700 font-medium border-r border-slate-100 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Building className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{tx.branchName}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2.5 text-slate-600 border-r border-slate-100 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium">
                        {tx.monthLabel}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-800 font-mono border-r border-slate-100 whitespace-nowrap">
                      {tx.tin || '—'}
                    </td>
                    <td className="py-2 px-3 text-slate-900 font-medium border-r border-slate-100 max-w-[200px] truncate" title={tx.registeredName}>
                      {tx.registeredName || '—'}
                    </td>
                    <td className="py-2 px-3 text-slate-500 border-r border-slate-100 max-w-[180px] truncate" title={tx.address}>
                      {tx.address || '—'}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-slate-800 border-r border-slate-100 whitespace-nowrap">
                      {formatPHP(tx.grossAmount)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-slate-500 border-r border-slate-100 whitespace-nowrap">
                      {tx.exemptAmount ? formatPHP(tx.exemptAmount) : '—'}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-slate-500 border-r border-slate-100 whitespace-nowrap">
                      {tx.zeroRatedAmount ? formatPHP(tx.zeroRatedAmount) : '—'}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono font-medium text-slate-900 border-r border-slate-100 whitespace-nowrap">
                      {formatPHP(tx.taxableAmount)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono font-bold text-amber-800 bg-amber-50/40 whitespace-nowrap">
                      {formatPHP(tx.taxAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-slate-900 text-white font-bold border-t-2 border-slate-800">
                <tr>
                  <td colSpan={6} className="py-2.5 px-3 uppercase text-[11px] tracking-wider border-r border-slate-800">
                    Totals ({filteredTotals.count} record{filteredTotals.count === 1 ? '' : 's'})
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono text-slate-200 border-r border-slate-800 whitespace-nowrap">
                    {formatPHP(filteredTotals.gross)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono text-slate-300 border-r border-slate-800 whitespace-nowrap">
                    {formatPHP(filteredTotals.exempt)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono text-slate-300 border-r border-slate-800 whitespace-nowrap">
                    {formatPHP(filteredTotals.zeroRated)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono text-white text-sm border-r border-slate-800 whitespace-nowrap">
                    {formatPHP(filteredTotals.taxable)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono text-amber-300 text-sm bg-amber-950/60 whitespace-nowrap">
                    {formatPHP(filteredTotals.inputTax)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600">
            Showing <span className="font-semibold text-slate-900">{filteredTotals.count}</span> of{' '}
            <span className="font-semibold text-slate-900">{overallTotals.count}</span> recorded purchase transactions
          </div>
          <button
            type="button"
            id="close-combined-purchases-btn"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

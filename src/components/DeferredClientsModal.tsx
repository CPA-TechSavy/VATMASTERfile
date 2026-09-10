import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, Search, Users, Calendar, AlertCircle } from 'lucide-react';
import { ClientProfile, Quarter } from '../types/tax';
import { DeferredClientRecord, QuarterlyDeferralDetail } from '../utils/deferralTracker';
import { formatPHP } from '../utils/formatters';
import { exportDeferredClientsListPdf } from '../utils/pdfExport';

interface DeferredClientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientProfile;
  year: number;
  currentQuarter: Quarter;
  deferredClients: DeferredClientRecord[];
  quarterlyBreakdown: QuarterlyDeferralDetail[];
  accumulatedPriorTaxable: number;
  accumulatedPriorVatDue: number;
}

export const DeferredClientsModal: React.FC<DeferredClientsModalProps> = ({
  isOpen,
  onClose,
  client,
  year,
  currentQuarter,
  deferredClients,
  quarterlyBreakdown,
  accumulatedPriorTaxable,
  accumulatedPriorVatDue,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const filteredClients = deferredClients.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.registeredName.toLowerCase().includes(term) ||
      (c.tin && c.tin.toLowerCase().includes(term)) ||
      c.branchName.toLowerCase().includes(term) ||
      c.quarter.toLowerCase().includes(term)
    );
  });

  const totalSpecificTaxable = deferredClients.reduce((sum, c) => sum + (c.taxableAmount || 0), 0);
  const totalSpecificVatDue = deferredClients.reduce((sum, c) => sum + (c.taxAmount || 0), 0);

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      await exportDeferredClientsListPdf({
        client,
        year,
        currentQuarter,
        deferredClients,
        quarterlyBreakdown,
        accumulatedPriorTaxable,
        accumulatedPriorVatDue,
      });
    } catch (err) {
      console.error('Failed to export deferred clients PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div
        id="deferred-clients-modal"
        className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Deferred Clients List
                </h3>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-violet-100 text-violet-800">
                  Taxable Year {year} (Q1 to {currentQuarter})
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {client.registeredName || client.tradeName} • TIN: {client.tin} • RDO: {client.rdo}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="download-deferred-clients-pdf-btn"
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-violet-700 hover:bg-violet-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Generating PDF...' : 'Download PDF Report'}</span>
            </button>
            <button
              id="close-deferred-clients-modal-btn"
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="p-6 bg-slate-50/50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Deferred Clients (YTD)
            </div>
            <div className="text-2xl font-black text-violet-900 mt-1">
              {deferredClients.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Across all branches from Q1 to {currentQuarter}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Specific Taxable Sales
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 mt-1">
              {formatPHP(totalSpecificTaxable)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Accumulated customer taxable base
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-violet-700">
              Specific Output Tax Deferral
            </div>
            <div className="text-lg font-bold font-mono text-violet-800 mt-1">
              {formatPHP(totalSpecificVatDue)}
            </div>
            <div className="text-[11px] text-violet-600 mt-0.5">
              12% VAT Due withheld/deferred
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-2xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Prior Quarters Running Balance
            </div>
            <div className="text-lg font-bold font-mono text-emerald-900 mt-1">
              {formatPHP(accumulatedPriorTaxable)}
            </div>
            <div className="text-[11px] text-emerald-700 mt-0.5">
              VAT Due: {formatPHP(accumulatedPriorVatDue)}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                id="search-deferred-clients-input"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by customer name, TIN, branch, or quarter..."
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-hidden"
              />
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Showing {filteredClients.length} of {deferredClients.length} deferred client transactions
            </span>
          </div>

          {/* Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2.5 w-10 text-center">#</th>
                    <th className="px-3.5 py-2.5 w-24 text-center">Quarter</th>
                    <th className="px-3.5 py-2.5 w-36">Branch</th>
                    <th className="px-3.5 py-2.5">Registered Customer Name</th>
                    <th className="px-3.5 py-2.5 w-32">TIN</th>
                    <th className="px-3.5 py-2.5 w-32 text-right">Taxable Sales</th>
                    <th className="px-3.5 py-2.5 w-32 text-right">VAT Due (12%)</th>
                    <th className="px-3.5 py-2.5 w-24 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredClients.length > 0 ? (
                    filteredClients.map((c, idx) => (
                      <tr key={`${c.quarter}-${c.branchId}-${c.tin}-${idx}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3.5 py-2.5 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="px-3.5 py-2.5 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-100 text-violet-800">
                            {c.quarter} {c.year}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600 font-medium truncate max-w-[140px]">{c.branchName}</td>
                        <td className="px-3.5 py-2.5 text-slate-900 font-semibold">{c.registeredName}</td>
                        <td className="px-3.5 py-2.5 font-mono text-slate-600 text-[11px]">{c.tin || 'N/A'}</td>
                        <td className="px-3.5 py-2.5 font-mono text-slate-900 text-right font-medium">
                          {formatPHP(c.taxableAmount)}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-violet-700 text-right font-bold">
                          {formatPHP(c.taxAmount)}
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            Deferred
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                        {deferredClients.length === 0 ? (
                          <div className="flex flex-col items-center justify-center gap-2">
                            <AlertCircle className="w-6 h-6 text-slate-300" />
                            <p className="text-sm font-medium">No specific clients have been deferred yet in taxable year {year}.</p>
                            <p className="text-xs text-slate-400">
                              Specific deferrals selected in any quarter from Q1 up to {currentQuarter} will appear here.
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm">No clients match your search query "{searchTerm}".</p>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            {filteredClients.length > 0 && (
              <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">Total Displayed Deferrals:</span>
                <div className="flex items-center gap-6">
                  <span>
                    Taxable Sales:{' '}
                    <strong className="font-mono text-slate-900">
                      {formatPHP(filteredClients.reduce((sum, c) => sum + (c.taxableAmount || 0), 0))}
                    </strong>
                  </span>
                  <span>
                    VAT Due:{' '}
                    <strong className="font-mono text-violet-700">
                      {formatPHP(filteredClients.reduce((sum, c) => sum + (c.taxAmount || 0), 0))}
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quarterly breakdown card */}
          {quarterlyBreakdown.length > 0 && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Quarterly Cumulative Deferrals Breakdown (Taxable Year {year})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {quarterlyBreakdown.map((qb) => (
                  <div key={qb.quarter} className="bg-white p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-slate-900">{qb.quarter} {qb.year}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {qb.clientCount} clients
                      </span>
                    </div>
                    <div className="space-y-1 text-[11px] text-slate-600 font-mono">
                      <div className="flex justify-between">
                        <span>Taxable:</span>
                        <span className="text-slate-900 font-semibold">{formatPHP(qb.totalTaxable)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>VAT Due:</span>
                        <span className="text-violet-700 font-bold">{formatPHP(qb.totalVatDue)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Accumulation period: Beginning of Taxable Year ({year}) through {currentQuarter}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

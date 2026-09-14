import React, { useState, useRef, useEffect } from 'react';
import { ClientProfile } from '../types/tax';
import { SawtRecord, SawtSummary, SawtHistoryItem } from '../types/sawt';
import { parseSawtExcelFile, downloadSawtExcelTemplate } from '../utils/sawtParser';
import { formatPHP } from '../utils/formatters';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Building2,
  Trash2,
  Search,
  ArrowRight,
  RotateCcw,
  History,
  ChevronDown,
  ChevronRight,
  Eye,
  Calendar,
} from 'lucide-react';

interface SawtUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientProfile;
  year: number;
  currentCwtValue: number;
  onApplyCwt: (totalCwt: number, summary: SawtSummary) => void;
  existingSummary?: SawtSummary | null;
  onClearSummary?: () => void;
}

export const SawtUploadModal: React.FC<SawtUploadModalProps> = ({
  isOpen,
  onClose,
  client,
  year,
  currentCwtValue,
  onApplyCwt,
  existingSummary,
  onClearSummary,
}) => {
  const [summary, setSummary] = useState<SawtSummary | null>(existingSummary || null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'records' | 'atc' | 'quarters' | 'history'>('records');
  const [isDragOver, setIsDragOver] = useState(false);
  const [expandedTin, setExpandedTin] = useState<string | null>(null);

  const historyStorageKey = `bir_sawt_history_${client.id}_${year}`;
  const [history, setHistory] = useState<SawtHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(historyStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync when existingSummary changes
  useEffect(() => {
    if (existingSummary) {
      setSummary(existingSummary);
    }
  }, [existingSummary]);

  // If no summary but history exists, default to the latest history item if available
  useEffect(() => {
    if (!summary && history.length > 0 && !existingSummary) {
      const activeItem = history.find((h) => h.isActive) || history[0];
      if (activeItem) {
        setSummary(activeItem.summary);
      }
    }
  }, [history]);

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    if (!file) return;
    setIsLoading(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const parsed = parseSawtExcelFile(buffer, file.name);

        // Create new history entry
        const newHistoryItem: SawtHistoryItem = {
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          uploadedAt: new Date().toLocaleString('en-PH', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          fileName: file.name,
          totalCwtAmount: parsed.totalCwtAmount,
          totalGrossAmount: parsed.totalGrossAmount,
          totalRecords: parsed.totalRecords,
          uniquePayorsCount: parsed.uniquePayorsCount,
          summary: parsed,
          isActive: true,
        };

        // Prepend new upload and retain all previous uploads
        const updatedHistory = [
          newHistoryItem,
          ...history.map((h) => ({ ...h, isActive: false })),
        ];

        setHistory(updatedHistory);
        try {
          localStorage.setItem(historyStorageKey, JSON.stringify(updatedHistory));
        } catch (storageErr) {
          console.warn('Failed to save SAWT history to localStorage:', storageErr);
        }

        setSummary(parsed);
        setActiveTab('records');
      } catch (err: any) {
        console.error('Error parsing SAWT file:', err);
        setErrorMessage(
          err.message || 'Failed to parse the uploaded Excel file. Please ensure it follows the SAWT format.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorMessage('Failed to read the uploaded file.');
      setIsLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleApply = (customSummary?: SawtSummary) => {
    const target = customSummary || summary;
    if (target) {
      // Mark as active in history
      const updatedHistory = history.map((h) => ({
        ...h,
        isActive: h.summary.fileName === target.fileName && h.summary.totalCwtAmount === target.totalCwtAmount,
      }));
      setHistory(updatedHistory);
      try {
        localStorage.setItem(historyStorageKey, JSON.stringify(updatedHistory));
      } catch (storageErr) {
        console.warn('Failed to update SAWT history active flag:', storageErr);
      }

      onApplyCwt(target.totalCwtAmount, target);
      onClose();
    }
  };

  const handleClear = () => {
    setSummary(null);
    if (onClearSummary) {
      onClearSummary();
    }
    setErrorMessage(null);
  };

  const handleSelectHistoricalFile = (item: SawtHistoryItem, shouldApply = false) => {
    setSummary(item.summary);
    if (shouldApply) {
      handleApply(item.summary);
    } else {
      setActiveTab('records');
    }
  };

  const handleDeleteHistoricalFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(updated));
    } catch (storageErr) {
      console.warn('Failed to delete SAWT history item:', storageErr);
    }
  };

  const toggleExpandTin = (tin: string) => {
    setExpandedTin((prev) => (prev === tin ? null : tin));
  };

  const filteredRecords = (summary?.records || []).filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.payorName.toLowerCase().includes(q) ||
      r.payorTin.toLowerCase().includes(q) ||
      r.atcCode.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold">SAWT Excel Reader & Form 2307 CWT</h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                  BIR Form 2307
                </span>
                {history.length > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-700 text-slate-300 rounded-full">
                    {history.length} saved {history.length === 1 ? 'file' : 'files'}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-300 mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-white">{client.registeredName}</span>
                <span className="text-slate-500">•</span>
                <span className="font-mono text-slate-300">TIN: {client.tin}</span>
                <span className="text-slate-500">•</span>
                <span>Taxable Year {year}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadSawtExcelTemplate(client, year)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/80 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl border border-slate-600 transition-colors cursor-pointer"
              title="Download BIR SAWT Excel template starting at Row 16"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download Template</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 bg-slate-50/50">
          {/* Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`p-5 rounded-2xl border-2 border-dashed transition-all text-center ${
              isDragOver
                ? 'border-emerald-500 bg-emerald-50/50'
                : 'border-slate-300 bg-white hover:border-slate-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls"
              onChange={handleInputChange}
              className="hidden"
              id="sawt-file-input"
            />

            <div className="flex flex-col items-center justify-center space-y-2.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shadow-xs">
                <Upload className="w-6 h-6" />
              </div>

              <div>
                <p className="text-sm font-bold text-slate-800">
                  Upload Official SAWT Excel File (.xlsx, .xls)
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Drag and drop your client's SAWT Excel schedule here, or click to browse.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1 flex-wrap justify-center">
                <button
                  type="button"
                  id="browse-sawt-file-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{isLoading ? 'Processing SAWT...' : 'Select SAWT Excel File'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => downloadSawtExcelTemplate(client, year)}
                  className="sm:hidden px-3 py-2 bg-white border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl shadow-xs hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Template</span>
                </button>
              </div>
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="flex items-start gap-2 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Upload Notice: </span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Parsed Summary Content */}
          {summary && (
            <div className="space-y-4">
              {/* File Info & Quick Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white border border-slate-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800">{summary.fileName}</span>
                    <span className="text-slate-400 font-mono ml-2">({summary.uploadDate})</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClear}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Active</span>
                  </button>
                </div>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Form 2307 CWT (Full Year)
                  </div>
                  <div className="text-xl font-bold font-mono text-emerald-950 mt-1">
                    ₱{formatPHP(summary.totalCwtAmount, false)}
                  </div>
                  <div className="text-[10px] text-emerald-700 mt-0.5">Creditable Tax Withheld</div>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Income Payment Base
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-800 mt-1">
                    ₱{formatPHP(summary.totalGrossAmount, false)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Gross Transactions</div>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Customer TINs
                  </div>
                  <div className="text-xl font-bold font-mono text-blue-600 mt-1">
                    {summary.uniquePayorsCount}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Consolidated Customers</div>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Certificates Count
                  </div>
                  <div className="text-xl font-bold font-mono text-purple-600 mt-1">
                    {summary.totalRecords}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Total SAWT Line Items</div>
                </div>
              </div>

              {/* Comparison with Current Form Value */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <span className="font-semibold">Current Form Part III CWT: </span>
                    <span className="font-mono font-bold text-slate-700">₱{formatPHP(currentCwtValue, false)}</span>
                    <span className="mx-2 text-slate-400">•</span>
                    <span className="font-semibold">SAWT Computed CWT: </span>
                    <span className="font-mono font-bold text-emerald-700">₱{formatPHP(summary.totalCwtAmount, false)}</span>
                  </div>
                </div>
                <div className="text-blue-700 font-medium">
                  {summary.totalCwtAmount === currentCwtValue
                    ? '✓ In exact sync with Form 2307'
                    : `Variance: ₱${formatPHP(Math.abs(summary.totalCwtAmount - currentCwtValue), false)}`}
                </div>
              </div>

              {/* Sub-view Navigation Tabs */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setActiveTab('records')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'records'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Customers by TIN ({summary.records.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('atc')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'atc'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    ATC Breakdown ({Object.keys(summary.atcBreakdown).length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('quarters')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'quarters'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Quarterly Schedule
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'history'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Upload History ({history.length})</span>
                  </button>
                </div>

                {activeTab === 'records' && (
                  <div className="relative w-48 sm:w-60">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search TIN, Customer..."
                      className="w-full pl-8 pr-3 py-1 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Tab 1: Consolidated Records by Customer TIN */}
              {activeTab === 'records' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100/80 sticky top-0 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-10">#</th>
                          <th className="py-2.5 px-3">Customer TIN</th>
                          <th className="py-2.5 px-3">Withholding Agent / Customer Name</th>
                          <th className="py-2.5 px-2 text-center">Certificates</th>
                          <th className="py-2.5 px-2 text-center">ATC</th>
                          <th className="py-2.5 px-3 text-right">Total Gross Income</th>
                          <th className="py-2.5 px-2 text-right">Eff. Rate</th>
                          <th className="py-2.5 px-3 text-right">Total 2307 CWT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                        {filteredRecords.map((rec) => {
                          const hasMulti = (rec.transactionCount || 1) > 1;
                          const isExpanded = expandedTin === rec.payorTin;

                          return (
                            <React.Fragment key={rec.id}>
                              <tr
                                onClick={() => hasMulti && toggleExpandTin(rec.payorTin)}
                                className={`transition-colors ${
                                  hasMulti ? 'cursor-pointer hover:bg-slate-50/90' : 'hover:bg-slate-50/60'
                                }`}
                              >
                                <td className="py-2 px-3 text-center text-slate-400">
                                  {hasMulti ? (
                                    <span className="inline-flex items-center justify-center">
                                      {isExpanded ? (
                                        <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
                                      ) : (
                                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                      )}
                                    </span>
                                  ) : (
                                    rec.seqNo
                                  )}
                                </td>
                                <td className="py-2 px-3 font-bold text-slate-800">
                                  {rec.payorTin}
                                </td>
                                <td className="py-2 px-3 font-sans text-slate-800">
                                  <div className="font-semibold truncate max-w-[200px]" title={rec.payorName}>
                                    {rec.payorName}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate max-w-[200px]" title={rec.description}>
                                    {rec.description}
                                  </div>
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                      hasMulti
                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                  >
                                    {rec.transactionCount || 1} { (rec.transactionCount || 1) === 1 ? 'cert' : 'certs' }
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200">
                                    {rec.atcCode}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right text-slate-600">
                                  {formatPHP(rec.grossAmount, false)}
                                </td>
                                <td className="py-2 px-2 text-right text-slate-500">
                                  {rec.taxRate}%
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-emerald-700">
                                  {formatPHP(rec.cwtAmount, false)}
                                </td>
                              </tr>

                              {/* Nested sub-transactions for multi-certificate customers */}
                              {hasMulti && isExpanded && rec.rawTransactions && (
                                <tr className="bg-slate-50/80">
                                  <td colSpan={8} className="p-3 pl-8">
                                    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-xs">
                                      <div className="px-3 py-1.5 bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                                        <span>Consolidated Form 2307 Certificates for TIN {rec.payorTin}</span>
                                        <span>{rec.rawTransactions.length} individual entries</span>
                                      </div>
                                      <table className="w-full text-left text-[11px] border-collapse font-mono">
                                        <thead className="border-b border-slate-100 text-slate-500 text-[9px] uppercase bg-slate-50">
                                          <tr>
                                            <th className="py-1 px-3">Period</th>
                                            <th className="py-1 px-3">ATC</th>
                                            <th className="py-1 px-3">Description</th>
                                            <th className="py-1 px-3 text-right">Gross Income</th>
                                            <th className="py-1 px-3 text-right">Rate</th>
                                            <th className="py-1 px-3 text-right">Tax Withheld</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {rec.rawTransactions.map((tx, idx) => (
                                            <tr key={tx.id || idx} className="hover:bg-slate-50">
                                              <td className="py-1 px-3 font-semibold text-slate-700">{tx.taxablePeriod || '—'}</td>
                                              <td className="py-1 px-3 text-slate-600">{tx.atcCode}</td>
                                              <td className="py-1 px-3 font-sans text-slate-600 truncate max-w-[180px]">{tx.description}</td>
                                              <td className="py-1 px-3 text-right text-slate-600">{formatPHP(tx.grossAmount, false)}</td>
                                              <td className="py-1 px-3 text-right text-slate-500">{tx.taxRate}%</td>
                                              <td className="py-1 px-3 text-right font-bold text-emerald-700">{formatPHP(tx.cwtAmount, false)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 px-4">
                    <span>
                      Showing {filteredRecords.length} unique customer(s) from {summary.totalRecords} total line items
                    </span>
                    <span className="font-semibold text-slate-800">
                      Total 2307 CWT: <strong className="text-emerald-700 font-mono">₱{formatPHP(summary.totalCwtAmount, false)}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Tab 2: ATC Breakdown */}
              {activeTab === 'atc' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden p-4 space-y-3">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Alphanumeric Tax Codes (ATC) Summary
                  </div>
                  <div className="space-y-2">
                    {Object.entries(summary.atcBreakdown).map(
                      ([code, item]: [string, { description: string; gross: number; cwt: number; count: number }]) => (
                        <div
                          key={code}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-bold font-mono text-xs">
                              {code}
                            </span>
                            <div>
                              <div className="font-semibold text-slate-800">{item.description}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {item.count} transaction(s) • Gross: ₱{formatPHP(item.gross, false)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] text-slate-400 font-medium">Creditable Tax</div>
                            <div className="font-mono font-bold text-emerald-700 text-sm">
                              ₱{formatPHP(item.cwt, false)}
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Quarterly Schedule */}
              {activeTab === 'quarters' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => {
                    const qData = summary.quarterlyBreakdown[q];
                    return (
                      <div key={q} className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                            {q} Withholding Tax
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            {qData.count} item(s)
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-600">
                          <span>Income Base:</span>
                          <span className="font-mono">₱{formatPHP(qData.gross, false)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-800 font-bold border-t border-slate-100 pt-1.5">
                          <span>Form 2307 CWT:</span>
                          <span className="font-mono text-emerald-700">₱{formatPHP(qData.cwt, false)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tab 4: Upload History Tab */}
              {activeTab === 'history' && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        SAWT Upload History & Stored Files
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Previous SAWT uploads remain preserved. You can inspect or re-apply any file to Form 2307 CWT anytime.
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-semibold font-mono text-xs rounded-lg border border-slate-200">
                      {history.length} file{history.length === 1 ? '' : 's'} preserved
                    </span>
                  </div>

                  {history.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                      No previous SAWT files in history yet. Upload a file above to begin tracking.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto">
                      {history.map((item) => {
                        const isCurrent =
                          summary &&
                          summary.fileName === item.summary.fileName &&
                          summary.totalCwtAmount === item.summary.totalCwtAmount;

                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isCurrent
                                ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-200'
                                : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs text-slate-800">
                                  {item.fileName}
                                </span>
                                {isCurrent ? (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-600 text-white rounded-md flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Active Return CWT
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-200 text-slate-600 rounded-md">
                                    Preserved History
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  {item.uploadedAt}
                                </span>
                                <span>•</span>
                                <span>{item.uniquePayorsCount} customers</span>
                                <span>•</span>
                                <span>{item.totalRecords} certificates</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 justify-between sm:justify-end">
                              <div className="text-right">
                                <div className="text-[10px] uppercase font-medium text-slate-400">Total 2307 CWT</div>
                                <div className="font-mono font-bold text-sm text-emerald-700">
                                  ₱{formatPHP(item.totalCwtAmount, false)}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSelectHistoricalFile(item, false)}
                                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Inspect extracted data in tabs"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Inspect</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSelectHistoricalFile(item, true)}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="Apply this file's CWT to the tax return"
                                >
                                  <span>Apply</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteHistoricalFile(item.id, e)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Remove this file from history"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Fallback if no active summary but history exists */}
          {!summary && history.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Previously Uploaded SAWT Files
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Select any file below to inspect its data or apply it to Form 2307 CWT.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 hover:bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-800">{item.fileName}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {item.uploadedAt} • {item.uniquePayorsCount} customers • {item.totalRecords} line items
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="font-mono font-bold text-sm text-emerald-700">
                        ₱{formatPHP(item.totalCwtAmount, false)}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectHistoricalFile(item, false)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                      >
                        Inspect
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectHistoricalFile(item, true)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
                      >
                        Apply CWT
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {summary ? (
              <span>
                Ready to update Form 2307 CWT (Full Year) to{' '}
                <strong className="text-emerald-700 font-mono font-bold">
                  ₱{formatPHP(summary.totalCwtAmount, false)}
                </strong>
              </span>
            ) : (
              <span>Upload your client's SAWT Excel file to automatically calculate Full Year CWT.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {summary && (
              <button
                type="button"
                id="apply-sawt-cwt-btn"
                onClick={() => handleApply()}
                className="flex-1 sm:flex-none px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Apply ₱{formatPHP(summary.totalCwtAmount, false)} to Form 2307 CWT</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { X, Building2, User, Trash2, Calendar, Info } from 'lucide-react';
import { ClientProfile, TaxClassification, VatStatus, TaxableYearType } from '../types/tax';
import { formatTIN } from '../utils/formatters';
import { BIR_RDO_LIST } from '../data/rdoList';
import { MONTH_NAMES_FULL, MONTH_END_DAYS, calculate60DaysAfterMonthEnd } from '../utils/taxDeadlines';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (client: ClientProfile) => void;
  onDelete?: (clientId: string) => void;
  clientToEdit?: ClientProfile | null;
}

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  clientToEdit,
}) => {
  const [tradeName, setTradeName] = useState('');
  const [registeredName, setRegisteredName] = useState('');
  const [tin, setTin] = useState('');
  const [rdo, setRdo] = useState('');
  const [classification, setClassification] = useState<TaxClassification>('Corporation');
  const [vatStatus, setVatStatus] = useState<VatStatus>('vat-registered');
  const [isWithholdingAgent, setIsWithholdingAgent] = useState(false);
  const [hasBranches, setHasBranches] = useState(false);
  const [taxableYearType, setTaxableYearType] = useState<TaxableYearType>('calendar');
  const [fiscalYearEndMonth, setFiscalYearEndMonth] = useState<number>(6); // Default to June
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (clientToEdit) {
      setTradeName(clientToEdit.tradeName);
      setRegisteredName(clientToEdit.registeredName);
      setTin(clientToEdit.tin);
      setRdo(clientToEdit.rdo);
      setClassification(clientToEdit.classification);
      setVatStatus(clientToEdit.vatStatus);
      setIsWithholdingAgent(clientToEdit.isWithholdingAgent);
      setHasBranches(Boolean(clientToEdit.hasBranches));
      setTaxableYearType(clientToEdit.taxableYearType || 'calendar');
      setFiscalYearEndMonth(clientToEdit.fiscalYearEndMonth || 6);
      setNotes(clientToEdit.notes || '');
    } else {
      setTradeName('');
      setRegisteredName('');
      setTin('');
      setRdo('RDO 98 - West Misamis Oriental');
      setClassification('Corporation');
      setVatStatus('vat-registered');
      setIsWithholdingAgent(false);
      setHasBranches(false);
      setTaxableYearType('calendar');
      setFiscalYearEndMonth(6);
      setNotes('');
    }
  }, [clientToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradeName.trim()) return;

    const newClient: ClientProfile = {
      id: clientToEdit ? clientToEdit.id : `client-${Date.now()}`,
      tradeName: tradeName.trim(),
      registeredName: registeredName.trim() || tradeName.trim(),
      tin: tin.trim() || '000-000-000-000',
      rdo: rdo.trim() || 'RDO 000',
      classification,
      vatStatus,
      isWithholdingAgent,
      hasBranches,
      taxableYearType,
      fiscalYearEndMonth: taxableYearType === 'fiscal' ? fiscalYearEndMonth : 12,
      notes: notes.trim(),
    };

    onSave(newClient);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div
        id="client-modal-card"
        className="w-full max-w-xl rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            {classification.startsWith('corp') ? (
              <Building2 className="w-5 h-5 text-indigo-600" />
            ) : (
              <User className="w-5 h-5 text-indigo-600" />
            )}
            <h2 className="text-lg font-semibold text-slate-900">
              {clientToEdit ? 'Edit Client Record' : 'Register New Client'}
            </h2>
          </div>
          <button
            id="close-client-modal-btn"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Trade Name / Business Name *
              </label>
              <input
                id="client-trade-name-input"
                type="text"
                required
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="e.g. Apex Logistics"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Registered Taxpayer Name
              </label>
              <input
                id="client-reg-name-input"
                type="text"
                value={registeredName}
                onChange={(e) => setRegisteredName(e.target.value)}
                placeholder="e.g. Apex Logistics Corp."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                TIN (12 Digits)
              </label>
              <input
                id="client-tin-input"
                type="text"
                value={tin}
                onChange={(e) => setTin(formatTIN(e.target.value))}
                placeholder="000-000-000-000"
                maxLength={15}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                RDO (Revenue District Office)
              </label>
              <select
                id="client-rdo-select"
                value={rdo}
                onChange={(e) => setRdo(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {!BIR_RDO_LIST.includes(rdo) && rdo && (
                  <option value={rdo}>{rdo}</option>
                )}
                {BIR_RDO_LIST.map((rdoOption) => (
                  <option key={rdoOption} value={rdoOption}>
                    {rdoOption}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Tax Classification
              </label>
              <select
                id="client-classification-select"
                value={classification}
                onChange={(e) => {
                  const val = e.target.value as TaxClassification;
                  setClassification(val);
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="Corporation">Corporation</option>
                <option value="Non-Stock">Non-Stock</option>
                <option value="Partnership">Partnership</option>
                <option value="Single">Single</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                VAT Registration
              </label>
              <select
                id="client-vat-select"
                value={vatStatus}
                onChange={(e) => setVatStatus(e.target.value as VatStatus)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="non-vat">Non-VAT (Percentage Tax - Form 2551Q)</option>
                <option value="vat-registered">VAT-Registered (12% VAT - Form 2550Q)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Branch Structure
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                id="client-mode-single-unit-btn"
                onClick={() => setHasBranches(false)}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left text-xs transition-all ${
                  !hasBranches
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-semibold ring-1 ring-indigo-600'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50'
                }`}
              >
                <Building2 className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-xs">No Branch (Single Unit)</p>
                  <p className="text-[11px] text-slate-500 font-normal">Head office only; no branch additions</p>
                </div>
              </button>

              <button
                type="button"
                id="client-mode-has-branches-btn"
                onClick={() => setHasBranches(true)}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left text-xs transition-all ${
                  hasBranches
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-semibold ring-1 ring-indigo-600'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50'
                }`}
              >
                <Building2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-xs">Has Branches</p>
                  <p className="text-[11px] text-slate-500 font-normal">Multiple branches or lines of business</p>
                </div>
              </button>
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 select-none">
              <input
                id="client-withholding-checkbox"
                type="checkbox"
                checked={isWithholdingAgent}
                onChange={(e) => setIsWithholdingAgent(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium">Withholding Agent</span>
              <span className="text-xs text-slate-500">(Required to file 1601-C / 0619-E)</span>
            </label>
          </div>

          {/* Taxable Year Basis: Calendar Year vs Fiscal Year */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                Taxable Year Period
              </label>
              <span className="text-[11px] font-mono text-slate-500">Sec. 43 NIRC</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                id="tax-year-calendar-btn"
                onClick={() => setTaxableYearType('calendar')}
                className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${
                  taxableYearType === 'calendar'
                    ? 'border-indigo-600 bg-white text-indigo-950 font-semibold ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white/70'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                    taxableYearType === 'calendar' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-400'
                  }`}
                >
                  {taxableYearType === 'calendar' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Calendar Year (Ending Dec 31)</p>
                  <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                    Standard taxable year (Jan 1 to Dec 31). Annual ITR due on April 15.
                  </p>
                </div>
              </button>

              <button
                type="button"
                id="tax-year-fiscal-btn"
                onClick={() => setTaxableYearType('fiscal')}
                className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${
                  taxableYearType === 'fiscal'
                    ? 'border-indigo-600 bg-white text-indigo-950 font-semibold ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white/70'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                    taxableYearType === 'fiscal' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-400'
                  }`}
                >
                  {taxableYearType === 'fiscal' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Fiscal Year (Ending Another Month)</p>
                  <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                    12-month period closing on the last day of any month other than December.
                  </p>
                </div>
              </button>
            </div>

            {taxableYearType === 'fiscal' && (
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div>
                  <label htmlFor="fiscal-year-end-select" className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Fiscal Year Closing Month:
                  </label>
                  <select
                    id="fiscal-year-end-select"
                    value={fiscalYearEndMonth}
                    onChange={(e) => setFiscalYearEndMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((m) => {
                      const aitrMonth = ((m - 1 + 4) % 12) + 1;
                      return (
                        <option key={m} value={m}>
                          Ending {MONTH_NAMES_FULL[m - 1]} {MONTH_END_DAYS[m - 1]} &nbsp;— (Annual AITR Form 1702 Due: {MONTH_NAMES_FULL[aitrMonth - 1]} 15)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Live calculation preview of adjusted BIR deadlines */}
                <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs space-y-1.5">
                  <p className="font-semibold text-indigo-900 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    Calculated Statutory BIR Deadlines for Fiscal Year Ending {MONTH_NAMES_FULL[fiscalYearEndMonth - 1]} {MONTH_END_DAYS[fiscalYearEndMonth - 1]}:
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-700">
                    <div>
                      <span className="text-slate-500">Annual AITR (1702):</span>{' '}
                      <strong className="text-indigo-900">
                        {MONTH_NAMES_FULL[((fiscalYearEndMonth - 1 + 4) % 12)]} 15
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">eAFS Submission:</span>{' '}
                      <strong className="text-indigo-900">
                        {MONTH_NAMES_FULL[((fiscalYearEndMonth - 1 + 4) % 12)]} {MONTH_END_DAYS[((fiscalYearEndMonth - 1 + 4) % 12)]}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">1st Quarter (1702Q):</span>{' '}
                      <strong className="text-indigo-900">
                        {(() => {
                          const q1End = ((fiscalYearEndMonth - 1 + 3) % 12) + 1;
                          const due = calculate60DaysAfterMonthEnd(2026, q1End);
                          return `${MONTH_NAMES_FULL[due.dueMonth - 1]} ${due.dueDay}`;
                        })()}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">2nd Quarter (1702Q):</span>{' '}
                      <strong className="text-indigo-900">
                        {(() => {
                          const q2End = ((fiscalYearEndMonth - 1 + 6) % 12) + 1;
                          const due = calculate60DaysAfterMonthEnd(2026, q2End);
                          return `${MONTH_NAMES_FULL[due.dueMonth - 1]} ${due.dueDay}`;
                        })()}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">3rd Quarter (1702Q):</span>{' '}
                      <strong className="text-indigo-900">
                        {(() => {
                          const q3End = ((fiscalYearEndMonth - 1 + 9) % 12) + 1;
                          const due = calculate60DaysAfterMonthEnd(2026, q3End);
                          return `${MONTH_NAMES_FULL[due.dueMonth - 1]} ${due.dueDay}`;
                        })()}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Quarterly VAT (2550Q):</span>{' '}
                      <strong className="text-indigo-900">25th of month after each fiscal quarter</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Internal Client Notes / Details
            </label>
            <input
              id="client-notes-input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Retainer client, quarterly filing deadlines, bookkeeper in charge"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200">
            {clientToEdit && onDelete ? (
              <button
                id="delete-client-modal-btn"
                type="button"
                onClick={() => {
                  onDelete(clientToEdit.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Delete Client</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <button
                id="cancel-client-btn"
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                id="save-client-btn"
                type="submit"
                className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
              >
                {clientToEdit ? 'Save Changes' : 'Create Client'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

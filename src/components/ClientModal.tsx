import React, { useState, useEffect } from 'react';
import { X, Building2, User, Trash2 } from 'lucide-react';
import { ClientProfile, TaxClassification, VatStatus } from '../types/tax';
import { formatTIN } from '../utils/formatters';

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
      setNotes(clientToEdit.notes || '');
    } else {
      setTradeName('');
      setRegisteredName('');
      setTin('');
      setRdo('RDO 044 - Taguig / Pateros');
      setClassification('Corporation');
      setVatStatus('vat-registered');
      setIsWithholdingAgent(false);
      setHasBranches(false);
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
              <input
                id="client-rdo-input"
                type="text"
                value={rdo}
                onChange={(e) => setRdo(e.target.value)}
                placeholder="e.g. RDO 044 - Taguig / Pateros"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
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

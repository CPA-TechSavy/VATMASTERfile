import React, { useState } from 'react';
import {
  Download,
  Monitor,
  CheckCircle2,
  ExternalLink,
  X,
  FileCode,
  ShieldCheck,
  Zap,
  Info,
  Laptop,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const {
    isInstallable,
    isInstalled,
    isInIframe,
    isWindows,
    install,
    downloadDesktopShortcut,
  } = usePWAInstall();

  const [installSuccess, setInstallSuccess] = useState(false);
  const [downloadedShortcut, setDownloadedShortcut] = useState(false);

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    const success = await install();
    if (success) {
      setInstallSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2500);
    }
  };

  const handleDownloadShortcut = () => {
    downloadDesktopShortcut();
    setDownloadedShortcut(true);
    setTimeout(() => setDownloadedShortcut(false), 4000);
  };

  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      id="install-pc-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="install-pc-modal-card"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white shadow-inner">
                <Laptop className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Install on PC / Desktop
                  {isInstalled && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Installed ✓
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Run BIR Tax Return Calculator as a standalone desktop application
                </p>
              </div>
            </div>
            <button
              id="close-install-modal-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Key Advantages */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/10 text-xs">
            <div className="flex items-center gap-1.5 text-slate-200">
              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Instant Launch</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>100% Offline Ready</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-200">
              <Monitor className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>Full Window App</span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Status Alert if Already Installed */}
          {isInstalled && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-emerald-900">Application is Installed</p>
                <p className="text-xs text-emerald-700">
                  You are already running this app as a standalone desktop application on your PC.
                </p>
              </div>
            </div>
          )}

          {/* Success Banner if user just installed */}
          {installSuccess && (
            <div className="p-3.5 bg-emerald-500 text-white rounded-xl flex items-center gap-3 text-sm shadow-md animate-in zoom-in-95 duration-200">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold">Installation Successful!</p>
                <p className="text-xs text-emerald-100">
                  The app is now installed on your PC and pinned to your Desktop/Start Menu.
                </p>
              </div>
            </div>
          )}

          {/* Method 1: Native 1-Click Install Button (When available directly) */}
          {isInstallable && !isInstalled && (
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                  Recommended: Instant PC Installation
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-200/60 font-semibold text-indigo-800">
                  1-Click
                </span>
              </div>
              <p className="text-xs text-indigo-700">
                Install as a dedicated Windows/Mac desktop program with full system integration and taskbar shortcut.
              </p>
              <button
                id="btn-pwa-native-install"
                onClick={handleNativeInstall}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Install BIR Calculator to PC</span>
              </button>
            </div>
          )}

          {/* Notice if running inside iframe preview */}
          {isInIframe && !isInstalled && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-semibold text-amber-950">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Running inside Preview Frame</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                Modern desktop browsers (Chrome & Edge) require opening the app in its own browser tab to trigger the direct desktop installation prompt.
              </p>
              <button
                id="btn-open-new-tab-install"
                onClick={handleOpenInNewTab}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Full Tab to Install</span>
              </button>
            </div>
          )}

          {/* Method 2: Browser Address Bar Installation Instructions */}
          {!isInstalled && (
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                How to Install via Chrome or Microsoft Edge on PC:
              </h4>

              <div className="space-y-2.5 text-xs text-slate-600">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                    1
                  </span>
                  <div>
                    <strong className="text-slate-900 font-semibold">Check the Address Bar:</strong>
                    <p className="text-slate-500 mt-0.5">
                      Look at the right side of your browser URL address bar for the{' '}
                      <span className="inline-flex items-center px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-mono text-slate-800">
                        Install / ⊕
                      </span>{' '}
                      icon.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                    2
                  </span>
                  <div>
                    <strong className="text-slate-900 font-semibold">Or use the Browser Menu:</strong>
                    <p className="text-slate-500 mt-0.5">
                      Click the three dots (<span className="font-mono">⋮</span> or{' '}
                      <span className="font-mono">...</span>) in the top-right corner of your browser &rarr;{' '}
                      <span className="font-medium text-slate-800">
                        "Save and share" &rarr; "Install BIR Tax Return Calculator"
                      </span>{' '}
                      (or <span className="font-medium text-slate-800">"Apps" &rarr; "Install this site as an app"</span>).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                    3
                  </span>
                  <div>
                    <strong className="text-slate-900 font-semibold">Confirm Desktop Icon:</strong>
                    <p className="text-slate-500 mt-0.5">
                      Check "Create Desktop Shortcut" and "Pin to Taskbar" for instant 1-click access anytime!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Method 3: Download Direct Desktop Shortcut (.url file) */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-slate-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Direct PC Desktop Shortcut
                </h4>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {isWindows ? '.url (Windows)' : 'Web Shortcut'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Download a ready-to-use desktop shortcut file. Once downloaded, double-click it from your Downloads folder or drag it onto your PC Desktop.
            </p>
            <button
              id="btn-download-desktop-shortcut"
              onClick={handleDownloadShortcut}
              className="w-full py-2 px-3.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-2 transition-colors"
            >
              {downloadedShortcut ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Saved to Downloads folder!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>Download Desktop Shortcut (.url)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Compliant with Progressive Web App (PWA) standards
          </span>
          <button
            id="btn-install-modal-close"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

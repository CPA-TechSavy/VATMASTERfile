import React, { useState } from 'react';
import { Laptop, Download, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { InstallAppModal } from './InstallAppModal';

interface InstallButtonProps {
  className?: string;
}

export const InstallButton: React.FC<InstallButtonProps> = ({ className = '' }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = async () => {
    // If native install prompt is already primed by the browser, invoke it directly
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setIsModalOpen(true);
      }
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <button
        id="btn-install-pc"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-2xs transition-all ${
          isInstalled
            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
            : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs'
        } ${className}`}
        title={
          isInstalled
            ? 'Installed as PC Desktop App'
            : 'Download and install BIR Tax Return Calculator onto your PC'
        }
      >
        {isInstalled ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Installed on PC</span>
            <span className="sm:hidden">Installed</span>
          </>
        ) : (
          <>
            <Laptop className="w-3.5 h-3.5 text-emerald-100" />
            <span className="hidden sm:inline">Download / Install App</span>
            <span className="sm:hidden">Install</span>
            <Download className="w-3 h-3 text-emerald-200 hidden md:inline" />
          </>
        )}
      </button>

      <InstallAppModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

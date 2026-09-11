import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  });
  const [isIOS, setIsIOS] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect iframe environment
    setIsInIframe(window.self !== window.top);

    // Detect standalone mode
    const standaloneMediaQuery = window.matchMedia('(display-mode: standalone)');
    const updateStandalone = (e: MediaQueryListEvent | MediaQueryList) => {
      const standalone = e.matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(standalone);
    };
    updateStandalone(standaloneMediaQuery);

    try {
      standaloneMediaQuery.addEventListener('change', updateStandalone);
    } catch {
      // Fallback for older browsers
      standaloneMediaQuery.addListener(updateStandalone);
    }

    // Platform detection
    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
    setIsWindows(/windows|win32|win64/.test(ua));
    setIsMac(/macintosh|mac os x/.test(ua));

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      try {
        standaloneMediaQuery.removeEventListener('change', updateStandalone);
      } catch {
        standaloneMediaQuery.removeListener(updateStandalone);
      }
    };
  }, []);

  // Trigger browser native install prompt
  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error invoking install prompt:', err);
      return false;
    }
  }, [deferredPrompt]);

  // Download a Windows Desktop shortcut (.url) or Mac/Linux web shortcut
  const downloadDesktopShortcut = useCallback(() => {
    const appUrl = window.location.href;
    const title = 'BIR Tax Return Calculator';

    // Standard Windows .url Internet Shortcut file
    const shortcutContent = `[InternetShortcut]\r\nURL=${appUrl}\r\nIconIndex=0\r\nIconFile=${window.location.origin}/favicon.ico\r\nHotKey=0\r\n[{000214A0-0000-0000-C000-000000000046}]\r\nProp3=19,0\r\n`;

    const blob = new Blob([shortcutContent], { type: 'application/internet-shortcut;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '_')}.url`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isWindows,
    isMac,
    isInIframe,
    install,
    downloadDesktopShortcut,
  };
}

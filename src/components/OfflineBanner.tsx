import React, { useState, useEffect } from 'react';
import { WifiOff, DownloadCloud } from 'lucide-react';

interface OfflineBannerProps {
  savedOfflineCount?: number;
  onOpenOfflineVault?: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ 
  savedOfflineCount = 0,
  onOpenOfflineVault 
}) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-amber-600 text-white text-xs font-semibold px-4 py-2 flex items-center justify-between sticky top-0 z-50 shadow-md">
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-amber-200 animate-pulse" />
        <span>You are currently offline. Browsing locally cached materials and offline study packs.</span>
      </div>
      {onOpenOfflineVault && (
        <button
          onClick={onOpenOfflineVault}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-colors cursor-pointer"
        >
          <DownloadCloud className="w-3.5 h-3.5" />
          <span>Saved Packs ({savedOfflineCount})</span>
        </button>
      )}
    </div>
  );
};
